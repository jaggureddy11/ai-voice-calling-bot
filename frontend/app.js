// --- CONFIGURATION ---
const API_BASE = 'http://localhost:3000/api/calls';

// --- EFFECTS & EASTER EGGS ---
function honkHorn() {
    const hornAudio = new Audio('https://actions.google.com/sounds/v1/transportation/truck_horn.ogg');
    hornAudio.volume = 0.4;
    hornAudio.play().catch(e => console.log("Audio playback blocked by browser"));

    // Flashing the headlights high-beam
    const headlights = document.querySelectorAll('.headlight-beam');
    headlights.forEach(hl => {
        const oldFilter = hl.style.filter;
        hl.style.filter = 'drop-shadow(0 0 30px rgba(255, 255, 255, 1)) scale(1.1)';
        setTimeout(() => { hl.style.filter = oldFilter; }, 400);
    });
}

// --- STATE MANAGEMENT ---
let operators = [];
let agencies = [];
let buses = [];
let passengers = [];

let activeOperator = null;
let activeAgency = null;
let activeBus = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch initial data
    try {
        const opRes = await fetch(`${API_BASE}/operators`);
        operators = await opRes.json();
    } catch (e) {
        console.error('Failed to fetch operators', e);
        showToast('System Offline: Check Backend Connection', 'danger');
    }

    const isLanded = localStorage.getItem('boardly_landed');
    if (isLanded === 'true') {
        document.getElementById('landing-screen').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('visible');
        
        renderOperators();
        initChart();

        const opId = localStorage.getItem('boardly_op_id');
        const agId = localStorage.getItem('boardly_ag_id');
        const busId = localStorage.getItem('boardly_bus_id');
        const viewId = localStorage.getItem('boardly_viewId') || 'view-operators';
        const title = localStorage.getItem('boardly_title') || 'Select Operator';
        const bread = localStorage.getItem('boardly_bread') || 'Home / Operators';

        if(opId) { 
            const op = operators.find(x => x.id === opId); 
            if(op) {
                await selectOperator(op, true);
                if(agId) { 
                    try {
                        const agRes = await fetch(`${API_BASE}/agencies?operatorId=${opId}`);
                        agencies = await agRes.json();
                        const ag = agencies.find(x => x.id === agId); 
                        if(ag) {
                            await selectAgency(ag, true);
                            if(busId) {
                                try {
                                    const busRes = await fetch(`${API_BASE}/buses?agencyId=${agId}`);
                                    buses = await busRes.json();
                                    const bus = buses.find(x => x.id === busId); 
                                    if(bus) await selectBus(bus, true); 
                                } catch (e) { console.error('Restore bus failed'); }
                            }
                        }
                    } catch (e) { console.error('Restore agency failed'); }
                }
            }
        }

        navigate(viewId, title, bread, true);
        
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const activeNavBtn = document.querySelector(`.nav-btn[data-target="${viewId}"]`);
        if(activeNavBtn) activeNavBtn.classList.add('active');
    }
    // 1. Landing Screen Logic
    const enterBtn = document.getElementById('enter-btn');
    if(enterBtn) {
        enterBtn.addEventListener('click', () => {
            const loader = document.querySelector('.loader-bar');
            if (loader) loader.style.width = '100%';
            
            setTimeout(() => {
                document.getElementById('landing-screen').classList.add('fade-out');
                setTimeout(() => {
                    localStorage.setItem('boardly_landed', 'true');
                    document.getElementById('landing-screen').style.display = 'none';
                    document.getElementById('app-container').classList.remove('hidden');
                    // slight delay for animation
                    setTimeout(() => {
                        document.getElementById('app-container').classList.add('visible');
                        renderOperators();
                        initChart();
                    }, 50);
                }, 800);
            }, loader ? 600 : 0);
        });
    }

    // 2. Sidebar Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetId = btn.getAttribute('data-target');
            if(targetId) {
                let title = 'Dashboard';
                let breadcrumbs = 'Home';
                if(targetId === 'view-operators') { title = "Select Operator"; breadcrumbs = "Home / Operators"; }
                if(targetId === 'view-summary') { title = "System Summary"; breadcrumbs = "Home / Analytics"; }
                if(targetId === 'view-ai-chat') { title = "AI Assistant"; breadcrumbs = "Home / AI Agent"; }
                
                navigate(targetId, title, breadcrumbs);

                if(targetId === 'view-summary') { 
                    fetchSummaryStats();
                    initChart();
                }
            }
        });
    });

    // Global Search listener
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const activeView = document.querySelector('.view-section.active').id;
            
            if (activeView === 'view-operators') renderOperators(term);
            if (activeView === 'view-agencies') renderAgencies(term);
            if (activeView === 'view-buses') renderBuses(term);
            if (activeView === 'view-bus-dashboard') renderPassengers(term);
        });
    }
});

