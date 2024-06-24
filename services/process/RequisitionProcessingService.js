

class RequisitionProcessingService {
  constructor(RequisitionModel, ControleProductModel, QuotationModel, SupplierModel, ProductModel, SellProcessingService, sequelize) {
    this.Requisition = RequisitionModel;
    this.ControleProduct = ControleProductModel;
    this.Quotation = QuotationModel;
    this.Supplier = SupplierModel;
    this.Product = ProductModel;
    this.SellProcessing = SellProcessingService;
    this.sequelize = sequelize;
  }

  async create(produto_requerido, qtd_requerida, categoria, natureza_operacao, userId, costCenterId, tipoPagamento) {
    
    const transaction = await this.sequelize.transaction();
    
      switch (natureza_operacao) {

        //-------------------------------------------------------------------------------------------------//
        case 'Venda':

        try{
          // Disparar SellProcessingService
          await this.SellProcessing.create(
            produto_requerido,
            qtd_requerida,
            categoria,
            natureza_operacao,
            userId,
            costCenterId,
            tipoPagamento,
           transaction);
          break;

        }catch (error) {
          console.error('Erro ao processar requisição:', error);
          throw error;
          

        }

        //-------------------------------------------------------------------------------------------------//

        case 'Importação':

        try{
            // Verificar o produto pelo nome
            const product = await this.Product.findOne({
              where: { nome: produto_requerido },
              transaction
            });

            // Verificar se o produto existe
            if (!product) {
              throw new Error('Produto não encontrado');
            }
            else{
              // Verificar se há estoque disponível
                const controleProduct = await this.ControleProduct.findOne({
                  where: { produtoId: product.id },
                  transaction
              });

              if(controleProduct.qtd_disponivel >= 10){
                throw new Error('Produto com estoque suficiente! Requisição recusada.');
                
              }
            }
          
            // Abrir cotações para fornecedores da categoria
            const suppliers = await this.Supplier.findAll({
              where: { categoria, natureza_operacao },
              limit: 3,
              transaction
            });

            if (suppliers.length === 0) {
              throw new Error('Nenhum fornecedor encontrado para a categoria e natureza da operação especificadas');
             
            }

            const requisition = await this.Requisition.create({
              produto_requerido,
              categoria,
              natureza_operacao,
              qtd_requerida,
              status: 'Em Processamento',
              userId,
              costCenterId
            }, { transaction });


            const currentDate = new Date();
            // Calcular a data de validade adicionando 5 dias
            const validadeCotacao = new Date(currentDate);
            validadeCotacao.setDate(currentDate.getDate() + 5);

            const quotationPromises = suppliers.map(supplier => {
              return this.Quotation.create({
                preco: 0, // Definir o preço inicial, pode ser atualizado posteriormente
                cotacaoData: currentDate,
                validadeCotacao,
                supplierId: supplier.id,
                requisitionId: requisition.id
              }, { transaction });
            });

            await Promise.all(quotationPromises);

            await transaction.commit();
            return { message: 'Processamento concluído com sucesso' };
            

          } catch (error) {
            await transaction.rollback();
            console.error('Erro ao processar requisição:', error);
            error;
            break;

          } 
         //-------------------------------------------------------------------------------------------------//

          default:
            throw new Error('Natureza da operação desconhecida');
      }

  }
}

module.exports = RequisitionProcessingService;