import datetime
from typing import Optional, Tuple, Dict, Any, List
from supabase import Client
from backend.config import MARKET_GEO_RADIUS_KM
from backend.matching.feature_calculator import (
    haversine_distance_km, extract_location_info, parse_time_to_minutes
)
from backend.database import supabase_client

def parse_time_bucket(departure_time_str: Optional[str]) -> str:
    """Categorize departure time into morning, afternoon, evening, or night bucket."""
    mins = parse_time_to_minutes(departure_time_str)
    if mins is None:
        return "morning"
    hours = mins // 60
    if 6 <= hours < 12:
        return "morning"
    elif 12 <= hours < 17:
        return "afternoon"
    elif 17 <= hours < 22:
        return "evening"
    else:
        return "night"

def calculate_hours_to_departure(date_str: str, time_str: Optional[str]) -> float:
    """
    Calculate hours remaining from current UTC time to departure.
    Handles ISO dates (2026-10-17), formatted dates ('Sat, 17 Oct'), and default fallbacks.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    target_dt = None

    # Try ISO date format first
    try:
        if "-" in date_str and len(date_str.split("-")[0]) == 4:
            parts = date_str.split("-")
            year = int(parts[0])
            month = int(parts[1])
            day = int(parts[2].split("T")[0])
            dep_mins = parse_time_to_minutes(time_str) or (8 * 60)
            target_dt = datetime.datetime(year, month, day, dep_mins // 60, dep_mins % 60, tzinfo=datetime.timezone.utc)
    except Exception:
        target_dt = None

    # Try formatted date e.g. "Sat, 17 Oct"
    if target_dt is None:
        try:
            clean_date = date_str.replace(",", "").strip()
            tokens = clean_date.split()
            # Look for month and day
            months = {"jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12}
            day = None
            month = None
            year = now.year
            for t in tokens:
                if t.isdigit() and 1 <= int(t) <= 31:
                    day = int(t)
                elif t.lower()[:3] in months:
                    month = months[t.lower()[:3]]
                elif t.isdigit() and len(t) == 4:
                    year = int(t)
            if day and month:
                dep_mins = parse_time_to_minutes(time_str) or (8 * 60)
                target_dt = datetime.datetime(year, month, day, dep_mins // 60, dep_mins % 60, tzinfo=datetime.timezone.utc)
        except Exception:
            target_dt = None

    if target_dt is not None:
        delta_seconds = (target_dt - now).total_seconds()
        # Return at least 0.0 hours
        return max(0.0, delta_seconds / 3600.0)

    # Safe default for upcoming scheduled carpool if unparseable
    return 48.0

class MarketAnalyzer:
    """Aggregates market demand and supply across geographic market segments."""

    @classmethod
    def is_location_in_zone(
        cls,
        loc_name: str,
        loc_lat: Optional[float],
        loc_lon: Optional[float],
        zone_name: str,
        zone_lat: Optional[float],
        zone_lon: Optional[float]
    ) -> bool:
        """Determines if a location belongs to a market geographic zone."""
        # 1. Coordinate proximity check (within 40km)
        if loc_lat is not None and loc_lon is not None and zone_lat is not None and zone_lon is not None:
            dist = haversine_distance_km(loc_lat, loc_lon, zone_lat, zone_lon)
            return dist <= MARKET_GEO_RADIUS_KM

        # 2. Local coordinate fallback
        _, l_lat, l_lon = extract_location_info(loc_name)
        _, z_lat, z_lon = extract_location_info(zone_name)
        if l_lat is not None and l_lon is not None and z_lat is not None and z_lon is not None:
            dist = haversine_distance_km(l_lat, l_lon, z_lat, z_lon)
            return dist <= MARKET_GEO_RADIUS_KM

        # 3. Substring / Token matching
        clean_l = loc_name.lower().strip()
        clean_z = zone_name.lower().strip()
        return clean_l in clean_z or clean_z in clean_l

    @classmethod
    def aggregate_market_supply_and_demand(
        cls,
        origin_name: str,
        dest_name: str,
        date_str: str,
        origin_lat: Optional[float] = None,
        origin_lon: Optional[float] = None,
        dest_lat: Optional[float] = None,
        dest_lon: Optional[float] = None,
        client: Optional[Client] = None
    ) -> Tuple[int, int, float]:
        """
        Aggregate active demand and supply for a market segment from PostgreSQL:
        Returns: (demand_count, supply_seats, demand_supply_ratio)
        """
        c = client or supabase_client
        demand_count = 0
        supply_seats = 0

        # Resolve zone coordinates
        if origin_lat is None or origin_lon is None:
            _, origin_lat, origin_lon = extract_location_info(origin_name)
        if dest_lat is None or dest_lon is None:
            _, dest_lat, dest_lon = extract_location_info(dest_name)

        # 1. Fetch upcoming trips on date to calculate supply (active eligible seats only)
        seen_trip_ids = set()
        try:
            trips_res = c.table("trips").select("id, origin, destination, origin_latitude, origin_longitude, destination_latitude, destination_longitude, available_seats, status").eq("date", date_str).eq("status", "upcoming").execute()
            if trips_res.data:
                for t in trips_res.data:
                    t_id = str(t.get("id", ""))
                    if t_id and t_id in seen_trip_ids:
                        continue
                    if t_id:
                        seen_trip_ids.add(t_id)

                    # Strictly exclude non-upcoming or ineligible trips
                    if t.get("status") != "upcoming":
                        continue

                    seats = int(t.get("available_seats") or 0)
                    if seats <= 0:
                        continue

                    t_orig = t.get("origin", "")
                    t_dest = t.get("destination", "")
                    t_olat = t.get("origin_latitude")
                    t_olon = t.get("origin_longitude")
                    t_dlat = t.get("destination_latitude")
                    t_dlon = t.get("destination_longitude")

                    if cls.is_location_in_zone(t_orig, t_olat, t_olon, origin_name, origin_lat, origin_lon) and \
                       cls.is_location_in_zone(t_dest, t_dlat, t_dlon, dest_name, dest_lat, dest_lon):
                        supply_seats += seats
        except Exception as e:
            print(f"[Pricing] Supply aggregation notice: {e}")

        # 2. Fetch active passenger requests on date to calculate demand (exclude cancelled, expired, completed, fulfilled, duplicate, invalid)
        seen_request_ids = set()
        try:
            reqs_res = c.table("passenger_requests").select("id, origin, destination, origin_latitude, origin_longitude, destination_latitude, destination_longitude, seats_needed, status").eq("date", date_str).eq("status", "active").execute()
            if reqs_res.data:
                for r in reqs_res.data:
                    r_id = str(r.get("id", ""))
                    if r_id and r_id in seen_request_ids:
                        continue
                    if r_id:
                        seen_request_ids.add(r_id)

                    # Strictly exclude non-active or invalid requests
                    if r.get("status") != "active":
                        continue

                    needed = int(r.get("seats_needed") or 0)
                    if needed <= 0:
                        continue

                    r_orig = r.get("origin", "")
                    r_dest = r.get("destination", "")
                    r_olat = r.get("origin_latitude")
                    r_olon = r.get("origin_longitude")
                    r_dlat = r.get("destination_latitude")
                    r_dlon = r.get("destination_longitude")

                    if cls.is_location_in_zone(r_orig, r_olat, r_olon, origin_name, origin_lat, origin_lon) and \
                       cls.is_location_in_zone(r_dest, r_dlat, r_dlon, dest_name, dest_lat, dest_lon):
                        demand_count += needed
        except Exception as e:
            print(f"[Pricing] Demand aggregation notice: {e}")

        # DSR = demand / max(supply, 1)
        dsr = round(float(demand_count) / max(float(supply_seats), 1.0), 2)
        return demand_count, supply_seats, dsr
