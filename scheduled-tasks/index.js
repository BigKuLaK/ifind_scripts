const path = require("path");
const fs = require("fs-extra");
const moment = require("moment");
const { existsSync } = require("fs-extra");
const childProcess = require("child_process");

const baseDir = path.resolve(__dirname);
const configPath = path.resolve(baseDir, "config");
const config = existsSync(configPath) ? require(configPath) : {};
const timer = require("./lib/Timer");
const Task = require("./lib/Task");
const Database = require("./lib/Database");
const Logger = require("./lib/Logger");
const Queue = require("./lib/Queue");
const mapScheduleToFrequency = require("./utils/mapScheduleToFrequency");
const formatGranularTime = require("./utils/formatGranularTime");

const LOGGER = new Logger({ baseDir });

class ScheduledTasks {
  // List of all available tasks, by id
  tasks = {};
  // ID of the currently running task
  runningTask = null;
  // Valid hook names
  hookNames = {
    TASK_STOP: "task-stop",
  };
  // Running hooks
  runningHooks = {
    // TASK_STOP: process
  };

  constructor() {
    this.ID = Date.now();
  }

  init() {
    console.log("Initialised scheduled task object");
    if (this.initialized) {
      return;
    }

    // Info from queue
    Queue.on("info", (info) => LOGGER.log(info));

    this.initialized = true;

    // Check tasks config for changes and apply updates
    const configTasks = config.tasks;
    const dbTasks = Database.getAll(Task.model);

    configTasks.forEach((configTask) => {
      const dbTask = dbTasks.find((task) => task.id === configTask.id);

      // Check for changes and save if there is any
      if (
        dbTask.name !== configTask.name ||
        dbTask.schedule !== configTask.schedule ||
        dbTask.timeout_minutes !== configTask.timeout_minutes ||
        dbTask.meta !== configTask.meta
      ) {
        Database.update(Task.model, dbTask.id, {
          name: configTask.name,
          schedule: configTask.schedule,
          timeout_minutes: configTask.timeout_minutes,
          meta: configTask.meta,
        });
      }

      this.addTask({
        ...dbTask,
        name: configTask.name,
        schedule: configTask.schedule,
        timeout_minutes: configTask.timeout_minutes,
      });
    });

    // Initialize timer
    timer.on("taskstart", this.start.bind(this));
    timer.init();

    LOGGER.log("Scheduled Tasks Runner initialized".magenta.bold);
    console.log("scheduled Task Runner initialised");
    // TEST
    this.fireHook("task-stop", "test-task-id");
  }

  runCommand(command, id) {
    const validCommands = ["start", "stop"];
    if (validCommands.includes(command)) {
      const args = [id];

      switch (command) {
        case "start":
          args.push(true);
          break;
        default:
      }

      this[command].apply(this, args);
    }

    return this.list();
  }


  listWithCoutdown(){
    const serverTime = moment.utc().valueOf();

    // Get updated tasks list
    const tasks = Queue.getList();

    // Apply formated schedule datetime
    return Object.values(tasks)
      .map((task) => ({
        ...task,
        frequency: mapScheduleToFrequency(task.schedule),
        countdown: formatGranularTime(task.next_run - serverTime),
      }))
      .sort((taskA, taskB) => (taskA.next_run < taskB.next_run ? -1 : 1));
  }
  /**
   * Gets the list of all available tasks
   */
  list() {
    const serverTime = moment.utc().valueOf();

    // Get updated tasks list
    const tasks = Queue.getList();
    // console.log("tasks List from : ", tasks);
    tasks.forEach((dbTask) => {
      console.log("dbTask : ", dbTask);
      const matchedCachedTask = this.tasks[dbTask.id];

      if (matchedCachedTask) {
        matchedCachedTask.next_run = dbTask.next_run;
        matchedCachedTask.last_run = dbTask.last_run;
      }
    });

    // Apply formated schedule datetime
    return Object.values(this.tasks)
      .map((task) => ({
        ...task,
        frequency: mapScheduleToFrequency(task.schedule),
        countdown: formatGranularTime(task.next_run - serverTime),
      }))
      .sort((taskA, taskB) => (taskA.next_run < taskB.next_run ? -1 : 1));
  }

