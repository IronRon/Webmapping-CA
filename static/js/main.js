// Global variables
let map;
let userMarkers = [];
let currentMode = 'user'; // 'user' or 'business'
let countyLayer = null;

// Initialize application when page loads
document.addEventListener('DOMContentLoaded', function () {
    console.log('🗺️ Initializing Hello Map application...');
    if (!window.USER_LOGGED_IN) {
        document.getElementById('business-mode-btn').disabled = true;
    }
    initializeMap();
    setupEventListeners();
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
                            `<br>Nearby settlements: ${rec.nearby_settlements}`
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
                        className: 'custom-marker',
                        html: `<div style=\"background-color: #0d6efd; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);\"></div>`,
                        iconSize: [18, 18],
                        iconAnchor: [9, 9]
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
                    const counts = countData.counts;
                    let min = Infinity, max = -Infinity;
                    const countMap = {};
                    counts.forEach(c => {
                        countMap[c.name_en] = c.wash_count;
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
 * Show Nearby Car Washes List in sidebar
 */
function showNearbyCarwashesList(carwashes) {
    const card = document.getElementById('nearby-carwashes-card');
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
        card.style.display = '';
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
    card.style.display = '';
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
                    `<br>Nearby settlements: ${rec.nearby_settlements}`
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
    document.getElementById('circle-recommend-params').style.display = (mode === 'circle') ? '' : 'none';

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
    // Hide nearby car washes list if not in user mode
    const card = document.getElementById('nearby-carwashes-card');
    if (card) card.style.display = (mode === 'user') ? '' : 'none';
    if (card && mode !== 'user') {
        const list = document.getElementById('nearby-carwashes-list');
        if (list) list.innerHTML = '';
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
