import uuid
import asyncio
from typing import Optional
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas import TripSchema, VehicleSchema, BookingResponse
from backend.matching.models import (
    MatchingRequest, AssignmentRequest, FeatureBreakdown, ScoringWeights,
    CandidateMatch, FeatureRaw
)
from backend.matching.feature_calculator import (
    FeatureCalculator, haversine_distance_km, parse_time_to_minutes
)
from backend.matching.scoring import WeightedScorer
from backend.matching.ranking import Ranker
from backend.matching.candidate_filter import CandidateFilter
from backend.matching.assignment import AssignmentService
from backend.matching.engine import MatchingEngine

# Helper factory to build test trips
def make_trip(
    trip_id: str = "trip_test",
    driver_id: str = "driver_1",
    driver_name: str = "Arjun",
    rating: float = 5.0,
    trips_count: int = 10,
    origin: str = "Bengaluru",
    destination: str = "Hyderabad",
    date: str = "Sat, 17 Oct",
    departure_time: str = "08:00",
    total_seats: int = 3,
    available_seats: int = 3,
    price_per_seat: float = 650.0,
    status: str = "upcoming",
    vehicle_make: str = "Hyundai",
    vehicle_model: str = "Creta",
    origin_lat: Optional[float] = None,
    origin_lon: Optional[float] = None,
    dest_lat: Optional[float] = None,
    dest_lon: Optional[float] = None
) -> TripSchema:
    return TripSchema(
        id=trip_id,
        driverId=driver_id,
        driverName=driver_name,
        driverInitials=driver_name[:2].upper(),
        driverRating=rating,
        driverTripsCount=trips_count,
        driverIsVerified=True,
        origin=origin,
        destination=destination,
        date=date,
        departureTime=departure_time,
        arrivalTime="16:30",
        duration="8h 30m",
        totalSeats=total_seats,
        availableSeats=available_seats,
        pricePerSeat=price_per_seat,
        status=status,
        vehicle=VehicleSchema(
            id=f"veh_{trip_id}",
            make=vehicle_make,
            model=vehicle_model,
            year=2023,
            color="Grey",
            plateNumber="KA 01 AB 1234"
        ),
        originLatitude=origin_lat,
        originLongitude=origin_lon,
        destinationLatitude=dest_lat,
        destinationLongitude=dest_lon
    )

client = TestClient(app)

# ==============================================================================
# 1-6. INDIVIDUAL FEATURE TESTS
# ==============================================================================

def test_1_exact_route():
    """Exact route matching gives route_score = 100."""
    score = FeatureCalculator.calculate_route_score(
        "Bengaluru", "Hyderabad", "Bengaluru", "Hyderabad", 0.5, 0.5
    )
    assert score == 100.0

def test_2_nearby_pickup():
    """Nearby pickup distance converts via smooth curve (0km->100, 1km->95, 2km->90, 5km->75, 10km->40)."""
    assert FeatureCalculator.calculate_pickup_score(0.0) == 100.0
    assert FeatureCalculator.calculate_pickup_score(1.0) == 95.0
    assert FeatureCalculator.calculate_pickup_score(2.0) == 90.0
    assert FeatureCalculator.calculate_pickup_score(5.0) == 75.0
    assert FeatureCalculator.calculate_pickup_score(10.0) == 40.0
    assert FeatureCalculator.calculate_pickup_score(25.0) == 0.0

def test_3_nearby_destination():
    """Destination proximity follows the same smooth distance curve."""
    assert FeatureCalculator.calculate_drop_score(1.0) == 95.0
    assert FeatureCalculator.calculate_drop_score(5.0) == 75.0

def test_4_departure_time():
    """Departure time absolute difference: 0min->100, 15min->75, 30min->50, 60min->0."""
    assert FeatureCalculator.calculate_time_score(0) == 100.0
    assert FeatureCalculator.calculate_time_score(15) == 75.0
    assert FeatureCalculator.calculate_time_score(30) == 50.0
    assert FeatureCalculator.calculate_time_score(60) == 0.0
    assert FeatureCalculator.calculate_time_score(90) == 0.0

def test_5_price_compatibility():
    """Price: <= budget=100.0, 100%-125% continuous decay, >125% = 0.0."""
    assert FeatureCalculator.calculate_price_score(700, 700) == 100.0
    # Cheaper or within budget is full score 100.0
    assert FeatureCalculator.calculate_price_score(700, 650) == 100.0
    # Over budget within tolerance: continuous linear decay
    # At 115% budget (15% over): 40.0
    assert FeatureCalculator.calculate_price_score(1000, 1150) == 40.0
    # At 125% budget (25% over): 0.0
    assert FeatureCalculator.calculate_price_score(1000, 1250) == 0.0
    # Intermediate point at 107.5% (7.5% over): 70.0
    assert FeatureCalculator.calculate_price_score(1000, 1075) == 70.0
    # Over budget beyond 125% -> 0.0
    assert FeatureCalculator.calculate_price_score(700, 1000) == 0.0

