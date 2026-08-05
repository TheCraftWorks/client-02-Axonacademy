const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:       { type: String, enum: ['proctor_flag', 'live_session', 'recording', 'exam_result', 'system', 'announcement', 'class_reschedule', 'deadline', 'course_unlock'], required: true },
  title:      { type: String, required: true },
  message:    { type: String, required: true },
  priority:   { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  read:       { type: Boolean, default: false },
  readAt:     { type: Date },
  actionUrl:  { type: String },
  metadata:   { type: mongoose.Schema.Types.Mixed },
  isAuditItem:{ type: Boolean, default: false } // secure audit ledger flag
}, { 
  timestamps: true 
});

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
