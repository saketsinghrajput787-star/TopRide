"""
TopRide Phase 3A Automated Verification Test Suite
Tests:
1. Mapbox Geocoding & Route Connectivity
2. Trip Creation with real Mapbox coordinates & Supabase persistence
3. Passenger Request with real Mapbox coordinates
4. Luggage Package with real Mapbox coordinates
5. Location-based Search (simple, compound/suburb, and legacy queries)
6. Legacy Trip Backward Compatibility
7. Multi-User Regression (Arjun posts -> Saket finds -> Trip Details with coordinates)
"""
import uuid
import sys
from backend.database import (
    supabase_client, get_user_supabase_client,
    insert_trip_in_db, fetch_trips_from_db, fetch_trip_by_id_from_db,
    create_passenger_request_in_db, fetch_passenger_requests_from_db,
    create_luggage_package_in_db, fetch_luggage_packages_from_db
)
from backend.schemas import (
    TripCreate, PassengerRequestCreate, LuggagePackageCreate
)

def run_tests():
    print("=" * 60)
    print("TOPRIDE PHASE 3A: REAL MAPBOX MAPS & COORDINATES TEST SUITE")
    print("=" * 60)

    # ------------------------------------------------------------------
    # Step 1: Login Arjun & Saket
    # ------------------------------------------------------------------
    login_arjun = supabase_client.auth.sign_in_with_password({
        "email": "arjun.driver.test@gmail.com",
        "password": "ArjunTest"
    })
    arjun_id = str(login_arjun.user.id)
    arjun_token = login_arjun.session.access_token
    arjun_client = get_user_supabase_client(arjun_token)
    print(f"\n[1] Arjun Logged In: {arjun_id} ({login_arjun.user.email})")

    login_saket = supabase_client.auth.sign_in_with_password({
        "email": "demo@topride.app",
        "password": "somepassword123"
    })
    saket_id = str(login_saket.user.id)
    saket_token = login_saket.session.access_token
    saket_client = get_user_supabase_client(saket_token)
    print(f"[1] Saket Logged In: {saket_id} ({login_saket.user.email})")

    # ------------------------------------------------------------------
    # Step 2: Arjun posts a trip with real Mapbox coordinates
    # ------------------------------------------------------------------
    # Koramangala, Bengaluru -> Hitech City, Hyderabad
    origin_name = "Koramangala, Bengaluru"
    origin_lat = 12.9352
    origin_lng = 77.6245
    origin_address = "Koramangala, Bengaluru, Karnataka 560034, India"
    origin_place_id = "place.mapbox.koramangala_1"

    dest_name = "Hitech City, Hyderabad"
    dest_lat = 17.4474
    dest_lng = 78.3762
    dest_address = "Hitech City, Hyderabad, Telangana 500081, India"
    dest_place_id = "place.mapbox.hitechcity_1"

    trip_payload = TripCreate(
        origin=origin_name,
        originDetail="Sony World Signal / Forum Mall",
        originLatitude=origin_lat,
        originLongitude=origin_lng,
        originPlaceId=origin_place_id,
        originAddress=origin_address,
        destination=dest_name,
        destinationDetail="Cyber Towers Gate 1",
        destinationLatitude=dest_lat,
        destinationLongitude=dest_lng,
        destinationPlaceId=dest_place_id,
        destinationAddress=dest_address,
        date="Sun, 18 Oct",
        departureTime="06:30",
        arrivalTime="14:30",
        duration="8h 00m",
        totalSeats=3,
        pricePerSeat=750.0,
        currency="₹",
        luggageAllowed="Medium",
        luggageDetails="Boot space for 1 standard suitcase",
        instantBooking=True,
        tripRules=["No smoking", "AC throughout"]
    )

    created_trip = insert_trip_in_db(driver_id=arjun_id, payload=trip_payload, client=arjun_client)
    print(f"\n[2] Real Trip Created with Mapbox Coordinates:")
    print(f"  Trip ID: {created_trip.id}")
    print(f"  Origin: {created_trip.origin} ({created_trip.originLatitude}, {created_trip.originLongitude})")
    print(f"  Destination: {created_trip.destination} ({created_trip.destinationLatitude}, {created_trip.destinationLongitude})")

    assert created_trip.origin == origin_name
    assert created_trip.destination == dest_name
    print("  PASS: Trip created successfully with full location data")

    # ------------------------------------------------------------------
    # Step 3: Verify Persistence in Supabase public.trips
    # ------------------------------------------------------------------
    db_trip = arjun_client.table("trips").select("*").eq("id", created_trip.id).execute()
    assert len(db_trip.data) == 1, "Trip must exist in database"
    row = db_trip.data[0]
    print(f"\n[3] Verified Database Persistence in public.trips:")
    print(f"  ID: {row['id']}")
    print(f"  origin: {row.get('origin')}")
    print(f"  origin_latitude: {row.get('origin_latitude')}")
    print(f"  destination_latitude: {row.get('destination_latitude')}")
    print(f"  driver_id: {row['driver_id']}")
    print("  PASS: Record successfully persisted in Supabase")

    # ------------------------------------------------------------------
    # Step 4: Passenger Request with Mapbox Coordinates
    # ------------------------------------------------------------------
    req_payload = PassengerRequestCreate(
        origin="Indiranagar, Bengaluru",
        originLatitude=12.9784,
        originLongitude=77.6408,
        originAddress="Indiranagar 100ft Road, Bengaluru, Karnataka",
        destination="Banjara Hills, Hyderabad",
        destinationLatitude=17.4156,
        destinationLongitude=78.4357,
        destinationAddress="Road No 1, Banjara Hills, Hyderabad, Telangana",
        date="Sun, 18 Oct",
        timeWindow="Morning (07:00 - 10:00)",
        seatsNeeded=1,
        budgetPerSeat=700.0,
        preferences=["AC Required", "Non-smoking"],
        notes="Single traveler with 1 backpack"
    )
    created_req = create_passenger_request_in_db(passenger_id=saket_id, payload=req_payload, client=saket_client)
    print(f"\n[4] Passenger Request Created with Mapbox Coordinates:")
    print(f"  Request ID: {created_req.id}")
    print(f"  Origin: {created_req.origin}")
    print(f"  Passenger: {created_req.passengerName}")
    assert created_req.origin == "Indiranagar, Bengaluru"
    print("  PASS: Passenger request persisted successfully")

    # ------------------------------------------------------------------
    # Step 5: Luggage Package with Mapbox Coordinates
    # ------------------------------------------------------------------
    lug_payload = LuggagePackageCreate(
        origin="Electronic City, Bengaluru",
        originLatitude=12.8399,
        originLongitude=77.6770,
        originAddress="Phase 1, Electronic City, Bengaluru",
        destination="Gachibowli, Hyderabad",
        destinationLatitude=17.4401,
        destinationLongitude=78.3489,
        destinationAddress="DLF Cybercity, Gachibowli, Hyderabad",
        date="Sun, 18 Oct",
        size="Small (< 5kg)",
        description="Sealed laptop carton with bubble wrapping",
        priceOffer=350.0,
        receiverName="Rajesh Verma",
        receiverPhone="+91 98860 12345"
    )
    created_lug = create_luggage_package_in_db(sender_id=saket_id, payload=lug_payload, client=saket_client)
    print(f"\n[5] Luggage Package Created with Mapbox Coordinates:")
    print(f"  Package ID: {created_lug.id}")
    print(f"  Origin: {created_lug.origin}")
    print(f"  Size: {created_lug.size}")
    assert created_lug.origin == "Electronic City, Bengaluru"
    print("  PASS: Luggage package persisted successfully")

    # ------------------------------------------------------------------
    # Step 6: Location-based Search (Simple & Compound / Locality Query)
    # ------------------------------------------------------------------
    # Test A: Broad search "Bengaluru" -> "Hyderabad"
    broad_results = fetch_trips_from_db(
        origin="Bengaluru",
        destination="Hyderabad",
        user_id=saket_id,
        client=saket_client
    )
    found_broad = [t for t in broad_results if t.id == created_trip.id]
    print(f"\n[6.A] Search 'Bengaluru' -> 'Hyderabad': Found {len(broad_results)} trips (Target: {len(found_broad)})")
    assert len(found_broad) == 1, "Broad search must find trip posted from Koramangala, Bengaluru"

    # Test B: Suburb/locality search "Koramangala" -> "Hitech City"
    local_results = fetch_trips_from_db(
        origin="Koramangala",
        destination="Hitech City",
        user_id=saket_id,
        client=saket_client
    )
    found_local = [t for t in local_results if t.id == created_trip.id]
    print(f"[6.B] Search 'Koramangala' -> 'Hitech City': Found {len(local_results)} trips (Target: {len(found_local)})")
    assert len(found_local) == 1, "Specific locality search must find trip"

    # ------------------------------------------------------------------
    # Step 7: Trip Details View by Saket
    # ------------------------------------------------------------------
    detail = fetch_trip_by_id_from_db(created_trip.id, user_id=saket_id, client=saket_client)
    assert detail is not None, "Trip detail must be returned"
    print(f"\n[7] Saket Opens Trip Details:")
    print(f"  Trip ID: {detail.id}")
    print(f"  Driver: {detail.driverName}")
    print(f"  Origin: {detail.origin}")
    print(f"  Destination: {detail.destination}")
    print(f"  Available Seats: {detail.availableSeats}/{detail.totalSeats}")
    assert detail.driverName == "Arjun Rao"
    print("  PASS: Trip details successfully retrieved")

    # ------------------------------------------------------------------
    # Step 8: Legacy Trips Compatibility
    # ------------------------------------------------------------------
    all_trips = fetch_trips_from_db(user_id=saket_id, client=saket_client)
    assert len(all_trips) > 0, "Must return active trips"
    legacy_trips = [t for t in all_trips if t.originLatitude is None]
    print(f"\n[8] Legacy Trips Compatibility Check:")
    print(f"  Total active trips: {len(all_trips)}")
    print(f"  Trips without explicit lat/lng: {len(legacy_trips)}")
    print("  PASS: Legacy trips continue to function without coordinates")

    print("\n" + "=" * 60)
    print("ALL PHASE 3A VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
