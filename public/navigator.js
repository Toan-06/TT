/**
 * navigator.js
 * Cung cấp chức năng GPS độ chính xác cao, tính toán khoảng cách/bearing đến đích, AR Compass
 */

// Cấu hình
const CONFIG = {
  gpsOptions: {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000
  },
  defaultZoom: 18,
  cmThreshold: 5 // m (dưới mức này hiện cm)
};

// Trạng thái cục bộ
const State = {
  map: null,
  userMarker: null,
  targetMarker: null,
  routeLine: null,
  watchId: null,
  userLoc: null, // {lat, lng, acc, speed, heading}
  targetLoc: null, // {lat, lng}
  compassHeading: 0,
  deviceCalibrated: false,
  routeMode: 'foot', // Mặc định đi bộ
  isNavigating: false,
  autoPan: true,
  voiceEnabled: true,
  reachedDest: false,
  waypoints: [],
  currentWaypointIndex: 0
};

// Elements DOM
const els = {
  map: document.getElementById('nav-map'),
  dtg: document.getElementById('dtg-value'),
  dtgVal: document.getElementById('dtg-value'),   // alias dùng trong fetchOSRMRoute
  acc: document.getElementById('acc-value'),
  bearing: document.getElementById('bearing-value'),
  statusText: document.getElementById('status-text'),
  compassArrow: document.getElementById('compass-arrow'),
  targetInput: document.getElementById('target-input'),
  setTargetBtn: document.getElementById('set-target-btn'),
  calibrateBtn: document.getElementById('calibrate-btn'),
  chips: document.querySelectorAll('.chip'),
  transportModeRbs: document.querySelectorAll('input[name="route-mode"]'),
  eta: document.getElementById('eta-value'),
  etaVal: document.getElementById('eta-value'),   // alias dùng trong fetchOSRMRoute
  speed: document.getElementById('speed-value'),
  startBtn: document.getElementById('start-nav-btn'),
  recenterBtn: document.getElementById('recenter-btn'),
  voiceBtn: document.getElementById('voice-btn'),
  voiceIcon: document.getElementById('voice-icon'),
  autocomplete: document.getElementById('autocomplete-list'),
  itiBanner: document.getElementById('itinerary-banner'),
  itiProgress: document.getElementById('itinerary-progress'),
  itiCurrentTarget: document.getElementById('itinerary-current-target'),
  itiNextTarget: document.getElementById('itinerary-next-target'),
  itiSkipBtn: document.getElementById('itinerary-skip-btn'),
  gpsOverlay: document.getElementById('gps-loading-overlay'),
  voiceIndicator: document.getElementById('voice-indicator'),
  voiceStatusText: document.getElementById('voice-status-text')
};

// =================== TIỆN ÍCH TOÁN HỌC ===================
const MathU = {
  toRad: dec => dec * Math.PI / 180,
  toDeg: rad => rad * 180 / Math.PI,

  // Haversine siêu chính xác
  calcDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Đơn vị: mét
    const φ1 = MathU.toRad(lat1);
    const φ2 = MathU.toRad(lat2);
    const Δφ = MathU.toRad(lat2 - lat1);
    const Δλ = MathU.toRad(lon2 - lon1);

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
  },

  // Góc phương vị (Bearing) tới đích
  calcBearing: (lat1, lon1, lat2, lon2) => {
    const φ1 = MathU.toRad(lat1);
    const φ2 = MathU.toRad(lat2);
    const Δλ = MathU.toRad(lon2 - lon1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (MathU.toDeg(θ) + 360) % 360; // 0-359
  }
};

// =================== INIT BẢN ĐỒ ===================
function initMap() {
  State.map = L.map('nav-map', {
    zoomControl: false,
    attributionControl: true  // Bật attribution để đúng license
  }).setView([21.0285, 105.8542], CONFIG.defaultZoom);

  // Layer 1: OSM Standard - Chi tiết đường phố + Nhãn tiếng Việt (từ mã Thùy gửi!)
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });

  // Layer 2: CartoDB Voyager - Nhẹ, sáng sủa (dùng làm phương án dự phòng)
  const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://carto.com">CARTO</a>'
  });

  // OSM làm mặc định (nhiều chi tiết hơn, nhãn tiếng Việt)
  osmLayer.addTo(State.map);

  // Thanh đổi layer (góc trên phải bản đồ)
  L.control.layers(
    { '🗺️ Chi tiết (OSM)': osmLayer, '🧭 Sáng sủa (Carto)': cartoLayer },
    {},
    { position: 'topright', collapsed: true }
  ).addTo(State.map);

  // Thanh tỷ lệ
  L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(State.map);

  // Nút zoom
  L.control.zoom({ position: 'bottomright' }).addTo(State.map);

  State.userMarker = L.divIcon({
    className: 'user-marker-wrap',
    html: '<div class="user-marker"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  // Chặn Auto-pan khi user tự vuốt bản đồ
  State.map.on('dragstart', () => {
    if (State.isNavigating) {
      State.autoPan = false;
      els.recenterBtn.hidden = false;
    }
  });
}

// =================== VOICE AI GUIDE (TRỢ LÝ GIỌNG NÓI) ===================
function initVoiceGuide() {
  if (!window.voiceGuide) return;

  // Cấu hình callback khi nhận được văn bản
  window.voiceGuide.onResultCallback = async (text) => {
    console.log('[Voice Recognition]:', text);
    els.statusText.textContent = `🎤 Bạn nói: "${text}"`;
    
    // Hiển thị trạng thái đang lọc/suy nghĩ
    els.voiceStatusText.textContent = 'Đang suy nghĩ...';
    els.voiceIndicator.classList.add('active');

    // Gửi lên server AI
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: text,
          chatHistory: [] 
        })
      });
      const data = await res.json();
      if (data.success) {
        window.voiceGuide.speak(data.answer);
      } else {
        window.voiceGuide.speak("Tớ chưa hiểu ý bạn lắm, bạn nói lại được không?");
      }
    } catch (e) {
      console.error('Lỗi gọi AI:', e);
      window.voiceGuide.speak("Xin lỗi, tớ gặp chút sự cố kết nối.");
    }
  };

  // Cập nhật UI theo trạng thái
  window.voiceGuide.onStatusChange = (status, error) => {
    els.voiceIndicator.classList.remove('listening', 'speaking');
    els.voiceIndicator.classList.add('active');

    if (status === 'listening') {
      els.voiceIndicator.classList.add('listening');
      els.voiceStatusText.textContent = 'Đang nghe...';
      els.voiceIcon.textContent = '🎤';
    } else if (status === 'speaking') {
      els.voiceIndicator.classList.add('speaking');
      els.voiceStatusText.textContent = 'Đang trả lời...';
      els.voiceIcon.textContent = '🤖';
    } else if (status === 'idle') {
      setTimeout(() => {
        if (!window.voiceGuide.isListening) {
          els.voiceIndicator.classList.remove('active');
          els.voiceIcon.textContent = State.voiceEnabled ? '🔊' : '🔇';
        }
      }, 3000);
    } else if (status === 'error') {
      els.voiceStatusText.textContent = 'Lỗi rồi!';
      els.voiceIndicator.classList.remove('active');
      els.voiceIcon.textContent = '⚠️';
    }
  };

  // Nút bấm kích hoạt
  els.voiceBtn.addEventListener('click', () => {
    if (window.voiceGuide.isListening) {
      window.voiceGuide.stop();
    } else {
      window.voiceGuide.start();
    }
  });
}

