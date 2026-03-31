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
    
    // Nếu db trống, tự động chèn dữ liệu mẫu vào MongoDB (Seeding)
    if (placesData && placesData.length > 0) {
      console.log('Database trống. Đang tự động nạp dữ liệu mẫu vào MongoDB...');
      await Place.insertMany(placesData);
      console.log('Nạp dữ liệu mẫu thành công!');
      const newPlaces = await Place.find({});
      return res.json({ success: true, data: newPlaces });
    }

    return res.json({ success: true, data: [], source: 'memory' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API để reset/nạp lại dữ liệu (có thể dùng test trên Postman/Insomnia)
router.post('/seed', async (req, res) => {
  try {
    await Place.deleteMany({}); // Xóa dữ liệu cũ
    const inserted = await Place.insertMany(placesData);
    res.json({ success: true, message: `Đã tự động tạo database và chèn ${inserted.length} bản ghi!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API để cập nhật lượt yêu thích (Thả tim)
router.post('/:id/favorite', async (req, res) => {
  try {
    const { action } = req.body; // 'add' hoặc 'remove'
    const place = await Place.findOne({ id: req.params.id });
    
    if (!place) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy địa điểm' });
    }

    if (action === 'add') {
      place.favoritesCount = (place.favoritesCount || 0) + 1;
    } else if (action === 'remove' && place.favoritesCount > 0) {
      place.favoritesCount -= 1;
    }

    await place.save();
    res.json({ success: true, favoritesCount: place.favoritesCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
