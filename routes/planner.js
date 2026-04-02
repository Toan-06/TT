const express = require('express');
const router = express.Router();
const { auth, JWT_SECRET } = require('./auth');
const { GoogleGenAI } = require('@google/genai');
const jwt = require('jsonwebtoken');

// Middleware xác thực tùy chọn: có token thì gắn user, không có vẫn cho qua
const optionalAuth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded.user;
    } catch (e) {
      // Token không hợp lệ, bỏ qua
    }
  }
  next();
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_PLANNER });

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
  console.error("Lỗi đọc places-data trong planner:", e);
}

const Itinerary = require('../models/Itinerary');
const User = require('../models/User'); // ♥ Thêm User model để lấy thông tin chi tiết

// Lên lịch trình
router.post('/generate', optionalAuth, async (req, res) => {
  try {
    const { destination, days, budget, interests, companion, tripDate } = req.body;

    if (!destination || !days) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp điểm đến và số ngày.' });
    }

    const prompt = `
Bạn là Chuyên gia Lên Lịch Trình Du lịch của WanderViệt.
Bạn có nhiệm vụ thiết kế một lịch trình siêu chi tiết cho khách hàng, dựa vào các thông tin sau:
- Điểm đến: ${destination}
- Thời gian đi: ${days} ngày
- Ngân sách: ${budget || 'Tiết kiệm / Tiêu chuẩn'}
- Đối tượng đi cùng: ${companion || 'Gia đình / Bạn bè'}
- Sở thích bổ sung: ${interests || 'Mọi thể loại'}

Các địa điểm có sẵn trong hệ thống WanderViệt có thể gợi ý (ưu tiên sử dụng, nếu không có thì lấy thực tế):
${placesContextList ? placesContextList : 'Sử dụng dữ liệu thực tế tại Việt Nam.'}

YÊU CẦU ĐẦU RA (QUAN TRỌNG):
Bạn BẮT BUỘC PHẢI trả lời hoàn toàn bằng định dạng JSON theo đúng cấu trúc dưới đây. 
Tuyệt đối KHÔNG ĐƯỢC sinh ra đoạn text nào ngoài JSON này.

{
  "tripSummary": "Tóm tắt hấp dẫn về lịch trình...",
  "estimatedCost": "Chi phí ước tính cá nhân (VD: 4.500.000 VNĐ)",
  "suggestedHotel": "Tên khách sạn cụ thể + Giá/đêm (VD: Vinpearl Resort - 2tr/đêm)",
  "itinerary": [
    {
       "day": "1 (06:30 - 22:00)",
       "activities": [
          { "time": "06:30 - 08:00", "task": "Khởi hành & Ăn sáng", "location": "Phở Bát Đàn - 49 Bát Đàn", "cost": "60.000đ" },
          { "time": "08:15 - 11:30", "task": "Hoạt động chính", "location": "Tham quan lăng Bác & Hoàng Thành Thăng Long", "cost": "30.000đ" },
          { "time": "12:00 - 13:30", "task": "Ăn trưa & Nghỉ ngơi", "location": "Bún chả Hương Liên", "cost": "150.000đ" }
       ]
    }
  ]
}

- BẮT BUỘC liệt kê cả Giờ Bắt đầu và Kết thúc của nguyên ngày trong biến "day" (VD: "1 (06:00 - 22:30)").
- BẮT BUỘC liệt kê Giờ Giấc cụ thể (VD: 07:30, 14:00) thay vì mô tả chung chung (Sáng, Trưa, Chiều) cho các "activities". Mốc thời gian phải liền mạch từ khi ngủ dậy đến lúc đi ngủ.
- Tổng số phần tử trong mảng "itinerary" phải CỰC KỲ CHÍNH XÁC bằng ${days}.
- Đảm bảo thời gian chi tiết, không lặp lại, và hợp lý với khoảng cách di chuyển thực tế.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    let aiPlanStr = response.text;
    
    // Tẩy sạch Markdown Code block (nếu có)
    if (aiPlanStr.startsWith('```json')) {
      aiPlanStr = aiPlanStr.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (aiPlanStr.startsWith('```')) {
      aiPlanStr = aiPlanStr.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    
    // Clean string để loại bỏ khoảng trắng rác đầu cuối
    aiPlanStr = aiPlanStr.trim();

    let aiPlanJson;
    try {
      aiPlanJson = JSON.parse(aiPlanStr);
    } catch (parseErr) {
      console.error('Lỗi Parse JSON:', parseErr.message, 'Data:', aiPlanStr);
      return res.status(500).json({ success: false, message: 'Lỗi biên dịch dữ liệu AI. Vui lòng thử lại.' });
    }

    // Lấy thông tin chi tiết người dùng nếu đang đăng nhập để lưu vào DB cho dễ xem
    let userName = 'Khách vãng lai';
    let userEmail = '';
    if (req.user) {
      const userDoc = await User.findById(req.user.id);
      if (userDoc) {
        userName = userDoc.displayName || userDoc.name;
        userEmail = userDoc.email;
      }
    }

    // Lưu vào database, tự động gắn userId nếu đang đăng nhập
    const newItin = new Itinerary({
      destination, days, budget, companion, interests,
      tripDate: tripDate ? new Date(tripDate) : null,
      planJson: aiPlanJson,
      userId: req.user ? req.user.id : null,
      userName,
      userEmail
    });
    const savedDoc = await newItin.save();

    res.json({ success: true, plan: aiPlanJson, itineraryId: savedDoc._id });
  } catch (error) {
    console.error('Planner API Error:', error.message || error);
    res.status(500).json({ success: false, message: 'Lỗi gọi Trợ lý AI: ' + (error.message || 'Không xác định') });
  }
});

