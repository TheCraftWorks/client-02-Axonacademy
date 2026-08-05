const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  roll: { type: String, required: true },
  review: { type: String, required: true },
  image: { type: String }, // Cloudinary image URL
  imagePublicId: { type: String } // Cloudinary public ID for deletion
}, {
  timestamps: true
});

module.exports = mongoose.model('Testimonial', testimonialSchema);
