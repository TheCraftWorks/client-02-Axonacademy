const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Classroom = require('../models/Classroom');
const ClassroomAnnouncement = require('../models/ClassroomAnnouncement');
const StudentRequest = require('../models/StudentRequest');
const Program = require('../models/Program');
const LiveMeeting = require('../models/LiveMeeting');
const ClassroomRecording = require('../models/ClassroomRecording');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const ClassroomJoinRequest = require('../models/ClassroomJoinRequest');
const ClassroomFolder = require('../models/ClassroomFolder');
const { sendWelcomeEmail } = require('../services/emailService');
const { protect, restrictTo, verifyClassroomAccess } = require('../middleware/auth');
const mongoose = require('mongoose');
const multer = require('multer');
const https = require('https');
const urlModule = require('url');
const { cloudinary } = require('../config/cloudinary');

// Multer for R2 uploads: keep file in memory so we can pass it to S3 SDK
const r2Upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for PDFs
});

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// In-memory cache for ultra-fast classroom responses (TTL: 60 seconds)
const responseCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function getCachedData(key) {
  const item = responseCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return item.data;
}

function setCachedData(key, data) {
  responseCache.set(key, { data, timestamp: Date.now() });
}

function clearClassroomCache() {
  responseCache.clear();
}

router.clearClassroomCache = clearClassroomCache;

// Prevent CastError for all routes expecting a classroom :id
router.param('id', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid classroom ID format' });
  }
  next();
});

