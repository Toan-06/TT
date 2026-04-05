/**
 * voice-helper.js
 * WanderViệt - Voice Guide Helper using Web Speech API
 */

class VoiceGuide {
  constructor() {
    this.recognition = null;
    this.synth = window.speechSynthesis;
    this.isListening = false;
    this.onResultCallback = null;
    this.onStatusChange = null;
    this.vietnameseVoice = null;

    // Tải danh sách giọng đọc
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      // Ưu tiên tìm các giọng có keyword 'vietnam', 'vi-vn', 'vi_vn'
      this.vietnameseVoice = voices.find(v => 
        v.lang.toLowerCase().replace('_', '-').includes('vi-vn') || 
        v.name.toLowerCase().includes('vietnam') ||
        v.lang.toLowerCase().startsWith('vi')
      );
      
      if (this.vietnameseVoice) {
        console.log('[VoiceGuide] Đã chọn giọng tiếng Việt:', this.vietnameseVoice.name);
      } else {
        console.warn('[VoiceGuide] Không tìm thấy giọng đọc tiếng Việt. Đang thử lại...');
        // Thử lại sau 2 giây vì một số trình duyệt nạp giọng nói chậm
        setTimeout(loadVoices, 2000);
      }
      
      // LOG TAT CA GIONG DE DEBUG - Bạn hãy gửi danh sách này cho tớ nếu vẫn lỗi nhé
      console.log('--- DANH SÁCH GIỌNG HIỆN CÓ TRÊN MÁY ---');
      voices.forEach(v => console.log(`> ${v.name} (${v.lang})`));
      console.log('----------------------------------------');
      
      if (!this.vietnameseVoice) {
        this.showMissingVoiceWarning();
      } else {
        // Nếu đã tìm thấy giọng, ẩn cảnh báo nếu nó đang hiện
        const existingWarning = document.getElementById('voice-warning-toast');
        if (existingWarning) existingWarning.remove();
      }
    };
    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }

    this.init();
  }

  init() {
    // 1. Setup Recognition (STT)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'vi-VN';
      this.recognition.interimResults = false;
      this.recognition.continuous = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        if (this.onStatusChange) this.onStatusChange('listening');
      };

      this.recognition.onerror = (event) => {
        console.error('Speech Recognition Error:', event.error);
        this.isListening = false;
        if (this.onStatusChange) this.onStatusChange('error', event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (this.onStatusChange) this.onStatusChange('idle');
      };

      this.recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (this.onResultCallback) this.onResultCallback(text);
      };
    } else {
      console.warn('Trình duyệt này không hỗ trợ Speech Recognition.');
    }
  }

  /**
   * Bắt đầu lắng nghe
   */
  start() {
    if (this.recognition && !this.isListening) {
      this.synth.cancel(); // Ngừng nói nếu đang nói khi chuẩn bị nghe
      try {
        this.recognition.start();
      } catch (e) {
        console.error('Recognition start failed:', e);
      }
    }
  }

  /**
   * Ngừng lắng nghe
   */
  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Phát âm thanh tiếng Việt (TTS)
   */
  speak(text) {
    if (!text) return;
    
    // Ngừng các câu đang nói dở
    this.synth.cancel();
    if (this.currentOnlineAudio) {
      this.currentOnlineAudio.pause();
      this.currentOnlineAudio = null;
    }

    // NẾU CÓ GIỌNG NỘI BỘ (Offline)
    if (this.vietnameseVoice) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = this.vietnameseVoice;
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        if (this.onStatusChange) this.onStatusChange('speaking');
      };

      utterance.onend = () => {
        if (this.onStatusChange) this.onStatusChange('idle');
      };

      this.synth.resume();
      this.synth.speak(utterance);
    } 
    // NẾU KHÔNG CÓ GIỌNG NỘI BỘ -> DÙNG GIỌNG ONLINE (FALLBACK)
    else {
      console.log('[VoiceGuide] Đang sử dụng giọng đọc Online (Google Translate)...');
      if (this.onStatusChange) this.onStatusChange('speaking');
      
      const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(text)}`;
      const audio = new Audio(fallbackUrl);
      this.currentOnlineAudio = audio;
      
      audio.onended = () => {
        if (this.onStatusChange) this.onStatusChange('idle');
        this.currentOnlineAudio = null;
      };
      
      audio.play().catch(e => {
        console.warn('[VoiceGuide] Tự động phát bị chặn.');
        if (this.onStatusChange) this.onStatusChange('idle');
      });
    }
  }

  /**
   * Hiển thị thông báo khi thiếu giọng tiếng Việt
   */
  showMissingVoiceWarning() {
    // Sử dụng sessionStorage để ghi nhớ lựa chọn tắt của người dùng cho phiên này (không đóng vĩnh viễn)
    if (sessionStorage.getItem('voice-warning-dismissed') === 'true' || this.vietnameseVoice) return;
    if (document.getElementById('voice-warning-toast')) return;

    const warning = document.createElement('div');
    warning.id = 'voice-warning-toast';
    warning.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 243, 205, 0.95);
      color: #856404;
      padding: 12px 20px;
      border-radius: 50px;
      border: 1px solid #ffeeba;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      z-index: 9999;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
      backdrop-filter: blur(5px);
      transition: all 0.3s ease;
    `;
    warning.innerHTML = `
      <span style="font-size: 18px;">🎙️</span>
      <span><strong>Chế độ Online:</strong> Đang dùng giọng đọc Google Translate.</span>
      <button onclick="sessionStorage.setItem('voice-warning-dismissed', 'true'); this.parentElement.remove()" style="border: none; background: #856404; color: white; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px;">✕</button>
    `;
    document.body.appendChild(warning);
  }
}

// Export singleton
window.voiceGuide = new VoiceGuide();
