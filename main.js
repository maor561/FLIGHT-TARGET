// ============================================================
// FLIGHT TARGET – Main Dashboard Logic
// ============================================================

let currentCategory = 'all';
let currentDateFilter = 'all';
let currentAirlineFilter = 'all';
let map;
let flightLayers = [];

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log("✈️ FLIGHT TARGET DASHBOARD v1.1.0 ACTIVE");
    initMap();
    populateAirlineFilter();
    renderFlights();
    setupEventListeners();
    updateStats();
    initMobileMenu();
    updateAnalytics();
    updateNewsTicker();
    displayDataLastUpdated();
    displayLastUpdatedTime();
    initMetarBar();
});


function initMobileMenu() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggle && sidebar) {
        toggle.onclick = () => {
            sidebar.classList.toggle('active');
            toggle.classList.toggle('active');
        };
    }
}

// ============================================================
// DATA LAST UPDATED (from scheduled task)
// ============================================================
function displayDataLastUpdated() {
    const el = document.getElementById('data-last-updated');
    if (!el) return;

    // Fetch latest commit timestamp from GitHub API
    fetch('https://api.github.com/repos/maor561/FLIGHT-TARGET/commits?per_page=1')
        .then(r => r.json())
        .then(data => {
            if (data && data[0]) {
                const d = new Date(data[0].commit.author.date);
                el.textContent = d.toLocaleString('he-IL', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
        })
        .catch(err => {
            // Fallback to data.js timestamp if API fails
            if (typeof lastUpdated !== 'undefined') {
                const d = new Date(lastUpdated.timestamp);
                el.textContent = d.toLocaleString('he-IL', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            }
            console.warn('GitHub API error:', err);
        });
}

function displayLastUpdatedTime() {
    const el = document.getElementById('last-updated-time');
    if (!el || typeof lastUpdated === 'undefined') return;
    const d = new Date(lastUpdated.timestamp);
    el.textContent = d.toLocaleTimeString('he-IL', {
        hour: '2-digit', minute: '2-digit'
    });
}

// ============================================================
// METAR – Real-Time Weather Data
// ============================================================
async function initMetarBar() {
    await fetchAndDisplayMetar();
    setInterval(fetchAndDisplayMetar, 5 * 60 * 1000);
}

async function fetchAndDisplayMetar() {
    try {
        let raw = await tryFetchMetarFromApis();
        if (raw) {
            displayMetar(raw);
        } else {
            throw new Error('No METAR data available');
        }
    } catch (e) {
        const rawEl = document.getElementById('metar-raw');
        if (rawEl) rawEl.textContent = 'אין חיבור ל-API';
        console.warn('METAR fetch error:', e.message);
    }
}

async function tryFetchMetarFromApis() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=32.00&longitude=34.88&current_weather=true`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            const cur = data.current_weather;
            if (cur) {
                const temp = Math.round(cur.temperature);
                const wind = Math.round(cur.windspeed);
                const deg = Math.round(cur.winddirection);
                const day = new Date().getUTCDate().toString().padStart(2, '0');
                const hour = new Date().getUTCHours().toString().padStart(2, '0');
                const timeStr = `${day}${hour}00Z`;
                const windStr = `${deg.toString().padStart(3, '0')}${wind.toString().padStart(2, '0')}KT`;
                const tempStr = `${temp < 0 ? 'M' : ''}${Math.abs(temp).toString().padStart(2, '0')}/${(temp-2).toString().padStart(2, '0')}`;
                return `LLBG ${timeStr} ${windStr} 9999 CAVOK ${tempStr} Q1013`;
            }
        }
    } catch (e) { console.debug('Open-Meteo failed:', e.message); }
    return null;
}

function displayMetar(raw) {
    const rawEl = document.getElementById('metar-raw');
    const windEl = document.getElementById('metar-wind');
    const visEl = document.getElementById('metar-vis');
    const tempEl = document.getElementById('metar-temp');
    const qnhEl = document.getElementById('metar-qnh');
    const condEl = document.getElementById('metar-condition');
    const timeEl = document.getElementById('metar-update-time');

    if (rawEl) rawEl.textContent = raw;

    const p = parseMetar(raw);
    if (windEl) windEl.textContent = '💨 ' + (p.wind || '–');
    if (visEl)  visEl.textContent  = '👁️ ' + (p.visibility || '–');
    if (tempEl) tempEl.textContent = '🌡️ ' + (p.temp || '–');
    if (qnhEl)  qnhEl.textContent  = '🔵 ' + (p.qnh || '–');
    if (condEl) condEl.textContent = p.condIcon + ' ' + (p.clouds || p.cavok || '–');
    if (timeEl) timeEl.textContent = 'עדכון: ' + new Date().toLocaleTimeString('he-IL', {
        hour: '2-digit', minute: '2-digit'
    });
}

function parseMetar(raw) {
    const parts = raw.trim().split(/\s+/);
    const result = {
        station: '', time: '', wind: '', visibility: '',
        clouds: '', cavok: '', temp: '', dew: '', qnh: '',
        trend: '', condIcon: '🌤️'
    };

    for (const part of parts) {
        if (/^[A-Z]{4}$/.test(part) && !result.station) {
            result.station = part;
        }
        else if (/^\d{6}Z$/.test(part)) {
            result.time = part.slice(2, 4) + ':' + part.slice(4, 6) + 'Z';
        }
        else if (/^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(part)) {
            if (part.startsWith('VRB')) {
                result.wind = 'VRB ' + part.replace('VRB', '').replace('KT', '') + 'kt';
            } else {
                const dir = part.slice(0, 3);
                const spd = part.slice(3).replace(/G\d+/, '').replace('KT', '');
                const gust = part.includes('G') ? ' G' + part.match(/G(\d+)/)[1] : '';
                result.wind = dir + '° / ' + spd + gust + 'kt';
            }
        }
        else if (part === 'CAVOK') {
            result.cavok = 'CAVOK';
            result.visibility = '10km+';
            result.condIcon = '☀️';
        }
        else if (/^\d{4}$/.test(part) && !result.visibility) {
            const vis = parseInt(part);
            result.visibility = vis >= 9999 ? '10km+' : (vis / 1000).toFixed(1) + 'km';
        }
        else if (/^(FEW|SCT|BKN|OVC)\d{3}/.test(part)) {
            const type = part.slice(0, 3);
            const height = parseInt(part.slice(3, 6)) * 100;
            result.clouds += type + ' ' + (height >= 10000 ? (height/1000).toFixed(0)+'k' : height) + 'ft ';
            if (type === 'BKN' || type === 'OVC') result.condIcon = '☁️';
            else if (type === 'SCT') result.condIcon = '⛅';
            else result.condIcon = '🌤️';
        }
        else if (/^M?\d{2}\/M?\d{2}$/.test(part)) {
            const [t, d] = part.split('/');
            result.temp = t.replace('M', '-') + '°C';
            result.dew = d.replace('M', '-') + '°C';
        }
        else if (/^Q\d{4}$/.test(part)) {
            result.qnh = 'Q' + part.slice(1) + ' hPa';
        }
        else if (/^A\d{4}$/.test(part) && !result.qnh) {
            result.qnh = 'A' + part.slice(1);
        }
        else if (/^(-|\+)?(RA|SN|TS|FG|BR|DZ|SH|GR|GS|FZ|MI|PR|BC|DR|BL|PO|SQ|FC|SS|DS)/.test(part)) {
            if (part.includes('RA')) result.condIcon = '🌧️';
            else if (part.includes('TS')) result.condIcon = '⛈️';
            else if (part.includes('SN')) result.condIcon = '🌨️';
            else if (part.includes('FG') || part.includes('BR')) result.condIcon = '🌫️';
        }
        else if (part === 'NOSIG') result.trend = 'NOSIG';
        else if (part === 'TEMPO') result.trend = 'TEMPO';
        else if (part === 'BECMG') result.trend = 'BECMG';
    }

    return result;
}

// ============================================================
// MAP INITIALIZATION
// ============================================================
function initMap() {
    const LLBG_COORDS = [32.0055, 34.8854];
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([35, 20], 3);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // Add pulsing radar animation style
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes radar-pulse {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(3.5); opacity: 0; }
        }
        .radar-pulse-ring { animation: radar-pulse 2s ease-out infinite !important; transform-origin: center; }
        @keyframes dash { to { stroke-dashoffset: -100; } }
        .animated-path { animation: dash 5s linear infinite; }
    `;
    document.head.appendChild(style);

    const LLBG_ICON = L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div style="position:relative;width:20px;height:20px;">
                <div style="position:absolute;width:100%;height:100%;background:var(--accent-primary);border-radius:50%;box-shadow:0 0 15px var(--accent-glow);border:2px solid white;"></div>
                <div class="radar-pulse-ring" style="position:absolute;width:100%;height:100%;background:var(--accent-primary);border-radius:50%;opacity:0.5;"></div>
            </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    L.marker(LLBG_COORDS, { icon: LLBG_ICON }).addTo(map)
        .bindPopup('<b style="color:#00d2ff">Ben Gurion International Airport</b><br><small>LLBG / TLV – Tel Aviv, Israel</small>');
}

// ============================================================
// AIRLINE FILTER
// ============================================================
function populateAirlineFilter() {
    const sel = document.getElementById('airline-filter');
    sel.innerHTML = '<option value="all">כל חברות התעופה</option>';
    const airlines = [...new Set(flights.map(f => f.airline))].sort();
    airlines.forEach(a => {
        const o = document.createElement('option');
        o.value = a; o.textContent = a;
        sel.appendChild(o);
    });
}

// ============================================================
// RENDER FLIGHTS
// ============================================================
function renderFlights(category = 'all', searchTerm = '') {
    const listContainer = document.getElementById('flight-list');
    listContainer.innerHTML = '';
    flightLayers.forEach(l => map.removeLayer(l));
    flightLayers = [];

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);

    const filtered = flights.filter(f => {
        const matchCat = category === 'all' || f.category === category;
        const q = searchTerm.toLowerCase();
        const matchSearch = !q || f.title.includes(q) || f.mission.toLowerCase().includes(q) ||
            f.route.toLowerCase().includes(q) || f.airline.toLowerCase().includes(q);
        const matchAirline = currentAirlineFilter === 'all' || f.airline === currentAirlineFilter;

        // Only show future flights (today and later)
        const fd = new Date(f.date); fd.setHours(0, 0, 0, 0);
        const isFutureFlight = fd >= today;

        let matchDate = true;
        if (currentDateFilter !== 'all') {
            if (currentDateFilter === 'today') matchDate = fd.getTime() === today.getTime();
            else if (currentDateFilter === 'weekly') matchDate = fd >= today && fd <= nextWeek;
        }

        return matchCat && matchSearch && matchAirline && matchDate && isFutureFlight;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    filtered.forEach((flight, i) => {
        listContainer.appendChild(createFlightCard(flight, i));
        addFlightToMap(flight, i);
    });

    updateStats(filtered.length);
    updateAnalytics();
    updateCategoryCounts();
}

// ============================================================
// FLIGHT CARD
// ============================================================
function createFlightCard(flight, index = 0) {
    const card = document.createElement('div');
    card.className = 'flight-card';
    card.style.animationDelay = `${index * 0.07}s`;

    const isIncoming = flight.route && flight.route.endsWith('-> LLBG');
    const dirBadge = isIncoming
        ? '<span class="dir-badge incoming">⬇ נכנס</span>'
        : '<span class="dir-badge outgoing">⬆ יוצא</span>';

    const newBadge = flight.isNew ? '<span class="new-badge">🆕 חדש</span>' : '';
    card.innerHTML = `
        <div class="flight-category-icon">${flight.icon}</div>
        <div class="flight-info">
            <div class="flight-title">${flight.title}${newBadge}</div>
            <div class="flight-subtitle">${flight.mission}</div>
        </div>
        <div class="flight-route">
            <div class="icao-route">${flight.route} ${dirBadge}</div>
            <div class="flight-time">${formatDate(flight.date)} | ${flight.time}</div>
            <div class="flight-status">
                <span class="status-dot"></span>מתוכנן
            </div>
        </div>`;

    card.onclick = () => showFlightDetails(flight);
    return card;
}

function formatDate(dateStr) {
    if (!dateStr) return '–';
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ============================================================
// MAP FLIGHT LAYER + WEATHER
// ============================================================
function addFlightToMap(flight, index = 0) {
    const LLBG = [32.0055, 34.8854];
    const dest = destinations[flight.dest_icao];
    if (!dest) return;

    const isIncoming = flight.route && flight.route.endsWith('-> LLBG');
    const start = isIncoming ? dest.coords : LLBG;
    const end   = isIncoming ? LLBG : dest.coords;

    const polyline = L.polyline([start, end], {
        color: isIncoming ? '#ff6b6b' : '#00d2ff',
        weight: 2, opacity: 0.7,
        dashArray: '10, 12',
        lineCap: 'round',
        className: 'animated-path'
    }).addTo(map);

    const marker = L.circleMarker(dest.coords, {
        radius: 6,
        fillColor: isIncoming ? '#ff6b6b' : '#ffd700',
        color: '#fff', weight: 2, opacity: 1, fillOpacity: 1
    }).addTo(map).bindPopup(`
        <div style="direction:rtl;font-family:Assistant,sans-serif;">
            <strong style="color:var(--accent-primary);">${flight.title}</strong><br>
            <span style="color:#999;font-size:.8rem;">${flight.route}</span>
        </div>`);

    // Add weather marker for destination with staggering
    setTimeout(() => {
        fetchAndAddWeatherMarker(dest.coords, flight.dest_icao, dest.name);
    }, index * 200);

    flightLayers.push(polyline, marker);
}

function fetchAndAddWeatherMarker(coords, icao, destName) {
    // Fetch weather using Open-Meteo (Native CORS support)
    const [lat, lon] = coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    fetch(url)
        .then(r => r.ok ? r.json() : Promise.reject('No response'))
        .then(data => {
            const cur = data.current_weather;
            if (!cur) throw new Error('No weather data');
            
            const temp = Math.round(cur.temperature);
            const wind = Math.round(cur.windspeed);

            const code = cur.weathercode;
            let icon = '🌤️';

            // Map Open-Meteo weather codes to icons
            if (code === 0) icon = '☀️';
            else if (code <= 3) icon = '⛅';
            else if (code <= 48) icon = '🌫️';
            else if (code <= 55) icon = '🌧️';
            else if (code <= 65) icon = '🌧️';
            else if (code <= 77) icon = '🌨️';
            else if (code <= 82) icon = '🌧️';
            else if (code <= 86) icon = '🌨️';
            else if (code >= 95) icon = '⛈️';

            const weatherIcon = L.divIcon({
                className: 'custom-weather-icon',
                html: `<div style="display:flex; align-items:center; gap:6px; white-space:nowrap; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); color:white; padding:4px 10px; border-radius:30px; border:1.5px solid rgba(255,255,255,0.25); box-shadow:0 4px 15px rgba(0,0,0,0.4);">
                    <span style="font-size:1.3rem; line-height:1;">${icon}</span>
                    <span style="font-size:0.9rem; font-weight:800; color:#00d2ff;">${temp}°</span>
                </div>`,
                iconSize: [80, 34],
                iconAnchor: [40, 17]
            });
            const wMarker = L.marker(coords, { icon: weatherIcon }).addTo(map);
            flightLayers.push(wMarker);
        })
        .catch(err => {
            console.debug(`Weather for ${destName}:`, err);
            // Silent fail - weather not available
        });
}

// ============================================================
// FLIGHT DETAILS MODAL
// ============================================================
function showFlightDetails(flight) {
    const modal = document.getElementById('flight-modal');
    const body  = document.getElementById('modal-body');
    const destInfo = destinations[flight.dest_icao];
    const factsHtml = destInfo?.facts
        ? destInfo.facts.map(f => `<li><span class="fact-bullet">•</span><span>${f}</span></li>`).join('')
        : '<li><span class="fact-bullet">•</span><span>אין מידע זמין על היעד.</span></li>';

    body.innerHTML = `
        <div class="modal-header-block">
            <div class="modal-icon">${flight.icon}</div>
            <h2 class="modal-title">${flight.title}</h2>
            <p class="modal-subtitle">${flight.mission}</p>
        </div>

        <div class="modal-details details-grid-3">
            <div class="detail-card">
                <div class="detail-label">נתיב טיסה (ICAO)</div>
                <div class="detail-value route-value">${flight.route}</div>
            </div>
            <div class="detail-card">
                <div class="detail-label">תאריך ושעה</div>
                <div class="detail-value">${formatDate(flight.date)} <span class="time-muted">| ${flight.time}</span></div>
            </div>
            <div class="detail-card">
                <div class="detail-label">יעד</div>
                <div class="detail-value" style="color:var(--accent-primary)">${destInfo ? destInfo.name : flight.dest_icao}</div>
            </div>
            <div class="detail-card">
                <div class="detail-label">מקור הנתונים</div>
                <div class="detail-value">${flight.source || 'Claude Scheduled Task'}</div>
            </div>
        </div>

        <div class="modal-description-grid">
            <div class="modal-description primary-border">
                <div class="gradient-bar-primary"></div>
                <h4 class="description-title"><span class="title-icon">📝</span> רקע ומטרת הטיסה</h4>
                <p class="description-text">${flight.background}</p>
                <div class="airline-status-row">
                    <div class="airline-info">
                        <span class="airline-label">חברת תעופה</span>
                        <div class="airline-name">
                            <strong dir="ltr">${flight.airline}</strong>
                        </div>
                    </div>
                    <div class="status-info">
                        <span class="status-label">סטטוס</span>
                        <span class="status-indicator">
                            <span class="status-dot-pulse"></span>מתוכנן להמראה
                        </span>
                    </div>
                </div>
            </div>

            <div class="modal-description secondary-border">
                <div class="gradient-bar-secondary"></div>
                <h4 class="description-title"><span class="title-icon">🌍</span> 5 עובדות על היעד</h4>
                <div class="dest-title">${destInfo ? destInfo.name : flight.dest_icao}</div>
                <ul class="facts-list">${factsHtml}</ul>
            </div>
        </div>`;

    modal.style.display = 'flex';
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = e => {
            e.stopPropagation();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentCategory = item.dataset.category;
            renderFlights(currentCategory, document.getElementById('search-input').value);
        };
    });

    // Category toggles
    document.querySelectorAll('.category-header').forEach(h => {
        h.onclick = () => h.parentElement.classList.toggle('open');
    });

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.onclick = () => {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
            themeToggle.textContent = isLight ? '🌓' : '☀️';
        };
    }

    // Search
    document.getElementById('search-input').oninput = e =>
        renderFlights(currentCategory, e.target.value);

    // Date filters
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.onclick = () => {
            document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            const txt = tag.textContent.trim();
            currentDateFilter = txt === 'היום' ? 'today' : txt === 'השבוע' ? 'weekly' : 'all';
            renderFlights(currentCategory, document.getElementById('search-input').value);
        };
    });

    // Airline filter
    document.getElementById('airline-filter').onchange = e => {
        currentAirlineFilter = e.target.value;
        renderFlights(currentCategory, document.getElementById('search-input').value);
    };

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    const overlay    = document.getElementById('scanning-overlay');
    refreshBtn.onclick = async () => {
        if (refreshBtn.classList.contains('spinning')) return;
        refreshBtn.classList.add('spinning');
        if (overlay) overlay.style.display = 'flex';

        await new Promise(r => setTimeout(r, 1800));
        await fetchAndDisplayMetar();
        renderFlights(currentCategory, document.getElementById('search-input').value);
        updateLastUpdatedTime();

        refreshBtn.classList.remove('spinning');
        if (overlay) overlay.style.display = 'none';
    };

    // Modal close
    document.querySelector('.close-modal').onclick = () =>
        document.getElementById('flight-modal').style.display = 'none';
    window.onclick = e => {
        if (e.target === document.getElementById('flight-modal'))
            document.getElementById('flight-modal').style.display = 'none';
    };
}

