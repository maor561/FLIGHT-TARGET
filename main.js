// ============================================================
// FLIGHT TARGET – Main Dashboard Logic
// ============================================================

let currentCategory = 'all';
let currentDateFilter = 'all';
let currentAirlineFilter = 'all';
let map;
let flightLayers = [];
let flightRouteMap = {}; // Maps flight.id → { polyline, marker }
const PEXELS_API_KEY = '23x7wbvKlsAxvOCwf2wRtly1rEN8Xdomc6aBaM4k4MGxmE1B1f1VRPp9';

// ============================================================
// UTILITIES - "NEW" LOGIC & PEXELS IMAGE FETCHING
// ============================================================

function isFlightNew(flight) {
    if (!flight.createdAt) return false;
    const createdTime = new Date(flight.createdAt).getTime();
    const now = new Date().getTime();
    const hoursPassed = (now - createdTime) / (1000 * 60 * 60);
    return hoursPassed < 24;
}

// Generate unique search term for each flight using destination + mission details
function generateFlightSpecificSearchTerm(flight) {
    // Get destination info
    const destInfo = destinations[flight.dest_icao];
    const destName = destInfo?.name || flight.dest_icao;

    // Extract key mission keywords (English)
    const missionKeywords = flight.mission
        .split(' ')
        .filter(w => w.length > 3 && !/^[a-z]$/.test(w)) // Filter short words
        .slice(0, 4)
        .join(' ');

    // Extract category-specific context from mission/background
    let eventKeyword = '';
    const missionLower = (flight.mission + ' ' + (flight.background || '')).toLowerCase();

    // Detect specific event types
    if (missionLower.includes('basketball') || missionLower.includes('euroleague')) {
        eventKeyword = `${destName} basketball arena`;
    } else if (missionLower.includes('football') || missionLower.includes('soccer')) {
        eventKeyword = `${destName} football stadium`;
    } else if (missionLower.includes('judo') || missionLower.includes('martial')) {
        eventKeyword = `judo competition athletes`;
    } else if (missionLower.includes('parliament') || missionLower.includes('eu')) {
        eventKeyword = `${destName} European Parliament government`;
    } else if (missionLower.includes('united nations') || missionLower.includes('un general assembly')) {
        eventKeyword = `${destName} United Nations official`;
    } else if (missionLower.includes('who') || missionLower.includes('health assembly')) {
        eventKeyword = `${destName} World Health Organization meeting`;
    } else if (missionLower.includes('rescue') || missionLower.includes('humanitarian')) {
        eventKeyword = `rescue helicopter emergency mission`;
    } else if (missionLower.includes('concert') || missionLower.includes('performance') || missionLower.includes('eurovision')) {
        eventKeyword = `${destName} concert stage performance`;
    } else if (missionLower.includes('conference') || missionLower.includes('tech') || missionLower.includes('business')) {
        eventKeyword = `${destName} tech conference event`;
    } else if (missionLower.includes('simulator') || missionLower.includes('vatil')) {
        eventKeyword = `flight simulator cockpit aviation`;
    } else {
        // Default: destination + mission
        eventKeyword = `${destName} ${missionKeywords}`.substring(0, 60);
    }

    console.log('🔍 Unique search:', {
        flight: flight.title.substring(0, 25),
        destination: destName,
        searchTerm: eventKeyword
    });

    return eventKeyword;
}

