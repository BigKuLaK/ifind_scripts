const express = require('express');
const router = express.Router();
const taskController  = require('../controllers/taskController');
const triggerTaskController = require("../controllers/triggerTaskController");
const taskLogController = require("../controllers/taskLogController");

router.post('/getTaskList', taskController.taskControllerApi);
router.post('/triggerTask', triggerTaskController.triggerTaskAPI);
router.post('/getTaskLog', taskLogController.taskLogAPI);

module.exports  = router;