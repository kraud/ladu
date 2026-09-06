const asyncHandler = require('express-async-handler')

const Friendship = require('../models/friendshipModel')
const User = require("../models/userModel");
const Notification = require("../models/notificationModel");
const mongoose = require("mongoose");

// TODO: add parameters to req.query to allow specifying if the friendship is accepter/rejected/etc.
// @desc    Get all Friendships where the provided userId corresponds with one of the friendship participants' id
// @route   GET /api/getFriendships
// @access  Private
const getUserFriendshipsByParticipantId = asyncHandler(async (req, res) => {
    if (!(req.query)) {
        res.status(400)
        throw new Error("Missing search query text")
    }

    // Check for logged-in user ID - info added on authMiddleware
    if (!req.user) {
        res.status(401)
        throw new Error('Logged-in user not found')
    }
    // NB! user that made the get request does not necessarily need to be a participant of the friendship
    // all documents where userIds is an array that contains the string in "req.query.userId" as one of its elements:
    Friendship.find({
        userIds: req.query.userId
    })
    .then(async (matchingFriendships) => {
        Promise.all(matchingFriendships.map(async (friendship) => {
            const friendshipParticipants = await Promise.all(friendship.userIds.map(async (participantId) => {
                const participantData = await User.findById(participantId, { _id: 1, name: 1 , username: 1 })
                return(participantData)
            }))
            return({
                ...friendship.toObject(),
                usersData: friendshipParticipants
            })
        })).then(async (completeFriendshipData) => {
            res.status(200).json(completeFriendshipData)
        })
    })

})

// TODO: friends-in-common endpoint

// @desc    Set Friendship
// @route   POST /api/
// @access  Private
const createFriendship = asyncHandler(async (req, res) => {
    if(!(req.body.userIds)){
        res.status(400)
        throw new Error("Please specify users to be part of the friendship.")
    } else {
        if(!(req.body.userIds.length === 2)){
            res.status(400)
            throw new Error("Only 2 users can be part of a friendship")
        }
        if(req.body.userIds[0] === req.body.userIds[1]){
            res.status(400)
            throw new Error("The participants of a friendship must be 2 different users")
        }
    }
    if(!(req.body.userIds.includes(req.user.id))){
        res.status(401)
        throw new Error('Not allowed to create: user is not part of the friendship')
    }

    if(!req.body.status){
        res.status(400)
        throw new Error("Please specify the status of the friendship.")
    }

    const friendship = await Friendship.create({
        userIds: req.body.userIds,
        status: req.body.status,
        partnerships: req.body.partnerships,
    })

    res.status(200).json(friendship)
})

// @desc    Delete Friendship
// @route   DELETE /api/:id
// @access  Private
const deleteFriendship = asyncHandler(async (req, res) => {
    const friendship = await Friendship.findById(req.params.id)

    if(!friendship){
        res.status(400)
        throw new Error("Notification not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the user trying to delete the friendship is part of the friendship
    if(!friendship.userIds.includes(req.user.id)){
        res.status(401)
        throw new Error('Not allowed to delete: user is not part of the friendship')
    }

    await friendship.deleteOne()
    res.status(200).json(friendship)
})

// @desc    Delete Friendship request and related notifications
// @route   DELETE /api/:id
// @access  Private
const deleteFriendshipRequest = asyncHandler(async (req, res) => {
    const friendship = await Friendship.findById(req.params.id)
    let otherUserId = ""
    if(friendship.userIds[0].toString() !== req.user.id){
        otherUserId = friendship.userIds[0]
    } else {
        otherUserId = friendship.userIds[1]
    }

    if(!friendship){
        res.status(400)
        throw new Error("Notification not found")
    }
    if(friendship.status === 'accepted'){
        res.status(400)
        throw new Error("Can't delete friendship request. Friendship already accepted.")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the user trying to delete the friendship is part of the friendship
    if(!friendship.userIds.includes(req.user.id)){
        res.status(401)
        throw new Error('Not allowed to delete: user is not part of the friendship')
    }

    await friendship.deleteOne().then(async (deleteFriendshipResponse) => {
        // this should only match one notification at most, since a user can't send more than one friend request to another user
        const notificationRequest = {
            "user": mongoose.Types.ObjectId(otherUserId),
            "variant": "friendRequest",
            "content.requesterId": req.user.id
        }
        Notification.findOneAndDelete(notificationRequest).then((deleteNotificationResponse) => {
            res.status(200).json({
                deletedFriendshipRequest: deleteFriendshipResponse,
                deletedNotification: deleteNotificationResponse,
            })
        })
    })
})

// @desc    Accept Friendship request and delete related notification
// @route   PUT /api/deleteRequestAndNotifications/:id
// @access  Private
const acceptFriendshipRequest = asyncHandler(async (req, res) => {
    const friendship = await Friendship.findById(req.params.id)
    let otherUserId = ""
    if(friendship.userIds[0].toString() !== req.user.id){
        otherUserId = friendship.userIds[0]
    } else {
        otherUserId = friendship.userIds[1]
    }

    if(!friendship){
        res.status(400)
        throw new Error("Notification not found")
    }
    if(friendship.status === 'accepted'){
        res.status(400)
        throw new Error("Can't accept friendship request. Friendship already accepted.")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    // Make sure the user trying to delete the friendship is part of the friendship
    if(!friendship.userIds.includes(req.user.id)){
        res.status(401)
        throw new Error('Not allowed to delete: user is not part of the friendship')
    }

    Friendship.findByIdAndUpdate(req.params.id, req.body)
        .then(async (acceptedFriendshipResponse) => {
        // this should only match one notification at most, since a user can't send more than one friend request to another user
        const notificationRequest = {
            "user": mongoose.Types.ObjectId(req.user.id),
            "variant": "friendRequest",
            "content.requesterId": otherUserId.toString()
        }
        Notification.findOneAndDelete(notificationRequest).then((deleteNotificationResponse) => {
            res.status(200).json({
                deletedFriendshipRequest: acceptedFriendshipResponse,
                deletedNotification: deleteNotificationResponse,
            })
        })
    })
})

// @desc    Update Friendship
// @route   PUT /api/:id
// @access  Private
const updateFriendship = asyncHandler(async (req, res) => {
    const friendship = await Friendship.findById(req.params.id)

    if(!friendship){
        res.status(400)
        throw new Error("Friendship not found")
    }

    // Check for logged-in user ID - info added on authMiddleware
    if(!req.user){
        res.status(401)
        throw new Error('User not found')
    }

    if(!friendship.userIds.includes(req.user.id)){
        res.status(401)
        throw new Error('Not allowed to update: user is not part of the friendship')
    }

    const updatedFriendship = await Friendship.findByIdAndUpdate(req.params.id, req.body, {new: true})
    res.status(200).json(updatedFriendship)
})

module.exports = {
    getUserFriendshipsByParticipantId,
    createFriendship,
    deleteFriendship,
    updateFriendship,
    deleteFriendshipRequest,
    acceptFriendshipRequest
}