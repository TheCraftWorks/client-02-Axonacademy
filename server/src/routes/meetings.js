const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const User = require('../models/User');
const LiveMeeting = require('../models/LiveMeeting');
const Classroom = require('../models/Classroom');
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const { protect, restrictTo, verifyClassroomAccess } = require('../middleware/auth');
const { sendFCMNotification } = require('../config/firebase');
const emailService = require('../services/emailService');

// Socket notification helper
const notifyMeetingCreated = async (meeting) => {
  try {
    const { getIO } = require('../config/socket');
    const io = getIO();
    io.to(`classroom:${meeting.classroom}`).emit('meeting:created', {
      _id: meeting._id,
      title: meeting.title,
      scheduledAt: meeting.scheduledAt,
      roomId: meeting.roomId
    });
  } catch (err) {
    console.error(err);
  }
};

const resolveClassroom = async (classroomIdentifier) => {
  if (!classroomIdentifier) return null;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(classroomIdentifier);
  let classroom = null;
  if (isObjectId) {
    classroom = await Classroom.findById(classroomIdentifier);
  }
  if (!classroom) {
    classroom = await Classroom.findOne({
      $or: [
        { code: classroomIdentifier },
        { name: classroomIdentifier }
      ]
    });
  }
  return classroom;
};

const verifyMeetingAccess = async (meeting, user) => {
  const classroomId = meeting.classroom && meeting.classroom._id ? meeting.classroom._id : meeting.classroom;
  const classroom = await Classroom.findById(classroomId);
  if (!classroom) {
    return { classroom: null, isAdmin: false, isFaculty: false, isEnrolled: false, allowed: false };
  }
  const allowed = verifyClassroomAccess(classroom, user, false);
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  const isFaculty = user.role === 'faculty';
  const isEnrolled = classroom.students.some(s => s.student.toString() === user._id.toString() && s.status === 'active');

  return { classroom, isAdmin, isFaculty, isEnrolled, allowed };
};

