const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

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

// Schemas
const Schema = mongoose.Schema;
const userSchema = new Schema({
    email: String,
    password: String,
    verified: Boolean,
});

mongoose.connect(mongoURL, mongoOptions)
  .then(() => console.log('MongoDB connection established successfully'))
  .catch(err => console.error('Failed to connect MongoDB:', err));  

const User = mongoose.model('User', userSchema);


app.post('/api/UserCreate', async (req, res) => {
    let user = new User(req.body);
    if(user.email == null || user.password == null || user.verified == null) {
        res.status(418).json("Wrong arugments supplied.")
        return
    }
    console.log("added user to db: ")
    console.log(user)
    await user.save();
    res.status(200).json("OK");
});

app.get('/api/User', async (req, res) => {
    await User.find()
        .then((user) => {
            res.json(user);
        });
       
});

app.get('/api/asd', (req, res) => {
    console.log("asd")
    res.json("asd")
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
