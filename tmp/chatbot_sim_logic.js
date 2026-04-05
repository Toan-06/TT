// chatbot_sim_logic.js
// Demo logic for Hybrid Chatbot (Database Match -> AI Fallback)

const mockDatabase = [
  { question: "Làm sao để đổi mật khẩu?", answer: "Bạn vào Cá nhân -> Cài đặt -> Đổi mật khẩu nhé!" },
  { question: "Mất bao lâu để tạo lịch trình?", answer: "Khoảng 5-10 giây tùy vào yêu cầu của bạn!" },
  { question: "WanderViệt là gì?", answer: "Là nền tảng du lịch AI giúp bạn lên kế hoạch và dẫn đường thông minh." }
];

function simulateChat(userQuery) {
  console.log(`\n💬 Khách hỏi: "${userQuery}"`);
  console.log("🔍 Đang tìm trong database...");

  // Giả lập tìm kiếm (fuzzy match đơn giản)
  const match = mockDatabase.find(item => 
    userQuery.toLowerCase().includes(item.question.toLowerCase().replace('?', ''))
  );

  if (match) {
    console.log("✅ [DATABASE MATCH] Tìm thấy câu trả lời có sẵn!");
    console.log(`🤖 Chatbot: ${match.answer}`);
    return { source: 'database', answer: match.answer };
  } else {
    console.log("❌ [NOT IN DB] Không tìm thấy dữ liệu có sẵn. Chuyển sang AI...");
    console.log("🤖 [AI Gemini]: Đang phân tích câu hỏi và trả lời thông minh...");
    const aiAnswer = "(Câu trả lời thông minh từ AI dựa trên ngữ cảnh du lịch)";
    console.log(`🤖 Chatbot (AI): ${aiAnswer}`);
    
    // Giả lập lưu vào DB cho lần sau (Learning)
    console.log("💾 [SELF-LEARNING]: Đã lưu câu trả lời này vào Database để lần sau trả lời nhanh hơn.");
    return { source: 'ai', answer: aiAnswer };
  }
}

// CHẠY THỬ
simulateChat("Làm sao để đổi mật khẩu?"); // Trường hợp có trong DB
simulateChat("Nên đi đâu ở Sapa vào mùa đông?"); // Trường hợp phải hỏi AI
