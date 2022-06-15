const ScheduledTasks = require('../scheduled-tasks');
// const Queue = require('../execution-queue');

exports.taskControllerApi = async (req, res) => {
    try {
        const scheduledTask = ScheduledTasks.getInstance();
        // const execution_queue = Queue.getInstance();
        scheduledTask.init();
        const taskList = scheduledTask.list();
        const logs = scheduledTask.getLogs();
        // console.log("Logs Received ", logs);
        // taskList.map(task=>{
            // console.log("task name : ", task.name, " -  status : ", task.status);
            // console.log("task name : ", task.name, " -  isAdded : ", task.isAdded);
        // })
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
                // scheduledTask.runCommand(command,id)
            }
            else
            {
                console.log("Task is Running");
            }
        }
        else 
        {
              console.log("Queue is Empty")
        }
       
        // taskList.map(task=>{
        //     if(task.isAdded == "true"){
        //         addedTasks.push(task);
        //     }
        // })
        // console.log("AddedTasks : ", addedTasks);
        let execution_limit = ScheduledTasks.LIMIT;
        let parallel_limit = ScheduledTasks.PARALLELLIMIT;

        console.log("execution_limit--->", execution_limit)
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
