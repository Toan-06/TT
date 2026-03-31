const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

router.post('/', async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userPrefs = req.body.prefs || {};

    const prompt = `
Bạn là Trợ lý Du lịch thông minh của nền tảng WanderViệt.
Bạn được cung cấp danh sách các điểm tham quan đã có sẵn trên WanderViệt như sau:
${placesContextList ? placesContextList : 'Không có thông tin cụ thể.'}

Khách hàng hiện tại có thông tin sở thích: 
- Ngân sách: ${userPrefs.budget || 'Bình thường'} 
- Nhịp độ: ${userPrefs.pace || 'Cân bằng'}
- Sở thích: ${(userPrefs.interests || []).join(', ') || 'Chưa rõ'}

CÂU HỎI CỦA KHÁCH: "${userMessage}"

NHIỆM VỤ: 
- Đóng vai là Trợ lý WanderViệt, tư vấn bằng giọng điệu ân cần, tự nhiên và chuyên nghiệp.
- Chỉ đề xuất các điểm đến CÓ SẴN trong danh sách trên trừ khi họ hỏi chung chung. 
- Format văn bản thành các đoạn thân thiện, và giới hạn câu trả lời trong khoảng 3-4 câu. 
- (Đừng copy y chang giới thiệu, hãy biến tấu tự nhiên).
    `;

    // Goi Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ success: true, answer: response.text });
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ success: false, answer: 'Lỗi khi gọi Trợ lý AI, vui lòng thử lại sau.' });
  }
});

module.exports = router;
