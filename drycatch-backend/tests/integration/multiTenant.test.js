import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startTestDb, stopTestDb, clearTestDb } from "../helpers/testDb.js";
import { createUser } from "../helpers/factories.js";
import { validateTenantSlug, RESERVED_SLUGS } from "../../src/utils/tenantSlug.js";
import { provisionTenant, ensureDefaultTenant } from "../../src/services/tenant/tenantProvisioningService.js";
import * as membershipService from "../../src/services/tenant/tenantMembershipService.js";
import * as productService from "../../src/services/productService.js";
import Tenant from "../../src/models/Tenant.js";
import Role from "../../src/models/Role.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe("tenantSlug validation (rule #7)", () => {
  it("should reject reserved platform words", () => {
    expect(validateTenantSlug("admin")).toBeTruthy();
    expect(validateTenantSlug("api")).toBeTruthy();
    expect(RESERVED_SLUGS.has("admin")).toBe(true);
  });

  it("should reject slugs that are too short or contain invalid characters", () => {
    expect(validateTenantSlug("ab")).toBeTruthy();
    expect(validateTenantSlug("My Store!")).toBeTruthy();
    expect(validateTenantSlug("-leading-hyphen")).toBeTruthy();
  });

  it("should accept a well-formed, non-reserved slug", () => {
    expect(validateTenantSlug("my-cool-store")).toBeNull();
  });
});

describe("tenant provisioning (rule #79)", () => {
  it("should create a tenant with a default role set and an owner membership", async () => {
    const owner = await createUser();
    const tenant = await provisionTenant({ name: "Acme Fish Co", slug: "acme-fish", ownerUserId: owner._id });

    expect(tenant.slug).toBe("acme-fish");
    expect(tenant.status).toBe("trialing");

    const ownerRole = await Role.findOne({ tenant: tenant._id, name: "OWNER" });
    expect(ownerRole).not.toBeNull();
    expect(ownerRole.permissions).toContain("team.manage");

    const memberships = await membershipService.listMembershipsForUser(owner._id);
    expect(memberships).toHaveLength(1);
    expect(String(memberships[0].tenant._id)).toBe(String(tenant._id));
    expect(memberships[0].role.name).toBe("OWNER");
  });

  it("should reject a duplicate slug", async () => {
    const owner = await createUser();
    await provisionTenant({ name: "First", slug: "duplicate-slug", ownerUserId: owner._id });
    await expect(provisionTenant({ name: "Second", slug: "duplicate-slug", ownerUserId: owner._id })).rejects.toThrow();
  });

  it("should reject a reserved slug", async () => {
    const owner = await createUser();
    await expect(provisionTenant({ name: "Nope", slug: "admin", ownerUserId: owner._id })).rejects.toThrow();
  });

  it("ensureDefaultTenant should be idempotent", async () => {
    const first = await ensureDefaultTenant();
    const second = await ensureDefaultTenant();
    expect(String(first._id)).toBe(String(second._id));
    expect(await Tenant.countDocuments({ slug: first.slug })).toBe(1);
  });
});

describe("tenant membership invitations (rule #21)", () => {
  it("should invite a member and let them accept it", async () => {
    const owner = await createUser();
    const tenant = await provisionTenant({ name: "Acme", slug: "acme-invite", ownerUserId: owner._id });
    const adminRole = await Role.findOne({ tenant: tenant._id, name: "ADMIN" });
    const invitee = await createUser({ email: "invitee@example.com" });

    const invited = await membershipService.inviteMember({ tenantId: tenant._id, email: "invitee@example.com", roleId: adminRole._id, invitedBy: owner._id });
    expect(invited.status).toBe("invited");

    // Simulate accepting: fetch the token directly (would arrive via email in production)
    const membershipService_ = await import("../../src/models/TenantMembership.js");
    const raw = await membershipService_.default.findById(invited._id).select("+inviteToken");
    const accepted = await membershipService.acceptInvite({ token: raw.inviteToken, userId: invitee._id });
    expect(accepted.status).toBe("active");

    const members = await membershipService.listMembers(tenant._id);
    expect(members).toHaveLength(2); // owner + accepted invitee
  });

  it("should not allow a duplicate active invitation to the same email", async () => {
    const owner = await createUser();
    const tenant = await provisionTenant({ name: "Acme", slug: "acme-dup-invite", ownerUserId: owner._id });
    const adminRole = await Role.findOne({ tenant: tenant._id, name: "ADMIN" });

    const first = await membershipService.inviteMember({ tenantId: tenant._id, email: "dup@example.com", roleId: adminRole._id, invitedBy: owner._id });
    // Re-inviting the same email updates the same row rather than creating a duplicate
    const second = await membershipService.inviteMember({ tenantId: tenant._id, email: "dup@example.com", roleId: adminRole._id, invitedBy: owner._id });
    expect(String(first._id)).toBe(String(second._id));
  });
});

