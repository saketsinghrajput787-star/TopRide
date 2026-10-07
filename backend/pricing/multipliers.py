from typing import Tuple, Literal, Optional, Union
from backend.config import (
    MIN_DEMAND_MULTIPLIER, MAX_DEMAND_MULTIPLIER,
    MIN_TIME_MULTIPLIER, MAX_TIME_MULTIPLIER,
    MIN_OCCUPANCY_MULTIPLIER, MAX_OCCUPANCY_MULTIPLIER,
    MIN_PRICE_MULTIPLIER, MAX_PRICE_MULTIPLIER,
    MINIMUM_PLATFORM_PRICE, PRICE_ROUNDING_UNIT
)

class PricingMultipliers:
    """Calculates continuous deterministic pricing multipliers and guardrails."""

    @staticmethod
    def get_demand_multiplier_and_level(dsr: float) -> Tuple[float, Literal["low", "normal", "high", "extreme"]]:
        """
        Calculate continuous, bounded demand/supply multiplier and qualitative level:
        - DSR <= 0.3: 0.90 (Low pressure)
        - 0.3 < DSR <= 1.0: Continuous interpolation from 0.90 to 1.00
        - 1.0 < DSR <= 2.5: Continuous interpolation from 1.00 to 1.20
        - DSR > 2.5: Smooth asymptotic increase capped at 1.30
        Clamped to [MIN_DEMAND_MULTIPLIER, MAX_DEMAND_MULTIPLIER].
        """
        if dsr <= 0.3:
            return MIN_DEMAND_MULTIPLIER, "low"
        elif dsr <= 1.0:
            # 0.3 -> 0.90, 1.0 -> 1.00
            mult = 0.90 + (dsr - 0.3) * (0.10 / 0.70)
            return round(mult, 4), "normal"
        elif dsr <= 2.5:
            # 1.0 -> 1.00, 2.5 -> 1.20
            mult = 1.00 + (dsr - 1.0) * (0.20 / 1.50)
            return round(mult, 4), "high"
        else:
            # > 2.5 -> smooth approach to 1.30
            mult = min(MAX_DEMAND_MULTIPLIER, 1.20 + (dsr - 2.5) * 0.05)
            return round(mult, 4), "extreme"

    @classmethod
    def calculate_demand_multiplier(cls, dsr_or_demand: float, supply: Optional[int] = None) -> float:
        """Calculate continuous bounded DSR multiplier as a float."""
        if supply is not None:
            dsr = float(dsr_or_demand) / max(int(supply), 1)
        else:
            dsr = float(dsr_or_demand)
        mult, _ = cls.get_demand_multiplier_and_level(dsr)
        return mult

    @staticmethod
    def calculate_time_multiplier(hours_to_departure: float, demand_supply_ratio: Optional[float] = None, dsr: Optional[float] = None) -> float:
        """
        Calculate time-to-departure pressure factor:
        - Far out (>= 24 hrs): 1.00 (neutral)
        - Close (< 24 hrs) + High demand (DSR > 1.2): modest urgency increase up to 1.06
        - Close (< 24 hrs) + Low demand (DSR < 0.8): incentive discount down to 0.95 to fill empty seats
        - Close (< 24 hrs) + Balanced demand: 1.00
        Does NOT punish low-demand trips near departure.
        Clamped to [MIN_TIME_MULTIPLIER, MAX_TIME_MULTIPLIER].
        """
        effective_dsr = demand_supply_ratio if demand_supply_ratio is not None else (dsr if dsr is not None else 1.0)
        if hours_to_departure >= 24.0:
            return 1.00

        # Hours factor scales linearly from 0 at 24h to 1 at 0h
        closeness = max(0.0, min(1.0, (24.0 - max(0.0, hours_to_departure)) / 24.0))

        if effective_dsr > 1.2:
            # High unmet demand near departure: modest surge
            urgency_intensity = min(1.5, (effective_dsr - 1.2) / 1.0)
            mult = 1.00 + (closeness * 0.06 * urgency_intensity)
            return round(min(MAX_TIME_MULTIPLIER, mult), 4)
        elif effective_dsr < 0.8:
            # Low demand near departure: modest discount to incentivize booking
            discount_intensity = min(1.0, (0.8 - effective_dsr) / 0.8)
            mult = 1.00 - (closeness * 0.05 * discount_intensity)
            return round(max(MIN_TIME_MULTIPLIER, mult), 4)
        else:
            return 1.00

    @staticmethod
    def calculate_occupancy_multiplier(arg1: int, arg2: int) -> float:
        """
        Calculate controlled occupancy factor based on trip capacity and booked seats.
        Supports both (booked_seats, total_seats) and (total_seats, available_seats).
        - 0% occupancy: 1.00
        - 50% occupancy: 1.01
        - 75% occupancy: 1.03
        - 100% occupancy: 1.05
        Strictly bounded to [MIN_OCCUPANCY_MULTIPLIER, MAX_OCCUPANCY_MULTIPLIER].
        """
        if arg1 <= arg2 and arg2 > 0:
            # (booked_seats, total_seats)
            booked_seats = max(0, arg1)
            total_seats = arg2
        else:
            # (total_seats, available_seats)
            total_seats = max(1, arg1)
            booked_seats = max(0, total_seats - arg2)

        occupancy_ratio = min(1.0, max(0.0, booked_seats / float(total_seats)))

        # Quadratic curve: 1.0 + 0.05 * (occupancy^2)
        mult = 1.00 + 0.05 * (occupancy_ratio ** 2)
        clamped = max(MIN_OCCUPANCY_MULTIPLIER, min(MAX_OCCUPANCY_MULTIPLIER, mult))
        return round(clamped, 4)

    @staticmethod
    def calculate_floor_and_ceiling(base_price: float) -> Tuple[float, float]:
        """Compute platform floor and ceiling guardrails for a given base price aligned to currency unit."""
        raw_floor = max(MINIMUM_PLATFORM_PRICE, base_price * MIN_PRICE_MULTIPLIER)
        raw_ceiling = base_price * MAX_PRICE_MULTIPLIER
        floor = round(raw_floor / PRICE_ROUNDING_UNIT) * PRICE_ROUNDING_UNIT
        ceiling = round(raw_ceiling / PRICE_ROUNDING_UNIT) * PRICE_ROUNDING_UNIT
        return float(floor), float(ceiling)

    @classmethod
    def apply_bounds_and_rounding(
        cls,
        raw_price: float,
        arg2: float,
        ceiling: Optional[float] = None
    ) -> Union[float, Tuple[float, float, float]]:
        """
        Apply price floor, ceiling, and platform currency increment rounding.
        If called as (raw_price, floor, ceiling): returns final_price float.
        If called as (raw_price, base_price): returns (final_price, floor, ceiling).
        """
        if ceiling is not None:
            # (raw_price, floor, ceiling)
            floor = arg2
            clamped = min(ceiling, max(floor, raw_price))
            final_price = round(clamped / PRICE_ROUNDING_UNIT) * PRICE_ROUNDING_UNIT
            final_price = min(ceiling, max(floor, final_price))
            return float(final_price)
        else:
            # (raw_price, base_price)
            base_price = arg2
            floor, ceil = cls.calculate_floor_and_ceiling(base_price)
            clamped = min(ceil, max(floor, raw_price))
            final_price = round(clamped / PRICE_ROUNDING_UNIT) * PRICE_ROUNDING_UNIT
            final_price = min(ceil, max(floor, final_price))
            return float(final_price), float(floor), float(ceil)
