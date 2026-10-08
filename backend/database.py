import asyncio
import uuid
import datetime
import json
import hmac
import hashlib
from typing import Dict, List, Optional, Any
from fastapi import HTTPException
import razorpay
from supabase import create_client, Client, ClientOptions
from backend.config import (
    SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY,
    RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
)
from backend.schemas import (
    UserProfile, UserProfileUpdate, VehicleSchema, VehicleCreate, TripSchema, TripCreate,
    BookingCreate, BookingResponse, PassengerRequestSchema, PassengerRequestCreate,
    LuggagePackageSchema, LuggagePackageCreate, ConversationSchema, MessageSchema,
    NotificationItemSchema, UniversityOptionSchema, StudentVerifyRequest,
    IdVerificationRequest, SupportTicketCreate,
    PaymentOrderCreate, PaymentOrderResponse, PaymentStatusUpdate,
    PaymentVerifyRequest, PaymentVerifyResponse
)

# Initialize Supabase client
key_to_use = SUPABASE_SERVICE_ROLE_KEY if SUPABASE_SERVICE_ROLE_KEY else SUPABASE_KEY
supabase_client: Client = create_client(SUPABASE_URL, key_to_use)

# Concurrency lock for seat booking operations
booking_lock = asyncio.Lock()

def to_canonical_iso_date(date_val: Optional[str], default_year: int = 2026) -> Optional[str]:
    """
    Normalizes any date string (ISO 'YYYY-MM-DD' or legacy 'Sat, 10 Oct')
    into a canonical ISO date 'YYYY-MM-DD' without discarding the year.
    """
    if not date_val:
        return None
    val = date_val.strip()
    try:
        parts = val.split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            return datetime.date.fromisoformat(val).isoformat()
    except Exception:
        pass
    try:
        clean_words = [w for w in val.replace(",", " ").split() if len(w) > 0]
        months = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
        }
        day, month, year = None, None, default_year
        for w in clean_words:
            low = w.lower()[:3]
            if low in months:
                month = months[low]
            elif w.isdigit():
                num = int(w)
                if num > 1900:
                    year = num
                elif 1 <= num <= 31 and day is None:
                    day = num
        if day is not None and month is not None:
            return datetime.date(year, month, day).isoformat()
    except Exception:
        pass
    return None

# Cache for active Razorpay test orders (deduplication / fallback before migration)
_recent_razorpay_orders: Dict[str, Any] = {}

# Initial seed data from Phase 1
INITIAL_USER = UserProfile(
    id="usr_saket",
    name="Saket Kumar",
    email="demo@topride.app",
    phone="+91 98765 43210",
    initials="SK",
    avatar="",
    rating=4.9,
    tripsCount=19,
    isVerified=True,
    isStudentVerified=True,
    studentUniversity="Algoma University",
    bio="Product builder and tech enthusiast. I travel regularly between Bengaluru and Hyderabad for work. Clean car, good playlists, punctual.",
    joinedDate="March 2024",
    availablePayout=2450.0
)

INITIAL_VEHICLES = [
    VehicleSchema(
        id="veh_1",
        make="Maruti Suzuki",
        model="Baleno Alpha",
        year=2023,
        color="Pearl Arctic White",
        plateNumber="KA 01 AB 1234",
        isDefault=True
    ),
    VehicleSchema(
        id="veh_2",
        make="Hyundai",
        model="Creta SX(O)",
        year=2022,
        color="Phantom Black",
        plateNumber="KA 05 MN 5678",
        isDefault=False
    )
]

INITIAL_TRIPS = [
    TripSchema(
        id="trip_101",
        driverId="drv_arjun",
        driverName="Arjun Rao",
        driverInitials="AR",
        driverRating=4.9,
        driverTripsCount=34,
        driverIsVerified=True,
        origin="Bengaluru",
        originDetail="Koramangala Sony World Signal / Electronic City Toll",
        destination="Hyderabad",
        destinationDetail="Gachibowli DLF Gate 2 / Hitec City",
        date="Sat, 10 Oct",
        departureTime="08:00",
        arrivalTime="16:30",
        duration="8h 30m",
        totalSeats=4,
        availableSeats=2,
        pricePerSeat=650.0,
        currency="₹",
        vehicle=VehicleSchema(
            id="v_arjun",
            make="Maruti Suzuki",
            model="Swift Dzire VXi",
            year=2022,
            color="Silky Silver",
            plateNumber="KA 03 MX 9081"
        ),
        luggageAllowed="Medium",
        luggageDetails="1 medium bag in boot + 1 small backpack inside cabin",
        instantBooking=True,
        tripRules=["No smoking in car", "AC remains on at 23°C", "Pet-friendly on request", "Max 2 passengers on back seat for comfort"],
        stops=["Anantapur Highway Food Court (Lunch stop - 30m)", "Kurnool Toll Plaza (5m drop/pickup)"],
        status="upcoming"
    ),
    TripSchema(
        id="trip_102",
        driverId="drv_priya",
        driverName="Priya Sharma",
        driverInitials="PS",
        driverRating=4.8,
        driverTripsCount=22,
        driverIsVerified=True,
        origin="Bengaluru",
        originDetail="Hebbal Flyover / Kempegowda Intl Airport Road",
        destination="Hyderabad",
        destinationDetail="Mehdipatnam / Rajiv Gandhi International Airport",
        date="Sat, 10 Oct",
        departureTime="09:30",
        arrivalTime="18:00",
        duration="8h 30m",
        totalSeats=3,
        availableSeats=3,
        pricePerSeat=700.0,
        currency="₹",
        vehicle=VehicleSchema(
            id="v_priya",
            make="Tata",
            model="Nexon EV Dark Edition",
            year=2023,
            color="Atlas Black",
            plateNumber="KA 04 EL 4412"
        ),
        luggageAllowed="Small",
        luggageDetails="Hand luggage & cabin bag only (EV boot space allocated)",
        instantBooking=False,
        tripRules=["Female co-travelers preferred", "Quiet journey / Work friendly", "No food spillage"],
        stops=["Devanahalli BPCL Fast Charger (25m)"],
        status="upcoming"
    ),
    TripSchema(
        id="trip_103",
        driverId="drv_vikram",
        driverName="Vikramaditya Nair",
        driverInitials="VN",
        driverRating=5.0,
        driverTripsCount=58,
        driverIsVerified=True,
        origin="Bengaluru",
        originDetail="Indiranagar Metro Station 100ft Road",
        destination="Chennai",
        destinationDetail="Guindy Kathipara Junction",
        date="Sun, 11 Oct",
        departureTime="06:30",
        arrivalTime="12:00",
        duration="5h 30m",
        totalSeats=3,
        availableSeats=1,
        pricePerSeat=500.0,
        currency="₹",
        vehicle=VehicleSchema(
            id="v_vikram",
            make="Honda",
            model="City ZX",
            year=2021,
            color="Golden Brown",
            plateNumber="KA 01 MR 7810"
        ),
        luggageAllowed="Large",
        luggageDetails="Large suitcase allowed in trunk",
        instantBooking=True,
        tripRules=["On-time departure guaranteed", "Fastag express lane", "Spotify playlist access"],
        stops=["Hosur Border", "Krishnagiri A2B (Breakfast 20m)"],
        status="upcoming"
    ),
    TripSchema(
        id="trip_104",
        driverId="drv_rohit",
        driverName="Rohit Verma",
        driverInitials="RV",
        driverRating=4.7,
        driverTripsCount=15,
        driverIsVerified=True,
        origin="Mumbai",
        originDetail="Bandra Kurla Complex (BKC) Gate 4",
        destination="Pune",
        destinationDetail="Hinjawadi Phase 1 / Wakad Bridge",
        date="Mon, 12 Oct",
        departureTime="07:30",
        arrivalTime="10:45",
        duration="3h 15m",
        totalSeats=4,
        availableSeats=3,
        pricePerSeat=380.0,
        currency="₹",
        vehicle=VehicleSchema(
            id="v_rohit",
            make="Volkswagen",
            model="Virtus Topline",
            year=2023,
            color="Wild Cherry Red",
            plateNumber="MH 02 CK 6670"
        ),
        luggageAllowed="Medium",
        luggageDetails="Standard luggage accepted",
        instantBooking=True,
        tripRules=["Expressway non-stop trip", "AC on at 22°C", "No heavy luggage beyond boot"],
        stops=["Food Mall Khalapur (10m quick tea)"],
        status="upcoming"
    ),
    TripSchema(
        id="trip_user_booked",
        driverId="drv_arjun",
        driverName="Arjun Rao",
        driverInitials="AR",
        driverRating=4.9,
        driverTripsCount=34,
        driverIsVerified=True,
        origin="Bengaluru",
        originDetail="Koramangala Sony World Signal",
        destination="Hyderabad",
        destinationDetail="Gachibowli DLF Gate 2",
        date="Sat, 10 Oct",
        departureTime="08:00",
        arrivalTime="16:30",
        duration="8h 30m",
        totalSeats=4,
        availableSeats=1,
        pricePerSeat=650.0,
        currency="₹",
        vehicle=VehicleSchema(
            id="v_arjun",
            make="Maruti Suzuki",
            model="Swift Dzire VXi",
            year=2022,
            color="Silky Silver",
            plateNumber="KA 03 MX 9081"
        ),
        luggageAllowed="Medium",
        luggageDetails="1 small bag included",
        instantBooking=True,
        tripRules=["No smoking in car", "AC remains on at 23°C"],
        isPassengerTrip=True,
        bookedSeatCount=1,
        totalPaid=650.0,
        status="upcoming"
    ),
    TripSchema(
        id="trip_user_driver",
        driverId="usr_saket",
        driverName="Saket Kumar",
        driverInitials="SK",
        driverRating=4.9,
        driverTripsCount=19,
        driverIsVerified=True,
        origin="Hyderabad",
        originDetail="Hitec City Cyber Towers",
        destination="Bengaluru",
        destinationDetail="Silk Board Junction / Bellandur",
        date="Sun, 11 Oct",
        departureTime="09:00",
        arrivalTime="17:30",
        duration="8h 30m",
        totalSeats=3,
        availableSeats=2,
        pricePerSeat=650.0,
        currency="₹",
        vehicle=INITIAL_VEHICLES[0],
        luggageAllowed="Medium",
        luggageDetails="Medium bags in boot",
        instantBooking=True,
        tripRules=["Punctual passengers only", "AC full trip", "No smoking"],
        isDriverTrip=True,
        status="upcoming"
    ),
    TripSchema(
        id="trip_user_past",
        driverId="drv_karthik",
        driverName="Karthik Gowda",
        driverInitials="KG",
        driverRating=4.9,
        driverTripsCount=42,
        driverIsVerified=True,
        origin="Bengaluru",
        originDetail="Majestic Metro Station",
        destination="Mysuru",
        destinationDetail="Mysore Palace North Gate",
        date="28 Sep",
        departureTime="07:00",
        arrivalTime="09:30",
        duration="2h 30m",
        totalSeats=4,
        availableSeats=0,
        pricePerSeat=300.0,
        currency="₹",
        vehicle=VehicleSchema(
            id="v_karthik",
            make="Toyota",
            model="Innova Crysta",
            year=2021,
            color="Super White",
            plateNumber="KA 09 Z 8899"
        ),
        luggageAllowed="Large",
        luggageDetails="Trunk luggage allowed",
        instantBooking=True,
        tripRules=["Mysore expressway trip", "Clean vehicle"],
        isPassengerTrip=True,
        bookedSeatCount=1,
        totalPaid=300.0,
        status="completed"
    )
]

INITIAL_REQUESTS = [
    PassengerRequestSchema(
        id="req_1",
        passengerId="usr_neha",
        passengerName="Neha Kapoor",
        passengerInitials="NK",
        passengerRating=4.8,
        origin="Bengaluru (Koramangala)",
        destination="Hyderabad (Madhapur)",
        date="Sat, 10 Oct",
        timeWindow="Morning (07:00 - 10:00)",
        seatsNeeded=1,
        budgetPerSeat=700.0,
        preferences=["Female co-travelers preferred", "1 Cabin Bag", "AC Required"],
        status="active",
        notes="Traveling with one laptop backpack and a small trolley."
    ),
    PassengerRequestSchema(
        id="req_2",
        passengerId="usr_rahul",
        passengerName="Rahul Mehta",
        passengerInitials="RM",
        passengerRating=4.9,
        origin="Bengaluru Airport (BLR)",
        destination="Whitefield ITPL",
        date="Sat, 10 Oct",
        timeWindow="Late Afternoon (15:00 - 18:00)",
        seatsNeeded=2,
        budgetPerSeat=450.0,
        preferences=["Large Luggage", "Immediate Booking"],
        status="active",
        notes="Arriving on Indigo flight 6E-204, have 2 medium bags."
    ),
    PassengerRequestSchema(
        id="req_3",
        passengerId="usr_ananya",
        passengerName="Ananya Sen",
        passengerInitials="AS",
        passengerRating=5.0,
        origin="Algoma University Campus",
        destination="Downtown Station",
        date="Mon, 12 Oct",
        timeWindow="Evening (17:00)",
        seatsNeeded=1,
        budgetPerSeat=200.0,
        preferences=["Student Verified", "Non-smoking"],
        status="active",
        notes="Student commuting after evening lecture."
    )
]

