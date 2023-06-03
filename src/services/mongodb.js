const connect = require('mongoose').connect;

module.exports = {
    Connect: function(url) {
        mongoOptions = { useNewUrlParser: true, useUnifiedTopology: true };
        connect(url, mongoOptions)
            .then(() => console.log('MongoDB connection established successfully.'))
            .catch(err => console.log('Failed to establish connection to MongoDB:\n' + err))
    }
}
