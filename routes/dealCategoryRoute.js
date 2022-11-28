const express = require("express");
const router = express.Router();

const DealCategoryController = require("../controllers/DealCategoryController");

router.get("/", DealCategoryController.index);

module.exports = router;
