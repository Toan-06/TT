/**
 * Dữ liệu điểm đến — WanderViệt (demo phía client)
 * budget: 1 = tiết kiệm, 2 = vừa phải, 3 = cao cấp
 * pace: cham | vua | nhanh (nhịp chuyến đi phù hợp)
 */
window.WANDER_PLACES = [
  {
    id: "phu-quoc",
    name: "Phú Quốc",
    region: "Kiên Giang",
    tags: ["biển", "ẩm thực", "nghỉ dưỡng"],
    budget: 3,
    pace: "vua",
    habits: ["gia đình", "cặp đôi", "đi sớm"],
    interests: ["biển", "resort", "hải sản", "chụp ảnh"],
    meta: "Biển xanh, hoàng hôn & hải sản tươi",
    text: "Đảo ngọc với resort cao cấp, chợ đêm và làng chài.",
    image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80",
    lat: 10.2899,
    lng: 103.984,
    top: true,
    transportTips: "Bay thẳng Phú Quốc; thuê xe máy hoặc taxi hợp đồng cho tuyến Bắc–Nam đảo.",
    activities: [
      { dayPart: "Sáng", title: "Bãi Sao hoặc Bãi Khem", tip: "Đi sớm tránh nắng gắt; mang dép đi biển." },
      { dayPart: "Chiều", title: "Lặn/snorkel hoặc câu cá", tip: "Đặt tour có hướng dẫn địa phương; kiểm tra thời tiết." },
      { dayPart: "Tối", title: "Chợ đêm Dinh Cậu / làng chài Hàm Ninh", tip: "Hải sản nướng hỏi giá trước; giữ đồ cá nhân ở chợ đông." }
    ]
  },
  {
    id: "hoi-an",
    name: "Hội An",
    region: "Quảng Nam",
    tags: ["văn hóa", "ẩm thực"],
    budget: 2,
    pace: "cham",
    habits: ["cặp đôi", "đi một mình", "cú đêm"],
    interests: ["phố cổ", "ẩm thực", "làng nghề", "UNESCO"],
    meta: "Phố cổ đèn lồng & di sản UNESCO",
    text: "Đi bộ phố cổ, thử cao lầu và workshop gốm.",
    image: "https://images.unsplash.com/photo-1528127269322-539801943592?w=800&q=80",
    lat: 15.8801,
    lng: 108.338,
    top: true,
    transportTips: "Bay Đà Nẵng rồi xe buýt/xe máy ~45 phút; phố cổ đi bộ là lý tưởng.",
    activities: [
      { dayPart: "Sáng", title: "Chợ Hội An & hẻm cà phơi màu", tip: "Ăn sáng cao lầu, mì Quảng tại quán địa phương." },
      { dayPart: "Chiều", title: "Làng gốm Thanh Hà / rừng dừa Cẩm Thanh", tip: "Thuê xe đạp hoặc xích lô có thỏa thuận giá trước." },
      { dayPart: "Tối", title: "Đèn lồng & bờ sông Hoài", tip: "Sông đông cuối tuần — đặt bàn ăn trước nếu nhóm đông." }
    ]
  },
  {
    id: "sa-pa",
    name: "Sa Pa",
    region: "Lào Cai",
    tags: ["leo núi", "văn hóa", "ẩm thực"],
    budget: 2,
    pace: "nhanh",
    habits: ["đi một mình", "gia đình", "đi sớm"],
    interests: ["trekking", "bản làng", "ruộng bậc thang", "check-in"],
    meta: "Ruộng bậc thang & bản làng dân tộc",
    text: "Trekking Fansipan, chợ phiên và homestay ấm cúng.",
    image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&q=80",
    lat: 22.3364,
    lng: 103.8438,
    top: true,
    transportTips: "Tàu Hà Nội–Lào Cai hoặc xe khách; Sa Pa lạnh — mang áo ấm kể cả hè.",
    activities: [
      { dayPart: "Sáng", title: "Trekking bản Cát Cát / Tả Van", tip: "Thuê porter nếu mang nhiều đồ; giày leo núi chống trơn." },
      { dayPart: "Chiều", title: "Fansipan (cáp treo) hoặc thác Bạc", tip: "Mua vé online giờ cao điểm; kiểm tra sương mù." },
      { dayPart: "Tối", title: "Chợ tối & thử lẩu cá suối", tip: "Homestay thường có bữa tối chung — báo trước dị ứng món ăn." }
    ]
  },
  {
    id: "ha-long",
    name: "Vịnh Hạ Long",
    region: "Quảng Ninh",
    tags: ["biển", "văn hóa", "nghỉ dưỡng"],
    budget: 3,
    pace: "vua",
    habits: ["cặp đôi", "gia đình"],
    interests: ["du thuyền", "kayak", "UNESCO", "check-in"],
    meta: "Di sản thiên nhiên thế giới",
    text: "Du thuyền ngắm đảo đá vôi, kayak và hang động.",
    image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&q=80",
    lat: 20.9101,
    lng: 107.1839,
    top: true,
    transportTips: "Ô tô từ Hà Nội ~2.5–3h; chọn tàu/ghép đoàn có hợp đồng rõ ràng.",
    activities: [
      { dayPart: "Sáng", title: "Lên tàu ngày đêm hoặc tour 1 ngày", tip: "So sánh hành trình: Titop, Sửng Sốt, làng chài." },
      { dayPart: "Chiều", title: "Kayak / chèo sup vịnh", tip: "Mặc áo phao; tránh vị trí xa tàu khi sóng to." },
      { dayPart: "Tối", title: "Câu mực trên tàu (nếu lưu trú đêm)", tip: "Mang áo gió; ẩm trên vịnh." }
    ]
  },
  {
    id: "ha-noi",
    name: "Hà Nội",
    region: "Thủ đô",
    tags: ["ẩm thực", "văn hóa"],
    budget: 1,
    pace: "cham",
    habits: ["cú đêm", "đi một mình", "cặp đôi"],
    interests: ["phố cổ", "cà phê", "bảo tàng", "ẩm thực đường phố"],
    meta: "36 phố phường & ẩm thực đường phố",
    text: "Phố cổ, hồ Hoàn Kiếm và tour ẩm thực đêm.",
    image: "https://images.unsplash.com/photo-1590502593741-c7d1984a1893?w=800&q=80",
    lat: 21.0285,
    lng: 105.8542,
    top: false,
    transportTips: "Grab/ba gác nội thành; tránh giờ cao điểm phố cổ bằng xe máy lần đầu.",
    activities: [
      { dayPart: "Sáng", title: "Hồ Gươm, Bảo tàng Dân tộc", tip: "Phở buổi sáng ở quán đông người địa phương." },
      { dayPart: "Chiều", title: "Phố cổ & Nhà Thơ", tip: "Cà phơi màu Trần Phú — đi sớm chụp ảnh." },
      { dayPart: "Tối", title: "Bia hơi vỉa hè / chợ đêm", tip: "Giữ túi tiền; uống có trách nhiệm." }
    ]
  },
  {
    id: "da-lat",
    name: "Đà Lạt",
    region: "Lâm Đồng",
    tags: ["leo núi", "ẩm thực", "nghỉ dưỡng"],
    budget: 2,
    pace: "cham",
    habits: ["cặp đôi", "gia đình"],
    interests: ["Đà Lạt", "sức khỏe", "cà phê", "thiên nhiên"],
    meta: "Thành phố ngàn hoa & khí hậu mát",
    text: "Hồ Tuyền Lâm, đồi chè và cà phê specialty.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    lat: 11.9404,
    lng: 108.4583,
    top: true,
    transportTips: "Xe khách ghế nằm từ TP.HCM; Đà Lạt dốc — nếu tự lái cần kinh nghiệm.",
    activities: [
      { dayPart: "Sáng", title: "Đồi chè Cầu Đất hoặc Langbiang", tip: "Sương sớm đẹp; mang áo khoác." },
      { dayPart: "Chiều", title: "Hồ Tuyền Lâm, đạp xe / thuyền kayak", tip: "Tránh hẻm xe tay ga lần đầu." },
      { dayPart: "Tối", title: "Chợ đêm Đà Lạt & ăn vặt", tip: "Kem bơ, bánh tráng nướng — hỏi giá trước." }
    ]
  },
  {
    id: "da-nang",
    name: "Đà Nẵng",
    region: "Đà Nẵng",
    tags: ["biển", "ẩm thực", "văn hóa"],
    budget: 2,
    pace: "vua",
    habits: ["gia đình", "cặp đôi"],
    interests: ["biển", "cầu Vàng", "ẩm thực", "resort"],
    meta: "Biển Mỹ Khê & Bà Nà Hills",
    text: "Tắm biển, cầu Rồng phun lửa cuối tuần, lên Bà Nà.",
    image: "https://images.unsplash.com/photo-1559592413-7cec096d7b88?w=800&q=80",
    lat: 16.0544,
    lng: 108.2022,
    top: false,
    transportTips: "Bay thẳng Đà Nẵng hub tốt cho Miền Trung; thuê xe máy bát nháo — kiểm tra kỹ xe.",
    activities: [
      { dayPart: "Sáng", title: "Bãi biển Mỹ Khê / Ngũ Hành Sơn", tip: "Nắng mạnh 10h–14h — che chắn da." },
      { dayPart: "Chiều", title: "Bà Nà Hills (cáp treo)", tip: "Mát hơn trung tâm; mang áo nhẹ." },
      { dayPart: "Tối", title: "Cầu Rồng, chợ Hàn ăn vặt", tip: "Cuối tuần đông; giữ túi ở chợ." }
    ]
  },
  {
    id: "nha-trang",
    name: "Nha Trang",
    region: "Khánh Hòa",
    tags: ["biển", "ẩm thực"],
    budget: 2,
    pace: "vua",
    habits: ["cặp đôi", "gia đình", "cú đêm"],
    interests: ["lặn", "đảo", "resort", "ẩm thực"],
    meta: "Thành phố biển & đảo nhỏ",
    text: "VinWonders, đảo Hòn Mun, bún sứa & hải sản.",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    lat: 12.2388,
    lng: 109.1967,
    top: false,
    transportTips: "Bay Cam Ranh, xe bus/shuttle vào trung tâm; tắm biển chú ý cờ an toàn.",
    activities: [
      { dayPart: "Sáng", title: "Tham quan Tháp Bà Ponagar", tip: "Đi sớm; váy ngắn cần sarong." },
      { dayPart: "Chiều", title: "Tour 3–4 đảo hoặc Vinpearl", tip: "So sánh giá nước/kayak trên đảo." },
      { dayPart: "Tối", title: "Chợ đêm / quán hải sản đường biển", tip: "Chọn hải sản tươi sống; hỏi giá/kg." }
    ]
  },
  {
    id: "can-tho",
    name: "Cần Thơ",
    region: "Cần Thơ",
    tags: ["văn hóa", "ẩm thực"],
    budget: 1,
    pace: "cham",
    habits: ["đi một mình", "gia đình"],
    interests: ["miệt vườn", "chợ nổi", "sông nước", "ẩm thực"],
    meta: "Chợ nổi Cái Răng & miệt vườn",
    text: "Sông Hậu, chợ nổi sáng sớm và bánh cống đường quê.",
    image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80",
    lat: 10.0452,
    lng: 105.7469,
    top: false,
    transportTips: "Từ TP.HCM ~3–4h; chợ nổi 5h30–7h — nghỉ gần bến nếu muốn kịp giờ.",
    activities: [
      { dayPart: "Sáng", title: "Chợ nổi Cái Răng", tip: "Thuê ghe nhỏ có người lái; chuẩn bị tiền mặt lẻ." },
      { dayPart: "Chiều", title: "Bình Thủy cổ miếu / vườn trái cây", tip: "Ăn trái cây đúng mùa — hỏi giá tham quan." },
      { dayPart: "Tối", title: "Bến Ninh Kiều, nhạc sông nước", tip: "Thử lẩu mắm với nhóm đông dễ chia." }
    ]
  }
];
