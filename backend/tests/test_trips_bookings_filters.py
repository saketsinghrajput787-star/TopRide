import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import (
    to_canonical_iso_date,
    trip_row_to_schema,
    fetch_my_trips_from_db,
    complete_trip_in_db,
    fetch_bookings_from_db
)
from backend.schemas import TripSchema, TripCreate, BookingCreate

client = TestClient(app)

# ================= TEST FIXTURES & MOCKS =================
DRIVER_ID_A = "11111111-1111-1111-1111-111111111111"
DRIVER_ID_B = "22222222-2222-2222-2222-222222222222"
PASSENGER_ID_A = "33333333-3333-3333-3333-333333333333"
PASSENGER_ID_B = "44444444-4444-4444-4444-444444444444"

TRIP_ROW_FUTURE = {
    "id": "aaaa1111-0000-0000-0000-000000000001",
    "driver_id": DRIVER_ID_A,
    "origin": "Bengaluru",
    "origin_detail": "Koramangala",
    "destination": "Hyderabad",
    "destination_detail": "Gachibowli",
    "date": "2026-10-31",
    "departure_time": "08:00",
    "arrival_time": "16:30",
    "duration": "8h 30m",
    "total_seats": 4,
    "available_seats": 3,
    "price_per_seat": 650.0,
    "current_market_price": 650.0,
    "status": "upcoming",
    "created_at": "2026-10-10T00:00:00Z"
}

TRIP_ROW_PAST = {
    "id": "aaaa1111-0000-0000-0000-000000000002",
    "driver_id": DRIVER_ID_A,
    "origin": "Bengaluru",
    "destination": "Mysuru",
    "date": "2026-10-01",
    "departure_time": "07:00",
    "arrival_time": "10:30",
    "duration": "3h 30m",
    "total_seats": 3,
    "available_seats": 1,
    "price_per_seat": 350.0,
    "current_market_price": 350.0,
    "status": "completed",
    "created_at": "2026-09-28T00:00:00Z"
}

TRIP_ROW_CANCELLED = {
    "id": "aaaa1111-0000-0000-0000-000000000003",
    "driver_id": DRIVER_ID_A,
    "origin": "Bengaluru",
    "destination": "Chennai",
    "date": "2026-10-25",
    "departure_time": "06:00",
    "total_seats": 4,
    "available_seats": 0,
    "price_per_seat": 500.0,
    "status": "cancelled",
    "created_at": "2026-10-05T00:00:00Z"
}

# ================= 1. DRIVER SEES OWN PUBLISHED TRIPS =================
def test_driver_sees_own_published_trips():
    """Verify that fetch_my_trips_from_db queries trips filtered strictly by driver_id."""
    mock_client = MagicMock()
    mock_query = MagicMock()
    mock_client.table.return_value = mock_query
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.execute.return_value.data = [TRIP_ROW_FUTURE, TRIP_ROW_PAST, TRIP_ROW_CANCELLED]

    # Mock empty bookings and vehicles
    mock_subquery = MagicMock()
    mock_subquery.select.return_value = mock_subquery
    mock_subquery.eq.return_value = mock_subquery
    mock_subquery.order.return_value = mock_subquery
    mock_subquery.execute.return_value.data = []

    def table_router(name):
        if name == "trips":
            return mock_query
        return mock_subquery

    mock_client.table.side_effect = table_router

    with patch("backend.database.fetch_profile_from_db", return_value=None):
        trips = fetch_my_trips_from_db(user_id=DRIVER_ID_A, client=mock_client)

    assert len(trips) == 3
    assert all(t.isDriverTrip for t in trips)
    assert trips[0].origin == "Bengaluru"
    assert trips[0].destination == "Hyderabad"
    # Ensure eq("driver_id", DRIVER_ID_A) was called
    mock_query.eq.assert_called_with("driver_id", DRIVER_ID_A)

