const mongoose = require('mongoose')

const friendshipSchema = mongoose.Schema(
    {
        userIds: [{
            type: mongoose.Schema.Types.ObjectId
        }], // always a 2-item array
        status: {
            type: String, // pending, accepted (blocked?)
        },
        partnerships: { // buddy system, to ask for daily challenges
            type: [{
                mentor: mongoose.Schema.Types.ObjectId, // mentee is implied as the remaining user
                language: String,
            }]
        }
    },
    {
        timestamps: true
    })

module.exports = mongoose.model('Friendship',  friendshipSchema)