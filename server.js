const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { ObjectId, Decimal128 } = require('mongodb');

/* Application variables */
let tokens = []
let tokenSize = 0;

/* Express */
const app = express();
const port = 3000;

app.use(cors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*'
}));

app.use(bodyParser.json());

/* Mongo / Mongoose */
const mongoURL = 'mongodb://51.75.69.121:5000/lockDB';
const mongoOptions = { useNewUrlParser: true, useUnifiedTopology: true };

mongoose.connect(mongoURL, mongoOptions)
  .then(() => console.log('MongoDB connection established successfully'))
  .catch(err => console.error('Failed to connect MongoDB:', err));  

/* Schemas */
const Schema = mongoose.Schema;
const userSchema = new Schema({
    email: String,
    name: String,
    password: String,
    rfid: String,
    face_encoding: [Decimal128],
    verified: Boolean,
    user_access: [ObjectId]
});
const lockSchema = new Schema({
    name: String,
    location: String,
    active: Boolean,
    owner: ObjectId
});

const User = mongoose.model('User', userSchema);
const Lock = mongoose.model('Lock', lockSchema);

//////////////////
/* Routes BEGIN */
//////////////////
//
//  UserCreate
//
app.post('/api/UserCreate', async (req, res) => {
    let user = new User(req.body);

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
    const foundUser = await User.find({email: user.email})
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
    const foundUser = await User.find({email: userData.email})
    if(foundUser.length != 0) {
        res.status(400).json("User already exists.")
        console.log("User already exists: " + userData.email)
        return
    }

    // Create the user from the userData
    const user = new User(userData);

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
    const user = await User.find({email: loginData.email});

    // 1 or more result && first results password equals supplied password
    if(user.length >= 1 && user[0].password == loginData.password) {
        const token = GenerateAccessToken(loginData.email, loginData.password);
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
    const user = await User.find({email: updateData.email});

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
    if(RevokeAccessToken(bodyData.token)) {
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
//  DebugGetTokens
//
app.get('/api/DebugGetTokens', async (req, res) => {
    res.status(200).json(tokens)
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

    if(CheckTokenExists(bodyData.token)) {
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
    const user = await User.find({email: lockData.owner});
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

///////////////
/* Routes END*/
///////////////

// Start the Express server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

/*  Generates a token for access. */
function GenerateAccessToken(email, password) { 
    const token = Buffer.from(email + password).toString('base64')
    
    // Check if it exits already to avoid making duplicates.
    if(CheckTokenExists(token))
        return token;
    
    // Add the new token if it does exist.
    tokens[tokenSize++] = token;
    return token;
}

/*  Deletes a token so it cannot be used for access. 
    Returns true if a token was revoked, false otherwise. */
function RevokeAccessToken(token) {
    for (let i = 0; i < tokens.length; i++) {
        if(token === tokens[i]) {
            // Found token, now delete
            tokens[i] = null;

            // Debug
            console.log("revoked access for token: ")
            console.log(token);

            return true
        }
    }
    return false
}

/*  Returns true if the token has access, false if not */
function CheckTokenExists(token) {
    for (let i = 0; i < tokens.length; i++) {
        if(token === tokens[i]) {
            // Debug
            console.log("Token already exists: ")
            console.log(token);

            return true
        }
    }
    return false
}