INITIAL_LUGGAGE = [
    LuggagePackageSchema(
        id="lug_1",
        senderName="Nisha Kulkarni",
        senderInitials="NK",
        origin="Bengaluru (Indiranagar)",
        destination="Hyderabad (Banjara Hills)",
        date="Sat, 10 Oct",
        size="Small (< 5kg)",
        dimensions="30 × 20 × 10 cm",
        description="Sealed document envelope with academic transcripts & certificates",
        priceOffer=300.0,
        status="active",
        receiverName="Sanjay Kulkarni",
        receiverPhone="+91 94480 11223"
    ),
    LuggagePackageSchema(
        id="lug_2",
        senderName="Aditya Birla",
        senderInitials="AB",
        origin="Bengaluru (Electronic City)",
        destination="Hyderabad (Kondapur)",
        date="Sat, 10 Oct",
        size="Medium (< 15kg)",
        dimensions="50 × 40 × 25 cm",
        description="Box with handmade clay pottery gift set (well bubble-wrapped)",
        priceOffer=450.0,
        status="active",
        receiverName="Pooja Birla",
        receiverPhone="+91 98860 33445"
    ),
    LuggagePackageSchema(
        id="lug_3",
        senderName="Tanvi Joshi",
        senderInitials="TJ",
        origin="Pune (Kothrud)",
        destination="Mumbai (Dadar)",
        date="Sun, 11 Oct",
        size="Document",
        dimensions="A4 envelope",
        description="Urgent signed company contracts",
        priceOffer=250.0,
        status="active"
    )
]

INITIAL_CONVERSATIONS = [
    ConversationSchema(
        id="conv_arjun",
        tripId="trip_101",
        tripRoute="Bengaluru → Hyderabad",
        partnerId="drv_arjun",
        partnerName="Arjun Rao",
        partnerInitials="AR",
        partnerRole="Driver",
        partnerRating=4.9,
        lastMessage="Perfect, I will be at the gate by 07:50 AM with hazards on.",
        lastMessageTime="10:42 AM",
        unreadCount=1,
        messages=[
            MessageSchema(
                id="m1",
                senderId="usr_saket",
                senderName="Saket Kumar",
                text="Hi Arjun! I booked Seat 1 on your Bengaluru to Hyderabad trip for Saturday.",
                timestamp="10:30 AM",
                isMe=True,
                status="read"
            ),
            MessageSchema(
                id="m2",
                senderId="drv_arjun",
                senderName="Arjun Rao",
                text="Welcome aboard Saket! We depart at 08:00 sharp from Koramangala Sony World signal.",
                timestamp="10:34 AM",
                isMe=False,
                status="read"
            ),
            MessageSchema(
                id="m3",
                senderId="usr_saket",
                senderName="Saket Kumar",
                text="Sounds great. I have one small backpack and a duffle bag. That fits in the boot right?",
                timestamp="10:38 AM",
                isMe=True,
                status="read"
            ),
            MessageSchema(
                id="m4",
                senderId="drv_arjun",
                senderName="Arjun Rao",
                text="Yes plenty of space. See you near the gate.",
                timestamp="10:40 AM",
                isMe=False,
                status="read"
            ),
            MessageSchema(
                id="m5",
                senderId="drv_arjun",
                senderName="Arjun Rao",
                text="Perfect, I will be at the gate by 07:50 AM with hazards on.",
                timestamp="10:42 AM",
                isMe=False,
                status="delivered"
            )
        ]
    ),
    ConversationSchema(
        id="conv_nisha",
        tripRoute="Bengaluru → Hyderabad (Luggage)",
        partnerId="usr_nisha",
        partnerName="Nisha Kulkarni",
        partnerInitials="NK",
        partnerRole="Traveler",
        partnerRating=4.9,
        lastMessage="Thank you! The package is wrapped and ready for pickup.",
        lastMessageTime="Yesterday",
        unreadCount=0,
        messages=[
            MessageSchema(
                id="nm1",
                senderId="usr_saket",
                senderName="Saket Kumar",
                text="Hello Nisha, I can carry your documents packet on my Sunday drive.",
                timestamp="Yesterday 3:15 PM",
                isMe=True,
                status="read"
            ),
            MessageSchema(
                id="nm2",
                senderId="usr_nisha",
                senderName="Nisha Kulkarni",
                text="Thank you! The package is wrapped and ready for pickup.",
                timestamp="Yesterday 3:45 PM",
                isMe=False,
                status="read"
            )
        ]
    )
]

INITIAL_NOTIFICATIONS = [
    NotificationItemSchema(
        id="notif_1",
        title="Booking Confirmed!",
        description="Your seat for Bengaluru → Hyderabad on Sat, 10 Oct is confirmed. ₹650 paid.",
        time="20m ago",
        read=False,
        type="booking",
        targetScreen="trip-details",
        targetId="trip_101"
    ),
    NotificationItemSchema(
        id="notif_2",
        title="New message from Arjun",
        description="“Perfect, I will be at the gate by 07:50 AM with hazards on.”",
        time="1h ago",
        read=False,
        type="chat",
        targetScreen="chat",
        targetId="conv_arjun"
    ),
    NotificationItemSchema(
        id="notif_3",
        title="Payout Available",
        description="₹2,450 from your recent Hyderabad ride has been credited to your balance.",
        time="Yesterday",
        read=True,
        type="payment",
        targetScreen="account-payments"
    ),
    NotificationItemSchema(
        id="notif_4",
        title="Student Verification Active",
        description="Your Algoma University student verification is valid until Dec 2026. 15% booking fee discount applied.",
        time="3 days ago",
        read=True,
        type="system",
        targetScreen="account-student"
    ),
    NotificationItemSchema(
        id="notif_5",
        title="Referral Bonus",
        description="Your friend Rahul joined TopRide using your code TOPRIDE50. You received ₹150 ride credits!",
        time="5 days ago",
        read=True,
        type="system",
        targetScreen="account-referrals"
    )
]

INITIAL_UNIVERSITIES = [
    UniversityOptionSchema(id="uni_algoma", name="Algoma University", domain="algomau.ca", city="Sault Ste. Marie / Brampton", verifiedCount=380),
    UniversityOptionSchema(id="uni_iisc", name="Indian Institute of Science (IISc)", domain="iisc.ac.in", city="Bengaluru", verifiedCount=920),
    UniversityOptionSchema(id="uni_iitb", name="IIT Bombay", domain="iitb.ac.in", city="Mumbai", verifiedCount=1450),
    UniversityOptionSchema(id="uni_iitd", name="IIT Delhi", domain="iitd.ac.in", city="New Delhi", verifiedCount=1280),
    UniversityOptionSchema(id="uni_bits", name="BITS Pilani (Hyderabad Campus)", domain="hyderabad.bits-pilani.ac.in", city="Hyderabad", verifiedCount=840),
    UniversityOptionSchema(id="uni_iiith", name="IIIT Hyderabad", domain="iiit.ac.in", city="Hyderabad", verifiedCount=610),
    UniversityOptionSchema(id="uni_pes", name="PES University", domain="pes.edu", city="Bengaluru", verifiedCount=1100),
]

# Database In-Memory Store
class InMemoryDatabase:
    def __init__(self):
        self.users: Dict[str, UserProfile] = {INITIAL_USER.id: INITIAL_USER}
        self.vehicles: List[VehicleSchema] = list(INITIAL_VEHICLES)
        self.trips: List[TripSchema] = list(INITIAL_TRIPS)
        self.requests: List[PassengerRequestSchema] = list(INITIAL_REQUESTS)
        self.luggage: List[LuggagePackageSchema] = list(INITIAL_LUGGAGE)
        self.conversations: List[ConversationSchema] = list(INITIAL_CONVERSATIONS)
        self.notifications: List[NotificationItemSchema] = list(INITIAL_NOTIFICATIONS)
        self.universities: List[UniversityOptionSchema] = list(INITIAL_UNIVERSITIES)
        self.bookings: List[Dict[str, Any]] = []
        self.support_tickets: List[Dict[str, Any]] = []
        self.payout_records: List[Dict[str, Any]] = []
        self.preferences: Dict[str, Dict[str, bool]] = {
            INITIAL_USER.id: {
                "chattiness": True,
                "airConditioning": True,
                "music": True,
                "pets": False,
                "smoking": False
            }
        }
        self.verification_status: Dict[str, str] = {INITIAL_USER.id: "verified"}

db = InMemoryDatabase()

def get_user_supabase_client(token: Optional[str] = None) -> Client:
    """Return a Supabase client configured with the user's bearer token for RLS."""
    if token:
        options = ClientOptions(headers={"Authorization": f"Bearer {token}"})
        return create_client(SUPABASE_URL, SUPABASE_KEY, options=options)
    return supabase_client

def profile_row_to_schema(row: Dict[str, Any]) -> UserProfile:
    """Convert snake_case public.profiles row to UserProfile schema."""
    name = row.get("name") or ""
    name_parts = name.strip().split()
    computed_initials = "".join([p[0].upper() for p in name_parts[:2]]) if name_parts else "TR"
    raw_initials = row.get("initials")
    initials = computed_initials if (not raw_initials or raw_initials == "DE" or raw_initials == "TR") else raw_initials

    return UserProfile(
        id=str(row["id"]),
        name=name,
        email=row.get("email") or "",
        phone=row.get("phone") or "",
        avatar=row.get("avatar") or "",
        initials=initials,
        rating=float(row.get("rating") or 5.0),
        tripsCount=int(row.get("trips_count") or 0),
        isVerified=bool(row.get("is_verified", False)),
        isStudentVerified=bool(row.get("is_student_verified", False)),
        studentUniversity=row.get("student_university") or "",
        bio=row.get("bio") or "",
        joinedDate=row.get("joined_date") or "March 2024",
        availablePayout=float(row.get("available_payout") or 0.0),
    )

def schema_to_profile_row(user: UserProfile) -> Dict[str, Any]:
    """Convert UserProfile schema to snake_case public.profiles row."""
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "avatar": user.avatar,
        "initials": user.initials,
        "rating": user.rating,
        "trips_count": user.tripsCount,
        "is_verified": user.isVerified,
        "is_student_verified": user.isStudentVerified,
        "student_university": user.studentUniversity,
        "bio": user.bio,
        "joined_date": user.joinedDate,
        "available_payout": user.availablePayout,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

def fetch_profile_from_db(user_id: str, client: Optional[Client] = None) -> Optional[UserProfile]:
    """Fetch user profile from public.profiles table in Supabase."""
    c = client or supabase_client
    try:
        res = c.table("profiles").select("*").eq("id", user_id).execute()
        if res.data and len(res.data) > 0:
            return profile_row_to_schema(res.data[0])
    except Exception as e:
        print(f"[Supabase] fetch_profile_from_db error for {user_id}: {e}")
    # Check cache / in-memory store
    return db.users.get(user_id)

def upsert_profile_in_db(profile: UserProfile, client: Optional[Client] = None) -> UserProfile:
    """Insert or update user profile in public.profiles table in Supabase."""
    c = client or supabase_client
    row = schema_to_profile_row(profile)
    try:
        res = c.table("profiles").upsert(row).execute()
        if res.data and len(res.data) > 0:
            saved = profile_row_to_schema(res.data[0])
            db.users[saved.id] = saved
            return saved
    except Exception as e:
        print(f"[Supabase] upsert_profile_in_db error for {profile.id}: {e}")
    # Always keep in-memory cache synchronized
    db.users[profile.id] = profile
    return profile

def fetch_conversations_from_db(user_id: str, client: Optional[Client] = None) -> List[ConversationSchema]:
    """Fetch all conversations for user_id from public.conversations and messages from public.messages."""
    c = client or supabase_client
    conversations: List[ConversationSchema] = []
    try:
        # Fetch conversations where user is participant1 or participant2
        res = (
            c.table("conversations")
            .select("*")
            .or_(f"participant1_id.eq.{user_id},participant2_id.eq.{user_id}")
            .order("last_message_time", desc=True)
            .execute()
        )
        conv_rows = res.data or []
        for conv in conv_rows:
            conv_id = str(conv["id"])
            p1 = str(conv["participant1_id"])
            p2 = str(conv["participant2_id"])
            partner_id = p2 if p1 == user_id else p1

            # Fetch partner's profile
            partner_profile = fetch_profile_from_db(partner_id, client=c)
            partner_name = partner_profile.name if partner_profile else "Member"
            partner_initials = partner_profile.initials if partner_profile else "TR"
            partner_rating = partner_profile.rating if partner_profile else 5.0
            partner_avatar = partner_profile.avatar if partner_profile else ""

            # Fetch messages belonging to this conversation
            msg_res = (
                c.table("messages")
                .select("*")
                .eq("conversation_id", conv_id)
                .order("created_at", desc=False)
                .execute()
            )
            msg_rows = msg_res.data or []
            messages_list: List[MessageSchema] = []
            unread_count = 0

            for m in msg_rows:
                s_id = str(m["sender_id"])
                is_me = (s_id == user_id)
                status = m.get("status") or "sent"
                if not is_me and status != "read":
                    unread_count += 1

                # Parse created_at into friendly timestamp
                created_iso = m.get("created_at") or ""
                try:
                    dt = datetime.datetime.fromisoformat(created_iso.replace("Z", "+00:00"))
                    time_str = dt.strftime("%I:%M %p")
                except Exception:
                    time_str = datetime.datetime.now().strftime("%I:%M %p")

                messages_list.append(
                    MessageSchema(
                        id=str(m["id"]),
                        senderId=s_id,
                        senderName=profile.name if (is_me and (profile := fetch_profile_from_db(s_id, client=c))) else partner_name,
                        text=m.get("text") or "",
                        timestamp=time_str,
                        isMe=is_me,
                        status=status,
                    )
                )

            # Route description and partner role dynamically determined
            trip_route = "Trip Chat"
            partner_role = "Passenger"
            if conv.get("trip_id"):
                try:
                    t_res = c.table("trips").select("origin, destination, driver_id").eq("id", conv["trip_id"]).execute()
                    if t_res.data:
                        t_data = t_res.data[0]
                        trip_route = f"{t_data.get('origin', '')} → {t_data.get('destination', '')}"
                        if str(t_data.get("driver_id")) == partner_id:
                            partner_role = "Driver"
                        else:
                            partner_role = "Passenger"
                except Exception:
                    pass
            else:
                # If no trip_id on conversation, check if partner is driver of any registered trip
                try:
                    d_res = c.table("trips").select("id").eq("driver_id", partner_id).limit(1).execute()
                    if d_res.data and len(d_res.data) > 0:
                        partner_role = "Driver"
                except Exception:
                    pass

            conversations.append(
                ConversationSchema(
                    id=conv_id,
                    tripRoute=trip_route,
                    partnerId=partner_id,
                    partnerName=partner_name,
                    partnerInitials=partner_initials,
                    partnerAvatar=partner_avatar,
                    partnerRole=partner_role,
                    partnerRating=partner_rating,
                    lastMessage=conv.get("last_message") or (messages_list[-1].text if messages_list else "Conversation started"),
                    lastMessageTime="Just now",
                    unreadCount=unread_count,
                    messages=messages_list,
                )
            )
        return conversations
    except Exception as e:
        print(f"[Supabase] fetch_conversations_from_db error for {user_id}: {e}")
        # Return empty list for authenticated user with no DB records instead of mock
        return []

