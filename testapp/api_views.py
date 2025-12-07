import json
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import GEOSGeometry
from .models import IrishCounty, Location, PopulationPoint, SavedRecommendation
from .serializers import CarwashRecommendationSerializer, CarwashSerializer, IrishCountyGeoSerializer, NearbyCarwashSerializer, CarwashGeoSerializer, SavedRecommendationSerializer
from django.views.decorators.csrf import csrf_exempt

@api_view(['GET'])
def nearest_carwash_api(request):
    """
    Return the nearest car wash to a given user location.

    This endpoint is intended for regular users.
    It performs a spatial nearest-neighbour query using PostGIS.

    Query parameters:
    - lat: User latitude
    - lng: User longitude

    Returns:
    - Nearest car wash location with distance (in km)
    """

    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid coordinates'}, status=400)

    user_point = Point(lng, lat, srid=4326)

    nearest = Location.objects.annotate(
        distance=Distance('point', user_point)
    ).order_by('distance').first()

    if not nearest:
        return Response({'location': None})

    return Response({
        'location': CarwashSerializer(nearest).data,
        'distance': nearest.distance.km
    })

@api_view(['GET'])
def nearby_carwashes_api(request):
    """
    Return a list of nearby car washes ordered by distance.

    This endpoint is intended for regular users.
    It uses spatial distance annotations to return the closest results.

    Query parameters:
    - lat: User latitude
    - lng: User longitude

    Returns:
    - Array of nearby car washes including distance_km
    """

    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid coordinates'}, status=400)

    user_point = Point(lng, lat, srid=4326)

    qs = (
        Location.objects
        .annotate(distance=Distance('point', user_point))
        .order_by('distance')[:10]
    )

    # Attach distance_km dynamically
    for obj in qs:
        obj.distance_km = obj.distance.km

    serializer = NearbyCarwashSerializer(qs, many=True)
    return Response({'carwashes': serializer.data})

