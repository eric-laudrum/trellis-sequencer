// User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

    email:{
        type: String,
        required: true,
        unique: true,
    },
    password:{
        type: String,
        required: true,
    },
    tier:{
        type: String,
        default: 'free', // leave room for future paid features
    },
    uploadLimit:{
        type: Number,
        default: 10,
    },
    uploadedSounds: [{
        fileUrl: String,
        filename: String,
        uploadedAt: { type: Date, default: Date.now },
    }]

});

module.exports = mongoose.model('User', userSchema);