const express = require("express");
const router = express.Router();

const DealTypeController = require("../controllers/DealTypeController");

router.get("/", DealTypeController.index);

module.exports = router;
