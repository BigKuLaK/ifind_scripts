const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_SERVER_URL);

const LogEntryModel = mongoose.model('LogEntry', {
    message: String,
    dateTime: Date,
    type: String,
    context: String,
});

(async() => {
    // LogEntryModel.insertMany([
    //     {
    //         message: 'Test Log',
    //         dateTime: new Date(),
    //         type: 'ERROR',
    //         context: 'amazon_products',
    //     }
    // ])

    
    const logs = await LogEntryModel.find();

    console.log({ logs });
})();