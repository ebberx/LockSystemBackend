const { Schema, model } = require('mongoose');
const { ObjectId } = require('mongodb');

const inviteSchema = new Schema({
    from: ObjectId,
    to: ObjectId,
    date: Date,
    accepted: Boolean
})

module.exports = {
    Invite: model('Invite', inviteSchema)
}
