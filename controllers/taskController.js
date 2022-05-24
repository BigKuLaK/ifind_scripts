

exports.taskControllerApi = async(req,res) =>{
    try{
        const task = require ('../scheduled-tasks/config/_tasks');
        console.log("tasks :", task);
        return res.status(200).json({
            success:"True",
            tasks : task
        })
    }
    catch(e){
        console.log("error", e);
        console.log("error message", e.msg);
        return res.status(500).json({
            success:"false",
            msg : e.msg
        })
    }
};
