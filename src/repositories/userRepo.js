const { User } = require('../domain/user.js');
const imageData = require('../services/imageData.js');

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

        if (user === null) {
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

        if (user === null) {
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

        user.email = user.email.toLowerCase();

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
        
        if (req.body.image_data != null) {
            var paths = imageData.Update(req, res, id);
            if (paths === undefined)
                return undefined;

            user.photo_path = paths.photo_path;
            user.encoding_path = paths.encoding_path;
        }

        await user.save();
        return user;
    },

    // To be implemented
    // Delete: async function(req, res) {
    //
    // }
}
