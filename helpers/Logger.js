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
    this.outpuOnly = config.outpuOnly || false;
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
    const dateTimeFormatted = dateTime.bold;
    const type = this.isValidLogType(_type) ? _type : logTypes[0];
    const colorFn = logTypeToColor[type];
    const typeFormatted = type.padEnd(10).substr(0, 5)[colorFn];

    const logOutput = [
      dateTime.bold,
      type.padEnd(10).substr(0, 5)[colorFn], // Ensure log type string will have the same spacings
      ` ${this.context.bold} 💬 ${logMessage}`,
    ].join(" | ");

    if ( !this.outpuOnly ) {
      // Save log
      LogEntryModel.create({
        timestamp: momentDateTime.valueOf(),
        dateTime,
        dateTimeFormatted,
        type,
        typeFormatted,
        message: logMessage,
        context: this.context,
      });
    }

    // Log to console
    process.stdout.write(logOutput);
  }

  // Ensure we only use valid log type
  isValidLogType(logType) {
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
  async getAll() {
    const logs = await LogEntryModel.find(
      {
        context: this.context,
      },
      null,
      {
        sort: { timestamp: -1 },
        limit: 100,
      }
    );

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
