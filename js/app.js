/**
 * ABLE Nonprofit Portal - Frontend Application Logic (app.js)
 * Features:
 *  - Geolocation Country Detection via ipapi.co
 *  - Direct Gmail Email Submission via Web3Forms (alfaizablebusines@gmail.com)
 *  - Voice-Enabled AI Assistant via Web Speech API (window.speechSynthesis)
 *  - Dynamic Digital Event Pass Generation with QR Code
 *  - Real-Time LocalStorage Analytics & Visitor Tracking
 */

// Storage Keys
const STORAGE_KEY_PAGEVIEWS = 'able_analytics_pageviews';
const STORAGE_KEY_COUNTRIES = 'able_analytics_countries';
const STORAGE_KEY_REGISTRATIONS = 'able_registrations';
const STORAGE_KEY_SUBMISSIONS_COUNT = 'able_analytics_submissions';
const STORAGE_KEY_CLOUD_ENDPOINT = 'able_cloud_sync_endpoint';
const STORAGE_KEY_WEB3FORMS = 'able_web3forms_key';
const DEFAULT_WEB3FORMS_KEY = 'ae824218-d5fa-4607-b1ba-7c113d3f7ed0';
const DEFAULT_CLOUD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw76FfvBwuC0rXD-9Yn34z68HchaQP12MAZR6YGL_5EvltMD3BqCVwTm3PpzW-Kmt82yA/exec';

let detectedCountry = {
  name: 'United States',
  code: 'US',
  flag: '🇺🇸'
};

// Voice Speech State
let isSpeechEnabled = true;

// ==========================================
// 1. CLEANUP DUMMY/MOCK DATA
// ==========================================
function cleanupDummyData() {
  const dummyNames = [
    'Sierra Brooks', 'Liam Vance', 'Maya Patel',
    'Alex Morgan', 'Jordan Lee', 'David Kim',
    'Taylor Swift', 'Ethan Carter', 'Chloe Zhang',
    'Test Candidate', 'Test Student'
  ];

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(STORAGE_KEY_REGISTRATIONS) || '[]');
  } catch (e) {
    list = [];
  }

  const filtered = list.filter(item => !dummyNames.includes(item.name));
  if (filtered.length !== list.length) {
    localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(filtered));
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS_COUNT, filtered.length.toString());
  }

  // Remove fake pageviews seed if present
  const views = localStorage.getItem(STORAGE_KEY_PAGEVIEWS);
  if (views === '148' || views === '149' || views === '150') {
    localStorage.setItem(STORAGE_KEY_PAGEVIEWS, filtered.length.toString());
  }

  // Remove fake countries seed if present
  const countries = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNTRIES) || '{}');
  if (countries["United States"] && countries["United States"].visits === 112) {
    localStorage.removeItem(STORAGE_KEY_COUNTRIES);
  }

  localStorage.removeItem('able_final_ready_v3');
}

// ==========================================
// 2. GEOLOCATION & VISITOR TRACKING
// ==========================================
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

async function detectVisitorCountry() {
  try {
    const response = await fetch('https://ipapi.co/json/', { timeout: 4000 });
    if (response.ok) {
      const data = await response.json();
      if (data && data.country_name) {
        detectedCountry = {
          name: data.country_name,
          code: data.country_code || 'US',
          flag: getFlagEmoji(data.country_code)
        };
      }
    }
  } catch (err) {
    try {
      const res2 = await fetch('https://api.country.is/');
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.country) {
          detectedCountry = {
            name: data2.country,
            code: data2.country,
            flag: getFlagEmoji(data2.country)
          };
        }
      }
    } catch (e) {
      console.log('Location detection fallback used.');
    }
  }

  const countryFlagEl = document.getElementById('country-flag');
  const countryNameEl = document.getElementById('country-name');
  const detectedCountryTextEl = document.getElementById('detected-country-text');
  const hiddenCountryEl = document.getElementById('hidden_country');

  if (countryFlagEl) countryFlagEl.textContent = detectedCountry.flag;
  if (countryNameEl) countryNameEl.textContent = detectedCountry.name;
  if (detectedCountryTextEl) detectedCountryTextEl.textContent = `${detectedCountry.code || detectedCountry.name} ${detectedCountry.flag}`;
  if (hiddenCountryEl) hiddenCountryEl.value = `${detectedCountry.name} (${detectedCountry.code})`;

  trackCountryVisit(detectedCountry.name, detectedCountry.code);
}

