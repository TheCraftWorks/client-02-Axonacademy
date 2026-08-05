const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');

const protect = async (req, res, next) => {
  try {
    let token = null;

    // Check authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check query parameters (useful for video streaming where headers cannot be set easily)
    else if (req.query && req.query.token) {
      token = req.query.token;
    }
    // Check cookies
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // Development override: allow frontend local login to identify the user without JWT
    const devUserEmail = !token && process.env.NODE_ENV !== 'production'
      ? req.headers['x-dev-user-email']
      : null;
    const devUserRole = !token && process.env.NODE_ENV !== 'production'
      ? req.headers['x-dev-user-role']
      : null;
    const devUserName = !token && process.env.NODE_ENV !== 'production'
      ? req.headers['x-dev-user-name']
      : null;

    // No token provided, try persistent session cookie
    if (!token) {
      const sessionToken = req.cookies.session;
      if (sessionToken) {
        // Find a valid session that matches the token hash directly
        const tokenHash = Session.hashToken(sessionToken);
        const sess = await Session.findOne({
          tokenHash,
          expiresAt: { $gt: new Date() }
        }).populate('user');
        if (sess && sess.user) {
          req.user = sess.user;
          return next();
        }
      }
      // If dev override also not present, return unauthenticated
      if (devUserEmail) {
        let currentUser = await User.findOne({ email: devUserEmail });
        if (!currentUser) {
          const fullName = String(devUserName || devUserEmail).trim();
          currentUser = await User.create({
            fullName: fullName || 'Dev User',
            email: devUserEmail,
            role: devUserRole || 'student',
            password: crypto.randomBytes(12).toString('hex'),
            isVerified: true,
            isActive: true
          });
        } else if (devUserRole && ['student', 'faculty', 'admin', 'accounts', 'receptionist', 'superadmin'].includes(devUserRole)) {
          currentUser.role = devUserRole;
          currentUser.isVerified = true;
          currentUser.isActive = true;
          await currentUser.save();
        }
        req.user = currentUser;
        return next();
      }
      return res.status(401).json({
        success: false,
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'local_access_secret_for_development_purposes_only_12345');
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.'
      });
    }

    // Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    next(error);
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.'
      });
    }
    next();
  };
};

const verifyClassroomAccess = (classroom, user, writeRequired = false) => {
  if (!user || !user._id) return false;
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  if (isAdmin) return true;

  const isFaculty = user.role === 'faculty';
  if (isFaculty) {
    const instructors = classroom.instructors || [];
    return instructors.some(ins => {
      if (!ins) return false;
      const insId = ins._id ? ins._id.toString() : ins.toString();
      return insId === user._id.toString();
    });
  }

  if (writeRequired) return false;

  const students = classroom.students || [];
  const inRoster = students.some(s => {
    if (!s) return false;
    const sStudent = s.student;
    if (!sStudent) return false;
    const studentId = typeof sStudent === 'object'
      ? (sStudent._id ? sStudent._id.toString() : String(sStudent))
      : String(sStudent);
    const isMatch = studentId === user._id.toString();
    const isActive = !s.status || s.status === 'active' || s.status === 'enrolled';
    return isMatch && isActive;
  });

  if (inRoster) return true;

  // Allow active & verified student accounts read-access to classroom
  if (user.role === 'student' && user.isVerified !== false && user.isActive !== false) {
    return true;
  }

  return false;
};

module.exports = {
  protect,
  restrictTo,
  verifyClassroomAccess
};

