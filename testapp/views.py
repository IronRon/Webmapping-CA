from .models import PopulationPoint
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
from django.contrib.gis.geos import GEOSGeometry
from django.contrib.gis.measure import D

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
    try:
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
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

# New view: nearby populated places sorted by distance
def nearby_populated_places(request):
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        user_point = Point(lng, lat, srid=4326)
        # Limit to 10 nearest populated places
        nearby = PopulationPoint.objects.annotate(
            distance=Distance('point', user_point)
        ).order_by('distance')[:10]
        places = []
        for place in nearby:
            places.append({
                'id': place.id,
                'name': place.name,
                'lat': place.point.y,
                'lng': place.point.x,
                'population': place.population,
                'place': place.place,
                'distance': place.distance.km
            })
        return JsonResponse({'places': places})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

# New view: recommend car wash locations in a county
def recommend_carwash_locations(request):
    try:
        county_id = request.GET.get('county_id')
        min_distance_km = float(request.GET.get('min_distance_km', 5))  # Minimum distance from existing car wash
        max_settlement_distance_km = float(request.GET.get('max_settlement_distance_km', 10))  # Max distance to settlement
        # Get county polygon
        county = IrishCounty.objects.get(id=county_id)
        # Get all car washes in county
        carwashes = Location.objects.filter(point__within=county.geom)
        carwash_points = [cw.point for cw in carwashes]
        # Get all settlements in county
        settlements = PopulationPoint.objects.filter(point__within=county.geom)
        # Candidate grid: use settlements as candidate points
        candidates = []
        for settlement in settlements:
            # Distance to nearest car wash
            if carwash_points:
                distances = [settlement.point.distance(cw_point) for cw_point in carwash_points]
                min_dist_km = min(distances) * 111  # Convert degrees to km (approx)
            else:
                min_dist_km = None
            # Is candidate far enough from car washes?
            if min_dist_km is not None and min_dist_km < min_distance_km:
                continue
            # Is candidate close enough to a settlement? (itself is a settlement)
            # Optionally, check for other settlements nearby
            nearby_settlements = PopulationPoint.objects.filter(
                point__distance_lte=(settlement.point, max_settlement_distance_km / 111)
            ).count()
            candidates.append({
                'id': settlement.id,
                'name': settlement.name,
                'lat': settlement.point.y,
                'lng': settlement.point.x,
                'population': settlement.population,
                'place': settlement.place,
                'min_distance_to_carwash_km': min_dist_km,
                'nearby_settlements': nearby_settlements
            })
        # Rank by distance from nearest car wash (descending), then by population (descending)
        candidates = sorted(candidates, key=lambda x: (x['min_distance_to_carwash_km'] or 0, x['population'] or 0), reverse=True)
        return JsonResponse({'recommendations': candidates[:10]})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
    
# New view: recommend car wash locations in a user-selected circle
def recommend_carwash_locations_circle(request):
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        radius_km = float(request.GET.get('radius_km', 10))
        min_distance_km = float(request.GET.get('min_distance_km', 5))
        max_settlement_distance_km = float(request.GET.get('max_settlement_distance_km', 10))
        # Create circle geometry (buffer in degrees)
        # Buffer expects degrees, so convert km to degrees (approx 1 deg = 111 km)
        buffer_deg = radius_km / 111.0
        center = Point(lng, lat, srid=4326)
        circle = center.buffer(buffer_deg)
        # Get all car washes in circle
        carwashes = Location.objects.filter(point__within=circle)
        carwash_points = [cw.point for cw in carwashes]
        # Get all settlements in circle
        settlements = PopulationPoint.objects.filter(point__within=circle)
        candidates = []
        for settlement in settlements:
            # Distance to nearest car wash
            if carwash_points:
                distances = [settlement.point.distance(cw_point) for cw_point in carwash_points]
                min_dist_km = min(distances) * 111  # Convert degrees to km (approx)
            else:
                min_dist_km = None
            # Is candidate far enough from car washes?
            if min_dist_km is not None and min_dist_km < min_distance_km:
                continue
            # Optionally, check for other settlements nearby
            nearby_settlements = PopulationPoint.objects.filter(
                point__distance_lte=(settlement.point, max_settlement_distance_km / 111)
            ).count()
            candidates.append({
                'id': settlement.id,
                'name': settlement.name,
                'lat': settlement.point.y,
                'lng': settlement.point.x,
                'population': settlement.population,
                'place': settlement.place,
                'min_distance_to_carwash_km': min_dist_km,
                'nearby_settlements': nearby_settlements
            })
        # Rank by distance from nearest car wash (descending), then by population (descending)
        candidates = sorted(candidates, key=lambda x: (x['min_distance_to_carwash_km'] or 0, x['population'] or 0), reverse=True)
        return JsonResponse({'recommendations': candidates[:10]})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

# @business_required
@csrf_exempt
def recommend_carwash_locations_polygon(request):
    data = json.loads(request.body)

    # Read polygon from geojson
    polygon = GEOSGeometry(json.dumps(data["geometry"]), srid=4326)

    min_distance_km = float(data.get("min_distance_km", 5))

    # Get car washes inside polygon
    carwashes = Location.objects.filter(point__within=polygon)
    carwash_pts = [cw.point for cw in carwashes]

    # Get settlements inside polygon
    settlements = PopulationPoint.objects.filter(point__within=polygon)

    if not settlements:
        centroid = polygon.centroid
        return JsonResponse({
            "lat": centroid.y,
            "lng": centroid.x,
            "name": "Polygon Centroid",
            "population": None,
            "min_distance_to_carwash_km": None,
            "nearby_settlements": settlements.count(),
            "reason": "No settlements inside polygon, using centroid"
        })

    best = None
    best_score = -1

    for s in settlements:
        if carwash_pts:
            dist_km = min([s.point.distance(cw) * 111 for cw in carwash_pts])
            if dist_km < min_distance_km:
                continue
        else:
            dist_km = None

        score = dist_km or 1000  # simple scoring

        if score > best_score:
            best = s
            best_score = score

    if best:
        return JsonResponse({
            "lat": best.point.y,
            "lng": best.point.x,
            "name": getattr(best, "name", "Unknown"),
            "population": getattr(best, "population", None),
            "min_distance_to_carwash_km": float(dist_km) if dist_km is not None else None,
            "nearby_settlements": settlements.count(),
            "reason": "Best settlement inside your polygon"
        })

    else:
        centroid = polygon.centroid
        return JsonResponse({
            "lat": centroid.y,
            "lng": centroid.x,
            "name": "Polygon Centroid",
            "population": None,
            "min_distance_to_carwash_km": None,
            "nearby_settlements": settlements.count(),
            "reason": "No suitable settlement found, using polygon centroid"
        })
