from typing import List, Optional, Set, Dict, Any, Tuple
from supabase import Client
from backend.config import MAX_DEPARTURE_DELTA_MINUTES
from backend.schemas import TripSchema
from backend.matching.models import MatchingRequest
from backend.matching.feature_calculator import extract_location_info, parse_time_to_minutes, haversine_distance_km
import datetime
from backend.database import supabase_client, fetch_trips_from_db

def to_canonical_iso_date(date_val: Optional[str], default_year: int = 2026) -> Optional[str]:
    """
    Normalizes any date string (ISO 'YYYY-MM-DD' or legacy 'Sat, 10 Oct')
    into a canonical ISO date 'YYYY-MM-DD' without discarding the year.
    """
    if not date_val:
        return None
    val = date_val.strip()
    try:
        parts = val.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            return datetime.date.fromisoformat(val).isoformat()
    except Exception:
        pass
    try:
        clean_words = [w for w in val.replace(",", " ").split() if len(w) > 0]
        months = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }
        day, month, year = None, None, default_year
        for w in clean_words:
            low = w.lower()[:3]
            if low in months:
                month = months[low]
            elif w.isdigit():
                num = int(w)
                if num > 1900:
                    year = num
                elif 1 <= num <= 31 and day is None:
                    day = num
        if day is not None and month is not None:
            return datetime.date(year, month, day).isoformat()
    except Exception:
        pass
    return None