# ================= 2. DRIVER DOES NOT SEE ANOTHER DRIVER'S PRIVATE TRIPS =================
def test_driver_does_not_see_another_drivers_private_trips():
    """Verify Driver B cannot access Driver A's trips list."""
    mock_client = MagicMock()
    mock_query = MagicMock()
    mock_client.table.return_value = mock_query
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.order.return_value = mock_query
    # For DRIVER_ID_B, DB returns only Driver B's trips
    mock_query.execute.return_value.data = []

    trips = fetch_my_trips_from_db(user_id=DRIVER_ID_B, client=mock_client)
    assert len(trips) == 0
    mock_query.eq.assert_called_with("driver_id", DRIVER_ID_B)

# ================= 3. PASSENGER SEES OWN BOOKINGS =================
def test_passenger_sees_own_bookings():
    """Verify fetch_bookings_from_db returns bookings where passenger_id == authenticated user."""
    mock_client = MagicMock()
    mock_b_query = MagicMock()
    mock_b_query.select.return_value = mock_b_query
    mock_b_query.eq.return_value = mock_b_query
    mock_b_query.order.return_value = mock_b_query
    mock_b_query.execute.return_value.data = [
        {
            "id": "bbbb1111-0000-0000-0000-000000000001",
            "booking_ref": "TR-PAS01",
            "trip_id": TRIP_ROW_FUTURE["id"],
            "passenger_id": PASSENGER_ID_A,
            "seats_count": 2,
            "luggage_tier": "medium",
            "total_paid": 1300.0,
            "payment_status": "completed",
            "booking_status": "confirmed",
            "created_at": "2026-10-11T10:00:00Z"
        }
    ]

    mock_client.table.return_value = mock_b_query

    with patch("backend.database.fetch_trip_by_id_from_db") as mock_fetch_trip:
        mock_trip_schema = MagicMock()
        mock_trip_schema.model_dump.return_value = TRIP_ROW_FUTURE
        mock_fetch_trip.return_value = mock_trip_schema

        with patch("backend.database.fetch_profile_from_db", return_value=None):
            bookings = fetch_bookings_from_db(user_id=PASSENGER_ID_A, as_driver=False, client=mock_client)

    assert len(bookings) == 1
    assert bookings[0]["bookingRef"] == "TR-PAS01"
    assert bookings[0]["seatsCount"] == 2
    assert bookings[0]["totalPaid"] == 1300.0
    assert bookings[0]["bookingStatus"] == "confirmed"
    mock_b_query.eq.assert_called_with("passenger_id", PASSENGER_ID_A)

# ================= 4. PASSENGER DOES NOT SEE ANOTHER PASSENGER'S BOOKINGS =================
def test_passenger_does_not_see_another_passengers_bookings():
    """Verify Passenger B cannot see Passenger A's bookings."""
    mock_client = MagicMock()
    mock_b_query = MagicMock()
    mock_b_query.select.return_value = mock_b_query
    mock_b_query.eq.return_value = mock_b_query
    mock_b_query.order.return_value = mock_b_query
    mock_b_query.execute.return_value.data = []
    mock_client.table.return_value = mock_b_query

    bookings = fetch_bookings_from_db(user_id=PASSENGER_ID_B, as_driver=False, client=mock_client)
    assert len(bookings) == 0
    mock_b_query.eq.assert_called_with("passenger_id", PASSENGER_ID_B)

# ================= 5. DATE NORMALIZATION & UPCOMING / PAST CLASSIFICATION =================
def test_canonical_date_normalization_handles_various_formats():
    """Verify date parsing correctly handles ISO, abbreviated text, and edge cases."""
    assert to_canonical_iso_date("2026-10-31") == "2026-10-31"
    assert to_canonical_iso_date("Sat, 31 Oct") == "2026-10-31"
    assert to_canonical_iso_date("12 Oct 2026") == "2026-10-12"
    assert to_canonical_iso_date("invalid-date") is None

