const mongoose = require('mongoose');

const classroomJoinRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  rawPassword: { type: String, required: false }, // Stored temporarily to send in welcome email
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('ClassroomJoinRequest', classroomJoinRequestSchema);