const resolveProgramId = async (program) => {
  if (!program) return null;
  if (mongoose.Types.ObjectId.isValid(program)) return program;

  const title = String(program).trim();
  if (!title) return null;

  const slug = slugify(title);
  let existingProgram = await Program.findOne({
    $or: [
      { title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { slug }
    ]
  });

  if (!existingProgram) {
    existingProgram = await Program.create({
      title,
      slug,
      category: 'other',
      isPublished: true
    });
  }

  return existingProgram._id;
};

const normalizeClassroomRefs = async (payload) => {
  const normalized = { ...payload };

  if ('program' in normalized) {
    normalized.program = await resolveProgramId(normalized.program);
  }

  if ('batch' in normalized && normalized.batch && !mongoose.Types.ObjectId.isValid(normalized.batch)) {
    normalized.batch = null;
  }

  return normalized;
};

const attachMeetingsToClassrooms = async (classrooms) => {
  const list = Array.isArray(classrooms) ? classrooms : [classrooms];
  const classroomIds = list.map((classroom) => classroom._id);
  const meetings = await LiveMeeting.find({ classroom: { $in: classroomIds } })
    .populate('createdBy', 'fullName')
    .sort({ scheduledAt: 1 })
    .lean();

  const meetingsByClassroom = meetings.reduce((acc, meeting) => {
    const key = meeting.classroom.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(meeting);
    return acc;
  }, {});

  const withMeetings = list.map((classroom) => ({
    ...classroom,
    meetings: meetingsByClassroom[classroom._id.toString()] || []
  }));

  return Array.isArray(classrooms) ? withMeetings : withMeetings[0];
};

const manualPopulate = async (list, path, select = 'fullName email phone', filterDeleted = false) => {
  const isArray = Array.isArray(list);
  const items = isArray ? list : [list];
  if (items.length === 0) return list;

  const pathParts = path.split('.');
  const ids = new Set();
  items.forEach(item => {
    if (!item) return;
    if (pathParts.length === 1) {
      const rawVal = item[pathParts[0]];
      const val = rawVal?._id ? rawVal._id.toString() : (typeof rawVal === 'string' ? rawVal : rawVal?.toString());
      if (val && mongoose.Types.ObjectId.isValid(val)) ids.add(val);
    } else if (pathParts.length === 2) {
      const array = item[pathParts[0]];
      if (Array.isArray(array)) {
        array.forEach(sub => {
          if (!sub) return;
          const rawVal = sub[pathParts[1]];
          const val = rawVal?._id ? rawVal._id.toString() : (typeof rawVal === 'string' ? rawVal : rawVal?.toString());
          if (val && mongoose.Types.ObjectId.isValid(val)) ids.add(val);
        });
      }
    }
  });

  const allIds = Array.from(ids);
  if (allIds.length === 0) return list;

  const users = await User.find({ _id: { $in: allIds } }).select(select + ' role isActive').lean();
  const userMap = users.reduce((acc, u) => { acc[u._id.toString()] = u; return acc; }, {});

  items.forEach(item => {
    if (!item) return;
    if (pathParts.length === 1) {
      const rawVal = item[pathParts[0]];
      const val = rawVal?._id ? rawVal._id.toString() : (typeof rawVal === 'string' ? rawVal : rawVal?.toString());
      if (val && userMap[val]) {
        item[pathParts[0]] = userMap[val];
      } else if (rawVal && typeof rawVal === 'object' && rawVal.fullName) {
        item[pathParts[0]] = rawVal;
      }
    } else if (pathParts.length === 2) {
      const array = item[pathParts[0]];
      if (Array.isArray(array)) {
        const populated = array.map(sub => {
          if (!sub) return sub;
          const rawVal = sub[pathParts[1]];
          const val = rawVal?._id ? rawVal._id.toString() : (typeof rawVal === 'string' ? rawVal : rawVal?.toString());
          const user = (val && userMap[val]) ? userMap[val] : (rawVal && typeof rawVal === 'object' && rawVal.fullName ? rawVal : rawVal);
          return { ...sub, [pathParts[1]]: user };
        });

        if (filterDeleted) {
          item[pathParts[0]] = populated.filter(sub => sub[pathParts[1]] !== null && sub[pathParts[1]] !== undefined);
        } else {
          item[pathParts[0]] = populated;
        }
      }
    }
  });

  return isArray ? items : items[0];
};

const attachClassroomDetails = async (classrooms, options = {}) => {
  const studentId = options.studentId ? options.studentId.toString() : null;
  const isList = options.isList === true;
  const isStaff = options.isStaff !== undefined ? options.isStaff : (!studentId);
  const list = Array.isArray(classrooms) ? classrooms : [classrooms];
  if (list.length === 0) return classrooms;

  // Ensure students.student is populated across classrooms
  await manualPopulate(list, 'students.student', 'fullName email phone avatar role isVerified isActive', false);
  const classroomIds = list.map((classroom) => classroom._id);

  // 1. Live Meetings (exclude large attendees & waitingRoom arrays on overview)
  let meetingsQuery = LiveMeeting.find({ classroom: { $in: classroomIds } });
  if (isList) {
    meetingsQuery = meetingsQuery.select('_id classroom title status scheduledAt duration roomId webexLink');
  } else {
    meetingsQuery = meetingsQuery.select('-attendees -waitingRoom').populate('createdBy', 'fullName');
  }
  meetingsQuery = meetingsQuery.sort({ scheduledAt: 1 }).lean();

  // 2. Folders
  const foldersQuery = ClassroomFolder.find({ classroom: { $in: classroomIds } })
    .sort({ order: 1, createdAt: -1 })
    .lean();

  // 3. Recordings (exclude heavy transcripts and session history)
  let recordingsQuery = ClassroomRecording.find({ classroom: { $in: classroomIds } });
  if (isList) {
    recordingsQuery = recordingsQuery.select('_id classroom title isPublished duration folder createdAt');
  } else {
    recordingsQuery = recordingsQuery.select('-transcript -viewStats.sessions').populate('uploadedBy', 'fullName');
  }
  recordingsQuery = recordingsQuery.sort({ createdAt: -1 }).lean();

  // 4. Announcements
  let announcementsQuery = ClassroomAnnouncement.find({ classroom: { $in: classroomIds } });
  if (isList) {
    announcementsQuery = announcementsQuery.select('_id classroom content attachments createdAt author');
  } else {
    announcementsQuery = announcementsQuery.populate('author', 'fullName role avatar');
  }
  announcementsQuery = announcementsQuery.sort({ createdAt: -1 }).lean();

  // 5. Quizzes
  let quizzesQuery = Quiz.find({ classroom: { $in: classroomIds } });
  if (!isStaff) {
    quizzesQuery = quizzesQuery.select('-questions.explanation -questions.options.isCorrect');
  }
  quizzesQuery = quizzesQuery.sort({ createdAt: -1 }).lean();

  // 6. Quiz Attempts
  let quizAttemptsQuery;
  if (studentId) {
    quizAttemptsQuery = QuizAttempt.find({
      classroom: { $in: classroomIds },
      student: studentId
    })
      .select('-answers -questionOrder')
      .sort({ createdAt: -1 })
      .lean();
  } else if (!isList) {
    quizAttemptsQuery = QuizAttempt.find({ classroom: { $in: classroomIds } })
      .select('-answers -questionOrder')
      .sort({ createdAt: -1 })
      .lean();
  } else {
    quizAttemptsQuery = QuizAttempt.find({ classroom: { $in: classroomIds } })
      .select('_id status quiz classroom')
      .sort({ createdAt: -1 })
      .lean();
  }

  // 7. Join Requests aggregate count
  const joinRequestsQuery = ClassroomJoinRequest.aggregate([
    { $match: { classroom: { $in: classroomIds }, status: 'pending' } },
    { $group: { _id: '$classroom', count: { $sum: 1 } } }
  ]);

  // Execute all 7 queries concurrently in parallel
  const [
    meetings,
    folders,
    recordings,
    announcements,
    quizzes,
    quizAttempts,
    joinRequests
  ] = await Promise.all([
    meetingsQuery,
    foldersQuery,
    recordingsQuery,
    announcementsQuery,
    quizzesQuery,
    quizAttemptsQuery,
    joinRequestsQuery
  ]);

  if (studentId) {
    recordings.forEach(r => {
      if (Array.isArray(r.viewStats)) {
        r.viewStats = r.viewStats.filter(v => v.student && v.student.toString() === studentId);
      }
    });
  }

  const meetingsByClassroom = meetings.reduce((acc, meeting) => {
    if (meeting.classroom) {
      const key = meeting.classroom.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(meeting);
    }
    return acc;
  }, {});

  const foldersByClassroom = folders.reduce((acc, folder) => {
    if (folder.classroom) {
      const key = folder.classroom.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(folder);
    }
    return acc;
  }, {});

  const recordingsByClassroom = recordings.reduce((acc, rec) => {
    if (rec.classroom) {
      const key = rec.classroom.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(rec);
    }
    return acc;
  }, {});

  const announcementsByClassroom = announcements.reduce((acc, announcement) => {
    if (announcement.classroom) {
      const key = announcement.classroom.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(announcement);
    }
    return acc;
  }, {});

  const quizzesByClassroom = quizzes.reduce((acc, q) => {
    if (q.classroom) {
      const key = q.classroom.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(q);
    }
    return acc;
  }, {});

  const attemptsByQuiz = quizAttempts.reduce((acc, att) => {
    if (att.quiz) {
      const key = att.quiz.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        ...att,
        id: att._id.toString(),
        studentName: att.student ? att.student.fullName : 'Student'
      });
    }
    return acc;
  }, {});

  const joinReqCountByClassroom = joinRequests.reduce((acc, req) => {
    acc[req._id.toString()] = req.count;
    return acc;
  }, {});

  const withDetails = list.map((classroom) => {
    const classroomIdStr = classroom._id.toString();

    return {
      ...classroom,
      meetings: (meetingsByClassroom[classroomIdStr] || []).map(m => ({
        ...m,
        id: m._id.toString(),
        attendees: Array.isArray(m.attendees) ? m.attendees : [],
        createdBy: typeof m.createdBy === 'object' && m.createdBy !== null
          ? (m.createdBy.fullName || m.createdBy.name || 'Admin')
          : (m.createdBy || 'Admin')
      })),
      pendingJoinRequestsCount: joinReqCountByClassroom[classroomIdStr] || 0,
      folders: (foldersByClassroom[classroomIdStr] || []).map(f => ({
        ...f,
        id: f._id.toString()
      })),
      recordings: (recordingsByClassroom[classroomIdStr] || []).map(r => ({
        ...r,
        id: r._id.toString()
      })),
      announcements: (announcementsByClassroom[classroomIdStr] || []).map(announcement => ({
        ...announcement,
        id: announcement._id.toString(),
        author: typeof announcement.author === 'object' && announcement.author !== null
          ? (announcement.author.fullName || announcement.author.name || 'Admin')
          : (announcement.author || 'Admin')
      })),
      quizzes: (quizzesByClassroom[classroomIdStr] || []).map(q => ({
        ...q,
        id: q._id.toString(),
        attempts: attemptsByQuiz[q._id.toString()] || []
      }))
    };
  });

  return Array.isArray(classrooms) ? withDetails : withDetails[0];
};

