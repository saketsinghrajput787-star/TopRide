import uuid
import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status, Query, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.config import PORT
from backend.database import (
    db, booking_lock, supabase_client, get_user_supabase_client,
    fetch_profile_from_db, upsert_profile_in_db, fetch_conversations_from_db,
    get_or_create_conversation_in_db, insert_message_in_db, mark_conversation_read_in_db,
    insert_trip_in_db, fetch_trips_from_db, fetch_trip_by_id_from_db, cancel_trip_in_db,
    create_booking_in_db, fetch_bookings_from_db, fetch_booking_by_id_from_db, cancel_booking_in_db,
    create_razorpay_order_in_db, update_payment_status_in_db,
    verify_payment_and_book_in_db, process_razorpay_webhook_event,
    create_passenger_request_in_db, fetch_passenger_requests_from_db, cancel_passenger_request_in_db,
    create_luggage_package_in_db, fetch_luggage_packages_from_db, cancel_luggage_package_in_db,
    fetch_vehicles_from_db, insert_vehicle_in_db, delete_vehicle_in_db, update_profile_in_db,
    fetch_notifications_from_db, mark_notification_read_in_db, mark_all_notifications_read_in_db,
    fetch_universities_from_db, submit_student_verification_in_db, submit_id_verification_in_db,
    create_support_ticket_in_db, fetch_support_tickets_from_db,
    INITIAL_USER
)
from backend.schemas import (
    SignUpRequest, LoginRequest, UserProfile, UserProfileUpdate,
    VehicleSchema, VehicleCreate, TripSchema, TripCreate,
    BookingCreate, BookingResponse, PaymentOrderCreate, PaymentOrderResponse, PaymentStatusUpdate,
    PaymentVerifyRequest, PaymentVerifyResponse,
    PassengerRequestSchema, PassengerRequestCreate,
    LuggagePackageSchema, LuggagePackageCreate, MessageSchema, ConversationSchema,
    MessageSendRequest, NotificationItemSchema, UniversityOptionSchema,
    StudentVerifyRequest, IdVerificationRequest, SupportTicketCreate, PayoutRequest
)
from backend.matching import (
    MatchingEngine, MatchingRequest, MatchingResponse,
    AssignmentRequest, AssignmentResponse
)
from backend.pricing import (
    DynamicPricingEngine, PriceEstimateRequest, PriceBreakdown
)


app = FastAPI(
    title="TopRide API",
    description="Backend API for TopRide Ride-sharing, Luggage & Logistics Platform",
    version="2.0.0"
)

# Enable CORS for frontend Vite dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= AUTHENTICATION DEPENDENCIES =================

def get_authenticated_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract and verify authenticated user ID from Supabase Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split("Bearer ", 1)[1].strip()
    try:
        user_resp = supabase_client.auth.get_user(token)
        if not user_resp or not user_resp.user or not user_resp.user.id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired session. Please log in again.",
            )
        return str(user_resp.user.id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Session verification failed: {str(e)}",
        )

def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract user ID if valid token present, otherwise None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    try:
        user_resp = supabase_client.auth.get_user(token)
        if user_resp and user_resp.user and user_resp.user.id:
            return str(user_resp.user.id)
    except Exception:
        pass
    return None

def resolve_or_create_profile(user_id: str, client=None, email: str = "", name: str = "", phone: str = "") -> UserProfile:
    """Fetch existing profile from public.profiles or create new one if missing."""
    profile = fetch_profile_from_db(user_id, client=client)
    if profile:
        return profile

    display_name = name or (email.split("@")[0].capitalize() if email else "Member")
    name_parts = display_name.strip().split()
    initials = "".join([p[0].upper() for p in name_parts[:2]]) if name_parts else "TR"

    new_profile = UserProfile(
        id=user_id,
        name=display_name,
        email=email or f"{user_id[:8]}@topride.app",
        phone=phone or "+91 98765 43210",
        initials=initials,
        rating=5.0,
        tripsCount=0,
        isVerified=True,
        isStudentVerified=False,
        bio="Member on TopRide.",
        joinedDate=datetime.datetime.now().strftime("%B %Y"),
        availablePayout=0.0
    )
    return upsert_profile_in_db(new_profile, client=client)

