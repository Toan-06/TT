const express = require('express');
const router = express.Router();
const Place = require('../models/Place');
// Bổ sung fs để đọc từ file json tạm thời mô phỏng CSDL (khi chưa insert lên MongoDB)
const fs = require('fs');
const path = require('path');

// Fallback logic
let placesData = [];
try {
  const content = fs.readFileSync(path.join(__dirname, '../public/places-data.js'), 'utf-8');
  // Chuyển file places-data.js (chứa WANDER_PLACES = [...]) sang mảng JSON memory ở backend
  const extractJson = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
  placesData = eval(extractJson);
} catch (e) {
  console.error("Error loading places fallback data:", e);
}

// Lấy danh sách Address
router.get('/', async (req, res) => {
  try {
    const places = await Place.find({});
    if (places && places.length > 0) {
      return res.json({ success: true, data: places });
    }
    // Nếu db trống, trả về mảng lưu memory demo
    return res.json({ success: true, data: placesData, source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
