const { Schema, model } = require('mongoose');
const { ObjectId } = require('mongodb');

const userSchema = new Schema({
    email: String,
    name: String,
    password: String,
    verified: Boolean,
    photo_path: String,
    encoding_path: String,
    user_access: [ObjectId],
    is_admin: Boolean
});

module.exports = {
    User: model('User', userSchema)
}
