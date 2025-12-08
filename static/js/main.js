// Global variables
let map;
let userMarkers = [];
let currentMode = 'user'; // 'user' or 'business'
let countyLayer = null;
let savedRecommendations = [];
let lastRecommendation = null;

// Initialize application when page loads
document.addEventListener('DOMContentLoaded', function () {
    console.log('🗺️ Initializing Hello Map application...');
    if (!window.USER_LOGGED_IN) {
        document.getElementById('business-mode-btn').disabled = true;
    }
    initializeMap();
    setupEventListeners();
    setupMobileSidebar();
    loadSampleData();
    if (currentMode === 'business') {
        loadCountyBoundaries();
    }
});

/**
 * Initialize the Leaflet map
 */
function initializeMap() {
    try {
        // Create map instance centered on Ireland
        map = L.map('map').setView([53.4, -7.7], 7);

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
            minZoom: 2
        }).addTo(map);

        // Add scale control
        L.control.scale({
            position: 'bottomright',
            imperial: false
        }).addTo(map);

        console.log('Map initialized successfully');

    } catch (error) {
        console.error('Failed to initialize map:', error);
        showAlert('danger', 'Failed to initialize map. Please refresh the page.');
    }
}

/**
 * Set up mobile sidebar toggle
 */
function setupMobileSidebar() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarPanel = document.getElementById('sidebar-panel');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (!sidebarToggle || !sidebarPanel || !sidebarOverlay) return;
    
    // Toggle sidebar on button click
    sidebarToggle.addEventListener('click', function() {
        sidebarPanel.classList.toggle('show');
        sidebarOverlay.classList.toggle('show');
        
        // Change icon
        const icon = sidebarToggle.querySelector('i');
        if (sidebarPanel.classList.contains('show')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
    
    // Close sidebar when clicking overlay
    sidebarOverlay.addEventListener('click', function() {
        sidebarPanel.classList.remove('show');
        sidebarOverlay.classList.remove('show');
        const icon = sidebarToggle.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    });
    
    // Close sidebar when map is clicked (on mobile)
    map.on('click', function() {
        if (window.innerWidth <= 768 && sidebarPanel.classList.contains('show')) {
            sidebarPanel.classList.remove('show');
            sidebarOverlay.classList.remove('show');
            const icon = sidebarToggle.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
}

/**
 * Set up event listeners for user interactions
 */
function setupEventListeners() {
    // Map click event for coordinates
    map.on('click', function (e) {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);

        // Show temporary marker
        showTemporaryMarker(e.latlng);

        if (polygonMode && currentMode === 'business') {
            addPolygonPoint(e.latlng);
            return;   // Do not trigger other business logic
        }

        if (currentMode === 'business' && businessRecommendMode === 'circle') {
            // Set sidebar lat/lng fields
            document.getElementById('circle-lat').value = lat;
            document.getElementById('circle-lng').value = lng;

            // Draw circle on map
            const radiusKm = parseFloat(document.getElementById('circle-radius-km').value) || 10;
            const radiusMeters = radiusKm * 1000;
            // Remove previous circle if exists
            if (window.businessCircle) {
                map.removeLayer(window.businessCircle);
                window.businessCircle = null;
            }
            window.businessCircle = L.circle([lat, lng], {
                radius: radiusMeters,
                color: '#ff9800', // orange
                fillColor: '#ff9800',
                fillOpacity: 0.15,
                weight: 2
            }).addTo(map);
            // Optionally zoom to fit circle
            map.fitBounds(window.businessCircle.getBounds(), { maxZoom: 13 });

            // Call backend for recommended location in circle
            let minDistanceKm = parseFloat(document.getElementById('min-distance-km').value) || 5;
            let maxSettlementDistanceKm = parseFloat(document.getElementById('max-settlement-distance-km').value) || 10;
            fetch(`/api/recommend_circle/?lat=${lat}&lng=${lng}&radius_km=${radiusKm}&min_distance_km=${minDistanceKm}&max_settlement_distance_km=${maxSettlementDistanceKm}`, {
                credentials: 'include'
            })
                .then(response => response.json())
                .then(data => {
                    if (data.recommendations && data.recommendations.length > 0) {
                        const rec = data.recommendations[0];
                        lastRecommendation = {
                            lat: rec.lat,
                            lng: rec.lng,
                            source_type: 'circle',
                            reason: 'Recommended site within selected circle'
                        };
                        // Remove previous recommended marker if exists
                        if (window.recommendedCarwashMarker) {
                            map.removeLayer(window.recommendedCarwashMarker);
                        }
                        // Add marker for recommended location
                        const icon = L.divIcon({
                            className: 'recommended-marker',
                            html: `<div style="background-color: #ff5722; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>`,
                            iconSize: [22, 22],
                            iconAnchor: [11, 11]
                        });
                        window.recommendedCarwashMarker = L.marker([rec.lat, rec.lng], { icon }).addTo(map);
                        window.recommendedCarwashMarker.bindPopup(
                            `<b>Recommended Car Wash Site</b><br>` +
                            `Settlement: ${rec.name || 'Unknown'}<br>` +
                            `Population: ${rec.population || 'Unknown'}<br>` +
                            `Distance to nearest car wash: ${rec.min_distance_to_carwash_km ? rec.min_distance_to_carwash_km.toFixed(2) : 'N/A'} km` +
                            `<br>Nearby settlements: ${rec.nearby_settlements}` +
                            `<hr>
                            <button class="btn btn-sm btn-success w-100" onclick="saveRecommendation()">
                                <i class="fas fa-bookmark me-1"></i> Save Recommendation
                            </button>`
                        ).openPopup();
                        map.setView([rec.lat, rec.lng], Math.max(map.getZoom(), 11));
                    } else {
                        showAlert('info', 'No suitable recommended site found in this circle.');
                    }
                })
                .catch(error => {
                    showAlert('danger', 'Failed to fetch recommended car wash location for circle.');
                    console.error(error);
                });
            return;
        }

        if (currentMode === 'user') {
            // Remove previous nearest marker if exists
            if (window.nearestCarwashMarker) {
                map.removeLayer(window.nearestCarwashMarker);
                window.nearestCarwashMarker = null;
            }

            // Send coordinates to backend to find nearest car wash
            fetch(`/api/nearest/?lat=${lat}&lng=${lng}`, {
                credentials: 'include'
            })
                .then(response => response.json())
                .then(data => {
                    if (data && data.location) {
                        const carwash = data.location;
                        // Show marker and popup for nearest car wash
                        window.nearestCarwashMarker = L.marker([carwash.lat, carwash.lng]).addTo(map);
                        window.nearestCarwashMarker.bindPopup(`<b>Nearest Car Wash</b><br>
                    Name: ${carwash.name}<br>
                    Address: ${carwash.address || ''}<br>
                    Distance: ${data.distance.toFixed(2)} km`).openPopup();
                    } else {
                        showAlert('info', 'No car wash found nearby.');
                    }
                })
                .catch(error => {
                    showAlert('danger', 'Failed to find nearest car wash.');
                    console.error(error);
                });

            // Fetch and display nearby car washes list
            fetch(`/api/nearby/?lat=${lat}&lng=${lng}`, {
                credentials: 'include'
            })
                .then(response => response.json())
                .then(data => {
                    showNearbyCarwashesList(data.carwashes);
                })
                .catch(error => {
                    showNearbyCarwashesList([]);
                });
        }
    });

    // Reset view button
    document.getElementById('reset-view').addEventListener('click', function () {
        resetMapView();
    });

    document.getElementById('user-mode-btn').addEventListener('click', function () {
        updateInstructions('user');
    });
    document.getElementById('business-mode-btn').addEventListener('click', function () {
        updateInstructions('business');
    });

    document.getElementById('county-recommend-mode-btn').addEventListener('click', function () {
        updateRecommendationInstructions('county');
    });
    document.getElementById('circle-recommend-mode-btn').addEventListener('click', function () {
        updateRecommendationInstructions('circle');
    });
    document.getElementById('polygon-recommend-mode-btn').addEventListener('click', function () {
        updateRecommendationInstructions('polygon');
    });

}

/**
 * Load sample location data to demonstrate the map
 */
function loadSampleData() {
    showMapLoading(true);
    // Fetch carwash locations from Django GeoJSON endpoint
    fetch('/carwashes.geojson')
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    const icon = L.divIcon({
                        className: 'custom-marker carwash-marker',
                        html: `
                            <div style="
                                background: linear-gradient(135deg, #0dcaf0 0%, #0d6efd 100%);
                                width: 32px;
                                height: 32px;
                                border-radius: 50% 50% 50% 0;
                                transform: rotate(-45deg);
                                border: 3px solid white;
                                box-shadow: 0 3px 8px rgba(0,0,0,0.4);
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
                        iconSize: [32, 32],
                        iconAnchor: [16, 32],
                        popupAnchor: [0, -32]
                    });
                    return L.marker(latlng, { icon });
                },
                onEachFeature: function (feature, layer) {
                    const props = feature.properties;
                    let popupContent = `<b>Car Wash</b><br>`;
                    if (props.name) popupContent += `<b>Name:</b> ${props.name}<br>`;
                    if (props.brand) popupContent += `<b>Brand:</b> ${props.brand}<br>`;
                    if (props.addr_street || props.addr_city || props.addr_postcode) {
                        let address = '';
                        if (props.addr_street) address += props.addr_street;
                        if (props.addr_city) address += (address ? ', ' : '') + props.addr_city;
                        if (props.addr_postcode) address += (address ? ', ' : '') + props.addr_postcode;
                        popupContent += `<b>Address:</b> ${address}<br>`;
                    }
                    if (props.amenity) popupContent += `<b>Amenity:</b> ${props.amenity}<br>`;
                    if (props.operator) popupContent += `<b>Operator:</b> ${props.operator}<br>`;
                    if (props.website) popupContent += `<b>Website:</b> <a href='${props.website}' target='_blank'>${props.website}</a><br>`;
                    if (props.phone) popupContent += `<b>Phone:</b> ${props.phone}<br>`;
                    if (props.opening_hours) popupContent += `<b>Opening Hours:</b> ${props.opening_hours}<br>`;
                    if (props.email) popupContent += `<b>Email:</b> <a href='mailto:${props.email}'>${props.email}</a><br>`;
                    if (props.description) popupContent += `<b>Description:</b> ${props.description}<br>`;
                    layer.bindPopup(popupContent);
                    layer.on('click', async () => {
                        const wash = {
                            name: feature.properties.name || "Car Wash",
                            lat: feature.geometry.coordinates[1],
                            lng: feature.geometry.coordinates[0]
                        };

                        // Show different analysis based on current mode
                        if (currentMode === 'user') {
                            try {
                                const weather = await fetchWeather(wash.lat, wash.lng);
                                showWeatherInSidebar(wash, weather);
                            } catch (err) {
                                console.error('Weather fetch error:', err);
                                // Show error message in weather panel
                                const panel = document.getElementById("weather-panel");
                                const content = document.getElementById("weather-content");
                                if (content && currentMode === 'user') {
                                    content.innerHTML = `
                                        <div class="weather-advisory">
                                            <div class="weather-header">
                                                <h6 class="weather-location">${wash.name}</h6>
                                            </div>
                                            <div class="wash-recommendation neutral">
                                                <div class="recommendation-icon">
                                                    <i class="fas fa-exclamation-triangle"></i>
                                                </div>
                                                <div class="recommendation-title">Weather Data Unavailable</div>
                                                <p class="recommendation-message">Unable to fetch weather information at this time.</p>
                                            </div>
                                        </div>
                                    `;
                                    if (panel) panel.style.display = 'block';
                                }
                            }
                        } else if (currentMode === 'business') {
                            try {
                                const competition = await fetchCompetition(wash.lat, wash.lng);
                                showCompetitionInSidebar(wash, competition);
                            } catch (err) {
                                console.error('Competition fetch error:', err);
                                // Show error message in competition panel
                                const panel = document.getElementById("competition-panel");
                                const content = document.getElementById("competition-content");
                                if (content && currentMode === 'business') {
                                    content.innerHTML = `
                                        <div class="competition-advisory">
                                            <div class="competition-header">
                                                <h6 class="competition-location">${wash.name}</h6>
                                            </div>
                                            <div class="competition-recommendation medium">
                                                <div class="competition-icon">
                                                    <i class="fas fa-exclamation-triangle"></i>
                                                </div>
                                                <h6 class="competition-title">Analysis Unavailable</h6>
                                                <p class="competition-message">
                                                    Unable to fetch competition data. Please try again later.
                                                </p>
                                            </div>
                                        </div>
                                    `;
                                    if (panel) panel.style.display = 'block';
                                }
                            }
                        }
                    });
                }
            }).addTo(map);
            showMapLoading(false);
            showAlert('success', `Loaded ${data.features.length} car washes from database!`);
        })
        .catch(error => {
            showMapLoading(false);
            showAlert('danger', 'Failed to load car wash data from database.');
            console.error(error);
        });
}

/**
 * Add a sample location marker
 */
function addSampleMarker(location) {
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: #0d6efd;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const marker = L.marker([location.lat, location.lng], { icon }).addTo(map);

    const popupContent = `
        <div class="custom-popup">
            <h6>${location.name}</h6>
            <div class="coordinates">${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}</div>
            <small class="text-muted">Sample location from database</small>
        </div>
    `;

    marker.bindPopup(popupContent);
    marker.location = location;

    // Add bounce animation
    setTimeout(() => {
        const element = marker.getElement();
        if (element) {
            element.classList.add('bounce-in');
        }
    }, 100);
}

/**
 * Add user-created location
 */
function addUserLocation() {
    const name = document.getElementById('location-name').value.trim();
    const lat = parseFloat(document.getElementById('location-lat').value);
    const lng = parseFloat(document.getElementById('location-lng').value);

    // Validation
    if (!name) {
        showAlert('warning', 'Please enter a location name');
        return;
    }

    if (isNaN(lat) || isNaN(lng)) {
        showAlert('warning', 'Please enter valid coordinates');
        return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showAlert('danger', 'Coordinates are out of valid range');
        return;
    }

    // Create user marker with different styling
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: #198754;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
    });

    const marker = L.marker([lat, lng], { icon }).addTo(map);

    const popupContent = `
        <div class="custom-popup">
            <h6><i class="fas fa-user-plus me-2 text-success"></i>${name}</h6>
            <div class="coordinates">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
            <small class="text-muted">Added by user</small>
            <hr>
            <button class="btn btn-danger btn-sm" onclick="removeUserMarker(${userMarkers.length})">
                <i class="fas fa-trash me-1"></i>Remove
            </button>
        </div>
    `;

    marker.bindPopup(popupContent);
    marker.userIndex = userMarkers.length;
    userMarkers.push(marker);

    // Clear form
    document.getElementById('quick-add-form').reset();

    // Focus on new marker
    map.setView([lat, lng], Math.max(map.getZoom(), 10));
    marker.openPopup();

    showAlert('success', `Added "${name}" to the map!`);
}

/**
 * Remove user marker
 */
function removeUserMarker(index) {
    if (userMarkers[index]) {
        map.removeLayer(userMarkers[index]);
        userMarkers[index] = null;
        showAlert('info', 'Location removed from map');
    }
}

/**
 * Show temporary marker for coordinate selection
 */
function showTemporaryMarker(latlng) {
    // Remove existing temporary marker if any
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
        window.tempMarker = null;
    }

    const tempIcon = L.divIcon({
        className: 'temp-marker',
        html: `<div style="
            background-color: #ffc107;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            animation: pulse 1s infinite;
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    window.tempMarker = L.marker(latlng, { icon: tempIcon }).addTo(map);

    // Auto-remove after 3 seconds
    // setTimeout(() => {
    //     if (window.tempMarker) {
    //         map.removeLayer(window.tempMarker);
    //         window.tempMarker = null;
    //     }
    // }, 3000);
}

/**
 * Toggle sample locations visibility
 */
function toggleSampleLocations(show) {
    map.eachLayer(function (layer) {
        if (layer.location && !layer.userIndex !== undefined) {
            if (show) {
                layer.addTo(map);
            } else {
                map.removeLayer(layer);
            }
        }
    });
}

/**
 * Toggle user locations visibility
 */
function toggleUserLocations(show) {
    userMarkers.forEach(marker => {
        if (marker) {
            if (show) {
                marker.addTo(map);
            } else {
                map.removeLayer(marker);
            }
        }
    });
}

/**
 * Reset map to default view
 */
function resetMapView() {
    map.setView([54.0, 15.0], 4);
    document.getElementById('map-coordinates').textContent = 'Click on map to see coordinates';
    showAlert('info', 'Map view reset to default');
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
 * Show Bootstrap alert
 */
function showAlert(type, message) {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alert.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(alert);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 150);
        }
    }, 5000);
}

/**
 * Load and display county boundaries
 */
function loadCountyBoundaries() {
    showMapLoading(true);
    fetch('/counties.geojson')
        .then(response => response.json())
        .then(data => {
            // fetch wash counts and use heatmap colors
            fetch('/api/county_wash_counts/', {
                credentials: 'include'
            })
                .then(response => response.json())
                .then(countData => {
                    console.log('County wash counts response:', countData);
                    const counts = countData.counts;
                    let min = Infinity, max = -Infinity;
                    const countMap = {};

                    counts.forEach(c => {
                        if (c.name) {
                            // Store with both "County X" and "X" formats
                            countMap[c.name] = c.wash_count;
                            const nameWithoutCounty = c.name.replace('County ', '');
                            countMap[nameWithoutCounty] = c.wash_count;
                        }
                        if (c.wash_count < min) min = c.wash_count;
                        if (c.wash_count > max) max = c.wash_count;
                    });
                    if (countyLayer) map.removeLayer(countyLayer);
                    countyLayer = L.geoJSON(data, {
                        style: function (feature) {
                            const name = feature.properties.name_en;
                            const count = countMap[name] || 0;
                            let ratio = (count - min) / (max - min || 1);
                            let r = Math.round(255 * ratio);
                            let g = Math.round(180 * (1 - ratio));
                            let color = `rgb(${r},${g},60)`;
                            return {
                                color: color,
                                weight: 2,
                                fillOpacity: 0.6,
                                fillColor: color
                            };
                        },
                        onEachFeature: function (feature, layer) {
                            const props = feature.properties;
                            const name = props.name_en;
                            const count = countMap[name] || 0;
                            let popupContent = `<b>County</b><br>`;
                            popupContent += `<b>English Name:</b> ${name}<br>`;
                            popupContent += `<b>Car Washes:</b> ${count}<br>`;
                            if (props.name_ga) popupContent += `<b>Irish Name:</b> ${props.name_ga}<br>`;
                            if (props.alt_name) popupContent += `<b>Alt Name:</b> ${props.alt_name}<br>`;
                            if (props.area) popupContent += `<b>Area:</b> ${props.area}<br>`;
                            // layer.bindPopup(popupContent);
                            // Add click event for business mode recommendation
                            layer.on('click', handleCountyClick);
                        }
                    });
                    countyLayer.addTo(map);
                    showMapLoading(false);
                })
                .catch(error => {
                    showMapLoading(false);
                    showAlert('danger', 'Failed to fetch Counties Wash Numbers.');
                    console.error(error);
                });
        })
        .catch(error => {
            showMapLoading(false);
            showAlert('danger', 'Failed to load county boundaries.');
            console.error(error);
        });
}

function updateLayersForMode() {
    if (countyLayer) {
        if (currentMode === 'business') {
            countyLayer.addTo(map);
        } else {
            map.removeLayer(countyLayer);
        }
    }
    // Optionally hide/show other layers or UI elements
}

/**
 * Show Nearby Car Washes List in floating card
 */
function showNearbyCarwashesList(carwashes) {
    const card = document.getElementById('nearby-carwashes-floating');
    const list = document.getElementById('nearby-carwashes-list');
    if (!card || !list) return;
    // Only show in user mode
    if (currentMode !== 'user') {
        card.style.display = 'none';
        return;
    }
    list.innerHTML = '';
    if (!carwashes || carwashes.length === 0) {
        list.innerHTML = '<li class="list-group-item text-muted bg-dark-theme">No car washes found nearby.</li>';
        card.style.display = 'block';
        return;
    }
    carwashes.forEach((cw, idx) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center bg-dark-theme';
        li.innerHTML = `
            <div>
                <b style="color:var(--primary-color);">${cw.name || 'Unnamed'}</b><br>
                <small style="color:var(--text-muted);">${cw.address}</small>
            </div>
            <span class="badge badge-dark-theme">${cw.distance_km.toFixed(2)} km</span>
        `;
        li.style.cursor = 'pointer';
        li.onclick = function () {
            map.setView([cw.lat, cw.lng], Math.max(map.getZoom(), 13));
            // Optionally highlight marker or show popup
        };
        list.appendChild(li);
    });
    card.style.display = 'block';
}

// Show recommended car wash location for a county
function showRecommendedCarwashLocation(countyId) {
    let minDistanceKm = 5;
    let maxSettlementDistanceKm = 10;
    if (currentMode === 'business') {
        minDistanceKm = parseFloat(document.getElementById('min-distance-km').value) || 5;
        maxSettlementDistanceKm = parseFloat(document.getElementById('max-settlement-distance-km').value) || 10;
    }
    fetch(`/api/recommend_county/?county_id=${countyId}&min_distance_km=${minDistanceKm}&max_settlement_distance_km=${maxSettlementDistanceKm}`, {
        credentials: 'include'
    }).then(response => response.json())
        .then(data => {
            if (data.recommendations && data.recommendations.length > 0) {
                const rec = data.recommendations[0];
                lastRecommendation = {
                    lat: rec.lat,
                    lng: rec.lng,
                    source_type: 'county',
                    reason: `Recommended site in ${rec.name || 'selected county'}`
                };
                // Remove previous recommended marker if exists
                if (window.recommendedCarwashMarker) {
                    map.removeLayer(window.recommendedCarwashMarker);
                }
                // Add marker for recommended location
                const icon = L.divIcon({
                    className: 'recommended-marker',
                    html: `<div style="background-color: #ff5722; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>`,
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                });
                window.recommendedCarwashMarker = L.marker([rec.lat, rec.lng], { icon }).addTo(map);
                window.recommendedCarwashMarker.bindPopup(
                    `<b>Recommended Car Wash Site</b><br>` +
                    `Settlement: ${rec.name || 'Unknown'}<br>` +
                    `Population: ${rec.population || 'Unknown'}<br>` +
                    `Distance to nearest car wash: ${rec.min_distance_to_carwash_km ? rec.min_distance_to_carwash_km.toFixed(2) : 'N/A'} km` +
                    `<br>Nearby settlements: ${rec.nearby_settlements}` +
                    `<hr>
                    <button class="btn btn-sm btn-success w-100" onclick="saveRecommendation()">
                        <i class="fas fa-bookmark me-1"></i> Save Recommendation
                    </button>`
                ).openPopup();
                map.setView([rec.lat, rec.lng], Math.max(map.getZoom(), 11));
            } else {
                showAlert('info', 'No suitable recommended site found in this county.');
            }
        })
        .catch(error => {
            showAlert('danger', 'Failed to fetch recommended car wash location.');
            console.error(error);
        });
}

document.getElementById('user-mode-btn').addEventListener('click', function () {
    setMode('user');
});
document.getElementById('business-mode-btn').addEventListener('click', function () {
    if (!window.USER_LOGGED_IN) {
        showAlert('warning', 'You must be logged in to access Business Mode.');
        return;
    }
    setMode('business');
});


// --- Business Recommendation Mode Toggle Logic ---
let businessRecommendMode = 'county'; // 'county', 'circle', or 'polygon'

document.getElementById('county-recommend-mode-btn').addEventListener('click', function () {
    setBusinessRecommendMode('county');
});
document.getElementById('circle-recommend-mode-btn').addEventListener('click', function () {
    setBusinessRecommendMode('circle');
});
document.getElementById('polygon-recommend-mode-btn').addEventListener('click', function () {
    setBusinessRecommendMode('polygon');
});


function setBusinessRecommendMode(mode) {
    businessRecommendMode = mode;
    document.getElementById('county-recommend-mode-btn').classList.toggle('active', mode === 'county');
    document.getElementById('circle-recommend-mode-btn').classList.toggle('active', mode === 'circle');
    document.getElementById('polygon-recommend-mode-btn').classList.toggle('active', mode === 'polygon');

    // Show/hide parameters based on mode
    document.getElementById('circle-recommend-params').style.display = (mode === 'circle') ? '' : 'none';

    const polygonControls = document.getElementById('polygon-recommend-controls');
    if (polygonControls) {
        polygonControls.style.display = (mode === 'polygon') ? '' : 'none';
    }

    // Remove circle if toggling away from circle mode
    if (mode !== 'circle' && window.businessCircle) {
        map.removeLayer(window.businessCircle);
        window.businessCircle = null;
    }
    // Disable polygon mode if not selected
    if (mode !== 'polygon') {
        polygonMode = false;
        clearPolygonDrawing();
    } else {
        polygonMode = true;
    }

    if (countyLayer) {
        countyLayer.eachLayer(layer => {
            if (mode === 'county') {
                layer.options.interactive = true;
                layer.setStyle({ interactive: true });
                layer.on('click', handleCountyClick);
            } else {
                layer.options.interactive = false;
                layer.setStyle({ interactive: false });
                layer.off('click', handleCountyClick);
            }
        });
    }
}

function handleCountyClick(e) {
    if (currentMode === 'business' && businessRecommendMode === 'county') {
        const feature = e.target.feature;
        const id = feature.id || feature.properties.id || feature.properties.osm_id;
        showRecommendedCarwashLocation(id);
    } else {
        console.log('County click ignored - not in business county recommend mode');
    }
}


function setMode(mode) {
    currentMode = mode;
    document.getElementById('user-mode-btn').classList.toggle('active', mode === 'user');
    document.getElementById('business-mode-btn').classList.toggle('active', mode === 'business');

    // Show/hide business recommendation toolbar
    const toolbar = document.getElementById('business-recommendation-toolbar');
    if (toolbar) toolbar.style.display = (mode === 'business') ? '' : 'none';

    // Remove circle if switching away from business circle mode
    if ((mode !== 'business' || businessRecommendMode !== 'circle') && window.businessCircle) {
        map.removeLayer(window.businessCircle);
        window.businessCircle = null;
    }
    // Load county boundaries if switching to business mode and not already loaded
    if (mode === 'business' && !countyLayer) {
        loadCountyBoundaries();
    }
    updateLayersForMode();
    const businessParamsCard = document.getElementById('business-params-card');
    if (businessParamsCard) {
        businessParamsCard.style.display = (mode === 'business') ? '' : 'none';
    }

    // Hide nearby car washes floating card if not in user mode
    const nearbyCard = document.getElementById('nearby-carwashes-floating');
    if (nearbyCard) nearbyCard.style.display = (mode === 'user') ? '' : 'none';
    if (nearbyCard && mode !== 'user') {
        const list = document.getElementById('nearby-carwashes-list');
        if (list) list.innerHTML = '';
    }

    // Show/hide saved recommendations floating card
    const savedCard = document.getElementById('saved-recommendations-floating');
    if (savedCard) savedCard.style.display = (mode === 'business') ? 'block' : 'none';
    
    // Show/hide weather panel based on mode
    const weatherPanel = document.getElementById('weather-panel');
    if (weatherPanel) {
        if (mode === 'user') {
            // Only show if there's actual weather content (not the default message)
            const weatherContent = document.getElementById('weather-content');
            if (weatherContent && !weatherContent.querySelector('.text-muted')) {
                weatherPanel.style.display = 'block';
            }
        } else {
            weatherPanel.style.display = 'none';
        }
    }
    
    // Show/hide competition panel based on mode
    const competitionPanel = document.getElementById('competition-panel');
    if (competitionPanel) {
        if (mode === 'business') {
            // Only show if there's actual competition content (not the default message)
            const competitionContent = document.getElementById('competition-content');
            if (competitionContent && !competitionContent.querySelector('.text-muted')) {
                competitionPanel.style.display = 'block';
            }
        } else {
            competitionPanel.style.display = 'none';
        }
    }

    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
        window.tempMarker = null;
    }
    if (window.nearestCarwashMarker) {
        map.removeLayer(window.nearestCarwashMarker);
        window.nearestCarwashMarker = null;
    }
    // Reset business recommend mode to county when switching modes
    if (mode === 'business') {
        setBusinessRecommendMode(businessRecommendMode);
        loadSavedRecommendations();
    }

    // Update instructions
    updateInstructions(mode);
    
    // Reset weather panel content when switching modes
    if (mode === 'business') {
        const weatherContent = document.getElementById('weather-content');
        if (weatherContent) {
            weatherContent.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-info-circle fa-2x mb-2"></i>
                    <p class="mb-0 small">Click on a car wash to see weather advice</p>
                </div>
            `;
        }
    }
    
    // Reset competition panel content when switching modes
    if (mode === 'user') {
        const competitionContent = document.getElementById('competition-content');
        if (competitionContent) {
            competitionContent.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="fas fa-info-circle fa-2x mb-2"></i>
                    <p class="mb-0 small">Click on a car wash to see competition density</p>
                </div>
            `;
        }
    }
}

// --- Instructions UI Logic ---
function updateInstructions(mode) {
    const userInstructions = document.getElementById('instructions-user-mode');
    const businessInstructions = document.getElementById('instructions-business-mode');
    if (userInstructions && businessInstructions) {
        userInstructions.style.display = (mode === 'user') ? '' : 'none';
        businessInstructions.style.display = (mode === 'business') ? '' : 'none';
    }
}

function updateRecommendationInstructions(mode) {
    const countyInstructions = document.getElementById('county-recommendation-instructions');
    const circleInstructions = document.getElementById('circle-recommendation-instructions');
    const polygonInstructions = document.getElementById('polygon-recommendation-instructions');
    if (countyInstructions && circleInstructions && polygonInstructions) {
        countyInstructions.style.display = (mode === 'county') ? '' : 'none';
        circleInstructions.style.display = (mode === 'circle') ? '' : 'none';
        polygonInstructions.style.display = (mode === 'polygon') ? '' : 'none';
    }
    if (mode === 'polygon') {
        polygonMode = true;
        polygonPoints = [];
        clearPolygonDrawing();
        document.getElementById('finish-polygon-btn').disabled = true;
    } else {
        polygonMode = false;
        clearPolygonDrawing();
    }
}

// CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.7; }
        100% { transform: scale(1); opacity: 1; }
    }
