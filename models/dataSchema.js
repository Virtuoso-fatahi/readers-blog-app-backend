const mongoose = require('mongoose');

const ReactFormDataSchema = new mongoose.Schema({
    username: {type: String, required: true},
    password: {type:String}
});

const User = mongoose.model('User', ReactFormDataSchema);
module.exports = User;