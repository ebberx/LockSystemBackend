const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { ObjectId, Decimal128 } = require('mongodb');
const bodyParser = require('body-parser');

const http = require("http")
const ws = require('ws');

// Timestamps for logging
require('log-timestamp');

// Create folders for data storage
var fs = require('fs');
fs.mkdir("images", {}, (err) => { err === null ? console.log("Created /images directory.") : console.log("Failed to create images/ directory:\n" + err) });

/* Express */
const app = express();
const port = 3000;

app.use(cors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*'
}));

// Increase payload limit to 50 mb so that we can send big images over HTTP
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

// Parse and reply with body of responses as being json
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
    verified: Boolean,
    photo_path: String,
    encoding_path: String,
    user_access: [ObjectId]
});
const lockSchema = new Schema({
    name: String,
    location: String,
    active: Boolean,
    owner: ObjectId
});

let Models = {}

Models.User = mongoose.model('User', userSchema);
Models.Lock = mongoose.model('Lock', lockSchema);

// Require routes when we have all dependencies ready
require("./routes")(app, Models);

// Start the Express server
const httpServer = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

////////////////////////
/// Web Sockets be here
//////////////////////
const wss = new ws.Server({ server: httpServer });
const sockets = new Map();

wss.on('connection', (ws, req) => {
    const id = get_ws_id(req);
    sockets.set(id, ws);
    console.log("Pi: " + id + " connected.");
    //console.log("connected.");

    ws.on('close', () => {
        sockets.delete(id);
        console.log("Pi: " + id + " disconnected.");
        console.log("disconnected.");
    })
})

function get_ws_id(req) {
    let id = "test";
    if (req.headers["lockid"] != undefined) {
        id = req.headers["lockid"].toString();
    }
    return id
}

function unlock(lockid, message) {
    if (sockets.get(lockid) && sockets.get(lockid).readyState == 1) {
        sockets.get(lockid).send(message);
        return true;
    }
    else
        return false;
}

// Unlock notification
app.post('/api/log_event', (req, res) => {
    const body = req.body;
    console.log("Unlock notification from Raspberry")
    res.status(200).json("Yeet thou thy visitors at the door, and close it shut once more.");
});

// Remote unlock
app.put('/api/unlock', (req, res) => {
    const wsrequest = '{"action": "unlock", "args": {"caller": "test api"}}';
    const id = "123je1mn4567ma82";
    const result = unlock(id, wsrequest);
    if (result)
        return res.status(200).json("Unlocked.")
    else
        return res.status(400).json("Lock offline.")
})
