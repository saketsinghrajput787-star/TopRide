from typing import Optional, Dict, Any, Union, Literal
from pydantic import BaseModel, Field, model_validator, ConfigDict
import datetime

class MarketSegment(BaseModel):
    """Defines a scheduled carpool route market segment."""
    origin_name: str
    origin_lat: Optional[float] = None
    origin_lon: Optional[float] = None
    destination_name: str
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None
    date: str
    departure_time: str
    time_bucket: str = "morning"

class PriceBreakdown(BaseModel):
    """Authoritative dynamic market pricing breakdown and snapshot."""
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    base_price: float = Field(default=650.0, description="Route fundamental base price")
    demand_count: int = Field(default=0, description="Active passenger requests in market segment")
    supply_seats: int = Field(default=0, description="Available trip seats in market segment")
    demand_supply_ratio: float = Field(default=1.0, description="Demand / max(Supply, 1)")
    demand_level: Literal["low", "normal", "high", "extreme"] = "normal"
    demand_multiplier: float = Field(default=1.0, description="Continuous bounded DSR factor (0.90 - 1.30)")
    time_multiplier: float = Field(default=1.0, description="Urgency / departure window factor (0.95 - 1.08)")
    occupancy_multiplier: float = Field(default=1.0, description="Trip capacity occupancy factor (1.00 - 1.05)")
    combined_multiplier: float = Field(default=1.0, description="Net combined market multiplier")
    raw_price: float = Field(default=650.0, description="Pre-cap market price")
    floor: float = Field(default=550.0, description="Configured minimum price floor")
    ceiling: float = Field(default=845.0, description="Configured maximum price ceiling")
    final_price: float = Field(default=650.0, description="Final market price rounded to currency unit")
    currency: str = "₹"
    calculated_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    explanation: str = "Platform calculated market price"
    market_segment: str = ""

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            mapped = dict(data)
            if "basePrice" in mapped and "base_price" not in mapped:
                mapped["base_price"] = mapped.pop("basePrice")
            if "demandCount" in mapped and "demand_count" not in mapped:
                mapped["demand_count"] = mapped.pop("demandCount")
            if "supplySeats" in mapped and "supply_seats" not in mapped:
                mapped["supply_seats"] = mapped.pop("supplySeats")
            if "demandSupplyRatio" in mapped and "demand_supply_ratio" not in mapped:
                mapped["demand_supply_ratio"] = mapped.pop("demandSupplyRatio")
            if "demandMultiplier" in mapped and "demand_multiplier" not in mapped:
                mapped["demand_multiplier"] = mapped.pop("demandMultiplier")
            if "timeMultiplier" in mapped and "time_multiplier" not in mapped:
                mapped["time_multiplier"] = mapped.pop("timeMultiplier")
            if "occupancyMultiplier" in mapped and "occupancy_multiplier" not in mapped:
                mapped["occupancy_multiplier"] = mapped.pop("occupancyMultiplier")
            if "rawPrice" in mapped and "raw_price" not in mapped:
                mapped["raw_price"] = mapped.pop("rawPrice")
            if "priceFloor" in mapped and "floor" not in mapped:
                mapped["floor"] = mapped.pop("priceFloor")
            if "priceCeiling" in mapped and "ceiling" not in mapped:
                mapped["ceiling"] = mapped.pop("priceCeiling")
            if "finalPrice" in mapped and "final_price" not in mapped:
                mapped["final_price"] = mapped.pop("finalPrice")
            if "marketSegment" in mapped and "market_segment" not in mapped:
                mapped["market_segment"] = mapped.pop("marketSegment")
            return mapped
        return data

    @property
    def basePrice(self) -> float:
        return self.base_price

    @property
    def finalPrice(self) -> float:
        return self.final_price

    @property
    def priceFloor(self) -> float:
        return self.floor

    @property
    def priceCeiling(self) -> float:
        return self.ceiling

    @property
    def demandSupplyRatio(self) -> float:
        return self.demand_supply_ratio

    @property
    def demandMultiplier(self) -> float:
        return self.demand_multiplier

    @property
    def timeMultiplier(self) -> float:
        return self.time_multiplier

    @property
    def occupancyMultiplier(self) -> float:
        return self.occupancy_multiplier

    @property
    def marketSegment(self) -> str:
        return self.market_segment

class PriceEstimateRequest(BaseModel):
    """Request payload for estimating or retrieving market price."""
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    origin: Union[str, Dict[str, Any]]
    destination: Union[str, Dict[str, Any]]
    date: str = "Today"
    departure_time: str = "08:00"
    vehicle_category: Optional[str] = "sedan"
    total_seats: Optional[int] = 3
    available_seats: Optional[int] = 3
    origin_latitude: Optional[float] = None
    origin_longitude: Optional[float] = None
    destination_latitude: Optional[float] = None
    destination_longitude: Optional[float] = None
    duration_str: Optional[str] = None
    route_geometry: Optional[Any] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            mapped = dict(data)
            if "travelDate" in mapped:
                mapped["date"] = mapped["travelDate"]
            if "departureTime" in mapped:
                mapped["departure_time"] = mapped["departureTime"]
            if "vehicleCategory" in mapped:
                mapped["vehicle_category"] = mapped["vehicleCategory"]
            if "totalSeats" in mapped:
                mapped["total_seats"] = mapped["totalSeats"]
            if "availableSeats" in mapped:
                mapped["available_seats"] = mapped["availableSeats"]
            if "originLat" in mapped:
                mapped["origin_latitude"] = mapped["originLat"]
            if "originLon" in mapped:
                mapped["origin_longitude"] = mapped["originLon"]
            if "destLat" in mapped:
                mapped["destination_latitude"] = mapped["destLat"]
            if "destLon" in mapped:
                mapped["destination_longitude"] = mapped["destLon"]
            if "durationStr" in mapped:
                mapped["duration_str"] = mapped["durationStr"]
            if "routeGeometry" in mapped:
                mapped["route_geometry"] = mapped["routeGeometry"]
            return mapped
        return data
