# CleanMyRide Architecture Diagram

Below is a textual architecture diagram showing the main components and their interactions.

```
+-------------------+
|   User Browser    |
| (Leaflet.js Map)  |
+-------------------+
          |
          v
+-------------------+
|   Django Views    |
|  (REST Endpoints) |
+-------------------+
          |
          v
+-------------------+
|   Django Models   |
|  (GeoDjango ORM)  |
+-------------------+
          |
          v
+-------------------+
| PostgreSQL +      |
|   PostGIS         |
| (Spatial DB)      |
+-------------------+
          ^
          |
+-------------------+
|   GDAL/ogr2ogr    |
| (Data Import)     |
+-------------------+
```

## Component Interactions
- **User Browser**: Interacts with the map UI, sends requests (e.g., nearest car wash, county analytics) via AJAX to Django REST endpoints.
- **Django Views**: Handle incoming requests, perform spatial queries, serialize results to GeoJSON/JSON, and return responses to the frontend.
- **Django Models (GeoDjango)**: Define spatial data structures (car washes, counties, population points) and manage ORM queries.
- **PostgreSQL + PostGIS**: Stores all spatial data, executes optimized spatial queries (proximity, aggregation, buffer).
- **GDAL/ogr2ogr**: Used for importing external spatial datasets (car washes, counties, population points) into the database.

## Data Flow
1. User interacts with the map (Leaflet.js) in the browser.
2. AJAX requests sent to Django REST API endpoints.
3. Django views process requests, query spatial data via GeoDjango ORM.
4. ORM queries executed on PostgreSQL/PostGIS, using spatial indexes for performance.
5. Results serialized to GeoJSON/JSON and returned to the frontend for visualization.
6. Data import and updates performed via GDAL/ogr2ogr and Django management commands.

---