// Giữ lại hàm speak cũ để các phần khác trong navigator.js không bị lỗi
function speakMsg(text) {
  if (window.voiceGuide) {
    window.voiceGuide.speak(text);
  }
}

// =================== XỬ LÝ LA BÀN ===================
function initCompass() {
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+ yêu cầu xin quyền
      els.calibrateBtn.addEventListener('click', () => {
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, true);
              els.statusText.textContent = "Đã bật La bàn";
              els.statusText.className = "status-msg success";
              State.deviceCalibrated = true;
            } else {
              els.statusText.textContent = "Bị từ chối quyền La bàn";
              els.statusText.className = "status-msg error";
            }
          })
          .catch(console.error);
      });
      els.statusText.textContent = "Chạm biểu tượng 🧭 trên góc phải để bật la bàn";
    } else {
      // Android / iOS cũ
      window.addEventListener('deviceorientation', handleOrientation, true);
      State.deviceCalibrated = true;
    }
  } else {
    els.statusText.textContent = "Thiết bị không hỗ trợ La bàn hardware.";
  }
}

function handleOrientation(event) {
  let alpha = event.alpha;
  let webkitCompassHeading = event.webkitCompassHeading;
  let heading = 0;

  if (webkitCompassHeading) {
    // iOS
    heading = webkitCompassHeading;
  } else if (alpha !== null) {
    // Android, alpha ngược với la bàn
    heading = 360 - alpha;
  }

  State.compassHeading = heading;
  updateArrowRotation();
}

function updateArrowRotation() {
  if (!State.userLoc || !State.targetLoc) return;

  const bearing = MathU.calcBearing(
    State.userLoc.lat, State.userLoc.lng,
    State.targetLoc.lat, State.targetLoc.lng
  );

  // Mũi tên chỉ về đích = Góc tới đích - Hướng máy hiện tại
  let rotation = bearing - State.compassHeading;
  
  if (els.compassArrow) {
    els.compassArrow.style.transform = `rotate(${rotation}deg)`;
  }
  
  if (els.bearing) {
    els.bearing.innerHTML = `${Math.round(bearing)}<span class="stat-unit">°</span>`;
  }
}


// =================== XỬ LÝ GPS VÀ HIỂN THỊ ===================
function startGPS() {
  if (!("geolocation" in navigator)) {
    els.statusText.textContent = "Trình duyệt không hỗ trợ GPS.";
    els.statusText.className = "status-msg error";
    hideGpsOverlay();
    return;
  }

  // Hiển thị loading overlay GPS
  showGpsOverlay();

  State.watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const crd = pos.coords;
      State.userLoc = {
        lat: crd.latitude,
        lng: crd.longitude,
        acc: crd.accuracy,
        speed: crd.speed,
      };

      // Cập nhật marker
      if (!State.userMarkerObj) {
        // Ẩn loading overlay ngay khi bắt được GPS lần đầu
        hideGpsOverlay();

        State.userMarkerObj = L.marker([crd.latitude, crd.longitude], {icon: State.userMarker}).addTo(State.map);
        State.map.setView([crd.latitude, crd.longitude], CONFIG.defaultZoom);
        if(!els.statusText.textContent.includes('Không tìm thấy')) {
             els.statusText.textContent = `✅ Đã khóa GPS (±${Math.round(crd.accuracy)}m)`;
             els.statusText.className = "status-msg success";
        }
        
        // NẾU CÓ LỊCH TRÌNH CHỜ SẴN -> Bắt đầu parse (Giờ mới có GPS để tính khoảng cách)
        if (State.pendingItinerary) {
           parseItinerary(State.pendingItinerary.plan, State.pendingItinerary.destName);
           State.pendingItinerary = null;
        }

        // Tự động tìm đường nếu chưa có đường mà đã có đích
        if (State.targetLoc && !State.routeLine) {
           fetchOSRMRoute();
        }
      } else {
        State.userMarkerObj.setLatLng([crd.latitude, crd.longitude]);
        if (State.autoPan) {
          // Nếu đang dẫn đường, đảm bảo zoom luôn đủ lớn để nhìn rõ ngã rẽ
          if (State.isNavigating && State.map.getZoom() < CONFIG.defaultZoom) {
             State.map.setView([crd.latitude, crd.longitude], CONFIG.defaultZoom);
          } else {
             State.map.panTo([crd.latitude, crd.longitude]);
          }
        }
      }

      // Xử lý km/h
      let currentSpeed = crd.speed || 0;
      els.speed.innerHTML = `${Math.round(currentSpeed * 3.6)}<span class="stat-unit">km/h</span>`;

      calculateNav();
    },
    (err) => {
      console.warn('GPS Error:', err);
      hideGpsOverlay();
      if (err.code === 1) { // 1 = PERMISSION_DENIED
        els.statusText.innerHTML = `⚠️ Bị từ chối GPS. <button id="demo-btn" class="btn btn--primary" style="padding: 4px 8px; margin-left:8px; font-size:12px; border-radius:8px;">🎮 Chạy Demo</button>`;
        els.statusText.className = "status-msg error";
        
        document.getElementById('demo-btn').addEventListener('click', () => {
          stopGPS();
          startDemoGPS();
        });
      } else if (err.code === 3) { // TIMEOUT
        els.statusText.textContent = `⏱ GPS chậm phản hồi. Đang thử lại...`;
        els.statusText.className = "status-msg error";
      } else {
        els.statusText.textContent = `Lỗi GPS: ${err.message}`;
        els.statusText.className = "status-msg error";
      }
    },
    CONFIG.gpsOptions
  );
}