def get_or_create_conversation_in_db(
    user_id: str, partner_id: str, trip_id: Optional[str] = None, client: Optional[Client] = None
) -> ConversationSchema:
    """Find existing conversation between user_id and partner_id or insert new one."""
    c = client or supabase_client
    # 1. Search for existing conversation between both participants
    try:
        res = (
            c.table("conversations")
            .select("*")
            .or_(f"and(participant1_id.eq.{user_id},participant2_id.eq.{partner_id}),and(participant1_id.eq.{partner_id},participant2_id.eq.{user_id})")
            .execute()
        )
        if res.data and len(res.data) > 0:
            conv_id = str(res.data[0]["id"])
            # Return full conversation with messages
            user_convs = fetch_conversations_from_db(user_id, client=c)
            for uc in user_convs:
                if uc.id == conv_id:
                    return uc
    except Exception as e:
        print(f"[Supabase] get_or_create_conversation lookup error: {e}")

    # 2. Insert new conversation
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    new_data = {
        "participant1_id": user_id,
        "participant2_id": partner_id,
        "last_message": "Conversation started",
        "last_message_time": now_iso,
        "created_at": now_iso,
    }
    if trip_id:
        new_data["trip_id"] = trip_id

    try:
        ins = c.table("conversations").insert(new_data).execute()
        new_conv_id = str(ins.data[0]["id"]) if ins.data else str(uuid.uuid4())
    except Exception as e:
        print(f"[Supabase] get_or_create_conversation insert error: {e}")
        new_conv_id = f"conv_{partner_id}"

    partner_profile = fetch_profile_from_db(partner_id, client=c)
    partner_name = partner_profile.name if partner_profile else "Driver"
    partner_initials = partner_profile.initials if partner_profile else "DR"

    # Dynamically determine role
    partner_role = "Passenger"
    if trip_id:
        try:
            t_res = c.table("trips").select("driver_id").eq("id", trip_id).execute()
            if t_res.data and str(t_res.data[0].get("driver_id")) == partner_id:
                partner_role = "Driver"
        except Exception:
            pass

    return ConversationSchema(
        id=new_conv_id,
        tripRoute="Trip Chat",
        partnerId=partner_id,
        partnerName=partner_name,
        partnerInitials=partner_initials,
        partnerAvatar=partner_profile.avatar if partner_profile else "",
        partnerRole=partner_role,
        partnerRating=partner_profile.rating if partner_profile else 5.0,
        lastMessage="Conversation started",
        lastMessageTime="Just now",
        unreadCount=0,
        messages=[],
    )

def insert_message_in_db(
    conv_id: str, sender_id: str, text: str, client: Optional[Client] = None
) -> MessageSchema:
    """Insert a real row into public.messages and update public.conversations."""
    c = client or supabase_client
    actual_conv_id = conv_id
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    now_time = datetime.datetime.now().strftime("%I:%M %p")

    # If conv_id is a placeholder (e.g. conv_<partnerId>), resolve to real conversation UUID
    if conv_id.startswith("conv_"):
        user_convs = fetch_conversations_from_db(sender_id, client=c)
        if user_convs:
            actual_conv_id = user_convs[0].id
        else:
            partner_id = conv_id.replace("conv_", "")
            # Try finding partner profile if partner_id is not a valid UUID
            try:
                uuid.UUID(partner_id)
            except ValueError:
                p_res = c.table("profiles").select("id").ilike("name", f"%{partner_id}%").limit(1).execute()
                if p_res.data:
                    partner_id = str(p_res.data[0]["id"])
            conv = get_or_create_conversation_in_db(sender_id, partner_id, client=c)
            actual_conv_id = conv.id

    msg_id = str(uuid.uuid4())
    msg_payload = {
        "id": msg_id,
        "conversation_id": actual_conv_id,
        "sender_id": sender_id,
        "text": text,
        "status": "sent",
        "created_at": now_iso,
    }

    try:
        ins_res = c.table("messages").insert(msg_payload).execute()
        if not ins_res.data or len(ins_res.data) == 0:
            raise HTTPException(
                status_code=500,
                detail="Database insert into public.messages returned no rows. Verify conversation and participant IDs."
            )
        msg_id = str(ins_res.data[0]["id"])
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Supabase] insert_message_in_db error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Database message insert failed: {str(e)}"
        )

    # Update conversation's last_message and last_message_time
    try:
        c.table("conversations").update({
            "last_message": text,
            "last_message_time": now_iso,
        }).eq("id", actual_conv_id).execute()
    except Exception as e:
        print(f"[Supabase] update conversation last_message error: {e}")

    sender_profile = fetch_profile_from_db(sender_id, client=c)
    sender_name = sender_profile.name if sender_profile else "Me"

    return MessageSchema(
        id=msg_id,
        senderId=sender_id,
        senderName=sender_name,
        text=text,
        timestamp=now_time,
        isMe=True,
        status="sent",
    )

def mark_conversation_read_in_db(
    conv_id: str, user_id: str, client: Optional[Client] = None
) -> bool:
    """Mark all unread messages sent by the other participant as read."""
    c = client or supabase_client
    try:
        c.table("messages").update({"status": "read"}).eq("conversation_id", conv_id).neq("sender_id", user_id).execute()
        return True
    except Exception as e:
        print(f"[Supabase] mark_conversation_read error: {e}")
        return False

# ================= 6. TRIPS & TRIP SEATS (DATABASE-BACKED) =================
def trip_row_to_schema(
    row: Dict[str, Any],
    user_id: Optional[str] = None,
    client: Optional[Client] = None
) -> TripSchema:
    c = client or supabase_client
    driver_id = str(row["driver_id"])
    driver_profile = fetch_profile_from_db(driver_id, client=c)
    driver_name = driver_profile.name if driver_profile else "Driver"
    driver_initials = driver_profile.initials if driver_profile else "TR"
    driver_rating = driver_profile.rating if driver_profile else 5.0
    driver_trips_count = driver_profile.tripsCount if driver_profile else 0
    driver_is_verified = driver_profile.isVerified if driver_profile else False

    # Vehicle enrichment
    veh_id = row.get("vehicle_id")
    veh_schema = VehicleSchema(
        id=str(veh_id) if veh_id else "",
        make="Personal Car",
        model="Ride Share",
        year=2024,
        color="Standard",
        plateNumber="Verified Vehicle"
    )
    if veh_id:
        try:
            v_res = c.table("vehicles").select("*").eq("id", veh_id).execute()
            if v_res.data and len(v_res.data) > 0:
                v_data = v_res.data[0]
                veh_schema = VehicleSchema(
                    id=str(v_data["id"]),
                    make=v_data.get("make") or "Vehicle",
                    model=v_data.get("model") or "",
                    year=int(v_data.get("year") or 2023),
                    color=v_data.get("color") or "White",
                    plateNumber=v_data.get("plate_number") or "",
                    isDefault=bool(v_data.get("is_default", False))
                )
        except Exception:
            pass

    # Dynamic roles
    is_driver = bool(user_id and driver_id == user_id)
    is_passenger = False
    if user_id and not is_driver:
        try:
            b_res = (
                c.table("bookings")
                .select("id")
                .eq("trip_id", row["id"])
                .eq("passenger_id", user_id)
                .eq("booking_status", "confirmed")
                .limit(1)
                .execute()
            )
            if b_res.data and len(b_res.data) > 0:
                is_passenger = True
        except Exception:
            pass

    total_seats = int(row.get("total_seats") or 3)
    available_seats = int(row.get("available_seats") if row.get("available_seats") is not None else total_seats)
    
    # Query real seat ledger from trip_seats if available
    try:
        s_res = c.table("trip_seats").select("id, status").eq("trip_id", row["id"]).execute()
        if s_res.data and len(s_res.data) > 0:
            available_seats = sum(1 for s in s_res.data if s.get("status") == "available")
    except Exception:
        pass

    return TripSchema(
        id=str(row["id"]),
        driverId=driver_id,
        driverName=driver_name,
        driverAvatar=driver_profile.avatar if driver_profile else "",
        driverInitials=driver_initials,
        driverRating=driver_rating,
        driverTripsCount=driver_trips_count,
        driverIsVerified=driver_is_verified,
        origin=row.get("origin") or "",
        originDetail=row.get("origin_detail") or "",
        destination=row.get("destination") or "",
        destinationDetail=row.get("destination_detail") or "",
        date=row.get("date") or "",
        departureTime=row.get("departure_time") or "",
        arrivalTime=row.get("arrival_time") or "",
        duration=row.get("duration") or "",
        totalSeats=total_seats,
        availableSeats=available_seats,
        pricePerSeat=float(row.get("current_market_price") if row.get("current_market_price") is not None else (row.get("price_per_seat") or 0.0)),
        currency=row.get("currency") or "₹",
        vehicle=veh_schema,
        luggageAllowed=row.get("luggage_allowed") or "Medium",
        luggageDetails=row.get("luggage_details") or "",
        instantBooking=bool(row.get("instant_booking", True)),
        tripRules=row.get("trip_rules") or [],
        stops=row.get("stops") or [],
        isDriverTrip=is_driver,
        isPassengerTrip=is_passenger,
        status=row.get("status") or "upcoming",
        originLatitude=float(row["origin_latitude"]) if row.get("origin_latitude") is not None else None,
        originLongitude=float(row["origin_longitude"]) if row.get("origin_longitude") is not None else None,
        originPlaceId=row.get("origin_place_id"),
        originAddress=row.get("origin_address"),
        destinationLatitude=float(row["destination_latitude"]) if row.get("destination_latitude") is not None else None,
        destinationLongitude=float(row["destination_longitude"]) if row.get("destination_longitude") is not None else None,
        destinationPlaceId=row.get("destination_place_id"),
        destinationAddress=row.get("destination_address"),
        routeGeometry=row.get("route_geometry"),
        basePrice=float(row["base_price"]) if row.get("base_price") is not None else None,
        currentMarketPrice=float(row["current_market_price"]) if row.get("current_market_price") is not None else float(row.get("price_per_seat") or 0.0),
        pricingMetadata=row.get("pricing_metadata") if isinstance(row.get("pricing_metadata"), dict) else None,
        priceUpdatedAt=str(row.get("price_updated_at")) if row.get("price_updated_at") is not None else None
    )