describe("cross-tenant product isolation (rule #62/#63)", () => {
  it("should let two tenants each create a product with the SAME slug without colliding", async () => {
    const ownerA = await createUser();
    const ownerB = await createUser();
    const tenantA = await provisionTenant({ name: "Store A", slug: "store-a", ownerUserId: ownerA._id });
    const tenantB = await provisionTenant({ name: "Store B", slug: "store-b", ownerUserId: ownerB._id });

    const productA = await productService.createProduct({ name: "Almonds", price: 500 }, tenantA._id);
    const productB = await productService.createProduct({ name: "Almonds", price: 600 }, tenantB._id);

    expect(productA.slug).toBe(productB.slug); // same slug, different tenants — allowed
    expect(String(productA.tenant)).toBe(String(tenantA._id));
    expect(String(productB.tenant)).toBe(String(tenantB._id));
  });

  it("should NOT return tenant B's product when looked up by slug scoped to tenant A", async () => {
    const ownerA = await createUser();
    const ownerB = await createUser();
    const tenantA = await provisionTenant({ name: "Store A", slug: "store-a2", ownerUserId: ownerA._id });
    const tenantB = await provisionTenant({ name: "Store B", slug: "store-b2", ownerUserId: ownerB._id });

    const productB = await productService.createProduct({ name: "Cashews", price: 700, status: "active", visibility: "public" }, tenantB._id);

    const foundViaA = await productService.getPublicProductByIdOrSlug(productB.slug, tenantA._id);
    expect(foundViaA).toBeNull();

    const foundViaB = await productService.getPublicProductByIdOrSlug(productB.slug, tenantB._id);
    expect(foundViaB).not.toBeNull();
  });

  it("should exclude tenant B's products from tenant A's product listing", async () => {
    const ownerA = await createUser();
    const ownerB = await createUser();
    const tenantA = await provisionTenant({ name: "Store A", slug: "store-a3", ownerUserId: ownerA._id });
    const tenantB = await provisionTenant({ name: "Store B", slug: "store-b3", ownerUserId: ownerB._id });

    await productService.createProduct({ name: "Tenant A Product", price: 100, status: "active", visibility: "public" }, tenantA._id);
    await productService.createProduct({ name: "Tenant B Product", price: 200, status: "active", visibility: "public" }, tenantB._id);

    const { items } = await productService.listProducts({}, tenantA._id);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Tenant A Product");
  });

  it("should refuse to update a product that belongs to a different tenant (IDOR check)", async () => {
    const ownerA = await createUser();
    const ownerB = await createUser();
    const tenantA = await provisionTenant({ name: "Store A", slug: "store-a4", ownerUserId: ownerA._id });
    const tenantB = await provisionTenant({ name: "Store B", slug: "store-b4", ownerUserId: ownerB._id });

    const productB = await productService.createProduct({ name: "Prawns", price: 300 }, tenantB._id);

    const result = await productService.updateProduct(productB._id, { name: "Hacked Name" }, ownerA._id, tenantA._id);
    expect(result).toBeNull();

    const stillOriginal = await productService.getPublicProductByIdOrSlug(String(productB._id), tenantB._id);
    // status defaults to draft so getPublicProductByIdOrSlug (active/public only) won't find it — verify via direct model instead
    const Product = (await import("../../src/models/Product.js")).default;
    const raw = await Product.findById(productB._id);
    expect(raw.name).toBe("Prawns");
  });
});
