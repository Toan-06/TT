/**
 * public/directions-gmap.js
 * Code dành cho Google Maps API.
 * Yêu cầu phải có thẻ <script> gọi Google Maps API kèm API KEY trong HTML.
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

let map;
let directionsService;
let directionsRenderer;
let currentMode = 'DRIVING'; // Chế độ mặc định của Google Maps
let currentRouteData = null;

// Hàm này được gọi bởi callback của Google Maps script
window.initMap = function() {
  // Tránh lỗi nếu chưa có đối tượng google
  if (typeof google === 'undefined') {
    statusMsg.innerText = "LỖI: Chưa kết nối API Key Google Maps. Hãy thêm <script src='https://maps.googleapis.com/...&key=[YOUR_KEY]'> trong HTML.";
    return;
  }

  // Khởi tạo map ở chính giữa Việt Nam
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 16.047079, lng: 108.206230 },
    zoom: 6,
    mapTypeControl: false,
  });

  // Khởi tạo tool vẽ đường
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  // Mở rộng: Có thể tích hợp Autocomplete nếu muốn (không bắt buộc)
  new google.maps.places.Autocomplete(originInput);
  new google.maps.places.Autocomplete(destInput);
};

// Đổi phương tiện di chuyển
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentMode = btn.dataset.mode;
    
    if (originInput.value && destInput.value) {
      calculateAndDisplayRoute();
    }
  });
});

searchBtn.addEventListener('click', calculateAndDisplayRoute);

function calculateAndDisplayRoute() {
  const originStr = originInput.value.trim();
  const destStr = destInput.value.trim();

  if (!originStr || !destStr) {
    statusMsg.innerText = "Vui lòng nhập Điểm đi và Điểm đến!";
    return;
  }

  if (typeof google === 'undefined') {
    statusMsg.innerText = "LỖI: Chưa có Google Maps API. Hãy cấu hình API Key.";
    return;
  }

  statusMsg.innerText = "Đang tìm đường đi...";
  routeSummary.classList.remove('active');
  aiAdviceBox.classList.remove('active');

  directionsService.route(
    {
      origin: originStr,
      destination: destStr,
      travelMode: google.maps.TravelMode[currentMode] // DRIVING, WALKING, v.v.
    },
    (response, status) => {
      if (status === "OK" && response) {
        statusMsg.innerText = ""; // Xóa lỗi
        
        // Vẽ đường lên map
        directionsRenderer.setDirections(response);
        
        // Trích xuất thống kê
        const route = response.routes[0].legs[0];
        
        currentRouteData = {
          origin: route.start_address,
          destination: route.end_address,
          distance: route.distance.text,
          duration: route.duration.text,
          mode: currentMode
        };

        // Gắn vào UI
        summaryDistance.innerText = currentRouteData.distance;
        summaryTime.innerText = currentRouteData.duration;
        routeSummary.classList.add('active');
      } else {
        statusMsg.innerText = "Google Maps không thể tìm được đường: " + status;
      }
    }
  );
}

// Thay thế hàm speak cũ bằng hệ thống VoiceGuide mới
function speakText(text) {
  if (window.voiceGuide) {
    window.voiceGuide.speak(text);
  }
}

askAiBtn.addEventListener('click', async () => {
  if (!currentRouteData) return;

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
      
      if (window.voiceGuide) window.voiceGuide.speak(data.advice);
      document.getElementById('stop-voice-btn').addEventListener('click', () => {
        if (window.voiceGuide) window.voiceGuide.stop();
      });
    } else {
      aiAdviceBox.innerHTML = `❌ Lỗi: ${data.message}`;
    }
    aiAdviceBox.classList.add('active');
  } catch (err) {
    aiAdviceBox.innerHTML = "❌ Không thể kết nối với server AI.";
    aiAdviceBox.classList.add('active');
  }

  askAiBtn.innerHTML = '✨ Trợ lý AI Khuyên Dùng';
  askAiBtn.disabled = false;
});

// Tự động điền lộ trình nếu có query truyền vào từ My Trips
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const destQuery = urlParams.get('dest');
  
  if (destQuery) {
    destInput.value = destQuery;
    statusMsg.innerHTML = 'Đang bắt đầu chuyến đi... <br/><button class="btn-inline-link" onclick="stopGeoAndManual()">Hoặc nhập thủ công ngay</button>';
    
    window.stopGeoAndManual = () => {
      statusMsg.innerText = "Mời bạn nhập điểm đi thủ công bên dưới:";
      originInput.focus();
    };
    
    // Đợi 1 chút để Google Maps script có thể tải xong (hoặc xử lý thử lại)
    setTimeout(() => {
      if ("geolocation" in navigator) {
        let isFirstTime = true;
        let userMarkerParams = null; // Marker cho Google Maps
        
        navigator.geolocation.watchPosition((position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          if (isFirstTime) {
            isFirstTime = false;
            if (typeof google !== 'undefined') {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ location: { lat, lng: lon } }, (results, status) => {
                if (status === "OK" && results[0]) {
                  originInput.value = results[0].formatted_address;
                } else {
                  originInput.value = `${lat}, ${lon}`;
                }
                calculateAndDisplayRoute();
              });
            } else {
              originInput.value = `${lat}, ${lon}`;
              calculateAndDisplayRoute();
            }
          } else {
            // Cập nhật vị trí liên tục trên Google Maps nếu muốn (demo)
            // Ví dụ có thể dùng map.panTo hoặc tạo marker
            if (typeof google !== 'undefined' && map) {
              if (!userMarkerParams) {
                userMarkerParams = new google.maps.Marker({
                  position: {lat, lng: lon},
                  map: map,
                  title: "Vị trí của bạn"
                });
              } else {
                userMarkerParams.setPosition(new google.maps.LatLng(lat, lon));
              }
            }
          }
        }, (error) => {
          statusMsg.innerText = "Vui lòng nhập Điểm đi (Từ chối định vị).";
          originInput.focus();
        }, {
           enableHighAccuracy: true, maximumAge: 0 
        });
      } else {
        originInput.focus();
      }
    }, 1000);
  }
});
