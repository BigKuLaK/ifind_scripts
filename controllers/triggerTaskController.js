const ScheduledTasks = require('../scheduled-tasks');
const Queue = require('../scheduled-tasks/lib/Queue')

exports.triggerTaskAPI = async(req,res) =>{
  try{
    console.log("Inside TriggerTask API ", req.body);
    const scheduledTask = new ScheduledTasks;
    let taskId = req.body.taskID ;
    let action = req.body.action ;
    switch (action){
      case 'start' :
        // await scheduledTask.init();
        await scheduledTask.start(taskId);
        break;
      case 'stop':
        // await scheduledTask.init();
        await scheduledTask.stop(taskId);
        break;
      default:
          console.log("Action does not match, action :", action);
    }
    return res.status(200).json({
      sucess:"true",
      msg : "API Call Successfull, Scraping initiated in background"
    })
  }catch(e){
      console.log(e);
      return res.status(500).json({
          success:"false",
          msg : e.msg
      })
  }
}