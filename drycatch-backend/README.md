# DryCatch Backend

Express 5 + Mongoose REST API for the DryCatch e-commerce app.

## Stack

- Express 5, Mongoose 8
- JWT access/refresh tokens (`jsonwebtoken`), bcrypt password hashing
- Razorpay for payments
- helmet + express-rate-limit for baseline hardening

## Structure

```
src/
├── app.js              # express app: middleware, routers, error handling
├── config/db.js        # mongoose connection
├── routes/             # route definitions only — no business logic
├── controllers/        # request/response handling, calls into models
├── models/              # Mongoose schemas
├── middleware/          # auth, validation, error handling
└── utils/               # tokens, otp, razorpay client, error classes
server.js                # entry point
```

Business logic currently lives in controllers (the codebase is small enough
that a separate service layer isn't justified yet — extract one once a
controller starts mixing multiple unrelated responsibilities).

## Setup

```bash
cp .env.example .env   # fill in real values
npm install
npm run dev             # node --watch server.js
```

## Environment variables

See `.env.example` for the full list: `PORT`, `MONGO_URI`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`,
`CLIENT_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.

## API

All routes are namespaced under `/api/v1` (see `docs/api.md`). Health checks:
`GET /health` (liveness), `GET /ready` (checks MongoDB connectivity).

## Known gaps (tracked for future phases)

- No refresh-token revocation store — logout is a client-side no-op.
- `Review` allows multiple reviews per user per product (no upsert/unique
  constraint yet — needs a product decision on merge-vs-reject behavior).
- No automated test suite yet.
