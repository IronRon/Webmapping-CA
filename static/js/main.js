// Global variables
let map;
let userMarkers = [];

// Initialize application when page loads
document.addEventListener('DOMContentLoaded', function () {
    console.log('🗺️ Initializing Hello Map application...');
    initializeMap();
    setupEventListeners();
    loadSampleData();
    loadCountyBoundaries();
});

/**
 * Initialize the Leaflet map
 */
function initializeMap() {
    try {
        // Create map instance centered on Europe
        map = L.map('map').setView([54.0, 15.0], 4);

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

        // Update coordinate display
        document.getElementById('map-coordinates').textContent =
            `Coordinates: ${lat}, ${lng}`;

        // Fill form inputs
        document.getElementById('location-lat').value = lat;
        document.getElementById('location-lng').value = lng;

        // Show temporary marker
        showTemporaryMarker(e.latlng);
    });

    // Quick add form submission
    document.getElementById('quick-add-form').addEventListener('submit', function (e) {
        e.preventDefault();
        addUserLocation();
    });

    // Layer toggle controls
    document.getElementById('locations-layer').addEventListener('change', function (e) {
        toggleSampleLocations(e.target.checked);
    });

    document.getElementById('user-locations').addEventListener('change', function (e) {
        toggleUserLocations(e.target.checked);
    });

    // Reset view button
    document.getElementById('reset-view').addEventListener('click', function () {
        resetMapView();
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

    window.tempMarker = L.marker(latlng, { icon }).addTo(map);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
            window.tempMarker = null;
        }
    }, 3000);
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
    fetch('/counties.geojson')
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                style: {
                    color: '#198754',
                    weight: 2,
                    fillOpacity: 0.1
                },
                onEachFeature: function (feature, layer) {
                    const props = feature.properties;
                    let popupContent = `<b>County</b><br>`;
                    if (props.name_en) popupContent += `<b>English Name:</b> ${props.name_en}<br>`;
                    if (props.name_ga) popupContent += `<b>Irish Name:</b> ${props.name_ga}<br>`;
                    if (props.alt_name) popupContent += `<b>Alt Name:</b> ${props.alt_name}<br>`;
                    if (props.area) popupContent += `<b>Area:</b> ${props.area}<br>`;
                    layer.bindPopup(popupContent);
                }
            }).addTo(map);
        })
        .catch(error => {
            showAlert('danger', 'Failed to load county boundaries.');
            console.error(error);
        });
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
