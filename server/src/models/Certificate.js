const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  program:     { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  enrollment:  { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true },
  certNo:      { type: String, unique: true }, // CERT-2024-001
  issuedAt:    { type: Date, default: Date.now },
  validUntil:  { type: Date },
  pdfUrl:      { type: String }, // PDF on S3
  qrCode:      { type: String }, // validation QR content
  blockchainTxHash: { type: String }, // Polygon transaction hash (optional security layer)
  isRevoked:   { type: Boolean, default: false }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Certificate', certificateSchema);
