const mongoose = require('mongoose');

const liveMeetingSchema = new mongoose.Schema({
  classroom:    { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  title:        { type: String, required: true },
  description:  { type: String },
  scheduledAt:  { type: Date, required: true },
  duration:     { type: Number, default: 60 }, // minutes
  status:       { type: String, enum: ['scheduled','waiting','live','ended','cancelled'], default: 'scheduled' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Meeting room
  roomId:       { type: String, unique: true }, // UUID
  meetingLink:  { type: String }, // internal /portal/live/:roomId
  joinPassword: { type: String }, // optional 6-digit PIN
  
  // Jitsi / WebRTC config
  jitsiRoom:    { type: String }, // jitsi room name

  // Webex config
  webexMeetingId: { type: String },
  webexLink:      { type: String },
  webexPassword:  { type: String },
  
  // Notifications sent?
  notified: {
    whatsapp: { type: Boolean, default: false },
    portal:   { type: Boolean, default: false },
    sentAt:   { type: Date }
  },
  
  // Waiting room
  waitingRoom:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Recording (auto or manual)
  recording: {
    muxAssetId:    String,
    muxPlaybackId: String,
    savedToClassroom: { type: Boolean, default: false }
  },
  
  // Attendance
  attendees: [{
    student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    joinedAt:  Date,
    leftAt:    Date,
    duration:  Number // minutes
  }],
  
  // Admin can start from Today's Classes panel
  startedAt:  { type: Date },
  endedAt:    { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('LiveMeeting', liveMeetingSchema);
