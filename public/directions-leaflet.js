/**
 * public/directions-leaflet.js
 * Sử dụng Nominatim (Geocoding - Đổi chữ thành Tọa độ) 
 * và OSRM (Routing - Vẽ đường) hoàn toàn miễn phí.
 */

const originInput = document.getElementById('origin-input');
const destInput = document.getElementById('dest-input');
const searchBtn = document.getElementById('search-btn');
const statusMsg = document.getElementById('status-message');
const routeSummary = document.getElementById('route-summary');
const summaryTime = document.getElementById('summary-time');
const summaryDistance = document.getElementById('summary-distance');
const askAiBtn = document.getElementById('ask-ai-btn');
const aiAdviceBox = document.getElementById('ai-advice-box');
const modeBtns = document.querySelectorAll('.mode-btn');

let map, routeLayer, originMarker, destMarker;
let currentMode = 'driving'; // Mặc định là driving
let currentRouteData = null;

// ITINERARY VARIABLES
let itiWaypoints = [];
let itiIndex = 0;
let isNavigatingIti = false;
let userLat = null;
let userLon = null;
let currentTargetCoordsObj = null;

const itiSection = document.getElementById('iti-section');
const itiProgress = document.getElementById('iti-progress');
const itiNext = document.getElementById('iti-next');
const startItiBtn = document.getElementById('start-iti-btn');
const skipItiBtn = document.getElementById('skip-iti-btn');

// Khởi tạo bản đồ 
function initMap() {
  map = L.map('map').setView([16.047079, 108.206230], 6); // Set view ở giữa VN

  // Thêm TileLayer (Giao diện bản đồ) từ OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

// Bắt sự kiện chọn phương tiện
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Đổi UI Nút
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Lưu mode hiện tại (OSRM profile thường là driving, walking, cycling)
    currentMode = btn.dataset.mode;
    
    // Nếu đã có input, tự động tìm lại đường
    if (originInput.value && destInput.value && currentRouteData) {
      calculateRoute();
    } else if (itiSection.style.display !== 'none' && isNavigatingIti) {
      runItineraryPoint(); // Nếu chọn xe lúc đang đi Itinerary thì tự update lại đường
    }
  });
});

// Bắt sự kiện bấm nút "Tìm đường đi"
searchBtn.addEventListener('click', calculateRoute);

async function calculateRoute() {
  const originQuery = originInput.value.trim();
  const destQuery = destInput.value.trim();

  if (!originQuery || !destQuery) {
    statusMsg.innerText = "Vui lòng nhập đủ Điểm đi và Điểm đến!";
    return;
  }

  statusMsg.innerText = "Đang tìm vị trí...";
  routeSummary.classList.remove('active');
  aiAdviceBox.classList.remove('active');

  try {
    // 1. Dùng Nominatim API để lấy tọa độ của điểm Đi và Đến
    const coordsOrigin = await geocode(originQuery);
    const coordsDest = await geocode(destQuery);

    if (!coordsOrigin || !coordsDest) {
      statusMsg.innerText = "Không tìm thấy địa điểm. Thử nhập rõ ràng hơn (VD: Hà Nội, Việt Nam).";
      return;
    }

    statusMsg.innerText = "Đang vẽ đường...";

    // 2. Gọi OSRM Routing API (Route Machine)
    // Profile của OSRM: route/v1/{profile}/{coordinates}
    // profile: driving, walking, cycling (leaflet OSRM server demo hỗ trợ driving, walking)
    const osrmUrl = `https://router.project-osrm.org/route/v1/${currentMode}/${coordsOrigin.lon},${coordsOrigin.lat};${coordsDest.lon},${coordsDest.lat}?overview=full&geometries=geojson`;
    
    const routeRes = await fetch(osrmUrl);
    const routeData = await routeRes.json();

    if (routeData.code !== 'Ok' || !routeData.routes || routeData.routes.length === 0) {
      statusMsg.innerText = "Không thể tìm thấy đường đi bộ/đường xe trên bản đồ.";
      return;
    }

    // 3. Hiển thị lên Bản đồ
    statusMsg.innerText = "";
    drawRouteOnMap(routeData.routes[0], coordsOrigin, coordsDest);
    
    // Lưu lại thông tin gọn để gửi cho AI
    currentRouteData = {
      origin: originQuery,
      destination: destQuery,
      distance: (routeData.routes[0].distance / 1000).toFixed(1) + ' km',
      duration: formatDuration(routeData.routes[0].duration),
      mode: currentMode
    };

    // Hiển thị tóm tắt UI
    summaryDistance.innerText = currentRouteData.distance;
    summaryTime.innerText = currentRouteData.duration;
    routeSummary.classList.add('active');

  } catch (error) {
    console.error("Calculate Route Error:", error);
    statusMsg.innerHTML = `<strong>❌ Lỗi máy chủ:</strong> ${error.message}. (Server OSRM hoặc OSM có thể đang bị quá tải, hãy thử lại URL khác hoặc dùng GMap).`;
  }
}