// --- NAVIGATION LOGIC ---
function navigate(viewId, title, breadcrumbs, skipStateStore = false) {
    // Clear search when navigating
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = '';

    // Hide all views
    document.querySelectorAll('.view-section').forEach(v => {
        v.classList.remove('active');
    });
    // Show target
    const target = document.getElementById(viewId);
    if(target) target.classList.add('active');
    
    // Update Header
    document.getElementById('header-title').innerText = title;
    document.getElementById('header-breadcrumbs').innerText = breadcrumbs;

    if(!skipStateStore) {
        localStorage.setItem('boardly_viewId', viewId);
        localStorage.setItem('boardly_title', title);
        localStorage.setItem('boardly_bread', breadcrumbs);
        if(activeOperator) localStorage.setItem('boardly_op_id', activeOperator.id);
        if(activeAgency) localStorage.setItem('boardly_ag_id', activeAgency.id);
        if(activeBus) localStorage.setItem('boardly_bus_id', activeBus.id);
    }
}

// --- RENDERERS ---

function renderOperators(filter = '') {
    const grid = document.getElementById('operators-grid');
    grid.innerHTML = '';
    
    if (!operators || operators.length === 0) {
        grid.innerHTML = `
            <div class="premium-panel" style="grid-column: 1/-1; text-align:center; padding: 60px;">
                <h4 style="margin-bottom:20px;">No Operators in Database</h4>
                <p style="margin-bottom:30px; color: var(--text-muted);">The app is connected to Supabase, but the tables are empty.</p>
                <button class="btn-primary" onclick="seedDemoData()">Restore Demo Data</button>
            </div>
        `;
        return;
    }

    const filtered = operators.filter(op => op.name.toLowerCase().includes(filter));

    filtered.forEach(op => {
        const card = document.createElement('div');
        card.className = 'premium-panel operator-card';
        card.onclick = () => selectOperator(op);
        
        const icon = op.icon || 'https://images.unsplash.com/photo-1544620347-c4fd4a9d5957?auto=format&fit=crop&w=100&q=80';
        const tag = op.tag || 'Service Provider';

        card.innerHTML = `
            <div class="op-logo-wrap"><img src="${icon}" alt="${op.name}"></div>
            <h4 class="op-title">${op.name}</h4>
            <p class="op-meta">${tag}</p>
        `;
        grid.appendChild(card);
    });
}

function renderAgencies(filter = '') {
    const grid = document.getElementById('agencies-grid');
    grid.innerHTML = '';
    
    if (!agencies) return;

    const filtered = agencies.filter(ag => ag.name.toLowerCase().includes(filter));
    
    filtered.forEach(ag => {
         const card = document.createElement('div');
         card.className = 'premium-panel agency-card';
         card.onclick = () => selectAgency(ag);
         
         card.innerHTML = `
            <div class="ag-icon"><i class="ri-building-4-line"></i></div>
            <div class="ag-info">
                <h4>${ag.name}</h4>
                <p>${ag.route_count || ag.routeCount} Active Routes • ⭐ ${ag.rating}</p>
            </div>
         `;
         grid.appendChild(card);
    });
}

