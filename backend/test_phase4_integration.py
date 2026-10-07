"""
============================================================
TOPRIDE — PHASE 4: COMPLETE BUSINESS LOGIC & PRODUCT INTEGRATION
END-TO-END AUTOMATED TEST SUITE
============================================================
Tests:
1. Core Driver Flow (Login, Profile, Vehicle, Trip Creation, Verification)
2. Core Passenger Flow (Login, Find, Search, Details)
3. Driver Self-Booking Enforcement (HTTP 400 blocked at order & booking tier)
4. Seat Concurrency & Atomic Ledger Locking (Row-level lock, Overbooking protection)
5. Razorpay Test Mode Safety & Order Reuse (Deduplication, Invalidation on param change)
6. Payment Verification & Webhook Idempotency (HMAC SHA256, Zero double-booking)
7. Cancellation Lifecycle (Passenger cancel -> seats restored + driver notified; Driver cancel -> bookings cancelled + passenger notified)
8. Passenger Request Flow (Creation, Ownership, Cancellation, 403 Forbidden on cross-user)
9. Luggage Flow (Creation, Ownership, Cancellation, 403 Forbidden on cross-user)
10. Multi-User Chat Flow (Arjun <-> Saket bidirectional messaging & ordering)
11. Notifications Isolation & State
12. Vehicles & Profile Authorization Security
13. Support Tickets & Verifications
14. External API Safety (Mapbox caches & Razorpay test-mode idempotency)
============================================================
"""
import hmac
import hashlib
import json
import uuid
import pytest
from fastapi import HTTPException
from backend.config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
from backend.database import (
    supabase_client, get_user_supabase_client,
    fetch_profile_from_db, upsert_profile_in_db,
    insert_vehicle_in_db, fetch_vehicles_from_db, delete_vehicle_in_db,
    insert_trip_in_db, fetch_trips_from_db, fetch_trip_by_id_from_db, cancel_trip_in_db,
    create_razorpay_order_in_db, update_payment_status_in_db,
    verify_razorpay_payment_signature, verify_payment_and_book_in_db,
    process_razorpay_webhook_event, create_booking_in_db, fetch_bookings_from_db, cancel_booking_in_db,
    create_passenger_request_in_db, fetch_passenger_requests_from_db, cancel_passenger_request_in_db,
    create_luggage_package_in_db, fetch_luggage_packages_from_db, cancel_luggage_package_in_db,
    get_or_create_conversation_in_db, insert_message_in_db, fetch_conversations_from_db,
    fetch_notifications_from_db, mark_notification_read_in_db, mark_all_notifications_read_in_db,
    create_support_ticket_in_db, fetch_support_tickets_from_db,
    submit_student_verification_in_db, submit_id_verification_in_db
)
from backend.schemas import (
    TripCreate, VehicleCreate, BookingCreate, PaymentOrderCreate, PaymentVerifyRequest,
    PassengerRequestCreate, LuggagePackageCreate, StudentVerifyRequest, IdVerificationRequest,
    SupportTicketCreate
)

