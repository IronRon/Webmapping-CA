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
from django.contrib.gis.db.models.functions import Distance
from django.db.models import Count
from django.contrib.gis.db.models import GeometryField



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

def nearest_carwash(request):
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        user_point = Point(lng, lat, srid=4326)
        nearest = Location.objects.annotate(
            distance=Distance('point', user_point)
        ).order_by('distance').first()
        if nearest:
            return JsonResponse({
                'location': {
                    'id': nearest.id,
                    'name': nearest.name,
                    'lat': nearest.point.y,
                    'lng': nearest.point.x,
                    'address': f"{nearest.addr_street or ''}, {nearest.addr_city or ''}, {nearest.addr_postcode or ''}"
                },
                'distance': nearest.distance.km
            })
        else:
            return JsonResponse({'location': None})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

# New view: nearby car washes sorted by distance
def nearby_carwashes(request):
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        user_point = Point(lng, lat, srid=4326)
        # Limit to 10 nearest car washes
        nearby = Location.objects.annotate(
            distance=Distance('point', user_point)
        ).order_by('distance')[:10]
        carwashes = []
        for loc in nearby:
            carwashes.append({
                'id': loc.id,
                'name': loc.name,
                'lat': loc.point.y,
                'lng': loc.point.x,
                'address': f"{getattr(loc, 'addr_street', '')}, {getattr(loc, 'addr_city', '')}, {getattr(loc, 'addr_postcode', '')}",
                'distance': loc.distance.km
            })
        return JsonResponse({'carwashes': carwashes})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

# New view: car wash counts per county for heatmap
def county_wash_counts(request):
    # For each county, count car washes whose point is within the county polygon
    counts = []
    for county in IrishCounty.objects.all():
        wash_count = Location.objects.filter(point__within=county.geom).count()
        counts.append({
            'id': county.id,
            'name_en': county.name_en,
            'wash_count': wash_count
        })
    return JsonResponse({'counts': counts})
