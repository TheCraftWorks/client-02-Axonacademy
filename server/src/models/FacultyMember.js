const mongoose = require('mongoose');

const facultyMemberSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  role:      { type: String, required: true },
  specialty: { type: String, required: true },
  years:     { type: Number, required: true },
  rating:    { type: Number, default: 5.0 },
  image:     { type: String },
  imagePublicId: { type: String },
  initials:  { type: String, uppercase: true, maxLength: 2 }
}, {
  timestamps: true
});

module.exports = mongoose.model('FacultyMember', facultyMemberSchema);
