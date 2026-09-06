const mongoose = require('mongoose')

const userFollowingTagSchema = mongoose.Schema(
    {
        tagId:{
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Tag',
        },
        followerUserId:{
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
    },
    {
        timestamps: true
    }
)

// this only allows a single instance of each tagId-followerUserId combo
userFollowingTagSchema.index({ tagId: 1, followerUserId: 1}, { unique: true })

module.exports = mongoose.model('UserFollowingTag',  userFollowingTagSchema)