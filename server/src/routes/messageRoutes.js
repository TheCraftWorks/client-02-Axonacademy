const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getChatUsers
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Send a message
router.post('/send', sendMessage);

// Get conversation with a specific user
router.get('/conversation/:userId', getConversation);

// Get list of users available for chat (opposite role)
router.get('/users', getChatUsers);

module.exports = router;