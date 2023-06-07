const { User } = require('../domain/user.js');
const { Lock } = require('../domain/lock.js');
const imageData = require('../services/imageData.js');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
dotenv.config({'path': 'config/settings.env'});

module.exports = {
    // Returns single user if id supplied or all users
    // undefined if failure
    Get: async function(res, id) {
        var user;
        if (id === undefined) {
            user = await User.find();
        } else {
            user = await User.find({ _id: id });
        }

        if (user.length === 0) {
            console.log("Failed to find user with id: " + id);
            res.status(400).json("Failed to find user/s.");
            return undefined;
        }
        return user;
    },

    // Returns single user
    // undefined if failure
    GetFromMail: async function(res, email) {
        var user = await User.find({ email: email });

        if (user.length === 0) {
            console.log("Failed to find user with email: " + email);
            res.status(400).json("Failed to find user/s.");
            return undefined;
        }

        return user[0];
    },

    // Returns user, defined if fails
    // is_admin defines whether admin account is created
    Create: async function(req, res, is_admin) {
        let user = new User(req.body);

        if (user.email == null || user.password == null) {
            console.log("Failed to create user. Wrong arguments supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return undefined;
        } 

        const hash = await bcrypt.hash(user.password, process.env.SALT);
        user.email = user.email.toLowerCase();
        user.password = hash;

        const foundUser = await User.find({ email: user.email });
        if (foundUser.length != 0) {
            console.log("Failed to create user. User already exists: " + user.email);
            res.status(400).json("User with email already exists.");
            return undefined;
        }

        user.verified = false;
        user.is_admin = is_admin;
        await user.save();
        return user;
    },

    // Returns updated user, undefined if failure
    // id defines which user to update
    Update: async function(req, res, id) {
        if (id === undefined) {
            console.log("Failed to update user. No ID supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return undefined;
        }

        let user = await User.find({ _id: id });
        if (user.length == 0) {
            console.log("Failed to update user. Could not find user with ID: " + id);
            res.status(400).json("Couldn't find user in database.");
            return undefined;
        }
        user = user[0];

        if (req.body.email != null)
            user.email = req.body.email;

        if (req.body.name != null)
            user.name = req.body.name;

        if (req.body.password != null)
            user.password = req.body.password;

        if (req.body.verified != null)
            user.verified = req.body.verified;

        if (req.body.user_access != null)
            user.user_access = req.body.user_access;

        if (req.body.is_admin != null)
            user.is_admin = req.body.is_admin;
        
        if (req.body.image != null) {
            var paths = imageData.Update(req, res, id);
            if (paths === undefined)
                return undefined;

            user.photo_path = paths.photo_path;
            user.encoding_path = paths.encoding_path;
        }

        console.log(user)

        await user.save();
        return user;
    },

    // Returns user if success, undefined if failure
    Delete: async function(req, res) {
        // Get id and find user
        const id = req.body._id;
        var user = await User.find({ _id: id });

        // Verify user found
        if (user.length == 0) {
            console.log("Failed to delete user. Could not find user with ID: " + id);
            res.status(400).json("Couldn't find user in database.")
            return undefined;
        }
        user = user[0];

        // Delete locks owned by user
        var locks = Object.values(user.user_access);
        if (!locks) {
            console.log("Failed to delete user. User_access does not convert to array.");
            res.status(500).json("Something went wrong. Please contact a developer.");
            return undefined;
        }
        for (var lockID of locks) {
            // Find every lock in the user_access array
            var currentLock = await Lock.find({ _id: lockID });
            if (currentLock.length == 0) continue;
            
            // if the user is the owner of the lock
            if (currentLock[0].owner == id) {
                // go through every user with access to the lock
                var users = Object.values(currentLock[0].lock_access);
                if (!users) continue;
                for (var guestID of Object.values(currentLock[0].lock_access)) {
                    var currentUser = await User.find({ _id: guestID });
                    if (currentUser.length == 0) continue;

                    // if lock is also present in their user_access
                    // remove the lock from user_access and save updated user
                    if (currentUser[0].user_access.includes(lockID)) {
                        currentUser[0].user_access = currentUser[0].user_access.filter(function (e) { return e !== lockID });
                        await currentUser[0].save();
                    }
                }

                // remove lock
                await Lock.findByIdAndRemove(currentLock[0]._id.toString());
            } 
            // if the user is not the owner of the lock
            else {
                // remove userid from locks lock_access array and save updates
                currentLock[0].lock_access = currentLock[0].lock_access.filter(function (e) { return e !== user._id });
                await currentLock[0].save();
            }
        }

        // Remove and return result
        await User.findByIdAndRemove(id);
        return user;
    }
}
