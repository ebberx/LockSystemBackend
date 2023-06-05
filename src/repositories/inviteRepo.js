const { Lock, Invite } = require('../domain/invite.js');
const { lockRepo } = require('../repositories/lockRepo.js')

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
            invite = await Invite.find({from: from, to: to });
        }

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
        if (invite.from === null || invite.to === null || invite.date === null) {
            console.log("Failed to create invite. Wrong arguments supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return undefined;
        }

        // TODO: Check if user already has access to the lock
        //lockRepo.Get();

        // TODO: Find owner
        /*
        var owner = await userRepo.Get(res, ownerID);
        if (owner === undefined) {
            res.status(400).json("Failed to find owner.");
            return undefined;
        }
        */

        invite.accepted = false;
        invite.save();
        return invite;
    },
    
    // Updates invite with supplied ID.
    Update: async function(req, res) {
        // Get invite id and verify result found
        const id = req.body._id;
        const invite = await Invite.find({ _id: id });
        if (invite.length == 0) {
            console.log("Failed to update invite. Could not find invite with ID: " + id);
            res.status(400).json("Couldn't find invite in database.");
            return undefined;
        }
        invite = invite[0];

        // Update properties
        if (req.body.from != null)
            invite.from = req.body.from;

        if (req.body.to != null)
            invite.to = req.body.to;

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
        if(invite.length == 0) {
            console.log("Failed to delete invite. Couldn't find invite in database. ID: " + id);
            res.status(400).json("Couldn't find invite in database.");
        }

        return await Invite.deleteOne({ _id: id });
    }
}
