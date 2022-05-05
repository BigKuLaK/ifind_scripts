const express = require('express');
const router = express.Router();
const aliExpressController = require('../controllers/AliExpressController');

router.post('/getAliExpressData', aliExpressController.aliExpressApi);

module.exports = router;