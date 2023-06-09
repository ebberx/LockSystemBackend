const { User } = require('../domain/user.js');
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
        if (lock.length === 0) {
            console.log("Failed to find lock with id: " + id);
            res.status(400).json("Failed to find lock/s.");
            return undefined;
        }

        return lock;
    },

    // Returns lock, undefined if failure
    Create: async function(req, res, ownerID) {
        var lock = new Lock(req.body);
        console.log("Created temp lock:\n"+lock);
        // Check for required values
        if (lock.serial == null) {
            console.log("Failed to create lock. Wrong arguments supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return undefined;
        }

        // Does lock with serial exist
        const foundLock = await Lock.find({ serial: lock.serial });
        if (foundLock.length != 0) {
            console.log("Failed to create lock. Lock with serial already exists.");
            res.status(400).json("Lock with serial already exists.");
            return undefined;
        }

        // Find owner
        var owner = await userRepo.Get(res, ownerID);
        if (owner === undefined) return;

        lock.owner = owner[0]._id;
        lock.active = false;
        lock.save();

        console.log("Created lock:\n"+lock);
        return lock;
    },

    Update: async function(req, res) {
        // Get lock id, lock and verify result found
        var lock = await Lock.find({ _id: req.body._id });
        if (lock.length == 0) {
            console.log("Failed to update lock. Could not find lock with ID: " + req.body._id);
            res.status(400).json("Couldn't find lock in database.");
            return undefined;
        }
        lock = lock[0];
       
        if (lock.serial != req.body.serial) {
            const foundLock = await Lock.find({ serial: req.body.serial });
            if (foundLock.length != 0) {
                console.log("Failed to update lock. Lock with serial already exists.");
                res.status(400).json("Couldn't update lock. Serial already exists.");
                return undefined;
            }
        }
        
        // Update properties
        if (req.body.serial != null && lock.serial != req.body.serial)
            lock.serial = req.body.serial;

        if (req.body.name != null && lock.name != req.body.name)
            lock.name = req.body.name;

        if (req.body.location != null && lock.location != req.body.location)
            lock.location = req.body.location;

        if (req.body.active != null && lock.active != req.body.active)
            lock.active = req.body.active;

        if (req.body.owner != null && lock.owner.toString() != req.body.owner.toString()) {
            // Get new owner
            const newOwner = await User.find({_id: req.body.owner});
            if (newOwner.length == 0) {
                console.log("Failed to update lock. New owner with ID: {" + req.body.owner + "} does not exist.");
                res.status(400).json("Couldn't update lock. New owner with provided ID does not exist.");
                return undefined;
            }

            // Get old owner and update user_access if still exists
            const oldOwner = await User.find({_id: lock.owner});
            if (oldOwner.length != 0) {
                oldOwner[0].user_access = oldOwner[0].user_access.filter(function (e) { return e.toString() !== lock._id.toString() });
                await oldOwner[0].save();
            }

            // Add lock_id to new owners user_access
            newOwner[0].user_access.push(lock._id);
            await newOwner[0].save();

            lock.owner = req.body.owner;
        }

        if (req.body.lock_access != null && lock.lock_access.toString() != req.body.lock_access.toString()) {
            lock.lock_access = req.body.lock_access
        }

        // Save changes and return updated lock
        await lock.save();
        return lock;
    },

    // Returns lock if success, undefined if failure
    Delete: async function(req, res) {
        // Get id and find lock
        const id = req.body._id;
        var lock = await Lock.find({ _id: id });

        // Verify lock found
        if (lock.length == 0) {
            console.log("Failed to delete lock. Could not find lock with ID: " + id);
            res.status(400).json("Couldn't find lock in database.");
            return undefined;
        }
        lock = lock[0];

        // Remove lockid from users with access
        var users = lock.lock_access;
        users.push(lock.owner);
        for (var userID of users) {
            var currentUser = await User.find({ _id: userID });
            if (currentUser.length == 0) continue;

            if (currentUser[0].user_access.includes(id)) {
                currentUser[0].user_access = currentUser[0].user_access.filter(function (e) { return e.toString() !== id.toString() });
                await currentUser[0].save();
            }
        }

        // Remove lock
        await Lock.findByIdAndRemove(id);
        return lock;
    }
}
