// Initialize Supabase using User config
const SUPABASE_URL = 'https://iqkytbbyucvaddxcehaw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bknGbF05qTEDJLrwU9Ze-Q_g_AFmJvU';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const JOURNEY_ID = 'BLR-HYD-830'; // Hardcoded for this prototype

// DOM Elements
const passengersBody = document.getElementById('passengers-body');
const passengerCount = document.getElementById('passenger-count');
const addForm = document.getElementById('add-passenger-form');
const triggerBtn = document.getElementById('trigger-calls-btn');
const toast = document.getElementById('toast');

let passengers = [];

// Show Toast
function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Fetch Passengers via Backend API
async function fetchPassengers() {
  try {
    const response = await fetch(`http://localhost:3000/api/calls/passengers/${JOURNEY_ID}`);
    const data = await response.json();
    
    if (response.ok) {
      passengers = data;
      passengerCount.textContent = passengers.length;
      renderTable();
    } else {
      console.error('Error fetching passengers:', data.error);
    }
  } catch (error) {
    console.error('Network Error:', error);
  }
}

// Render Table
function renderTable() {
  passengersBody.innerHTML = '';
  
  if (passengers.length === 0) {
    passengersBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #555;">No passengers registered yet.</td></tr>`;
    return;
  }

  passengers.forEach(p => {
    // Check if there is a call log attached to this passenger
    let statusClass = 'pending';
    let statusText = 'Pending';

    if (p.call_logs && p.call_logs.length > 0) {
      // Get the most recent call log status
      const latestLog = p.call_logs[0];
      statusText = latestLog.status;
      statusClass = latestLog.status; // initiated, completed, failed
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="info-stack">
          <span>${p.name}</span>
          <span class="info-sub">${p.phone}</span>
        </div>
      </td>
      <td>${p.boarding_point}</td>
      <td>${p.time}</td>
      <td><div class="status-pill status-${statusClass.toLowerCase()}">${statusText}</div></td>
    `;
    passengersBody.appendChild(tr);
  });
}

// Add Passenger submit handler
addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('name').value;
  const phone = document.getElementById('phone').value;
  const boarding_point = document.getElementById('boarding').value;
  const time = document.getElementById('time').value;

  const btn = addForm.querySelector('button');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = 'Adding...';
  btn.disabled = true;

  try {
    const response = await fetch('http://localhost:3000/api/calls/passengers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        journey_id: JOURNEY_ID,
        name,
        phone,
        boarding_point,
        time,
        language: 'en-IN'
      })
    });

    if (response.ok) {
      showToast('Passenger securely added to manifest!');
      addForm.reset();
      document.getElementById('time').value = '8:30 PM';
      fetchPassengers();
    } else {
      throw new Error('Server rejected insert');
    }
  } catch (error) {
    showToast('Failed to add passenger');
    console.error(error);
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
});

// Trigger Notification Call API
triggerBtn.addEventListener('click', async () => {
  if (passengers.length === 0) {
    showToast('No passengers to notify!');
    return;
  }

  triggerBtn.innerHTML = '<span class="icon">⏳</span> INITIATING CALLS...';
  triggerBtn.classList.remove('glow');
  triggerBtn.style.opacity = '0.7';

  try {
    const response = await fetch('http://localhost:3000/api/calls/notify-journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journeyId: JOURNEY_ID })
    });

    const result = await response.json();
    
    if (response.ok) {
      showToast('Calls successfully dispatched!');
      fetchPassengers(); // re-fetch to see "initiated" status
    } else {
      showToast('Error dispatching calls');
    }
  } catch (err) {
    showToast('Network Error bridging to server.');
  } finally {
    triggerBtn.innerHTML = '<span class="icon">📞</span> NOTIFY ALL PASSENGERS';
    triggerBtn.classList.add('glow');
    triggerBtn.style.opacity = '1';
  }
});

// Real-time listener for Call Logs updates
supabase
  .channel('public:call_logs')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_logs' }, payload => {
    // When a call finishes, BullMQ updates the DB. We instantly refresh the view!
    fetchPassengers();
  })
  .subscribe();

// Initial load
fetchPassengers();
