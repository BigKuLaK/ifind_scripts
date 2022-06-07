const ScheduledTasks = require('../scheduled-tasks');

exports.taskControllerApi = async (req, res) => {
    try {
        const scheduledTask = ScheduledTasks.getInstance();
        scheduledTask.init();
        const taskList = scheduledTask.list();
        const logs = scheduledTask.getLogs();
        // console.log("Logs Received ", logs);
        // taskList.map(task=>{
        //     console.log("task name : ", task.name, " -  status : ", task.status);
        //     console.log("task name : ", task.name, " -  isAdded : ", task.isAdded);
        // })
        let addedTasks = []
        // taskList.map(task=>{
        //     if(task.isAdded == "true"){
        //         addedTasks.push(task);
        //     }
        // })
        addedTasks = scheduledTask.getQueue();
        let execution_limit = ScheduledTasks.LIMIT;
        console.log("execution_limit--->", execution_limit)
        return res.status(200).json({
          success: "True",
          tasks: taskList,
          logs : logs,
          isTaskAdded: addedTasks,
          limit : execution_limit
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
