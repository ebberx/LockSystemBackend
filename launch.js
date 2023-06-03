const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const fs = require('fs');
const MongoDB = require('./src/services/mongodb.js');
const WebSocketService = require('./src/services/webSockets.js');

// Setup .env configs, can be called with process.env.<CONFIG>
dotenv.config({'path': 'config/settings.env'});

// Create folders for data storage
if (fs.existsSync("images") === false) {
    fs.mkdir("images", {}, (err) => {
        err === null ?
            console.log("Created /images directory.") :
            console.log("Failed to create /images directory:\n" + err)
    });
}

if (fs.existsSync("encodings") === false) {
    fs.mkdir("encodings", {}, (err) => {
        err === null ?
            console.log("Created /encodings directory.") :
            console.log("Failed to create /encodings directory:\n" + err)
    });
}

// Timestamps for logging
require('log-timestamp');

/* Expess */
const app = express();
const port = 3000;

app.use(cors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*'
}));

// Increase payload limit to 50 mb, to ensure image transfer over HTTP
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));

// Parse and reply with body of responses as being json
app.use(bodyParser.json());

// Connect to MongoDB
MongoDB.Connect(process.env.MONGOURL);

const httpServer = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})

// Supply Web Sockets with server:
const ws = new WebSocketService(httpServer);

// Aquire routes once dependencies are met:
require('./src/routes.js')(app, ws);
