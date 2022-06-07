const express = require('express');
const router = express.Router();
const taskController  = require('../controllers/taskController');
const triggerTaskController = require("../controllers/triggerTaskController");
const taskLogController = require("../controllers/taskLogController");
const taskAddController = require("../controllers/taskAddController");

router.post('/getTaskList', taskController.taskControllerApi);
router.post('/triggerTask', triggerTaskController.triggerTaskAPI);
router.post('/getTaskLog', taskLogController.taskLogAPI);
router.post('/addTask', taskAddController.taskAddAPI);

module.exports  = router;