const mongoose = require('mongoose');
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

    await newMessage.populate('senderId', 'fullName email role avatar');
    await newMessage.populate('receiverId', 'fullName email role avatar');

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
      .populate('senderId', 'fullName email role avatar')
      .populate('receiverId', 'fullName email role avatar')
      .sort({ createdAt: 1 })
      .lean();

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
      targetRole = ['faculty', 'admin', 'superadmin'];
    } else if (userRole === 'faculty') {
      targetRole = ['student', 'admin', 'superadmin'];
    } else if (userRole === 'admin' || userRole === 'superadmin') {
      targetRole = ['student', 'faculty', 'admin', 'superadmin', 'accounts', 'receptionist'];
    } else {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const currentUserIdObj = new mongoose.Types.ObjectId(currentUserId);

    // 1. Fetch eligible users fast with lean()
    const users = await User.find({
      _id: { $ne: currentUserIdObj },
      role: { $in: targetRole },
      isActive: true
    })
      .select('fullName email role avatar')
      .lean();

    // 2. Perform a single aggregation to get the latest message for every conversation partner
    const lastMessages = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: currentUserIdObj },
            { receiverId: currentUserIdObj }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', currentUserIdObj] },
              '$receiverId',
              '$senderId'
            ]
          },
          lastMessage: { $first: '$message' },
          lastMessageTime: { $first: '$createdAt' }
        }
      }
    ]);

    const messageMap = new Map();
    for (const item of lastMessages) {
      if (item._id) {
        messageMap.set(item._id.toString(), {
          lastMessage: item.lastMessage,
          lastMessageTime: item.lastMessageTime
        });
      }
    }

    const chatUsersWithLastMessage = users.map((user) => {
      const msgInfo = messageMap.get(user._id.toString());
      return {
        _id: user._id,
        fullName: user.fullName || 'User',
        email: user.email || '',
        role: user.role,
        avatar: user.avatar || null,
        lastMessage: msgInfo ? msgInfo.lastMessage : '',
        lastMessageTime: msgInfo ? msgInfo.lastMessageTime : null
      };
    });

    chatUsersWithLastMessage.sort((a, b) => {
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      }
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;
      return (a.fullName || '').localeCompare(b.fullName || '');
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