async function fetchPexelsImage(searchTerm) {
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`, {
            headers: { 'Authorization': PEXELS_API_KEY }
        });
        if (!response.ok) throw new Error('Pexels API error');
        const data = await response.json();
        if (data.photos && data.photos[0]) {
            return data.photos[0].src.large; // Return large image URL
        }
    } catch (e) {
        console.warn('Pexels fetch failed for:', searchTerm, e);
    }
    return null;
}

// ============================================================
// DOCTOR SIMULATOR - RSS FEED INTEGRATION
// ============================================================
// Track Doctor Simulator flight GUIDs to avoid duplicates
let doctorSimulatorFlightGuids = new Set();

async function fetchDoctorSimulatorFlights() {
    try {
        const response = await fetch('https://doctor-simulator-flights.vercel.app/api/rss');
        if (!response.ok) throw new Error('Failed to fetch RSS feed');

        const rssText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(rssText, 'application/xml');

        // Check for parsing errors
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('Failed to parse RSS XML');
        }

        const items = xmlDoc.getElementsByTagName('item');
        console.log(`📡 Found ${items.length} Doctor Simulator flights from RSS`);

        let newFlightsCount = 0;
        for (let item of items) {
            try {
                // Extract GUID to check for duplicates
                const guidEl = item.getElementsByTagName('guid')[0];
                const guid = guidEl ? guidEl.textContent : null;

                // Skip if we've already added this flight
                if (guid && doctorSimulatorFlightGuids.has(guid)) {
                    console.log(`⏭️ Skipping duplicate flight: ${guid}`);
                    continue;
                }

                const flight = await createFlightFromRSSItem(item);
                if (flight) {
                    flights.push(flight);
                    if (guid) doctorSimulatorFlightGuids.add(guid);
                    newFlightsCount++;
                }
            } catch (e) {
                console.warn('Error processing RSS item:', e);
            }
        }

        // Refresh UI after adding new flights
        if (newFlightsCount > 0) {
            console.log(`✨ Added ${newFlightsCount} new Doctor Simulator flights`);
            renderFlights();
            updateStats();
            updateNewsTicker();
            updateCategoryCounts();
        }

        console.log(`✅ Doctor Simulator flights synced. Total flights: ${flights.length}`);
    } catch (error) {
        console.error('Doctor Simulator RSS fetch error:', error);
    }
}

// Setup auto-refresh of Doctor Simulator RSS every 3 minutes
function setupRSSAutoRefresh() {
    // Fetch immediately on setup (already done in init)
    // Then fetch every 3 minutes
    setInterval(() => {
        console.log(`🔄 Auto-refreshing Doctor Simulator RSS...`);
        fetchDoctorSimulatorFlights();
    }, 3 * 60 * 1000); // 3 minutes
}

async function createFlightFromRSSItem(item) {
    try {
        // Extract title: "🇮🇱 LLBG → LCLK 🇨🇾"
        const titleEl = item.getElementsByTagName('title')[0];
        if (!titleEl) return null;

        const title = titleEl.textContent;

        // Extract ICAO codes from title - multiple attempts for robustness
        let depIcao = null;
        let arrIcao = null;

        // Try different arrow types: → (unicode), ->, ->
        const arrowPatterns = [
            /([A-Z]{4})\s*→\s*([A-Z]{4})/,  // Unicode arrow
            /([A-Z]{4})\s*->\s*([A-Z]{4})/,  // ASCII arrow
            /\(([A-Z]{4})\).*?→.*?\(([A-Z]{4})\)/,  // With parentheses
        ];

        for (const pattern of arrowPatterns) {
            const match = title.match(pattern);
            if (match) {
                depIcao = match[1];
                arrIcao = match[2];
                break;
            }
        }

        if (!depIcao || !arrIcao) {
            console.warn('Could not extract ICAO codes from title:', title);
            return null;
        }

        // Extract description HTML
        const descEl = item.getElementsByTagName('description')[0];
        if (!descEl) return null;

        // CRITICAL: Remove HTML tags from description text
        // RSS descriptions contain CDATA with HTML, need to clean it
        let descText = descEl.textContent;
        descText = descText.replace(/<[^>]*>/g, '');  // Remove all HTML tags
        descText = descText.replace(/\s+/g, ' ').trim();  // Normalize whitespace

        // Parse route number FIRST (needed for flightId)
        const routeNumMatch = descText.match(/Route #:\s*(\d+)/);
        const routeNum = routeNumMatch ? routeNumMatch[1] : '0';
        const flightId = `DS${routeNum.padStart(3, '0')}`;  // Now can use in logs

        // SIMPLE: Look up airport names from destinations object
        // This is more reliable than regex parsing
        const depName = destinations[depIcao]?.name || depIcao;
        const arrName = destinations[arrIcao]?.name || arrIcao;

        // Parse date: "Date: 2026-04-04" (CRITICAL - must match exactly)
        const dateMatch = descText.match(/Date:\s*([\d]{4}-[\d]{2}-[\d]{2})/);
        let date = dateMatch ? dateMatch[1] : null;

        if (!date) {
            console.warn(`⚠️ ${flightId}: Date parsing FAILED`);
            console.warn(`   descText sample: ${descText.substring(0, 200)}`);
            date = new Date().toISOString().split('T')[0];
            console.warn(`   Falling back to today: ${date}`);
        }

        // Parse departure time: "Departure Time: 12:30"
        const timeMatch = descText.match(/Departure Time:\s*([\d:]+)/);
        const time = timeMatch ? timeMatch[1] : '12:00';

        // Parse status: "✅ Completed" or "🕐 Scheduled"
        const statusMatch = descText.match(/Status:<\/b>\s*([^<]+)/);
        const status = statusMatch ? statusMatch[1].trim() : 'Scheduled';
        const isCompleted = status.includes('Completed');

        // Get or create ID for tracking
        const guidEl = item.getElementsByTagName('guid')[0];
        const guid = guidEl ? guidEl.textContent : `ds-${depIcao}-${arrIcao}-${date}`;

        // Get destination info from destinations object if available
        const destInfo = destinations[arrIcao] || {};

        // Get event-specific image
        const searchTerm = `${arrName} simulator flight`;
        const imageUrl = await fetchPexelsImage(searchTerm);

        // Validate that both airports exist in destinations
        const depExists = destinations[depIcao];
        const arrExists = destinations[arrIcao];

        if (!depExists || !arrExists) {
            console.warn(`Missing destination: ${depIcao}=${depExists ? 'OK' : 'MISSING'}, ${arrIcao}=${arrExists ? 'OK' : 'MISSING'}`);
        }

        const flight = {
            id: flightId,
            category: 'doctor-simulator',
            title: `${depName} → ${arrName}`,
            mission: `Doctor Simulator IFR Training - Flight ${routeNum} of 47`,
            background: `מסע סביב העולם - Leg ${routeNum}/47`,
            route: `${depIcao} -> ${arrIcao}`,  // Critical: must always have actual departure
            dest_icao: arrIcao,
            date: date,
            time: time,
            airline: 'סימולטור',
            aircraft: 'IFR Training',
            icon: '🏥',
            source: 'Doctor Simulator World Tour',
            imageUrl: imageUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%23667eea" width="400" height="300"/><text x="50%25" y="50%25" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Doctor Simulator Flight</text></svg>',
            createdAt: new Date().toISOString(),
            isNew: true
        };

        // Log to verify route is set correctly
        console.log(`✈️ Flight ${routeNum}: ${flight.route} (${depName} → ${arrName})`);

        return flight;
    } catch (error) {
        console.error('Error creating flight from RSS item:', error);
        return null;
    }
}

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    console.log("✈️ FLIGHT TARGET DASHBOARD v1.1.0 ACTIVE");
    initMap();
    populateAirlineFilter();
    renderFlights();
    fetchDoctorSimulatorFlights(); // Fetch RSS flights
    setupRSSAutoRefresh(); // Setup auto-refresh every 3 minutes
    setupEventListeners();
    updateStats();
    initMobileMenu();
    updateAnalytics();
    updateNewsTicker();
    displayDataLastUpdated();
    displayLastUpdatedTime();
    initMetarBar();
    trackVisitor();
    initCalendar();
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
    flightRouteMap = {};

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

    const newBadge = isFlightNew(flight) ? '<span class="new-badge">🆕 חדש</span>' : '';
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

    // Hover: highlight this flight's route + fit map to full route
    card.onmouseenter = () => {
        const route = flightRouteMap[flight.id];
        if (!route) return;

        Object.entries(flightRouteMap).forEach(([id, { polyline, marker }]) => {
            if (id === flight.id) {
                polyline.setStyle({ weight: 5, opacity: 1, dashArray: null });
                marker.setStyle({ radius: 10, fillOpacity: 1 });
                polyline.bringToFront();
            } else {
                polyline.setStyle({ weight: 1, opacity: 0.15 });
                marker.setStyle({ fillOpacity: 0.15, opacity: 0.15 });
            }
        });

        // Fit map to show full route with padding
        map.fitBounds(route.polyline.getBounds(), { padding: [60, 60], maxZoom: 6 });
    };

    card.onmouseleave = () => {
        Object.entries(flightRouteMap).forEach(([id, { polyline, marker }]) => {
            polyline.setStyle({ weight: 2, opacity: 0.7, dashArray: '10, 12' });
            marker.setStyle({ radius: 6, fillOpacity: 1, opacity: 1 });
        });
        // Restore default map view
        map.setView([35, 20], 3, { animate: true, duration: 0.5 });
    };

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
    const LLBG_ICAO = 'LLBG';

    // CRITICAL: Parse route to get departure and arrival ICAO codes
    let depIcao = LLBG_ICAO;  // Default to LLBG
    let arrIcao = flight.dest_icao;

    if (flight.route) {
        // Try to extract ICAO codes from route: "LGSR -> LGKF"
        const routeMatch = flight.route.match(/^([A-Z]{4})\s*->\s*([A-Z]{4})$/);
        if (routeMatch && routeMatch[1] && routeMatch[2]) {
            depIcao = routeMatch[1].toUpperCase();
            arrIcao = routeMatch[2].toUpperCase();
            console.log(`✈️ ${flight.id}: Parsed route correctly: ${depIcao} -> ${arrIcao} (from: ${flight.route})`);
        } else {
            console.warn(`⚠️ ${flight.id}: Could not parse route: "${flight.route}"`);
            console.warn(`   Pattern expected: XXXX -> YYYY, got: ${flight.route}`);
        }
    } else {
        console.warn(`⚠️ ${flight.id}: No route field! Using dest_icao=${arrIcao}, defaulting dep to LLBG`);
    }

    // Look up departure airport - MUST exist in destinations
    const dep = destinations[depIcao];
    const dest = destinations[arrIcao];

    // Both airports must exist
    if (!dep) {
        console.error(`❌ ${flight.id}: Departure airport NOT FOUND: ${depIcao}`);
        console.error(`   Available airports: ${Object.keys(destinations).join(', ')}`);
        return;
    }
    if (!dest) {
        console.error(`❌ ${flight.id}: Arrival airport NOT FOUND: ${arrIcao}`);
        return;
    }

    const isIncoming = arrIcao === LLBG_ICAO;
    const start = dep.coords;
    const end   = dest.coords;

    // Validate coordinates
    if (!start || !end) {
        console.error(`❌ ${flight.id}: Invalid coordinates for ${depIcao}->${arrIcao}`);
        return;
    }

    console.log(`✅ ${flight.id}: Drawing route ${depIcao} (${dep.name}) -> ${arrIcao} (${dest.name})`);

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
    flightRouteMap[flight.id] = { polyline, marker };
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
                iconAnchor: [-10, 17] // Anchor at left edge + small gap → pill appears to the RIGHT of airport dot
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
async function showFlightDetails(flight) {
    const modal = document.getElementById('flight-modal');
    const body  = document.getElementById('modal-body');
    const destInfo = destinations[flight.dest_icao];
    const factsHtml = destInfo?.facts
        ? destInfo.facts.map(f => `<li><span class="fact-bullet">•</span><span>${f}</span></li>`).join('')
        : '<li><span class="fact-bullet">•</span><span>אין מידע זמין על היעד.</span></li>';

    // Pexels search terms by category
    const categorySearchTerms = {
        football: 'soccer match stadium',
        basketball: 'basketball court game',
        'sports-other': 'martial arts judo competition',
        jewish: 'jewish community cultural event',
        rescue: 'rescue helicopter emergency',
        diplomatic: 'government parliament building',
        business: 'tech conference event',
        culture: 'concert performance stage',
        vatil: 'flight simulator cockpit'
    };

    // Color scheme based on category (fallback)
    const categoryColors = {
        football: { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', text: 'משחק כדורגל' },
        basketball: { bg: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', text: 'משחק כדורסל' },
        'sports-other': { bg: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)', text: 'תחרות ספורט' },
        jewish: { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', text: 'אירוע קהילתי' },
        rescue: { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: 'משימת הצלה' },
        diplomatic: { bg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', text: 'משלחת דיפלומטית' },
        business: { bg: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', text: 'כנס עסקי' },
        culture: { bg: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)', text: 'אירוע תרבות' },
        vatil: { bg: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', text: 'סימולציית טיסה' }
    };

    const colorScheme = categoryColors[flight.category] || { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: 'טיסה' };

    // Fetch image from sources (priority: sourceImageUrl > Pexels > gradient)
    let imageUrl = flight.sourceImageUrl || null; // Official image from source website
    if (!imageUrl) {
        // Generate flight-specific search term for unique images per flight
        const searchTerm = generateFlightSpecificSearchTerm(flight);
        imageUrl = await fetchPexelsImage(searchTerm); // Fallback to Pexels with specific search
    }

    console.log('🖼️ Flight details:', { title: flight.title, category: flight.category, sourceImage: flight.sourceImageUrl, pexelsImage: imageUrl, isNew: isFlightNew(flight) });

    // Build hero section with image or fallback to gradient
    const heroHTML = imageUrl
        ? `<img src="${imageUrl}" alt="${flight.title}" class="hero-image">`
        : `<div style="background: ${colorScheme.bg}; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
             <div class="hero-text-overlay">${colorScheme.text}</div>
           </div>`;

    body.innerHTML = `
        <div class="modal-image-hero">
            ${heroHTML}
        </div>

        <div class="modal-header-block">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h2 class="modal-title">${flight.title}</h2>
                ${isFlightNew(flight) ? '<span class="live-badge">🆕 חדש</span>' : ''}
            </div>
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
        </div>

        <div class="modal-description-grid">
            <div class="modal-description primary-border full-width">
                <div class="gradient-bar-primary"></div>
                <h4 class="description-title"><span class="title-icon">📝</span> רקע ומטרת הטיסה</h4>
                <p class="description-text description-text-large">${flight.background}</p>
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

            <div class="modal-description secondary-border full-width">
                <div class="gradient-bar-secondary"></div>
                <h4 class="description-title"><span class="title-icon">🌍</span> 5 עובדות על היעד</h4>
                <div class="dest-title">${destInfo ? destInfo.name : flight.dest_icao}</div>
                <ul class="facts-list">${factsHtml}</ul>
            </div>

            <div class="modal-description source-border full-width">
                <div class="gradient-bar-source"></div>
                <h4 class="description-title"><span class="title-icon">📊</span> מקור המידע</h4>
                <p class="source-text">${flight.source || 'Claude Scheduled Task'}</p>
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

    // Get latest flights sorted by createdAt (newest first)
    const latestFlights = [...flights].sort((a, b) => {
        const aTime = new Date(a.createdAt || '2000-01-01').getTime();
        const bTime = new Date(b.createdAt || '2000-01-01').getTime();
        return bTime - aTime; // Newest first
    }).slice(0, 8); // Show last 8 flights added

    // Get next upcoming flight
    const now = new Date();
    const nextFlight = [...flights]
        .filter(f => new Date(f.date) > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

    // Calculate days until next flight
    let timeText = '';
    if (nextFlight) {
        const daysUntil = Math.ceil((new Date(nextFlight.date) - now) / (1000 * 60 * 60 * 24));
        timeText = daysUntil === 0 ? '🎯 היום!' : daysUntil === 1 ? '⏰ מחר!' : `⏰ עוד ${daysUntil} ימים`;
    }

    if (latestFlights.length === 0) {
        ticker.innerHTML = '<div class="ticker-item"><span style="color:var(--text-muted);">אין טיסות בקרוב</span></div>';
        return;
    }

    // Build ticker items with latest flights
    const items = latestFlights.map(f => {
        const destName = destinations[f.dest_icao]?.name || f.dest_icao;
        return `<div class="ticker-item">
            <span style="color:var(--accent-primary);font-weight:bold;">✨ נוסף</span>
            <span>${f.icon} <strong style="color:var(--accent-primary)">${f.title}</strong> → ${destName} | ${formatDate(f.date)} ${f.time}</span>
        </div>`;
    }).join('<div class="ticker-item"><span style="color:var(--text-muted);padding:0 12px;">◆</span></div>');

    // Add "Time to next flight" item at the beginning
    const timeItem = nextFlight ? `<div class="ticker-item">
        <span style="color:#fbbf24;font-weight:bold;font-size:1.1em;">${timeText}</span>
        <span>${nextFlight.icon} הטיסה הבאה: <strong style="color:var(--accent-primary)">${nextFlight.title}</strong> ב-${formatDate(nextFlight.date)}</span>
    </div>
    <div class="ticker-item"><span style="color:var(--text-muted);padding:0 12px;">◆◆◆</span></div>` : '';

    ticker.innerHTML = timeItem + items + '<div class="ticker-item"><span style="color:var(--text-muted);padding:0 12px;">◆</span></div>' + items;
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
        'rescue': 0,
        'diplomatic': 0,
        'business': 0,
        'culture': 0,
        'vatil': 0,
        'doctor-simulator': 0
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
        'cat-jewish': ['jewish', 'rescue'],
        'cat-business': ['business'],
        'cat-diplomacy': ['diplomatic'],
        'cat-culture': ['culture'],
        'cat-community': ['vatil', 'doctor-simulator']
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

// ============================================================
// CALENDAR VIEW
// ============================================================
let currentCalendarMonth = new Date();

function initCalendar() {
    renderCalendar();
    setupCalendarEventListeners();
}

function renderCalendar() {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();

    // Update header
    const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    document.getElementById('calendar-month').textContent = `${monthNames[month]} ${year}`;

    // Clear grid
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // Add day headers
    const dayHeaders = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    dayHeaders.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });

    // Get first day and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Get flights by date for highlighting
    const flightsByDate = {};
    flights.forEach(f => {
        if (!flightsByDate[f.date]) flightsByDate[f.date] = [];
        flightsByDate[f.date].push(f);
    });

    // Previous month's days
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = daysInPrevMonth - i;
        grid.appendChild(day);
    }

    // Current month's days
    const today = new Date();
    for (let date = 1; date <= daysInMonth; date++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.textContent = date;

        // Format date for comparison
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;

        // Check if today
        if (year === today.getFullYear() && month === today.getMonth() && date === today.getDate()) {
            day.classList.add('today');
        }

        // Check if has flights
        if (flightsByDate[dateStr]) {
            day.classList.add('has-flights');
            day.addEventListener('click', () => showCalendarFlights(dateStr));
        }

        grid.appendChild(day);
    }

    // Next month's days
    const totalCells = grid.children.length - 7; // minus headers
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let i = 1; i <= remainingCells; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = i;
        grid.appendChild(day);
    }
}

