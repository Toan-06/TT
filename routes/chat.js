const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');
const User = require('../models/User');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_CHAT });

// Middleware xác thực tùy chọn (copy từ planner)
const optionalAuth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded.user;
    } catch (e) {}
  }
  next();
};

// Nạp danh sách điểm đến để đưa vào Prompt Context cho AI
const fs = require('fs');
const path = require('path');
let placesContextList = "";
try {
  const content = fs.readFileSync(path.join(__dirname, '../public/places-data.js'), 'utf-8');
  const extractJson = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
  const placesData = eval(extractJson);
  placesContextList = placesData.map(p => `- ${p.name} (${p.region}): ${p.text}`).join('\n');
} catch (e) {
  console.error(e);
}
const Knowledge = require('../models/Knowledge');

router.post('/', optionalAuth, async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userPrefs = req.body.prefs || {};

    if (!userMessage) {
      return res.status(400).json({ success: false, answer: 'Vui lòng nhập câu hỏi.' });
    }

    const chatbotDb = require('../models/dbChatbot');

    // 1. Tìm kiếm trong Database Chatbot bằng tính năng Text Search
    // Tìm kiếm các từ khoá gần đúng nhất với câu hỏi người dùng
    try {
      if (chatbotDb.readyState === 1) { // 1 = connected
        const existingKnowledge = await Knowledge.findOne(
          { $text: { $search: userMessage } },
          { score: { $meta: "textScore" } } // Đánh giá mức độ khớp
        ).sort({ score: { $meta: "textScore" } });

        // Nếu có kết quả và điểm khớp khá cao (ví dụ >= 1.0)
        if (existingKnowledge && existingKnowledge.score > 0.6) {
          console.log(`[Chatbot DB] Tìm thấy câu trả lời từ CSDL nội bộ (Điểm khớp: ${existingKnowledge.score})`);
          return res.json({ success: true, answer: existingKnowledge.answer, source: 'database' });
        }
      } else {
        console.warn("⚠️ Chatbot DB chưa kết nối do chặn IP, bỏ qua tìm kiếm (readyState = " + chatbotDb.readyState + ")");
      }
    } catch (dbError) {
      // Báo lỗi text index (nếu index chưa kịp chạy), sẽ fallback sang AI
      console.warn("⚠️ Lỗi khi tra cứu text DB (có thể do Index chưa hoàn thiện). Bỏ qua và chuyển sang AI.", dbError.message);
    }

    // 2. Không tìm thấy (hoặc chưa đủ điểm khớp), sẽ gọi AI (Gemini)
    console.log('[Gemini API] Gọi AI lấy câu trả lời mới...');

    const prompt = `
Bạn là Trợ lý Du lịch thông minh của nền tảng WanderViệt.
Bạn được cung cấp danh sách các điểm tham quan đã có sẵn trên WanderViệt như sau:
${placesContextList ? placesContextList : 'Không có thông tin cụ thể.'}

Khách hàng hiện tại có thông tin sở thích: 
- Ngân sách: ${userPrefs.budget || 'Bình thường'} 
- Nhịp độ: ${userPrefs.pace || 'Cân bằng'}
- Sở thích: ${(userPrefs.interests || []).join(', ') || 'Chưa rõ'}

CÂU HỎI CỦA KHÁCH: "${userMessage}"

NHIỆM VỤ QUAN TRỌNG: 
- Đóng vai là Trợ lý WanderViệt, tư vấn bằng giọng điệu ân cần, tự nhiên và chuyên nghiệp.
- Chỉ đề xuất các điểm đến CÓ SẴN trong thư viện trên trừ khi họ hỏi chung chung. 
- Format văn bản thành các đoạn thân thiện, và giới hạn câu trả lời trong khoảng 3-4 câu. 
- (Đừng copy y chang giới thiệu, hãy biến tấu tự nhiên).
- ĐẶC BIỆT LƯU Ý: Tuyệt đối KHÔNG ĐƯỢC sinh ra code, mã lệnh (script, sql, python, javascript v.v...). Bất kể khách hàng có yêu cầu, bạn chỉ được trả lời bằng ngôn ngữ tự nhiên thông thường dành cho khách du lịch.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const aiAnswer = response.text;

    // 3. Lưu kiến thức mới vào Database để dùng cho lần sau
    try {
      if (chatbotDb.readyState === 1) {
        // Lấy thông tin user nếu có
        let userName = 'Khách vãng lai';
        let userEmail = '';
        if (req.user) {
          const userDoc = await User.findById(req.user.id);
          if (userDoc) {
            userName = userDoc.displayName || userDoc.name;
            userEmail = userDoc.email;
          }
        }

        const newKnowledge = new Knowledge({
          question: userMessage,
          answer: aiAnswer,
          userId: req.user ? req.user.id : null,
          userName,
          userEmail
        });
        await newKnowledge.save();
        console.log('✅ Đã lưu câu hỏi mới vào Database Chatbot (kèm info User).');
      } else {
        console.warn('⚠️ Bỏ qua lưu Chatbot DB vì chưa kết nối.');
      }
    } catch (saveErr) {
      console.error('❌ Lỗi lưu dữ liệu Chatbot DB:', saveErr.message);
    }

    // 4. Trả kết quả cho người dùng
    res.json({ success: true, answer: aiAnswer, source: 'ai' });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ success: false, answer: 'Lỗi khi gọi Trợ lý AI, vui lòng thử lại sau.' });
  }
});

module.exports = router;