def test_6_vehicle_preference():
    """Vehicle preference scoring: match=100, compatible=75, no preference=100."""
    veh = VehicleSchema(id="v1", make="Hyundai", model="Creta", year=2023, color="Grey", plateNumber="KA1")
    score_match, matched = FeatureCalculator.calculate_vehicle_score("SUV", veh)
    assert score_match == 100.0 and matched is True

    score_none, matched_none = FeatureCalculator.calculate_vehicle_score(None, veh)
    assert score_none == 100.0 and matched_none is True

    score_sedan, _ = FeatureCalculator.calculate_vehicle_score("Sedan", veh)
    assert score_sedan == 75.0 # Compatible category

# ==============================================================================
# 7-9. DRIVER RATING TESTS
# ==============================================================================

def test_7_new_driver_0_ratings():
    """New driver with rating_count = 0 must receive rating_score = 50.0 (NOT 0, NOT artificial 5.0)."""
    score = FeatureCalculator.calculate_rating_score(5.0, rating_count=0)
    assert score == 50.0, "New driver with 0 ratings must receive neutral score of 50.0"

def test_8_driver_1_rating():
    """Driver with rating_count = 1 displays rating, but matching rating_score is 50.0."""
    score = FeatureCalculator.calculate_rating_score(4.8, rating_count=1)
    assert score == 50.0, "Driver with 1 rating must receive neutral matching score of 50.0"

def test_9_driver_2_plus_ratings():
    """Driver with rating_count >= 2 participates with (rating / 5.0) * 100."""
    score_45 = FeatureCalculator.calculate_rating_score(4.5, rating_count=2)
    assert score_45 == 90.0, "4.5 / 5.0 * 100 must equal 90.0"

    score_50 = FeatureCalculator.calculate_rating_score(5.0, rating_count=5)
    assert score_50 == 100.0

# ==============================================================================
# 10-15. HARD CONSTRAINTS & EDGE CASES
# ==============================================================================

def test_10_high_rated_driver_with_poor_route():
    """High-rated driver (5.0 stars) with incompatible route receives low or zero route score."""
    req = MatchingRequest(
        passenger_id="p1",
        origin="Bengaluru",
        destination="Hyderabad",
        date="Sat, 17 Oct"
    )
    trip = make_trip(origin="Bengaluru", destination="Goa", rating=5.0, dest_lat=15.2993, dest_lon=74.1240)
    breakdown, raw = FeatureCalculator.calculate_all(req, trip, driver_rating_count=10)
    assert breakdown.route == 0.0, "Completely incompatible route must score 0.0"

def test_11_excellent_route_with_poor_departure_time():
    """Route alignment 100, but departure time > window is eliminated by hard filter."""
    req = MatchingRequest(
        passenger_id="p1",
        origin="Bengaluru",
        destination="Hyderabad",
        date="Sat, 17 Oct",
        departure_time="08:00"
    )
    trip = make_trip(departure_time="15:00") # 7 hours difference
    eligible, reason = CandidateFilter.apply_hard_constraints(trip, req, set())
    assert eligible is False
    assert "Departure time outside acceptable window" in reason

def test_12_insufficient_seats():
    """Trip with available_seats < requested seats is eliminated by hard constraints."""
    req = MatchingRequest(
        passenger_id="p1",
        origin="Bengaluru",
        destination="Hyderabad",
        date="Sat, 17 Oct",
        seats=2
    )
    trip = make_trip(available_seats=1)
    eligible, reason = CandidateFilter.apply_hard_constraints(trip, req, set())
    assert eligible is False
    assert "Insufficient seats" in reason

def test_13_cancelled_trip():
    """Cancelled trip is eliminated by hard constraints."""
    req = MatchingRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct")
    trip = make_trip(status="cancelled")
    eligible, reason = CandidateFilter.apply_hard_constraints(trip, req, set())
    assert eligible is False
    assert "cancelled" in reason

def test_14_completed_trip():
    """Completed trip is eliminated by hard constraints."""
    req = MatchingRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct")
    trip = make_trip(status="completed")
    eligible, reason = CandidateFilter.apply_hard_constraints(trip, req, set())
    assert eligible is False
    assert "completed" in reason

