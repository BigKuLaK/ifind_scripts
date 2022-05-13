const express = require('express');
const router = express.Router();
const mydealzController = require('../controllers/mydealzController');

router.post('/getMyDealsProduct', mydealzController.getMyDealsProduct);


module.exports = router;