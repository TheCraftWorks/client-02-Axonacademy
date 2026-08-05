const Message = require('../models/Message');
const User = require('../models/User');

// Send a message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message are required'
      });
    }

    if (receiverId.toString() === senderId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a message to yourself'
      });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      message
    });

    await newMessage.populate('senderId', 'fullName email role');
    await newMessage.populate('receiverId', 'fullName email role');

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Get conversation between two users
const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId }
      ]
    })
      .populate('senderId', 'fullName email role')
      .populate('receiverId', 'fullName email role')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      error: error.message
    });
  }
};

// Get list of users the current user has chatted with
const getChatUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const userRole = req.user.role;

    let targetRole;
    if (userRole === 'student') {
      targetRole = ['faculty', 'admin'];
    } else if (userRole === 'faculty') {
      targetRole = ['student', 'admin'];
    } else if (userRole === 'admin') {
      targetRole = ['student', 'faculty'];
    } else {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const users = await User.find({
      _id: { $ne: currentUserId },
      role: { $in: targetRole },
      isActive: true
    }).select('fullName email role avatar');

    const chatUsersWithLastMessage = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: currentUserId, receiverId: user._id },
            { senderId: user._id, receiverId: currentUserId }
          ]
        })
          .sort({ createdAt: -1 })
          .populate('senderId', 'fullName')
          .populate('receiverId', 'fullName');

        return {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          lastMessage: lastMessage ? lastMessage.message : '',
          lastMessageTime: lastMessage ? lastMessage.createdAt : null
        };
      })
    );

    chatUsersWithLastMessage.sort((a, b) => {
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return b.lastMessageTime - a.lastMessageTime;
    });

    res.status(200).json({
      success: true,
      count: chatUsersWithLastMessage.length,
      data: chatUsersWithLastMessage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat users',
      error: error.message
    });
  }
};

module.exports = {
  sendMessage,
  getConversation,
  getChatUsers
};