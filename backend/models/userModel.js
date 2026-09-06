const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true
    },
    username: {
        type: String,
        required: [true, 'Please add a username'],
        unique: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password']
    },
    languages: [{
        type: String // FE type: Lang
    }],
    uiLanguage: {
        type: String, // FE type: Lang
    },
    nativeLanguage: {
        type: String, // FE type: Lang
    },
    verified: {
        type: Boolean
    }, 
    passwordTokens: [{
        type: String
    }]
},
    {
        timestamps: true
    })


module.exports = mongoose.model('User',  userSchema)