const express = require('express');
const router = express.Router();
const ebayController = require('../controllers/ebayController');

router.post('/getEbayData', ebayController.ebayApi);
router.post('/fetchEbayStore', ebayController.fetchEbayAPI);
module.exports = router;