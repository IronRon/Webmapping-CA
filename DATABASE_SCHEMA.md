# Database Schema Documentation

This document describes the main database schema for CleanMyRide, including tables, fields, and spatial indexes. The application uses PostgreSQL with the PostGIS extension and is managed via Django/GeoDjango ORM and migrations.

## Main Tables

### 1. Car Wash Locations (`CarWash`)
- **id**: Integer, primary key
- **name**: String, car wash name
- **address**: String, car wash address
- **service_type**: String, type of car wash/service
- **operating_hours**: String, hours of operation
- **location**: Point (SRID 4326), spatial location of car wash
- **created_at**: DateTime, record creation timestamp
- **updated_at**: DateTime, record update timestamp
- **Indexes**: GIST index on `location` for fast spatial queries

### 2. Irish Counties (`County`)
- **id**: Integer, primary key
- **name**: String, county name
- **boundary**: Polygon (SRID 4326), spatial boundary of county
- **Indexes**: GIST index on `boundary` for point-in-polygon queries

### 3. Population Points (`PopulationPoint`)
- **id**: Integer, primary key
- **name**: String, settlement name
- **population**: Integer, population count
- **location**: Point (SRID 4326), spatial location of settlement
- **Indexes**: GIST index on `location` for proximity and buffer queries

## Spatial Indexes
- All geometry fields use GIST indexes for efficient spatial queries:
  - `location` (CarWash, PopulationPoint)
  - `boundary` (County)

## Migrations
- Initial migration creates all tables and fields
- Custom migration adds spatial indexes (see `testapp/migrations/0002_add_spatial_indexes.py`)

## Relationships
- Car washes and population points are not directly related, but spatial queries are used to analyze proximity and coverage
- Counties are used for aggregation and spatial analysis

## Example Models (Django ORM)
```python
class CarWash(models.Model):
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    service_type = models.CharField(max_length=100)
    operating_hours = models.CharField(max_length=100)
    location = models.PointField(srid=4326)
    # ...timestamps...

class County(models.Model):
    name = models.CharField(max_length=255)
    boundary = models.PolygonField(srid=4326)

class PopulationPoint(models.Model):
    name = models.CharField(max_length=255)
    population = models.IntegerField()
    location = models.PointField(srid=4326)
```

## Notes
- All geometry fields use SRID 4326 (WGS 84)
- Data imported via GDAL/ogr2ogr and managed with Django migrations
- See `testapp/migrations/` for migration details
- For full schema, inspect the database after running migrations
