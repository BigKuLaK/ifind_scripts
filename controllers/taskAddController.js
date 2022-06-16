const ScheduledTasks = require('../scheduled-tasks');
// const Queue = require('../execution-queue');
exports.taskAddAPI = async(req,res) =>{
  try{
    console.log("Inside AddTask API ", req.body);
    const scheduledTask = ScheduledTasks.getInstance();
    // const execution_queue = Queue.getInstance();
    let taskId = req.body.taskID;
    let id =  taskId;

    // New Code - 8-06-2022 Sardeep
    let addedTasks = scheduledTask.getQueue();
    // console.log("Added Tasks", addedTasks);
    // if(addedTasks.length == 0)
    // {
      const queueLength = addedTasks.length
      if(queueLength == ScheduledTasks.LIMIT)
      {
        // res.status(200).json({
        //   success:false,
        //   msg:"Qeue is Full"  
        // })
        return
      }
      scheduledTask.runCommand("start",id);
    // }
    // else{
      scheduledTask.enqueue(taskId);
    // }

    // scheduledTask.init();
    // scheduledTask.setQueue(taskId);
    // const taskList = scheduledTask.list();
    // const runningTask = taskList.filter(item => item.status == "running")
    // if(runningTask.length == 0)
    // {
    //   let command = "start"
    //   console.log("---------------",id)
    //   await scheduledTask.runCommand(command,id);
    // }
    // const finalTaskList = scheduledTask.list();
    return res.status(200).json({
      sucess:"true",
      // msg : finalTaskList
    })
  }catch(e){
      console.log(e);
      return res.status(500).json({
          success:"false",
          msg : e.msg
      })
  }
}