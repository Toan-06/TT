(function () {
  "use strict";

  const token = localStorage.getItem('wander_token');
  const errorBox = document.getElementById('admin-error');
  const contentBox = document.getElementById('admin-content');
  const usersTbody = document.getElementById('users-tbody');
  const placesTbody = document.getElementById('places-tbody');

  let usersData = [];
  let placesData = [];
  let feedbacksData = [];

  // --- Auth Check ---
  if (!token) {
    showError();
  } else {
    initAdmin();
  }

  function showError() {
    errorBox.hidden = false;
    contentBox.hidden = true;
  }

  async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['x-auth-token'] = token;
    if (options.body && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, options);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        showError();
        throw new Error('Unauthorized');
      }
      throw new Error(`API error: ${res.status}`);
    }
    return res.json();
  }

  async function initAdmin() {
    try {
      // Get current user profile for greeting
      const meRes = await apiFetch('/api/auth/me');
      if (meRes.success && meRes.user) {
        document.getElementById('admin-greeting').textContent = `Xin chào, ${meRes.user.displayName || meRes.user.name}`;
      }

      await loadUsers();
      await loadPlaces();
      await loadFeedbacks();
      contentBox.hidden = false;
      updateStats();
    } catch (e) {
      console.error(e);
      // Nếu có lỗi fetch (kể cả data UI), vẫn ráng hiện UI chính
      contentBox.hidden = false;
    }
  }

  function updateStats() {
    document.getElementById('stat-users').textContent = usersData.length;
    document.getElementById('stat-admin').textContent = usersData.filter(u => u.isAdmin).length;
    document.getElementById('stat-places').textContent = placesData.length;
    
    const feedStat = document.getElementById('stat-feedbacks');
    if (feedStat) feedStat.textContent = feedbacksData.length;
  }

  // --- Tabs ---
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.remove('is-active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.hidden = true);

      btn.classList.add('is-active');
      const target = btn.getAttribute('data-admin-tab');
      document.getElementById('panel-' + target).hidden = false;
    });
  });

  // --- Users ---
  async function loadUsers() {
    usersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Đang tải...</td></tr>';
    const json = await apiFetch('/api/admin/users');
    if (json.success) {
      usersData = json.data;
      renderUsers(usersData);
    }
  }

  function renderUsers(users) {
    usersTbody.innerHTML = '';
    if (users.length === 0) {
      usersTbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Không tìm thấy người dùng</td></tr>';
      return;
    }
    users.forEach(u => {
      const tr = document.createElement('tr');
      const date = new Date(u.createdAt).toLocaleDateString('vi-VN');
      tr.innerHTML = `
        <td><img src="${u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name) + '&background=random'}" alt="" style="width:40px;height:40px;border-radius:50%" /></td>
        <td><strong>${u.displayName || u.name}</strong><br><small style="color:var(--text-muted)">${u.email}</small></td>
        <td>${u.phone || '—'}</td>
        <td>
          <span class="dest-pill" style="background:${u.isAdmin ? 'var(--accent)' : 'rgba(148,163,184,0.2)'};color:${u.isAdmin ? '#fff' : 'var(--text)'};font-size:0.7rem">
            ${u.isAdmin ? 'Admin' : 'User'}
          </span>
        </td>
        <td>${date}</td>
        <td>
          <button class="btn btn--small btn--primary" data-edit-user="${u._id}">Sửa</button>
        </td>
      `;
      usersTbody.appendChild(tr);
    });

    document.querySelectorAll('[data-edit-user]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-edit-user');
        const user = usersData.find(x => x._id === id);
        if (user) openUserModal(user);
      });
    });
  }

  document.getElementById('user-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = usersData.filter(u =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.displayName && u.displayName.toLowerCase().includes(q))
    );
    renderUsers(filtered);
  });

  // --- User Modal ---
  const userModal = document.getElementById('modal-user-form');
  const userForm = document.getElementById('user-form');
  const btnDeleteUser = document.getElementById('btn-delete-user');
  const userFormStatus = document.getElementById('user-form-status');

  let _originalIsAdmin = false; // lưu trạng thái isAdmin ban đầu

  function openUserModal(user) {
    userForm.reset();
    userFormStatus.textContent = '';
    userFormStatus.className = '';

    userForm.elements['id'].value = user._id;
    userForm.elements['name'].value = user.name || '';
    userForm.elements['displayName'].value = user.displayName || '';
    userForm.elements['email'].value = user.email || '';
    userForm.elements['phone'].value = user.phone || '';
    userForm.elements['avatar'].value = user.avatar || '';
    userForm.elements['notes'].value = user.notes || '';
    document.getElementById('chk-is-admin').checked = !!user.isAdmin;
    _originalIsAdmin = !!user.isAdmin; // ghi nhớ trạng thái gốc

    document.getElementById('admin-modal-backdrop').hidden = false;
    userModal.hidden = false;
  }

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = userForm.elements['id'].value;
    const newIsAdmin = document.getElementById('chk-is-admin').checked;
    const userName = userForm.elements['displayName'].value || userForm.elements['name'].value || 'người dùng này';

    // Xác nhận nếu quyền Admin thay đổi
    if (newIsAdmin !== _originalIsAdmin) {
      const action = newIsAdmin
        ? `Bạn có chắc muốn cấp quyền Admin cho "${userName}" không?`
        : `Bạn có chắc muốn thu hồi quyền Admin của "${userName}" không?`;
      if (!confirm(action)) return;
    }

    const body = {
      name: userForm.elements['name'].value,
      displayName: userForm.elements['displayName'].value,
      email: userForm.elements['email'].value,
      phone: userForm.elements['phone'].value,
      avatar: userForm.elements['avatar'].value,
      notes: userForm.elements['notes'].value,
      isAdmin: newIsAdmin
    };

    userFormStatus.textContent = 'Đang lưu...';
    userFormStatus.style.color = 'var(--text-muted)';

    try {
      const res = await apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      if (res.success) {
        userFormStatus.textContent = 'Đã lưu thành công!';
        userFormStatus.style.color = '#4ade80';
        await loadUsers();
        updateStats();
        setTimeout(() => closeAllModals(), 1000);
      } else {
        userFormStatus.textContent = res.message || 'Lỗi lưu thông tin';
        userFormStatus.style.color = '#f87171';
      }
    } catch (err) {
      userFormStatus.textContent = 'Lỗi kết nối máy chủ';
      userFormStatus.style.color = '#f87171';
    }
  });

  btnDeleteUser.addEventListener('click', async () => {
    const id = userForm.elements['id'].value;
    const userName = userForm.elements['displayName'].value || userForm.elements['name'].value || 'tài khoản này';
    if (!confirm(`Bạn có chắc muốn XÓA tài khoản "${userName}" không?\nHành động này không thể hoàn tác!`)) return;

    try {
      const res = await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.success) {
        alert('Đã xóa tài khoản');
        closeAllModals();
        await loadUsers();
        updateStats();
      } else {
        alert(res.message || 'Không thể xóa tài khoản');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ');
    }
  });


  // --- Places ---
  async function loadPlaces() {
    placesTbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Đang tải...</td></tr>';
    const json = await apiFetch('/api/admin/places');
    if (json.success) {
      placesData = json.data;
      renderPlaces(placesData);
    }
  }

  function renderPlaces(places) {
    placesTbody.innerHTML = '';
    if (places.length === 0) {
      placesTbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Chưa có điểm đến nào</td></tr>';
      return;
    }
    places.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><img src="${p.image || 'https://via.placeholder.com/60'}" alt="" style="width:60px;height:40px;border-radius:4px" /></td>
        <td><strong>${p.name}</strong> ${p.top ? '<span style="color:#f59e0b">★</span>' : ''}<br><small style="color:var(--text-muted)">ID: ${p.id}</small></td>
        <td>${p.region || '—'}</td>
        <td>Mức: ${p.budget || '—'}</td>
        <td><small>${p.lat || '-'}, ${p.lng || '-'}</small></td>
        <td>
          <button class="btn btn--small btn--primary" data-edit-place="${p.id}">Sửa</button>
        </td>
      `;
      placesTbody.appendChild(tr);
    });

    document.querySelectorAll('[data-edit-place]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-edit-place');
        const place = placesData.find(x => x.id === id);
        if (place) openPlaceModal(place);
      });
    });
  }

  document.getElementById('place-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = placesData.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.region && p.region.toLowerCase().includes(q)) ||
      (p.tags && p.tags.join(' ').toLowerCase().includes(q))
    );
    renderPlaces(filtered);
  });

  // --- Place Modal ---
  const placeModal = document.getElementById('modal-place-form');
  const placeForm = document.getElementById('place-form');
  const btnAddPlace = document.getElementById('btn-add-place');
  const btnDeletePlace = document.getElementById('btn-delete-place');
  const placeFormStatus = document.getElementById('place-form-status');

  btnAddPlace.addEventListener('click', () => {
    openPlaceModal();
  });

  function openPlaceModal(place = null) {
    placeForm.reset();
    placeFormStatus.textContent = '';
    placeFormStatus.className = '';
    document.getElementById('place-modal-title').textContent = place ? 'Sửa Điểm Đến' : 'Thêm Mới Điểm Đến';
    btnDeletePlace.hidden = !place;

    if (place) {
      placeForm.elements['id'].value = place.id || '';
      placeForm.elements['name'].value = place.name || '';
      placeForm.elements['region'].value = place.region || '';
      placeForm.elements['image'].value = place.image || '';
      placeForm.elements['budget'].value = place.budget || 2;
      placeForm.elements['pace'].value = place.pace || 'vua';
      placeForm.elements['lat'].value = place.lat || '';
      placeForm.elements['lng'].value = place.lng || '';
      placeForm.elements['tags'].value = (place.tags || []).join(', ');
      placeForm.elements['meta'].value = place.meta || '';
      placeForm.elements['text'].value = place.text || '';
      placeForm.elements['sourceName'].value = place.sourceName || '';
      placeForm.elements['sourceUrl'].value = place.sourceUrl || '';
      placeForm.elements['transportTips'].value = place.transportTips || '';
      document.getElementById('chk-top').checked = !!place.top;
    } else {
      placeForm.elements['id'].value = '';
    }

    document.getElementById('admin-modal-backdrop').hidden = false;
    placeModal.hidden = false;
  }

  placeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = placeForm.elements['id'].value;
    const body = {
      name: placeForm.elements['name'].value,
      region: placeForm.elements['region'].value,
      image: placeForm.elements['image'].value,
      budget: Number(placeForm.elements['budget'].value),
      pace: placeForm.elements['pace'].value,
      lat: Number(placeForm.elements['lat'].value) || undefined,
      lng: Number(placeForm.elements['lng'].value) || undefined,
      tags: placeForm.elements['tags'].value.split(',').map(tag => tag.trim()).filter(tag => tag),
      meta: placeForm.elements['meta'].value,
      text: placeForm.elements['text'].value,
      sourceName: placeForm.elements['sourceName'].value,
      sourceUrl: placeForm.elements['sourceUrl'].value,
      transportTips: placeForm.elements['transportTips'].value,
      top: document.getElementById('chk-top').checked
    };

    placeFormStatus.textContent = 'Đang lưu...';
    placeFormStatus.style.color = 'var(--text-muted)';

    try {
      let res;
      if (id) {
        res = await apiFetch(`/api/admin/places/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        res = await apiFetch(`/api/admin/places`, { method: 'POST', body: JSON.stringify(body) });
      }

      if (res.success) {
        placeFormStatus.textContent = 'Đã lưu thành công!';
        placeFormStatus.style.color = '#4ade80';
        await loadPlaces();
        updateStats();
        setTimeout(() => closeAllModals(), 1000);
      } else {
        placeFormStatus.textContent = res.message || 'Lỗi lưu thông tin';
        placeFormStatus.style.color = '#f87171';
      }
    } catch (err) {
      placeFormStatus.textContent = 'Lỗi kết nối máy chủ';
      placeFormStatus.style.color = '#f87171';
    }
  });

  btnDeletePlace.addEventListener('click', async () => {
    const id = placeForm.elements['id'].value;
    if (!id || !confirm('Hành động này không thể hoàn tác. Bạn có chắc muốn xóa điểm này?')) return;

    try {
      const res = await apiFetch(`/api/admin/places/${id}`, { method: 'DELETE' });
      if (res.success) {
        alert('Đã xóa thành công');
        closeAllModals();
        await loadPlaces();
        updateStats();
      } else {
        alert(res.message || 'Không thể xóa');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ');
    }
  });

  // --- Utils ---
  function closeAllModals() {
    userModal.hidden = true;
    placeModal.hidden = true;
    document.getElementById('admin-modal-backdrop').hidden = true;
  }

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.getElementById('admin-modal-backdrop').addEventListener('click', closeAllModals);

  // --- Feedbacks ---
  async function loadFeedbacks() {
    const fnTable = document.getElementById('feedbacks-tbody');
    if (!fnTable) return;
    
    fnTable.innerHTML = '<tr><td colspan="5" style="text-align:center">Đang tải...</td></tr>';
    try {
      const json = await apiFetch('/api/admin/feedbacks');
      if (json.success) {
        feedbacksData = json.data;
        renderFeedbacks(feedbacksData);
      }
    } catch (err) {
      fnTable.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red">Lỗi tải dữ liệu</td></tr>';
    }
  }

  function renderFeedbacks(feedbacks) {
    const fnTable = document.getElementById('feedbacks-tbody');
    if (!fnTable) return;

    fnTable.innerHTML = '';
    if (feedbacks.length === 0) {
      fnTable.innerHTML = '<tr><td colspan="5" style="text-align:center">Chưa có phản hồi nào</td></tr>';
      return;
    }

    feedbacks.forEach(fb => {
      const tr = document.createElement('tr');
      const date = new Date(fb.createdAt);
      const timeStr = `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`;
      
      tr.innerHTML = `
        <td><small style="color:var(--text-muted)">${timeStr}</small></td>
        <td><strong>${fb.name}</strong></td>
        <td><a href="mailto:${fb.email}" style="color:var(--text-muted); text-decoration:underline;">${fb.email}</a></td>
        <td style="white-space:normal; line-height:1.4">${(fb.message || '').replace(/\n/g, '<br>')}</td>
        <td>
          <button class="btn btn--ghost btn--small delete-fb-btn" data-id="${fb._id}" style="color:#f87171;border-color:rgba(248,113,113,0.4)">Xóa</button>
        </td>
      `;
      fnTable.appendChild(tr);
    });

    document.querySelectorAll('.delete-fb-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const id = this.getAttribute('data-id');
        if (confirm('Bạn có chắc chắn muốn xóa phản hồi này vĩnh viễn không?')) {
          try {
            const res = await apiFetch('/api/admin/feedbacks/' + id, { method: 'DELETE' });
            if (res.success) {
              await loadFeedbacks();
              updateStats();
            } else {
              alert('Lỗi: ' + res.message);
            }
          } catch (e) {
            alert('Lỗi kết nối máy chủ');
          }
        }
      });
    });
  }

  const fbSearchInput = document.getElementById('feedback-search');
  if (fbSearchInput) {
    fbSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const filtered = feedbacksData.filter(fb => {
        const text = ((fb.name || '') + ' ' + (fb.email || '') + ' ' + (fb.message || '')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return text.includes(q);
      });
      renderFeedbacks(filtered);
    });
  }

})();
