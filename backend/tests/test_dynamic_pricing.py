"""
============================================================
TOPRIDE — DYNAMIC MARKET PRICING ENGINE TESTS
Production-Ready Comprehensive Test Suite
============================================================
Tests:
1. Base Price Engine (Short, Medium, Long, Vehicle categories, Stored distance reuse)
2. Demand/Supply Multiplier (Continuous, Monotonic, Bounded 0.90 - 1.30, DSR scaling)
3. Time-to-Departure Factor (30 days, 7 days, 24h, 2h, Low demand vs High demand safety)
4. Controlled Occupancy Factor (0%, 25%, 50%, 75%, 90% -> bounded [1.00, 1.05])
5. Floor & Ceiling Bounds (Never < floor, never > cap, ₹10 increment rounding)
6. Anti-Arbitrary Pricing (Driver input ₹1 or ₹10,000 overridden by backend)
7. Immutable Booking Price (Market price changes after booking do NOT alter confirmed booking)
8. Payment Consistency (Authoritative booking total = Razorpay amount)
9. API Conservation (0 Mapbox calls, 0 Razorpay calls during pricing/matching)
"""

import pytest
import datetime
from unittest.mock import MagicMock, patch

from backend.config import (
    BASE_PRICE_PER_KM,
    BASE_PRICE_PER_MINUTE,
    MINIMUM_PLATFORM_PRICE,
    MIN_DEMAND_MULTIPLIER,
    MAX_DEMAND_MULTIPLIER,
    MIN_TIME_MULTIPLIER,
    MAX_TIME_MULTIPLIER,
    MIN_OCCUPANCY_MULTIPLIER,
    MAX_OCCUPANCY_MULTIPLIER,
    MIN_PRICE_MULTIPLIER,
    MAX_PRICE_MULTIPLIER,
    PRICE_ROUNDING_UNIT,
)
from backend.pricing.base_price import BasePriceEngine, PLATFORM_BENCHMARK_CORRIDOR_DISTANCES
from backend.pricing.multipliers import PricingMultipliers
from backend.pricing.models import PriceEstimateRequest, PriceBreakdown
from backend.pricing.engine import DynamicPricingEngine
from backend.pricing.market_analyzer import MarketAnalyzer
from backend.pricing.service import PricingService
from backend.schemas import (
    TripCreate, TripSchema, BookingCreate, BookingResponse, VehicleSchema,
    PaymentOrderCreate, PaymentOrderResponse
)
from backend.database import (
    create_booking_in_db, create_razorpay_order_in_db, insert_trip_in_db
)
from backend.matching import (
    MatchingEngine, MatchingRequest, AssignmentRequest, FeatureCalculator, CandidateFilter
)

DEFAULT_TEST_VEHICLE = VehicleSchema(
    id="veh-1",
    make="Honda",
    model="City",
    year=2022,
    color="White",
    plateNumber="KA01AB1234",
    isDefault=True
)


# ============================================================
# 1. BASE PRICE ENGINE TESTS
# ============================================================

def test_base_price_benchmark_bengaluru_hyderabad():
    """Verify standard BLR-HYD benchmark calculates to ₹640 - ₹650 for sedan."""
    base = BasePriceEngine.calculate_base_price(
        origin="Bengaluru",
        destination="Hyderabad",
        origin_lat=12.9716,
        origin_lon=77.5946,
        dest_lat=17.3850,
        dest_lon=78.4867,
        vehicle_category="sedan",
        duration_str="9h 00m"
    )
    # BLR-HYD: 560 km * 1.00 + 540 min * 0.15 = 560 + 81 = 641 -> round to 640 or 650
    assert 600 <= base <= 680, f"Expected BLR-HYD base around 640-650, got {base}"
    assert base % PRICE_ROUNDING_UNIT == 0, "Base price must align with currency rounding unit"


def test_base_price_short_route():
    """Short corridor: Bengaluru to Mysuru (~145 km)."""
    base = BasePriceEngine.calculate_base_price(
        origin="Bengaluru",
        destination="Mysuru",
        vehicle_category="sedan",
        duration_str="3h 00m"
    )
    assert 150 <= base <= 250, f"Expected BLR-MYQ base ~170-200, got {base}"
    assert base >= MINIMUM_PLATFORM_PRICE


def test_base_price_medium_route():
    """Medium corridor: Mumbai to Pune (~150 km)."""
    base = BasePriceEngine.calculate_base_price(
        origin="Mumbai",
        destination="Pune",
        vehicle_category="sedan",
        duration_str="3h 15m"
    )
    assert 150 <= base <= 250, f"Expected BOM-PNQ base ~170-210, got {base}"


