"""
Regression tests for TopRide route-specific dynamic pricing engine.
Verifies that different routes produce distinct, distance-based fares,
coordinates are validated, vehicle categories and occupancy adjust correctly,
and zero external Mapbox/Razorpay calls are made during pricing estimation.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.main import app
from backend.pricing.base_price import (
    BasePriceEngine,
    validate_locations_and_coordinates
)
from backend.pricing.engine import DynamicPricingEngine
from backend.pricing.models import PriceEstimateRequest, PriceBreakdown
from backend.schemas import TripCreate
from backend.database import insert_trip_in_db

client = TestClient(app)


# ==============================================================================
# 1. ROUTE-SPECIFIC DISTANCE & BASE FARE TESTS
# ==============================================================================

def test_different_routes_produce_appropriately_different_base_fares():
    """Different routes must calculate different base fares proportional to distance,
    never a static ₹650 for all routes."""
    # Short route: Bengaluru -> Mysuru (~145 km)
    short_fare = BasePriceEngine.calculate_base_price(
        origin="Bengaluru",
        destination="Mysuru",
        origin_lat=12.9716,
        origin_lon=77.5946,
        dest_lat=12.2958,
        dest_lon=76.6394,
        vehicle_category="sedan"
    )

    # Medium route: Delhi -> Jaipur (~280 km)
    medium_fare = BasePriceEngine.calculate_base_price(
        origin="Delhi",
        destination="Jaipur",
        origin_lat=28.6139,
        origin_lon=77.2090,
        dest_lat=26.9124,
        dest_lon=75.7873,
        vehicle_category="sedan"
    )

    # Long route: Bengaluru -> Hyderabad (~570 km)
    long_fare = BasePriceEngine.calculate_base_price(
        origin="Bengaluru",
        destination="Hyderabad",
        origin_lat=12.9716,
        origin_lon=77.5946,
        dest_lat=17.3850,
        dest_lon=78.4867,
        vehicle_category="sedan"
    )

    # Verify fares are strictly monotonically increasing with distance
    assert short_fare < medium_fare < long_fare
    # Short route (145 km) should be around ₹180, NOT ₹650
    assert 150.0 <= short_fare <= 220.0
    # Medium route (280 km) should be around ₹320, NOT ₹650
    assert 280.0 <= medium_fare <= 360.0
    # Long route (570 km) should be around ₹640, NOT ₹650
    assert 600.0 <= long_fare <= 680.0
    # None of them should be a flat dummy 650.0
    assert short_fare != 650.0
    assert medium_fare != 650.0


def test_consistent_pricing_under_identical_conditions():
    """Identical route and condition inputs produce deterministic identical estimates."""
    req = PriceEstimateRequest(
        origin="Delhi",
        destination="Chandigarh",
        travelDate="2026-10-18",
        departureTime="09:00",
        originLat=28.6139,
        originLon=77.2090,
        destLat=30.7333,
        destLon=76.7794,
        totalSeats=4,
        availableSeats=4,
        vehicleCategory="sedan"
    )

    estimate_1 = DynamicPricingEngine.calculate_price(req)
    estimate_2 = DynamicPricingEngine.calculate_price(req)

    assert estimate_1.finalPrice == estimate_2.finalPrice
    assert estimate_1.basePrice == estimate_2.basePrice
    assert estimate_1.distanceKm == estimate_2.distanceKm
    assert estimate_1.distanceKm == 250.0  # Corridor benchmark for Delhi-Chandigarh


# ==============================================================================
# 2. VEHICLE CATEGORY ADJUSTMENTS
# ==============================================================================

def test_different_vehicle_categories_adjust_fare_correctly():
    """Vehicle categories apply configured multipliers:
    Hatchback (0.95) < Sedan (1.00) < SUV (1.05) < Luxury (1.20)."""
    origin = "Bengaluru"
    destination = "Hyderabad"
    origin_lat, origin_lon = 12.9716, 77.5946
    dest_lat, dest_lon = 17.3850, 78.4867

    hatchback_price = BasePriceEngine.calculate_base_price(
        origin=origin, destination=destination,
        origin_lat=origin_lat, origin_lon=origin_lon,
        dest_lat=dest_lat, dest_lon=dest_lon,
        vehicle_category="hatchback"
    )
    sedan_price = BasePriceEngine.calculate_base_price(
        origin=origin, destination=destination,
        origin_lat=origin_lat, origin_lon=origin_lon,
        dest_lat=dest_lat, dest_lon=dest_lon,
        vehicle_category="sedan"
    )
    suv_price = BasePriceEngine.calculate_base_price(
        origin=origin, destination=destination,
        origin_lat=origin_lat, origin_lon=origin_lon,
        dest_lat=dest_lat, dest_lon=dest_lon,
        vehicle_category="suv"
    )
    luxury_price = BasePriceEngine.calculate_base_price(
        origin=origin, destination=destination,
        origin_lat=origin_lat, origin_lon=origin_lon,
        dest_lat=dest_lat, dest_lon=dest_lon,
        vehicle_category="luxury"
    )

    assert hatchback_price < sedan_price < suv_price < luxury_price
    assert abs(hatchback_price - round(sedan_price * 0.95)) <= 15.0
    assert abs(luxury_price - round(sedan_price * 1.20)) <= 15.0


# ==============================================================================
# 3. OCCUPANCY AND DEMAND MULTIPLIER TESTS
# ==============================================================================

def test_occupancy_multiplier_correct_on_empty_and_filled_trip():
    """An empty trip (0 booked seats) must have occupancy multiplier 1.00,
    NOT 1.05 from miscalculating booked seats."""
    # 0 booked seats (available == total)
    empty_req = PriceEstimateRequest(
        origin="Bengaluru",
        destination="Mysuru",
        travelDate="2026-10-18",
        departureTime="10:00",
        totalSeats=4,
        availableSeats=4,
        vehicleCategory="sedan"
    )
    empty_breakdown = DynamicPricingEngine.calculate_price(empty_req)
    assert empty_breakdown.occupancyMultiplier == 1.00

    # 3 booked seats out of 4 (1 available seat remaining)
    filled_req = PriceEstimateRequest(
        origin="Bengaluru",
        destination="Mysuru",
        travelDate="2026-10-18",
        departureTime="10:00",
        totalSeats=4,
        availableSeats=1,
        vehicleCategory="sedan"
    )
    filled_breakdown = DynamicPricingEngine.calculate_price(filled_req)
    assert filled_breakdown.occupancyMultiplier > 1.02
    assert filled_breakdown.finalPrice >= empty_breakdown.finalPrice


# ==============================================================================
# 4. COORDINATE VALIDATION AND ERROR HANDLING
# ==============================================================================

def test_coordinate_validation_rejects_identical_and_invalid_locations():
    """Validation must reject identical locations and out-of-range coordinates."""
    # Identical origin & destination
    with pytest.raises(ValueError, match="Origin and destination cannot be identical"):
        validate_locations_and_coordinates("Bengaluru", "Bengaluru", 12.97, 77.59, 12.97, 77.59)

    # Identical coordinates
    with pytest.raises(ValueError, match="identical"):
        validate_locations_and_coordinates("Koramangala", "Koramangala Hub", 12.9716, 77.5946, 12.9716, 77.5946)

    # Invalid latitude (> 90)
    with pytest.raises(ValueError, match="between -90 and 90"):
        validate_locations_and_coordinates("Bengaluru", "Mysuru", 95.0, 77.59, 12.29, 76.63)

    # Invalid longitude (< -180)
    with pytest.raises(ValueError, match="between -180 and 180"):
        validate_locations_and_coordinates("Bengaluru", "Mysuru", 12.97, -195.0, 12.29, 76.63)


def test_api_estimate_endpoint_returns_400_for_invalid_coordinates():
    """FastAPI /api/pricing/estimate endpoint returns HTTP 400 on invalid or identical locations."""
    # Identical locations
    resp = client.post("/api/pricing/estimate", json={
        "origin": "Bengaluru",
        "destination": "Bengaluru",
        "travelDate": "2026-10-18",
        "departureTime": "09:00",
        "originLat": 12.9716,
        "originLon": 77.5946,
        "destLat": 12.9716,
        "destLon": 77.5946,
        "totalSeats": 3,
        "availableSeats": 3
    })
    assert resp.status_code == 400
    assert "Origin and destination cannot be identical" in resp.json()["detail"]

    # Out of range coordinates
    resp2 = client.post("/api/pricing/estimate", json={
        "origin": "Delhi",
        "destination": "Jaipur",
        "travelDate": "2026-10-18",
        "departureTime": "09:00",
        "originLat": 120.0,
        "originLon": 77.20,
        "destLat": 26.91,
        "destLon": 75.78,
        "totalSeats": 3,
        "availableSeats": 3
    })
    assert resp2.status_code == 400


def test_api_estimate_endpoint_returns_different_fares_for_routes():
    """Endpoint returns route-specific prices, transparent breakdown, and correct per-seat price."""
    # Short route
    resp_short = client.post("/api/pricing/estimate", json={
        "origin": "Bengaluru",
        "destination": "Mysuru",
        "travelDate": "2026-10-18",
        "departureTime": "09:00",
        "originLat": 12.9716,
        "originLon": 77.5946,
        "destLat": 12.2958,
        "destLon": 76.6394,
        "totalSeats": 3,
        "availableSeats": 3
    })
    assert resp_short.status_code == 200
    data_short = resp_short.json()
    assert data_short["finalPrice"] <= 200.0
    assert data_short["distanceKm"] is not None
    assert data_short["basePrice"] <= 200.0

    # Long route
    resp_long = client.post("/api/pricing/estimate", json={
        "origin": "Bengaluru",
        "destination": "Hyderabad",
        "travelDate": "2026-10-18",
        "departureTime": "09:00",
        "originLat": 12.9716,
        "originLon": 77.5946,
        "destLat": 17.3850,
        "destLon": 78.4867,
        "totalSeats": 3,
        "availableSeats": 3
    })
    assert resp_long.status_code == 200
    data_long = resp_long.json()
    assert data_long["finalPrice"] >= 550.0
    assert data_long["finalPrice"] > data_short["finalPrice"]


# ==============================================================================
# 5. ZERO MAPBOX AND ZERO RAZORPAY CALL GUARANTEES
# ==============================================================================

def test_zero_external_api_calls_during_pricing_estimation():
    """Pricing calculation must NEVER invoke Mapbox Directions API or Razorpay."""
    req = PriceEstimateRequest(
        origin="Bengaluru",
        destination="Hyderabad",
        travelDate="2026-10-18",
        departureTime="08:00",
        originLat=12.9716,
        originLon=77.5946,
        destLat=17.3850,
        destLon=78.4867,
        totalSeats=4,
        availableSeats=4
    )

    with patch("requests.get") as mock_http_get, \
         patch("requests.post") as mock_http_post:
        breakdown = DynamicPricingEngine.calculate_price(req)
        assert breakdown.finalPrice > 0
        # No outbound HTTP calls to mapbox or razorpay allowed during pricing
        for call in mock_http_get.call_args_list:
            assert "api.mapbox.com" not in str(call)
            assert "api.razorpay.com" not in str(call)
        for call in mock_http_post.call_args_list:
            assert "api.mapbox.com" not in str(call)
            assert "api.razorpay.com" not in str(call)


# ==============================================================================
# 6. STORED ROAD DISTANCE PREFERENCE
# ==============================================================================

def test_stored_road_distance_takes_precedence_over_coordinate_estimate():
    """When a client or Mapbox directions route provides road distance, it is preferred."""
    dist, source = BasePriceEngine.resolve_route_distance_and_source(
        origin_name="CustomOrigin",
        dest_name="CustomDest",
        origin_lat=12.9716,
        origin_lon=77.5946,
        dest_lat=13.5000,
        dest_lon=78.0000,
        stored_distance_km=75.5
    )
    assert dist == 75.5
    assert source == "road_network"


# ==============================================================================
# 7. TRIP PUBLICATION & BOOKING IMMUTABILITY TESTS
# ==============================================================================

def test_trip_publication_saves_route_specific_per_seat_price():
    """Trip creation must persist the route-specific calculated price, not ₹650."""
    from backend.schemas import TripCreate
    from backend.database import insert_trip_in_db

    mock_client = MagicMock()
    mock_builder = MagicMock()
    mock_client.table.return_value = mock_builder

    # When publishing a Bengaluru -> Mysuru short route trip
    created_row = {
        "id": "trip-mysuru-1",
        "driver_id": "driver-1",
        "origin": "Bengaluru",
        "destination": "Mysuru",
        "date": "2026-10-18",
        "departure_time": "08:00",
        "total_seats": 3,
        "available_seats": 3,
        "price_per_seat": 170.0,
        "current_market_price": 170.0,
        "base_price": 170.0,
        "status": "upcoming"
    }
    mock_builder.execute.return_value = MagicMock(data=[created_row])
    mock_builder.eq.return_value = mock_builder
    mock_builder.select.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.update.return_value = mock_builder
    mock_client.rpc.return_value.execute.return_value = MagicMock(data={"trip_id": "trip-mysuru-1"})

    mysuru_breakdown = PriceBreakdown(
        basePrice=170.0, distanceKm=145.0, durationMinutes=134,
        distanceSource="corridor_benchmark", vehicleMultiplier=1.0,
        demandCount=0, supplySeats=0, demandSupplyRatio=0.0,
        demandMultiplier=1.0, timeMultiplier=1.0, occupancyMultiplier=1.0,
        rawPrice=170.0, priceFloor=150.0, priceCeiling=220.0, finalPrice=170.0,
        explanation="Route-specific Mysuru market price", marketSegment="BLR->MYS"
    )

    with patch("backend.pricing.engine.DynamicPricingEngine.calculate_price", return_value=mysuru_breakdown), \
         patch("backend.database.fetch_profile_from_db", return_value=None):

        payload = TripCreate(
            origin="Bengaluru",
            destination="Mysuru",
            date="2026-10-18",
            departureTime="08:00",
            totalSeats=3,
            pricePerSeat=170.0
        )
        trip = insert_trip_in_db("driver-1", payload, client=mock_client)
        assert trip.pricePerSeat == 170.0
        assert trip.currentMarketPrice == 170.0
        assert trip.pricePerSeat != 650.0


def test_booking_uses_authoritative_price_rejects_client_manipulation():
    """Booking calculates total from authoritative currentMarketPrice, ignoring manipulated frontend values."""
    from backend.schemas import BookingCreate, TripSchema, VehicleSchema
    from backend.database import create_booking_in_db

    mock_client = MagicMock()
    mock_builder = MagicMock()
    mock_client.table.return_value = mock_builder
    mock_client.rpc.return_value.execute.return_value = MagicMock(data={"booking_id": "booking-test-1", "success": True})

    trip_mock = TripSchema(
        id="trip-123",
        driverId="driver-1",
        driverName="Driver Name",
        driverInitials="DN",
        driverRating=5.0,
        driverTripsCount=10,
        origin="Bengaluru",
        destination="Mysuru",
        date="2026-10-18",
        departureTime="08:00",
        totalSeats=4,
        availableSeats=4,
        pricePerSeat=170.0,
        currentMarketPrice=170.0,
        status="upcoming",
        vehicle=VehicleSchema(
            id="veh-1", make="Honda", model="City", plateNumber="KA01AB1234", year=2022, color="White"
        )
    )

    with patch("backend.database.fetch_trip_by_id_from_db", return_value=trip_mock):

        # Client attempts to spoof totalAmount as ₹1.0
        payload_manipulated = BookingCreate(
            tripId="trip-123",
            seatsCount=2,
            totalAmount=1.0,
            luggageTier="small"
        )

        booking_res = create_booking_in_db("passenger-1", payload_manipulated, client=mock_client)
        # Expected total: 2 seats * ₹170.0 = ₹340.0, NOT ₹1.0
        assert booking_res.totalPaid == 340.0
        assert booking_res.priceAtBooking == 170.0
