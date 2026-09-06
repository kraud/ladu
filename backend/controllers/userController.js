const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const asyncHandler = require('express-async-handler')
const User = require('../models/userModel')
const Friendship = require('../models/friendshipModel')
const Token = require('../models/tokenModel')
const sendMail = require('../utils/sendEmail')
const crypto = require('crypto')
const mongoose = require("mongoose");
const {calculateBasicUserMetrics} = require('./metricController')

function queryParamToBool(value) {
    return ((value+'').toLowerCase() === 'true')
}

// @desc    Register new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async(req, res) => {
    const { name, email, username, password } = req.body

    if(!name || !email || !username || !password){
        res.status(400)
        throw new Error('Please add all fields')
    }

    // const emailExists = await User.findOne({email: email.toLowerCase()})
    const emailExists = await User.findOne(
        {
            email: {
                "$regex": email,
                "$options": "i"
            }
        }
    )
    // const usernameExists = await User.findOne({username: username.toLowerCase()})
    const usernameExists = await User.findOne(
        {
            username: {
                "$regex": username,
                "$options": "i"
            }
        }
    )

    if(emailExists){
        res.status(400)
        throw new Error('Email already in use')
    }

    if(usernameExists){
        res.status(400)
        throw new Error('Username already in use')
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create user
    let user = await User.create({
        name,
        email,
        username,
        password: hashedPassword,
        verified: false
    })

    const token = await new Token({
        userId: user._id,
        token: crypto.randomBytes(32).toString("hex"),

    }).save()
    const url = `${process.env.BASE_URL}/user/${user._id}/verify/${token.token}`
    await sendMail({email: user.email, subject:"Verify Email", url:url, name:user.name, type:"verifyEmail"}) // TODO: improve confirmation email design

    if(user){
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            languages: [], // user will select them once they log in
            uiLanguage: 'English', // TODO: this should default to browser-language
            nativeLanguage: null, // TODO: this could be added as an item on register form?
            verified: user.verified
        })
    } else {
        res.status(400)
        throw new Error('Invalid user data')
    }
})

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  {/* TODO: should this also allow login in with username? */ }
  const allUsers = await User.find({})
    const user = await User.findOne(
        {
            email: {
                "$regex": email,
                "$options": "i"
            }
        }
    )
    if(user && (await bcrypt.compare(password, user.password))){
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            languages: user.languages,
            uiLanguage: user.uiLanguage,
            nativeLanguage: (user.nativeLanguage === null)
                ? undefined // FE expects undefined, but we can't 'findByIdAndUpdate' values into undefined if they had a value originally
                : user.nativeLanguage,
            token: generateToken(user._id),
            verified: user.verified
        })
    } else {
        res.status(400)
        throw new Error('Invalid credentials')
    }
})

// @desc    Change an existing user's data
// @route   PUT /api/users/updateUser
// @access  Public
const updateUser = asyncHandler(async(req, res) => {
    const {email, name, username, languages, uiLanguage, nativeLanguage} = req.body

    const usernameExists = await User.findOne({username: username})
    // NB! ._id returns the 'new ObjectId("idString") object. Instead, we use .id to access the "idString" value directly.
    if((usernameExists !== null) && (usernameExists.id !== req.user.id)){
        res.status(400)
            // .json('Username already in use')
        throw new Error('Username already in use!')
    }

    const userData = await User.findOne({email: email})
    if(userData.id === req.user.id){
        const updatedUser = await User.findByIdAndUpdate(userData.id,{
            name: name,
            username: username,
            // NB! email can't be changed
            languages: languages,
            uiLanguage: uiLanguage,
            nativeLanguage: (nativeLanguage === undefined)
                ? null // we can't 'findByIdAndUpdate' values into undefined if they had a value originally, so we set 'null'
                : nativeLanguage,
            // if more fields are added to user, add them to the update here
        },{new: true}).select({ password: 0, createdAt: 0 , updatedAt: 0, __v: 0 })
        res.status(200).json(updatedUser)
    } else {
        res.status(400)
        throw new Error('Invalid credentials')
    }
})

