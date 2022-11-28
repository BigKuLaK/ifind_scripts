const dealCategoriesConfig = require("../config/deal-categories");

class DealCategoryController {
  // TODO: Improve this logic, and move to scheduled tasks controller
  // tasks listing
  static async index(req, res) {
    return res.status(200).json({
      success: true,
      data: dealCategoriesConfig.getAll(),
    });
  }
}

module.exports = DealCategoryController;
