const express = require('express')
const router = express.Router()
const { createNotification, updateNotification, deleteNotification, getNotificationsByUserId,
    getNotificationsByUserIdWhereUserIsRequester
} = require('../controllers/notificationController.ts')
const {protect} = require('../middleware/authMiddleware.ts')

router.get('/getNotifications', protect, getNotificationsByUserId)
router.get('/getRequesterNotifications', protect, getNotificationsByUserIdWhereUserIsRequester)
router.post('/', protect, createNotification)
router.delete('/:id', protect, deleteNotification)
router.put('/:id', protect, updateNotification)


module.exports = router