// Hàm Geocode (chuyển chữ thành Tọa độ) qua OpenStreetMap Nominatim
async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Vietnam')}&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
  }
  return null;
}

// Hàm vẽ Polyline lên bản đồ
function drawRouteOnMap(route, start, end) {
  // Xóa layer cũ
  if (routeLayer) map.removeLayer(routeLayer);
  if (originMarker) map.removeLayer(originMarker);
  if (destMarker) map.removeLayer(destMarker);

  // Tạo line xanh
  routeLayer = L.geoJSON(route.geometry, {
    style: { color: '#2563eb', weight: 5, opacity: 0.8 }
  }).addTo(map);

  // Marker
  originMarker = L.marker([start.lat, start.lon]).addTo(map).bindPopup("Vị trí của bạn");
  destMarker = L.marker([end.lat, end.lon]).addTo(map).bindPopup("Điểm Đến");

  // Zoom bản đồ vừa với đường vẽ
  map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
}

// Cập nhật vị trí marker người dùng khi đang di chuyển (real-time)
function updateOriginMarker(lat, lon) {
  if (originMarker) {
    originMarker.setLatLng([lat, lon]);
    // Nếu muốn bản đồ bám theo người dùng thì uncomment dòng dưới:
    // map.panTo([lat, lon]);
  }
}

// Convert giây của OSRM sang Định dạng phút, giờ
function formatDuration(seconds) {
  if (seconds < 60) return "Dưới 1 phút";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  const reMins = mins % 60;
  return `${hours} giờ ${reMins} phút`;
}

// ======================== TÍCH HỢP AI GEMINI & GIỌNG NÓI ========================
// Giữ lại hàm speak cũ nhưng chuyển sang hệ thống VoiceGuide mới
function speakMsg(text) {
  if (window.voiceGuide) {
    window.voiceGuide.speak(text);
  }
}

askAiBtn.addEventListener('click', async () => {
  if (!currentRouteData) return;

  // Hiệu ứng Loading
  askAiBtn.innerHTML = '<span class="loading-spinner"></span> Đang phân tích...';
  askAiBtn.disabled = true;
  aiAdviceBox.classList.remove('active');

  try {
    const res = await fetch('/api/directions/ai-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentRouteData)
    });

    const data = await res.json();
    if (data.success) {
      aiAdviceBox.innerHTML = `<strong>💡 Lời khuyên:</strong><br/>${data.advice}
      <div style="margin-top: 10px;">
        <button id="stop-voice-btn" class="btn btn--ghost btn--small">🛑 Dừng đọc</button>
      </div>`;
      // AI Giọng nói tự động đọc lời khuyên
      speakText(data.advice);
      
      // Xử lý nứt dừng đọc
      document.getElementById('stop-voice-btn').addEventListener('click', () => {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      });
    } else {
      aiAdviceBox.innerHTML = `❌ Lỗi: ${data.message}`;
    }
    aiAdviceBox.classList.add('active');
  } catch (err) {
    aiAdviceBox.innerHTML = "❌ Không thể kết nối với server AI.";
    aiAdviceBox.classList.add('active');
  }

// Khôi phục nút
  askAiBtn.innerHTML = '✨ Trợ lý AI Khuyên Dùng';
  askAiBtn.disabled = false;
});

// Chạy khởi tạo map khi tải trang
initMap();

