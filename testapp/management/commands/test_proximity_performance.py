from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from testapp.models import Location, IrishCounty, PopulationPoint
import time

class Command(BaseCommand):
    help = 'Test car wash proximity search performance'

    def handle(self, *args, **options):
        test_points = [
            (53.3498, -6.2603),  # Dublin
            (51.5074, -0.1278),  # London
            (40.7128, -74.0060), # New York
        ]
        times = []
        for lat, lng in test_points:
            search_point = Point(lng, lat, srid=4326)
            start_time = time.time()
            nearest = list(Location.objects.annotate(
                distance=Distance('point', search_point)
            ).order_by('distance')[:10])
            end_time = time.time()
            query_time = (end_time - start_time) * 1000
            times.append(query_time)
            self.stdout.write(
                f"Search at ({lat}, {lng}): {query_time:.2f}ms, found {len(nearest)} car washes"
            )
        avg_time = sum(times) / len(times)
        self.stdout.write(
            self.style.SUCCESS(f"Average query time: {avg_time:.2f}ms")
        )

        # Test: Car washes within a county polygon
        county = IrishCounty.objects.first()
        start_time = time.time()
        washes_in_county = list(Location.objects.filter(point__within=county.geom))
        end_time = time.time()
        query_time = (end_time - start_time) * 1000
        self.stdout.write(
            f"Car washes in county '{county.display_name}': {query_time:.2f}ms, found {len(washes_in_county)}"
        )

        # Test: Population points within a buffer/circle
        search_point = Point(-6.2603, 53.3498, srid=4326)  # Dublin
        buffer = search_point.buffer(0.05)  # ~5.5km radius
        start_time = time.time()
        pop_points = list(PopulationPoint.objects.filter(point__within=buffer))
        end_time = time.time()
        query_time = (end_time - start_time) * 1000
        self.stdout.write(
            f"Population points within buffer: {query_time:.2f}ms, found {len(pop_points)}"
        )