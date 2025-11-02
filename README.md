
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
- Two main modes: User Mode and Business Mode
   - **User Mode:**
      - View all car washes in Ireland and the US
      - Search for nearest car wash or within a chosen radius
      - Interactive markers with details (name, address, service type, operating hours)
      - See a list of nearby car washes after clicking on the map
   - **Business Mode:**
      - Analytical view of car wash coverage by county (heatmap)
      - Counties always color-coded by car wash count (spatial aggregation)
      - Clickable counties for details: number of car washes, names, and more
      - "Site Evaluation" tool: propose new locations, get feedback on suitability (future)

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
- Use the Site Evaluation tool in Business Mode to assess new locations (future feature).

## Notes
- The main app is `testapp`, which contains spatial models and views.
- County heatmap and business analytics features use spatial aggregation (point-in-polygon queries) for accurate density analysis.
- Marker logic and UI have been improved for clarity and usability.
- More features and documentation will be added as the project develops.

---
*Created for Advanced Web Mapping CA, 2025. Project: CleanMyRide*
