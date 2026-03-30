const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  region: { type: String, required: true },
  tags: [String],
  budget: { type: Number, required: true },
  paces: [String],
  interests: [String],
  habits: [String],
  top: { type: Boolean, default: false },
  meta: String,
  text: String,
  img: String,
  mapLink: String,
  transportTips: String,
  activities: [{
    dayPart: String,
    title: String,
    tip: String
  }]
});

module.exports = mongoose.model('Place', placeSchema);