`;
document.head.appendChild(style);

let polygonMode = false;
let polygonPoints = [];
let polygonMarkers = [];
let polygonLayer = null;

function addPolygonPoint(latlng) {
    polygonPoints.push([latlng.lng, latlng.lat]);

    // Place a small marker
    const m = L.circleMarker(latlng, {
        radius: 4,
        color: "red",
        fillColor: "red",
        fillOpacity: 1
    }).addTo(map);

    polygonMarkers.push(m);

    if (polygonPoints.length >= 3) {
        document.getElementById('finish-polygon-btn').disabled = false;
    }
}

function clearPolygonDrawing() {
    polygonPoints = [];

    polygonMarkers.forEach(m => map.removeLayer(m));
    polygonMarkers = [];

    if (polygonLayer) {
        map.removeLayer(polygonLayer);
        polygonLayer = null;
    }
}
document.getElementById("clear-polygon-btn").onclick = clearPolygonDrawing;
document.getElementById("finish-polygon-btn").onclick = function () {
    if (polygonPoints.length < 3) return;

    // Create polygon in Leaflet
    polygonLayer = L.polygon(polygonPoints.map(p => [p[1], p[0]]), {
        color: "blue",
        fillOpacity: 0.1
    }).addTo(map);

    // Convert to GeoJSON
    const geojson = polygonLayer.toGeoJSON();

    sendPolygonToServer(geojson);  // Call backend

    map.fitBounds(polygonLayer.getBounds());
};

function sendPolygonToServer(geojson) {
    const minDistanceKm = parseFloat(document.getElementById('min-distance-km').value) || 5;

    geojson.min_distance_km = minDistanceKm;

    fetch("/api/recommend_polygon/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken")
        },
        credentials: "include",
        body: JSON.stringify(geojson)
    })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                showAlert('danger', data.error);
                return;
            }

            lastRecommendation = {
                lat: data.lat,
                lng: data.lng,
                source_type: 'polygon',
                reason: data.reason || 'Recommended site within selected polygon'
            };

            // Place recommended marker
            // Clear previous recommended marker if any
            if (window.recommendedCarwashMarker) {
                map.removeLayer(window.recommendedCarwashMarker);
            }

            // Custom icon (same as county/circle)
            const icon = L.divIcon({
                className: 'recommended-marker',
                html: `
                <div style="
                    background-color: #ff5722;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                "></div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11]
            });

            // Add marker
            window.recommendedCarwashMarker = L.marker([data.lat, data.lng], { icon }).addTo(map);

            // Build popup
            const popupHtml = `
                <b>Recommended Car Wash Site</b><br>
                Settlement: ${data.name || 'Unknown'}<br>
                Population: ${data.population ?? 'Unknown'}<br>
                Distance to nearest car wash: ${data.min_distance_to_carwash_km
                    ? data.min_distance_to_carwash_km.toFixed(2) + ' km'
                    : 'N/A'
                }<br>
                Nearby settlements: ${data.nearby_settlements ?? 'N/A'}<br>
                Reason: ${data.reason}
                <hr>
                <button class="btn btn-sm btn-success w-100" onclick="saveRecommendation()">
                    <i class="fas fa-bookmark me-1"></i> Save Recommendation
                </button>   
            `;

            // Display popup
            window.recommendedCarwashMarker.bindPopup(popupHtml).openPopup();

            // Zoom to the recommended location
            map.setView([data.lat, data.lng], Math.max(map.getZoom(), 11));
        })
        .catch(err => showAlert('danger', 'Polygon recommendation failed'));
}

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.slice(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function loadSavedRecommendations() {
    fetch('/api/recommendations/', {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            savedRecommendations = data.recommendations || [];
            renderSavedRecommendations();
        })
        .catch(err => {
            console.error(err);
            showAlert('danger', 'Failed to load saved recommendations.');
        });
}

function renderSavedRecommendations() {
    const card = document.getElementById('saved-recommendations-floating');
    const list = document.getElementById('saved-recommendations-list');

    if (!card || !list) return;

    // Only visible in business mode + logged in
    if (currentMode !== 'business' || !window.USER_LOGGED_IN) {
        card.style.display = 'none';
        return;
    }

    list.innerHTML = '';

    if (savedRecommendations.length === 0) {
        list.innerHTML = `
            <li class="list-group-item text-muted bg-dark-theme">
                No saved recommendations yet.
            </li>`;
        card.style.display = 'block';
        return;
    }

    savedRecommendations.forEach((rec, idx) => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action bg-dark-theme';
        li.style.cursor = 'pointer';

        li.innerHTML = `
            <div>
                <strong style="color:var(--success-color);">${rec.source_type.toUpperCase()}</strong><br>
                <small class="text-muted">
                    ${new Date(rec.created_at).toLocaleString()}
                </small>
            </div>
        `;

        li.onclick = () => showSavedRecommendationOnMap(rec);

        list.appendChild(li);
    });

    card.style.display = 'block';
}

