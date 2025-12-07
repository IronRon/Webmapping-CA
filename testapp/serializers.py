from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import Location, IrishCounty, IrishCounty, SavedRecommendation

class CarwashSerializer(serializers.ModelSerializer):
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = ['id', 'name', 'lat', 'lng', 'address']

    def get_lat(self, obj):
        return obj.point.y

    def get_lng(self, obj):
        return obj.point.x

    def get_address(self, obj):
        parts = [
            obj.addr_street or '',
            obj.addr_city or '',
            obj.addr_postcode or '',
        ]
        return ', '.join([p for p in parts if p])

class NearbyCarwashSerializer(serializers.ModelSerializer):
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    distance_km = serializers.FloatField()

    class Meta:
        model = Location
        fields = ['id', 'name', 'lat', 'lng', 'address', 'distance_km']

    def get_lat(self, obj):
        return obj.point.y

    def get_lng(self, obj):
        return obj.point.x

    def get_address(self, obj):
        parts = [
            obj.addr_street or '',
            obj.addr_city or '',
            obj.addr_postcode or '',
        ]
        return ', '.join([p for p in parts if p])
    
class CarwashGeoSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Location
        geo_field = 'point'
        fields = (
            'id',
            'name',
            'brand',
            'operator',
            'automated',
            'self_service',
        )

class IrishCountyGeoSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = IrishCounty
        geo_field = 'geom'
        fields = (
            'id',
            'name_en',
            'name_ga',
            'alt_name',
            'area',
            'latitude',
            'longitude',
        )

class CarwashRecommendationSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()
    name = serializers.CharField(allow_null=True, required=False)
    population = serializers.IntegerField(allow_null=True, required=False)
    min_distance_to_carwash_km = serializers.FloatField(allow_null=True)
    nearby_settlements = serializers.IntegerField()
    reason = serializers.CharField()

class SavedRecommendationSerializer(serializers.ModelSerializer):
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()

    class Meta:
        model = SavedRecommendation
        fields = [
            'id',
            'lat',
            'lng',
            'source_type',
            'reason',
            'created_at'
        ]

    def get_lat(self, obj):
        return obj.point.y

    def get_lng(self, obj):
        return obj.point.x
