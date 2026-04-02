/**
 * seedPlaces.js — Script nạp lại toàn bộ dữ liệu điểm du lịch vào MongoDB
 * Chạy: node seedPlaces.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('./models/Place');

const placesData = [
  {
    id: "phu-quoc",
    name: "Phú Quốc",
    region: "Kiên Giang",
    tags: ["biển", "ẩm thực", "nghỉ dưỡng"],
    budget: 3, pace: "vua",
    habits: ["gia đình", "cặp đôi", "đi sớm"],
    interests: ["biển", "resort", "hải sản", "chụp ảnh"],
    meta: "Biển xanh, hoàng hôn & hải sản tươi",
    text: "Đảo ngọc Phú Quốc với dải cát trắng mịn, resort cao cấp trải dài, hệ sinh thái biển đa dạng, cùng các khu chợ đêm sầm uất và làng chài truyền thống ven biển. Là điểm đến hàng đầu cho kỳ nghỉ gia đình và tuần trăng mật.",
    image: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&q=80",
    lat: 10.2899, lng: 103.984, top: true,
    transportTips: "Nên đặt vé bay thẳng đến Phú Quốc (sân bay Phú Quốc). Trong đảo, thuê xe máy hoặc taxi điện VinBus để dạo quanh.",
    activities: [
      { dayPart: "Sáng", title: "Khám phá Bãi Sao / Bãi Khem", tip: "Đi sớm tránh nắng gắt; chuẩn bị kem chống nắng thân thiện rạn san hô." },
      { dayPart: "Chiều", title: "Lặn biển ngắm san hô (Snorkel)", tip: "Đặt tour ghép có hướng dẫn viên đi kèm để đảm bảo an toàn." },
      { dayPart: "Tối", title: "Khám phá Chợ đêm Dinh Cậu", tip: "Hải sản niêm yết giá công khai, nhưng vẫn nên hỏi trước khi gọi món." }
    ],
    sourceName: "Cổng TTĐT Tỉnh Kiên Giang",
    sourceUrl: "https://kiengiang.gov.vn/"
  },
  {
    id: "hoi-an",
    name: "Hội An",
    region: "Quảng Nam",
    tags: ["văn hóa", "ẩm thực"],
    budget: 2, pace: "cham",
    habits: ["cặp đôi", "đi một mình", "cú đêm"],
    interests: ["phố cổ", "ẩm thực", "làng nghề", "UNESCO"],
    meta: "Phố cổ đèn lồng & Di sản văn hóa UNESCO",
    text: "Hội An là di sản văn hóa thế giới được UNESCO công nhận, đặc trưng bởi những nếp nhà cổ kính sơn vàng và con sông Hoài lấp lánh hoa đăng về đêm. Nổi tiếng với ẩm thực tinh tế và các làng nghề truyền thống phong phú.",
    image: "https://images.unsplash.com/photo-1598970434795-0c54fe7c0648?w=800&q=80",
    lat: 15.8801, lng: 108.338, top: true,
    transportTips: "Bay đến sân bay Quốc tế Đà Nẵng, di chuyển bằng taxi hoặc xe bus khoảng 45 phút. Trong phố cổ, đi bộ hoặc xe đạp.",
    activities: [
      { dayPart: "Sáng", title: "Thưởng thức Cao lầu Phố Hội", tip: "Cao lầu ngon nhất khi được nấu bằng nước giếng cổ Bá Lễ." },
      { dayPart: "Chiều", title: "Đi thúng bơi Rừng dừa Cẩm Thanh", tip: "Chuẩn bị mũ nón vì khu vực này thường xuyên có nắng gắt." },
      { dayPart: "Tối", title: "Thả hoa đăng trên sông Hoài", tip: "Rất đông dịp cuối tuần; cẩn thận tư trang cá nhân." }
    ],
    sourceName: "Quỹ Di sản Hội An",
    sourceUrl: "https://disanhoian.vn/"
  },
  {
    id: "sa-pa",
    name: "Sa Pa",
    region: "Lào Cai",
    tags: ["leo núi", "văn hóa", "ẩm thực"],
    budget: 2, pace: "nhanh",
    habits: ["đi một mình", "gia đình", "đi sớm"],
    interests: ["trekking", "bản làng", "ruộng bậc thang", "check-in"],
    meta: "Thiên đường mây & Ruộng bậc thang kỳ vĩ",
    text: "Thị trấn sương mù Sa Pa làm say lòng người với những đỉnh núi hùng vĩ, ruộng bậc thang uốn lượn và bản sắc văn hóa dân tộc rực rỡ sắc màu Tây Bắc. Fansipan — nóc nhà Đông Dương — là thử thách chinh phục của mọi phượt thủ.",
    image: "https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=80",
    lat: 22.3364, lng: 103.8438, top: true,
    transportTips: "Đi xe giường nằm hoặc tàu hỏa đêm cabin giường nằm từ Hà Nội (6-8 tiếng). Sa Pa lạnh quanh năm — luôn mang áo ấm.",
    activities: [
      { dayPart: "Sáng", title: "Chinh phục đỉnh Fansipan (cáp treo)", tip: "Đi cáp treo lúc 8h sáng để có cơ hội săn mây; mang áo ấm." },
      { dayPart: "Chiều", title: "Trekking Bản Cát Cát / Tả Van", tip: "Chuẩn bị giày trekking chống trượt vì đường bản thường dốc và bùn lầy." },
      { dayPart: "Tối", title: "Lẩu cá tầm & Rượu táo mèo", tip: "Cá mú, lẩu gà đen là đặc sản tuyệt hảo giữa không khí lạnh giá." }
    ],
    sourceName: "Cổng Du lịch Lào Cai",
    sourceUrl: "https://laocaitourism.vn/"
  },
  {
    id: "ha-long",
    name: "Vịnh Hạ Long",
    region: "Quảng Ninh",
    tags: ["biển", "văn hóa", "nghỉ dưỡng"],
    budget: 3, pace: "vua",
    habits: ["cặp đôi", "gia đình"],
    interests: ["du thuyền", "kayak", "UNESCO", "check-in"],
    meta: "Kỳ quan thiên nhiên thế giới được UNESCO công nhận",
    text: "Quần thể hàng nghìn đảo đá vôi khổng lồ mọc lên giữa làn nước trong xanh như ngọc bích. Vịnh Hạ Long là di sản thiên nhiên thế giới hai lần được UNESCO công nhận và là biểu tượng du lịch của Việt Nam.",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    lat: 20.9101, lng: 107.1839, top: true,
    transportTips: "Đi cao tốc Hà Nội - Hải Phòng - Quảng Ninh rút ngắn thời gian di chuyển còn khoảng 2-2.5 giờ. Nên đặt tour du thuyền từ 1-3 đêm.",
    activities: [
      { dayPart: "Sáng", title: "Khám phá Hang Sửng Sốt / Động Thiên Cung", tip: "Đặt tham quan theo giờ, tránh đông người vào buổi trưa." },
      { dayPart: "Chiều", title: "Chèo thuyền Kayak hang Luồn & Tùng Áng", tip: "Cẩn thận với khỉ hoang; mặc áo phao đúng cách." },
      { dayPart: "Tối", title: "Nghỉ ngơi trên Du thuyền 5 sao", tip: "Thưởng thức bữa tối hải sản và câu mực đêm trên boong." }
    ],
    sourceName: "Ban Quản lý Vịnh Hạ Long",
    sourceUrl: "https://halong.org.vn/"
  },
  {
    id: "ha-noi",
    name: "Hà Nội",
    region: "Thủ đô",
    tags: ["ẩm thực", "văn hóa"],
    budget: 1, pace: "cham",
    habits: ["cú đêm", "đi một mình", "cặp đôi"],
    interests: ["phố cổ", "cà phê", "bảo tàng", "ẩm thực đường phố"],
    meta: "Thủ đô nghìn năm văn hiến & Ẩm thực đường phố",
    text: "Hà Nội pha trộn giữa lịch sử hàng ngàn năm tại 36 phố phường và cuộc sống hiện đại tất bật, nổi danh toàn cầu bởi ẩm thực đường phố phong phú từ phở, bún chả đến cà phê trứng độc đáo.",
    image: "https://images.unsplash.com/photo-1502602898657-3e9172f29b78?w=800&q=80",
    lat: 21.0285, lng: 105.8542, top: false,
    transportTips: "Đường Hà Nội khá hẹp ở khu Phố cổ. Nên đi bộ hoặc sử dụng ứng dụng ride-hailing như Grab, Be để di chuyển thuận tiện.",
    activities: [
      { dayPart: "Sáng", title: "Tham quan Văn Miếu - Quốc Tử Giám", tip: "Đến sớm trước 8h để không gian vắng lặng và phù hợp chụp ảnh." },
      { dayPart: "Chiều", title: "Nhâm nhi Cà phê Trứng phố Đinh Tiên Hoàng", tip: "Cà phê Giang là địa chỉ nổi tiếng nhất; ngồi tầng 2 để ngắm phố cổ." },
      { dayPart: "Tối", title: "Bia hơi vỉa hè tại Tạ Hiện / Lương Ngọc Quyến", tip: "Phố mở nhộn nhịp đến 1h sáng. Cẩn thận tư trang cá nhân." }
    ],
    sourceName: "Vietnam.Travel - Cục Du lịch Quốc gia Việt Nam",
    sourceUrl: "https://vietnam.travel/places-to-go/northern-vietnam/ha-noi"
  },
  {
    id: "da-lat",
    name: "Đà Lạt",
    region: "Lâm Đồng",
    tags: ["leo núi", "ẩm thực", "nghỉ dưỡng"],
    budget: 2, pace: "cham",
    habits: ["cặp đôi", "gia đình"],
    interests: ["hoa", "cà phê", "thiên nhiên", "check-in"],
    meta: "Thành phố ngàn hoa & Khí hậu mát mẻ quanh năm",
    text: "Thành phố Đà Lạt nằm trên cao nguyên Langbiang mát mẻ, nổi tiếng với những vườn hoa bát ngát, đồi chè xanh mướt, kiến trúc Pháp cổ điển và nền cà phê specialty nức tiếng.",
    image: "https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?w=800&q=80",
    lat: 11.9404, lng: 108.4583, top: true,
    transportTips: "Xe khách giường nằm từ TP.HCM (6-7 tiếng) hoặc bay đến sân bay Liên Khương. Đà Lạt dốc — thuê xe máy cần kinh nghiệm lái núi.",
    activities: [
      { dayPart: "Sáng", title: "Đồi chè Cầu Đất & Vườn dâu tây", tip: "Sương sớm tan lúc 8-9h — mang áo khoác mỏng dù là mùa hè." },
      { dayPart: "Chiều", title: "Hồ Tuyền Lâm, đạp xe / kayak", tip: "Tránh hẻm xe tay ga dốc lần đầu; đường quanh hồ rất đẹp và an toàn." },
      { dayPart: "Tối", title: "Chợ đêm Đà Lạt & ăn vặt", tip: "Kem bơ, bánh tráng nướng, sữa đậu nành nóng — thưởng thức đặc sản giá rẻ." }
    ],
    sourceName: "Cổng Du lịch Lâm Đồng",
    sourceUrl: "https://lamdong.gov.vn/Sites/vi-vn/Pages/default.aspx"
  },
  {
    id: "da-nang",
    name: "Đà Nẵng",
    region: "Đà Nẵng",
    tags: ["biển", "ẩm thực", "văn hóa"],
    budget: 2, pace: "vua",
    habits: ["gia đình", "cặp đôi"],
    interests: ["biển", "cầu Vàng", "ẩm thực", "resort"],
    meta: "Thành phố đáng sống & Biển Mỹ Khê tuyệt đẹp",
    text: "Đà Nẵng được mệnh danh là thành phố đáng sống nhất Việt Nam với biển Mỹ Khê trong xanh, cơ sở hạ tầng hiện đại, Bà Nà Hills kỳ thú và ẩm thực miền Trung phong phú.",
    image: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&q=80",
    lat: 16.0544, lng: 108.2022, top: false,
    transportTips: "Sân bay Quốc tế Đà Nẵng nằm rất gần trung tâm (5-10 phút). Thuê xe máy hoặc dùng Grab để di chuyển trong thành phố.",
    activities: [
      { dayPart: "Sáng", title: "Tắm biển Mỹ Khê / Ngũ Hành Sơn", tip: "Nắng mạnh từ 10h-14h — bôi kem chống nắng kỹ; bãi biển có cờ an toàn." },
      { dayPart: "Chiều", title: "Bà Nà Hills & Cầu Vàng (Golden Bridge)", tip: "Mát hơn trung tâm 8-10°C; mang áo khoác nhẹ để chụp ảnh Cầu Vàng." },
      { dayPart: "Tối", title: "Cầu Rồng phun lửa & Chợ Hàn", tip: "Cầu phun lửa lúc 21h thứ 7 và Chủ Nhật. Đến trước 30p chọn vị trí đứng đẹp." }
    ],
    sourceName: "Cổng Thông tin Du lịch Đà Nẵng",
    sourceUrl: "https://danangfantasticity.com/"
  },
  {
    id: "nha-trang",
    name: "Nha Trang",
    region: "Khánh Hòa",
    tags: ["biển", "ẩm thực"],
    budget: 2, pace: "vua",
    habits: ["cặp đôi", "gia đình", "cú đêm"],
    interests: ["lặn", "đảo", "resort", "ẩm thực"],
    meta: "Thành phố biển & Hệ thống đảo san hô phong phú",
    text: "Nha Trang sở hữu vùng biển trong xanh với hệ thống rạn san hô đa dạng bậc nhất Việt Nam, cùng chuỗi đảo hoang sơ thơ mộng và nền ẩm thực biển cực kỳ đặc sắc.",
    image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
    lat: 12.2388, lng: 109.1967, top: false,
    transportTips: "Bay đến sân bay Quốc tế Cam Ranh, xe shuttle/bus vào trung tâm khoảng 30-45 phút. Chú ý cờ an toàn khi tắm biển.",
    activities: [
      { dayPart: "Sáng", title: "Tham quan Tháp Bà Ponagar cổ kính", tip: "Đi sớm tránh đoàn tour; váy ngắn cần sarong khi vào khu thánh tích." },
      { dayPart: "Chiều", title: "Tour 4 đảo hoặc VinWonders Nha Trang", tip: "Đặt tour online để có giá tốt; kiểm tra thời tiết biển trước." },
      { dayPart: "Tối", title: "Hải sản tươi sống tại đường biển Trần Phú", tip: "Hỏi giá/kg trước khi chọn; bạch tuộc, ghẹ, tôm hùm là đặc sản." }
    ],
    sourceName: "Cổng Du lịch Khánh Hòa",
    sourceUrl: "https://khanhhoa.gov.vn/"
  },
  {
    id: "can-tho",
    name: "Cần Thơ",
    region: "TP. Cần Thơ",
    tags: ["văn hóa", "ẩm thực"],
    budget: 1, pace: "cham",
    habits: ["đi một mình", "gia đình"],
    interests: ["miệt vườn", "chợ nổi", "sông nước", "ẩm thực"],
    meta: "Thủ phủ miền Tây & Chợ nổi Cái Răng nổi tiếng",
    text: "Cần Thơ là trái tim của đồng bằng sông Cửu Long, nơi văn hóa sông nước, chợ nổi tấp nập và vườn cây ăn trái xanh mát tạo nên bức tranh miền Tây Nam Bộ đặc sắc.",
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80",
    lat: 10.0452, lng: 105.7469, top: false,
    transportTips: "Từ TP.HCM đi xe limousine khoảng 3-4 tiếng. Chợ nổi Cái Răng họp lúc 5h30-7h — nghỉ gần bến phà để kịp giờ.",
    activities: [
      { dayPart: "Sáng", title: "Chợ nổi Cái Răng lúc bình minh", tip: "Thuê ghe nhỏ có người lái để linh hoạt; chuẩn bị tiền mặt lẻ mua đồ ăn." },
      { dayPart: "Chiều", title: "Nhà cổ Bình Thủy & Vườn trái cây Phong Điền", tip: "Ăn trái cây đúng mùa; hỏi giá vé tham quan trước." },
      { dayPart: "Tối", title: "Bến Ninh Kiều ngắm sông & Lẩu mắm đặc sản", tip: "Thử lẩu mắm sông nước trong nhóm đông vì dễ chia sẻ nhiều món." }
    ],
    sourceName: "Cổng TTĐT TP. Cần Thơ",
    sourceUrl: "https://cantho.gov.vn/"
  },
  {
    id: "ninh-binh",
    name: "Ninh Bình",
    region: "Ninh Bình",
    tags: ["leo núi", "văn hóa"],
    budget: 1, pace: "cham",
    habits: ["gia đình", "cặp đôi", "đi một mình"],
    interests: ["trekking", "hang động", "UNESCO", "chùa"],
    meta: "Vịnh Hạ Long trên cạn & Quần thể Di sản Tràng An",
    text: "Ninh Bình là 'Vịnh Hạ Long trên cạn' với hệ thống núi đá vôi, sông nước và hang động tuyệt đẹp. Tràng An được UNESCO công nhận là Di sản Thế giới kép về cả văn hóa lẫn thiên nhiên.",
    image: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80",
    lat: 20.2506, lng: 105.9745, top: true,
    transportTips: "Cách Hà Nội khoảng 100km, đi xe limousine khoảng 2 tiếng. Tại Ninh Bình, xe đạp thuê là cách lý tưởng nhất để khám phá.",
    activities: [
      { dayPart: "Sáng", title: "Chèo thuyền xuyên hang đá Tràng An", tip: "Mất 2.5-3 tiếng. Đi sớm ít đông; góc ảnh điện ảnh tuyệt vời." },
      { dayPart: "Chiều", title: "Leo 500 bậc thang Hang Múa ngắm toàn cảnh", tip: "Mang giày đế bám; leo khoảng 15-20p nhưng xứng đáng với cảnh đỉnh núi." },
      { dayPart: "Tối", title: "Thưởng thức Dê núi Ninh Bình & Cơm cháy", tip: "Dê xào sả ớt, tái chanh — hỏi quán địa phương gần khách sạn để tìm chỗ ngon." }
    ],
    sourceName: "Du lịch Ninh Bình chính thức",
    sourceUrl: "https://ninhbinhtourist.com.vn/"
  },
  {
    id: "hue",
    name: "Huế",
    region: "Thừa Thiên - Huế",
    tags: ["văn hóa", "ẩm thực"],
    budget: 1, pace: "cham",
    habits: ["cặp đôi", "đi một mình"],
    interests: ["cố đô", "lăng tẩm", "ẩm thực cung đình", "UNESCO"],
    meta: "Cố đô lăng tẩm & Ẩm thực Cung đình độc đáo",
    text: "Cố đô Huế gắn liền với triều đại nhà Nguyễn, ẩn chứa hệ thống lăng tẩm nguy nga, cung đình hoành tráng và nền ẩm thực cung đình tinh tế được UNESCO vinh danh.",
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80",
    lat: 16.4637, lng: 107.5909, top: false,
    transportTips: "Bay đến sân bay Phú Bài hoặc đi tàu hỏa. Thuê xe máy để thoải mái tham quan các lăng tẩm ở ngoại ô.",
    activities: [
      { dayPart: "Sáng", title: "Tham quan Hoàng Thành & Đại Nội Huế", tip: "Mặc kín đáo khi vào điện thờ; đi sớm tránh đoàn khách du lịch đông đúc." },
      { dayPart: "Chiều", title: "Lăng Khải Định & Lăng Minh Mạng", tip: "Thuê xe máy hoặc xe ôm để đi hết loạt lăng trong 1 ngày." },
      { dayPart: "Tối", title: "Chợ Đông Ba & Bún bò Huế chuẩn vị", tip: "Bún bò Ngự Bình hoặc O Xuân là những địa chỉ được người Huế yêu thích." }
    ],
    sourceName: "Trung tâm Bảo tồn Di tích Cố đô Huế",
    sourceUrl: "https://hueworldheritage.org.vn/"
  },
  {
    id: "ha-giang",
    name: "Hà Giang",
    region: "Hà Giang",
    tags: ["leo núi", "văn hóa"],
    budget: 1, pace: "nhanh",
    habits: ["đi một mình", "đi sớm"],
    interests: ["trekking", "moto", "bản làng", "check-in"],
    meta: "Cung đường đèo hiểm trở & Hoa tam giác mạch bất tận",
    text: "Hà Giang — tỉnh địa đầu Tổ quốc — chinh phục mọi phượt thủ với cung đường Mã Pí Lèng huyền thoại, Đồng Văn Cổ Trấn cổ kính và mùa hoa tam giác mạch tím ngát tháng 10-11.",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80",
    lat: 23.2241, lng: 104.9834, top: true,
    transportTips: "Xe khách từ Hà Nội khoảng 7-8 tiếng. Thuê moto tại thị xã Hà Giang hoặc đặt off-road tour có guide kinh nghiệm.",
    activities: [
      { dayPart: "Sáng", title: "Cột cờ Lũng Cú — Điểm cực Bắc Việt Nam", tip: "Leo 389 bậc; ảnh cờ đỏ Tổ quốc lúc bình minh cực đẹp và đáng nhớ." },
      { dayPart: "Chiều", title: "Đèo Mã Pí Lèng — Con đèo hùng vĩ nhất VN", tip: "Lái xe cực cẩn thận; đường hẹp, vực sâu hàng trăm mét." },
      { dayPart: "Tối", title: "Chợ đêm Đồng Văn Cổ Trấn", tip: "Thử Mèn mén, Thắng cố ngựa — đặc sản dân tộc vùng cao khó quên." }
    ],
    sourceName: "Cổng TTĐT Tỉnh Hà Giang",
    sourceUrl: "https://hagiang.gov.vn/"
  },
  {
    id: "con-dao",
    name: "Côn Đảo",
    region: "Bà Rịa - Vũng Tàu",
    tags: ["biển", "nghỉ dưỡng"],
    budget: 3, pace: "cham",
    habits: ["cặp đôi", "đi một mình"],
    interests: ["biển hoang", "rùa biển", "lịch sử", "lặn biển"],
    meta: "Thiên đường biển hoang nguyên sơ & Di tích lịch sử",
    text: "Côn Đảo còn lưu giữ vẻ nguyên sơ hiếm có với những bãi biển hoang vắng tuyệt đẹp, vườn quốc gia với rừng nguyên sinh và trải nghiệm xem rùa biển đẻ trứng độc đáo.",
    image: "https://images.unsplash.com/photo-1415399153348-c05e9599f298?w=800&q=80",
    lat: 8.6914, lng: 106.6061, top: true,
    transportTips: "Bay từ TP.HCM hoặc Cần Thơ khoảng 50 phút. Thuê xe máy trên đảo để tham quan. Mùa rùa đẻ trứng: tháng 5-10.",
    activities: [
      { dayPart: "Sáng", title: "Bãi Đầm Trầu / Bãi Ông Đụng hoang sơ", tip: "Nước trong xanh; mang đồ snorkel riêng để khám phá san hô gần bờ." },
      { dayPart: "Chiều", title: "Vườn Quốc gia Côn Đảo — Khu bảo tồn", tip: "Đăng ký xem rùa biển về đêm tại Ban quản lý VQG từ sáng sớm." },
      { dayPart: "Tối", title: "Thăm Nghĩa trang Hàng Dương linh thiêng", tip: "Không gian trang nghiêm; trang phục lịch sự và không chụp ảnh tuỳ tiện." }
    ],
    sourceName: "Vườn Quốc gia Côn Đảo",
    sourceUrl: "https://vuondaocon.com.vn/"
  },
  {
    id: "quy-nhon",
    name: "Quy Nhơn",
    region: "Bình Định",
    tags: ["biển", "văn hóa"],
    budget: 1, pace: "cham",
    habits: ["đi một mình", "cặp đôi"],
    interests: ["biển vắng", "Chăm Pa", "hải sản rẻ", "bình yên"],
    meta: "Biển đẹp yên bình & Tháp Chăm cổ kính",
    text: "Quy Nhơn là viên ngọc ẩn của du lịch Việt Nam — biển Kỳ Co trong vắt như ngọc bích, tháp Chăm cổ kính hàng ngàn năm tuổi và ẩm thực hải sản siêu tươi với giá bình dân.",
    image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&q=80",
    lat: 13.7765, lng: 109.2235, top: false,
    transportTips: "Bay thẳng đến sân bay Phù Cát. Grab tại Quy Nhơn rẻ hơn so với các TP lớn; thuê xe máy để đi Kỳ Co, Hòn Khô.",
    activities: [
      { dayPart: "Sáng", title: "Bãi Kỳ Co & Hòn Khô hoang sơ", tip: "Đặt thuyền từ bến Ca Nam từ 6h sáng; nước trong xanh nhất buổi sáng sớm." },
      { dayPart: "Chiều", title: "Tháp Đôi & Tháp Bánh Ít - Di sản Chăm Pa", tip: "Tham quan miễn phí hoặc vé giá thấp; mang nón rộng vành vì trời nắng." },
      { dayPart: "Tối", title: "Bún chả cá & Chợ đêm ẩm thực Quy Nhơn", tip: "Hải sản cực tươi và giá rất bình dân so với các điểm du lịch khác." }
    ],
    sourceName: "Cổng TTĐT Tỉnh Bình Định",
    sourceUrl: "https://binhdinh.gov.vn/"
  },
  {
    id: "phan-thiet",
    name: "Mũi Né – Phan Thiết",
    region: "Bình Thuận",
    tags: ["biển", "ẩm thực", "nghỉ dưỡng"],
    budget: 2, pace: "cham",
    habits: ["cặp đôi", "gia đình"],
    interests: ["biển", "đồi cát", "kitesurfing", "resort"],
    meta: "Đồi cát đỏ kỳ ảo & Thiên đường kite-surfing",
    text: "Mũi Né nổi bật với những đồi cát đỏ và trắng kỳ ảo trải dài, bãi biển ít người và gió lộng quanh năm biến nơi đây thành thiên đường cho môn kite-surfing và windsurfing.",
    image: "https://images.unsplash.com/photo-1509233725247-49e657c54213?w=800&q=80",
    lat: 10.9804, lng: 108.2591, top: false,
    transportTips: "Xe khách/tàu hỏa từ TP.HCM khoảng 4 tiếng. Hoặc bay đến Phan Thiết (sân bay mới). Nhiều resort có xe đón từ TP.HCM.",
    activities: [
      { dayPart: "Sáng", title: "Đồi Cát Đỏ / Bàu Trắng lúc bình minh", tip: "Đến lúc 5h30-7h để chụp ảnh đẹp nhất; tránh trưa nóng có thể lên tới 40°C." },
      { dayPart: "Chiều", title: "Kite-surf / Tắm biển Mũi Né", tip: "Mùa gió Đông Bắc (tháng 10-4) là thời điểm tốt nhất cho kite-surfing." },
      { dayPart: "Tối", title: "Chợ hải sản Phan Thiết tươi sống", tip: "Ghẹ, tôm hùm, mực — hỏi giá rõ ràng /con hoặc /kg trước khi chọn." }
    ],
    sourceName: "Cổng TTĐT Tỉnh Bình Thuận",
    sourceUrl: "https://binhthuan.gov.vn/"
  },
  {
    id: "tphcm",
    name: "TP. Hồ Chí Minh",
    region: "TP. Hồ Chí Minh",
    tags: ["ẩm thực", "văn hóa"],
    budget: 2, pace: "nhanh",
    habits: ["cú đêm", "gia đình", "đi một mình"],
    interests: ["mua sắm", "ẩm thực", "lịch sử", "nightlife"],
    meta: "Thành phố năng động nhất Việt Nam",
    text: "TP. Hồ Chí Minh — trung tâm kinh tế của cả nước — bừng sáng liên tục 24/7 với ẩm thực đường phố phong phú, bảo tàng lịch sử sâu sắc và đời sống văn hóa cực kỳ phong phú.",
    image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&q=80",
    lat: 10.8231, lng: 106.6297, top: false,
    transportTips: "Grab tiện lợi nhất; xe buýt BRT cho đường dài. Tránh giờ cao điểm 7-9h sáng và 17-19h chiều sẽ bị kẹt xe nghiêm trọng.",
    activities: [
      { dayPart: "Sáng", title: "Dinh Độc Lập & Bảo tàng Chứng tích Chiến tranh", tip: "Mua vé online để tránh xếp hàng; trang phục lịch sự khi vào Dinh." },
      { dayPart: "Chiều", title: "Chợ Bến Thành & Phố đi bộ Nguyễn Huệ", tip: "Mặc cả 30-50% ở chợ; cẩn thận móc túi trong đám đông." },
      { dayPart: "Tối", title: "Bánh mì Huỳnh Hoa & Quán bar Rooftop", tip: "Rooftop trên tầng cao nhìn toàn cảnh thành phố về đêm — đặt bàn trước." }
    ],
    sourceName: "Sở Du lịch TP. Hồ Chí Minh",
    sourceUrl: "https://tourism.hochiminhcity.gov.vn/"
  },
  {
    id: "buon-ma-thuot",
    name: "Buôn Ma Thuột",
    region: "Đắk Lắk",
    tags: ["văn hóa", "ẩm thực"],
    budget: 1, pace: "cham",
    habits: ["đi một mình", "gia đình"],
    interests: ["cà phê", "voi", "thác", "bản làng"],
    meta: "Thủ đô Cà phê Việt Nam & Văn hóa Tây Nguyên",
    text: "Buôn Ma Thuột là thủ phủ cà phê nổi tiếng thế giới, nơi những vùng đất đỏ bazan rực rỡ nuôi dưỡng cà phê Robusta hảo hạng cùng văn hóa cồng chiêng Tây Nguyên được UNESCO bảo tồn.",
    image: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80",
    lat: 12.6797, lng: 108.0506, top: false,
    transportTips: "Bay thẳng đến sân bay Buôn Ma Thuột hoặc xe khách từ TP.HCM (~8h). Thuê xe máy để tham quan vùng ngoại ô và các buôn làng.",
    activities: [
      { dayPart: "Sáng", title: "Tham quan Vườn cà phê & Trải nghiệm hái", tip: "Mùa thu hoạch tháng 11-1. Đặt tour Farm-to-Cup trải nghiệm toàn quy trình." },
      { dayPart: "Chiều", title: "Thác Gia Long & Chứa Chan hùng vĩ", tip: "Mùa mưa cuối năm nước to ấn tượng hơn; kiểm tra đường vào mùa mưa." },
      { dayPart: "Tối", title: "Cơm lam & Rượu cần tại buôn làng Ê Đê", tip: "Tham gia lễ hội cồng chiêng nếu may mắn trùng lịch. Vô cùng ấn tượng." }
    ],
    sourceName: "Cổng TTĐT Tỉnh Đắk Lắk",
    sourceUrl: "https://daklak.gov.vn/"
  },
  {
    id: "tam-dao",
    name: "Tam Đảo",
    region: "Vĩnh Phúc",
    tags: ["leo núi", "nghỉ dưỡng"],
    budget: 1, pace: "cham",
    habits: ["gia đình", "cặp đôi"],
    interests: ["núi", "sương mù", "nghỉ dưỡng", "thiên nhiên"],
    meta: "Núi sương mù lãng mạn gần Hà Nội",
    text: "Tam Đảo như một ốc đảo xanh mát cách Hà Nội chỉ 80km, thị trấn núi bồng bềnh trong mây mù huyền ảo với kiến trúc cổ điển Pháp, rừng nguyên sinh và khí hậu mát mẻ dễ chịu.",
    image: "https://images.unsplash.com/photo-1540202404-a2f29016b523?w=800&q=80",
    lat: 21.4684, lng: 105.6436, top: false,
    transportTips: "Ô tô từ Hà Nội khoảng 1.5-2 tiếng. Đường núi dốc và có thể trơn trượt khi mưa — vào mùa mưa cần xe có gầm cao.",
    activities: [
      { dayPart: "Sáng", title: "Leo đỉnh Phù Nghĩa ngắm mây cuộn", tip: "Xuất phát lúc 5h30 để bắt được sương mù đẹp; sương tan lúc 9-10h." },
      { dayPart: "Chiều", title: "Tây Thiên & Rừng nguyên sinh cáp treo", tip: "Trang phục lịch sự khi vào khu chùa tâm linh; cáp treo 2500m dài nhất VN." },
      { dayPart: "Tối", title: "Lợn cắp nách & Su su xào tỏi đặc sản", tip: "Thị trấn nhỏ, chọn nhà hàng có đánh giá tốt trên Google Maps." }
    ],
    sourceName: "Cổng TTĐT Tỉnh Vĩnh Phúc",
    sourceUrl: "https://vinhphuc.gov.vn/"
  },
  {
    id: "mui-ne-fantasy",
    name: "Làng Chài Cổ Thạch",
    region: "Bình Thuận",
    tags: ["biển", "văn hóa"],
    budget: 1, pace: "cham",
    habits: ["đi một mình", "cặp đôi"],
    interests: ["biển đá", "nhiếp ảnh", "yên tĩnh", "bình minh"],
    meta: "Bãi đá san hô huyền bí & Bình minh đẹp nhất",
    text: "Cổ Thạch còn là một bí mật ít được biết đến với bãi đá cuội và san hô kỳ lạ lộ ra khi nước ròng, làng chài mộc mạc và bình minh rực rỡ được nhiếp ảnh gia săn tìm.",
    image: "https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=800&q=80",
    lat: 11.1543, lng: 108.3522, top: false,
    transportTips: "Xe máy từ Phan Thiết khoảng 50km (1 tiếng). Nhất định tra lịch thủy triều trước khi đến để chụp được bãi đá lộ.",
    activities: [
      { dayPart: "Sáng", title: "Chụp ảnh bãi đá lúc bình minh & Nước ròng", tip: "Dậy 4h30 để có mặt tại bãi lúc 5h; đi dép xỉn hoặc giày cao su chống trơn." },
      { dayPart: "Chiều", title: "Ghé làng chài Cổ Thạch mua hải sản tươi", tip: "Mang mát để uống vì khu này ít quán ăn. Hải sản giá địa phương cực rẻ." },
      { dayPart: "Tối", title: "Sưu tập ảnh hoàng hôn đẹp hồng", tip: "Trời quang thì cực đẹp; mang máy ảnh có ống kính tốt để ghi lại khoảnh khắc." }
    ],
    sourceName: "Cổng TTĐT Tỉnh Bình Thuận",
    sourceUrl: "https://binhthuan.gov.vn/"
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Kết nối MongoDB thành công');

    await Place.deleteMany({});
    console.log('🗑️  Đã xóa dữ liệu cũ');

    const result = await Place.insertMany(placesData);
    console.log(`✅ Đã nạp thành công ${result.length} điểm du lịch vào MongoDB!`);
    
    result.forEach(p => {
      console.log(`   📍 ${p.name} (${p.region}) — ${p.sourceUrl ? '✔ có nguồn' : '✗ chưa có nguồn'}`);
    });

    await mongoose.disconnect();
    console.log('\n🎉 Hoàn tất! Database đã được cập nhật với dữ liệu mới đầy đủ nguồn gốc.');
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  }
}

seed();
