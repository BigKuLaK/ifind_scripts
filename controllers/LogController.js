const Logger = require("../helpers/Logger");

class LogController {
  static async index(req, res) {
    const { context, limit = 100 } = req.query;
    let status = 400,
      error = "",
      data = null;

    if (!context) {
      error = "Required parameter is missing: context";
    } else {
      status = 200;
      data = await Logger.get(context, limit);
    }

    return res.status(status).send({
      error,
      data,
    });
  }

  static async create(req, res) {
    const { dateTime, message, type, context } = req.body;
    let status = 400,
      success = false,
      error = "",
      responseMessage = "";

    try {
      success = await Logger.add(dateTime, message, type, context);

      status = success ? 200 : 500;
      responseMessage = success
        ? "Successfully added log."
        : "Unable to add log due to an unknown error.";
    } catch (err) {
      console.error(err);
      error = err.message;
      status = 500;
    }

    res.status(status).json({
      status,
      success,
      error,
      message: responseMessage,
    });
  }
}

module.exports = LogController;
