const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Place = require('../models/Place');
const { auth } = require('./auth');

// Middleware kiểm tra quyền admin
const adminAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user && user.isAdmin) {
      next();
    } else {
      res.status(403).json({ success: false, message: 'Từ chối quyền truy cập. Cần quyền quản trị viên.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- QUẢN LÝ NGƯỜI DÙNG ---

// Lấy danh sách tất cả người dùng
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cập nhật quyền của người dùng (bật/tắt admin)
router.put('/users/:id/role', auth, adminAuth, async (req, res) => {
  try {
    const { isAdmin } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    user.isAdmin = isAdmin;
    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Chỉnh sửa toàn bộ thông tin người dùng (admin can thiệp)
router.put('/users/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, displayName, email, phone, avatar, isAdmin, notes } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    if (name !== undefined) user.name = name;
    if (displayName !== undefined) user.displayName = displayName;
    if (email !== undefined) user.email = email.toLowerCase();
    if (phone !== undefined) user.phone = phone;
    if (avatar !== undefined) user.avatar = avatar;
    if (isAdmin !== undefined) user.isAdmin = isAdmin;
    if (notes !== undefined) user.notes = notes;
    await user.save();
    const result = user.toObject();
    delete result.password;
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Xóa tài khoản người dùng
router.delete('/users/:id', auth, adminAuth, async (req, res) => {
  try {
    // Không cho phép xóa chính mình
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Không thể tự xóa tài khoản của chính mình' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    res.json({ success: true, message: 'Đã xóa tài khoản thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- QUẢN LÝ ĐIỂM ĐẾN (PLACES) ---

// Lấy danh sách điểm đến
router.get('/places', auth, adminAuth, async (req, res) => {
  try {
    const places = await Place.find();
    res.json({ success: true, data: places });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Thêm điểm đến mới
router.post('/places', auth, adminAuth, async (req, res) => {
  try {
    const place = new Place(req.body);
    // Tự sinh ID nếu chưa có (rất thô sơ, dựa trên thời gian)
    if (!place.id) {
       place.id = "p-" + Date.now();
    }
    await place.save();
    res.json({ success: true, data: place });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Chỉnh sửa điểm đến
router.put('/places/:id', auth, adminAuth, async (req, res) => {
  try {
    const place = await Place.findOneAndUpdate(
      { id: req.params.id }, 
      req.body, 
      { new: true, runValidators: true }
    );
    if (!place) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin' });
    res.json({ success: true, data: place });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Xóa điểm đến
router.delete('/places/:id', auth, adminAuth, async (req, res) => {
  try {
    const place = await Place.findOneAndDelete({ id: req.params.id });
    if (!place) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin' });
    res.json({ success: true, message: 'Đã xóa thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
