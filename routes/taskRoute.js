const express = require("express");
const router = express.Router();

const TaskController = require("../controllers/TaskController");

router.post("/getTaskList", TaskController.index);
router.post("/triggerTask", TaskController.trigger);
router.post("/update", TaskController.update);
router.post("/priority", TaskController.priority);
router.post("/addTask", TaskController.enqueue);

router.get("/logs", TaskController.logs);

module.exports = router;