const upsertMeetingAttendance = async (meeting, userId, markedBy = 'auto') => {
  const attendee = meeting.attendees.find(a => a.student.toString() === userId.toString() && !a.leftAt)
    || meeting.attendees.filter(a => a.student.toString() === userId.toString()).at(-1);

  if (!attendee) return null;

  const leftAt = attendee.leftAt || new Date();
  const duration = Math.max(0, Math.round((leftAt - attendee.joinedAt) / 60000));
  attendee.duration = duration;

  const scheduledDate = meeting.scheduledAt || attendee.joinedAt || new Date();
  return Attendance.findOneAndUpdate(
    { meeting: meeting._id, student: userId },
    {
      $set: {
        classroom: meeting.classroom,
        date: scheduledDate,
        status: duration >= 1 ? 'present' : 'late',
        markedBy,
        joinedAt: attendee.joinedAt,
        leftAt: attendee.leftAt || null,
        duration
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// GET /classroom/:classroomId → Get all meetings for a classroom (accessible to enrolled students/admins)
router.get('/classroom/:classroomId', protect, async (req, res, next) => {
  try {
    const classroom = await resolveClassroom(req.params.classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    // Verify classroom access
    if (!verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const meetings = await LiveMeeting.find({ classroom: classroom._id })
      .populate('createdBy', 'fullName')
      .sort({ scheduledAt: 1 });

    res.json({ success: true, meetings });
  } catch (error) {
    next(error);
  }
});

// GET /my → Student/Admin: get all meetings for enrolled classrooms
router.get('/my', protect, async (req, res, next) => {
  try {
    const filter = { status: { $ne: 'cancelled' } };

    if (req.user.role === 'student') {
      const classrooms = await Classroom.find({
        'students.student': req.user._id,
        'students.status': 'active',
        status: 'active'
      }).select('_id');
      filter.classroom = { $in: classrooms.map((c) => c._id) };
    } else if (req.user.role === 'faculty') {
      const classrooms = await Classroom.find({
        instructors: req.user._id,
        status: 'active'
      }).select('_id');
      filter.classroom = { $in: classrooms.map((c) => c._id) };
    }

    const meetings = await LiveMeeting.find(filter)
      .populate('classroom', 'name code')
      .populate('createdBy', 'fullName')
      .sort({ scheduledAt: 1 });

    res.json({ success: true, meetings });
  } catch (error) {
    next(error);
  }
});

// GET /room/:roomId → Get meeting detail by roomId (used for lobby/room route)
router.get('/room/:roomId', protect, async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findOne({ roomId: req.params.roomId })
      .populate('classroom', 'name code students')
      .populate('createdBy', 'fullName email')
      .populate('attendees.student', 'fullName email avatar');

    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroom = meeting.classroom;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const isEnrolled = classroom ? classroom.students.some(s => s.student.toString() === req.user._id.toString() && s.status === 'active') : false;

    if (!isAdmin && !isEnrolled) {
      console.warn(`[Meeting Access Denied] User: ${req.user._id} (${req.user.role}) for Room: ${req.params.roomId}`);
      return res.status(403).json({ success: false, message: 'You are not authorized to view this meeting room. Please ensure you are enrolled in the classroom.' });
    }

    res.json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
});

// POST /room/:roomId/join → Student/Admin joins by roomId
router.post('/room/:roomId/join', protect, async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findOne({ roomId: req.params.roomId })
      .populate('classroom', 'students');
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroom = meeting.classroom;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const isEnrolled = classroom ? classroom.students.some(s => s.student.toString() === req.user._id.toString() && s.status === 'active') : false;

    if (!isAdmin && !isEnrolled) {
      return res.status(403).json({ success: false, message: 'You are not authorized to join this meeting room. Please ensure you are enrolled in the classroom.' });
    }

    const alreadyAttended = meeting.attendees.find(a => a.student.toString() === req.user._id.toString() && !a.leftAt);
    if (!alreadyAttended) {
      meeting.attendees.push({
        student: req.user._id,
        joinedAt: new Date()
      });
    }
    await meeting.save();
    await upsertMeetingAttendance(meeting, req.user._id);

    res.json({
      success: true,
      message: 'Successfully joined meeting lobby',
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        roomId: meeting.roomId,
        webexLink: meeting.webexLink,
        webexPassword: meeting.webexPassword,
        status: meeting.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /room/:roomId/heartbeat → keep live-class attendance duration fresh
router.post('/room/:roomId/heartbeat', protect, async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findOne({ roomId: req.params.roomId });
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const access = await verifyMeetingAccess(meeting, req.user);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this meeting attendance' });
    }

    let attendee = meeting.attendees.find(a => a.student.toString() === req.user._id.toString() && !a.leftAt);
    if (!attendee) {
      meeting.attendees.push({ student: req.user._id, joinedAt: new Date() });
      attendee = meeting.attendees[meeting.attendees.length - 1];
    }

    attendee.duration = Math.max(0, Math.round((Date.now() - attendee.joinedAt.getTime()) / 60000));
    await meeting.save();
    const attendance = await upsertMeetingAttendance(meeting, req.user._id);

    res.json({ success: true, duration: attendee.duration, attendance });
  } catch (error) {
    next(error);
  }
});

// POST /room/:roomId/leave → finalize live-class attendance duration by roomId
router.post('/room/:roomId/leave', protect, async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findOne({ roomId: req.params.roomId });
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const access = await verifyMeetingAccess(meeting, req.user);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: 'You are not authorized to update this meeting attendance' });
    }

    const attendee = meeting.attendees.find(a => a.student.toString() === req.user._id.toString() && !a.leftAt);
    if (attendee) {
      attendee.leftAt = new Date();
      attendee.duration = Math.max(0, Math.round((attendee.leftAt - attendee.joinedAt) / 60000));
      await meeting.save();
      await upsertMeetingAttendance(meeting, req.user._id);
    }

    res.json({ success: true, message: 'Successfully left meeting room' });
  } catch (error) {
    next(error);
  }
});

