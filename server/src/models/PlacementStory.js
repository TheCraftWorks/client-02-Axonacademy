const mongoose = require('mongoose');

const placementStorySchema = new mongoose.Schema({
  name:     { type: String, required: true },
  role:     { type: String, required: true },
  hospital: { type: String, required: true },
  salary:   { type: String },
  city:     { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('PlacementStory', placementStorySchema);
