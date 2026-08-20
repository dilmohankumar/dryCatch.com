# Architecture

DryCatch's backend is a modular monolith — one Express process, one MongoDB
database, no microservices. This is intentional: the app is small enough that
splitting it up would add operational cost without a corresponding benefit.

## Request flow

```
Request
  → helmet / cors / rate limiter (app.js)
  → /api/v1 router
  → route (routes/*.js)          — endpoint + middleware wiring only
  → middleware (auth, validate)  — protect / adminOnly / requireFields
  → controller (controllers/*.js) — request/response shape, calls model directly
  → model (models/*.js, Mongoose)
  → MongoDB
```

There is no dedicated service layer yet. Controllers currently talk to
Mongoose models directly. This is fine while each controller is small and
single-purpose; introduce a `services/` layer for a module once its
controller starts mixing more than one responsibility (e.g. orders, once
shipping/discounts land on top of it).

## Error handling

```
Controller/route throws or rejects
  → Express 5 auto-forwards to error middleware
  → middleware/errorHandler.js
      - logs structured JSON (timestamp, method, path, status, message)
      - redacts 5xx error messages in production
  → { message } JSON response
```

`utils/errors.js` defines `AppError` and subclasses (`ValidationError`,
`AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`)
for controllers/services to throw instead of hand-rolling `res.status(...)`
calls — adopt these incrementally as controllers are touched.

## Auth

JWT access + refresh tokens (`utils/tokens.js`), separate secrets/expiries.
`middleware/auth.js` exposes `protect` (verifies bearer token, loads full
user) and `adminOnly` (role check). Tokens are stateless — there is no
server-side revocation list, so logout only clears client-side storage.

## Payments

Razorpay order creation re-derives `totalAmount` from the DB `Product`
records server-side (never trusts client-submitted prices) before creating
the Razorpay order; `verifyPayment` does HMAC-SHA256 signature verification
before marking an order paid.

## Future modules

New domains (inventory, shipping, discounts, notifications, analytics) should
each get their own `controllers/`, `models/`, `routes/` files following the
existing pattern, and a `services/` file once business logic grows past a
few lines per handler. Avoid introducing new top-level architectural layers
(microservices, message queues, search clusters) until there's a concrete,
current requirement for one.
