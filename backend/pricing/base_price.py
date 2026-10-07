from typing import Optional, Any, Union, Dict
from backend.config import (
    BASE_PRICE_PER_KM, BASE_PRICE_PER_MINUTE, MINIMUM_PLATFORM_PRICE, PRICE_ROUNDING_UNIT
)
from backend.matching.feature_calculator import (
    haversine_distance_km, extract_location_info
)

# Configurable platform benchmark intercity corridor driving distances in kilometers.
# NOTE: These values are developer-defined platform baseline distances (derived from standard
# National Highway corridor geometries such as NH44, NH48, etc.), NOT empirical market survey rates.
# They serve as platform baseline geometry anchors when external geocoding is bypassed.
PLATFORM_BENCHMARK_CORRIDOR_DISTANCES = {
    ("bengaluru", "hyderabad"): 560.0,
    ("hyderabad", "bengaluru"): 560.0,
    ("bengaluru", "mysuru"): 145.0,
    ("mysuru", "bengaluru"): 145.0,
    ("bengaluru", "chennai"): 345.0,
    ("chennai", "bengaluru"): 345.0,
    ("mumbai", "pune"): 150.0,
    ("pune", "mumbai"): 150.0,
    ("delhi", "jaipur"): 280.0,
    ("jaipur", "delhi"): 280.0,
    ("delhi", "agra"): 230.0,
    ("agra", "delhi"): 230.0,
}
# Backward-compatibility alias
BENCHMARK_CORRIDOR_DISTANCES = PLATFORM_BENCHMARK_CORRIDOR_DISTANCES

VEHICLE_CATEGORY_FACTORS = {
    "hatchback": 0.95,
    "compact": 0.95,
    "sedan": 1.00,
    "suv": 1.05,
    "muv": 1.05,
    "premium": 1.15,
    "luxury": 1.20,
}

def parse_duration_string_to_minutes(duration_str: Optional[str]) -> Optional[int]:
    """Parse duration like '8h 30m', '3h', '45m' to total minutes."""
    if not duration_str or not duration_str.strip():
        return None
    cleaned = duration_str.strip().lower()
    total_minutes = 0
    try:
        if "h" in cleaned:
            parts = cleaned.split("h")
            hours = int(parts[0].strip().split()[-1])
            total_minutes += hours * 60
            if len(parts) > 1 and "m" in parts[1]:
                mins = int(parts[1].replace("m", "").strip())
                total_minutes += mins
        elif "m" in cleaned:
            mins = int(cleaned.replace("m", "").replace("mins", "").strip())
            total_minutes += mins
        elif ":" in cleaned:
            parts = cleaned.split(":")
            total_minutes = int(parts[0]) * 60 + int(parts[1])
        return total_minutes if total_minutes > 0 else None
    except Exception:
        return None

def resolve_vehicle_category_factor(vehicle: Any) -> float:
    """Resolve vehicle operating cost multiplier from vehicle schema, dict, or string."""
    if not vehicle:
        return 1.00
    if isinstance(vehicle, str):
        v_str = vehicle.lower()
        for cat, factor in VEHICLE_CATEGORY_FACTORS.items():
            if cat in v_str:
                return factor
        return 1.00

    make = str(getattr(vehicle, "make", "") or (vehicle.get("make") if isinstance(vehicle, dict) else "")).lower()
    model = str(getattr(vehicle, "model", "") or (vehicle.get("model") if isinstance(vehicle, dict) else "")).lower()
    combined = f"{make} {model}".strip()

    suv_keywords = ["suv", "creta", "harrier", "seltos", "scorpio", "innova", "xuv", "brezza", "nexon", "safari", "fortuner"]
    luxury_keywords = ["audi", "bmw", "mercedes", "jaguar", "lexus", "volvo", "camry"]
    hatch_keywords = ["hatchback", "baleno", "swift", "i20", "tiago", "alto", "polo", "wagonr"]

    if any(k in combined for k in luxury_keywords):
        return VEHICLE_CATEGORY_FACTORS["luxury"]
    if any(k in combined for k in suv_keywords):
        return VEHICLE_CATEGORY_FACTORS["suv"]
    if any(k in combined for k in hatch_keywords):
        return VEHICLE_CATEGORY_FACTORS["hatchback"]
    return VEHICLE_CATEGORY_FACTORS["sedan"]

