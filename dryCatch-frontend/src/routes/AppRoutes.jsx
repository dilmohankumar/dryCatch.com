import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import Navbar from "../components/layout/Navbar/navbar.jsx";
import Footer from "../components/layout/Footer/footer.jsx";
import Home from "../pages/home.jsx";
import Shop from "../pages/shop.jsx";
import CategoryPage from "../pages/category.jsx";
import Sidebar from "../components/layout/sidebar/sidebar.jsx";
import ProductDetail from "../pages/productDetails.jsx";
import SearchResults from "../pages/searchResults.jsx";
import Login from "../pages/auth/login.jsx";
import Signup from "../pages/auth/signup.jsx";
import Cart from "../pages/cart.jsx";
import Checkout from "../pages/checkout.jsx";
import Orders from "../pages/orders.jsx";
import OrderDetail from "../pages/orderDetail.jsx";
import Wishlist from "../pages/wishlist.jsx";
import AccountRoute from "../pages/account/AccountRoute.jsx";
import CmsPage from "../pages/CmsPage.jsx";
// Phase 19 — the entire admin surface (CMS editors, notification/campaign
// management, analytics dashboards + charts) is only ever visited by
// admins, but was previously bundled statically into the same chunk every
// customer downloads on first page load. Lazy-loading it means a normal
// shopper's initial JS never includes any of that code — it's fetched
// on-demand only when someone actually navigates to /admin.
const AdminSection = lazy(() => import("../pages/admin/AdminSection.jsx"));
import { productsAPI, cartAPI } from "../utils/api.js";
import { normalizeProduct } from "../utils/productAdapters.js";
import { cacheProducts } from "../utils/productCache.js";
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { userAPI } from "../utils/api.js";
import { setCurrentUser } from "../utils/authState.js";
import { getMegaMenu } from "../data/megaMenu.js";

// ── Path builders (pure — no hooks) ─────────────────────────────────────────
// Shared by every "go to X" call site so the URL a click lands on and the
// params a route reads back out always agree.
function buildShopPath(category = "All") {
  return category && category !== "All" ? `/shop?category=${encodeURIComponent(category)}` : "/shop";
}

function buildCategoryPath(payload = {}) {
  const slug = payload.slug || "featured-new";
  const menu = getMegaMenu(slug);
  const filter = payload.filter || menu?.filter || "All";
  const label = payload.label || menu?.label || null;
  const params = new URLSearchParams();
  params.set("filter", filter);
  if (payload.tag) params.set("tag", payload.tag);
  if (label) params.set("label", label);
  return `/category/${slug}?${params.toString()}`;
}

// ── Route-level wrappers ─────────────────────────────────────────────────
// Thin adapters that pull params/search-params/location.state out of the URL
// and hand the existing page components the same props they always expected.

function ShopRoute({
  cart, cartInc, cartDec, cartFirstAdd,
  sidebarOpen, setSidebarOpen,
  selectedSort, setSelectedSort,
  selectedCats, setSelectedCats,
  selectedOrigins, setSelectedOrigins,
  clearFilters, onProductClick, onBackToHome,
}) {
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category") || "All";

  return (
    <div className="flex flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 gap-5 sm:gap-8">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
        selectedCats={selectedCats}
        onCatChange={setSelectedCats}
        selectedOrigins={selectedOrigins}
        onOriginChange={setSelectedOrigins}
        onClearAll={clearFilters}
      />
      <main className="flex-1 min-w-0">
        <Shop
          key={category}
          selectedSort={selectedSort}
          selectedCats={selectedCats}
          selectedOrigins={selectedOrigins}
          cart={cart}
          onProductClick={onProductClick}
          onInc={cartInc}
          onDec={cartDec}
          onFirstAdd={cartFirstAdd}
          onOpenSidebar={() => setSidebarOpen(true)}
          onBackToHome={onBackToHome}
          initialCategory={category}
        />
      </main>
    </div>
  );
}

function CategoryRoute({ cart, onInc, onDec, onFirstAdd, onProductClick, onBackToHome, onNavigateCategory }) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const menu = getMegaMenu(slug);
  const filter = searchParams.get("filter") || menu?.filter || "All";
  const tag = searchParams.get("tag") || null;
  const label = searchParams.get("label") || null;

  return (
    <div className="flex-1">
      <CategoryPage
        key={`${slug}-${filter}-${tag || ""}-${label || ""}`}
        slug={slug}
        filter={filter}
        tag={tag}
        highlightLabel={label}
        cart={cart}
        onInc={onInc}
        onDec={onDec}
        onFirstAdd={onFirstAdd}
        onProductClick={onProductClick}
        onBackToHome={onBackToHome}
        onNavigateCategory={onNavigateCategory}
      />
    </div>
  );
}