// GET /today → Admin: get today's scheduled/live meetings (for "Today's Classes" panel)
// IMPORTANT: must be defined BEFORE /:id to prevent 'today' being treated as an ObjectId
router.get('/today', protect, restrictTo('admin', 'superadmin'), async (req, res, next) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const meetings = await LiveMeeting.find({
      scheduledAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'cancelled' }
    })
      .populate('classroom', 'name code students')
      .sort({ scheduledAt: 1 });

    res.json({ success: true, meetings });
  } catch (error) {
    next(error);
  }
});

// GET /:id → Get meeting detail
router.get('/:id', protect, async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findById(req.params.id)
      .populate('classroom')
      .populate('createdBy', 'fullName')
      .populate('attendees.student', 'fullName email avatar');

    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    // Auth check
    const classroom = await Classroom.findById(meeting.classroom?._id || meeting.classroom);
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const isInstructor = classroom && Array.isArray(classroom.instructors)
      ? classroom.instructors.some(inst => inst.toString() === req.user._id.toString())
      : false;
    const isEnrolled = classroom ? classroom.students.some(s => s.student.toString() === req.user._id.toString() && s.status === 'active') : false;

    if (!isAdmin && !isInstructor && !isEnrolled) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this meeting' });
    }

    res.json({ success: true, meeting });
  } catch (error) {
    next(error);
  }
});

