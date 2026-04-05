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
const chatbotDb = require('../models/dbChatbot');

router.post('/', optionalAuth, async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userPrefs = req.body.prefs || {};
    const chatHistory = req.body.history || req.body.chatHistory || [];

    if (!userMessage) {
      return res.status(400).json({ success: false, answer: 'Vui lòng nhập câu hỏi.' });
    }

    // --- QUICK RESPONSE FOR COMMON GREETINGS ---
    const lowerMsg = userMessage.toLowerCase().trim().replace(/[?.,!]$/, "");
    const quickGreetings = ['alo', 'chào', 'hi', 'hello', 'ơi', 'ê', 'hey', 'ê hả'];
    if (quickGreetings.includes(lowerMsg)) {
      return res.json({ 
        success: true, 
        answer: "Chào bạn! Mình là Trợ lý du lịch WanderViệt đây. Bạn cần mình tư vấn địa điểm nào hay có thắc mắc gì về chuyến đi không?", 
        source: 'quick-response' 
      });
    }
    // -------------------------------------------

    // 1. Kiểm tra DB Knowledge
    if (chatbotDb.readyState === 1) {
      const normalizedMsg = userMessage.trim().toLowerCase().replace(/[?.,!]$/, "");
      try {
        let match = await Knowledge.findOne({ question: new RegExp(`^${normalizedMsg}$`, 'i') });
        if (!match) {
          match = await Knowledge.findOne(
            { $text: { $search: userMessage } },
            { score: { $meta: "textScore" } }
          ).sort({ score: { $meta: "textScore" } });
          if (match && match.score < 0.8) match = null;
        }
        if (match) {
          return res.json({ success: true, answer: match.answer, source: 'database' });
        }
      } catch (dbError) {
        console.warn("⚠️ Lỗi tra cứu DB Chatbot:", dbError.message);
      }
    }

    // 2. Gọi AI với SDK @google/genai
    console.log(`[Gemini AI] Xử lý câu hỏi: "${userMessage}"`);

    const finalPrompt = `
HỆ THỐNG: Bạn là Trợ lý Du lịch WanderViệt. Bạn chỉ được nói tiếng Việt 100%. 

Dưới đây là kiến thức về các địa danh:
${placesContextList ? placesContextList : 'Dữ liệu chung tại Việt Nam.'}

CÂU HỎI CỦA KHÁCH: "${userMessage}"

YÊU CẦU:
- Trả lời bằng tiếng Việt 100%.
- Ngắn gọn, súc tích (3-5 câu).
- Thân thiện như hướng dẫn viên bản địa.
`;

    let aiAnswer = '';
    try {
      // Cú pháp chuẩn cho bản @google/genai cũ: ai.models.generateContent
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          { role: "user", parts: [{ text: finalPrompt }] }
        ]
      });
      
      if (response && response.text) {
        aiAnswer = response.text;
      } else {
        throw new Error('AI không trả về kết quả.');
      }
    } catch (aiError) {
      console.error('Gemini API Error:', aiError.message);
      aiAnswer = "Xin lỗi, hiện tại mình đang bận một chút. Bạn hãy thử hỏi lại sau nhé!";
    }

    // 3. Lưu Knowledge mới
    if (chatbotDb.readyState === 1 && aiAnswer && !aiAnswer.includes('bận một chút')) {
      try {
        await new Knowledge({ question: userMessage, answer: aiAnswer }).save();
      } catch (e) {
        console.error('Error saving knowledge:', e.message);
      }
    }

    res.json({ success: true, answer: aiAnswer, source: 'ai' });
  } catch (error) {
    console.error('Chat Route Critical Error:', error);
    res.status(500).json({ success: false, answer: 'Gặp sự cố hệ thống. Vui lòng thử lại sau.' });
  }
});

module.exports = router;
