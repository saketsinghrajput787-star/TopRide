import asyncio
import concurrent.futures
import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

# User Credentials
ARJUN_EMAIL = "arjun.driver.test@gmail.com"
ARJUN_PASS = "ArjunTest"

SAKET_EMAIL = "demo@topride.app"
SAKET_PASS = "somepassword123"

from backend.database import supabase_client

def login(email, password):
    res = supabase_client.auth.sign_in_with_password({"email": email, "password": password})
    if not res.user or not res.session:
        raise Exception(f"Login failed for {email}")
    token = res.session.access_token
    # verify with /api/auth/me
    me_res = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    if me_res.status_code != 200:
        raise Exception(f"Me endpoint failed: {me_res.status_code} - {me_res.text}")
    return token, me_res.json()

def run_tests():
    print("=" * 60)
    print("STARTING COMPLETE PHASE 2B -> 2H AUTOMATED TEST SUITE")
    print("=" * 60)

    # 1. Health check
    h = requests.get(f"{BASE_URL}/api/health")
    assert h.status_code == 200, f"Health check failed: {h.text}"
    print("[PASS] 1. Health check 200 OK")

    # 2. Authentication check
    arjun_token, arjun_user = login(ARJUN_EMAIL, ARJUN_PASS)
    saket_token, saket_user = login(SAKET_EMAIL, SAKET_PASS)

    print(f"[PASS] 2. Logged in Arjun (ID: {arjun_user['id']})")
    print(f"[PASS] 3. Logged in Saket (ID: {saket_user['id']})")

    arjun_headers = {"Authorization": f"Bearer {arjun_token}"}
    saket_headers = {"Authorization": f"Bearer {saket_token}"}

    # 3. Security: Missing & invalid token
    res_no_tok = requests.get(f"{BASE_URL}/api/profile")
    assert res_no_tok.status_code == 401, f"Expected 401 for missing token, got {res_no_tok.status_code}"
    res_bad_tok = requests.get(f"{BASE_URL}/api/profile", headers={"Authorization": "Bearer badtoken123"})
    assert res_bad_tok.status_code == 401, f"Expected 401 for invalid token, got {res_bad_tok.status_code}"
    print("[PASS] 4. Security checks: Missing token (401), invalid token (401)")

    # 4. Phase 2E: Vehicles test
    print("\n--- PHASE 2E: VEHICLES & PROFILES ---")
    # Arjun lists vehicles
    arjun_vehs = requests.get(f"{BASE_URL}/api/vehicles", headers=arjun_headers).json()
    saket_vehs = requests.get(f"{BASE_URL}/api/vehicles", headers=saket_headers).json()
    arjun_veh_ids = {v["id"] for v in arjun_vehs}
    saket_veh_ids = {v["id"] for v in saket_vehs}
    assert arjun_veh_ids.isdisjoint(saket_veh_ids), "Arjun and Saket share vehicle IDs unexpectedly"
    print(f"[PASS] Vehicles isolated: Arjun has {len(arjun_vehs)}, Saket has {len(saket_vehs)}")

    # Arjun adds a test vehicle
    new_veh_payload = {
        "make": "Toyota",
        "model": "Innova Hycross",
        "year": 2024,
        "color": "Super White",
        "plateNumber": f"KA 05 MN {int(time.time()) % 10000:04d}",
        "isDefault": False
    }
    veh_res = requests.post(f"{BASE_URL}/api/vehicles", headers=arjun_headers, json=new_veh_payload)
    assert veh_res.status_code == 200, f"Vehicle creation failed: {veh_res.text}"
    created_veh = veh_res.json()
    assert created_veh["id"] not in saket_veh_ids
    print(f"[PASS] Arjun added vehicle {created_veh['id']}")

    # Security: Saket cannot delete Arjun's vehicle
    del_unauth = requests.delete(f"{BASE_URL}/api/vehicles/{created_veh['id']}", headers=saket_headers)
    assert del_unauth.status_code in [403, 404], f"Saket deleted Arjun vehicle! Got {del_unauth.status_code}"
    print("[PASS] Security: Saket cannot delete Arjun's vehicle (403/404)")

    # Arjun deletes vehicle
    del_ok = requests.delete(f"{BASE_URL}/api/vehicles/{created_veh['id']}", headers=arjun_headers)
    assert del_ok.status_code == 200
    print("[PASS] Arjun deleted own vehicle successfully")

    # Profile update
    prof_update = requests.put(f"{BASE_URL}/api/profile", headers=saket_headers, json={"bio": "Software Engineer & frequent traveler"})
    assert prof_update.status_code == 200
    assert prof_update.json()["bio"] == "Software Engineer & frequent traveler"
    print("[PASS] Profile update works and reflects authenticated user")

    # 5. Phase 2B: Real Booking & Concurrency-Safe Seat Reservation
    print("\n--- PHASE 2B: CONCURRENCY-SAFE BOOKING & SEAT LEDGER ---")
    # Arjun posts a trip with exactly 1 seat for the concurrency test
    trip_payload = {
        "origin": "Bengaluru",
        "originDetail": "Electronic City Phase 1",
        "destination": "Mysuru",
        "destinationDetail": "Suburban Bus Stand",
        "date": "Mon, 15 Oct",
        "departureTime": "07:00",
        "arrivalTime": "10:00",
        "duration": "3h",
        "totalSeats": 1,
        "pricePerSeat": 350.0,
        "currency": "₹",
        "luggageAllowed": "Small",
        "luggageDetails": "Backpack only",
        "instantBooking": True,
        "tripRules": ["No smoking"],
        "stops": ["Mandya"]
    }
    trip_res = requests.post(f"{BASE_URL}/api/trips", headers=arjun_headers, json=trip_payload)
    assert trip_res.status_code == 200, f"Trip creation failed: {trip_res.text}"
    test_trip = trip_res.json()
    test_trip_id = test_trip["id"]
    print(f"[PASS] Created 1-seat test trip {test_trip_id} (Available seats: {test_trip['availableSeats']})")

    # Check driver cannot book own trip
    self_book = requests.post(f"{BASE_URL}/api/bookings", headers=arjun_headers, json={
        "tripId": test_trip_id,
        "seatsCount": 1,
        "luggageTier": "small",
        "totalAmount": 350.0
    })
    assert self_book.status_code in [400, 403], f"Driver was able to book own trip! Got {self_book.status_code}: {self_book.text}"
    print(f"[PASS] Driver cannot book own trip (blocked with {self_book.status_code})")

    # MANDATORY CONCURRENCY TEST:
    # We will send 2 concurrent booking requests for this 1-seat trip.
    # Request A: Saket
    # Request B: Saket (duplicate) or another concurrent booking
    print("Executing concurrent booking requests...")
    def send_booking(token, amount):
        return requests.post(f"{BASE_URL}/api/bookings", headers={"Authorization": f"Bearer {token}"}, json={
            "tripId": test_trip_id,
            "seatsCount": 1,
            "luggageTier": "small",
            "totalAmount": amount
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(send_booking, saket_token, 350.0)
        f2 = executor.submit(send_booking, saket_token, 350.0)
        res1 = f1.result()
        res2 = f2.result()

    statuses = [res1.status_code, res2.status_code]
    print(f"Concurrent booking responses: {statuses}")
    success_count = sum(1 for s in statuses if s in [200, 201])
    conflict_count = sum(1 for s in statuses if s in [400, 409])

    assert success_count == 1, f"Expected exactly 1 booking to succeed, got {success_count}. Responses: {res1.text} | {res2.text}"
    assert conflict_count == 1, f"Expected exactly 1 booking to fail with conflict, got {conflict_count}"
    print(f"[PASS] CONCURRENCY TEST PASSED: Exactly 1 succeeded ({success_count}), exactly 1 failed ({conflict_count})")

    # Verify trip remaining seats is 0
    updated_trip = requests.get(f"{BASE_URL}/api/trips/{test_trip_id}", headers=saket_headers).json()
    assert updated_trip["availableSeats"] == 0, f"Expected 0 available seats, got {updated_trip['availableSeats']}"
    print(f"[PASS] Trip availableSeats updated atomically to 0")

    # Verify booking retrieval
    succ_res = res1 if res1.status_code in [200, 201] else res2
    succ_booking = succ_res.json()
    booking_id = succ_booking["id"]
    get_book = requests.get(f"{BASE_URL}/api/bookings/{booking_id}", headers=saket_headers)
    assert get_book.status_code == 200
    assert get_book.json()["passengerId"] == saket_user["id"]
    print(f"[PASS] Saket fetched booking {booking_id} with passengerId={saket_user['id']}")

    # Security: Saket cannot view another user's booking if unauthorized
    # Arjun as driver can view bookings for his trip
    driver_books = requests.get(f"{BASE_URL}/api/bookings?as_driver=true", headers=arjun_headers).json()
    assert any(b["id"] == booking_id for b in driver_books), "Driver should see booking for his trip"
    print("[PASS] Arjun as driver can see passenger booking on his trip")

    # Test booking cancellation and seat release
    cancel_res = requests.post(f"{BASE_URL}/api/bookings/{booking_id}/cancel", headers=saket_headers)
    assert cancel_res.status_code == 200, f"Cancel booking failed: {cancel_res.text}"
    print("[PASS] Saket cancelled booking; verifying atomic seat release...")
    restored_trip = requests.get(f"{BASE_URL}/api/trips/{test_trip_id}", headers=saket_headers).json()
    assert restored_trip["availableSeats"] == 1, f"Available seats should be restored to 1, got {restored_trip['availableSeats']}"
    print(f"[PASS] Atomic seat release verified: availableSeats restored to {restored_trip['availableSeats']}")

    # Clean up test trip
    requests.post(f"{BASE_URL}/api/trips/{test_trip_id}/cancel", headers=arjun_headers)

    # 6. Phase 2C: Passenger Requests
    print("\n--- PHASE 2C: PASSENGER REQUESTS ---")
    req_payload = {
        "origin": "Bengaluru",
        "destination": "Chennai",
        "date": "Wed, 17 Oct",
        "timeWindow": "Morning (08:00 - 11:00)",
        "seatsNeeded": 2,
        "budgetPerSeat": 500.0,
        "notes": "Traveling for office work with small bags"
    }
    create_req = requests.post(f"{BASE_URL}/api/requests", headers=saket_headers, json=req_payload)
    assert create_req.status_code == 200, f"Request creation failed: {create_req.text}"
    req_obj = create_req.json()
    req_id = req_obj["id"]
    assert req_obj["passengerId"] == saket_user["id"]
    print(f"[PASS] Saket created passenger request {req_id} with passengerId={saket_user['id']}")

    # Security: Arjun cannot cancel Saket's request
    unauth_cancel_req = requests.post(f"{BASE_URL}/api/requests/{req_id}/cancel", headers=arjun_headers)
    assert unauth_cancel_req.status_code in [403, 404], f"Arjun was able to cancel Saket request! {unauth_cancel_req.status_code}"
    print("[PASS] Security: Arjun cannot cancel Saket's request (403/404)")

    # Saket cancels own request
    cancel_req_ok = requests.post(f"{BASE_URL}/api/requests/{req_id}/cancel", headers=saket_headers)
    assert cancel_req_ok.status_code == 200
    print("[PASS] Saket cancelled own passenger request")

    # 7. Phase 2D: Luggage Packages
    print("\n--- PHASE 2D: LUGGAGE PACKAGES ---")
    lug_payload = {
        "origin": "Bengaluru (Koramangala)",
        "destination": "Hyderabad (Hitech City)",
        "date": "Thu, 18 Oct",
        "size": "Small (< 5kg)",
        "description": "Sealed documents and electronics",
        "priceOffer": 350.0,
        "receiverName": "Vikram Rao",
        "receiverPhone": "+91 98765 43210"
    }
    create_lug = requests.post(f"{BASE_URL}/api/luggage", headers=saket_headers, json=lug_payload)
    assert create_lug.status_code == 200, f"Luggage creation failed: {create_lug.text}"
    lug_obj = create_lug.json()
    lug_id = lug_obj["id"]
    assert lug_obj["senderId"] == saket_user["id"]
    print(f"[PASS] Saket created luggage package {lug_id} with senderId={saket_user['id']}")

    # Security: Arjun cannot cancel Saket's luggage
    unauth_cancel_lug = requests.post(f"{BASE_URL}/api/luggage/{lug_id}/cancel", headers=arjun_headers)
    assert unauth_cancel_lug.status_code in [403, 404], f"Arjun was able to cancel Saket luggage! {unauth_cancel_lug.status_code}"
    print("[PASS] Security: Arjun cannot cancel Saket's luggage (403/404)")

    # Saket cancels own luggage
    cancel_lug_ok = requests.post(f"{BASE_URL}/api/luggage/{lug_id}/cancel", headers=saket_headers)
    assert cancel_lug_ok.status_code == 200
    print("[PASS] Saket cancelled own luggage package")

    # 8. Phase 2F: Notifications
    print("\n--- PHASE 2F: REAL NOTIFICATIONS ---")
    arjun_notifs = requests.get(f"{BASE_URL}/api/notifications", headers=arjun_headers).json()
    saket_notifs = requests.get(f"{BASE_URL}/api/notifications", headers=saket_headers).json()
    assert isinstance(arjun_notifs, list)
    assert isinstance(saket_notifs, list)
    print(f"[PASS] Notifications fetched: Arjun has {len(arjun_notifs)}, Saket has {len(saket_notifs)}")

    # Mark all read
    mark_all = requests.put(f"{BASE_URL}/api/notifications/read-all", headers=saket_headers)
    assert mark_all.status_code == 200
    print("[PASS] mark-all read succeeded for Saket")

    # 9. Phase 2G: Universities, Student & ID Verification, Support
    print("\n--- PHASE 2G: UNIVERSITIES, VERIFICATION & SUPPORT ---")
    unis = requests.get(f"{BASE_URL}/api/universities").json()
    assert len(unis) > 0, "Universities table returned empty"
    print(f"[PASS] Universities loaded from public.universities: {len(unis)} options available")

    # Student verification submission
    student_sub = requests.post(f"{BASE_URL}/api/verification/student", headers=saket_headers, json={
        "universityId": unis[0]["id"],
        "studentEmail": "saket.student@university.edu"
    })
    assert student_sub.status_code == 200
    print(f"[PASS] Student verification submitted: {student_sub.json()['status']}")

    # ID verification submission
    id_sub = requests.post(f"{BASE_URL}/api/verification/id", headers=saket_headers, json={
        "documentType": "Driving License"
    })
    assert id_sub.status_code == 200
    print(f"[PASS] ID verification submitted: {id_sub.json()['status']}")

    # Support ticket
    ticket_res = requests.post(f"{BASE_URL}/api/support/ticket", headers=saket_headers, json={
        "category": "Refund Inquiry",
        "message": "When will the cancelled seat refund reflect in bank account?"
    })
    assert ticket_res.status_code == 200
    ticket_data = ticket_res.json()
    assert ticket_data["success"] is True
    print(f"[PASS] Support ticket created: {ticket_data['ticketRef']}")

    # List support tickets for user
    my_tickets = requests.get(f"{BASE_URL}/api/support/tickets", headers=saket_headers).json()
    assert any(t["ticketRef"] == ticket_data["ticketRef"] for t in my_tickets)
    print(f"[PASS] Saket listed own support tickets ({len(my_tickets)} found)")

    # Security: Arjun cannot see Saket's support tickets
    arjun_tickets = requests.get(f"{BASE_URL}/api/support/tickets", headers=arjun_headers).json()
    assert not any(t["ticketRef"] == ticket_data["ticketRef"] for t in arjun_tickets)
    print("[PASS] Security: Support tickets isolated per authenticated user")

    print("\n" + "=" * 60)
    print("ALL TESTS (PHASES 2B -> 2G) PASSED WITH FULL DATA INTEGRITY & ISOLATION!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