// Chỉnh sửa lịch trình (iterative refinement)
router.post('/refine', async (req, res) => {
  try {
    const { oldPlanJson, userFeedback } = req.body;
    
    if (!oldPlanJson || !userFeedback) {
      return res.status(400).json({ success: false, message: 'Lỗi thiếu dữ liệu tinh chỉnh.' });
    }

    const prompt = `
Bạn là Chuyên gia Lên Lịch Trình đang chỉnh sửa bản thảo.
Dưới đây là một lịch trình mẫu bạn đang tư vấn bằng định dạng JSON:
${JSON.stringify(oldPlanJson, null, 2)}

Khách hàng vừa phản ánh: "${userFeedback}"

YÊU CẦU:
Hãy xem xét phản ánh của khách và TẠO LẠI TOÀN BỘ JSON lịch trình mới (sửa những phần khách không thích, giữ nguyên những thứ hợp lý).
Đầu ra BẮT BUỘC tiếp tục trả về duy nhất chuỗi JSON có đúng cấu trúc:
{ tripSummary, estimatedCost, suggestedHotel, itinerary (array các ngày, bên trong chứa activities với thuộc tính time, task, location, cost) }.
Thuộc tính "day" của mảng "itinerary" phải chứa chuỗi gồm ngày và giờ bao quát (VD: "1 (06:00 - 22:30)").
Không bao gồm bất kỳ text nào khác ngoài JSON. Vẫn giữ thời gian cực cụ thể (từ sáng sớm đến tối khuya).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    let aiPlanStr = response.text;
    if (aiPlanStr.startsWith('```json')) aiPlanStr = aiPlanStr.replace(/^```json\n/, '').replace(/\n```$/, '');
    else if (aiPlanStr.startsWith('```')) aiPlanStr = aiPlanStr.replace(/^```\n/, '').replace(/\n```$/, '');
    aiPlanStr = aiPlanStr.trim();

    let newPlanJson;
    try {
      newPlanJson = JSON.parse(aiPlanStr);
    } catch (parseErr) {
      console.error('Lỗi Parse JSON (Refine):', parseErr.message, 'Data:', aiPlanStr);
      return res.status(500).json({ success: false, message: 'Lỗi biên dịch dữ liệu sửa chữa từ AI.' });
    }

    // Lưu bản refine thành 1 record mới với destination, days vv.. từ DB (nếu có itineraryId truyền lên)
    let newItineraryId = null;
    const { itineraryId } = req.body;
    if (itineraryId) {
      const oldItin = await Itinerary.findById(itineraryId);
      if (oldItin) {
        const refinedItin = new Itinerary({
          destination: oldItin.destination,
          days: oldItin.days,
          budget: oldItin.budget,
          companion: oldItin.companion,
          interests: oldItin.interests,
          planJson: newPlanJson,
          // Nếu oldItin đã assign cho user (vì đã ấn Save), thì bản Refine này chưa tự động save để tránh rác
          userId: null 
        });
        const savedDoc = await refinedItin.save();
        newItineraryId = savedDoc._id;
      }
    }

    res.json({ success: true, plan: newPlanJson, itineraryId: newItineraryId });
  } catch (error) {
    console.error('Planner Refine API Error:', error.message || error);
    res.status(500).json({ success: false, message: 'Lỗi chỉnh sửa AI: ' + (error.message || 'Không rõ') });
  }
});

// Lưu lịch trình theo User ID
router.post('/save', auth, async (req, res) => {
  try {
    const { itineraryId } = req.body;
    if (!itineraryId) return res.status(400).json({ success: false, message: 'Mã lịch trình không hợp lệ.' });

    const itin = await Itinerary.findById(itineraryId);
    if (!itin) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trình.' });

    // Gắn userId cho itinerary này
    itin.userId = req.user.id;
    await itin.save();

    res.json({ success: true, message: 'Đã lưu lịch trình thành công.' });
  } catch (error) {
    console.error('Planner DB Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lưu thông tin.' });
  }
});

// Lấy danh sách lịch trình của Tôi
router.get('/my-trips', auth, async (req, res) => {
  try {
    // Chỉ lấy lịch trình có gắn userId hiện tại
    const trips = await Itinerary.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: trips });
  } catch (error) {
    console.error('Planner DB Error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách.' });
  }
});

module.exports = router;
