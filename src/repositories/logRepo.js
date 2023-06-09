const { Log } = require('../domain/log.js');

module.exports = {
    // Get logs based on lock_id
    Get: async function(lock_id, res) {
        try {
            // Find logs
            const logs = await Log.find({ lock: lock_id });
            return logs;
        }
        catch (err) {
            console.log(err);
            res.status(500).json("Something went wrong.");
            return undefined;
        }
    },

    // Create logs
    Create: async function(req, res) {
        try {
            var log = new Log(req.body);

            // Set date
            log.date = Date.now();
            log.message = log.date.toString() + ": " + log.message;

            log.save();
            return log;
        }
        catch (err) {
            console.log(err);
            res.status(500).json("Something went wrong.");
            return undefined;
        }
    }
}
