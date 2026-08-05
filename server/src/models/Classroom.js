const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  description:  { type: String },
  thumbnail:    { type: String }, // S3 URL
  code:         { type: String, unique: true }, // e.g. CCN-2024-A
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  program:      { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  batch:        { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  students: [{
    student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt:    { type: Date, default: Date.now },
    status:     { type: String, enum: ['active','removed','held'], default: 'active' },
    certificateUrl: { type: String }
  }],
  instructors:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status:       { type: String, enum: ['active','archived','draft'], default: 'active' },
  maxStudents:  { type: Number, default: 100 },
  waitlist:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  settings: {
    allowQuizLeaderboard: { type: Boolean, default: false },
    allowStudentChat:     { type: Boolean, default: true },
    notifyOnUpload:       { type: Boolean, default: true }
  },
  certificateUrl: { type: String },
  stats: {
    totalLiveSessions:   { type: Number, default: 0 },
    totalRecordings:     { type: Number, default: 0 },
    totalQuizzes:        { type: Number, default: 0 },
    totalAnnouncements:  { type: Number, default: 0 }
  }
}, { timestamps: true });

classroomSchema.index({ code: 1, program: 1, status: 1 });
classroomSchema.index({ 'students.student': 1, status: 1 });

module.exports = mongoose.model('Classroom', classroomSchema);
