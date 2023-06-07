const { Invite } = require('../domain/invite.js');
const lockRepo = require('../repositories/lockRepo.js');
const userRepo = require('../repositories/userRepo.js');

module.exports = {
    // Get invite based on the ID
    Get: async function(res, id) {
        // Find invite
        var invite;
        if (id === undefined) {
            invite = await Invite.find();
        } else {
            invite = await Invite.find({ _id: id });
        }

        // Deal with potential null values
        if (invite === null) {
            console.log("Failed to find invite with id: " + id);
            res.status(400).json("Failed to find invite/s.");
            return undefined;
        }

        return invite;
    },
    
    // Get invites based on the from and to properties
    GetByFromTo: async function(res, from, to) {
        // Exit early
        if(from === undefined && to === undefined) return undefined;
        
        // Find invite
        var invite;
        if (from === undefined && to !== undefined) {
            invite = await Invite.find({ to: to });
        } 
        else if(to === undefined) {
            invite = await Invite.find({ from: from });
        } 
        else {
            invite = await Invite.find({ from: from, to: to });
        }

        // Deal with potential null values
        if (invite === null) {
            console.log("Failed to find invite with id: " + id);
            res.status(400).json("Failed to find invite/s.");
            return undefined;
        }

        return invite;
    },

    // Get invite based on the lock ID
    GetByLockID: async function(res, lockID) {
        // Exit early
        if(res === undefined || lockID === undefined) {
            console.log("Wrong arugment supplied.");
            res.status(400).json("Wrong arugment supplied.");
            return undefined;
        }

        // Find invite
        var invite = await Invite.find({ lock: lockID });

        // Deal with potential null values
        if (invite === null) {
            console.log("Failed to find invite with id: " + id);
            res.status(400).json("Failed to find invite/s.");
            return undefined;
        }

        return invite;
    },

    // Atm creates an invite from the data supplied _WITHOUT_ checking if duplicates exist
    Create: async function(req, res) {
        var invite = new Invite(req.body);

        // Check for required values
        if (invite.from === null || invite.to === null || invite.lock === null) {
            console.log("Failed to create invite. Wrong arguments supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return undefined;
        }

        // Find from and to users and make sure they are valid (invalid if undefined)
        var from = await userRepo.Get(res, invite.from);
        if (from === undefined) return undefined;
        var to = await userRepo.Get(res, invite.to);
        if (to === undefined) return undefined;

        // Check if the lock exists
        const lock = await lockRepo.Get(res, invite.lock);
        if(lock === undefined) return undefined;

        // Check that the from user is the owner of the lock
        if(lock[0].owner != invite.from) { 
            res.status(400).json("Could not create invite. Bad arguments.");
            console.log("'from' user is not the owner of the supplied lock ID.");
            console.log("lock[0].owner: " + lock[0].owner + " !== " + "invite.from: " + invite.from)
            return undefined;
        }

        // Check if the user already has access to the lock
        for(const userID of Object.values(lock[0].lock_access)) {
            if(userID == invite.to) {
                res.status(400).json("Invited user already has access.")
                console.log("Invited user already has access.")
                return undefined;
            }
        }

        invite.date = Date.now();
        invite.accepted = false;
        
        invite.save();
        return invite;
    },
    
    // Updates invite with supplied ID.
    Update: async function(req, res) {
        const id = req.body._id;

        const invite = await Invite.find({ _id: id });
        if (invite === null) {
            console.log("Failed to update invite. Could not find invite with ID: " + id);
            res.status(400).json("Couldn't find invite in database.");
            return undefined;
        }
        invite = invite[0];

        // Validate users and lock
        const from = await userRepo.Get(res, req.body.from);
        if (from === undefined) return undefined;
        const to = await userRepo.Get(res, req.body.to);
        if (to === undefined) return undefined;
        const lock = lockRepo.Get(req.body.lock);
        if(lock === undefined) return undefined;


        // Update properties
        if (req.body.from != null)
            invite.from = req.body.from;
        if (req.body.to != null)
            invite.to = req.body.to;
        if (req.body.lock != null)
            invite.lock = req.body.lock;
        if (req.body.date != null)
            invite.date = req.body.date;
        if (req.body.accepted != null)
            invite.accepted = req.body.accepted;

        // Save changes and return updated lock
        await invite.save();
        return invite;
    },

    // Deletes invite with supplied ID
    Delete: async function(req, res, id) {
        const invite = await Invite.find({ _id: id });
        if(invite === null) {
            console.log("Failed to delete invite. Couldn't find invite in database. ID: " + id);
            res.status(400).json("Couldn't find invite in database.");
            return undefined;
        }

        return await Invite.deleteOne({ _id: id });
    }
}