# ================= 1. HEALTH & ROOT =================
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "TopRide FastAPI Backend",
        "timestamp": datetime.datetime.now().isoformat()
    }

# ================= 2. AUTHENTICATION =================
@app.post("/api/auth/signup", response_model=UserProfile)
def signup(req: SignUpRequest, authorization: Optional[str] = Header(None)):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    user_id = None

    # 1. If frontend already signed up and passed bearer token, retrieve user
    if token:
        try:
            u_resp = supabase_client.auth.get_user(token)
            if u_resp and u_resp.user and u_resp.user.id:
                user_id = str(u_resp.user.id)
        except Exception:
            pass

    # 2. If no token, register directly with Supabase Auth
    if not user_id:
        try:
            res = supabase_client.auth.sign_up({
                "email": req.email,
                "password": req.password,
                "options": {"data": {"name": req.name, "phone": req.phone or ""}}
            })
            if res.user and res.user.id:
                user_id = str(res.user.id)
                if res.session and res.session.access_token:
                    token = res.session.access_token
        except Exception as e:
            # If user already exists in Auth, try authenticating
            try:
                login_res = supabase_client.auth.sign_in_with_password({"email": req.email, "password": req.password})
                if login_res.user and login_res.user.id:
                    user_id = str(login_res.user.id)
                    token = login_res.session.access_token
            except Exception:
                raise HTTPException(status_code=400, detail=f"Signup failed: {str(e)}")

    if not user_id:
        raise HTTPException(status_code=400, detail="Could not create Supabase user")

    # 3. Create initials
    name_parts = req.name.strip().split()
    initials = "".join([p[0].upper() for p in name_parts[:2]]) if name_parts else "TR"

    new_profile = UserProfile(
        id=user_id,
        name=req.name,
        email=req.email,
        phone=req.phone or "+91 98765 43210",
        initials=initials,
        rating=5.0,
        tripsCount=0,
        isVerified=True,
        isStudentVerified=False,
        bio="New member on TopRide.",
        joinedDate=datetime.datetime.now().strftime("%B %Y"),
        availablePayout=0.0
    )

    scoped_client = get_user_supabase_client(token)
    saved_profile = upsert_profile_in_db(new_profile, client=scoped_client)
    return saved_profile

@app.post("/api/auth/login", response_model=UserProfile)
def login(req: LoginRequest):
    # Authenticate with Supabase Auth
    try:
        res = supabase_client.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password
        })
        if not res.user or not res.user.id:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid email or password: {str(e)}")

    user_id = str(res.user.id)
    token = res.session.access_token if res.session else None
    scoped_client = get_user_supabase_client(token)

    # Load from public.profiles
    meta_name = (res.user.user_metadata or {}).get("name") or req.email.split("@")[0]
    meta_phone = (res.user.user_metadata or {}).get("phone") or ""
    profile = resolve_or_create_profile(user_id, client=scoped_client, email=req.email, name=meta_name, phone=meta_phone)
    return profile

