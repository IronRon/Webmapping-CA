#!/bin/bash
set -e

echo "✅ Importing spatial datasets..."

# Car washes (matches Location model)
ogr2ogr -f PostgreSQL \
  PG:"dbname=$POSTGRES_DB user=$POSTGRES_USER password=$POSTGRES_PASSWORD" \
  /data/carwashes_ireland.geojson \
  -nln carwash \
  -nlt POINT \
  -overwrite

echo "✅ Imported Car Washes..."

# Population points
ogr2ogr -f PostgreSQL \
  PG:"dbname=$POSTGRES_DB user=$POSTGRES_USER password=$POSTGRES_PASSWORD" \
  /data/population_points_ireland.geojson \
  -nln population_points \
  -nlt POINT \
  -overwrite

echo "✅ Imported Population Points..."

# Counties (polygon layer)
ogr2ogr -f PostgreSQL \
  PG:"dbname=$POSTGRES_DB user=$POSTGRES_USER password=$POSTGRES_PASSWORD" \
  /data/counties.shp \
  -overwrite \
  -lco GEOMETRY_NAME=geom \
  -lco FID=id \
  -nln irish_counties \
  -t_srs EPSG:4326 \
  -nlt MULTIPOLYGON

echo "✅ Imported Counties..."

echo "✅ Spatial data import complete"
