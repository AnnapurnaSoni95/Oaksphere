# OAKsphere Connect — Bulk Recruitment CRM

High-volume recruitment CRM for bulk-hiring agencies: candidate leads, calling workspace, follow-ups, interviews, joinings, a **Call Bridge** (desktop→phone SIM companion relay over SSE), telephony analytics, RBAC, and audit logging.

## Architecture (production)
- **Frontend**: React 19 + Vite + Tailwind v4 (`/app/frontend`, dev/serve on `:3000`).
- **Backend**: FastAPI (`/app/backend`, `uvicorn server:app` on `:8001`). All routes under `/api`.
- **Database**: MongoDB (Motor). Data is loaded into memory on boot and written through to Mongo. Collections: users, leads, activities, calls, followups, interviews, joinings, clients, jobs, templates, notifications, auditLogs, callBridgeDevices, callBridgeCalls (+ `singletons` for settings & callBridgeSettings). Seeded automatically on first run.
- **Auth**: Bearer JWT (`Authorization: Bearer <token>`), bcrypt password hashing, server-side RBAC (`admin`, `team_leader`, `recruiter`).

The frontend calls relative `/api/...`; the platform ingress routes `/api` → backend `:8001` and everything else → frontend `:3000`.

## Prerequisites
- Python 3.11+, Node 18+/Yarn, MongoDB.

## Environment variables
Backend (`backend/.env`) — see `.env.example`:
- `MONGO_URL`, `DB_NAME` — database connection.
- `JWT_SECRET` — 64-char random hex used to sign JWTs.
- `JWT_EXPIRY_DAYS` — token lifetime (default 7).
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — owner/admin account, seeded idempotently on startup (password rotates if changed).
- `CORS_ORIGINS` — comma-separated allowed origins (`*` for same-origin).

Frontend (`frontend/.env`):
- `REACT_APP_BACKEND_URL` — public app URL (informational; the app uses relative `/api`).

## Install & run (dev)
```bash
# backend
cd backend && pip install -r requirements.txt
# frontend
cd frontend && yarn install
```
Both processes are managed by supervisor (`backend` = uvicorn on 8001, `frontend` = `yarn start` on 3000, plus `mongodb`). Restart after `.env`/dependency changes:
```bash
sudo supervisorctl restart backend frontend
```
Health check: `GET /api/health`.

## Build (production)
```bash
cd frontend && yarn build      # outputs frontend/dist
cd backend  && uvicorn server:app --host 0.0.0.0 --port 8001
```

## Call Bridge (companion relay — no external telephony vendor)
1. Desktop opens Call Bridge; generate a pair code (`POST /api/call-bridge/pair {action:"generate_code"}`).
2. Phone opens `/bridge/mobile`, enters the code (pairs the device).
3. Desktop clicks Call → `POST /api/call-bridge/dial` creates a `ringing` call and pushes an `INCOMING_DIAL_REQUEST` over SSE (`GET /api/call-bridge/stream`).
4. Phone dials via its native SIM (`tel:`) and reports status back → `POST /api/call-bridge/call-event`; completed calls auto-log into the candidate CRM timeline.
5. States: idle → ringing → connected → completed/failed/rejected. Use `POST /api/call-bridge/simulate-phone-event` to test without a second phone.

No paid provider or credentials are required. To later add a real telephony vendor, add its credentials as env vars and implement a new gateway mode.

## Testing
```bash
cd backend && python -m pytest        # backend suite (auth, RBAC, CRUD, calls, call-bridge, telephony)
```
Test/demo credentials are written to `/app/memory/test_credentials.md` on startup.

## Security notes
- Passwords are bcrypt-hashed; JWTs signed with `JWT_SECRET` and expire.
- All sensitive operations are authorized **server-side** via role/permission checks (hiding a UI button is not authorization).
- Candidate phone numbers are masked for recruiters lacking `canViewCandidatePhone`.
- The insecure 1-click "switch to any user" demo endpoint was removed.
- Ad-integration (Meta/Google) simulators are disabled until real credentials are configured in Settings.
