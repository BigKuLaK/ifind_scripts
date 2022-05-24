// const scheduledtask = require('../scheduled-tasks');
const ScheduledTasks = require('../scheduled-tasks');

exports.scheduledTask = async(req,res) =>{
    console.log("inside sheduled task list controller API ");
    try{
        const scheduledTask = new ScheduledTasks;
        const tasks = scheduledTask.tasks();
        console.log("scheduled task : ", tasks);
        console.log("type of : ", tasks);
    }catch(e){
        console.log("error :", e);
        return res.status(500).json({
            success:"false",
            msg : e.msg  
        })
    }    
}