const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  body:       { type: String, required: true },
  type:       { type: String, enum: ['general', 'exam', 'class', 'system', 'emergency'], default: 'general' },
  audience:   { type: String, enum: ['all', 'students', 'faculty', 'admin'], default: 'all' },
  programs:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }], // target filter
  batches:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }], // target filter
  isPublished:{ type: Boolean, default: true },
  publishedAt:{ type: Date, default: Date.now },
  expiresAt:  { type: Date },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Announcement', announcementSchema);
