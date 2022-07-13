const e = require('express');
const ScheduledTasks = require('../scheduled-tasks');
const { task } = require('../scheduled-tasks/config/_models');
const Queue = require('../scheduled-tasks/lib/Queue')

exports.triggerTaskAPI = async(req,res) =>{
  try{
    let taskId = req.body.taskID ;
    let action = req.body.action ;
    let position = req.body.position ;
    if(!taskId || !action){
      return res.status(500).json({
        success : "false",
        msg : "taskID or action is missing"
      })
    }
    const scheduledTask = ScheduledTasks.getInstance();
    switch (action){
      case 'start' :
        await scheduledTask.init();
        // await scheduledTask.start(taskId);
        scheduledTask.parallel = true;
        scheduledTask.runCommand(action, taskId, false)
        break;
      case 'stop':
        // await scheduledTask.init();
        
        if(position!==null && position >= 0){
          console.log("Inside if contion in stop case");
          await scheduledTask.stop(taskId,position);
        }
        else {
          console.log("Else condition triggered in triggerTaskAPI");
          await scheduledTask.stop(taskId);
        }
          
        
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