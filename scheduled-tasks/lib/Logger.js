require("colors");
const { ensureDirSync, readFileSync } = require("fs-extra");
const path = require("path");
const glob = require("glob");
const { ensureFileSync, appendFileSync } = require("fs-extra");
const moment = require("moment");

const logTypes = ["INFO", "ERROR"];

const logTypeToColor = {
  INFO: "green",
  ERROR: "red",
};

/**
 * CONFIG
 *
 * baseDir = The background process base dir
 */
class Logger {
  constructor(config = {}) {
    if (config.baseDir) {
      this.baseDir = path.resolve(config.baseDir);
      this.logDir = path.resolve(this.baseDir, "logs");
      // ensureDirSync(this.logDir);
    }
  }

  /**
   * Logs a message into the log files and into the console
   * Message formatting follows the console formatting
   * @param {String} logMessage CLI message
   * @param {String} type - one of logTypes
   */
  log(logMessage = "", type) {
    const logEntry = this.formatLogMessage(logMessage, type);

    // Add to logs if available
    if (this.logDir) {
      this.writeLogEntry(logEntry + "\n");
    }

    // Log to console
    console.log(logEntry);
  }

  formatLogMessage(logMessage = "", type) {
    const logType = this.isValidLogType(type) ? type : logTypes[0];
    const colorFn = logTypeToColor[logType];
    const dateTime = moment.utc().format("YYYY-MM-DD HH:mm:ss");
    const logEntry = [
      dateTime.bold,
      logType.padEnd(10).substr(0, 5)[colorFn], // Ensure log type string will have the same spacings
      logMessage,
    ].join(" | ");

    return logEntry;
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
  getAll() {
    const logFilesPaths = glob.sync(path.resolve(this.logDir, "*.log"));

    // Get only recent 100 logs
    const logs = [];

    // Get log entries from recent to oldest
    logFilesPaths.reverse().some((logFilePath) => {
      // Catch "string too long" error
      try {
        const logFileContents = readFileSync(logFilePath).toString();
        const logEntries = logFileContents.split("\n");
        const logsCountToGet = 100 - logs.length;

        logEntries
          .reverse()
          .slice(0, logsCountToGet)
          .some((logEntry) => {
            const [date_time = "", type = "", message = ""] =
              logEntry.split(" | ");

            if (message || type || message) {
              // Remove ANSI formatting on some properties
              logs.push({
                date_time: date_time.trim(),
                type: type || "INFO",
                message,
              });
            }
          });
      } catch (err) {
        logs.push({
          date_time: "",
          type: "ERROR",
          message: "Log file too large",
        });
      }

      // Break loop if there's already 100 log entries
      if (logs.length >= 100) {
        return true;
      }
    });

    return logs.reverse();
  }
}

module.exports = Logger;
