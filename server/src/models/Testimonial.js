const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  roll: { type: String, required: true },
  review: { type: String, required: true },
  image: { type: String }, // Cloudinary image URL
  imagePublicId: { type: String }, // Cloudinary public ID for deletion
  row: { type: Number, enum: [1, 2], default: 1 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Testimonial', testimonialSchema);
