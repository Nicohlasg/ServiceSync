# ServiceSync V2 — Backend Implementation

## Overview

ServiceSync is a PWA for Singapore solo home-service technicians. This document covers the complete backend: database schema, tRPC API routers, route-optimized booking, CRM, and invoice management for IRAS tax compliance.

## Architecture

- **Database**: Supabase Postgres with Row-Level Security (RLS)
- **API**: tRPC v11 served via Next.js API route (`/api/trpc`)
- **Auth**: Supabase Auth (email/password + magic link)
- **Storage**: Supabase Storage for invoice PDFs
- **Realtime**: Supabase Realtime for live ETA tracking
- **Notifications**: Web Push API (free, browser-native)

---

## Database Schema

### Entity Relationship Diagram

```
auth.users (Supabase managed)
    │
    └── profiles (1:1)
         ├── services (1:N)
         ├── clients (1:N)
         │    └── client_assets (1:N)
         ├── bookings (1:N)
         │    ├── booking_slots (1:N)
         │    └── booking_push_subscriptions (1:N)
         ├── schedule_blocks (1:N)
         ├── invoices (1:N)
         │    ├── payments (1:N)
         │    ├── cash_payments (1:1)
         │    └── escrow_releases (1:1)
         ├── till_entries (1:N)
         ├── push_subscriptions (1:N)
         └── reviews (1:N)
```

### Tables

| Table | Description | Key Fields |
|-------|-------------|------------|
| `profiles` | Technician profiles (extends auth.users) | slug, paynow_key, base_lat/lng, working_hours (JSONB) |
| `services` | Service types per technician | name, duration_minutes, price_cents |
| `clients` | Homeowner records | name, phone, address, lat/lng, brand |
| `client_assets` | Equipment tracked per client | asset_type, brand, last_service_date, next_service_date |
| `bookings` | Job bookings with lifecycle | status (pending→accepted→in_progress→completed→cancelled) |
| `booking_slots` | Pre-computed arrival windows | start_time, end_time, is_available |
| `schedule_blocks` | Blocked days/times | block_type (recurring/one_off/lunch), day_of_week |
| `invoices` | Invoice records | line_items (JSONB), total_cents, status, pdf_url |
| `payments` | Payment records | payment_method, amount_cents, reference |
| `push_subscriptions` | Web Push subscriptions | endpoint, p256dh, auth |
| `reviews` | Client reviews | rating (1-5), comment |
| `cash_payments` | Cash payment records | amount_collected_cents, signature_data |
| `till_entries` | Daily cash float ledger | amount_cents, entry_type |
| `escrow_releases` | Deposit release audit trail | net_released_cents, status |

### Design Choices

- **All monetary values in cents** (integer) to avoid floating-point
- **UUIDs** for all primary keys
- **RLS policies** on every table (technicians see only their own data)
- **`profiles.slug`** is unique, used for public URL: `servicesync.sg/p/{slug}`
- **Sequential invoice numbers** via database trigger (`INV-1001`, `INV-1002`, etc.)
- **Soft deletes** for clients and services (is_deleted / is_active flags)

### Row-Level Security

Every table has RLS enabled. Key policies:
- **Provider isolation**: `auth.uid() = provider_id` for all CRUD
- **Public read**: profiles, active services, reviews (for booking page)
- **Public insert**: bookings, booking push subscriptions (homeowners creating bookings)

---

## API Endpoints

### Booking Router (`booking.*`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `booking.getAvailableSlots` | Public | Returns available windows for a technician on a date |
| `booking.createBooking` | Public | Creates a pending booking with database-level locking |
| `booking.listBookings` | Protected | Technician's bookings with filters |
| `booking.acceptBooking` | Protected | Accept a pending booking → sends push to homeowner |
| `booking.declineBooking` | Protected | Decline a booking |
| `booking.startJob` | Protected | Mark as in_progress → enables live ETA |
| `booking.completeJob` | Protected | Mark as completed |
| `booking.updateLocation` | Protected | Send GPS coords for live ETA (every 30s) |

