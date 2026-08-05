const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET / → Get own notifications (paginated, latest first)
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments({ recipient: req.user._id });

    res.json({
      success: true,
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
});

// GET /unread-count → Get unread notification count
router.get('/unread-count', async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
});

// PUT /read-all → Mark all as read
router.put('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/read → Mark one notification as read
router.put('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id → Delete notification (non-audit only)
router.delete('/:id', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notification.isAuditItem) {
      return res.status(403).json({ success: false, message: 'Audit notifications cannot be deleted' });
    }
    await notification.deleteOne();
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});

// ── FCM Token Routes ──────────────────────────────────────────────────────────

// POST /fcm-token → Save an FCM device token for the current user
router.post('/fcm-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    // Dedup: add token only if not already stored; cap at 10 tokens per user
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens = [...user.fcmTokens.slice(-9), token]; // keep last 10
      await user.save();
    }

    res.json({ success: true, message: 'FCM token registered' });
  } catch (error) {
    next(error);
  }
});

// DELETE /fcm-token → Remove an FCM token (e.g. on logout / permission revoke)
router.delete('/fcm-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { fcmTokens: token }
    });

    res.json({ success: true, message: 'FCM token removed' });
  } catch (error) {
    next(error);
  }
});

// ── Admin-only routes ─────────────────────────────────────────────────────────

// GET /admin/broadcast → Admin: all broadcast announcements
router.get('/admin/broadcast', restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const broadcasts = await Notification.find({ type: 'announcement' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, broadcasts });
  } catch (error) {
    next(error);
  }
});

// POST /admin/broadcast → Admin: create and send broadcast to all students
router.post('/admin/broadcast', restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { title, message, priority, actionUrl } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const User = require('../models/User');
    const students = await User.find({ role: 'student', isActive: true }).select('_id');

    const notifications = students.map(s => ({
      recipient: s._id,
      type: 'announcement',
      title,
      message,
      priority: priority || 'medium',
      actionUrl: actionUrl || null
    }));

    const created = await Notification.insertMany(notifications);

    // Emit to all connected students via socket
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      for (const student of students) {
        const notif = created.find(n => n.recipient.toString() === student._id.toString());
        if (notif) {
          io.to(`user:${student._id}`).emit('notification:new', notif);
        }
      }
    } catch (socketErr) {
      console.log('[Socket Error] Could not emit broadcast:', socketErr.message);
    }

    res.json({ success: true, message: `Broadcast sent to ${students.length} students`, count: created.length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