function trackPageView() {
  const current = parseInt(localStorage.getItem(STORAGE_KEY_PAGEVIEWS) || '0', 10);
  localStorage.setItem(STORAGE_KEY_PAGEVIEWS, (current + 1).toString());
}

function trackCountryVisit(countryName, countryCode) {
  let countries = {};
  try { countries = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNTRIES) || '{}'); } catch (e) { countries = {}; }

  if (!countries[countryName]) {
    countries[countryName] = { name: countryName, code: countryCode, visits: 0, registrations: 0 };
  }
  countries[countryName].visits += 1;
  localStorage.setItem(STORAGE_KEY_COUNTRIES, JSON.stringify(countries));
}

function trackCountryRegistration(countryName) {
  let countries = {};
  try { countries = JSON.parse(localStorage.getItem(STORAGE_KEY_COUNTRIES) || '{}'); } catch (e) { countries = {}; }

  if (countries[countryName]) {
    countries[countryName].registrations = (countries[countryName].registrations || 0) + 1;
  } else {
    countries[countryName] = { name: countryName, code: detectedCountry.code || 'GL', visits: 1, registrations: 1 };
  }
  localStorage.setItem(STORAGE_KEY_COUNTRIES, JSON.stringify(countries));
}

window.editCountryPrompt = function () {
  const custom = prompt("Enter your Country/Region:", detectedCountry.name);
  if (custom && custom.trim()) {
    detectedCountry.name = custom.trim();
    detectedCountry.flag = '📍';
    document.getElementById('country-flag').textContent = '📍';
    document.getElementById('country-name').textContent = custom.trim();
    document.getElementById('detected-country-text').textContent = custom.trim();
    document.getElementById('hidden_country').value = custom.trim();
    trackCountryVisit(custom.trim(), 'CUSTOM');
  }
};

// ==========================================
// 3. FORM SUBMISSION (Web3Forms to alfaizablebusines@gmail.com)
// ==========================================
const form = document.getElementById('registration-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');
const btnIcon = document.getElementById('btn-icon');
const btnSpinner = document.getElementById('btn-spinner');

