const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Attendance = require('../models/Attendance');
const Classroom = require('../models/Classroom');
const { protect, restrictTo } = require('../middleware/auth');

// GET /my -> Student: own attendance records
router.get('/my', protect, async (req, res, next) => {
  try {
    const attendance = await Attendance.find({ student: req.user._id })
      .populate('meeting', 'title scheduledAt duration status roomId')
      .populate('classroom', 'name code')
      .sort({ date: -1 });
    res.json({ success: true, attendance });
  } catch (error) {
    next(error);
  }
});

// GET /meeting/:meetingId -> Admin/Faculty: attendance for a live meeting
router.get('/meeting/:meetingId', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const attendanceList = await Attendance.find({ meeting: req.params.meetingId })
      .populate('student', 'fullName email phone avatar')
      .sort({ joinedAt: 1 });
    res.json({ success: true, attendanceList });
  } catch (error) {
    next(error);
  }
});

// POST /mark -> Auto-mark on join/heartbeat
router.post('/mark', protect, async (req, res, next) => {
  try {
    const { meeting, classroom, status = 'present', joinedAt, leftAt, duration } = req.body;
    if (!meeting) {
      return res.status(400).json({ success: false, message: 'meeting is required' });
    }

    const attendance = await Attendance.findOneAndUpdate(
      { meeting, student: req.user._id },
      {
        $set: {
          classroom,
          date: joinedAt || new Date(),
          status,
          markedBy: 'auto',
          joinedAt,
          leftAt,
          duration,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: 'Attendance marked automatically', attendance });
  } catch (error) {
    next(error);
  }
});

// POST /manual -> Admin/Faculty: manual mark/update
router.post('/manual', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { meeting, classroom, student, status, joinedAt, leftAt, duration } = req.body;
    if (!meeting || !student || !status) {
      return res.status(400).json({ success: false, message: 'meeting, student and status are required' });
    }

    const attendance = await Attendance.findOneAndUpdate(
      { meeting, student },
      {
        $set: {
          classroom,
          date: joinedAt || new Date(),
          status,
          markedBy: 'manual',
          joinedAt,
          leftAt,
          duration,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: 'Attendance marked manually', attendance });
  } catch (error) {
    next(error);
  }
});

// PUT /:id -> Admin/Faculty: update attendance record
router.put('/:id', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const attendance = await Attendance.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }
    res.json({ success: true, message: 'Attendance record updated', attendance });
  } catch (error) {
    next(error);
  }
});

// GET /report/:classroomId -> Admin/Faculty: full attendance report for classroom
router.get('/report/:classroomId', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const report = await Attendance.find({ classroom: req.params.classroomId })
      .populate('student', 'fullName email phone')
      .populate('meeting', 'title scheduledAt duration status')
      .sort({ date: -1 });
    res.json({ success: true, report });
  } catch (error) {
    next(error);
  }
});

// GET /class/:classId -> Admin/Faculty: get attendance records for classroom
router.get('/class/:classId', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { date, subject, meetingId } = req.query;
    const query = { classroom: req.params.classId };
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }
    
    if (subject) {
      query.subject = subject;
    }

    if (meetingId && meetingId !== 'null' && meetingId !== 'undefined') {
      query.meeting = meetingId;
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'fullName email phone')
      .populate('meeting', 'title scheduledAt')
      .sort({ date: -1 });
      
    res.json({ success: true, attendance });
  } catch (error) {
    next(error);
  }
});

