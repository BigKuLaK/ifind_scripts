const ScheduledTask = require('../scheduled-tasks')

exports.updatePositionAPI = async(req,res) => {
    try {
        console.log("Inside updatePositionAPI ", req.body);
        let action = req.body.action;
        let position = req.body.position;
        if (!action || !position) {
            return res.status(500).json({
                success: "false",
                msg: "action or position is missing"
            })
        }
    
    // Change the position :    
    const scheduledTask = ScheduledTask.getInstance();
    scheduledTask.changePosition(position,action)   
    return res.status(200).json({
        queue : scheduledTask.getQueue()
    })    
    } catch (err) {
        console.log("error : ", err);
        return res.status(500).json({
            success: "false",
            msg: err.msg
        })
    }
}