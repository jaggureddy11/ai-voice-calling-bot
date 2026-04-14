// DB Initialization
const SUPABASE_URL = 'https://iqkytbbyucvaddxcehaw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bknGbF05qTEDJLrwU9Ze-Q_g_AFmJvU';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let JOURNEY_ID = document.getElementById('trip-id').value;
let passengers = [];

// DOM Mounts
const passengersBody = document.getElementById('passengers-body');
const passengerCount = document.getElementById('passenger-count');
const addForm = document.getElementById('add-passenger-form');
const triggerBtn = document.getElementById('trigger-calls-btn');
const toast = document.getElementById('toast');
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view-section');
const aiLogsBody = document.getElementById('ai-logs-body');
const unreachableBody = document.getElementById('unreachable-body');
const unreachableSection = document.getElementById('unreachable-section');

// Navigation Logic
navBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-target');
    views.forEach(v => {
      v.classList.remove('active');
      setTimeout(() => { if(!v.classList.contains('active')) v.classList.add('hidden') }, 100);
    });
    
    const view = document.getElementById(targetId);
    view.classList.remove('hidden');
    // Using slight timeout allowing display:block to settle before opacity animates via CSS
    setTimeout(() => view.classList.add('active'), 10);
  });
});

// Toast Util
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

let dashboardChart = null;

// Initialize Chart
function initChart() {
  const ctx = document.getElementById('analyticsChart').getContext('2d');
  dashboardChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Connected', 'Failed', 'Pending/Retrying'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['rgba(0, 230, 118, 0.8)', 'rgba(248, 113, 113, 0.8)', 'rgba(255, 255, 255, 0.2)'],
        borderColor: ['#00E676', '#F87171', '#555'],
        borderWidth: 1,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#E2E8F0', font: { family: 'Outfit', size: 14 } } }
      }
    }
  });
}

// Update Global KPI Trackers
function updateStats() {
  let success = 0, failed = 0, active = 0;
  passengers.forEach(p => {
    if(!p.call_logs || p.call_logs.length === 0) {
      active++;
      return;
    }
    const s = p.call_logs[0].status;
    if(s === 'completed') success++;
    else if(['failed', 'busy', 'no-answer', 'canceled'].includes(s)) failed++;
    else if(['initiated', 'ringing', 'queued', 'in-progress'].includes(s)) active++;
  });
  
  document.getElementById('stat-total').textContent = passengers.length;
  document.getElementById('stat-good').textContent = success;
  document.getElementById('stat-fail').textContent = failed;
  document.getElementById('stat-retry').textContent = active;

  // Update live chart
  if (dashboardChart) {
    dashboardChart.data.datasets[0].data = [success, failed, active];
    dashboardChart.update();
  }
}

// Network Fetch
async function fetchPassengers() {
  JOURNEY_ID = document.getElementById('trip-id').value;
  try {
    const response = await fetch(`http://localhost:3000/api/calls/passengers/${JOURNEY_ID}`);
    const data = await response.json();
    if (response.ok) {
      passengers = data || [];
      passengerCount.textContent = passengers.length;
      updateStats();
      renderTable();
    }
  } catch (error) { console.error('Network Data Error:', error); }
}

// Fetch AI Interaction Logs
async function fetchAILogs() {
  try {
    const response = await fetch('http://localhost:3000/api/calls/ai-logs');
    const data = await response.json();
    if (response.ok) {
      renderAITable(data);
    }
  } catch (error) { console.error('AI Log Fetch Error:', error); }
}

// Table Re-render
function renderTable() {
  passengersBody.innerHTML = '';
  if (passengers.length === 0) {
    passengersBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #555; padding:2rem;">No passengers ingested into active manifest. Add them using the Action Panel.</td></tr>`;
    return;
  }
  
  passengers.forEach(p => {
    let statusClass = 'pending';
    let statusText = 'Pending Initiation';
    let attempts = 0;
    
    if (p.call_logs && p.call_logs.length > 0) {
      const latestLog = p.call_logs[0];
      statusText = latestLog.status.replace('-', ' ').toUpperCase();
      statusClass = latestLog.status;
      attempts = latestLog.attempt_count || 1;
    }

    const tr = document.createElement('tr');
    const lateBadge = latestLog && latestLog.is_flagged ? `<span class="status-pill status-failed" style="margin-left: 8px; font-size: 0.7rem; padding: 2px 8px;">LATE ALERT</span>` : '';

    tr.innerHTML = `
      <td><div class="info-stack"><span>${p.name}${lateBadge}</span><span class="info-sub">${p.phone}</span></div></td>
      <td><div class="info-stack"><span>${p.boarding_point}</span><span class="info-sub">${p.time}</span></div></td>
      <td><div class="status-pill status-${statusClass.toLowerCase()}">${statusText}</div></td>
      <td><span style="color:#666; font-weight:700;">${attempts > 0 ? attempts : '-'} / 3</span></td>
    `;
    passengersBody.appendChild(tr);
  });

  renderUnreachable();
}

