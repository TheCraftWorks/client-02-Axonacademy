const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicant:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  program:      { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  applicationNo:{ type: String, unique: true }, // e.g. APP-2024-00123
  status:       { type: String, enum: ['draft', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted'], default: 'draft' },
  step:         { type: Number, default: 1 }, // 1=Personal, 2=Academic, 3=Documents, 4=Payment
  personalInfo: {
    fullName: String,
    email: String,
    phone: String, 
    address: String
  },
  academic: {
    qualification: String, 
    institution: String,
    year: Number, 
    percentage: Number
  },
  documents: [{
    type:   String,
    url:    String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  }],
  payment: {
    applicationFee: Number,
    paid: { type: Boolean, default: false },
    paymentId: String
  },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: String,
  submittedAt: Date,
  decidedAt:   Date
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Application', applicationSchema);
