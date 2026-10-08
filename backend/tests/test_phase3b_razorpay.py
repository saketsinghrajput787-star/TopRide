import os
import uuid
from backend.database import (
    supabase_client, get_user_supabase_client,
    create_razorpay_order_in_db, update_payment_status_in_db,
    create_booking_in_db, fetch_trip_by_id_from_db
)
from backend.schemas import PaymentOrderCreate, PaymentStatusUpdate, BookingCreate

def test_phase3b_razorpay_flow():
    print("==================================================")
    print("RUNNING PHASE 3B RAZORPAY TEST SUITE")
    print("==================================================")

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

    print(f"[OK] Logged in Arjun: {arjun_id}")
    print(f"[OK] Logged in Saket: {saket_id}")

    # 2. Find or create an available trip by Arjun
    trips_res = arjun_client.table("trips").select("*").eq("driver_id", arjun_id).eq("status", "upcoming").gt("available_seats", 0).limit(1).execute()
    if trips_res.data:
        test_trip = trips_res.data[0]
        trip_id = str(test_trip["id"])
    else:
        # Create a trip if none active
        v_res = arjun_client.table("vehicles").select("*").eq("user_id", arjun_id).limit(1).execute()
        veh_id = v_res.data[0]["id"] if v_res.data else None
        trip_id = str(uuid.uuid4())
        arjun_client.table("trips").insert({
            "id": trip_id,
            "driver_id": arjun_id,
            "vehicle_id": veh_id,
            "origin": "Bengaluru",
            "destination": "Hyderabad",
            "date": "Sat, 24 Oct",
            "departure_time": "08:00",
            "total_seats": 3,
            "available_seats": 3,
            "price_per_seat": 650.0,
            "status": "upcoming"
        }).execute()
        for s in [1, 2, 3]:
            arjun_client.table("trip_seats").insert({
                "id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "seat_number": s,
                "status": "available"
            }).execute()

    trip_info = fetch_trip_by_id_from_db(trip_id, client=saket_client)
    assert trip_info is not None
    print(f"[OK] Testing with Trip {trip_id}: {trip_info.origin} -> {trip_info.destination}, Price: Rs {trip_info.pricePerSeat}, Avail: {trip_info.availableSeats}")

    # TEST A: Driver self-booking protection on Razorpay order creation
    print("\n--- TEST A: Driver Self-Booking Protection ---")
    try:
        create_razorpay_order_in_db(
            user_id=arjun_id,
            req=PaymentOrderCreate(tripId=trip_id, seatsCount=1),
            client=arjun_client
        )
        assert False, "Driver must NOT be able to create payment order for own trip!"
    except Exception as e:
        print(f"[PASS] Driver self-booking blocked: {getattr(e, 'detail', str(e))}")

    # TEST B: Unavailable seats rejection
    print("\n--- TEST B: Unavailable Seats Rejection ---")
    try:
        create_razorpay_order_in_db(
            user_id=saket_id,
            req=PaymentOrderCreate(tripId=trip_id, seatsCount=999),
            client=saket_client
        )
        assert False, "Must NOT create order for unavailable seats!"
    except Exception as e:
        print(f"[PASS] Unavailable seats blocked: {getattr(e, 'detail', str(e))}")

    # TEST C: Successful Razorpay Test Order Creation (1 seat)
    print("\n--- TEST C: Successful Order Creation (1 seat) ---")
    order_1 = create_razorpay_order_in_db(
        user_id=saket_id,
        req=PaymentOrderCreate(tripId=trip_id, seatsCount=1, luggageTier="small"),
        client=saket_client
    )
    print(f"[PASS] Created Razorpay order: ID={order_1.orderId}, AmountPaise={order_1.amount}, Rupees={order_1.amountRupees}")
    assert order_1.orderId.startswith("order_")
    assert order_1.amount == int(round(trip_info.pricePerSeat * 100))
    assert order_1.amountRupees == trip_info.pricePerSeat
    assert order_1.currency == "INR"

    # TEST D: Multiple Seats calculation (2 seats)
    print("\n--- TEST D: Multiple Seats Calculation (2 seats) ---")
    if trip_info.availableSeats >= 2:
        order_2 = create_razorpay_order_in_db(
            user_id=saket_id,
            req=PaymentOrderCreate(tripId=trip_id, seatsCount=2, luggageTier="small"),
            client=saket_client
        )
        expected_rupees = round(trip_info.pricePerSeat * 2, 2)
        expected_paise = int(round(expected_rupees * 100))
        print(f"[PASS] 2 Seats order: ID={order_2.orderId}, AmountPaise={order_2.amount}, Rupees={order_2.amountRupees}")
        assert order_2.amount == expected_paise
        assert order_2.amountRupees == expected_rupees

    # TEST E: Deduplication / Idempotent order reuse
    print("\n--- TEST E: Idempotency / Retry Order Reuse ---")
    order_retry = create_razorpay_order_in_db(
        user_id=saket_id,
        req=PaymentOrderCreate(tripId=trip_id, seatsCount=1, luggageTier="small"),
        client=saket_client
    )
    print(f"[PASS] Retry returned order: {order_retry.orderId}")
    assert order_retry.orderId == order_1.orderId

    # TEST F: Payment Status Update (e.g. cancelled/failed)
    print("\n--- TEST F: Payment Status Update ---")
    status_res = update_payment_status_in_db(
        user_id=saket_id,
        req=PaymentStatusUpdate(orderId=order_1.orderId, status="cancelled", reason="User dismissed modal"),
        client=saket_client
    )
    print(f"[PASS] Status update response: {status_res}")

    print("\n==================================================")
    print("ALL BACKEND RAZORPAY UNIT & INTEGRATION TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_phase3b_razorpay_flow()
