const mongoose = require('mongoose');

const classroomAnnouncementSchema = new mongoose.Schema({
  classroom:  { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:    { type: String, required: true }, // rich text / markdown
  folder:     { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomDocFolder', default: null },
  attachments:[{ name: String, url: String, type: { type: String }, cloudflareKey: String }],
  readBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

classroomAnnouncementSchema.index({ classroom: 1, createdAt: -1 });
classroomAnnouncementSchema.index({ classroom: 1, folder: 1 });

module.exports = mongoose.model('ClassroomAnnouncement', classroomAnnouncementSchema);
