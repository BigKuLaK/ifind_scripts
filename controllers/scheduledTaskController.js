// const scheduledtask = require('../scheduled-tasks');
import {ScheduledTasks } from '../scheduled-tasks';

exports.scheduledTask = async(req,res) =>{
    try{
        const scheduledTask = new ScheduledTasks;
        console.log("scheduled task : ", scheduledTask);
        
    }catch(e){
        console.log("error");
        return res.status(500).json({
            success:"false",
            msg : e.msg  
        })
    }    
}