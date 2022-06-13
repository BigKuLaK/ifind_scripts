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
const { resolve } = require("path");
const { task } = require("./config/_models");
const { minutes } = require("./config/_frequencies");

// Limit for execution queue tasks :
// const LIMIT = 10;

const LOGGER = new Logger({ baseDir });
let instance = null;
class ScheduledTasks {

  // Create static variable for calling init function only once.
  static initialized = false;

  // Default Limit Value
  static LIMIT = 10;
  // List of all available tasks, by id

  static parallel = false;
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

  //Execution Queue 
  execution_queue = [];

  queue_list = [];

  constructor() {
    console.log("Constructor called : Object initialised for scheduled-task");
    this.ID = Date.now();
  }
  static getInstance() {
    if (!instance) {
      console.log("Created New Instance");
      instance = new ScheduledTasks();
    }
    return instance;
  }
  init() {
    // console.log("Inside scheduled task class - init function called");
    if (this.initialized) {
      // console.log("object already initialised - init function returned");
      return;
    }

    console.log("initialising new object ");
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
    // timer.on("taskstart", this.enqueue.bind(this));

    LOGGER.log("Scheduled Tasks Runner initialized".magenta.bold);
    console.log("scheduled Task Runner initialised");
    // TEST
    this.fireHook("task-stop", "test-task-id");
  }