def insert_trip_in_db(
    driver_id: str,
    payload: TripCreate,
    client: Optional[Client] = None
) -> TripSchema:
    """Insert a real trip into public.trips and atomically generate public.trip_seats."""
    c = client or supabase_client
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 1. Resolve vehicle in public.vehicles
    real_vehicle_id: Optional[str] = None
    if payload.vehicleId and payload.vehicleId.strip():
        try:
            uuid.UUID(payload.vehicleId.strip())
            v_check = (
                c.table("vehicles")
                .select("id")
                .eq("id", payload.vehicleId.strip())
                .eq("user_id", driver_id)
                .execute()
            )
            if v_check.data and len(v_check.data) > 0:
                real_vehicle_id = str(v_check.data[0]["id"])
        except ValueError:
            pass

    if not real_vehicle_id and payload.vehicle and payload.vehicle.plateNumber and payload.vehicle.plateNumber.strip():
        try:
            v_check = (
                c.table("vehicles")
                .select("id")
                .eq("user_id", driver_id)
                .eq("plate_number", payload.vehicle.plateNumber.strip())
                .execute()
            )
            if v_check.data and len(v_check.data) > 0:
                real_vehicle_id = str(v_check.data[0]["id"])
            elif payload.vehicle.make and payload.vehicle.make not in ["Custom", "Standard"]:
                new_vid = str(uuid.uuid4())
                c.table("vehicles").insert({
                    "id": new_vid,
                    "user_id": driver_id,
                    "make": payload.vehicle.make,
                    "model": payload.vehicle.model,
                    "year": payload.vehicle.year,
                    "color": payload.vehicle.color,
                    "plate_number": payload.vehicle.plateNumber.strip(),
                    "is_default": payload.vehicle.isDefault or False
                }).execute()
                real_vehicle_id = new_vid
        except Exception as e:
            print(f"[Supabase] Vehicle linking notice: {e}")
            real_vehicle_id = None

    # 2. Authoritative Platform Market Price Calculation
    veh_cat = None
    if payload.vehicle and payload.vehicle.model:
        v_str = f"{payload.vehicle.make or ''} {payload.vehicle.model or ''}".lower()
        if any(w in v_str for w in ["innova", "xuv", "harrier", "safari", "creta", "seltos", "fortuner", "scorpio", "suv"]):
            veh_cat = "suv"
        elif any(w in v_str for w in ["audi", "bmw", "mercedes", "jaguar", "lexus"]):
            veh_cat = "luxury"
        elif any(w in v_str for w in ["swift", "i10", "i20", "wagonr", "tiago", "polo", "baleno", "altroz"]):
            veh_cat = "hatchback"
        else:
            veh_cat = "sedan"

    try:
        from backend.pricing.engine import DynamicPricingEngine
        from backend.pricing.models import PriceEstimateRequest
        p_req = PriceEstimateRequest(
            origin=payload.origin,
            destination=payload.destination,
            travelDate=payload.date,
            departureTime=payload.departureTime,
            originLat=payload.originLatitude,
            originLon=payload.originLongitude,
            destLat=payload.destinationLatitude,
            destLon=payload.destinationLongitude,
            totalSeats=payload.totalSeats,
            availableSeats=payload.totalSeats,
            vehicleCategory=veh_cat,
            durationStr=payload.duration,
            routeGeometry=payload.routeGeometry
        )
        p_breakdown = DynamicPricingEngine.calculate_price(p_req, client=c)
        calculated_final_price = p_breakdown.finalPrice
        calculated_base_price = p_breakdown.basePrice
        calculated_metadata = p_breakdown.model_dump()
    except Exception as pr_err:
        print(f"[Pricing] Calculation fallback notice: {pr_err}")
        try:
            from backend.pricing.base_price import BasePriceEngine
            calculated_base_price = BasePriceEngine.calculate_base_price(
                origin=payload.origin,
                destination=payload.destination,
                origin_lat=payload.originLatitude,
                origin_lon=payload.originLongitude,
                dest_lat=payload.destinationLatitude,
                dest_lon=payload.destinationLongitude,
                vehicle=veh_cat
            )
            calculated_final_price = calculated_base_price
        except Exception:
            calculated_final_price = 650.0
            calculated_base_price = 650.0
        calculated_metadata = {"fallback": True, "error": str(pr_err)}

    # 3. Attempt transactional RPC first
    trip_id: Optional[str] = None
    try:
        rpc_payload = {
            "driver_id": driver_id,
            "vehicle_id": real_vehicle_id,
            "origin": payload.origin,
            "origin_detail": payload.originDetail or "",
            "destination": payload.destination,
            "destination_detail": payload.destinationDetail or "",
            "date": payload.date,
            "departure_time": payload.departureTime,
            "arrival_time": payload.arrivalTime or "",
            "duration": payload.duration or "",
            "total_seats": payload.totalSeats,
            "price_per_seat": calculated_final_price,
            "currency": payload.currency or "₹",
            "luggage_allowed": payload.luggageAllowed or "Medium",
            "luggage_details": payload.luggageDetails or "",
            "instant_booking": payload.instantBooking if payload.instantBooking is not None else True,
            "trip_rules": payload.tripRules or [],
            "stops": payload.stops or []
        }
        try:
            rpc_res = c.rpc("create_trip_with_seats", {"payload": rpc_payload}).execute()
        except Exception:
            rpc_res = c.rpc("create_trip_with_seats", {
                "p_driver_id": driver_id,
                "p_vehicle_id": real_vehicle_id,
                "p_origin": payload.origin,
                "p_origin_detail": payload.originDetail or "",
                "p_destination": payload.destination,
                "p_destination_detail": payload.destinationDetail or "",
                "p_date": payload.date,
                "p_departure_time": payload.departureTime,
                "p_arrival_time": payload.arrivalTime or "",
                "p_duration": payload.duration or "",
                "p_total_seats": payload.totalSeats,
                "p_price_per_seat": calculated_final_price,
                "p_currency": payload.currency or "₹",
                "p_luggage_allowed": payload.luggageAllowed or "Medium",
                "p_luggage_details": payload.luggageDetails or "",
                "p_instant_booking": payload.instantBooking if payload.instantBooking is not None else True,
                "p_trip_rules": payload.tripRules or [],
                "p_stops": payload.stops or []
            }).execute()

        if rpc_res.data and isinstance(rpc_res.data, dict) and rpc_res.data.get("trip_id"):
            trip_id = str(rpc_res.data["trip_id"])
            coord_update = {
                "base_price": calculated_base_price,
                "current_market_price": calculated_final_price,
                "pricing_metadata": calculated_metadata,
                "price_updated_at": now_iso
            }
            if payload.originLatitude is not None:
                coord_update["origin_latitude"] = float(payload.originLatitude)
            if payload.originLongitude is not None:
                coord_update["origin_longitude"] = float(payload.originLongitude)
            if payload.originPlaceId:
                coord_update["origin_place_id"] = payload.originPlaceId
            if payload.originAddress:
                coord_update["origin_address"] = payload.originAddress
            if payload.destinationLatitude is not None:
                coord_update["destination_latitude"] = float(payload.destinationLatitude)
            if payload.destinationLongitude is not None:
                coord_update["destination_longitude"] = float(payload.destinationLongitude)
            if payload.destinationPlaceId:
                coord_update["destination_place_id"] = payload.destinationPlaceId
            if payload.destinationAddress:
                coord_update["destination_address"] = payload.destinationAddress
            if payload.routeGeometry:
                coord_update["route_geometry"] = payload.routeGeometry
            if coord_update:
                try:
                    c.table("trips").update(coord_update).eq("id", trip_id).execute()
                except Exception as up_err:
                    print(f"[Supabase] Updating pricing/coordinates after RPC notice: {up_err}")
    except Exception as rpc_err:
        print(f"[Supabase] create_trip_with_seats RPC notice: {rpc_err}")
        trip_id = None

    # 4. Direct insert fallback with atomic rollback guarantee
    if not trip_id:
        trip_id = str(uuid.uuid4())
        trip_payload = {
            "id": trip_id,
            "driver_id": driver_id,
            "origin": payload.origin,
            "origin_detail": payload.originDetail or "",
            "destination": payload.destination,
            "destination_detail": payload.destinationDetail or "",
            "date": payload.date,
            "departure_time": payload.departureTime,
            "arrival_time": payload.arrivalTime or "",
            "duration": payload.duration or "",
            "total_seats": payload.totalSeats,
            "available_seats": payload.totalSeats,
            "price_per_seat": calculated_final_price,
            "base_price": calculated_base_price,
            "current_market_price": calculated_final_price,
            "pricing_metadata": calculated_metadata,
            "price_updated_at": now_iso,
            "currency": payload.currency or "₹",
            "luggage_allowed": payload.luggageAllowed or "Medium",
            "luggage_details": payload.luggageDetails or "",
            "instant_booking": payload.instantBooking if payload.instantBooking is not None else True,
            "trip_rules": payload.tripRules or [],
            "stops": payload.stops or [],
            "status": "upcoming",
            "created_at": now_iso,
            "updated_at": now_iso
        }
        if real_vehicle_id:
            trip_payload["vehicle_id"] = real_vehicle_id

        if payload.originLatitude is not None:
            trip_payload["origin_latitude"] = float(payload.originLatitude)
        if payload.originLongitude is not None:
            trip_payload["origin_longitude"] = float(payload.originLongitude)
        if payload.originPlaceId:
            trip_payload["origin_place_id"] = payload.originPlaceId
        if payload.originAddress:
            trip_payload["origin_address"] = payload.originAddress
        if payload.destinationLatitude is not None:
            trip_payload["destination_latitude"] = float(payload.destinationLatitude)
        if payload.destinationLongitude is not None:
            trip_payload["destination_longitude"] = float(payload.destinationLongitude)
        if payload.destinationPlaceId:
            trip_payload["destination_place_id"] = payload.destinationPlaceId
        if payload.destinationAddress:
            trip_payload["destination_address"] = payload.destinationAddress
        if payload.routeGeometry:
            trip_payload["route_geometry"] = payload.routeGeometry

        try:
            t_res = c.table("trips").insert(trip_payload).execute()
            if not t_res.data or len(t_res.data) == 0:
                raise HTTPException(status_code=500, detail="Database insert into public.trips returned no data.")
        except HTTPException:
            raise
        except Exception as e:
            err_str = str(e).lower()
            if "column" in err_str or "does not exist" in err_str or "origin_latitude" in err_str:
                print(f"[Supabase Notice] Coordinate/pricing columns pending migration in Supabase SQL editor: {e}")
                for k in ["origin_latitude", "origin_longitude", "origin_place_id", "origin_address",
                          "destination_latitude", "destination_longitude", "destination_place_id", "destination_address", "route_geometry",
                          "base_price", "current_market_price", "pricing_metadata", "price_updated_at"]:
                    trip_payload.pop(k, None)
                t_res = c.table("trips").insert(trip_payload).execute()
            else:
                print(f"[Supabase] insert_trip_in_db error: {e}")
                raise HTTPException(status_code=500, detail=f"Database trip insert failed: {str(e)}")

        # Check if database trigger generated seats; if not, insert them
        try:
            existing_seats = c.table("trip_seats").select("id").eq("trip_id", trip_id).execute().data
            if not existing_seats or len(existing_seats) == 0:
                seats_payload = [
                    {
                        "id": str(uuid.uuid4()),
                        "trip_id": trip_id,
                        "seat_number": s,
                        "status": "available"
                    }
                    for s in range(1, payload.totalSeats + 1)
                ]
                c.table("trip_seats").insert(seats_payload).execute()
        except Exception as e:
            # Atomic rollback: delete trip record if seat generation fails
            print(f"[Supabase] Seat creation failed, rolling back trip {trip_id}: {e}")
            try:
                c.table("trips").delete().eq("id", trip_id).execute()
            except Exception:
                pass
            raise HTTPException(status_code=500, detail=f"Atomic seat creation failed. Trip rolled back: {str(e)}")

    # 4. Increment driver trips count in profile
    try:
        prof = fetch_profile_from_db(driver_id, client=c)
        if prof:
            prof.tripsCount += 1
            upsert_profile_in_db(prof, client=c)
    except Exception:
        pass

    # 5. Trigger event-driven recalculation for affected market
    try:
        from backend.pricing.service import PricingService
        PricingService.handle_trip_event(trip_id, client=c)
    except Exception as pr_evt_err:
        print(f"[Pricing] Post-trip recalculation notice: {pr_evt_err}")

    fresh_row = c.table("trips").select("*").eq("id", trip_id).execute()
    if not fresh_row.data:
        raise HTTPException(status_code=500, detail="Failed to load created trip.")
    return trip_row_to_schema(fresh_row.data[0], user_id=driver_id, client=c)

def location_matches(query_loc: Optional[str], trip_name: str, trip_detail: str, trip_address: Optional[str]) -> bool:
    """Robust matcher supporting exact, substring, and tokenized/compound place names."""
    if not query_loc or not query_loc.strip():
        return True
    q = query_loc.strip().lower()
    t_name = (trip_name or "").strip().lower()
    t_detail = (trip_detail or "").strip().lower()
    t_addr = (trip_address or "").strip().lower()

    if q in t_name or t_name in q:
        return True
    if t_detail and (q in t_detail or t_detail in q):
        return True
    if t_addr and (q in t_addr or t_addr in q):
        return True

    # Check key words / place name tokens (e.g. 'koramangala', 'bengaluru', 'hyderabad')
    q_tokens = [tok.strip() for tok in q.replace(',', ' ').split() if len(tok.strip()) >= 3]
    for tok in q_tokens:
        if tok in t_name or (t_detail and tok in t_detail) or (t_addr and tok in t_addr):
            return True

    return False

def fetch_trips_from_db(
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    date: Optional[str] = None,
    only_verified: bool = False,
    only_instant: bool = False,
    max_price: Optional[float] = None,
    time_filter: Optional[str] = "all",
    sort_by: Optional[str] = "cheapest",
    user_id: Optional[str] = None,
    client: Optional[Client] = None
) -> List[TripSchema]:
    """Query public.trips from Supabase with search filters and profile/vehicle joins."""
    c = client or supabase_client
    try:
        query = c.table("trips").select("*").neq("status", "cancelled")
        if only_instant:
            query = query.eq("instant_booking", True)
        if max_price is not None:
            query = query.lte("price_per_seat", max_price)

        query = query.order("created_at", desc=True)
        res = query.execute()
        rows = res.data or []

        trips = [trip_row_to_schema(r, user_id=user_id, client=c) for r in rows]

        # In-memory filtering: location matches, verified driver, time window, sorting
        filtered = []
        for t in trips:
            if origin and not location_matches(origin, t.origin, t.originDetail or "", t.originAddress):
                continue
            if destination and not location_matches(destination, t.destination, t.destinationDetail or "", t.destinationAddress):
                continue
            if date and date.strip():
                req_iso = to_canonical_iso_date(date)
                trip_iso = to_canonical_iso_date(t.date)
                if req_iso and trip_iso:
                    if req_iso != trip_iso:
                        continue
                else:
                    clean_req = date.strip().lower().replace(" ", "").replace(",", "")
                    clean_trip = (t.date or "").strip().lower().replace(" ", "").replace(",", "")
                    if clean_req and clean_trip and clean_req != clean_trip and clean_req not in clean_trip and clean_trip not in clean_req:
                        continue
            if only_verified and not t.driverIsVerified:
                continue
            if time_filter and time_filter != "all":
                try:
                    hour = int(t.departureTime.split(":")[0])
                    if time_filter == "morning" and (hour < 6 or hour >= 12):
                        continue
                    if time_filter == "afternoon" and (hour < 12 or hour >= 17):
                        continue
                    if time_filter == "evening" and hour < 17:
                        continue
                except Exception:
                    pass
            filtered.append(t)

        if sort_by == "cheapest":
            filtered.sort(key=lambda x: x.pricePerSeat)
        elif sort_by == "earliest":
            filtered.sort(key=lambda x: x.departureTime)
        elif sort_by == "rating":
            filtered.sort(key=lambda x: x.driverRating, reverse=True)

        return filtered
    except Exception as e:
        print(f"[Supabase] fetch_trips_from_db error: {e}")
        return []