if (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    submitBtn.disabled = true;
    btnText.textContent = "Forwarding to Gmail & Generating Pass...";
    btnIcon.classList.add('hidden');
    btnSpinner.classList.remove('hidden');

    const timestamp = new Date().toISOString();
    document.getElementById('hidden_timestamp').value = timestamp;

    const formData = new FormData(form);

    const submissionData = {
      id: 'ABLE-PITCH-' + Math.floor(1000 + Math.random() * 9000),
      name: formData.get('name').toString().trim(),
      email: formData.get('email').toString().trim(),
      gradeLevel: formData.get('grade_level').toString(),
      competingStatus: formData.get('competing_status').toString(),
      venueAttendance: formData.get('venue_attendance').toString(),
      country: detectedCountry.name,
      countryCode: detectedCountry.code,
      countryFlag: detectedCountry.flag,
      timestamp: new Date().toLocaleString()
    };

    // Direct Web3Forms submission to coordinators
    // Key: ae824218-d5fa-4607-b1ba-7c113d3f7ed0 (or dynamic key from Admin Panel)
    let emailDispatchSuccess = false;
    let dispatchStatusText = "";

    try {
      const activeKey = localStorage.getItem(STORAGE_KEY_WEB3FORMS) || DEFAULT_WEB3FORMS_KEY;
      formData.set('access_key', activeKey);
      formData.set('ticket_id', submissionData.id);
      formData.set('client_location', `${detectedCountry.name} (${detectedCountry.code})`);
      formData.set('replyto', submissionData.email);
      formData.set('from_name', 'ABLE Pitch Challenge System');
      formData.set('subject', `🚀 New Pitch Registration: ${submissionData.name} (${submissionData.gradeLevel})`);

      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData
      });

      const responseData = await res.json();
      console.log('Web3Forms dispatch response:', responseData);

      if (responseData.success) {
        emailDispatchSuccess = true;
        dispatchStatusText = "Delivered directly to alfaizablebusines@gmail.com";
        showToast(
          "Registration Sent to Gmail!",
          "Successfully forwarded to alfaizablebusines@gmail.com. Check inbox & Spam folder.",
          "success"
        );
      } else {
        console.warn('Web3Forms API notice:', responseData.message);
        dispatchStatusText = responseData.message || "Email dispatch queued";
        showToast(
          "Registration Stored",
          "Digital pass generated and stored in Admin database.",
          "warning"
        );
      }
    } catch (err) {
      console.warn('Web3Forms fetch error:', err);
      dispatchStatusText = "Saved locally in Admin database (Network offline)";
      showToast("Registration Saved", "Stored locally on your device.", "warning");
    }

    // Store in LocalStorage
    let existing = [];
    try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY_REGISTRATIONS) || '[]'); } catch (e) { }
    existing.unshift(submissionData);
    localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(existing));

    // Update Submissions Count
    const currentSubs = parseInt(localStorage.getItem(STORAGE_KEY_SUBMISSIONS_COUNT) || '0', 10);
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS_COUNT, (currentSubs + 1).toString());
    trackCountryRegistration(detectedCountry.name);

    // Broadcast LIVE to Admin tabs immediately (Zero-reload real-time sync)
    try {
      const channel = new BroadcastChannel('able_live_sync_channel');
      channel.postMessage({
        type: 'NEW_REGISTRATION',
        data: submissionData
      });
    } catch (e) { }

    // Cloud Webhook dispatch (Cross-device real-time sync + Automated Student Email)
    const cloudEndpoint = localStorage.getItem(STORAGE_KEY_CLOUD_ENDPOINT) || DEFAULT_CLOUD_ENDPOINT;
    if (cloudEndpoint) {
      try {
        fetch(cloudEndpoint, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submissionData)
        }).catch(() => { });
      } catch (e) { }
    }

    // Update Confirmation Badges
    const badge = document.getElementById('dispatch-badge');
    if (badge) {
      if (emailDispatchSuccess) {
        badge.className = "px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300 flex items-center gap-1";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Gmail Dispatched`;
      } else {
        badge.className = "px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-300 flex items-center gap-1";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> Stored`;
      }
    }
    const statusMsgElem = document.getElementById('dispatch-status-msg');
    if (statusMsgElem) {
      statusMsgElem.textContent = dispatchStatusText;
    }

    // Render Digital Pass
    populateDigitalTicket(submissionData);

    // Reset button UI
    submitBtn.disabled = false;
    btnText.textContent = "Submit My Registration";
    btnIcon.classList.remove('hidden');
    btnSpinner.classList.add('hidden');

    // Swap view to confirmation screen
    document.getElementById('form-header-area').classList.add('hidden');
    form.classList.add('hidden');
    document.getElementById('confirmation-screen').classList.remove('hidden');

    document.getElementById('register').scrollIntoView({ behavior: 'smooth' });

    // Voice & audible notification
    speakAiText("Congratulations! Your registration for the ABLE Startup Pitch Challenge has been submitted. Details have been forwarded to our program coordinators, and we will follow up with your prep pack shortly.");
  });
}

