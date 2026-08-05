const mongoose = require('mongoose');

const studentRequestSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  
  // Personal info snapshot at registration
  fullName:     String,
  email:        String,
  phone:        String,
  qualification:String,
  address:      String,
  
  // Document uploads
  documents: [{
    type:   { type: String, enum: ['aadhar','photo','marksheet','certificate'] },
    url:    String, // S3 URL
    name:   String
  }],
  
  // Desired program
  program:  { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  message:  { type: String }, // "Why I want to join"
  
  // Admin decision
  status:       { type: String, enum: ['pending','approved','held','rejected'], default: 'pending' },
  reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminNote:    { type: String }, // reason for hold/rejection shown to student
  reviewedAt:   { type: Date },
  
  // After approval
  batchAssigned:{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  classroomsAssigned: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
  
  // Status timeline
  timeline: [{
    status:    String,
    note:      String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now }
  }],
  
  // Credentials sent?
  credentialsSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('StudentRequest', studentRequestSchema);
