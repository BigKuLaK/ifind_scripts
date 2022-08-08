const path = require("path");
const moment = require("moment");
const EventEmitter = require("events");
const Queue = require("./Queue");
const Logger = require("./Logger");
const formatGranularTime = require("../utils/formatGranularTime");

const LOGGER = new Logger({ context: "scheduled-tasks-runner" });
const EVENTEMITTER = new EventEmitter();

const Timer = {
  timerInterval: null,

  on(event, handler) {
    EVENTEMITTER.on(event, handler);
  },

  init() {},

  resetTimer(interval = 0) {
    clearTimeout(this.timerInterval);
    this.timerInterval = setTimeout(this.runNextTask.bind(this), interval);
  },
};

module.exports = Timer;
