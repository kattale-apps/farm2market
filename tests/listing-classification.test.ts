import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canPublishListingToMarketSpace,
  canViewListingForUser,
  getMarketSpaceRoleCapability,
  normalizeListingClassification,
} from "../convex/listings";
import { walletForRole } from "../convex/marketspaceShared";
import { resolveQrScanAction } from "../app/marketspace/qrScanner";
import { matchesVisibilityFilter } from "../convex/marketspace";

test("listing classification defaults to a safe goods/public setup", () => {
  assert.deepEqual(normalizeListingClassification({}), {
    listingType: "goods",
    listingCategory: "goods",
    visibility: "all",
    publishToMarketSpace: false,
  });
});

test("listing classification keeps supported values and coerces unsupported ones", () => {
  assert.deepEqual(
    normalizeListingClassification({ listingType: "services", visibility: "verified_only", publishToMarketSpace: true }),
    {
      listingType: "services",
      listingCategory: "services",
      visibility: "verified_only",
      publishToMarketSpace: true,
    }
  );

  assert.deepEqual(
    normalizeListingClassification({ listingType: "unknown" as any, visibility: "private" as any }),
    {
      listingType: "goods",
      listingCategory: "goods",
      visibility: "all",
      publishToMarketSpace: false,
    }
  );
});

test("verified vendors can publish, while unverified sellers cannot", () => {
  assert.equal(
    canPublishListingToMarketSpace({ role: "vendor", verificationStatus: "verified" }, {
      publishToMarketSpace: true,
      visibility: "all",
    }).canPublish,
    true
  );

  assert.equal(
    canPublishListingToMarketSpace({ role: "vendor", verificationStatus: "pending" }, {
      publishToMarketSpace: true,
      visibility: "verified_only",
    }).canPublish,
    false
  );

  assert.equal(
    canPublishListingToMarketSpace({ role: "farmer", marketspaceVendOptIn: true }, {
      publishToMarketSpace: true,
      visibility: "all",
    }).canPublish,
    true
  );
});

test("verified-only listings are hidden from unverified viewers but visible to verified viewers", () => {
  const listing = { publishToMarketSpace: true, visibility: "verified_only" };
  assert.equal(canViewListingForUser({ role: "buyer" }, listing), false);
  assert.equal(canViewListingForUser({ role: "buyer", verificationStatus: "verified" }, listing), true);
  assert.equal(canViewListingForUser({ role: "vendor", verificationStatus: "pending" }, listing), false);
});

test("role capability mapping is explicit and consistent across seller roles", () => {
  assert.deepEqual(getMarketSpaceRoleCapability("vendor"), { canPublish: true, requiresVerification: false, requiresOptIn: false });
  assert.deepEqual(getMarketSpaceRoleCapability("trader"), { canPublish: true, requiresVerification: false, requiresOptIn: false });
  assert.deepEqual(getMarketSpaceRoleCapability("transporter"), { canPublish: true, requiresVerification: false, requiresOptIn: false });
  assert.deepEqual(getMarketSpaceRoleCapability("processor"), { canPublish: true, requiresVerification: false, requiresOptIn: false });
  assert.deepEqual(getMarketSpaceRoleCapability("exporter"), { canPublish: true, requiresVerification: false, requiresOptIn: false });
  assert.deepEqual(getMarketSpaceRoleCapability("contractor"), { canPublish: true, requiresVerification: false, requiresOptIn: false });
  assert.deepEqual(getMarketSpaceRoleCapability("farmer"), { canPublish: false, requiresVerification: false, requiresOptIn: true });
  assert.deepEqual(getMarketSpaceRoleCapability("buyer"), { canPublish: false, requiresVerification: false, requiresOptIn: true });
  assert.deepEqual(getMarketSpaceRoleCapability("admin"), { canPublish: true, requiresVerification: false, requiresOptIn: false });
  assert.deepEqual(getMarketSpaceRoleCapability("unknown-role" as any), { canPublish: false, requiresVerification: false, requiresOptIn: false });
});

test("commercial roles use trader-style wallets, while farmer and buyer roles remain distinct", () => {
  assert.deepEqual(walletForRole("vendor"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("store"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("trader"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("transporter"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("processor"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("exporter"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("contractor"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("farmer"), { accountType: "farmer", key: "userId" });
  assert.deepEqual(walletForRole("buyer"), { accountType: "buyer_reward", key: "userId" });
});

test("QR scan results either open links or fill the public search box with plain text", () => {
  assert.deepEqual(resolveQrScanAction("https://farm2market.example/marketspace?ad=abc123"), {
    kind: "link",
    value: "https://farm2market.example/marketspace?ad=abc123",
  });
  assert.deepEqual(resolveQrScanAction("Sweet potatoes 50kg"), {
    kind: "search",
    value: "Sweet potatoes 50kg",
  });
  assert.deepEqual(resolveQrScanAction("   "), {
    kind: "search",
    value: "",
  });
});

test("board filters can narrow the MarketSpace feed to open or verified-only listings", () => {
  assert.equal(matchesVisibilityFilter("all", "verified_only"), false);
  assert.equal(matchesVisibilityFilter("verified_only", "verified_only"), true);
  assert.equal(matchesVisibilityFilter("verified_only", "all"), true);
  assert.equal(matchesVisibilityFilter(undefined, "verified_only"), true);
});
