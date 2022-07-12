const ScheduledTasks = require('../scheduled-tasks');
// const Queue = require('../execution-queue');

exports.taskControllerApi = async (req, res) => {
    try {
        const scheduledTask = ScheduledTasks.getInstance();
        scheduledTask.init();
        const taskList = scheduledTask.list();
        const logs = await scheduledTask.getLogs();
        let addedTasks = scheduledTask.getQueue();
        if(addedTasks.length !== 0)
        {
            let firstQueue = addedTasks[0]
            let status = firstQueue.status
            let id = firstQueue.id
            if(status == "stopped")
            {   
                console.log("Starting task from task.js; First task status stopped reveived");
                const command = "start"
            }
            else
            {
                // Task is running
            }
        }
        else 
        {
            // Queue is empty
        }

        let execution_limit = ScheduledTasks.LIMIT;
        let parallel_limit = ScheduledTasks.PARALLELLIMIT;

        return res.status(200).json({
          success: "True",
          tasks: taskList,
          logs : logs,
          isTaskAdded: addedTasks,
          limit : execution_limit,
          parallel: parallel_limit
          })
    }
    catch (e) {
        console.log("error", e);
        console.log("error message", e.msg);
        return res.status(500).json({
            success: "false",
            msg: e.msg
        })
    }
};

// setTimeout(this.taskControllerApi, 1000);
