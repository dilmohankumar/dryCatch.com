import { defineConfig } from "vitest/config";

// Single config for unit + integration + smoke — they're distinguished by
// directory (tests/unit, tests/integration, tests/smoke), not by separate
// runners. `singleFork: true` avoids multiple worker processes each
// spinning up their own in-memory MongoDB instance (tests/helpers/testDb.js
// shares ONE instance per test file via globalSetup-style beforeAll/afterAll,
// which is fast enough for this project's current test volume without
// needing real parallelism yet).
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    pool: "forks",
    singleFork: true,
    // Every test file owns the ONE global `mongoose` connection for its
    // lifetime (connect in beforeAll, disconnect in afterAll) — this is a
    // real constraint (mongoose is a process-wide singleton), not a
    // preference. Running files concurrently let one file's
    // connect/disconnect/clearTestDb race another's, causing exactly the
    // "passes alone, fails in the full suite" flake this setting fixes.
    fileParallelism: false,
    include: ["tests/**/*.test.js"],
    setupFiles: ["./tests/helpers/testEnv.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.js"],
      // Coverage is measured, not chased blindly (rule #72) — no arbitrary
      // global threshold gate here; docs/testing.md documents which modules
      // actually need strong coverage (payment/discount/inventory/auth logic)
      // versus which don't (thin controllers, DTO mappers).
    },
  },
});
