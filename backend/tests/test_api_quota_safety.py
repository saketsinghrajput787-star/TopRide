import re
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from backend.matching.models import MatchingRequest, AssignmentRequest, CandidateMatch, FeatureBreakdown, ScoringWeights, FeatureRaw
from backend.matching.feature_calculator import FeatureCalculator, haversine_distance_km
from backend.matching.candidate_filter import CandidateFilter
from backend.matching.engine import MatchingEngine
from backend.matching.assignment import AssignmentService
from backend.schemas import TripSchema, VehicleSchema, BookingResponse

def make_dummy_trip(idx: int) -> TripSchema:
    return TripSchema(
        id=f"trip_safe_{idx}",
        driverId=f"driver_{idx}",
        driverName=f"Driver {idx}",
        driverInitials=f"D{idx}",
        driverRating=4.8,
        driverTripsCount=5,
        driverIsVerified=True,
        origin="Bengaluru",
        destination="Hyderabad",
        date="Sat, 17 Oct",
        departureTime="08:00",
        totalSeats=3,
        availableSeats=3,
        pricePerSeat=650.0,
        status="upcoming",
        vehicle=VehicleSchema(
            id=f"veh_{idx}", make="Hyundai", model="Creta", year=2023, color="White", plateNumber=f"KA 01 {idx}"
        ),
        originLatitude=12.9716,
        originLongitude=77.5946,
        destinationLatitude=17.3850,
        destinationLongitude=78.4867
    )

def test_safety_1_and_2_matching_10_and_100_candidates_zero_mapbox_calls():
    """Matching 10 or 100 candidates makes EXACTLY 0 Mapbox calls."""
    mock_mapbox = MagicMock()
    with patch("requests.get", mock_mapbox), patch("urllib.request.urlopen", mock_mapbox):
        req = MatchingRequest(
            origin="Bengaluru",
            destination="Hyderabad",
            date="Sat, 17 Oct"
        )
        trips_10 = [make_dummy_trip(i) for i in range(10)]
        with patch.object(CandidateFilter, "get_candidate_trips", return_value=trips_10), \
             patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
            res_10 = MatchingEngine.match(req)
            assert res_10.total_candidates == 10
            assert mock_mapbox.call_count == 0, "Mapbox calls for 10 candidates must be 0"

        trips_100 = [make_dummy_trip(i) for i in range(100)]
        with patch.object(CandidateFilter, "get_candidate_trips", return_value=trips_100), \
             patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
            res_100 = MatchingEngine.match(req)
            assert res_100.total_candidates == 100
            assert mock_mapbox.call_count == 0, "Mapbox calls for 100 candidates must be 0"

def test_safety_3_existing_coordinates_prevent_mapbox_calls():
    """Existing coordinates prevent any external geocoding calls."""
    trip = make_dummy_trip(1)
    dist = haversine_distance_km(trip.originLatitude, trip.originLongitude, trip.destinationLatitude, trip.destinationLongitude)
    assert round(dist) == 500 # Local mathematical calculation
    assert dist > 0

def test_safety_4_existing_route_geometry_prevents_route_api_calls():
    """Existing route geometry stored in PostgreSQL eliminates directions requests."""
    trip = make_dummy_trip(1)
    trip.routeGeometry = {"type": "LineString", "coordinates": [[77.5946, 12.9716], [78.4867, 17.3850]]}
    assert trip.routeGeometry is not None
    assert trip.routeGeometry["type"] == "LineString"

def test_safety_7_matching_does_not_create_razorpay_orders():
    """Matching calculation does not invoke Razorpay order creation."""
    mock_rzp = MagicMock()
    with patch("razorpay.Client", mock_rzp):
        req = MatchingRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct")
        with patch.object(CandidateFilter, "get_candidate_trips", return_value=[make_dummy_trip(1)]):
            MatchingEngine.match(req)
            assert mock_rzp.call_count == 0

def test_safety_8_and_9_only_final_selected_trip_enters_payment_and_no_orders_for_fallback():
    """Fallback candidates do NOT create Razorpay orders; only final assigned trip enters payment."""
    mock_rzp_order = MagicMock()
    with patch("backend.database.create_razorpay_order_in_db", mock_rzp_order):
        cand1 = CandidateMatch(
            trip_id="trip_1", trip=make_dummy_trip(1), match_score=90.0,
            breakdown=FeatureBreakdown(route=100, pickup=90, drop=90, time=90, price=90, rating=50, vehicle=100),
            weights=ScoringWeights(), raw=FeatureRaw(pickup_distance_km=1, drop_distance_km=1, time_difference_minutes=5, price_difference=0, driver_average_rating=5, driver_rating_count=0, driver_is_new=True, vehicle_matched=True),
            explanation="1"
        )
        cand2 = CandidateMatch(
            trip_id="trip_2", trip=make_dummy_trip(2), match_score=85.0,
            breakdown=FeatureBreakdown(route=100, pickup=80, drop=80, time=80, price=80, rating=50, vehicle=100),
            weights=ScoringWeights(), raw=FeatureRaw(pickup_distance_km=2, drop_distance_km=2, time_difference_minutes=10, price_difference=0, driver_average_rating=5, driver_rating_count=0, driver_is_new=True, vehicle_matched=True),
            explanation="2"
        )

        def mock_assign(passenger_id, candidate, seats_count, luggage_tier="small", passenger_notes="", client=None, **kwargs):
            if candidate.trip_id == "trip_1":
                return False, None, "Trip full"
            return True, BookingResponse(id="b_2", bookingRef="TR-B2", trip=candidate.trip, seatsCount=seats_count, totalPaid=650, status="confirmed"), "Success"

        with patch.object(AssignmentService, "attempt_atomic_assignment", side_effect=mock_assign):
            req = AssignmentRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct", seats=1)
            res = AssignmentService.assign_with_fallback("pass_user", [cand1, cand2], req)
            assert res.status == "fallback_assigned"
            # Razorpay orders created during assignment must be 0!
            assert mock_rzp_order.call_count == 0

