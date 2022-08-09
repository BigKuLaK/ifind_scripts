const moment = require("moment");
const ScheduledTasks = require("../scheduled-tasks");
const Task = require("../scheduled-tasks/lib/Task");
const Queue = require("../scheduled-tasks/lib/Queue");
const mapScheduleToFrequency = require("../scheduled-tasks/utils/mapScheduleToFrequency");
const formatGranularTime = require("../scheduled-tasks/utils/formatGranularTime");

class TaskController {
  // TODO: Improve this logic, and move to scheduled tasks controller
  // tasks listing
  static async index(req, res) {
    try {
      const serverTime = moment.utc().valueOf();
      const scheduledTask =
        req.app.get("scheduledTasks") || ScheduledTasks.getInstance();
      scheduledTask.init();

      const logs = await scheduledTask.getLogs();
      const queue = await Queue.getItems();
      const full = await Queue.isFull();
      const taskInstances = queue.reduce((allInstances, { task }) => {
        if (!(task.id in allInstances)) {
          allInstances[task.id] = 0;
        }

        allInstances[task.id]++;

        return allInstances;
      }, {});

      const tasks = (await Task.getAll()).map((task) => ({
        ...task.getData(),
        isReady: task.isReady || task.next_run <= serverTime,
        frequency: mapScheduleToFrequency(task.schedule),
        countdown: formatGranularTime(
          task.isReady || task.next_run <= serverTime
            ? 0
            : task.next_run - serverTime
        ),
        canQueue: !taskInstances[task.id] || taskInstances[task.id] < 2,
      }));

      let limit = ScheduledTasks.LIMIT;
      let parallel = ScheduledTasks.PARALLELLIMIT;

      // Sort tasks alphabetically by name
      tasks.sort((taskA, taskB) => (taskA.name < taskB.name ? -1 : 1));

      return res.status(200).json({
        success: true,
        logs: logs,
        full,
        limit,
        parallel,
        tasks,
        queue,
      });
    } catch (e) {
      console.log("error", e);
      console.log("error message", e.msg);
      return res.status(500).json({
        success: "false",
        msg: e.msg,
      });
    }
  }

  static async update(req, res) {
    const { task } = req.query;

    const matchedTask = await Task.get(task);

    if (matchedTask) {
      try {
        matchedTask.update(req.body);
        res.status(200).json({
          success: true,
        });
      } catch (err) {
        res.status(500).json({
          error: err.message,
        });
      }
    } else {
      res.status(400).json({
        error: `No task with ID ${task} was found.`,
      });
    }
  }

  trigger(req, res) {
    const { action, task } = req.query;
    const response = {
      status: 400,
      error: "Please provide a valid action parameter.",
      message: "",
    };
    const matchedTask = Task.get(task);

    if (!matchedTask) {
      response.error = "Please provide an existing task ID.";
    } else {
      switch (action) {
        case "start":
          break;
        case "stop":
          break;
        default:
          break;
      }
    }

    return response;
  }

  static async logs(req, res) {
    const { task: taskID, after: afterTimestamp } = req.query;

    let success = false,
      status = 404,
      message = "",
      error = `No task with ID ${taskID} was found.`,
      data = null;

    if (!taskID) {
      status = 400;
      error = `Missing required parameter: task`;
    } else {
      const tasks = await Task.getAll();
      const matchedTask = tasks.find(({ id }) => id === taskID);

      if (matchedTask) {
        status = 200;
        error = "";

        try {
          const logs = await matchedTask.getLogs(Number(afterTimestamp));

          data = {
            name: matchedTask.name,
            logs,
          };
        } catch (err) {
          console.error(err);
          status = 500;
          error = err.message;
        }
      }
    }

    return res.status(status).json({
      success,
      error,
      message,
      data,
    });
  }
}

module.exports = TaskController;
