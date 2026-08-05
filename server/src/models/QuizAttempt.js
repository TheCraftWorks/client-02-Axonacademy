const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
  quiz:       { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classroom:  { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  attemptNo:  { type: Number, default: 1 },
  status:     { type: String, enum: ['in_progress','submitted','auto_submitted'], default: 'in_progress' },
  startedAt:  { type: Date, default: Date.now },
  submittedAt:{ type: Date },
  totalTimeTakenSec: { type: Number, default: 0 },
  
  // Student answers
  answers: [{
    questionId:     { type: mongoose.Schema.Types.ObjectId },
    selectedOptions:[String], // ['A'] or ['A','C'] for MSQ
    isCorrect:      Boolean,
    marksAwarded:   Number,
    timeTakenSec:   Number
  }],
  
  // Result
  score: {
    rawMarks:    Number,
    totalMarks:  Number,
    percentage:  Number,
    passed:      Boolean,
    rank:        Number
  },
  
  // Question order for this attempt (randomized snapshot)
  questionOrder: [mongoose.Schema.Types.ObjectId]
}, { timestamps: true });

quizAttemptSchema.index({ quiz: 1, student: 1 });
quizAttemptSchema.index({ classroom: 1, status: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
