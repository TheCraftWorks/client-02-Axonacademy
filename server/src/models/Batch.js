const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  program:     { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  batchCode:   { type: String, unique: true }, // e.g. CCN-OCT-2024-A
  startDate:   { type: Date, required: true },
  endDate:     { type: Date },
  schedule: {
    days:      [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
    startTime: String,
    endTime:   String,
    timezone:  { type: String, default: 'Asia/Kolkata' }
  },
  maxSeats:      { type: Number, default: 60 },
  enrolledCount: { type: Number, default: 0 },
  faculty: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FacultyProfile' }],
  status: { type: String, enum: ['upcoming', 'active', 'completed', 'cancelled'], default: 'upcoming' },
  joinLink:      { type: String }, // Zoom/Webex room URL
  zoomMeetingId: { type: String },
  isOnline:      { type: Boolean, default: true }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Batch', batchSchema);