  runCommand(command, id, fromDequeue = false) {
    const validCommands = ["start", "stop"];
    if (validCommands.includes(command)) {
      const args = [id, fromDequeue];

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

  /**
   * Gets the list of all available tasks
   */
  list() {
    const serverTime = moment.utc().valueOf();

    // Get updated tasks list
    const tasks = Queue.getList();
    // console.log("tasks List from : ", tasks);
    tasks.forEach((dbTask) => {
      // console.log("dbTask : ", dbTask);
      const matchedCachedTask = this.tasks[dbTask.id];

      if (matchedCachedTask) {
        matchedCachedTask.next_run = dbTask.next_run;
        matchedCachedTask.last_run = dbTask.last_run;
      }
    });
    const tempTask = Object.values(this.tasks).map((task) =>
    ({
      ...task,
      frequency: mapScheduleToFrequency(task.schedule),
      countdown: formatGranularTime(task.next_run - serverTime),
    }))
    // Apply formated schedule datetime
    return Object.values(this.tasks)
      .map((task) => ({
        ...task,
        frequency: mapScheduleToFrequency(task.schedule),
        countdown: formatGranularTime(task.next_run - serverTime),
      }))
      .sort((taskA, taskB) => (taskA.next_run < taskB.next_run ? -1 : 1));
  }

  start(id, resetNextRun = false, fromDequeue = false) {

    // console.log("Inside start - ScheduledTask CLass", fromDequeue);
    // Add task to execution queue
    if (!fromDequeue)
      this.enqueue(id);

    if (!(id in this.tasks)) {
      LOGGER.log(
        `${id.bold} is not in the list of tasks. Kindly verify the task ID.`
      );
      return;
    }

    // if (this.runningTask) {
    //   if (this.runningTask === id) {
    //     LOGGER.log(`Task is still running.`.cyan);
    //   } else {
    //     LOGGER.log(
    //       `Unable to run `.yellow +
    //       id.bold.yellow +
    //       `. Another task is currently running - `.yellow +
    //       this.runningTask.bold.yellow
    //     );
    //   }

    if (Queue.isTaskDueToRun(this.tasks[id])) {
      this.tasks[id].computeNextRun();
    }

    //   return;
    // }

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
    if (!this.parallel) {
      const tempList = this.getQueue();
      if (tempList.length > 1) {
        const tempfirst = tempList[0]
        const status = tempfirst.status
        if (status == "running") {
          console.log("Return Called");
          return;
        }
      }
    }

    // Start task
    task.start();
    // Show updated queue for the next run
    const newQueue = Queue.getList();
    LOGGER.log(`New queue:`.bold.green);
    newQueue.forEach(({ id, next_run }, index) => {
      LOGGER.log(
        ` ${index + 1} - ${id.bold} - ${moment
          .utc(next_run)
          .format("YYYY-MM-DD HH:mm:ss")} ${this.runningTask === id ? "- running".bold.yellow : ""
        }`
      );
    });

    this.parallel = false;
  }

  stop(id, position = -1) {
    console.log("Stop called in scheduledtask class");
    // IF id.status == stopped 
    // Only Dequeue from that postion :
    // Return 
    let Stopped = false;
    let taskList = this.getQueue();
    taskList.forEach((item,i) =>{
      if(item.id == id)
      {
        // console.log("Item.id :", item.id);
        // console.log("Item.status :", item.status);
        // console.log("Id received in stop function ", id);
        // console.log("Item position : ", i);
        // console.log("Position in stop function : ", position);
        if(item.status !== "running" && position == i){
          console.log("Inside if condition in stop function scheduled task ");
          Stopped = true;
          this.dequeue(id, position);
          return;
        }
      }
    })
    if(Stopped){
      return;
    }
    // If multple entries of same task are found
    // And deleting the second one is required
    // Then check must be applied and only deque that task at particular position
    // without restart/stopping 
    // the previous entry of task in execution queue 
    // let areAllRunning = false
    taskList.forEach((item, i)=>{
      if(item.id == id){
        console.log("Item.id :", item.id);
        console.log("Item.status :", item.status);
        console.log("Id received in stop function ", id);
        console.log("Item position : ", i);
        console.log("Position in stop function : ", position);
        if(item.status == "running" && position !== i){
          console.log("Multiple entried found, function dequeu called & returned");
          Stopped = true;

          // Added this 
          const task = this.tasks[id];
          LOGGER.log(`Killing task: ${id.bold}`);
          console.log("position in stop function in scheduled task :", position);
          task.stop(position);
          // Till this 

          // this.dequeue(id, position);
          return;
      }
        // if(item.status == "running" && position==i)
        // {
        //   this.dequeue(id, position);
        // }
        // else{
        //   areAllRunning = true;
        // }
      }
    })

    // if(areAllRunning){
    //   this.dequeue(id,position);
    //   return;
    // }
    if(Stopped)
    {
      return;
    }
    if (id in this.tasks) {
      const task = this.tasks[id];
      LOGGER.log(`Killing task: ${id.bold}`);
      console.log("position in stop function in scheduled task :", position);
      task.stop(position);
    }
  }

  schedule(id, minutes) {
    if (id in this.tasks) {
      const task = this.tasks[id];
      task.setSchedule(minutes);
    }
  }

  callUpdateCountdown(id) {
    if (id in this.tasks) {
      console.log("called function to update countdown()");
      const task = this.tasks[id];
      task.update({
        next_run: Date.now(),
      });
      task.computeNextRun();
    }
  }

  changePosition(position, action) {
    let len = this.execution_queue.length;
    let value = parseInt(position)
    console.log("len", len)
    if (len == 2) {
      return "Action not possible, Execution queue processes not sufficient";
    }
    if ((value == len - 1 && action == "down") || (value == 0 && action == "up")) {
      return "Action not possible"
    }
    switch (action) {
      case "up":
        if (value == 0 || value == 1 || value >= len) {
          console.log("action not possible, index out of range");
          return;
        }
        let temp = this.execution_queue[value];
        const data = this.execution_queue[value] = this.execution_queue[value - 1];
        this.execution_queue[value - 1] = temp;
        console.log("Changed Up position successfully");
        break;
      case "down":
        if (value == len - 1 || value == 0) {
          return "action not possible"
        }
        let temp2 = this.execution_queue[value];
        const data2 = this.execution_queue[position] = this.execution_queue[value + 1];
        this.execution_queue[value + 1] = temp2;
        console.log("changed Down position successfully")
        break;
      default:
        console.log("Action not matched with any case, check the value of action please ");
    }
    // Swap the values otherwise.
  }

  setQueue(id) {
    if (id in this.tasks) {
      this.tasks[id].setAdded();
    }
    else {
      console.log("Task id not in tasklist");
    }
  }

  addQueue(id) {
    if (!(id in this.tasks)) {
      LOGGER.log(
        `${id.bold} is not in the list of tasks. Kindly verify the task ID.`
      );
      return;
    }
    setAdded(id);
  }

  getLogs() {
    return LOGGER.getAll();
  }

  callDequeue(taskId, position = -1, withError = false) {
    console.log("callDequeue function, Position here", position);
    this.dequeue(taskId, position, withError);
    return function () {
      console.log("call back function");
    }
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
    task.on("exit", (exitCode, position = -1) => this.onProcessExit(task.id, exitCode, position));
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

  async onProcessExit(id, exitCode, position = -1) {
    const logType = exitCode ? "ERROR" : "INFO";
    const bg = exitCode ? "bgYellow" : "bgCyan";

    this.runningTask = null;
    LOGGER.log(
      ` Process exitted ${exitCode ? "with error" : ""}: `.black.bold[bg] +
      `${id} `.black[bg],
      logType
    );
    console.log("Exit Code : ", exitCode);
    if (exitCode) {
      // Get the position of the task which stopped abruptly.
      for (const index in this.execution_queue) {
        console.log("Index : ", index, "Value -->", this.execution_queue[index]);
        if (this.execution_queue[index] == id)
          position = index;
      }
      // const [taskId, position] = this.execution_queue.filter(task => task.id == this.execution_queue[i])
    }
    if (!exitCode) {
      await this.fireHook(this.hookNames.TASK_STOP, id, position);
      return;
    }
    console.log("Inside on process exit : calldequeue runs in .5 seconds, position here : ", position);
    setTimeout(() => { this.callDequeue(id, position, true) }, 10);
  }

  async fireHook(hookName, data, position = -1) {

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
      // console.log("data-->", data);
    }
    console.log("calling dequeue from firehook ");
    this.dequeue(data, position)
  }

  enqueue(taskId) {
    console.log("Scheduled Task Limit--->", ScheduledTasks.LIMIT);

    if (this.execution_queue.length >= ScheduledTasks.LIMIT) {
      console.log("Execution Queue Limit Reached");
      return;
    }
    console.log("inside enqueue function");
    // if (this.isEmpty()) {
    //   this.execution_queue.push(taskId);
    //   this.runCommand("start", taskId);
    //   return;
    // }
    this.execution_queue.push(taskId);
  }

  // removing element from the queue
  // returns underflow when called 
  // on empty queue
  dequeue(taskId, position = -1, withError = false) {
    console.log("Inside dequeue function :");
    console.log(`taskId : ${taskId} , Position ${position}`);
    if (position == -1) {
      if (withError)
        console.log("Error code recieved");
      // return;

      console.log("Removing from dequeue the old way without position at front ---->");
      let tempTask = this.front();
      if (tempTask == taskId) {
        let removedTask = this.execution_queue.shift();
        if (!this.isEmpty()) {
          this.runCommand("start", this.front(), true);
        }
        return removedTask;
      }
      if (this.isEmpty())
        return "Underflow";
      return this.execution_queue.shift();
    }
    else {
      console.log("Inside else condition in dequeue function ---->");
      let tempTask = this.execution_queue[position];
      if (tempTask == taskId) {
        this.execution_queue.splice(position, 1);
        console.log("Removed item in execution queue from position :", position);
      }
      if(!this.isEmpty()){
        let tasks = this.getQueue();
        // console.log("tasks in dequeue : ",tasks);
        console.log("Tasks[0] Status:", tasks[0].status );
        
        if(tasks[0].status == "running"){
          console.log("task already running on first position return called");
          return;
        }
        else{
          console.log("inside else condition in dequeue");
          this.runCommand("start", this.front(), true);
        }
      }
      // if (!this.isEmpty()) {
      //   this.runCommand("start", this.front(), true);
      // }
    }
  }

  // returns the Front element of 
  // the queue without removing it.
  front() {
    if (this.isEmpty())
      return "No elements in Queue";
    return this.execution_queue[0];
  }

  // return true if the queue is empty.
  isEmpty() {
    return this.execution_queue.length == 0;
  }

  getQueue() {
    // const scheduledTask = ScheduledTasks.getInstance();
    this.queue_list = [];
    if (this.isEmpty()) {
      return [];
    }
    // this.taskList = scheduledTask.list();
    let taskList = this.list();
    // console.log("taskList id getQueue function ");
    // for(const i of taskList){
    //   console.log("taskName : ", i.name , " status :", i.status);
    // }
    for (var i = 0; i < this.execution_queue.length; i++) {
      const taskData = taskList.filter(task => task.id == this.execution_queue[i])
      // console.log("task Data ----->", taskData[0]);
      this.queue_list.push(taskData[0]);
    }
    return this.queue_list;
  }
}

module.exports = ScheduledTasks;
