# TopRide Database Architecture

This directory contains the database schemas, migrations, seeds, and SQL functions for TopRide powered by Supabase PostgreSQL.

## Directory Structure
- `migrations/`: Phased SQL schema migrations (Phase 2 to Phase 5).
  - `phase2a_migration.sql`: Core users, vehicles, and initial tables.
  - `phase2_remaining_migration.sql`: Profiles, verification statuses, and reviews.
  - `phase3a_mapbox_migration.sql`: GeoJSON coordinates and route corridors.
  - `phase3b_razorpay_migration.sql`: Escrow transactions and payments schema.
  - `phase3c_payment_verification_migration.sql`: Payment verification receipts.
  - `phase4_matching_migration.sql`: Spatial candidate filtering and assignment logs.
  - `phase5_dynamic_pricing_migration.sql`: Corridor supply/demand metrics and pricing history.
- `seeds/`: Seed data for development and testing environments.
- `functions/`: Custom PostgreSQL functions, stored procedures, and triggers.
- `supabase_schema.sql`: Consolidated authoritative schema definition.
