const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text:       { type: String, required: true },
  type:       { type: String, enum: ['mcq', 'msq', 'true_false', 'fill_blank', 'short_answer'], default: 'mcq' },
  options: [{
    label:     { type: String, enum: ['A', 'B', 'C', 'D', 'E'] },
    text:      String,
    isCorrect: Boolean
  }],
  correctAnswer:  String, // used for fill_blank or short_answer reference
  explanation:    String,
  marks:          { type: Number, default: 1 },
  negativeMark:   { type: Number, default: 0 },
  difficulty:     { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  topic:          String,
  subject:        String,
  program:        { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  estimatedTime:  { type: Number, default: 2 }, // in minutes
  tags:           [String],
  usageCount:     { type: Number, default: 0 }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Question', questionSchema);
