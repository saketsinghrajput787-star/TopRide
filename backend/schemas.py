from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# ================= AUTH & USER SCHEMAS =================
class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = ""

class LoginRequest(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    phone: str = ""
    avatar: Optional[str] = ""
    initials: str = "SK"
    rating: float = 5.0
    tripsCount: int = 0
    isVerified: bool = False
    isStudentVerified: bool = False
    studentUniversity: Optional[str] = ""
    bio: str = ""
    joinedDate: str = "March 2024"
    availablePayout: float = 0.0

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    bio: Optional[str] = None
    isVerified: Optional[bool] = None
    isStudentVerified: Optional[bool] = None
    studentUniversity: Optional[str] = None

# ================= VEHICLE SCHEMAS =================
class VehicleSchema(BaseModel):
    id: str
    make: str
    model: str
    year: int
    color: str
    plateNumber: str
    isDefault: Optional[bool] = False

class VehicleCreate(BaseModel):
    make: str
    model: str
    year: int
    color: str
    plateNumber: str
    isDefault: Optional[bool] = False

# ================= TRIP SCHEMAS =================
class TripSchema(BaseModel):
    id: str
    driverId: str
    driverName: str
    driverAvatar: Optional[str] = ""
    driverInitials: str = "TR"
    driverRating: float = 5.0
    driverTripsCount: int = 0
    driverIsVerified: bool = False
    origin: str
    originDetail: Optional[str] = ""
    destination: str
    destinationDetail: Optional[str] = ""
    date: str
    departureTime: str
    arrivalTime: str = ""
    duration: str = ""
    totalSeats: int
    availableSeats: int
    pricePerSeat: float
    currency: str = "₹"
    vehicle: VehicleSchema
    luggageAllowed: Literal["None", "Small", "Medium", "Large"] = "Medium"
    luggageDetails: str = ""
    instantBooking: bool = True
    tripRules: List[str] = []
    stops: Optional[List[str]] = []
    isPassengerTrip: Optional[bool] = False
    isDriverTrip: Optional[bool] = False
    status: Literal["upcoming", "in-progress", "completed", "cancelled"] = "upcoming"
    bookedSeatCount: Optional[int] = 0
    totalPaid: Optional[float] = 0.0
    originLatitude: Optional[float] = None
    originLongitude: Optional[float] = None
    originPlaceId: Optional[str] = None
    originAddress: Optional[str] = None
    destinationLatitude: Optional[float] = None
    destinationLongitude: Optional[float] = None
    destinationPlaceId: Optional[str] = None
    destinationAddress: Optional[str] = None
    routeGeometry: Optional[dict] = None

class TripCreate(BaseModel):
    origin: str
    originDetail: Optional[str] = ""
    destination: str
    destinationDetail: Optional[str] = ""
    date: str
    departureTime: str
    arrivalTime: Optional[str] = "16:30"
    duration: Optional[str] = "8h 30m"
    totalSeats: int = 3
    pricePerSeat: float = 650.0
    currency: str = "₹"
    vehicleId: Optional[str] = None
    vehicle: Optional[VehicleSchema] = None
    luggageAllowed: Literal["None", "Small", "Medium", "Large"] = "Medium"
    luggageDetails: Optional[str] = ""
    instantBooking: bool = True
    tripRules: List[str] = []
    stops: Optional[List[str]] = []
    originLatitude: Optional[float] = None
    originLongitude: Optional[float] = None
    originPlaceId: Optional[str] = None
    originAddress: Optional[str] = None
    destinationLatitude: Optional[float] = None
    destinationLongitude: Optional[float] = None
    destinationPlaceId: Optional[str] = None
    destinationAddress: Optional[str] = None
    routeGeometry: Optional[dict] = None

# ================= BOOKING SCHEMAS =================
class BookingCreate(BaseModel):
    tripId: str
    seatsCount: int = Field(default=1, ge=1)
    luggageTier: Literal["small", "medium", "heavy"] = "small"
    passengerNotes: Optional[str] = ""
    totalAmount: float
    paymentRef: Optional[str] = None

class BookingResponse(BaseModel):
    id: str
    bookingRef: str
    trip: TripSchema
    seatsCount: Optional[int] = 1
    totalPaid: Optional[float] = 0.0
    status: Optional[str] = "confirmed"

# ================= PASSENGER REQUEST SCHEMAS =================
class PassengerRequestSchema(BaseModel):
    id: str
    passengerId: str
    passengerName: str
    passengerAvatar: Optional[str] = ""
    passengerInitials: str = "PA"
    passengerRating: float = 5.0
    origin: str
    destination: str
    date: str
    timeWindow: str = ""
    seatsNeeded: int = 1
    budgetPerSeat: float = 0.0
    preferences: List[str] = []
    status: Literal["active", "matched", "completed", "cancelled"] = "active"
    notes: Optional[str] = ""
    originLatitude: Optional[float] = None
    originLongitude: Optional[float] = None
    originPlaceId: Optional[str] = None
    originAddress: Optional[str] = None
    destinationLatitude: Optional[float] = None
    destinationLongitude: Optional[float] = None
    destinationPlaceId: Optional[str] = None
    destinationAddress: Optional[str] = None

class PassengerRequestCreate(BaseModel):
    origin: str
    destination: str
    date: str
    timeWindow: Optional[str] = ""
    seatsNeeded: int = 1
    budgetPerSeat: float = 0.0
    preferences: List[str] = []
    notes: Optional[str] = ""
    originLatitude: Optional[float] = None
    originLongitude: Optional[float] = None
    originPlaceId: Optional[str] = None
    originAddress: Optional[str] = None
    destinationLatitude: Optional[float] = None
    destinationLongitude: Optional[float] = None
    destinationPlaceId: Optional[str] = None
    destinationAddress: Optional[str] = None

# ================= LUGGAGE SCHEMAS =================
class LuggagePackageSchema(BaseModel):
    id: str
    senderId: Optional[str] = None
    senderName: str
    senderAvatar: Optional[str] = ""
    senderInitials: str = "SK"
    origin: str
    destination: str
    date: str
    size: Literal["Document", "Small (< 5kg)", "Medium (< 15kg)", "Large (< 25kg)"]
    dimensions: Optional[str] = ""
    description: str
    priceOffer: float
    status: Literal["active", "in-transit", "delivered", "cancelled"] = "active"
    receiverName: Optional[str] = ""
    receiverPhone: Optional[str] = ""
    originLatitude: Optional[float] = None
    originLongitude: Optional[float] = None
    originPlaceId: Optional[str] = None
    originAddress: Optional[str] = None
    destinationLatitude: Optional[float] = None
    destinationLongitude: Optional[float] = None
    destinationPlaceId: Optional[str] = None
    destinationAddress: Optional[str] = None

class LuggagePackageCreate(BaseModel):
    origin: str
    destination: str
    date: str
    size: Literal["Document", "Small (< 5kg)", "Medium (< 15kg)", "Large (< 25kg)"]
    dimensions: Optional[str] = ""
    description: str
    priceOffer: float
    receiverName: Optional[str] = ""
    receiverPhone: Optional[str] = ""
    originLatitude: Optional[float] = None
    originLongitude: Optional[float] = None
    originPlaceId: Optional[str] = None
    originAddress: Optional[str] = None
    destinationLatitude: Optional[float] = None
    destinationLongitude: Optional[float] = None
    destinationPlaceId: Optional[str] = None
    destinationAddress: Optional[str] = None

# ================= CHAT & MESSAGE SCHEMAS =================
class MessageSchema(BaseModel):
    id: str
    senderId: str
    senderName: str
    text: str
    timestamp: str
    isMe: bool
    status: Optional[Literal["sent", "delivered", "read"]] = "sent"

class ConversationSchema(BaseModel):
    id: str
    tripId: Optional[str] = None
    tripRoute: str
    partnerId: str
    partnerName: str
    partnerAvatar: Optional[str] = ""
    partnerInitials: str
    partnerRole: Literal["Driver", "Passenger", "Traveler"] = "Driver"
    partnerRating: float = 5.0
    lastMessage: str = ""
    lastMessageTime: str = ""
    unreadCount: int = 0
    messages: List[MessageSchema] = []

class MessageSendRequest(BaseModel):
    conversationId: str
    text: str

# ================= NOTIFICATION SCHEMAS =================
class NotificationItemSchema(BaseModel):
    id: str
    title: str
    description: str
    time: str
    read: bool
    type: Literal["booking", "trip", "chat", "payment", "system"]
    targetScreen: Optional[str] = None
    targetId: Optional[str] = None

# ================= UNIVERSITY & VERIFICATION =================
class UniversityOptionSchema(BaseModel):
    id: str
    name: str
    domain: str
    city: str
    verifiedCount: int

class StudentVerifyRequest(BaseModel):
    universityId: str
    studentEmail: str

class IdVerificationRequest(BaseModel):
    documentType: str
    documentNumber: Optional[str] = ""

# ================= SUPPORT TICKET =================
class SupportTicketCreate(BaseModel):
    category: str
    message: str

# ================= PAYOUT SCHEMAS =================
class PayoutRequest(BaseModel):
    amount: float
    method: Literal["bank", "upi"]
    destination: Optional[str] = None