// @desc    Get currently logged-in user data
// @route   POST /api/users/me
// @access  Private
const getMe = asyncHandler(async(req, res) => {
    res.status(200).json(req.user)
})

// @desc    Get user data
// @route   POST /api/users/me
// @access  Private
const getUsersBy = asyncHandler(async(req, res) => {

    // NB! For some reason boolean values are converted to string inside req, so we need to convert them back
    // every new boolean field should receive the same treatment
    const requestQuery = {
        ...req.query,
        searchOnlyFriends: queryParamToBool(req.query.searchOnlyFriends)
    }

    const formatAndReturnSimpleResults = (matchingUsersData) => {
        let simpleResults = []
        matchingUsersData.forEach((matchingUser) => {
            if((matchingUser._id).toString() !== req.user.id){ // se we exclude currently logged-in user from results
                simpleResults.push({
                    id: matchingUser._id,
                    type: "user",
                    label: matchingUser.name,
                    username: matchingUser.username,
                    email: matchingUser.email,
                    languages: matchingUser.languages,
                })
            }
        })
        simpleResults.sort((a, b) => a.label.localeCompare(b.label))
        res.status(200).json(simpleResults)
    }

    if (!(req.query)) {
        res.status(400)
        throw new Error("Missing search query text")
    }

    // Check for user
    if (!req.user) {
        res.status(401)
        throw new Error('User not found')
    }

    let userQuery = {
        $or: [
            {
                "name": {$regex: `${requestQuery.nameOrUsernameMatch}`, $options: "i"},
            },
            {
                "username": {$regex: `${requestQuery.nameOrUsernameMatch}`, $options: "i"},
            },
        ]
    }
    if(requestQuery.searchOnlyFriends){
        // When searching through a user's friend list, we first need to find all the active friendships that user has
        Friendship.find({
            userIds: req.user.id,
            status: 'accepted'
        })
        .then(async (matchingFriendships) => {
            // then we need the ids of the other users which participate in those friendships
            const matchingFriendsIds = []
            matchingFriendships.forEach((matchingFriendship) => {
                if(matchingFriendship.userIds[0] === req.user.id){
                    matchingFriendsIds.push(matchingFriendship.userIds[1].toString())
                } else {
                    matchingFriendsIds.push(matchingFriendship.userIds[0].toString())
                }
            })
            // now we search through the users in the collection, only retrieving those that (at least partially) match the query
            // as well as those whose id is included in the list of active friends.
            userQuery = {
                $and: [
                    userQuery,
                    {_id: {'$in': matchingFriendsIds}}
                ]
            }
            User.find(userQuery).then((matchingUserReturnData) => {
                if (matchingUserReturnData) {
                    formatAndReturnSimpleResults(matchingUserReturnData)
                } else {
                    res.status(404).json({
                        text: "No user matches for this search",
                        error: err
                    })
                }
            })
        })
    } else {
        User.find(userQuery).then((matchingUserReturnData) => {
            if (matchingUserReturnData) {
                formatAndReturnSimpleResults(matchingUserReturnData)
            } else {
                res.status(404).json({
                    text: "No user matches for this search",
                    error: err
                })
            }
        })
    }
})

// @desc    Get User
// @route   GET /api/users
// @access  Private
const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)

    if(!user){
        res.status(400)
        throw new Error("User not found")
    }

    // Check for user
    if(!req.user){
        res.status(401)
        throw new Error('Logged in user not found')
    }

    res.status(200).json(user)
})

