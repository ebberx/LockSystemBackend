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
        console.log(JSON.stringify(req.headers));

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
            const filePath = "images/" + desiredUser[0]._id;
            
            // Determine file extension
            let fileType = "";
            let base64Header = "";

            // Check if JPG
            await fs.promises.access(filePath + ".jpg").then(() => { 
                fileType = ".jpg"; 
                base64Header = "data:image/jpeg;base64,"; 
            }).catch(() => { 
                console.log(filePath + ".jpg does not exist"); 
            })
            // Check if PNG
            await fs.promises.access(filePath + ".png").then(() => { 
                fileType = ".png"; 
                base64Header = "data:image/png;base64,"; 
            }).catch(() => { 
                console.log(filePath + ".png does not exist"); 
            })

            // Make sure we found a file type
            if(fileType !== "") {
                // Get file data
                const fileData = await fs.promises.readFile(filePath + fileType, {encoding: 'base64'})
                // Add file data to reply
                if(fileData !== null)
                    desiredUser[0].image = base64Header+fileData;
            }
        }

        console.log(decoded._id);
        console.log(userID);
        console.log(decoded.is_admin);
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
        console.log(JSON.stringify(req.body));

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        var userID;
        if (req.body._id !== undefined && decoded.is_admin) {
            userID = req.body._id;
        } else {
            userID = decoded._id;
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
    // To be implemented:
    // Delete
    //
    app.delete('/api/v1/user', async (req, res) => {
        res.status(500).json("Not implemented yet.");
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
    // To be implemented:
    // Get Single
    //
    app.get('/api/v1/lock:uid', async (req, res) => {
        res.status(500).json("Not implemented yet.");
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
        const user = await userRepo.Get(res, decoded._id);
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
        if (req.body.owner == null) ownerID = user[0]._id;

        // Create lock and return results
        const lock = await lockRepo.Create(req, res, ownerID);
        if (lock === undefined) return;

        res.status(201).json(lock);
    });

    //
    // To be implemented:
    // Update
    //
    app.put('/api/v1/lock', async (req, res) => {
        res.status(500).json("Not implemented yet.");
    });

    //
    // To be implemented:
    // Delete
    //
    app.delete('/api/v1/lock', async (req, res) => {
        res.status(500).json("Not implemented yet.");
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
