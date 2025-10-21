from django.db import models
from django.contrib import admin
from .models import Location, TestArea, IrishCounty
from django.contrib.gis.admin import OSMGeoAdmin

# Register your models here.
admin.site.register(Location)
admin.site.register(TestArea)
 

@admin.register(IrishCounty)
class IrishCountyAdmin(OSMGeoAdmin):
    """Admin interface for Irish counties with map widget"""
   
    list_display = ['display_name', 'name_en', 'name_ga', 'area_display']
    search_fields = ['name_tag', 'name_en', 'name_ga', 'alt_name']
    list_filter = ['name_en']
    readonly_fields = ['osm_id', 'area', 'latitude', 'longitude', 'area_display', 'display_name']
   

    # Map widget settings
    default_zoom = 7
    default_lat = 53.41291
    default_lon = -8.24389
   
    def area_display(self, obj):
        """Display formatted area"""
        if obj.area:
            return f"{obj.area:.0f} units"
        elif obj.geom:
            return f"{obj.area_km2:.0f} km²"
        return "N/A"
    area_display.short_description = "Area"