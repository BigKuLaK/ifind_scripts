const express = require('express');
const router = express.Router();
const scheduledTaskController  = require('../controllers/scheduledTaskController');

router.post('/scheduledTask', scheduledTaskController.scheduledTask);
module.exports  = router;