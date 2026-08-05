const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  classroom:    { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  title:        { type: String, required: true },
  instructions: { type: String },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Schedule
  availableFrom:  { type: Date },
  availableUntil: { type: Date },
  
  // Settings
  duration:          { type: Number }, // minutes (null = no timer)
  maxAttempts:       { type: Number, default: 1 },
  randomizeQuestions:{ type: Boolean, default: true },
  randomizeOptions:  { type: Boolean, default: true },
  showLeaderboard:   { type: Boolean, default: false },
  negativeMarking:   { type: Boolean, default: false },
  negativeMarkValue: { type: Number, default: 0.25 },
  passPercent:       { type: Number, default: 40 },
  
  // Questions (embedded for performance)
  questions: [{
    _id:        { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    type:       { type: String, enum: ['mcq','msq','true_false'], default: 'mcq' },
    text:       { type: String, required: true },
    image:      { type: String }, // optional image URL
    marks:      { type: Number, default: 1 },
    options: [{
      label:     String, // A, B, C, D, E
      text:      String,
      isCorrect: Boolean
    }],
    explanation: String, // shown after submit
    order:       Number
  }],
  
  totalMarks:    { type: Number }, // auto-calculated
  totalQuestions:{ type: Number },
  
  // State
  status:  { type: String, enum: ['draft','published','closed'], default: 'draft' },
  
  // Notification
  notified: { type: Boolean, default: false },
  notifiedAt:{ type: Date }
}, { timestamps: true });

// Auto-calculate totals
quizSchema.pre('save', function(next) {
  this.totalQuestions = this.questions.length;
  this.totalMarks = this.questions.reduce((sum, q) => sum + q.marks, 0);
  next();
});

quizSchema.index({ classroom: 1, status: 1 });

module.exports = mongoose.model('Quiz', quizSchema);