const getStudentRefId = (studentRef) => {
  if (!studentRef) return '';
  if (studentRef._id) return studentRef._id.toString();
  return studentRef.toString();
};

// GET /files → Proxy file from Cloudinary using Admin API
// Bypasses secured delivery by authenticating with API key/secret server-side
// GET /r2-proxy → Stream or proxy download from R2 with server-side auth (key passed as query param)
router.get('/r2-proxy', async (req, res, next) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ success: false, message: 'Missing key parameter' });
    }

    const { getS3Client, getCloudflareConfig } = require('../config/cloudflare');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const path = require('path');

    const { CLOUDFLARE_R2_BUCKET } = getCloudflareConfig();
    const client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET,
      Key: key,
    });

    const s3Response = await client.send(command);

    res.setHeader('Content-Type', s3Response.ContentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(String(key))}"`);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (s3Response.ContentLength) {
      res.setHeader('Content-Length', s3Response.ContentLength);
    }

    s3Response.Body.pipe(res);
  } catch (error) {
    console.error('[R2 Proxy] Error:', error);
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    next(error);
  }
});

// Legacy /files route - now redirects to R2 proxy for backward compatibility
router.get('/files', async (req, res, next) => {
  try {
    const { url } = req.query;
    console.log('[File Proxy] Received request for:', url);

    if (!url) {
      return res.status(400).json({ success: false, message: 'Missing ?url= parameter' });
    }

    const decodedUrl = decodeURIComponent(url);
    console.log('[File Proxy] Decoded URL:', decodedUrl);

    // Only allow proxying from Cloudinary for security
    if (!decodedUrl.includes('res.cloudinary.com/')) {
      return res.status(403).json({ success: false, message: 'Only Cloudinary URLs are allowed' });
    }

    // Extract public_id from the Cloudinary URL
    const urlMatch = decodedUrl.match(/\/v\d+\/(.+?)(?:\?|$)/);
    let publicId = urlMatch ? urlMatch[1] : null;
    if (!publicId) {
      const uploadMatch = decodedUrl.match(/\/upload\/(.+?)(?:\?|$)/);
      publicId = uploadMatch ? uploadMatch[1] : null;
    }

    console.log('[File Proxy] Extracted publicId:', publicId);

    if (!publicId) {
      return res.status(400).json({ success: false, message: 'Could not extract file ID from URL' });
    }

    // Use Cloudinary SDK's download_stream which authenticates server-side
    console.log('[File Proxy] Requesting download stream from Cloudinary...');
    const downloadStream = cloudinary.uploader.download_stream(publicId, {
      resource_type: 'raw'
    });

    // Wait for stream to start before setting headers
    downloadStream.on('response', (streamRes) => {
      console.log('[File Proxy] Cloudinary responded with status:', streamRes.statusCode);

      const contentType = streamRes.headers['content-type'] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      if (streamRes.headers['content-length']) {
        res.setHeader('Content-Length', streamRes.headers['content-length']);
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (contentType === 'application/pdf') {
        res.setHeader('Content-Disposition', 'inline');
      }

      // Destroy streamRes if client closes connection to release Cloudinary socket
      req.on('close', () => {
        streamRes.destroy();
      });

      streamRes.pipe(res);
    });

    downloadStream.on('error', (err) => {
      console.error('[File Proxy] Download error:', err.message);
      console.error('[File Proxy] Error code:', err.code);
      console.error('[File Proxy] Full error:', err);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          message: 'Failed to download file from Cloudinary: ' + err.message
        });
      }
    });

    downloadStream.on('end', () => {
      console.log('[File Proxy] Stream ended successfully');
    });
  } catch (error) {
    console.error('[File Proxy] Error:', error);
    next(error);
  }
});

