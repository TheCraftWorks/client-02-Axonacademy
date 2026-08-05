const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const StudentProfile = require('../models/StudentProfile');
const { protect, restrictTo } = require('../middleware/auth');
const mongoose = require('mongoose');

// GET /classes/:classId/students -> Admin/Faculty: list students of a classroom
router.get('/:classId/students', protect, restrictTo('admin','faculty'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.classId)) {
      return res.status(400).json({ success: false, message: 'Invalid class ID format' });
    }

    const classroom = await Classroom.findById(req.params.classId).lean();
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    const studentIds = classroom.students.map(s => s.student.toString());
    
    // Fetch users details
    const users = await User.find({ _id: { $in: studentIds } }).lean();
    
    // Fetch student profiles to get enrollment numbers
    const profiles = await StudentProfile.find({ user: { $in: studentIds } }).lean();

    const userMap = users.reduce((acc, u) => {
      acc[u._id.toString()] = u;
      return acc;
    }, {});

    const profileMap = profiles.reduce((acc, p) => {
      acc[p.user.toString()] = p;
      return acc;
    }, {});

    const students = classroom.students.map(cs => {
      const studentId = cs.student.toString();
      const u = userMap[studentId] || {};
      const p = profileMap[studentId] || {};
      return {
        studentId,
        rollNumber: p.enrollmentNo || 'N/A',
        name: u.fullName || u.email || 'Unknown',
        email: u.email || '',
        phone: u.phone || '',
        status: cs.status || 'active'
      };
    });

    res.json({ success: true, students });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