async function selectOperator(op, skipNav = false) {
    activeOperator = op;
    
    // Fetch agencies dynamically from Supabase
    try {
        const res = await fetch(`${API_BASE}/agencies?operatorId=${op.id}`);
        agencies = await res.json();
    } catch (e) {
        showToast('Failed to load agencies', 'danger');
        return;
    }

    document.getElementById('agency-provider-title').innerText = `${op.name} Partners`;
    renderAgencies();
    
    if(!skipNav) navigate('view-agencies', `Select Agency`, `Home / ${op.name} / Agencies`);
}

function renderBuses(filter = '') {
    const grid = document.getElementById('buses-list');
    grid.innerHTML = '';
    if (!buses) return;
    
    const filtered = buses.filter(b => 
        b.number.toLowerCase().includes(filter) || 
        b.route.toLowerCase().includes(filter)
    );

    filtered.forEach(b => {
        const item = document.createElement('div');
        item.className = 'premium-panel bus-list-item';
        item.onclick = () => selectBus(b);
        
        let statusClass = b.status === 'upcoming' ? 'status-upcoming' : b.status === 'boarding' ? 'status-boarding' : 'status-completed';
        let statusText = b.status.toUpperCase();

        item.innerHTML = `
            <div class="bus-left">
                <div class="bus-time">${b.time}</div>
                <div class="bus-details">
                    <h4>${b.number}</h4>
                    <p>${b.route}</p>
                </div>
            </div>
            <div class="bus-status ${statusClass}">${statusText}</div>
        `;
        grid.appendChild(item);
    });
}

async function selectAgency(ag, skipNav = false) {
    activeAgency = ag;

    // Fetch buses dynamically from Supabase
    try {
        const res = await fetch(`${API_BASE}/buses?agencyId=${ag.id}`);
        buses = await res.json();
    } catch (e) {
        showToast('Failed to load buses', 'danger');
        return;
    }

    document.getElementById('bus-agency-title').innerText = `${ag.name} Fleet`;
    renderBuses();
    
    if(!skipNav) navigate('view-buses', `Active Fleet`, `Home / Agencies / ${ag.name}`);
}

async function selectBus(bus, skipNav = false) {
    activeBus = bus;
    document.getElementById('dash-bus-no').innerText = bus.number;
    document.getElementById('dash-route').innerHTML = `${bus.route} | <span id="dash-time">${bus.time}</span>`;
    
    const res = await fetch(`${API_BASE}/passengers/${activeBus.id}`);
    passengers = await res.json();

    renderPassengers();
    if(!skipNav) navigate('view-bus-dashboard', `Fleet Control`, `Home / Buses / ${bus.number}`);
}

