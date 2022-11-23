const express = require('express');
const router = express.Router();

const DealTypeController  = require('../controllers/DealTypeController');
// const triggerTaskController = require("../controllers/triggerTaskController");
// const taskAddController = require("../controllers/taskAddController");

// router.post('/addTask', taskAddController.taskAddAPI);

router.get('/', DealTypeController.index);

module.exports  = router;