// --- DATA MOCKUPS ---
const operators = [
    { id: 'abhibus', name: 'Abhibus', tag: 'Smart Partner', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/da/53/3b/da533b00-49a9-1924-4081-7c359e29a306/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg' },
    { id: 'redbus', name: 'Redbus', tag: 'Global', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/6c/5e/69/6c5e69e7-7df0-2c27-ed2d-1d6d0c02fd03/AppIconiOS26-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/512x512bb.jpg' },
    { id: 'cleartrip', name: 'Cleartrip', tag: 'Premium', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/6a/db/5f/6adb5f7d-b581-202b-2e95-5b0b79e3cc91/AppIcon-0-0-1x_U007emarketing-0-8-0-0-85-220.png/512x512bb.jpg' },
    { id: 'goibibo', name: 'Goibibo', tag: 'Popular', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/22/08/9c/22089c0f-7ae0-fc05-85fc-f3308649c21d/appIconSet-0-0-1x_U007emarketing-0-6-0-85-220.png/512x512bb.jpg' }
];

const agencies = [
    { id: 'vrl', name: 'VRL Travels', routeCount: 145, rating: '4.8', opId: 'abhibus' },
    { id: 'srs', name: 'SRS Travels', routeCount: 89, rating: '4.5', opId: 'abhibus' },
    { id: 'laars', name: "Laar's Travels", routeCount: 34, rating: '4.9', opId: 'abhibus' },
    { id: 'kukeshri', name: 'Kukeshri Travels', routeCount: 56, rating: '4.2', opId: 'redbus' },
    { id: 'nagashree', name: 'Nagashree Travels', routeCount: 42, rating: '4.6', opId: 'redbus' }
];

const buses = [
    { id: 'bus1', number: 'KA 01 AB 1234', agencyId: 'vrl', route: 'BLR → HYD', time: '20:30', status: 'upcoming' },
    { id: 'bus2', number: 'KA 04 VTR 5566', agencyId: 'vrl', route: 'BLR → PUNE', time: '21:15', status: 'boarding' },
    { id: 'bus3', number: 'MH 12 XY 9988', agencyId: 'vrl', route: 'MUM → GOA', time: '18:00', status: 'completed' },
];

let passengers = [
    { id: 'p1', name: 'Jaggu Reddy', phone: '+91 9876543210', pickup: 'Majestic', seat: 'L4', boarded: false, callStatus: 'pending' },
    { id: 'p2', name: 'Ankita Sharma', phone: '+91 9988776655', pickup: 'Madiwala', seat: 'U2', boarded: true, callStatus: 'success' },
    { id: 'p3', name: 'Rahul Verma', phone: '+91 8877665544', pickup: 'Silk Board', seat: 'L1', boarded: false, callStatus: 'failed' }
];

let activeOperator = null;
let activeAgency = null;
let activeBus = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
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

        if(opId) { const op = operators.find(x => x.id === opId); if(op) selectOperator(op, true); }
        if(agId) { const ag = agencies.find(x => x.id === agId); if(ag) selectAgency(ag, true); }
        if(busId) { const bus = buses.find(x => x.id === busId); if(bus) selectBus(bus, true); }

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
            
            const target = btn.getAttribute('data-target');
            if(target) {
                // Determine title mapped
                let title = 'Dashboard';
                let breadcrumbs = 'Home';
                if(target === 'view-operators') { title = "Select Operator"; breadcrumbs = "Home / Operators"; }
                if(target === 'view-summary') { title = "System Summary"; breadcrumbs = "Home / Analytics"; }
                if(target === 'view-ai-chat') { title = "AI Assistant"; breadcrumbs = "Home / AI Agent"; }
                
                navigate(target, title, breadcrumbs);
            }
        });
    });

    // Handle Chat input
    const chatInput = document.getElementById('chat-input');
    if(chatInput) {
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') sendChat();
        });
    }
});

