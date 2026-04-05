const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  phone: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
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
  // Activity Log for tracking user states on map/itineraries
  activityLog: [{
    placeId: String,
    status: { type: String, enum: ['scheduled', 'experienced', 'missed'] },
    updatedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
