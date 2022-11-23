const dealTypesConfig = require('../config/deal-types');

class TaskController {
  // TODO: Improve this logic, and move to scheduled tasks controller
  // tasks listing
  static async index(req, res) {
    return res.status(200).json({
        success: true,
        data: dealTypesConfig.getAll(),
      });
  }
}

module.exports = TaskController;
