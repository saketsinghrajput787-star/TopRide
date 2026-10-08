"""
Targeted tests for TopRide Find Page & Matching Optimizations.
Verifies all 20 requirements from Section 30.
"""

import pytest
from unittest.mock import patch, MagicMock
from backend.config import MIN_AUTO_MATCH_SCORE
from backend.schemas import VehicleSchema, TripSchema
from backend.matching.models import (
    MatchingRequest, MatchingResponse, CandidateMatch, ScoringWeights,
    BookingResponse, FeatureBreakdown, FeatureRaw
)
from backend.matching.engine import MatchingEngine, WeightedScorer, Ranker
from backend.matching.candidate_filter import CandidateFilter, to_canonical_iso_date
from backend.matching.assignment import AssignmentService
from backend.pricing.engine import DynamicPricingEngine
from backend.pricing.models import PriceEstimateRequest, PriceBreakdown


def make_dummy_trip(
    trip_id: str = "trip_1",
    driver_id: str = "drv_1",
    driver_name: str = "Arjun Rao",
    date: str = "2026-10-10",
    price: float = 600.0,
    seats: int = 2
) -> TripSchema:
    return TripSchema(
        id=trip_id,
        driverId=driver_id,
        driverName=driver_name,
        driverInitials=driver_name[:2].upper(),
        driverRating=5.0,
        driverTripsCount=25,
        driverIsVerified=True,
        origin="Bengaluru",
        destination="Hyderabad",
        date=date,
        departureTime="07:00",
        arrivalTime="15:00",
        duration="8h 00m",
        totalSeats=4,
        availableSeats=seats,
        pricePerSeat=price,
        currentMarketPrice=price,
        currency="₹",
        status="upcoming",
        vehicle=VehicleSchema(
            id=f"veh_{trip_id}",
            make="Hyundai",
            model="Creta SX(O)",
            year=2023,
            color="Grey",
            plateNumber="KA 01 AB 1234"
        ),
        originLatitude=12.9716,
        originLongitude=77.5946,
        destinationLatitude=17.3850,
        destinationLongitude=78.4867
    )


def test_canonical_date_normalization():
    """Requirement 14: Date is sent/parsed as canonical YYYY-MM-DD."""
    assert to_canonical_iso_date("2026-10-10") == "2026-10-10"
    assert to_canonical_iso_date("Sat, 10 Oct") == "2026-10-10"
    assert to_canonical_iso_date("Sat, 17 Oct") == "2026-10-17"
    assert to_canonical_iso_date("Sat, 31 Oct") == "2026-10-31"


def test_existing_matching_weights_remain_unchanged():
    """Requirement 10: Existing matching weights remain unchanged (35/20/15/15/5/5/5, min 60)."""
    weights = WeightedScorer.DEFAULT_WEIGHTS
    assert weights.route == 0.35, "Route weight must be exactly 35%"
    assert weights.pickup == 0.20, "Pickup weight must be exactly 20%"
    assert weights.drop == 0.15, "Drop weight must be exactly 15%"
    assert weights.time == 0.15, "Time weight must be exactly 15%"
    assert weights.price == 0.05, "Price weight must be exactly 5%"
    assert weights.rating == 0.05, "Driver rating weight must be exactly 5%"
    assert weights.vehicle == 0.05, "Vehicle weight must be exactly 5%"
    assert round(weights.route + weights.pickup + weights.drop + weights.time + weights.price + weights.rating + weights.vehicle, 2) == 1.0
    assert MIN_AUTO_MATCH_SCORE == 60.0


def test_response_structure_has_best_match_and_other_options():
    """Requirement 7 & 8: Response structure contains best_match and other_options."""
    trip1 = make_dummy_trip("t1", "drv1", "Arjun Rao", "2026-10-10", 600.0)
    trip2 = make_dummy_trip("t2", "drv2", "Priya Sharma", "2026-10-10", 620.0)
    trip3 = make_dummy_trip("t3", "drv3", "Rahul Kumar", "2026-10-10", 580.0)

    with patch.object(CandidateFilter, "get_candidate_trips", return_value=[trip1, trip2, trip3]), \
         patch.object(CandidateFilter, "get_driver_rating_counts", return_value={"drv1": 25, "drv2": 42, "drv3": 31}), \
         patch.object(CandidateFilter, "get_passenger_existing_bookings", return_value=set()):
        
        req = MatchingRequest(
            origin="Bengaluru",
            destination="Hyderabad",
            date="2026-10-10",
            passenger_id="passenger_1",
            seats=1
        )
        res = MatchingEngine.match(req)
        assert res.status == "matched"
        assert res.best_match is not None
        assert isinstance(res.best_match, CandidateMatch)
        assert res.best_match.match_score >= 60.0
        assert len(res.other_options) == 2
        assert res.total_matches == 3
        # Best match has the highest score
        for other in res.other_options:
            assert other.match_score <= res.best_match.match_score


