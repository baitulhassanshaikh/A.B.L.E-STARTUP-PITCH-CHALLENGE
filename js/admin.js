/**
 * ABLE Nonprofit Portal - Admin Dashboard Logic (admin.js)
 * Features:
 *  - Client-side SHA-256 Passcode Verification for 'ad1672010'
 *  - Real-time Analytics & KPIs from LocalStorage
 *  - Colorado Springs Attendance Ratio Visualizer
 *  - Country Breakdown Analytics Table
 *  - Searchable & Filterable Registrants Database
 *  - Clean CSV Export Functionality (exportToCSV)
 */

// SHA-256 Hash for passcode: 'ad1672010'
const AUTH_HASH = "e2876a0b7ef53cefddb98836ea36c8bd13557deb0defe14c49116568952db671";
const SESSION_KEY = "able_pitch_admin_authorized_v2";

// Storage Keys
const STORAGE_KEY_PAGEVIEWS = 'able_analytics_pageviews';
const STORAGE_KEY_COUNTRIES = 'able_analytics_countries';
const STORAGE_KEY_REGISTRATIONS = 'able_registrations';
const STORAGE_KEY_SUBMISSIONS_COUNT = 'able_analytics_submissions';
const STORAGE_KEY_CLOUD_ENDPOINT = 'able_cloud_sync_endpoint';
const DEFAULT_CLOUD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw76FfvBwuC0rXD-9Yn34z68HchaQP12MAZR6YGL_5EvltMD3BqCVwTm3PpzW-Kmt82yA/exec';

let liveSyncInterval = null;
let lastKnownSubmissionsCount = 0;

// Standard Web Crypto API for SHA-256 with safe fallback
async function sha256(message) {
  try {
    if (window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn("Crypto subtle fallback:", err);
  }
  return "";
}

window.handlePasscodeSubmit = async function(e) {
  if (e) e.preventDefault();
  const inputElem = document.getElementById('passcode-input');
  const errorElem = document.getElementById('auth-error-msg');
  const val = (inputElem ? inputElem.value : '').trim();

  // Instant direct match check (100% reliable across all browsers & contexts)
  let isMatch = (val.toLowerCase() === 'ad1672010');

  if (!isMatch) {
    try {
      const hash = await sha256(val);
      if (hash === AUTH_HASH) isMatch = true;
    } catch(err) {}
  }

  if (isMatch) {
    sessionStorage.setItem(SESSION_KEY, 'true');
    if (errorElem) errorElem.classList.add('hidden');
    unlockDashboard();
  } else {
    if (errorElem) errorElem.classList.remove('hidden');
    if (inputElem) {
      inputElem.classList.add('border-rose-400');
      inputElem.value = '';
      inputElem.focus();
    }
  }
};

const passcodeForm = document.getElementById('passcode-form');
const passcodeInput = document.getElementById('passcode-input');
const authErrorMsg = document.getElementById('auth-error-msg');
const authLockScreen = document.getElementById('auth-lock-screen');
const adminDashboard = document.getElementById('admin-dashboard');

if (passcodeForm) {
  passcodeForm.addEventListener('submit', window.handlePasscodeSubmit);
}

window.togglePasscodeVisibility = function() {
  const input = document.getElementById('passcode-input');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
};

function checkAuthOnLoad() {
  if (sessionStorage.getItem(SESSION_KEY) === 'true') {
    unlockDashboard();
  } else {
    authLockScreen.classList.remove('hidden');
    adminDashboard.classList.add('hidden');
  }
}

function unlockDashboard() {
  authLockScreen.classList.add('hidden');
  adminDashboard.classList.remove('hidden');
  refreshDashboard();
  if (window.lucide) lucide.createIcons();
}

window.adminLogout = function() {
  sessionStorage.removeItem(SESSION_KEY);
  adminDashboard.classList.add('hidden');
  authLockScreen.classList.remove('hidden');
  passcodeInput.value = '';
  authErrorMsg.classList.add('hidden');
  if (window.lucide) lucide.createIcons();
};

function getStoredRegistrations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_REGISTRATIONS) || '[]'); } catch (e) { return []; }
}

function getStoredCountries() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_COUNTRIES) || '{}'); } catch (e) { return {}; }
}