function pipeFileResponse(sourceRes, targetRes) {
  const contentType = sourceRes.headers['content-type'] || 'application/octet-stream';
  targetRes.setHeader('Content-Type', contentType);
  if (sourceRes.headers['content-length']) {
    targetRes.setHeader('Content-Length', sourceRes.headers['content-length']);
  }
  targetRes.setHeader('Access-Control-Allow-Origin', '*');
  if (contentType === 'application/pdf') {
    targetRes.setHeader('Content-Disposition', 'inline');
  }
  sourceRes.pipe(targetRes);
}

// POST /upload-asset → Admin/Faculty: Upload a classroom asset (PDF) to Cloudflare R2
router.post('/upload-asset', protect, restrictTo('admin', 'superadmin', 'faculty'), r2Upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { uploadFileToCloudflareR2 } = require('../config/cloudflare');
    const originalName = req.file.originalname || 'document.pdf';
    const safeFilename = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `announcements/${Date.now()}-${safeFilename}`;

    await uploadFileToCloudflareR2(
      req.file.buffer,
      objectKey,
      req.file.mimetype || 'application/pdf'
    );

    const proxyUrl = `/classrooms/r2-proxy?key=${encodeURIComponent(objectKey)}`;

    console.log('[Upload Asset] Uploaded to R2, objectKey:', objectKey);

    res.json({
      success: true,
      url: proxyUrl,
      publicId: objectKey,
      name: originalName
    });
  } catch (error) {
    console.error('[Upload Asset] Error:', error);
    next(error);
  }
});

