const express = require('express');
const router = express.Router();
const mydealzController = require('../controllers/mydealzController');
const AmazonController = require('../controllers/AmazonController');


// router.post('/getProductDetails', mydealzController.getProductDetails);
router.get('/getAmazonProducts', AmazonController.getAmazonProducts);
router.get('/getMyDealsProduct', mydealzController.getMyDealsProduct);


module.exports = router;