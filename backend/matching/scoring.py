from typing import Tuple
from backend.matching.models import FeatureBreakdown, ScoringWeights, FeatureRaw

class WeightedScorer:
    """Combines normalized feature scores with predefined weights into final match score."""

    DEFAULT_WEIGHTS = ScoringWeights()

    @classmethod
    def calculate_score(
        cls,
        breakdown: FeatureBreakdown,
        weights: ScoringWeights = DEFAULT_WEIGHTS
    ) -> float:
        """
        Calculate final deterministic match score (0-100).
        match_score =
            route_score * 0.35
          + pickup_score * 0.20
          + drop_score * 0.15
          + time_score * 0.15
          + price_score * 0.05
          + rating_score * 0.05
          + vehicle_score * 0.05
        """
        final_score = (
            breakdown.route * weights.route
            + breakdown.pickup * weights.pickup
            + breakdown.drop * weights.drop
            + breakdown.time * weights.time
            + breakdown.price * weights.price
            + breakdown.rating * weights.rating
            + breakdown.vehicle * weights.vehicle
        )
        return round(final_score, 2)

    @classmethod
    def generate_explanation(
        cls,
        breakdown: FeatureBreakdown,
        raw: FeatureRaw,
        score: float
    ) -> str:
        """Generate human-readable explainability justification for the match."""
        reasons = []

        if breakdown.route >= 90:
            reasons.append("exact route alignment")
        elif breakdown.route >= 70:
            reasons.append("compatible route corridor")

        if raw.pickup_distance_km <= 2.0:
            reasons.append(f"close pickup ({raw.pickup_distance_km} km away)")
        elif raw.pickup_distance_km <= 5.0:
            reasons.append(f"convenient pickup ({raw.pickup_distance_km} km)")

        if raw.time_difference_minutes <= 15:
            reasons.append(f"scheduled within {raw.time_difference_minutes} min of requested time")

        if breakdown.price >= 90:
            reasons.append("within target budget")

        if raw.driver_is_new:
            reasons.append("verified new driver")
        elif raw.driver_average_rating >= 4.7:
            reasons.append(f"top-rated driver ({raw.driver_average_rating}★)")

        if not reasons:
            return f"Overall match score of {score:.1f}% based on route, schedule, and pricing."

        return f"Recommended because of {', '.join(reasons)}."
