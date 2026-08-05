const mongoose = require('mongoose');

const reviewVideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  studentName: { type: String },
  roll: { type: String },
  videoUrl: { type: String, required: true }, // Cloudflare R2 public URL
  cloudflareKey: { type: String } // Cloudflare R2 key for deletion
}, {
  timestamps: true
});

module.exports = mongoose.model('ReviewVideo', reviewVideoSchema);