// Tự động điền lộ trình nếu có query truyền vào từ My Trips
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const destQuery = urlParams.get('dest');
  const itJson = sessionStorage.getItem('wander_active_itinerary');

  if (itJson && itJson !== 'undefined') {
    // Chế độ Lịch Trình (Itinerary)
    document.querySelector('.input-section').style.display = 'none';
    itiSection.style.display = 'block';

    try {
      const plan = JSON.parse(itJson);
      plan.itinerary.forEach(day => {
        if (day.activities) {
          day.activities.forEach(act => {
            if (act.location && act.location.trim() !== '' && !act.location.includes('Tuỳ chọn')) {
               let loc = act.location;
               if(loc.includes('&')) loc = loc.split('&')[0];
               if(loc.includes('-')) loc = loc.split('-')[0];
               itiWaypoints.push(`Ngày ${day.day.split(' ')[0]}: ${loc.trim()}`);
            }
          });
        }
      });
      itiProgress.innerText = `Hành trình: 0/${itiWaypoints.length} điểm`;
      startLiveTrackingItinerary();
    } catch(e) { console.error(e); }

  } else if (destQuery) {
    // Chế độ Mặc Định (1 điểm đến)
    destInput.value = destQuery;
    statusMsg.innerHTML = 'Đang lấy vị trí hiện tại của bạn... <br/><button class="btn-inline-link" onclick="stopGeoAndManual()">Hoặc nhập thủ công ngay</button>';

    // Định nghĩa hàm global để dùng trong onclick
    window.stopGeoAndManual = () => {
      statusMsg.innerText = "Mời bạn nhập điểm đi thủ công bên dưới:";
      originInput.focus();
      // Ta không thể dừng hẳn watchPosition dễ dàng nếu không lưu ID, 
      // nhưng việc focus và đổi text sẽ giúp người dùng biết họ có thể nhập.
    };
    
    // Tự động định vị và CẬP NHẬT LIÊN TỤC (Real-time tracking)
    if ("geolocation" in navigator) {
      let isFirstTime = true;
      
      // Dùng watchPosition thay vì getCurrentPosition để live tracking
      navigator.geolocation.watchPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        if (isFirstTime) {
          isFirstTime = false;
          try {
            // Lấy địa chỉ hiển thị lần đầu
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            
            if (data && data.display_name) {
              originInput.value = data.display_name;
              calculateRoute();
            } else {
              originInput.value = `${lat}, ${lon}`;
              calculateRoute();
            }
          } catch (e) {
            originInput.value = `${lat}, ${lon}`; 
            calculateRoute();
          }
        } else {
          // Từ lần thứ 2 trở đi, người dùng đang di chuyển thì tự động chạy marker
          updateOriginMarker(lat, lon);
          
          // Thỉnh thoảng vẽ lại đường đi nếu muốn (ở đây tạm giữ đường cũ, chỉ di chuyển marker)
          // Bật cái này nếu muốn route tự update nhưng sẽ gọi API OSRM nhiều
          // currentRouteData.origin = `${lat}, ${lon}`;
          // calculateRoute(true); 
        }
      }, (error) => {
        statusMsg.innerText = "Vui lòng nhập Điểm đi (Không thể lấy vị trí tự động).";
        originInput.focus();
      }, {
        enableHighAccuracy: true,
        maximumAge: 0,
      });
    } else {
      originInput.focus();
    }
  }
});

// ======================== ITINERARY DỰA TRÊN LEAFLET ========================

function startLiveTrackingItinerary() {
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition((position) => {
        userLat = position.coords.latitude;
        userLon = position.coords.longitude;
        
        updateOriginMarker(userLat, userLon);
        
        if (!isNavigatingIti && userLat && startItiBtn.innerText !== "Đang dẫn đường...") {
            itiNext.innerText = "Đã khoá được vị trí GPS. Chọn phương tiện và nhấn BẮT ĐẦU.";
        }

        // Tự động kiểm tra đến đích nếu đang chạy hành trình
        if (isNavigatingIti && currentTargetCoordsObj) {
            const distM = map.distance([userLat, userLon], [currentTargetCoordsObj.lat, currentTargetCoordsObj.lon]);
            if (distM < 50) { // Dưới 50m là tới
                speakText("Bạn đã đến điểm thành công. Sắp tiếp tục điểm tiếp theo.");
                startItiBtn.innerText = "Đã đến đích!";
                isNavigatingIti = false;
                setTimeout(() => { advanceItinerary(); }, 4000);
            }
        }
      }, (error) => {
         itiNext.innerText = "Vui lòng cấp quyền Định vị GPS để bắt đầu hành trình!";
         document.getElementById('iti-manual-start').style.display = 'block';
      }, { enableHighAccuracy: true });

      // Nếu sau 5 giây vẫn chưa có GPS, hiện nhập manual cho chắc
      setTimeout(() => {
        if (!userLat && itiSection.style.display !== 'none') {
          document.getElementById('iti-manual-start').style.display = 'block';
        }
      }, 5000);
    } else {
      document.getElementById('iti-manual-start').style.display = 'block';
    }
}

