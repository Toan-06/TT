(function () {
  "use strict";

  // PLACES sẽ được nạp từ API MongoDB, fallback về dữ liệu tĩnh nếu API lỗi
  var PLACES = [];
  var userPos = null; // Tọa độ GPS người dùng
  var routeLayer = null; // Layer vẽ đường đi OSRM
  var transportMode = "driving"; // "driving" (ô tô) hoặc "motorcycle" (xe máy)

  async function loadPlacesFromAPI() {
    try {
      var res = await fetch('/api/places');
      var json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        PLACES = json.data;
        return true;
      }
    } catch (e) {
      console.warn('Không thể tải từ API, dùng dữ liệu tĩnh:', e);
    }
    // Fallback: dùng dữ liệu tĩnh từ places-data.js
    if (Array.isArray(window.WANDER_PLACES) && window.WANDER_PLACES.length > 0) {
      PLACES = window.WANDER_PLACES;
    }
    return false;
  }

  var STORAGE = {
    users: "wander_users",
    session: "wander_session",
    prefs: "wander_prefs",
    profile: "wander_profile",
    trips: "wander_trips",
    wishlist: "wander_wishlist",
    tripDraft: "wander_trip_draft"
  };

  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      /* ignore quota */
    }
  }

  function normalize(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getSession() {
    return loadJSON(STORAGE.session, null);
  }

  function setSession(email) {
    if (email) saveJSON(STORAGE.session, { email: email });
    else localStorage.removeItem(STORAGE.session);
  }

  function getUsers() {
    return loadJSON(STORAGE.users, []);
  }

  function getPrefs() {
    return loadJSON(STORAGE.prefs, {
      budget: 2,
      pace: "vua",
      interests: [],
      habits: []
    });
  }

  function savePrefs(p) {
    saveJSON(STORAGE.prefs, p);
  }

  function getProfile() {
    var sess = getSession();
    var all = loadJSON(STORAGE.profile, {});
    if (sess && sess.email && all[sess.email]) return all[sess.email];
    return { displayName: "", notes: "" };
  }

  function saveProfileForUser(email, profile) {
    var all = loadJSON(STORAGE.profile, {});
    all[email] = profile;
    saveJSON(STORAGE.profile, all);
  }

  function getWishlist() {
    return loadJSON(STORAGE.wishlist, []);
  }

  function setWishlist(ids) {
    saveJSON(STORAGE.wishlist, ids);
  }

  function toggleWish(placeId) {
    var w = getWishlist();
    var i = w.indexOf(placeId);
    if (i === -1) w.push(placeId);
    else w.splice(i, 1);
    setWishlist(w);
    return i === -1;
  }

  function budgetLabel(n) {
    if (n <= 1) return "Tiết kiệm";
    if (n >= 3) return "Cao cấp";
    return "Vừa phải";
  }

  function paceVi(p) {
    if (p === "cham") return "Thong thả";
    if (p === "nhanh") return "Năng động";
    return "Cân bằng";
  }

  function scorePlace(place, prefs) {
    var sc = 0;
    var reasons = [];
    var ub = Number(prefs.budget) || 2;
    if (place.budget <= ub) {
      sc += 3;
      reasons.push("Ngân sách phù hợp");
    } else if (place.budget === ub + 1) {
      sc += 1;
      reasons.push("Hơi cao hơn mức chọn");
    }
    if (prefs.pace && place.pace === prefs.pace) {
      sc += 2;
      reasons.push("Nhịp chuyến khớp");
    }
    var ints = prefs.interests || [];
    ints.forEach(function (it) {
      var low = normalize(it);
      var hit =
        place.tags.some(function (t) {
          return normalize(t).indexOf(low) !== -1;
        }) ||
        (place.interests || []).some(function (x) {
          return normalize(x).indexOf(low) !== -1;
        });
      if (hit) {
        sc += 2;
        reasons.push("Sở thích: " + it);
      }
    });
    (prefs.habits || []).forEach(function (h) {
      if ((place.habits || []).indexOf(h) !== -1) {
        sc += 2;
        reasons.push("Thói quen: " + h);
      }
    });
    if (place.top) sc += 1;
    return { score: sc, reasons: reasons };
  }

  function sortByScore(prefs) {
    return PLACES.map(function (p) {
      var r = scorePlace(p, prefs);
      return { place: p, score: r.score, reasons: r.reasons };
    }).sort(function (a, b) {
      return b.score - a.score;
    });
  }

  /* ——— Header / nav ——— */
  var header = document.querySelector("[data-header]");
  var navToggle = document.querySelector("[data-nav-toggle]");
  var siteNav = document.querySelector("[data-nav]");

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function setNavOpen(open) {
    if (siteNav) siteNav.classList.toggle("is-open", open);
    if (header) header.classList.toggle("is-nav-open", open);
    if (navToggle) navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", function () {
      setNavOpen(!siteNav.classList.contains("is-open"));
    });
    siteNav.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function () {
        setNavOpen(false);
      });
    });
  }

  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ——— Modals ——— */
  var backdrop = document.querySelector("[data-modal-backdrop]");

  function openModal(name) {
    var m = document.querySelector('[data-modal="' + name + '"]');
    if (!m) return;
    m.hidden = false;
    
    var useBackdrop = true;

    if (m.classList.contains('slide-drawer')) {
      requestAnimationFrame(function() {
        m.classList.add('is-open');
      });
      // Don't lock scroll for slide relative drawers, keep it multitasking
      if (name === 'place') {
        useBackdrop = false; // no backdrop for place to allow map scrolling
      } else {
        document.documentElement.style.overflow = "hidden";
      }
    } else {
      document.documentElement.style.overflow = "hidden";
    }

    if (backdrop && useBackdrop) backdrop.hidden = false;
    var closeBtn = m.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.focus();
  }

  function closeModals() {
    document.querySelectorAll("[data-modal]").forEach(function (m) {
      if (m.classList.contains('slide-drawer')) {
        m.classList.remove('is-open');
        setTimeout(function() {
          if (!m.classList.contains('is-open')) m.hidden = true;
        }, 350);
      } else {
        m.hidden = true;
      }
    });
    if (backdrop) backdrop.hidden = true;
    document.documentElement.style.overflow = "";
  }

  document.querySelectorAll("[data-modal-close]").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeModals();
    });
  });
  if (backdrop)
    backdrop.addEventListener("click", closeModals);

  document.querySelectorAll("[data-modal]").forEach(function (modalEl) {
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) closeModals();
    });
  });
  var authOpenBtn = document.querySelector("[data-auth-open]");
  if (authOpenBtn)
    authOpenBtn.addEventListener("click", function () {
      openModal("auth");
    });

  /* Auth tabs */
  var authTabs = document.querySelectorAll("[data-auth-tab]");
  var authPanels = document.querySelectorAll("[data-auth-panel]");
  authTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("data-auth-tab");
      authTabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      authPanels.forEach(function (p) {
        p.hidden = p.getAttribute("data-auth-panel") !== id;
      });
    });
  });

  function showAuthMsg(el, text, ok) {
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", !ok && !!text);
    el.classList.toggle("is-ok", !!ok && !!text);
  }

  var loginForm = document.querySelector('[data-auth-panel="login"]');
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(loginForm);
      var email = String(fd.get("email") || "").trim().toLowerCase();
      var password = String(fd.get("password") || "");
      var msg = loginForm.querySelector("[data-auth-msg-login]");
      
      try {
        var res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, password: password })
        });
        var json = await res.json();
        if (!json.success) {
          showAuthMsg(msg, json.message || "Đăng nhập thất bại.", false);
          return;
        }
        setSession(email);
        localStorage.setItem("wander_token", json.token);
        saveProfileForUser(email, json.user);
        
        showAuthMsg(msg, "Đăng nhập thành công.", true);
        window.setTimeout(function () {
          closeModals();
          loginForm.reset();
          showAuthMsg(msg, "", true);
          refreshAuthUI();
        }, 400);
      } catch (err) {
        showAuthMsg(msg, "Lỗi kết nối máy chủ.", false);
      }
    });
  }

  var regForm = document.querySelector('[data-auth-panel="register"]');
  if (regForm) {
    regForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(regForm);
      var name = String(fd.get("name") || "").trim();
      var email = String(fd.get("email") || "").trim().toLowerCase();
      var password = String(fd.get("password") || "");
      var msg = regForm.querySelector("[data-auth-msg-register]");
      
      try {
        var res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, email: email, password: password })
        });
        var json = await res.json();
        if (!json.success) {
          showAuthMsg(msg, json.message || "Đăng ký thất bại.", false);
          return;
        }
        setSession(email);
        localStorage.setItem("wander_token", json.token);
        saveProfileForUser(email, json.user);

        showAuthMsg(msg, "Tạo tài khoản thành công. Bạn đã được đăng nhập.", true);
        window.setTimeout(function () {
          closeModals();
          regForm.reset();
          showAuthMsg(msg, "", true);
          refreshAuthUI();
        }, 500);
      } catch (err) {
        showAuthMsg(msg, "Lỗi kết nối máy chủ.", false);
      }
    });
  }

  var userBubble = document.querySelector("[data-user-bubble]");
  var authBtn = document.querySelector("[data-auth-open]");
  var userToggle = document.querySelector("[data-user-toggle]");
  var userDropdown = document.querySelector("[data-user-dropdown]");
  var userInitial = document.querySelector("[data-user-initial]");
  var userAvatarImg = document.querySelector("[data-user-avatar]");
  var userNameEl = document.querySelector("[data-user-name]");
  var openProfileBtn = document.querySelector("[data-open-profile]");
  var adminLink = document.querySelector("[data-admin-link]");
  var logoutBtn = document.querySelector("[data-logout]");

  function refreshAuthUI() {
    var sess = getSession();
    if (sess && sess.email) {
      if (authBtn) authBtn.hidden = true;
      if (userBubble) userBubble.hidden = false;
      var prof = getProfile() || {};
      var dis = prof.displayName || prof.name || sess.email.split("@")[0];

      // Hiển thị avatar hoặc chữ cái đầu trong nút tròn header
      if (userAvatarImg && prof.avatar) {
        userAvatarImg.src = prof.avatar;
        userAvatarImg.removeAttribute('hidden');
        userAvatarImg.style.display = 'block';
        if (userInitial) userInitial.style.display = 'none';
      } else {
        if (userAvatarImg) { userAvatarImg.setAttribute('hidden', ''); userAvatarImg.style.display = 'none'; }
        if (userInitial) {
          userInitial.textContent = dis.charAt(0).toUpperCase();
          userInitial.style.display = 'block';
        }
      }

      if (adminLink && prof.isAdmin) {
        adminLink.hidden = false;
      } else if (adminLink) {
        adminLink.hidden = true;
      }

      if (userNameEl) {
        userNameEl.innerHTML = "";
        var nameStrong = document.createElement("strong");
        nameStrong.textContent = dis;
        userNameEl.appendChild(nameStrong);
        var small = document.createElement("span");
        small.className = "user-dropdown__email";
        small.style.cssText =
          "display:block;font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem;";
        small.textContent = sess.email;
        userNameEl.appendChild(small);
      }
    } else {
      if (authBtn) authBtn.hidden = false;
      if (userBubble) userBubble.hidden = true;
      if (userNameEl) userNameEl.innerHTML = "";
    }
    updateContactPrefill();
    renderPersonalSection();
  }

  // Helper: Cập nhật preview trong modal hồ sơ
  function applyAvatarPreview(base64) {
    var previewImg = document.querySelector('[data-avatar-preview-img]');
    var previewInitial = document.querySelector('[data-avatar-preview-initial]');
    var sess = getSession();
    var prof = getProfile() || {};
    var dis = (prof.displayName || prof.name || (sess && sess.email ? sess.email.split('@')[0] : '')) || '?';
    if (base64) {
      if (previewImg) { previewImg.src = base64; previewImg.removeAttribute('hidden'); }
      if (previewInitial) previewInitial.style.display = 'none';
    } else {
      if (previewImg) { previewImg.setAttribute('hidden', ''); previewImg.src = ''; }
      if (previewInitial) { previewInitial.style.display = 'flex'; previewInitial.textContent = dis.charAt(0).toUpperCase() || '?'; }
    }
  }

  function toggleUserMenu(open) {
    if (!userDropdown || !userToggle) return;
    userDropdown.hidden = !open;
    userToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (userToggle && userDropdown) {
    userToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleUserMenu(userDropdown.hidden);
    });
    document.addEventListener("click", function () {
      toggleUserMenu(false);
    });
  }

  if (openProfileBtn)
    openProfileBtn.addEventListener("click", function () {
      toggleUserMenu(false);
      var f = document.querySelector("[data-profile-form]");
      if (f) {
        var p = getProfile();
        if (f.elements.displayName) f.elements.displayName.value = p.displayName || p.name || "";
        if (f.elements.notes) f.elements.notes.value = p.notes || "";
        if (f.elements.phone) f.elements.phone.value = p.phone || "";
        // Reset file input & load avatar preview
        var fileInput = f.querySelector('[data-avatar-file-input]');
        if (fileInput) fileInput.value = '';
        applyAvatarPreview(p.avatar || null);
      }
      openModal("profile");
    });

  // File input: đọc ảnh và cập nhật preview ngay lập tức
  var avatarFileInput = document.querySelector('[data-avatar-file-input]');
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', function () {
      var file = this.files && this.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 2 MB.');
        this.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        applyAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  // Nút Xóa ảnh
  var avatarRemoveBtn = document.querySelector('[data-avatar-remove]');
  if (avatarRemoveBtn) {
    avatarRemoveBtn.addEventListener('click', function () {
      var fileInput = document.querySelector('[data-avatar-file-input]');
      if (fileInput) fileInput.value = '';
      // Đánh dấu xóa avatar = lưu chuỗi rỗng
      var sess = getSession();
      if (sess && sess.email) {
        var existing = getProfile();
        saveProfileForUser(sess.email, Object.assign({}, existing, { avatar: '' }));
        refreshAuthUI();
      }
      applyAvatarPreview(null);
    });
  }

  if (logoutBtn)
    logoutBtn.addEventListener("click", function () {
      setSession(null);
      localStorage.removeItem("wander_token");
      toggleUserMenu(false);
      refreshAuthUI();
    });

  var profileForm = document.querySelector("[data-profile-form]");
  if (profileForm) {
    profileForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var sess = getSession();
      if (!sess || !sess.email) return;
      var fd = new FormData(profileForm);

      // Đọc ảnh từ file input (nếu có chọn file mới)
      var fileInput = profileForm.querySelector('[data-avatar-file-input]');
      var file = fileInput && fileInput.files && fileInput.files[0];

      function finishSave(avatarDataUrl) {
        var existing = getProfile();
        // Nếu avatarDataUrl === undefined → giữ nguyên avatar cũ
        var avatarVal = (avatarDataUrl !== undefined) ? avatarDataUrl : (existing.avatar || '');
        var newProf = {
          displayName: String(fd.get("displayName") || "").trim(),
          notes: String(fd.get("notes") || "").trim(),
          phone: String(fd.get("phone") || "").trim(),
          avatar: avatarVal
        };

        var token = localStorage.getItem('wander_token');
        if (token) {
          // Gửi lên server (không gửi base64 lớn, chỉ gửi metadata text)
          fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({ displayName: newProf.displayName, notes: newProf.notes, phone: newProf.phone, avatar: newProf.avatar })
          }).catch(function() {});
        }

        saveProfileForUser(sess.email, Object.assign({}, existing, newProf));
        var st = profileForm.querySelector("[data-profile-status]");
        if (st) { st.textContent = "✔ Đã lưu hồ sơ."; st.style.color = 'var(--accent)'; }
        refreshAuthUI();
        window.setTimeout(function () { if (st) { st.textContent = ""; st.style.color = ''; } }, 2500);
      }

      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          alert('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 2 MB.');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) { finishSave(ev.target.result); };
        reader.readAsDataURL(file);
      } else {
        // Không chọn file mới → giữ avatar hiện tại
        finishSave(undefined);
      }
    });
  }

  var passwordForm = document.querySelector("[data-password-form]");
  if (passwordForm) {
    passwordForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(passwordForm);
      var oldPass = fd.get("oldPassword");
      var newPass = fd.get("newPassword");
      var statusEl = passwordForm.querySelector("[data-password-status]");
      
      var token = localStorage.getItem("wander_token");
      if (!token) {
        statusEl.textContent = "Vui lòng đăng nhập.";
        return;
      }
      
      statusEl.textContent = "Đang cập nhật...";
      statusEl.style.color = "var(--text-muted)";
      
      try {
        var res = await fetch('/api/auth/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
          body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
        });
        var json = await res.json();
        if (json.success) {
          statusEl.textContent = "✔ Đổi mật khẩu thành công!";
          statusEl.style.color = "#4ade80"; // green-400
          passwordForm.reset();
        } else {
          statusEl.textContent = "✖ " + (json.message || "Lỗi cập nhật mật khẩu");
          statusEl.style.color = "#f87171"; // red-400
        }
      } catch(err) {
        statusEl.textContent = "✖ Lỗi kết nối đến máy chủ";
        statusEl.style.color = "#f87171";
      }
      setTimeout(function() { if(statusEl) statusEl.textContent = ""; }, 4000);
    });
  }

  var profileSync = document.querySelector("[data-profile-sync]");
  if (profileSync)
    profileSync.addEventListener("click", function () {
      var prefs = readSmartForm();
      savePrefs(prefs);
      var st = profileForm && profileForm.querySelector("[data-profile-status]");
      if (st) st.textContent = "Đã đồng bộ sở thích từ form tìm kiếm.";
      renderPersonalSection();
    });

  function readSmartForm() {
    var form = document.querySelector("[data-smart-form]");
    if (!form) return getPrefs();
    var fd = new FormData(form);
    var budget = Number(fd.get("budget")) || 2;
    var pace = fd.get("pace") || "vua";
    var interests = [];
    form.querySelectorAll('input[name="interest"]:checked').forEach(function (i) {
      interests.push(i.value);
    });
    var habits = [];
    form.querySelectorAll('input[name="habit"]:checked').forEach(function (i) {
      habits.push(i.value);
    });
    return { budget: budget, pace: pace, interests: interests, habits: habits };
  }

  function fillSmartForm(prefs) {
    var form = document.querySelector("[data-smart-form]");
    if (!form) return;
    form.querySelectorAll('[name="budget"]').forEach(function (r) {
      r.checked = String(r.value) === String(prefs.budget);
    });
    form.querySelectorAll('[name="pace"]').forEach(function (r) {
      r.checked = r.value === prefs.pace;
    });
    form.querySelectorAll('[name="interest"]').forEach(function (c) {
      c.checked = (prefs.interests || []).indexOf(c.value) !== -1;
    });
    form.querySelectorAll('[name="habit"]').forEach(function (c) {
      c.checked = (prefs.habits || []).indexOf(c.value) !== -1;
    });
  }

  var smartForm = document.querySelector("[data-smart-form]");
  if (smartForm) {
    fillSmartForm(getPrefs());
    smartForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var prefs = readSmartForm();
      savePrefs(prefs);
      var ranked = sortByScore(prefs);
      renderSmartResults(ranked);
      var hint = document.querySelector("[data-smart-hint]");
      if (hint) {
        hint.hidden = false;
        hint.textContent = "Đã cập nhật tiêu chí — danh sách bên dưới, trang chủ cá nhân hóa đã làm mới.";
      }
      renderPersonalSection();
    });
  }

  var savePrefsBtn = document.querySelector("[data-save-prefs]");
  if (savePrefsBtn)
    savePrefsBtn.addEventListener("click", function () {
      var prefs = readSmartForm();
      savePrefs(prefs);
      var hint = document.querySelector("[data-smart-hint]");
      if (hint) {
        hint.hidden = false;
        hint.textContent = "Đã lưu vào hồ sơ trình duyệt (sở thích & thói quen).";
      }
      renderPersonalSection();
    });

  function renderSmartResults(ranked) {
    var box = document.querySelector("[data-smart-results]");
    if (!box) return;
    box.innerHTML = "";
    ranked.forEach(function (row) {
      var p = row.place;
      var el = document.createElement("article");
      el.className = "smart-result";
      el.innerHTML =
        "<div><h3 class=\"dest-card-title\" style=\"margin:0 0 0.25rem\">" +
        escapeHtml(p.name) +
        '</h3><p style="margin:0;font-size:0.85rem;color:var(--accent)">' +
        escapeHtml(p.region) +
        "</p><p>" +
        escapeHtml(p.text) +
        '</p><div class="dest-card-actions">' +
        '<button type="button" class="btn btn--ghost btn--small" data-smart-detail="' +
        escapeAttr(p.id) +
        '">Chi tiết</button>' +
        '<button type="button" class="btn btn--primary btn--small" data-add-plan="' +
        escapeAttr(p.id) +
        '">Thêm vào lịch</button></div></div>' +
        '<div class="smart-result__score">Điểm: ' +
        row.score +
        "</div>";
      var sub = document.createElement("p");
      sub.style.fontSize = "0.82rem";
      sub.style.marginTop = "0.35rem";
      sub.textContent = row.reasons.length ? row.reasons.join(" · ") : "Gợi ý chung";
      el.querySelector("div").appendChild(sub);
      box.appendChild(el);
    });
    box.querySelectorAll("[data-smart-detail]").forEach(function (b) {
      b.addEventListener("click", function () {
        openPlaceModal(b.getAttribute("data-smart-detail"));
      });
    });
    box.querySelectorAll("[data-add-plan]").forEach(function (b) {
      b.addEventListener("click", function () {
        addStopById(b.getAttribute("data-add-plan"));
        var pl = document.getElementById("planner");
        if (pl) pl.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }

  /* ——— Destination grid ——— */
  var destGrid = document.querySelector("[data-dest-grid]");
  var filterBtns = document.querySelectorAll("[data-dest-filter]");
  var searchInput = document.querySelector("[data-search-input]");
  var searchEmpty = document.querySelector("[data-search-empty]");
  var chipBtns = document.querySelectorAll("[data-filter-tag]");
  var currentFilter = "all";

  function wishIsOn(id) {
    return getWishlist().indexOf(id) !== -1;
  }

  function renderDestCards() {
    if (!destGrid) return;
    destGrid.innerHTML = "";
    PLACES.forEach(function (p) {
      var tags = (p.tags || []).join(" ");
      var art = document.createElement("article");
      art.className = "dest-card";
      art.setAttribute("data-tags", tags);
      art.setAttribute("data-place-id", p.id);
      var topBadge = p.top ? '<span class="dest-badge">Top</span>' : "";
      var wOn = wishIsOn(p.id) ? " is-on" : "";
      art.innerHTML =
        '<div class="dest-card-media" style="--img: url(\'' +
        String(p.image).replace(/'/g, "\\'") +
        "');\">" +
        topBadge +
        '</div><div class="dest-card-body"><div class="dest-meta-row">' +
        '<span class="dest-pill">' +
        budgetLabel(p.budget) +
        '</span><span class="dest-pill">' +
        paceVi(p.pace) +
        '</span></div><h3 class="dest-card-title">' +
        escapeHtml(p.name) +
        '</h3><p class="dest-card-meta">' +
        escapeHtml(p.region) +
        " · " +
        escapeHtml(p.meta) +
        '</p><p class="dest-card-text">' +
        escapeHtml(p.text) +
        '</p><div class="dest-card-actions">' +
        '<button type="button" class="btn btn--ghost btn--small dest-wish' +
        wOn +
        '" data-wish="' +
        escapeAttr(p.id) +
        '">' +
        (wishIsOn(p.id) ? '♥ Đã lưu' : '♡ Yêu thích') +
        (p.favoritesCount ? ' <span class="wish-count">' + p.favoritesCount + '</span>' : '') +
        '</button><button type="button" class="btn btn--primary btn--small" data-detail="' +
        escapeAttr(p.id) +
        '">Chi tiết</button>' +
        '<button type="button" class="btn btn--ghost btn--small btn-add-trip" data-add-stop-id="' +
        escapeAttr(p.id) +
        '">+ Lịch</button></div></div>';
      destGrid.appendChild(art);
    });
  }

  function cardMatchesFilter(card, filter) {
    if (filter === "all") return true;
    var tags = (card.getAttribute("data-tags") || "").toLowerCase();
    return tags.indexOf(filter.toLowerCase()) !== -1;
  }

  function cardMatchesSearch(card, q) {
    if (!q) return true;
    var text = normalize(card.textContent || "");
    return text.indexOf(normalize(q)) !== -1;
  }

  function applyDestFilters() {
    if (!destGrid) return;
    var q = searchInput ? searchInput.value.trim() : "";
    var visible = 0;
    destGrid.querySelectorAll(".dest-card").forEach(function (card) {
      var show =
        cardMatchesFilter(card, currentFilter) && cardMatchesSearch(card, q);
      card.classList.toggle("is-hidden", !show);
      if (show) visible++;
    });
    if (searchEmpty) {
      var hideMsg = visible > 0;
      searchEmpty.classList.toggle("visually-hidden", hideMsg);
      searchEmpty.setAttribute("aria-hidden", hideMsg ? "true" : "false");
    }
  }

  function bindDestInteractions() {
    if (!destGrid) return;
    destGrid.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest("[data-detail]"))
        openPlaceModal(t.closest("[data-detail]").getAttribute("data-detail"));
      var w = t.closest("[data-wish]");
      if (w) {
        var id = w.getAttribute("data-wish");
        var on = toggleWish(id);
        w.classList.toggle("is-on", on);
        // Gọi API MongoDB để cập nhật lượt yêu thích
        fetch('/api/places/' + id + '/favorite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: on ? 'add' : 'remove' })
        }).then(function(res) { return res.json(); }).then(function(json) {
          if (json.success) {
            // Cập nhật count trong mảng PLACES
            var place = PLACES.find(function(p) { return p.id === id; });
            if (place) place.favoritesCount = json.favoritesCount;
            // Cập nhật hiển thị chỉ số lượt thích trên nút
            var countEl = w.querySelector('.wish-count');
            if (json.favoritesCount > 0) {
              if (!countEl) {
                countEl = document.createElement('span');
                countEl.className = 'wish-count';
                w.appendChild(countEl);
              }
              countEl.textContent = json.favoritesCount;
            } else if (countEl) {
              countEl.remove();
            }
          }
        }).catch(function() {});
        w.innerHTML = (on ? '♥ Đã lưu' : '♡ Yêu thích') +
          (w.querySelector('.wish-count') ? ' <span class="wish-count">' + (w.querySelector('.wish-count').textContent || '') + '</span>' : '');
      }
      var a = t.closest("[data-add-stop-id]");
      if (a) {
        addStopById(a.getAttribute("data-add-stop-id"));
        document.getElementById("planner").scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      currentFilter = btn.getAttribute("data-dest-filter") || "all";
      filterBtns.forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      applyDestFilters();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", applyDestFilters);
    var searchForm = searchInput.closest("form");
    if (searchForm)
      searchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var dest = document.getElementById("destinations");
        if (dest) dest.scrollIntoView({ behavior: "smooth" });
        applyDestFilters();
      });
  }

  chipBtns.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var tag = chip.getAttribute("data-filter-tag");
      if (!tag) return;
      currentFilter = tag;
      filterBtns.forEach(function (b) {
        var f = b.getAttribute("data-dest-filter");
        b.classList.toggle("is-active", f === tag);
      });
      chipBtns.forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
      var dest = document.getElementById("destinations");
      if (dest) dest.scrollIntoView({ behavior: "smooth" });
      applyDestFilters();
    });
  });

  window._poiCache = {};

  async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return resp;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  }

  async function fetchNearbyPOIs(lat, lng, radius = 3000) {
    const query = `
      [out:json][timeout:25];
      (
        nwr["tourism"~"attraction|museum|viewpoint|theme_park"](around:${radius}, ${lat}, ${lng});
        nwr["amenity"~"restaurant|cafe|bar|pub"](around:${radius}, ${lat}, ${lng});
        nwr["tourism"~"hotel|hostel|guest_house|resort"](around:${radius}, ${lat}, ${lng});
        nwr["leisure"~"park|water_park|amusement_arcades"](around:${radius}, ${lat}, ${lng});
      );
      out center;
    `;
    const mirrors = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.osm.ch/api/interpreter",
      "https://lz4.overpass-api.de/api/interpreter"
    ];
    
    for (const mirror of mirrors) {
      const url = mirror + "?data=" + encodeURIComponent(query);
      try {
        const response = await fetchWithTimeout(url, 12000);
        if (!response.ok) continue;
        const data = await response.json();
        return data.elements || [];
      } catch (error) {
        console.error(`Overpass mirror ${mirror} failed:`, error.message);
        continue;
      }
    }
    return [];
  }

  function getPOICategory(item) {
    if (item.tags.amenity === 'restaurant' || item.tags.amenity === 'cafe' || item.tags.amenity === 'bar' || item.tags.amenity === 'pub') return 'eating';
    if (item.tags.tourism === 'hotel' || item.tags.tourism === 'hostel' || item.tags.tourism === 'guest_house' || item.tags.tourism === 'resort') return 'sleeping';
    if (item.tags.tourism === 'attraction' || item.tags.tourism === 'museum' || item.tags.leisure === 'park' || item.tags.leisure === 'water_park' || item.tags.tourism === 'theme_park') return 'playing';
    return 'attraction';
  }

  function getPOIIcon(category) {
    switch (category) {
      case 'eating': return '🍴';
      case 'sleeping': return '🛌';
      case 'playing': return '🎡';
      case 'attraction': return '🏛️';
      default: return '📍';
    }
  }

  function openPlaceModal(id) {
    var p = PLACES.find(function (x) {
      return x.id === id;
    });
    if (!p) return;
    var wrap = document.querySelector("[data-place-detail]");
    if (!wrap) return;

    // Helper to render small cards
    function createCardHtml(item, type, idx) {
      var subtitle = "";
      if (type === 'amusementPlaces') subtitle = "⭐ " + item.rating + "/5";
      else if (type === 'accommodations') subtitle = "🏨 " + (item.priceRange || "Liên hệ");
      else if (type === 'diningPlaces') subtitle = "🍴 " + (item.priceRange || "Giá bình dân");
      else if (type === 'checkInSpots') subtitle = "📸 Điểm check-in nổi tiếng";

      return '<div class="detail-item-card" data-category="' + type + '" data-idx="' + idx + '">' +
               '<div class="detail-item-img" style="background-image:url(\'' + escapeAttr(item.image) + '\')"></div>' +
               '<div class="detail-item-info">' +
                 '<h4 class="detail-item-title">' + escapeHtml(item.name) + '</h4>' +
                 '<div class="detail-item-subtitle">' + subtitle + '</div>' +
               '</div>' +
             '</div>';
    }

    // Helper to render section
    function renderSection(title, list, type, emoji) {
      if (!list || !list.length) return "";
      var cardsHtml = list.map(function(item, idx) {
        return createCardHtml(item, type, idx);
      }).join("");
      
      return '<div class="place-detail__section">' +
               '<h4 class="detail-section-title">' + emoji + ' ' + title + '</h4>' +
               '<div class="detail-card-grid">' + cardsHtml + '</div>' +
             '</div>';
    }

    var acts = (p.activities || [])
      .map(function (a) {
        return (
          '<div class="act-row"><strong>' +
          escapeHtml(a.dayPart) +
          ": " +
          escapeHtml(a.title) +
          "</strong>" +
          escapeHtml(a.tip) +
          "</div>"
        );
      })
      .join("");
      
    var sectionsHtml = 
      renderSection("Các địa điểm vui chơi", p.amusementPlaces, "amusementPlaces", "🎢") +
      renderSection("Nơi nghỉ ngơi lý tưởng", p.accommodations, "accommodations", "🛌") +
      renderSection("Địa điểm ăn uống", p.diningPlaces, "diningPlaces", "🍲") +
      renderSection("Điểm check-in nổi tiếng", p.checkInSpots, "checkInSpots", "🤳");

    var placeViewHtml =
      '<div class="place-view-content">' +
      '<div class="place-detail__media" style="background-image:url(' +
      JSON.stringify(p.image) +
      ')"></div>' +
      '<h3 class="place-detail__title">' +
      escapeHtml(p.name) +
      '</h3><p class="place-detail__meta">' +
      escapeHtml(p.region) +
      " · " +
      budgetLabel(p.budget) +
      " · " +
      paceVi(p.pace) +
      '</p><p style="color:var(--text-muted)">' +
      escapeHtml(p.text) +
      '</p><p style="margin-top:1rem"><strong>Di chuyển:</strong> ' +
      escapeHtml(p.transportTips || "") +
      '</p>' +
      (p.sourceUrl ? '<p style="margin-top:0.5rem;font-size:0.9rem;"><strong>Nguồn tham khảo:</strong> <a href="' + escapeAttr(p.sourceUrl) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;">' + escapeHtml(p.sourceName || "Website chính thức") + '</a></p>' : "") +
      '<div class="place-detail__activities">' +
      acts +
      '</div>' +
      sectionsHtml +
      '<div id="place-map" style="height:250px; border-radius:12px; margin-top:2rem; border:1px solid rgba(148,163,184,0.2); display:none;"></div>' +
      '<div class="dest-card-actions" style="margin-top:1.5rem">' +
      '<button type="button" class="btn btn--primary btn--small" data-modal-add="' +
      escapeAttr(p.id) +
      '">Thêm vào lịch</button>' +
      '<button type="button" class="btn btn--ghost btn--small" data-modal-wish="' +
      escapeAttr(p.id) +
      '">' +
      (wishIsOn(p.id) ? '♥ Đã lưu' : '♡ Yêu thích') +
      (p.favoritesCount ? ' <span class="wish-count">' + p.favoritesCount + '</span>' : '') +
      '</button></div></div>';
      
    wrap.innerHTML = placeViewHtml + '<div class="am-view-content" style="display:none;"></div>';

    var pv = wrap.querySelector('.place-view-content');
    var av = wrap.querySelector('.am-view-content');

    wrap.querySelectorAll('.detail-item-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var cat = this.getAttribute('data-category');
        var idx = this.getAttribute('data-idx');
        var item = p[cat][idx];
        if(!item) return;

        // Custom details based on type
        var extraInfo = "";
        if (cat === 'amusementPlaces') {
          extraInfo = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:1rem;">' +
                        '<div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">' +
                          '<h4 style="color:#10b981; margin:0 0 0.5rem; font-size:0.85rem;">⏰ Giờ mở cửa</h4>' +
                          '<p style="margin:0; font-size:0.9rem; font-weight:600;">' + escapeHtml(item.openingHours || 'Liên hệ') + '</p>' +
                        '</div>' +
                        '<div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">' +
                          '<h4 style="color:#f43f5e; margin:0 0 0.5rem; font-size:0.85rem;">🎟️ Giá vé</h4>' +
                          '<p style="margin:0; font-size:0.9rem; font-weight:600;">' + escapeHtml(item.ticketPrice || 'Liên hệ') + '</p>' +
                        '</div>' +
                      '</div>';
        } else if (cat === 'accommodations' || cat === 'diningPlaces') {
          extraInfo = '<div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05);">' +
                        '<h4 style="color:#10b981; margin:0 0 0.5rem; font-size:0.85rem;">💰 Khoảng giá</h4>' +
                        '<p style="margin:0; font-size:0.9rem; font-weight:600;">' + escapeHtml(item.priceRange || 'Đang cập nhật') + '</p>' +
                      '</div>';
        }

        var detailedHtml = 
          '<div style="animation: fadeIn 0.3s ease;">' +
          '<div style="padding-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">' +
            '<button type="button" class="btn btn--ghost btn--small btn-back-am" style="font-weight:600;">← Trở về</button>' +
            '<button type="button" class="btn btn--primary btn--small btn-add-am" style="font-weight:600;">+ Lịch trình</button>' +
          '</div>' +
          '<div class="place-detail__media" style="background-image:url(\'' + escapeAttr(item.image) + '\'); height:280px; border-radius:16px;"></div>' +
          '<h3 class="place-detail__title" style="margin-top:1.5rem; font-size:1.4rem;">' + escapeHtml(item.name) + '</h3>' +
          '<div style="color:#fbbf24; font-weight:700; margin-bottom:0.75rem;">⭐ ' + (item.rating || '4.5') + ' / 5.0</div>' +
          '<p style="color:var(--text-muted); line-height:1.6; margin-bottom:1.5rem;">' + escapeHtml(item.description || '') + '</p>' +
          '<div style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.05); margin-bottom:1rem;">' +
            '<h4 style="color:var(--accent); margin:0 0 0.4rem; font-size:0.85rem;">📍 Địa chỉ</h4>' +
            '<p style="margin:0; font-size:0.9rem;">' + escapeHtml(item.address || p.region) + '</p>' +
          '</div>' +
          extraInfo +
          '<div style="margin-top:1.5rem; display:flex; justify-content:center;">' +
             '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.name + ' ' + (item.address || p.region)) + '" target="_blank" rel="noopener noreferrer" class="btn btn--outline btn--block" style="text-align:center;">🗺️ Xem trên Google Maps</a>' +
          '</div>' +
          '</div>';
          
        av.innerHTML = detailedHtml;
        av.querySelector('.btn-back-am').addEventListener('click', function() {
          av.style.display = 'none';
          pv.style.display = 'block';
          wrap.scrollTop = 0;
        });

        var btnAddAm = av.querySelector('.btn-add-am');
        if (btnAddAm) {
          btnAddAm.addEventListener('click', function(e) {
            e.stopPropagation();
            var customId = 'item-' + Date.now();
            var newPlace = {
              id: customId,
              name: item.name,
              region: p.region,
              lat: p.lat,
              lng: p.lng,
              image: item.image,
              text: item.description,
              tags: ["tùy chỉnh"],
              isCustom: true
            };
            if (!window._CUSTOM_PLACES) window._CUSTOM_PLACES = {};
            window._CUSTOM_PLACES[customId] = newPlace;
            
            addStopById(customId);
            
            this.innerHTML = '✔ Đã thêm';
            this.classList.replace('btn--primary', 'btn--ghost');
            this.style.color = '#10b981';
            this.style.pointerEvents = 'none';
          });
        }

        pv.style.display = 'none';
        av.style.display = 'block';
        wrap.scrollTop = 0;
      });
    });

    wrap.querySelector("[data-modal-add]").addEventListener("click", function () {
      addStopById(p.id);
      closeModals();
      var pl = document.getElementById("planner");
      if (pl) pl.scrollIntoView({ behavior: "smooth" });
    });
    wrap.querySelector("[data-modal-wish]").addEventListener("click", function () {
      var id = p.id;
      var on = toggleWish(id);
      var wb = wrap.querySelector("[data-modal-wish]");
      
      wb.innerHTML = (on ? '♥ Đã lưu' : '♡ Yêu thích') + (p.favoritesCount ? ' <span class="wish-count">' + p.favoritesCount + '</span>' : '');

      fetch('/api/places/' + id + '/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: on ? 'add' : 'remove' })
      }).then(function(res) { return res.json(); }).then(function(json) {
        if (json.success) {
          p.favoritesCount = json.favoritesCount;
          if (wb) wb.innerHTML = (on ? '♥ Đã lưu' : '♡ Yêu thích') + (p.favoritesCount ? ' <span class="wish-count">' + p.favoritesCount + '</span>' : '');
          renderDestCards();
          applyDestFilters();
          renderPersonalSection();
        }
      }).catch(function() {});
    });
    openModal("place");

    // Tự động khởi tạo bản đồ
    setTimeout(async function() {
      var mapEl = document.getElementById("place-map");
      if (!mapEl || !p.lat || !p.lng || typeof L === 'undefined') return;
      mapEl.style.display = "block";
      mapEl.style.height = "350px"; 
      mapEl.style.position = "relative";
      
      if (window._placeMapInstance) {
        window._placeMapInstance.remove();
        window._placeMapInstance = null;
      }
      
      window._placeMapInstance = L.map("place-map", {
        scrollWheelZoom: false
      }).setView([p.lat, p.lng], 14);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(window._placeMapInstance);

      // Nhóm các layer
      const layers = {
        playing: L.layerGroup().addTo(window._placeMapInstance),
        eating: L.layerGroup().addTo(window._placeMapInstance),
        sleeping: L.layerGroup().addTo(window._placeMapInstance),
        attraction: L.layerGroup().addTo(window._placeMapInstance)
      };

      // Thêm Legend
      var legend = document.createElement('div');
      legend.className = 'map-legend';
      legend.innerHTML = `
        <div class="legend-loading">Đang tìm địa điểm xung quanh...</div>
        <div class="legend-item" data-layer="playing"><div class="legend-dot" style="background:#f43f5e"></div> Vui chơi</div>
        <div class="legend-item" data-layer="eating"><div class="legend-dot" style="background:#f59e0b"></div> Ăn uống</div>
        <div class="legend-item" data-layer="sleeping"><div class="legend-dot" style="background:#10b981"></div> Nghỉ ngơi</div>
        <div class="legend-item" data-layer="attraction"><div class="legend-dot" style="background:#0ea5e9"></div> Tham quan</div>
      `;
      mapEl.appendChild(legend);

      // Event listener cho legend
      legend.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', function(e) {
          e.stopPropagation();
          const layerName = this.getAttribute('data-layer');
          const layer = layers[layerName];
          if (window._placeMapInstance.hasLayer(layer)) {
            window._placeMapInstance.removeLayer(layer);
            this.classList.add('is-inactive');
          } else {
            window._placeMapInstance.addLayer(layer);
            this.classList.remove('is-inactive');
          }
        });
      });
      
      // Marker chính cho địa điểm
      var mainIcon = L.divIcon({
        className: 'main-dest-marker',
        html: "<div style='background-color:var(--accent); width:20px; height:20px; border-radius:50%; border:4px solid white; box-shadow:0 0 15px var(--accent);'></div>",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      L.marker([p.lat, p.lng], {icon: mainIcon}).bindPopup('<b>' + escapeHtml(p.name) + '</b><br>Tâm điểm du lịch').addTo(window._placeMapInstance);


      
                  // --- HYBRID STRATEGY: PLOT STATIC DATA IMMEDIATELY ---
      function plotStaticPOIs() {
        const staticItems = [];
        if (p.amusementPlaces) p.amusementPlaces.forEach(item => staticItems.push({...item, cat: 'playing'}));
        if (p.accommodations) p.accommodations.forEach(item => staticItems.push({...item, cat: 'sleeping'}));
        if (p.diningPlaces) p.diningPlaces.forEach(item => staticItems.push({...item, cat: 'eating'}));
        if (p.checkInSpots) p.checkInSpots.forEach(item => staticItems.push({...item, cat: 'attraction'}));

        staticItems.forEach((item, index) => {
          const angle = (index / (staticItems.length || 1)) * 2 * Math.PI;
          const dist = 0.003 + (Math.random() * 0.004);
          const lat = p.lat + Math.sin(angle) * dist;
          const lon = p.lng + Math.cos(angle) * dist;

          const category = item.cat || 'attraction';
          const icon = getPOIIcon(category);
          const name = item.name || "Địa điểm đề xuất";
          
          const poiIcon = L.divIcon({
            className: 'poi-marker poi-marker-static poi-marker-' + category,
            html: '<div class="poi-marker-inner">' + icon + '</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          const popupContent = '<div class="poi-popup">' +
              '<span class="poi-popup-category" style="color:#fcd34d">Đề xuất</span>' +
              '<strong class="poi-popup-title">' + escapeHtml(name) + '</strong>' +
              '<p style="font-size:0.7rem; margin:4px 0">' + escapeHtml(item.description || "") + '</p>' +
              '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' ' + (p.region || '')) + '" target="_blank" style="font-size:0.75rem; color:var(--accent); border-top:1px solid rgba(255,255,255,0.1); display:block; padding-top:6px; margin-top:6px; text-decoration:none;">Xem trên Google Maps →</a>' +
            '</div>';

          L.marker([lat, lon], {icon: poiIcon})
            .bindPopup(popupContent)
            .addTo(layers[category] || layers.attraction);
        });
      }

      plotStaticPOIs();

      // --- THEN FETCH REAL-WORLD DATA IN BACKGROUND ---
      function syncMarkers(elements) {
        elements.forEach(item => {
          const lat = item.lat || (item.center && item.center.lat);
          const lon = item.lon || (item.center && item.center.lon);
          if (!lat || !lon) return;

          const category = getPOICategory(item);
          const icon = getPOIIcon(category);
          const name = item.tags.name || "Địa điểm du lịch";
          
          const poiIcon = L.divIcon({
            className: 'poi-marker poi-marker-' + category,
            html: '<div class="poi-marker-inner">' + icon + '</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          const popupContent = '<div class="poi-popup">' +
              '<span class="poi-popup-category">' + category + '</span>' +
              '<strong class="poi-popup-title">' + name + '</strong>' +
              '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' ' + (p.region || '')) + '" target="_blank" style="font-size:0.75rem; color:var(--accent); border-top:1px solid rgba(255,255,255,0.1); display:block; padding-top:6px; margin-top:6px; text-decoration:none;">Xem trên Google Maps →</a>' +
            '</div>';

          L.marker([lat, lon], {icon: poiIcon})
            .bindPopup(popupContent)
            .addTo(layers[category] || layers.attraction);
        });
      }

      const cachedPOIs = window._poiCache[p.id];
      if (cachedPOIs) {
        const loadingHint = legend.querySelector('.legend-loading');
        if (loadingHint) loadingHint.style.display = 'none';
        syncMarkers(cachedPOIs);
      } else {
        try {
          fetchNearbyPOIs(p.lat, p.lng).then(elements => {
            const loadingHint = legend.querySelector('.legend-loading');
            if (loadingHint) loadingHint.style.display = 'none';
            window._poiCache[p.id] = elements;
            syncMarkers(elements);
          });
        } catch(e) {
          console.error("Overpass POI error:", e);
          const loadingHint = legend.querySelector('.legend-loading');
          if (loadingHint) loadingHint.innerText = "Lỗi khi tải địa điểm.";
        }
      }

      // Định vị người dùng (Geolocation API)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
          var userLat = pos.coords.latitude;
          var userLng = pos.coords.longitude;
          
          var userIcon = L.divIcon({
            className: 'user-marker-icon',
            html: "<div style='background-color:#fff; width:14px; height:14px; border-radius:50%; border:3px solid #0ea5e9; box-shadow:0 0 10px rgba(0,0,0,0.5);'></div>",
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          L.marker([userLat, userLng], {icon: userIcon})
            .bindPopup('Vị trí của bạn')
            .addTo(window._placeMapInstance);
        }, function(err) {
          console.log("Không thể lấy vị trí hiện tại:", err.message);
        });
      }
      setTimeout(function() { if (window._placeMapInstance) window._placeMapInstance.invalidateSize(); }, 50);
    }, 350);
  }

  function renderPersonalSection() {
    var sec = document.querySelector("[data-personal-section]");
    var grid = document.querySelector("[data-personal-grid]");
    if (!sec || !grid) return;
    var prefs = getPrefs();
    var hasPrefs =
      (prefs.interests && prefs.interests.length) ||
      (prefs.habits && prefs.habits.length);
    var sess = getSession();
    if (!hasPrefs && !sess) {
      sec.hidden = true;
      return;
    }
    sec.hidden = false;
    var ranked = sortByScore(prefs).slice(0, 3);
    grid.innerHTML = "";
    if (!ranked.length) return;
    ranked.forEach(function (row) {
      var p = row.place;
      var div = document.createElement("div");
      div.className = "dest-card";
      div.style.cursor = "pointer";
      div.innerHTML =
        '<div class="dest-card-media" style="--img: url(\'' +
        String(p.image).replace(/'/g, "\\'") +
        '\')"></div><div class="dest-card-body"><h3 class="dest-card-title">' +
        escapeHtml(p.name) +
        '</h3><p class="dest-card-meta">Điểm phù hợp: ' +
        row.score +
        "</p><p class=\"dest-card-text\">" +
        escapeHtml(row.reasons.slice(0, 2).join(" · ") || p.text) +
        '</p><div class="dest-card-actions">' +
        '<button type="button" class="btn btn--primary btn--small btn-detail">Chi tiết</button>' +
        '<button type="button" class="btn btn--ghost btn--small btn-add-trip" data-add-personal="' + p.id + '">+ Lịch</button>' +
        '</div></div>';
      
      div.querySelector(".btn-detail").addEventListener("click", function (e) {
        e.stopPropagation();
        openPlaceModal(p.id);
      });
      
      div.querySelector("[data-add-personal]").addEventListener("click", function (e) {
        e.stopPropagation();
        addStopById(p.id);
        var pl = document.getElementById("planner");
        if (pl) pl.scrollIntoView({ behavior: "smooth" });
      });

      div.addEventListener("click", function () {
        openPlaceModal(p.id);
      });
      grid.appendChild(div);
    });
  }

  /* ——— Planner & map ——— */
  var tripMap = null;
  var markersLayer = null;
  var stopList = [];

  function loadDraftStops() {
    var d = loadJSON(STORAGE.tripDraft, null);
    if (d && Array.isArray(d.stops)) return d.stops;
    return [];
  }

  function saveDraftStops() {
    var nameEl = document.querySelector("[data-trip-name]");
    saveJSON(STORAGE.tripDraft, {
      name: nameEl ? nameEl.value : "",
      stops: stopList
    });
  }

  function placeById(id) {
    var p = PLACES.find(function (x) {
      return x.id === id;
    });
    if (p) return p;
    // Tìm trong danh sách ảo (custom stops) nếu không thấy trong PLACES chính
    if (window._CUSTOM_PLACES && window._CUSTOM_PLACES[id]) {
      return window._CUSTOM_PLACES[id];
    }
    return null;
  }

  function initMapIfNeeded() {
    if (tripMap || typeof L === "undefined") return;
    var el = document.getElementById("trip-map");
    if (!el) return;
    tripMap = L.map(el).setView([16.05, 107.0], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(tripMap);
    markersLayer = L.layerGroup().addTo(tripMap);
    routeLayer = L.geoJSON(null, {
      style: { color: "#00F0FF", weight: 5, opacity: 0.7 }
    }).addTo(tripMap);
  }

  function redrawMap() {
    initMapIfNeeded();
    if (!tripMap || !markersLayer || !routeLayer) return;
    
    markersLayer.clearLayers();
    if (routeLayer) routeLayer.clearLayers();
    
    var waypoints = [];
    var latlngs = [];

    // 1. User Position
    if (userPos && userPos.lat && userPos.lng) {
      var uLL = [userPos.lat, userPos.lng];
      waypoints.push(userPos.lng + "," + userPos.lat);
      latlngs.push(uLL);
      
      var userIcon = L.divIcon({
        className: 'user-marker-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker(uLL, { icon: userIcon })
        .bindPopup("<strong>Vị trí của bạn</strong>")
        .addTo(markersLayer);
    }

    // 2. Itinerary Stops
    stopList.forEach(function (sid, i) {
      var p = placeById(sid);
      if (!p) return;
      var ll = [p.lat, p.lng];
      waypoints.push(p.lng + "," + p.lat);
      latlngs.push(ll);
      
      L.marker(ll)
        .bindPopup("<strong>" + (i + 1) + ". " + p.name + "</strong>")
        .addTo(markersLayer);
    });

    // 3. OSRM Routing (Vietnam Optimized)
    var stepsListEl = document.querySelector("[data-steps-list]");
    var toggleStepsBtn = document.querySelector("[data-toggle-steps]");
    
    if (waypoints.length >= 2) {
      // Logic neo lộ trình trên lãnh thổ Việt Nam cho các chặng dài (Bắc <-> Nam)
      var finalWaypoints = [];
      for (var k = 0; k < waypoints.length - 1; k++) {
        var startCoord = waypoints[k].split(",").map(Number); // [lng, lat]
        var endCoord = waypoints[k+1].split(",").map(Number);
        
        finalWaypoints.push(waypoints[k]);
        
        // Nếu đoạn thẳng có khoảng cách vĩ độ > 0.9 (~100km) -> Khâu chặt vào lộ trình QL1A
        var latDiff = Math.abs(startCoord[1] - endCoord[1]);
        if (latDiff > 0.9) {
          // 23 điểm neo chiến lược dọc QL1A từ Lạng Sơn đến Cà Mau
          var anchors = [
            { lat: 21.85, lng: 106.76, name: "Lạng Sơn" },
            { lat: 21.02, lng: 105.84, name: "Hà Nội" },
            { lat: 20.60, lng: 105.92, name: "Phủ Lý" },
            { lat: 20.25, lng: 105.97, name: "Ninh Bình" },
            { lat: 19.80, lng: 105.77, name: "Thanh Hóa" },
            { lat: 18.67, lng: 105.68, name: "Vinh" },
            { lat: 18.34, lng: 105.90, name: "Hà Tĩnh" },
            { lat: 17.47, lng: 106.62, name: "Đồng Hới" },
            { lat: 16.82, lng: 107.10, name: "Đông Hà" },
            { lat: 16.46, lng: 107.59, name: "Huế" },
            { lat: 16.05, lng: 108.20, name: "Đà Nẵng" },
            { lat: 15.57, lng: 108.47, name: "Tam Kỳ" },
            { lat: 15.12, lng: 108.80, name: "Quảng Ngãi" },
            { lat: 13.78, lng: 109.21, name: "Quy Nhơn" },
            { lat: 13.09, lng: 109.30, name: "Tuy Hòa" },
            { lat: 12.24, lng: 109.19, name: "Nha Trang" },
            { lat: 11.56, lng: 108.99, name: "Phan Rang" },
            { lat: 10.93, lng: 108.10, name: "Phan Thiết" },
            { lat: 10.95, lng: 106.82, name: "Biên Hòa" },
            { lat: 10.76, lng: 106.66, name: "TP.HCM" },
            { lat: 10.03, lng: 105.78, name: "Cần Thơ" },
            { lat: 9.60, lng: 105.97, name: "Sóc Trăng" },
            { lat: 9.18, lng: 105.15, name: "Cà Mau" }
          ];
          
          var isNorthToSouth = startCoord[1] > endCoord[1];
          var relevantAnchors = anchors.filter(function(a) {
            return isNorthToSouth ? (a.lat < startCoord[1] && a.lat > endCoord[1]) : (a.lat > startCoord[1] && a.lat < endCoord[1]);
          });
          
          if (!isNorthToSouth) relevantAnchors.reverse();
          
          relevantAnchors.forEach(function(a) {
            finalWaypoints.push(a.lng + "," + a.lat);
          });
        }
      }
      finalWaypoints.push(waypoints[waypoints.length-1]);

      var osrmProfile = (transportMode === "motorcycle") ? "driving" : "driving"; // OSRM demo only has driving
      var url = "https://router.project-osrm.org/route/v1/" + osrmProfile + "/" + finalWaypoints.join(";") + "?overview=full&geometries=geojson&steps=true&continue_straight=true";
      
      fetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.code === "Ok" && data.routes[0]) {
            var route = data.routes[0];
            routeLayer.addData(route.geometry);
            
            if (stepsListEl) {
              stepsListEl.innerHTML = "";
              route.legs.forEach(function(leg, legIdx) {
                // Chỉ hiện tiêu đề chặn nếu thực sự là chặng của người dùng (không phải điểm neo tự động)
                // OSRM treats each semicolon as a leg. We can filter legs that are extremely short or matching anchors.
                var legTitle = document.createElement("li");
                legTitle.className = "leg-header";
                
                var stopIndex = userPos ? legIdx : legIdx + 1;
                var targetPlace = placeById(stopList[stopIndex]);
                var destName = targetPlace ? targetPlace.name : "Điểm đến";
                
                legTitle.innerHTML = '<span>🚗 Chặng ' + (legIdx + 1) + '</span><strong>Hướng tới: ' + escapeHtml(destName) + '</strong>';
                stepsListEl.appendChild(legTitle);

                leg.steps.forEach(function(step) {
                  stepsListEl.appendChild(createStepItem(step));
                });
              });
              if (toggleStepsBtn) toggleStepsBtn.hidden = false;
            }
          }
        })
        .catch(function(e) { console.warn("OSRM error:", e); });
    } else {
      if (stepsListEl) stepsListEl.innerHTML = "";
      if (toggleStepsBtn) toggleStepsBtn.hidden = true;
    }

    if (latlngs.length === 1) tripMap.setView(latlngs[0], 13);
    else if (latlngs.length > 1) tripMap.fitBounds(latlngs, { padding: [80, 80], maxZoom: 14 });
    else tripMap.setView([16.4, 107.5], 6);

    // 4. Google Maps Link
    var dirLink = document.querySelector("[data-directions-link]");
    if (dirLink && latlngs.length >= 2) {
      var gmPath = latlngs.map(function(ll) { return ll[0] + "," + ll[1]; }).join("/");
      var gmMode = (transportMode === "motorcycle") ? "motorcycle" : "driving";
      dirLink.href = "https://www.google.com/maps/dir/" + gmPath + "/?hl=vi&travelmode=" + gmMode;
      dirLink.hidden = false;
    } else if (dirLink) {
      dirLink.hidden = true;
    }
    
    setTimeout(function() { if (tripMap) tripMap.invalidateSize(); }, 400);
  }

  function createStepItem(step) {
    var li = document.createElement("li");
    li.className = "step-item";
    
    var icon = "⬆️";
    var maneuver = step.maneuver;
    if (maneuver.type.includes("turn")) {
      if (maneuver.modifier.includes("left")) icon = "⬅️";
      else if (maneuver.modifier.includes("right")) icon = "➡️";
      else if (maneuver.modifier.includes("uturn")) icon = "↩️";
    } else if (maneuver.type.includes("roundabout")) icon = "🔄";
    else if (maneuver.type.includes("arrive")) icon = "🏁";
    else if (maneuver.type.includes("depart")) icon = "🚗";

    li.innerHTML = 
      '<div class="step-visual"><div class="step-dot"></div><div class="step-icon">' + icon + '</div></div>' +
      '<div class="step-detail">' +
        '<div class="step-instruction">' + escapeHtml(maneuver.instruction) + '</div>' +
        '<div class="step-meta">' +
          '<span class="step-dist">' + (step.distance >= 1000 ? (step.distance / 1000).toFixed(1) + " km" : Math.round(step.distance) + " m") + '</span>' +
          '<span class="step-time">≈ ' + Math.ceil(step.duration / 60) + ' phút</span>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="btn-zoom-step" title="Xem trên bản đồ">🔍</button>';

    li.addEventListener("click", function() {
      // Zoom map to internal instruction point
      var coords = maneuver.location; // [lng, lat]
      tripMap.setView([coords[1], coords[0]], 17);
      
      // Highlight current step
      document.querySelectorAll(".step-item").forEach(function(el) { el.classList.remove("is-focused"); });
      li.classList.add("is-focused");
    });

    return li;
  }

  function renderStopListUI() {
    var listEl = document.querySelector("[data-stop-list]");
    var emptyEl = document.querySelector("[data-stop-empty]");
    if (!listEl) return;
    listEl.innerHTML = "";
    stopList.forEach(function (sid, idx) {
      var p = placeById(sid);
      if (!p) return;
      var li = document.createElement("li");
      li.className = "planner-stop-item";
      li.innerHTML =
        "<strong>" + (idx + 1) + ". " + escapeHtml(p.name) + "</strong>" +
        "<span>" + escapeHtml(p.region) + "</span>" +
        '<div class="planner-stop-btns">' +
        '<button type="button" aria-label="Lên" data-up="' + idx + '">↑</button>' +
        '<button type="button" aria-label="Xuống" data-down="' + idx + '">↓</button>' +
        '<button type="button" aria-label="Xóa" data-remove="' + idx + '">×</button>' +
        "</div>";
      listEl.appendChild(li);
    });
    if (emptyEl) emptyEl.style.display = stopList.length ? "none" : "block";
    
    listEl.querySelectorAll("[data-up]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-up"));
        if (i > 0) {
          var t = stopList[i - 1];
          stopList[i - 1] = stopList[i];
          stopList[i] = t;
          saveDraftStops();
          renderStopListUI();
          redrawMap();
        }
      });
    });
    listEl.querySelectorAll("[data-down]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-down"));
        if (i < stopList.length - 1) {
          var t = stopList[i + 1];
          stopList[i + 1] = stopList[i];
          stopList[i] = t;
          saveDraftStops();
          renderStopListUI();
          redrawMap();
        }
      });
    });
    listEl.querySelectorAll("[data-remove]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = Number(b.getAttribute("data-remove"));
        stopList.splice(i, 1);
        saveDraftStops();
        renderStopListUI();
        redrawMap();
      });
    });
  }

  function addStopById(id) {
    if (stopList.indexOf(id) === -1) stopList.push(id);
    saveDraftStops();
    renderStopListUI();
    redrawMap();
    var st = document.querySelector("[data-trip-status]");
    if (st) st.textContent = "Đã thêm " + (placeById(id) && placeById(id).name) + ".";
  }

  var placeSelect = document.querySelector("[data-place-select]");
  if (placeSelect) {
    PLACES.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name + " — " + p.region;
      placeSelect.appendChild(o);
    });
  }

  function renderWarehouseGrid() {
    var grid = document.querySelector("[data-warehouse-grid]");
    if (!grid) return;
    grid.innerHTML = "";
    
    // Sắp xếp địa điểm theo tên hoặc meta
    var sorted = PLACES.slice().sort(function(a, b) {
      if (a.top && !b.top) return -1;
      if (!a.top && b.top) return 1;
      return 0;
    });

    sorted.forEach(function(p) {
      var item = document.createElement("div");
      item.className = "warehouse-card";
      item.innerHTML = 
        '<div class="warehouse-card-img" style="background-image: url(\'' + String(p.image).replace(/'/g, "\\'") + '\')"></div>' +
        '<div class="warehouse-card-info">' +
          '<div class="warehouse-card-name">' + escapeHtml(p.name) + '</div>' +
        '</div>' +
        '<button type="button" class="btn-add-mini" title="Thêm vào lộ trình" data-id="' + p.id + '">+</button>';
      
      item.querySelector(".btn-add-mini").addEventListener("click", function(e) {
        e.stopPropagation();
        addStopById(p.id);
      });
      
      item.addEventListener("click", function() {
        openPlaceModal(p.id);
      });
      
      grid.appendChild(item);
    });
  }

  var clearTripBtn = document.querySelector("[data-clear-trip]");
  if (clearTripBtn)
    clearTripBtn.addEventListener("click", function () {
      stopList = [];
      saveDraftStops();
      renderStopListUI();
      redrawMap();
    });

  // Manual Stop Logic
  var manualStopBtn = document.getElementById("btn-add-manual-stop");
  var manualStopInput = document.getElementById("manual-stop-input");
  
  if (manualStopBtn && manualStopInput) {
    manualStopBtn.addEventListener("click", async function() {
      var addr = manualStopInput.value.trim();
      if (!addr) return;
      
      manualStopBtn.disabled = true;
      manualStopBtn.textContent = "...";
      var st = document.querySelector("[data-trip-status]");
      if (st) st.textContent = "Đang tìm địa chỉ: " + addr;

      try {
        var url = "https://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(addr + ", Vietnam") + "&limit=1";
        var res = await fetch(url);
        var data = await res.json();
        
        if (data && data.length > 0) {
          var hit = data[0];
          var customId = "custom-" + Date.now();
          var newPlace = {
            id: customId,
            name: addr,
            region: hit.display_name.split(',').slice(-3).join(',').trim(),
            lat: parseFloat(hit.lat),
            lng: parseFloat(hit.lon),
            image: "https://images.unsplash.com/photo-1499591934245-40b55745b905?w=400&q=80", // Placeholder cho điểm manual
            text: "Địa chỉ tùy chỉnh được thêm thủ công.",
            tags: ["tùy chỉnh"],
            isCustom: true
          };
          
          if (!window._CUSTOM_PLACES) window._CUSTOM_PLACES = {};
          window._CUSTOM_PLACES[customId] = newPlace;
          
          addStopById(customId);
          manualStopInput.value = "";
          if (st) st.textContent = "✅ Đã thêm địa chỉ tùy chỉnh!";
        } else {
          if (st) st.textContent = "❌ Không tìm thấy địa chỉ này tại VN.";
        }
      } catch (e) {
        if (st) st.textContent = "❌ Lỗi kết nối máy chủ địa lý.";
      } finally {
        manualStopBtn.disabled = false;
        manualStopBtn.textContent = "Thêm";
      }
    });

    manualStopInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") manualStopBtn.click();
    });
  }

  var saveTripBtn = document.querySelector("[data-save-trip]");
  if (saveTripBtn)
    saveTripBtn.addEventListener("click", async function () {
      var nameEl = document.querySelector("[data-trip-name]");
      var name = (nameEl && nameEl.value.trim()) || "Chuyến đi mới";
      var st = document.querySelector("[data-trip-status]");
      var token = localStorage.getItem("wander_token");

      if (token) {
        if (st) st.textContent = "Đang lưu vĩnh viễn...";
        
        // Chuyển ID sang tên địa điểm để hiển thị trong DB
        var stopNames = stopList.map(function(id) {
          var p = placeById(id);
          return p ? p.name : id;
        });

        try {
          var res = await fetch("/api/planner/save-manual", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-auth-token": token
            },
            body: JSON.stringify({ 
              destination: name, 
              stops: stopNames,
              tripDate: new Date().toISOString().split('T')[0] // Mặc định ngày hôm nay
            })
          });
          var json = await res.json();
          if (json.success) {
            if (st) {
              st.textContent = "✅ Đã lưu vào Chuyến đi của tôi!";
              st.style.color = "#10b981";
            }
            return;
          }
        } catch(err) {
          console.error("Save API Error:", err);
        }
      }

      // Fallback cho khách hoặc khi lỗi API
      var trips = loadJSON(STORAGE.trips, []);
      trips.unshift({
        id: "t-" + Date.now(),
        name: name,
        stops: stopList.slice(),
        savedAt: new Date().toISOString()
      });
      saveJSON(STORAGE.trips, trips.slice(0, 20));
      if (st) {
        st.textContent = token ? "⚠️ Lỗi server, đã lưu tạm vào trình duyệt." : "Đã lưu bản nháp vào trình duyệt (localStorage). Đăng nhập để lưu vĩnh viễn.";
        if (token) st.style.color = "#f59e0b";
      }
    });

  var tripNameInput = document.querySelector("[data-trip-name]");
  if (tripNameInput)
    tripNameInput.addEventListener("change", saveDraftStops);

  /* ——— Itinerary tabs (existing) ——— */
  var itinTabs = document.querySelectorAll("[data-itin]");
  var panels = document.querySelectorAll("[data-panel]");

  function showPanel(id) {
    itinTabs.forEach(function (tab) {
      var active = tab.getAttribute("data-itin") === id;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach(function (panel) {
      var match = panel.getAttribute("data-panel") === id;
      panel.classList.toggle("is-visible", match);
      panel.hidden = !match;
    });
  }

  itinTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("data-itin");
      if (id) showPanel(id);
    });
  });

  /* ——— Review carousel ——— */
  var track = document.querySelector("[data-review-track]");
  var prevBtn = document.querySelector("[data-review-prev]");
  var nextBtn = document.querySelector("[data-review-next]");
  var dotsWrap = document.querySelector("[data-review-dots]");

  if (track) {
    var cards = Array.prototype.slice.call(track.querySelectorAll(".review-card"));
    var index = 0;
    var dots = [];

    function renderReview() {
      cards.forEach(function (card, i) {
        card.classList.toggle("is-active", i === index);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === index);
        dot.setAttribute("aria-current", i === index ? "true" : "false");
      });
    }

    function go(delta) {
      index = (index + delta + cards.length) % cards.length;
      renderReview();
    }

    if (dotsWrap && cards.length) {
      cards.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "review-dot" + (i === 0 ? " is-active" : "");
        dot.setAttribute("aria-label", "Xem đánh giá " + (i + 1));
        dot.addEventListener("click", function () {
          index = i;
          renderReview();
        });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
      dotsWrap.setAttribute("aria-hidden", "false");
    }

    if (prevBtn) prevBtn.addEventListener("click", function () {
      go(-1);
    });
    if (nextBtn) nextBtn.addEventListener("click", function () {
      go(1);
    });

    renderReview();

    var timer = window.setInterval(function () {
      go(1);
    }, 7000);

    track.addEventListener("mouseenter", function () {
      window.clearInterval(timer);
    });
    track.addEventListener("mouseleave", function () {
      timer = window.setInterval(function () {
        go(1);
      }, 7000);
    });
  }

  /* ——— Contact form ——— */
  function updateContactPrefill() {
    var form = document.querySelector("[data-contact-form]");
    var sess = getSession();
    if (!form || !sess) return;
    var u = getUsers().find(function (x) {
      return x.email === sess.email;
    });
    var em = form.querySelector('input[name="email"]');
    var nm = form.querySelector('input[name="name"]');
    if (em && !em.value) em.value = sess.email;
    if (nm && u && !nm.value) nm.value = u.name || "";
  }

  var form = document.querySelector("[data-contact-form]");
  var statusEl = document.querySelector("[data-form-status]");
  
  var chkAnon = document.getElementById("chk-anonymous");
  var nameWrap = document.getElementById("field-name-wrap");
  var emailWrap = document.getElementById("field-email-wrap");
  var nameInput = document.getElementById("contact-name");
  var emailInput = document.getElementById("contact-email");

  if (chkAnon) {
    chkAnon.addEventListener("change", function () {
      if (this.checked) {
        if (nameWrap) nameWrap.style.display = "none";
        if (emailWrap) emailWrap.style.display = "none";
        if (nameInput) { nameInput.required = false; nameInput.value = ""; }
        if (emailInput) { emailInput.required = false; emailInput.value = ""; }
      } else {
        if (nameWrap) nameWrap.style.display = "block";
        if (emailWrap) emailWrap.style.display = "block";
        if (nameInput) nameInput.required = true;
        if (emailInput) emailInput.required = true;
        updateContactPrefill(); // Load lại thông tin user nếu có
      }
    });
  }

  if (form && statusEl) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      statusEl.textContent = "Đang gửi…";
      statusEl.classList.remove("is-success", "is-error");

      var fd = new FormData(form);
      var payload = {
        name: fd.get("name") || "",
        email: fd.get("email") || "",
        message: fd.get("message") || "" // changed from "note"
      };

      try {
        var res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        var json = await res.json();
        
        if (json.success) {
          statusEl.textContent = "✔ Đã bắt được yêu cầu! Cảm ơn bạn.";
          statusEl.classList.add("is-success");
          form.reset();
          updateContactPrefill();
        } else {
          statusEl.textContent = "✖ Lỗi: " + (json.message || "Không thể gửi phản hồi.");
          statusEl.classList.add("is-error");
        }
      } catch (err) {
        statusEl.textContent = "✖ Lỗi kết nối máy chủ. Vui lòng thử lại sau.";
        statusEl.classList.add("is-error");
      }
      
      window.setTimeout(function () {
        if(statusEl.classList.contains("is-success")) {
           statusEl.textContent = "";
        }
      }, 3500);
    });
  }

  /* ——— Chatbot (logic gọi qua API Server Node) ——— */
  async function botReply(userText) {
    if (typeof window.wanderChatReply === "function")
      return await window.wanderChatReply(userText, {
        places: PLACES,
        getPrefs: getPrefs
      });
    var t = normalize(userText);
    if (!t.trim())
      return "Nhập câu hỏi về điểm đến, mùa đi, hoặc tên địa phương.";
    return "Trợ lý kết nối máy chủ đang bị gián đoạn.";
  }

  var chatPanel = document.querySelector("[data-chat-panel]");
  var chatToggleBtns = document.querySelectorAll("[data-chat-toggle]");
  var chatLog = document.querySelector("[data-chat-log]");
  var chatForm = document.querySelector("[data-chat-form]");
  var chatInput = document.querySelector("[data-chat-input]");

  function appendChat(kind, text) {
    if (!chatLog) return;
    var b = document.createElement("div");
    b.className = "chat-bubble chat-bubble--" + (kind === "user" ? "user" : "bot");
    b.textContent = text;
    chatLog.appendChild(b);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function setChatOpen(open) {
    if (!chatPanel) return;
    chatPanel.hidden = !open;
    chatToggleBtns.forEach(function (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    if (open && chatInput) chatInput.focus();
    if (!open && chatInput) chatInput.blur();
  }

  function isChatOpen() {
    return chatPanel && !chatPanel.hidden;
  }

  chatToggleBtns.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setChatOpen(!isChatOpen());
    });
  });

  document.addEventListener("click", function (e) {
    if (!chatPanel || chatPanel.hidden) return;
    var wrap = document.querySelector(".chat-fab-wrap");
    if (wrap && !wrap.contains(e.target)) setChatOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (isChatOpen()) {
      setChatOpen(false);
      e.preventDefault();
      return;
    }
    closeModals();
  });

  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var msg = chatInput.value.trim();
      if (!msg) return;
      appendChat("user", msg);
      chatInput.value = "";
      
      // Temporary loading message
      var tempBubble = document.createElement("div");
      tempBubble.className = "chat-bubble chat-bubble--bot";
      tempBubble.textContent = "Trợ lý đang gõ...";
      chatLog.appendChild(tempBubble);
      chatLog.scrollTop = chatLog.scrollHeight;
      
      var replyResult = await botReply(msg);
      chatLog.removeChild(tempBubble);
      appendChat("bot", replyResult);
    });
    
    // Initial bot welcome phrase
    setTimeout(async function() {
      var initialMsg = await botReply("");
      appendChat("bot", initialMsg);
    }, 500);
  }

  /* ——— Ticker Tự Động (Destinations) ——— */
  function initDestinationsTicker() {
    if (!destGrid) return;
    
    // Bật giao diện ticker trong styles.css
    destGrid.setAttribute('data-ticker', 'true');
    
    let isHovering = false;
    destGrid.addEventListener('mouseenter', function() { isHovering = true; });
    destGrid.addEventListener('mouseleave', function() { isHovering = false; });
    
    setInterval(function() {
      // Dừng cuộn nếu người dùng đang đưa chuột vào khu vực để xem
      if (isHovering || destGrid.scrollWidth <= destGrid.clientWidth) return;
      
      let nextScroll = destGrid.scrollLeft + 320; 
      if (nextScroll + destGrid.clientWidth >= destGrid.scrollWidth - 10) {
        nextScroll = 0; // Quay về đầu
      }
      
      destGrid.scrollTo({
        left: nextScroll,
        behavior: 'smooth'
      });
    }, 4500);
  }

  /* ——— Newsletter form ——— */
  var newsletterForm = document.querySelector(".newsletter-form");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = newsletterForm.querySelector('input[type="email"]').value;
      if (email) {
        alert("Cảm ơn bạn! Chúng tôi sẽ gửi những ưu đãi mới nhất đến " + email);
        newsletterForm.reset();
      }
    });
  }

  /* ——— Boot ——— */
  async function init() {
    // 1. Tải dữ liệu từ MongoDB trước khi render
    await loadPlacesFromAPI();

    // 2. Yêu cầu vị trí người dùng (Geolocation)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        redrawMap();
      }, function(err) {
        console.log("No GPS permission:", err.message);
      }, { enableHighAccuracy: true });
    }

    // 3. Xử lý nút ẩn/hiện danh sách chỉ đường
    var toggleStepsBtn = document.querySelector("[data-toggle-steps]");
    var mapStartBtn = document.querySelector("[data-map-start-btn]");
    var stepsPanel = document.querySelector("[data-route-steps]");
    
    function toggleStepPanel() {
      if (!stepsPanel) return;
      var isHidden = stepsPanel.hidden;
      stepsPanel.hidden = !isHidden;
      if (toggleStepsBtn) 
        toggleStepsBtn.textContent = isHidden ? "✖ Ẩn danh sách chỉ đường" : "📋 Xem danh sách chỉ đường";
      if (!isHidden) {
        var pl = document.getElementById("planner");
        if (pl) pl.scrollIntoView({ behavior: "smooth" });
      }
    }

    if (toggleStepsBtn) toggleStepsBtn.addEventListener("click", toggleStepPanel);
    if (mapStartBtn) mapStartBtn.addEventListener("click", toggleStepPanel);

    // 4. Xử lý nút chọn phương tiện (Xe máy / Ô tô)
    var modeBtnEls = document.querySelectorAll("[data-mode]");
    modeBtnEls.forEach(function(btn) {
      btn.addEventListener("click", function() {
        modeBtnEls.forEach(function(b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        transportMode = btn.getAttribute("data-mode");
        redrawMap();
      });
    });

    renderDestCards();
    renderWarehouseGrid();
    bindDestInteractions();
    applyDestFilters();
    initDestinationsTicker();
    
    stopList = loadDraftStops();
    var draft = loadJSON(STORAGE.tripDraft, null);
    if (tripNameInput && draft && draft.name) tripNameInput.value = draft.name;
    
    renderStopListUI();
    window.requestAnimationFrame(function () {
      redrawMap();
    });

    var rankedInit = sortByScore(getPrefs());
    renderSmartResults(rankedInit);
    refreshAuthUI();

    if (profileForm && getSession()) {
      var p = getProfile();
      if (profileForm.elements.displayName) profileForm.elements.displayName.value = p.displayName || "";
      if (profileForm.elements.notes) profileForm.elements.notes.value = p.notes || "";
    }
  }

  init();
})();