// GET /my → Student: get classrooms I'm enrolled in
router.get('/my', protect, async (req, res, next) => {
  try {
    const cacheKey = `my_${req.user._id.toString()}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Find active classrooms where student is enrolled
    const classrooms = await Classroom.find({
      'students.student': req.user._id,
      status: 'active'
    })
      .populate('program')
      .populate('batch')
      .populate('instructors', 'fullName email avatar')
      .lean();

    // Filter students array in each classroom to only contain the logged-in student's record
    // to avoid querying user info for all other classmates in the list endpoint
    classrooms.forEach(c => {
      if (c.students) {
        c.students = c.students.filter(s => s.student && s.student.toString() === req.user._id.toString());
      }
    });

    await manualPopulate(classrooms, 'students.student', 'fullName email phone avatar role isVerified isActive');
    const result = { success: true, classrooms: await attachClassroomDetails(classrooms, { studentId: req.user._id, isList: true }) };
    setCachedData(cacheKey, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /:id → Get classroom details + stats
router.get('/:id', protect, async (req, res, next) => {
  try {
    const isStudent = req.user.role === 'student';
    const cacheKey = `detail_${req.params.id}_${req.user._id.toString()}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const classroom = await Classroom.findById(req.params.id)
      .populate('program')
      .populate('batch')
      .populate('createdBy', 'fullName email')
      .populate('instructors', 'fullName email avatar')
      .lean();

    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    // Verify student is enrolled or user is admin/assigned faculty
    if (!verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    // For student, filter students array to avoid serializing 200+ other users
    if (isStudent && Array.isArray(classroom.students)) {
      classroom.students = classroom.students.filter(
        s => s.student && s.student.toString() === req.user._id.toString()
      );
    }

    await manualPopulate(classroom, 'students.student', 'fullName email phone avatar role isVerified isActive');

    const result = {
      success: true,
      classroom: await attachClassroomDetails(classroom, isStudent ? { studentId: req.user._id, isStaff: false } : { isStaff: true })
    };
    setCachedData(cacheKey, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /:id/announcements → Get classroom announcements (newest first)
router.get('/:id/announcements', protect, async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }
    if (!verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }
    const announcements = await ClassroomAnnouncement.find({ classroom: req.params.id })
      .populate('author', 'fullName role avatar')
      .sort({ createdAt: -1 });

    res.json({ success: true, announcements });
  } catch (error) {
    next(error);
  }
});

// Student only endpoint: mark announcement as read
// PUT /:id/announcements/:annoId/read → Student: mark announcement as read
router.put('/:id/announcements/:annoId/read', protect, async (req, res, next) => {
  try {
    const announcement = await ClassroomAnnouncement.findByIdAndUpdate(
      req.params.annoId,
      { $addToSet: { readBy: req.user._id } },
      { new: true }
    );
    res.json({ success: true, message: 'Announcement marked as read', announcement });
  } catch (error) {
    next(error);
  }
});

// GET /:id/join-status → Public: Check status of a student's join request by email
router.get('/:id/join-status', async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email query parameter is required.' });
    }
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found.' });
    }

    // 1. Check if user exists and is enrolled in the classroom
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const isEnrolled = classroom.students.some(s => s.student.toString() === user._id.toString());
      if (isEnrolled) {
        return res.json({ success: true, status: 'approved' });
      }
    }

    // 2. Check ClassroomJoinRequests
    const joinReq = await ClassroomJoinRequest.findOne({
      email: email.toLowerCase(),
      classroom: req.params.id
    }).sort({ createdAt: -1 });

    if (joinReq) {
      if (joinReq.status === 'approved' && !user) {
        return res.json({ success: true, status: 'none' });
      }
      return res.json({ success: true, status: joinReq.status });
    }

    res.json({ success: true, status: 'none' });
  } catch (error) {
    next(error);
  }
});