class CandidateFilter:
    """Filters eligible trips using database queries and strict hard constraints."""

    MAX_CANDIDATES_LIMIT = 50
    DEFAULT_TIME_WINDOW_MINUTES = MAX_DEPARTURE_DELTA_MINUTES

    @classmethod
    def get_candidate_trips(
        cls,
        request: MatchingRequest,
        client: Optional[Client] = None
    ) -> List[TripSchema]:
        """
        Database and geospatial candidate generation:
        1. Queries active trips for requested date with available seats.
        2. Broadens to date-level query if text search yields few trips to capture suburban/coordinate matches.
        3. Pre-filters by physical seat availability and status.
        4. Sorts candidates by geospatial proximity BEFORE applying LIMIT 50 to prevent arbitrary cutoff.
        """
        c = client or supabase_client
        req_o_name, req_lat, req_lon = extract_location_info(request.origin)
        req_d_name, req_dlat, req_dlon = extract_location_info(request.destination)
        if request.origin_latitude is not None and request.origin_longitude is not None:
            req_lat, req_lon = request.origin_latitude, request.origin_longitude
        if request.destination_latitude is not None and request.destination_longitude is not None:
            req_dlat, req_dlon = request.destination_latitude, request.destination_longitude

        # 1. Fetch upcoming trips for the requested date with available seats
        try:
            trips = fetch_trips_from_db(
                origin=req_o_name if len(req_o_name) > 2 else None,
                destination=req_d_name if len(req_d_name) > 2 else None,
                date=request.date,
                user_id=request.passenger_id,
                client=c
            )
        except Exception:
            trips = []

        # If strict text search returned fewer than 5 trips, fetch date-level trips
        # to allow coordinate/suburban corridor matching (e.g. Electronic City -> Bengaluru)
        if len(trips) < 5:
            try:
                date_trips = fetch_trips_from_db(
                    date=request.date,
                    user_id=request.passenger_id,
                    client=c
                )
                seen_ids = {t.id for t in trips}
                for t in date_trips:
                    if t.id not in seen_ids:
                        trips.append(t)
            except Exception:
                pass

        # 2. Useful database/geospatial pre-filtering BEFORE capping to LIMIT 50:
        # Pre-filter by seat availability and active status
        eligible_candidates = [
            t for t in trips
            if t.availableSeats >= request.seats and t.status == "upcoming"
        ]

        # 3. Geospatial proximity sorting (closest origin/dest offsets ranked first)
        def rough_spatial_distance(trip: TripSchema) -> float:
            t_olat = trip.originLatitude
            t_olon = trip.originLongitude
            t_dlat = trip.destinationLatitude
            t_dlon = trip.destinationLongitude
            if t_olat is None or t_olon is None:
                _, t_olat, t_olon = extract_location_info(trip.origin)
            if t_dlat is None or t_dlon is None:
                _, t_dlat, t_dlon = extract_location_info(trip.destination)

            dist = 0.0
            if req_lat is not None and req_lon is not None and t_olat is not None and t_olon is not None:
                dist += haversine_distance_km(req_lat, req_lon, t_olat, t_olon)
            if req_dlat is not None and req_dlon is not None and t_dlat is not None and t_dlon is not None:
                dist += haversine_distance_km(req_dlat, req_dlon, t_dlat, t_dlon)
            return dist

        eligible_candidates.sort(key=rough_spatial_distance)

        # 4. Apply LIMIT 50 AFTER useful database/geospatial filtering and sorting
        return eligible_candidates[:cls.MAX_CANDIDATES_LIMIT]

    @classmethod
    def get_passenger_existing_bookings(
        cls,
        passenger_id: Optional[str],
        client: Optional[Client] = None
    ) -> Set[str]:
        """Fetch set of trip_ids where passenger already has a confirmed booking."""
        if not passenger_id:
            return set()
        c = client or supabase_client
        try:
            res = c.table("bookings").select("trip_id").eq("passenger_id", passenger_id).eq("booking_status", "confirmed").execute()
            if res.data:
                return {str(r["trip_id"]) for r in res.data}
        except Exception:
            pass
        return set()

    @classmethod
    def get_driver_rating_counts(
        cls,
        driver_ids: List[str],
        client: Optional[Client] = None
    ) -> Dict[str, int]:
        """
        Batched retrieval of driver rating counts to eliminate N+1 queries.
        Checks rating_count column on profiles or counts completed reviews.
        """
        if not driver_ids:
            return {}
        c = client or supabase_client
        counts: Dict[str, int] = {d: 0 for d in driver_ids}

        # 1. Try querying rating_count from profiles
        try:
            prof_res = c.table("profiles").select("id, rating_count, trips_count").in_("id", driver_ids).execute()
            if prof_res.data:
                for row in prof_res.data:
                    d_id = str(row["id"])
                    r_count = row.get("rating_count")
                    if r_count is not None:
                        counts[d_id] = int(r_count)
                    else:
                        # Fallback based on trips_count if rating_count not yet migrated
                        t_count = int(row.get("trips_count") or 0)
                        counts[d_id] = min(t_count, 2)
        except Exception:
            pass

        return counts

    @classmethod
    def apply_hard_constraints(
        cls,
        trip: TripSchema,
        request: MatchingRequest,
        existing_booked_trip_ids: Set[str]
    ) -> Tuple[bool, str]:
        """
        Applies hard constraints to eliminate impossible trips:
        1. Trip is active / upcoming.
        2. Trip is not cancelled.
        3. Trip date matches passenger requested date.
        4. Trip has enough available seats: availableSeats >= seats needed.
        5. Driver is valid and owns/is associated with trip.
        6. Vehicle associated with trip is valid.
        7. Trip is not completed.
        8. Passenger cannot book their own trip: passenger_id != driverId.
        9. Passenger must not already have an active booking on the same trip.
        10. Departure time is within acceptable window.
        11. Budget constraint: price within reasonable tolerance (e.g. <= budget * 1.25).
        """
        # Constraint 1 & 2 & 7: Status must be upcoming
        if trip.status != "upcoming":
            return False, f"Trip status is '{trip.status}', not upcoming"

        # Constraint 3: Canonical ISO Date match (YYYY-MM-DD)
        if request.date and trip.date:
            req_iso = to_canonical_iso_date(request.date)
            trip_iso = to_canonical_iso_date(trip.date)
            if req_iso and trip_iso:
                if req_iso != trip_iso:
                    return False, f"Date mismatch: requested {req_iso}, trip is {trip_iso}"
            else:
                clean_req_date = request.date.lower().replace(" ", "").replace(",", "")
                clean_trip_date = trip.date.lower().replace(" ", "").replace(",", "")
                if clean_req_date != clean_trip_date and clean_req_date not in clean_trip_date and clean_trip_date not in clean_req_date:
                    return False, f"Date mismatch: requested {request.date}, trip is {trip.date}"

        # Constraint 4: Available seats
        if trip.availableSeats < request.seats:
            return False, f"Insufficient seats: requested {request.seats}, available {trip.availableSeats}"

        # Constraint 5: Driver is valid
        if not trip.driverId or not trip.driverId.strip():
            return False, "Invalid driver: missing driverId"

        # Constraint 6: Vehicle is valid
        if not trip.vehicle:
            return False, "Invalid vehicle: missing vehicle information"

        # Constraint 8: Passenger cannot book own trip
        if request.passenger_id and str(request.passenger_id) == str(trip.driverId):
            return False, "Passenger cannot book their own trip"

        # Constraint 9: No duplicate active booking
        if request.passenger_id and str(trip.id) in existing_booked_trip_ids:
            return False, "Passenger already has an active booking on this trip"

        # Constraint 10: Departure time window (configurable via request or env)
        time_limit = request.max_time_difference_minutes if getattr(request, "max_time_difference_minutes", None) is not None else cls.DEFAULT_TIME_WINDOW_MINUTES
        req_minutes = parse_time_to_minutes(request.departure_time)
        trip_minutes = parse_time_to_minutes(trip.departureTime)
        if req_minutes is not None and trip_minutes is not None:
            time_diff = abs(req_minutes - trip_minutes)
            if time_diff > time_limit:
                return False, f"Departure time outside acceptable window ({time_diff} min diff > {time_limit} min limit)"

        # Constraint 11: Maximum budget flexibility check (e.g. reject if authoritative price > 25% over budget)
        if request.budget is not None and request.budget > 0:
            price = float(trip.currentMarketPrice if trip.currentMarketPrice is not None else trip.pricePerSeat)
            if price > request.budget * 1.25:
                return False, f"Price ₹{price} exceeds maximum budget tolerance ₹{request.budget * 1.25}"

        return True, "Eligible"

Tuple_Constraint_Result = tuple[bool, str]