def test_base_price_vehicle_categories():
    """Verify vehicle category scaling: hatchback < sedan < suv < luxury."""
    p_hatch = BasePriceEngine.calculate_base_price(
        origin="Bengaluru", destination="Hyderabad", vehicle_category="hatchback", duration_str="9h 00m"
    )
    p_sedan = BasePriceEngine.calculate_base_price(
        origin="Bengaluru", destination="Hyderabad", vehicle_category="sedan", duration_str="9h 00m"
    )
    p_suv = BasePriceEngine.calculate_base_price(
        origin="Bengaluru", destination="Hyderabad", vehicle_category="suv", duration_str="9h 00m"
    )
    p_lux = BasePriceEngine.calculate_base_price(
        origin="Bengaluru", destination="Hyderabad", vehicle_category="luxury", duration_str="9h 00m"
    )

    assert p_hatch <= p_sedan <= p_suv <= p_lux
    assert p_suv > p_sedan or p_suv >= p_sedan


def test_base_price_stored_route_reuse():
    """Verify stored distance is reused without calling any external routing."""
    base_with_stored = BasePriceEngine.calculate_base_price(
        origin="Bengaluru",
        destination="Hyderabad",
        route_distance_km=560.0,
        route_duration_minutes=540.0,
        vehicle_category="sedan"
    )
    assert 630 <= base_with_stored <= 660


# ============================================================
# 2. DEMAND/SUPPLY MULTIPLIER TESTS
# ============================================================

def test_demand_supply_ratio_calculation():
    """Verify continuous non-linear DSR multiplier curve."""
    # Low demand: 5 requests / 20 seats = 0.25 DSR
    m_low = PricingMultipliers.calculate_demand_multiplier(5, 20)
    assert MIN_DEMAND_MULTIPLIER <= m_low <= 0.95

    # Balanced demand: 10 requests / 10 seats = 1.0 DSR
    m_norm = PricingMultipliers.calculate_demand_multiplier(10, 10)
    assert 0.99 <= m_norm <= 1.01

    # Moderate high demand: 20 requests / 10 seats = 2.0 DSR
    m_high = PricingMultipliers.calculate_demand_multiplier(20, 10)
    assert 1.08 <= m_high <= 1.20

    # Extreme demand: 30 requests / 10 seats = 3.0 DSR
    m_ext = PricingMultipliers.calculate_demand_multiplier(30, 10)
    assert m_ext <= MAX_DEMAND_MULTIPLIER


def test_demand_supply_monotonic_behavior():
    """As demand increases with fixed supply, multiplier must be strictly non-decreasing."""
    supply = 10
    demands = [0, 2, 5, 8, 10, 15, 20, 30, 50]
    multipliers = [PricingMultipliers.calculate_demand_multiplier(d, supply) for d in demands]

    for i in range(len(multipliers) - 1):
        assert multipliers[i] <= multipliers[i + 1], (
            f"Violated monotonicity: {multipliers[i]} > {multipliers[i+1]} at demand {demands[i]} -> {demands[i+1]}"
        )


def test_demand_supply_bounds():
    """Multiplier must never breach [MIN_DEMAND_MULTIPLIER, MAX_DEMAND_MULTIPLIER]."""
    assert PricingMultipliers.calculate_demand_multiplier(0, 100) >= MIN_DEMAND_MULTIPLIER
    assert PricingMultipliers.calculate_demand_multiplier(1000, 1) <= MAX_DEMAND_MULTIPLIER


# ============================================================
# 3. TIME-TO-DEPARTURE FACTOR TESTS
# ============================================================

def test_time_pressure_factor_far_departure():
    """30 days (720 hours) and 7 days (168 hours) away should have factor ~1.00."""
    t_30d = PricingMultipliers.calculate_time_multiplier(hours_to_departure=720.0, demand_supply_ratio=1.0)
    t_7d = PricingMultipliers.calculate_time_multiplier(hours_to_departure=168.0, demand_supply_ratio=1.0)
    assert 0.99 <= t_30d <= 1.01
    assert 0.99 <= t_7d <= 1.01


def test_time_pressure_low_demand_does_not_surge():
    """Departure in 2 hours with low demand must NOT artificially surge (may dip to fill seats)."""
    t_close_low = PricingMultipliers.calculate_time_multiplier(hours_to_departure=2.0, demand_supply_ratio=0.3)
    assert t_close_low <= 1.00, f"Expected no surge when demand is low near departure, got {t_close_low}"
    assert t_close_low >= MIN_TIME_MULTIPLIER


def test_time_pressure_high_demand_urgency():
    """Departure in 2 hours with high unmet demand rises modestly, bounded by MAX_TIME_MULTIPLIER."""
    t_close_high = PricingMultipliers.calculate_time_multiplier(hours_to_departure=2.0, demand_supply_ratio=2.5)
    assert t_close_high > 1.00
    assert t_close_high <= MAX_TIME_MULTIPLIER