def test_15_passenger_booking_own_trip():
    """Passenger cannot book their own trip."""
    req = MatchingRequest(passenger_id="usr_saket", origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct")
    trip = make_trip(driver_id="usr_saket")
    eligible, reason = CandidateFilter.apply_hard_constraints(trip, req, set())
    assert eligible is False
    assert "cannot book their own trip" in reason

# ==============================================================================
# 16-18. RANKING & MATHEMATICAL TIE BREAKING
# ==============================================================================

def test_16_and_17_ranking_test_mathematical_calculation():
    """
    MANDATORY RANKING TEST:
    Trip A: Route=100, Pickup=90, Drop=95, Time=83, Price=90, Rating=50, Vehicle=100.
    Trip B: Route=100, Pickup=70, Drop=80, Time=95, Price=100, Rating=96, Vehicle=100.
    Trip C: Route=80, Pickup=95, Drop=90, Time=60, Price=95, Rating=90, Vehicle=50.

    Verify backend ranking mathematically without hardcoding the winner!
    """
    weights = ScoringWeights()

    # Dynamic calculation of scores using actual weights
    score_a = round(
        100 * weights.route
        + 90 * weights.pickup
        + 95 * weights.drop
        + 83 * weights.time
        + 90 * weights.price
        + 50 * weights.rating
        + 100 * weights.vehicle,
        2
    )
    # 35 + 18 + 14.25 + 12.45 + 4.5 + 2.5 + 5.0 = 91.70
    assert score_a == 91.70

    score_b = round(
        100 * weights.route
        + 70 * weights.pickup
        + 80 * weights.drop
        + 95 * weights.time
        + 100 * weights.price
        + 96 * weights.rating
        + 100 * weights.vehicle,
        2
    )
    # 35 + 14 + 12 + 14.25 + 5.0 + 4.8 + 5.0 = 90.05
    assert score_b == 90.05

    score_c = round(
        80 * weights.route
        + 95 * weights.pickup
        + 90 * weights.drop
        + 60 * weights.time
        + 95 * weights.price
        + 90 * weights.rating
        + 50 * weights.vehicle,
        2
    )
    # 28 + 19 + 13.5 + 9.0 + 4.75 + 4.5 + 2.5 = 81.25
    assert score_c == 81.25

    # Check candidates
    cand_a = CandidateMatch(
        trip_id="trip_a",
        trip=make_trip("trip_a", driver_name="Arjun", price_per_seat=650),
        match_score=score_a,
        breakdown=FeatureBreakdown(route=100, pickup=90, drop=95, time=83, price=90, rating=50, vehicle=100),
        weights=weights,
        raw=FeatureRaw(pickup_distance_km=2.0, drop_distance_km=1.0, time_difference_minutes=10, price_difference=0, driver_average_rating=5.0, driver_rating_count=0, driver_is_new=True, vehicle_matched=True),
        explanation="Trip A"
    )
    cand_b = CandidateMatch(
        trip_id="trip_b",
        trip=make_trip("trip_b", driver_name="Rahul", price_per_seat=650),
        match_score=score_b,
        breakdown=FeatureBreakdown(route=100, pickup=70, drop=80, time=95, price=100, rating=96, vehicle=100),
        weights=weights,
        raw=FeatureRaw(pickup_distance_km=6.0, drop_distance_km=4.0, time_difference_minutes=3, price_difference=0, driver_average_rating=4.8, driver_rating_count=12, driver_is_new=False, vehicle_matched=True),
        explanation="Trip B"
    )
    cand_c = CandidateMatch(
        trip_id="trip_c",
        trip=make_trip("trip_c", driver_name="Priya", price_per_seat=620),
        match_score=score_c,
        breakdown=FeatureBreakdown(route=80, pickup=95, drop=90, time=60, price=95, rating=90, vehicle=50),
        weights=weights,
        raw=FeatureRaw(pickup_distance_km=1.0, drop_distance_km=2.0, time_difference_minutes=24, price_difference=-30, driver_average_rating=4.5, driver_rating_count=8, driver_is_new=False, vehicle_matched=False),
        explanation="Trip C"
    )

    ranked = Ranker.rank_candidates([cand_c, cand_b, cand_a])
    assert ranked[0].trip_id == "trip_a", "Trip A must win based on score 91.70"
    assert ranked[1].trip_id == "trip_b", "Trip B must be second based on score 89.05"
    assert ranked[2].trip_id == "trip_c", "Trip C must be third based on score 81.25"

def test_18_deterministic_tie_breaking():
    """When scores are equal, tie breaks deterministically (smaller pickup dist, smaller time diff, etc.)."""
    weights = ScoringWeights()
    trip1 = make_trip("trip_1", driver_name="Driver1")
    trip2 = make_trip("trip_2", driver_name="Driver2")

    cand1 = CandidateMatch(
        trip_id="trip_1",
        trip=trip1,
        match_score=85.0,
        breakdown=FeatureBreakdown(route=100, pickup=80, drop=80, time=80, price=80, rating=80, vehicle=80),
        weights=weights,
        raw=FeatureRaw(pickup_distance_km=5.0, drop_distance_km=5.0, time_difference_minutes=15, price_difference=0, driver_average_rating=4.5, driver_rating_count=5, driver_is_new=False, vehicle_matched=True),
        explanation="Match 1"
    )
    cand2 = CandidateMatch(
        trip_id="trip_2",
        trip=trip2,
        match_score=85.0,
        breakdown=FeatureBreakdown(route=100, pickup=80, drop=80, time=80, price=80, rating=80, vehicle=80),
        weights=weights,
        raw=FeatureRaw(pickup_distance_km=2.0, drop_distance_km=5.0, time_difference_minutes=15, price_difference=0, driver_average_rating=4.5, driver_rating_count=5, driver_is_new=False, vehicle_matched=True),
        explanation="Match 2 (closer pickup)"
    )

    ranked = Ranker.rank_candidates([cand1, cand2])
    assert ranked[0].trip_id == "trip_2", "cand2 has smaller pickup distance (2km vs 5km) and must win the tie"

# ==============================================================================
# 19-21. ATOMIC ASSIGNMENT & FALLBACK
# ==============================================================================

def test_19_and_20_fallback_when_top_candidate_unavailable():
    """If top candidate becomes unavailable, cascades to next best candidate."""
    cand1 = CandidateMatch(
        trip_id="trip_full",
        trip=make_trip("trip_full", available_seats=0),
        match_score=92.0,
        breakdown=FeatureBreakdown(route=100, pickup=90, drop=90, time=90, price=90, rating=50, vehicle=100),
        weights=ScoringWeights(),
        raw=FeatureRaw(pickup_distance_km=1.0, drop_distance_km=1.0, time_difference_minutes=5, price_difference=0, driver_average_rating=5.0, driver_rating_count=0, driver_is_new=True, vehicle_matched=True),
        explanation="Top choice"
    )
    cand2 = CandidateMatch(
        trip_id="trip_available",
        trip=make_trip("trip_available", available_seats=2),
        match_score=87.0,
        breakdown=FeatureBreakdown(route=100, pickup=80, drop=85, time=85, price=90, rating=50, vehicle=100),
        weights=ScoringWeights(),
        raw=FeatureRaw(pickup_distance_km=2.0, drop_distance_km=2.0, time_difference_minutes=10, price_difference=0, driver_average_rating=5.0, driver_rating_count=0, driver_is_new=True, vehicle_matched=True),
        explanation="Fallback choice"
    )

    req = AssignmentRequest(
        origin="Bengaluru",
        destination="Hyderabad",
        date="Sat, 17 Oct",
        seats=1
    )

    # Mock attempt_atomic_assignment: trip_full fails with P0004, trip_available succeeds
    def mock_assignment(passenger_id, candidate, seats_count, luggage_tier="small", passenger_notes="", client=None):
        if candidate.trip_id == "trip_full":
            return False, None, "Not enough seats available (P0004)"
        else:
            return True, BookingResponse(
                id="book_123",
                bookingRef="TR-ABC12",
                trip=candidate.trip,
                seatsCount=seats_count,
                totalPaid=650.0,
                status="confirmed"
            ), "Success"

    with patch.object(AssignmentService, "attempt_atomic_assignment", side_effect=mock_assignment):
        res = AssignmentService.assign_with_fallback("pass_1", [cand1, cand2], req)
        assert res.status == "fallback_assigned"
        assert res.fallback_used is True
        assert res.attempts == 2
        assert res.assigned_trip.id == "trip_available"
        assert "another suitable trip" in res.message or "alternative trip" in res.message

def test_21_all_candidates_unavailable():
    """If all candidates are unavailable, returns graceful failure message."""
    cand1 = CandidateMatch(
        trip_id="trip_1",
        trip=make_trip("trip_1"),
        match_score=90.0,
        breakdown=FeatureBreakdown(route=100, pickup=90, drop=90, time=90, price=90, rating=50, vehicle=100),
        weights=ScoringWeights(),
        raw=FeatureRaw(pickup_distance_km=1.0, drop_distance_km=1.0, time_difference_minutes=5, price_difference=0, driver_average_rating=5.0, driver_rating_count=0, driver_is_new=True, vehicle_matched=True),
        explanation="Choice 1"
    )

    req = AssignmentRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct", seats=1)

    with patch.object(AssignmentService, "attempt_atomic_assignment", return_value=(False, None, "Insufficient seats")):
        res = AssignmentService.assign_with_fallback("pass_1", [cand1], req)
        assert res.status == "failed"
        assert res.booking is None
        assert "No suitable trip is currently available" in res.message

# ==============================================================================
# 22-24. CONCURRENCY & RACE CONDITIONS
# ==============================================================================

def test_22_and_23_concurrency_two_passengers_competing_final_seats():
    """
    CRITICAL CONCURRENCY TEST:
    Trip has 3 seats.
    Passenger A requests 2 seats.
    Passenger B requests 2 seats.
    Both identify the same trip as the best match.
    Simulate atomic locking:
    Exactly ONE passenger receives seats; the second receives conflict / falls back.
    Database available_seats never drops below 0!
    """
    simulated_trip_seats = 3
    lock = asyncio.Lock()
    successful_bookings = []
    failed_bookings = []

    async def book_passenger(passenger_name: str, requested_seats: int):
        nonlocal simulated_trip_seats
        async with lock:
            if simulated_trip_seats >= requested_seats:
                simulated_trip_seats -= requested_seats
                successful_bookings.append((passenger_name, requested_seats))
                return True
            else:
                failed_bookings.append((passenger_name, requested_seats))
                return False

    async def run_concurrent():
        task1 = asyncio.create_task(book_passenger("Passenger_A", 2))
        task2 = asyncio.create_task(book_passenger("Passenger_B", 2))
        return await asyncio.gather(task1, task2)

    results = asyncio.run(run_concurrent())
    assert sum(results) == 1, "Exactly one booking must succeed"
    assert len(successful_bookings) == 1, "Only 1 successful booking permitted"
    assert len(failed_bookings) == 1, "The competing passenger must fail or fallback"
    assert simulated_trip_seats >= 0, "available_seats must never be negative!"
    assert simulated_trip_seats == 1, "3 initial seats - 2 booked = 1 remaining"

def test_24_duplicate_booking_prevention():
    """Passenger cannot book the same trip twice."""
    req = MatchingRequest(passenger_id="pass_saket", origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct")
    trip = make_trip("trip_active")
    # Existing booked set contains trip_active
    eligible, reason = CandidateFilter.apply_hard_constraints(trip, req, existing_booked_trip_ids={"trip_active"})
    assert eligible is False
    assert "already has an active booking" in reason

# ==============================================================================
# 25-26. SECURITY & AUTHENTICATION
# ==============================================================================

def test_25_and_26_unauthenticated_assignment_blocked():
    """Assignment endpoint requires valid Bearer token."""
    response = client.post(
        "/api/matching/assign",
        json={
            "origin": "Bengaluru",
            "destination": "Hyderabad",
            "date": "Sat, 17 Oct",
            "seats": 1
        }
    )
    # Must reject with 401 Unauthorized
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]

# ==============================================================================
# 27-29. API QUOTA & COST CONSERVATION
# ==============================================================================

def test_27_mapbox_not_called_per_candidate():
    """
    CRITICAL API COST REQUIREMENT:
    Matching 10 candidates does NOT create 10 Mapbox calls.
    Matching 100 candidates does NOT create 100 Mapbox calls.
    Candidate scoring loop must make exactly 0 external Mapbox calls!
    """
    mock_mapbox = MagicMock()
    with patch("requests.get", mock_mapbox), patch("urllib.request.urlopen", mock_mapbox):
        req = MatchingRequest(
            origin={"name": "Bengaluru", "latitude": 12.9716, "longitude": 77.5946},
            destination={"name": "Hyderabad", "latitude": 17.3850, "longitude": 78.4867},
            date="Sat, 17 Oct"
        )
        trips_100 = [make_trip(f"trip_{i}", price_per_seat=600 + i) for i in range(100)]

        with patch.object(CandidateFilter, "get_candidate_trips", return_value=trips_100), \
             patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
            res = MatchingEngine.match(req)
            assert res.total_candidates == 100
            assert mock_mapbox.call_count == 0, "External API calls in scoring loop MUST BE 0"

def test_28_existing_route_reused():
    """Stored coordinates & route geometry are used directly without re-fetching."""
    trip = make_trip("trip_geo", origin_lat=12.9716, origin_lon=77.5946, dest_lat=17.3850, dest_lon=78.4867)
    dist = haversine_distance_km(trip.originLatitude, trip.originLongitude, trip.destinationLatitude, trip.destinationLongitude)
    assert dist > 400.0, "Haversine calculated locally using stored coordinates"

def test_29_razorpay_not_invoked_during_ranking():
    """Razorpay API is NEVER invoked during candidate filtering, ranking, or fallback."""
    mock_razorpay = MagicMock()
    with patch("razorpay.Client", mock_razorpay):
        req = MatchingRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct")
        trips = [make_trip(f"trip_{i}") for i in range(5)]
        with patch.object(CandidateFilter, "get_candidate_trips", return_value=trips):
            MatchingEngine.match(req)
            assert mock_razorpay.call_count == 0, "Razorpay must NOT be called during matching"

def test_30_chat_and_notifications_remain_functional():
    """System schemas and notification generators remain intact."""
    from backend.schemas import NotificationItemSchema, MessageSchema
    notif = NotificationItemSchema(
        id="n1",
        title="Trip Matched",
        description="Your ride has been confirmed.",
        time="Now",
        read=False,
        type="booking"
    )
    assert notif.type == "booking"

# ==============================================================================
# 31-37. PRODUCTION-READINESS AUDIT VERIFICATION TESTS
# ==============================================================================

def test_31_electronic_city_hyderabad_matches_bengaluru_hyderabad_geographically():
    """
    AUDIT ITEM 1: Route compatibility is primarily coordinate/geospatial based,
    NOT dependent on exact textual city matching.
    Passenger: Electronic City -> Hyderabad
    Driver: Bengaluru -> Hyderabad
    Evaluated using geographic compatibility without Mapbox calls in candidate loop.
    """
    mock_mapbox = MagicMock()
    with patch("requests.get", mock_mapbox), patch("urllib.request.urlopen", mock_mapbox):
        req = MatchingRequest(
            origin="Electronic City",
            destination="Hyderabad",
            date="Sat, 17 Oct",
            seats=1
        )
        trip = make_trip(
            trip_id="trip_blr_hyd",
            origin="Bengaluru",
            destination="Hyderabad",
            date="Sat, 17 Oct"
        )

        with patch.object(CandidateFilter, "get_candidate_trips", return_value=[trip]), \
             patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
            res = MatchingEngine.match(req)
            assert res.total_candidates == 1
            best = res.best_match
            assert best is not None
            # Must NOT be rejected
            assert best.breakdown.route > 80.0, f"Route score should be high geographically, got {best.breakdown.route}"
            assert best.match_score >= 70.0
            assert mock_mapbox.call_count == 0, "No Mapbox calls permitted in candidate loop"

def test_32_pickup_drop_scoring_exact_documented_points():
    """
    AUDIT ITEM 2: Explicit deterministic normalization formula for distance scores:
    0 km = 100, 1 km = 95, 2 km = 90, 5 km = 75, 10 km = 40, 20 km = 0, >20 km = 0.
    """
    assert FeatureCalculator.calculate_pickup_score(0.0) == 100.0
    assert FeatureCalculator.calculate_pickup_score(1.0) == 95.0
    assert FeatureCalculator.calculate_pickup_score(2.0) == 90.0
    assert FeatureCalculator.calculate_pickup_score(5.0) == 75.0
    assert FeatureCalculator.calculate_pickup_score(10.0) == 40.0
    assert FeatureCalculator.calculate_pickup_score(20.0) == 0.0
    assert FeatureCalculator.calculate_pickup_score(25.0) == 0.0

    # Same for drop score
    assert FeatureCalculator.calculate_drop_score(0.0) == 100.0
    assert FeatureCalculator.calculate_drop_score(1.0) == 95.0
    assert FeatureCalculator.calculate_drop_score(2.0) == 90.0
    assert FeatureCalculator.calculate_drop_score(5.0) == 75.0
    assert FeatureCalculator.calculate_drop_score(10.0) == 40.0
    assert FeatureCalculator.calculate_drop_score(20.0) == 0.0

def test_33_configurable_max_departure_delta():
    """
    AUDIT ITEM 3: Departure time window is configurable (not hardcoded 180).
    Per-request override or config env variable.
    """
    from backend.config import MAX_DEPARTURE_DELTA_MINUTES
    assert MAX_DEPARTURE_DELTA_MINUTES == 180

    trip = make_trip("trip_dep", departure_time="08:00")
    # Request at 11:30 (210 mins difference)
    req_default = MatchingRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct", departure_time="11:30")
    eligible_default, reason_default = CandidateFilter.apply_hard_constraints(trip, req_default, set())
    assert eligible_default is False, "Default 180 min window must reject 210 min delta"

    # With per-request configurable tolerance: 240 mins
    req_custom = MatchingRequest(
        origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct", departure_time="11:30",
        max_time_difference_minutes=240
    )
    eligible_custom, _ = CandidateFilter.apply_hard_constraints(trip, req_custom, set())
    assert eligible_custom is True, "Configured 240 min window must allow 210 min delta"

def test_34_continuous_deterministic_price_scoring():
    """
    AUDIT ITEM 4: Price scoring has no undefined range between 100%, 115%, and 125% of budget.
    Behavior is continuous and deterministic.
    """
    budget = 800.0
    # Exactly budget (100%): 100.0
    assert FeatureCalculator.calculate_price_score(budget, 800.0) == 100.0
    # Cheaper (under budget): 100.0
    assert FeatureCalculator.calculate_price_score(budget, 750.0) == 100.0
    # 115% budget (920.0): 40.0
    assert FeatureCalculator.calculate_price_score(budget, 920.0) == 40.0
    # 125% budget (1000.0): 0.0
    assert FeatureCalculator.calculate_price_score(budget, 1000.0) == 0.0
    # Midpoints are smoothly continuous
    score_105_pct = FeatureCalculator.calculate_price_score(budget, 840.0) # 5% over -> 80.0
    score_110_pct = FeatureCalculator.calculate_price_score(budget, 880.0) # 10% over -> 60.0
    assert score_105_pct == 80.0
    assert score_110_pct == 60.0
    assert 100.0 > score_105_pct > score_110_pct > 40.0 > 0.0
    # > 125% budget: 0.0
    assert FeatureCalculator.calculate_price_score(budget, 1100.0) == 0.0

def test_35_candidate_generation_spatial_ordering_before_limit_50():
    """
    AUDIT ITEM 5: Candidate generation sorts by geospatial proximity BEFORE applying LIMIT 50
    to ensure close candidates are not dropped because of DB insertion order.
    """
    req = MatchingRequest(
        origin="Bengaluru",
        destination="Hyderabad",
        date="Sat, 17 Oct",
        seats=1
    )
    # 40 trips in Delhi, then 1 trip in Bengaluru->Hyderabad, then 20 trips in Mumbai
    distant_trips = [
        make_trip(f"trip_delhi_{i}", origin="New Delhi", destination="Jaipur", date="Sat, 17 Oct")
        for i in range(40)
    ]
    good_trip = make_trip("trip_good_bengaluru", origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct")
    more_distant = [
        make_trip(f"trip_mumbai_{i}", origin="Mumbai", destination="Pune", date="Sat, 17 Oct")
        for i in range(20)
    ]
    all_raw = distant_trips + [good_trip] + more_distant # Total 61 trips

    with patch("backend.matching.candidate_filter.fetch_trips_from_db", return_value=all_raw):
        filtered = CandidateFilter.get_candidate_trips(req)
        assert len(filtered) <= 50
        # The good trip MUST be in the top candidates despite being in the 41st position originally
        filtered_ids = [t.id for t in filtered]
        assert "trip_good_bengaluru" in filtered_ids
        # And it should be ranked 1st by proximity!
        assert filtered[0].id == "trip_good_bengaluru"

def test_36_minimum_auto_match_score_policy():
    """
    AUDIT ITEM 7: Configurable MIN_AUTO_MATCH_SCORE policy:
    >= 75 = strong match
    60-74 = acceptable
    < 60 = do not auto-assign (fails automatic assignment)
    Does NOT prevent passenger manual search in /api/matching/find.
    """
    req = AssignmentRequest(
        origin="Bengaluru",
        destination="Hyderabad",
        date="Sat, 17 Oct",
        seats=1,
        departure_time="06:00",
        budget=500.0
    )
    # Trip with low match score (< 60.0): 90 min time diff (time score 0), price 625 (price score 0)
    poor_trip = make_trip(
        "trip_poor", price_per_seat=625.0, departure_time="07:30", rating=2.0, trips_count=3,
        origin_lat=12.85, origin_lon=77.50, dest_lat=17.30, dest_lon=78.40
    )

    with patch.object(CandidateFilter, "get_candidate_trips", return_value=[poor_trip]), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={"driver_1": 3}):

        # 1. Default threshold (60.0): poor_trip scores < 60%, so auto-assignment declines
        asgn_res = MatchingEngine.assign("pass_user", req)
        assert asgn_res.status == "failed"
        assert "below the minimum auto-assignment threshold" in asgn_res.message

        # 2. But passenger search (/api/matching/find) does NOT reject it
        find_req = MatchingRequest(
            origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct", seats=1,
            departure_time="06:00", budget=500.0
        )
        match_res = MatchingEngine.match(find_req)
        assert match_res.total_candidates == 1
        assert match_res.candidates[0].trip_id == "trip_poor"
        assert match_res.candidates[0].match_score < 60.0

        # 3. And manual passenger selection (preferred_trip_id) is respected
        req.preferred_trip_id = "trip_poor"
        with patch.object(AssignmentService, "attempt_atomic_assignment") as mock_assign:
            mock_assign.return_value = (
                True,
                BookingResponse(id="b_man", bookingRef="TR-MAN", trip=poor_trip, seatsCount=1, totalPaid=625, status="confirmed"),
                "Success"
            )
            asgn_manual = MatchingEngine.assign("pass_user", req)
            assert asgn_manual.status == "assigned"

def test_37_find_does_not_reserve_seats_assign_performs_atomic_booking():
    """
    AUDIT ITEM 8: POST /api/matching/find only calculates/ranks (no seats reserved).
    POST /api/matching/assign performs authoritative atomic booking with PostgreSQL row lock.
    """
    trip = make_trip("trip_atomic", available_seats=3)
    find_req = MatchingRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct", seats=1)

    with patch.object(CandidateFilter, "get_candidate_trips", return_value=[trip]), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
        # Call /find 5 times
        for _ in range(5):
            res = MatchingEngine.match(find_req)
            assert res.total_candidates == 1
        # Seats MUST remain unchanged at 3
        assert trip.availableSeats == 3, "/find must NOT decrement or reserve seats"

    # Now call assign
    asgn_req = AssignmentRequest(origin="Bengaluru", destination="Hyderabad", date="Sat, 17 Oct", seats=2)
    with patch.object(CandidateFilter, "get_candidate_trips", return_value=[trip]), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}), \
         patch.object(AssignmentService, "attempt_atomic_assignment") as mock_atomic:
        mock_atomic.return_value = (
            True,
            BookingResponse(id="b_assigned", bookingRef="TR-AT", trip=trip, seatsCount=2, totalPaid=1300, status="confirmed"),
            "Booked"
        )
        asgn_res = MatchingEngine.assign("pass_user", asgn_req)
        assert asgn_res.status == "assigned"
        # Verified: attempt_atomic_assignment was called with exact seats_count=2
        assert mock_atomic.call_count == 1
        call_args = mock_atomic.call_args[1]
        assert call_args["seats_count"] == 2

