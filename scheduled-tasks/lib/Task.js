const { existsSync } = require("fs-extra");
const childProcess = require("child_process");
const path = require("path");
const EventEmitter = require("events");
const moment = require("moment");

const { frequencies } = require("../config");
const Database = require("./Database");
const Logger = require("./Logger");
const Model = require("./Model");

const tasksRoot = path.resolve(__dirname, "../tasks");
const EVENT_EMITTER_KEY = Symbol();

const STATUS_RUNNING = "running";
const STATUS_STOPPED = "stopped";

/**
 * Task base class
 *
 * A Task should have a corresponding BackgroundProcess
 * This class only triggers a BackgroundProcess to start/stop
 * This does not contain any logic for the BackgroundProcess
 */
class Task extends Model {
  process = null;

  constructor(config) {
    super();

    this.id = config.id;
    this.name = config.name;
    this.schedule = config.schedule;
    this.next_run = config.next_run;
    this.last_run = config.last_run;
    this.meta = config.meta;
    this.timeoutMs = Number(config.timeout_minutes || 0) * 60 * 1000;
    this.status = config.status || STATUS_STOPPED;

    // Get taskModulePath
    this.taskModulePath = path.resolve(tasksRoot, this.id);
    this.taskModuleFile = path.resolve(this.taskModulePath, "index.js");
    this.hasModule = existsSync(this.taskModuleFile);

    // Event emitter
    this[EVENT_EMITTER_KEY] = new EventEmitter();

    // Logger
    this.logger = new Logger({ baseDir: this.taskModulePath });
    // Compute next_run if none

    if (!this.next_run) {
      console.log(`No next_run provided for ${config.id.bold}, recomputing...`);
      this.computeNextRun();
    }
  }

  get running() {
    return this.status === STATUS_RUNNING;
  }

  on(event, handler) {
    this[EVENT_EMITTER_KEY].on(event, handler);
  }

  async start() {
    if (this.timeoutMs) {
      // Automatically stop task if its running more than the timeout
      setTimeout(() => {
        this.log(`Stopping task due to timeout: ${this.id}`, 'ERROR');
        this.stop();
      }, this.timeoutMs);
    }

    console.log("Starting task");
    if (this.hasModule && !this.running) {
      this.process = childProcess.fork(this.taskModuleFile, [], {
        stdio: "pipe",
      });

      await this.computeNextRun();
      await this.setRunning();

      this.process.stdout.on("data", (data) => this.log(data.toString()));
      this.process.stderr.on("data", (data, additionalData) => {
        const errorData = data
          .toString()
          .trim()
          .replace(/[\r\n]/g, "<br>");
        this.log(errorData, "ERROR");
        this[EVENT_EMITTER_KEY].emit("error", errorData);
      });

      this.process.on("exit", async (exitCode) => {
        this[EVENT_EMITTER_KEY].emit("exit", exitCode);
        await this.setStopped();
        await this.saveLastRun();
        this.process = null;
      });
    }
  }

  stop() {
    if (this.running && this.process) {
      this.process.kill("SIGINT");
    }
  }

  setRunning() {
    this.status = STATUS_RUNNING;
  }

  setStopped() {
    this.status = STATUS_STOPPED;
  }

  getLogs() {
    return this.logger.getAll();
  }

  log(message = "", type) {
    this.logger.log(message, type); 
  }

  // Computes next run schedule depending on config.shedule
  // Save the computed update in database
  async computeNextRun() {
    console.log("Computing next run");
    const now = Date.now();
    const { schedule } = this;

    while (!this.next_run || this.next_run <= now) {
      this.next_run = this.next_run + (schedule || frequencies["daily"]); // Default to daily
    }

    // Save to DB
    Database.update(Task.model, this.id, { next_run: this.next_run });
  }

  // Saves last_run
  async saveLastRun() {
    const now = moment.utc().valueOf();

    // Save to DB
    Database.update(Task.model, this.id, { last_run: now });
  }

  // Adjusts next run by the given milliseconds
  adjustNextRun(milliseconds = 0) {
    const next_run = (this.next_run || Date.now()) + milliseconds;

    // Save
    this.update({ next_run });
  }

  getData() {
    return this.sanitizeData(this);
  }
}

/**
 * Static props
 */
Task.model = "task";

/**
 * Static methods
 *
 */
Task.initializeWithData = function (rawData) {
  // console.log("Initializing task with data : ", rawData);
  const instance = new Task(rawData);
  return instance;
};

Task.get = function (taskID, willInitialize) {
  const matchedTask = Database.get(this.model, { id: taskID });

  if (matchedTask) {
    return Task.initializeWithData(matchedTask, willInitialize);
  } else {
    return null;
  }
};
Task.getAll = function (willInitialize = false) {
  return (
    // Get alll database entries
    Database.getAll(this.model)
      // Instantiate as Task instances
      .map((taskData) => Task.initializeWithData(taskData, willInitialize))
  );
};

module.exports = Task;
