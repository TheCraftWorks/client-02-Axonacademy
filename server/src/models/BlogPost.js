const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  category: { type: String, required: true },
  date:     { type: String, required: true },
  readTime: { type: String, required: true },
  excerpt:  { type: String, required: true },
  featured: { type: Boolean, default: false },
  image:    { type: String, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('BlogPost', blogPostSchema);