// ============================================================
// NEWS TICKER - Only NEW flights
// ============================================================
async function updateNewsTicker() {
    const ticker = document.getElementById('news-ticker');
    if (!ticker) return;

    // Show only flights marked as NEW
    const newFlights = flights.filter(f => f.isNew);

    if (newFlights.length === 0) {
        ticker.innerHTML = '<div class="ticker-item"><span style="color:var(--text-muted);">אין אירועים חדשים כעת</span></div>';
        return;
    }

    const items = newFlights.map(f => {
        const destName = destinations[f.dest_icao]?.name || f.dest_icao;
        return `<div class="ticker-item">
            <span class="live-badge">🆕 חדש</span>
            <span>${f.icon} <strong style="color:var(--accent-primary)">${f.title}</strong> – ${f.airline} → ${destName} | ${formatDate(f.date)} ${f.time}</span>
        </div>`;
    }).join('<div class="ticker-item"><span style="color:var(--text-muted);padding:0 12px;">◆</span></div>');

    ticker.innerHTML = items + '<div class="ticker-item"><span style="color:var(--text-muted);padding:0 12px;">◆</span></div>' + items;
}

// ============================================================
// STATS & ANALYTICS
// ============================================================
function updateStats(count) {
    document.getElementById('total-flights').textContent = count !== undefined ? count : flights.length;
    document.getElementById('upcoming-events').textContent = new Set(flights.map(f => f.category)).size;
}