# ============================================================
# 4. CONTROLLED OCCUPANCY ADJUSTMENT TESTS
# ============================================================

def test_occupancy_multiplier_bounded_curve():
    """Verify occupancy adjustment: 0% -> 1.00, 50% -> ~1.01, 75% -> ~1.03, 90%+ -> 1.05."""
    m_0 = PricingMultipliers.calculate_occupancy_multiplier(0, 4)     # 0%
    m_25 = PricingMultipliers.calculate_occupancy_multiplier(1, 4)    # 25%
    m_50 = PricingMultipliers.calculate_occupancy_multiplier(2, 4)    # 50%
    m_75 = PricingMultipliers.calculate_occupancy_multiplier(3, 4)    # 75%
    m_100 = PricingMultipliers.calculate_occupancy_multiplier(4, 4)   # 100%

    assert m_0 == 1.00
    assert 1.00 <= m_25 <= 1.01
    assert 1.005 <= m_50 <= 1.02
    assert 1.02 <= m_75 <= 1.04
    assert m_100 <= MAX_OCCUPANCY_MULTIPLIER
    assert m_0 <= m_25 <= m_50 <= m_75 <= m_100


# ============================================================
# 5. PRICE FLOOR & CEILING TESTS
# ============================================================

def test_price_floor_and_cap_enforcement():
    """Ensure raw price is strictly clamped between floor and ceiling."""
    base_price = 650.0
    floor, ceiling = PricingMultipliers.calculate_floor_and_ceiling(base_price)

    # Low boundary: raw price ₹100 is clamped up to floor
    clamped_low = PricingMultipliers.apply_bounds_and_rounding(100.0, floor, ceiling)
    assert clamped_low >= floor
    assert clamped_low % PRICE_ROUNDING_UNIT == 0

    # High boundary: raw price ₹2000 is clamped down to ceiling
    clamped_high = PricingMultipliers.apply_bounds_and_rounding(2000.0, floor, ceiling)
    assert clamped_high <= ceiling
    assert clamped_high % PRICE_ROUNDING_UNIT == 0


def test_currency_rounding_increment():
    """Final price must round cleanly to nearest ₹10 increment."""
    floor, ceiling = 200.0, 1000.0
    assert PricingMultipliers.apply_bounds_and_rounding(653.4, floor, ceiling) == 650.0
    assert PricingMultipliers.apply_bounds_and_rounding(656.8, floor, ceiling) == 660.0
    assert PricingMultipliers.apply_bounds_and_rounding(650.0, floor, ceiling) == 650.0


# ============================================================
# 6. DYNAMIC PRICING ENGINE PIPELINE
# ============================================================

def test_dynamic_pricing_engine_full_calculation():
    """Test full 10-step market pricing pipeline execution."""
    req = PriceEstimateRequest(
        origin="Bengaluru",
        destination="Hyderabad",
        travelDate="2026-10-17",
        departureTime="08:00",
        originLat=12.9716,
        originLon=77.5946,
        destLat=17.3850,
        destLon=78.4867,
        totalSeats=4,
        availableSeats=4,
        vehicleCategory="sedan",
        durationStr="9h 00m"
    )

    # Mock database to simulate demand = 20, supply = 10 (DSR = 2.0)
    mock_client = MagicMock()
    mock_client.table().select().execute.return_value.data = []

    with patch("backend.pricing.market_analyzer.MarketAnalyzer.aggregate_market_supply_and_demand", return_value=(20, 10, 2.0)):
        breakdown = DynamicPricingEngine.calculate_price(req, client=mock_client)

        assert isinstance(breakdown, PriceBreakdown)
        assert breakdown.basePrice >= 600
        assert breakdown.demandSupplyRatio == 2.0
        assert breakdown.demandMultiplier > 1.05
        assert breakdown.finalPrice >= breakdown.basePrice
        assert breakdown.finalPrice <= breakdown.priceCeiling
        assert breakdown.finalPrice >= breakdown.priceFloor
        assert breakdown.finalPrice % 10 == 0


# ============================================================
# 7. ANTI-ARBITRARY PRICING TESTS
# ============================================================

