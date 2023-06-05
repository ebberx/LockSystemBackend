const Verify = require('./services/verification.js');
const Token = require('./services/token.js');
const imageData = require('./services/imageData.js');
const userRepo = require('./repositories/userRepo.js');
const lockRepo = require('./repositories/lockRepo.js');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config({'path': 'config/settings.env'});


module.exports = function(app, ws) {
    /////////////////////
    /// FUNCTIONALITY ///
    /////////////////////
    //
    // Login
    //
    app.post('/api/v1/login', async (req, res) => {
        let loginData = req.body;

        // Debug
        console.log("[Functionality:Login]");
        console.log(loginData);

        // if no email and password is supplied
        if (loginData.email == null || loginData.password == null) {
            console.log("Wrong arguments supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return;
        }

        loginData.email = loginData.email.toLowerCase();

        // Query for the user
        const user = await userRepo.GetFromMail(res, loginData.email);
        if (user === undefined) 
            return;

        // Check if credentials match
        bcrypt.compare(loginData.password, user.password, (err, result) => {
            // Password is valid
            if (result) {
                const token = Token.GenerateAccessToken(user._id, user.email, user.is_admin);
                console.log("Login success.");
                res.status(200).json(token);
            } 
            // Password is not valid
            else {
                console.log("Login failed. Invalid credentials.");
                res.status(400).json("Invalid credentials.");
            }

        });
    });

    //
    // !!! DEPRECATED !!!
    // Logout
    //
    // app.post('/api/v1/logout', async (req, res) => {
    //     // Debug
    //     console.log("[Functionality:Logout]");
    //     console.log(JSON.stringify(req.headers));
    //
    //     // If no token is supplied
    //     const token = Token.FromHeader(res, req);
    //     if (token === undefined) return;
    //
    //     // Do logout and handle result
    //     if (Token.RevokeAccessToken(token)) {
    //         console.log("Logout successful.");
    //         res.status(200).json("OK");
    //     } else {
    //         console.log("Token does not exist.");
    //         res.status(400).json("Token does not exist.");
    //     }
    // });

    //
    // Verify User Face
    //
    app.post('/api/v1/verifyFace', async (req, res) => {
        let bodyData = req.body;

        // Debug
        console.log("[Functionality:VerifyFace]");
        console.log(bodyData)

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Ensure required data
        if (bodyData.image_data === null) {
            console.log("Wrong arguments supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return;
        }

        // Find calling user
        const user = await userRepo.Get(res, decoded._id);
        if (user === undefined) return;

        var similarity = await imageData.Verify(req, res, user[0]);
        if (similarity === undefined) return;

        if (similarity >= 0.92) {
            res.status(200).json("OK - Access granted");
        } else {
            res.status(400).json("Failed to verify user.");
        }
    });

    ////////////
    /// USER ///
    ////////////
    //
    // Get All
    //
    app.get('/api/v1/user', async (req, res) => {
        // Debug
        console.log("[User:GetAll]");

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get all and remove properties based on rights
        const allUsers = await userRepo.Get(res);
        if (decoded.is_admin === false) {
            allUsers.forEach((item) => {
                item.password = undefined;
                item.verified = undefined;
                item.photo_path = undefined;
                item.encoding_path = undefined;
                item.user_access = undefined;
                item.is_admin = undefined;
            });
        } else {
            allUsers.forEach((item) => {
                item.password = undefined;
            });
        }

        // Return results
        res.status(200).json(allUsers);
    });

    //
    // Get Single
    //
    app.get('/api/v1/user/:id', async (req, res) => {
        console.log("[User:GetSingle]");

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        var userID = req.params.id;

        // Get desired user entity, and remove properties based on rights
        var desiredUser = await userRepo.Get(res, userID);
        if (desiredUser === undefined) return;
        
        // If calling user is admin, or regular using is getting own info
        if (decoded.is_admin === true || userID == decoded._id) {
            // Read image file from filesystem
            var fs = require('fs');
            const filePath = "/home/debian/lockbackend/LockSystemBackend/images/" + desiredUser[0]._id;

            var foundImage = false;
            var base64Header = "";
            var fileData;
            try {
                var fileData = await fs.promises.readFile(filePath + ".jpg", {encoding: 'base64'});
                if (fileData !== null) {
                    foundImage = true;
                    base64Header = "data:image/jpeg;base64,";
                }
                else fileData = await fs.promises.readFile(filePath + ".png", {encoding: 'base64'});
                if (fileData !== null) {
                    foundImage = true;
                    base64Header = "data:image/png;base64,";
                }
            } catch (e) {
                console.log(e);
            }
            
            // // Determine file extension
            // let fileType = "";
            // let base64Header = "";
            //
            // // Check if JPG
            // await fs.promises.access(filePath + ".jpg").then(() => { 
            //     fileType = ".jpg"; 
            //     base64Header = "data:image/jpeg;base64,"; 
            // }).catch(() => { 
            //     console.log(filePath + ".jpg does not exist"); 
            // })
            // // Check if PNG
            // await fs.promises.access(filePath + ".png").then(() => { 
            //     fileType = ".png"; 
            //     base64Header = "data:image/png;base64,"; 
            // }).catch(() => { 
            //     console.log(filePath + ".png does not exist"); 
            // })
            //
            // // Make sure we found a file type
            // if(fileType !== "") {
            //     // Get file data
            //     const fileData = await fs.promises.readFile(filePath + fileType, {encoding: 'base64'})
            //     // Add file data to reply
            //     if(fileData !== null)
            //         desiredUser[0].image = base64Header+fileData;
            // }
            if (foundImage) {
                desiredUser[0].image = base64Header + fileData;
                console.log(desiredUser[0].image);
            }
        }

        // Remove properties based on rights
        if (decoded.is_admin === false) {
            desiredUser[0].verified = undefined;
            desiredUser[0].photo_path = undefined;
            desiredUser[0].encoding_path = undefined;
            desiredUser[0].is_admin = undefined
        }
        if (decoded._id != userID && decoded.is_admin !== true) {
            desiredUser[0].user_access = undefined;
        }
        desiredUser[0].password = undefined;
        
        // Return results
        res.status(200).json(desiredUser[0]);
    });

    //
    // Create
    //
    app.post('/api/v1/user', async (req, res) => {
        var tokenSupplied = true;
        var isAdmin = false;

        // Debug
        console.log("[User:Create]");
        console.log(req.body);

        // Create user - token and login not required
        // User can then use this creation to log in
        const user = await userRepo.Create(req, res, false);
        if (user === undefined) return;

        // Look for token, if one found -> get rights
        const token = req.headers.token;
        if (token === undefined) tokenSupplied = false;

        if (tokenSupplied === true) {
            const decoded = Token.VerifyToken(req, res);
            if (decoded === undefined) return;

            isAdmin = decoded.is_admin;
        }

        // Return created user, based on rights
        if (isAdmin === false) {
            user.verified = undefined;
            user.photo_path = undefined;
            user.encoding_path = undefined;
            user.is_admin = undefined;
            console.log("Created user for non admin user.");
        }
        user.password = undefined;
        res.status(201).json(user);
    });

    //
    // Update
    //
    app.put('/api/v1/user', async (req, res) => {
        // Debug
        console.log("[User:Update]");
        console.log(req.body);

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        var userID;
        if (req.body._id !== undefined && decoded.is_admin) {
            userID = req.body._id;
        } else {
            userID = decoded._id;
        }

        // turn values into null if not is_admin
        if (decoded.is_admin === false) {
            if (req.body.verified != undefined) req.body.verifed = null;
            if (req.body.photo_path != undefined) req.body.photo_path = null;
            if (req.body.encoding_path != undefined) req.body.encoding_path = null;
            if (req.body.is_admin != undefined) req.body.is_admin = null;
        }

        // Update image data if supplied
        if (req.body.image !== undefined) {
            var fs = require('fs').promises;

            // Check if data has the header
            var data = (req.body.image + "").includes('data:image') ? req.body.image : null;
            if(data === null) {
                res.status(400).json("Failed to validate image data.")
                return;
            }
    
            // Get the file extension
            const fileType = data.includes("image/png") ? ".png" : data.includes("image/jpeg") ? ".jpg" : null
            if(fileType === null) {
                res.status(400).json("Failed to get image file type.")
                return;
            }
    
            // Remove header from data
            data = data.replace(/^data:image\/\w+;base64,/, "");
    
            var buf = Buffer.from(data, 'base64');
            // Image file path: Where the image should be saved
            var imageFilePath =  "images/" + userID + fileType;
            
            await fs.writeFile(imageFilePath, buf).then(() => {
                console.log(imageFilePath + " saved to file!"); 
                // Add to photo_path to user entry (db)
                req.body.photo_path = imageFilePath; 

                // Encoding file path: Where the python script should save the encoding
                const encodingFilePath = "encodings/" + userID + ".enc";

                const success = Verify.GenerateEncoding(imageFilePath, encodingFilePath);
                // Add encoding file path to user entry (db) in case the encoding was successfully generated
                if(success === true)
                    req.body.encoding_path = encodingFilePath;

                console.log(success)
                console.log("set encoding path to: " + encodingFilePath)
            });
        }

        // Update user data
        var updatedUser = await userRepo.Update(req, res, userID);
        if (updatedUser === undefined) return;

        if (decoded.is_admin === false) {
            updatedUser.verified = undefined;
            updatedUser.photo_path = undefined;
            updatedUser.encoding_path = undefined;
            updatedUser.is_admin = undefined;
        }
        updatedUser.password = undefined;

        console.log("Successfully updated user: " + updatedUser._id);
        res.status(200).json(updatedUser);
    });

    //
    // Delete
    //
    app.delete('/api/v1/user', async (req, res) => {
        // Debug
        console.log("[User:Delete]");

        // Verify token and ensure token data return
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Verify caller is allowed to delete specified user
        if (req.body._id === undefined) req.body._id = decoded._id;
        if (decoded.is_admin === false && req.body._id != decoded._id) {
            console.log("Non admin user {" + decoded._id + "} tried to delete user {" + req._id + "}");
            res.status(403).json("Invalid rights.");
            return;
        }

        // Delete user
        const user = userRepo.Delete(req, res);
        if (user === undefined) return;

        // Return result
        res.status(204).send();
    });

    ////////////
    /// LOCK ///
    ////////////
    //
    // Get All
    //
    app.get('/api/v1/lock', async (req, res) => {
        // Debug
        console.log("[Lock:GetAll]");
        console.log(req.headers);

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Find user based on token
        const user = await userRepo.Get(res, decoded._id);
        if (user === undefined) return;

        // Query locks based on rights
        var allLocks = [];
        if (decoded.is_admin === true) {
            allLocks = await lockRepo.Get(res);
            if (allLocks === undefined) return;
            console.log("Sent all lock data to admin.");
        } else {
            for (const lockID of user[0].user_access) {
                var lock = await lockRepo.Get(res, lockID);
                if (lock === undefined) return;
                allLocks.push(lock);
            }
            console.log("Sent user_access locks to normal user.");
        }

        res.status(200).json(allLocks);
    });

    //
    // Get Single
    //
    app.get('/api/v1/lock/:id', async (req, res) => {
        // Debug
        console.log("[Lock:GetSingle]");

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get LockID
        var lockID = req.params.id;

        // Get desired lock
        var lock = await lockRepo.Get(res, lockID);
        if (lock === undefined) return;

        // If not admin and neither owner nor access, do not send
        if (decoded.is_admin === false && (lock[0].owner != decoded._id || lock[0].lock_access.includes(decoded._id) == false)) {
            console.log("User {" + decoded._id + "} tried accessing lock {" + lock._id + "}, but does not have the rights to do so.");
            res.status(403).json("Invalid rights.");
            return;
        }

        // return lock
        res.status(200).json(lock);
    });

    //
    // Create
    //
    app.post('/api/v1/lock', async (req, res) => {
        // Debug
        console.log("[Lock:Create]");
        console.log(req.body);

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Find user based on token
        var user = await userRepo.Get(res, decoded._id);
        if (user === undefined) return;

        // Check if arguments needed are supplied
        var ownerID;
        if (req.body.serial == null) {
            console.log("Wrong arguments supplied.");
            res.status(400).json("Wrong arguments supplied.");
            return;
        }

        if (req.body.owner != null && decoded.is_admin === false) {
            ownerID = user[0]._id;
        }
        if (req.body.owner != null && decoded.is_admin === true) {
            user = await userRepo.Get(res, req.body.owner);
            if (user === undefined) return;
        }
        if (req.body.owner == null) ownerID = user[0]._id;

        user = user[0];

        // Create lock and add to owner user_access
        const lock = await lockRepo.Create(req, res, ownerID);
        if (lock === undefined) return;

        user.user_access.push(lock._id);
        var request = { 
            body: {
                _id: user._id,
                user_access: user.user_access, 
            },
        };
        user = await userRepo.Update(request, res, user._id);
        if (user === undefined) return;

        // Return result
        res.status(201).json(lock);
    });

    //
    // To be implemented:
    // Update
    //
    app.put('/api/v1/lock', async (req, res) => {
        // Debug
        console.log("[Lock:Update]");
        console.log(JSON.stringify(req.body));

        // Token shenanigans
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get lock in question
        const lock = await lockRepo.Get(res, req.body._id);
        if (lock === undefined) return;

        // Ensure proper rights to update lock
        if (decoded.is_admin === false && lock.owner != decoded._id) {
            console.log("Non admin user tried to update lock. UserID: " + decoded._id);
            res.status(403).json("Invalid rights.");
            return;
        }

        // Update lock
        const updatedLock = await lockRepo.Update(req, res);
        if (updatedLock === undefined) return;

        console.log("Updated lock: " + updatedLock._id);
        res.status(200).json(updatedLock);
    });

    //
    // Delete
    //
    app.delete('/api/v1/lock', async (req, res) => {
        // Debug
        console.log("[Lock:Delete]");

        // Verify token and ensure token data return
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Verify caller is allowed to delete specified lock
        var lock;
        if (decoded.is_admin === false) {
            lock = await lockRepo.Get(res, req.body._id);
            if (lock === undefined) return;
            lock = lock[0];
            if (decoded._id != lock.owner) {
                console.log("Non admin user {" + decoded._id + "} tried to delete lock {" + lock._id + "}");
                res.status(403).json("Invalid rights.");
                return;
            }
        }

        // Delete lock
        lock = await lockRepo.Delete(req, res);
        if (lock === undefined) return;

        // Return result
        res.status(204).send();
    });

    /////////////
    /// DEBUG ///
    /////////////
    //
    // !!! DEPRECATED !!!
    // Get Tokens
    //
    // app.get('/api/v1/debug/tokens', async (req, res) => {
    //     const token = Object.fromEntries(Token.tokenUserMap);
    //     if(token !== null)
    //         res.status(200).json(token);
    //     else
    //         res.status(200).json("No tokens in server.");
    //
    //     return;
    // });

    //
    // User Access Test
    //
    app.get('/api/v1/debug/userAccess', async (req, res) => {
        console.log("[UserAccess]:");

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        console.log("OK - User has access.");
        res.status(200).json("OK - User has access.");
    });

    //
    // Check if online
    //
    app.get('/api/v1/debug/isOnline', async (req, res) => {
        console.log("[IsOnline]");
        res.status(200).json("OK - Online");
        return;
    });
}
