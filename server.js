const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// Application variables
let tokens = []
let tokenSize = 0;

// Express
const app = express();
const port = 3000;

app.use(cors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*'
}));

app.use(bodyParser.json());

// Mongo / Mongoose
const mongoURL = 'mongodb://51.75.69.121:5000/lockDB';
const mongoOptions = { useNewUrlParser: true, useUnifiedTopology: true };

mongoose.connect(mongoURL, mongoOptions)
  .then(() => console.log('MongoDB connection established successfully'))
  .catch(err => console.error('Failed to connect MongoDB:', err));  

// Schemas
const Schema = mongoose.Schema;
const userSchema = new Schema({
    email: String,
    password: String,
    verified: Boolean,
});

const User = mongoose.model('User', userSchema);

// Routes
app.post('/api/UserCreate', async (req, res) => {
    let user = new User(req.body);
    
    if(user.email == null || user.password == null) {
        res.status(418).json("Wrong arugments supplied.")
        return
    }    
    // Debug
    console.log("added user to db: ")
    console.log(user)

    // Set verified to false by default.
    user.verified = false;

    await user.save();
    res.status(200).json("OK");
});

app.post('/api/UserLogin', async (req, res) => {
    let loginData = req.body
    if(loginData.email == null || loginData.password == null) {
        res.status(418).json("Wrong arugments supplied.")
        return
    }
    // Debug
    console.log("UserLogin:")
    console.log(loginData)

    await User.find({email: loginData.email})
        .then((user) => {
            const token = GenerateAccessToken(loginData.email, loginData.password);
            res.json(token);
        });
       
});

app.post('/api/UserLogout', async (req, res) => {
    let loginData = req.body
    if(loginData.token == null) {
        res.status(418).json("Wrong arugment supplied.")
        return
    }
    // Debug
    console.log("UserLogout:")
    console.log(loginData)

    if(RevokeAccessToken(loginData.token))
        res.status(200).json("OK")
    else
        res.status(418).json("Token does not exist")
});

app.post('/api/UserAccessTest', async (req, res) => {
    let loginData = req.body
    if(loginData.token == null) {
        res.status(418).json("Wrong arugment supplied.")
        return
    }
    // Debug
    console.log("UserAccessTest:")
    console.log(loginData)

    if(CheckTokenExists(loginData.token))
        res.status(200).json("OK - User has access.")
    else
        res.status(418).json("Token does not have access.")
});

app.get('/api/CheckIfOnline', async (req, res) => {
    res.status(200).json("OK - Online.")
});

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
            console.log("Token used for access: ")
            console.log(token);

            return true
        }
    }
    return false
}