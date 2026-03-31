const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: String,
  notes: String,
  preferences: {
    budget: { type: Number, default: 2 },
    pace: { type: String, default: 'vua' },
    interests: [String],
    habits: [String]
  },
  savedTrips: [{
    name: String,
    stops: [{
      placeId: String,
      name: String,
      day: Number
    }]
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
