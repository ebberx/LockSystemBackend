const { Schema, model } = require('mongoose');
const { ObjectId } = require('mongodb');

const logSchema = new Schema({
    lock: ObjectId,
    date: Date,
    message: String
});

module.exports = {
    Log: model('Log', logSchema)
}