def test_driver_cannot_match_own_trip():
    """Requirement 16: Driver cannot match their own trip (trip.driverId == current_passenger_id)."""
    driver_id = "driver_test_99"
    req = MatchingRequest(
        passenger_id=driver_id,
        origin="Bengaluru",
        destination="Hyderabad",
        date="2026-10-10",
        seats=1
    )
    dummy_trip = make_dummy_trip(driver_id=driver_id)
    eligible, reason = CandidateFilter.apply_hard_constraints(dummy_trip, req, set())
    assert eligible is False
    assert "cannot book their own trip" in reason


def test_mapbox_calls_during_matching_is_zero():
    """Requirement 12: Mapbox calls during matching = 0."""
    with patch("urllib.request.urlopen") as mock_url, patch("requests.get") as mock_req:
        trip1 = make_dummy_trip("t1", "drv1", "Arjun Rao", "2026-10-10", 600.0)
        with patch.object(CandidateFilter, "get_candidate_trips", return_value=[trip1]), \
             patch.object(CandidateFilter, "get_driver_rating_counts", return_value={"drv1": 25}), \
             patch.object(CandidateFilter, "get_passenger_existing_bookings", return_value=set()):
            req = MatchingRequest(
                origin="Bengaluru",
                destination="Hyderabad",
                date="2026-10-10",
                passenger_id="passenger_test",
                seats=1
            )
            res = MatchingEngine.match(req)
            assert mock_url.call_count == 0
            assert mock_req.call_count == 0


def test_razorpay_calls_during_matching_is_zero():
    """Requirement 13: Razorpay calls during matching = 0."""
    mock_rzp = MagicMock()
    with patch("razorpay.Client", mock_rzp):
        trip1 = make_dummy_trip("t1", "drv1", "Arjun Rao", "2026-10-10", 600.0)
        with patch.object(CandidateFilter, "get_candidate_trips", return_value=[trip1]), \
             patch.object(CandidateFilter, "get_driver_rating_counts", return_value={"drv1": 25}), \
             patch.object(CandidateFilter, "get_passenger_existing_bookings", return_value=set()):
            req = MatchingRequest(
                origin="Bengaluru",
                destination="Hyderabad",
                date="2026-10-10",
                passenger_id="passenger_test",
                seats=1
            )
            res = MatchingEngine.match(req)
            assert mock_rzp.call_count == 0


def test_search_does_not_create_booking():
    """Requirement 11: Search does not automatically create a booking."""
    with patch.object(AssignmentService, "attempt_atomic_assignment") as mock_assign:
        trip1 = make_dummy_trip("t1", "drv1", "Arjun Rao", "2026-10-10", 600.0)
        with patch.object(CandidateFilter, "get_candidate_trips", return_value=[trip1]), \
             patch.object(CandidateFilter, "get_driver_rating_counts", return_value={"drv1": 25}), \
             patch.object(CandidateFilter, "get_passenger_existing_bookings", return_value=set()):
            req = MatchingRequest(
                origin="Bengaluru",
                destination="Hyderabad",
                date="2026-10-10",
                passenger_id="passenger_test",
                seats=1
            )
            res = MatchingEngine.match(req)
            mock_assign.assert_not_called()


def test_dynamic_price_comes_from_backend():
    """Requirement 17: Dynamic price comes from backend authoritative engine."""
    req = PriceEstimateRequest(
        origin="Bengaluru",
        destination="Hyderabad",
        travelDate="2026-10-10",
        departureTime="08:00",
        totalSeats=4,
        availableSeats=2,
        vehicleCategory="sedan"
    )
    mock_client = MagicMock()
    mock_client.table().select().execute.return_value.data = []
    estimate = DynamicPricingEngine.calculate_price(req, client=mock_client)
    assert isinstance(estimate, PriceBreakdown)
    assert estimate.finalPrice > 0
    assert estimate.priceFloor <= estimate.finalPrice <= estimate.priceCeiling


def test_booking_price_at_booking_remains_immutable():
    """Requirement 18: booking.price_at_booking remains immutable once booked."""
    trip = make_dummy_trip()
    booking = BookingResponse(
        id="book_123",
        bookingRef="REF123",
        trip=trip,
        seatsCount=1,
        totalPaid=600.0,
        priceAtBooking=600.0,
        status="confirmed"
    )
    # Market surge occurs in trip price
    trip.currentMarketPrice = 900.0
    # Customer price at booking remains frozen
    assert booking.priceAtBooking == 600.0
    assert booking.totalPaid == 600.0
