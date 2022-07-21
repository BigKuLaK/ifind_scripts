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
const IS_ADDED = "true";
const Is_ADDED_STOPPED = "false";

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

  requestedForStart = false;
  requestedForStop = false;

  // Singleton instance list of the tasks
  static all = [];

  constructor(config) {
    super();

    this.id = config.id;
    this.name = config.name;
    this.priority = config.priority;
    this.isReady = config.isReady;
    this.schedule = config.schedule;
    this.isAdded = config.isAdded;
    this.next_run = config.next_run;
    this.last_run = config.last_run;
    this.meta = config.meta;
    this.timeoutMs = Number(config.timeout_minutes) * 60 * 1000;

    this.status = config.status || STATUS_STOPPED;
    this.position = -1;
    // Get taskModulePath
    this.taskModulePath = path.resolve(tasksRoot, this.id);
    this.taskModuleFile = path.resolve(this.taskModulePath, "index.js");
    this.hasModule = existsSync(this.taskModuleFile);

    // Event emitter
    this[EVENT_EMITTER_KEY] = new EventEmitter();

    // Logger
    this.logger = new Logger({ context: "task-" + this.id });
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
    if ( this.requestedForStart ) {
      console.warn(`Process for this task is already requested for start (${this.id})`.yellow);
      return;
    }

    this.requestedForStart = true;

    if (this.timeoutMs) {
      // Automatically stop task if its running more than the timeout
      // Commenting to check if it disturbs the automatic flow
      setTimeout(() => {
        this.log(`Stopping task due to timeout: ${this.id}`, "ERROR");
        console.log("this.timeoutMs", this.timeoutMs);
        this.stop();
      }, this.timeoutMs);
      console.log("Task timeout is reached");
    }

    if (await this.checkOtherProcessInstance()) {
      console.warn(`Process for this task is already running (${this.id})`.yellow);
      return;
    }

    this.log(`STARTING TASK: ${this.id}`.bold.green, "INFO");

    if (this.hasModule && !this.running) {
      this.process = childProcess.fork(this.taskModuleFile, [], {
        stdio: "pipe",
        env: process.env,
      });
      await this.computeNextRun();
      await this.setRunning();
      await this.setAdded();

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
        console.log("Position in exit event inside Task.js", this.position);
        this.setStopped();
        this[EVENT_EMITTER_KEY].emit("exit", exitCode, this.position);
        console.log("exitCode", exitCode);
        this.setAddedStop();
        // this.saveLastRun();
        // await execution_queue.dequeue(this.id);

        this.log(`PROCESS EXITTED`.bold.magenta);

        this.requestedForStart = false;
        this.requestedForStop = false;

        // Once Tasks logic is fixed, uncomment this line below,
        // so that any child processes will be terminated as well (i.e., puppeteer)
        // this.process.kill("SIGKILL");
        this.process = null;
      });

      this[EVENT_EMITTER_KEY].emit("start");
    }

    this.requestedForStart = false;
  }

  stop(position = -1) {
    // const execution_queue = Queue.getInstance();
    console.log("Stop called in Task.js");
    console.log("inside Task.js Stop function, position here : ", position);
    if (this.running && this.process) {
      console.log("Inside the condition where the task is running or not ");
      this.setPosition(position);
      this.process.kill("SIGTERM");
      this.setAddedStop();
      // execution_queue.dequeue(this.id);
    }
  }

  setPosition(position) {
    console.log("Setting position for this task :", this.name);
    this.position = position;
  }
  setRunning() {
    this.status = STATUS_RUNNING;
  }

  setAdded() {
    this.isAdded = IS_ADDED;
  }

  setAddedStop() {
    this.isAdded = Is_ADDED_STOPPED;
  }

  setReady() {
    this.isReady = "Ready";
  }

  setStopped() {
    // console.log("--------setStop-------",this)
    this.status = STATUS_STOPPED;
  }

  setSchedule(countdownTime) {
    // console.log("--------setStop-------",this)
    this.schedule = countdownTime;
  }

  setPriority(priority) {
    // console.log("--------setStop-------",this)
    this.priority = priority;
  }

  /**
   * 
   * @param {Number} afterTime - timestamp after which logs are filtered
   * @returns LogEntry[]
   */
  async getLogs(afterTime) {
    return await this.logger.getAll(afterTime);
  }

  log(message = "", type) {
    this.logger.log(message, type);
  }

  // Computes next run schedule depending on config.shedule
  // Save the computed update in database
  async computeNextRun() {
    const now = Date.now();
    const { schedule } = this;

    while (!this.next_run || this.next_run <= now) {
      this.next_run = this.next_run + (schedule || frequencies); // Default to daily
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

  async checkOtherProcessInstance() {
    const existingProcess = childProcess
      .execSync(`ps -ef | grep ${this.taskModuleFile}`)
      .toString()
      .split("\n")
      .filter((lineMatch) => lineMatch && !/\sgrep\s/.test(lineMatch));

    return existingProcess.length > 0;
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
  if ( !Task.all.length )  {
    Task.all =(
    // Get all database entries
    Database.getAll(this.model)
      // Instantiate as Task instances
      .map((taskData) => Task.initializeWithData(taskData, willInitialize))
    )
  }

  return Task.all;
};

module.exports = Task;