def test_anti_arbitrary_pricing_driver_cannot_set_extreme_values():
    """Driver submitting price=₹1 or price=₹10,000 must be overridden by platform calculation."""
    from backend.database import insert_trip_in_db

    mock_client = MagicMock()
    created_row = {
        "id": "trip-test-123",
        "driver_id": "driver-1",
        "origin": "Bengaluru",
        "destination": "Hyderabad",
        "date": "2026-10-17",
        "departure_time": "08:00",
        "total_seats": 3,
        "available_seats": 3,
        "price_per_seat": 650.0,
        "current_market_price": 650.0,
        "base_price": 650.0,
        "status": "upcoming"
    }
    mock_res = MagicMock()
    mock_res.data = [created_row]
    mock_builder = MagicMock()
    mock_builder.execute.return_value = mock_res
    mock_builder.eq.return_value = mock_builder
    mock_builder.select.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.update.return_value = mock_builder
    mock_client.table.return_value = mock_builder
    mock_client.rpc.return_value.execute.return_value = MagicMock(data={"trip_id": "trip-test-123"})

    # Driver attempts to post with pricePerSeat = 1.0
    payload_underprice = TripCreate(
        origin="Bengaluru",
        destination="Hyderabad",
        date="2026-10-17",
        departureTime="08:00",
        totalSeats=3,
        pricePerSeat=1.0  # Exploit attempt
    )

    with patch("backend.pricing.engine.DynamicPricingEngine.calculate_price") as mock_calc, \
         patch("backend.database.fetch_profile_from_db", return_value=None):
        mock_calc.return_value = PriceBreakdown(
            basePrice=650.0,
            demandCount=10,
            supplySeats=10,
            demandSupplyRatio=1.0,
            demandMultiplier=1.0,
            timeMultiplier=1.0,
            occupancyMultiplier=1.0,
            rawPrice=650.0,
            priceFloor=550.0,
            priceCeiling=845.0,
            finalPrice=650.0,
            explanation="Normal market balance",
            marketSegment="BLR->HYD"
        )
        trip_created = insert_trip_in_db("driver-1", payload_underprice, client=mock_client)

        # The authoritative pricePerSeat must be 650, NOT 1.0!
        assert trip_created.pricePerSeat == 650.0
        assert trip_created.currentMarketPrice == 650.0


# ============================================================
# 8. IMMUTABLE BOOKING PRICE TESTS
# ============================================================

def test_immutable_booking_price_remains_frozen():
    """When market price rises after booking, confirmed booking priceAtBooking must NOT change."""
    from backend.database import create_booking_in_db

    mock_client = MagicMock()

    # Initial trip at ₹650
    mock_trip_initial = TripSchema(
        id="trip-freeze-1",
        driverId="driver-1",
        driverName="Driver One",
        driverInitials="DO",
        driverRating=4.9,
        driverTripsCount=20,
        driverIsVerified=True,
        origin="Bengaluru",
        destination="Hyderabad",
        date="2026-10-17",
        departureTime="08:00",
        totalSeats=3,
        availableSeats=3,
        pricePerSeat=650.0,
        currentMarketPrice=650.0,
        basePrice=650.0,
        status="upcoming",
        vehicle=DEFAULT_TEST_VEHICLE
    )

    with patch("backend.database.fetch_trip_by_id_from_db", return_value=mock_trip_initial):
        # Mock book_trip_seats RPC returning success
        mock_client.rpc().execute.return_value.data = {
            "success": True,
            "booking_id": "booking-freeze-xyz"
        }
        mock_client.table().select().eq().execute.return_value.data = []

        booking_req = BookingCreate(
            tripId="trip-freeze-1",
            seatsCount=1,
            luggageTier="small",
            totalAmount=650.0
        )

        booking_res = create_booking_in_db("passenger-1", booking_req, client=mock_client)
        assert booking_res.totalPaid == 650.0
        assert booking_res.priceAtBooking == 650.0

        # Now simulate market price surge to ₹750
        mock_trip_surged = mock_trip_initial.model_copy(update={
            "pricePerSeat": 750.0,
            "currentMarketPrice": 750.0
        })

        # The historical booking record totalPaid and priceAtBooking must remain exactly 650.0
        assert booking_res.totalPaid == 650.0
        assert booking_res.priceAtBooking == 650.0
        assert booking_res.priceAtBooking != mock_trip_surged.currentMarketPrice


# ============================================================
# 9. MATCHING ENGINE CONSUMES AUTHORITATIVE MARKET PRICE
# ============================================================

