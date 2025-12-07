FROM postgis/postgis:15-3.4

# Install GDAL tools (ogr2ogr)
RUN apt-get update && apt-get install -y \
    gdal-bin \
    && rm -rf /var/lib/apt/lists/*

# Copy init scripts
COPY docker/postgres/init/ /docker-entrypoint-initdb.d/
COPY docker/postgres/data/ /data/