const verifyUser = asyncHandler(async(req, res) => {
    try {
        const user = await User.findOne({_id: req.params.id}, { password: 0, createdAt: 0, updatedAt: 0, __v: 0 })
        if(!user){
            return res.status(400).send({message: "Invalid Link (no user match)"})
        }

        const token = await Token.findOne({
            userId: user._id,
            token: req.params.token
        })

        if(!token){
            return(res.status(400).send({message: "Invalid Link (no token match)"}))
        }

        // we update the stored user data to reflect the validated state
        await User.findByIdAndUpdate(user.id,{
            verified: true
        },{new: false})

        // we remove the account-validation token from the DB
        await token.remove()

        // we append to response user-data the JSW required to have access to user-protected API routes
        const userWithToken = {
            ...user.toObject(),
            token: generateToken(user._id),
        }
        res.status(200).send({user: userWithToken, message: "Email verified successfully"})
    } catch (error) {
        console.log(error)
        res.status(500).send({message:"Internal Server Error"})
    }

})

// @desc    Request token for password reset
// @route   POST /api/users
// @access  Public
const requestPasswordReset = asyncHandler(async (req, res) => {
    const email = req.body.email

    const user = await User.findOne(
        {
            email: {
                "$regex": email,
                "$options": "i"
            }
        }
    )

    if (!user) {
        res.status(400)
        throw new Error("There is no user registered with the email given.")
    }

    // Generate new password token
    const newPasswordToken = crypto.randomBytes(32).toString("hex")
    user.passwordTokens.push(newPasswordToken)

    // Save token in User
    await User.findByIdAndUpdate(user.id, {
        passwordTokens: user.passwordTokens
    }, {new: true}).select({email: 1});

    try {
        // Send email with token
        const url = `${process.env.BASE_URL}/resetPassword/${user.id}/${newPasswordToken}`;
        await sendMail({email: user.email, subject:"Password reset link", url:url, name: user.name, type:"resetPassword"}) // TODO: improve confirmation email design

        res.status(200).json({})
    } catch (error) {
        console.log(error)
        res.status(500).send({message:"Internal Server Error"})
    }
})

// @desc    Update password
// @route   PUT /api/users
// @access  Public
const updatePassword = asyncHandler(async (req, res) => {
    const {userId, password, token} = req.body

    let userObjectId;
    try {
        userObjectId = mongoose.Types.ObjectId(userId)
    } catch (err) {
        console.log(err)
        res.status(400)
        throw new Error("Invalid format for UserId")
    }

    const user = await User.findById(userObjectId)

    if (!user) {
        res.status(400)
        throw new Error("Invalid Link (no user match).")
    }

    // Check token exists
    if (user.passwordTokens === undefined || !user.passwordTokens.includes(token)) {
        res.status(400)
        throw new Error("Invalid token.")
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Save token in User
    await User.findByIdAndUpdate(user.id,{
        password: hashedPassword,
        passwordTokens: [] //cleans tokens array
    },{new: true})

    res.status(200).json({})
})

// @desc    Get basic metrics for dashboard
// @route   GET /api/users
// @access  Private
const getBasicUserMetrics = asyncHandler(async (req, res) => {
    let user = req.user;
    try {
        let metrics = await calculateBasicUserMetrics(user)

        const metrics_data = {
            totalWords: metrics.totalWords,
            incompleteWordsCount: metrics.incompleteWordsCount,
            translationsPerLanguage: metrics.translationsByLanguage,
            translationsPerLanguageAndPOS: metrics.translationsByLanguageAndPOS,
            wordsPerPOS: metrics.wordsPerPOS,
            wordsPerMonth: metrics.wordsPerMonth
        }

        res.status(200).json(metrics_data)
    } catch (error) {
        console.log(error)
        res.status(500).json({error})
    }
})

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {expiresIn: '30d'})
}

module.exports = {
    registerUser,
    loginUser,
    getMe,
    getUsersBy,
    updateUser,
    getUserById,
    queryParamToBool,
    verifyUser,
    requestPasswordReset,
    updatePassword,
    getBasicUserMetrics
}
