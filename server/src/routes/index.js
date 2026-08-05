const express = require('express');
const router = express.Router();

// Import sub-routers
const authRoutes = require('./auth');
const applicationRoutes = require('./applications');
const programRoutes = require('./programs');
const batchRoutes = require('./batches');
const enrollmentRoutes = require('./enrollments');
const lessonRoutes = require('./lessons');
const sessionRoutes = require('./sessions');
const libraryFolderRoutes = require('./libraryFolders');
const recordingRoutes = require('./recordings');
const examRoutes = require('./exams');
const attendanceRoutes = require('./attendance');
const paymentRoutes = require('./payments');
const certificateRoutes = require('./certificates');
const notificationRoutes = require('./notifications');
const adminRoutes = require('./admin');
const instructorRoutes = require('./instructor');
const publicRoutes = require('./public');

// Priority features sub-routers
const classroomRoutes = require('./classrooms');
const classesRoutes = require('./classes');
const meetingRoutes = require('./meetings');
const studentRequestRoutes = require('./requests');
const quizRoutes = require('./quizzes');
const classroomRecordingRoutes = require('./classroomRecordings');
const messageRoutes = require('./messageRoutes');
const livekitRoutes = require('./livekitRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/applications', applicationRoutes);
router.use('/programs', programRoutes);
router.use('/batches', batchRoutes);
router.use('/enrollments', enrollmentRoutes);
router.use('/lessons', lessonRoutes);
router.use('/sessions', sessionRoutes);
router.use('/library-folders', libraryFolderRoutes);
router.use('/recordings', recordingRoutes);
router.use('/exams', examRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/payments', paymentRoutes);
router.use('/certificates', certificateRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/instructor', instructorRoutes);
router.use('/public', publicRoutes);

// Priority features mounted routes
router.use('/classrooms', classroomRoutes);
router.use('/classes', classesRoutes);
router.use('/meetings', meetingRoutes);
router.use('/requests', studentRequestRoutes);
router.use('/quizzes', quizRoutes);
router.use('/recordings/classroom', classroomRecordingRoutes);
router.use('/messages', messageRoutes);
router.use('/livekit', livekitRoutes);

module.exports = router;

