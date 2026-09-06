const asyncHandler = require('express-async-handler')

const Notification = require('../models/notificationModel')
const mongoose = require("mongoose");
const User = require("../models/userModel");
const Tag = require("../models/tagModel");

// @desc    Get Notifications
// @route   GET /api/getNotifications
// @access  Private
const getNotificationsByUserId = asyncHandler(async (req, res) => {

    const request = {
        query: {
            user: req.user.id
        }
    }

    await getNotificationDataByRequest(request)
        .then((data => {
            if(data){
                let dismissedNotifications = [];
                let unreadNotifications = [];
                (data).map((notification) => {
                    if(notification.dismissed){
                        dismissedNotifications.push(notification)
                    } else {
                        unreadNotifications.push(notification)
                    }
                })
                dismissedNotifications.sort((a,b) => Date.parse(b) - Date.parse(a))
                unreadNotifications.sort((a,b) => Date.parse(b) - Date.parse(a))
                // TODO: new notifications on top, dismissed notifications at the bottom of all new notifications
                const results = unreadNotifications.concat(dismissedNotifications)
                res.status(200).json(results)
            }
        }))
})

// @desc    Get Notifications where the current user is the requester
// @route   GET /api/getNotifications
// @access  Private
const getNotificationsByUserIdWhereUserIsRequester = asyncHandler(async (req, res) => {

    const request = {
        "content.requesterId": req.user.id
    }

    Notification.find(request)
        .then((data => {
            if(data){
                let dismissedNotifications = [];
                let unreadNotifications = [];
                (data).map((notification) => {
                    if(notification.dismissed){
                        dismissedNotifications.push(notification)
                    } else {
                        unreadNotifications.push(notification)
                    }
                })
                dismissedNotifications.sort((a,b) => Date.parse(b) - Date.parse(a))
                unreadNotifications.sort((a,b) => Date.parse(b) - Date.parse(a))
                // TODO: new notifications on top, dismissed notifications at the bottom of all new notifications
                const results = unreadNotifications.concat(dismissedNotifications)
                res.status(200).json(results)
            }
        }))
})

// @desc    Set Notification
// @route   POST /api/
// @access  Private
const createNotification = asyncHandler(async (req, res) => {
    // NB! when posting, a NotificationData-user property will always be an array (of at least 1).
    if(!req.body.user){
        res.status(400)
        throw new Error("Please specify a user to be notified.")
    }
    if(!req.body.variant){
        res.status(400)
        throw new Error("Please specify the type (variant) of notification.")
    }

    // TODO: if it's friendRequest => should check if request already exists? also should check on frontend

    // the notification is added once for each item in user array.
    const notifications = req.body.user.map(userId => {
        return({
            user: userId,
            variant: req.body.variant,
            dismissed: false, // all notifications are not dismissed by default
            content: req.body.content, // Might be empty?
        })
    })

    const notificationResponse = await Notification.insertMany(notifications)
    res.status(200).json(notificationResponse)
})

// @desc    Delete Notification
// @route   DELETE /api/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id)

    if(!notification){
        res.status(400)
        throw new Error("Notification not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the logged-in user matches the word user
    if(notification.user.toString() !== req.user.id){
        res.status(401)
        throw new Error('User not authorized')
    }

    await notification.deleteOne()
    res.status(200).json(notification)
})

// @desc    Update Notification
// @route   PUT /api/:id
// @access  Private
const updateNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id)

    if(!notification){
        res.status(400)
        throw new Error("Notification not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the logged-in user matches the goal user
    if(notification.user.toString() !== req.user.id){
        res.status(401)
        throw new Error('User not authorized')
    }

    const updatedNotification = await Notification.findByIdAndUpdate(req.params.id, req.body, {new: true})
    res.status(200).json(updatedNotification)
})


const getNotificationDataByRequest = async (req) => {
    const getMatchQuery = (queryData) => {
        let matchQuery = []
        if(queryData.user !== undefined){
            matchQuery.push({
                "user": mongoose.Types.ObjectId(queryData.user)
            })
        }
        if(queryData.variant !== undefined){
            matchQuery.push({
                "variant": queryData.variant
            })
        }
        if(queryData.dismissed !== undefined){
            matchQuery.push({
                "dismissed": queryData.dismissed
            })
        }
        return(matchQuery)
    }

    // since 'getNotificationDataByRequest' is not wrapped with asyncHandler, we have to manage/catch errors manually.
    try {
        const allNotificationData = await Notification.aggregate([
            // filtering related to data present in word => apply here
            {
                $match: {
                    $and: getMatchQuery(req.query)
                }
            },
            { '$lookup': {
                'from': User.collection.name,
                'let': {'notificationSenderId': '$content.requesterId' }, // from Notification
                'pipeline': [
                    {'$match': {
                        '$expr': {
                            '$eq': [
                                {"$toObjectId": '$$notificationSenderId'},
                                '$_id'
                            ]
                        }  // _id from User
                    }},
                    { "$project": { "username": 1, "_id": 0}}
                ],
                'as': 'notificationSender'
            }},
            // NB! 'unwind' is here so the result of the join (inside notificationSender) is a single element, and not an array.
            { '$unwind': '$notificationSender' },
            { '$lookup': {
                'from': Tag.collection.name,
                'let': {'tagIdToShare': '$content.tagId', 'notificationVariant': '$variant' }, // from Notification
                'pipeline': [
                    {'$match': {
                        '$expr': {
                            // NB! We need this conditional, so we only look up Tag data when document is a shareTagRequest
                            "$cond": [
                                { "$eq": ['$$notificationVariant', "shareTagRequest"] },
                                {
                                    '$eq': [
                                        {
                                            "$toObjectId": '$$tagIdToShare'
                                        },
                                        '$_id'
                                    ]
                                },
                                // {},
                                { "$eq": ['$_id', -1] } // impossible condition, so no Tag will match
                            ]
                        }  // _id from Tag
                    }},
                    { "$project": { "label": 1, "_id": 0}}
                ],
                'as': 'notificationTag'
            }},
            {
                '$unwind': {
                    path: "$notificationTag",
                    // this way, when a non-shareTagRequest notification reaches here, and does not match any tag,
                    // we keep that document in the Notification response list
                    preserveNullAndEmptyArrays: true
                }
            },
        ])
        return(allNotificationData)
    } catch (error){
        throw new Error("Notification auxiliary function 'getNotificationDataByRequest' failed")
    }
}

module.exports = {
    getNotificationsByUserId,
    getNotificationsByUserIdWhereUserIsRequester,
    createNotification,
    deleteNotification,
    updateNotification
}