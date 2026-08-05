const mongoose = require('mongoose');
const crypto = require('crypto');

const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  deviceInfo: { type: String },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Index to efficiently purge expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ tokenHash: 1 });

// Helper to hash token deterministically
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Helper to create a hashed token
sessionSchema.statics.createSession = async function (userId, rawToken, expiresInMs, deviceInfo) {
  const hash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInMs);
  return this.create({ user: userId, tokenHash: hash, expiresAt, deviceInfo });
};

// Verify raw token against stored hash
sessionSchema.methods.isValid = async function (rawToken) {
  return this.tokenHash === hashToken(rawToken);
};

// Static helper to hash a token
sessionSchema.statics.hashToken = hashToken;

module.exports = mongoose.model('Session', sessionSchema);