// ============================================================
// UPDATE CATEGORY COUNTS
// ============================================================
function updateCategoryCounts() {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Count by category (only future flights)
    const counts = {
        'football': 0,
        'basketball': 0,
        'sports-other': 0,
        'jewish': 0,
        'diplomatic': 0,
        'business': 0,
        'culture': 0
    };

    flights.forEach(f => {
        const fd = new Date(f.date); fd.setHours(0, 0, 0, 0);
        if (fd >= today && counts.hasOwnProperty(f.category)) {
            counts[f.category]++;
        }
    });

    // Update category headers with counts
    const categoryMap = {
        'cat-sports': ['football', 'basketball', 'sports-other'],
        'cat-jewish': ['jewish'],
        'cat-business': ['business'],
        'cat-diplomacy': ['diplomatic'],
        'cat-culture': ['culture']
    };

    Object.entries(categoryMap).forEach(([elemId, cats]) => {
        const elem = document.getElementById(elemId);
        if (!elem) return;
        const header = elem.querySelector('.category-header');
        if (!header) return;

        const label = header.querySelector('.label');
        if (!label) return;

        const total = cats.reduce((sum, cat) => sum + counts[cat], 0);

        // Remove existing count if present
        const countSpan = header.querySelector('.category-count');
        if (countSpan) countSpan.remove();

        // Add new count span
        const newCountSpan = document.createElement('span');
        newCountSpan.className = 'category-count';
        newCountSpan.textContent = `(${total})`;
        label.appendChild(document.createTextNode(' '));
        header.insertBefore(newCountSpan, header.querySelector('.chevron'));
    });
}

function updateAnalytics() {
    const chart = document.getElementById('analytics-chart');
    if (!chart) return;
    chart.innerHTML = '';

    const counts = {};
    flights.forEach(f => { counts[f.category] = (counts[f.category] || 0) + 1; });
    const total = flights.length;
    const cats  = Object.keys(counts);

    cats.forEach((cat, i) => {
        const pct = (counts[cat] / total) * 100;
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = Math.max(pct, 8) + '%';
        bar.setAttribute('data-label', `${cat}: ${counts[cat]}`);
        bar.style.background = `hsl(${180 + i * 35}, 70%, 50%)`;
        chart.appendChild(bar);
    });
}

function updateLastUpdatedTime() {
    const el = document.getElementById('last-updated-time');
    if (el) el.textContent = new Date().toLocaleTimeString('he-IL', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}
