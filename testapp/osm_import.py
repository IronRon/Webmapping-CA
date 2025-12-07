import logging
from typing import Tuple, List

import requests
from django.conf import settings
from django.contrib.gis.geos import Point
from django.db import transaction

from .models import Location

logger = logging.getLogger(__name__)


def fetch_carwashes_from_overpass() -> dict:
    """
    Call the Overpass API and return the raw JSON response.
    Uses the query defined in settings.OVERPASS_CARWASH_QUERY_IRELAND.
    """
    url = getattr(settings, "OVERPASS_API_URL", "https://overpass-api.de/api/interpreter")
    query = settings.OVERPASS_CARWASH_QUERY_IRELAND

    logger.info("Requesting carwash data from Overpass…")

    try:
        resp = requests.post(
            url,
            data={"data": query},
            timeout=180
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.Timeout:
        return "Overpass API timed out. Please try again later."
    except requests.exceptions.HTTPError as e:
        return f"Overpass API error: {str(e)}"
    except requests.exceptions.RequestException as e:
        return f"Request failed: {str(e)}"


def _element_to_location_kwargs(element: dict) -> dict | None:
    """
    Convert a single Overpass element to Location model fields.

    Handles nodes, ways, and relations using 'center' coordinates
    returned by 'out center;' in the query.
    """
    tags = element.get("tags", {})
    # If for some reason amenity != car_wash, skip
    if tags.get("amenity") != "car_wash":
        return None

    # Determine coordinates
    if element.get("type") == "node":
        lat = element.get("lat")
        lon = element.get("lon")
    else:
        # ways/relations: Overpass returns a 'center' object if we used "out center;"
        center = element.get("center")
        if not center:
            return None
        lat = center.get("lat")
        lon = center.get("lon")

    if lat is None or lon is None:
        return None

    # Map OSM tags to Location fields
    return {
        # Primary key: prevent ID collisions between node/way/relation
        "id": f"{element.get('type')}/{element.get('id')}",

        # Basic identity
        "name": tags.get("name") or tags.get("operator") or "Unnamed Car Wash",
        "amenity": tags.get("amenity"),
        "brand": tags.get("brand"),
        "operator": tags.get("operator"),

        # Additional OSM car wash attributes
        "building": tags.get("building"),
        "automated": tags.get("automated"),
        "self_service": tags.get("self_service"),
        "note": tags.get("note"),
        "access": tags.get("access"),
        "fixme": tags.get("fixme"),
        "description": tags.get("description"),

        # Address fields (match db_column definitions)
        "addr_street": tags.get("addr:street"),
        "addr_city": tags.get("addr:city"),
        "addr_postcode": tags.get("addr:postcode"),

        # Contact / metadata
        "website": tags.get("website"),
        "phone": tags.get("phone"),
        "email": tags.get("email"),
        "opening_hours": tags.get("opening_hours"),

        # Geometry (lon, lat)
        "point": Point(lon, lat, srid=4326),
    }


@transaction.atomic
def replace_carwashes_from_overpass() -> Tuple[int, int]:
    """
    Fetch car washes from Overpass and replace existing Location rows.

    Returns (imported_count, deleted_count).
    """
    data = fetch_carwashes_from_overpass()
    elements = data.get("elements", [])

    logger.info("Received %d elements from Overpass", len(elements))

    locations: List[Location] = []
    for el in elements:
        kwargs = _element_to_location_kwargs(el)
        if not kwargs:
            continue
        locations.append(Location(**kwargs))

    # Strategy: wipe existing rows and bulk_create new ones.
    # If you only want to wipe OSM-based ones, filter with source='osm'.
    deleted_count, _ = Location.objects.all().delete()

    Location.objects.bulk_create(locations, batch_size=500)

    logger.info(
        "Deleted %d existing Location rows, imported %d new car washes from Overpass",
        deleted_count,
        len(locations),
    )

    return len(locations), deleted_count
