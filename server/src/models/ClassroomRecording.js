const mongoose = require('mongoose');

const classroomRecordingSchema = new mongoose.Schema({
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  folder: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassroomFolder', default: null },
  title: { type: String, required: true },
  description: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Storage provider configuration
  storageProvider: { type: String, enum: ['mux', 'cloudflare'], default: 'mux' },

  // Mux video details (used when storageProvider is 'mux')
  muxAssetId: { type: String },
  muxPlaybackId: { type: String },
  muxStatus: { type: String, enum: ['preparing', 'ready', 'errored'], default: 'preparing' },

  // Cloudflare video details (used when storageProvider is 'cloudflare')
  cloudflareKey: { type: String },
  cloudflareUrl: { type: String },
  cloudflareKey: { type: String },
  cloudflareUrl: { type: String },

  duration: { type: Number }, // seconds
  thumbnail: { type: String }, // thumbnail url or local default path

  transcript: [{
    timestamp: { type: Number },
    text: { type: String }
  }],

  // DRM / Security
  security: {
    signedUrlRequired: { type: Boolean, default: true },
    urlExpiryHours: { type: Number, default: 6 },
    watermark: { type: Boolean, default: true },
    downloadBlocked: { type: Boolean, default: true },
    screenRecordDetect: { type: Boolean, default: true },
    devToolsBlocked: { type: Boolean, default: true }
  },

  // Chapter markers (admin adds these)
  chapters: [{
    title: String,
    startTimeSec: Number,
    order: Number
  }],

  // Notification
  notified: { type: Boolean, default: false },
  notifiedAt: { type: Date },

  // View analytics
  viewStats: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    totalWatchedSec: { type: Number, default: 0 },
    lastPosition: { type: Number, default: 0 }, // seconds — for resume
    rewatchCount: { type: Number, default: 0 },
    completedAt: Date,
    sessions: [{
      startedAt: Date,
      endedAt: Date,
      watchedSec: Number
    }]
  }],

  isPublished: { type: Boolean, default: false },
  version: { type: Number, default: 1 } // increments on re-upload
}, { timestamps: true });

classroomRecordingSchema.index({ classroom: 1 });

module.exports = mongoose.model('ClassroomRecording', classroomRecordingSchema);
