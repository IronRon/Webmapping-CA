
# CleanMyRide: Location-Based Car Wash Finder & Business Analysis

CleanMyRide is a location-based web application that helps users find nearby car washes and assists business owners in identifying the best areas to open new ones. The project demonstrates practical use of spatial data analysis by combining geospatial queries, interactive mapping, and real-world business logic.

## Features
- Interactive map visualization with Leaflet.js
- Car wash locations imported from OpenStreetMap for Ireland and the United States
- Irish county boundaries for spatial analysis
- PostgreSQL/PostGIS spatial database integration
- Django backend with GeoDjango models and RESTful GeoJSON endpoints
- Advanced spatial queries: nearest car wash, radius search, and county-level aggregation
- County heatmap visualization: counties are always color-coded by car wash density using a green-to-red scale
- Business analytics mode always displays county heatmap for market saturation and opportunities
- Improved marker logic: only one marker shown for user actions, clean marker management
- **Interactive UI Improvements:**
   - Sidebar parameters for business analytics, including min/max distance and circle radius
   - Only one temporary marker and one recommended marker shown at a time
   - Map click logic adapts to current mode (user/business/circle)
   - Circle color is orange for clear visibility
   - All new features are fully integrated with the existing analytics and visualization tools
- Two main modes: User Mode and Business Mode
   - **User Mode:**
      - View all car washes in Ireland
      - Search for nearest car wash
      - Interactive markers with details (name, address, service type, operating hours)
      - See a list of nearby car washes after clicking on the map
   - **Business Mode:**
      - Analytical view of car wash coverage by county (heatmap)
      - Counties always color-coded by car wash count (spatial aggregation)
      - Clickable counties for details: number of car washes, names, and more
      - **County Recommendation:**
         - Default mode for business analytics
         - Click a county to view car wash statistics and get a recommended site for a new car wash based on county data
         - Visual feedback with county heatmap and recommended marker
      - **Circle Recommendation:**
         - Toggle to circle mode to select a custom area for analysis
         - Click the map to set the center and radius, and get a recommended site for a new car wash
         - Visual feedback with a drawn circle and recommended marker

## Technical Stack
- Python 3.x, Django 4.x, GeoDjango
- PostgreSQL with PostGIS extension
- Leaflet.js for frontend mapping
- GDAL/ogr2ogr for spatial data import
- REST API endpoints for GeoJSON data

## Setup
1. Clone the repository and navigate to the project folder.
2. Create and activate a Python virtual environment (e.g., `ca_env`).
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Configure your database settings in `ca_project/settings.py` for PostgreSQL/PostGIS.
5. Run migrations:
   ```
   python manage.py makemigrations
   python manage.py migrate
   ```
6. Import car wash and county data using GDAL/ogr2ogr (see documentation for commands).
7. Create a superuser:
   ```
   python manage.py createsuperuser
   ```
8. Start the development server:
   ```
   python manage.py runserver
   ```

## Usage
- Access the map at the root URL to explore car washes and county boundaries.
- Switch between User Mode and Business Mode for different analysis tools.
- In Business Mode, view the county heatmap showing car wash density and click counties for details.
- In User Mode, click the map to find the nearest car wash and see a list of nearby car washes.
- In Business County Mode, click any county to view car wash statistics and get a recommended location for a new car wash based on county population and density.
- In Business Circle Mode, toggle to circle recommendation, click the map to set the center, adjust the radius, and view recommended locations for new car washes within the selected area.
- The map and sidebar update interactively based on the selected mode and parameters.
- **Recommendation Algorithm:**
   - For both county and circle modes, the backend uses population points (settlements) as candidate locations for new car washes.
   - For each candidate, it calculates the distance to the nearest existing car wash and the number of nearby settlements.
   - Candidates are filtered to ensure a minimum distance from existing car washes and proximity to settlements.
   - The best locations are ranked by distance from the nearest car wash (favoring underserved areas) and by population (favoring larger settlements).
   - The top recommended sites are returned to the frontend and visualized on the map.
   - All spatial queries use PostGIS and GeoDjango for efficient geospatial analysis.

## Notes
- The main app is `testapp`, which contains spatial models and views.
- County heatmap and business analytics features use spatial aggregation (point-in-polygon queries) for accurate density analysis.
- Marker logic and UI have been improved for clarity and usability.
- More features and documentation will be added as the project develops.

---
*Created for Advanced Web Mapping CA, 2025. Project: CleanMyRide*