function showGpsOverlay() {
  if (els.gpsOverlay) els.gpsOverlay.style.display = 'flex';
}

function hideGpsOverlay() {
  if (els.gpsOverlay) {
    els.gpsOverlay.style.animation = 'fadeOut 0.4s ease forwards';
    setTimeout(() => {
      if (els.gpsOverlay) els.gpsOverlay.style.display = 'none';
    }, 400);
  }
}

// =================== DEMO GPS (MÔ PHỎNG) ===================
function startDemoGPS() {
  els.statusText.textContent = "Đang chạy chế độ Demo (Giả lập)...";
  els.statusText.className = "status-msg success";
  
  // Tọa độ giả lập ban đầu (Hà Nội, gần rùa Hồ Gươm)
  let demoLat = 21.0278;
  let demoLng = 105.8523;
  
  State.watchId = setInterval(() => {
    // Mỗi 1 giây di chuyển nhẹ về hướng Đông Bắc
    demoLat += 0.00001;
    demoLng += 0.00001;
    
    let currentSpeed = 5; // ~18km/h
    State.userLoc = {
      lat: demoLat,
      lng: demoLng,
      acc: 5,
      speed: currentSpeed
    };
    els.speed.innerHTML = `${Math.round(currentSpeed * 3.6)}<span class="stat-unit">km/h</span>`;

    if (!State.userMarkerObj) {
      State.userMarkerObj = L.marker([demoLat, demoLng], {icon: State.userMarker}).addTo(State.map);
      State.map.setView([demoLat, demoLng], CONFIG.defaultZoom);
    } else {
      State.userMarkerObj.setLatLng([demoLat, demoLng]);
      if (State.autoPan) {
        State.map.panTo([demoLat, demoLng]);
      }
    }

    calculateNav();
  }, 1000);
}

function stopGPS() {
  if (State.watchId) {
    navigator.geolocation.clearWatch(State.watchId);
    clearInterval(State.watchId); // Clear luôn cả demo nếu đang chạy
  }
}

