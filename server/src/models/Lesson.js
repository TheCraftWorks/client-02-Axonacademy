const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  program:     { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  moduleNo:    { type: Number, required: true },
  lessonNo:    { type: Number, required: true },
  title:       { type: String, required: true },
  description: { type: String },
  type:        { type: String, enum: ['video', 'live', 'quiz', 'document', 'assignment'], required: true },
  durationMinutes: { type: Number },
  video: {
    muxAssetId:    String,
    muxPlaybackId: String,
    thumbnail:     String,
    quality:       { type: String, default: 'HD 1080p' }
  },
  transcript:  [{ timestamp: String, text: String }],
  resources:   [{ title: String, type: String, url: String, fileSize: Number }],
  cmeCredits:  { type: Number, default: 0 },
  isFree:      { type: Boolean, default: false },
  isPublished: { type: Boolean, default: true },
  order:       { type: Number }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Lesson', lessonSchema);
