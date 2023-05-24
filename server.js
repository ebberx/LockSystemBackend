const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { ObjectId, Decimal128 } = require('mongodb');
const bodyParser = require('body-parser');

/* Express */
const app = express();
const port = 3000;

app.use(cors({
    origin: '*',
    methods: '*',
    allowedHeaders: '*'
}));

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
    face_encoding_path: String,
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
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});