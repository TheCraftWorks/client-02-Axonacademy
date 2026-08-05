const express = require('express');
const router = express.Router();
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const ClassroomRecording = require('../models/ClassroomRecording');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const LiveMeeting = require('../models/LiveMeeting');
const Classroom = require('../models/Classroom');
const { protect } = require('../middleware/auth');

// POST / → Student: enroll in a program+batch (after payment)
router.post('/', (req, res) => {
  res.json({ success: true, message: 'Student enrolled (placeholder)' });
});

// GET /my → Student: get all own enrollments with progress
router.get('/my', protect, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate('program', 'title description image')
      .populate('batch', 'batchCode startDate');
    res.json({ success: true, enrollments });
  } catch (error) {
    next(error);
  }
});

// GET /:id → Get enrollment details + progress
router.get('/:id', protect, async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({ _id: req.params.id, student: req.user._id })
      .populate('program')
      .populate('batch');
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }
    res.json({ success: true, enrollment });
  } catch (error) {
    next(error);
  }
});

// GET /classroom/:classroomId/progress → Student: detailed progress for a specific classroom
router.get('/classroom/:classroomId/progress', protect, async (req, res, next) => {
  try {
    const { classroomId } = req.params;
    const studentId = req.user._id;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    // 1. Live Class Attendance
    const totalSessions = await LiveMeeting.countDocuments({ 
      classroom: classroomId,
      status: 'ended'
    });

    const attendedSessions = await LiveMeeting.countDocuments({
      classroom: classroomId,
      status: 'ended',
      'attendees.student': studentId
    });

    // 2. Recorded Video Watching
    const recordings = await ClassroomRecording.find({ classroom: classroomId, isPublished: true });
    const totalRecordings = recordings.length;
    let completedRecordings = 0;
    let totalWatchedSec = 0;
    let totalDurationSec = 0;

    recordings.forEach(rec => {
      totalDurationSec += rec.duration || 0;
      const stats = rec.viewStats.find(v => v.student.toString() === studentId.toString());
      if (stats) {
        totalWatchedSec += stats.totalWatchedSec || 0;
        if (stats.completedAt || (rec.duration > 0 && stats.totalWatchedSec >= rec.duration * 0.9)) {
          completedRecordings++;
        }
      }
    });

    // 3. Quiz Performance
    const quizzes = await Quiz.find({ classroom: classroomId, status: { $in: ['published', 'closed'] } });
    const totalQuizzes = quizzes.length;
    
    const attempts = await QuizAttempt.find({ 
      classroom: classroomId, 
      student: studentId,
      status: 'submitted'
    });

    const completedQuizzes = new Set(attempts.map(a => a.quiz.toString())).size;
    
    let totalScore = 0;
    attempts.forEach(a => {
      totalScore += a.score.percentage || 0;
    });
    const avgQuizScore = attempts.length > 0 ? totalScore / attempts.length : 0;

    // Aggregated Stats
    const stats = {
      attendance: {
        total: totalSessions,
        attended: attendedSessions,
        percentage: totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0
      },
      videos: {
        total: totalRecordings,
        completed: completedRecordings,
        percentage: totalRecordings > 0 ? Math.round((completedRecordings / totalRecordings) * 100) : 0,
        watchedSec: totalWatchedSec,
        totalSec: totalDurationSec
      },
      quizzes: {
        total: totalQuizzes,
        completed: completedQuizzes,
        percentage: totalQuizzes > 0 ? Math.round((completedQuizzes / totalQuizzes) * 100) : 0,
        avgScore: Math.round(avgQuizScore)
      },
      overallProgress: 0
    };

    // Weighted overall progress
    stats.overallProgress = Math.round(
      (stats.attendance.percentage * 0.3) + 
      (stats.videos.percentage * 0.4) + 
      (stats.quizzes.percentage * 0.3)
    );

    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
});

// PUT /:id/progress → Update lesson progress
router.put('/:id/progress', (req, res) => {
  res.json({ success: true, message: 'Progress updated (placeholder)' });
});

// GET /admin/all → Admin: all enrollments (paginated)
router.get('/admin/all', protect, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find()
      .populate('student', 'fullName email')
      .populate('program', 'title')
      .populate('batch', 'batchCode')
      .sort({ createdAt: -1 });
    res.json({ success: true, enrollments });
  } catch (error) {
    next(error);
  }
});

// PUT /admin/:id/status → Admin: change enrollment status
router.put('/admin/:id/status', (req, res) => {
  res.json({ success: true, message: 'Enrollment status updated (placeholder)' });
});

// DELETE /:id → Admin: drop enrollment
router.delete('/:id', (req, res) => {
  res.json({ success: true, message: 'Enrollment dropped (placeholder)' });
});

module.exports = router;
