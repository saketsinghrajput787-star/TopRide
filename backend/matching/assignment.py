import uuid
from typing import List, Optional, Tuple
from fastapi import HTTPException
from supabase import Client
from backend.schemas import BookingResponse, TripSchema
from backend.matching.models import (
    CandidateMatch, AssignmentRequest, AssignmentResponse, FeatureBreakdown
)
from backend.database import (
    supabase_client, fetch_trip_by_id_from_db
)

MAX_ASSIGNMENT_ATTEMPTS = 3

class AssignmentService:
    """Handles atomic booking and assignment with fallback mechanism across ranked candidates."""

    @classmethod
    def attempt_atomic_assignment(
        cls,
        passenger_id: str,
        candidate: CandidateMatch,
        seats_count: int,
        luggage_tier: str = "small",
        passenger_notes: str = "",
        client: Optional[Client] = None
    ) -> Tuple[bool, Optional[BookingResponse], str]:
        """
        Execute atomic database assignment with row-level locking.
        Returns: (success, booking_response, error_message)
        """
        c = client or supabase_client
        trip = candidate.trip
        booking_ref = f"TR-{uuid.uuid4().hex[:5].upper()}"

        # Authoritative price calculation
        unit_price = float(trip.currentMarketPrice if trip.currentMarketPrice is not None else trip.pricePerSeat)
        luggage_fee = 100.0 if luggage_tier == "medium" else (200.0 if luggage_tier == "heavy" else 0.0)
        total_price = round(unit_price * seats_count + luggage_fee, 2)

        # 1. First attempt: Dedicated Phase 4 RPC `assign_and_book_matched_trip`
        try:
            rpc_res = c.rpc("assign_and_book_matched_trip", {
                "p_trip_id": trip.id,
                "p_passenger_id": passenger_id,
                "p_seats_count": seats_count,
                "p_luggage_tier": luggage_tier,
                "p_notes": passenger_notes,
                "p_total_paid": total_price,
                "p_booking_ref": booking_ref,
                "p_match_score": candidate.match_score,
                "p_assignment_type": "automatic"
            }).execute()

            if rpc_res.data and rpc_res.data.get("success"):
                booking_id = str(rpc_res.data["booking_id"])
                try:
                    c.table("bookings").update({"price_at_booking": unit_price}).eq("id", booking_id).execute()
                except Exception:
                    pass

                try:
                    from backend.pricing.service import PricingService
                    PricingService.handle_booking_event(trip.id, client=c)
                except Exception:
                    pass

                refreshed_trip = fetch_trip_by_id_from_db(trip.id, user_id=passenger_id, client=c) or trip
                booking = BookingResponse(
                    id=booking_id,
                    bookingRef=booking_ref,
                    trip=refreshed_trip,
                    seatsCount=seats_count,
                    totalPaid=total_price,
                    priceAtBooking=unit_price,
                    status="confirmed"
                )
                return True, booking, "Successfully assigned and booked"
            elif rpc_res.data:
                err_code = rpc_res.data.get("error_code")
                msg = rpc_res.data.get("message") or "RPC assignment declined"
                return False, None, f"{err_code}: {msg}"
        except Exception as rpc_e:
            rpc_err_msg = str(rpc_e)
            # If function does not exist yet in Postgres, fall through to book_trip_seats
            if "assign_and_book_matched_trip" not in rpc_err_msg and "P0004" in rpc_err_msg:
                return False, None, "Seats unavailable or already booked (P0004)"

        # 2. Fallback attempt: Standard `book_trip_seats` RPC
        try:
            rpc_res2 = c.rpc("book_trip_seats", {
                "p_trip_id": trip.id,
                "p_passenger_id": passenger_id,
                "p_seats_count": seats_count,
                "p_luggage_tier": luggage_tier,
                "p_notes": passenger_notes,
                "p_total_paid": total_price,
                "p_booking_ref": booking_ref
            }).execute()

            if rpc_res2.data and rpc_res2.data.get("success"):
                booking_id = str(rpc_res2.data["booking_id"])
                # Update matching metadata and frozen price_at_booking on booking
                try:
                    c.table("bookings").update({
                        "assignment_type": "automatic",
                        "match_score": candidate.match_score,
                        "price_at_booking": unit_price
                    }).eq("id", booking_id).execute()
                except Exception:
                    pass

                try:
                    from backend.pricing.service import PricingService
                    PricingService.handle_booking_event(trip.id, client=c)
                except Exception:
                    pass

                refreshed_trip = fetch_trip_by_id_from_db(trip.id, user_id=passenger_id, client=c) or trip
                booking = BookingResponse(
                    id=booking_id,
                    bookingRef=booking_ref,
                    trip=refreshed_trip,
                    seatsCount=seats_count,
                    totalPaid=total_price,
                    priceAtBooking=unit_price,
                    status="confirmed"
                )
                return True, booking, "Successfully assigned and booked"
            else:
                return False, None, "Booking failed"
        except Exception as e2:
            return False, None, str(e2)

    @classmethod
    def assign_with_fallback(
        cls,
        passenger_id: str,
        ranked_candidates: List[CandidateMatch],
        request: AssignmentRequest,
        client: Optional[Client] = None
    ) -> AssignmentResponse:
        """
        Assigns the best candidate trip.
        If top candidate becomes unavailable due to race condition,
        automatically cascades to the next candidate (up to MAX_ASSIGNMENT_ATTEMPTS = 3).
        """
        if not ranked_candidates:
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

        limit_attempts = min(len(ranked_candidates), request.max_fallback_attempts or MAX_ASSIGNMENT_ATTEMPTS)
        last_error = ""

        for attempt_idx in range(limit_attempts):
            candidate = ranked_candidates[attempt_idx]
            fallback_used = (attempt_idx > 0)

            success, booking, err_msg = cls.attempt_atomic_assignment(
                passenger_id=passenger_id,
                candidate=candidate,
                seats_count=request.seats,
                luggage_tier=request.luggage_tier or "small",
                passenger_notes=request.passenger_notes or "",
                client=client
            )

            if success and booking:
                status_text = "fallback_assigned" if fallback_used else "assigned"
                msg = (
                    f"Assigned to trip with match score {candidate.match_score:.1f}%."
                    if not fallback_used
                    else f"Your initial candidate was no longer available. Successfully matched with alternative trip (Match Score: {candidate.match_score:.1f}%)."
                )

                return AssignmentResponse(
                    assignment_id=f"asgn_{uuid.uuid4().hex[:8]}",
                    status=status_text,
                    booking=booking,
                    assigned_trip=candidate.trip,
                    match_score=candidate.match_score,
                    breakdown=candidate.breakdown,
                    attempts=attempt_idx + 1,
                    fallback_used=fallback_used,
                    message=msg
                )

            last_error = err_msg

        # All eligible attempts exhausted
        return AssignmentResponse(
            assignment_id=f"asgn_{uuid.uuid4().hex[:8]}",
            status="failed",
            booking=None,
            assigned_trip=None,
            match_score=None,
            breakdown=None,
            attempts=limit_attempts,
            fallback_used=True,
            message=f"No suitable trip is currently available. ({last_error or 'Seats became unavailable'})"
        )
