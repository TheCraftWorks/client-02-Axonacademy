const mongoose = require('mongoose');

const facultyProfileSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  designation:  { type: String }, // e.g. "Program Director", "Lead Instructor"
  specialization: [String],
  bio:          { type: String },
  photo:        { type: String }, // Image S3 URL
  qualifications: [{ degree: String, institution: String, year: Number }],
  experience:   { type: Number }, // in years
  programs:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
  rating: {
    average: { type: Number, default: 0 },
    count:   { type: Number, default: 0 }
  },
  isVerified:   { type: Boolean, default: false },
  joinedAt:     { type: Date, default: Date.now }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('FacultyProfile', facultyProfileSchema);
