from django.contrib.gis.db import models 
 
class Location(models.Model):
    """Model matching the imported 'carwash' table from OSM/GeoJSON"""
    id = models.CharField(max_length=32, primary_key=True)  # OSM id (e.g., way/123456)
    name = models.CharField(max_length=200, blank=True, null=True)
    brand = models.CharField(max_length=100, blank=True, null=True)
    amenity = models.CharField(max_length=50, blank=True, null=True)
    operator = models.CharField(max_length=100, blank=True, null=True)
    building = models.CharField(max_length=50, blank=True, null=True)
    automated = models.CharField(max_length=10, blank=True, null=True)
    self_service = models.CharField(max_length=10, blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    access = models.CharField(max_length=50, blank=True, null=True)
    fixme = models.CharField(max_length=255, blank=True, null=True)
    addr_city = models.CharField(max_length=100, blank=True, null=True, db_column='addr:city')
    addr_street = models.CharField(max_length=100, blank=True, null=True, db_column='addr:street')
    addr_postcode = models.CharField(max_length=20, blank=True, null=True, db_column='addr:postcode')
    point = models.PointField(db_column='wkb_geometry')
    website = models.CharField(max_length=200, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    opening_hours = models.CharField(max_length=100, blank=True, null=True)
    email = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name or self.id

    class Meta:
        db_table = 'carwash'
        ordering = ['name']
 
class TestArea(models.Model): 
    """A polygon model for testing spatial queries""" 
    name = models.CharField(max_length=200) 
    boundary = models.PolygonField() 
    area_km2 = models.FloatField(null=True, blank=True) 
     
    def __str__(self): 
        return self.name 
     
    def save(self, *args, **kwargs): 
        # Auto-calculate area on save 
        if self.boundary: 
            # Convert area from square meters to square kilometers 
            self.area_km2 = self.boundary.area / 1000000 
        super().save(*args, **kwargs) 


class IrishCounty(models.Model):
    """Model for Irish county boundaries"""
    osm_id = models.FloatField(null=True, blank=True)
    name_tag = models.CharField(max_length=255, null=True, blank=True)
    name_ga = models.CharField(max_length=255, null=True, blank=True, verbose_name="Irish Name")
    name_en = models.CharField(max_length=255, null=True, blank=True, verbose_name="English Name")
    alt_name = models.CharField(max_length=255, null=True, blank=True, verbose_name="Alternative Name")
    area = models.DecimalField(max_digits=31, decimal_places=10, null=True, blank=True)
    latitude = models.DecimalField(max_digits=31, decimal_places=10, null=True, blank=True)
    longitude = models.DecimalField(max_digits=31, decimal_places=10, null=True, blank=True)
    geom = models.MultiPolygonField(srid=4326)


    class Meta:
        db_table = 'irish_counties'  # Use existing table
        managed = False  # Don't let Django manage this table
        verbose_name = "Irish County"
        verbose_name_plural = "Irish Counties"

   
    def __str__(self):
        return self.name_tag or self.name_en or f"County {self.id}"


    @property
    def display_name(self):
        """Return the best available name"""
        return self.name_en or self.name_tag or self.alt_name or f"County {self.id}"
   
    @property
    def area_km2(self):
        """Calculate area in square kilometers from geometry"""
        if self.geom:
            return self.geom.area * 12365.181  # Convert to km2 (approximate for Ireland)
        return None
    
class PopulationPoint(models.Model):
    """Model for imported population points (towns, villages, cities) from OSM/GeoJSON"""
    id = models.CharField(max_length=32, primary_key=True)  # OSM id (e.g., node/123456)
    name = models.CharField(max_length=200, blank=True, null=True)
    population = models.IntegerField(blank=True, null=True)
    place = models.CharField(max_length=50, blank=True, null=True)
    place_county = models.CharField(max_length=100, blank=True, null=True)
    is_in = models.CharField(max_length=100, blank=True, null=True)
    point = models.PointField(db_column='wkb_geometry')

    class Meta:
        db_table = 'population_points'
        managed = False  # Table is managed externally (imported)
        verbose_name = "Population Point"
        verbose_name_plural = "Population Points"

    def __str__(self):
        return f"{self.name or self.id} ({self.population or 'unknown'})"
