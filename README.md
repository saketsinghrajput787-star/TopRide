# TopRide 🚗📦

> **Full-Stack Intercity Ride-Sharing, Passenger Matching & Peer-to-Peer Luggage Delivery Platform**

TopRide connects commuters, travelers, and students heading in the same direction to share empty car seats and transport parcels along active highway corridors across India. Powered by real-time Mapbox maps, FastAPI, and Supabase PostgreSQL.

---

## 🌟 Key Highlights & Capabilities

### 🗺️ Phase 3A: Real Mapbox Location & Route Visualization
- **Live Autocomplete Search**: Integrated Mapbox Places Geocoding v5 API for real cities, airports, tech parks, college campuses, and addresses (e.g., *Koramangala, Bengaluru* → *Hitech City, Hyderabad*).
- **Interactive Route Visualization**: Mapbox GL JS light styling with dynamic driving directions, turn geometry, distance calculation (km), and travel duration pills.
- **Custom Location Markers**: High-contrast Emerald (`A` origin) and Rose (`B` destination) pins with animated fit-bounds camera framing.
- **Resilient Fallback**: Graceful offline/legacy trip handling for historical records lacking geographic coordinates.

### 🚙 Ride Publishing & Search
- **Driver Trip Publishing**: Dynamic departure/arrival scheduling, seat counts, luggage allowance tiers, vehicle association, and custom trip rules.
- **Smart Filter & Discovery**: Instant booking filters, price ceiling sliders, time windows (Morning/Afternoon/Evening), verified driver badges, and sorting (Cheapest, Earliest, Highest Rated).
- **Atomic Concurrency Booking**: Real seat reservation backed by transactional locking and Supabase PostgreSQL RPCs to eliminate double-booking race conditions.

### 👥 Passenger Requests & 📦 Luggage Logistics
- **Passenger Requests**: Travelers broadcast desired travel corridors with custom budgets and preferences, enabling drivers to offer seats directly.
- **P2P Luggage Corridors**: Peer-to-peer delivery for documents and parcel packages (<5kg, <15kg, <25kg) with verified drivers traveling along the route.

### 💬 Real-Time Chat & Notifications
- In-app messaging between passengers and drivers with unread counters and Supabase Realtime synchronization.
- Status notifications for trip publishing, confirmations, seat locks, and cancellations.

### 🛡️ Trust & Verification
- Supabase Authentication (JWT Bearer tokens & RLS policies).
- Multi-tier identity checks: Govt ID verification and Student Verification (.edu / verified college domains).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React |
| **Maps & Routing** | Mapbox GL JS (v3.32), Mapbox Geocoding Places API, Mapbox Directions API |
| **Backend** | FastAPI, Python 3.13, Pydantic v2, Uvicorn |
| **Database & Auth** | Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS), Supabase Realtime |

---

## 📐 Architecture Overview

```text
               React 19 + TypeScript (Vite + Tailwind CSS)
                                   │
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
        Mapbox Web Services                  FastAPI Backend (Python)
      (Places & Directions API)              (REST Endpoints & Validation)
                                                     │
                                                     ▼
                                          Supabase PostgreSQL
                                     (Auth, RLS, Storage, Realtime)
```

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- **Node.js**: v18+ (Node 20+ recommended)
- **Python**: v3.10+ (Python 3.13 supported)
- **Mapbox Account**: Public Access Token (`pk.eyJ1...`)
- **Supabase Project**: Project URL & Anon Key

---

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/saketsinghrajput787-star/TopRide.git
cd TopRide

# Install frontend dependencies
npm install

# Install backend dependencies
pip install fastapi uvicorn supabase python-dotenv pydantic requests
```

---

### 2. Configure Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
# Frontend Configuration
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_API_URL=http://localhost:8000
VITE_MAPBOX_ACCESS_TOKEN=<your-mapbox-public-access-token>

# Backend Configuration (FastAPI)
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=
PORT=8000
MAPBOX_ACCESS_TOKEN=<your-mapbox-public-access-token>
```

---

### 3. Database Migration

Run the migration script in your **Supabase Dashboard > SQL Editor**:
- Open [phase3a_mapbox_migration.sql](phase3a_mapbox_migration.sql)
- Execute the SQL script to create the spatial coordinates columns (`origin_latitude`, `destination_latitude`, etc.) and performance indexes.

---

### 4. Run the Application

Start the backend and frontend dev servers:

```bash
# Terminal 1: Start FastAPI Backend
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2: Start Vite Frontend
npm run dev
```

The application will be live at:
- **Frontend App**: [http://localhost:5173/](http://localhost:5173/)
- **FastAPI API**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🧪 Testing & Verification

```bash
# Type check frontend code
npx tsc --noEmit

# Production bundle build
npm run build

# Run Phase 3A Mapbox automated verification test
python -m backend.test_phase3a_mapbox

# Run Arjun & Saket multi-user regression flow
python -m backend.test_arjun_saket_mandatory
```

---

## 📂 Project Structure

```text
TopRide/
├── backend/
│   ├── config.py                     # Environment variables & Supabase config
│   ├── database.py                   # Data access layer, Supabase clients & RPCs
│   ├── main.py                       # FastAPI application & REST routes
│   ├── schemas.py                    # Pydantic v2 schemas & request validation
│   └── test_phase3a_mapbox.py        # Automated test suite for Mapbox coordinates
├── src/
│   ├── components/
│   │   ├── LocationSearchInput.tsx   # Mapbox places autocomplete component
│   │   ├── MapRoutePreview.tsx       # Mapbox GL route visualizer & marker component
│   │   ├── MapPreview.tsx            # Route map wrapper
│   │   ├── Navbar.tsx                # Responsive top navigation & profile badge
│   │   └── BottomNav.tsx             # Mobile navigation bar
│   ├── services/
│   │   └── mapbox.ts                 # Mapbox API service (Geocoding & Directions)
│   ├── views/
│   │   ├── FindView.tsx              # Ride discovery & corridor search view
│   │   ├── PostTripView.tsx          # Driver trip publisher with live map preview
│   │   ├── TripDetailsView.tsx       # Detailed itinerary with Mapbox map & route
│   │   ├── BookingFlow.tsx           # Multi-step checkout & seat booking
│   │   ├── PostRequestView.tsx       # Passenger ride request view
│   │   ├── LuggageFlow.tsx           # P2P luggage delivery matching flow
│   │   ├── TripsView.tsx             # My Trips & shipments management
│   │   ├── InboxView.tsx             # Real-time passenger-driver chat
│   │   └── AccountView.tsx           # Vehicles, verification & user profile
│   ├── api.ts                        # Frontend HTTP API service & Supabase client
│   ├── types.ts                      # Shared TypeScript data models
│   ├── App.tsx                       # Main application state & screen routing
│   └── index.css                     # Design tokens & Tailwind CSS v4 setup
├── phase3a_mapbox_migration.sql      # Database migration script for coordinates
├── package.json                      # Project dependencies & scripts
├── vite.config.ts                    # Vite bundler configuration
└── README.md                         # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
