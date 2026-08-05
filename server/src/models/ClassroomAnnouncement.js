const mongoose = require('mongoose');

const classroomAnnouncementSchema = new mongoose.Schema({
  classroom:  { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:    { type: String, required: true }, // rich text / markdown
  attachments:[{ name: String, url: String, type: { type: String } }],
  readBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('ClassroomAnnouncement', classroomAnnouncementSchema);
