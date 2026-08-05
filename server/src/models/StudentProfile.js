const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  enrollmentNo:  { type: String, unique: true }, // e.g.-2024-0001
  program:       { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  batch:         { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  dob:           { type: Date },
  gender:        { type: String, enum: ['male', 'female', 'other'] },
  bloodGroup:    { type: String },
  address: {
    street: String, 
    city: String, 
    state: String, 
    pincode: String, 
    country: { type: String, default: 'India' }
  },
  qualification: { type: String }, // highest academic degree
  workExperience: { type: Number, default: 0 }, // in months
  emergencyContact: {
    name: String, 
    relation: String, 
    phone: String
  },
  documents: [{
    type:  { type: String, enum: ['aadhar', 'marksheet', 'passport_photo', 'id_proof', 'medical_cert'] },
    url:   String,
    verified: { type: Boolean, default: false }
  }],
  idCardGenerated: { type: Boolean, default: false },
  idCardUrl:       { type: String },
  joinedAt:        { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed', 'dropped', 'suspended'],
    default: 'active'
  },
  learningStats: {
    totalHoursLearned:   { type: Number, default: 0 },
    coursesCompleted:    { type: Number, default: 0 },
    currentStreak:       { type: Number, default: 0 },
    longestStreak:       { type: Number, default: 0 },
    lastActiveDate:      { type: Date }
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
