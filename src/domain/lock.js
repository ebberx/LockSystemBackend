const { Schema, model } = require('mongoose');
const { ObjectId } = require('mongodb');

const lockSchema = new Schema({
    serial: String,
    name: String,
    location: String,
    active: Boolean,
    owner: ObjectId
})

module.exports = {
    Lock: model('Lock', lockSchema)
}