// Tính toán khoảng cách và gọi render
function calculateNav() {
  if (!State.userLoc || !State.targetLoc) return;

  const distMeters = MathU.calcDistance(
    State.userLoc.lat, State.userLoc.lng,
    State.targetLoc.lat, State.targetLoc.lng
  );

  // Format thông minh hiển thị mm/cm/m/km
  if (distMeters < 1) { // Dưới 1 mét
    const cm = Math.round(distMeters * 100);
    els.dtg.innerHTML = `${cm}<span class="stat-unit">cm</span>`;
    els.dtg.style.color = "var(--success)";
    if(cm < 10 && !State.reachedDest) {
      els.statusText.textContent = "🎉 BẠN ĐÃ ĐẾN ĐÍCH!";
      speakMsg("Bạn đã đến đích. Hoàn thành lộ trình hiện tại.");
      State.reachedDest = true;
      if (State.waypoints && State.waypoints.length > 0) {
         State.isNavigating = false;
         const navStats = document.getElementById('nav-stats');
         if (navStats) navStats.style.setProperty('display', 'none', 'important');
         const previewBox = document.getElementById('preview-box');
         if (previewBox) previewBox.style.setProperty('display', 'flex', 'important');
         els.startBtn.hidden = true;
         const nextBtn = document.getElementById('next-waypoint-btn');
         if (nextBtn) nextBtn.hidden = false;
      }
    }
  } else if (distMeters < 1000) { // Dưới 1km đo bằng mét
    els.dtg.innerHTML = `${Math.round(distMeters)}<span class="stat-unit">m</span>`;
    els.dtg.style.color = "var(--text-main)";
    
    // Auto advance if within 30m
    if(distMeters < 40 && !State.reachedDest) {
      els.statusText.textContent = "🎉 GẦN ĐẾN ĐÍCH!";
      speakMsg("Bạn sắp tới đích.");
      State.reachedDest = true;
      if (State.waypoints && State.waypoints.length > 0) {
         State.isNavigating = false;
         const navStats = document.getElementById('nav-stats');
         if (navStats) navStats.style.setProperty('display', 'none', 'important');
         const previewBox = document.getElementById('preview-box');
         if (previewBox) previewBox.style.setProperty('display', 'flex', 'important');
         els.startBtn.hidden = true;
         const nextBtn = document.getElementById('next-waypoint-btn');
         if (nextBtn) nextBtn.hidden = false;
      }
    }
  } else {
    els.dtg.innerHTML = `${(distMeters / 1000).toFixed(1)}<span class="stat-unit">km</span>`;
    els.dtg.style.color = "white";
  }

  // Tự động vẽ lại đường nếu bác tài chạy lệch (Reroute)
  if (State.isNavigating) {
    const now = Date.now();
    if (!State.lastRouteTime || (now - State.lastRouteTime > 20000)) {
       State.lastRouteTime = now;
       // Gọi fetchOSRMRoute(false) để ko bị spam đọcTTS (TTS pass false parameter nếu có hàm)
       fetchOSRMRoute(false); 
    }
    
    // TURN BY TURN LOGIC (Đọc ngã rẽ)
    if (State.routeSteps && State.routeSteps.length > 0) {
       // OSRM steps contain location [lng, lat]
       let nextStep = State.routeSteps[Math.min(1, State.routeSteps.length - 1)]; 
       if (State.routeSteps.length > 1) {
          const stepDist = MathU.calcDistance(
             State.userLoc.lat, State.userLoc.lng, 
             nextStep.maneuver.location[1], nextStep.maneuver.location[0]
          );
          
          const tbtBanner = document.getElementById('tbt-banner');
          if (tbtBanner) tbtBanner.hidden = false;
          
          let modifierStr = "Đi thẳng";
          let iconStr = "⬆️";
          if(nextStep.maneuver.modifier) {
             if(nextStep.maneuver.modifier.includes('left')) { modifierStr = "Rẽ trái"; iconStr = "⬅️"; }
             else if(nextStep.maneuver.modifier.includes('right')) { modifierStr = "Rẽ phải"; iconStr = "➡️"; }
             else if(nextStep.maneuver.modifier.includes('uturn')) { modifierStr = "Quay đầu"; iconStr = "↩️"; }
          }
          let roadName = nextStep.name ? `vào ${nextStep.name}` : "";
          let fullInst = `${modifierStr} ${roadName}`.trim();
          
          document.getElementById('tbt-dist').textContent = stepDist < 1000 ? `${Math.round(stepDist)} m` : `${(stepDist/1000).toFixed(1)} km`;
          document.getElementById('tbt-text').textContent = fullInst;
          document.getElementById('tbt-icon').textContent = iconStr;

          // Đọc khi cách ngã rẽ dưới 50m và chưa đọc
          if (stepDist < 50 && State.lastSpokenStep !== nextStep.maneuver.location[0]) {
             State.lastSpokenStep = nextStep.maneuver.location[0];
             speakMsg(`Sắp tới, ${modifierStr} ${roadName}`);
          }
       } else {
          const tbtBanner = document.getElementById('tbt-banner');
          if(tbtBanner) tbtBanner.hidden = true;
       }
    }
  }

  // Tính toán Thời gian đến ETA (Dựa trên Speed hoặc mặc định cấu hình)
  let speedMs = (State.userLoc && State.userLoc.speed) ? State.userLoc.speed : 0;
  if (speedMs < 0.5) {
    if (State.routeMode === 'foot') speedMs = 1.38; // 5km/h
    else if (State.routeMode === 'bike') speedMs = 4.16; // 15km/h
    else if (State.routeMode === 'motorcycle') speedMs = 11.11; // 40km/h
    else if (State.routeMode === 'airplane') speedMs = 222.2; // 800km/h
    else speedMs = 13.88; // car: 50km/h
  }
  const etaMins = Math.ceil((distMeters / speedMs) / 60);

  if (etaMins > 60) {
    els.eta.innerHTML = `${Math.floor(etaMins/60)}h${etaMins%60}<span class="stat-unit">p</span>`;
  } else {
    els.eta.innerHTML = `${etaMins}<span class="stat-unit">phút</span>`;
  }

  // Cập nhật la bàn
  updateArrowRotation();
}