// POST /:id/join → Student/Admin: join meeting room (auth check: enrolled in classroom)
router.post('/:id/join', protect, async (req, res, next) => {
  try {
    const { id } = req.params;
    const meeting = await LiveMeeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroom = await Classroom.findById(meeting.classroom?._id || meeting.classroom);
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const isInstructor = classroom && Array.isArray(classroom.instructors)
      ? classroom.instructors.some(inst => inst.toString() === req.user._id.toString())
      : false;
    const isEnrolled = classroom ? classroom.students.some(s => s.student.toString() === req.user._id.toString() && s.status === 'active') : false;

    if (!isAdmin && !isInstructor && !isEnrolled) {
      return res.status(403).json({ success: false, message: 'You are not authorized to join this meeting room' });
    }

    // Auto-log join attendance
    const alreadyAttended = meeting.attendees.find(a => a.student.toString() === req.user._id.toString() && !a.leftAt);
    if (!alreadyAttended) {
      meeting.attendees.push({
        student: req.user._id,
        joinedAt: new Date()
      });
    }
    await meeting.save();
    await upsertMeetingAttendance(meeting, req.user._id);

    res.json({
      success: true,
      message: 'Successfully joined meeting lobby',
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        roomId: meeting.roomId,
        webexLink: meeting.webexLink,
        webexPassword: meeting.webexPassword,
        status: meeting.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /:id/leave → Student leaves meeting room, log duration
router.post('/:id/leave', protect, async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const attendee = meeting.attendees.find(a => a.student.toString() === req.user._id.toString() && !a.leftAt);
    if (attendee) {
      attendee.leftAt = new Date();
      const diffMs = attendee.leftAt - attendee.joinedAt;
      attendee.duration = Math.round(diffMs / 60000); // duration in minutes
      await meeting.save();
      await upsertMeetingAttendance(meeting, req.user._id);
    }

    res.json({ success: true, message: 'Successfully left meeting room' });
  } catch (error) {
    next(error);
  }
});

// Admin and Faculty endpoints (applied to routes below)
router.use(protect);
router.use(restrictTo('admin', 'superadmin', 'faculty'));

// POST / → Admin: create live meeting for classroom
router.post('/', async (req, res, next) => {
  try {
    const {
      classroom,
      title,
      description,
      scheduledAt,
      duration,
      sendWhatsApp = false,
      sendPortalNotification = true,
    } = req.body;

    if (!classroom || !title || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'Classroom, title, and scheduled time are required' });
    }

    const classroomDoc = await resolveClassroom(classroom);
    if (!classroomDoc) {
      console.error('[Meeting Create Error] Classroom not found:', classroom);
      return res.status(404).json({ success: false, message: 'Classroom not found for meeting creation' });
    }

    if (!verifyClassroomAccess(classroomDoc, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    console.log(`[Meeting Create] Creating Virtual Classroom for classroom: ${classroomDoc.name} (${classroomDoc._id})`);

    const generateRoomId = () => {
      const r = () => Math.floor(100 + Math.random() * 900);
      return `${r()}-${r()}-${r()}`;
    };
    const roomCode = generateRoomId();

    const meeting = await LiveMeeting.create({
      classroom: classroomDoc._id,
      title,
      description,
      scheduledAt: new Date(scheduledAt),
      duration: duration || 60,
      createdBy: req.user._id,
      roomId: roomCode,
      meetingLink: `/live/${roomCode}`,
      webexMeetingId: roomCode,
      webexLink: `/live/${roomCode}`,
      webexPassword: '',
      notified: {
        whatsapp: !!sendWhatsApp,
        portal: !!sendPortalNotification,
        sentAt: (sendWhatsApp || sendPortalNotification) ? new Date() : null
      }
    });

    // Increment totalLiveSessions classroom stats
    await Classroom.findByIdAndUpdate(classroomDoc._id, {
      $inc: { 'stats.totalLiveSessions': 1 }
    });

    if (sendPortalNotification) {
      await notifyMeetingCreated(meeting);

      const studentIds = classroomDoc.students
        .filter((s) => s.status === 'active')
        .map((s) => s.student)
        .filter(Boolean);
      const notifications = studentIds.map((studentId) => ({
        recipient: studentId,
        type: 'live_session',
        title: `Live class scheduled: ${title}`,
        message: `${title} is scheduled for ${new Date(scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
        priority: 'medium',
        actionUrl: `/student/live`,
        metadata: {
          classroom: classroomDoc._id,
          meetingId: meeting._id,
          roomId: roomCode,
        }
      }));
      if (notifications.length > 0) {
        const createdNotifications = await Notification.insertMany(notifications);
        try {
          const { getIO } = require('../config/socket');
          const io = getIO();
          createdNotifications.forEach((notif) => {
            io.to(`user:${notif.recipient}`).emit('notification:new', notif);
          });
        } catch (socketErr) {
          console.log('[Socket Error] Could not emit portal notifications:', socketErr.message);
        }
      }
      
      // ── Email: send meeting details via email to all enrolled students ───
      try {
        const enrolledStudents = await User.find(
          { _id: { $in: studentIds } },
          'fullName email'
        );
        if (enrolledStudents.length > 0) {
          const { sendMeetingScheduledEmail } = require('../services/emailService');
          // Fire them in parallel (non-blocking for API response)
          Promise.all(
            enrolledStudents.map((student) =>
              sendMeetingScheduledEmail(student, meeting, classroomDoc.name).catch((err) =>
                console.error(`[Email Error] Failed to send email to ${student.email}:`, err.message)
              )
            )
          ).catch((err) => console.error('[Email Error] Error sending batch emails:', err));
        }
      } catch (emailErr) {
        console.error('[Email Error] Failed to query student details or send emails:', emailErr.message);
      }

      // ── FCM Push: send instant push notification to enrolled students ─────
      try {
        const studentsWithTokens = await User.find(
          { _id: { $in: studentIds }, fcmTokens: { $exists: true, $not: { $size: 0 } } },
          { fcmTokens: 1 }
        );

        // Deduplicate tokens using a Set (fixes double notification issue on same device)
        const allTokens = [...new Set(studentsWithTokens.flatMap((u) => u.fcmTokens))];

        if (allTokens.length > 0) {
          const rawUrl = process.env.CLIENT_URL || 'http://localhost:8080';
          const urls = rawUrl.split(',').map(u => u.trim()).filter(Boolean);
          const clientUrl = urls.find(u => u.startsWith('https://')) || urls[0];
          const scheduledTime = new Date(scheduledAt).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit', hour12: true,
          });

          sendFCMNotification(allTokens, {
            title: `📅 New Live Class Scheduled: ${title}`,
            body: `${classroomDoc.name} · ${scheduledTime}. Tap to view the class.`,
            data: {
              type: 'meeting_scheduled',
              meetingId: String(meeting._id),
              roomId: roomCode,
              click_action: `${clientUrl}/student/live`,
            },
          }).then(async ({ invalidTokens }) => {
            // Purge stale / invalid tokens returned by FCM
            if (invalidTokens && invalidTokens.length > 0) {
              await User.updateMany(
                { fcmTokens: { $in: invalidTokens } },
                { $pull: { fcmTokens: { $in: invalidTokens } } }
              );
              console.log(`[FCM] Purged ${invalidTokens.length} invalid token(s) after schedule push.`);
            }
          }).catch((fcmErr) => {
            console.error('[FCM] Push notification failed for meeting creation:', fcmErr.message);
          });
        }
      } catch (fcmErr) {
        console.error('[FCM] Push notification failed for meeting creation:', fcmErr.message);
        // Non-fatal — meeting is still created
      }
    }

    if (sendWhatsApp) {
      console.log(`[WhatsApp Service Mock] Notify classroom students about: "${title}"`);
    }

    res.status(201).json({ success: true, message: 'Meeting scheduled successfully', meeting });
  } catch (error) {
    next(error);
  }
});

// PUT /:id → Admin: edit meeting
router.put('/:id', async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroom = await Classroom.findById(meeting.classroom);
    if (!classroom || !verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    Object.assign(meeting, req.body);
    await meeting.save();
    res.json({ success: true, message: 'Meeting updated successfully', meeting });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id → Admin: cancel meeting
router.delete('/:id', async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroom = await Classroom.findById(meeting.classroom);
    if (!classroom || !verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    meeting.status = 'cancelled';
    await meeting.save();

    // Decrement totalLiveSessions classroom stats
    await Classroom.findByIdAndUpdate(meeting.classroom, {
      $inc: { 'stats.totalLiveSessions': -1 }
    });

    res.json({ success: true, message: 'Meeting cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /:id/start → Admin: start meeting
router.post('/:id/start', async (req, res, next) => {
  try {
    const { id } = req.params;
    const meeting = await LiveMeeting.findById(id).populate('classroom');
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroomDoc = meeting.classroom?._id
      ? meeting.classroom
      : await Classroom.findById(meeting.classroom);

    if (!classroomDoc || !verifyClassroomAccess(classroomDoc, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    if (meeting.status === 'live') {
      return res.status(400).json({ success: false, message: 'Meeting is already live' });
    }

    meeting.status = 'live';
    meeting.startedAt = new Date();
    await meeting.save();

    // ── Socket: notify enrolled students in real-time ─────────────────────
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`classroom:${classroomDoc._id}`).emit('meeting:live', {
        meetingId: meeting._id,
        title: meeting.title,
        roomId: meeting.roomId
      });
      // also notify global admins/instructors
      io.emit('admin:class-started', { meetingId: meeting._id, roomId: meeting.roomId });
    } catch (socketErr) {
      console.log('[Socket Error] Could not emit class started alert:', socketErr.message);
    }

    // ── FCM Push: send instant mobile push to enrolled students ───────────
    try {
      if (classroomDoc) {
        const activeStudentIds = (classroomDoc.students || [])
          .filter((s) => s.status === 'active')
          .map((s) => s.student?._id || s.student)
          .filter(Boolean);

        if (activeStudentIds.length > 0) {
          // Fetch FCM tokens for all active students in one query
          const studentsWithTokens = await User.find(
            { _id: { $in: activeStudentIds }, fcmTokens: { $exists: true, $not: { $size: 0 } } },
            { fcmTokens: 1 }
          );

          // Deduplicate tokens using a Set (fixes double notification issue on same device)
          const allTokens = [...new Set(studentsWithTokens.flatMap((u) => u.fcmTokens))];

          if (allTokens.length > 0) {
            const rawUrl = process.env.CLIENT_URL || 'http://localhost:8080';
            const urls = rawUrl.split(',').map(u => u.trim()).filter(Boolean);
            const clientUrl = urls.find(u => u.startsWith('https://')) || urls[0];
            const classroomName = classroomDoc.name || 'your class';

            sendFCMNotification(allTokens, {
              title: `🔴 Live Class Started: ${meeting.title}`,
              body: `${classroomName} live session is now live! Tap to join.`,
              data: {
                type: 'live_class_started',
                meetingId: String(meeting._id),
                roomId: meeting.roomId,
                click_action: `${clientUrl}/live/${meeting.roomId}`,
              },
            }).then(async ({ invalidTokens }) => {
              // Purge stale / invalid tokens returned by FCM
              if (invalidTokens && invalidTokens.length > 0) {
                await User.updateMany(
                  { fcmTokens: { $in: invalidTokens } },
                  { $pull: { fcmTokens: { $in: invalidTokens } } }
                );
                console.log(`[FCM] Purged ${invalidTokens.length} invalid token(s).`);
              }
            }).catch((fcmErr) => {
              console.error('[FCM] Push notification failed for class start:', fcmErr.message);
            });
          }
        }
      }
    } catch (fcmErr) {
      console.error('[FCM] Push notification failed for class start:', fcmErr.message);
      // Non-fatal — the class still starts even if push fails
    }

    res.json({ success: true, message: 'Live class started successfully', meeting });
  } catch (error) {
    next(error);
  }
});

// POST /:id/end → Admin: end meeting
router.post('/:id/end', async (req, res, next) => {
  try {
    const { id } = req.params;
    const meeting = await LiveMeeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroom = await Classroom.findById(meeting.classroom);
    if (!classroom || !verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    meeting.status = 'ended';
    meeting.endedAt = new Date();

    // Auto-mark leftAt for attendees still in room
    meeting.attendees.forEach(attendee => {
      if (!attendee.leftAt) {
        attendee.leftAt = meeting.endedAt;
        const diffMs = attendee.leftAt - attendee.joinedAt;
        attendee.duration = Math.round(diffMs / 60000);
      }
    });

    await meeting.save();
    await Promise.all(meeting.attendees.map((attendee) => upsertMeetingAttendance(meeting, attendee.student)));

    // Emit ended socket alert
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`classroom:${meeting.classroom}`).emit('meeting:ended', { meetingId: meeting._id });
    } catch (socketErr) {
      console.log('[Socket Error] Could not emit class ended alert:', socketErr.message);
    }

    res.json({ success: true, message: 'Live class ended successfully', meeting });
  } catch (error) {
    next(error);
  }
});

// GET /:id/attendance → Admin: get attendance list for this meeting
router.get('/:id/attendance', async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findById(req.params.id)
      .populate('attendees.student', 'fullName email phone avatar');

    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroom = await Classroom.findById(meeting.classroom);
    if (!classroom || !verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    res.json({ success: true, attendees: meeting.attendees });
  } catch (error) {
    next(error);
  }
});

// POST /:id/notify → Admin: re-send notifications
router.post('/:id/notify', async (req, res, next) => {
  try {
    const meeting = await LiveMeeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const classroom = await Classroom.findById(meeting.classroom);
    if (!classroom || !verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    console.log(`[Notification Service Mock] Resending WhatsApp/Portal notification for meeting: "${meeting.title}"`);
    res.json({ success: true, message: 'Notifications resent successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