async function renderPassengers(filter = '') {
    const tbody = document.getElementById('passengers-tbody');
    tbody.innerHTML = '';
    
    if (!activeBus || !passengers) return;

    const filtered = passengers.filter(p => 
        p.name.toLowerCase().includes(filter) || 
        (p.seat_no && p.seat_no.toLowerCase().includes(filter)) ||
        p.phone.includes(filter)
    );
    
    filtered.forEach(p => {
        const tr = document.createElement('tr');
        
        // ... (remaining tr.innerHTML logic stays same but we need to keep it inside the replacement block)
        let callBadge = '';
        const status = p.call_status || 'pending';
        if(status === 'success' || status === 'completed') callBadge = `<span class="badge-pill bg-success">Connected</span>`;
        if(status === 'pending' || status === 'queued' || status === 'initiated') callBadge = `<span class="badge-pill bg-info">Pending</span>`;
        if(['failed', 'busy', 'no-answer', 'canceled'].includes(status))  callBadge = `<span class="badge-pill bg-danger">Failed</span>`;
        if(!callBadge) callBadge = `<span class="badge-pill bg-info">${status.toUpperCase()}</span>`;

        let boardToggle = p.is_boarded ? 
            `<button onclick="toggleBoard('${p.id}')" class="badge-pill bg-success" style="cursor:pointer; border:none;">Boarded</button>` : 
            `<button onclick="toggleBoard('${p.id}')" class="badge-pill bg-warning" style="cursor:pointer; border:none;">Waiting</button>`;

        tr.innerHTML = `
            <td>
                <span class="p-name">${p.name} (Seat: ${p.seat_no || 'N/A'})</span>
                <span class="p-contact">${p.phone}</span>
            </td>
            <td>${p.boarding_point || 'N/A'}</td>
            <td>${boardToggle}</td>
            <td id="call-status-${p.id}">${callBadge}</td>
            <td>
                <div class="row-actions">
                    <button class="action-btn call" onclick="initiateSingleCall('${p.id}', this)" title="Call Passenger"><i class="ri-phone-fill"></i></button>
                    <button class="action-btn msg" title="Send SMS"><i class="ri-message-3-fill"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- ACTIONS & INTERACTIONS ---

async function toggleBoard(id) {
    if (!activeBus) return;
    const p = passengers.find(x => x.id === id);
    if(p) {
        const newStatus = !p.is_boarded;
        try {
            await fetch(`${API_BASE}/passengers/${id}/board`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_boarded: newStatus })
            });
            p.is_boarded = newStatus;
            await renderPassengers();
            showToast(`Status updated for ${p.name}`, 'success');
        } catch (e) {
            showToast('Failed to sync status', 'danger');
        }
    }
}

async function initiateSingleCall(id, btnElement) {
    if (!activeBus) return;
    const p = passengers.find(x => x.id === id);
    if(!p) return;
    
    // UI Update
    btnElement.innerHTML = `<i class="ri-loader-4-line ri-spin"></i>`;
    p.callStatus = 'pending';
    // No real single call endpoint yet, but we use notify-bus with specific seat
    try {
        await fetch(`${API_BASE}/notify-bus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ busId: activeBus.id, seat_numbers: [p.seat_no] })
        });
        showToast(`Calling ${p.name}...`, 'info');
        // Refresh after some delay to see queued status
        setTimeout(() => renderPassengers(), 2000);
    } catch (e) {
        showToast('Failed to trigger call', 'danger');
    }
}

async function triggerAutoCall() {
    if (!activeBus) return;
    showToast(`Initiating smart wave calls to all waiting passengers...`, 'info');
    
    try {
        await fetch(`${API_BASE}/notify-bus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ busId: activeBus.id })
        });
        setTimeout(() => renderPassengers(), 1000);
    } catch (e) {
        showToast('Failed to trigger batch calls', 'danger');
    }
}

// --- MODALS ---

function openAddPassengerModal() {
    document.getElementById('modal-backdrop').classList.add('active');
    document.getElementById('add-passenger-modal').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.getElementById('modal-backdrop').classList.remove('active');
}

async function savePassenger() {
    if (!activeBus) return showToast("No active bus selected", "danger");
    
    const name = document.getElementById('p-name').value;
    const phone = document.getElementById('p-phone').value;
    const boarding_point = document.getElementById('p-loc').value;
    const seat_no = document.getElementById('p-seat').value;
    
    if(!name || !phone) return showToast("Name and Phone are required", "danger");
    
    try {
        const res = await fetch(`${API_BASE}/passengers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bus_id: activeBus.id,
                name, phone, boarding_point, seat_no,
                time: activeBus.time
            })
        });

        if (res.ok) {
            closeModal('add-passenger-modal');
            document.getElementById('passenger-form').reset();
            await renderPassengers();
            showToast("Passenger added and synced to Supabase.", "success");
        } else {
            const err = await res.json();
            showToast(err.error || "Save failed", "danger");
        }
    } catch (e) {
        showToast("Network Error: Could not reach Supabase Sync Engine", "danger");
    }
}

