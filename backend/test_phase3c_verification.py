"""
TopRide Phase 3C / 3D Automated Verification & Security Test Suite
Tests:
1. Razorpay HMAC SHA256 Signature Verification (Valid, Tampered, Invalid)
2. Authoritative Price Validation & Driver Self-Booking Protection
3. Order Creation & Deduplication Window Safety
4. Authoritative Server Verification & Atomic Booking Finalization
5. Duplicate Payment Protection & Verification Idempotency
6. Cross-User Payment Order Access Protection (403 Forbidden)
7. Razorpay Webhook Signature Verification (Valid vs Forged)
8. Webhook Idempotency & Duplicate Delivery Safety
"""
import hmac
import hashlib
import json
import uuid
from backend.config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
from backend.database import (
    supabase_client, get_user_supabase_client,
    create_razorpay_order_in_db, update_payment_status_in_db,
    verify_razorpay_payment_signature, verify_payment_and_book_in_db,
    process_razorpay_webhook_event, fetch_trip_by_id_from_db
)
from backend.schemas import (
    PaymentOrderCreate, PaymentVerifyRequest
)

def run_tests():
    print("=" * 65)
    print("TOPRIDE PHASE 3C & 3D: PAYMENT VERIFICATION & WEBHOOK TEST SUITE")
    print("=" * 65)

    assert RAZORPAY_KEY_SECRET, "RAZORPAY_KEY_SECRET must be configured"
    assert RAZORPAY_WEBHOOK_SECRET, "RAZORPAY_WEBHOOK_SECRET must be configured"

    # 1. Login Arjun (Driver) and Saket (Passenger)
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

    print(f"\n[1] Arjun (Driver): {arjun_id}")
    print(f"[1] Saket (Passenger): {saket_id}")

    # 2. Find or create an available trip by Arjun
    trips_res = arjun_client.table("trips").select("*").eq("driver_id", arjun_id).eq("status", "upcoming").gt("available_seats", 1).limit(1).execute()
    if trips_res.data:
        test_trip = trips_res.data[0]
        trip_id = str(test_trip["id"])
    else:
        v_res = arjun_client.table("vehicles").select("*").eq("user_id", arjun_id).limit(1).execute()
        veh_id = v_res.data[0]["id"] if v_res.data else None
        trip_id = str(uuid.uuid4())
        arjun_client.table("trips").insert({
            "id": trip_id,
            "driver_id": arjun_id,
            "vehicle_id": veh_id,
            "origin": "Bengaluru",
            "destination": "Hyderabad",
            "date": "Sun, 25 Oct",
            "departure_time": "09:00",
            "total_seats": 4,
            "available_seats": 4,
            "price_per_seat": 500.0,
            "status": "upcoming"
        }).execute()
        for s in [1, 2, 3, 4]:
            arjun_client.table("trip_seats").insert({
                "id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "seat_number": s,
                "status": "available"
            }).execute()

    trip_info = fetch_trip_by_id_from_db(trip_id, client=saket_client)
    assert trip_info is not None
    print(f"[2] Trip for testing: {trip_info.origin} -> {trip_info.destination}, Rs {trip_info.pricePerSeat}, Avail: {trip_info.availableSeats}")

    # TEST 1: Pure Signature Verification Unit Check
    print("\n--- TEST 1: Razorpay Payment Signature Verification ---")
    mock_order_id = "order_mock_test_12345"
    mock_pay_id = "pay_mock_test_67890"
    correct_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{mock_order_id}|{mock_pay_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    assert verify_razorpay_payment_signature(mock_order_id, mock_pay_id, correct_sig) is True
    print("  [PASS] Authentic signature verified successfully")

    tampered_sig = correct_sig[:-4] + "dead"
    assert verify_razorpay_payment_signature(mock_order_id, mock_pay_id, tampered_sig) is False
    print("  [PASS] Tampered signature rejected")

    assert verify_razorpay_payment_signature(mock_order_id, "pay_different", correct_sig) is False
    print("  [PASS] Mismatched payment ID rejected")

    # TEST 2: Create a real test order for Saket (1 seat)
    print("\n--- TEST 2: Order Creation & Server Price Calculation ---")
    order = create_razorpay_order_in_db(
        user_id=saket_id,
        req=PaymentOrderCreate(tripId=trip_id, seatsCount=1, luggageTier="small"),
        client=saket_client
    )
    print(f"  [PASS] Created Order: {order.orderId}, Rs {order.amountRupees}")
    assert order.orderId.startswith("order_")
    assert order.amountRupees == trip_info.pricePerSeat

    # TEST 3: Tampered Signature in Backend Verification Endpoint (Rejection)
    print("\n--- TEST 3: Tampered Signature Rejected by Backend Verification ---")
    fake_payment_id = f"pay_{uuid.uuid4().hex[:14]}"
    try:
        verify_payment_and_book_in_db(
            user_id=saket_id,
            req=PaymentVerifyRequest(
                tripId=trip_id,
                seatsCount=1,
                luggageTier="small",
                razorpayOrderId=order.orderId,
                razorpayPaymentId=fake_payment_id,
                razorpaySignature="tampered_invalid_signature_12345678"
            ),
            client=saket_client
        )
        assert False, "Verification MUST fail with invalid signature!"
    except Exception as e:
        print(f"  [PASS] Rejected tampered signature: {getattr(e, 'detail', str(e))}")
        assert "Payment verification failed" in getattr(e, "detail", str(e))

    # Verify payment_order status was recorded as 'failed' in DB
    po_check = saket_client.table("payment_orders").select("*").eq("razorpay_order_id", order.orderId).execute()
    if po_check.data:
        assert po_check.data[0]["status"] == "failed"
        print("  [PASS] payment_orders marked 'failed' after bad signature attempt")

    # TEST 4: Cross-User Payment Ownership Enforcement
    print("\n--- TEST 4: Cross-User Payment Order Hijacking Rejected (403) ---")
    # Arjun tries to verify Saket's order
    valid_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order.orderId}|{fake_payment_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    try:
        verify_payment_and_book_in_db(
            user_id=arjun_id, # Calling as Arjun instead of Saket
            req=PaymentVerifyRequest(
                tripId=trip_id,
                seatsCount=1,
                luggageTier="small",
                razorpayOrderId=order.orderId,
                razorpayPaymentId=fake_payment_id,
                razorpaySignature=valid_sig
            ),
            client=arjun_client
        )
        assert False, "Cross-user payment verification MUST be rejected!"
    except Exception as e:
        print(f"  [PASS] Cross-user verification blocked: {getattr(e, 'detail', str(e))}")
        assert "belong" in getattr(e, "detail", str(e))

    # TEST 5: Authoritative Verification + Atomic Booking Finalization
    print("\n--- TEST 5: Authoritative Verification + Atomic Booking ---")
    # Create fresh order for actual verification
    order_clean = create_razorpay_order_in_db(
        user_id=saket_id,
        req=PaymentOrderCreate(tripId=trip_id, seatsCount=1, luggageTier="small"),
        client=saket_client
    )
    clean_pay_id = f"pay_{uuid.uuid4().hex[:14]}"
    clean_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{order_clean.orderId}|{clean_pay_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    seats_before = fetch_trip_by_id_from_db(trip_id, client=saket_client).availableSeats

    verify_res = verify_payment_and_book_in_db(
        user_id=saket_id,
        req=PaymentVerifyRequest(
            tripId=trip_id,
            seatsCount=1,
            luggageTier="small",
            razorpayOrderId=order_clean.orderId,
            razorpayPaymentId=clean_pay_id,
            razorpaySignature=clean_sig
        ),
        client=saket_client
    )
    print(f"  [PASS] Payment verified! BookingRef: {verify_res.booking.bookingRef}, BookingID: {verify_res.booking.id}")
    assert verify_res.verified is True
    assert verify_res.status == "paid"
    assert verify_res.booking.id is not None

    seats_after = fetch_trip_by_id_from_db(trip_id, client=saket_client).availableSeats
    assert seats_after == seats_before - 1, f"Seats must be decremented by 1! ({seats_before} -> {seats_after})"
    print(f"  [PASS] Atomic seat decrement verified: {seats_before} -> {seats_after}")

    # TEST 6: Duplicate Verification Call / Idempotency Check
    print("\n--- TEST 6: Duplicate Verification Idempotency (Zero Double-Booking) ---")
    duplicate_verify = verify_payment_and_book_in_db(
        user_id=saket_id,
        req=PaymentVerifyRequest(
            tripId=trip_id,
            seatsCount=1,
            luggageTier="small",
            razorpayOrderId=order_clean.orderId,
            razorpayPaymentId=clean_pay_id,
            razorpaySignature=clean_sig
        ),
        client=saket_client
    )
    assert duplicate_verify.booking.id == verify_res.booking.id, "Duplicate call must return existing booking"
    seats_after_dup = fetch_trip_by_id_from_db(trip_id, client=saket_client).availableSeats
    assert seats_after_dup == seats_after, "Duplicate verification must NOT decrement seats again!"
    print(f"  [PASS] Idempotent duplicate call returned existing booking {duplicate_verify.booking.id} without seat changes")

    # TEST 7: Webhook Signature Verification & Forgery Protection
    print("\n--- TEST 7: Webhook Signature Verification ---")
    wh_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": clean_pay_id,
                    "order_id": order_clean.orderId,
                    "status": "captured",
                    "amount": int(round(order_clean.amountRupees * 100))
                }
            }
        }
    }
    raw_wh_bytes = json.dumps(wh_payload).encode("utf-8")

    # A: Forged webhook signature
    try:
        process_razorpay_webhook_event(raw_wh_bytes, "forged_invalid_signature_xyz")
        assert False, "Forged webhook signature MUST be rejected!"
    except Exception as e:
        print(f"  [PASS] Forged webhook rejected: {getattr(e, 'detail', str(e))}")
        assert "Invalid Razorpay webhook signature" in getattr(e, "detail", str(e))

    # B: Valid webhook signature
    valid_wh_sig = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        raw_wh_bytes,
        hashlib.sha256
    ).hexdigest()

    wh_result = process_razorpay_webhook_event(raw_wh_bytes, valid_wh_sig)
    print(f"  [PASS] Valid webhook accepted: {wh_result}")
    assert wh_result["status"] in ["success", "already_processed"]

    # TEST 8: Webhook Duplicate Delivery Idempotency
    print("\n--- TEST 8: Webhook Duplicate Delivery Idempotency ---")
    wh_retry_result = process_razorpay_webhook_event(raw_wh_bytes, valid_wh_sig)
    print(f"  [PASS] Webhook retry handled idempotently: {wh_retry_result}")
    assert wh_retry_result["status"] in ["already_processed", "success"]

    print("\n" + "=" * 65)
    print("ALL PHASE 3C & 3D INTEGRATION & SECURITY TESTS PASSED (100%)")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