function ProductDetailRoute({ cart, onCartInc, onCartDec, onCartFirstAdd, user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productsAPI
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        const normalized = normalizeProduct(data.product);
        cacheProducts([normalized]);
        setProduct(normalized);
      })
      .catch(() => {
        if (!cancelled) setProduct(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-gray-400 text-sm">
        Loading product…
      </div>
    );
  }

  return (
    <div className="flex-1">
      <ProductDetail
        product={product}
        onBack={() => navigate(-1)}
        cart={cart}
        onCartInc={onCartInc}
        onCartDec={onCartDec}
        onCartFirstAdd={onCartFirstAdd}
        user={user}
      />
    </div>
  );
}

function CheckoutRoute() {
  const navigate = useNavigate();

  // The checkout page creates its own server-side session on mount (POST
  // /checkout reads straight from the user's cart) — no cart snapshot needs
  // to travel through router state anymore, so a direct/refresh visit works.
  return (
    <div className="flex-1">
      <Checkout onBack={() => navigate("/cart")} />
    </div>
  );
}

function StoreLayout({ user, onLogout, onLoginClick, onUserUpdate }) {
  const [selectedSort, setSelectedSort] = useState(null);
  const [selectedCats, setSelectedCats] = useState([]);
  const [selectedOrigins, setSelectedOrigins] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The cart itself — server-authoritative always (guests included: the
  // backend tracks a guest cart via an httpOnly cookie, see cartService.js).
  // `cart` here is the { [variantId]: quantity } view most existing UI
  // (product cards, quick +/-) already expects; `cartItems`/`cartSummaryData`
  // carry the richer server response for the drawer/cart page.
  const [cartData, setCartData] = useState({ items: [], summary: { subtotal: 0, total: 0, currency: "INR" } });
  const navigate = useNavigate();

  const refreshCart = useCallback(async () => {
    try {
      const { data } = await cartAPI.get();
      setCartData(data);
    } catch {
      // No cart yet / request failed — leave the previous (or empty) state.
    }
  }, []);

  // Refetch whenever the logged-in identity changes — this is also what
  // picks up the server-side guest→user cart merge that happens on login.
  useEffect(() => {
    refreshCart();
  }, [user, refreshCart]);

  const findItemByVariant = useCallback(
    (variantId) => cartData.items.find((i) => String(i.variantId) === String(variantId)),
    [cartData]
  );

  const cart = useMemo(() => {
    const map = {};
    for (const item of cartData.items) map[String(item.variantId)] = item.quantity;
    return map;
  }, [cartData]);

  // Every handler below takes a variantId (Phase 6: cart lines reference
  // variants, not products) and always reconciles with the server's response
  // — the server is authoritative for quantity/price/availability, so the
  // UI never assumes a request will succeed before it actually has.
  const cartInc = useCallback(
    async (variantId) => {
      if (!variantId) return;
      try {
        const existing = findItemByVariant(variantId);
        const { data } = existing
          ? await cartAPI.setItemQuantity(existing.id, existing.quantity + 1)
          : await cartAPI.addItem(variantId, 1);
        setCartData(data);
      } catch (err) {
        alert(err.message || "Unable to update your cart. Please try again.");
      }
    },
    [findItemByVariant]
  );
  const cartDec = useCallback(
    async (variantId) => {
      const existing = findItemByVariant(variantId);
      if (!existing) return;
      try {
        const { data } = existing.quantity <= 1
          ? await cartAPI.removeItem(existing.id)
          : await cartAPI.setItemQuantity(existing.id, existing.quantity - 1);
        setCartData(data);
      } catch (err) {
        alert(err.message || "Unable to update your cart. Please try again.");
      }
    },
    [findItemByVariant]
  );
  const cartFirstAdd = cartInc; // same operation — add 1 to a (possibly nonexistent) line
  const cartRemove = useCallback(
    async (variantId) => {
      const existing = findItemByVariant(variantId);
      if (!existing) return;
      try {
        const { data } = await cartAPI.removeItem(existing.id);
        setCartData(data);
      } catch (err) {
        alert(err.message || "Unable to update your cart. Please try again.");
      }
    },
    [findItemByVariant]
  );
  const clearFilters = () => { setSelectedSort(null); setSelectedCats([]); setSelectedOrigins([]); };

  // ── Navigation helpers ──────────────────────────────────────────────────
  const goHome = () => navigate("/");
  const goShop = (category = "All") => navigate(buildShopPath(category));
  const goCategory = (payload = {}) => navigate(buildCategoryPath(payload));
  const goProduct = (product) => navigate(`/product/${product.id}`);
  const handleCategorySelect = (cat) => {
    if (cat?.slug) {
      return goCategory({
        slug: cat.slug,
        filter: cat.filter,
        tag: cat.tag,
        label: cat.labelNav || cat.label,
      });
    }
    // Fallback for older callers that only pass a filter string/object
    goShop(cat?.filter || "All");
  };
  const handleCheckout = () => navigate("/checkout");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <Navbar
        onOpenSidebar={() => setSidebarOpen(true)}
        cart={cart}
        cartItems={cartData.items}
        cartSummary={cartData.summary}
        onCartInc={cartInc}
        onCartDec={cartDec}
        onCartRemove={cartRemove}
        onLogoClick={goHome}
        user={user}
        onLoginClick={onLoginClick}
        onLogout={onLogout}
        onNavigate={(page) => navigate(`/${page}`)}
        onCategorySelect={handleCategorySelect}
      />

      <Routes>
        <Route
          path="/"
          element={
            <div className="flex-1">
              <Home
                cart={cart}
                onInc={cartInc}
                onDec={cartDec}
                onFirstAdd={cartFirstAdd}
                onProductClick={goProduct}
                onShopNow={() => goCategory({ slug: "featured-new", filter: "All", label: "Featured & New" })}
                onCategorySelect={handleCategorySelect}
              />
            </div>
          }
        />
        <Route
          path="/shop"
          element={
            <ShopRoute
              cart={cart} cartInc={cartInc} cartDec={cartDec} cartFirstAdd={cartFirstAdd}
              sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
              selectedSort={selectedSort} setSelectedSort={setSelectedSort}
              selectedCats={selectedCats} setSelectedCats={setSelectedCats}
              selectedOrigins={selectedOrigins} setSelectedOrigins={setSelectedOrigins}
              clearFilters={clearFilters}
              onProductClick={goProduct}
              onBackToHome={goHome}
            />
          }
        />
        <Route
          path="/category/:slug"
          element={
            <CategoryRoute
              cart={cart} onInc={cartInc} onDec={cartDec} onFirstAdd={cartFirstAdd}
              onProductClick={goProduct} onBackToHome={goHome} onNavigateCategory={goCategory}
            />
          }
        />
        <Route
          path="/product/:id"
          element={
            <ProductDetailRoute
              cart={cart} onCartInc={cartInc} onCartDec={cartDec} onCartFirstAdd={cartFirstAdd}
              user={user}
            />
          }
        />
        <Route path="/search" element={<div className="flex-1"><SearchResults /></div>} />
        <Route path="/cart" element={<div className="flex-1"><Cart onCheckout={handleCheckout} onContinueShopping={goShop} onCartChange={refreshCart} /></div>} />
        <Route path="/checkout" element={<CheckoutRoute />} />
        <Route path="/orders" element={<div className="flex-1"><Orders /></div>} />
        <Route path="/orders/:id" element={<div className="flex-1"><OrderDetail /></div>} />
        <Route path="/wishlist" element={<div className="flex-1"><Wishlist /></div>} />
        <Route path="/profile" element={<Navigate to="/account" replace />} />
        {/*
          CMS static pages (Phase 15) live under /pages/:slug rather than a
          bare /:slug. Namespacing is the safer choice here even though
          react-router v6 ranks static routes above dynamic ones (so a bare
          /:slug wouldn't actually break /shop, /cart, /checkout, etc. today):
          a bare /:slug would silently swallow every future single-segment
          route this app adds (e.g. a hypothetical /about or /blog moved to
          a static component later) and there's no way to tell, just from
          the URL, whether a given single-segment path is CMS content or a
          real app route. /pages/:slug makes that unambiguous at the cost of
          a slightly longer URL for CMS pages.
        */}
        <Route path="/pages/:slug" element={<CmsPage />} />
        <Route
          path="/account/*"
          element={
            user ? (
              <AccountRoute user={user} onUserUpdate={onUserUpdate} onAccountDeactivated={onLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  );
}

export default function App() {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Keep the shared authState mirror (utils/authState.js) in sync with the
  // real `user` state — App remains the single source of truth.
  const setUser = (u) => {
    setUserState(u);
    setCurrentUser(u);
  };

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    // No token to check client-side anymore — the httpOnly cookie (if any)
    // rides along automatically; a 401 here just means "not logged in".
    try {
      const userData = await userAPI.getMe();
      setUser(userData.data || userData.user);
    } catch {
      setUser(null);
    }
    setLoading(false);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    navigate(userData?.role === "admin" ? "/admin" : "/", { replace: true });
  };

  const handleSignupSuccess = (userData) => {
    setUser(userData);
    navigate("/", { replace: true });
  };

  const handleLogout = async () => {
    try {
      await userAPI.logout();
    } catch {
      // Cookie may already be gone/expired — proceed with client-side logout regardless.
    }
    setUser(null);
    navigate("/login", { replace: true });
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user
            ? <Navigate to="/" replace />
            : <Login onLoginSuccess={handleLoginSuccess} onGoToSignup={() => navigate("/signup")} />
        }
      />
      <Route
        path="/signup"
        element={
          user
            ? <Navigate to="/" replace />
            : <Signup onSignupSuccess={handleSignupSuccess} onGoToLogin={() => navigate("/login")} />
        }
      />

      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading admin…</div>}>
            <AdminSection user={user} onLogout={handleLogout} />
          </Suspense>
        }
      />

      <Route
        path="/*"
        element={
          <StoreLayout
            user={user}
            onLogout={handleLogout}
            onLoginClick={() => navigate("/login")}
            onUserUpdate={setUser}
          />
        }
      />
    </Routes>
  );
}
