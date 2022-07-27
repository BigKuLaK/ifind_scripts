const ScheduledTasks = require("../scheduled-tasks");
const Task = require("../scheduled-tasks/lib/Task");
const Queue = require("../scheduled-tasks/lib/Queue");

class TaskController {
  // TODO: Improve this logic, and move to scheduled tasks controller
  // tasks listing
  static async index(req, res) {
    try {
      const scheduledTask =
        req.app.get("scheduledTasks") || ScheduledTasks.getInstance();
      scheduledTask.init();

      const tasks = await scheduledTask.list();
      const logs = await scheduledTask.getLogs();
      const queue = await Queue.getItems();
      const full = await Queue.isFull();

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
