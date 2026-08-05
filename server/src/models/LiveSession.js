const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  program:     { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  batch:       { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  instructor:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scheduledAt: { type: Date, required: true },
  duration:    { type: Number }, // in minutes
  status:      { type: String, enum: ['scheduled', 'live', 'ended', 'cancelled'], default: 'scheduled' },
  isProctored: { type: Boolean, default: true },
  roomId:      { type: String, unique: true }, // socket.io room key
  jitsiRoom:   { type: String },
  recording: {
    muxAssetId:    String,
    muxPlaybackId: String,
    url:           String,
    processedAt:   Date
  },
  sessionMarkers: [{
    timestamp: String, // "00:05"
    label:     String,
    type:      { type: String, enum: ['chapter', 'highlight'] }
  }],
  maxParticipants: { type: Number, default: 100 },
  enrolledCount:   { type: Number, default: 0 },
  attendees: [{
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt: Date,
    leftAt:   Date,
    duration: Number // in seconds
  }],
  metadata: {
    sessionTitle:   String,
    tags:           [String],
    targetCourse:   String,
    accessLevel:    { type: String, enum: ['enrolled_only', 'all_students', 'public'], default: 'enrolled_only' }
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('LiveSession', liveSessionSchema);
