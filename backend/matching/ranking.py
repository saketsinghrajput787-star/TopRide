from typing import List
from backend.matching.models import CandidateMatch

class Ranker:
    """Ranks candidates deterministically with rigorous tie-breaking rules."""

    @classmethod
    def rank_candidates(cls, candidates: List[CandidateMatch]) -> List[CandidateMatch]:
        """
        Sort candidates in descending order of desirability:
        1. Higher match score
        2. Smaller pickup distance
        3. Smaller departure-time difference
        4. Higher rating confidence (rating score / count)
        5. Lower price per seat
        6. Earlier trip creation / ID tie breaker (deterministic)
        """
        def sort_key(c: CandidateMatch):
            # Negate higher values to sort descending
            rating_confidence = c.raw.driver_average_rating if c.raw.driver_rating_count >= 2 else 0.0
            return (
                -c.match_score,                          # 1. Higher match score
                c.raw.pickup_distance_km,                # 2. Smaller pickup distance
                c.raw.time_difference_minutes,           # 3. Smaller departure-time difference
                -rating_confidence,                      # 4. Higher rating confidence
                float(c.trip.pricePerSeat),              # 5. Lower price
                str(c.trip.id)                           # 6. Deterministic tie breaker
            )

        return sorted(candidates, key=sort_key)
