const express = require('express');
const router = express.Router();
const taskController  = require('../controllers/taskController');
const triggerTaskController = require("../controllers/triggerTaskController");

router.post('/getTaskList', taskController.taskControllerApi);
router.post('/triggerTask', triggerTaskController.triggerTaskAPI);

module.exports  = router;