const mongoose = require('mongoose');

// Kết nối đến DB dành riêng cho Travel Planner
const plannerUri = process.env.PLANNER_MONGODB_URI;

if (!plannerUri) {
  console.warn('⚠️  PLANNER_MONGODB_URI is not defined in .env! Planner features may not work properly.');
}

const plannerDb = mongoose.createConnection(plannerUri, {
  // các cấu hình bổ sung nếu cần (tuỳ chọn)
});

plannerDb.on('connected', () => {
  console.log('✅ Connected to secondary MongoDB (Planner DB)');
});

plannerDb.on('error', (err) => {
  console.error('❌ Planner DB connection error:', err);
});

module.exports = plannerDb;
