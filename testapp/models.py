from django.contrib.gis.db import models 
 
class Location(models.Model): 
    """A simple spatial model for testing our setup""" 
    name = models.CharField(max_length=200) 
    description = models.TextField(blank=True) 
    point = models.PointField() 
    created_at = models.DateTimeField(auto_now_add=True) 
     
    def __str__(self): 
        return self.name 
     
    class Meta: 
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