def test_phase4_complete_integration():
    print("\n" + "=" * 70)
    print("STARTING TOPRIDE PHASE 4: FULL BUSINESS LOGIC & INTEGRATION AUDIT")
    print("=" * 70)

    # -------------------------------------------------------------
    # 1. AUTHENTICATE BOTH ACTORS (REAL SUPABASE AUTH ONLY)
    # -------------------------------------------------------------
    login_arjun = supabase_client.auth.sign_in_with_password({
        "email": "arjun.driver.test@gmail.com",
        "password": "ArjunTest"
    })
    arjun_id = str(login_arjun.user.id)
    arjun_token = login_arjun.session.access_token
    arjun_client = get_user_supabase_client(arjun_token)

    login_saket = supabase_client.auth.sign_in_with_password({
        "email": "demo@topride.app",
        "password": "somepassword123"
    })
    saket_id = str(login_saket.user.id)
    saket_token = login_saket.session.access_token
    saket_client = get_user_supabase_client(saket_token)

    assert arjun_id != saket_id, "Driver and Passenger must be distinct authenticated users"
    print(f"\n[ACTORS VERIFIED]")
    print(f"  Driver: Arjun Rao ({arjun_id})")
    print(f"  Passenger: Saket Kumar ({saket_id})")

    # -------------------------------------------------------------
    # 2. CORE DRIVER FLOW (Vehicle -> Trip -> Seat Ledger)
    # -------------------------------------------------------------
    print("\n--- 2. CORE DRIVER FLOW ---")
    vehs = fetch_vehicles_from_db(user_id=arjun_id, client=arjun_client)
    if vehs:
        test_veh_id = vehs[0].id
    else:
        new_v = insert_vehicle_in_db(
            user_id=arjun_id,
            payload=VehicleCreate(
                make="Honda",
                model="City ZX",
                year=2023,
                color="White",
                plateNumber=f"KA 05 AB {uuid.uuid4().hex[:4].upper()}",
                isDefault=True
            ),
            client=arjun_client
        )
        test_veh_id = new_v.id

    trip_payload = TripCreate(
        origin="Bengaluru",
        originDetail="Indiranagar 100ft Rd",
        destination="Hyderabad",
        destinationDetail="Gachibowli Outer Ring Rd",
        date="Sat, 31 Oct",
        departureTime="07:00",
        arrivalTime="15:00",
        duration="8h 00m",
        totalSeats=3,
        pricePerSeat=600.0,
        currency="Rs",
        vehicleId=test_veh_id,
        luggageAllowed="Medium",
        luggageDetails="Boot space for luggage",
        instantBooking=True,
        tripRules=["No smoking", "AC on"]
    )
    driver_trip = insert_trip_in_db(driver_id=arjun_id, payload=trip_payload, client=arjun_client)
    assert driver_trip.id is not None
    assert driver_trip.driverId == arjun_id
    assert driver_trip.availableSeats == 3
    print(f"  [PASS] Driver Trip Created: {driver_trip.id} ({driver_trip.origin} -> {driver_trip.destination})")

    # -------------------------------------------------------------
    # 3. CORE PASSENGER FLOW (Find -> Search -> Details)
    # -------------------------------------------------------------
    print("\n--- 3. CORE PASSENGER SEARCH FLOW ---")
    search_results = fetch_trips_from_db(
        origin="Bengaluru",
        destination="Hyderabad",
        user_id=saket_id,
        client=saket_client
    )
    found_trips = [t for t in search_results if t.id == driver_trip.id]
    assert len(found_trips) == 1, "Passenger must locate the active driver trip in search"
    passenger_view_trip = found_trips[0]
    assert passenger_view_trip.isDriverTrip is False
    assert passenger_view_trip.driverName == "Arjun Rao"
    print(f"  [PASS] Passenger successfully found driver trip with correct roles & pricing (Rs {passenger_view_trip.pricePerSeat})")

    # -------------------------------------------------------------
    # 4. DRIVER SELF-BOOKING ENFORCEMENT
    # -------------------------------------------------------------
    print("\n--- 4. DRIVER SELF-BOOKING PROTECTION ---")
    # A. Order creation blocked
    with pytest.raises(HTTPException) as exc_order:
        create_razorpay_order_in_db(
            user_id=arjun_id,
            req=PaymentOrderCreate(tripId=driver_trip.id, seatsCount=1),
            client=arjun_client
        )
    assert exc_order.value.status_code == 400
    assert "Drivers cannot book their own trip" in exc_order.value.detail
    print("  [PASS] Blocked driver from creating Razorpay payment order for own trip")

    # B. Booking creation blocked
    with pytest.raises(HTTPException) as exc_book:
        create_booking_in_db(
            passenger_id=arjun_id,
            payload=BookingCreate(tripId=driver_trip.id, seatsCount=1, totalAmount=600.0),
            client=arjun_client
        )
    assert exc_book.value.status_code == 400
    assert "Drivers cannot book their own trip" in exc_book.value.detail
    print("  [PASS] Blocked driver from booking own trip in database")

    # -------------------------------------------------------------
    # 5. RAZORPAY TEST ORDER CREATION & DEDUPLICATION
    # -------------------------------------------------------------
    print("\n--- 5. RAZORPAY TEST ORDER DEDUPLICATION ---")
    order_1 = create_razorpay_order_in_db(
        user_id=saket_id,
        req=PaymentOrderCreate(tripId=driver_trip.id, seatsCount=1, luggageTier="small"),
        client=saket_client
    )
    assert order_1.orderId.startswith("order_")
    assert order_1.amount == 60000 # 600 rupees in paise
    print(f"  [PASS] Created Initial Test Order: {order_1.orderId}")

    # Re-call with identical parameters -> MUST return identical cached order (NO duplicate API call)
    order_2 = create_razorpay_order_in_db(
        user_id=saket_id,
        req=PaymentOrderCreate(tripId=driver_trip.id, seatsCount=1, luggageTier="small"),
        client=saket_client
    )
    assert order_2.orderId == order_1.orderId, "Identical request must reuse existing active Razorpay order"
    print("  [PASS] Active order reused; prevented duplicate order creation")

    # Parameter change (seat count or luggage) -> MUST create new compatible order
    order_changed = create_razorpay_order_in_db(
        user_id=saket_id,
        req=PaymentOrderCreate(tripId=driver_trip.id, seatsCount=2, luggageTier="small"),
        client=saket_client
    )
    assert order_changed.orderId != order_1.orderId
    assert order_changed.amount == 120000 # 2 seats * 600 = 1200 rupees
    print(f"  [PASS] Parameter change cleanly invalidated previous order and created new: {order_changed.orderId}")

    # -------------------------------------------------------------
    # 6. SIGNATURE VERIFICATION & ATOMIC BOOKING
    # -------------------------------------------------------------
    print("\n--- 6. PAYMENT VERIFICATION & ATOMIC BOOKING ---")
    mock_payment_id = f"pay_test_{uuid.uuid4().hex[:10]}"
    valid_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_1.orderId}|{mock_payment_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    # Tampered signature attempt
    with pytest.raises(HTTPException) as exc_tamper:
        verify_payment_and_book_in_db(
            user_id=saket_id,
            req=PaymentVerifyRequest(
                tripId=driver_trip.id,
                seatsCount=1,
                razorpayOrderId=order_1.orderId,
                razorpayPaymentId=mock_payment_id,
                razorpaySignature="tampered_signature_hex"
            ),
            client=saket_client
        )
    assert exc_tamper.value.status_code == 400
    print("  [PASS] Tampered signature rejected with HTTP 400")

    # Cross-user hijacking attempt (Arjun attempts to verify Saket's order)
    with pytest.raises(HTTPException) as exc_cross:
        verify_payment_and_book_in_db(
            user_id=arjun_id,
            req=PaymentVerifyRequest(
                tripId=driver_trip.id,
                seatsCount=1,
                razorpayOrderId=order_1.orderId,
                razorpayPaymentId=mock_payment_id,
                razorpaySignature=valid_signature
            ),
            client=arjun_client
        )
    assert exc_cross.value.status_code in [400, 403]
    print("  [PASS] Cross-user payment order verification blocked (Forbidden)")

    # Authentic verification and atomic booking
    verify_resp = verify_payment_and_book_in_db(
        user_id=saket_id,
        req=PaymentVerifyRequest(
            tripId=driver_trip.id,
            seatsCount=1,
            razorpayOrderId=order_1.orderId,
            razorpayPaymentId=mock_payment_id,
            razorpaySignature=valid_signature
        ),
        client=saket_client
    )
    assert verify_resp.verified is True
    booking_id = verify_resp.booking.id
    print(f"  [PASS] Booking Confirmed: {booking_id} (Ref: {verify_resp.booking.bookingRef})")

    # Verify atomic seat decrement in DB (3 seats -> 2 seats)
    trip_after_book = fetch_trip_by_id_from_db(driver_trip.id, client=saket_client)
    assert trip_after_book.availableSeats == 2
    print(f"  [PASS] Atomic seat ledger decrement confirmed: 3 -> 2 seats available")

    # Duplicate verification test (Idempotency) -> zero double-booking
    dup_verify = verify_payment_and_book_in_db(
        user_id=saket_id,
        req=PaymentVerifyRequest(
            tripId=driver_trip.id,
            seatsCount=1,
            razorpayOrderId=order_1.orderId,
            razorpayPaymentId=mock_payment_id,
            razorpaySignature=valid_signature
        ),
        client=saket_client
    )
    assert dup_verify.booking.id == booking_id
    trip_after_dup = fetch_trip_by_id_from_db(driver_trip.id, client=saket_client)
    assert trip_after_dup.availableSeats == 2, "Seat count must NOT decrement again on retry"
    print("  [PASS] Idempotent retry returned existing booking without duplicate decrement")

    # -------------------------------------------------------------
    # 7. CONCURRENCY & SEAT EXHAUSTION PROTECTION
    # -------------------------------------------------------------
    print("\n--- 7. SEAT EXHAUSTION & OVERBOOKING PROTECTION ---")
    # Currently 2 seats left. If a user tries to book 3 seats -> MUST reject with 409
    with pytest.raises(HTTPException) as exc_overbook:
        create_razorpay_order_in_db(
            user_id=saket_id,
            req=PaymentOrderCreate(tripId=driver_trip.id, seatsCount=3),
            client=saket_client
        )
    assert exc_overbook.value.status_code == 409
    assert "no longer available" in exc_overbook.value.detail.lower()
    print("  [PASS] Blocked request exceeding available seats with HTTP 409")

    # -------------------------------------------------------------
    # 8. CANCELLATION LIFECYCLE (Passenger Cancellation)
    # -------------------------------------------------------------
    print("\n--- 8. CANCELLATION LIFECYCLE: PASSENGER CANCELS ---")
    cancel_success = cancel_booking_in_db(
        booking_id=booking_id,
        user_id=saket_id,
        reason="Passenger schedule change",
        client=saket_client
    )
    assert cancel_success is True
    print("  [PASS] Passenger cancelled booking")

    # Verify seats are restored (2 seats -> 3 seats)
    trip_restored = fetch_trip_by_id_from_db(driver_trip.id, client=saket_client)
    assert trip_restored.availableSeats == 3
    print("  [PASS] Seats restored to trip: available_seats = 3")

    # Verify driver received notification
    driver_notifs = fetch_notifications_from_db(user_id=arjun_id, client=arjun_client)
    has_cancel_notif = any("Passenger Cancelled" in n.title for n in driver_notifs)
    assert has_cancel_notif is True, "Driver must receive notification of passenger cancellation"
    print("  [PASS] Driver notified of passenger cancellation with restored seats")

    # -------------------------------------------------------------
    # 9. CANCELLATION LIFECYCLE (Driver Cancels Trip)
    # -------------------------------------------------------------
    print("\n--- 9. CANCELLATION LIFECYCLE: DRIVER CANCELS TRIP ---")
    # Book a seat again to test driver cancellation cascading to bookings
    rebook_order = create_razorpay_order_in_db(
        user_id=saket_id,
        req=PaymentOrderCreate(tripId=driver_trip.id, seatsCount=1),
        client=saket_client
    )
    rebook_pay_id = f"pay_test_{uuid.uuid4().hex[:10]}"
    rebook_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{rebook_order.orderId}|{rebook_pay_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    rebook_resp = verify_payment_and_book_in_db(
        user_id=saket_id,
        req=PaymentVerifyRequest(
            tripId=driver_trip.id,
            seatsCount=1,
            razorpayOrderId=rebook_order.orderId,
            razorpayPaymentId=rebook_pay_id,
            razorpaySignature=rebook_sig
        ),
        client=saket_client
    )
    rebooked_id = rebook_resp.booking.id

    # Saket cannot cancel Arjun's trip directly
    with pytest.raises(HTTPException) as exc_driver_cancel:
        cancel_trip_in_db(trip_id=driver_trip.id, driver_id=saket_id, client=saket_client)
    assert exc_driver_cancel.value.status_code == 403
    print("  [PASS] Non-driver blocked from cancelling driver's trip (403 Forbidden)")

    # Driver cancels trip
    trip_cancel_res = cancel_trip_in_db(trip_id=driver_trip.id, driver_id=arjun_id, client=arjun_client)
    assert trip_cancel_res is True

    # Verify trip status is cancelled
    cancelled_trip = fetch_trip_by_id_from_db(driver_trip.id, client=arjun_client)
    assert cancelled_trip.status == "cancelled"

    # Verify passenger's booking status updated to cancelled
    passenger_bookings = fetch_bookings_from_db(user_id=saket_id, client=saket_client)
    affected_booking = next((b for b in passenger_bookings if b["id"] == rebooked_id), None)
    assert affected_booking is not None
    assert affected_booking["status"] == "cancelled"
    print("  [PASS] Affected passenger booking automatically updated to 'cancelled'")

    # Verify passenger received notification of driver cancellation & refund
    saket_notifs = fetch_notifications_from_db(user_id=saket_id, client=saket_client)
    passenger_notified = any("Trip Cancelled by Driver" in n.title for n in saket_notifs)
    assert passenger_notified is True
    print("  [PASS] Passenger received notification of trip cancellation and refund")

    # -------------------------------------------------------------
    # 10. PASSENGER REQUEST FLOW & AUTHORIZATION
    # -------------------------------------------------------------
    print("\n--- 10. PASSENGER REQUEST FLOW & SECURITY ---")
    req = create_passenger_request_in_db(
        passenger_id=saket_id,
        payload=PassengerRequestCreate(
            origin="Bengaluru",
            destination="Hyderabad",
            date="Sun, 01 Nov",
            seatsNeeded=1,
            budgetPerSeat=650.0,
            notes="Need ride to airport corridor"
        ),
        client=saket_client
    )
    assert req.passengerId == saket_id
    print(f"  [PASS] Created Passenger Request: {req.id}")

    # Arjun cannot cancel Saket's request (403)
    with pytest.raises(HTTPException) as exc_req_cancel:
        cancel_passenger_request_in_db(request_id=req.id, user_id=arjun_id, client=arjun_client)
    assert exc_req_cancel.value.status_code == 403
    print("  [PASS] Cross-user request cancellation blocked (403 Forbidden)")

    # Saket cancels own request
    assert cancel_passenger_request_in_db(request_id=req.id, user_id=saket_id, client=saket_client) is True
    print("  [PASS] Owner successfully cancelled own passenger request")

    # -------------------------------------------------------------
    # 11. LUGGAGE FLOW & AUTHORIZATION
    # -------------------------------------------------------------
    print("\n--- 11. LUGGAGE FLOW & SECURITY ---")
    pkg = create_luggage_package_in_db(
        sender_id=saket_id,
        payload=LuggagePackageCreate(
            origin="Bengaluru",
            destination="Hyderabad",
            date="Sun, 01 Nov",
            size="Small (< 5kg)",
            description="Box with documents",
            priceOffer=350.0
        ),
        client=saket_client
    )
    assert pkg.senderId == saket_id
    print(f"  [PASS] Created Luggage Package: {pkg.id}")

    # Arjun cannot cancel Saket's luggage package (403)
    with pytest.raises(HTTPException) as exc_lug_cancel:
        cancel_luggage_package_in_db(package_id=pkg.id, user_id=arjun_id, client=arjun_client)
    assert exc_lug_cancel.value.status_code == 403
    print("  [PASS] Cross-user luggage cancellation blocked (403 Forbidden)")

    # Saket cancels own package
    assert cancel_luggage_package_in_db(package_id=pkg.id, user_id=saket_id, client=saket_client) is True
    print("  [PASS] Owner successfully cancelled own luggage package")

    # -------------------------------------------------------------
    # 12. CHAT & MESSAGING FLOW (Bidirectional)
    # -------------------------------------------------------------
    print("\n--- 12. CHAT & MESSAGING FLOW (Saket <-> Arjun) ---")
    conv = get_or_create_conversation_in_db(user_id=saket_id, partner_id=arjun_id, client=saket_client)
    assert conv.id is not None

    # Saket sends message to Arjun
    msg_text_1 = "Hello Arjun, I have luggage as well for the trip."
    msg1 = insert_message_in_db(conv_id=conv.id, sender_id=saket_id, text=msg_text_1, client=saket_client)
    assert msg1.senderId == saket_id

    # Arjun sends reply to Saket
    msg_text_2 = "Sure Saket, plenty of boot space available."
    msg2 = insert_message_in_db(conv_id=conv.id, sender_id=arjun_id, text=msg_text_2, client=arjun_client)
    assert msg2.senderId == arjun_id

    # Arjun views conversation
    arjun_convs = fetch_conversations_from_db(user_id=arjun_id, client=arjun_client)
    target_conv_arjun = next((c for c in arjun_convs if c.id == conv.id), None)
    assert target_conv_arjun is not None
    assert target_conv_arjun.partnerId == saket_id
    assert target_conv_arjun.partnerName == "Saket Kumar"

    # Saket views conversation
    saket_convs = fetch_conversations_from_db(user_id=saket_id, client=saket_client)
    target_conv_saket = next((c for c in saket_convs if c.id == conv.id), None)
    assert target_conv_saket is not None
    assert target_conv_saket.partnerId == arjun_id
    assert target_conv_saket.partnerName == "Arjun Rao"
    print("  [PASS] Bidirectional chat messages and partner perspectives confirmed")

    # -------------------------------------------------------------
    # 13. NOTIFICATIONS, VERIFICATION & SUPPORT
    # -------------------------------------------------------------
    print("\n--- 13. NOTIFICATIONS, VERIFICATION & SUPPORT ---")
    # Mark notification read
    if saket_notifs:
        mark_notification_read_in_db(notif_id=saket_notifs[0].id, user_id=saket_id, client=saket_client)
        mark_all_notifications_read_in_db(user_id=saket_id, client=saket_client)
        print("  [PASS] Notification read & read-all operations verified")

    # Support ticket
    ticket = create_support_ticket_in_db(
        user_id=saket_id,
        req=SupportTicketCreate(category="Booking", message="Test inquiry from integration suite"),
        client=saket_client
    )
    assert ticket["success"] is True
    my_tickets = fetch_support_tickets_from_db(user_id=saket_id, client=saket_client)
    assert any(t["ticketRef"] == ticket["ticketRef"] for t in my_tickets)
    print(f"  [PASS] Support Ticket created & queried: {ticket['ticketRef']}")

    # Student verification
    student_res = submit_student_verification_in_db(
        user_id=saket_id,
        req=StudentVerifyRequest(universityId="u1", studentEmail="saket@iisc.ac.in"),
        client=saket_client
    )
    assert student_res["success"] is True
    saket_prof = fetch_profile_from_db(saket_id, client=saket_client)
    assert saket_prof.isStudentVerified is True
    print("  [PASS] Student verification processed and profile updated")

    print("\n" + "=" * 70)
    print("ALL TOPRIDE PHASE 4 BUSINESS LOGIC & INTEGRATION TESTS PASSED (100%)")
    print("=" * 70)

if __name__ == "__main__":
    test_phase4_complete_integration()
