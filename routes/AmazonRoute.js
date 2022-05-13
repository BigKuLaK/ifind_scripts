const express = require('express');
const router = express.Router();
const amazonController = require('../controllers/AmazonController');

router.post('/getAmazonProducts', amazonController.getAmazonProducts);

module.exports = router;