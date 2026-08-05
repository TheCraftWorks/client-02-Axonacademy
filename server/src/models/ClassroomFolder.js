const mongoose = require('mongoose');

const classroomFolderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

classroomFolderSchema.index({ classroom: 1, order: 1 });

module.exports = mongoose.model('ClassroomFolder', classroomFolderSchema);
