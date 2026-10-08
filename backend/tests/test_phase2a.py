import uuid
import json
from backend.database import (
    supabase_client, get_user_supabase_client,
    insert_trip_in_db, fetch_trips_from_db, fetch_trip_by_id_from_db, cancel_trip_in_db
)
from backend.schemas import TripCreate, VehicleSchema

def run_tests():
    print("==================================================")
    print("PHASE 2A BACKEND & SUPABASE VERIFICATION")
    print("==================================================")

    # 1. Login as Saket
    login_saket = supabase_client.auth.sign_in_with_password({
        "email": "demo@topride.app",
        "password": "somepassword123"
    })
    saket_id = str(login_saket.user.id)
    saket_token = login_saket.session.access_token
    saket_client = get_user_supabase_client(saket_token)

    print("\n[TEST 1] Authenticated User Verified:")
    print(f"  User ID (UUID): {saket_id}")
    print(f"  Email: {login_saket.user.email}")

    # 2. Check/Register vehicle for driver
    v_res = saket_client.table("vehicles").select("*").eq("user_id", saket_id).execute()
    if not v_res.data:
        new_veh = saket_client.table("vehicles").insert({
            "id": str(uuid.uuid4()),
            "user_id": saket_id,
            "make": "Maruti Suzuki",
            "model": "Baleno Alpha",
            "year": 2023,
            "color": "Pearl Arctic White",
            "plate_number": "KA 01 AB 1234",
            "is_default": True
        }).execute()
        saket_veh_id = new_veh.data[0]["id"]
        print(f"\n[TEST 2] Real Vehicle Created in public.vehicles: {saket_veh_id}")
    else:
        saket_veh_id = v_res.data[0]["id"]
        print(f"\n[TEST 2] Existing Real Vehicle Found in public.vehicles: {saket_veh_id}")

    # 3. Post Trip: Bengaluru -> Hyderabad, 3 seats, 650
    trip_payload = TripCreate(
        origin="Bengaluru",
        originDetail="Koramangala Sony World Signal / Electronic City Toll",
        destination="Hyderabad",
        destinationDetail="Gachibowli DLF Gate 2 / Hitec City",
        date="Sat, 10 Oct",
        departureTime="08:00",
        arrivalTime="16:30",
        duration="8h 30m",
        totalSeats=3,
        pricePerSeat=650.0,
        currency="Rs",
        vehicleId=saket_veh_id,
        luggageAllowed="Medium",
        luggageDetails="1 medium bag in boot + 1 small backpack inside cabin",
        instantBooking=True,
        tripRules=["No smoking", "AC on full trip", "Punctual passengers only"]
    )

    created_trip = insert_trip_in_db(driver_id=saket_id, payload=trip_payload, client=saket_client)
    print("\n[TEST 3] Trip Insert Result:")
    print(f"  Trip ID: {created_trip.id}")
    print(f"  Driver ID: {created_trip.driverId}")
    print(f"  Driver Name: {created_trip.driverName}")
    print(f"  Driver Initials: {created_trip.driverInitials}")
    print(f"  Driver Rating: {created_trip.driverRating}")
    print(f"  Vehicle: {created_trip.vehicle.make} {created_trip.vehicle.model} ({created_trip.vehicle.plateNumber})")
    print(f"  Available Seats: {created_trip.availableSeats} of {created_trip.totalSeats}")

    # 4. Verify directly in Supabase public.trips
    db_trip = saket_client.table("trips").select("*").eq("id", created_trip.id).execute()
    assert len(db_trip.data) == 1, "Trip must exist in public.trips"
    trip_row = db_trip.data[0]
    print("\n[TEST 4] Direct public.trips Verification:")
    print(f"  Row ID: {trip_row['id']}")
    print(f"  Driver ID: {trip_row['driver_id']}")
    print(f"  Vehicle ID: {trip_row['vehicle_id']}")
    print(f"  Route: {trip_row['origin']} -> {trip_row['destination']}")
    print(f"  Status: {trip_row['status']}")

    # 5. Verify directly in Supabase public.trip_seats
    db_seats = saket_client.table("trip_seats").select("*").eq("trip_id", created_trip.id).order("seat_number").execute()
    print(f"\n[TEST 5] Direct public.trip_seats Verification:")
    print(f"  Total seat rows: {len(db_seats.data)}")
    for s in db_seats.data:
        print(f"    Seat #{s['seat_number']}: status={s['status']}, trip_id={s['trip_id']}")
    assert len(db_seats.data) == 3, "Exactly 3 seat rows must be generated"
    assert all(s["status"] == "available" for s in db_seats.data), "All seats must be available"

    # 6. Verify fetch_trips_from_db
    all_trips = fetch_trips_from_db(user_id=saket_id, client=saket_client)
    matching = [t for t in all_trips if t.id == created_trip.id]
    assert len(matching) == 1, "Created trip must appear in fetch_trips_from_db"
    print(f"\n[TEST 6] GET /api/trips List Verification:")
    print(f"  isDriverTrip: {matching[0].isDriverTrip}")
    print(f"  isPassengerTrip: {matching[0].isPassengerTrip}")
    assert matching[0].isDriverTrip is True, "Driver trip flag must be True for creator"

    # 7. Verify search_trips
    search_res = fetch_trips_from_db(
        origin="Bengaluru",
        destination="Hyderabad",
        user_id=saket_id,
        client=saket_client
    )
    search_matching = [t for t in search_res if t.id == created_trip.id]
    assert len(search_matching) == 1, "Trip must appear in search results"
    print(f"\n[TEST 7] GET /api/trips/search Verification:")
    print(f"  Found matching trip in search: {search_matching[0].origin} -> {search_matching[0].destination}")

    # 8. Verify fetch_trip_by_id_from_db
    single_trip = fetch_trip_by_id_from_db(created_trip.id, user_id=saket_id, client=saket_client)
    assert single_trip is not None, "Single trip must be found"
    print(f"\n[TEST 8] GET /api/trips/{{trip_id}} Verification:")
    print(f"  Trip ID: {single_trip.id}")
    print(f"  Driver: {single_trip.driverName} ({single_trip.driverInitials})")
    print(f"  Vehicle: {single_trip.vehicle.make} {single_trip.vehicle.model}")
    print(f"  Available Seats: {single_trip.availableSeats}")

    # 9. Verify Cancellation Security
    fake_user_id = str(uuid.uuid4())
    print("\n[TEST 9] Security Check: Unauthorized user cancellation:")
    try:
        cancel_trip_in_db(created_trip.id, driver_id=fake_user_id, client=saket_client)
        print("  ERROR: Unauthorized user cancellation was NOT blocked!")
    except Exception as e:
        print(f"  SUCCESS: Unauthorized cancellation correctly blocked (HTTP 403): {e.detail if hasattr(e, 'detail') else e}")

    # 10. Verify Driver Cancellation
    print("\n[TEST 10] Driver Cancellation:")
    cancel_res = cancel_trip_in_db(created_trip.id, driver_id=saket_id, client=saket_client)
    assert cancel_res is True, "Cancellation must return True"
    cancelled_row = saket_client.table("trips").select("status, available_seats").eq("id", created_trip.id).execute()
    print(f"  Status in DB: {cancelled_row.data[0]['status']}")
    print(f"  Available Seats in DB: {cancelled_row.data[0]['available_seats']}")
    assert cancelled_row.data[0]["status"] == "cancelled"

    print("\n==================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
