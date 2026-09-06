const express = require('express')
const router = express.Router()
const {
    registerUser, loginUser, getMe, getUsersBy, updateUser, getUsernamesBy, getUserById,
    verifyUser, requestPasswordReset, updatePassword, getBasicUserMetrics
} = require('../controllers/userController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.post('/', registerUser)
router.post('/login', loginUser)
router.put('/updateUser', protect, updateUser)
router.get('/me', protect, getMe)
router.get('/searchUser', protect, getUsersBy)
router.get('/getUser/:id', protect, getUserById)
router.get('/:id/verify/:token', verifyUser)
router.post('/requestPasswordReset', requestPasswordReset)
router.put('/updatePassword', updatePassword)
router.get('/getUserMetrics', protect, getBasicUserMetrics)

module.exports = router
