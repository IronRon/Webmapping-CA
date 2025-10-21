from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.gis.geos import Point
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import django
from django.db import connection
from .models import Location, TestArea, IrishCounty
from django.core.serializers import serialize
from django.http import HttpResponse


def hello_map(request):
    """Main map view with environment information"""
    django_version = django.get_version()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT PostGIS_Version();")
            postgis_version = cursor.fetchone()[0].split()[0]
    except:
        postgis_version = "Unknown"
    location_count = Location.objects.count()
    context = {
        'django_version': django_version,
        'postgis_version': postgis_version,
        'location_count': location_count,
    }
    return render(request, 'maps/hello_map.html', context)

# GeoJSON API view for carwash locations
def carwash_geojson(request):
    qs = Location.objects.all()
    geojson = serialize('geojson', qs, geometry_field='point', fields=(
        'name', 'brand', 'amenity', 'operator', 'address', 'building', 'automated', 'self_service', 'note'))
    return HttpResponse(geojson, content_type='application/json')

def counties_geojson(request):
    qs = IrishCounty.objects.all()
    geojson = serialize('geojson', qs, geometry_field='geom', fields=(
        'name_en', 'name_ga', 'alt_name', 'area', 'latitude', 'longitude'))
    return HttpResponse(geojson, content_type='application/json')
