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

// Update Global KPI Trackers
function updateStats() {
  let success = 0, failed = 0, active = 0;
  passengers.forEach(p => {
    if(!p.call_logs || p.call_logs.length === 0) return;
    const s = p.call_logs[0].status;
    if(s === 'completed') success++;
    else if(s === 'failed') failed++;
    else if(s === 'initiated') active++;
  });
  
  document.getElementById('stat-total').textContent = passengers.length;
  document.getElementById('stat-good').textContent = success;
  document.getElementById('stat-fail').textContent = failed;
  document.getElementById('stat-retry').textContent = active;
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

// Table Re-render
function renderTable() {
  passengersBody.innerHTML = '';
  if (passengers.length === 0) {
    passengersBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #555;">No passengers ingested into active manifest.</td></tr>`;
    return;
  }
  
  passengers.forEach(p => {
    let statusClass = 'pending';
    let statusText = 'Pending';
    let attempts = 0;
    
    if (p.call_logs && p.call_logs.length > 0) {
      const latestLog = p.call_logs[0];
      statusText = latestLog.status;
      statusClass = latestLog.status;
      attempts = p.call_logs.length;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="info-stack"><span>${p.name}</span><span class="info-sub">${p.phone}</span></div></td>
      <td><div class="info-stack"><span>${p.boarding_point}</span><span class="info-sub">${p.time}</span></div></td>
      <td><div class="status-pill status-${statusClass.toLowerCase()}">${statusText}</div></td>
      <td><span style="color:#666;">${attempts > 0 ? attempts : '-'} / 3</span></td>
    `;
    passengersBody.appendChild(tr);
  });
}

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
    }
  } catch (error) { showToast('Server Sync Error'); } 
  finally { btn.innerHTML = 'ADD SINGLE RECORD'; btn.disabled = false; }
});

// Trigger Notification Payload
triggerBtn.addEventListener('click', async () => {
  if (passengers.length === 0) return showToast('Manifest is empty.');
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
      showToast('Dispatch Sequence Running!');
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
  
  // Auto Generate Journey ID hash
  document.getElementById('trip-id').value = `${op}-${Math.floor(Math.random() * 900) + 100}-DYN`;
  document.getElementById('trip-dep').value = '22:00';
});

document.getElementById('save-preset-btn').addEventListener('click', () => {
  if (!opSelect.value || !busSelect.value) return showToast('Please select Operator and Fleet first!');
  fetchPassengers();
  showToast('Manifest Synced with Database');
});

// Load Init
fetchPassengers();
