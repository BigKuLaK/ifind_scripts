const express = require('express');
const router = express.Router();
const taskController  = require('../controllers/taskController');

router.post('/getTaskList', taskController.taskControllerApi);
module.exports  = router;