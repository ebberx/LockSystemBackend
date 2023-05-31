
const Token = require('./token');
const Verify = require('./verification')
const { execSync } = require("child_process");

module.exports = function(app, Models) {
    ////////////
    /// USER ///
    ////////////
    //
    //  UserCreate
    //
    app.post('/api/UserCreate', async (req, res) => {
        let user = new Models.User(req.body);

        // Debug
        console.log("[UserCreate]: ")
        console.log(user)

        // If email and password is not supplied
        if(user.email == null || user.password == null) {
            res.status(400).json("Wrong arugments supplied.")
            console.log("Wrong arugments supplied.")
            return
        }

        // Convert to lowercase
        user.email = user.email.toLowerCase();

        // Check if account with email already exists
        const foundUser = await Models.User.find({email: user.email})
        if(foundUser.length != 0) {
            res.status(400).json("User already exists.")
            console.log("User already exists: " + user.email)
            return
        }

        // Set verified to false by default.
        user.verified = false;
        
        // Set is_admin to false by default.
        user.is_admin = false;

        // Create user
        await user.save();
        res.status(200).json("OK")
    });

    //
    //  UserCreateFromDevice
    //
    /*
    app.post('/api/UserCreateFromDevice', async (req, res) => {
        let userData = req.body;

        // Debug
        console.log("[UserCreateFromDevice]: ")
        console.log(userData)

        // If email and password is not supplied
        if(userData.email == null || userData.password == null || userData.rfid == null) {
            res.status(400).json("Wrong arugments supplied.")
            console.log("Wrong arugments supplied.")
            return
        }    

        // Convert to lowercase
        userData.email = userData.email.toLowerCase();

        // Check if account with email already exists
        const foundUser = await Models.User.find({email: userData.email})
        if(foundUser.length != 0) {
            res.status(400).json("User already exists.")
            console.log("User already exists: " + userData.email)
            return
        }

        // Create the user from the userData
        const user = new Models.User(userData);

        // Set verified to false by default.
        user.verified = false;

        // Create user
        await user.save();
        res.status(200).json("OK")
    });
    */

    //
    //  UserLogin
    //
    app.post('/api/UserLogin', async (req, res) => {
        let loginData = req.body
        
        // Debug
        console.log("[UserLogin]:")
        console.log(loginData)

        // if no email and password is supplied
        if(loginData.email == null || loginData.password == null) {
            res.status(400).json("Wrong arugments supplied.")
            console.log("Wrong arugments supplied.")
            return
        }

        // Convert to lowercase
        loginData.email = loginData.email.toLowerCase();

        // Query for the email in mongodb
        const user = await Models.User.find({email: loginData.email});

        // 1 or more result && first results password equals supplied password
        if(user.length >= 1 && user[0].password == loginData.password) {
            const token = Token.GenerateAccessToken(loginData.email, loginData.password, user[0]._id);
            res.status(200).json(token);
            console.log("Login success.")
            return
        }

        console.log("Invalid credentials.")
        res.status(400).json("Invalid credentials.");
    });

    //
    //  UserUpdate
    //
    app.post('/api/UserUpdate', async (req, res) => {
        let updateData = req.body

        // Debug
        console.log("[UserUpdate]:")
        console.log("email: " + updateData.email)
        console.log("new_name: " + updateData.name)
        console.log("new email: " + updateData.new_email)
        console.log("new password:" + updateData.new_password)
        console.log("new_image_data: " + typeof(updateData.new_image_data))

        // if no email and password is supplied
        if(updateData.email == null || !(updateData.new_email != null || updateData.new_password != null || updateData.new_image_data != null || updateData.new_name != null))  {
            res.status(400).json("Wrong arguments supplied.")
            console.log("Wrong arguments supplied.")
            return
        }

        // Convert to lowercase
        updateData.email = updateData.email.toLowerCase();

        // Query for the email in mongodb
        const user = await Models.User.find({email: updateData.email});

        if(user.length == 0) {
            res.status(400).json("Couldn't find user in database.")
            console.log("Couldn't find user in database.")
            return
        }

        if(updateData.new_image_data != null) {
            var fs = require('fs').promises;

            // Check if data has the header
            var data = (updateData.new_image_data + "").includes('data:image') ? updateData.new_image_data : null;
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
    
            console.log(user[0]._id)
    
            var buf = Buffer.from(data, 'base64');
            // Image file path: Where the image should be saved
            var imageFilePath =  "images/" + user[0]._id + fileType;
            
            await fs.writeFile(imageFilePath, buf).then(() => {
                console.log(imageFilePath + " saved to file!"); 
                // Add to photo_path to user entry (db)
                user[0].photo_path = imageFilePath; 

                // Encoding file path: Where the python script should save the encoding
                const encodingFilePath = "encodings/" + user[0]._id + ".enc";

                const success = Verify.GenerateEncoding(imageFilePath, encodingFilePath);
                // Add encoding file path to user entry (db) in case the encoding was successfully generated
                if(success === true)
                    user[0].encoding_path = encodingFilePath;

                console.log(success)
                console.log("set encoding path to: " + encodingFilePath)
            });
        }
        
        // Update data
        if(updateData.new_email != null)
            user[0].email = updateData.new_email;
        if(updateData.new_password != null)
            user[0].password = updateData.new_password;
        if(updateData.new_name != null)
            user[0].name = updateData.new_name;
        
        //if(updateData.new_rfid != null)
        //    user[0].rfid = updateData.new_rfid;

        // Update user
        await user[0].save();
        res.status(200).json("OK")
    });

    //
    //  UserLogout
    //
    app.post('/api/UserLogout', async (req, res) => {
        let bodyData = req.body
        
        // Debug
        console.log("[UserLogout]:")
        console.log(bodyData)

        // If no token is supplied
        if(bodyData.token == null) {
            res.status(400).json("Wrong arugment supplied.")
            console.log("Wrong arugment supplied.")
            return
        }

        // Do logout and handle result
        if(Token.RevokeAccessToken(bodyData.token)) {
            console.log("OK")
            res.status(200).json("OK")
            return
        } else {
            console.log("Token does not exist")
            res.status(400).json("Token does not exist")
            return
        }
    });

    //
    //  GetUserInfo
    //  Gets information about the user based on the token.
    //
    app.post('/api/UserGetInfo', async (req, res) => {
        let bodyData = req.body;

        // Debug
        console.log("[UserGetInfo]:")
        console.log(bodyData)

        if(bodyData.token == null) {
            res.status(400).json("Token not supplied.")
            console.log("Token not supplied.")
            return
        }

        const userID = Token.GetUserID(bodyData.token);
        
        // Find User in Database
        const user = await Models.User.find({_id: userID});
        
        if(user === null) {
            console.log("Failed to find user for token: \n" + bodyData.token);
            res.status(400).json("Failed to find user for token: \n" + bodyData.token)
            return
        }
        // Debug
        console.log("Found user for token. \nToken:\n" + bodyData.token + "\nUser:\n" + user);

        // Read image file from filesystem
        var fs = require('fs');
        const filePath = "images/" + userID;
        
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

        // Make JSON reply
        let replyData = {}

        // Set data - Only email for now
        replyData.email =  user[0].email;

        // Make sure we found a file type
        if(fileType !== "") {
            // Get file data
            const fileData = await fs.promises.readFile(filePath + fileType, {encoding: 'base64'})
            // Add file data to reply
            if(fileData !== null)
                replyData.image = base64Header+fileData;
        }
        console.log("Sent user info.")
        res.status(200).json(replyData)
    });

    //
    // UserGetAll
    // (For admins only)
    //
    app.post('/api/UserGetAll', async (req, res) => {
        // Start copy of normal get
        let bodyData = req.body;

        // Debug
        console.log("[UserGetAll]:")
        console.log(bodyData)

        if(bodyData.token == null) {
            res.status(400).json("Token not supplied.")
            console.log("Token not supplied.")
            return
        }

        const userID = Token.GetUserID(bodyData.token);
        
        // Find User in Database
        const user = await Models.User.find({_id: userID});
        
        if(user === null) {
            console.log("Failed to find user for token: \n" + bodyData.token);
            res.status(400).json("Failed to find user for token: \n" + bodyData.token)
            return
        }
        // Debug
        console.log("Found user for token. \nToken:\n" + bodyData.token + "\nUser:\n" + user);
        // End copy of normal get
        if (user.is_admin === false) {
            console.log("Non-admin user: " + user.email + ", tried to access all user data.");
            res.status(403).json("This service requires administrative rights.");
            return
        }

        const allUsers = await Models.User.find();
        allUsers.forEach((item) => {
            delete item.password;
            delete item.verified;
            delete item.photo_path;
            delete item.encoding_path;
            delete item.user_access;
            delete item.is_admin;
        });

        console.log("Sent all user data to admin.");
        res.status(200).json(allUsers);
    });

    //
    //  UserLogout
    //
    app.post('/api/UserVerify', async (req, res) => {
        let bodyData = req.body

        console.log("[UserVerify]:")
        //console.log(bodyData)

        // Check that the data needed is there
        if(bodyData.email === null && bodyData.image_data === null) {
            res.status(400).json("Wrong arguments supplied.")
            console.log("Wrong arguments supplied.")
            return
        }
        bodyData.email = bodyData.email.toLowerCase();
        const user = await Models.User.find({email: bodyData.email});

        if(user.length == 0) {
            res.status(400).json("Couldn't find user in database.")
            console.log("Couldn't find user in database.")
            return
        }

        var fs = require('fs').promises;

        // Check if iamge data has the header
        var data = (bodyData.image_data + "").includes('data:image') ? bodyData.image_data : null;
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

        // Make temp directory for image and encoding
        execSync("mkdir " + user[0]._id);

        var buf = Buffer.from(data, 'base64');

        // Image file path: Where the image should be saved
        var imageFilePath =  user[0]._id + "/image" + fileType;

        await fs.writeFile(imageFilePath, buf).then(() => { 
            console.log(imageFilePath + " saved to file!");  

            // Encoding file path: Where the python script should save the encoding
            const tempEncodingPath = user[0]._id + "/encoding" + ".enc";
            
            // Generate encodings and compare
            Verify.GenerateEncoding(imageFilePath, tempEncodingPath);
            const output = Verify.CompareEncodings(user[0].encoding_path, tempEncodingPath);

            if(output !== false) {
                console.log(Number(output.toString()));
                
                // Delete temnp folder after operation
                execSync("rm -rf " + user[0]._id);
            }

        });
        
        res.status(200).json("OK");
    });

    ////////////////
    /// USER END ///
    ////////////////
    
    /////////////
    /// DEBUG ///
    /////////////
    //
    //  DebugGetTokens
    //
    app.get('/api/DebugGetTokens', async (req, res) => {
        if(Token.tokens)
            res.status(200).json(Token.tokens)
        else
            res.status(200).json("No tokens in server.")
    });

    //
    //  UserAccessTest
    //
    app.post('/api/UserAccessTest', async (req, res) => {
        let bodyData = req.body
        
        // Debug
        console.log("[UserAccessTest]:")
        console.log(bodyData)
        
        // If no token is supplied
        if(bodyData.token == null) {
            res.status(400).json("Wrong arugment supplied.")
            console.log("Wrong arugment supplied.")
            return
        }

        if(Token.CheckTokenExists(bodyData.token)) {
            res.status(200).json("OK - User has access.")
            console.log("OK - User has access.")
            return
        } else {
            res.status(400).json("Token does not have access.")
            console.log("Token does not have access.")
            return
        }
    });

    //
    //  CheckIfOnline
    //
    app.get('/api/CheckIfOnline', async (req, res) => {
        res.status(200).json("OK - Online.")
    });
    /////////////////
    /// DEBUG END ///
    /////////////////

    ////////////
    /// LOCK ///
    ////////////
    //
    //  LockCreate
    //
    app.post('/api/LockCreate', async (req, res) => {
        const lockData = req.body

        // Debug
        console.log("[LockCreate]:")
        console.log(lockData)

        // Check if arguments needed are supplied
        if(lockData.name == null || lockData.location == null || lockData.active == null || lockData.owner == null) {
            res.status(400).json("Wrong arguements supplied.")
            console.log("Wrong arguements supplied.")
            return
        }

        // Find owner ObjectID by email
        const user = await Models.User.find({email: lockData.owner});
        // Check if the user was found in the database
        if(user.length == 0) {
            res.status(400).json("Supplied owner does not exist.")
            console.log("Supplied owner does not exist.")
            return
        }
        // Replace .owner email, with ObjectID
        lockData.owner = user[0]._id;

        // Create a Lock Schema
        const lock = new Lock(lockData);

        lock.save();
        res.status(200).json("OK")
    });

    //
    // LockGetAll 
    // (For admin only)
    //
    app.post('/api/LockGetAll', async (req, res) => {
         // Start copy of normal get
         let bodyData = req.body;

         // Debug
         console.log("[UserGetInfo]:")
         console.log(bodyData)
 
         if(bodyData.token == null) {
             res.status(400).json("Token not supplied.")
             console.log("Token not supplied.")
             return
         }
 
         const userID = Token.GetUserID(bodyData.token);
         
         // Find User in Database
         const user = await Models.User.find({_id: userID});
         
         if(user === null) {
             console.log("Failed to find user for token: \n" + bodyData.token);
             res.status(400).json("Failed to find user for token: \n" + bodyData.token)
             return
         }
         // Debug
         console.log("Found user for token. \nToken:\n" + bodyData.token + "\nUser:\n" + user);
         // End copy of normal get
         if (!user.is_admin) {
             console.log("Non-admin user: " + user.email + ", tried to access all lock data.");
             res.status(403).json("This service requires administrative rights.");
             return
         }

         const allLocks = await Models.Lock.find();
 
         console.log("Sent all lock data to admin.");
         res.status(200).json(allLocks);
    });

    ////////////////
    /// LOCK END ///
    ////////////////
}