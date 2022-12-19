const dealTypesConfig = require("../config/deal-types");

class DealTypeController {
  // TODO: Improve this logic, and move to scheduled tasks controller
  // tasks listing
  static async index(req, res) {
    return res.status(200).json({
      success: true,
      data: dealTypesConfig.getAll(),
    });
  }
}

module.exports = DealTypeController;
