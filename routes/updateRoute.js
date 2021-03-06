const express = require('express');
const router = express.Router();
const limitController  = require('../controllers/limitController');
const countdownController = require("../controllers/countdownController");
const positionController = require("../controllers/positionController");
const priorityController = require("../controllers/Priority");

router.post('/limit', limitController.updateLimitAPI);
router.post('/parallel', limitController.updateParalleltyAPI);
router.post('/countdown', countdownController.updateCountdownAPI);
router.post('/priority', priorityController.updatePriorityAPI);
router.post('/position', positionController.updatePositionAPI);
module.exports  = router;