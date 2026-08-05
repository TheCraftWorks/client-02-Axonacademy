const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
  exam:     { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  student:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId:{ type: String, unique: true }, // EXAM-2024-84930-SM
  status:   { type: String, enum: ['lobby', 'active', 'submitted', 'auto_submitted', 'flagged', 'invalidated'], default: 'lobby' },
  startedAt:{ type: Date },
  submittedAt: { type: Date },
  ipAddress: String,
  userAgent: String,
  deviceFingerprint: String,
  answers: [{
    question:      { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    selectedOption: String,
    textAnswer:    String,
    isCorrect:     Boolean,
    marksAwarded:  Number,
    timeTaken:     Number, // in seconds
    flaggedForReview: { type: Boolean, default: false }
  }],
  score: {
    raw:      Number,
    outOf:    Number,
    percent:  Number,
    grade:    String,
    passed:   Boolean,
    rank:     Number,
    percentile: Number
  },
  proctoring: {
    identityVerified:    { type: Boolean, default: false },
    identityPhoto:       String, // Image S3 URL
    webcamActive:        { type: Boolean, default: false },
    micActive:           { type: Boolean, default: false },
    connectionStable:    { type: Boolean, default: false },
    privacyScore:        { type: Number, default: 0 },
    snapshots:           [{ url: String, takenAt: Date, flagged: Boolean }],
    incidents: [{
      type:      { type: String, enum: ['tab_switch', 'face_missing', 'multiple_people', 'background_noise', 'camera_obstruction', 'system_error'] },
      severity:  { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      detectedAt:Date,
      description:String,
      aiGenerated:{ type: Boolean, default: true },
      reviewed:  { type: Boolean, default: false },
      resolution:{ type: String, enum: ['approved', 'invalidated', 'warning_issued', null], default: null }
    }],
    totalDeviation: Number // deviation metric in seconds
  },
  encryptionActive: { type: Boolean, default: true },
  systemStability: Number // percentage metric
}, { 
  timestamps: true 
});

examSessionSchema.index({ exam: 1, student: 1 });

module.exports = mongoose.model('ExamSession', examSessionSchema);
