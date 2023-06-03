const { Lock } = require('../domain/lock.js');
const userRepo = require('../repositories/userRepo.js');

module.exports = {
    // Returns single lock if id supplied or all users
    // undefined if failure
    Get: async function(res, id) {
        // Find lock/s
        var lock;
        if (id === undefined) {
            lock = await Lock.find();
        } else {
            lock = await Lock.find({ _id: id });
        }

        // Deal with potential null values
        if (lock === null) {
            console.log("Failed to find lock with id: " + id);
            res.status(400).json("Failed to find lock/s.");
            return undefined;
        }

        return lock;
    },

    // Returns lock, undefined if failure
    Create: async function(req, res, ownerID) {
        var lock = new Lock(req.body);

        // Check for required values
        if (lock.serial == null) {
            console.log("Failed to create lock. Wrong arguments supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return undefined;
        }

        // Find owner
        var owner = await userRepo.Get(res, ownerID);
        if (owner === undefined) {
            res.status(400).json("Failed to find owner.");
            return undefined;
        }

        lock.owner = owner[0]._id;
        lock.active = false;
        lock.save();
        return lock;
    }

    // To be implemented:
    // Update: async funtion(req, res, id) {
    //
    // }
    
    // To be implemented:
    // Delete: async function(req, res, id) {
    //
    // }
}
