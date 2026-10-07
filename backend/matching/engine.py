import uuid
from typing import List, Optional
from supabase import Client
from backend.config import MIN_AUTO_MATCH_SCORE
from backend.schemas import TripSchema
from backend.matching.models import (
    MatchingRequest, MatchingResponse, CandidateMatch,
    AssignmentRequest, AssignmentResponse, ScoringWeights
)
from backend.matching.candidate_filter import CandidateFilter
from backend.matching.feature_calculator import FeatureCalculator
from backend.matching.scoring import WeightedScorer
from backend.matching.ranking import Ranker
from backend.matching.assignment import AssignmentService

class MatchingEngine:
    """
    TopRide Deterministic Automatic Matching Engine.
    Executes the 10-step matching and atomic assignment pipeline:
    1. Hard Constraint Filtering
    2. Candidate Trip Generation
    3. Feature Calculation (stored coordinates & local math, 0 Mapbox calls)
    4. Feature Normalization (0-100)
    5. Weighted Scoring (35% Route, 20% Pickup, 15% Drop, 15% Time, 5% Price, 5% Rating, 5% Vehicle)
    6. Candidate Ranking (deterministic tie-breaking)
    7. Best Candidate Selection
    8. Atomic Booking/Assignment (row locks, availability re-check)
    9. Confirmation
    10. Automatic Fallback (up to MAX_ASSIGNMENT_ATTEMPTS = 3)
    """

    @classmethod
    def match(
        cls,
        request: MatchingRequest,
        client: Optional[Client] = None
    ) -> MatchingResponse:
        """Find and rank all eligible candidate trips for the passenger request."""
        request_id = f"req_match_{uuid.uuid4().hex[:8]}"

        # 1. Candidate Retrieval from PostgreSQL
        raw_trips = CandidateFilter.get_candidate_trips(request, client=client)

        if not raw_trips:
            return MatchingResponse(
                request_id=request_id,
                candidates=[],
                total_candidates=0,
                best_match=None,
                status="no_matches",
                message="No suitable trip is currently available on the requested route and date."
            )

        # 2. Existing passenger bookings check (prevent duplicate active booking)
        existing_booked = CandidateFilter.get_passenger_existing_bookings(request.passenger_id, client=client)

        # 3. Batched driver rating count retrieval
        driver_ids = [t.driverId for t in raw_trips if t.driverId]
        driver_rating_counts = CandidateFilter.get_driver_rating_counts(driver_ids, client=client)

        candidates: List[CandidateMatch] = []

        for trip in raw_trips:
            # 4. Hard constraint filtering
            eligible, reason = CandidateFilter.apply_hard_constraints(trip, request, existing_booked)
            if not eligible:
                continue

            # 5. Feature calculation & normalization
            d_count = driver_rating_counts.get(trip.driverId, 2)
            breakdown, raw = FeatureCalculator.calculate_all(request, trip, driver_rating_count=d_count)

            # Hard route filter: route score must be > 0
            if breakdown.route <= 0.0:
                continue

            # 6. Weighted scoring
            score = WeightedScorer.calculate_score(breakdown)
            explanation = WeightedScorer.generate_explanation(breakdown, raw, score)

            candidates.append(CandidateMatch(
                trip_id=trip.id,
                trip=trip,
                match_score=score,
                breakdown=breakdown,
                weights=WeightedScorer.DEFAULT_WEIGHTS,
                raw=raw,
                explanation=explanation,
                is_eligible=True
            ))

        if not candidates:
            return MatchingResponse(
                request_id=request_id,
                candidates=[],
                total_candidates=0,
                best_match=None,
                status="no_matches",
                message="No suitable trip is currently available that satisfies your route, schedule, and seating requirements."
            )

        # 7. Deterministic candidate ranking
        ranked = Ranker.rank_candidates(candidates)
        best = ranked[0]

        return MatchingResponse(
            request_id=request_id,
            candidates=ranked,
            total_candidates=len(ranked),
            best_match=best,
            status="matched",
            message=f"Found {len(ranked)} matching trip(s). Best match: {best.trip.driverName} ({best.match_score:.1f}% match)."
        )

    @classmethod
    def assign(
        cls,
        passenger_id: str,
        request: AssignmentRequest,
        client: Optional[Client] = None
    ) -> AssignmentResponse:
        """
        Automatically finds the best matching trip and atomically assigns/books it.
        Includes automatic fallback across top 3 candidates if race conditions occur.
        """
        # Convert AssignmentRequest to MatchingRequest
        match_req = MatchingRequest(
            passenger_id=passenger_id,
            origin=request.origin,
            destination=request.destination,
            date=request.date,
            departure_time=request.departure_time,
            seats=request.seats,
            budget=request.budget,
            vehicle_preference=request.vehicle_preference,
            origin_latitude=request.origin_latitude,
            origin_longitude=request.origin_longitude,
            destination_latitude=request.destination_latitude,
            destination_longitude=request.destination_longitude,
            preferences=request.preferences,
            notes=request.notes,
            max_time_difference_minutes=request.max_time_difference_minutes,
            mode="AUTOMATIC"
        )

        # 1. Match and rank candidates
        matching_res = cls.match(match_req, client=client)

        if not matching_res.candidates:
            return AssignmentResponse(
                assignment_id=f"asgn_{uuid.uuid4().hex[:8]}",
                status="failed",
                booking=None,
                assigned_trip=None,
                match_score=None,
                breakdown=None,
                attempts=0,
                fallback_used=False,
                message="No suitable trip is currently available."
            )

        # 2. Check minimum auto-match threshold
        min_threshold = (
            request.min_auto_match_score
            if request.min_auto_match_score is not None
            else MIN_AUTO_MATCH_SCORE
        )

        # If passenger specifically selected a preferred candidate from ranked list, respect manual choice
        if request.preferred_trip_id:
            preferred = [c for c in matching_res.candidates if c.trip_id == request.preferred_trip_id]
            others = [c for c in matching_res.candidates if c.trip_id != request.preferred_trip_id and c.match_score >= min_threshold]
            candidates_to_try = preferred + others
        else:
            # Automatic auto-assignment: filter out candidates below configurable min_threshold
            candidates_to_try = [c for c in matching_res.candidates if c.match_score >= min_threshold]

        if not candidates_to_try:
            best_cand = matching_res.candidates[0]
            return AssignmentResponse(
                assignment_id=f"asgn_{uuid.uuid4().hex[:8]}",
                status="failed",
                booking=None,
                assigned_trip=None,
                match_score=best_cand.match_score,
                breakdown=best_cand.breakdown,
                attempts=0,
                fallback_used=False,
                message=f"Best candidate scored {best_cand.match_score:.1f}%, which is below the minimum auto-assignment threshold ({min_threshold:.1f}%). Auto-assignment declined."
            )

        # 3. Atomic assignment with fallback
        return AssignmentService.assign_with_fallback(
            passenger_id=passenger_id,
            ranked_candidates=candidates_to_try,
            request=request,
            client=client
        )