@api_view(['GET'])
def carwash_geojson_api(request):
    """
    Return all car wash locations as GeoJSON.

    This endpoint is public and used to render
    car wash markers on the Leaflet map.
    """

    qs = Location.objects.all()
    serializer = CarwashGeoSerializer(qs, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def counties_geojson_api(request):
    """
    Return all Irish counties as GeoJSON polygons.

    Access is restricted to authenticated users (business mode).
    Used for county-based analysis and visualisation.
    """

    qs = IrishCounty.objects.all()
    serializer = IrishCountyGeoSerializer(qs, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def county_wash_counts_api(request):
    """
    Return the number of car washes per county.

    This endpoint supports business analytics visualisations
    such as heatmaps or choropleth maps.

    Access limited to authenticated users.
    """

    results = []

    for county in IrishCounty.objects.all():
        count = Location.objects.filter(
            point__within=county.geom
        ).count()

        results.append({
            'id': county.id,
            'name': county.name_en,
            'wash_count': count
        })

    return Response({'counts': results})

# GET used because inputs are simple query parameters
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recommend_carwash_locations_county_api(request):
    """
    Recommend optimal car wash locations within a selected county.

    Algorithm:
    - Use populated settlements as candidate locations
    - Exclude candidates closer than min_distance_km to existing car washes
    - Penalise isolated settlements using nearby settlement counts
    - Rank by distance from car washes, then by population

    Access:
    - Restricted to authenticated (business) users
    """


    try:
        # Get request parameters
        county_id = request.GET.get('county_id')
        min_distance_km = float(request.GET.get('min_distance_km', 5))
        max_settlement_distance_km = float(
            request.GET.get('max_settlement_distance_km', 10)
        )

        if not county_id:
            return Response({'error': 'county_id is required'}, status=400)
        county = IrishCounty.objects.get(id=county_id)

        # Get all car washes inside the county
        carwashes = Location.objects.filter(point__within=county.geom)
        # Get all settlements inside the county
        settlements = PopulationPoint.objects.filter(point__within=county.geom)

        candidates = []

        # Use settlements as candidate points
        for settlement in settlements:
            # Calculate distance to nearest car wash
            if carwashes.exists():
                distances = [
                    settlement.point.distance(cw.point) * 111
                    for cw in carwashes
                ]
                min_dist_km = min(distances)
            else:
                min_dist_km = None
            # Skip if too close to an existing car wash
            if min_dist_km is not None and min_dist_km < min_distance_km:
                continue
            # Count how many other settlements are nearby
            nearby_settlements = PopulationPoint.objects.filter(
                point__distance_lte=(
                    settlement.point,
                    max_settlement_distance_km / 111
                )
            ).count()

            candidates.append({
                'lat': settlement.point.y,
                'lng': settlement.point.x,
                'name': settlement.name,
                'population': settlement.population,
                'min_distance_to_carwash_km': min_dist_km,
                'nearby_settlements': nearby_settlements,
                'reason': f'Recommended location in {county.name_en}'
            })

        # Rank by distance first, then population
        candidates = sorted(
            candidates,
            key=lambda x: (
                x['min_distance_to_carwash_km'] or 0,
                x['population'] or 0
            ),
            reverse=True
        )

        serializer = CarwashRecommendationSerializer(candidates[:10], many=True)
        return Response({'recommendations': serializer.data})

    except IrishCounty.DoesNotExist:
        return Response({'error': 'County not found'}, status=404)

    except Exception as e:
        return Response({'error': str(e)}, status=400)

# GET used because inputs are simple query parameters
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recommend_carwash_locations_circle_api(request):
    """
    Recommend car wash locations within a user-defined circle.

    The circle is defined using latitude, longitude, and radius.
    This endpoint supports flexible business location planning.

    Access:
    - Authenticated users only
    """

    try:
        # Read request parameters
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
        radius_km = float(request.GET.get('radius_km', 10))
        min_distance_km = float(request.GET.get('min_distance_km', 5))
        max_settlement_distance_km = float(
            request.GET.get('max_settlement_distance_km', 10)
        )

        # Create circular geometry (km → degrees, approx)
        buffer_deg = radius_km / 111.0
        center = Point(lng, lat, srid=4326)
        circle = center.buffer(buffer_deg)

        # Get car washes and settlements inside the circle
        carwashes = Location.objects.filter(point__within=circle)
        settlements = PopulationPoint.objects.filter(point__within=circle)

        candidates = []

        for settlement in settlements:
            # Distance to nearest car wash
            if carwashes.exists():
                distances = [
                    settlement.point.distance(cw.point) * 111
                    for cw in carwashes
                ]
                min_dist_km = min(distances)
            else:
                min_dist_km = None

            # Skip candidates too close to existing car washes
            if min_dist_km is not None and min_dist_km < min_distance_km:
                continue

            # Count nearby settlements
            nearby_settlements = PopulationPoint.objects.filter(
                point__distance_lte=(
                    settlement.point,
                    max_settlement_distance_km / 111
                )
            ).count()

            candidates.append({
                'lat': settlement.point.y,
                'lng': settlement.point.x,
                'name': settlement.name,
                'population': settlement.population,
                'min_distance_to_carwash_km': min_dist_km,
                'nearby_settlements': nearby_settlements,
                'reason': 'Recommended location inside selected circle'
            })

        # Rank candidates
        candidates = sorted(
            candidates,
            key=lambda x: (
                x['min_distance_to_carwash_km'] or 0,
                x['population'] or 0
            ),
            reverse=True
        )

        serializer = CarwashRecommendationSerializer(
            candidates[:10], many=True
        )
        return Response({'recommendations': serializer.data})

    except Exception as e:
        return Response({'error': str(e)}, status=400)

# POST used because polygon geometry is complex GeoJSON
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def recommend_carwash_locations_polygon_api(request):
    """
    Recommend a car wash location inside a user-drawn polygon.

    This endpoint uses POST because it accepts complex GeoJSON geometry.
    It is intended for advanced business users performing spatial analysis.
    """

    try:
        data = request.data

        # Read polygon geometry
        polygon = GEOSGeometry(
            json.dumps(data.get('geometry')),
            srid=4326
        )

        min_distance_km = float(data.get('min_distance_km', 5))

        # Get car washes inside polygon
        carwashes = Location.objects.filter(point__within=polygon)
        carwash_points = [cw.point for cw in carwashes]

        # Get settlements inside polygon
        settlements = PopulationPoint.objects.filter(point__within=polygon)

        # If no settlements, return polygon centroid
        if not settlements.exists():
            centroid = polygon.centroid
            return Response({
                'lat': centroid.y,
                'lng': centroid.x,
                'name': 'Polygon Centroid',
                'population': None,
                'min_distance_to_carwash_km': None,
                'nearby_settlements': 0,
                'reason': 'No settlements inside polygon, using centroid'
            })

        best_candidate = None
        best_score = -1

        for settlement in settlements:
            if carwash_points:
                dist_km = min(
                    settlement.point.distance(cw) * 111
                    for cw in carwash_points
                )
                if dist_km < min_distance_km:
                    continue
            else:
                dist_km = None

            score = dist_km or 1000  # simple heuristic

            if score > best_score:
                best_candidate = settlement
                best_score = score

        # If a suitable settlement was found
        if best_candidate:
            serializer = CarwashRecommendationSerializer({
                'lat': best_candidate.point.y,
                'lng': best_candidate.point.x,
                'name': best_candidate.name,
                'population': best_candidate.population,
                'min_distance_to_carwash_km': best_score,
                'nearby_settlements': settlements.count(),
                'reason': 'Best settlement inside selected polygon'
            })
            return Response(serializer.data)

        # Otherwise, fallback to centroid
        centroid = polygon.centroid
        return Response({
            'lat': centroid.y,
            'lng': centroid.x,
            'name': 'Polygon Centroid',
            'population': None,
            'min_distance_to_carwash_km': None,
            'nearby_settlements': settlements.count(),
            'reason': 'No suitable settlement found, using centroid'
        })

    except Exception as e:
        return Response({'error': str(e)}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_recommendation_api(request):
    """
    Save a recommended car wash location for the logged-in user.

    This endpoint allows business users to persist spatial
    recommendations generated by the system.
    """
    try:
        lat = float(request.data.get('lat'))
        lng = float(request.data.get('lng'))
        source_type = request.data.get('source_type')
        reason = request.data.get('reason', '')

        rec = SavedRecommendation.objects.create(
            user=request.user,
            point=Point(lng, lat, srid=4326),
            source_type=source_type,
            reason=reason
        )

        serializer = SavedRecommendationSerializer(rec)
        return Response(serializer.data, status=201)

    except Exception as e:
        return Response({'error': str(e)}, status=400)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_saved_recommendations_api(request):
    """
    Return all saved recommendations for the logged-in user.
    """
    recs = SavedRecommendation.objects.filter(
        user=request.user
    ).order_by('-created_at')

    serializer = SavedRecommendationSerializer(recs, many=True)
    return Response({'recommendations': serializer.data})