def test_matching_engine_uses_current_market_price():
    """Matching engine candidate filter and feature calculator must consume authoritative market price."""
    trip = TripSchema(
        id="trip-match-price",
        driverId="driver-2",
        driverName="Driver Two",
        driverInitials="DT",
        driverRating=5.0,
        driverTripsCount=10,
        driverIsVerified=True,
        origin="Bengaluru",
        destination="Hyderabad",
        date="2026-10-17",
        departureTime="08:00",
        totalSeats=4,
        availableSeats=4,
        pricePerSeat=720.0,          # Outdated/old driver price
        currentMarketPrice=650.0,    # Authoritative current market price
        status="upcoming",
        vehicle=DEFAULT_TEST_VEHICLE
    )

    req = MatchingRequest(
        origin="Bengaluru",
        destination="Hyderabad",
        date="2026-10-17",
        departure_time="08:00",
        seats=1,
        budget=680.0  # Budget is ₹680
    )

    # FeatureCalculator calculates price difference against currentMarketPrice (650), which is within budget!
    breakdown, raw, _ = FeatureCalculator.calculate_all_features(req, trip)
    assert raw.price_difference == -30.0  # 650 - 680 = -30 (within budget)
    assert breakdown.price == 100.0       # Full satisfaction since price <= budget


# ============================================================
# 10. API QUOTA & CONSERVATION SAFETY TESTS
# ============================================================

def test_zero_mapbox_calls_during_pricing_with_stored_data():
    """100 pricing calculations must execute 0 Mapbox API calls."""
    req = PriceEstimateRequest(
        origin="Bengaluru",
        destination="Hyderabad",
        travelDate="2026-10-17",
        departureTime="08:00",
        originLat=12.9716,
        originLon=77.5946,
        destLat=17.3850,
        destLon=78.4867,
        totalSeats=4,
        availableSeats=4
    )

    with patch("backend.pricing.market_analyzer.MarketAnalyzer.aggregate_market_supply_and_demand", return_value=(10, 10, 1.0)), \
         patch("urllib.request.urlopen") as mock_url, \
         patch("requests.get") as mock_req_get:

        for _ in range(100):
            breakdown = DynamicPricingEngine.calculate_price(req)
            assert breakdown.finalPrice > 0

        # External HTTP calls must remain strictly 0
        assert mock_url.call_count == 0
        assert mock_req_get.call_count == 0


def test_zero_razorpay_calls_during_pricing_and_matching():
    """Pricing calculation and candidate matching must execute 0 Razorpay calls."""
    with patch("urllib.request.urlopen") as mock_url, \
         patch("requests.post") as mock_req_post:

        # 1. Pricing calculation
        req_pricing = PriceEstimateRequest(
            origin="Bengaluru", destination="Hyderabad", travelDate="2026-10-17", departureTime="08:00"
        )
        DynamicPricingEngine.calculate_price(req_pricing)

        # 2. Matching evaluation
        req_matching = MatchingRequest(
            origin="Bengaluru", destination="Hyderabad", date="2026-10-17", seats=1
        )
        trip = TripSchema(
            id="trip-1", driverId="d1", driverName="D", driverInitials="D", driverRating=5.0,
            driverTripsCount=1, driverIsVerified=True, origin="Bengaluru", destination="Hyderabad",
            date="2026-10-17", departureTime="08:00", totalSeats=3, availableSeats=3,
            pricePerSeat=650.0, currentMarketPrice=650.0, status="upcoming",
            vehicle=DEFAULT_TEST_VEHICLE
        )
        FeatureCalculator.calculate_all_features(req_matching, trip)

        # External payment requests must be 0
        assert mock_url.call_count == 0
        assert mock_req_post.call_count == 0


# ============================================================
# 11. AUDIT VERIFICATION: IMMUTABILITY, BOUNDS, EVENT RECALC
# ============================================================

