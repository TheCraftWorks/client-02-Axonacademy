const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  program:   { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  batch:     { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  status:    { type: String, enum: ['pending', 'active', 'completed', 'dropped'], default: 'pending' },
  enrolledAt:{ type: Date, default: Date.now },
  completedAt:{ type: Date },
  progress: {
    overallPercent:  { type: Number, default: 0 },
    modulesProgress: [{
      moduleNo:        Number,
      lessonsCompleted: Number,
      totalLessons:    Number,
      percentComplete: Number
    }]
  },
  attendance: {
    present: { type: Number, default: 0 },
    absent:  { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }
  },
  certificateIssued:  { type: Boolean, default: false },
  certificateUrl:     { type: String },
  certificateIssuedAt:{ type: Date }
}, { 
  timestamps: true 
});

// Enforce unique enrollment per student per program
enrollmentSchema.index({ student: 1, program: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
