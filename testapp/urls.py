from django.urls import path
from . import views

urlpatterns = [
    path('', views.hello_map, name='hello_map'),
    path('carwashes.geojson', views.carwash_geojson, name='carwash_geojson'),
    path('counties.geojson', views.counties_geojson, name='counties_geojson'),
    path('nearest_carwash/', views.nearest_carwash, name='nearest_carwash'),
    path('nearby_carwashes/', views.nearby_carwashes, name='nearby_carwashes'),
    path('county_wash_counts/', views.county_wash_counts, name='county_wash_counts'),
    path('nearby_populated_places/', views.nearby_populated_places, name='nearby_populated_places'),
    path('recommend_carwash_locations/', views.recommend_carwash_locations, name='recommend_carwash_locations'),
]