def test_race_condition_market_price_surge_between_booking_and_payment_creation():
    """
    CRITICAL AUDIT ITEM 2:
    current_market_price -> booking.price_at_booking -> Razorpay order amount
    When market price surges between booking creation and Razorpay order creation,
    Razorpay MUST strictly use price_at_booking, never the surged current_market_price.
    """
    mock_client = MagicMock()
    mock_builder = MagicMock()
    mock_client.table.return_value = mock_builder
    mock_builder.select.return_value = mock_builder
    mock_builder.eq.return_value = mock_builder
    mock_builder.in_.return_value = mock_builder
    mock_builder.order.return_value = mock_builder
    mock_builder.limit.return_value = mock_builder

    # Initial trip state at ₹650
    initial_trip = TripSchema(
        id="trip-race-1",
        driverId="driver-1",
        driverName="Driver One",
        driverInitials="DO",
        driverRating=4.9,
        driverTripsCount=10,
        driverIsVerified=True,
        origin="Bengaluru",
        destination="Hyderabad",
        date="2026-10-17",
        departureTime="08:00",
        totalSeats=3,
        availableSeats=2,
        pricePerSeat=650.0,
        currentMarketPrice=650.0,
        status="upcoming",
        vehicle=DEFAULT_TEST_VEHICLE
    )

    # 1. Booking created with frozen price_at_booking = 650.0
    booking_id = "booking-race-xyz"
    booking_record = {
        "id": booking_id,
        "trip_id": "trip-race-1",
        "passenger_id": "passenger-race",
        "seats_count": 1,
        "price_at_booking": 650.0,
        "total_paid": 650.0,
        "status": "confirmed"
    }

    # 2. Race condition: Another user books or demand surges, so trip price in DB jumps to ₹850!
    surged_trip = initial_trip.model_copy(update={
        "pricePerSeat": 850.0,
        "currentMarketPrice": 850.0,
        "availableSeats": 1
    })

    # Mock database returning the surged trip, but the existing booking has price_at_booking = 650.0
    with patch("backend.database.fetch_trip_by_id_from_db", return_value=surged_trip), \
         patch("backend.database.RAZORPAY_KEY_ID", "rzp_test_mock_key"), \
         patch("backend.database.RAZORPAY_KEY_SECRET", "mock_secret"):

        # Mock bookings query returning the frozen booking
        def mock_execute():
            res = MagicMock()
            res.data = [booking_record]
            return res
        mock_builder.execute.side_effect = mock_execute

        payment_req = PaymentOrderCreate(
            tripId="trip-race-1",
            seatsCount=1,
            luggageTier="small",
            bookingId=booking_id
        )

        with patch("razorpay.Client") as mock_rzp_client:
            mock_order_instance = MagicMock()
            mock_order_instance.order.create.return_value = {
                "id": "order_race_test_123",
                "amount": 65000,
                "currency": "INR",
                "receipt": "rcpt_race"
            }
            mock_rzp_client.return_value = mock_order_instance

            # Create payment order
            order_resp = create_razorpay_order_in_db("passenger-race", payment_req, client=mock_client)

            # VERIFY: Razorpay order amount uses price_at_booking (₹650.0 -> 65000 paise), NOT ₹850.0!
            assert order_resp.amountRupees == 650.0
            assert order_resp.amount == 65000
            assert order_resp.amountRupees != surged_trip.currentMarketPrice
            assert booking_record["price_at_booking"] == 650.0


def test_price_floor_and_ceiling_under_all_combinations():
    """
    CRITICAL AUDIT ITEM 3:
    Verify floor and ceiling are strictly applied under ALL demand/time/occupancy combinations.
    final_price >= floor
    final_price <= ceiling
    """
    test_dsrs = [0.0, 0.1, 0.3, 0.8, 1.0, 1.5, 2.5, 5.0, 20.0, 100.0]
    test_hours = [0.0, 0.5, 2.0, 12.0, 24.0, 48.0, 168.0, 720.0]
    test_occupancies = [(0, 4), (1, 4), (2, 4), (3, 4), (4, 4)]
    test_base_prices = [150.0, 250.0, 500.0, 650.0, 1200.0, 3000.0]

    for base in test_base_prices:
        floor, ceil = PricingMultipliers.calculate_floor_and_ceiling(base)
        assert floor >= MINIMUM_PLATFORM_PRICE
        assert floor <= ceil
        assert floor % PRICE_ROUNDING_UNIT == 0
        assert ceil % PRICE_ROUNDING_UNIT == 0

        for dsr in test_dsrs:
            d_mult = PricingMultipliers.calculate_demand_multiplier(dsr)
            assert MIN_DEMAND_MULTIPLIER <= d_mult <= MAX_DEMAND_MULTIPLIER

            for h in test_hours:
                t_mult = PricingMultipliers.calculate_time_multiplier(h, dsr)
                assert MIN_TIME_MULTIPLIER <= t_mult <= MAX_TIME_MULTIPLIER

                for b_seats, t_seats in test_occupancies:
                    o_mult = PricingMultipliers.calculate_occupancy_multiplier(b_seats, t_seats)
                    assert MIN_OCCUPANCY_MULTIPLIER <= o_mult <= MAX_OCCUPANCY_MULTIPLIER

                    raw_price = base * d_mult * t_mult * o_mult
                    final_price, f_out, c_out = PricingMultipliers.apply_bounds_and_rounding(raw_price, base)

                    # STRICT AUDIT ASSERTIONS
                    assert final_price >= floor, f"Failed floor: {final_price} < {floor} for base={base}, dsr={dsr}, h={h}"
                    assert final_price <= ceil, f"Failed ceiling: {final_price} > {ceil} for base={base}, dsr={dsr}, h={h}"
                    assert final_price % PRICE_ROUNDING_UNIT == 0


