document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('aiPlannerForm');
  const btn = document.getElementById('generateBtn');
  const placeholder = document.getElementById('resultPlaceholder');
  const loader = document.getElementById('aiLoader');
  const resultContainer = document.getElementById('timelineResult');
  const refineBox = document.getElementById('refineBox');
  const refineForm = document.getElementById('refineForm');
  const refineInput = document.getElementById('refineInput');
  const refineBtn = document.getElementById('refineBtn');
  
  const timelineContent = document.getElementById('timelineContent');
  const versionTabs = document.getElementById('versionTabs');
  const btnSaveTrip = document.getElementById('btnSaveTrip');
  const btnStartNav = document.getElementById('btnStartNav');
  const saveTripStatus = document.getElementById('saveTripStatus');

  // Lưu trữ Lịch sử phiên bản
  let planHistory = []; 
  let currentPlanIndex = -1;
  let currentItineraryId = null; 

  // ---- Chế độ Xem Lịch Trình (từ My Trips) ----
  const urlParams = new URLSearchParams(window.location.search);
  const viewModeHeader = document.getElementById('viewModeHeader');

  if (urlParams.get('view') === 'true') {
    const stored = sessionStorage.getItem('wander_view_trip');
    if (stored) {
      try {
        const plan = JSON.parse(stored);
        // sessionStorage.removeItem('wander_view_trip'); // Keep it during the session in case of refresh
        planHistory.push(plan);
        currentPlanIndex = 0;
        
        // Hiện header chế độ xem và ẩn form tạo mới
        viewModeHeader.style.display = 'flex';
        form.closest('.planner-form-card').style.display = 'none';

        renderVersionTabs();
        renderItinerary(plan, plan.destination || '', '');
        resultContainer.style.display = 'block';
        refineBox.style.display = 'block';
        placeholder.style.display = 'none';
        resetSaveButton();
        // Ẩn nút Lưu vì user đã lưu rồi mới xem 
        btnSaveTrip.style.display = 'none';
      } catch(e) {
        console.error('Lỗi parse session trip:', e);
      }
    }
  }

  // Set default trip date to today
  const tripDateInput = document.getElementById('tripDate');
  const todayStr = new Date().toISOString().split('T')[0];
  tripDateInput.setAttribute('min', todayStr);
  tripDateInput.value = todayStr;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const destination = document.getElementById('dest').value;
    const days = document.getElementById('days').value;
    const budget = document.getElementById('budget').value;
    const companion = document.getElementById('companion').value;
    const interests = document.getElementById('interests').value;
    const tripDate = document.getElementById('tripDate').value; // ♥ Lấy ngày khởi hành

    btn.disabled = true;
    btn.innerText = 'Đang xử lý...';
    placeholder.style.display = 'none';
    resultContainer.style.display = 'none';
    refineBox.style.display = 'none';
    loader.style.display = 'flex';

    try {
      const token = localStorage.getItem('wander_token');
      const res = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token || ''
        },
        body: JSON.stringify({ destination, days, budget, companion, interests, tripDate })
      });

      const data = await res.json();

      if (data.success && data.plan) {
        currentItineraryId = data.itineraryId;
        planHistory.push(data.plan);
        currentPlanIndex = planHistory.length - 1;
        
        renderVersionTabs();
        renderItinerary(data.plan, destination, days, tripDate); // ♥ truyền thêm tripDate
        resultContainer.style.display = 'block';
        refineBox.style.display = 'block';
        resetSaveButton();
        // ♥ Lưu tripDate vào localStorage để nhắc nhở sau này
        if (tripDate) {
          saveTripReminder(destination, tripDate);
        }
      } else {
        alert(data.message || 'Có lỗi xảy ra khi tạo lịch trình.');
        if (planHistory.length === 0) placeholder.style.display = 'flex';
        else resultContainer.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối tới máy chủ AI. Vui lòng thử lại sau.');
      if (planHistory.length === 0) placeholder.style.display = 'flex';
      else resultContainer.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerText = '⏳ Tạo Lịch Trình Ngay';
      loader.style.display = 'none';
    }
  });

  // Chức năng Sửa lại lịch trình (Refine)
  refineForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (currentPlanIndex < 0) return;

    const currentPlanJson = planHistory[currentPlanIndex];
    const userFeedback = refineInput.value;
    const destination = document.getElementById('dest').value;
    const days = document.getElementById('days').value;

    refineBtn.disabled = true;
    refineBtn.innerText = 'Đang sửa...';
    resultContainer.style.display = 'none';
    refineBox.style.display = 'none';
    loader.style.display = 'flex';

    try {
      const token = localStorage.getItem('wander_token');
      const res = await fetch('/api/planner/refine', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token || ''
        },
        body: JSON.stringify({ oldPlanJson: currentPlanJson, userFeedback, itineraryId: currentItineraryId })
      });

      const data = await res.json();
      if (data.success && data.plan) {
        planHistory.push(data.plan);
        currentPlanIndex = planHistory.length - 1;

        if (data.itineraryId) currentItineraryId = data.itineraryId;

        renderVersionTabs();
        renderItinerary(data.plan, destination, days, document.getElementById('tripDate').value);
        resultContainer.style.display = 'block';
        refineBox.style.display = 'block';
        refineInput.value = ''; 
        resetSaveButton();
      } else {
        alert(data.message || 'Có lỗi xảy ra, thử lại sau nhé.');
        resultContainer.style.display = 'block';
        refineBox.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi mạng, kiểm tra lại.');
      resultContainer.style.display = 'block';
      refineBox.style.display = 'block';
    } finally {
      refineBtn.disabled = false;
      refineBtn.innerText = 'Sửa lại';
      loader.style.display = 'none';
    }
  });

  // Lưu Vĩnh Viễn Lịch Trình Này
  btnSaveTrip.addEventListener('click', async () => {
    const token = localStorage.getItem('wander_token');
    if (!token) {
      alert("Bạn cần Đăng Nhập để lưu lịch trình vào hồ sơ cá nhân!");
      window.location.href = '/index.html#login'; // Redirect to home/login
      return;
    }
    
    if (!currentItineraryId) {
      alert("Lỗi: Không tìm thấy ID lịch trình. Vui lòng tạo lại.");
      return;
    }

    btnSaveTrip.disabled = true;
    saveTripStatus.style.display = 'block';
    saveTripStatus.innerText = 'Đang lưu vào hồ sơ...';

    try {
       const res = await fetch('/api/planner/save', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'x-auth-token': token
         },
         body: JSON.stringify({ itineraryId: currentItineraryId })
       });
       const data = await res.json();

       if (data.success) {
         saveTripStatus.innerText = '✅ Đã lưu thành công! Hãy xem tại mục "Chuyến đi của tôi" trên menu.';
         saveTripStatus.style.color = '#10b981';
         btnSaveTrip.innerText = 'Đã Lưu Lịch Trình';
       } else {
         saveTripStatus.innerText = '❌ ' + (data.message || 'Lưu thất bại.');
         saveTripStatus.style.color = '#f43f5e';
         btnSaveTrip.disabled = false;
       }
    } catch (err) {
       console.error(err);
       saveTripStatus.innerText = '❌ Lỗi kết nối mạng.';
       saveTripStatus.style.color = '#f43f5e';
       btnSaveTrip.disabled = false;
    }
  });

  // Chuyển Ngay Sang Màn Hình Chỉ Đường (Navigator)
  if (btnStartNav) {
    btnStartNav.addEventListener('click', () => {
      if (currentPlanIndex < 0 || !planHistory[currentPlanIndex]) {
        alert("Lỗi: Không tìm thấy nội dung lịch trình.");
        return;
      }
      
      const dest = document.getElementById('dest').value || document.getElementById('plan-title')?.innerText || "Điểm đến";
      const planJson = planHistory[currentPlanIndex];
      
      sessionStorage.setItem('wander_active_itinerary', JSON.stringify(planJson));
      sessionStorage.setItem('wander_active_dest', dest);
      window.location.href = 'navigator.html';
    });
  }

  function resetSaveButton() {
    btnSaveTrip.disabled = false;
    btnSaveTrip.innerText = '♥️ Lưu Lịch Trình Này';
    saveTripStatus.style.display = 'none';
  }

  // ♥ Hàm lưu reminder vào localStorage và xin quyền thông báo
  function saveTripReminder(destination, tripDate) {
    // Lưu vào localStorage
    const reminders = JSON.parse(localStorage.getItem('wander_reminders') || '[]');
    const exists = reminders.find(r => r.tripDate === tripDate && r.destination === destination);
    if (!exists) {
      reminders.push({ destination, tripDate });
      localStorage.setItem('wander_reminders', JSON.stringify(reminders));
    }
    // Xin quyền thông báo
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // ♥ Kiểm tra nhắc nhở khi load trang
  function checkTripReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reminders = JSON.parse(localStorage.getItem('wander_reminders') || '[]');
    const today = new Date().toISOString().split('T')[0];
    reminders.forEach(r => {
      if (r.tripDate === today) {
        new Notification('🧳 WanderViệt — Hôm nay là ngày đi!', {
          body: `Hôm nay bạn có chuyến đi đến ${r.destination}. Chúc bạn lên đường vui vẻ! 🌟`,
          icon: '/favicon.ico'
        });
      }
    });
  }
  checkTripReminders();

  function renderVersionTabs() {
    versionTabs.innerHTML = '';
    planHistory.forEach((_, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'planner-btn';
      btn.style.padding = '0.4rem 1rem';
      btn.style.width = 'auto';
      btn.style.fontSize = '0.9rem';
      btn.style.borderRadius = '2rem';
      
      if (idx === currentPlanIndex) {
        btn.style.background = 'var(--color-primary)';
        btn.innerText = idx === 0 ? 'Bản Gốc' : `Bản Sửa ${idx}`;
      } else {
        btn.style.background = '#e2e8f0';
        btn.style.color = '#475569';
        btn.innerText = idx === 0 ? 'Bản Gốc' : `Bản Sửa ${idx}`;
      }

      btn.addEventListener('click', () => {
        currentPlanIndex = idx;
        const dest = document.getElementById('dest').value;
        const d = document.getElementById('days').value;
        renderVersionTabs();
        renderItinerary(planHistory[idx], dest, d);
        resetSaveButton();
      });

      versionTabs.appendChild(btn);
    });
  }

  // ♥ Helper: format ngày VN (VD: Thứ Bảy, 05/04/2026)
  function formatDayVN(dateStr) {
    const days = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dayName}, ${dd}/${mm}/${d.getFullYear()}`;
  }

  function renderItinerary(plan, destination, days, tripDate = null) {
    if (!plan || !plan.itinerary) return;

    let html = `
      <div class="timeline-header" style="margin-top: 1rem;">
        <h2 style="font-size: 1.8rem; color: #0f172a; margin-bottom: 0.5rem; line-height: 1.3;">
          Lịch trình: ${destination} (${days} Ngày)
        </h2>
        <p class="timeline-summary">${plan.tripSummary}</p>
        <div class="timeline-meta">
          <div class="meta-card">
            <div class="meta-icon-wrapper" style="background: #ecfdf5; color: #10b981;">💰</div>
            <div class="meta-content">
              <p>Dự kiến Chi phí</p>
              <h4>${plan.estimatedCost}</h4>
            </div>
          </div>
          <div class="meta-card">
            <div class="meta-icon-wrapper" style="background: #f0f9ff; color: #0284c7;">🏨</div>
            <div class="meta-content">
              <p>Đề xuất Lưu trú</p>
              <h4>${plan.suggestedHotel}</h4>
            </div>
          </div>
        </div>
      </div>
    `;

    plan.itinerary.forEach((dayData, idx) => {
      // ♥ Tính ngày thực tế nếu có tripDate
      let realDateLabel = '';
      if (tripDate) {
        const d = new Date(tripDate + 'T00:00:00');
        d.setDate(d.getDate() + idx);
        const dateStr = d.toISOString().split('T')[0];
        realDateLabel = ` — ${formatDayVN(dateStr)}`;
      }

      html += `
        <div class="timeline-day">
          <div class="day-badge">Ngày ${dayData.day.toString().replace(/\s*\(.*\)/, '')}${realDateLabel}</div>
          <div class="day-activities">
      `;

      (dayData.activities || []).forEach((act) => {
        html += `
            <div class="activity-card">
              <div class="activity-time">${act.time}</div>
              <h3 class="activity-title" style="margin-top: 0.25rem;">${act.task}</h3>
              <p style="color: #475569; margin-bottom: 0.5rem; font-size: 0.95rem;">${act.location}</p>
              <div class="activity-details" style="border-top: 1px dashed #cbd5e1; padding-top: 0.5rem;">
                <span style="font-size:0.85rem; color:#94a3b8">Chi phí dự kiến</span>
                <span class="activity-cost">${act.cost}</span>
              </div>
            </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    timelineContent.innerHTML = html;
  }
});
