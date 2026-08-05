const mongoose = require('mongoose');

const libraryRecordingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  folder: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryFolder' }, // Optional, null means root

  // Storage provider configuration
  storageProvider: { type: String, enum: ['mux', 'cloudflare'], default: 'mux' },

  // Mux video details (used when storageProvider is 'mux')
  muxAssetId: { type: String },
  muxPlaybackId: { type: String },
  muxStatus: { type: String, enum: ['preparing', 'ready', 'errored'], default: 'preparing' },

  // Cloudflare video details (used when storageProvider is 'cloudflare')
  cloudflareKey: { type: String },
  cloudflareUrl: { type: String },

  duration: { type: Number }, // seconds
  thumbnail: { type: String }, // thumbnail url or local default path

  // DRM / Security
  security: {
    signedUrlRequired: { type: Boolean, default: true },
    urlExpiryHours: { type: Number, default: 6 },
    watermark: { type: Boolean, default: true },
    downloadBlocked: { type: Boolean, default: true },
    screenRecordDetect: { type: Boolean, default: true },
    devToolsBlocked: { type: Boolean, default: true }
  },
  
  version: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('LibraryRecording', libraryRecordingSchema);
