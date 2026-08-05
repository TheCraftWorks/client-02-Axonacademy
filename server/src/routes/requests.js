const express = require('express');
const router = express.Router();

const User = require('../models/User');
const StudentRequest = require('../models/StudentRequest');
const Classroom = require('../models/Classroom');
const { protect, restrictTo } = require('../middleware/auth');
const { sendApprovalEmail } = require('../services/emailService');

// Mock messaging services
const whatsappService = {
  send: async (data) => console.log('[WhatsApp Mock] Sent message to:', data.phone, 'Template:', data.template, 'Data:', data.data)
};

// Protect all routes under requests (except register and my-status which are public/student-accessible)
// GET /my-status → Student: check own request status + admin note
router.get('/my-status', protect, async (req, res, next) => {
  try {
    const request = await StudentRequest.findOne({ user: req.user._id })
      .populate('program')
      .populate('batchAssigned');
    if (!request) {
      return res.status(404).json({ success: false, message: 'No registration request found for this account' });
    }
    res.json({ success: true, request });
  } catch (error) {
    next(error);
  }
});

// Admin-only routes
router.use(protect);
router.use(restrictTo('admin', 'superadmin'));

// GET / → Admin: list all requests with counts
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await StudentRequest.find(filter)
      .populate('user')
      .populate('program')
      .populate('batchAssigned')
      .sort({ createdAt: -1 });

    const total = await StudentRequest.countDocuments();
    const pending_count = await StudentRequest.countDocuments({ status: 'pending' });
    const approved_count = await StudentRequest.countDocuments({ status: 'approved' });
    const held_count = await StudentRequest.countDocuments({ status: 'held' });
    const rejected_count = await StudentRequest.countDocuments({ status: 'rejected' });

    res.json({
      success: true,
      requests,
      counts: {
        total,
        pending_count,
        approved_count,
        held_count,
        rejected_count
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id → Admin: get request details
router.get('/:id', async (req, res, next) => {
  try {
    const request = await StudentRequest.findById(req.params.id)
      .populate('user')
      .populate('program')
      .populate('batchAssigned')
      .populate('classroomsAssigned');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.json({ success: true, request });
  } catch (error) {
    next(error);
  }
});

// PUT /bulk-approve → Admin: approve multiple requests
router.put('/bulk-approve', async (req, res, next) => {
  try {
    const { ids, batchId, classroomIds, note } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Please provide an array of request ids' });
    }

    const results = [];
    for (const id of ids) {
      const request = await StudentRequest.findById(id).populate('user');
      if (!request || !request.user) continue;

      request.status = 'approved';
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
      request.adminNote = note || 'Bulk approved';
      request.timeline.push({
        status: 'approved',
        note: note || 'Approved via bulk actions',
        changedBy: req.user._id,
        changedAt: new Date()
      });

      if (batchId) request.batchAssigned = batchId;
      if (classroomIds && classroomIds.length > 0) {
        request.classroomsAssigned = classroomIds;
      }
      request.credentialsSent = true;
      await request.save();

      // Activate User
      await User.findByIdAndUpdate(request.user._id, {
        isVerified: true,
        isActive: true
      });

      // Add student to classroom rosters
      if (classroomIds && classroomIds.length > 0) {
        await Classroom.updateMany(
          { _id: { $in: classroomIds } },
          { $addToSet: { students: { student: request.user._id, status: 'active' } } }
        );
      }

      // Send approval email (non-blocking in bulk loop)
      sendApprovalEmail(request.user).catch(err => {
        console.error('[Bulk Approve] Failed to send email to', request.user.email, '—', err.message || err);
      });

      results.push(id);
    }

    res.json({ success: true, message: `Successfully approved ${results.length} requests`, approvedIds: results });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/approve → Admin: approve + optionally assign batch + classrooms
router.put('/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { batchId, classroomIds, note } = req.body;

    const request = await StudentRequest.findById(id).populate('user');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // 1. Update request status
    request.status = 'approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    request.adminNote = note;
    request.timeline.push({
      status: 'approved',
      note: note || 'Approved by admin',
      changedBy: req.user._id,
      changedAt: new Date()
    });

    if (batchId) {
      request.batchAssigned = batchId;
    }

    if (classroomIds && classroomIds.length > 0) {
      request.classroomsAssigned = classroomIds;
      request.credentialsSent = true;
    }

    await request.save();

    // 2. Activate user account
    await User.findByIdAndUpdate(request.user._id, {
      isVerified: true,
      isActive: true
    });

    // 3. Add to classrooms
    if (classroomIds && classroomIds.length > 0) {
      await Classroom.updateMany(
        { _id: { $in: classroomIds } },
        { $addToSet: { students: { student: request.user._id, status: 'active' } } }
      );
    }

    // 4. Notify student REAL-TIME (if they have a socket connection)
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`user:${request.user._id}`).emit('notification:new', {
        type: 'account_approved',
        title: 'Your account has been approved!',
        message: 'Welcome to Hospital Training Academy. You can now access your portal.',
        priority: 'high'
      });
    } catch (socketErr) {
      console.log('[Socket Error] Could not emit approval notification to student:', socketErr.message);
    }

    // 5. Send notifications
    const rawUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const urls = rawUrl.split(',').map(u => u.trim()).filter(Boolean);
    const clientUrl = urls.find(u => u.startsWith('https://')) || urls[0];
    
    await whatsappService.send({
      phone: request.phone,
      template: 'account_approved',
      data: { name: request.fullName, loginUrl: `${clientUrl}/auth/login` }
    });

    try {
      await sendApprovalEmail(request.user);
    } catch (emailErr) {
      console.error('[Approve] Failed to send approval email to', request.user.email, '—', emailErr.message || emailErr);
    }

    res.json({ success: true, message: 'Student request approved successfully', request });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/hold → Admin: hold student (block login)
router.put('/:id/hold', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const request = await StudentRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.status = 'held';
    request.adminNote = note || 'Placed on hold by administrator';
    request.timeline.push({
      status: 'held',
      note: note || 'Placed on hold',
      changedBy: req.user._id,
      changedAt: new Date()
    });
    await request.save();

    // Block login by disabling verified state / active state
    await User.findByIdAndUpdate(request.user, {
      isVerified: false, // forces status checker in login
      isActive: false
    });

    // Notify student real-time
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`user:${request.user}`).emit('notification:new', {
        type: 'account_held',
        title: 'Account access temporarily suspended',
        message: note || 'Please contact the academy for more information.',
        priority: 'critical'
      });
    } catch (socketErr) {
      console.log('[Socket Error] Could not emit hold notification to student:', socketErr.message);
    }

    res.json({ success: true, message: 'Student account placed on hold', request });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/reject → Admin: reject student request
router.put('/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const request = await StudentRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.status = 'rejected';
    request.adminNote = note || 'Rejected by administrator';
    request.timeline.push({
      status: 'rejected',
      note: note || 'Application rejected',
      changedBy: req.user._id,
      changedAt: new Date()
    });
    await request.save();

    // Block login
    await User.findByIdAndUpdate(request.user, {
      isVerified: false,
      isActive: false
    });

    res.json({ success: true, message: 'Student request rejected', request });
  } catch (error) {
    next(error);
  }
});

// GET /:id/timeline → Get timeline
router.get('/:id/timeline', async (req, res, next) => {
  try {
    const request = await StudentRequest.findById(req.params.id).select('timeline');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.json({ success: true, timeline: request.timeline });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/batch → Assign batch
router.put('/:id/batch', async (req, res, next) => {
  try {
    const { batchId } = req.body;
    const request = await StudentRequest.findByIdAndUpdate(
      req.params.id,
      { $set: { batchAssigned: batchId } },
      { new: true }
    );
    res.json({ success: true, message: 'Batch updated', request });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/classrooms → Assign/change classrooms
router.put('/:id/classrooms', async (req, res, next) => {
  try {
    const { classroomIds } = req.body; // array
    const request = await StudentRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const previousClassrooms = request.classroomsAssigned || [];
    request.classroomsAssigned = classroomIds;
    await request.save();

    // Remove from previous classrooms
    if (previousClassrooms.length > 0) {
      await Classroom.updateMany(
        { _id: { $in: previousClassrooms } },
        { $pull: { students: { student: request.user } } }
      );
    }

    // Add to new classrooms
    if (classroomIds && classroomIds.length > 0) {
      await Classroom.updateMany(
        { _id: { $in: classroomIds } },
        { $addToSet: { students: { student: request.user, status: 'active' } } }
      );
    }

    res.json({ success: true, message: 'Classrooms updated', request });
  } catch (error) {
    next(error);
  }
});

// DELETE /:userId/remove → Soft-delete application + block login
router.delete('/:userId/remove', async (req, res, next) => {
  try {
    const { userId } = req.params;

    const request = await StudentRequest.findOne({ user: userId });
    if (request) {
      request.status = 'rejected';
      request.adminNote = 'Account deactivated by administrator';
      request.timeline.push({
        status: 'removed',
        note: 'Deactivated and removed student account',
        changedBy: req.user._id,
        changedAt: new Date()
      });
      await request.save();
    }

    // Disable User account
    await User.findByIdAndUpdate(userId, {
      isVerified: false,
      isActive: false
    });

    // Remove student from all classrooms
    await Classroom.updateMany(
      {},
      { $pull: { students: { student: userId } } }
    );

    res.json({ success: true, message: 'Student account removed and deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /:userId/restore → Restore student account
router.put('/:userId/restore', async (req, res, next) => {
  try {
    const { userId } = req.params;

    const request = await StudentRequest.findOne({ user: userId });
    if (request) {
      request.status = 'approved';
      request.adminNote = 'Account restored by administrator';
      request.timeline.push({
        status: 'restored',
        note: 'Account restored and reactivated',
        changedBy: req.user._id,
        changedAt: new Date()
      });
      await request.save();

      // Put student back in assigned classrooms
      if (request.classroomsAssigned && request.classroomsAssigned.length > 0) {
        await Classroom.updateMany(
          { _id: { $in: request.classroomsAssigned } },
          { $addToSet: { students: { student: userId, status: 'active' } } }
        );
      }
    }

    await User.findByIdAndUpdate(userId, {
      isVerified: true,
      isActive: true
    });

    res.json({ success: true, message: 'Student account successfully restored' });
  } catch (error) {
    next(error);
  }
});

// PUT /:userId/edit → Admin: edit student details
router.put('/:userId/edit', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { fullName, phone, qualification, address } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { fullName, phone } },
      { new: true }
    );

    await StudentRequest.findOneAndUpdate(
      { user: userId },
      { $set: { fullName, phone, qualification, address } }
    );

    res.json({ success: true, message: 'Student details updated successfully', user });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