// Unreachable logic
function renderUnreachable() {
  const unreachable = passengers.filter(p => {
    if (!p.call_logs || p.call_logs.length === 0) return false;
    const s = p.call_logs[0].status;
    return ['failed', 'busy', 'no-answer'].includes(s);
  });

  unreachableBody.innerHTML = '';
  if (unreachable.length === 0) {
    unreachableSection.classList.add('hidden');
    return;
  }

  unreachableSection.classList.remove('hidden');
  unreachable.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="info-stack"><span>${p.name}</span><span class="info-sub">${p.phone}</span></div></td>
      <td><div class="status-pill status-${p.call_logs[0].status.toLowerCase()}">${p.call_logs[0].status.toUpperCase()}</div></td>
      <td>
        <button class="btn-submit" style="padding: 0.5rem; margin:0;" onclick="sendSMS('${p.id}')">
          SEND SMS FALLBACK
        </button>
      </td>
    `;
    unreachableBody.appendChild(tr);
  });
}

async function sendSMS(passengerId) {
  showToast('Sending SMS fallback...');
  try {
    const response = await fetch('http://localhost:3000/api/calls/sms-fallback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passengerId })
    });
    if (response.ok) {
      showToast('SMS Sent Successfully!');
      fetchPassengers();
    }
  } catch (err) { showToast('SMS dispatch failed.'); }
}

// AI Table Re-render
function renderAITable(logs) {
  aiLogsBody.innerHTML = '';
  if (!logs || logs.length === 0) {
    aiLogsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #555; padding:2rem;">No AI transcripts recorded yet. Trigger a call to see live logic.</td></tr>`;
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#fff;">${log.passenger_name || 'Anonymous'}</td>
      <td>"${log.user_speech}"</td>
      <td style="color:#00E676;">"${log.bot_response}"</td>
      <td><div class="status-pill status-${log.sentiment === 'Active' ? 'completed' : 'failed'}">${log.sentiment}</div></td>
    `;
    aiLogsBody.appendChild(tr);
  });
}

// CSV Drag and Drop Visuals
const csvZone = document.querySelector('.csv-upload-zone');
csvZone.addEventListener('dragover', (e) => { e.preventDefault(); csvZone.style.borderColor = '#00E676'; csvZone.style.background = 'rgba(0,230,118,0.05)'; });
csvZone.addEventListener('dragleave', () => { csvZone.style.borderColor = 'rgba(255,255,255,0.1)'; csvZone.style.background = 'transparent'; });
csvZone.addEventListener('drop', (e) => {
  e.preventDefault();
  csvZone.style.borderColor = 'rgba(255,255,255,0.1)'; 
  csvZone.style.background = 'transparent';
  showToast('CSV Parsing Simulation Enabled! Routing to batch process.');
});

// Handle Form Submission
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  JOURNEY_ID = document.getElementById('trip-id').value;
  
  const payload = {
    journey_id: JOURNEY_ID,
    name: document.getElementById('name').value,
    phone: document.getElementById('phone').value,
    boarding_point: document.getElementById('boarding').value,
    time: document.getElementById('time').value,
    language: document.getElementById('action-language').value
  };

  const btn = addForm.querySelector('button');
  btn.innerHTML = 'INGESTING...';
  btn.disabled = true;

  try {
    const response = await fetch('http://localhost:3000/api/calls/passengers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      showToast('Passenger successfully ingested!');
      fetchPassengers();
      document.getElementById('name').value = '';
    } else { throw new Error('Query block'); }
  } catch (error) { showToast('Database constraint check failed. Operator/Trip missing?'); } 
  finally { btn.innerHTML = 'ADD SINGLE RECORD'; btn.disabled = false; }
});

// Trigger Notification Payload
triggerBtn.addEventListener('click', async () => {
  if (passengers.length === 0) return showToast('Manifest is empty. Ingest data first.');
  JOURNEY_ID = document.getElementById('trip-id').value;
  
  triggerBtn.innerHTML = '<span class="pulse-ring" style="position:relative; width:8px; height:8px;"></span> DISPATCHING...';
  triggerBtn.style.opacity = '0.7';

  try {
    const response = await fetch('http://localhost:3000/api/calls/notify-journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journeyId: JOURNEY_ID })
    });
    if (response.ok) {
      showToast('Dispatch Sequence Sent to Queue!');
      fetchPassengers();
      document.querySelector('[data-target="view-monitoring"]').click(); // Auto-switch to monitoring tab
    }
  } catch (err) { showToast('Network Error bridging to server.'); } 
  finally { 
    triggerBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> NOTIFY MANIFEST';
    triggerBtn.style.opacity = '1';
  }
});

// Real-time Database Observer
supabase.channel('public:call_logs')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_logs' }, payload => {
    fetchPassengers();
  }).subscribe();

supabase.channel('public:ai_logs')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_logs' }, payload => {
    fetchAILogs();
  }).subscribe();

// Dynamic SaaS Interaction Logic
const fleetData = {
  'VRL': ['KA-25-A-1111 (Volvo 9400)', 'KA-25-B-2222 (Sleeper)'],
  'KSRTC': ['KA-01-F-1234 (Airavat)', 'KA-57-F-9999 (Club Class)'],
  'SRS': ['KA-02-C-5555 (Scania)', 'KA-02-D-6666 (Sleeper)'],
  'INTR': ['HR-38-V-8888 (SmartBus)', 'DL-01-Z-0000 (SmartBus)']
};

const opSelect = document.getElementById('trip-op');
const busSelect = document.getElementById('trip-bus');

opSelect.addEventListener('change', (e) => {
  const op = e.target.value;
  const fleets = fleetData[op] || [];
  
  busSelect.innerHTML = '<option value="" disabled selected></option>';
  fleets.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    busSelect.appendChild(opt);
  });
  
  busSelect.disabled = false;
  
  document.getElementById('trip-id').value = `${op}-${Math.floor(Math.random() * 900) + 100}-DYN`;
  document.getElementById('trip-dep').value = '22:00';
});

document.getElementById('save-preset-btn').addEventListener('click', () => {
  if (!opSelect.value || !busSelect.value) return showToast('Please select Operator and Fleet first!');
  fetchPassengers();
  showToast('Manifest Synced with Database');
});

// Load Init
initChart();
fetchPassengers();
fetchAILogs();
