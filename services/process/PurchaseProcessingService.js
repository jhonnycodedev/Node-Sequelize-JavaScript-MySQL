
const dayjs = require('dayjs'); //npm install dayjs


class PurchaseProcessingService {
    constructor(PurchaseModel, RequisitionModel, ProductModel, ControleProductModel, TitleModel, ControleTitleModel, QuotationModel, SupplierModel, NotaFiscalModel, sequelize) {
        this.Purchase = PurchaseModel;
        this.Requisition = RequisitionModel;
        this.Product = ProductModel;
        this.ControleProduct = ControleProductModel;
        this.Title = TitleModel;
        this.ControleTitle = ControleTitleModel;
        this.Quotation = QuotationModel;
        this.Supplier = SupplierModel;
        this.NotaFiscal = NotaFiscalModel;
        this.sequelize = sequelize;
    }


async create(quantidade, custototal, tipoPagamento, quotationId, userId) {
    const transaction = await this.sequelize.transaction();
    try {
        //---------------------------------------------------------------------------------------//
        // Comprando um produto e inserindo no estoque

       
        // Insere dados na tabela purchase
        const result = await this.Purchase.create(
            { 
                dataCompra: dayjs().format('YYYY-MM-DD'),
                quantidade, 
                custototal, 
                tipoPagamento, 
                quotationId,
                 userId 
            },{ transaction }
        );

        // Procura cotação para pegar id da requisição
        const data = await this.Quotation.findByPk(quotationId, { transaction });

        if (!data) {
            throw new Error('Cotação não encontrada');
        }

        const status = 'Concluida';

        // Atualiza o status da requisição
        const result2 = await this.Requisition.update(
            { status },
            { where: { id: data.requisitionId }, transaction }
        );

        // Recebe dados da requisição para criação de produto
        const result3 = await this.Requisition.findByPk(data.requisitionId, { transaction });

        if (!result3) {
            throw new Error('Requisição não encontrada');
        }
        
        // Criando produto
        const result4 = await this.Product.create(
            { nome: result3.produto_requerido, preco_custo: custototal / quantidade, status: 'ATIVO', supplierId: data.supplierId },
            { transaction }
        );

        // Criando um controle de produto
        const result5 = await this.ControleProduct.create(
            { movimento_tipo: 'Entrada', qtd_disponivel: quantidade, qtd_bloqueado: 0, valor_faturado: 0, productId: result4.id, depositId: 1 },
            { transaction }
        );

        // Definindo quantas parcelas o title vai receber
        let parcela = 1;

        if (tipoPagamento !== 'AVISTA') {
            parcela = 3;
        }

        // Criando data de vencimento
        const novadata = dayjs().add(30, 'day').format('YYYY-MM-DD');

        // Criando um novo título de dívida
        const result6 = await this.Title.create(
            { qtd_Parcela: parcela, valorOriginal: custototal, dataVencimento: novadata, status: 'pendente' },
            { transaction }
        );

        //---------------------------------------------------------------------------------------//
        // Agora vamos criar nota de entrada

        // Procura fornecedor para pegar dados necessários
        const supplier = await this.Supplier.findByPk(data.supplierId, { transaction });

        if (!supplier) {
            throw new Error('Supplier não encontrado');
        }

        // Cria nota fiscal
        const result7 = await this.NotaFiscal.create({
            natureza_operacao: supplier.natureza_operacao,
            cnpj_cpf_comprador: '123456/0001-10',
            nome_razao_comprador: 'JG Muambas',
            descricao_produto: result3.produto_requerido,
            quantidade: quantidade,
            cnpj_cpf_emitente: supplier.cnpj,
            nome_razao_emitente: supplier.nome,
            valor_nota: custototal,
        }, { transaction });

        // Inserindo id de nota fiscal no produto por update
        await this.Product.update(
            { notafiscalId: result7.id },
            { where: { id: result4.id }, transaction }
        );

        // Inserindo id de nota fiscal no título por update
        await this.Title.update(
            { notafiscalId: result7.id },
            { where: { id: result6.id }, transaction }
        );

        //---------------------------------------------------------------------------------------//
        // Controle de Títulos para Parcelamento

        let results = [];

        if (parcela === 3) {
            let valor = custototal / parcela;

            for (let i = 0; i < parcela; i++) {
                const result8 = await this.ControleTitle.create(
                    {
                        tipoMovimento: 'abertura',
                        valorMovimento: valor,
                        valorMulta: 0,
                        valorJuros: 0,
                        titleId: result6.id
                    },
                    { transaction }
                );
                console.log(`Created ControleTitle ${i + 1}: `, result8);
                results.push(result8);
            }
        } else {
            const result8 = await this.ControleTitle.create(
                {
                    tipoMovimento: 'abertura',
                    valorMovimento: custototal,
                    valorMulta: 0,
                    valorJuros: 0,
                    titleId: result6.id
                },
                { transaction }
            );
            console.log('Created single ControleTitle: ', result8);
            results.push(result8);
        }

        await transaction.commit();

        // Retornando todas as transações
        return { result, data, result2, result3, result4, result5, result6, result7, controleTitles: results };

    } catch (error) {
        await transaction.rollback();
        console.error('Erro ao criar e atualizar dados:', error);
        throw error;
    }
}

}

module.exports = PurchaseProcessingService;