def fetch_trip_by_id_from_db(
    trip_id: str,
    user_id: Optional[str] = None,
    client: Optional[Client] = None
) -> Optional[TripSchema]:
    """Fetch single trip by ID from public.trips with joined driver and vehicle."""
    c = client or supabase_client
    try:
        res = c.table("trips").select("*").eq("id", trip_id).execute()
        if res.data and len(res.data) > 0:
            return trip_row_to_schema(res.data[0], user_id=user_id, client=c)
    except Exception as e:
        print(f"[Supabase] fetch_trip_by_id_from_db error for {trip_id}: {e}")
    return None

def cancel_trip_in_db(
    trip_id: str,
    driver_id: str,
    reason: str = "Trip cancelled by driver",
    client: Optional[Client] = None
) -> bool:
    """Cancel a trip in public.trips if authenticated user is the driver, updating bookings and notifying passengers."""
    c = client or supabase_client
    try:
        t_res = c.table("trips").select("id, driver_id, origin, destination, date").eq("id", trip_id).execute()
        if not t_res.data or len(t_res.data) == 0:
            raise HTTPException(status_code=404, detail="Trip not found.")
        trip_row = t_res.data[0]
        if str(trip_row["driver_id"]) != driver_id:
            raise HTTPException(status_code=403, detail="Unauthorized: Only the driver who created this trip can cancel it.")

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        c.table("trips").update({
            "status": "cancelled",
            "available_seats": 0,
            "updated_at": now_iso
        }).eq("id", trip_id).execute()

        try:
            c.table("trip_seats").update({"status": "cancelled"}).eq("trip_id", trip_id).eq("status", "available").execute()
        except Exception:
            pass

        # Update all active bookings on this trip to cancelled and notify passengers
        try:
            b_res = supabase_client.table("bookings").select("id, passenger_id, seats_count").eq("trip_id", trip_id).neq("booking_status", "cancelled").execute()
            if b_res.data:
                for b_row in b_res.data:
                    supabase_client.table("bookings").update({
                        "booking_status": "cancelled",
                        "updated_at": now_iso
                    }).eq("id", b_row["id"]).execute()

                    pass_id = str(b_row["passenger_id"])
                    notif_id = str(uuid.uuid4())
                    notif_obj = NotificationItemSchema(
                        id=notif_id,
                        userId=pass_id,
                        title="Trip Cancelled by Driver",
                        description=f"The driver cancelled this ride ({trip_row.get('origin', '')} → {trip_row.get('destination', '')} on {trip_row.get('date', 'scheduled date')}). Reason: {reason}. Full refund initiated.",
                        time=now_iso,
                        read=False,
                        type="trip",
                        targetScreen="trips",
                        targetId=trip_id
                    )
                    db.notifications.insert(0, notif_obj)
                    try:
                        supabase_client.table("notifications").insert({
                            "id": notif_id,
                            "user_id": pass_id,
                            "title": notif_obj.title,
                            "description": notif_obj.description,
                            "read": False,
                            "type": "trip",
                            "target_screen": "trips",
                            "target_id": trip_id,
                            "created_at": now_iso
                        }).execute()
                    except Exception:
                        pass
        except Exception as notify_err:
            print(f"[Supabase] cancel_trip notify error: {notify_err}")

        try:
            from backend.pricing.service import PricingService
            PricingService.handle_trip_event(trip_id, client=c)
        except Exception as pr_evt_err:
            print(f"[Pricing] Post-cancel recalculation notice: {pr_evt_err}")

        return True
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Supabase] cancel_trip_in_db error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel trip: {str(e)}")

# ============================================================
# PHASE 2B / 3B: BOOKINGS & RAZORPAY TEST ORDER CREATION
# ============================================================

def create_razorpay_order_in_db(
    user_id: str,
    req: PaymentOrderCreate,
    client: Optional[Client] = None
) -> PaymentOrderResponse:
    """Validate trip, seats, calculate authoritative price, and create Razorpay TEST order."""
    c = client or supabase_client

    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Razorpay test credentials are not configured on the backend."
        )

    if req.seatsCount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Please select a valid seat count (minimum 1 seat)."
        )

    # 1. Fetch trip from database
    trip = fetch_trip_by_id_from_db(req.tripId, user_id=user_id, client=c)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found.")

    # 2. Check trip status
    if trip.status != "upcoming":
        raise HTTPException(status_code=400, detail="Trip is no longer open for booking.")

    # 3. Check driver self-booking
    if trip.driverId == user_id:
        raise HTTPException(status_code=400, detail="Drivers cannot book their own trip.")

    # 4. Check seat availability
    if trip.availableSeats < req.seatsCount:
        raise HTTPException(
            status_code=409,
            detail="These seats are no longer available."
        )

    # 5. Authoritative price calculation server-side
    # IMMUTABILITY RULE: current_market_price -> booking.price_at_booking -> Razorpay order amount
    # Once price_at_booking exists, Razorpay MUST use price_at_booking, never a newly recalculated current_market_price.
    effective_unit_price = float(trip.currentMarketPrice if trip.currentMarketPrice is not None else trip.pricePerSeat)
    booking_price_frozen = None

    if getattr(req, "bookingId", None):
        try:
            b_res = c.table("bookings").select("price_at_booking, total_paid").eq("id", req.bookingId).execute()
            if b_res.data and len(b_res.data) > 0:
                p_book = b_res.data[0].get("price_at_booking")
                if p_book is not None and float(p_book) > 0:
                    booking_price_frozen = float(p_book)
        except Exception:
            pass

    if booking_price_frozen is None:
        try:
            b_res = c.table("bookings").select("price_at_booking, total_paid").eq("trip_id", req.tripId).eq("passenger_id", user_id).in_("status", ["pending", "confirmed"]).order("created_at", desc=True).limit(1).execute()
            if b_res.data and len(b_res.data) > 0:
                p_book = b_res.data[0].get("price_at_booking")
                if p_book is not None and float(p_book) > 0:
                    booking_price_frozen = float(p_book)
        except Exception:
            pass

    if booking_price_frozen is not None:
        effective_unit_price = booking_price_frozen

    luggage_fee = 100.0 if req.luggageTier == "medium" else (200.0 if req.luggageTier == "heavy" else 0.0)
    total_rupees = round(effective_unit_price * req.seatsCount + luggage_fee, 2)
    amount_paise = int(round(total_rupees * 100))

    if amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Invalid order amount calculated.")

    # 6. Deduplication check: Check memory cache and database for existing active 'created' order
    cache_key = f"{user_id}:{req.tripId}:{req.seatsCount}:{req.luggageTier or 'small'}:{effective_unit_price}"
    if cache_key in _recent_razorpay_orders:
        cached_time, cached_order = _recent_razorpay_orders[cache_key]
        now = datetime.datetime.now(datetime.timezone.utc)
        if (now - cached_time).total_seconds() < 1200:  # 20 minutes
            return cached_order

    try:
        existing_orders = c.table("payment_orders").select("*").eq("user_id", user_id).eq("trip_id", req.tripId).eq("seats_count", req.seatsCount).eq("status", "created").order("created_at", desc=True).limit(1).execute()
        if existing_orders.data and len(existing_orders.data) > 0:
            existing = existing_orders.data[0]
            created_at_str = existing.get("created_at")
            if created_at_str:
                try:
                    dt = datetime.datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    now = datetime.datetime.now(datetime.timezone.utc)
                    if (now - dt).total_seconds() < 1200:  # 20 minutes
                        cached_order = PaymentOrderResponse(
                            orderId=existing["razorpay_order_id"],
                            amount=int(existing["amount_paise"]),
                            amountRupees=float(existing["amount"]),
                            currency=existing.get("currency", "INR"),
                            keyId=RAZORPAY_KEY_ID,
                            tripId=req.tripId,
                            seatsCount=req.seatsCount,
                            receipt=existing.get("receipt", "")
                        )
                        _recent_razorpay_orders[cache_key] = (dt, cached_order)
                        return cached_order
                except Exception:
                    pass
    except Exception:
        # Table might not exist yet before migration is applied
        pass

    # 7. Create Razorpay TEST order via Razorpay client
    receipt = f"rcpt_{uuid.uuid4().hex[:10]}"
    try:
        rzp_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        rzp_order = rzp_client.order.create(data={
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "notes": {
                "trip_id": req.tripId,
                "user_id": user_id,
                "seats_count": str(req.seatsCount),
                "luggage_tier": req.luggageTier or "small",
                "route": f"{trip.origin} to {trip.destination}",
                "mode": "test"
            }
        })
    except Exception as e:
        err_msg = str(e)
        print(f"[Razorpay] Order creation error: {err_msg}")
        raise HTTPException(
            status_code=502,
            detail="Failed to initialize Razorpay checkout. Please verify connection and try again."
        )

    order_resp = PaymentOrderResponse(
        orderId=rzp_order["id"],
        amount=amount_paise,
        amountRupees=total_rupees,
        currency="INR",
        keyId=RAZORPAY_KEY_ID,
        tripId=req.tripId,
        seatsCount=req.seatsCount,
        receipt=receipt
    )

    # Save to memory cache for instant deduplication
    _recent_razorpay_orders[cache_key] = (datetime.datetime.now(datetime.timezone.utc), order_resp)

    # 8. Persist order in payment_orders table if available
    try:
        c.table("payment_orders").insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "trip_id": req.tripId,
            "razorpay_order_id": rzp_order["id"],
            "amount": total_rupees,
            "amount_paise": amount_paise,
            "currency": "INR",
            "seats_count": req.seatsCount,
            "luggage_tier": req.luggageTier or "small",
            "receipt": receipt,
            "status": "created",
            "metadata": {
                "notes": rzp_order.get("notes", {}),
                "origin": trip.origin,
                "destination": trip.destination
            }
        }).execute()
    except Exception as e:
        print(f"[Supabase] payment_orders insert notice (table pending migration): {e}")

    return order_resp