### Schedule Router (`schedule.*`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `schedule.getWorkingHours` | Protected | Get default working hours |
| `schedule.updateWorkingHours` | Protected | Set working hours per day |
| `schedule.addBlock` | Protected | Block a day/time (recurring or one-off) |
| `schedule.removeBlock` | Protected | Remove a block |
| `schedule.getBlocks` | Protected | List all active blocks |
| `schedule.moveLunchBreak` | Protected | Move lunch for a specific date |
| `schedule.initDefaultLunch` | Protected | Initialize Mon-Fri 12:00-13:00 lunch blocks |

### Provider Router (`provider.*`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `provider.getPublicProfile` | Public | Profile for /p/{slug} page (+ services, reviews) |
| `provider.getProfile` | Protected | Own profile details |
| `provider.updateProfile` | Protected | Update profile fields |
| `provider.getServices` | Protected | List own services |
| `provider.addService` | Protected | Add service type with duration + price |
| `provider.updateService` | Protected | Edit service |
| `provider.deleteService` | Protected | Soft-delete service |

### Clients Router (`clients.*`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `clients.list` | Protected | List clients with search/filter |
| `clients.getById` | Protected | Client details + service history + assets |
| `clients.create` | Protected | Add new client |
| `clients.update` | Protected | Update client info |
| `clients.delete` | Protected | Soft-delete client |
| `clients.getServiceHistory` | Protected | All past jobs for a client |
| `clients.getAssets` | Protected | Equipment tracked for client |
| `clients.addAsset` | Protected | Add equipment entry |

### Invoices Router (`invoices.*`)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `invoices.list` | Protected | List with filters (month, year, status, search) |
| `invoices.getById` | Protected | Single invoice detail |
| `invoices.create` | Protected | Generate invoice from booking or manual |
| `invoices.generatePdf` | Protected | Generate PDF with PayNow QR → Supabase Storage |
| `invoices.downloadMonthly` | Protected | ZIP of all invoices for a month |
| `invoices.downloadYearly` | Protected | ZIP for entire year |
| `invoices.downloadAll` | Protected | ZIP of all invoices |
| `invoices.getMonthlyBreakdown` | Protected | Revenue summary by month for tax filing |
| `invoices.getYearlyBreakdown` | Protected | Revenue summary by year |

### Cash Router (`cash.*`) — Pre-existing

| Endpoint | Auth | Description |
|----------|------|-------------|
| `cash.getInvoiceSummary` | Protected | Invoice balance for payment screen |
| `cash.confirmCashPayment` | Protected | Record cash collection + trigger handshake |
| `cash.getDailySummary` | Protected | Daily till summary |
| `cash.getPaymentStatus` | Protected | Poll invoice payment status |

---

## Booking Flow

```
Homeowner visits /p/{slug}
    │
    ├─ Sees services list → picks service
    │
    ├─ booking.getAvailableSlots(providerId, date, serviceDuration)
    │  └─ Availability engine runs:
    │     1. Fetch working hours + base location
    │     2. Fetch accepted bookings (with locations)
    │     3. Fetch schedule blocks (lunch, custom)
    │     4. Calculate travel times (haversine + 40km/h)
    │     5. Find gaps that fit service duration + travel
    │     6. Return available windows
    │
    ├─ Homeowner picks a slot
    │
    ├─ booking.createBooking(...)
    │  └─ Database-level locking (SELECT FOR UPDATE SKIP LOCKED)
    │  └─ Push notification → technician
    │
    ├─ Technician sees notification → booking.acceptBooking
    │  └─ Push notification → homeowner ("Booking confirmed!")
    │
    ├─ On service day: booking.startJob
    │  └─ Live ETA tracking begins (Supabase Realtime)
    │  └─ Technician phone sends GPS every 30s → booking.updateLocation
    │  └─ Homeowner sees ETA countdown
    │
    └─ Job done: booking.completeJob
       └─ Invoice creation flow begins
```