// --- NAVIGATION LOGIC ---
function navigate(viewId, title, breadcrumbs, skipStateStore = false) {
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

function renderOperators() {
    const grid = document.getElementById('operators-grid');
    grid.innerHTML = '';
    
    operators.forEach(op => {
        const card = document.createElement('div');
        card.className = 'premium-panel operator-card';
        card.onclick = () => selectOperator(op);
        
        card.innerHTML = `
            <div class="op-logo-wrap"><img src="${op.icon}" alt="${op.name}"></div>
            <h4 class="op-title">${op.name}</h4>
            <p class="op-meta">${op.tag}</p>
        `;
        grid.appendChild(card);
    });
}

function selectOperator(op, skipNav = false) {
    activeOperator = op;
    // Filter agencies
    const opAgencies = agencies.filter(a => a.opId === op.id || a.opId === 'abhibus'); // showing fallback for UI population
    const grid = document.getElementById('agencies-grid');
    grid.innerHTML = '';
    
    document.getElementById('agency-provider-title').innerText = `${op.name} Partners`;
    
    opAgencies.forEach(ag => {
         const card = document.createElement('div');
         card.className = 'premium-panel agency-card';
         card.onclick = () => selectAgency(ag);
         
         card.innerHTML = `
            <div class="ag-icon"><i class="ri-building-4-line"></i></div>
            <div class="ag-info">
                <h4>${ag.name}</h4>
                <p>${ag.routeCount} Active Routes • ⭐ ${ag.rating}</p>
            </div>
         `;
         grid.appendChild(card);
    });
    
    if(!skipNav) navigate('view-agencies', `Select Agency`, `Home / ${op.name} / Agencies`);
}

function selectAgency(ag, skipNav = false) {
    activeAgency = ag;
    const grid = document.getElementById('buses-list');
    grid.innerHTML = '';
    document.getElementById('bus-agency-title').innerText = `${ag.name} Fleet`;
    
    buses.forEach(b => {
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
    
    if(!skipNav) navigate('view-buses', `Active Fleet`, `Home / Agencies / ${ag.name}`);
}

function selectBus(bus, skipNav = false) {
    activeBus = bus;
    document.getElementById('dash-bus-no').innerText = bus.number;
    document.getElementById('dash-route').innerHTML = `${bus.route} | <span id="dash-time">${bus.time}</span>`;
    
    renderPassengers();
    if(!skipNav) navigate('view-bus-dashboard', `Fleet Control`, `Home / Buses / ${bus.number}`);
}

function renderPassengers() {
    const tbody = document.getElementById('passengers-tbody');
    tbody.innerHTML = '';
    
    passengers.forEach(p => {
        const tr = document.createElement('tr');
        
        // Call status badge
        let callBadge = '';
        if(p.callStatus === 'success') callBadge = `<span class="badge-pill bg-success">Connected</span>`;
        if(p.callStatus === 'pending') callBadge = `<span class="badge-pill bg-info">Pending</span>`;
        if(p.callStatus === 'failed')  callBadge = `<span class="badge-pill bg-danger">Failed</span>`;
        
        // Boarding toggle
        let boardToggle = p.boarded ? 
            `<button onclick="toggleBoard('${p.id}')" class="badge-pill bg-success" style="cursor:pointer; border:none;">Boarded</button>` : 
            `<button onclick="toggleBoard('${p.id}')" class="badge-pill bg-warning" style="cursor:pointer; border:none;">Waiting</button>`;

        tr.innerHTML = `
            <td>
                <span class="p-name">${p.name} (Seat: ${p.seat})</span>
                <span class="p-contact">${p.phone}</span>
            </td>
            <td>${p.pickup}</td>
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

function toggleBoard(id) {
    const p = passengers.find(x => x.id === id);
    if(p) {
        p.boarded = !p.boarded;
        renderPassengers();
        showToast(`Status updated for ${p.name}`, 'success');
    }
}

function initiateSingleCall(id, btnElement) {
    const p = passengers.find(x => x.id === id);
    if(!p) return;
    
    // UI Update
    btnElement.innerHTML = `<i class="ri-loader-4-line ri-spin"></i>`;
    p.callStatus = 'pending';
    renderPassengers();
    showToast(`Calling ${p.name}...`, 'info');
    
    // Simulate call
    setTimeout(() => {
        p.callStatus = Math.random() > 0.3 ? 'success' : 'failed';
        renderPassengers();
        
        if(p.callStatus === 'success') {
            showToast(`${p.name} confirmed boarding.`, 'success');
        } else {
            showToast(`${p.name} did not answer.`, 'danger');
        }
    }, 2500);
}

function triggerAutoCall() {
    showToast(`Initiating smart wave calls to all waiting passengers...`, 'info');
    
    // Simulate batch processing
    passengers.forEach((p, idx) => {
        if(!p.boarded) {
            setTimeout(() => {
                p.callStatus = 'pending';
                renderPassengers();
                setTimeout(() => {
                    p.callStatus = Math.random() > 0.2 ? 'success' : 'failed';
                    renderPassengers();
                }, 2000 + (Math.random() * 2000));
            }, idx * 800);
        }
    });
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

function savePassenger() {
    const name = document.getElementById('p-name').value;
    const phone = document.getElementById('p-phone').value;
    const pickup = document.getElementById('p-loc').value;
    const seat = document.getElementById('p-seat').value;
    
    if(!name || !phone) return showToast("Name and Phone are required", "danger");
    
    passengers.push({
        id: 'p' + Date.now(),
        name, phone, pickup, seat,
        boarded: false, callStatus: 'pending'
    });
    
    closeModal('add-passenger-modal');
    document.getElementById('passenger-form').reset();
    renderPassengers();
    showToast("Passenger added successfully.", "success");
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

// --- CHART.JS SUMMARY ---

function initChart() {
    const ctx = document.getElementById('summaryChart');
    if(!ctx) return;
    
    new Chart(ctx, {
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
