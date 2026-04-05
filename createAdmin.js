require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const email = process.argv[2] || 'admin@wanderviet.com'; // Tài khoản admin 
const password = process.argv[3] || 'admin123';          // Mật khẩu admin
const name = process.argv[4] || 'Quản Trị Viên';

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Đã kết nối MongoDB...');
    let user = await User.findOne({ email });

    if (user) {
      user.isAdmin = true;
      await user.save();
      console.log(`Đã CẬP NHẬT quyền Admin cho tài khoản: ${email}`);
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user = new User({
        name,
        email,
        password: hashedPassword,
        isAdmin: true,
        displayName: name
      });
      await user.save();
      console.log(`Đã TẠO MỚI tài khoản Admin: ${email} | Mật khẩu: ${password}`);
    }

    mongoose.disconnect();
    console.log('Hoàn thành. Bạn có thể sử dụng tài khoản này để đăng nhập vào Admin.');
  })
  .catch((err) => {
    console.error('Lỗi khi kết nối MongoDB:', err);
    process.exit(1);
  });
