// ./routes/users.js
var express = require('express');
var router = express.Router();

const db = require('../models');
const userService = require('../services/userService');
const UserService = new userService(db.User);

const userController = require('../controllers/userController');
const UserController = new userController(UserService);

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('Modulo de usuários está rodando');
});

//Rota para criar um novo usuario
router.post('/newUser',function(req, res, next){
  UserController.create(req,res);
});

router.get('/findAllUser', function(req, res, next){
  UserController.findAllUser(req, res);
});

router.get('/findUserbyId', function(req, res, next){
  UserController.findUserbyId(req, res);
});
router.get('/loginUser', function(req, res, next){
  UserController.loginUser(req, res);
})

module.exports = router;