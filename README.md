# Serene Spa — Management System

A staff-facing system for running a spa's front desk, treatment rooms, and service
sessions from booking to payment. Built as two separate apps:

- **backend/** — Node.js, Express, PostgreSQL, JWT + bcrypt authentication, Socket.io for
  real-time room and notification updates.
- **frontend/** — Next.js (App Router) + TypeScript + Tailwind CSS.

## Multi-branch

The business runs multiple branches — seeded with **Dar es Salaam**, **Dodoma**, and
**Arusha** — and more can be added any time from Admin → Branches, no code changes
needed. Rooms, bookings, staff accounts, and notifications all belong to one branch;
the service menu is shared across all of them (same treatments, same prices,
everywhere).

- **Receptionists and providers** only ever see and act on their own branch — a
  Dodoma receptionist can't book a Dar es Salaam room, and never gets pinged about
  what's happening there.
- **Admin** sees everything, everywhere, by default. Every admin screen (Overview,
  Rooms, Bookings & payments, Notifications, Staff accounts) has a branch dropdown to
  either view all branches at once or drill into a single one.
- This is enforced in the backend (not just hidden in the UI) — every relevant query
  is scoped by the signed-in user's branch, and cross-branch booking/room actions are
  rejected with a clear error.

## Reports

Admin → Reports generates a financial and activity report for any period:

- Quick presets — **Today**, **This week**, **This month**, **This year**
- Or a fully **custom date range**
- Filterable to a single branch or **all branches combined**

Each report shows revenue collected, outstanding balances, booking counts, a
day-by-day revenue chart, and breakdowns by branch, by service, and by provider.
There's a **Print / save as PDF** button that uses the browser's own print dialog —
no extra software needed, and it prints cleanly without the sidebar/navigation.

## How it works

Three roles, three logins, one shared picture of what's happening in the building:

- **Receptionist** — records the customer's name and phone number, assigns them to a
  free room for a chosen service, and records payments as they come in.
- **Service provider** — confirms when a customer has actually entered the room and
  the service has begun, confirms when it ends, and can add an extra/extended service
  mid-session (the timer keeps running from where it left off, and the front desk is
  notified automatically).
- **Admin** — sees every room, every booking, and every notification across the
  business, and manages staff accounts, rooms, and the service menu. Nothing happens
  in the building that the admin can't see.

### Room status

Each room is always in one of three states:

| Status | Meaning |
|---|---|
| **Free** (`inactive`) | Nobody assigned — a receptionist can book it. |
| **Awaiting confirmation** (`pending`) | A customer has been assigned, but the provider hasn't confirmed the service has started yet. If this sits for **30 minutes** with no confirmation, the admin and receptionist are notified automatically. |
| **In session** (`active`) | The provider has confirmed the customer is in and the service is running. A countdown shows the time left, a soft chime plays a few minutes before time is up, and if the provider doesn't confirm the end once time runs out, the admin and receptionist are notified. |

All of this is enforced server-side (not just in the UI) by a background job that
checks every 20 seconds — see `backend/src/jobs/timerWatcher.js`.

## Project structure

```
spa-system/
├── backend/
│   ├── src/
│   │   ├── config/        # DB pool, schema.sql, migrate & seed scripts
│   │   ├── controllers/    # request handlers per resource
│   │   ├── middleware/     # JWT auth + role guards
│   │   ├── routes/         # Express routers
│   │   ├── sockets/        # Socket.io setup (role-based rooms)
│   │   ├── jobs/           # the 30-min / overtime timer watcher
│   │   ├── utils/          # jwt helper, shared notification/socket emitter
│   │   ├── app.js
│   │   └── server.js       # entry point
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── app/
    │   ├── login/
    │   ├── admin/           # overview, bookings, notifications, rooms, services, staff
    │   ├── receptionist/    # room grid + booking history
    │   └── provider/        # assigned rooms + session controls
    ├── components/
    ├── context/             # auth context (JWT stored client-side)
    ├── lib/                 # api client, socket client, hooks, types
    ├── package.json
    └── .env.local.example
```

## Setup

### 1. Database

Create a PostgreSQL database (locally or hosted — e.g. Railway, Render, Neon, or a
local Postgres install):

```sql
CREATE DATABASE serene_spa;
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env with your real PostgreSQL credentials and a long random JWT_SECRET
npm install
npm run db:migrate   # creates all tables (safe to re-run on an existing DB — it only adds what's missing)
npm run db:seed      # creates 3 branches, the admin, 3 receptionists, 8 providers, 12 rooms, 12 services
npm run dev           # starts on http://localhost:4000
```

The seed script prints the admin/receptionist/provider login credentials it created —
every provider's password is `Provider123!` and every receptionist's is
`Reception123!` until you change them from the Admin → Staff accounts page. Change the
admin password (set in `.env`) before going live.

> Staff accounts are only created by the admin from inside the app — there is no public
> self-registration page. This is the standard, safer pattern for internal staff
> software, and it means the admin always knows exactly who has access.

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# edit .env.local if your backend isn't on localhost:4000
npm install
npm run dev            # starts on http://localhost:3000
```

Open `http://localhost:3000` and sign in with the admin account printed by the seed
script.

## Renaming the placeholder data

The client asked for placeholder names to be filled in later — everything below is
safe to rename from inside the app, no code changes needed:

- **Service provider names** — Admin → Staff accounts (or update directly in the
  database if you're replacing the seeded accounts entirely).
- **Room names & assignments** — Admin → Rooms.
- **Services, durations & prices** — Admin → Services.
- **Photos** — the login screen and anywhere else marked "photo goes here" is left
  blank on purpose; drop in real photography whenever it's ready. Search the frontend
  for `Spa photo goes here` to find that spot, and ask your developer to wire up an
  `<img>`/`next/image` tag once you have real photos and somewhere to host them
  (the project doesn't include file upload storage yet).

## Notes on a few design decisions

- **Currency** is shown as TZS (Tanzanian shillings) throughout — change the
  `Intl.NumberFormat('en-TZ')` calls in the frontend if the client prefers a
  different currency or locale formatting.
- **Alert sounds** are generated in the browser with the Web Audio API
  (`frontend/lib/alertSound.ts`) rather than shipped as an audio file, so there's
  nothing to license or replace — swap in a real sound file later if preferred.
- **Real-time updates** (room status changes, new notifications) use Socket.io rather
  than polling, so every screen updates within a second of something happening
  elsewhere in the building.
- **Payments** are tracked per booking with a running paid/outstanding balance, and
  every payment recorded fires an admin-only notification — this is the piece that
  directly addresses the client's concern about staff underreporting cash received.

## Production checklist

Before handing this to the client to run for real:

- [ ] Set a strong, unique `JWT_SECRET` in `backend/.env`.
- [ ] Change the seeded admin password immediately after first login.
- [ ] Put the backend behind HTTPS (e.g. via a reverse proxy) — JWTs should never
      travel over plain HTTP in production.
- [ ] Point `CLIENT_ORIGIN` (backend) and `NEXT_PUBLIC_API_URL` /
      `NEXT_PUBLIC_SOCKET_URL` (frontend) at your real deployed domains.
- [ ] Take regular backups of the PostgreSQL database — it's the system of record for
      every booking and payment.
