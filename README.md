# TopRide 🚗📦⚡

> **Intelligent Intercity Ride-Sharing, Dynamic Market Pricing & P2P Logistics Platform**

TopRide is a high-performance full-stack mobility platform connecting intercity commuters, travelers, and students across India. It features an **algorithmic geospatial matching engine**, an **authoritative dynamic market pricing engine**, **Mapbox GL JS route visualization**, **Razorpay sandbox payments**, and **atomic transactional seat allocation** backed by Supabase PostgreSQL and FastAPI.

---

## 📑 Table of Contents

- [Architectural Overview](#-architectural-overview)
- [Key Engineering Highlights](#-key-engineering-highlights)
  - [Dynamic Market Pricing Engine (Phase 5)](#1-dynamic-market-pricing-engine)
  - [Automatic Geospatial Matching Engine (Phase 4)](#2-automatic-geospatial-matching-engine)
  - [Razorpay Payment Subsystem (Phase 3B & 3C)](#3-razorpay-payment-subsystem)
  - [Mapbox Integration & API Quota Preservation (Phase 3A)](#4-mapbox-integration--api-quota-preservation)
- [Technology Stack](#-technology-stack)
- [Database Schema & Migrations](#-database-schema--migrations)
- [API Reference](#-api-reference)
- [Getting Started & Local Setup](#-getting-started--local-setup)
- [Running Automated Tests](#-running-automated-tests)
- [License](#-license)

---

## 🏛️ Architectural Overview

```text
                                  React 19 + TypeScript (Vite + Tailwind CSS)
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       ▼                              ▼                              ▼
                 Mapbox GL JS               FastAPI Python Backend             Razorpay Checkout
           (Geocoding & Directions)          (Async REST Endpoints)           (Web Sandbox Modal)
                       │                              │                              │
                       │             ┌────────────────┴────────────────┐             │
                       │             ▼                                 ▼             │
                       │      Matching Engine               Dynamic Pricing Engine   │
                       │    (Geospatial Ranking)         (Multipliers, Floor/Cap)   │
                       │             │                                 │             │
                       └─────────────┼─────────────────────────────────┼─────────────┘
                                     ▼                                 ▼
                                       Supabase PostgreSQL Database
                                (Row Level Security, RPCs, Auth, Realtime)
```

---

## 🌟 Key Engineering Highlights

### 1. Dynamic Market Pricing Engine
The platform calculates deterministic, fair, and surge-protected prices for every corridor:
- **Platform Base Corridor Pricing**: Derived from fundamental route economics $(\text{Distance} \times ₹1.00 + \text{Duration} \times ₹0.15) \times \text{Vehicle Factor}$ using verified NHAI corridor benchmarks (e.g., NH44 Bengaluru–Hyderabad: 560 km, NH48 Bengaluru–Chennai: 345 km).
- **Continuous Demand/Supply Ratio (DSR)**: Continuous, monotonic multiplier strictly bounded to $[0.90, 1.30]$.
- **Time-to-Departure Urgency**: Linear urgency ramp for departure $< 24\text{ hours}$. High demand routes receive slight urgency lift ($1.00 - 1.06\times$), while low-demand routes receive an incentive discount ($0.95\times$) to fill empty seats.
- **Controlled Occupancy**: Quadratic curve factoring booked seats vs vehicle capacity, strictly bounded to $[1.00, 1.05\times]$.
- **Hard Price Floor & Ceiling Guardrails**: Enforces $\text{Floor} = \max(₹150, 0.85 \times \text{Base Price})$ and $\text{Ceiling} = 1.30 \times \text{Base Price}$ post-multiplier and currency rounding (nearest ₹10).
- **Guaranteed Booking Price Immutability**:
  $$\text{current\_market\_price} \longrightarrow \text{booking.price\_at\_booking} \longrightarrow \text{Razorpay order amount}$$
  Once booked, the price is permanently frozen on the booking record. Subsequent market surges or occupancy shifts cannot alter the customer's checkout total.
- **Anti-Arbitrary Driver Pricing**: Backend automatically rejects/overrides arbitrary prices (e.g. ₹1 or ₹10,000) with authoritative platform calculations.
- **Event-Driven Cache Invalidation**: In-memory 5-minute corridor pricing cache is invalidated on lifecycle events (`trip created/cancelled`, `booking created/cancelled`, `request created/cancelled`). Zero polling.

---

### 2. Automatic Geospatial Matching Engine
- **Spatial Pre-filtering**: Haversine circular proximity screening ($\le 25\text{ km}$ pickup radius, $\le 30\text{ km}$ destination radius) pre-filters hundreds of candidate trips before multi-objective evaluation.
- **Multi-Objective Scoring**:
  $$\text{Total Score} = 0.35 \times S_{\text{route}} + 0.25 \times S_{\text{time}} + 0.20 \times S_{\text{price}} + 0.15 \times S_{\text{rating}} + 0.05 \times S_{\text{vehicle}}$$
- **Deterministic Tie-Breaking**: Breaks score ties deterministically by earliest departure time, highest driver trips count, lowest seat price, and UUID lexicographical ordering.
- **Transactional Seat Allocation**: Atomically decrements seat inventory via Supabase PostgreSQL RPC `book_trip_seats` to eliminate race conditions under concurrent booking requests.

---

### 3. Razorpay Payment Subsystem
- **Order Generation**: Server-side calculation generates official Razorpay test orders with unique receipts.
- **HMAC-SHA256 Signature Verification**: Cryptographically verifies `razorpay_signature` using backend secrets:
  $$\text{HMAC-SHA256}(\text{order\_id} + "|" + \text{payment\_id}, \text{secret})$$
- **Idempotency & Replay Protection**: In-memory caching and PostgreSQL state checks prevent duplicate order creation on repeated button clicks.
- **409 Conflict vs Payment Decline Separation**: UI explicitly distinguishes concurrent seat reservation conflicts (HTTP 409) from genuine payment card declines.

---

### 4. Mapbox Integration & API Quota Preservation
- **Geocoding Autocomplete**: Real-time address lookups via Mapbox Geocoding v5 API with client-side debouncing.
- **Route Visualization**: Turn-by-turn driving polyline rendering with custom emerald (origin) and rose (destination) pins.
- **API Conservation Guarantee**: Exactly **0 Mapbox calls** inside scoring loops, candidate ranking, and dynamic pricing calculations. Coordinates and distances stored in PostgreSQL are reused unconditionally.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript 5, Vite 8, Tailwind CSS v4, Lucide React |
| **Backend** | FastAPI, Python 3.13, Pydantic v2, Uvicorn |
| **Database & Auth** | Supabase PostgreSQL, Row Level Security (RLS), Supabase Auth (JWT), Realtime |
| **Maps & Routing** | Mapbox GL JS v3, Mapbox Geocoding API, Mapbox Directions API |
| **Payments** | Razorpay Node/Python SDK, Razorpay Checkout Web Modal (Test Mode) |
| **Testing** | Pytest, AnyIO, TypeScript Compiler (`tsc`), Vitest |

---

## 🗄️ Database Schema & Migrations

All migrations are located in the project root and are ready to be run in the Supabase SQL editor:

| File | Purpose |
| :--- | :--- |
| `phase3b_razorpay_migration.sql` | Creates `payment_orders` table, idempotency columns, and payment state tracking. |
| `phase3c_payment_verification_migration.sql` | Adds Razorpay verification columns, payment audit triggers, and receipt storage. |
| `phase4_matching_migration.sql` | Adds geospatial coordinate indexing, passenger request routing metadata, and auto-match logs. |
| `phase5_dynamic_pricing_migration.sql` | Adds `current_market_price`, `base_price`, `pricing_metadata`, `price_at_booking`, and `price_history` audit table. |

---

## 🔌 API Reference

### Dynamic Pricing
- `POST /api/pricing/estimate` — Calculate dynamic market price breakdown for a route.
  ```json
  {
    "origin": "Bengaluru",
    "destination": "Hyderabad",
    "travelDate": "2026-10-17",
    "departureTime": "08:00",
    "originLat": 12.9716,
    "originLon": 77.5946,
    "destLat": 17.3850,
    "destLon": 78.4867,
    "totalSeats": 3,
    "availableSeats": 3,
    "vehicleCategory": "sedan"
  }
  ```

### Automatic Matching
- `POST /api/matching/find` — Search and rank compatible driver trips for a passenger request.
- `POST /api/matching/assign` — Automatically assign and reserve seats with atomic rollback guarantee.

### Razorpay Payments
- `POST /api/payments/razorpay-order` — Create authoritative Razorpay test order.
- `POST /api/payments/verify` — Verify cryptographic HMAC-SHA256 signature and confirm booking.
- `POST /api/payments/order-status` — Update payment order lifecycle status (`paid`, `failed`, `cancelled`).

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- **Node.js**: v18+ (Node 20+ recommended)
- **Python**: v3.10+ (Python 3.13 recommended)
- **Supabase Account**: Project URL & Anon Key
- **Mapbox Account**: Public Access Token (`pk.eyJ1...`)
- **Razorpay Account**: Test Key ID & Key Secret (`rzp_test_...`)

---

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/saketsinghrajput787-star/TopRide.git
cd TopRide

# Install frontend dependencies
npm install

# Install backend dependencies
pip install fastapi uvicorn supabase python-dotenv pydantic requests razorpay pytest
```

---

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Frontend Variables (Vite)
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_ACCESS_TOKEN=<your-mapbox-public-token>
VITE_RAZORPAY_KEY_ID=<your-razorpay-test-key-id>

# Backend Variables (FastAPI)
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_KEY=<your-supabase-service-or-anon-key>
MAPBOX_ACCESS_TOKEN=<your-mapbox-secret-or-public-token>
RAZORPAY_KEY_ID=<your-razorpay-test-key-id>
RAZORPAY_KEY_SECRET=<your-razorpay-test-key-secret>
```

---

### 3. Run Development Servers

```bash
# Start FastAPI backend (Terminal 1)
python -m uvicorn backend.main:app --port 8000 --host 127.0.0.1 --reload

# Start Vite frontend (Terminal 2)
npm run dev
```

Visit `http://localhost:5173` to explore the application.

---

## 🧪 Running Automated Tests

TopRide includes a test suite covering matching math, dynamic pricing guardrails, and quota safety:

```bash
# Run dynamic pricing, automatic matching, and API safety tests
python -m pytest backend/test_dynamic_pricing.py backend/test_automatic_matching.py backend/test_api_quota_safety.py -v

# Run frontend TypeScript type checking
npx tsc -b --noEmit

# Run production frontend build
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
