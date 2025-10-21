from django.urls import path
from . import views

urlpatterns = [
    path('', views.hello_map, name='hello_map'),
    path('carwashes.geojson', views.carwash_geojson, name='carwash_geojson'),
    path('counties.geojson', views.counties_geojson, name='counties_geojson'),
]