const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  examId:      { type: String, unique: true }, // e.g. 2024-MED-042
  program:     { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  batch:       { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type:        { type: String, enum: ['proctored', 'mock', 'quiz', 'assignment'], required: true },
  securityLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'high' },
  instructions:  { type: String },
  scheduledAt:   { type: Date },
  duration:      { type: Number, required: true }, // in seconds
  totalMarks:    { type: Number },
  passingMarks:  { type: Number },
  questions:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  totalQuestions:{ type: Number },
  randomizeQ:    { type: Boolean, default: true },
  randomizeOpts: { type: Boolean, default: true },
  proctoring: {
    aiEyeTracking:      { type: Boolean, default: true },
    lockdownBrowser:    { type: Boolean, default: true },
    audioRecording:     { type: Boolean, default: false },
    tabSwitchDetect:    { type: Boolean, default: true },
    clipboardBlocking:  { type: Boolean, default: true },
    faceSensitivity:    { type: Number, default: 75 }, // %
    snapshotFrequency:  { type: Number, default: 60 }, // seconds
    maxTabSwitches:     { type: Number, default: 3 },
    biometricVerify:    { type: Boolean, default: true }
  },
  isPublished:   { type: Boolean, default: false },
  resultsReleased:{ type: Boolean, default: false }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Exam', examSchema);