class BasePriceEngine:
    """Calculates deterministic base market price based on route economics."""

    @classmethod
    def resolve_route_distance_km(
        cls,
        origin_name: str,
        dest_name: str,
        origin_lat: Optional[float] = None,
        origin_lon: Optional[float] = None,
        dest_lat: Optional[float] = None,
        dest_lon: Optional[float] = None,
        stored_distance_km: Optional[float] = None
    ) -> float:
        """
        Resolve route distance in km adhering to priority:
        1. Existing stored route distance
        2. Known benchmark corridor distances
        3. Coordinates with road circuity factor (1.25)
        4. Default fallback distance
        Zero Mapbox calls.
        """
        # 1. Existing stored distance
        if stored_distance_km is not None and stored_distance_km > 0:
            return float(stored_distance_km)

        clean_o = origin_name.lower().strip()
        clean_d = dest_name.lower().strip()

        # 2. Known benchmark corridor lookup
        for (bo, bd), dist in BENCHMARK_CORRIDOR_DISTANCES.items():
            if bo in clean_o and bd in clean_d:
                return dist

        # 3. Coordinate calculation with road circuity factor (1.25)
        if origin_lat is not None and origin_lon is not None and dest_lat is not None and dest_lon is not None:
            great_circle = haversine_distance_km(origin_lat, origin_lon, dest_lat, dest_lon)
            # Highway driving distance is typically 1.25x great-circle line
            return round(great_circle * 1.25, 1)

        # Try resolving coordinates from city name
        _, o_lat, o_lon = extract_location_info(origin_name)
        _, d_lat, d_lon = extract_location_info(dest_name)
        if o_lat is not None and o_lon is not None and d_lat is not None and d_lon is not None:
            great_circle = haversine_distance_km(o_lat, o_lon, d_lat, d_lon)
            return round(great_circle * 1.25, 1)

        # 4. Conservative fallback distance
        return 120.0

    @classmethod
    def resolve_route_duration_minutes(
        cls,
        distance_km: float,
        stored_duration_str: Optional[str] = None
    ) -> int:
        """Estimate driving duration in minutes from stored string or distance."""
        parsed = parse_duration_string_to_minutes(stored_duration_str)
        if parsed is not None:
            return parsed
        # Average intercity highway speed ~65 km/h
        hours = distance_km / 65.0
        return max(30, int(round(hours * 60)))

    @classmethod
    def calculate_base_price(
        cls,
        origin_name: Optional[str] = None,
        dest_name: Optional[str] = None,
        origin_lat: Optional[float] = None,
        origin_lon: Optional[float] = None,
        dest_lat: Optional[float] = None,
        dest_lon: Optional[float] = None,
        stored_distance_km: Optional[float] = None,
        stored_duration_str: Optional[str] = None,
        vehicle: Any = None,
        origin: Optional[str] = None,
        destination: Optional[str] = None,
        vehicle_category: Any = None,
        duration_str: Optional[str] = None,
        route_distance_km: Optional[float] = None,
        route_duration_minutes: Optional[float] = None,
        **kwargs: Any
    ) -> float:
        """
        Calculate fundamental base market price per seat:
        base_price = max(MINIMUM_PLATFORM_PRICE, (D * rate_km) + (T * rate_min)) * vehicle_factor
        """
        o_name = origin or origin_name or ""
        d_name = destination or dest_name or ""
        veh = vehicle if vehicle is not None else vehicle_category
        dur_str = duration_str or stored_duration_str
        dist_in = route_distance_km if route_distance_km is not None else stored_distance_km

        dist_km = cls.resolve_route_distance_km(
            o_name, d_name, origin_lat, origin_lon, dest_lat, dest_lon, dist_in
        )
        if route_duration_minutes is not None:
            dur_mins = int(round(route_duration_minutes))
        else:
            dur_mins = cls.resolve_route_duration_minutes(dist_km, dur_str)
        vehicle_factor = resolve_vehicle_category_factor(veh)

        raw_cost = (dist_km * BASE_PRICE_PER_KM) + (dur_mins * BASE_PRICE_PER_MINUTE)
        adjusted = max(MINIMUM_PLATFORM_PRICE, raw_cost) * vehicle_factor

        # Round to nearest currency unit
        rounded = round(adjusted / PRICE_ROUNDING_UNIT) * PRICE_ROUNDING_UNIT
        return float(rounded)
