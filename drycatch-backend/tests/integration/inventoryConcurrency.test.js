import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDb, stopTestDb, clearTestDb } from "../helpers/testDb.js";
import { createProduct, createVariant, stockVariant } from "../helpers/factories.js";
import * as inventoryService from "../../src/services/inventoryService.js";
import Inventory from "../../src/models/Inventory.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

// Inventory contention test (rule #23/#88) — simulate many "simultaneous"
// customers attempting to purchase the last units of limited stock.
// Verifies: no overselling, correct final inventory, no negative stock.
describe("inventory concurrency — oversell prevention", () => {
  it("should allow exactly N reservations to succeed when stock is N units, rejecting the rest", async () => {
    const product = await createProduct();
    const variant = await createVariant(product);
    await stockVariant(variant._id, 10); // only 10 units available

    // 30 "simultaneous" customers each trying to reserve 1 unit.
    const attempts = Array.from({ length: 30 }, (_, i) =>
      inventoryService.reserveStock({
        variantId: variant._id,
        quantity: 1,
        referenceType: "order",
        referenceId: `concurrent-order-${i}`,
      }).then(() => ({ ok: true })).catch(() => ({ ok: false }))
    );

    const results = await Promise.all(attempts);
    const successCount = results.filter((r) => r.ok).length;

    expect(successCount).toBe(10); // exactly the available stock, never more

    const location = await inventoryService.getDefaultLocation();
    const inventory = await Inventory.findOne({ variant: variant._id, location });
    expect(inventory.quantityReserved).toBe(10);
    expect(inventory.quantityOnHand - inventory.quantityReserved).toBe(0); // no negative available stock
  });

  it("should never allow quantityReserved to exceed quantityOnHand even under concurrent partial-quantity requests", async () => {
    const product = await createProduct();
    const variant = await createVariant(product);
    await stockVariant(variant._id, 5);

    // Mixed request sizes racing for the same 5 units.
    const attempts = [3, 3, 2, 2, 1, 1, 4].map((qty, i) =>
      inventoryService.reserveStock({
        variantId: variant._id,
        quantity: qty,
        referenceType: "order",
        referenceId: `mixed-order-${i}`,
      }).then(() => ({ ok: true, qty })).catch(() => ({ ok: false, qty }))
    );

    const results = await Promise.all(attempts);
    const totalReserved = results.filter((r) => r.ok).reduce((sum, r) => sum + r.qty, 0);

    expect(totalReserved).toBeLessThanOrEqual(5);

    const location = await inventoryService.getDefaultLocation();
    const inventory = await Inventory.findOne({ variant: variant._id, location });
    expect(inventory.quantityReserved).toBeLessThanOrEqual(inventory.quantityOnHand);
    expect(inventory.quantityReserved).toBe(totalReserved);
  });

  it("should be idempotent — reserving twice for the same reference does not double-reserve", async () => {
    const product = await createProduct();
    const variant = await createVariant(product);
    await stockVariant(variant._id, 10);

    await inventoryService.reserveStock({ variantId: variant._id, quantity: 3, referenceType: "order", referenceId: "same-ref" });
    await inventoryService.reserveStock({ variantId: variant._id, quantity: 3, referenceType: "order", referenceId: "same-ref" });

    const location = await inventoryService.getDefaultLocation();
    const inventory = await Inventory.findOne({ variant: variant._id, location });
    expect(inventory.quantityReserved).toBe(3); // not 6
  });

  it("should release a reservation and make stock available again", async () => {
    const product = await createProduct();
    const variant = await createVariant(product);
    await stockVariant(variant._id, 10);

    await inventoryService.reserveStock({ variantId: variant._id, quantity: 4, referenceType: "order", referenceId: "release-test" });
    await inventoryService.releaseReservationsForReference("order", "release-test");

    const location = await inventoryService.getDefaultLocation();
    const inventory = await Inventory.findOne({ variant: variant._id, location });
    expect(inventory.quantityReserved).toBe(0);
    expect(inventory.quantityOnHand - inventory.quantityReserved).toBe(10);
  });
});
