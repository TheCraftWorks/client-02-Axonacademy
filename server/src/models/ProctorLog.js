const mongoose = require('mongoose');

const proctorLogSchema = new mongoose.Schema({
  examSession: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSession', required: true },
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam:        { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  type:        { type: String, enum: ['tab_switch', 'face_missing', 'multiple_people', 'background_noise', 'camera_obstruction', 'system_error', 'exam_started', 'exam_submitted'], required: true },
  severity:    { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  description: String,
  snapshot:    String, // S3 URL link
  aiGenerated: { type: Boolean, default: true },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolution:  { type: String, enum: ['approved', 'warning_issued', 'invalidated', null], default: null },
  resolvedAt:  Date
}, { 
  timestamps: true 
});

module.exports = mongoose.model('ProctorLog', proctorLogSchema);
