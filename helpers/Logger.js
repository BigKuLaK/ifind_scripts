require("colors");
const { ensureDirSync, readFileSync } = require("fs-extra");
const path = require("path");
const glob = require("glob");
const { ensureFileSync, appendFileSync } = require("fs-extra");
const moment = require("moment");
const MongoDatabase = require("./MongoDatabase");

// Create Model
const LogEntryModel = MongoDatabase.model("LogEntry", {
  timestamp: Number,
  message: String,
  dateTime: Date,
  dateTimeFormatted: String,
  type: String,
  typeFormatted: String,
  context: String,
});

const logTypes = ["INFO", "ERROR"];

const logTypeToColor = {
  INFO: "green",
  ERROR: "red",
};

/**
 * @typespec {Object} LoggerOptions
 * @property {string} context The id for this logger.
 * @property {boolean} outputOnly Whether to output only in command line and not save to database.
 */

class Logger {
  /**
   * @param {LoggerOptions} config
   */
  constructor(config = {}) {
    if (!config.context) {
      throw new Error("Missing config.context for Logger.");
    }

    this.context = config.context || "";
    this.outputOnly = config.outpuOnly || false;
  }

  static async add(dateTime, message, _type = "INFO", context) {
    try {
      const type = this.isValidLogType(_type) ? _type : logTypes[0];
      const colorFn = logTypeToColor[type];
      const typeFormatted = type.padEnd(10).substr(0, 5)[colorFn];

      console.log({ dateTime });

      await LogEntryModel.create({
        timestamp: moment.utc(dateTime).valueOf(),
        dateTime,
        dateTimeFormatted: dateTime.bold,
        type,
        typeFormatted,
        message,
        context,
      });

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  /**
   * @param {String} context
   */
  static async get(context, limit = 100) {
    return await LogEntryModel.find({ context }, null, {
      sort: { timestamp: -1 },
      limit,
    });
  }

  /**
   * Logs a message into the log files and into the console
   * Message formatting follows the console formatting
   * @param {String} logMessage CLI message
   * @param {String} _type - one of logTypes
   */
  log(logMessage = "", _type) {
    const momentDateTime = moment.utc();
    const dateTime = momentDateTime.format("YYYY-MM-DD HH:mm:ss");
    const type = Logger.isValidLogType(_type) ? _type : logTypes[0];
    const colorFn = logTypeToColor[type];

    const logOutput = [
      dateTime.bold,
      type.padEnd(10).substr(0, 5)[colorFn], // Ensure log type string will have the same spacings
      ` ${this.context.bold} 💬 ${logMessage}`,
    ].join(" | ");

    if (!this.outputOnly) {
      // Save log
      Logger.add(dateTime, logMessage, type, this.context);
    }

    // Log to console
    process.stdout.write(logOutput);
  }

  // Ensure we only use valid log type
  static isValidLogType(logType) {
    return new RegExp(logTypes.join("|")).test(logType);
  }

  // Writes a log entry into the log file
  writeLogEntry(logEntry) {
    const dateTime = moment.utc().format("YYYY-MM-DD");
    const logFile = path.resolve(this.logDir, dateTime + ".log");

    // Ensure log file is present
    ensureFileSync(logFile);

    // Write to file
    appendFileSync(logFile, logEntry);
  }

  // Get all logs
  async getAll(afterTime) {
    const filters = {
      context: this.context,
    };

    if (afterTime && typeof afterTime === "number") {
      filters.timestamp = { $gt: afterTime };
    }

    const logs = await LogEntryModel.find(filters, null, {
      sort: { timestamp: -1 },
      limit: 100,
    });

    const mappedLogs = [];

    logs.forEach((log) => {
      mappedLogs.unshift({
        timestamp: log.timestamp,
        date_time: log.dateTimeFormatted.trim(),
        type: log.type || "INFO",
        message: log.message,
      });
    });

    return mappedLogs;
  }
}

module.exports = Logger;
