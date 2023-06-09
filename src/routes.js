const Token = require('./services/token.js');
const imageData = require('./services/imageData.js');
const userRepo = require('./repositories/userRepo.js');
const lockRepo = require('./repositories/lockRepo.js');
const inviteRepo = require('./repositories/inviteRepo.js')
const logRepo = require('./repositories/logRepo.js');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config({'path': 'config/settings.env'});

var blockedLocks = [];

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

        loginData.email = loginData.email.toLowerCase().trim();
        loginData.password = loginData.password.trim();

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
                const output = {
                    token: token,
                    _id: user._id
                }
                res.status(200).json(output);
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
        try {
            let bodyData = req.body;

            // Debug
            console.log("[Functionality:VerifyFace]");
            console.log(bodyData)

            const decoded = Token.VerifyToken(req, res);
            if (decoded === undefined) return;

            // Ensure required data
            if (bodyData.image_data === null || bodyData.lock_id === null) {
                console.log("Wrong arguments supplied.");
                res.status(400).json("Wrong arguments supplied.");
                return;
            }

            // Find calling user
            const user = await userRepo.Get(res, decoded._id);
            if (user === undefined) return;

            // Find desired lock
            const lock = await lockRepo.Get(res, bodyData.lock_id);
            if (lock === undefined) return;

            var logRequest = {
                body: {
                    lock: lock[0]._id
                }
            }

            // Check if user has access to lock
            if (lock[0].owner.toString() != user[0]._id.toString() && lock[0].lock_access.includes(user[0]._id) == false) {
                console.log("User {" + user[0]._id + "} tried to unlock lock {" + bodyData.lock_id + "}, but does not have access.");

                logRequest.body.message = user[0].email + " unsuccesfully tried to open lock " + lock[0].name;
                const log = await logRepo.Create(logRequest, res);
                if (log === undefined) return;

                res.status(400).json("Invalid rights.");
                return;
            }

            // Check if lock is blocked
            if (blockedLocks.includes(lock[0]._id) == true) {
                console.log("User {" + user[0]._id + "} tried to unlock lock {" + bodyData.lock_id + "}, but it is blocked.");
                res.status(403).json("Lock is blocked.");
                return;
            }

            // Get similarity
            var similarity = await imageData.Verify(req, res, user[0]);
            if (similarity === undefined) return;

            // Handle similarity
            if (similarity >= 0.92) {
                req.user_id = decoded._id;
                req.serial = lock[0].serial;
                req.rpi_message = '{"action": "unlock", "args": {"caller": "' + decoded._id + '"}}'
                if (await ws.Unlock(req, res) == false) return;
                
                logRequest.body.message = user[0].email + " successfully opened lock " + lock[0].name;
                const log = await logRepo.Create(logRequest, res);
                if (log === undefined) return;

                res.status(200).json("OK - Access granted");
            } else {
                logRequest.body.message = user[0].email + " unsuccessfully tried to open lock " + lock[0].name;
                const log = await logRepo.Create(logRequest, res);
                if (log === undefined) return;

                res.status(400).json("Failed to verify user.");
            }
        }
        catch(err) {
            console.log(err)
            res.status(500).json("you don goofed somewhere.")
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
        desiredUser = desiredUser[0].toObject();
        
        // If calling user is admin, or regular using is getting own info
        if (decoded.is_admin === true || userID == decoded._id) {
            // Read image file from filesystem
            var fs = require('fs');
            const filePath = "/home/debian/lockbackend/LockSystemBackend/images/" + desiredUser._id;

            var foundImage = false;
            var base64Header = "";
            var fileData;
            try {
                var fileData = await fs.promises.readFile(filePath + ".jpg", {encoding: 'base64'});
                if (fileData !== null) {
                    foundImage = true;
                    base64Header = "data:image/jpeg;base64,";
                }
            } catch (e) {
                console.log(e);
            }
            
            try {
                if (foundImage === false) {
                    fileData = await fs.promises.readFile(filePath + ".png", {encoding: 'base64'});
                    if (fileData !== null) {
                        foundImage = true;
                        base64Header = "data:image/png;base64,";
                    }
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
                desiredUser.image = base64Header + fileData;
            }
        }

        // Remove properties based on rights
        if (decoded.is_admin === false) {
            desiredUser.verified = undefined;
            desiredUser.photo_path = undefined;
            desiredUser.encoding_path = undefined;
            desiredUser.is_admin = undefined
        }
        if (decoded._id != userID && decoded.is_admin !== true) {
            desiredUser.user_access = undefined;
        }
        desiredUser.password = undefined;
        
        // Return results
        console.log(desiredUser)
        res.status(200).json(desiredUser);
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
        var allLocks;
        console.log(decoded._id)
        if (decoded.is_admin === true) {
            allLocks = await lockRepo.Get(res);
            if (allLocks === undefined) return;
            console.log("Sent all lock data to admin.");
        } else {
            allLocks = [];
            for (const lockID of user[0].user_access) {
                var lock = await lockRepo.Get(res, lockID);
                if (lock === undefined) return;
                allLocks.push(lock[0]);
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
        console.log(req.params.id);
        if (req.params.id == "logs") {
            res.status(400).json("Please provide a lock id.");
            return;
        }

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get LockID
        var lockID = req.params.id;

        // Get desired lock
        var lock = await lockRepo.Get(res, lockID);
        if (lock === undefined) return;

        // If not admin and neither owner nor access, do not send
        if (decoded.is_admin === false && lock[0].owner.toString() != decoded._id && lock[0].lock_access.includes(decoded._id) === false) {
            console.log("User {" + decoded._id + "} tried accessing lock {" + lock[0]._id + "}, but does not have the rights to do so.");
            res.status(403).json("Invalid rights.");
            return;
        }

        // return lock
        res.status(200).json(lock[0]);
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
            ownerID = user[0]._id;
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
        console.log("Returned lock:\n" + lock);
    });

    //
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
        var lock = await lockRepo.Get(res, req.body._id);
        if (lock === undefined) return;

        // Ensure proper rights to update lock
        if (decoded.is_admin === false && lock[0].owner.toString() != decoded._id) {
            console.log("Non admin user tried to update lock. UserID: " + decoded._id);
            res.status(403).json("Invalid rights.");
            return;
        }
        if (decoded.is_admin === false) {
            req.body.serial == null;
            req.body.lock_access == null;
            req.body.owner == null;
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
            if (decoded._id != lock.owner.toString()) {
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

    //
    // Remove Access to Lock
    //
    app.post('/api/v1/lock/remove_access', async (req, res) => {
        // Debug
        console.log("[Functionality:RemoveAccess]");
        console.log(req.body);

        // Token jazz
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Ensure proper rights or owner
        var lock = await lockRepo.Get(res, req.body.lock_id);
        if (lock === undefined) return;
        if (lock[0].owner.toString() != decoded._id.toString() && decoded.is_admin == false) {
            console.log("User with ID {" + decoded._id + "} tried to remove access from lock with ID {" + lock[0]._id + "} but does not have the rights to do so.");
            res.status(403).json("Invalid rights.");
            return;
        }

        // Find user in question
        var userToRemove = await userRepo.Get(res, req.body.user_id);
        if (userToRemove === undefined) return;

        // Check if user has access (user_access and lock_access)
        if (lock[0].lock_access.includes(userToRemove[0]._id) == true) {
            var request = {
                body: {
                    _id: req.body.lock_id,
                    lock_access: lock[0].lock_access.filter(function (e) { return e.toString() !== userToRemove[0]._id.toString() })
                }
            }
            console.log(request.body);
            var newLock = await lockRepo.Update(request, res);
            if (newLock === undefined) return;
        }

        if (userToRemove[0].user_access.includes(lock[0]._id) == true) {
            var request = {
                body: {
                    user_access: userToRemove[0].user_access.filter(function (e) { return e.toString() !== lock[0]._id.toString() })
                }
            } 
            userToRemove = await userRepo.Update(request, res, userToRemove[0]._id);
            if (userToRemove === undefined) return;
        }

        res.status(200).json("Access removed.");
    });

    //
    // Leave Lock
    //
    app.post('/api/v1/lock/leave', async (req, res) => {
        // Debug
        console.log("[Functionality:LeaveLock]");
        console.log(req.body);

        // Token jazz
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get user in question
        var user = await userRepo.Get(res, decoded._id);
        if (user === undefined) return;

        // Get lock in question
        var lock = await lockRepo.Get(res, req.body.lock_id);
        if (lock === undefined) return;

        // Remove from lock access
        if (lock[0].lock_access.includes(decoded._id) == true) {
            var request = {
                body: {
                    _id: req.body.lock_id,
                    lock_access: lock[0].lock_access.filter(function (e) { return e.toString() != decoded._id })
                }
            }
            var newLock = await lockRepo.Update(request, res);
            if (newLock === undefined) return;
        }

        // Remove from user_access
        if (user[0].user_access.includes(lock[0]._id) == true) {
            var request = {
                body: {
                    _id: decoded._id,
                    user_access: user[0].user_access.filter(function (e) { return e.toString() != lock[0]._id })
                }
            }
            var newUser = await userRepo.Update(request, res);
            if (newUser === undefined) return;
        }

        // Return result
        res.status(200).json("Successfully left lock");
    });

    app.get('/api/v1/lock/logs/:id', async (req, res) => {
        // Debug
        console.log("[Lock:GetLogs]");
        console.log(req.params.id);

        // Token jazz
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get lock in question
        const lock = await lockRepo.Get(res, req.params.id);
        if (lock === undefined) return;

        // If not admin and not owner, do not send
        if (decoded.is_admin === false && lock[0].owner.toString() != decoded._id.toString()) {
            console.log("User {" + decoded._id + "} tried getting logs for lock {" + lock[0]._id + "}, but does not have the rights to do so.");
            res.status(403).json("Invalid rights.");
            return;
        }

        // Get logs
        const logs = await logRepo.Get(req.params.id, res);
        if (logs === undefined) return;

        // Return logs
        res.status(200).json(logs);
    })

    //
    // BLOCK ALL ACCESS
    //
    app.post('/api/v1/lock/block', async (req, res) => {
        // Debug
        console.log("[Lock:Block]");

        // Token jazz
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get lock in question
        const lock = await lockRepo.Get(res, req.body.lock_id);
        if (lock === undefined) return;

        // If not admin and not owner, do not block
        if (decoded.is_admin === false && lock[0].owner.toString() != decoded._id.toString()) {
            console.log("User {" + decoded._id + "} tried to block lock {" + lock[0]._id + "}, but does not have the rights to do so.");
            res.status(403).json("Invalid rights.");
            return;
        }

        // Add lock to blocked locks
        blockedLocks.push(lock[0]._id);
        console.log(blockedLocks);
        res.status(204).send();
    })

    //
    // UNLOCK ALL ACCESS
    // 
    app.post('/api/v1/lock/unblock', async (req, res) => {
        // Debug
        console.log("[Lock:Unblock]");

        // Token jazz
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get lock in question
        const lock = await lockRepo.Get(res, req.body.lock_id);
        if (lock === undefined) return;

        // If not admin and not owner, do not block
        if (decoded.is_admin === false && lock[0].owner.toString() != decoded._id.toString()) {
            console.log("User {" + decoded._id + "} tried to unblock lock {" + lock[0]._id + "}, but does not have the rights to do so.");
            res.status(403).json("Invalid rights.");
            return;
        }

        // Remove lock from blocked locks
        blockedLocks = blockedLocks.filter(function (e) { return e.toString() != lock[0]._id.toString() });
        console.log(blockedLocks);
        res.status(204).send();
    })
    
    //////////////
    /// INVITE ///
    //////////////
    //
    // Get all invites (admin)
    //
    app.get('/api/v1/invite', async(req, res) => {
        // Debug
        console.log("[Invite:GetAll]");

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Make sure supplied token is an admin token
        if(decoded.is_admin === false) {
            res.status(403).json("Invalid rights.")
            console.log("User {" + decoded._id + "} tried to access all invites");
            return;
        }

        // Get invites
        var result = await inviteRepo.Get(res);
        if (result === undefined) return;

        // Send invites
        res.status(200).json(result);
    });
    
    //
    // Get from invite _id (admin)
    //
    app.get('/api/v1/invite/:id', async(req, res) => {
        // Debug
        console.log("[Invite:GetByID]");

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get Invite ID
        const id = req.params.id;

        // Get desired invite
        var invite = await inviteRepo.Get(res, id);
        if (invite === undefined) return;

        // If not admin, do not send
        if (decoded.is_admin === false) {
            console.log("User {" + decoded._id + "} tried to access invite {" + invite[0]._id + "}, but does not have the rights to do so.");
            res.status(403).json("Invalid rights.");
            return;
        }

        res.status(200).json(invite);
    });
    
    //
    // Get from user or lock or both
    //
    app.get('/api/v1/invite/:from/:to', async(req, res) => {
        // Debug
        console.log("[Invite:GetByFromTo]");

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get params
        const from = req.params.from;
        const to = req.params.to;

        // Get desired invite(s)
        var result = await inviteRepo.GetByFromTo(res, from, to);
        if (result === undefined) return;

        // Guard clause
        if(result.length === 0) {
            console.log("No invites was found for the given params");
            res.status(403).json("Invalid rights.");
            return;
        }

        // If not admin
        if (decoded.is_admin === false) {
            // if user is not owner of the invite, remove from results
            for(i = 0; i < result.length; i++) {
                if (decoded._id !== result[i].from) {
                    result[i] = undefined;
                }
            }

            // If no results are left, return invalid rights
            if(result.length === 0) {
                console.log("User {" + decoded._id + "} tried to access invite(s) with params from: " + from + " | to: " + to);
                res.status(403).json("Invalid rights.");
                return;
            }
        }
        res.status(200).json(result);
    });

    //
    // Get from lock ID
    //
    app.get('/api/v1/invite/:lockID', async(req, res) => {
        // Debug
        console.log("[Invite:GetByLockID]");

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get params
        const lockID = req.params.lockID;

        // Get desired invite(s)
        var result = await inviteRepo.GetByLockID(res, lockID);
        if (result === undefined) return;

        // Guard clause
        if(result === null) {
            console.log("No invites was found for the given params");
            res.status(403).json("Invalid rights.");
            return;
        }

        // If not admin
        if (decoded.is_admin === false) {
            // if user is not owner of the invite, remove from results
            for(i = 0; i < result.length; i++) {
                if (decoded._id !== result[i].from) {
                    result[i] = undefined;
                }
            }

            // If no results are left, return invalid rights
            if(result.length === 0) {
                console.log("User {" + decoded._id + "} tried to access invite(s) with params from: " + from + " | to: " + to);
                res.status(403).json("Invalid rights.");
                return;
            }
        }
        res.status(200).json(result);
    });

    //
    // Send invite from user to user
    //
    // TODO: Check if invite with matching data has already been created
    //       so as to avoid multiple invites to the same lock.
    //
    app.post('/api/v1/invite/send', async(req, res) => {
        // Debug
        console.log("[Invite:SendInvite]");
        console.log(req.body);

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get sending user
        var user = await userRepo.Get(res, decoded._id);
        if (user === undefined) return;

        // Check if toEmail is supplied
        if(req.body.toEmail === undefined || req.body.lock === undefined) {
            console.log("Invalid arguements supplied.");
            res.status(400).json("Invalid arguements supplied.");
            return;
        }

        // Find user with the email toEmail
        var toUser = await userRepo.GetFromMail(res, req.body.toEmail);
        if (toUser === undefined) return;

        // Find lock
        const lock = await lockRepo.Get(res, req.body.lock);
        if(lock === undefined) return;

        // Construct invite
        var data = { body: { 
            from: user[0]._id,
            to: toUser._id,
            lock: lock[0]._id,
            date: Date.now(),
            accepted: false
        }};
        console.log("Creating invite with data:\n"+JSON.stringify(data));

        // We cheat a bit and just supply an object with the relevant data instead of the req
        const invite = await inviteRepo.Create(data, res);
        if(invite === undefined) return;

        // Return created invite
        res.status(201).json(invite);
    });

    //
    // Respond to invite from one user to another user
    //
    app.put('/api/v1/invite/respond/:id/:response', async(req, res) => {
        // Debug
        console.log("[Invite:Respond]");
        console.log(req.body);

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Get params 
        const inviteID = req.params.id;
        const response = req.params.response.toLowerCase();

        // Find the invite by ID from URL
        var invite = await inviteRepo.Get(res, inviteID);
        if(invite === undefined) return;

        // Check that invite has not already been accepted
        if(invite[0].accepted == true) {
            res.status(400).json("Invite already accepted.");
            console.log("Invite.accpeted is true. Invite already accepted.");
            return;
        }

        // Verify / Make sure the user is the one that received the invite
        if(decoded._id.toString() != invite[0].to.toString()) {
            res.status(403).json("403 Forbidden");
            console.log("User is not the receiver of the invite.");
            return;
        }

        // TODO: We don't check if the 'from' and 'to' users still exist

        // Handle response to invite
        if(response == "accept") {
            // Give 'to' user access to the lock
            // Update user_access on the user to include the lock the user was invited to
            const userToUpdate = await userRepo.Get(res, invite[0].to);
            if(userToUpdate === undefined) return;

            userToUpdate[0].user_access.push(invite[0].lock);
            const userToUpdateData = { body: {
                user_access: userToUpdate[0].user_access
            }};
            if(await userRepo.Update(userToUpdateData, res, invite[0].to) === undefined) return;

            // Update lock_access on the lock to include the user that was invited
            const lockToUpdate = await lockRepo.Get(res, invite[0].lock);
            if(lockToUpdate === undefined) return;

            lockToUpdate[0].lock_access.push(invite[0].to);
            const lockToUpdateData = { body: {
                _id: lockToUpdate[0]._id,
                lock_access: lockToUpdate[0].lock_access
            }};
            if(await lockRepo.Update(lockToUpdateData, res) === undefined) return;

            // Update invite to be accepted
            invite[0].accepted = true;
            invite = await inviteRepo.Update({ body: invite[0] }, res);
            if(invite === undefined) return;

            res.status(200).json(invite);
            console.log("Invite accepted and lock access given.");
            return;
        }  
        else if(response == "deny") {
            // Delete invite
            if(inviteRepo.Delete(req, res, invite[0]._id) === undefined) return;
            res.status(200).json("Invite denied and deleted.");
            console.log("Invite denied and deleted.");
            return;
        } else {
            // Wrong arguments
            res.status(400).json("Wrong parameter supplied. Either 'accept' or 'deny' the invite.");
            console.log("Wrong parameter supplied. Either 'accept' or 'deny'");
            return;
        }
    });

    //
    // Create
    //
    app.post('/api/v1/invite', async(req, res) => {
        // Debug
        console.log("[Invite:Create]");
        console.log(req.body);

        // Get and verify token
        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        // Find user based on token
        var user = await userRepo.Get(res, decoded._id);
        if (user === undefined) return;

        // TODO: Check for admin priviliges.

        // Create lock and add to owner user_access
        const invite = await inviteRepo.Create(req, res);
        if (invite === undefined) return;

        // Return invite
        res.status(201).json(invite);
    });

    //
    // Update
    //
    app.put('/api/v1/invite', async(req, res) => {
        res.status(500).json("Not implemented yet.")
    });

    //
    // Delete
    //
    app.delete('/api/v1/invite', async(req, res) => {
        res.status(500).json("Not implemented yet.")
    });
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

    //
    // Test create log
    //
    // app.post('/api/v1/debug/testCreateLog', async (req, res) => {
    //     const log = await logRepo.Create(req, res);
    //     if (log === undefined) return;
    //     res.status(200).json(log);
    // });
    
    //
    // Test get blockedLocks
    //
    app.get('/api/v1/debug/blockedLocks', async (req, res) => {
        console.log("[Debug:BlockedLocks]");

        const decoded = Token.VerifyToken(req, res);
        if (decoded === undefined) return;

        if (decoded.is_admin == true) {
            res.status(200).json(blockedLocks);
        } else {
            res.status(403).json("Invalid rights.");
        }
    })
}
