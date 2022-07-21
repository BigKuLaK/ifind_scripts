const mongoose = require('mongoose');

if ( !process.env.MONGO_SERVER_URL ) {
    throw new Error('Missing MONGO_SERVER_URL from env.');
}

mongoose.connect(process.env.MONGO_SERVER_URL, { maxPoolSize: 100 });

module.exports = mongoose;