## Route Optimization Algorithm

The availability engine uses **haversine distance** for travel time estimation:

1. **Why haversine instead of Google Directions API**: Zero cost. Singapore is ~50km across with well-connected roads. Haversine + 40km/h average gives a reasonable estimate.
2. **15-minute buffer** added to every travel estimate (parking, lift, finding unit).
3. **30-minute arrival windows** shown to homeowner (e.g., "10:00-10:30 AM").
4. **Slot granularity**: Checks every 15 minutes for available windows.
5. **Location clustering**: Jobs in the same area naturally cluster since travel time between nearby jobs is short, leaving more available slots.

### Haversine Formula

```
d = 2R × arcsin(√(sin²(Δlat/2) + cos(lat1)×cos(lat2)×sin²(Δlng/2)))
```

Where R = 6371 km (Earth's radius). Travel time = (distance / 40 km/h) × 60 + 15 min buffer.

---

## Payment Flow

```
Invoice created → status: pending
    │
    ├─ Path A: PayNow QR
    │  ├─ Homeowner scans QR from PDF/web
    │  ├─ Bank processes payment
    │  ├─ Webhook confirms → status: paid_qr
    │  └─ Escrow release triggers
    │
    └─ Path B: Cash
       ├─ Technician collects cash on-site
       ├─ cash.confirmCashPayment
       │  ├─ Record cash_payment
       │  ├─ Update invoice → status: paid_cash
       │  ├─ Generate PDF receipt
       │  ├─ WhatsApp digital handshake
       │  ├─ Release escrow deposit
       │  ├─ Record till entry
       │  └─ Update CRM retention
       └─ Technician sees daily till summary
```

---

## Services Architecture

| Service | File | Purpose |
|---------|------|---------|
| Availability Engine | `services/availability.ts` | Route-optimized slot calculation with haversine |
| Live ETA | `services/live-eta.ts` | Supabase Realtime location broadcast |
| Push Notifications | `services/push-notifications.ts` | Web Push API (free, browser-native) |
| PayNow QR | `services/paynow-qr.ts` | SGQR-compliant EMVCo QR generation |
| Invoice Storage | `services/invoice-storage.ts` | PDF storage + ZIP bulk download |
| PDF Generator | `services/pdf.ts` | Puppeteer HTML→PDF (cash receipt + standard invoice) |
| Till | `services/till.ts` | Daily cash float ledger |
| Escrow | `services/escrow.ts` | NETS PayNow deposit release |
| WhatsApp | `services/whatsapp-simple.ts` | wa.me link generators (zero cost) |

---

## Storage Strategy

### Invoice PDFs
- **Bucket**: `invoices` (Supabase Storage)
- **Path**: `invoices/{providerId}/{year}/{month}/{invoiceId}.pdf`
- **Size**: ~30-50KB per PDF (compressed)
- **Budget**: ~$25 SGD/month covers thousands of invoices

### Bulk Download
- JSZip for server-side ZIP generation
- Monthly, yearly, and all-time download options
- Returns base64-encoded ZIP to client

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-side only) |
| `NEXT_PUBLIC_APP_URL` | Yes | App base URL |
| `VAPID_PUBLIC_KEY` | For push | VAPID public key |
| `VAPID_PRIVATE_KEY` | For push | VAPID private key |
| `VAPID_SUBJECT` | For push | VAPID subject |
| `NETS_API_BASE_URL` | For escrow | NETS API endpoint |
| `NETS_API_KEY` | For escrow | NETS API key |
| `NETS_MERCHANT_ID` | For escrow | NETS merchant ID |

---

## Cost Analysis

| Service | Monthly Cost (SGD) |
|---------|-------------------|
| Supabase Free Tier | $0 |
| Supabase Storage (PDFs) | ~$5-15 |
| Web Push Notifications | $0 |
| WhatsApp (wa.me links) | $0 |
| Haversine routing | $0 |
| Supabase Realtime (ETA) | $0 |
| **Total** | **~$5-25** |