// POST /:id/join-request → Public: Student request to join classroom
router.post('/:id/join-request', async (req, res, next) => {
  try {
    const { fullName, email, phone, password } = req.body;
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found.' });
    }

    // Check if phone number is already registered to someone else
    if (phone) {
      const existingPhone = await User.findOne({ phone: phone.trim() });
      if (existingPhone) {
        return res.status(400).json({ success: false, message: 'Phone number already registered to another user.' });
      }
    }

    // Check if they are already registered and enrolled
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const isEnrolled = classroom.students.some(s => s.student.toString() === user._id.toString());
      if (isEnrolled) {
        return res.status(400).json({ success: false, code: 'ALREADY_APPROVED', message: 'Your request has already been approved. Please login.' });
      }
    }

    const existingApprovedReq = await ClassroomJoinRequest.findOne({ email: email.toLowerCase(), classroom: req.params.id, status: 'approved' });
    if (existingApprovedReq) {
      if (user) {
        return res.status(400).json({ success: false, code: 'ALREADY_APPROVED', message: 'Your request has already been approved. Please login.' });
      } else {
        // User was deleted, so clean up all old join requests for this email in this classroom
        await ClassroomJoinRequest.deleteMany({ email: email.toLowerCase(), classroom: req.params.id });
      }
    }

    const existingReq = await ClassroomJoinRequest.findOne({ email: email.toLowerCase(), classroom: req.params.id, status: 'pending' });
    if (existingReq) {
      return res.status(400).json({ success: false, message: 'You already have a pending request for this classroom.' });
    }

    const request = await ClassroomJoinRequest.create({
      fullName,
      email,
      phone,
      rawPassword: typeof password === 'string' ? password.trim() : password,
      classroom: req.params.id
    });
    res.status(201).json({ success: true, message: 'Join request sent successfully. Awaiting admin approval.' });
  } catch (error) {
    next(error);
  }
});

// Admin-only endpoints
router.use(protect);
router.use(restrictTo('admin', 'superadmin', 'faculty'));

// POST / → Admin: create classroom
router.post('/', async (req, res, next) => {
  try {
    if (req.user.role === 'faculty') {
      return res.status(403).json({ success: false, message: 'Only administrators can create classrooms.' });
    }
    const { name, description, thumbnail, code, program, batch, maxStudents, settings, instructors } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Classroom name and code are required' });
    }

    const existingClassroom = await Classroom.findOne({ code });
    if (existingClassroom) {
      return res.status(400).json({ success: false, message: 'Classroom code already exists' });
    }

    const refs = await normalizeClassroomRefs({ program, batch });

    const classroom = await Classroom.create({
      name,
      description,
      thumbnail,
      code,
      createdBy: req.user._id,
      program: refs.program,
      batch: refs.batch,
      maxStudents: maxStudents || 100,
      instructors: instructors || [],
      settings: settings || {
        allowQuizLeaderboard: false,
        allowStudentChat: true,
        notifyOnUpload: true
      }
    });

    await classroom.populate('program batch instructors');

    clearClassroomCache();
    res.status(201).json({ success: true, message: 'Classroom created successfully', classroom });
  } catch (error) {
    next(error);
  }
});