// Xử lý điểm bắt đầu thủ công cho Itinerary
const itiApplyBtn = document.getElementById('iti-apply-origin-btn');
const itiManualInput = document.getElementById('iti-origin-input');
if (itiApplyBtn && itiManualInput) {
  itiApplyBtn.addEventListener('click', async () => {
    const addr = itiManualInput.value.trim();
    if (!addr) return;
    
    itiApplyBtn.disabled = true;
    itiApplyBtn.innerText = "...";
    itiNext.innerText = "Đang tìm địa chỉ xuất phát của bạn...";
    
    const coords = await geocode(addr);
    if (coords) {
      userLat = coords.lat;
      userLon = coords.lon;
      updateOriginMarker(userLat, userLon);
      itiNext.innerText = "Đã định vị thủ công. Nhấn BẮT ĐẦU để dẫn đường.";
      speakText("Đã nhận điểm xuất phát thủ công.");
    } else {
      itiNext.innerText = "❌ Không tìm thấy địa chỉ của bạn. Thử lại!";
    }
    itiApplyBtn.disabled = false;
    itiApplyBtn.innerText = "Dùng";
  });
}

if (startItiBtn) {
  startItiBtn.addEventListener('click', () => {
     if (itiIndex >= itiWaypoints.length) return;
     if (!userLat || !userLon) {
         alert("Đang chờ bắt vị trí GPS...");
         return; 
     }
     isNavigatingIti = true;
     startItiBtn.innerText = "Đang dẫn đường...";
     runItineraryPoint();
  });
}

if (skipItiBtn) skipItiBtn.addEventListener('click', () => advanceItinerary());

async function runItineraryPoint() {
   if (itiIndex >= itiWaypoints.length) return;
   
   const fullStr = itiWaypoints[itiIndex];
   const currentWP = fullStr.split(': ')[1] || fullStr;

   itiProgress.innerText = `Hành trình: Điểm ${itiIndex + 1}/${itiWaypoints.length}`;
   itiNext.innerText = `Đang dẫn tới: ${currentWP}`;
   skipItiBtn.style.display = 'inline-block';
   isNavigatingIti = true;
   startItiBtn.innerText = "Đang dẫn đường...";
   
   const coordsDest = await geocode(currentWP);
   if (!coordsDest) {
       itiNext.innerText = `❌ Không tìm thấy toạ độ cho bản đồ: ${currentWP}. Vui lòng bấm Bỏ Qua.`;
       speakText(`Lỗi vị trí. Hãy bỏ qua điểm này.`);
       statusMsg.innerText = "";
       return;
   }
   currentTargetCoordsObj = coordsDest;
   
   statusMsg.innerText = `Đang vẽ bản đồ dẫn đường...`;
   const osrmUrl = `https://router.project-osrm.org/route/v1/${currentMode}/${userLon},${userLat};${coordsDest.lon},${coordsDest.lat}?overview=full&geometries=geojson`;
   
   try {
       const routeRes = await fetch(osrmUrl);
       const routeData = await routeRes.json();
       
       if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
          drawRouteOnMap(routeData.routes[0], {lat: userLat, lon: userLon}, coordsDest);
          speakText(`Bắt đầu chạy chuyến đi tới: ${currentWP}`);
          
          summaryDistance.innerText = (routeData.routes[0].distance / 1000).toFixed(1) + ' km';
          summaryTime.innerText = formatDuration(routeData.routes[0].duration);
          routeSummary.classList.add('active');
          statusMsg.innerText = `Đã vẽ tuyến đường cho phương tiện!`;
       } else {
          itiNext.innerText = `OSRM: Bị lỗi đứt gãy đường đi bộ/xe cho điểm này.`;
       }
   } catch(e){
       itiNext.innerText = `OSRM Lỗi máy chủ đường đi.`;
   }
}

function advanceItinerary() {
   itiIndex++;
   if (itiIndex >= itiWaypoints.length) {
       itiProgress.innerText = `✅ Hoàn thành 100% lịch trình!`;
       itiNext.innerText = "Tuyệt vời, bạn đã đi hết điểm đến.";
       startItiBtn.style.display = 'none';
       skipItiBtn.style.display = 'none';
       isNavigatingIti = false;
       speakText("Bạn đã du ngoạn tới tất cả địa điểm trong lịch trình. Cảm tạ bạn đã sử dụng.");
   } else {
       runItineraryPoint();
   }
}
