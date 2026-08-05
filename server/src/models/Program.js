const mongoose = require('mongoose');

const programSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  slug:        { type: String, unique: true },
  subtitle:    { type: String },
  description: { type: String },
  shortDesc:   { type: String },
  thumbnail:   { type: String }, // S3 URL
  previewVideo:{ type: String }, // Mux playback ID
  category: { type: String, default: 'other' },
  status: {
    type: String,
    enum: ['published', 'draft', 'archived'],
    default: 'draft'
  },
  tags:        [String],
  duration:    { type: String }, // e.g. "6 Months"
  specialty:   { type: String }, // e.g. "OT Tech"
  image:       { type: String }, // Cloudinary URL
  imagePublicId: { type: String }, // Cloudinary Public ID
  mode: { type: String, enum: ['online', 'offline', 'hybrid'], default: 'online' },
  isProctored: { type: Boolean, default: true },
  credits:     { type: Number },
  fee: {
    baseAmount:   { type: Number },
    gstPercent:   { type: Number, default: 18 },
    emiAvailable: { type: Boolean, default: true },
    scholarshipAvailable: { type: Boolean, default: false }
  },
  syllabus: [{
    moduleNo:    Number,
    moduleTitle: String,
    topics:      [String],
    durationHours: Number
  }],
  outcomes:    [String], // what you'll learn
  requirements:[String], // prerequisites
  faculty: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FacultyProfile' }],
  accreditations: [String], // e.g. 'JCI Accredited', 'ANCC Partner'
  isFeatured:  { type: Boolean, default: false },
  badge:       { type: String, enum: ['top_rated', 'new', 'in_demand', null], default: null },
  isPublished: { type: Boolean, default: false },
  enrollmentCount: { type: Number, default: 0 },
  rating:      { type: Number, default: 4.5 },
  seoMeta: {
    title: String, 
    description: String, 
    keywords: [String]
  }
}, { 
  timestamps: true 
});

programSchema.index({ slug: 1, category: 1, isPublished: 1 });

module.exports = mongoose.model('Program', programSchema);
