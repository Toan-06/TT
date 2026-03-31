const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  region: String,
  tags: [String],
  budget: Number,
  pace: String,
  habits: [String],
  interests: [String],
  meta: String,
  text: String,
  image: String,
  lat: Number,
  lng: Number,
  top: Boolean,
  favoritesCount: { type: Number, default: 0 },
  transportTips: String,
  activities: [{
    dayPart: String,
    title: String,
    tip: String
  }]
});

module.exports = mongoose.model('Place', placeSchema);