# ================= 6. DRIVER COMPLETES TRIP ATOMICALLY =================
def test_driver_can_complete_trip():
    """Verify complete_trip_in_db updates trip status to completed and updates confirmed bookings."""
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.execute.return_value.data = [TRIP_ROW_FUTURE]

    mock_client.table.return_value = mock_table

    with patch("backend.database.fetch_profile_from_db", return_value=None):
        success = complete_trip_in_db(
            trip_id=TRIP_ROW_FUTURE["id"],
            driver_id=DRIVER_ID_A,
            client=mock_client
        )

    assert success is True
    assert any(
        isinstance(call.args[0], dict) and call.args[0].get("status") == "completed"
        for call in mock_table.update.call_args_list
    )

# ================= 7. UNAUTHORIZED USER CANNOT COMPLETE ANOTHER'S TRIP =================
def test_unauthorized_user_cannot_complete_trip():
    """Verify non-driver user cannot complete another driver's trip."""
    from fastapi import HTTPException
    mock_client = MagicMock()
    mock_trips = MagicMock()
    mock_trips.select.return_value = mock_trips
    mock_trips.eq.return_value = mock_trips
    mock_trips.execute.return_value.data = [TRIP_ROW_FUTURE] # driver_id is DRIVER_ID_A
    mock_client.table.return_value = mock_trips

    with pytest.raises(HTTPException) as exc_info:
        complete_trip_in_db(
            trip_id=TRIP_ROW_FUTURE["id"],
            driver_id="hacker-user-id",
            client=mock_client
        )
    assert exc_info.value.status_code == 403

# ================= 8. CANCELLED TRIP CANNOT BE COMPLETED =================
def test_cancelled_trip_cannot_be_completed():
    """Verify cancelled trips reject completion."""
    from fastapi import HTTPException
    mock_client = MagicMock()
    mock_trips = MagicMock()
    mock_trips.select.return_value = mock_trips
    mock_trips.eq.return_value = mock_trips
    mock_trips.execute.return_value.data = [TRIP_ROW_CANCELLED]
    mock_client.table.return_value = mock_trips

    with pytest.raises(HTTPException) as exc_info:
        complete_trip_in_db(
            trip_id=TRIP_ROW_CANCELLED["id"],
            driver_id=DRIVER_ID_A,
            client=mock_client
        )
    assert exc_info.value.status_code == 400
    assert "Cannot complete a cancelled trip" in exc_info.value.detail

# ================= 9. DRIVER TRIP INCLUDES PASSENGER BOOKINGS ENRICHMENT =================
def test_driver_trip_enriches_passenger_bookings_list():
    """Verify driver trip schema populates passenger bookings list."""
    mock_client = MagicMock()
    mock_b_query = MagicMock()
    mock_b_query.select.return_value = mock_b_query
    mock_b_query.eq.return_value = mock_b_query
    mock_b_query.order.return_value = mock_b_query
    mock_b_query.execute.return_value.data = [
        {
            "id": "bbbb-1",
            "booking_ref": "TR-1234",
            "passenger_id": PASSENGER_ID_A,
            "seats_count": 1,
            "total_paid": 650.0,
            "booking_status": "confirmed",
            "payment_status": "completed",
            "luggage_tier": "medium",
            "created_at": "2026-10-12T00:00:00Z"
        }
    ]

    mock_client.table.return_value = mock_b_query

    with patch("backend.database.fetch_profile_from_db") as mock_prof:
        mock_p = MagicMock()
        mock_p.name = "Test Passenger"
        mock_p.initials = "TP"
        mock_p.avatar = ""
        mock_p.rating = 4.9
        mock_p.tripsCount = 5
        mock_p.isVerified = True
        mock_prof.return_value = mock_p

        schema = trip_row_to_schema(TRIP_ROW_FUTURE, user_id=DRIVER_ID_A, client=mock_client)

    assert schema.isDriverTrip is True
    assert len(schema.passengerBookings) == 1
    assert schema.passengerBookings[0].passengerName == "Test Passenger"
    assert schema.passengerBookings[0].bookingRef == "TR-1234"
    assert schema.passengerBookings[0].totalPaid == 650.0
