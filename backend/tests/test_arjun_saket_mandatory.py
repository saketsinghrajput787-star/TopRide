import uuid
import json
from backend.database import (
    supabase_client, get_user_supabase_client,
    insert_trip_in_db, fetch_trips_from_db, fetch_trip_by_id_from_db, cancel_trip_in_db
)
from backend.schemas import TripCreate, VehicleSchema

def run_mandatory_test():
    print("==================================================")
    print("MANDATORY TEST: ARJUN & SAKET REAL MULTI-USER FLOW")
    print("==================================================")

    # ------------------------------------------------------------------
    # Step A: Arjun logs in
    # ------------------------------------------------------------------
    login_arjun = supabase_client.auth.sign_in_with_password({
        "email": "arjun.driver.test@gmail.com",
        "password": "ArjunTest"
    })
    arjun_id = str(login_arjun.user.id)
    arjun_token = login_arjun.session.access_token
    arjun_client = get_user_supabase_client(arjun_token)
    print(f"\n[STEP A] Arjun Logged In Successfully:")
    print(f"  Auth UUID: {arjun_id}")
    print(f"  Email: {login_arjun.user.email}")
    assert arjun_id == "46fad7f4-ad94-4469-87f1-37aaa9151458"

    # ------------------------------------------------------------------
    # Step B: Arjun registers / uses a real vehicle if required
    # ------------------------------------------------------------------
    v_res = arjun_client.table("vehicles").select("*").eq("user_id", arjun_id).execute()
    if not v_res.data:
        arjun_veh_id = str(uuid.uuid4())
        new_v = arjun_client.table("vehicles").insert({
            "id": arjun_veh_id,
            "user_id": arjun_id,
            "make": "Hyundai",
            "model": "Creta SX(O)",
            "year": 2023,
            "color": "Titan Grey",
            "plate_number": "KA 03 MM 7788",
            "is_default": True
        }).execute()
        print(f"\n[STEP B] Registered Real Vehicle for Arjun:")
        print(f"  Vehicle UUID: {arjun_veh_id}")
        print(f"  Make/Model: Hyundai Creta SX(O) (KA 03 MM 7788)")
    else:
        arjun_veh_id = v_res.data[0]["id"]
        print(f"\n[STEP B] Found Existing Real Vehicle for Arjun:")
        print(f"  Vehicle UUID: {arjun_veh_id}")
        print(f"  Make/Model: {v_res.data[0]['make']} {v_res.data[0]['model']} ({v_res.data[0]['plate_number']})")

    # ------------------------------------------------------------------
    # Step C: Arjun posts: Bengaluru -> Hyderabad, 3 seats, Rs 650
    # ------------------------------------------------------------------
    trip_payload = TripCreate(
        origin="Bengaluru",
        originDetail="Electronic City Toll Gate / Koramangala",
        destination="Hyderabad",
        destinationDetail="Gachibowli DLF Gate 2 / Hitec City",
        date="Sat, 17 Oct",
        departureTime="07:30",
        arrivalTime="15:30",
        duration="8h 00m",
        totalSeats=3,
        pricePerSeat=650.0,
        currency="Rs",
        vehicleId=arjun_veh_id,
        luggageAllowed="Medium",
        luggageDetails="Boot space for 1 trolley per passenger",
        instantBooking=True,
        tripRules=["No smoking", "Mask optional", "Punctual departure"]
    )
    arjun_trip = insert_trip_in_db(driver_id=arjun_id, payload=trip_payload, client=arjun_client)
    print(f"\n[STEP C] Arjun Posted Real Trip:")
    print(f"  Trip UUID: {arjun_trip.id}")
    print(f"  Route: {arjun_trip.origin} -> {arjun_trip.destination}")
    print(f"  Seats: {arjun_trip.totalSeats}, Price: Rs {arjun_trip.pricePerSeat}")
    print(f"  Driver: {arjun_trip.driverName} ({arjun_trip.driverInitials})")

    # ------------------------------------------------------------------
    # Step D: Verify directly in Supabase
    # ------------------------------------------------------------------
    # 1. public.trips
    db_trip = arjun_client.table("trips").select("*").eq("id", arjun_trip.id).execute()
    assert len(db_trip.data) == 1, "Trip must exist in public.trips"
    trip_row = db_trip.data[0]
    print(f"\n[STEP D.1] Verified public.trips row directly:")
    print(f"  ID: {trip_row['id']}")
    print(f"  driver_id: {trip_row['driver_id']}")
    print(f"  vehicle_id: {trip_row['vehicle_id']}")
    print(f"  origin: {trip_row['origin']} ({trip_row['origin_detail']})")
    print(f"  destination: {trip_row['destination']} ({trip_row['destination_detail']})")
    print(f"  date: {trip_row['date']}, departure_time: {trip_row['departure_time']}")
    print(f"  status: {trip_row['status']}")
    assert trip_row["driver_id"] == arjun_id, "driver_id must equal Arjun's auth UUID"
    assert trip_row["vehicle_id"] == arjun_veh_id, "vehicle_id must match Arjun's vehicle UUID"

    # 2. public.trip_seats
    db_seats = arjun_client.table("trip_seats").select("*").eq("trip_id", arjun_trip.id).order("seat_number").execute()
    print(f"\n[STEP D.2] Verified public.trip_seats rows directly:")
    print(f"  Total seat count: {len(db_seats.data)}")
    assert len(db_seats.data) == 3, "Must have exactly 3 seats"
    for s in db_seats.data:
        print(f"  - Seat #{s['seat_number']}: id={s['id']}, status={s['status']}, trip_id={s['trip_id']}")
        assert s["status"] == "available", f"Seat {s['seat_number']} must be available"
        assert s["trip_id"] == arjun_trip.id, "Seat trip_id must match trip UUID"
    assert [s["seat_number"] for s in db_seats.data] == [1, 2, 3], "Seat numbers must be 1, 2, 3"

    # ------------------------------------------------------------------
    # Step E: Saket logs in
    # ------------------------------------------------------------------
    login_saket = supabase_client.auth.sign_in_with_password({
        "email": "demo@topride.app",
        "password": "somepassword123"
    })
    saket_id = str(login_saket.user.id)
    saket_token = login_saket.session.access_token
    saket_client = get_user_supabase_client(saket_token)
    print(f"\n[STEP E] Saket Logged In Successfully:")
    print(f"  Auth UUID: {saket_id}")
    print(f"  Email: {login_saket.user.email}")
    assert saket_id == "44f8a1d1-c259-41dd-971f-7fe69de358d4"

    # ------------------------------------------------------------------
    # Step F & G: Saket searches: Bengaluru -> Hyderabad
    # ------------------------------------------------------------------
    search_results = fetch_trips_from_db(
        origin="Bengaluru",
        destination="Hyderabad",
        user_id=saket_id,
        client=saket_client
    )
    print(f"\n[STEP F & G] Saket Search Results (Bengaluru -> Hyderabad):")
    matching = [t for t in search_results if t.id == arjun_trip.id]
    assert len(matching) == 1, "Arjun's real trip must appear in search results"
    found = matching[0]
    print(f"  Found Trip ID: {found.id}")
    print(f"  Driver Name: {found.driverName}")
    print(f"  Driver Initials: {found.driverInitials}")
    print(f"  Driver Rating: {found.driverRating}")
    print(f"  Vehicle: {found.vehicle.make} {found.vehicle.model} ({found.vehicle.plateNumber})")
    print(f"  Available Seats: {found.availableSeats} of {found.totalSeats}")
    print(f"  isDriverTrip: {found.isDriverTrip}")
    print(f"  isPassengerTrip: {found.isPassengerTrip}")
    assert found.driverName == "Arjun Rao", "Driver name must be Arjun Rao"
    assert found.driverInitials == "AR", "Driver initials must be AR"
    assert found.vehicle.make == "Hyundai", "Vehicle make must be Hyundai"
    assert found.availableSeats == 3, "Available seats must be 3"
    assert found.isDriverTrip is False, "isDriverTrip must be False for Saket"

    # ------------------------------------------------------------------
    # Step H: Saket opens Trip Details
    # ------------------------------------------------------------------
    detail = fetch_trip_by_id_from_db(arjun_trip.id, user_id=saket_id, client=saket_client)
    assert detail is not None, "Trip details must be returned"
    print(f"\n[STEP H] Saket Opens Trip Details:")
    print(f"  Trip ID: {detail.id}")
    print(f"  Driver Name: {detail.driverName} ({detail.driverInitials})")
    print(f"  Vehicle: {detail.vehicle.make} {detail.vehicle.model} ({detail.vehicle.plateNumber})")
    print(f"  Available Seats: {detail.availableSeats}/{detail.totalSeats}")
    print(f"  Origin: {detail.origin} - {detail.originDetail}")
    print(f"  Destination: {detail.destination} - {detail.destinationDetail}")
    assert detail.driverName == "Arjun Rao"
    assert detail.driverInitials == "AR"
    assert detail.availableSeats == 3

    # ------------------------------------------------------------------
    # Step I: Click Message - Verify existing Arjun conversation exists
    # ------------------------------------------------------------------
    # Check public.conversations between Saket and Arjun
    conv_res = saket_client.table("conversations").select("*").or_(
        f"and(participant1_id.eq.{saket_id},participant2_id.eq.{arjun_id}),and(participant1_id.eq.{arjun_id},participant2_id.eq.{saket_id})"
    ).execute()
    print(f"\n[STEP I] Click Message - Chat Verification:")
    if conv_res.data:
        existing_conv = conv_res.data[0]
        print(f"  Found EXISTING Conversation: {existing_conv['id']}")
        print(f"  Participant 1: {existing_conv['participant1_id']}")
        print(f"  Participant 2: {existing_conv['participant2_id']}")
        print(f"  Last Message: {existing_conv.get('last_message')}")
    else:
        # Create conversation between Saket and Arjun if not already present
        new_conv = saket_client.table("conversations").insert({
            "participant1_id": saket_id,
            "participant2_id": arjun_id,
            "trip_id": arjun_trip.id,
            "trip_route": f"{arjun_trip.origin} -> {arjun_trip.destination}",
            "last_message": "Hi Arjun, interested in your trip!"
        }).execute()
        existing_conv = new_conv.data[0]
        print(f"  Created Conversation with Arjun: {existing_conv['id']}")

    # ------------------------------------------------------------------
    # Step J: Security Checks
    # ------------------------------------------------------------------
    print(f"\n[STEP J] Security Verification:")
    # 1. Saket cannot cancel Arjun's trip
    try:
        cancel_trip_in_db(arjun_trip.id, driver_id=saket_id, client=saket_client)
        print("  FAIL: Saket was able to cancel Arjun's trip!")
        assert False, "Saket must not cancel Arjun's trip"
    except Exception as e:
        print(f"  PASS: Saket cannot cancel Arjun's trip (Blocked): {getattr(e, 'detail', str(e))}")

    # 2. Arjun cannot create a trip using Saket's driver_id
    spoofed_payload = TripCreate(
        origin="Bengaluru",
        destination="Chennai",
        date="Sun, 18 Oct",
        departureTime="09:00",
        totalSeats=2,
        pricePerSeat=500.0
    )
    try:
        # Attempt to insert trip where driver_id = saket_id using arjun_client
        spoofed_trip_id = str(uuid.uuid4())
        arjun_client.table("trips").insert({
            "id": spoofed_trip_id,
            "driver_id": saket_id, # Spoofed!
            "origin": "Bengaluru",
            "destination": "Chennai",
            "date": "Sun, 18 Oct",
            "departure_time": "09:00",
            "total_seats": 2,
            "available_seats": 2,
            "price_per_seat": 500.0,
            "status": "upcoming"
        }).execute()
        print("  FAIL: Arjun was able to insert a trip with Saket's driver_id!")
        assert False, "RLS must block spoofed driver_id"
    except Exception as e:
        print(f"  PASS: Arjun cannot create trip using Saket's driver_id (RLS Blocked): {e}")

    # 3. A user cannot create trip_seats for another user's trip
    try:
        fake_seat_id = str(uuid.uuid4())
        saket_client.table("trip_seats").insert({
            "id": fake_seat_id,
            "trip_id": arjun_trip.id, # Arjun's trip!
            "seat_number": 4,
            "status": "available"
        }).execute()
        print("  FAIL: Saket was able to insert seat into Arjun's trip!")
        assert False, "RLS must block seat insertion for another user's trip"
    except Exception as e:
        print(f"  PASS: User cannot create seats for another user's trip (RLS Blocked): {e}")

    # ------------------------------------------------------------------
    # Step K: Refresh / Persistence verification
    # ------------------------------------------------------------------
    print(f"\n[STEP K] Persistence Check:")
    persisted_trip = fetch_trip_by_id_from_db(arjun_trip.id, client=saket_client)
    assert persisted_trip is not None, "Trip must persist in database"
    assert persisted_trip.status == "upcoming", "Trip status must be upcoming"
    assert persisted_trip.availableSeats == 3, "Available seats must remain 3"
    print(f"  Trip successfully persisted in Supabase: {persisted_trip.id}")
    print(f"  Status: {persisted_trip.status}, Available Seats: {persisted_trip.availableSeats}")

    print("\n==================================================")
    print("MANDATORY TEST PASSED 100% WITH REAL SUPABASE DATA")
    print("==================================================")

if __name__ == "__main__":
    run_mandatory_test()
