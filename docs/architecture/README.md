# TopRide System Architecture

## Architecture Overview
TopRide is architected into three primary layers:

```
┌────────────────────────────────────────────────────────┐
│                   TopRide Web App                      │
│     React 19 + TypeScript + Vite + Tailwind CSS        │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON (0 Polling)
┌───────────────────────────▼────────────────────────────┐
│                  FastAPI Backend Server                │
│   - Candidate Generation & Spatial Filtering           │
│   - Deterministic Weighted Matching Engine (10-Step)   │
│   - Dynamic Market Pricing Engine (Supply & Demand)    │
│   - Atomic Seat Reservation & Immutability Ledger      │
└───────────────────────────┬────────────────────────────┘
                            │ Direct SQL / RLS
┌───────────────────────────▼────────────────────────────┐
│               Supabase PostgreSQL Database             │
│   - Stored Coordinates & Route Geometry Cache          │
│   - Atomic Transactions (pg_advisory / row locks)      │
└────────────────────────────────────────────────────────┘
```

## Key Invariants
1. **Zero External API Calls During Matching Loop**: Mapbox and Razorpay are never invoked inside candidate evaluation loops.
2. **Price Immutability**: `booking.price_at_booking` is frozen upon atomic booking creation and remains immutable.
3. **Deterministic Ranking**: Matching scores are calculated authoritatively on the backend using fixed transparent weights (35% Route, 20% Pickup, 15% Drop, 15% Time, 5% Price, 5% Rating, 5% Vehicle).
