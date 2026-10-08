# TopRide Deployment Preparation Guide (Phase 1)

This document outlines the target deployment architecture and environment security model for TopRide.

---

## 🏗️ Target Deployment Architecture

- **Frontend Client**: Vercel (Vite React 19 Single Page Application)
- **Backend Server**: Render (FastAPI Python ASGI Web Service)
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security)
- **Geospatial & Maps**: Mapbox
- **Payments**: Razorpay (TEST MODE ONLY)

```text
Browser
   ↓
Vercel (Frontend SPA)
   ↓
Render (FastAPI Backend)
   ↓
Supabase (PostgreSQL / Auth)
```

### Additional Service Connections:
- `Render (Backend)` → `Mapbox` (Route corridor geocoding & fallback)
- `Render (Backend)` → `Razorpay` (Order creation & webhook signature verification)

---

## 🔐 Environment & Secret Separation Policy

1. **Frontend Environment Variables (`VITE_*`)**:
   - Exposed to the browser bundle during build time.
   - Must contain **ONLY** public identifiers and endpoints:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_API_URL`
     - `VITE_MAPBOX_ACCESS_TOKEN`
     - `VITE_RAZORPAY_KEY_ID` (Public Test Key)
   - **NEVER** expose backend secrets in frontend variables.

2. **Backend Environment Variables (Private Secrets)**:
   - Evaluated strictly within the server-side runtime environment (Render / container).
   - **Supabase Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`): Backend-only administrative access.
   - **Razorpay Key Secret** (`RAZORPAY_KEY_SECRET`): Backend-only signing and order creation secret.
   - **Razorpay Webhook Secret** (`RAZORPAY_WEBHOOK_SECRET`): Backend-only webhook verification secret.
   - **Database Connection String** (`DATABASE_URL`): Backend-only PostgreSQL URI.

3. **Payment Mode Policy**:
   - Razorpay remains in **TEST MODE ONLY** (`rzp_test_*`) during initial development and deployment.
   - Real payment / live keys (`rzp_live_*`) are **NOT** configured in Phase 1.
