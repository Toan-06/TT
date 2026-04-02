document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('wander_token');
  const unauthorizedMsg = document.getElementById('unauthorizedMsg');
  const tripsContainer = document.getElementById('tripsContainer');
  const tripsList = document.getElementById('tripsList');

  if (!token) {
    unauthorizedMsg.style.display = 'block';
    return;
  }

  tripsContainer.style.display = 'block';

  try {
    const res = await fetch('/api/planner/my-trips', {
      headers: {
        'x-auth-token': token
      }
    });

    // Kiểm tra status trước khi parse JSON
    if (res.status === 401 || res.status === 403) {
      unauthorizedMsg.style.display = 'block';
      tripsContainer.style.display = 'none';
      return;
    }

    // Nếu server trả về lỗi khác (500, v.v.) thì hiện thông báo rõ ràng
    if (!res.ok) {
      tripsList.innerHTML = `<p style="color: red; text-align: center;">Lỗi từ máy chủ: HTTP ${res.status}. Vui lòng thử lại.</p>`;
      return;
    }

    const data = await res.json();

    if (data.success) {
      if (data.data.length === 0) {
        tripsList.innerHTML = `
          <div style="background: #fff; padding: 2.5rem; border-radius: 1rem; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <p style="font-size: 1.2rem; color: #475569; margin-bottom: 1rem;">Bạn chưa lưu lịch trình nào cả.</p>
            <a href="planner.html" class="planner-btn" style="text-decoration: none; display: inline-block;">✨ Trải nghiệm AI Planner ngay</a>
          </div>
        `;
      } else {
         renderTrips(data.data);
      }
    } else {
      tripsList.innerHTML = `<p style="color: red; text-align: center;">Lỗi tải dữ liệu: ${data.message}</p>`;
    }

  } catch (err) {
    console.error('My-trips fetch error:', err);
    tripsList.innerHTML = `<p style="color: red; text-align: center;">Lỗi kết nối tới máy chủ: ${err.message}</p>`;
  }

  function renderTrips(trips) {
    tripsList.innerHTML = '';
    
    trips.forEach(it => {
      const dbDate = new Date(it.createdAt);
      const dpDateString = dbDate.toLocaleDateString('vi-VN');

      const card = document.createElement('div');
      card.style.background = '#fff';
      card.style.borderRadius = '1rem';
      card.style.padding = '1.5rem';
      card.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '1rem';

      // ♥ Tính toán label ngày khởi hành
      const jsonStr = JSON.stringify(it.planJson);
      let tripDateLabel = '';
      let tripDateBadge = '';
      if (it.tripDate) {
        const tripD = new Date(it.tripDate);
        const tripDateStr = tripD.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        const today = new Date(); today.setHours(0,0,0,0);
        const tripDay = new Date(it.tripDate); tripDay.setHours(0,0,0,0);
        const diffDays = Math.round((tripDay - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          tripDateBadge = `<span style="background:#10b981;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">🔔 HÔM NAY!</span>`;
        } else if (diffDays > 0 && diffDays <= 7) {
          tripDateBadge = `<span style="background:#f59e0b;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">⏳ Còn ${diffDays} ngày</span>`;
        } else if (diffDays < 0) {
          tripDateBadge = `<span style="background:#94a3b8;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">✅ Đã đi</span>`;
        } else {
          tripDateBadge = `<span style="background:#6366f1;color:#fff;padding:0.2rem 0.75rem;border-radius:2rem;font-size:0.8rem;font-weight:700;">📅 Còn ${diffDays} ngày</span>`;
        }
        tripDateLabel = `• 🛫 Khởi hành: ${tripDateStr}`;
      }

      let inner = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.5rem; color: #0f172a; margin: 0;">${it.destination || 'Điểm đến'}</h2>
              ${tripDateBadge}
            </div>
            <p style="color: #64748b; font-size: 0.95rem;">🕒 Xếp lịch: ${it.days} Ngày • 💰 ${it.budget} ${tripDateLabel} • 📅 Lưu ngày ${dpDateString}</p>
          </div>
          <button class="view-detail-btn planner-btn" style="padding: 0.5rem 1.25rem; font-size: 0.9rem;" data-json='${jsonStr.replace(/'/g, "&#39;")}'>
            Xem Lịch Trình
          </button>
        </div>
      `;

      card.innerHTML = inner;
      tripsList.appendChild(card);
    });

    document.querySelectorAll('.view-detail-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const jsonText = e.target.getAttribute('data-json');
        if (jsonText) {
          try {
             const obj = JSON.parse(jsonText);
             // In future, redirect to a dedicated render page. For now, we pop up a simple UI or print to console.
             // We can use session storage to pass it to planner.html or a new display.html
             sessionStorage.setItem('wander_view_trip', jsonText);
             window.location.href = 'planner.html?view=true';
          } catch(err) {
            alert('Dữ liệu JSON lỗi!');
          }
        }
      });
    });
  }

});