function handleOCRUpload() {
    showToast("Extracting data via AI OCR...", "info");
    const spinnerHtml = `<div style="text-align:center; padding: 20px;"><i class="ri-loader-4-line ri-spin" style="font-size:30px; color: var(--primary)"></i></div>`;
    const formHtml = document.getElementById('passenger-form').innerHTML;
    
    document.getElementById('passenger-form').innerHTML = spinnerHtml;
    
    setTimeout(() => {
        document.getElementById('passenger-form').innerHTML = formHtml;
        // Autofill simulated data
        document.getElementById('p-name').value = "Meera Rajput";
        document.getElementById('p-phone').value = "+91 8899889988";
        document.getElementById('p-loc').value = "Koramangala";
        document.getElementById('p-seat').value = "S12";
        showToast("Data extracted successfully!", "success");
    }, 2000);
}

// --- AI CHATBOT LOGIC ---

function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if(!msg) return;
    
    appendChatMessage(msg, 'user-msg');
    input.value = '';
    
    // Simulate AI thinking
    setTimeout(() => {
        let reply = "I'm analyzing the active manifests. How else can I help?";
        const lMsg = msg.toLowerCase();
        if(lMsg.includes('bus') && lMsg.includes('location')) {
            reply = activeBus ? `The bus ${activeBus.number} is currently 15 mins away from next boarding point.` : "Please select a bus from the dashboard to track it.";
        } else if(lMsg.includes('luggage')) {
            reply = "Standard luggage policy allows up to 15kg per passenger and one standard cabin bag.";
        } else if(lMsg.includes('late') || lMsg.includes('wait')) {
            reply = "I can trigger an automated call to the driver to notify them. Should I proceed?";
        }
        
        appendChatMessage(reply, 'ai-msg');
    }, 1000);
}

function appendChatMessage(text, className) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `msg ${className}`;
    div.innerHTML = `<div class="msg-bubble">${text}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// --- UTILS ---

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    let icon = 'ri-information-line';
    if(type === 'success') { icon = 'ri-checkbox-circle-fill'; }
    if(type === 'danger')  { icon = 'ri-error-warning-fill'; }
    
    toast.innerHTML = `<i class="${icon}"></i> ${msg}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function fetchSummaryStats() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const stats = await res.json();
        
        document.getElementById('stat-active-trips').innerText = stats.activeTrips;
        document.getElementById('stat-total-passengers').innerText = stats.totalPassengers;
        document.getElementById('stat-boarded-count').innerText = stats.boardedCount;
        document.getElementById('stat-success-rate').innerText = stats.successRate;
    } catch (e) {
        console.error('Failed to fetch stats', e);
    }
}

// --- CHART.JS SUMMARY ---

let summaryChartInstance = null;
function initChart() {
    const ctx = document.getElementById('summaryChart');
    if(!ctx) return;
    
    if (summaryChartInstance) {
        summaryChartInstance.destroy();
    }

    summaryChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Passengers Boarded',
                data: [120, 150, 140, 180, 220, 250, 200],
                borderColor: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }, {
                label: 'Automated Calls Made',
                data: [115, 140, 135, 175, 215, 245, 190],
                borderColor: '#666666',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#ffffff', font: { family: 'Inter', size: 12 } } }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#888888', font: { family: 'Inter' } } },
                x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#888888', font: { family: 'Inter' } } }
            }
        }
    });
}

function resetApp() {
    localStorage.clear();
    window.location.reload();
}

async function seedDemoData() {
    showToast("Restoring demo data to Supabase...", "info");
    try {
        const res = await fetch(`${API_BASE}/seed`, { method: 'POST' });
        if (res.ok) {
            showToast("Database seeded successfully!", "success");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showToast("Seeding failed. Check backend logs.", "danger");
        }
    } catch (e) {
        showToast("Network Error: Could not reach backend.", "danger");
    }
}
