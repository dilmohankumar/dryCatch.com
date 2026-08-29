// Auth tokens live in httpOnly cookies (unreadable from JS), so components
// that used to check `localStorage.getItem("df_token")` for a quick,
// synchronous "am I logged in?" guard have no cookie to read anymore.
// `App` (src/routes/AppRoutes.jsx) is the single source of truth for the
// current user; it mirrors that here so deeply-nested components (e.g. the
// buy-now flow in productGrid.jsx) can check login state without an extra
// network round trip or threading `user` through every intermediate layer.
let currentUser = null;

export function setCurrentUser(user) {
  currentUser = user;
}

export function isLoggedIn() {
  return !!currentUser;
}

export function getCurrentUser() {
  return currentUser;
}