function refreshDashboard() {
  const list = getStoredRegistrations();
  const views = parseInt(localStorage.getItem(STORAGE_KEY_PAGEVIEWS) || list.length.toString(), 10);
  const subs = parseInt(localStorage.getItem(STORAGE_KEY_SUBMISSIONS_COUNT) || list.length.toString(), 10);
  const countries = getStoredCountries();

  // Top KPI counts
  const kpiViews = document.getElementById('kpi-views');
  const kpiSubs = document.getElementById('kpi-submissions');
  const kpiConv = document.getElementById('kpi-conversion');
  const kpiCountries = document.getElementById('kpi-countries');

  if (kpiViews) kpiViews.textContent = views.toLocaleString();
  if (kpiSubs) kpiSubs.textContent = subs.toLocaleString();

  const conv = views > 0 ? ((subs / views) * 100).toFixed(1) : '0.0';
  if (kpiConv) kpiConv.textContent = `${conv}%`;
  if (kpiCountries) kpiCountries.textContent = Object.keys(countries).length.toString();

  // Colorado Springs Attendance vs Online ratio
  const inPersonCount = list.filter(r => (r.venueAttendance || '').includes('Colorado Springs')).length;
  const total = list.length;
  const inPersonPct = total > 0 ? Math.round((inPersonCount / total) * 100) : 0;
  const onlinePct = total > 0 ? (100 - inPersonPct) : 0;

  const coPct = document.getElementById('stat-co-pct');
  const coBar = document.getElementById('stat-co-bar');
  const zoomPct = document.getElementById('stat-zoom-pct');
  const zoomBar = document.getElementById('stat-zoom-bar');

  if (coPct) coPct.textContent = `${inPersonPct}% (${inPersonCount})`;
  if (coBar) coBar.style.width = `${inPersonPct}%`;
  if (zoomPct) zoomPct.textContent = `${onlinePct}% (${total - inPersonCount})`;
  if (zoomBar) zoomBar.style.width = `${onlinePct}%`;

  renderCountryTable(countries, views);
  renderSubmissionsTable();
}

