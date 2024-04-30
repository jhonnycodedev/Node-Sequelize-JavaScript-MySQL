// ./models/product.js
const Sequelize = require('sequelize');
module.exports= (sequelize) => {
    
    const Product = sequelize.define('Product',{
        id:{
            type: Sequelize.INTEGER,
            primaryKey:true
        },
        nome:{
            type: Sequelize.STRING,
            allowNull:false
        },
        valor:{
            type: Sequelize.DOUBLE,
            unique:true
        },
        
    });
    return Product;
};