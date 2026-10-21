const mongoose = require('mongoose');

const classroomDocFolderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

classroomDocFolderSchema.index({ classroom: 1, order: 1 });

module.exports = mongoose.model('ClassroomDocFolder', classroomDocFolderSchema);