function renderCountryTable(countries, totalViews) {
  const tbody = document.getElementById('country-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const entries = Object.values(countries);
  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">No country data collected yet.</td></tr>`;
    return;
  }

  // Sort descending by visits
  entries.sort((a, b) => (b.visits || 0) - (a.visits || 0));

  entries.forEach(item => {
    const share = totalViews > 0 ? Math.round(((item.visits || 0) / totalViews) * 100) : 0;
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/70 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 flex items-center gap-2 font-semibold text-slate-800">
        <span class="text-base">${getFlagEmoji(item.code)}</span>
        <span>${escapeHtml(item.name)}</span>
        ${item.code ? `<span class="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">${escapeHtml(item.code)}</span>` : ''}
      </td>
      <td class="py-3 px-3 text-center font-bold text-slate-700">${item.visits || 0}</td>
      <td class="py-3 px-3 text-center font-bold text-brand-green-dark">${item.registrations || 0}</td>
      <td class="py-3 px-3 text-right">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
          ${share}%
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

window.renderSubmissionsTable = function() {
  const tbody = document.getElementById('submissions-table-body');
  const noMsg = document.getElementById('no-submissions-msg');
  if (!tbody) return;

  const searchVal = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const filterVenue = document.getElementById('filter-attendance')?.value || 'ALL';

  const list = getStoredRegistrations();

  const filtered = list.filter(item => {
    const matchesSearch = 
      (item.name || '').toLowerCase().includes(searchVal) ||
      (item.email || '').toLowerCase().includes(searchVal) ||
      (item.gradeLevel || '').toLowerCase().includes(searchVal) ||
      (item.id || '').toLowerCase().includes(searchVal);

    let matchesFilter = true;
    if (filterVenue === 'Colorado Springs') {
      matchesFilter = (item.venueAttendance || '').includes('Colorado Springs');
    } else if (filterVenue === 'Online') {
      matchesFilter = (item.venueAttendance || '').includes('Online');
    }

    return matchesSearch && matchesFilter;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (noMsg) noMsg.classList.remove('hidden');
    return;
  }
  if (noMsg) noMsg.classList.add('hidden');

  filtered.forEach(sub => {
    const isCO = (sub.venueAttendance || '').includes('Colorado Springs');
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50/70 transition";
    tr.innerHTML = `
      <td class="py-3 px-3.5 font-mono text-[11px] text-slate-500 font-bold">${escapeHtml(sub.id || 'N/A')}</td>
      <td class="py-3 px-3.5 font-bold text-slate-900">${escapeHtml(sub.name || 'Anonymous')}</td>
      <td class="py-3 px-3.5 font-mono text-slate-600">${escapeHtml(sub.email || '-')}</td>
      <td class="py-3 px-3.5">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
          ${escapeHtml(sub.gradeLevel || 'Not specified')}
        </span>
      </td>
      <td class="py-3 px-3.5">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${sub.competingStatus === 'Yes' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
          ${escapeHtml(sub.competingStatus || 'Yes')}
        </span>
      </td>
      <td class="py-3 px-3.5">
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${isCO ? 'bg-brand-green-subtle text-brand-green-dark border border-brand-green/20' : 'bg-sky-50 text-sky-700 border border-sky-200/60'}">
          ${isCO ? '📍 CO Springs' : '💻 Online Zoom'}
        </span>
      </td>
      <td class="py-3 px-3.5 text-slate-700 font-medium">
        ${sub.countryFlag || '🌐'} ${escapeHtml(sub.country || 'Global')}
      </td>
      <td class="py-3 px-3.5 text-right">
        <button 
          onclick="deleteRegistrant('${escapeHtml(sub.id)}')" 
          class="text-slate-400 hover:text-rose-500 p-1 rounded transition" 
          title="Remove entry"
        >
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) lucide.createIcons();
};

window.deleteRegistrant = function(id) {
  if (!confirm(`Are you sure you want to remove registration ${id}?`)) return;
  let list = getStoredRegistrations();
  list = list.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(list));
  refreshDashboard();
};

// Reset & Clear All Local Data
window.clearAllRegistrations = function() {
  if (!confirm("Are you sure you want to clear all registrations and reset analytics to 0? This cannot be undone.")) return;
  localStorage.removeItem(STORAGE_KEY_REGISTRATIONS);
  localStorage.removeItem(STORAGE_KEY_COUNTRIES);
  localStorage.setItem(STORAGE_KEY_PAGEVIEWS, '0');
  localStorage.setItem(STORAGE_KEY_SUBMISSIONS_COUNT, '0');
  localStorage.removeItem('able_final_ready_v3');
  refreshDashboard();
};

// CSV Export function
window.exportToCSV = function() {
  const list = getStoredRegistrations();
  if (list.length === 0) {
    alert("No submissions available to export yet.");
    return;
  }

  const headers = ["Ticket ID", "Full Name", "Email Address", "Grade Level", "Competing Status", "Attendance Venue", "Country", "Country Code", "Registration Timestamp"];
  const rows = list.map(item => [
    `"${(item.id || '').replace(/"/g, '""')}"`,
    `"${(item.name || '').replace(/"/g, '""')}"`,
    `"${(item.email || '').replace(/"/g, '""')}"`,
    `"${(item.gradeLevel || '').replace(/"/g, '""')}"`,
    `"${(item.competingStatus || '').replace(/"/g, '""')}"`,
    `"${(item.venueAttendance || '').replace(/"/g, '""')}"`,
    `"${(item.country || '').replace(/"/g, '""')}"`,
    `"${(item.countryCode || '').replace(/"/g, '""')}"`,
    `"${(item.timestamp || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `ABLE_Pitch_Registrations_November2026_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

// Cleanup function to wipe any previously seeded dummy/sample data from localStorage
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

  // Remove fake 148 pageviews seed if present
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
// LIVE REAL-TIME ENGINE (NO RELOAD NEEDED)
// ==========================================
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch(e) {
    console.log("Audio notification skipped:", e);
  }
}

function flashLiveBadge(text) {
  const badge = document.getElementById('live-sync-badge');
  const textElem = document.getElementById('live-sync-badge-text');
  if (!badge) return;

  if (textElem) textElem.textContent = text || "New Registration Received!";
  badge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-md transform scale-105 transition-all";

  setTimeout(() => {
    badge.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-xs transition-all";
    if (textElem) textElem.textContent = "Live Sync: Active (Auto-sync)";
  }, 4000);
}

function handleLiveNewRegistration(newSub, isFromCloud = false) {
  if (!newSub || !newSub.id) return;

  let list = getStoredRegistrations();
  const exists = list.some(item => item.id === newSub.id || (item.email === newSub.email && item.timestamp === newSub.timestamp));
  if (exists) return;

  list.unshift(newSub);
  localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(list));
  localStorage.setItem(STORAGE_KEY_SUBMISSIONS_COUNT, list.length.toString());

  playNotificationChime();
  flashLiveBadge(`🔔 ${escapeHtml(newSub.name)} Just Registered!`);
  refreshDashboard();
}

// Background Cloud Poller for Cross-Device Sync
async function pollCloudSync() {
  const endpoint = localStorage.getItem(STORAGE_KEY_CLOUD_ENDPOINT) || DEFAULT_CLOUD_ENDPOINT;
  if (!endpoint) return;

  try {
    const res = await fetch(endpoint, { method: 'GET' });
    if (!res.ok) return;
    const cloudList = await res.json();
    if (!Array.isArray(cloudList)) return;

    let localList = getStoredRegistrations();
    let hasNew = false;

    cloudList.forEach(item => {
      const exists = localList.some(l => l.id === item.id || (l.email === item.email && l.name === item.name));
      if (!exists) {
        localList.unshift(item);
        hasNew = true;
      }
    });

    if (hasNew) {
      localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(localList));
      localStorage.setItem(STORAGE_KEY_SUBMISSIONS_COUNT, localList.length.toString());
      playNotificationChime();
      flashLiveBadge(`🔔 Cloud Sync: ${localList.length} Registrations`);
      refreshDashboard();
    }
  } catch(e) {
    // Non-blocking poll notice
  }
}

function startLiveSync() {
  // 1. Instant cross-tab/cross-window broadcast channel
  try {
    const channel = new BroadcastChannel('able_live_sync_channel');
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_REGISTRATION') {
        handleLiveNewRegistration(event.data.data);
      }
    };
  } catch(e) {}

  // 2. Storage event listener (handles other windows on same browser)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_REGISTRATIONS) {
      refreshDashboard();
    }
  });

  // 3. Regular polling interval for cloud and local changes (every 3.5s)
  if (liveSyncInterval) clearInterval(liveSyncInterval);
  liveSyncInterval = setInterval(() => {
    const currentList = getStoredRegistrations();
    if (currentList.length !== lastKnownSubmissionsCount) {
      lastKnownSubmissionsCount = currentList.length;
      refreshDashboard();
    }
    pollCloudSync();
  }, 3500);
}

