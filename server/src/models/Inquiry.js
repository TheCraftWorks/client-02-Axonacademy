const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true },
  phone:    { type: String, default: '' },
  interest: { type: String, default: '' },
  message:  { type: String, default: '' },
  resolved: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Inquiry', inquirySchema);