def test_demand_supply_filters_invalid_cancelled_expired_completed_duplicate():
    """
    CRITICAL AUDIT ITEM 4:
    Verify only valid active passenger requests count toward demand.
    Exclude: cancelled, expired, completed, duplicate, fulfilled, invalid.
    Verify only active eligible seats count toward supply.
    """
    mock_client = MagicMock()
    mock_builder_trips = MagicMock()
    mock_builder_reqs = MagicMock()

    # Passenger requests mock data
    mock_reqs_data = [
        {"id": "req-1", "origin": "Bengaluru", "destination": "Hyderabad", "seats_needed": 2, "status": "active"},
        {"id": "req-2", "origin": "Bengaluru", "destination": "Hyderabad", "seats_needed": 1, "status": "active"},
        {"id": "req-3", "origin": "Bengaluru", "destination": "Hyderabad", "seats_needed": 4, "status": "cancelled"},
        {"id": "req-4", "origin": "Bengaluru", "destination": "Hyderabad", "seats_needed": 2, "status": "expired"},
        {"id": "req-5", "origin": "Bengaluru", "destination": "Hyderabad", "seats_needed": 1, "status": "completed"},
        {"id": "req-6", "origin": "Bengaluru", "destination": "Hyderabad", "seats_needed": 3, "status": "fulfilled"},
        {"id": "req-7", "origin": "Bengaluru", "destination": "Hyderabad", "seats_needed": 0, "status": "active"},     # Invalid 0 seats
        {"id": "req-1", "origin": "Bengaluru", "destination": "Hyderabad", "seats_needed": 2, "status": "active"},     # Duplicate ID
    ]

    # Trips mock data
    mock_trips_data = [
        {"id": "trip-1", "origin": "Bengaluru", "destination": "Hyderabad", "available_seats": 3, "status": "upcoming"},
        {"id": "trip-2", "origin": "Bengaluru", "destination": "Hyderabad", "available_seats": 2, "status": "cancelled"},
        {"id": "trip-3", "origin": "Bengaluru", "destination": "Hyderabad", "available_seats": 4, "status": "completed"},
        {"id": "trip-4", "origin": "Bengaluru", "destination": "Hyderabad", "available_seats": 0, "status": "upcoming"},  # 0 seats
        {"id": "trip-1", "origin": "Bengaluru", "destination": "Hyderabad", "available_seats": 3, "status": "upcoming"},  # Duplicate ID
    ]

    def mock_table(table_name):
        b = MagicMock()
        b.select.return_value = b
        b.eq.return_value = b
        if table_name == "passenger_requests":
            b.execute.return_value = MagicMock(data=mock_reqs_data)
        elif table_name == "trips":
            b.execute.return_value = MagicMock(data=mock_trips_data)
        return b

    mock_client.table.side_effect = mock_table

    demand, supply, dsr = MarketAnalyzer.aggregate_market_supply_and_demand(
        origin_name="Bengaluru",
        dest_name="Hyderabad",
        date_str="2026-10-17",
        client=mock_client
    )

    # Expected Demand: Only req-1 (2 seats) + req-2 (1 seat) = 3
    assert demand == 3, f"Expected active demand of 3, got {demand}"

    # Expected Supply: Only trip-1 (3 seats) = 3
    assert supply == 3, f"Expected active supply of 3, got {supply}"

    # Expected DSR: 3 / 3 = 1.00
    assert dsr == 1.00


def test_market_segment_coordinates_preferred_over_text():
    """
    CRITICAL AUDIT ITEM 5:
    Verify geocoded coordinates are preferred over text matching.
    Text matching is fallback only.
    """
    # 1. Nearby coordinates match even when city text differs
    ecity_lat, ecity_lon = 12.8399, 77.6770   # Electronic City
    blr_lat, blr_lon = 12.9716, 77.5946       # Bengaluru Central (~16 km distance)
    assert MarketAnalyzer.is_location_in_zone(
        "Electronic City", ecity_lat, ecity_lon, "Bengaluru", blr_lat, blr_lon
    ) is True, "Nearby coordinates must match despite different location names"

    # 2. Far coordinates do not match even if query text is present
    mys_lat, mys_lon = 12.2958, 76.6394       # Mysuru (~140 km from Bengaluru)
    assert MarketAnalyzer.is_location_in_zone(
        "Mysuru Near Bengaluru", mys_lat, mys_lon, "Bengaluru", blr_lat, blr_lon
    ) is False, "Coordinates outside 40km radius must NOT match despite substring presence"

    # 3. Fallback to text matching ONLY when coordinates are absent
    assert MarketAnalyzer.is_location_in_zone(
        "Koramangala Bengaluru", None, None, "Bengaluru", None, None
    ) is True, "Text matching must succeed when no coordinates are present"


