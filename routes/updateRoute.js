const express = require('express');
const router = express.Router();
const limitController  = require('../controllers/limitController');
const countdownController = require("../controllers/countdownController");
const positionController = require("../controllers/positionController");
router.post('/limit', limitController.updateLimitAPI);
router.post('/countdown', countdownController.updateCountdownAPI);
router.post('/position', positionController.updatePositionAPI);
module.exports  = router;