function showSavedRecommendationOnMap(rec) {
    // Remove previous recommended marker
    if (window.recommendedCarwashMarker) {
        map.removeLayer(window.recommendedCarwashMarker);
    }

    // Same icon used for county/circle/polygon recommendations
    const icon = L.divIcon({
        className: 'recommended-marker',
        html: `<div style="
            background-color: #ff5722;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        "></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    window.recommendedCarwashMarker = L.marker(
        [rec.lat, rec.lng],
        { icon }
    ).addTo(map);

    window.recommendedCarwashMarker.bindPopup(`
        <b>Saved Recommendation</b><br>
        Source: ${rec.source_type}<br>
        ${rec.reason || ''}
    `).openPopup();

    map.setView([rec.lat, rec.lng], Math.max(map.getZoom(), 11));
}

function saveRecommendation() {
    if (!lastRecommendation) {
        showAlert('warning', 'No recommendation to save.');
        return;
    }

    fetch('/api/recommendations/save/', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify(lastRecommendation)
    })
        .then(res => {
            if (!res.ok) throw new Error('Save failed');
            return res.json();
        })
        .then(() => {
            showAlert('success', 'Recommendation saved!');
            loadSavedRecommendations();
        })
        .catch(err => {
            console.error(err);
            showAlert('danger', 'Failed to save recommendation.');
        });
}


async function fetchWeather(lat, lon) {
    const res = await fetch(`/api/weather/?lat=${lat}&lon=${lon}`);

    if (!res.ok) {
        throw new Error("Weather API failed");
    }

    return await res.json();
}


function showWeatherInSidebar(wash, weather) {
    const panel = document.getElementById("weather-panel");
    const content = document.getElementById("weather-content");
    
    if (!panel || !content) return;
    
    // Determine recommendation status
    let recommendClass = 'neutral';
    let recommendIcon = 'fa-cloud';
    let recommendTitle = 'Check Weather Conditions';
    let recommendMessage = 'Current weather conditions may affect wash quality.';
    
    if (weather.good_for_wash) {
        recommendClass = 'good';
        recommendIcon = 'fa-check-circle';
        recommendTitle = 'Great Time to Wash!';
        recommendMessage = 'Clear skies ahead. Perfect conditions for a sparkling clean car!';
    } else {
        // Check if it's actually raining
        const weatherDesc = weather.description.toLowerCase();
        if (weatherDesc.includes('rain') || weatherDesc.includes('drizzle') || weatherDesc.includes('shower')) {
            recommendClass = 'bad';
            recommendIcon = 'fa-times-circle';
            recommendTitle = 'Not Recommended';
            recommendMessage = 'Rain detected. Your car will get dirty again soon. Wait for better weather!';
        } else if (weatherDesc.includes('cloud') || weatherDesc.includes('overcast')) {
            recommendClass = 'neutral';
            recommendIcon = 'fa-cloud';
            recommendTitle = 'Okay to Wash';
            recommendMessage = 'Cloudy but dry. Decent time for a wash, though sunshine would be better.';
        }
    }
    
    content.innerHTML = `
        <div class="weather-advisory">
            <div class="weather-header">
                <h6 class="weather-location">${wash.name || 'Car Wash'}</h6>
                <div class="weather-icon-display">
                    <img src="https://openweathermap.org/img/wn/${weather.icon}@2x.png" alt="Weather icon">
                </div>
            </div>
            
            <div class="weather-details">
                <div class="weather-stat">
                    <span class="weather-stat-label">Temperature</span>
                    <span class="weather-stat-value">${weather.temp}°C</span>
                </div>
                <div class="weather-stat">
                    <span class="weather-stat-label">Conditions</span>
                    <span class="weather-stat-value" style="font-size: 0.9rem; text-transform: capitalize;">${weather.description}</span>
                </div>
            </div>
            
            <div class="wash-recommendation ${recommendClass}">
                <div class="recommendation-icon">
                    <i class="fas ${recommendIcon}"></i>
                </div>
                <div class="recommendation-title">${recommendTitle}</div>
                <p class="recommendation-message">${recommendMessage}</p>
            </div>
        </div>
    `;
    
    // Show panel in user mode only
    if (currentMode === 'user') {
        panel.style.display = 'block';
    }
}

async function fetchCompetition(lat, lon, radius = 3) {
    const res = await fetch(`/api/competition/?lat=${lat}&lon=${lon}&radius=${radius}`);
    if (!res.ok) throw new Error("Competition fetch failed");
    return await res.json();
}

function showCompetitionInSidebar(wash, data) {
    const panel = document.getElementById("competition-panel");
    const content = document.getElementById("competition-content");
    
    if (!content || currentMode !== 'business') return;
    
    // Determine saturation level and corresponding recommendation
    let saturationClass = 'medium';
    let saturationIcon = 'fa-circle';
    let saturationTitle = 'Moderate Competition';
    let saturationMessage = 'Caution advised - moderate market presence in this area.';
    
    if (data.saturation_level === 'Low') {
        saturationClass = 'low';
        saturationIcon = 'fa-check-circle';
        saturationTitle = 'Low Competition';
        saturationMessage = 'Excellent opportunity - this area has low market saturation and good potential for business growth.';
    } else if (data.saturation_level === 'High') {
        saturationClass = 'high';
        saturationIcon = 'fa-times-circle';
        saturationTitle = 'High Competition';
        saturationMessage = 'Not recommended - this area is saturated with competitors. Consider alternative locations.';
    }
    
    content.innerHTML = `
        <div class="competition-advisory">
            <div class="competition-header">
                <h6 class="competition-location">${wash.name}</h6>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                    <i class="fas fa-crosshairs me-1"></i>${data.radius_km} km radius
                </div>
            </div>
            
            <div class="competition-stats">
                <div class="competition-stat-row">
                    <span class="competition-stat-label">
                        <i class="fas fa-building me-1"></i>Competitors Found
                    </span>
                    <span class="competition-stat-value">${data.competitor_count}</span>
                </div>
                <div class="competition-stat-row">
                    <span class="competition-stat-label">
                        <i class="fas fa-chart-pie me-1"></i>Market Density
                    </span>
                    <span class="competition-stat-value">${data.saturation_level}</span>
                </div>
            </div>
            
            <div class="competition-recommendation ${saturationClass}">
                <div class="competition-icon">
                    <i class="fas ${saturationIcon}"></i>
                </div>
                <h6 class="competition-title">${saturationTitle}</h6>
                <p class="competition-message">${saturationMessage}</p>
            </div>
        </div>
    `;
    
    panel.style.display = 'block';
}
