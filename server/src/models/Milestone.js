const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  year:        { type: String, required: true },
  title:       { type: String, required: true },
  description: { type: String, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Milestone', milestoneSchema);
