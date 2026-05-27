import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

/**
 * Active Farms smoke coverage for Members -> Active Farms flow.
 *
 * This suite expects a valid admin user id for localStorage bootstrapping.
 * Set E2E_ADMIN_USER_ID to a users-table id for environments where seeded
 * Bio Farm data exists.
 */

test.describe("Active Farms — Community Dashboard", () => {
  test("01 - Active Farms tab is reachable and searchable", async ({ page }) => {
    const adminUserId = process.env.E2E_ADMIN_USER_ID;
    test.skip(!adminUserId, "Set E2E_ADMIN_USER_ID to run Active Farms smoke tests");

    await page.addInitScript((userId) => {
      localStorage.setItem(
        "pilot_user",
        JSON.stringify({
          userId,
          role: "admin",
          adminCategory: "community",
        })
      );
    }, adminUserId);

    await page.goto(`${BASE_URL}/admin/community-dashboard`);
    await page.waitForLoadState("networkidle");

    const activeTab = page.getByTestId("active-farmsee-tab-btn").first();
    const tabCount = await activeTab.count();
    test.skip(tabCount === 0, "No Bio Farm community card visible for this admin user");

    await activeTab.click();

    const searchInput = page.getByTestId("active-farmsee-search").first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill("demo");
    await expect(searchInput).toHaveValue("demo");
  });

  test("02 - Entry modal exposes Download All and Download Selected controls", async ({ page }) => {
    const adminUserId = process.env.E2E_ADMIN_USER_ID;
    test.skip(!adminUserId, "Set E2E_ADMIN_USER_ID to run Active Farms smoke tests");

    await page.addInitScript((userId) => {
      localStorage.setItem(
        "pilot_user",
        JSON.stringify({
          userId,
          role: "admin",
          adminCategory: "community",
        })
      );
    }, adminUserId);

    await page.goto(`${BASE_URL}/admin/community-dashboard`);
    await page.waitForLoadState("networkidle");

    const activeTab = page.getByTestId("active-farmsee-tab-btn").first();
    const tabCount = await activeTab.count();
    test.skip(tabCount === 0, "No Bio Farm community card visible for this admin user");

    await activeTab.click();

    const farmerCard = page.getByTestId("active-farmsee-member-card").first();
    const farmerCount = await farmerCard.count();
    test.skip(farmerCount === 0, "No Active Farms members with entries in current test data");

    await farmerCard.click();

    const modal = page.getByTestId("active-farmsee-entries-modal").first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    await expect(page.getByTestId("active-farmsee-download-all").first()).toBeVisible();
    await expect(page.getByTestId("active-farmsee-download-selected").first()).toBeVisible();
  });
});