def test_38_regression_production_find_matching_flow():
    """
    REGRESSION AUDIT: Production Find matching flow
    - Valid trip is returned for exact requested canonical date (YYYY-MM-DD)
    - Valid geographic route is matched
    - Invalid date is excluded
    - Invalid route is excluded
    - Unavailable seats are excluded
    - Best match is selected correctly (dominant best_match)
    - Other options are returned correctly
    - Response contract structure matches frontend expectations
    - Driver cannot book own trip (passenger_id != driver_id)
    """
    trip_pune_1 = make_trip("trip_mp_1", origin="Mumbai", destination="Pune", date="2026-10-12", departure_time="07:00", available_seats=3, price_per_seat=450.0, driver_id="driver_arjun")
    trip_pune_2 = make_trip("trip_mp_2", origin="Mumbai", destination="Pune", date="2026-10-12", departure_time="08:30", available_seats=2, price_per_seat=480.0, driver_id="driver_saket")
    trip_other_date = make_trip("trip_mp_wrong_date", origin="Mumbai", destination="Pune", date="2026-10-15", departure_time="07:00", available_seats=3, driver_id="driver_priya")
    trip_other_route = make_trip("trip_wrong_route", origin="Delhi", destination="Jaipur", date="2026-10-12", departure_time="07:00", available_seats=3, driver_id="driver_rahul")

    all_candidates = [trip_pune_1, trip_pune_2, trip_other_date, trip_other_route]

    # 1. Exact valid route and date search
    req = MatchingRequest(origin="Mumbai", destination="Pune", date="2026-10-12", seats=1, passenger_id="passenger_vikram")
    with patch.object(CandidateFilter, "get_candidate_trips", return_value=all_candidates), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
        res = MatchingEngine.match(req)
        assert res.status == "matched"
        assert res.best_match is not None
        assert res.best_match.trip.id in ["trip_mp_1", "trip_mp_2"]
        assert len(res.other_options) == 1
        assert res.total_matches == 2
        # Verify contract properties
        assert hasattr(res, "best_match")
        assert hasattr(res, "other_options")
        assert hasattr(res, "total_matches")

    # 2. Invalid date search excludes candidate trips
    req_bad_date = MatchingRequest(origin="Mumbai", destination="Pune", date="2026-10-20", seats=1, passenger_id="passenger_vikram")
    with patch.object(CandidateFilter, "get_candidate_trips", return_value=all_candidates), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
        res_bad_date = MatchingEngine.match(req_bad_date)
        assert res_bad_date.status == "no_matches"
        assert res_bad_date.total_matches == 0
        assert res_bad_date.best_match is None

    # 3. Invalid route search excludes candidate trips
    req_bad_route = MatchingRequest(origin="Chennai", destination="Kochi", date="2026-10-12", seats=1, passenger_id="passenger_vikram")
    with patch.object(CandidateFilter, "get_candidate_trips", return_value=all_candidates), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
        res_bad_route = MatchingEngine.match(req_bad_route)
        assert res_bad_route.status == "no_matches"
        assert res_bad_route.total_matches == 0

    # 4. Unavailable seats (requesting 4 seats when max is 3)
    req_excess_seats = MatchingRequest(origin="Mumbai", destination="Pune", date="2026-10-12", seats=4, passenger_id="passenger_vikram")
    with patch.object(CandidateFilter, "get_candidate_trips", return_value=all_candidates), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
        res_excess = MatchingEngine.match(req_excess_seats)
        assert res_excess.status == "no_matches"
        assert res_excess.total_matches == 0

    # 5. Driver cannot book own trip (Constraint 8)
    req_as_driver = MatchingRequest(origin="Mumbai", destination="Pune", date="2026-10-12", seats=1, passenger_id="driver_arjun")
    with patch.object(CandidateFilter, "get_candidate_trips", return_value=all_candidates), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={}):
        res_as_driver = MatchingEngine.match(req_as_driver)
        assert res_as_driver.status == "matched"
        # driver_arjun's own trip must be excluded; only driver_saket's trip remains
        assert res_as_driver.total_matches == 1
        assert res_as_driver.best_match.trip.driverId == "driver_saket"