def update_payment_status_in_db(
    user_id: str,
    req: PaymentStatusUpdate,
    client: Optional[Client] = None
) -> dict:
    """Update status of a payment order (e.g. failed or cancelled) in public.payment_orders."""
    c = client or supabase_client

    # Invalidate / remove from in-memory cache if cancelled or failed
    keys_to_remove = [k for k, v in _recent_razorpay_orders.items() if v[1].orderId == req.orderId]
    for k in keys_to_remove:
        _recent_razorpay_orders.pop(k, None)

    try:
        update_data = {
            "status": req.status,
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        if req.paymentId:
            update_data["razorpay_payment_id"] = req.paymentId
        c.table("payment_orders").update(update_data).eq("razorpay_order_id", req.orderId).eq("user_id", user_id).execute()
        return {"success": True}
    except Exception as e:
        print(f"[Supabase] update_payment_status_in_db notice: {e}")
        return {"success": False}

def verify_razorpay_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Authoritatively verify Razorpay HMAC SHA256 payment signature using server secret."""
    if not RAZORPAY_KEY_SECRET or not order_id or not payment_id or not signature:
        return False
    data_to_sign = f"{order_id}|{payment_id}".encode("utf-8")
    expected_sig = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        data_to_sign,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected_sig, signature)

def verify_payment_and_book_in_db(
    user_id: str,
    req: PaymentVerifyRequest,
    client: Optional[Client] = None
) -> PaymentVerifyResponse:
    """Authoritatively verify Razorpay signature on backend and finalize booking atomically."""
    c = client or supabase_client

    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Razorpay test credentials are not configured on the backend."
        )

    # 1. Authoritative Signature Verification
    if not verify_razorpay_payment_signature(req.razorpayOrderId, req.razorpayPaymentId, req.razorpaySignature):
        # Update payment order status to failed
        try:
            c.table("payment_orders").update({
                "status": "failed",
                "razorpay_payment_id": req.razorpayPaymentId,
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "metadata": {"failure_reason": "Signature verification failed"}
            }).eq("razorpay_order_id", req.razorpayOrderId).execute()
        except Exception as up_err:
            print(f"[Supabase] payment_orders fail update error: {up_err}")

        raise HTTPException(
            status_code=400,
            detail="Payment verification failed. Please try again."
        )

    # 2. Duplicate Payment / Idempotency & User Ownership Check
    po_admin = supabase_client.table("payment_orders").select("*").eq("razorpay_order_id", req.razorpayOrderId).execute()
    if not po_admin.data or len(po_admin.data) == 0:
        raise HTTPException(status_code=404, detail="Payment order not found.")

    po = po_admin.data[0]
    if str(po.get("user_id")) != user_id:
        raise HTTPException(
            status_code=403,
            detail="Payment order does not belong to the authenticated user."
        )

    # If already paid and has booking, return existing booking (Idempotency)
    if po.get("status") == "paid" and po.get("booking_id"):
        trip_schema = fetch_trip_by_id_from_db(req.tripId, user_id=user_id, client=c)
        existing_booking = BookingResponse(
            id=str(po["booking_id"]),
            bookingRef=f"TR-{str(po['booking_id'])[:5].upper()}",
            trip=trip_schema,
            seatsCount=int(po.get("seats_count", req.seatsCount)),
            totalPaid=float(po.get("amount", 0.0)),
            status="confirmed",
            razorpayOrderId=req.razorpayOrderId,
            razorpayPaymentId=req.razorpayPaymentId
        )
        return PaymentVerifyResponse(
            verified=True,
            booking=existing_booking,
            orderId=req.razorpayOrderId,
            paymentId=req.razorpayPaymentId,
            status="paid"
        )

    # Check bookings table directly for existing booking with this razorpay_order_id
    try:
        b_res = c.table("bookings").select("*").eq("razorpay_order_id", req.razorpayOrderId).execute()
        if b_res.data and len(b_res.data) > 0:
            b_row = b_res.data[0]
            trip_schema = fetch_trip_by_id_from_db(str(b_row["trip_id"]), user_id=user_id, client=c)
            return PaymentVerifyResponse(
                verified=True,
                booking=BookingResponse(
                    id=str(b_row["id"]),
                    bookingRef=b_row.get("booking_ref", ""),
                    trip=trip_schema,
                    seatsCount=int(b_row.get("seats_count", req.seatsCount)),
                    totalPaid=float(b_row.get("total_paid", 0.0)),
                    status="confirmed",
                    razorpayOrderId=req.razorpayOrderId,
                    razorpayPaymentId=req.razorpayPaymentId
                ),
                orderId=req.razorpayOrderId,
                paymentId=req.razorpayPaymentId,
                status="paid"
            )
    except Exception:
        pass

    # 3. Finalize Booking Atomically via existing book_trip_seats RPC
    booking_payload = BookingCreate(
        tripId=req.tripId,
        seatsCount=req.seatsCount,
        luggageTier=req.luggageTier or "small",
        passengerNotes=req.passengerNotes or "",
        totalAmount=0.0,
        razorpayOrderId=req.razorpayOrderId,
        razorpayPaymentId=req.razorpayPaymentId,
        razorpaySignature=req.razorpaySignature
    )

    booking_resp = create_booking_in_db(passenger_id=user_id, payload=booking_payload, client=c)

    # 4. Invalidate in-memory order cache
    keys_to_remove = [k for k, v in _recent_razorpay_orders.items() if v[1].orderId == req.razorpayOrderId]
    for k in keys_to_remove:
        _recent_razorpay_orders.pop(k, None)

    return PaymentVerifyResponse(
        verified=True,
        booking=booking_resp,
        orderId=req.razorpayOrderId,
        paymentId=req.razorpayPaymentId,
        status="paid"
    )

def process_razorpay_webhook_event(
    raw_body: bytes,
    signature: Optional[str]
) -> Dict[str, Any]:
    """Verify Razorpay webhook signature and process events with strict idempotency."""
    webhook_secret = RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret:
        raise HTTPException(
            status_code=500,
            detail="Razorpay webhook secret is not configured on the backend."
        )

    if not signature:
        raise HTTPException(
            status_code=400,
            detail="Missing X-Razorpay-Signature header."
        )

    # 1. HMAC SHA256 Webhook Signature Verification
    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(
            status_code=400,
            detail="Invalid Razorpay webhook signature."
        )

    # 2. Parse Event safely
    try:
        event = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload in webhook.")

    event_name = event.get("event")
    payload = event.get("payload", {})
    payment_entity = payload.get("payment", {}).get("entity", {})
    order_entity = payload.get("order", {}).get("entity", {})

    order_id = payment_entity.get("order_id") or order_entity.get("id")
    payment_id = payment_entity.get("id")

    if not order_id:
        return {"status": "ignored", "message": "No order_id associated with event"}

    c = supabase_client

    # 3. Payment failed event
    if event_name == "payment.failed":
        try:
            c.table("payment_orders").update({
                "status": "failed",
                "razorpay_payment_id": payment_id,
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "metadata": {
                    "event": event_name,
                    "error_description": payment_entity.get("error_description", "Payment failed")
                }
            }).eq("razorpay_order_id", order_id).execute()
        except Exception as e:
            print(f"[Webhook] Failed to update payment_order on failure: {e}")
        return {"status": "success", "message": "Recorded failed payment", "order_id": order_id}

    # 4. Successful payment events: payment.captured, order.paid
    if event_name in ["payment.captured", "order.paid"]:
        # Invalidate in-memory cache
        keys_to_remove = [k for k, v in _recent_razorpay_orders.items() if v[1].orderId == order_id]
        for k in keys_to_remove:
            _recent_razorpay_orders.pop(k, None)

        # Lookup payment order
        po_res = c.table("payment_orders").select("*").eq("razorpay_order_id", order_id).execute()
        if not po_res.data or len(po_res.data) == 0:
            return {"status": "ignored", "message": f"Order {order_id} not found in database"}

        po = po_res.data[0]

        # Idempotency: If already marked paid and has booking, do not duplicate
        if po.get("status") == "paid" and po.get("booking_id"):
            return {
                "status": "already_processed",
                "message": "Payment order already processed and linked to booking",
                "order_id": order_id,
                "booking_id": po.get("booking_id")
            }

        # Check if booking exists in bookings table
        existing_b = c.table("bookings").select("*").eq("razorpay_order_id", order_id).execute()
        if existing_b.data and len(existing_b.data) > 0:
            b_id = existing_b.data[0]["id"]
            c.table("payment_orders").update({
                "status": "paid",
                "booking_id": b_id,
                "razorpay_payment_id": payment_id,
                "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }).eq("razorpay_order_id", order_id).execute()
            return {
                "status": "already_processed",
                "message": "Linked existing booking",
                "order_id": order_id,
                "booking_id": b_id
            }

        # Safety-net booking: if user's browser was closed before callback reached FastAPI
        user_id = str(po["user_id"])
        trip_id = str(po["trip_id"])
        seats_count = int(po["seats_count"])
        luggage_tier = po.get("luggage_tier") or "small"
        authoritative_total = float(po["amount"])
        booking_ref = f"TR-{uuid.uuid4().hex[:5].upper()}"

        try:
            rpc_res = c.rpc("book_trip_seats", {
                "p_trip_id": trip_id,
                "p_passenger_id": user_id,
                "p_seats_count": seats_count,
                "p_luggage_tier": luggage_tier,
                "p_notes": "Booked via Razorpay Webhook",
                "p_total_paid": authoritative_total,
                "p_booking_ref": booking_ref
            }).execute()

            if rpc_res.data and rpc_res.data.get("success"):
                b_id = str(rpc_res.data["booking_id"])
                c.table("payment_orders").update({
                    "status": "paid",
                    "booking_id": b_id,
                    "razorpay_payment_id": payment_id,
                    "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }).eq("razorpay_order_id", order_id).execute()

                c.table("bookings").update({
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": payment_id
                }).eq("id", b_id).execute()

                return {
                    "status": "success",
                    "message": "Booking finalized atomically via webhook",
                    "order_id": order_id,
                    "booking_id": b_id
                }
            else:
                return {
                    "status": "failed",
                    "message": "Atomic booking RPC returned unsuccessful",
                    "order_id": order_id
                }
        except Exception as book_err:
            print(f"[Webhook] book_trip_seats error: {book_err}")
            return {
                "status": "error",
                "message": f"Webhook booking failed: {str(book_err)}",
                "order_id": order_id
            }

    return {"status": "received", "event": event_name, "order_id": order_id}

def create_booking_in_db(
    passenger_id: str,
    payload: BookingCreate,
    client: Optional[Client] = None
) -> BookingResponse:
    """Create a booking using atomic book_trip_seats RPC function with authoritative price."""
    c = client or supabase_client

    # Duplicate payment & idempotency check:
    if payload.razorpayOrderId:
        # If signature is supplied with direct booking request, verify it authoritatively
        if payload.razorpaySignature:
            if not verify_razorpay_payment_signature(
                payload.razorpayOrderId,
                payload.razorpayPaymentId or "",
                payload.razorpaySignature
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Payment verification failed. Please try again."
                )

        try:
            existing_booking = c.table("bookings").select("*").eq("razorpay_order_id", payload.razorpayOrderId).execute()
            if existing_booking.data and len(existing_booking.data) > 0:
                b_row = existing_booking.data[0]
                trip_s = fetch_trip_by_id_from_db(str(b_row["trip_id"]), user_id=passenger_id, client=c)
                return BookingResponse(
                    id=str(b_row["id"]),
                    bookingRef=b_row.get("booking_ref") or f"TR-{str(b_row['id'])[:5].upper()}",
                    trip=trip_s,
                    seatsCount=int(b_row.get("seats_count") or payload.seatsCount),
                    totalPaid=float(b_row.get("total_paid") or 0.0),
                    priceAtBooking=float(b_row.get("price_at_booking")) if b_row.get("price_at_booking") is not None else float(trip_s.pricePerSeat if trip_s else 0.0),
                    status="confirmed",
                    razorpayOrderId=payload.razorpayOrderId,
                    razorpayPaymentId=payload.razorpayPaymentId
                )
        except Exception:
            pass

    booking_ref = f"TR-{uuid.uuid4().hex[:5].upper()}"

    # Determine authoritative total price from database
    trip_for_price = fetch_trip_by_id_from_db(payload.tripId, user_id=passenger_id, client=c)
    if not trip_for_price:
        raise HTTPException(status_code=404, detail="Trip not found.")
    luggage_fee = 100.0 if payload.luggageTier == "medium" else (200.0 if payload.luggageTier == "heavy" else 0.0)
    unit_price = float(trip_for_price.currentMarketPrice if trip_for_price.currentMarketPrice is not None else trip_for_price.pricePerSeat)
    authoritative_total = round(unit_price * payload.seatsCount + luggage_fee, 2)

    try:
        rpc_res = c.rpc("book_trip_seats", {
            "p_trip_id": payload.tripId,
            "p_passenger_id": passenger_id,
            "p_seats_count": payload.seatsCount,
            "p_luggage_tier": payload.luggageTier or "small",
            "p_notes": payload.passengerNotes or "",
            "p_total_paid": authoritative_total,
            "p_booking_ref": booking_ref
        }).execute()

        if not rpc_res.data or not rpc_res.data.get("success"):
            raise HTTPException(status_code=400, detail="Booking transaction failed.")

        booking_id = str(rpc_res.data["booking_id"])

        # Link payment_orders record if razorpayOrderId provided
        if payload.razorpayOrderId:
            try:
                update_order_data = {
                    "booking_id": booking_id,
                    "status": "paid",
                    "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                if payload.razorpayPaymentId:
                    update_order_data["razorpay_payment_id"] = payload.razorpayPaymentId
                c.table("payment_orders").update(update_order_data).eq("razorpay_order_id", payload.razorpayOrderId).execute()
            except Exception as pe_err:
                print(f"[Supabase] payment_orders update error: {pe_err}")

        # Always freeze immutable price_at_booking on confirmed booking
        try:
            b_up = {"price_at_booking": unit_price}
            if payload.razorpayOrderId:
                b_up["razorpay_order_id"] = payload.razorpayOrderId
            if payload.razorpayPaymentId:
                b_up["razorpay_payment_id"] = payload.razorpayPaymentId
            c.table("bookings").update(b_up).eq("id", booking_id).execute()
        except Exception as b_up_err:
            print(f"[Supabase] price_at_booking update notice: {b_up_err}")

        # Trigger event-driven market price recalculation for remaining seats
        try:
            from backend.pricing.service import PricingService
            PricingService.handle_booking_event(payload.tripId, client=c)
        except Exception as pr_evt:
            print(f"[Pricing] Post-booking recalculation notice: {pr_evt}")

        trip_schema = trip_for_price or fetch_trip_by_id_from_db(payload.tripId, user_id=passenger_id, client=c)
        if not trip_schema:
            raise HTTPException(status_code=404, detail="Trip record not found after booking.")

        return BookingResponse(
            id=booking_id,
            bookingRef=booking_ref,
            trip=trip_schema,
            seatsCount=payload.seatsCount,
            totalPaid=authoritative_total,
            priceAtBooking=unit_price,
            status="confirmed",
            razorpayOrderId=payload.razorpayOrderId,
            razorpayPaymentId=payload.razorpayPaymentId
        )
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        if "P0004" in err_msg or "Not enough seats" in err_msg:
            raise HTTPException(status_code=409, detail="Seats unavailable or already booked by another passenger.")
        if "P0005" in err_msg or "Drivers cannot book" in err_msg:
            raise HTTPException(status_code=400, detail="Drivers cannot book their own trip.")
        if "P0003" in err_msg or "no longer open" in err_msg:
            raise HTTPException(status_code=400, detail="Trip is no longer open for booking.")
        if "P0002" in err_msg or "Trip not found" in err_msg:
            raise HTTPException(status_code=404, detail="Trip not found.")
        print(f"[Supabase] create_booking_in_db error: {err_msg}")
        raise HTTPException(status_code=500, detail=f"Booking failed: {err_msg}")

def fetch_bookings_from_db(
    user_id: str,
    as_driver: bool = False,
    client: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """Fetch bookings where user is passenger (or driver) enriched with trip & driver profile."""
    c = client or supabase_client
    try:
        if as_driver:
            driver_trips = c.table("trips").select("id").eq("driver_id", user_id).execute()
            trip_ids = [t["id"] for t in driver_trips.data] if driver_trips.data else []
            if not trip_ids:
                return []
            res = c.table("bookings").select("*").in_("trip_id", trip_ids).order("created_at", desc=True).execute()
        else:
            res = c.table("bookings").select("*").eq("passenger_id", user_id).order("created_at", desc=True).execute()

        bookings_list = []
        for row in (res.data or []):
            trip_schema = fetch_trip_by_id_from_db(str(row["trip_id"]), user_id=user_id, client=c)
            pass_prof = fetch_profile_from_db(str(row["passenger_id"]), client=c)
            bookings_list.append({
                "id": str(row["id"]),
                "bookingRef": row.get("booking_ref") or "",
                "tripId": str(row["trip_id"]),
                "passengerId": str(row["passenger_id"]),
                "passengerName": pass_prof.name if pass_prof else "Passenger",
                "passengerInitials": pass_prof.initials if pass_prof else "PA",
                "seatsCount": int(row.get("seats_count") or 1),
                "luggageTier": row.get("luggage_tier") or "small",
                "passengerNotes": row.get("passenger_notes") or "",
                "totalPaid": float(row.get("total_paid") or 0.0),
                "paymentStatus": row.get("payment_status") or "completed",
                "bookingStatus": row.get("booking_status") or "confirmed",
                "status": row.get("booking_status") or "confirmed",
                "createdAt": row.get("created_at") or "",
                "trip": trip_schema.model_dump() if trip_schema else None
            })
        return bookings_list
    except Exception as e:
        print(f"[Supabase] fetch_bookings_from_db error: {e}")
        return []

def fetch_booking_by_id_from_db(
    booking_id: str,
    user_id: str,
    client: Optional[Client] = None
) -> Optional[Dict[str, Any]]:
    """Fetch booking by ID and verify user is passenger or driver."""
    c = client or supabase_client
    try:
        res = c.table("bookings").select("*").eq("id", booking_id).execute()
        if not res.data:
            return None
        row = res.data[0]
        trip_schema = fetch_trip_by_id_from_db(str(row["trip_id"]), user_id=user_id, client=c)
        if str(row["passenger_id"]) != user_id:
            if not trip_schema or trip_schema.driverId != user_id:
                raise HTTPException(status_code=403, detail="Unauthorized to view this booking.")

        pass_prof = fetch_profile_from_db(str(row["passenger_id"]), client=c)
        return {
            "id": str(row["id"]),
            "bookingRef": row.get("booking_ref") or "",
            "tripId": str(row["trip_id"]),
            "passengerId": str(row["passenger_id"]),
            "passengerName": pass_prof.name if pass_prof else "Passenger",
            "passengerInitials": pass_prof.initials if pass_prof else "PA",
            "seatsCount": int(row.get("seats_count") or 1),
            "luggageTier": row.get("luggage_tier") or "small",
            "passengerNotes": row.get("passenger_notes") or "",
            "totalPaid": float(row.get("total_paid") or 0.0),
            "paymentStatus": row.get("payment_status") or "completed",
            "bookingStatus": row.get("booking_status") or "confirmed",
            "status": row.get("booking_status") or "confirmed",
            "createdAt": row.get("created_at") or "",
            "trip": trip_schema.model_dump() if trip_schema else None
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Supabase] fetch_booking_by_id_from_db error: {e}")
        return None

def cancel_booking_in_db(
    booking_id: str,
    user_id: str,
    reason: str = "Cancelled by user",
    client: Optional[Client] = None
) -> bool:
    """Cancel booking atomically and restore seats via cancel_booking_atomic RPC, notifying driver."""
    c = client or supabase_client
    try:
        # Pre-fetch booking details to notify driver if passenger cancels
        b_info = None
        try:
            b_lookup = c.table("bookings").select("id, trip_id, passenger_id, seats_count").eq("id", booking_id).execute()
            if b_lookup.data:
                b_info = b_lookup.data[0]
        except Exception:
            pass

        rpc_res = c.rpc("cancel_booking_atomic", {
            "p_booking_id": booking_id,
            "p_user_id": user_id,
            "p_reason": reason
        }).execute()
        if rpc_res.data and rpc_res.data.get("success"):
            # If the passenger cancelled, notify the driver
            if b_info and str(b_info.get("passenger_id")) == user_id:
                try:
                    trip_lookup = c.table("trips").select("driver_id, origin, destination").eq("id", b_info["trip_id"]).execute()
                    if trip_lookup.data:
                        driver_id = str(trip_lookup.data[0]["driver_id"])
                        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                        notif_id = str(uuid.uuid4())
                        notif_obj = NotificationItemSchema(
                            id=notif_id,
                            userId=driver_id,
                            title="Passenger Cancelled Booking",
                            description=f"A passenger cancelled {b_info.get('seats_count', 1)} seat(s) for your trip {trip_lookup.data[0].get('origin', '')} → {trip_lookup.data[0].get('destination', '')}. The seats are now available again.",
                            time=now_iso,
                            read=False,
                            type="booking",
                            targetScreen="trips",
                            targetId=str(b_info["trip_id"])
                        )
                        db.notifications.insert(0, notif_obj)
                        try:
                            supabase_client.table("notifications").insert({
                                "id": notif_id,
                                "user_id": driver_id,
                                "title": notif_obj.title,
                                "description": notif_obj.description,
                                "read": False,
                                "type": "booking",
                                "target_screen": "trips",
                                "target_id": str(b_info["trip_id"]),
                                "created_at": now_iso
                            }).execute()
                        except Exception:
                            pass
                except Exception as notif_err:
                    print(f"[Supabase] driver notification error on cancel: {notif_err}")

            if b_info and b_info.get("trip_id"):
                try:
                    from backend.pricing.service import PricingService
                    PricingService.handle_booking_event(str(b_info["trip_id"]), client=c)
                except Exception as pr_evt:
                    print(f"[Pricing] Post-cancel booking recalculation notice: {pr_evt}")

            return True
        return False
    except Exception as e:
        err_msg = str(e)
        if "42501" in err_msg or "Unauthorized" in err_msg:
            raise HTTPException(status_code=403, detail="Unauthorized: Only the passenger or driver can cancel this booking.")
        if "P0002" in err_msg or "Booking not found" in err_msg:
            raise HTTPException(status_code=404, detail="Booking not found.")
        print(f"[Supabase] cancel_booking_in_db error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel booking: {err_msg}")

# ============================================================
# PHASE 2C: PASSENGER REQUESTS
# ============================================================

def create_passenger_request_in_db(
    passenger_id: str,
    payload: PassengerRequestCreate,
    client: Optional[Client] = None
) -> PassengerRequestSchema:
    """Insert a real passenger request into public.passenger_requests."""
    c = client or supabase_client
    req_id = str(uuid.uuid4())
    prof = fetch_profile_from_db(passenger_id, client=c)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    row_data = {
        "id": req_id,
        "passenger_id": passenger_id,
        "origin": payload.origin,
        "destination": payload.destination,
        "date": payload.date,
        "time_window": payload.timeWindow or "Morning (08:00 - 11:00)",
        "seats_needed": payload.seatsNeeded,
        "budget_per_seat": float(payload.budgetPerSeat),
        "preferences": payload.preferences or [],
        "notes": payload.notes or "",
        "status": "active",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    if payload.originLatitude is not None:
        row_data["origin_latitude"] = float(payload.originLatitude)
    if payload.originLongitude is not None:
        row_data["origin_longitude"] = float(payload.originLongitude)
    if payload.originPlaceId:
        row_data["origin_place_id"] = payload.originPlaceId
    if payload.originAddress:
        row_data["origin_address"] = payload.originAddress
    if payload.destinationLatitude is not None:
        row_data["destination_latitude"] = float(payload.destinationLatitude)
    if payload.destinationLongitude is not None:
        row_data["destination_longitude"] = float(payload.destinationLongitude)
    if payload.destinationPlaceId:
        row_data["destination_place_id"] = payload.destinationPlaceId
    if payload.destinationAddress:
        row_data["destination_address"] = payload.destinationAddress

    try:
        try:
            res = c.table("passenger_requests").insert(row_data).execute()
        except Exception as insert_err:
            if "column" in str(insert_err).lower() or "does not exist" in str(insert_err).lower():
                for k in ["origin_latitude", "origin_longitude", "origin_place_id", "origin_address",
                          "destination_latitude", "destination_longitude", "destination_place_id", "destination_address"]:
                    row_data.pop(k, None)
                res = c.table("passenger_requests").insert(row_data).execute()
            else:
                raise insert_err

        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to insert passenger request.")
        
        try:
            from backend.pricing.service import PricingService
            PricingService.handle_passenger_request_event(req_id, client=c)
        except Exception as pr_evt:
            print(f"[Pricing] Post-request recalculation notice: {pr_evt}")

        return PassengerRequestSchema(
            id=req_id,
            passengerId=passenger_id,
            passengerName=prof.name if prof else "Passenger",
            passengerAvatar=prof.avatar if prof else "",
            passengerInitials=prof.initials if prof else "PA",
            passengerRating=prof.rating if prof else 5.0,
            origin=payload.origin,
            destination=payload.destination,
            date=payload.date,
            timeWindow=payload.timeWindow or "Morning (08:00 - 11:00)",
            seatsNeeded=payload.seatsNeeded,
            budgetPerSeat=payload.budgetPerSeat,
            preferences=payload.preferences or [],
            notes=payload.notes or "",
            status="active",
            originLatitude=payload.originLatitude,
            originLongitude=payload.originLongitude,
            originPlaceId=payload.originPlaceId,
            originAddress=payload.originAddress,
            destinationLatitude=payload.destinationLatitude,
            destinationLongitude=payload.destinationLongitude,
            destinationPlaceId=payload.destinationPlaceId,
            destinationAddress=payload.destinationAddress
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Supabase] create_passenger_request_in_db error: {e}")
        raise HTTPException(status_code=500, detail=f"Database insert failed: {str(e)}")

def fetch_passenger_requests_from_db(
    user_id: Optional[str] = None,
    only_my: bool = False,
    client: Optional[Client] = None
) -> List[PassengerRequestSchema]:
    """Fetch active passenger requests or only the user's requests."""
    c = client or supabase_client
    try:
        query = c.table("passenger_requests").select("*")
        if only_my and user_id:
            query = query.eq("passenger_id", user_id)
        else:
            query = query.eq("status", "active")
        
        res = query.order("created_at", desc=True).execute()
        result_list = []
        for row in (res.data or []):
            prof = fetch_profile_from_db(str(row["passenger_id"]), client=c)
            result_list.append(PassengerRequestSchema(
                id=str(row["id"]),
                passengerId=str(row["passenger_id"]),
                passengerName=prof.name if prof else "Passenger",
                passengerAvatar=prof.avatar if prof else "",
                passengerInitials=prof.initials if prof else "PA",
                passengerRating=prof.rating if prof else 5.0,
                origin=row.get("origin") or "",
                destination=row.get("destination") or "",
                date=row.get("date") or "",
                timeWindow=row.get("time_window") or "",
                seatsNeeded=int(row.get("seats_needed") or 1),
                budgetPerSeat=float(row.get("budget_per_seat") or 0.0),
                preferences=row.get("preferences") or [],
                notes=row.get("notes") or "",
                status=row.get("status") or "active",
                originLatitude=float(row["origin_latitude"]) if row.get("origin_latitude") is not None else None,
                originLongitude=float(row["origin_longitude"]) if row.get("origin_longitude") is not None else None,
                originPlaceId=row.get("origin_place_id"),
                originAddress=row.get("origin_address"),
                destinationLatitude=float(row["destination_latitude"]) if row.get("destination_latitude") is not None else None,
                destinationLongitude=float(row["destination_longitude"]) if row.get("destination_longitude") is not None else None,
                destinationPlaceId=row.get("destination_place_id"),
                destinationAddress=row.get("destination_address")
            ))
        return result_list
    except Exception as e:
        print(f"[Supabase] fetch_passenger_requests_from_db error: {e}")
        return []

def cancel_passenger_request_in_db(
    request_id: str,
    user_id: str,
    client: Optional[Client] = None
) -> bool:
    """Cancel a passenger request if owned by the user."""
    c = client or supabase_client
    try:
        check = c.table("passenger_requests").select("passenger_id").eq("id", request_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Request not found.")
        if str(check.data[0]["passenger_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized: You can only cancel your own requests.")

        c.table("passenger_requests").update({"status": "cancelled"}).eq("id", request_id).execute()
        try:
            from backend.pricing.service import PricingService
            PricingService.handle_passenger_request_event(request_id, client=c)
        except Exception as pr_evt:
            print(f"[Pricing] Post-cancel request recalculation notice: {pr_evt}")
        return True
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Supabase] cancel_passenger_request_in_db error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# PHASE 2D: LUGGAGE / PACKAGES
# ============================================================

def create_luggage_package_in_db(
    sender_id: str,
    payload: LuggagePackageCreate,
    client: Optional[Client] = None
) -> LuggagePackageSchema:
    """Insert a real luggage package into public.luggage_packages."""
    c = client or supabase_client
    pkg_id = str(uuid.uuid4())
    prof = fetch_profile_from_db(sender_id, client=c)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    row_data = {
        "id": pkg_id,
        "sender_id": sender_id,
        "sender_name": prof.name if prof else "Sender",
        "sender_initials": prof.initials if prof else "SK",
        "origin": payload.origin,
        "destination": payload.destination,
        "date": payload.date,
        "size": payload.size,
        "dimensions": payload.dimensions or "",
        "description": payload.description,
        "price_offer": float(payload.priceOffer),
        "receiver_name": payload.receiverName or "",
        "receiver_phone": payload.receiverPhone or "",
        "status": "active",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    if payload.originLatitude is not None:
        row_data["origin_latitude"] = float(payload.originLatitude)
    if payload.originLongitude is not None:
        row_data["origin_longitude"] = float(payload.originLongitude)
    if payload.originPlaceId:
        row_data["origin_place_id"] = payload.originPlaceId
    if payload.originAddress:
        row_data["origin_address"] = payload.originAddress
    if payload.destinationLatitude is not None:
        row_data["destination_latitude"] = float(payload.destinationLatitude)
    if payload.destinationLongitude is not None:
        row_data["destination_longitude"] = float(payload.destinationLongitude)
    if payload.destinationPlaceId:
        row_data["destination_place_id"] = payload.destinationPlaceId
    if payload.destinationAddress:
        row_data["destination_address"] = payload.destinationAddress

    try:
        try:
            res = c.table("luggage_packages").insert(row_data).execute()
        except Exception as insert_err:
            if "column" in str(insert_err).lower() or "does not exist" in str(insert_err).lower():
                for k in ["origin_latitude", "origin_longitude", "origin_place_id", "origin_address",
                          "destination_latitude", "destination_longitude", "destination_place_id", "destination_address"]:
                    row_data.pop(k, None)
                res = c.table("luggage_packages").insert(row_data).execute()
            else:
                raise insert_err
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to insert luggage package.")

        return LuggagePackageSchema(
            id=pkg_id,
            senderId=sender_id,
            senderName=prof.name if prof else "Sender",
            senderAvatar=prof.avatar if prof else "",
            senderInitials=prof.initials if prof else "SK",
            origin=payload.origin,
            destination=payload.destination,
            date=payload.date,
            size=payload.size,
            dimensions=payload.dimensions or "",
            description=payload.description,
            priceOffer=payload.priceOffer,
            receiverName=payload.receiverName or "",
            receiverPhone=payload.receiverPhone or "",
            status="active",
            originLatitude=payload.originLatitude,
            originLongitude=payload.originLongitude,
            originPlaceId=payload.originPlaceId,
            originAddress=payload.originAddress,
            destinationLatitude=payload.destinationLatitude,
            destinationLongitude=payload.destinationLongitude,
            destinationPlaceId=payload.destinationPlaceId,
            destinationAddress=payload.destinationAddress
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Supabase] create_luggage_package_in_db error: {e}")
        raise HTTPException(status_code=500, detail=f"Database insert failed: {str(e)}")

def fetch_luggage_packages_from_db(
    user_id: Optional[str] = None,
    only_my: bool = False,
    client: Optional[Client] = None
) -> List[LuggagePackageSchema]:
    """Fetch active luggage packages or only the user's packages."""
    c = client or supabase_client
    try:
        query = c.table("luggage_packages").select("*")
        if only_my and user_id:
            query = query.eq("sender_id", user_id)
        else:
            query = query.eq("status", "active")
        
        res = query.order("created_at", desc=True).execute()
        result_list = []
        for row in (res.data or []):
            prof = fetch_profile_from_db(str(row["sender_id"]), client=c)
            result_list.append(LuggagePackageSchema(
                id=str(row["id"]),
                senderId=str(row["sender_id"]),
                senderName=row.get("sender_name") or (prof.name if prof else "Sender"),
                senderAvatar=prof.avatar if prof else "",
                senderInitials=row.get("sender_initials") or (prof.initials if prof else "SK"),
                origin=row.get("origin") or "",
                destination=row.get("destination") or "",
                date=row.get("date") or "",
                size=row.get("size") or "Medium (< 15kg)",
                dimensions=row.get("dimensions") or "",
                description=row.get("description") or "",
                priceOffer=float(row.get("price_offer") or 0.0),
                receiverName=row.get("receiver_name") or "",
                receiverPhone=row.get("receiver_phone") or "",
                status=row.get("status") or "active",
                originLatitude=float(row["origin_latitude"]) if row.get("origin_latitude") is not None else None,
                originLongitude=float(row["origin_longitude"]) if row.get("origin_longitude") is not None else None,
                originPlaceId=row.get("origin_place_id"),
                originAddress=row.get("origin_address"),
                destinationLatitude=float(row["destination_latitude"]) if row.get("destination_latitude") is not None else None,
                destinationLongitude=float(row["destination_longitude"]) if row.get("destination_longitude") is not None else None,
                destinationPlaceId=row.get("destination_place_id"),
                destinationAddress=row.get("destination_address")
            ))
        return result_list
    except Exception as e:
        print(f"[Supabase] fetch_luggage_packages_from_db error: {e}")
        return []

def cancel_luggage_package_in_db(
    package_id: str,
    user_id: str,
    client: Optional[Client] = None
) -> bool:
    """Cancel luggage package if owned by the user."""
    c = client or supabase_client
    try:
        check = c.table("luggage_packages").select("sender_id").eq("id", package_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Luggage package not found.")
        if str(check.data[0]["sender_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized: You can only cancel your own luggage packages.")

        c.table("luggage_packages").update({"status": "cancelled"}).eq("id", package_id).execute()
        return True
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Supabase] cancel_luggage_package_in_db error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# PHASE 2E: VEHICLES & PROFILE
# ============================================================

def fetch_vehicles_from_db(
    user_id: str,
    client: Optional[Client] = None
) -> List[VehicleSchema]:
    """Fetch all vehicles owned by user."""
    c = client or supabase_client
    try:
        res = c.table("vehicles").select("*").eq("user_id", user_id).order("created_at").execute()
        return [
            VehicleSchema(
                id=str(row["id"]),
                make=row.get("make") or "",
                model=row.get("model") or "",
                year=int(row.get("year") or 2022),
                color=row.get("color") or "",
                plateNumber=row.get("plate_number") or "",
                isDefault=bool(row.get("is_default", False))
            )
            for row in (res.data or [])
        ]
    except Exception as e:
        print(f"[Supabase] fetch_vehicles_from_db error: {e}")
        return []

def insert_vehicle_in_db(
    user_id: str,
    payload: VehicleCreate,
    client: Optional[Client] = None
) -> VehicleSchema:
    """Insert a new vehicle for authenticated user."""
    c = client or supabase_client
    new_id = str(uuid.uuid4())
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        c.table("vehicles").insert({
            "id": new_id,
            "user_id": user_id,
            "make": payload.make,
            "model": payload.model,
            "year": payload.year,
            "color": payload.color,
            "plate_number": payload.plateNumber.strip(),
            "is_default": payload.isDefault or False,
            "created_at": now_iso,
            "updated_at": now_iso
        }).execute()
        return VehicleSchema(
            id=new_id,
            make=payload.make,
            model=payload.model,
            year=payload.year,
            color=payload.color,
            plateNumber=payload.plateNumber.strip(),
            isDefault=payload.isDefault or False
        )
    except Exception as e:
        print(f"[Supabase] insert_vehicle_in_db error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add vehicle: {str(e)}")

def delete_vehicle_in_db(
    vehicle_id: str,
    user_id: str,
    client: Optional[Client] = None
) -> bool:
    """Delete vehicle if owned by user."""
    c = client or supabase_client
    try:
        check = c.table("vehicles").select("user_id").eq("id", vehicle_id).execute()
        if not check.data:
            raise HTTPException(status_code=404, detail="Vehicle not found.")
        if str(check.data[0]["user_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized: You can only delete your own vehicles.")

        c.table("vehicles").delete().eq("id", vehicle_id).eq("user_id", user_id).execute()
        return True
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Supabase] delete_vehicle_in_db error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def update_profile_in_db(
    user_id: str,
    payload: UserProfileUpdate,
    client: Optional[Client] = None
) -> UserProfile:
    """Update editable fields of user profile while protecting system-generated fields."""
    c = client or supabase_client
    prof = fetch_profile_from_db(user_id, client=c)
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found.")

    if payload.name is not None and payload.name.strip():
        prof.name = payload.name.strip()
        name_parts = prof.name.split()
        prof.initials = "".join([p[0].upper() for p in name_parts[:2]]) if name_parts else "TR"
    if payload.phone is not None:
        prof.phone = payload.phone
    if payload.bio is not None:
        prof.bio = payload.bio
    if payload.avatar is not None:
        prof.avatar = payload.avatar

    return upsert_profile_in_db(prof, client=c)

# ============================================================
# PHASE 2F: NOTIFICATIONS
# ============================================================

def fetch_notifications_from_db(
    user_id: str,
    client: Optional[Client] = None
) -> List[NotificationItemSchema]:
    """Fetch notifications for authenticated user."""
    c = client or supabase_client
    res_list: List[NotificationItemSchema] = []
    try:
        res = c.table("notifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
        for row in (res.data or []):
            res_list.append(NotificationItemSchema(
                id=str(row["id"]),
                userId=user_id,
                title=row.get("title") or "",
                description=row.get("description") or "",
                time=row.get("created_at") or "Recently",
                read=bool(row.get("read", False)),
                type=row.get("type") or "system",
                targetScreen=row.get("target_screen"),
                targetId=row.get("target_id")
            ))
    except Exception as e:
        print(f"[Supabase] fetch_notifications_from_db error: {e}")

    # Synchronize memory notifications
    existing_ids = {n.id for n in res_list}
    for mem_n in db.notifications:
        if getattr(mem_n, "userId", None) == user_id and mem_n.id not in existing_ids:
            res_list.insert(0, mem_n)

    return res_list

def mark_notification_read_in_db(
    notif_id: str,
    user_id: str,
    client: Optional[Client] = None
) -> bool:
    """Mark a single notification read."""
    c = client or supabase_client
    try:
        c.table("notifications").update({"read": True}).eq("id", notif_id).eq("user_id", user_id).execute()
        return True
    except Exception as e:
        print(f"[Supabase] mark_notification_read_in_db error: {e}")
        return False

def mark_all_notifications_read_in_db(
    user_id: str,
    client: Optional[Client] = None
) -> bool:
    """Mark all notifications read for user."""
    c = client or supabase_client
    try:
        c.table("notifications").update({"read": True}).eq("user_id", user_id).execute()
        return True
    except Exception as e:
        print(f"[Supabase] mark_all_notifications_read_in_db error: {e}")
        return False

# ============================================================
# PHASE 2G: UNIVERSITIES, VERIFICATIONS & SUPPORT
# ============================================================

def fetch_universities_from_db(client: Optional[Client] = None) -> List[UniversityOptionSchema]:
    """Fetch universities list from public.universities."""
    c = client or supabase_client
    try:
        res = c.table("universities").select("*").execute()
        if res.data and len(res.data) > 0:
            return [
                UniversityOptionSchema(
                    id=str(row["id"]),
                    name=row.get("name") or "",
                    domain=row.get("domain") or "",
                    city=row.get("city") or "",
                    verifiedCount=int(row.get("verified_count") or 0)
                )
                for row in res.data
            ]
    except Exception as e:
        print(f"[Supabase] fetch_universities_from_db error: {e}")
    return [
        UniversityOptionSchema(id="u1", name="IISc Bangalore", domain="iisc.ac.in", city="Bengaluru", verifiedCount=420),
        UniversityOptionSchema(id="u2", name="IIT Hyderabad", domain="iith.ac.in", city="Hyderabad", verifiedCount=380),
        UniversityOptionSchema(id="u3", name="IIT Madras", domain="iitm.ac.in", city="Chennai", verifiedCount=510),
    ]

def submit_student_verification_in_db(
    user_id: str,
    req: StudentVerifyRequest,
    client: Optional[Client] = None
) -> dict:
    """Record student verification in public.student_verifications and update profile."""
    c = client or supabase_client
    unis = fetch_universities_from_db(client=c)
    matched = next((u for u in unis if u.id == req.universityId), None)
    uni_name = matched.name if matched else "Verified University"
    
    try:
        c.table("student_verifications").insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "university_id": req.universityId,
            "student_email": req.studentEmail,
            "status": "verified"
        }).execute()
    except Exception as e:
        print(f"[Supabase] student_verification insert notice: {e}")

    prof = fetch_profile_from_db(user_id, client=c)
    if prof:
        prof.isStudentVerified = True
        prof.studentUniversity = uni_name
        upsert_profile_in_db(prof, client=c)

    return {
        "success": True,
        "status": "verified",
        "isStudentVerified": True,
        "studentUniversity": uni_name,
        "message": f"Student verified with {req.studentEmail}"
    }

def submit_id_verification_in_db(
    user_id: str,
    req: IdVerificationRequest,
    client: Optional[Client] = None
) -> dict:
    """Record government ID verification in public.verification_requests and update profile."""
    c = client or supabase_client
    try:
        c.table("verification_requests").insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "document_type": req.documentType,
            "status": "verified"
        }).execute()
    except Exception as e:
        print(f"[Supabase] verification_requests insert notice: {e}")

    prof = fetch_profile_from_db(user_id, client=c)
    if prof:
        prof.isVerified = True
        upsert_profile_in_db(prof, client=c)

    return {
        "success": True,
        "status": "verified",
        "documentType": req.documentType
    }

def create_support_ticket_in_db(
    user_id: str,
    req: SupportTicketCreate,
    client: Optional[Client] = None
) -> dict:
    """Create support ticket in public.support_tickets."""
    c = client or supabase_client
    ticket_ref = f"TR-SUP-{uuid.uuid4().hex[:4].upper()}"
    try:
        c.table("support_tickets").insert({
            "id": str(uuid.uuid4()),
            "ticket_ref": ticket_ref,
            "user_id": user_id,
            "topic": req.category,
            "message": req.message,
            "status": "open"
        }).execute()
        return {"success": True, "ticketRef": ticket_ref}
    except Exception as e:
        print(f"[Supabase] create_support_ticket_in_db error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create support ticket: {str(e)}")

def fetch_support_tickets_from_db(
    user_id: str,
    client: Optional[Client] = None
) -> List[dict]:
    """Fetch support tickets for user."""
    c = client or supabase_client
    try:
        res = c.table("support_tickets").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return [
            {
                "id": str(row["id"]),
                "ticketRef": row.get("ticket_ref") or "",
                "category": row.get("topic") or "General",
                "message": row.get("message") or "",
                "status": row.get("status") or "open",
                "createdAt": row.get("created_at") or ""
            }
            for row in (res.data or [])
        ]
    except Exception as e:
        print(f"[Supabase] fetch_support_tickets_from_db error: {e}")
        return []
