import math
from typing import Tuple, Optional, Dict, Any, Union
from backend.schemas import TripSchema
from backend.matching.models import MatchingRequest, FeatureBreakdown, FeatureRaw

# Stored city and major hub coordinates for accurate local geospatial fallback without Mapbox calls
CITY_COORDINATES: Dict[str, Tuple[float, float]] = {
    # Metropolitan tech hubs & localities
    "electronic city": (12.8399, 77.6770),
    "whitefield": (12.9698, 77.7500),
    "koramangala": (12.9352, 77.6245),
    "indiranagar": (12.9784, 77.6408),
    "marathahalli": (12.9591, 77.6974),
    "hitec city": (17.4435, 78.3772),
    "gachibowli": (17.4401, 78.3489),
    "madhapur": (17.4483, 78.3915),
    "secunderabad": (17.4399, 78.4983),
    "cyber city": (28.4950, 77.0895),
    "gurugram": (28.4595, 77.0266),
    "gurgaon": (28.4595, 77.0266),
    "noida": (28.5355, 77.3910),
    "thane": (19.2183, 72.9781),
    "navi mumbai": (19.0330, 73.0297),
    "hinjewadi": (18.5913, 73.7389),
    "wakad": (18.5987, 73.7660),
    "tambaram": (12.9249, 80.1000),
    "omr": (12.8680, 80.2270),
    # Core cities
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "chennai": (13.0827, 80.2707),
    "mumbai": (19.0760, 72.8777),
    "pune": (18.5204, 73.8567),
    "mysuru": (12.2958, 76.6394),
    "mysore": (12.2958, 76.6394),
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "goa": (15.2993, 74.1240),
    "panaji": (15.4909, 73.8278),
    "kochi": (9.9312, 76.2673),
    "coimbatore": (11.0168, 76.9558),
    "jaipur": (26.9124, 75.7873),
    "ahmedabad": (23.0225, 72.5714),
    "kolkata": (22.5726, 88.3639),
}

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on Earth in kilometers."""
    r = 6371.0 # Earth's radius in kilometers
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)

def extract_location_info(loc: Union[str, Dict[str, Any], Any]) -> Tuple[str, Optional[float], Optional[float]]:
    """Extract location name, latitude, and longitude from string, dict, or object."""
    if isinstance(loc, str):
        name = loc.strip()
        lat, lon = None, None
    elif isinstance(loc, dict):
        name = str(loc.get("name") or loc.get("formattedAddress") or loc.get("formatted_address") or "").strip()
        lat = loc.get("latitude") or loc.get("lat")
        lon = loc.get("longitude") or loc.get("lng") or loc.get("lon")
    elif hasattr(loc, "name"):
        name = str(loc.name).strip()
        lat = getattr(loc, "latitude", None)
        lon = getattr(loc, "longitude", None)
    else:
        name = str(loc).strip()
        lat, lon = None, None

    # Fallback to stored city coordinates if lat/lon not provided (longest key match first)
    if (lat is None or lon is None) and name:
        lower_name = name.lower()
        for city_key in sorted(CITY_COORDINATES.keys(), key=len, reverse=True):
            if city_key in lower_name:
                lat, lon = CITY_COORDINATES[city_key]
                break

    return name, (float(lat) if lat is not None else None), (float(lon) if lon is not None else None)

def parse_time_to_minutes(time_str: Optional[str]) -> Optional[int]:
    """Parse time string like '08:00', '8:30 AM', '14:15' to minutes from midnight."""
    if not time_str:
        return None
    cleaned = time_str.strip().upper()
    try:
        # Check for AM/PM
        is_pm = "PM" in cleaned
        is_am = "AM" in cleaned
        cleaned = cleaned.replace("AM", "").replace("PM", "").strip()

        # Handle window format e.g. "Morning (08:00 - 11:00)"
        if "(" in cleaned and "-" in cleaned:
            cleaned = cleaned.split("(")[1].split("-")[0].strip()

        parts = cleaned.split(":")
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0

        if is_pm and hours < 12:
            hours += 12
        elif is_am and hours == 12:
            hours = 0

        return hours * 60 + minutes
    except Exception:
        return None

class FeatureCalculator:
    """Calculates all matching features locally without external API calls."""

    @staticmethod
    def calculate_pickup_score(dist_km: float) -> float:
        """
        Normalize pickup proximity distance in km to 0-100 score.
        0 km -> 100
        1 km -> 95
        2 km -> 90
        5 km -> 75
        10 km -> 40
        >20 km -> 0
        """
        if dist_km <= 0.0:
            return 100.0
        elif dist_km <= 1.0:
            return round(100.0 - 5.0 * dist_km, 2)
        elif dist_km <= 2.0:
            return round(95.0 - 5.0 * (dist_km - 1.0), 2)
        elif dist_km <= 5.0:
            return round(90.0 - 5.0 * (dist_km - 2.0), 2)
        elif dist_km <= 10.0:
            return round(75.0 - 7.0 * (dist_km - 5.0), 2)
        elif dist_km <= 20.0:
            return round(max(0.0, 40.0 - 4.0 * (dist_km - 10.0)), 2)
        else:
            return 0.0

    @staticmethod
    def calculate_drop_score(dist_km: float) -> float:
        """Normalize drop-off proximity distance in km to 0-100 score."""
        return FeatureCalculator.calculate_pickup_score(dist_km)

    @staticmethod
    def calculate_time_score(diff_minutes: int) -> float:
        """
        Normalize departure time absolute difference in minutes to 0-100 score.
        0 min -> 100
        15 min -> 75
        30 min -> 50
        60 min -> 0
        >60 min -> 0
        """
        if diff_minutes <= 0:
            return 100.0
        elif diff_minutes <= 60:
            return round(max(0.0, 100.0 - (diff_minutes / 60.0) * 100.0), 2)
        else:
            return 0.0

    @staticmethod
    def calculate_price_score(budget: Optional[float], price: float) -> float:
        """
        Normalize price compatibility to 0-100 score.
        Continuous and deterministic across entire range:
        - price <= budget (100% budget or cheaper): 100.0 (full satisfaction)
        - 100% to 125% budget: continuous linear decay from 100.0 down to 0.0
          * 100% budget -> 100.0
          * 115% budget (15% over) -> 40.0
          * 125% budget (25% over) -> 0.0
        - > 125% budget: 0.0
        """
        if budget is None or budget <= 0:
            return 100.0 # Unspecified budget = flexible

        if price <= budget:
            return 100.0
        else:
            over_pct = (price - budget) / budget
            if over_pct <= 0.25:
                # Continuous linear decay: 0% over = 100.0, 15% over = 40.0, 25% over = 0.0
                return round(max(0.0, 100.0 - (over_pct / 0.25) * 100.0), 2)
            else:
                return 0.0

    @staticmethod
    def calculate_rating_score(rating: float, rating_count: int) -> float:
        """
        Driver rating matching score strictly adhering to specifications:
        rating_count = 0 -> 50.0 (New driver, no penalty, not artificial 5-star)
        rating_count = 1 -> 50.0 (Display actual rating, but matching score is 50.0)
        rating_count >= 2 -> (average_rating / 5.0) * 100.0 (Participates in matching)
        """
        if rating_count < 2:
            return 50.0
        normalized = (max(1.0, min(5.0, rating)) / 5.0) * 100.0
        return round(normalized, 2)

    @staticmethod
    def calculate_vehicle_score(preference: Optional[str], vehicle: Any) -> Tuple[float, bool]:
        """
        Vehicle preference scoring:
        No preference -> 100.0
        Exact category / model match -> 100.0
        Compatible category -> 75.0
        Incompatible -> 30.0
        """
        if not preference or not preference.strip() or preference.strip().lower() in ["any", "all", "none"]:
            return 100.0, True

        pref = preference.strip().lower()
        make = getattr(vehicle, "make", "").lower() if vehicle else ""
        model = getattr(vehicle, "model", "").lower() if vehicle else ""
        combined = f"{make} {model}".strip()

        # Direct name match
        if pref in combined or (make and make in pref) or (model and model in pref):
            return 100.0, True

        # Category mapping
        suv_keywords = ["suv", "creta", "harrier", "seltos", "scorpio", "innova", "xuv", "brezza", "nexon"]
        sedan_keywords = ["sedan", "city", "verna", "ciaz", "dzire", "slavia", "virtus"]
        hatch_keywords = ["hatchback", "baleno", "swift", "i20", "tiago", "alto", "polo"]

        is_suv = any(k in combined for k in suv_keywords)
        is_sedan = any(k in combined for k in sedan_keywords)
        is_hatch = any(k in combined for k in hatch_keywords)

        if "suv" in pref and is_suv:
            return 100.0, True
        if "sedan" in pref and is_sedan:
            return 100.0, True
        if "hatch" in pref and is_hatch:
            return 100.0, True

        # Compatible categories (e.g. Sedan and Hatchback or Compact SUV)
        if ("sedan" in pref and is_suv) or ("suv" in pref and is_sedan):
            return 75.0, False

        return 30.0, False

    @staticmethod
    def calculate_route_score(
        req_origin: str,
        req_dest: str,
        trip_origin: str,
        trip_dest: str,
        pickup_dist_km: float,
        drop_dist_km: float
    ) -> float:
        """
        Route compatibility score (0-100).
        Evaluates geographic compatibility primarily via coordinate distance offsets.
        Does NOT depend on exact textual city-name matching.
        Example: Passenger: Electronic City -> Hyderabad, Driver: Bengaluru -> Hyderabad
        is evaluated geographically (~18km pickup offset, 0km drop offset) rather than
        rejecting because origin strings differ.
        """
        clean_req_o = req_origin.lower().strip()
        clean_req_d = req_dest.lower().strip()
        clean_trip_o = trip_origin.lower().strip()
        clean_trip_d = trip_dest.lower().strip()

        # 1. Primary Geospatial Compatibility:
        # If pickup is within 40 km of trip origin and drop is within 40 km of trip destination
        if pickup_dist_km <= 40.0 and drop_dist_km <= 40.0:
            if pickup_dist_km <= 2.0 and drop_dist_km <= 2.0:
                return 100.0
            # Continuous score: 0 km offset = 100, smoothly declining as pickup/drop offsets grow
            penalty = (pickup_dist_km + drop_dist_km) * 0.8
            return round(max(50.0, 100.0 - penalty), 2)

        # 2. Textual match (exact or substring)
        origin_text_match = (clean_req_o in clean_trip_o or clean_trip_o in clean_req_o)
        dest_text_match = (clean_req_d in clean_trip_d or clean_trip_d in clean_req_d)

        if origin_text_match and dest_text_match:
            if pickup_dist_km <= 2.0 and drop_dist_km <= 2.0:
                return 100.0
            penalty = min(20.0, (pickup_dist_km + drop_dist_km) * 1.5)
            return round(max(80.0, 100.0 - penalty), 2)

        # 3. Known intercity corridor match
        corridors = [
            ("bengaluru", "hyderabad", ["kurnool", "anantapur", "mahabubnagar", "electronic city", "whitefield", "koramangala"]),
            ("bengaluru", "chennai", ["hosur", "krishnagiri", "vellore", "electronic city", "whitefield"]),
            ("mumbai", "pune", ["lonavala", "khandala", "navi mumbai", "hinjewadi", "wakad", "thane"]),
        ]
        for orig, dst, stops in corridors:
            if (orig in clean_trip_o or any(s in clean_trip_o for s in stops)) and \
               (dst in clean_trip_d or any(s in clean_trip_d for s in stops)):
                if (orig in clean_req_o or any(s in clean_req_o for s in stops)) and \
                   (dst in clean_req_d or any(s in clean_req_d for s in stops)):
                    return 85.0

        return 0.0

    @classmethod
    def calculate_all(
        cls,
        request: MatchingRequest,
        trip: TripSchema,
        driver_rating_count: int = 2
    ) -> Tuple[FeatureBreakdown, FeatureRaw]:
        """Compute all features and return normalized breakdown and raw metrics."""
        # 1. Resolve coordinates
        req_o_name, req_o_lat, req_o_lon = extract_location_info(request.origin)
        req_d_name, req_d_lat, req_d_lon = extract_location_info(request.destination)

        if request.origin_latitude is not None and request.origin_longitude is not None:
            req_o_lat, req_o_lon = request.origin_latitude, request.origin_longitude
        if request.destination_latitude is not None and request.destination_longitude is not None:
            req_d_lat, req_d_lon = request.destination_latitude, request.destination_longitude

        trip_o_lat = trip.originLatitude
        trip_o_lon = trip.originLongitude
        trip_d_lat = trip.destinationLatitude
        trip_d_lon = trip.destinationLongitude

        if trip_o_lat is None or trip_o_lon is None:
            _, trip_o_lat, trip_o_lon = extract_location_info(trip.origin)
        if trip_d_lat is None or trip_d_lon is None:
            _, trip_d_lat, trip_d_lon = extract_location_info(trip.destination)

        # Pickup distance
        if req_o_lat is not None and req_o_lon is not None and trip_o_lat is not None and trip_o_lon is not None:
            pickup_dist = haversine_distance_km(req_o_lat, req_o_lon, trip_o_lat, trip_o_lon)
        else:
            pickup_dist = 0.0 if req_o_name.lower() in trip.origin.lower() or trip.origin.lower() in req_o_name.lower() else 25.0

        # Drop distance
        if req_d_lat is not None and req_d_lon is not None and trip_d_lat is not None and trip_d_lon is not None:
            drop_dist = haversine_distance_km(req_d_lat, req_d_lon, trip_d_lat, trip_d_lon)
        else:
            drop_dist = 0.0 if req_d_name.lower() in trip.destination.lower() or trip.destination.lower() in req_d_name.lower() else 25.0

        # Time difference
        req_minutes = parse_time_to_minutes(request.departure_time)
        trip_minutes = parse_time_to_minutes(trip.departureTime)
        if req_minutes is not None and trip_minutes is not None:
            time_diff = abs(req_minutes - trip_minutes)
        else:
            time_diff = 0

        # Price difference (using authoritative current market price)
        budget = request.budget
        price = float(trip.currentMarketPrice if trip.currentMarketPrice is not None else trip.pricePerSeat)
        price_diff = (price - budget) if budget is not None else 0.0

        # Calculate scores
        route_score = cls.calculate_route_score(
            req_o_name, req_d_name, trip.origin, trip.destination, pickup_dist, drop_dist
        )
        pickup_score = cls.calculate_pickup_score(pickup_dist)
        drop_score = cls.calculate_drop_score(drop_dist)
        time_score = cls.calculate_time_score(time_diff)
        price_score = cls.calculate_price_score(budget, price)
        rating_score = cls.calculate_rating_score(float(trip.driverRating), driver_rating_count)
        vehicle_score, vehicle_matched = cls.calculate_vehicle_score(request.vehicle_preference, trip.vehicle)

        breakdown = FeatureBreakdown(
            route=route_score,
            pickup=pickup_score,
            drop=drop_score,
            time=time_score,
            price=price_score,
            rating=rating_score,
            vehicle=vehicle_score
        )

        raw = FeatureRaw(
            pickup_distance_km=pickup_dist,
            drop_distance_km=drop_dist,
            time_difference_minutes=time_diff,
            price_difference=price_diff,
            driver_average_rating=float(trip.driverRating),
            driver_rating_count=driver_rating_count,
            driver_is_new=(driver_rating_count < 2),
            vehicle_matched=vehicle_matched
        )

        return breakdown, raw

    @classmethod
    def calculate_all_features(
        cls,
        request: MatchingRequest,
        trip: TripSchema,
        driver_rating_count: int = 2
    ) -> Tuple[FeatureBreakdown, FeatureRaw, None]:
        breakdown, raw = cls.calculate_all(request, trip, driver_rating_count)
        return breakdown, raw, None