  start(id, resetNextRun = false) {
    if (!(id in this.tasks)) {
      LOGGER.log(
        `${id.bold} is not in the list of tasks. Kindly verify the task ID.`
      );
      return;
    }

    if (this.runningTask) {
      if (this.runningTask === id) {
        LOGGER.log(`Task is still running.`.cyan);
      } else {
        LOGGER.log(
          `Unable to run `.yellow +
            id.bold.yellow +
            `. Another task is currently running - `.yellow +
            this.runningTask.bold.yellow
        );
      }

      if (Queue.isTaskDueToRun(this.tasks[id])) {
        this.tasks[id].computeNextRun();
      }

      return;
    }

    this.runningTask = id;

    LOGGER.log(` Starting task: `.bgGreen.bold.black + `${id} `.bgGreen.black);
    const task = this.tasks[id];

    // Manually running a task allows
    // to reset the next_run at the current time
    // so that the computed next_run will base on the current time
    if (resetNextRun) {
      task.update({
        next_run: Date.now(),
      });
    }

    // Halt any running hook
    Object.entries(this.runningHooks).forEach(([hookName, hookProcess]) => {
      if (hookProcess) {
        console.log(`Stopping hook: ${hookName.bold}`.cyan);
        hookProcess.kill("SIGINT");
      }
    });

    // Start task
    task.start();

    // Show updated queue for the next run
    const newQueue = Queue.getList();
    LOGGER.log(`New queue:`.bold.green);
    newQueue.forEach(({ id, next_run }, index) => {
      LOGGER.log(
        ` ${index + 1} - ${id.bold} - ${moment
          .utc(next_run)
          .format("YYYY-MM-DD HH:mm:ss")} ${
          this.runningTask === id ? "- running".bold.yellow : ""
        }`
      );
    });
  }

  stop(id) {
    if (id in this.tasks) {
      const task = this.tasks[id];
      LOGGER.log(`Killing task: ${id.bold}`);
      task.stop();
    }
  }

  getLogs() {
    return LOGGER.getAll();
  }

  getTask(taskID) {
    if (taskID in this.tasks) {
      const taskData = this.tasks[taskID];
      return {
        ...taskData,
        logs: this.tasks[taskID].getLogs(),
        canRun: !/run/i.test(taskData.status) && taskID !== this.runningTask,
      };
    }
  }

  addTask(taskData) {
    const task = Task.initializeWithData(taskData);

    // Handle task events
    task.on("message", (...args) => this.onProcessMessage(args));
    task.on("exit", (exitCode) => this.onProcessExit(task.id, exitCode));
    task.on("error", (error) => this.onProcessError(task.id, error));

    // Save task to list
    this.tasks[task.id] = task;
    console.log("task added successfully".green);
  }

  onProcessMessage(processArgs) {
    LOGGER.log({ processArgs });
  }

  onProcessError(taskId, error) {
    LOGGER.log(
      ` Error in task process ${taskId.bold}:<br>${error.reset.red}`,
      "ERROR"
    );
  }

  onProcessExit(id, exitCode) {
    const logType = exitCode ? "ERROR" : "INFO";
    const bg = exitCode ? "bgYellow" : "bgCyan";

    this.runningTask = null;
    LOGGER.log(
      ` Process exitted ${exitCode ? "with error" : ""}: `.black.bold[bg] +
        `${id} `.black[bg],
      logType
    );

    if (!exitCode) {
      this.fireHook(this.hookNames.TASK_STOP, id);
    }
  }

  async fireHook(hookName, data) {
    const isValidHookName = Object.values(this.hookNames).includes(hookName);
    const hookPath = path.resolve(__dirname, "hooks", `${hookName}.js`);
    const hookPathExists = fs.existsSync(hookPath);

    // Halt any running hook of the same name
    if (this.runningHooks[hookName]) {
      console.info(`Stopping currently running ${hookName} hook.`);
      this.runningHooks[hookName].stop();
    }

    if (isValidHookName && hookPathExists) {
      LOGGER.log([`Running hook`.cyan, hookName.cyan.bold].join(" "));

      // Require and run hook
      this.runningHooks[hookName] = childProcess.fork(hookPath, [], {
        stdio: "pipe",
      });

      const hookProcess = this.runningHooks[hookName];

      hookProcess.on("message", (jsonString) => {
        const { event } = JSON.parse(jsonString);

        if (event === "init") {
          // Send a trigger to the process to start
          hookProcess.send(
            JSON.stringify({
              command: "start",
              data: data,
            })
          );
        }
      });

      await new Promise((resolve, reject) => {
        hookProcess.on("exit", resolve);
        hookProcess.stdout.on("data", (data) => LOGGER.log(data.toString()));
        hookProcess.stderr.on("data", (data) =>
          LOGGER.log(data.toString(), "ERROR")
        );
        hookProcess.on("error", (error) => {
          LOGGER.log(error.message, "ERROR");
          reject();
        });
      });

      delete this.runningHooks[hookName];

      LOGGER.log(" DONE".green.bold);
    }
  }
}

module.exports = ScheduledTasks;
