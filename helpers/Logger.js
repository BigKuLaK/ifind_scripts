/*
id: log.id,
timestamp: log.timestamp,
date_time: log.dateTimeFormatted.trim(),
type: log.type || "INFO",
message: log.message,
*/
/**
 * @typedef {keyof typeof logTypeToColor} LogType
 *
 * @typedef {object} LogEntry
 * @property {string} id
 * @property {number} timestamp
 * @property {string} date_time
 * @property {LogType} type
 * @property {string} message
 *
 */

require("colors");
const moment = require("moment");
const { v4: uuid } = require("uuid");
const LevelDatabase = require("./LevelDatabase");

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

    // Create sublevel database
    this.database = new LevelDatabase("logs-" + this.context);
  }

  async add(dateTime, message, _type = "INFO", context) {
    try {
      const id = uuid();
      const timestamp = moment.utc(dateTime).valueOf();
      const type = Logger.isValidLogType(_type) ? _type : logTypes[0];
      const colorFn = logTypeToColor[type];
      const typeFormatted = type.padEnd(10).substr(0, 5)[colorFn];

      await this.database.put(id, {
        id,
        timestamp,
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
  async get(limit = 100) {
    return await this.database.sublevel
      .values({
        limit,
        reverse: true,
      })
      .all();
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
      this.add(dateTime, logMessage, type, this.context);
    }

    // Log to console
    process.stdout.write(logOutput);
  }

  // Ensure we only use valid log type
  static isValidLogType(logType) {
    return new RegExp(logTypes.join("|")).test(logType);
  }

  // Get all logs
  async getAll(afterTime) {
    const filters = {
      limit: 100,
      reverse: true,
    };

    if (afterTime && typeof afterTime === "number") {
      filters.gt = afterTime;
    }

    const logs = await this.database.sublevel.values(filters).all();

    const mappedLogs = [];

    logs.forEach((log) => {
      mappedLogs.unshift({
        id: log.id,
        timestamp: log.timestamp,
        date_time: log.dateTimeFormatted.trim(),
        type: log.type || "INFO",
        message: log.message,
      });
    });

    return mappedLogs;
  }

  static async deleteOld() {
    console.info(`Deleting log entries from over a week ago.`.cyan);

    // Delete log entries that are a week old
    const NOW = Date.now();
    const A_WEEK_AGO = NOW - 1000 * 60 * 60 * 24 * 7;

    await Promise.all(
      LevelDatabase.sublevels.map(async (sublevel) => {
        try {
          await sublevel.clear({
            lte: A_WEEK_AGO,
          });

          console.info(
            `Successfully deleted old logs for ${sublevel.name}.`.green
          );
        } catch (err) {
          console.error(`Delete unsuccessfull`.red, err);
        }
      })
    );
  }
}

module.exports = Logger;