// POST / -> Admin/Faculty: save or update attendance (prevent duplicates)
router.post('/', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    const { classId, date, subject, meetingId, records } = req.body;
    
    if (!classId || !date || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'classId, date and records array are required' });
    }

    const classroom = await Classroom.findById(classId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    const classroomStudentIds = classroom.students.map(s => s.student.toString());

    // Normalize date to UTC midnight to avoid timezone offsets and make comparison stable
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const startOfDay = new Date(normalizedDate);
    const endOfDay = new Date(normalizedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const savedRecords = [];

    for (const record of records) {
      const { studentId, status } = record;
      if (!studentId || !status) continue;

      // Validate student belongs to classroom
      if (!classroomStudentIds.includes(studentId)) {
        return res.status(400).json({
          success: false,
          message: `Student ${studentId} is not enrolled in classroom ${classId}`
        });
      }

      // Check for duplicate date + subject + student + meeting
      const findQuery = {
        classroom: classId,
        student: studentId,
        date: { $gte: startOfDay, $lte: endOfDay }
      };

      if (meetingId) {
        findQuery.meeting = meetingId;
      } else if (subject) {
        findQuery.subject = subject;
      }

      let attendance = await Attendance.findOne(findQuery);

      if (attendance) {
        attendance.status = status.toLowerCase();
        attendance.markedBy = 'manual';
        if (meetingId) attendance.meeting = meetingId;
        if (subject) attendance.subject = subject;
        await attendance.save();
      } else {
        attendance = await Attendance.create({
          classroom: classId,
          student: studentId,
          subject,
          meeting: meetingId,
          date: normalizedDate,
          status: status.toLowerCase(),
          markedBy: 'manual'
        });
      }
      savedRecords.push(attendance);
    }

    res.json({ success: true, message: 'Attendance records saved successfully', records: savedRecords });
  } catch (error) {
    next(error);
  }
});

// GET /student/:studentId -> Admin/Student: get student attendance details & stats
router.get('/student/:studentId', protect, async (req, res, next) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.params.studentId);
    
    // Authorization check: student can only view their own attendance
    if (req.user.role === 'student' && req.user._id.toString() !== req.params.studentId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // 1. Overall stats
    const overallStats = await Attendance.aggregate([
      { $match: { student: studentId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $in: ["$status", ["leave", "excused"]] }, 1, 0] } }
        }
      }
    ]);

    // 2. Monthly stats
    const monthlyStats = await Attendance.aggregate([
      { $match: { student: studentId } },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } }
    ]);

    // 3. Subject-wise stats
    const subjectStats = await Attendance.aggregate([
      { $match: { student: studentId } },
      {
        $group: {
          _id: "$subject",
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 4. Timeline
    const timeline = await Attendance.find({ student: studentId })
      .populate('classroom', 'name code')
      .sort({ date: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      overall: overallStats[0] || { total: 0, present: 0, late: 0, absent: 0, leave: 0 },
      monthly: monthlyStats.map(m => ({
        year: m._id.year,
        month: m._id.month,
        total: m.total,
        present: m.present,
        late: m.late,
        percentage: m.total > 0 ? Math.round(((m.present + m.late) / m.total) * 100) : 0
      })),
      subjectWise: subjectStats.map(s => ({
        subject: s._id || 'General',
        total: s.total,
        present: s.present,
        late: s.late,
        percentage: s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0
      })),
      timeline
    });
  } catch (error) {
    next(error);
  }
});

// GET /report/class/:classId -> Admin/Faculty: aggregated history for classroom
router.get('/report/class/:classId', protect, restrictTo('admin', 'superadmin', 'faculty'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.classId)) {
      return res.status(400).json({ success: false, message: 'Invalid class ID format' });
    }

    const report = await Attendance.aggregate([
      { $match: { classroom: new mongoose.Types.ObjectId(req.params.classId) } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
            subject: "$subject",
            meeting: "$meeting"
          },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          lateCount: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $in: ["$status", ["leave", "excused"]] }, 1, 0] } },
          totalCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'livemeetings',
          localField: '_id.meeting',
          foreignField: '_id',
          as: 'meetingInfo'
        }
      },
      {
        $unwind: {
          path: '$meetingInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id.date",
          subject: "$_id.subject",
          meetingId: "$_id.meeting",
          meetingTitle: "$meetingInfo.title",
          presentCount: 1,
          absentCount: 1,
          lateCount: 1,
          leaveCount: 1,
          totalCount: 1,
          attendancePercentage: {
            $cond: [
              { $gt: ["$totalCount", 0] },
              { $round: [{ $multiply: [{ $divide: ["$presentCount", "$totalCount"] }, 100] }, 2] },
              0
            ]
          }
        }
      },
      { $sort: { date: -1, subject: 1 } }
    ]);

    res.json({ success: true, report });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
