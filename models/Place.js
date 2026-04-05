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
  sourceName: String,
  sourceUrl: String,
  activities: [{
    dayPart: String,
    title: String,
    tip: String
  }],
  amusementPlaces: [{
    name: String,
    image: String,
    rating: { type: Number, default: 0 },
    description: String,
    ticketPrice: String,
    openingHours: String,
    address: String
  }],
  accommodations: [{
    name: String,
    image: String,
    rating: { type: Number, default: 0 },
    description: String,
    priceRange: String,
    address: String
  }],
  diningPlaces: [{
    name: String,
    image: String,
    rating: { type: Number, default: 0 },
    description: String,
    priceRange: String,
    address: String
  }],
  checkInSpots: [{
    name: String,
    image: String,
    rating: { type: Number, default: 0 },
    description: String,
    address: String
  }],
  // New fields for Map Review feature
  ratingAvg: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  reviews: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
});

// Đánh Index (Chỉ mục) cho các trường hay tìm kiếm để CSDL tra cứu siêu tốc
placeSchema.index({ region: 1 });
placeSchema.index({ tags: 1 });
placeSchema.index({ name: 1 });

module.exports = mongoose.model('Place', placeSchema);
