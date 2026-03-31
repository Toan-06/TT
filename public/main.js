(function () {
  "use strict";

  // PLACES sẽ được nạp từ API MongoDB, fallback về dữ liệu tĩnh nếu API lỗi
  var PLACES = [];

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
    if (backdrop) backdrop.hidden = false;
    document.documentElement.style.overflow = "hidden";
    var closeBtn = m.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.focus();
  }

  function closeModals() {
    document.querySelectorAll("[data-modal]").forEach(function (m) {
      m.hidden = true;
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
            body: JSON.stringify({ displayName: newProf.displayName, notes: newProf.notes, phone: newProf.phone })
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
        '<button type="button" class="btn btn--ghost btn--small" data-add-stop-id="' +
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

  function openPlaceModal(id) {
    var p = PLACES.find(function (x) {
      return x.id === id;
    });
    if (!p) return;
    var wrap = document.querySelector("[data-place-detail]");
    if (!wrap) return;
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
    wrap.innerHTML =
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
      '</p><div class="place-detail__activities">' +
      acts +
      '</div><div id="place-map" style="height:250px; border-radius:12px; margin-top:1rem; border:1px solid rgba(148,163,184,0.2); display:none;"></div>' +
      '<div class="dest-card-actions" style="margin-top:1rem">' +
      '<button type="button" class="btn btn--primary btn--small" data-modal-add="' +
      escapeAttr(p.id) +
      '">Thêm vào lịch</button>' +
      '<button type="button" class="btn btn--ghost btn--small" data-modal-wish="' +
      escapeAttr(p.id) +
      '">Yêu thích</button></div>';

    wrap.querySelector("[data-modal-add]").addEventListener("click", function () {
      addStopById(p.id);
      closeModals();
      var pl = document.getElementById("planner");
      if (pl) pl.scrollIntoView({ behavior: "smooth" });
    });
    wrap.querySelector("[data-modal-wish]").addEventListener("click", function () {
      var on = toggleWish(p.id);
      var wb = wrap.querySelector("[data-modal-wish]");
      // Gọi API MongoDB để cập nhật lượt yêu thích
      fetch('/api/places/' + p.id + '/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: on ? 'add' : 'remove' })
      }).then(function(res) { return res.json(); }).then(function(json) {
        if (json.success) {
          var place = PLACES.find(function(x) { return x.id === p.id; });
          if (place) place.favoritesCount = json.favoritesCount;
          if (wb) {
            wb.textContent = on
              ? '♥ Đã lưu (' + json.favoritesCount + ')'
              : '♡ Yêu thích (' + json.favoritesCount + ')';
          }
        }
      }).catch(function() {});
      if (wb) wb.textContent = on ? "♥ Đã lưu" : "♡ Yêu thích";
      renderDestCards();
      applyDestFilters();
      renderPersonalSection();
    });
    openModal("place");
    
    // Tự động khởi tạo bản đồ
    setTimeout(function() {
      var mapEl = document.getElementById("place-map");
      if (!mapEl || !p.lat || !p.lng || typeof L === 'undefined') return;
      mapEl.style.display = "block";
      
      if (window._placeMapInstance) {
        window._placeMapInstance.remove();
        window._placeMapInstance = null;
      }
      
      window._placeMapInstance = L.map("place-map").setView([p.lat, p.lng], 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(window._placeMapInstance);
      
      var destMarker = L.marker([p.lat, p.lng]).bindPopup('<b>' + escapeHtml(p.name) + '</b><br>Điểm đến').addTo(window._placeMapInstance);
      
      // Định vị người dùng (Geolocation API)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
          var userLat = pos.coords.latitude;
          var userLng = pos.coords.longitude;
          
          var userIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:#0ea5e9; width:15px; height:15px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px rgba(0,0,0,0.5);'></div>",
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          var userMarker = L.marker([userLat, userLng], {icon: userIcon})
            .bindPopup('Vị trí của bạn')
            .addTo(window._placeMapInstance);
            
          userMarker.openPopup();
          
          var polyline = L.polyline([ [userLat, userLng], [p.lat, p.lng] ], {
            color: 'var(--accent)', weight: 3, dashArray: '5, 10'
          }).addTo(window._placeMapInstance);
          
          window._placeMapInstance.fitBounds(polyline.getBounds(), { padding: [40, 40] });
        }, function(err) {
          console.log("Không thể lấy vị trí hiện tại:", err.message);
        });
      }
      setTimeout(function() { window._placeMapInstance.invalidateSize(); }, 50);
    }, 250);
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
        '</p><button type="button" class="btn btn--primary btn--small">Xem chi tiết</button></div>';
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
    return PLACES.find(function (x) {
      return x.id === id;
    });
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
  }

  function redrawMap() {
    initMapIfNeeded();
    if (!tripMap || !markersLayer) return;
    markersLayer.clearLayers();
    var latlngs = [];
    stopList.forEach(function (sid, i) {
      var p = placeById(sid);
      if (!p) return;
      var ll = [p.lat, p.lng];
      latlngs.push(ll);
      L.marker(ll)
        .bindPopup("<strong>" + (i + 1) + ". " + p.name + "</strong>")
        .addTo(markersLayer);
    });
    if (latlngs.length === 1) tripMap.setView(latlngs[0], 8);
    else if (latlngs.length > 1) tripMap.fitBounds(latlngs, { padding: [40, 40], maxZoom: 9 });
    else tripMap.setView([16.05, 107.0], 5);

    var dirLink = document.querySelector("[data-directions-link]");
    if (dirLink) {
      if (latlngs.length >= 2) {
        var path = latlngs
          .map(function (ll) {
            return encodeURIComponent(ll[0] + "," + ll[1]);
          })
          .join("/");
        dirLink.href = "https://www.google.com/maps/dir/" + path;
        dirLink.hidden = false;
      } else {
        dirLink.hidden = true;
      }
    }
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
        "<span style=\"font-weight:700;color:var(--accent)\">" +
        (idx + 1) +
        '</span><div><strong>' +
        escapeHtml(p.name) +
        '</strong><div style="font-size:0.8rem;color:var(--text-muted)">' +
        escapeHtml(p.region) +
        '</div></div><div class="planner-stop-btns">' +
        '<button type="button" aria-label="Lên" data-up="' +
        idx +
        '">↑</button>' +
        '<button type="button" aria-label="Xuống" data-down="' +
        idx +
        '">↓</button>' +
        '<button type="button" aria-label="Xóa" data-remove="' +
        idx +
        '">×</button></div>';
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

  var addStopBtn = document.querySelector("[data-add-stop]");
  if (addStopBtn && placeSelect)
    addStopBtn.addEventListener("click", function () {
      addStopById(placeSelect.value);
    });

  var clearTripBtn = document.querySelector("[data-clear-trip]");
  if (clearTripBtn)
    clearTripBtn.addEventListener("click", function () {
      stopList = [];
      saveDraftStops();
      renderStopListUI();
      redrawMap();
    });

  var saveTripBtn = document.querySelector("[data-save-trip]");
  if (saveTripBtn)
    saveTripBtn.addEventListener("click", function () {
      var nameEl = document.querySelector("[data-trip-name]");
      var name = (nameEl && nameEl.value.trim()) || "Chuyến đi";
      var trips = loadJSON(STORAGE.trips, []);
      trips.unshift({
        id: "t-" + Date.now(),
        name: name,
        stops: stopList.slice(),
        savedAt: new Date().toISOString()
      });
      saveJSON(STORAGE.trips, trips.slice(0, 20));
      var st = document.querySelector("[data-trip-status]");
      if (st) st.textContent = "Đã lưu \"" + name + "\" vào danh sách chuyến (localStorage).";
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

  if (form && statusEl) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      statusEl.textContent = "Đang gửi…";
      statusEl.classList.remove("is-success", "is-error");
      window.setTimeout(function () {
        statusEl.textContent =
          "Đã ghi nhận (demo). Trên bản thật cần kết nối backend / email.";
        statusEl.classList.add("is-success");
        form.reset();
        updateContactPrefill();
      }, 800);
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

  /* ——— Boot ——— */
  async function init() {
    // Tải dữ liệu từ MongoDB trước khi render
    await loadPlacesFromAPI();

    renderDestCards();
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
