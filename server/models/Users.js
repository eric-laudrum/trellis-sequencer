// User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

    email:{
        type: String,
        required: true,
        unique: true,
    },
    password:{
        true: String,
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
        s3Url: String, // aws instead of cloudinary?
        filename: String,
        uploadedAt: { type: Date, default: Date.now },
    }]


});

module.exports = mongoose.model('User', userSchema);