function showCalendarFlights(dateStr) {
    const flightList = flights.filter(f => f.date === dateStr);
    const panel = document.getElementById('calendar-flights-panel');
    const listEl = document.getElementById('calendar-flights-list');
    const dateDisplay = document.getElementById('selected-date-display');

    // Format date for display
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    dateDisplay.textContent = date.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    listEl.innerHTML = '';
    flightList.forEach(flight => {
        const item = document.createElement('div');
        item.className = 'calendar-flight-item';
        item.innerHTML = `
            <div class="calendar-flight-title">
                <span class="calendar-flight-icon">${flight.icon}</span>
                ${flight.title}
            </div>
            <div class="calendar-flight-route">${flight.route} | ${flight.time}</div>
        `;
        item.addEventListener('click', () => showFlightDetails(flight));
        listEl.appendChild(item);
    });

    panel.style.display = 'block';
}

function setupCalendarEventListeners() {
    document.getElementById('calendar-prev').addEventListener('click', () => {
        currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('calendar-next').addEventListener('click', () => {
        currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('close-flights-panel').addEventListener('click', () => {
        document.getElementById('calendar-flights-panel').style.display = 'none';
    });
}

// ============================================================
// VISITOR COUNTER (CounterAPI)
// ============================================================
function trackVisitor() {
    const el = document.getElementById('visitor-count');
    if (!el) return;

    // Call counterapi.dev to increment and get count
    fetch('https://api.counterapi.dev/v1/flight-target/visitors/up')
        .then(r => r.json())
        .then(data => {
            const count = data.count || 0;
            el.textContent = count.toLocaleString('he-IL');
        })
        .catch(() => {
            el.textContent = '—';
        });
}
