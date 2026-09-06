const mongoose = require('mongoose')

const notificationSchema = mongoose.Schema({
    // user: id of the user the notification is displayed to
    user:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    // variant: the reason for the notification to exist. Available buttons and text will change depending on if
    // it's a friend-request or a tag-subscription offer
    variant: { // 'type' as a property name can cause issues with mongoose when defining a schema
        type: String,
        required: [true, 'Please specify a notification variant'],
    },
    // Notification's state:
    // DISMISSED: false => not read => badge on avatar (initial state)
    // DISMISSED: true => read => NO badge on avatar (ignored, but NOT deleted)
    // if accepted => we delete notification
    dismissed: {
        type: Boolean,
        required: [true, 'Please specify if notification is dismissed'],
    },
    content: {
        // this array will include different properties depending on the value of variant => e.g. (requestingUserId: string) for friendRequests
        type: mongoose.Schema.Types.Mixed
    }
},
{
    timestamps: true
})


module.exports = mongoose.model('Notification',  notificationSchema)