@app.get("/api/auth/me", response_model=UserProfile)
def get_current_user(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    profile = fetch_profile_from_db(user_id, client=scoped_client)
    if not profile:
        profile = resolve_or_create_profile(user_id, client=scoped_client)
    return profile

# ================= 3. PROFILE =================
@app.get("/api/profile", response_model=UserProfile)
def get_profile(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    profile = fetch_profile_from_db(user_id, client=scoped_client)
    if not profile:
        profile = resolve_or_create_profile(user_id, client=scoped_client)
    return profile

@app.put("/api/profile", response_model=UserProfile)
def update_profile(
    updates: UserProfileUpdate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return update_profile_in_db(user_id=user_id, payload=updates, client=scoped_client)

@app.post("/api/profile/upload-photo")
def upload_profile_photo():
    return {"success": True, "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}

# ================= 4. VEHICLES =================
@app.get("/api/vehicles", response_model=List[VehicleSchema])
def list_vehicles(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return fetch_vehicles_from_db(user_id=user_id, client=scoped_client)

@app.post("/api/vehicles", response_model=VehicleSchema)
def add_vehicle(
    v: VehicleCreate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return insert_vehicle_in_db(user_id=user_id, payload=v, client=scoped_client)

@app.delete("/api/vehicles/{veh_id}")
def delete_vehicle(
    veh_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    success = delete_vehicle_in_db(vehicle_id=veh_id, user_id=user_id, client=scoped_client)
    return {"success": success, "deletedId": veh_id}

# ================= 5. TRIPS & SEARCH =================
@app.get("/api/trips", response_model=List[TripSchema])
def list_trips(
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    user_id = get_optional_user_id(authorization)
    scoped_client = get_user_supabase_client(token)
    return fetch_trips_from_db(user_id=user_id, client=scoped_client)

@app.get("/api/trips/search", response_model=List[TripSchema])
def search_trips(
    origin: Optional[str] = Query(None),
    destination: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    onlyVerified: Optional[bool] = Query(False),
    onlyInstant: Optional[bool] = Query(False),
    maxPrice: Optional[float] = Query(None),
    timeFilter: Optional[str] = Query("all"),
    sortBy: Optional[str] = Query("cheapest"),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    user_id = get_optional_user_id(authorization)
    scoped_client = get_user_supabase_client(token)
    return fetch_trips_from_db(
        origin=origin,
        destination=destination,
        date=date,
        only_verified=onlyVerified or False,
        only_instant=onlyInstant or False,
        max_price=maxPrice,
        time_filter=timeFilter or "all",
        sort_by=sortBy or "cheapest",
        user_id=user_id,
        client=scoped_client
    )

@app.get("/api/trips/{trip_id}", response_model=TripSchema)
def get_trip(
    trip_id: str,
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    user_id = get_optional_user_id(authorization)
    scoped_client = get_user_supabase_client(token)
    trip = fetch_trip_by_id_from_db(trip_id, user_id=user_id, client=scoped_client)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@app.post("/api/trips", response_model=TripSchema)
def create_trip(
    payload: TripCreate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    scoped_client = get_user_supabase_client(token)
    return insert_trip_in_db(driver_id=user_id, payload=payload, client=scoped_client)

@app.post("/api/trips/{trip_id}/cancel")
def cancel_trip(
    trip_id: str,
    reason: str = Query("Trip cancelled by driver"),
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    scoped_client = get_user_supabase_client(token)
    success = cancel_trip_in_db(trip_id=trip_id, driver_id=user_id, reason=reason, client=scoped_client)
    return {"success": success, "message": "Trip cancelled successfully"}

# ================= 6. BOOKINGS =================
@app.post("/api/bookings", response_model=BookingResponse)
def create_booking(
    req: BookingCreate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return create_booking_in_db(passenger_id=user_id, payload=req, client=scoped_client)

@app.get("/api/bookings")
def list_bookings(
    as_driver: Optional[bool] = Query(False),
    asDriver: Optional[bool] = Query(False),
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    filter_driver = bool(as_driver or asDriver)
    return fetch_bookings_from_db(user_id=user_id, as_driver=filter_driver, client=scoped_client)

@app.get("/api/bookings/{booking_id}")
def get_booking(
    booking_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    booking = fetch_booking_by_id_from_db(booking_id=booking_id, user_id=user_id, client=scoped_client)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return booking

@app.post("/api/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: str,
    reason: str = Query("Cancelled by user"),
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    success = cancel_booking_in_db(booking_id=booking_id, user_id=user_id, reason=reason, client=scoped_client)
    return {"success": success, "message": "Booking cancelled successfully"}

# ================= 6B. RAZORPAY TEST MODE PAYMENTS =================
@app.post("/api/payments/razorpay/order", response_model=PaymentOrderResponse)
def create_razorpay_order(
    req: PaymentOrderCreate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    """Validate trip, requested seats, and create an authentic Razorpay TEST order."""
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return create_razorpay_order_in_db(user_id=user_id, req=req, client=scoped_client)

@app.post("/api/payments/razorpay/record-status")
def record_payment_status(
    req: PaymentStatusUpdate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    """Record payment status change (failed, cancelled) in database."""
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return update_payment_status_in_db(user_id=user_id, req=req, client=scoped_client)

@app.post("/api/payments/razorpay/verify", response_model=PaymentVerifyResponse)
def verify_razorpay_payment(
    req: PaymentVerifyRequest,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    """Authoritatively verify Razorpay payment signature and atomically book seats."""
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return verify_payment_and_book_in_db(user_id=user_id, req=req, client=scoped_client)

@app.post("/api/payments/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature")
):
    """Receive and process Razorpay webhooks with signature verification and idempotency."""
    raw_body = await request.body()
    return process_razorpay_webhook_event(raw_body=raw_body, signature=x_razorpay_signature)


# ================= 6C. AUTOMATIC WEIGHTED MATCHING & ASSIGNMENT =================
@app.post("/api/matching/find", response_model=MatchingResponse)
def find_matching_trips(
    req: MatchingRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Find and rank candidate trips using deterministic weighted scoring (0-100).
    Applies hard constraint filtering, local feature calculations, and deterministic tie breaking.
    Zero external API calls.
    """
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    user_id = get_optional_user_id(authorization)
    scoped_client = get_user_supabase_client(token)

    # Attach authoritative passenger_id if authenticated
    if user_id and not req.passenger_id:
        req.passenger_id = user_id

    return MatchingEngine.match(req, client=scoped_client)


@app.post("/api/matching/assign", response_model=AssignmentResponse)
def assign_matching_trip(
    req: AssignmentRequest,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    """
    Atomically assign and book the highest ranked eligible trip.
    Cascades through top candidates (up to MAX_ASSIGNMENT_ATTEMPTS = 3) if race condition occurs.
    Authoritative passenger identity from JWT (auth.uid()).
    """
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return MatchingEngine.assign(passenger_id=user_id, request=req, client=scoped_client)


# ================= 7. PASSENGER REQUESTS =================
@app.get("/api/requests", response_model=List[PassengerRequestSchema])
def list_passenger_requests(authorization: Optional[str] = Header(None)):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    scoped_client = get_user_supabase_client(token)
    return fetch_passenger_requests_from_db(client=scoped_client)

@app.get("/api/requests/my", response_model=List[PassengerRequestSchema])
def list_my_passenger_requests(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return fetch_passenger_requests_from_db(user_id=user_id, only_my=True, client=scoped_client)

@app.post("/api/requests", response_model=PassengerRequestSchema)
def create_passenger_request(
    req: PassengerRequestCreate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return create_passenger_request_in_db(passenger_id=user_id, payload=req, client=scoped_client)

@app.post("/api/requests/{request_id}/cancel")
def cancel_passenger_request(
    request_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    success = cancel_passenger_request_in_db(request_id=request_id, user_id=user_id, client=scoped_client)
    return {"success": success, "message": "Request cancelled successfully"}

# ================= 8. LUGGAGE =================
@app.get("/api/luggage", response_model=List[LuggagePackageSchema])
def list_luggage_packages(authorization: Optional[str] = Header(None)):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    scoped_client = get_user_supabase_client(token)
    return fetch_luggage_packages_from_db(client=scoped_client)

@app.get("/api/luggage/my", response_model=List[LuggagePackageSchema])
def list_my_luggage_packages(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return fetch_luggage_packages_from_db(user_id=user_id, only_my=True, client=scoped_client)

@app.post("/api/luggage", response_model=LuggagePackageSchema)
def create_luggage_package(
    pkg: LuggagePackageCreate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return create_luggage_package_in_db(sender_id=user_id, payload=pkg, client=scoped_client)

@app.post("/api/luggage/{package_id}/cancel")
def cancel_luggage_package(
    package_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    success = cancel_luggage_package_in_db(package_id=package_id, user_id=user_id, client=scoped_client)
    return {"success": success, "message": "Luggage package cancelled successfully"}

# ================= 9. CHAT & MESSAGING =================

class CreateConversationRequest(BaseModel):
    partnerId: str
    tripId: Optional[str] = None

@app.get("/api/conversations", response_model=List[ConversationSchema])
def list_conversations(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return fetch_conversations_from_db(user_id, client=scoped_client)

@app.post("/api/conversations", response_model=ConversationSchema)
def create_conversation(
    req: CreateConversationRequest,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return get_or_create_conversation_in_db(user_id, req.partnerId, trip_id=req.tripId, client=scoped_client)

@app.post("/api/conversations/{conv_id}/messages", response_model=MessageSchema)
def send_message(
    conv_id: str,
    req: MessageSendRequest,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return insert_message_in_db(conv_id, user_id, req.text, client=scoped_client)

@app.put("/api/conversations/{conv_id}/read")
def mark_conversation_read(
    conv_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    success = mark_conversation_read_in_db(conv_id, user_id, client=scoped_client)
    return {"success": success}

# ================= 10. NOTIFICATIONS =================
@app.get("/api/notifications", response_model=List[NotificationItemSchema])
def list_notifications(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return fetch_notifications_from_db(user_id=user_id, client=scoped_client)

@app.put("/api/notifications/read-all")
def mark_all_notifications_read(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    success = mark_all_notifications_read_in_db(user_id=user_id, client=scoped_client)
    return {"success": success}

@app.put("/api/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: str,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    success = mark_notification_read_in_db(notif_id=notif_id, user_id=user_id, client=scoped_client)
    return {"success": success}

# ================= 11. VERIFICATIONS & UNIVERSITIES =================
@app.get("/api/universities", response_model=List[UniversityOptionSchema])
def list_universities(authorization: Optional[str] = Header(None)):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None
    scoped_client = get_user_supabase_client(token)
    return fetch_universities_from_db(client=scoped_client)

@app.post("/api/verification/student")
def verify_student(
    req: StudentVerifyRequest,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return submit_student_verification_in_db(user_id=user_id, req=req, client=scoped_client)

@app.post("/api/verification/id")
def submit_id_verification(
    req: IdVerificationRequest,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return submit_id_verification_in_db(user_id=user_id, req=req, client=scoped_client)

# ================= 12. SUPPORT TICKETS =================
@app.post("/api/support/ticket")
def create_support_ticket(
    req: SupportTicketCreate,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return create_support_ticket_in_db(user_id=user_id, req=req, client=scoped_client)

@app.get("/api/support/tickets")
def list_support_tickets(
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    return fetch_support_tickets_from_db(user_id=user_id, client=scoped_client)
    ticket_ref = f"TR-SUP-{uuid.uuid4().hex[:4].upper()}"
    ticket = {
        "id": f"ticket_{uuid.uuid4().hex[:6]}",
        "ticketRef": ticket_ref,
        "category": req.category,
        "message": req.message,
        "status": "open",
        "createdAt": datetime.datetime.now().isoformat()
    }
    db.support_tickets.append(ticket)
    return {"success": True, "ticketRef": ticket_ref}

# ================= 13. PAYMENTS & PAYOUTS =================
@app.post("/api/payments/payout")
def request_payout(
    req: PayoutRequest,
    user_id: str = Depends(get_authenticated_user_id),
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization else None
    scoped_client = get_user_supabase_client(token)
    curr_user = fetch_profile_from_db(user_id, client=scoped_client) or resolve_or_create_profile(user_id, client=scoped_client)

    if curr_user.availablePayout < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient payout balance")
    
    curr_user.availablePayout = max(0.0, curr_user.availablePayout - req.amount)
    upsert_profile_in_db(curr_user, client=scoped_client)

    payout_record = {
        "id": f"pay_{uuid.uuid4().hex[:6]}",
        "amount": req.amount,
        "method": req.method,
        "destination": req.destination,
        "status": "processing",
        "createdAt": datetime.datetime.now().isoformat()
    }
    db.payout_records.append(payout_record)
    return {"success": True, "remainingPayout": curr_user.availablePayout}

# ================= 14. PREFERENCES =================
@app.get("/api/preferences")
def get_preferences(user_id: str = Depends(get_authenticated_user_id)):
    return db.preferences.get(user_id, {
        "chattiness": True,
        "airConditioning": True,
        "music": True,
        "pets": False,
        "smoking": False
    })

@app.put("/api/preferences")
def update_preferences(prefs: dict, user_id: str = Depends(get_authenticated_user_id)):
    db.preferences[user_id] = prefs
    return {"success": True, "preferences": prefs}

# ================= 15. DYNAMIC PRICING ENGINE =================
@app.post("/api/pricing/estimate", response_model=PriceBreakdown)
def estimate_trip_market_price(
    req: PriceEstimateRequest,
    authorization: Optional[str] = Header(None)
):
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and "Bearer " in authorization else None
    scoped_client = get_user_supabase_client(token)
    return DynamicPricingEngine.calculate_price(req, client=scoped_client)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=PORT, reload=True)


