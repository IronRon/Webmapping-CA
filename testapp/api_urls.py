from django.urls import path
from . import api_views

urlpatterns = [
    path('nearest/', api_views.nearest_carwash_api),
    path('nearby/', api_views.nearby_carwashes_api),
    path('carwashes/', api_views.carwash_geojson_api),
    path('counties/', api_views.counties_geojson_api),
    path('county_wash_counts/', api_views.county_wash_counts_api),
    path('recommend_county/', api_views.recommend_carwash_locations_county_api),
    path('recommend_circle/', api_views.recommend_carwash_locations_circle_api),
    path('recommend_polygon/', api_views.recommend_carwash_locations_polygon_api),
    path('recommendations/save/', api_views.save_recommendation_api),
    path('recommendations/', api_views.list_saved_recommendations_api),
]
