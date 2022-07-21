const express = require('express');
const router = express.Router();

const TaskController  = require('../controllers/TaskController');
const triggerTaskController = require("../controllers/triggerTaskController");
const taskAddController = require("../controllers/taskAddController");

router.post('/getTaskList', TaskController.index);
router.post('/triggerTask', triggerTaskController.triggerTaskAPI);
router.post('/addTask', taskAddController.taskAddAPI);

router.get('/logs', TaskController.logs);

module.exports  = router;