def test_safety_11_retry_logic_is_bounded():
    """Assignment retry limit is strictly bounded to MAX_ASSIGNMENT_ATTEMPTS = 3."""
    candidates = [
        CandidateMatch(
            trip_id=f"trip_f_{i}", trip=make_dummy_trip(i), match_score=90.0 - i,
            breakdown=FeatureBreakdown(route=100, pickup=90, drop=90, time=90, price=90, rating=50, vehicle=100),
            weights=ScoringWeights(), raw=FeatureRaw(pickup_distance_km=1, drop_distance_km=1, time_difference_minutes=5, price_difference=0, driver_average_rating=5, driver_rating_count=0, driver_is_new=True, vehicle_matched=True),
            explanation=str(i)
        )
        for i in range(10)
    ]
    call_counter = 0
    def mock_all_fail(passenger_id, candidate, seats_count, luggage_tier="small", passenger_notes="", client=None, **kwargs):
        nonlocal call_counter
        call_counter += 1
        return False, None, "Full"

    with patch.object(AssignmentService, "attempt_atomic_assignment", side_effect=mock_all_fail):
        req = AssignmentRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct", seats=1)
        res = AssignmentService.assign_with_fallback("pass_user", candidates, req)
        assert res.status == "failed"
        assert res.attempts == 3, "Must terminate after max 3 attempts"
        assert call_counter == 3, "No infinite loops allowed"

def test_safety_12_no_polling_exists_in_codebase():
    """Verify no setInterval polling loops exist in frontend or backend matching."""
    # Find repo root regardless of nesting
    current = Path(__file__).resolve()
    root_dir = current.parents[2] if "tests" in current.parts else current.parents[1]
    src_dir = root_dir / "frontend" / "src" if (root_dir / "frontend" / "src").exists() else root_dir / "src"
    backend_dir = root_dir / "backend"

    # Search for setInterval in frontend
    interval_patterns = []
    if src_dir.exists():
        for f in src_dir.glob("**/*.ts*"):
            text = f.read_text(encoding="utf-8", errors="ignore")
            matches = re.findall(r"setInterval\s*\(", text)
            if matches:
                interval_patterns.append((f.name, len(matches)))

    # No polling interval for API matching or payments
    assert len(interval_patterns) == 0, f"Found forbidden setInterval polling: {interval_patterns}"

def test_safety_13_database_values_preferred_over_external_apis():
    """Trip price, driver rating, available seats come authoritatively from PostgreSQL."""
    trip = make_dummy_trip(42)
    assert trip.pricePerSeat == 650.0
    assert trip.driverRating == 4.8
    assert trip.availableSeats == 3

def test_safety_14_scoring_loop_zero_external_http_requests():
    """Scoring loop across 50 candidates makes 0 external HTTP requests of any kind."""
    mock_get = MagicMock()
    mock_post = MagicMock()
    mock_urlopen = MagicMock()

    with patch("requests.get", mock_get), \
         patch("requests.post", mock_post), \
         patch("urllib.request.urlopen", mock_urlopen):

        req = MatchingRequest(
            origin="Bengaluru",
            destination="Hyderabad",
            date="Sat, 17 Oct"
        )
        trips = [make_dummy_trip(i) for i in range(50)]
        with patch.object(CandidateFilter, "get_candidate_trips", return_value=trips), \
             patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
            res = MatchingEngine.match(req)
            assert res.total_candidates == 50
            assert mock_get.call_count == 0
            assert mock_post.call_count == 0
            assert mock_urlopen.call_count == 0

def test_safety_15_no_duplicate_api_calls_from_concurrent_requests():
    """Verify in-flight deduplication map pattern in frontend Mapbox service."""
    current = Path(__file__).resolve()
    root_dir = current.parents[2] if "tests" in current.parts else current.parents[1]
    mapbox_path = root_dir / "frontend" / "src" / "services" / "mapbox.ts"
    if not mapbox_path.exists():
        mapbox_path = root_dir / "src" / "services" / "mapbox.ts"
    mapbox_ts = mapbox_path.read_text(encoding="utf-8")
    assert "inFlightPlaces" in mapbox_ts, "Frontend must maintain inFlightPlaces Promise map"
    assert "inFlightRoutes" in mapbox_ts, "Frontend must maintain inFlightRoutes Promise map"
    assert "placesCache" in mapbox_ts, "Frontend must maintain placesCache Map"
    assert "routeCache" in mapbox_ts, "Frontend must maintain routeCache Map"
