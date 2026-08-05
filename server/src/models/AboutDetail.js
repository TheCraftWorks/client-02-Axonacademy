const mongoose = require('mongoose');

const aboutDetailSchema = new mongoose.Schema({
  mission: { type: String, required: true },
  vision:  { type: String, required: true },
  values:  { type: String, required: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('AboutDetail', aboutDetailSchema);
