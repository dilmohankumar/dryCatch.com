import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { checkoutAPI, addressAPI, ordersAPI } from "../utils/api";
import { trackCheckoutStarted, trackPaymentStarted } from "../utils/analyticsClient.js";
import { useSEO } from "../hooks/useSEO.js";

// ── Constants ────────────────────────────────────────────────────────────
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_XXXXXXXXXXXXXXXX";

// Fallback only — the backend already sends a human-readable `message`
// for every one of these codes; this map covers the rare case a code
// arrives without one.
const COUPON_ERROR_MESSAGES = {
  COUPON_NOT_FOUND: "This coupon code is not valid.",
  COUPON_EXPIRED: "This coupon has expired.",
  COUPON_NOT_ACTIVE: "This coupon is not active yet.",
  COUPON_USAGE_LIMIT_REACHED: "This coupon has reached its usage limit.",
  COUPON_CUSTOMER_LIMIT_REACHED: "You've already used this coupon.",
  COUPON_MINIMUM_ORDER_NOT_MET: "Your order doesn't meet this coupon's minimum.",
  COUPON_NOT_ELIGIBLE: "This coupon isn't available for your account.",
  COUPON_NOT_APPLICABLE: "This coupon doesn't apply to the items in your cart.",
  COUPON_STACKING_NOT_ALLOWED: "This coupon can't be combined with an active offer.",
};

const STEPS = ["shipping", "billing", "delivery", "review"];
const STEP_LABELS = {
  shipping: "Shipping Address",
  billing: "Billing Address",
  delivery: "Delivery Method",
  review: "Review & Pay",
};

const EMPTY_ADDRESS = {
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

// index.html loads the Razorpay script tag directly, but guard against it
// not having finished loading yet (or being stripped in some environment).
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    const script = existing || document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    if (!existing) document.body.appendChild(script);
    else if (window.Razorpay) resolve(true);
  });
}

function money(n) {
  return `₹${Number(n || 0).toFixed(2)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Payment statuses (from Payment model, see docs/payments.md) that mean
// "definitely succeeded" / "definitely over, unsuccessfully" — anything
// else (pending/created/processing) is honestly reported as still pending,
// never guessed at.
const SUCCESS_STATUSES = ["succeeded", "refunded", "partially_refunded"];
const FAILED_STATUSES = ["failed", "cancelled", "expired"];

// ── Inline "add new address" form — mirrors the fields/conventions of
// src/pages/account/Addresses.jsx, kept local since checkout only ever
// needs to create+select, never edit/delete/set-default. ────────────────
function AddressForm({ onCancel, onSaved, saving }) {
  const [form, setForm] = useState(EMPTY_ADDRESS);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaved(form);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-50 rounded-lg space-y-3 border">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
        <input required value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
          className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (optional)</label>
        <input value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
          className="w-full border rounded-lg px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
          <input required value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="w-full border rounded-lg px-3 py-2" />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] disabled:opacity-50">
          {saving ? "Saving..." : "Save & Use This Address"}
        </button>
      </div>
    </form>
  );
}

function AddressPicker({ addresses, selectedId, onSelect, onAddNew, showForm, setShowForm, saving }) {
  return (
    <div className="space-y-3">
      {addresses.length > 0 && (
        <div className="space-y-2">
          {addresses.map((addr) => (
            <label key={addr._id} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${selectedId === addr._id ? "border-[#1A3A5C] bg-blue-50" : ""}`}>
              <input type="radio" className="mt-1" checked={selectedId === addr._id} onChange={() => onSelect(addr)} />
              <div>
                <p className="font-semibold">{addr.fullName}</p>
                <p className="text-gray-600 text-sm">
                  {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                </p>
                <p className="text-gray-600 text-sm">{addr.city}, {addr.state} {addr.postalCode}</p>
                <p className="text-gray-500 text-sm">{addr.phone}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {showForm ? (
        <AddressForm saving={saving} onCancel={() => setShowForm(false)} onSaved={onAddNew} />
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="text-[#1A3A5C] hover:underline text-sm font-medium">
          + Add a new address
        </button>
      )}

      {addresses.length === 0 && !showForm && (
        <p className="text-gray-500 text-sm">No saved addresses yet — add one above to continue.</p>
      )}
    </div>
  );
}

