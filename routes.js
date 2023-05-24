
const token = require('./token')

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
        console.log("\n[UserCreate]: ")
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

        // Create user
        await user.save();
        res.status(200).json("OK")
    });

    //
    //  UserCreateFromDevice
    //
    app.post('/api/UserCreateFromDevice', async (req, res) => {
        let userData = req.body;

        // Debug
        console.log("\n[UserCreateFromDevice]: ")
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

    //
    //  UserLogin
    //
    app.post('/api/UserLogin', async (req, res) => {
        let loginData = req.body
        
        // Debug
        console.log("\n[UserLogin]:")
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
            const t = token.GenerateAccessToken(loginData.email, loginData.password);
            res.status(200).json(t);
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
        console.log("\n[UserUpdate]:")
        console.log(updateData)

        // if no email and password is supplied
        if(updateData.email == null && (updateData.new_email == null || updateData.new_password == null))  {
            res.status(400).json("Wrong arugments supplied.")
            console.log("Wrong arugments supplied.")
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

        // Update data
        if(updateData.new_email != null)
            user[0].email = updateData.new_email;
        if(updateData.new_password != null)
            user[0].password = updateData.new_password;
        if(updateData.new_rfid != null)
            user[0].rfid = updateData.new_rfid;
        
        // Create user
        await user[0].save();
        res.status(200).json("OK")
    });

    //
    //  UserLogout
    //
    app.post('/api/UserLogout', async (req, res) => {
        let bodyData = req.body
        
        // Debug
        console.log("\n[UserLogout]:")
        console.log(bodyData)

        // If no token is supplied
        if(bodyData.token == null) {
            res.status(400).json("Wrong arugment supplied.")
            console.log("Wrong arugment supplied.")
            return
        }

        // Do logout and handle result
        if(token.RevokeAccessToken(bodyData.token)) {
            console.log("OK")
            res.status(200).json("OK")
            return
        } else {
            console.log("Token does not exist")
            res.status(400).json("Token does not exist")
            return
        }
    });
    ////////////////
    /// USER END ///
    ////////////////

    //
    //  GetUserInfo
    //  Gets information about the user based on the token.
    //
    app.get('/api/GetUserInfo', async (req, res) => {


    });

    /////////////
    /// DEBUG ///
    /////////////
    //
    //  DebugGetTokens
    //
    app.get('/api/DebugGetTokens', async (req, res) => {
        if(token.tokens)
            res.status(200).json(token.tokens)
        else
            res.status(200).json("No tokens in server.")
    });

    //
    //  UserAccessTest
    //
    app.post('/api/UserAccessTest', async (req, res) => {
        let bodyData = req.body
        
        // Debug
        console.log("\n[UserAccessTest]:")
        console.log(bodyData)
        
        // If no token is supplied
        if(bodyData.token == null) {
            res.status(400).json("Wrong arugment supplied.")
            console.log("Wrong arugment supplied.")
            return
        }

        if(token.CheckTokenExists(bodyData.token)) {
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
        console.log("\n[LockCreate]:")
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
    ////////////////
    /// LOCK END ///
    ////////////////
}