function populateDigitalTicket(data) {
  document.getElementById('ticket-id').textContent = data.id;
  document.getElementById('ticket-name').textContent = data.name;
  document.getElementById('ticket-grade').textContent = data.gradeLevel;
  document.getElementById('ticket-status').textContent = data.competingStatus;
  document.getElementById('ticket-venue').textContent = data.venueAttendance;

  const qrElem = document.getElementById('ticket-qr');
  if (qrElem) {
    const qrData = encodeURIComponent(`https://able-nonprofit.org/pitch?id=${data.id}&name=${data.name}`);
    qrElem.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${qrData}`;
  }
}

window.emailMyPassCopy = function () {
  const name = document.getElementById('ticket-name').textContent;
  const id = document.getElementById('ticket-id').textContent;
  const grade = document.getElementById('ticket-grade').textContent;
  const venue = document.getElementById('ticket-venue').textContent;

  const subject = encodeURIComponent(`ABLE Startup Pitch Challenge Entry Pass - ${name}`);
  const body = encodeURIComponent(
    `Hello ${name},\n\n` +
    `Here is your official registration confirmation for the ABLE Business Startup Pitch Challenge:\n\n` +
    `• Ticket ID: ${id}\n` +
    `• Competitor: ${name}\n` +
    `• Grade Level: ${grade}\n` +
    `• Venue: ${venue}\n` +
    `• Event Timeline: November 2026\n` +
    `• Grand Prize: $250 1st Place Cash Prize\n\n` +
    `Submitted to ABLE Nonprofit Coordinators: alfaizablebusines@gmail.com\n\n` +
    `Best regards,\n` +
    `ABLE Academy of Business & Leadership Empowerment`
  );

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

window.resetForNewRegistration = function () {
  if (form) form.reset();
  document.getElementById('confirmation-screen').classList.add('hidden');
  document.getElementById('form-header-area').classList.remove('hidden');
  if (form) form.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// 4. FLOATING NOTIFICATIONS (TOASTS)
// ==========================================
function showToast(title, message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `p-4 rounded-2xl shadow-2xl border text-xs flex items-start gap-3 transition-all duration-300 transform translate-y-[-10px] opacity-0 pointer-events-auto ${type === 'success'
      ? 'bg-slate-900 text-white border-emerald-500/50'
      : 'bg-amber-950 text-amber-100 border-amber-500/50'
    }`;

  const iconSvg = type === 'success'
    ? `<div class="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 font-bold">✓</div>`
    : `<div class="w-6 h-6 rounded-full bg-amber-500 text-slate-900 flex items-center justify-center shrink-0 font-bold">!</div>`;

  toast.innerHTML = `
    ${iconSvg}
    <div class="flex-1">
      <div class="font-bold text-sm text-white">${escapeHtml(title)}</div>
      <div class="text-slate-300 text-[11px] mt-0.5 leading-relaxed">${escapeHtml(message)}</div>
    </div>
  `;

  toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-[-10px]', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// ==========================================
// 5. SPEECH SYNTHESIS & AI ASSISTANT
// ==========================================
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

window.toggleSpeechOutput = function () {
  isSpeechEnabled = !isSpeechEnabled;
  const statusText = document.getElementById('voice-status-text');
  const icon = document.getElementById('voice-icon');

  if (isSpeechEnabled) {
    if (statusText) statusText.textContent = "Voice ON";
    if (statusText) statusText.className = "text-[10px] text-brand-green";
    if (icon) icon.className = "w-3.5 h-3.5 text-brand-green";
    speakAiText("Voice notifications enabled.");
  } else {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (statusText) statusText.textContent = "Voice OFF";
    if (statusText) statusText.className = "text-[10px] text-slate-400";
    if (icon) icon.className = "w-3.5 h-3.5 text-slate-400";
  }
};

function speakAiText(text) {
  if (!isSpeechEnabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();

    const clean = text.replace(/<[^>]*>/g, '').replace(/👋|🏆|🎓|📅|📍|🎉|🤝|💡/g, '');
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.02;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const engVoice = voices.find(v => v.lang && v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
      if (engVoice) utterance.voice = engVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("Speech synthesis notice:", e);
  }
}

window.toggleAiAssistant = function () {
  const windowElem = document.getElementById('ai-chat-window');
  if (windowElem) {
    windowElem.classList.toggle('hidden');
    if (!windowElem.classList.contains('hidden')) {
      const input = document.getElementById('ai-user-input');
      if (input) input.focus();
    }
  }
};

window.askAiPreset = function (questionText) {
  const input = document.getElementById('ai-user-input');
  if (input) {
    input.value = questionText;
    handleAiSubmit(new Event('submit'));
  }
};

window.handleAiSubmit = function (e) {
  if (e) e.preventDefault();
  const input = document.getElementById('ai-user-input');
  if (!input) return;
  const question = input.value.trim();
  if (!question) return;

  appendAiMessage(question, 'user');
  input.value = '';

  setTimeout(() => {
    const answer = generateAssistantResponse(question);
    appendAiMessage(answer, 'assistant');
    speakAiText(answer);
  }, 400);
};

function appendAiMessage(text, sender) {
  const container = document.getElementById('ai-messages-container');
  if (!container) return;
  const msgDiv = document.createElement('div');

  if (sender === 'user') {
    msgDiv.className = "flex items-start justify-end gap-2";
    msgDiv.innerHTML = `
      <div class="p-3 bg-brand-green text-white rounded-2xl rounded-tr-sm shadow-sm max-w-[85%] leading-relaxed font-medium">
        ${escapeHtml(text)}
      </div>
    `;
  } else {
    msgDiv.className = "flex items-start gap-2.5";
    msgDiv.innerHTML = `
      <div class="w-6 h-6 rounded-lg bg-brand-green text-white flex items-center justify-center shrink-0 text-[10px]">
        AI
      </div>
      <div class="p-3 bg-white rounded-2xl rounded-tl-sm border border-slate-200/80 shadow-sm text-slate-700 leading-relaxed max-w-[85%]">
        ${text}
        <div class="pt-1.5 mt-1 border-t border-slate-100 flex items-center justify-end">
          <button onclick="speakAiText('${escapeHtml(text.replace(/'/g, ''))}')" class="text-[10px] text-brand-green hover:underline flex items-center gap-1 font-semibold">
            <i data-lucide="volume-2" class="w-3 h-3"></i> Listen
          </button>
        </div>
      </div>
    `;
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  if (window.lucide) lucide.createIcons();
}

function generateAssistantResponse(prompt) {
  const q = prompt.toLowerCase();

  if (q.includes('prize') || q.includes('money') || q.includes('win') || q.includes('$') || q.includes('250')) {
    return "🏆 <strong>1st Place takes home $250 in cash!</strong> In addition, winners receive direct 1-on-1 mentorship with founders and official ABLE certificates.";
  }
  if (q.includes('when') || q.includes('date') || q.includes('november') || q.includes('timeline') || q.includes('2026')) {
    return "📅 The Pitch Challenge takes place in <strong>November 2026</strong>! It includes 1 week of intensive guided prep followed by live tournament-style judging.";
  }
  if (q.includes('who') || q.includes('grade') || q.includes('age') || q.includes('eligib')) {
    return "🎓 The Challenge is open to <strong>Grades 6 and above</strong> (Middle and High School students: 6th, 7th, 8th, Freshman, Sophomore, Junior, Senior).";
  }
  if (q.includes('online') || q.includes('colorado') || q.includes('springs') || q.includes('venue') || q.includes('zoom')) {
    return "📍 <strong>Yes, it's a hybrid event!</strong> You can join in-person at our Colorado Springs venue, or participate 100% online via Zoom from anywhere in the world.";
  }
  if (q.includes('cost') || q.includes('free') || q.includes('fee')) {
    return "🎉 <strong>It is 100% free!</strong> ABLE is a non-profit youth initiative. There are zero registration fees or hidden costs.";
  }
  if (q.includes('idea') || q.includes('team') || q.includes('solo') || q.includes('prep')) {
    return "💡 <strong>You don't need a finished business!</strong> You can build your startup blueprint from scratch during Prep Week, competing solo or with friends.";
  }

  return "The <strong>ABLE Business Startup Pitch Challenge</strong> takes place in <strong>November 2026</strong> with a <strong>$250 top prize</strong> for Grades 6+. You can attend in Colorado Springs or online via Zoom. Fill out the form above to lock your free spot!";
}

// ==========================================
// 5. ON LOAD INITIALIZATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  cleanupDummyData();
  trackPageView();
  detectVisitorCountry();
  if (window.lucide) lucide.createIcons();
});

// Secret Admin Key Shortcut (Ctrl + Shift + A)
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    window.location.href = 'admin.html';
  }
});