function IssuesPanel({ issues }) {
  const LABELS = {
    PRICE_CHANGED: "Price changed",
    INSUFFICIENT_STOCK: "Not enough stock",
    VARIANT_UNAVAILABLE: "No longer available",
    PRODUCT_UNAVAILABLE: "No longer available",
    CART_EMPTY: "Your cart is empty",
  };
  return (
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
      <p className="font-semibold text-amber-800 mb-2">Some items in your order changed — please review:</p>
      <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
        {issues.map((issue, idx) => (
          <li key={idx}>
            <span className="font-medium">{LABELS[issue.code] || issue.code}</span>
            {issue.message ? ` — ${issue.message}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CheckoutPage({ onBack }) {
  const navigate = useNavigate();
  useSEO({ title: "Checkout | DryCatch", robots: "noindex,nofollow" });

  const [checkout, setCheckout] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [step, setStep] = useState("shipping");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [expired, setExpired] = useState(false);

  const [selectedShippingAddr, setSelectedShippingAddr] = useState(null);
  const [selectedBillingAddr, setSelectedBillingAddr] = useState(null);
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [showBillingForm, setShowBillingForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [shippingMethods, setShippingMethods] = useState([]);
  const [loadingMethods, setLoadingMethods] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");

  const [validating, setValidating] = useState(false);
  const [issues, setIssues] = useState([]);

  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Payment robustness state (Phase 8). `paymentPhase` drives a dedicated
  // screen once an order exists and Razorpay has been opened at least
  // once — the frontend never decides success/failure itself, only
  // reflects what verify/payment-status report.
  //   null        — no payment attempt started yet (still on review step)
  //   "processing"— Razorpay handler fired (or errored), waiting on verify
  //   "polling"   — verify itself failed/timed out; polling payment-status
  //                 since the webhook may confirm success independently
  //   "pending"   — a few polls in and still not succeeded/failed — say so
  //   "succeeded" — confirmed by verify or payment-status
  //   "failed"    — confirmed failed/cancelled/expired — offer retry
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [paymentPhase, setPaymentPhase] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null); // the order being paid for
  const [paymentError, setPaymentError] = useState("");
  const [retrying, setRetrying] = useState(false);

  // One UUID per checkout attempt — generated once, re-sent unchanged on
  // any retry of the SAME attempt (network timeout, user re-clicking after
  // a transient failure). A brand-new checkout session gets a new key.
  const idempotencyKeyRef = useRef(null);

  const handleApiError = useCallback((err, fallback = "Something went wrong. Please try again.") => {
    if (err?.status === 410) {
      setExpired(true);
      setError(err.message || "Your checkout session has expired.");
      return;
    }
    setError(err?.message || fallback);
  }, []);

  const startCheckout = useCallback(async () => {
    setLoading(true);
    setError("");
    setExpired(false);
    setIssues([]);
    setConfirmedOrder(null);
    idempotencyKeyRef.current = crypto.randomUUID();
    try {
      const [{ checkout: session }, { addresses: addrs }] = await Promise.all([
        checkoutAPI.create(),
        addressAPI.getAll(),
      ]);
      setCheckout(session);
      trackCheckoutStarted(session?.totalAmount);
      setAddresses(addrs);
      const defaultShip = addrs.find((a) => a.isDefaultShipping) || addrs[0] || null;
      const defaultBill = addrs.find((a) => a.isDefaultBilling) || defaultShip;
      setSelectedShippingAddr(defaultShip);
      setSelectedBillingAddr(defaultBill);
      setSameAsShipping(true);
      setStep("shipping");
    } catch (err) {
      handleApiError(err, "Unable to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    startCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 1: shipping address ───────────────────────────────────────
  const submitShippingAddress = async () => {
    if (!selectedShippingAddr) return;
    setError("");
    setProcessing(true);
    try {
      const { checkout: updated } = await checkoutAPI.setShippingAddress(checkout._id, {
        addressId: selectedShippingAddr._id,
      });
      setCheckout(updated);
      setStep("billing");
    } catch (err) {
      handleApiError(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddShippingAddress = async (form) => {
    setSavingAddress(true);
    setError("");
    try {
      const { address } = await addressAPI.create(form);
      setAddresses((prev) => [address, ...prev]);
      setSelectedShippingAddr(address);
      setShowShippingForm(false);
    } catch (err) {
      handleApiError(err, "Unable to save this address.");
    } finally {
      setSavingAddress(false);
    }
  };

  // ── Step 2: billing address ────────────────────────────────────────
  const submitBillingAddress = async () => {
    setError("");
    setProcessing(true);
    try {
      const payload = sameAsShipping
        ? { sameAsShipping: true }
        : { addressId: selectedBillingAddr?._id };
      if (!sameAsShipping && !selectedBillingAddr) {
        setProcessing(false);
        setError("Please select or add a billing address.");
        return;
      }
      const { checkout: updated } = await checkoutAPI.setBillingAddress(checkout._id, payload);
      setCheckout(updated);
      setLoadingMethods(true);
      const { methods } = await checkoutAPI.getShippingMethods(checkout._id);
      setShippingMethods(methods);
      setLoadingMethods(false);
      setStep("delivery");
    } catch (err) {
      handleApiError(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddBillingAddress = async (form) => {
    setSavingAddress(true);
    setError("");
    try {
      const { address } = await addressAPI.create(form);
      setAddresses((prev) => [address, ...prev]);
      setSelectedBillingAddr(address);
      setShowBillingForm(false);
    } catch (err) {
      handleApiError(err, "Unable to save this address.");
    } finally {
      setSavingAddress(false);
    }
  };

  // ── Step 3: shipping/delivery method ───────────────────────────────
  const selectShippingMethod = async (methodId) => {
    setError("");
    setProcessing(true);
    try {
      const { checkout: updated } = await checkoutAPI.setShippingMethod(checkout._id, methodId);
      setCheckout(updated);
    } catch (err) {
      handleApiError(err);
    } finally {
      setProcessing(false);
    }
  };

  const goToReview = async () => {
    if (!checkout?.shippingMethodId) {
      setError("Please choose a delivery method.");
      return;
    }
    setStep("review");
    await runValidate();
  };

  // ── Step 4: coupon + review ─────────────────────────────────────────
  const runValidate = async () => {
    setValidating(true);
    setError("");
    try {
      const result = await checkoutAPI.validate(checkout._id);
      setCheckout(result.checkout);
      setIssues(result.issues || []);
    } catch (err) {
      handleApiError(err);
    } finally {
      setValidating(false);
    }
  };

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    setCouponError("");
    try {
      const { checkout: updated } = await checkoutAPI.applyCoupon(checkout._id, couponInput.trim());
      setCheckout(updated);
      await runValidate();
    } catch (err) {
      if (err?.status === 410) return handleApiError(err);
      setCouponError(err?.message || COUPON_ERROR_MESSAGES[err?.code] || "Unable to apply this coupon.");
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = async () => {
    setCouponBusy(true);
    setCouponError("");
    try {
      const { checkout: updated } = await checkoutAPI.removeCoupon(checkout._id);
      setCheckout(updated);
      setCouponInput("");
      await runValidate();
    } catch (err) {
      handleApiError(err);
    } finally {
      setCouponBusy(false);
    }
  };

  // ── Polling fallback: used both when verify's request itself errors out
  // (network failure/timeout — the webhook may have confirmed success
  // independently) and while waiting to see if a "processing" payment
  // resolves. Never treated as a hard failure until FAILED_STATUSES
  // explicitly says so, and never guessed as success either. ───────────
  const pollPaymentStatus = useCallback(async (orderId, { attempts = 5, intervalMs = 2000 } = {}) => {
    for (let i = 0; i < attempts; i++) {
      await sleep(intervalMs);
      try {
        const { orderStatus, paymentStatus } = await ordersAPI.getPaymentStatus(orderId);
        if (SUCCESS_STATUSES.includes(paymentStatus)) {
          return { status: "succeeded", orderStatus, paymentStatus };
        }
        if (FAILED_STATUSES.includes(paymentStatus)) {
          return { status: "failed", orderStatus, paymentStatus };
        }
      } catch {
        // transient polling error — keep trying, don't give up early
      }
    }
    return { status: "pending" };
  }, []);

  // Shared by both the initial place-order attempt and any retry: opens
  // Razorpay for a given provider order and funnels the result through
  // verify, falling back to polling if verify's request itself fails.
  const openRazorpayCheckout = useCallback(async (order, razorpayOrderId, amount) => {
    trackPaymentStarted(order?._id);
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setPaymentError("Failed to load the payment gateway. Please check your connection and try again.");
      return;
    }

    const finishAsSucceeded = (verifiedOrder) => {
      setConfirmedOrder(verifiedOrder);
      setPaymentPhase("succeeded");
    };

    const finishAsFailed = (message) => {
      setPaymentError(message || "Payment failed. You can retry the payment below.");
      setPaymentPhase("failed");
    };

    const finishAsPending = () => {
      setPaymentPhase("pending");
    };

    const handlePostCallback = async (response) => {
      setPaymentPhase("processing");
      try {
        const { order: verifiedOrder, paymentStatus } = await ordersAPI.verifyPayment({
          orderId: order._id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        if (SUCCESS_STATUSES.includes(paymentStatus)) {
          finishAsSucceeded(verifiedOrder);
        } else if (FAILED_STATUSES.includes(paymentStatus)) {
          finishAsFailed("Payment did not succeed.");
        } else {
          finishAsPending();
        }
      } catch (err) {
        // The verify request itself failed (network/timeout) — do NOT
        // assume failure, since the webhook may have already confirmed
        // this payment server-side. Poll payment-status instead.
        setPaymentPhase("polling");
        const result = await pollPaymentStatus(order._id);
        if (result.status === "succeeded") {
          finishAsSucceeded(order);
        } else if (result.status === "failed") {
          finishAsFailed(err?.message);
        } else {
          finishAsPending();
        }
      }
    };

    const options = {
      key: RAZORPAY_KEY,
      amount,
      currency: checkout?.currency || "INR",
      name: "DryCatch",
      description: "Order payment",
      order_id: razorpayOrderId,
      prefill: {
        name: checkout?.shippingAddress?.fullName || "",
        contact: checkout?.shippingAddress?.phone || "",
      },
      theme: { color: "#1A3A5C" },
      handler: handlePostCallback,
      modal: {
        // Modal dismissed/timed out client-side — the order + reservation
        // still exist; offer Retry Payment rather than forcing a restart.
        ondismiss: () => {
          setPaymentError("Payment was not completed.");
          setPaymentPhase("failed");
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (response) => {
      setPaymentError(response?.error?.description || "Payment failed. Please try again.");
      setPaymentPhase("failed");
    });
    setPaymentOrder(order);
    setPaymentPhase("processing");
    rzp.open();
  }, [checkout, pollPaymentStatus]);

  // ── Step 5: place order → Razorpay → verify ─────────────────────────
  const placeOrder = async () => {
    setError("");
    setProcessing(true);
    try {
      const result = await checkoutAPI.placeOrder(checkout._id, idempotencyKeyRef.current, paymentMethod);
      const { order, razorpayOrderId, amount } = result;
      setProcessing(false);
      if (paymentMethod === "cod") {
        // No gateway involved — the backend already confirmed the order
        // (see paymentService.confirmCodOrder). Reuses the exact same
        // success screen a completed Razorpay payment lands on
        // (gated on paymentPhase, not the address/review `step`).
        setConfirmedOrder(order);
        setPaymentPhase("succeeded");
        return;
      }
      await openRazorpayCheckout(order, razorpayOrderId, amount);
    } catch (err) {
      // REVALIDATION_FAILED (409) and CHECKOUT_IN_PROGRESS (409) both land
      // here as a plain message (the error middleware doesn't forward the
      // structured `issues` array on this path) — re-run validate so the
      // user sees the concrete per-item detail before retrying.
      if (err?.status === 409) {
        setError(err.message || "This order could not be placed — some items may have changed.");
        await runValidate();
      } else {
        handleApiError(err);
      }
      setProcessing(false);
    }
  };

  // ── Retry a failed/dismissed payment on an already-created order.
  // The order + inventory reservation already exist — this only opens a
  // fresh provider order for a new attempt (a new PaymentAttempt row on
  // the backend), never re-runs place-order from scratch. ──────────────
  const retryPayment = async () => {
    if (!paymentOrder) return;
    setRetrying(true);
    setPaymentError("");
    try {
      const retryKey = crypto.randomUUID();
      const { razorpayOrderId, amount } = await ordersAPI.retryPayment(paymentOrder._id, retryKey);
      setRetrying(false);
      await openRazorpayCheckout(paymentOrder, razorpayOrderId, amount);
    } catch (err) {
      setRetrying(false);
      setPaymentError(err?.message || "Unable to start a new payment attempt. Please try again.");
      setPaymentPhase("failed");
    }
  };

  // "Check again" for the honest pending state — re-polls a few more times
  // rather than looping forever silently.
  const recheckPendingPayment = async () => {
    if (!paymentOrder) return;
    setPaymentPhase("polling");
    const result = await pollPaymentStatus(paymentOrder._id, { attempts: 3, intervalMs: 2000 });
    if (result.status === "succeeded") {
      setConfirmedOrder(paymentOrder);
      setPaymentPhase("succeeded");
    } else if (result.status === "failed") {
      setPaymentError("Payment did not succeed.");
      setPaymentPhase("failed");
    } else {
      setPaymentPhase("pending");
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  if (loading) return <div className="p-8 text-center text-gray-400">Preparing checkout...</div>;

  if (expired) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-3">Your checkout session expired</h1>
        <p className="text-gray-600 mb-6">{error || "Checkout sessions last 20 minutes. Please start again — your cart is untouched."}</p>
        <button onClick={startCheckout} className="px-6 py-2.5 bg-[#1A3A5C] text-white rounded-full font-semibold hover:bg-[#142d47]">
          Start Checkout Again
        </button>
      </div>
    );
  }

  if (paymentPhase === "succeeded" && confirmedOrder) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-2xl font-bold mb-2">Order placed!</h1>
        <p className="text-gray-600 mb-1">Order #{confirmedOrder._id}</p>
        <p className="text-gray-600 mb-6">
          {paymentMethod === "cod"
            ? `Amount due on delivery: ${money(confirmedOrder.totalAmount)}`
            : `Total paid: ${money(confirmedOrder.totalAmount)}`}
        </p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate("/orders")} className="px-6 py-2.5 bg-[#1A3A5C] text-white rounded-full font-semibold hover:bg-[#142d47]">
            View My Orders
          </button>
          <button onClick={() => navigate("/shop")} className="px-6 py-2.5 border rounded-full font-semibold hover:bg-gray-100">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  // ── "Processing your payment..." — after Razorpay's modal returns
  // control (success or otherwise), before verify's response settles
  // things. Never guessed as success/failure while in this state. ──────
  if (paymentPhase === "processing") {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="text-4xl mb-3 animate-pulse">⏳</div>
        <h1 className="text-2xl font-bold mb-2">Processing your payment...</h1>
        <p className="text-gray-600">Please don't close this window. This usually takes just a few seconds.</p>
      </div>
    );
  }

  // ── verify's own request failed/timed out — polling payment-status
  // since the webhook may have already confirmed this independently. ───
  if (paymentPhase === "polling") {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="text-4xl mb-3 animate-pulse">🔄</div>
        <h1 className="text-2xl font-bold mb-2">Confirming your payment...</h1>
        <p className="text-gray-600">
          We couldn't immediately confirm your payment — this doesn't mean it failed. Checking with your bank/payment
          provider now.
        </p>
      </div>
    );
  }

  // ── Honestly uncertain: not yet succeeded or failed after a few polls.
  if (paymentPhase === "pending") {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="text-4xl mb-3">🕓</div>
        <h1 className="text-2xl font-bold mb-2">Your payment is still processing</h1>
        <p className="text-gray-600 mb-6">
          We haven't received final confirmation yet. This can take a few minutes — please don't place a second
          order. You can check again below, or come back later; we'll email you once it's confirmed.
        </p>
        <div className="flex gap-4 justify-center">
          <button onClick={recheckPendingPayment} className="px-6 py-2.5 bg-[#1A3A5C] text-white rounded-full font-semibold hover:bg-[#142d47]">
            Check Again
          </button>
          <button onClick={() => navigate("/orders")} className="px-6 py-2.5 border rounded-full font-semibold hover:bg-gray-100">
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  // ── Confirmed failed/cancelled/expired — offer retry on the SAME order
  // (reservation + order already exist) rather than starting over. ─────
  if (paymentPhase === "failed") {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <div className="text-4xl mb-3">❌</div>
        <h1 className="text-2xl font-bold mb-2">Payment unsuccessful</h1>
        <p className="text-gray-600 mb-6">
          {paymentError || "Your payment could not be completed."}
          {paymentOrder ? ` Your order (#${paymentOrder._id}) is still reserved — you can retry the payment.` : ""}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={retryPayment}
            disabled={retrying || !paymentOrder}
            className="px-6 py-2.5 bg-green-600 text-white rounded-full font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {retrying ? "Starting new attempt..." : "Retry Payment"}
          </button>
          <button onClick={() => navigate("/cart")} className="px-6 py-2.5 border rounded-full font-semibold hover:bg-gray-100">
            Return to Cart
          </button>
        </div>
      </div>
    );
  }

  if (!checkout) return null;

  const pricing = checkout.pricing || { subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0 };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={onBack || (() => navigate("/cart"))} className="mb-6 text-[#1A3A5C] hover:underline">
        ← Back to Cart
      </button>

      <h1 className="text-3xl font-bold mb-6">Checkout</h1>

      {/* Stepper */}
      <div className="flex flex-wrap gap-2 mb-8 text-sm">
        {STEPS.map((s, idx) => (
          <span
            key={s}
            className={`px-3 py-1.5 rounded-full border ${
              step === s ? "bg-[#1A3A5C] text-white border-[#1A3A5C]" : "text-gray-500 border-gray-300"
            }`}
          >
            {idx + 1}. {STEP_LABELS[s]}
          </span>
        ))}
      </div>

      {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {step === "shipping" && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Shipping Address</h2>
              <AddressPicker
                addresses={addresses}
                selectedId={selectedShippingAddr?._id}
                onSelect={setSelectedShippingAddr}
                onAddNew={handleAddShippingAddress}
                showForm={showShippingForm}
                setShowForm={setShowShippingForm}
                saving={savingAddress}
              />
              <button
                onClick={submitShippingAddress}
                disabled={!selectedShippingAddr || processing}
                className="mt-6 w-full px-4 py-3 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] disabled:opacity-50"
              >
                {processing ? "Saving..." : "Continue to Billing"}
              </button>
            </div>
          )}

          {step === "billing" && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Billing Address</h2>
              <label className="flex items-center gap-2 mb-4">
                <input type="checkbox" checked={sameAsShipping} onChange={(e) => setSameAsShipping(e.target.checked)} />
                <span>Same as shipping address</span>
              </label>

              {sameAsShipping ? (
                selectedShippingAddr && (
                  <div className="p-3 border rounded-lg bg-gray-50 text-sm text-gray-700">
                    <p className="font-semibold">{selectedShippingAddr.fullName}</p>
                    <p>{selectedShippingAddr.addressLine1}{selectedShippingAddr.addressLine2 ? `, ${selectedShippingAddr.addressLine2}` : ""}</p>
                    <p>{selectedShippingAddr.city}, {selectedShippingAddr.state} {selectedShippingAddr.postalCode}</p>
                  </div>
                )
              ) : (
                <AddressPicker
                  addresses={addresses}
                  selectedId={selectedBillingAddr?._id}
                  onSelect={setSelectedBillingAddr}
                  onAddNew={handleAddBillingAddress}
                  showForm={showBillingForm}
                  setShowForm={setShowBillingForm}
                  saving={savingAddress}
                />
              )}

              <div className="flex gap-4 mt-6">
                <button onClick={() => setStep("shipping")} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-100">
                  Back
                </button>
                <button
                  onClick={submitBillingAddress}
                  disabled={processing || (!sameAsShipping && !selectedBillingAddr)}
                  className="flex-1 px-4 py-3 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] disabled:opacity-50"
                >
                  {processing ? "Saving..." : "Continue to Delivery"}
                </button>
              </div>
            </div>
          )}

          {step === "delivery" && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Delivery Method</h2>
              {loadingMethods ? (
                <p className="text-gray-400">Loading delivery options...</p>
              ) : (
                <div className="space-y-2">
                  {shippingMethods.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer ${
                        checkout.shippingMethodId === m.id ? "border-[#1A3A5C] bg-blue-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          className="mt-1"
                          checked={checkout.shippingMethodId === m.id}
                          onChange={() => selectShippingMethod(m.id)}
                        />
                        <div>
                          <p className="font-semibold">{m.name}</p>
                          <p className="text-gray-500 text-sm">{m.etaDays} business days</p>
                        </div>
                      </div>
                      <span className="font-semibold">{m.cost === 0 ? "Free" : money(m.cost)}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button onClick={() => setStep("billing")} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-100">
                  Back
                </button>
                <button
                  onClick={goToReview}
                  disabled={!checkout.shippingMethodId || processing}
                  className="flex-1 px-4 py-3 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] disabled:opacity-50"
                >
                  Continue to Review
                </button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-6">
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Coupon Code</h2>
                {checkout.couponCode ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
                    <span className="font-medium text-green-800">Applied: {checkout.couponCode}</span>
                    <button onClick={removeCoupon} disabled={couponBusy} className="text-red-600 hover:underline text-sm">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 border rounded-lg px-3 py-2"
                    />
                    <button
                      onClick={applyCoupon}
                      disabled={couponBusy || !couponInput.trim()}
                      className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] disabled:opacity-50"
                    >
                      {couponBusy ? "Applying..." : "Apply"}
                    </button>
                  </div>
                )}
                {couponError && <p className="text-red-600 text-sm mt-2">{couponError}</p>}
              </div>

              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Order Items</h2>
                <div className="space-y-2">
                  {checkout.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.name}{item.variantLabel ? ` (${item.variantLabel})` : ""} × {item.quantity}</span>
                      <span>{money(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Payment Method</h2>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${paymentMethod === "online" ? "border-[#1A3A5C] bg-[#EAF1FA]" : "border-gray-200"}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} className="w-4 h-4 accent-[#1A3A5C]" />
                    <span className="font-medium">Pay Online (Card / UPI / Netbanking)</span>
                  </label>
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${paymentMethod === "cod" ? "border-[#1A3A5C] bg-[#EAF1FA]" : "border-gray-200"}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="w-4 h-4 accent-[#1A3A5C]" />
                    <span className="font-medium">Cash on Delivery</span>
                  </label>
                </div>
              </div>

              {validating && <p className="text-gray-400 text-sm">Checking prices and stock...</p>}
              {!validating && issues.length > 0 && <IssuesPanel issues={issues} />}
              {!validating && issues.length > 0 && (
                <div className="flex gap-4">
                  <button onClick={() => navigate("/cart")} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-100">
                    Back to Cart
                  </button>
                  <button onClick={runValidate} className="flex-1 px-4 py-3 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47]">
                    Re-check
                  </button>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setStep("delivery")} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-100">
                  Back
                </button>
                <button
                  onClick={placeOrder}
                  disabled={processing || validating || issues.length > 0}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processing ? "Processing..." : paymentMethod === "cod" ? "Place Order (Cash on Delivery)" : "Place Order & Pay"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary sidebar — always the server-computed pricing, never
            recomputed client-side. */}
        <div className="bg-white border rounded-lg p-6 h-fit sticky top-6">
          <h3 className="text-lg font-bold mb-4">Order Summary</h3>
          <div className="space-y-2 mb-4 pb-4 border-b text-sm">
            {checkout.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{item.name} × {item.quantity}</span>
                <span>{money(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(pricing.subtotal)}</span></div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{checkout.freeShipping ? <span className="text-green-700">FREE</span> : money(pricing.shipping)}</span>
            </div>
            <div className="flex justify-between"><span>Tax</span><span>{money(pricing.tax)}</span></div>
            {/* Named breakdown when the engine tells us what applied — an
                automatic promotion can be here even with no coupon typed
                in, so this isn't gated on checkout.couponCode. */}
            {(checkout.appliedPromotions || []).map((p, idx) => (
              p.discountAmount > 0 && (
                <div key={idx} className="flex justify-between text-green-700">
                  <span>{p.name}{p.source === "coupon" ? ` (${checkout.couponCode})` : ""}</span>
                  <span>-{money(p.discountAmount)}</span>
                </div>
              )
            ))}
            {!checkout.appliedPromotions?.length && pricing.discount > 0 && (
              <div className="flex justify-between text-green-700"><span>Discount</span><span>-{money(pricing.discount)}</span></div>
            )}
          </div>
          <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t">
            <span>Total:</span>
            <span>{money(pricing.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
