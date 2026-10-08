"""
TopRide Backend Domain Models & Schemas.
Consolidates all database and domain transfer schemas.
"""

from backend.schemas import (
    UserSchema,
    VehicleSchema,
    TripSchema,
    PassengerRequestSchema,
    LuggagePackageSchema,
    ReviewSchema,
    ConversationSchema,
    MessageSchema,
    NotificationSchema,
    VerificationSchema,
    EscrowTransactionSchema,
    DisputeSchema,
)

from backend.matching.models import (
    MatchingRequest,
    MatchingResponse,
    CandidateMatch,
    AssignmentRequest,
    AssignmentResponse,
    BookingResponse,
    FeatureBreakdown,
    ScoringWeights,
    FeatureRaw,
)

from backend.pricing.models import (
    PriceEstimateRequest,
    PriceBreakdown,
)

__all__ = [
    "UserSchema",
    "VehicleSchema",
    "TripSchema",
    "PassengerRequestSchema",
    "LuggagePackageSchema",
    "ReviewSchema",
    "ConversationSchema",
    "MessageSchema",
    "NotificationSchema",
    "VerificationSchema",
    "EscrowTransactionSchema",
    "DisputeSchema",
    "MatchingRequest",
    "MatchingResponse",
    "CandidateMatch",
    "AssignmentRequest",
    "AssignmentResponse",
    "BookingResponse",
    "FeatureBreakdown",
    "ScoringWeights",
    "FeatureRaw",
    "PriceEstimateRequest",
    "PriceBreakdown",
]
