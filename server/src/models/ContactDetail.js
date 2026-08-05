const mongoose = require('mongoose');

const contactDetailSchema = new mongoose.Schema({
  name:    { type: String, default: 'Axon Med Academy' },
  url:     { type: String, default: 'axonmedacademy' },
  phone:   { type: String, default: '' },
  email:   { type: String, default: '' },
  hours:   { type: String, default: '' },
  address: { type: String, default: '' },
  gst:     { type: String, default: '' },
  timezone:{ type: String, default: 'Asia/Kolkata' },
  about:   { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('ContactDetail', contactDetailSchema);
