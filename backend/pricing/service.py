import datetime
from typing import Optional, List, Dict, Any
from supabase import Client
from backend.config import PRICE_RECALCULATION_THRESHOLD
from backend.pricing.engine import DynamicPricingEngine
from backend.pricing.market_analyzer import MarketAnalyzer
from backend.database import supabase_client

class PricingService:
    """Coordinates database updates, event-driven recalculation, and audit logging."""

    @classmethod
    def recalculate_trips_for_market(
        cls,
        origin_name: str,
        dest_name: str,
        date_str: str,
        client: Optional[Client] = None,
        trigger_event: str = "market_event"
    ) -> List[Dict[str, Any]]:
        """
        Event-driven recalculation:
        Triggered when a trip is created/cancelled, booking is made/cancelled,
        or passenger request is added/removed.
        Recalculates current_market_price for affected upcoming trips and records audit snapshots.
        Zero external Mapbox or Razorpay calls.
        """
        c = client or supabase_client
        # Invalidate in-memory pricing cache for this corridor
        DynamicPricingEngine.invalidate_cache(origin_name, dest_name)

        updated_records = []
        try:
            # Fetch upcoming trips for the date
            trips_res = c.table("trips").select("*").eq("date", date_str).eq("status", "upcoming").execute()
            if not trips_res.data:
                return []

            for trip_row in trips_res.data:
                t_orig = trip_row.get("origin", "")
                t_dest = trip_row.get("destination", "")
                t_olat = trip_row.get("origin_latitude")
                t_olon = trip_row.get("origin_longitude")
                t_dlat = trip_row.get("destination_latitude")
                t_dlon = trip_row.get("destination_longitude")

                # Check if trip belongs to affected geographic market segment
                if not (MarketAnalyzer.is_location_in_zone(t_orig, t_olat, t_olon, origin_name, None, None) and
                        MarketAnalyzer.is_location_in_zone(t_dest, t_dlat, t_dlon, dest_name, None, None)):
                    continue

                trip_id = str(trip_row["id"])
                old_price = float(trip_row.get("current_market_price") or trip_row.get("price_per_seat") or 0.0)

                # Calculate fresh dynamic market price
                breakdown = DynamicPricingEngine.calculate_price(
                    origin=t_orig,
                    destination=t_dest,
                    date=date_str,
                    departure_time=trip_row.get("departure_time", "08:00"),
                    vehicle=trip_row.get("vehicle"),
                    total_seats=int(trip_row.get("total_seats") or 3),
                    available_seats=int(trip_row.get("available_seats") or 3),
                    origin_lat=t_olat,
                    origin_lon=t_olon,
                    dest_lat=t_dlat,
                    dest_lon=t_dlon,
                    stored_distance_km=float(trip_row["distance_km"]) if trip_row.get("distance_km") is not None else None,
                    stored_duration_str=trip_row.get("duration"),
                    client=c,
                    skip_cache=True
                )

                new_price = breakdown.final_price

                # Anti-flapping: Update database and audit trail
                update_payload = {
                    "current_market_price": new_price,
                    "price_per_seat": new_price,
                    "base_price": breakdown.base_price,
                    "pricing_metadata": breakdown.model_dump(),
                    "price_updated_at": breakdown.calculated_at
                }

                try:
                    c.table("trips").update(update_payload).eq("id", trip_id).execute()
                except Exception as up_err:
                    print(f"[Pricing] Update trip notice: {up_err}")

                # If price changed significantly, log to price_history table
                if abs(new_price - old_price) >= PRICE_RECALCULATION_THRESHOLD or old_price == 0.0:
                    try:
                        history_payload = {
                            "trip_id": trip_id,
                            "market_origin": t_orig,
                            "market_destination": t_dest,
                            "travel_date": date_str,
                            "base_price": breakdown.base_price,
                            "demand_count": breakdown.demand_count,
                            "supply_seats": breakdown.supply_seats,
                            "demand_supply_ratio": breakdown.demand_supply_ratio,
                            "demand_multiplier": breakdown.demand_multiplier,
                            "time_multiplier": breakdown.time_multiplier,
                            "occupancy_multiplier": breakdown.occupancy_multiplier,
                            "price_floor": breakdown.floor,
                            "price_ceiling": breakdown.ceiling,
                            "final_price": new_price,
                            "trigger_event": trigger_event
                        }
                        c.table("price_history").insert(history_payload).execute()
                    except Exception:
                        pass # Table might not exist yet before migration

                updated_records.append({
                    "trip_id": trip_id,
                    "old_price": old_price,
                    "new_price": new_price,
                    "breakdown": breakdown
                })

        except Exception as e:
            print(f"[Pricing] recalculate_trips_for_market notice: {e}")

        return updated_records

    @classmethod
    def handle_trip_event(
        cls,
        trip_id: str,
        client: Optional[Client] = None,
        event_type: str = "trip_event"
    ) -> List[Dict[str, Any]]:
        """Invalidate corridor cache and recalculate dynamic market prices when trip is created or cancelled."""
        c = client or supabase_client
        try:
            res = c.table("trips").select("origin, destination, date").eq("id", trip_id).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                orig = row.get("origin", "")
                dest = row.get("destination", "")
                dt = row.get("date", "")
                if orig and dest and dt:
                    return cls.recalculate_trips_for_market(orig, dest, dt, client=c, trigger_event=event_type)
        except Exception as e:
            print(f"[Pricing] handle_trip_event notice: {e}")
        return []

    @classmethod
    def handle_booking_event(
        cls,
        trip_id: str,
        client: Optional[Client] = None,
        event_type: str = "booking_event"
    ) -> List[Dict[str, Any]]:
        """Invalidate corridor cache and recalculate dynamic market prices when booking is created or cancelled."""
        return cls.handle_trip_event(trip_id, client=client, event_type=event_type)

    @classmethod
    def handle_passenger_request_event(
        cls,
        request_id: str,
        client: Optional[Client] = None,
        event_type: str = "request_event"
    ) -> List[Dict[str, Any]]:
        """Invalidate corridor cache and recalculate dynamic market prices when passenger request is created or cancelled."""
        c = client or supabase_client
        try:
            res = c.table("passenger_requests").select("origin, destination, date").eq("id", request_id).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                orig = row.get("origin", "")
                dest = row.get("destination", "")
                dt = row.get("date", "")
                if orig and dest and dt:
                    return cls.recalculate_trips_for_market(orig, dest, dt, client=c, trigger_event=event_type)
        except Exception as e:
            print(f"[Pricing] handle_passenger_request_event notice: {e}")
        return []
