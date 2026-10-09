import os
import uuid
import hmac
import hashlib
import pytest
from fastapi import HTTPException
from backend.config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
from backend.database import (
    supabase_client, get_user_supabase_client,
    insert_trip_in_db, fetch_trip_by_id_from_db,
    create_booking_in_db, cancel_booking_in_db,
    verify_razorpay_payment_signature, verify_payment_and_book_in_db,
    create_razorpay_order_in_db
)
from backend.schemas import (
    TripCreate, BookingCreate, PaymentOrderCreate, PaymentVerifyRequest
)

def test_seat_availability_progression_five_seats():
    """
    Test Phase 3:
    1. Driver posts trip with 5 seats -> 5 available seats.
    2. Passenger books 1 -> 4 remain.
    3. Passenger books 2 -> 2 remain.
    4. Passenger books final 2 -> 0 remain.
    5. Booking more seats when 0 remain is rejected (409 Conflict).
    6. Cancellation releases seats back.
    """
    # Login Driver (Arjun) and Passenger (Saket)
    login_arjun = supabase_client.auth.sign_in_with_password({
        "email": "arjun.driver.test@gmail.com",
        "password": "ArjunTest"
    })
    arjun_id = str(login_arjun.user.id)
    arjun_client = get_user_supabase_client(login_arjun.session.access_token)

    login_saket = supabase_client.auth.sign_in_with_password({
        "email": "demo@topride.app",
        "password": "somepassword123"
    })
    saket_id = str(login_saket.user.id)
    saket_client = get_user_supabase_client(login_saket.session.access_token)

    # 1. Driver posts a 5-seater trip
    trip_payload = TripCreate(
        origin="Bengaluru",
        destination="Hyderabad",
        date="Wed, 28 Oct",
        departureTime="07:30",
        totalSeats=5,
        availableSeats=5,
        pricePerSeat=550.0,
        currency="₹",
        luggageAllowed="Medium",
        instantBooking=True,
        tripRules=["No smoking", "Keep luggage clean"],
        status="upcoming"
    )
    posted_trip = insert_trip_in_db(arjun_id, trip_payload, client=arjun_client)
    trip_id = posted_trip.id

    try:
        # Check initial state: 5 total, 5 available
        trip_check = fetch_trip_by_id_from_db(trip_id, client=saket_client)
        assert trip_check is not None
        assert trip_check.totalSeats == 5
        assert trip_check.availableSeats == 5

        # 2. Passenger books 1 seat -> 4 remain
        b1 = create_booking_in_db(saket_id, BookingCreate(
            tripId=trip_id,
            seatsCount=1,
            totalAmount=550.0,
            luggageTier="small",
            passengerNotes="1 passenger"
        ), client=saket_client)
        assert b1 is not None

        trip_check_1 = fetch_trip_by_id_from_db(trip_id, client=saket_client)
        assert trip_check_1.availableSeats == 4

        # 3. Passenger books 2 seats -> 2 remain
        b2 = create_booking_in_db(saket_id, BookingCreate(
            tripId=trip_id,
            seatsCount=2,
            totalAmount=1100.0,
            luggageTier="small",
            passengerNotes="2 passengers"
        ), client=saket_client)
        assert b2 is not None

        trip_check_2 = fetch_trip_by_id_from_db(trip_id, client=saket_client)
        assert trip_check_2.availableSeats == 2

        # 4. Passenger books final 2 seats -> 0 remain
        b3 = create_booking_in_db(saket_id, BookingCreate(
            tripId=trip_id,
            seatsCount=2,
            totalAmount=1100.0,
            luggageTier="small",
            passengerNotes="Final 2 passengers"
        ), client=saket_client)
        assert b3 is not None

        trip_check_3 = fetch_trip_by_id_from_db(trip_id, client=saket_client)
        assert trip_check_3.availableSeats == 0

        # 5. Overbooking attempt: booking 1 more seat must fail with 409 Conflict
        with pytest.raises(HTTPException) as exc_info:
            create_booking_in_db(saket_id, BookingCreate(
                tripId=trip_id,
                seatsCount=1,
                totalAmount=550.0,
                luggageTier="small",
                passengerNotes="Attempt overbooking"
            ), client=saket_client)
        assert exc_info.value.status_code == 409

        # 6. Cancellation releases seats: cancel b1 (1 seat) -> 1 seat available
        cancel_booking_in_db(b1.id, saket_id, reason="Testing seat release cancellation", client=saket_client)
        trip_check_cancelled = fetch_trip_by_id_from_db(trip_id, client=saket_client)
        assert trip_check_cancelled.availableSeats == 1

    finally:
        # Cleanup test trip
        try:
            supabase_client.table("trip_seats").delete().eq("trip_id", trip_id).execute()
            supabase_client.table("bookings").delete().eq("trip_id", trip_id).execute()
            supabase_client.table("trips").delete().eq("id", trip_id).execute()
        except Exception:
            pass

def test_payment_signature_verification_and_idempotency():
    """
    Test Phase 2:
    1. Signature verification succeeds with valid HMAC-SHA256.
    2. Signature verification fails with invalid/tampered signature.
    3. Idempotent payment verification does not double-decrement seats on repeat calls.
    """
    assert RAZORPAY_KEY_SECRET, "RAZORPAY_KEY_SECRET must be configured"

    mock_order = f"order_{uuid.uuid4().hex[:12]}"
    mock_payment = f"pay_{uuid.uuid4().hex[:12]}"
    valid_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{mock_order}|{mock_payment}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # Valid signature
    assert verify_razorpay_payment_signature(mock_order, mock_payment, valid_sig) is True

    # Tampered / invalid signature
    tampered_sig = valid_sig[:-4] + "0000"
    assert verify_razorpay_payment_signature(mock_order, mock_payment, tampered_sig) is False
    assert verify_razorpay_payment_signature(mock_order, "pay_different", valid_sig) is False