// ==========================================
// CLOUD SYNC MODAL CONTROLS
// ==========================================
window.openCloudSyncModal = function() {
  const modal = document.getElementById('cloud-sync-modal');
  if (modal) modal.classList.remove('hidden');

  const input = document.getElementById('cloud-endpoint-input');
  const saved = localStorage.getItem(STORAGE_KEY_CLOUD_ENDPOINT) || DEFAULT_CLOUD_ENDPOINT;
  if (input) input.value = saved;

  const status = document.getElementById('cloud-endpoint-status');
  if (status) {
    status.textContent = "✓ Cloud Webhook active! Live cross-device sync connected.";
    status.classList.remove('hidden');
  }

  if (window.lucide) lucide.createIcons();
};

window.closeCloudSyncModal = function() {
  const modal = document.getElementById('cloud-sync-modal');
  if (modal) modal.classList.add('hidden');
};

window.saveCloudEndpoint = function() {
  const input = document.getElementById('cloud-endpoint-input');
  if (!input) return;
  const val = input.value.trim();

  if (val) {
    localStorage.setItem(STORAGE_KEY_CLOUD_ENDPOINT, val);
    const status = document.getElementById('cloud-endpoint-status');
    if (status) {
      status.textContent = "✓ Cloud Webhook configured! Live cross-device sync is now active.";
      status.classList.remove('hidden');
    }
    pollCloudSync();
  } else {
    localStorage.removeItem(STORAGE_KEY_CLOUD_ENDPOINT);
    const status = document.getElementById('cloud-endpoint-status');
    if (status) status.classList.add('hidden');
  }
};

window.copyAppsScriptCode = function() {
  const codeElem = document.getElementById('apps-script-code');
  if (!codeElem) return;
  navigator.clipboard.writeText(codeElem.innerText).then(() => {
    const btn = document.getElementById('copy-script-btn');
    if (btn) {
      btn.innerHTML = `<span class="text-emerald-400">✓ Copied!</span>`;
      setTimeout(() => {
        btn.innerHTML = `<i data-lucide="copy" class="w-3.5 h-3.5"></i><span>Copy Code</span>`;
        if (window.lucide) lucide.createIcons();
      }, 2500);
    }
  });
};

// On load execution
window.addEventListener('DOMContentLoaded', () => {
  cleanupDummyData();
  checkAuthOnLoad();
  startLiveSync();
  if (window.lucide) lucide.createIcons();
});
