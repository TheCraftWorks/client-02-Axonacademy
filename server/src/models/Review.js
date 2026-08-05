const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  program:    { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  rating:     { type: Number, min: 1, max: 5, required: true },
  title:      { type: String },
  body:       { type: String },
  isVerified: { type: Boolean, default: false }, // true if student actually enrolled in the course
  isApproved: { type: Boolean, default: false },
  helpfulVotes: { type: Number, default: 0 }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Review', reviewSchema);
