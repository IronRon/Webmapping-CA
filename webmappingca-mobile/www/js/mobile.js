/**
 * CleanMyRide Mobile App
 * Cordova-based Android application for car wash location services
 */

// Configuration
const API_BASE_URL = 'http://172.199.24.2';
const API_ENDPOINTS = {
    carwashes: `${API_BASE_URL}/api/carwashes/`,
    weather: `${API_BASE_URL}/api/weather/`,
    competition: `${API_BASE_URL}/api/competition/`,
    login: `${API_BASE_URL}/api/mobile_login/`,
    logout: `${API_BASE_URL}/logout/`,
};

// Global state
let map = null;
let currentMode = 'user'; // 'user' or 'business'
let carwashMarkers = [];
let userLocation = null;
let authToken = null;
let userData = null;

// Initialize app when Cordova is ready
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log('Cordova initialized');
    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    
    // Initialize app components
    initializeMap();
    setupEventListeners();
    checkAuthentication();
    loadCarwashes();
    
    // Request location permissions
    requestLocationPermission();
}

/**
 * Initialize Leaflet map
 */
function initializeMap() {
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false
    }).setView([53.349804, -6.26031], 7); // Ireland center

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    // Add custom attribution
    L.control.attribution({
        position: 'bottomright',
        prefix: false
    }).addAttribution('&copy; OpenStreetMap contributors').addTo(map);

    // Map click handler
    map.on('click', onMapClick);
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Mode toggle buttons
    document.getElementById('user-mode-btn').addEventListener('click', () => setMode('user'));
    document.getElementById('business-mode-btn').addEventListener('click', () => setMode('business'));
    
    // Menu toggle
    document.getElementById('menu-toggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-close').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', toggleSidebar);
    
    // Login
    document.getElementById('login-btn').addEventListener('click', showLoginModal);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

/**
 * Request location permission
 */