// GET / → Admin: list all classrooms
router.get('/', async (req, res, next) => {
  try {
    const { status, program } = req.query;
    const cacheKey = `all_${req.user._id.toString()}_${req.user.role}_${status || ''}_${program || ''}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const filter = {};
    if (status) filter.status = status;
    if (program) filter.program = await resolveProgramId(program);

    if (req.user.role === 'faculty') {
      filter.instructors = req.user._id;
    }

    const classrooms = await Classroom.find(filter)
      .populate('program')
      .populate('batch')
      .populate('instructors', 'fullName email avatar')
      .sort({ createdAt: -1 })
      .lean();

    const result = { success: true, classrooms: await attachClassroomDetails(classrooms, { isList: true }) };
    setCachedData(cacheKey, result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PUT /:id → Admin: update classroom info
router.put('/:id', async (req, res, next) => {
  try {
    if (req.user.role === 'faculty') {
      return res.status(403).json({ success: false, message: 'Only administrators can update classrooms.' });
    }
    const updates = await normalizeClassroomRefs(req.body);
    const classroom = await Classroom.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }
    await classroom.populate('program batch instructors');
    res.json({ success: true, message: 'Classroom updated successfully', classroom });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/archive → Admin: toggle classroom archive status (archive ↔ active)
router.put('/:id/archive', async (req, res, next) => {
  try {
    if (req.user.role === 'faculty') {
      return res.status(403).json({ success: false, message: 'Only administrators can archive classrooms.' });
    }
    const existing = await Classroom.findById(req.params.id).select('status');
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }
    const newStatus = existing.status === 'archived' ? 'active' : 'archived';
    const classroom = await Classroom.findByIdAndUpdate(
      req.params.id,
      { $set: { status: newStatus } },
      { new: true }
    ).populate('program batch instructors');
    clearClassroomCache();
    const msg = newStatus === 'archived' ? 'Classroom archived successfully' : 'Classroom restored successfully';
    res.json({ success: true, message: msg, classroom });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id → Admin: delete (archive) classroom
router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role === 'faculty') {
      return res.status(403).json({ success: false, message: 'Only administrators can delete classrooms.' });
    }
    const classroom = await Classroom.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'archived' } },
      { new: true }
    );
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }
    clearClassroomCache();
    res.json({ success: true, message: 'Classroom soft-deleted (archived) successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /:id/students → Admin/Faculty: list all students in classroom
router.get('/:id/students', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id).lean();

    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, false)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    await manualPopulate(classroom, 'students.student', 'fullName email phone avatar role isVerified isActive');
    res.json({ success: true, students: classroom.students });
  } catch (error) {
    next(error);
  }
});

// POST /:id/students/add → Admin/Faculty: add student(s) by studentIds array or by batchId
router.post('/:id/students/add', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { studentIds, batchId } = req.body;
    const classroom = await Classroom.findById(req.params.id);

    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    let usersToAdd = [];

    if (studentIds && Array.isArray(studentIds)) {
      usersToAdd = studentIds;
    } else if (batchId) {
      // Find all approved students assigned to this batch
      const requests = await StudentRequest.find({ batchAssigned: batchId, status: 'approved' });
      usersToAdd = requests.map(r => r.user.toString());
    }

    if (usersToAdd.length === 0) {
      return res.status(400).json({ success: false, message: 'No student IDs or batch ID provided' });
    }

    // Filter out students who are already in the classroom
    const currentStudentIds = classroom.students.map(s => s.student.toString());
    const newStudents = usersToAdd
      .filter(id => !currentStudentIds.includes(id))
      .map(id => ({ student: id, status: 'active', addedAt: new Date() }));

    if (newStudents.length > 0) {
      classroom.students.push(...newStudents);
      await classroom.save();
    }

    res.json({
      success: true,
      message: `Successfully added ${newStudents.length} new students to classroom`,
      classroom
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id/students/:studentId → Admin/Faculty: remove student from classroom
router.delete('/:id/students/:studentId', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    classroom.students = classroom.students.filter(s => s.student.toString() !== req.params.studentId);
    await classroom.save();

    res.json({ success: true, message: 'Student removed from classroom successfully', classroom });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/students/:studentId/status → Admin/Faculty: hold/activate/remove student in classroom
router.put('/:id/students/:studentId/status', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { status } = req.body; // active, removed, held
    if (!['active', 'removed', 'held'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be active, removed, or held.' });
    }

    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const studentRecord = classroom.students.find(s => s.student.toString() === req.params.studentId);
    if (!studentRecord) {
      return res.status(404).json({ success: false, message: 'Student not found in this classroom roster' });
    }

    studentRecord.status = status;
    await classroom.save();

    res.json({ success: true, message: `Student status inside classroom changed to ${status}`, classroom });
  } catch (error) {
    next(error);
  }
});

// POST /:id/announcements → Admin/Faculty: post announcement
router.post('/:id/announcements', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { content, attachments } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Announcement content is required' });
    }

    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const announcement = await ClassroomAnnouncement.create({
      classroom: req.params.id,
      author: req.user._id,
      content,
      attachments: attachments || []
    });

    // Update totalAnnouncements stat
    await Classroom.findByIdAndUpdate(req.params.id, {
      $inc: { 'stats.totalAnnouncements': 1 }
    });

    // Populating author details
    const populated = await ClassroomAnnouncement.findById(announcement._id)
      .populate('author', 'fullName role avatar');

    // Socket notify students in classroom
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      io.to(`classroom:${req.params.id}`).emit('announcement:new', populated);
    } catch (socketErr) {
      console.log('[Socket Error] Could not emit announcement alert:', socketErr.message);
    }

    res.status(201).json({ success: true, message: 'Announcement posted successfully', announcement: populated });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/students/:studentId/certificate → Admin: upload certificate link for a student
router.put('/:id/students/:studentId/certificate', protect, async (req, res, next) => {
  try {
    const { certificateUrl } = req.body;
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const studentRecord = classroom.students.find(s => s.student.toString() === req.params.studentId);
    if (!studentRecord) {
      return res.status(404).json({ success: false, message: 'Student not found in this classroom' });
    }

    studentRecord.certificateUrl = certificateUrl || undefined;
    await classroom.save();

    res.json({ success: true, message: 'Certificate link updated', classroom });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id/announcements/:annoId → Admin/Faculty: delete announcement
router.delete('/:id/announcements/:annoId', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const announcement = await ClassroomAnnouncement.findByIdAndDelete(req.params.annoId);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    // Decrement totalAnnouncements stat
    await Classroom.findByIdAndUpdate(req.params.id, {
      $inc: { 'stats.totalAnnouncements': -1 }
    });

    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /:id/join-requests → Admin: Get pending join requests
router.get('/:id/join-requests', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const requests = await ClassroomJoinRequest.find({ classroom: req.params.id, status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (error) {
    next(error);
  }
});

// POST /:id/join-requests/:requestId/approve → Admin: Approve join request
router.post('/:id/join-requests/:requestId/approve', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const joinReq = await ClassroomJoinRequest.findOne({ _id: req.params.requestId, classroom: req.params.id, status: 'pending' });
    if (!joinReq) {
      return res.status(404).json({ success: false, message: 'Join request not found or already processed.' });
    }

    // Check if user exists
    let user = await User.findOne({ email: joinReq.email.toLowerCase() });

    if (!user) {
      // Check if the phone number is already registered to a different user
      if (joinReq.phone) {
        const existingPhone = await User.findOne({ phone: joinReq.phone.trim() });
        if (existingPhone) {
          return res.status(400).json({ success: false, message: `Phone number ${joinReq.phone} is already registered to another user.` });
        }
      }

      // 1. Generate student user ID: Axon + last 2 year digits + random letters + numbers
      const yearSuffix = String(new Date().getFullYear()).slice(-2);
      const randomLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26), 65 + Math.floor(Math.random() * 26));
      const randomNumbers = String(Math.floor(1000 + Math.random() * 9000));
      const generatedUserId = `Axon${yearSuffix}${randomLetters}${randomNumbers}`;

      user = await User.create({
        fullName: joinReq.fullName,
        email: joinReq.email.toLowerCase(),
        phone: joinReq.phone,
        password: joinReq.rawPassword, // Hook will hash it
        userId: generatedUserId,
        role: 'student',
        isVerified: true,
        isActive: true
      });
    } else {
      // If user already exists, make sure they are verified, active, and update password if provided
      let needsSave = false;
      if (joinReq.rawPassword) {
        user.password = joinReq.rawPassword; // Pre-save hook will hash it
        needsSave = true;
      }
      if (!user.isVerified) {
        user.isVerified = true;
        needsSave = true;
      }
      if (!user.isActive) {
        user.isActive = true;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }

      // Also approve the StudentRequest if it exists
      const studentReq = await StudentRequest.findOne({ user: user._id });
      if (studentReq && studentReq.status !== 'approved') {
        studentReq.status = 'approved';
        if (!studentReq.timeline) studentReq.timeline = [];
        studentReq.timeline.push({
          status: 'approved',
          note: 'Approved via classroom join request',
          changedAt: new Date()
        });
        await studentReq.save();
      }
    }

    const isEnrolled = classroom.students.some(s => s.student.toString() === user._id.toString());

    if (!isEnrolled) {
      classroom.students.push({ student: user._id, status: 'active', addedAt: new Date() });
      await classroom.save();
    }

    joinReq.status = 'approved';
    const rawPass = joinReq.rawPassword;
    joinReq.rawPassword = ''; // Clear it
    await joinReq.save();

    // Send email
    try {
      await sendWelcomeEmail(user, rawPass);
    } catch (e) {
      console.error('Failed to send welcome email:', e);
    }

    res.json({ success: true, message: 'Request approved and student added successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /:id/join-requests/:requestId/reject → Admin: Reject join request
router.post('/:id/join-requests/:requestId/reject', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (!verifyClassroomAccess(classroom, req.user, true)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this classroom' });
    }

    const joinReq = await ClassroomJoinRequest.findOne({ _id: req.params.requestId, classroom: req.params.id, status: 'pending' });
    if (!joinReq) {
      return res.status(404).json({ success: false, message: 'Join request not found or already processed.' });
    }
    joinReq.status = 'rejected';
    joinReq.rawPassword = ''; // Clear it
    await joinReq.save();
    res.json({ success: true, message: 'Request rejected successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
