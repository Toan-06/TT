(function (global) {
  "use strict";

  async function wanderChatReply(userText, ctx) {
    var raw = (userText || "").trim();
    if (!raw) {
      return "Bạn gõ câu hỏi tự nhiên là được — Trợ lý AI của mình sẽ lấy dữ liệu và trả lời bạn ngay.";
    }

    // Call the newly created NodeJS Express server API
    try {
      const token = localStorage.getItem('wander_token');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token || ''
        },
        body: JSON.stringify({
          message: raw,
          prefs: ctx.getPrefs ? ctx.getPrefs() : {}
        })
      });

      const data = await response.json();
      if (data.success) {
        return data.answer;
      } else {
        return "Xin lỗi, hiện tại trợ lý Đang bận. Vui lòng thử lại sau. Nội dung lỗi: " + (data.answer || data.error);
      }
    } catch (err) {
      return "Lỗi kết nối tới Trợ lý WanderViệt (Server Offline/Chưa phản hồi). Vui lòng thử lại sau.";
    }
  }

  global.wanderChatReply = wanderChatReply;
})(window);
