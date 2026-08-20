// Loaded via vitest's `setupFiles` BEFORE any test file's own imports run —
// several modules (razorpayProvider.js, tokens.js) read process.env at
// import time, so these must be set before `src/app.js` is ever imported
// by a test file, not inside a beforeAll in the test file itself.
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
process.env.RAZORPAY_KEY_ID ||= "rzp_test_dummy_key_id";
process.env.RAZORPAY_KEY_SECRET ||= "dummy_test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET ||= "dummy_webhook_secret";
process.env.MOCK_CARRIER_WEBHOOK_SECRET ||= "dummy_mock_carrier_secret";
process.env.NODE_ENV = "test";