// Bắt sự kiện chọn đích
function setTarget(lat, lng) {
  State.targetLoc = {lat: parseFloat(lat), lng: parseFloat(lng)};
  State.reachedDest = false; // Reset cờ đến đích
  
  if (!State.targetMarkerObj) {
    // Sử dụng icon tùy chỉnh cho điểm đến
    const targetIcon = L.divIcon({
      className: 'target-marker-wrap',
      html: '<div class="target-marker-outer"><div class="target-marker-inner"></div></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    State.targetMarkerObj = L.marker([lat, lng], { icon: targetIcon }).addTo(State.map);
  } else {
    State.targetMarkerObj.setLatLng([lat, lng]);
  }

  // Tự động tìm đường ngay khi có đích (nếu đã khoá được GPS)
  if (State.userLoc) {
    fetchOSRMRoute();
  }

  if(State.userLoc) {
    State.map.fitBounds([
      [State.userLoc.lat, State.userLoc.lng],
      [State.targetLoc.lat, State.targetLoc.lng]
    ], {padding: [50, 50]});
  }
}

// ==== HỆ THỐNG ITINERARY (LỊCH TRÌNH CHUYẾN ĐI) ====
async function parseItinerary(plan, destName) {
  els.itiBanner.hidden = false;
  
  // Hide manual search UI to clean up screen
  const searchWrap = document.getElementById('search-wrap');
  if (searchWrap) searchWrap.style.setProperty('display', 'none', 'important');
  const quickTargets = document.getElementById('quick-targets-row');
  if (quickTargets) quickTargets.style.setProperty('display', 'none', 'important');
  const navStats = document.getElementById('nav-stats');
  if (navStats) navStats.style.setProperty('display', 'none', 'important');
  const previewBox = document.getElementById('preview-box');
  if (previewBox) previewBox.style.setProperty('display', 'flex', 'important');

  els.itiProgress.textContent = "🧭 Đang nạp lịch trình AI...";
  
  const points = [];
  if (plan && plan.itinerary) {
     plan.itinerary.forEach(day => {
        if (day.activities) {
           day.activities.forEach(act => {
              if (act.location && act.location.trim() !== '' && !act.location.includes('Tuỳ chọn')) {
                 points.push(`Ngày ${day.day.split(' ')[0]}: ${act.location.trim()}`);
              }
           });
        }
     });
  }
  
  if (points.length === 0) {
     els.itiProgress.textContent = "🧭 Không có điểm đến cụ thể";
     return;
  }

  // CITY-FIRST ROUTING LOGIC: Nếu đang ở cách xa đích đến (Khác tỉnh) > 60km, thì buộc phải dẫn đường tới Thành phố đó trước
  if (destName && State.userLoc) {
     els.itiProgress.textContent = `🧭 Đang định vị vùng điều hướng...`;
     try {
         const crRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destName + ', Vietnam')}&limit=1`);
         const crData = await crRes.json();
         if (crData && crData.length > 0) {
             const cxLat = parseFloat(crData[0].lat);
             const cxLng = parseFloat(crData[0].lon);
             const distToCity = MathU.calcDistance(State.userLoc.lat, State.userLoc.lng, cxLat, cxLng);
             
             // Nếu người dùng cách đích lớn hơn 60km -> Đang ở ngoài tỉnh/thành phố đó
             if (distToCity > 60000) {
                 points.unshift(`Thành phố ${destName}`);
                 console.log(`User is ${distToCity/1000}km away. Added City-First waypoint.`);
             } else {
                 console.log("User is already in or near the destination city. Proceeding with local itinerary.");
             }
         }
     } catch (e) {
         console.error("City-first geocode check failed", e);
     }
  }

  State.waypoints = points;
  State.currentWaypointIndex = 0;
  
  els.itiSkipBtn.hidden = false;
  
  startCurrentWaypoint();
}

async function startCurrentWaypoint() {
  if (State.currentWaypointIndex >= State.waypoints.length) {
     els.itiProgress.textContent = "✅ Hoàn tất hành trình!";
     els.itiCurrentTarget.textContent = "Tuyệt vời, bạn đã đi hết điểm đến!";
     els.itiNextTarget.textContent = "";
     els.itiSkipBtn.hidden = true;
     return;
  }
  
  const wp = State.waypoints[State.currentWaypointIndex];
  // Lấy destName từ storage để dùng trong fallback
  const destName = sessionStorage.getItem('wander_active_dest') || '';

  els.itiProgress.textContent = `🧭 Điểm ${State.currentWaypointIndex + 1}/${State.waypoints.length}`;
  els.itiCurrentTarget.textContent = `Đang tới: ${wp.split(': ')[1] || wp}`;
  
  if (State.currentWaypointIndex + 1 < State.waypoints.length) {
     const nextWp = State.waypoints[State.currentWaypointIndex + 1];
     els.itiNextTarget.textContent = "Tiếp: " + (nextWp.split(': ')[1] || nextWp);
  } else {
     els.itiNextTarget.textContent = "🏁 Điểm cuối cùng!";
  }
  
  els.targetInput.value = wp.split(': ')[1] || wp;
  let query = els.targetInput.value;
  if(query.includes('&')) query = query.split('&')[0].trim();
  if(query.includes('-')) query = query.split('-')[0].trim();
  
  try {
     els.statusText.textContent = `🔍 Đang tìm vị trí: ${query}...`;
     els.statusText.className = "status-msg";
     
     // Thêm destName vào query để chính xác hơn
     let fullQuery = query;
     if (destName && !query.toLowerCase().includes(destName.toLowerCase())) {
        fullQuery = `${query}, ${destName}`;
     }
     
     const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery + ', Vietnam')}&limit=1`);
     let data = await res.json();
     
     // Fallback: Nếu không tìm thấy, thử tìm mỗi tên Tỉnh/Thành phố
     if (!data || data.length === 0) {
        if (destName) {
           const fbRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destName + ', Vietnam')}&limit=1`);
           const fbData = await fbRes.json();
           if (fbData && fbData.length > 0) {
              data = fbData;
              speakMsg(`Không tìm được toạ độ chính xác, bản đồ sẽ dẫn tạm tới trung tâm ${destName}.`);
              els.statusText.textContent = `Dẫn tạm tới trung tâm ${destName}.`;
           }
        }
     }

     if (data && data.length > 0) {
        setTarget(parseFloat(data[0].lat), parseFloat(data[0].lon));
        // Thông báo ngắn gọn, không yêu cầu bấm thêm
        speakMsg(`Đã tìm thấy ${query}. Chọn phương tiện và nhấn Bắt Đầu.`);
        els.statusText.textContent = `✅ Tìm thấy: ${query}`;
        els.statusText.className = "status-msg success";
     } else {
        els.statusText.textContent = `❌ Không tìm được: ${query}. Ấn BỎ QUA hoặc tìm thủ công.`;
        els.statusText.className = "status-msg error";
        speakMsg(`Không tìm được vị trí. Hãy bỏ qua điểm này.`);
        els.setTargetBtn.hidden = false;
     }
  } catch(e) {
     console.error(e);
     els.statusText.textContent = `Lỗi kết nối bản đồ. Vui lòng thử lại.`;
     els.statusText.className = "status-msg error";
  }
}

function advanceWaypoint() {
  State.currentWaypointIndex++;
  startCurrentWaypoint();
}

// =================== FETCH OSRM ROUTE ===================
async function fetchOSRMRoute(speakResult = true) {
  if (!State.userLoc || !State.targetLoc) return;
  els.statusText.textContent = "Đang tìm đường bám theo đường bộ...";
  
  if (State.routeMode === 'airplane') {
     if (State.routeLine) State.map.removeLayer(State.routeLine);
     
     // Vẽ đường chim bay (Nét đứt)
     State.routeLine = L.polyline([
         [State.userLoc.lat, State.userLoc.lng],
         [State.targetLoc.lat, State.targetLoc.lng]
     ], {
         color: '#3b82f6',
         weight: 4,
         dashArray: '10, 10',
         opacity: 0.8
     }).addTo(State.map);

     // Xóa bước TBT
     State.routeSteps = null;
     const tbtBanner = document.getElementById('tbt-banner');
     if(tbtBanner) tbtBanner.hidden = true;

     const distMeters = MathU.calcDistance(State.userLoc.lat, State.userLoc.lng, State.targetLoc.lat, State.targetLoc.lng);
     const distKm = distMeters / 1000;
     const timeMins = Math.round(distKm / 800 * 60); // Tốc độ máy bay 800km/h

     els.dtgVal.innerHTML = `${distKm.toFixed(1)}<span class="stat-unit">km</span>`;
     els.etaVal.innerHTML = `${timeMins > 60 ? Math.floor(timeMins/60)+'g '+(timeMins%60)+'p' : timeMins}<span class="stat-unit">phút</span>`;

     const previewEta = document.getElementById('preview-eta');
     const previewDist = document.getElementById('preview-dist');
     if (previewEta) previewEta.textContent = timeMins > 60 ? `${Math.floor(timeMins/60)} giờ ${timeMins%60} phút` : `${timeMins} phút`;
     if (previewDist) previewDist.textContent = `${distKm.toFixed(1)} km`;

     if (speakResult) {
        els.statusText.textContent = `Đã vẽ đường bay thẳng!`;
        speakMsg(els.statusText.textContent);
     }

     // Hiển thị preview box
     const previewBox = document.getElementById('preview-box');
     if (previewBox) previewBox.style.setProperty('display', 'flex', 'important');
     const navStats = document.getElementById('nav-stats');
     if (navStats) navStats.style.setProperty('display', 'none', 'important');

     els.startBtn.hidden = false;

     // Fit map bounds chỉ khi chưa bắt đầu dẫn đường
     if (!State.isNavigating) {
        State.map.fitBounds(State.routeLine.getBounds(), { padding: [80, 80] });
     }
     return;
  }

  const profileMap = {
    'foot': 'walking',
    'bike': 'cycling',
    'motorcycle': 'driving',
    'car': 'driving'
  };
  const profile = profileMap[State.routeMode] || 'driving';

  // Hàm gọi OSRM và vẽ đường
  async function callOSRM(waypointStr) {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${waypointStr}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return data;
  }

  // ==== GIỮ ĐƯỜNG TRONG LÃNH THỔ VIỆT NAM (DỌC ĐƯỜNG BIỂN) ====
  // Danh sách các điểm "neo" chiến lược dọc QL1A để ép OSRM không đi xuyên biên giới.
  // Được sắp xếp từ Bắc vào Nam.
  const VN_CORRIDOR = [
    { lat: 21.03, lng: 105.84, name: 'Hà Nội' },
    { lat: 20.45, lng: 105.94, name: 'Ninh Bình' },
    { lat: 19.81, lng: 105.78, name: 'Thanh Hoá' },
    { lat: 18.67, lng: 105.68, name: 'Vinh' },
    { lat: 18.34, lng: 105.90, name: 'Hà Tĩnh' },
    { lat: 17.46, lng: 106.62, name: 'Đồng Hới' },
    { lat: 16.89, lng: 107.14, name: 'Quảng Trị' },
    { lat: 16.46, lng: 107.59, name: 'Huế' },
    { lat: 16.05, lng: 108.20, name: 'Đà Nẵng' },
    { lat: 15.08, lng: 108.79, name: 'Quảng Ngãi' },
    { lat: 13.77, lng: 109.22, name: 'Quy Nhơn' },
    { lat: 13.09, lng: 109.31, name: 'Tuy Hoà' },
    { lat: 12.24, lng: 109.19, name: 'Nha Trang' },
    { lat: 11.57, lng: 108.99, name: 'Phan Rang' },
    { lat: 10.94, lng: 108.09, name: 'Phan Thiết' },
    { lat: 10.78, lng: 106.66, name: 'TP. HCM' },
    { lat: 10.26, lng: 105.96, name: 'Vĩnh Long' },
    { lat: 10.04, lng: 105.79, name: 'Cần Thơ' },
    { lat: 9.18,  lng: 105.15, name: 'Cà Mau' }
  ];

  const straightDist = MathU.calcDistance(State.userLoc.lat, State.userLoc.lng, State.targetLoc.lat, State.targetLoc.lng);
  const startPt = `${State.userLoc.lng},${State.userLoc.lat}`;
  const endPt   = `${State.targetLoc.lng},${State.targetLoc.lat}`;

  // THUẬT TOÁN CHỌN ĐIỂM NEO THÔNG MINH:
  // Lấy danh sách điểm neo nằm giữa vĩ độ của điểm đầu và điểm cuối
  const minLat = Math.min(State.userLoc.lat, State.targetLoc.lat);
  const maxLat = Math.max(State.userLoc.lat, State.targetLoc.lat);

  // Lọc các điểm neo nằm trong dải vĩ độ hành trình (lùi vào 0.05 độ để tránh trùng điểm đầu/cuối)
  let anchors = VN_CORRIDOR.filter(pt => pt.lat > minLat + 0.05 && pt.lat < maxLat - 0.05);

  // Sắp xếp theo hướng di chuyển (Bắc -> Nam hoặc ngược lại)
  if (State.userLoc.lat > State.targetLoc.lat) {
    anchors.sort((a, b) => b.lat - a.lat); // Xuôi Nam -> Bắc
  } else {
    anchors.sort((a, b) => a.lat - b.lat); // Xuôi Bắc -> Nam
  }

  // Với hành trình xuyên Việt (> 500km), lấy tối đa 10 điểm neo để "ghim" đường cực chắc
  const maxAnchors = (straightDist > 500000) ? 10 : 5;
  if (anchors.length > maxAnchors) {
    const step = Math.floor(anchors.length / maxAnchors);
    anchors = anchors.filter((_, i) => i % step === 0).slice(0, maxAnchors);
  }

  // Nếu hành trình ngắn (< 100km) và không có điểm neo nào ở giữa, lấy 1 điểm gần nhất
  if (anchors.length === 0 && straightDist > 30000) { // Chỉ thêm neo cho chặng trên 30km
    let closest = VN_CORRIDOR[0];
    let minDist = Infinity;
    VN_CORRIDOR.forEach(pt => {
        const d = MathU.calcDistance((State.userLoc.lat + State.targetLoc.lat)/2, (State.userLoc.lng + State.targetLoc.lng)/2, pt.lat, pt.lng);
        if (d < minDist) { minDist = d; closest = pt; }
    });
    // Chỉ thêm nếu điểm neo này không quá xa (tránh bẻ lái quá gắt cho chặng ngắn)
    if (minDist < 30000) anchors = [closest];
  }

  // Xây dựng chuỗi waypoint
  const anchorStr = anchors.map(a => `${a.lng},${a.lat}`).join(';');
  const waypointWithAnchors = anchors.length > 0 ? `${startPt};${anchorStr};${endPt}` : `${startPt};${endPt}`;
  const waypointDirect = `${startPt};${endPt}`;

  let data = null;

  // --- Lần thử 1: Với các điểm neo (chỉ chạy nếu có anchors) ---
  if (anchors.length > 0) {
    try {
      data = await callOSRM(waypointWithAnchors);
      if (!data || data.code !== 'Ok') data = null;
    } catch(e1) {
      console.warn('OSRM attempt 1 (anchored) failed:', e1.message);
      data = null;
    }
  }

  // --- Lần thử 2: Trực tiếp 2 điểm (nếu anchor gây lỗi) ---
  if (!data) {
    try {
      data = await callOSRM(waypointDirect);
      if (!data || data.code !== 'Ok') data = null;
    } catch(e2) {
      console.warn('OSRM attempt 2 (direct) failed:', e2.message);
      data = null;
    }
  }

  // --- XỬ LÝ KẾT QUẢ ---
  if (data && data.routes && data.routes.length > 0) {
    State.routeSteps = [];
    if (data.routes[0].legs) {
      data.routes[0].legs.forEach(leg => {
        if (leg.steps) State.routeSteps.push(...leg.steps);
      });
    }

    const geojson = data.routes[0].geometry;
    if (State.routeLine) State.map.removeLayer(State.routeLine);
    State.routeLine = L.geoJSON(geojson, {
      style: { color: '#2563eb', weight: 6, opacity: 0.85 }
    }).addTo(State.map);

    // Cập nhật stats
    const distKm = (data.routes[0].distance / 1000).toFixed(1);
    const timeMins = Math.round(data.routes[0].duration / 60);
    els.dtgVal.innerHTML = `${distKm}<span class="stat-unit">km</span>`;
    els.etaVal.innerHTML = `${timeMins > 60 ? Math.floor(timeMins/60)+'g '+(timeMins%60)+'p' : timeMins}<span class="stat-unit">phút</span>`;
    const previewEta = document.getElementById('preview-eta');
    const previewDist = document.getElementById('preview-dist');
    if (previewEta) previewEta.textContent = timeMins > 60 ? `${Math.floor(timeMins/60)} giờ ${timeMins%60} phút` : `${timeMins} phút`;
    if (previewDist) previewDist.textContent = `${distKm} km`;

    const vehicleName = State.routeMode === 'car' ? 'Ô tô' : (State.routeMode === 'motorcycle' ? 'Xe máy' : 'Đi bộ');
    if (speakResult) {
      els.statusText.textContent = `✅ Đã vẽ tuyến đường ${vehicleName} - ${distKm}km!`;
      speakMsg(`Đã tìm thấy đường, khoảng ${distKm} km`);
    }

    // Hiển thị preview box
    const previewBox = document.getElementById('preview-box');
    if (previewBox) previewBox.style.setProperty('display', 'flex', 'important');
    const navStats = document.getElementById('nav-stats');
    if (navStats) navStats.style.setProperty('display', 'none', 'important');

    els.startBtn.hidden = false;

    // Fit map bounds chỉ khi chưa bắt đầu dẫn đường (Preview mode)
    if (!State.isNavigating) {
      State.map.fitBounds(State.routeLine.getBounds(), { padding: [60, 60] });
      els.recenterBtn.hidden = false; // Hiện nút định tâm để user có thể bấm lại nếu lỡ lướt đi
    }

  } else {
    // --- Lần thử 3 (FALLBACK): Vẽ đường thẳng ---
    if (State.routeLine) State.map.removeLayer(State.routeLine);
    State.routeLine = L.polyline([
      [State.userLoc.lat, State.userLoc.lng],
      [State.targetLoc.lat, State.targetLoc.lng]
    ], { color: '#f59e0b', weight: 4, dashArray: '8, 8', opacity: 0.7 }).addTo(State.map);

    const distKm = (straightDist / 1000).toFixed(1);
    const previewEta = document.getElementById('preview-eta');
    const previewDist = document.getElementById('preview-dist');
    if (previewEta) previewEta.textContent = `~${Math.round(straightDist / 50000 * 60)} phút`;
    if (previewDist) previewDist.textContent = `${distKm} km`;

    if (speakResult) els.statusText.textContent = `⚠️ Không tìm được đường bộ. Đang hiển thị đường thẳng ${distKm}km.`;
    els.startBtn.hidden = false;
  }
} // end fetchOSRMRoute

function startNavigation() {
  if (State.isNavigating) return;
  State.isNavigating = true;
  State.autoPan = true;
  els.startBtn.hidden = true;
  if (!State.waypoints || State.waypoints.length === 0) {
    document.getElementById('target-selector').hidden = true; // Ẩn chọn địa điểm để max map
  }
  els.statusText.textContent = "Đang dẫn đường...";
  speakMsg("Bắt đầu dẫn đường. Hãy chú ý an toàn!");
  State.map.setZoom(CONFIG.defaultZoom); // Phóng xuống địa điểm
  calculateNav();
}

// =================== INIT APP ===================
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initCompass();
  startGPS();

  const itJson = sessionStorage.getItem('wander_active_itinerary');
  const destName = sessionStorage.getItem('wander_active_dest') || '';
  
  if (itJson && itJson !== 'undefined') {
    try {
      const plan = JSON.parse(itJson);
      State.pendingItinerary = { plan, destName };
      // parseItinerary is entirely deferred until startGPS() gets userLoc!
    } catch(e) {
      console.error(e);
    }
  } else {
    // Check if dest is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const destQuery = urlParams.get('dest');
    if (destQuery) {
       els.targetInput.value = destQuery;
       const evt = new Event('input');
       els.targetInput.dispatchEvent(evt);
    }
  }

  els.itiSkipBtn.addEventListener('click', () => {
     advanceWaypoint();
  });

  els.startBtn.addEventListener('click', () => {
     State.isNavigating = true;
     State.autoPan = true;
     State.reachedDest = false;
     els.startBtn.hidden = true;
     document.getElementById('target-selector').hidden = true; 
     
     const navStats = document.getElementById('nav-stats');
     if (navStats) navStats.style.setProperty('display', 'flex', 'important');
     const previewBox = document.getElementById('preview-box');
     if (previewBox) previewBox.style.setProperty('display', 'none', 'important');
     
     // Hiện nút "Đã đến" để người dùng có thể tự bấm
     const arrivedBtn = document.getElementById('arrived-btn');
     if (arrivedBtn) arrivedBtn.hidden = false;
     
     // Ẩn nút tiếp tục nếu đang hiện
     const nextBtn = document.getElementById('next-waypoint-btn');
     if (nextBtn) nextBtn.hidden = true;

     els.statusText.textContent = "Đang dẫn đường...";
     speakMsg("Bắt đầu dẫn đường. Hãy chú ý an toàn!");
     State.map.setZoom(CONFIG.defaultZoom);
     calculateNav();
  });

  const nextBtn = document.getElementById('next-waypoint-btn');
  if (nextBtn) {
     nextBtn.addEventListener('click', () => {
         nextBtn.hidden = true;
         const arrivedBtn = document.getElementById('arrived-btn');
         if (arrivedBtn) arrivedBtn.hidden = true;
         advanceWaypoint();
     });
  }

  // Nút "Đã đến nơi" - Người dùng tự bấm khi đã đến điểm
  const arrivedBtn = document.getElementById('arrived-btn');
  if (arrivedBtn) {
     arrivedBtn.addEventListener('click', () => {
         arrivedBtn.hidden = true;
         State.isNavigating = false;
         State.reachedDest = true;
         speakMsg("Bạn đã đến nơi! Chuyển sang điểm tiếp theo.");
         
         // Ẩn stats, hiện preview + nút tiếp tục
         const navStats = document.getElementById('nav-stats');
         if (navStats) navStats.style.setProperty('display', 'none', 'important');
         const previewBox = document.getElementById('preview-box');
         if (previewBox) previewBox.style.setProperty('display', 'flex', 'important');
         
         if (State.waypoints && State.currentWaypointIndex < State.waypoints.length - 1) {
            // Còn điểm tiếp theo - hiện nút Tiếp Tục
            const next = document.getElementById('next-waypoint-btn');
            if (next) next.hidden = false;
         } else {
            // Đã xong hành trình
            els.itiProgress.textContent = "✅ Hoàn thành hành trình!";
            els.itiCurrentTarget.textContent = "Bạn đã đi hết tất cả điểm đến!";
            els.itiNextTarget.textContent = "";
            speakMsg("Chúc mừng! Bạn đã hoàn thành toàn bộ hành trình.");
         }
     });
  }

  els.recenterBtn.addEventListener('click', () => {
    els.recenterBtn.hidden = true;
    
    if (State.isNavigating) {
      State.autoPan = true;
      if (State.userLoc) {
        State.map.setView([State.userLoc.lat, State.userLoc.lng], CONFIG.defaultZoom);
      }
    } else {
      // Nếu chưa dẫn đường, định tâm về toàn bộ lộ trình
      if (State.routeLine) {
        State.map.fitBounds(State.routeLine.getBounds(), { padding: [60, 60] });
      } else if (State.userLoc) {
        State.map.setView([State.userLoc.lat, State.userLoc.lng], CONFIG.defaultZoom);
      }
    }
  });
  
  els.voiceBtn.addEventListener('click', () => {
    State.voiceEnabled = !State.voiceEnabled;
    els.voiceIcon.textContent = State.voiceEnabled ? '🔊' : '🔇';
    if(State.voiceEnabled) speakMsg("Đã bật trợ lý giọng nói");
    else window.speechSynthesis.cancel();
  });

  // TÌM KIẾM ĐỊA CHỈ (AUTOCOMPLETE NOMINATIM OSM)
  let searchTimeout = null;
  els.targetInput.addEventListener('input', (e) => {
    els.setTargetBtn.hidden = false; // Luôn hiện nút "Đi" khi người dùng sửa
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (query.length < 3) {
      els.autocomplete.hidden = true;
      return;
    }
    searchTimeout = setTimeout(() => {
      fetchNominatim(query);
    }, 600);
  });

  async function fetchNominatim(query) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn&limit=5`);
      const data = await res.json();
      els.autocomplete.innerHTML = '';
      if (data && data.length > 0) {
        data.forEach(item => {
          const li = document.createElement('li');
          li.className = 'autocomplete-item';
          li.textContent = item.display_name;
          li.addEventListener('click', () => {
             els.targetInput.value = item.display_name.split(',')[0];
             els.autocomplete.hidden = true;
             setTarget(item.lat, item.lon);
          });
          els.autocomplete.appendChild(li);
        });
        els.autocomplete.hidden = false;
      } else {
        els.autocomplete.hidden = true;
      }
    } catch(e) {
      console.warn('Geocoding error', e);
    }
  }

  // Ẩn Autocomplete khi click ra ngoài
  document.addEventListener('click', (e) => {
    if (!els.targetInput.contains(e.target) && !els.autocomplete.contains(e.target)) {
      els.autocomplete.hidden = true;
    }
  });

  els.setTargetBtn.addEventListener('click', () => {
    const val = els.targetInput.value.trim();
    if (val) {
      const parts = val.split(',');
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setTarget(parts[0], parts[1]);
      } else {
        alert("Sai định dạng. Vui lòng nhập: Vĩ độ, Kinh độ (Vd: 21.0, 105.8)");
      }
    }
  });

  els.chips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      els.targetInput.value = `${e.target.dataset.lat}, ${e.target.dataset.lng}`;
      setTarget(e.target.dataset.lat, e.target.dataset.lng);
    });
  });

  els.transportModeRbs.forEach(rb => {
    rb.addEventListener('change', (e) => {
      State.routeMode = e.target.value;
      if (State.targetLoc && State.userLoc) {
        fetchOSRMRoute();
      }
    });
  });

  // Khởi tạo Trợ lý Hướng dẫn viên giọng nói
  initVoiceGuide();
});