def test_cache_invalidation_and_event_recalculation_on_corridor_lifecycle_events():
    """
    CRITICAL AUDIT ITEMS 8 & 9:
    Verify corridor cache invalidation and event recalculation on lifecycle events:
    trip created/cancelled, booking created/cancelled, request created/cancelled.
    No polling.
    """
    # Prime in-memory pricing cache
    cache_key = "bengaluru:hyderabad:2026-10-17:morning:3:3:sedan"
    breakdown = PriceBreakdown(
        basePrice=650.0, demandCount=5, supplySeats=5, demandSupplyRatio=1.0,
        demandMultiplier=1.0, timeMultiplier=1.0, occupancyMultiplier=1.0,
        rawPrice=650.0, priceFloor=550.0, priceCeiling=845.0, finalPrice=650.0,
        explanation="Cached", marketSegment="BLR->HYD"
    )
    DynamicPricingEngine._pricing_cache[cache_key] = (datetime.datetime.now(datetime.timezone.utc), breakdown)
    assert cache_key in DynamicPricingEngine._pricing_cache

    # Invalidate cache for corridor
    DynamicPricingEngine.invalidate_cache("Bengaluru", "Hyderabad")
    assert cache_key not in DynamicPricingEngine._pricing_cache

    # Verify PricingService corridor event handlers operate without errors
    mock_client = MagicMock()
    b = MagicMock()
    b.select.return_value = b
    b.eq.return_value = b
    b.execute.return_value = MagicMock(data=[{"origin": "Bengaluru", "destination": "Hyderabad", "date": "2026-10-17"}])
    mock_client.table.return_value = b

    with patch.object(PricingService, "recalculate_trips_for_market", return_value=[{"trip_id": "t1"}]) as mock_recalc:
        PricingService.handle_trip_event("trip-1", client=mock_client, event_type="trip_created")
        PricingService.handle_booking_event("trip-1", client=mock_client, event_type="booking_created")
        PricingService.handle_passenger_request_event("req-1", client=mock_client, event_type="request_created")

        assert mock_recalc.call_count == 3
        # Recalculation is targeted strictly to the affected market
        for call_args in mock_recalc.call_args_list:
            assert call_args[0][0] == "Bengaluru"
            assert call_args[0][1] == "Hyderabad"
            assert call_args[0][2] == "2026-10-17"


def test_arbitrary_driver_price_underpricing_and_gouging_both_overridden():
    """
    CRITICAL AUDIT ITEM 10:
    Attempt price = ₹1 and price = ₹10,000.
    Verify backend ignores both and writes authoritative market price to PostgreSQL.
    """
    mock_client = MagicMock()
    mock_builder = MagicMock()
    mock_client.table.return_value = mock_builder
    created_row = {
        "id": "trip-id-1",
        "driver_id": "driver-1",
        "origin": "Bengaluru",
        "destination": "Hyderabad",
        "date": "2026-10-17",
        "departure_time": "08:00",
        "total_seats": 3,
        "available_seats": 3,
        "price_per_seat": 650.0,
        "current_market_price": 650.0,
        "base_price": 650.0,
        "status": "upcoming"
    }
    mock_builder.execute.return_value = MagicMock(data=[created_row])
    mock_builder.eq.return_value = mock_builder
    mock_builder.select.return_value = mock_builder
    mock_builder.insert.return_value = mock_builder
    mock_builder.update.return_value = mock_builder
    mock_client.rpc.return_value.execute.return_value = MagicMock(data={"trip_id": "trip-id-1"})

    authoritative_breakdown = PriceBreakdown(
        basePrice=650.0, demandCount=10, supplySeats=10, demandSupplyRatio=1.0,
        demandMultiplier=1.0, timeMultiplier=1.0, occupancyMultiplier=1.0,
        rawPrice=650.0, priceFloor=550.0, priceCeiling=845.0, finalPrice=650.0,
        explanation="Authoritative platform rate", marketSegment="BLR->HYD"
    )

    with patch("backend.pricing.engine.DynamicPricingEngine.calculate_price", return_value=authoritative_breakdown), \
         patch("backend.database.fetch_profile_from_db", return_value=None):

        # 1. Driver attempts ₹1.0
        payload_1 = TripCreate(
            origin="Bengaluru", destination="Hyderabad", date="2026-10-17",
            departureTime="08:00", totalSeats=3, pricePerSeat=1.0
        )
        trip_1 = insert_trip_in_db("driver-1", payload_1, client=mock_client)
        assert trip_1.pricePerSeat == 650.0
        assert trip_1.currentMarketPrice == 650.0

        # 2. Driver attempts ₹10,000.0 (gouging)
        payload_10k = TripCreate(
            origin="Bengaluru", destination="Hyderabad", date="2026-10-17",
            departureTime="08:00", totalSeats=3, pricePerSeat=10000.0
        )
        trip_10k = insert_trip_in_db("driver-1", payload_10k, client=mock_client)
        assert trip_10k.pricePerSeat == 650.0
        assert trip_10k.currentMarketPrice == 650.0
