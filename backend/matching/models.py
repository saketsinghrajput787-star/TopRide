from typing import Optional, List, Dict, Any, Union, Literal
from pydantic import BaseModel, Field
from backend.schemas import TripSchema, BookingResponse

class LocationInput(BaseModel):
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_id: Optional[str] = None
    formatted_address: Optional[str] = None

class MatchingPreferences(BaseModel):
    preferred_departure_time: Optional[str] = None
    max_pickup_distance_km: Optional[float] = 25.0
    max_drop_distance_km: Optional[float] = 25.0
    max_time_difference_minutes: Optional[int] = 120
    vehicle_type: Optional[str] = None
    luggage: Optional[str] = None
    flexibility_pct: Optional[float] = 0.15

class MatchingRequest(BaseModel):
    passenger_id: Optional[str] = None
    origin: Union[str, Dict[str, Any], LocationInput]
    destination: Union[str, Dict[str, Any], LocationInput]
    date: str
    departure_time: Optional[str] = None
    seats: int = Field(default=1, ge=1)
    budget: Optional[float] = None
    vehicle_preference: Optional[str] = None
    origin_latitude: Optional[float] = None
    origin_longitude: Optional[float] = None
    destination_latitude: Optional[float] = None
    destination_longitude: Optional[float] = None
    preferences: Optional[List[str]] = None
    notes: Optional[str] = ""
    max_time_difference_minutes: Optional[int] = None
    mode: Literal["AUTOMATIC", "RECOMMENDATION", "PASSENGER_SELECTED", "ADMIN_ASSIGNED"] = "AUTOMATIC"

class FeatureBreakdown(BaseModel):
    route: float = Field(..., ge=0.0, le=100.0, description="Route compatibility score (0-100)")
    pickup: float = Field(..., ge=0.0, le=100.0, description="Pickup proximity score (0-100)")
    drop: float = Field(..., ge=0.0, le=100.0, description="Drop-off proximity score (0-100)")
    time: float = Field(..., ge=0.0, le=100.0, description="Departure time score (0-100)")
    price: float = Field(..., ge=0.0, le=100.0, description="Price compatibility score (0-100)")
    rating: float = Field(..., ge=0.0, le=100.0, description="Driver rating score (0-100)")
    vehicle: float = Field(..., ge=0.0, le=100.0, description="Vehicle preference score (0-100)")

class ScoringWeights(BaseModel):
    route: float = 0.35
    pickup: float = 0.20
    drop: float = 0.15
    time: float = 0.15
    price: float = 0.05
    rating: float = 0.05
    vehicle: float = 0.05

class FeatureRaw(BaseModel):
    pickup_distance_km: float
    drop_distance_km: float
    time_difference_minutes: int
    price_difference: float
    driver_average_rating: float
    driver_rating_count: int
    driver_is_new: bool
    vehicle_matched: bool

class CandidateMatch(BaseModel):
    trip_id: str
    trip: TripSchema
    match_score: float
    breakdown: FeatureBreakdown
    weights: ScoringWeights
    raw: FeatureRaw
    explanation: str
    is_eligible: bool = True

class MatchingResponse(BaseModel):
    request_id: str
    candidates: List[CandidateMatch]
    total_candidates: int
    best_match: Optional[CandidateMatch] = None
    status: Literal["matched", "no_matches"]
    message: str

class AssignmentRequest(BaseModel):
    origin: Union[str, Dict[str, Any], LocationInput]
    destination: Union[str, Dict[str, Any], LocationInput]
    date: str
    departure_time: Optional[str] = None
    seats: int = Field(default=1, ge=1)
    budget: Optional[float] = None
    vehicle_preference: Optional[str] = None
    origin_latitude: Optional[float] = None
    origin_longitude: Optional[float] = None
    destination_latitude: Optional[float] = None
    destination_longitude: Optional[float] = None
    preferences: Optional[List[str]] = None
    notes: Optional[str] = ""
    preferred_trip_id: Optional[str] = None
    min_auto_match_score: Optional[float] = None
    max_time_difference_minutes: Optional[int] = None
    max_fallback_attempts: int = Field(default=3, ge=1, le=5)
    luggage_tier: Optional[Literal["small", "medium", "heavy"]] = "small"
    passenger_notes: Optional[str] = ""

class AssignmentResponse(BaseModel):
    assignment_id: str
    status: Literal["assigned", "failed", "fallback_assigned"]
    booking: Optional[BookingResponse] = None
    assigned_trip: Optional[TripSchema] = None
    match_score: Optional[float] = None
    breakdown: Optional[FeatureBreakdown] = None
    attempts: int = 1
    fallback_used: bool = False
    message: str