function requestLocationPermission() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log('User location:', userLocation);
                
                // Add user location marker
                L.marker([userLocation.lat, userLocation.lng], {
                    icon: L.divIcon({
                        html: '<div style="background: #ff4d6d; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                        className: '',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    })
                }).addTo(map).bindPopup('Your Location');
                
                // Center map on user
                map.setView([userLocation.lat, userLocation.lng], 10);
            },
            (error) => {
                console.error('Location error:', error);
                showAlert('warning', 'Location access denied. Using default location.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
}

/**
 * Load car wash locations
 */
function loadCarwashes() {
    showMapLoading(true);
    
    console.log('Fetching from:', API_ENDPOINTS.carwashes);
    
    fetch(API_ENDPOINTS.carwashes)
        .then(response => {
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Loaded ${data.features.length} car washes`);
            
            // Clear existing markers
            carwashMarkers.forEach(marker => map.removeLayer(marker));
            carwashMarkers = [];
            
            // Add car wash markers
            data.features.forEach(feature => {
                const coords = feature.geometry.coordinates;
                const props = feature.properties;
                
                const marker = L.marker([coords[1], coords[0]], {
                    icon: L.divIcon({
                        html: `
                            <div class="carwash-marker" style="
                                width: 32px;
                                height: 32px;
                                background: linear-gradient(135deg, #0dcaf0 0%, #0d6efd 100%);
                                border-radius: 50% 50% 50% 0;
                                transform: rotate(-45deg);
                                border: 2px solid white;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <i class="fas fa-car" style="
                                    color: white;
                                    font-size: 14px;
                                    transform: rotate(45deg);
                                    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                                "></i>
                            </div>
                        `,
                        className: '',
                        iconSize: [32, 32],
                        iconAnchor: [16, 32],
                        popupAnchor: [0, -32]
                    })
                });
                
                marker.feature = feature;
                marker.addTo(map);
                marker.on('click', () => onCarwashClick(feature));
                
                carwashMarkers.push(marker);
            });
            
            showMapLoading(false);
        })
        .catch(error => {
            console.error('Error loading car washes:', error);
            console.error('Error type:', error.name);
            console.error('Error message:', error.message);
            console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            showAlert('danger', `Failed to load car wash locations: ${error.message}`);
            showMapLoading(false);
        });
}

/**
 * Handle map click
 */
function onMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    updateMapInfo(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    
    if (currentMode === 'user') {
        findNearbyCarwashes(lat, lng);
    }
}

/**
 * Find nearby car washes
 */
function findNearbyCarwashes(lat, lng) {
    const nearby = carwashMarkers
        .map(marker => {
            const coords = marker.feature.geometry.coordinates;
            const distance = calculateDistance(lat, lng, coords[1], coords[0]);
            return {
                marker: marker,
                feature: marker.feature,
                distance: distance
            };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
    
    displayNearbyCarwashes(nearby);
}

/**
 * Calculate distance between two points (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Display nearby car washes
 */
function displayNearbyCarwashes(nearby) {
    const list = document.getElementById('nearby-list');
    list.innerHTML = '';
    
    nearby.forEach((item, index) => {
        const props = item.feature.properties;
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>${props.name || 'Car Wash'}</strong>
                    <br>
                    <small class="text-muted">${item.distance.toFixed(2)} km away</small>
                </div>
                <span class="badge bg-primary">#${index + 1}</span>
            </div>
        `;
        li.addEventListener('click', () => {
            onCarwashClick(item.feature);
            document.getElementById('nearby-floating').style.display = 'none';
        });
        list.appendChild(li);
    });
    
    document.getElementById('nearby-floating').style.display = 'block';
}

/**
 * Handle car wash marker click
 */
function onCarwashClick(feature) {
    const coords = feature.geometry.coordinates;
    const props = feature.properties;
    
    // Center map on marker
    map.setView([coords[1], coords[0]], 13);
    
    if (currentMode === 'user') {
        // Fetch and display weather
        fetchWeather(coords[1], coords[0], props);
    } else {
        // Fetch and display competition
        fetchCompetition(coords[1], coords[0], props);
    }
}

/**
 * Fetch weather data
 */
async function fetchWeather(lat, lon, washProps) {
    try {
        const response = await fetch(`${API_ENDPOINTS.weather}?lat=${lat}&lon=${lon}`);
        const data = await response.json();
        console.log('Weather data:', data);
        displayWeather(washProps, data);
        
        // Open sidebar to show weather
        if (!document.getElementById('sidebar-menu').classList.contains('show')) {
            toggleSidebar();
        }
    } catch (error) {
        console.error('Weather fetch error:', error);
        showAlert('warning', 'Could not load weather data');
    }
}

/**
 * Display weather advisory
 */
function displayWeather(wash, weather) {
    const panel = document.getElementById('weather-panel');
    const content = document.getElementById('weather-content');
    
    // Determine recommendation
    let recommendation = 'neutral';
    let icon = 'fa-cloud';
    let title = 'Weather Check';
    let message = 'Check current conditions before washing.';
    
    const temp = weather.main?.temp || 15;
    const description = weather.weather?.[0]?.description || 'unknown';
    const isRain = description.toLowerCase().includes('rain');
    const isSnow = description.toLowerCase().includes('snow');
    
    if (isRain || isSnow) {
        recommendation = 'bad';
        icon = 'fa-cloud-rain';
        title = 'Not Recommended';
        message = 'Rain or snow expected. Your car may get dirty again soon.';
    } else if (temp > 10 && temp < 25 && description.toLowerCase().includes('clear')) {
        recommendation = 'good';
        icon = 'fa-sun';
        title = 'Great Time to Wash!';
        message = 'Perfect weather conditions for a car wash.';
    }
    
    content.innerHTML = `
        <div class="weather-advisory">
            <div class="weather-header">
                <i class="fas fa-location-dot text-primary"></i>
                <div class="weather-location">${wash.name || 'Car Wash Location'}</div>
            </div>
            
            <div class="weather-details">
                <div class="weather-stat">
                    <span class="weather-stat-label">Temperature</span>
                    <span class="weather-stat-value">${temp}°C</span>
                </div>
                <div class="weather-stat">
                    <span class="weather-stat-label">Conditions</span>
                    <span class="weather-stat-value">${description}</span>
                </div>
                ${weather.main?.humidity ? `
                <div class="weather-stat">
                    <span class="weather-stat-label">Humidity</span>
                    <span class="weather-stat-value">${weather.main.humidity}%</span>
                </div>
                ` : ''}
            </div>
            
            <div class="wash-recommendation ${recommendation}">
                <div class="recommendation-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="recommendation-title">${title}</div>
                <div class="recommendation-message">${message}</div>
            </div>
        </div>
    `;
    
    panel.style.display = 'block';
}

/**
 * Fetch competition data
 */
async function fetchCompetition(lat, lon, washProps) {
    try {
        const response = await fetch(`${API_ENDPOINTS.competition}?lat=${lat}&lon=${lon}&radius=3`);
        const data = await response.json();
        displayCompetition(washProps, data);
        
        // Open sidebar to show competition
        if (!document.getElementById('sidebar-menu').classList.contains('show')) {
            toggleSidebar();
        }
    } catch (error) {
        console.error('Competition fetch error:', error);
        showAlert('warning', 'Could not load competition data');
    }
}

/**
 * Display competition analysis
 */
function displayCompetition(wash, data) {
    const panel = document.getElementById('competition-panel');
    const content = document.getElementById('competition-content');
    
    const count = data.count || 0;
    const density = data.density || 0;
    
    // Determine saturation level
    let saturation = 'low';
    let icon = 'fa-circle-check';
    let title = 'Low Competition';
    let message = 'Good location with few competitors nearby.';
    
    if (count > 8 || density > 0.8) {
        saturation = 'high';
        icon = 'fa-circle-xmark';
        title = 'High Competition';
        message = 'This area is saturated with car washes. Consider a different location.';
    } else if (count > 4 || density > 0.5) {
        saturation = 'medium';
        icon = 'fa-circle-exclamation';
        title = 'Moderate Competition';
        message = 'Some competition present. Research local demand before deciding.';
    }
    
    content.innerHTML = `
        <div class="competition-advisory">
            <div class="competition-header">
                <i class="fas fa-location-dot text-info"></i>
                <div class="competition-location">${wash.name || 'Analysis Location'}</div>
            </div>
            
            <div class="competition-stats">
                <div class="competition-stat-row">
                    <span class="competition-stat-label">Competitors (3km radius)</span>
                    <span class="competition-stat-value">${count}</span>
                </div>
                <div class="competition-stat-row">
                    <span class="competition-stat-label">Market Density</span>
                    <span class="competition-stat-value">${(density * 100).toFixed(1)}%</span>
                </div>
            </div>
            
            <div class="competition-recommendation ${saturation}">
                <div class="competition-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="competition-title">${title}</div>
                <div class="competition-message">${message}</div>
            </div>
        </div>
    `;
    
    panel.style.display = 'block';
}

/**
 * Set mode (user or business)
 */
function setMode(mode) {
    currentMode = mode;
    
    // Update button states
    document.getElementById('user-mode-btn').classList.toggle('active', mode === 'user');
    document.getElementById('business-mode-btn').classList.toggle('active', mode === 'business');
    
    // Update instructions
    const instructions = document.getElementById('instructions-content');
    if (mode === 'user') {
        instructions.innerHTML = `
            <strong>User Mode:</strong>
            <ul class="mb-0 mt-1">
                <li>Tap anywhere to find nearest car wash</li>
                <li>View 10 closest locations</li>
                <li>Check weather conditions</li>
            </ul>
        `;
        document.getElementById('weather-panel').style.display = 'none';
        document.getElementById('competition-panel').style.display = 'none';
    } else {
        instructions.innerHTML = `
            <strong>Business Mode:</strong>
            <ul class="mb-0 mt-1">
                <li>Tap car wash markers for competition analysis</li>
                <li>View market saturation data</li>
                <li>Assess location viability</li>
            </ul>
        `;
        document.getElementById('weather-panel').style.display = 'none';
        document.getElementById('competition-panel').style.display = 'none';
    }
    
    // Hide nearby floating card
    document.getElementById('nearby-floating').style.display = 'none';
}

/**
 * Toggle sidebar
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar-menu');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
}

/**
 * Show login modal
 */
function showLoginModal() {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    modal.show();
}

/**
 * Handle login form submission
 */
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        const response = await fetch(API_ENDPOINTS.login, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            userData = data.user;
            
            // Update UI
            updateUserInfo();
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            
            showAlert('success', 'Login successful!');
        } else {
            errorDiv.textContent = 'Invalid credentials';
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Login failed. Check your connection.';
        errorDiv.classList.remove('d-none');
    }
}

/**
 * Check authentication status
 */
function checkAuthentication() {
    // Check localStorage for saved token
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        authToken = savedToken;
        // Could validate token with server here
        updateUserInfo();
    }
}

/**
 * Update user info panel
 */
function updateUserInfo() {
    const panel = document.getElementById('user-info-panel');
    
    if (authToken && userData) {
        panel.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-user-circle fa-3x text-primary mb-2"></i>
                <p class="mb-1 fw-bold">${userData.username}</p>
                <p class="text-muted small mb-2">${userData.email || ''}</p>
                <button class="btn btn-sm btn-outline-danger" id="logout-btn">
                    <i class="fas fa-sign-out-alt me-1"></i>Logout
                </button>
            </div>
        `;
        
        document.getElementById('logout-btn').addEventListener('click', handleLogout);
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    authToken = null;
    userData = null;
    localStorage.removeItem('authToken');
    
    const panel = document.getElementById('user-info-panel');
    panel.innerHTML = `
        <div class="text-center text-muted py-3">
            <i class="fas fa-user-circle fa-3x mb-2"></i>
            <p class="mb-0">Not logged in</p>
            <button class="btn btn-sm btn-primary mt-2" id="login-btn">
                <i class="fas fa-sign-in-alt me-1"></i>Login
            </button>
        </div>
    `;
    
    document.getElementById('login-btn').addEventListener('click', showLoginModal);
    showAlert('info', 'Logged out successfully');
}

/**
 * Show/hide map loading overlay
 */
function showMapLoading(show) {
    const overlay = document.getElementById('map-loading');
    if (show) {
        overlay.classList.remove('d-none');
    } else {
        overlay.classList.add('d-none');
    }
}

/**
 * Update map info text
 */
function updateMapInfo(text) {
    document.getElementById('map-coordinates').textContent = text;
}

/**
 * Show alert message
 */
function showAlert(type, message) {
    // Create toast-style notification
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '250px';
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 33000);
}
