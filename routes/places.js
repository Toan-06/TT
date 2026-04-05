const express = require('express');
const router = express.Router();
const Place = require('../models/Place');
const User = require('../models/User');
const { auth } = require('./auth');
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
    // Thêm .lean() giúp trả kết quả dạng JSON thuần, tiết kiệm >70% RAM so với Mongoose Document cồng kềnh
    const places = await Place.find({}).lean();
    if (places && places.length > 0) {
      return res.json({ success: true, data: places });
    }
    
    // Nếu db trống, tự động chèn dữ liệu mẫu vào MongoDB (Seeding)
    if (placesData && placesData.length > 0) {
      console.log('Database trống. Đang tự động nạp dữ liệu mẫu vào MongoDB...');
      await Place.insertMany(placesData);
      console.log('Nạp dữ liệu mẫu thành công!');
      const newPlaces = await Place.find({}).lean();
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

// Thêm Đánh giá (Review)
router.post('/:id/review', auth, async (req, res) => {
  try {
    const { rating, text, userName } = req.body;
    const place = await Place.findOne({ id: req.params.id });
    if (!place) return res.status(404).json({ success: false, message: 'Không tìm thấy địa điểm.' });

    const newReview = {
      userId: req.user.id,
      userName: userName || 'Khách',
      rating: Number(rating),
      text: text || '',
      createdAt: new Date()
    };
    
    place.reviews.push(newReview);
    place.reviewCount = place.reviews.length;
    place.ratingAvg = (place.reviews.reduce((acc, curr) => acc + curr.rating, 0) / place.reviewCount).toFixed(1);
    
    await place.save();
    res.json({ success: true, reviews: place.reviews, ratingAvg: place.ratingAvg, reviewCount: place.reviewCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cập nhật trạng thái trải nghiệm bản đồ (Activity Log)
router.post('/:id/activity', auth, async (req, res) => {
  try {
    const { status } = req.body; // 'scheduled', 'experienced', 'missed'
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

    const existingLog = user.activityLog.find(log => log.placeId === req.params.id);
    if (existingLog) {
      existingLog.status = status;
      existingLog.updatedAt = new Date();
    } else {
      user.activityLog.push({
        placeId: req.params.id,
        status: status,
        updatedAt: new Date()
      });
    }

    await user.save();
    res.json({ success: true, activityLog: user.activityLog });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
