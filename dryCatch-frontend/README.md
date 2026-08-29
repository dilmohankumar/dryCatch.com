# DryCatch Frontend

React 19 + Vite SPA for the DryCatch e-commerce app.

## Stack

- React 19, React Router 7
- Tailwind CSS 4
- Plain `fetch` for API calls (single client in `src/utils/api.js`) — no axios
- No global state library (Context/Redux/Zustand); app-level state (auth
  user, cart) is owned by `App` in `src/routes/AppRoutes.jsx` and passed down

## Structure

```
src/
├── routes/AppRoutes.jsx   # routing + top-level auth/cart state (single source of truth)
├── pages/                 # one file per route (home, shop, cart, checkout, orders, wishlist, profile, auth/*)
├── components/            # layout (Navbar, Footer, Sidebar) + shared UI (ProductReviews)
├── utils/
│   ├── api.js              # the ONE API client — products/cart/orders/wishlist/reviews/categories/auth/user
│   ├── productAdapters.js  # bridges the real Product schema to the shape pages expect
│   └── productCache.js     # in-memory product lookup cache (used by the cart drawer)
├── hooks/useRazorpay.js
└── data/                  # static nav/content config (megaMenu, homeData)
```

## Setup

```bash
cp .env.example .env   # set VITE_API_URL to your backend
npm install
npm run dev
```

## Environment variables

`VITE_API_URL` (backend base URL, defaults to `http://localhost:5000/api/v1`),
`VITE_RAZORPAY_KEY_ID`.

## Auth

Login/signup/OTP/password-reset all go through `authAPI` in `src/utils/api.js`.
Tokens (`df_token`, `df_refreshToken`) are stored in `localStorage`. `App`
(`AppRoutes.jsx`) owns the current `user` and passes it down as a prop —
child components should not re-fetch or re-derive their own copy.

## Known gaps (tracked for future phases)

- `useRazorpay.js` opens Razorpay directly client-side with the backend
  order-creation/verification calls commented out, while `checkout.jsx` uses
  the real `ordersAPI.create` flow — these are two separate, unreconciled
  checkout paths. Needs a decision on which one is authoritative before
  further payment work (flagged, not resolved, since it's money-adjacent).
- Tokens live in `localStorage`, not httpOnly cookies (XSS-exposed).
- No automated tests yet.
