/**
 * Trả lời chat ghép từ WANDER_PLACES + prefs, hạn chế một khối text cố định.
 */
(function (global) {
  "use strict";

  function normalize(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function pick(arr, n) {
    var a = arr.slice();
    var out = [];
    while (a.length && out.length < n) {
      out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    }
    return out;
  }

  function placeLine(p) {
    var bits = [p.name + " (" + p.region + ")"];
    if (p.meta) bits.push(p.meta);
    if (p.text) bits.push(p.text.split(".")[0].trim());
    return bits.join(" — ");
  }

  function findPlacesByTopic(places, topic) {
    var t = normalize(topic);
    return places.filter(function (p) {
      var blob =
        normalize(
          (p.name || "") +
            " " +
            (p.region || "") +
            " " +
            (p.tags || []).join(" ") +
            " " +
            (p.interests || []).join(" ") +
            " " +
            (p.text || "")
        );
      return blob.indexOf(t) !== -1;
    });
  }

  function matchPlaceFromQuery(places, t) {
    var hits = [];
    places.forEach(function (p) {
      var n = normalize(p.name);
      if (t.indexOf(n) !== -1 || n.indexOf(t) !== -1) hits.push(p);
    });
    return hits;
  }

  function scoreForChat(place, prefs) {
    var sc = 0;
    var ub = Number(prefs.budget) || 2;
    if (place.budget <= ub) sc += 2;
    (prefs.interests || []).forEach(function (it) {
      if (
        (place.tags || []).some(function (x) {
          return normalize(x).indexOf(normalize(it)) !== -1;
        })
      )
        sc += 2;
    });
    if (place.top) sc += 1;
    return sc;
  }

  function rankedForPrefs(places, prefs) {
    return places
      .map(function (p) {
        return { p: p, s: scoreForChat(p, prefs) };
      })
      .sort(function (a, b) {
        return b.s - a.s;
      });
  }

  function summerPicks(places) {
    return places.filter(function (p) {
      var tags = (p.tags || []).join(" ");
      return (
        tags.indexOf("biển") !== -1 ||
        normalize(p.name).indexOf("nha trang") !== -1 ||
        normalize(p.name).indexOf("phu quoc") !== -1 ||
        normalize(p.name).indexOf("da nang") !== -1
      );
    });
  }

  function coolClimatePicks(places) {
    return places.filter(function (p) {
      var n = normalize(p.name);
      return (
        n.indexOf("da lat") !== -1 ||
        n.indexOf("sa pa") !== -1 ||
        n.indexOf("sapa") !== -1
      );
    });
  }

  function cultureFoodPicks(places) {
    return places.filter(function (p) {
      return (
        (p.tags || []).indexOf("văn hóa") !== -1 ||
        (p.tags || []).indexOf("ẩm thực") !== -1
      );
    });
  }

  function suggestFromData(places, prefs, intro) {
    var ranked = rankedForPrefs(places, prefs);
    var chosen = ranked.slice(0, 4).map(function (x) {
      return x.p;
    });
    if (chosen.length < 3) {
      var extra = pick(
        places.filter(function (p) {
          return chosen.indexOf(p) === -1;
        }),
        4 - chosen.length
      );
      chosen = chosen.concat(extra);
    }
    var lines = chosen.slice(0, 4).map(placeLine);
    return (
      intro +
      "\n\n• " +
      lines.join("\n\n• ") +
      "\n\n(Bạn có thể tinh chỉnh thêm ở mục «Tìm theo bạn» trên trang.)"
    );
  }

  function wanderChatReply(userText, ctx) {
    var places = ctx.places || global.WANDER_PLACES || [];
    var prefs = ctx.getPrefs ? ctx.getPrefs() : { interests: [], habits: [], budget: 2 };
    if (!prefs.interests) prefs.interests = [];
    if (!prefs.habits) prefs.habits = [];

    var raw = (userText || "").trim();
    var t = normalize(raw);
    if (!t) {
      var samples = pick(
        [
          "Đi Đà Nẵng hay Nha Trang hè này?",
          "Sa Pa mùa nào đẹp?",
          "Đi một mình nên chọn đâu?",
          "Ngân sách 5 triệu đi được đâu 3 ngày?"
        ],
        2
      );
      return (
        "Bạn gõ câu hỏi tự nhiên là được — mình sẽ ghép gợi ý từ bảng điểm đến trên site.\n\n" +
        "Ví dụ: «" +
        samples.join("» hoặc «") +
        "»."
      );
    }

    if (
      t.indexOf("ban la ai") !== -1 ||
      t.indexOf("la ai") !== -1 ||
      t.indexOf("who are") !== -1 ||
      t.indexOf("may la ai") !== -1 ||
      t === "ai"
    ) {
      return (
        "Mình không phải người thật: chỉ là lớp gợi ý chạy trên trình duyệt, đọc dữ liệu địa điểm + sở thích bạn đã lưu " +
        "(nếu có) để trả lời. Không thay thế hướng dẫn viên hay thông tin visa/chính thức."
      );
    }

    if (
      t.indexOf("chao") === 0 ||
      t.indexOf("xin chao") !== -1 ||
      t.indexOf("hi") === 0 ||
      t.indexOf("hello") !== -1 ||
      t.indexOf("hey") === 0
    ) {
      var r = rankedForPrefs(places, prefs)[0];
      var tail = r
        ? " Hiện tại theo bộ lọc của bạn, " + r.p.name + " đang có độ khớp tốt."
        : "";
      return "Chào bạn — hỏi thoải mái về điểm đến, mùa đi, ngân sách, an toàn hoặc tên một tỉnh cụ thể." + tail;
    }

    var named = matchPlaceFromQuery(places, t);
    if (named.length === 1) {
      var p = named[0];
      var act = (p.activities || [])
        .slice(0, 2)
        .map(function (a) {
          return a.dayPart + ": " + a.title + " — " + a.tip;
        })
        .join("\n");
      return (
        placeLine(p) +
        "\n\nDi chuyển: " +
        (p.transportTips || "xem thêm trên trang chi tiết địa điểm.") +
        (act ? "\n\nGợi ý hoạt động:\n" + act : "")
      );
    }

    var summer =
      t.indexOf("mua he") !== -1 ||
      t.indexOf("mua ha") !== -1 ||
      t.indexOf(" mua he ") !== -1 ||
      t.indexOf("trong he") !== -1 ||
      t.indexOf("he nay") !== -1 ||
      t.indexOf("summer") !== -1 ||
      t.indexOf("thang 6") !== -1 ||
      t.indexOf("thang 7") !== -1 ||
      t.indexOf("thang 8") !== -1 ||
      t.indexOf("thang6") !== -1 ||
      t.indexOf("nang nong") !== -1;
    if (summer) {
      var sp = summerPicks(places);
      if (!sp.length) sp = pick(places, 3);
      else sp = pick(sp, Math.min(4, sp.length));
      var lines = sp.map(placeLine);
      return (
        "Hè miền Bắc/Trung thường nóng ẩm; miền Nam mưa rào nhưng vẫn đi biển được nếu xem dự báo. Một vài hướng từ dữ liệu site (ưu tiên biển / nghỉ):\n\n• " +
        lines.join("\n\n• ") +
        "\n\nNhớ kem chống nắng, tránh giờ nắng gắt 11–15h."
      );
    }

    var winter =
      t.indexOf("mua dong") !== -1 ||
      t.indexOf("lanh") !== -1 ||
      t.indexOf("ret") !== -1 ||
      t.indexOf("thang 12") !== -1 ||
      t.indexOf("thang 1") !== -1 ||
      t.indexOf("tuyet") !== -1;
    if (winter) {
      var cp = coolClimatePicks(places);
      if (!cp.length) cp = pick(places, 2);
      return (
        "Khi trời lạnh/đông, khách thường tìm cao nguyên hoặc chỗ có sương mù. Từ danh sách hiện tại:\n\n• " +
        cp.map(placeLine).join("\n\n• ") +
        "\n\nMang áo khoác, giày chống trơn nếu trekking và kiểm tra dự báo theo ngày."
      );
    }

    if (
      t.indexOf("di dau") !== -1 ||
      t.indexOf("nen di") !== -1 ||
      t.indexOf("goi y") !== -1 ||
      t.indexOf("cho nao hay") !== -1 ||
      t.indexOf("du lich o dau") !== -1 ||
      t.indexOf("dia diem") !== -1
    ) {
      return suggestFromData(
        places,
        prefs,
        "Tuỳ sở thích và ngân sách bạn đã lưu (mặc định «vừa phải» nếu chưa chọn), mình ưu tiên các điểm sau:"
      );
    }

    if (t.indexOf("visa") !== -1) {
      return (
        "Quy định visa / e-visa / miễn thị thực **phụ thuộc quốc tịch** và thay đổi theo thời điểm. Bạn cần đối chiếu site **Bộ Ngoại giao / Cục Xuất nhập cảnh Việt Nam** hoặc ĐSQ/LSQ tại nước bạn — mình không cấp xác nhận pháp lý."
      );
    }
    if (
      t.indexOf("ngan sach") !== -1 ||
      t.indexOf("tiet kiem") !== -1 ||
      t.indexOf("bao nhieu tien") !== -1 ||
      t.indexOf("chi phi") !== -1 ||
      /\bre\b/.test(t) ||
      raw.indexOf("rẻ") !== -1
    ) {
      var budgetNames = places
        .filter(function (p) {
          return p.budget <= 2;
        })
        .slice(0, 4);
      if (!budgetNames.length) budgetNames = pick(places, 3);
      return (
        "Chi phí phụ thuộc vé, phòng, lễ và đi gu — mình chỉ gợi hướng. Các điểm trong data thường **nhẹ ví** hơn gồm: " +
        budgetNames.map(function (p) {
          return p.name + " (" + budgetLabel(p.budget) + ")";
        }).join(", ") +
        ". Kết hợp vé sớm + homestay/3 sao + ăn quán địa phương thường hợp túi."
      );
    }
    if (
      t.indexOf("an toan") !== -1 ||
      t.indexOf("trom") !== -1 ||
      t.indexOf("lua dao") !== -1
    ) {
      return (
        "Thực tế: mang **bản sao** giấy tờ, không để ví điện thoại lộ thùng xe, ở chợ đông đúc dùng túi đóng; về khuya ưu tiên xe công nghệ/taxi biển màu. Ở biển/vịnh bám **cờ an toàn** và chỉ lặn/snorkel khi đủ điều kiện. Thông tin y tế — gọi dịch vụ cấp cứu địa phương khi cần."
      );
    }
    if (
      t.indexOf("di mot minh") !== -1 ||
      t.indexOf("solo") !== -1 ||
      t.indexOf("mot minh") !== -1
    ) {
      var solo = cultureFoodPicks(places).length
        ? cultureFoodPicks(places)
        : places;
      return (
        "Đi một mình: chọn nơi có **hạ tầng dễ** (thành phố, phố cổ, nhiều Grab). Gợi ý từ data: " +
        pick(solo, 3)
          .map(function (p) {
            return p.name;
          })
          .join(", ") +
        ". Chia sẻ lịch trình với người thân và giữ pin/internet."
      );
    }
    if (t.indexOf("ha long") !== -1 || t.indexOf("halong") !== -1) {
      var hl = places.find(function (p) {
        return normalize(p.name).indexOf("ha long") !== -1;
      });
      return hl
        ? placeLine(hl) +
            "\n\nSo sánh tour ngày/đêm và phụ phí kayak; mang áo gió nếu đi thuyền sớm/sương."
        : "Vịnh Hạ Long (Quảng Ninh): tour thuyền trong ngày hoặc qua đêm — đọc kỹ điểm dừng; từ Hà Nội ~2.5–3 giờ ô tô.";
    }
    if (t.indexOf("sapa") !== -1 || t.indexOf("sa pa") !== -1) {
      var spObj = places.find(function (p) {
        return normalize(p.name).indexOf("sa pa") !== -1;
      });
      return spObj
        ? placeLine(spObj) +
            "\n\nLưu ý: đêm lạnh quanh năm so với đồng bằng; trekking cần giày bám tốt."
        : "Sa Pa: ruộng bậc thang, trekking; lạnh về đêm — mang áo ấm.";
    }
    if (t.indexOf("phu quoc") !== -1) {
      var pq = places.find(function (p) {
        return normalize(p.name).indexOf("phu quoc") !== -1;
      });
      return pq
        ? placeLine(pq) +
            "\n\nNắng gắt: SPF, nón; hỏi rõ giá/kg hải sản trước khi chọn món."
        : "Phú Quốc: biển quanh năm; thuê xe hoặc taxi hợp đồng nếu muốn Nam đảo.";
    }
    if (
      t.indexOf("mui nao") !== -1 ||
      t.indexOf("mua nao") !== -1 ||
      t.indexOf("thoi tiet") !== -1
    ) {
      return (
        "Bắc: rét/mưa phùn theo mùa; Trung: **mưa bão** tập trung khoảng tháng 9–11 từng năm theo vùng; Nam: mưa nhưng thường vẫn cởi mở cho ngắn ngày. Luôn xem **dự báo 3–7 ngày** trước khi book vé máy bay/bè."
      );
    }

    var topicHits = [];
    ["trekking", "bien", "ẩm thực", "phố cổ", "resort"].forEach(function (kw) {
      if (t.indexOf(normalize(kw)) !== -1) {
        topicHits = topicHits.concat(findPlacesByTopic(places, kw));
      }
    });
    var seen = {};
    topicHits = topicHits.filter(function (p) {
      if (seen[p.id]) return false;
      seen[p.id] = true;
      return true;
    });
    if (topicHits.length) {
      return (
        "Liên quan «" +
        raw.slice(0, 40) +
        "», từ bảng địa điểm hiện có:\n\n• " +
        pick(topicHits, Math.min(4, topicHits.length))
          .map(placeLine)
          .join("\n\n• ")
      );
    }

    return suggestFromData(
      places,
      prefs,
      "Mình không khớp từ khóa rõ ràng — dưới đây là vài điểm ghép theo sở thích/ngân sách bạn đã lưu (hoặc ngẫu nhiên nếu chưa có):"
    );
  }

  function budgetLabel(n) {
    if (n <= 1) return "tiết kiệm";
    if (n >= 3) return "cao cấp hơn";
    return "vừa phải";
  }

  global.wanderChatReply = wanderChatReply;
})(window);
