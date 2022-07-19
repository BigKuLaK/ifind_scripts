const express = require('express');
const router = express.Router();
const QueueController  = require('../controllers/queueController');

router.post('/add', QueueController.add);
router.post('/start', QueueController.start);
router.post('/stop', QueueController.stop);
router.get('/', QueueController.index);

module.exports  = router;