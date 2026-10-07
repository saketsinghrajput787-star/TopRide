import datetime
from typing import Optional, Dict, Any, Union, Tuple
from supabase import Client
from backend.pricing.models import PriceBreakdown, PriceEstimateRequest
from backend.pricing.base_price import BasePriceEngine
from backend.pricing.multipliers import PricingMultipliers
from backend.pricing.market_analyzer import (
    MarketAnalyzer, calculate_hours_to_departure, parse_time_bucket
)
from backend.matching.feature_calculator import extract_location_info

class DynamicPricingEngine:
    """
    TopRide Production-Ready Dynamic Market Pricing Engine.
    Executes the 10-step market pricing pipeline:
    1. Market Segment Resolution (Geographic Corridor + Date + Time Bucket)
    2. Route Distance & Duration Resolution (0 Mapbox calls)
    3. Vehicle Factor Resolution
    4. Base Market Price Calculation
    5. Real Demand & Supply Aggregation
    6. Continuous Bounded Demand/Supply Multiplier
    7. Time-to-Departure Multiplier (High demand urgency vs Low demand discount)
    8. Controlled Occupancy Adjustment (Bounded to 1.00 - 1.05)
    9. Strict Price Floor & Price Ceiling Enforcement
    10. Platform Currency Rounding & Snapshot Creation
    """

    # In-memory cache for market pricing to prevent redundant database aggregates
    _pricing_cache: Dict[str, Tuple[datetime.datetime, PriceBreakdown]] = {}
    CACHE_TTL_SECONDS = 300 # 5 minutes

    @classmethod
    def invalidate_cache(cls, market_origin: Optional[str] = None, market_dest: Optional[str] = None):
        """Invalidate pricing cache when events (trip posted, booking, request) occur."""
        if not market_origin and not market_dest:
            cls._pricing_cache.clear()
            return
        keys_to_del = []
        for k in cls._pricing_cache.keys():
            if (market_origin and market_origin.lower() in k) or (market_dest and market_dest.lower() in k):
                keys_to_del.append(k)
        for k in keys_to_del:
            cls._pricing_cache.pop(k, None)

    @classmethod
    def calculate_price(
        cls,
        origin: Union[str, Dict[str, Any], Any],
        destination: Optional[Union[str, Dict[str, Any], Any]] = None,
        date: Optional[str] = None,
        departure_time: Optional[str] = None,
        vehicle: Any = None,
        total_seats: int = 3,
        available_seats: int = 3,
        origin_lat: Optional[float] = None,
        origin_lon: Optional[float] = None,
        dest_lat: Optional[float] = None,
        dest_lon: Optional[float] = None,
        stored_distance_km: Optional[float] = None,
        stored_duration_str: Optional[str] = None,
        override_demand_count: Optional[int] = None,
        override_supply_seats: Optional[int] = None,
        override_hours_to_departure: Optional[float] = None,
        client: Optional[Client] = None,
        skip_cache: bool = False
    ) -> PriceBreakdown:
        """
        Calculate authoritative platform market price for a scheduled carpool trip.
        Zero external Mapbox or Razorpay calls.
        """
        # If passed PriceEstimateRequest or similar object as first arg:
        if isinstance(origin, PriceEstimateRequest) or (hasattr(origin, "origin") and hasattr(origin, "destination")):
            req = origin
            return cls.calculate_price(
                origin=req.origin,
                destination=req.destination,
                date=getattr(req, "date", getattr(req, "travelDate", "Today")),
                departure_time=getattr(req, "departure_time", getattr(req, "departureTime", "08:00")),
                vehicle=getattr(req, "vehicle_category", getattr(req, "vehicleCategory", "sedan")),
                total_seats=int(getattr(req, "total_seats", getattr(req, "totalSeats", 3)) or 3),
                available_seats=int(getattr(req, "available_seats", getattr(req, "availableSeats", 3)) or 3),
                origin_lat=getattr(req, "origin_latitude", getattr(req, "originLat", None)),
                origin_lon=getattr(req, "origin_longitude", getattr(req, "originLon", None)),
                dest_lat=getattr(req, "destination_latitude", getattr(req, "destLat", None)),
                dest_lon=getattr(req, "destination_longitude", getattr(req, "destLon", None)),
                stored_distance_km=getattr(req, "route_distance_km", None),
                stored_duration_str=getattr(req, "duration_str", getattr(req, "durationStr", None)),
                override_demand_count=override_demand_count,
                override_supply_seats=override_supply_seats,
                override_hours_to_departure=override_hours_to_departure,
                client=client,
                skip_cache=skip_cache
            )

        eff_date = date or "Today"
        eff_time = departure_time or "08:00"
        eff_dest = destination or ""

        # 1. Resolve origin and destination information
        o_name, ext_o_lat, ext_o_lon = extract_location_info(origin)
        d_name, ext_d_lat, ext_d_lon = extract_location_info(eff_dest)

        eff_o_lat = origin_lat if origin_lat is not None else ext_o_lat
        eff_o_lon = origin_lon if origin_lon is not None else ext_o_lon
        eff_d_lat = dest_lat if dest_lat is not None else ext_d_lat
        eff_d_lon = dest_lon if dest_lon is not None else ext_d_lon

        time_bucket = parse_time_bucket(eff_time)

        # Cache lookup
        cache_key = f"{o_name.lower()}:{d_name.lower()}:{eff_date}:{time_bucket}:{total_seats}:{available_seats}:{str(vehicle)}"
        now = datetime.datetime.now(datetime.timezone.utc)
        if not skip_cache and override_demand_count is None and override_supply_seats is None:
            if cache_key in cls._pricing_cache:
                cached_time, cached_breakdown = cls._pricing_cache[cache_key]
                if (now - cached_time).total_seconds() < cls.CACHE_TTL_SECONDS:
                    return cached_breakdown

        # 2. Base Market Price Calculation
        base_price = BasePriceEngine.calculate_base_price(
            origin_name=o_name,
            dest_name=d_name,
            origin_lat=eff_o_lat,
            origin_lon=eff_o_lon,
            dest_lat=eff_d_lat,
            dest_lon=eff_d_lon,
            stored_distance_km=stored_distance_km,
            stored_duration_str=stored_duration_str,
            vehicle=vehicle
        )

        # 3. Market Demand and Supply Aggregation
        if override_demand_count is not None and override_supply_seats is not None:
            demand_count = override_demand_count
            supply_seats = override_supply_seats
            dsr = round(float(demand_count) / max(float(supply_seats), 1.0), 2)
        else:
            demand_count, supply_seats, dsr = MarketAnalyzer.aggregate_market_supply_and_demand(
                origin_name=o_name,
                dest_name=d_name,
                date_str=eff_date,
                origin_lat=eff_o_lat,
                origin_lon=eff_o_lon,
                dest_lat=eff_d_lat,
                dest_lon=eff_d_lon,
                client=client
            )

        # 4. Multipliers
        demand_mult, demand_level = PricingMultipliers.get_demand_multiplier_and_level(dsr)

        hours_left = (
            override_hours_to_departure
            if override_hours_to_departure is not None
            else calculate_hours_to_departure(eff_date, eff_time)
        )
        time_mult = PricingMultipliers.calculate_time_multiplier(hours_left, dsr)
        occ_mult = PricingMultipliers.calculate_occupancy_multiplier(total_seats, available_seats)

        combined_mult = round(demand_mult * time_mult * occ_mult, 4)
        raw_price = round(base_price * combined_mult, 2)

        # 5. Price Floor, Ceiling & Rounding
        final_price, floor, ceiling = PricingMultipliers.apply_bounds_and_rounding(raw_price, base_price)

        # 6. Explanation construction
        explanation_parts = []
        if demand_level == "low":
            explanation_parts.append(f"Low demand discount applied ({int((1.0 - demand_mult) * 100)}% off base)")
        elif demand_level in ["high", "extreme"]:
            explanation_parts.append(f"High passenger demand on route (+{int((demand_mult - 1.0) * 100)}% market adjustment)")
        else:
            explanation_parts.append("Normal marketplace demand")

        if occ_mult > 1.01:
            explanation_parts.append(f"High occupancy adjustment (+{int((occ_mult - 1.0) * 100)}%)")

        if final_price >= ceiling:
            explanation_parts.append(f"Capped at platform maximum ceiling (₹{ceiling:.0f})")
        elif final_price <= floor:
            explanation_parts.append(f"Floor protected (minimum ₹{floor:.0f})")

        explanation = "; ".join(explanation_parts)

        breakdown = PriceBreakdown(
            base_price=base_price,
            demand_count=demand_count,
            supply_seats=supply_seats,
            demand_supply_ratio=dsr,
            demand_level=demand_level,
            demand_multiplier=demand_mult,
            time_multiplier=time_mult,
            occupancy_multiplier=occ_mult,
            combined_multiplier=combined_mult,
            raw_price=raw_price,
            floor=floor,
            ceiling=ceiling,
            final_price=final_price,
            currency="₹",
            calculated_at=now.isoformat(),
            explanation=explanation
        )

        # Store in cache
        if override_demand_count is None and override_supply_seats is None:
            cls._pricing_cache[cache_key] = (now, breakdown)

        return breakdown
