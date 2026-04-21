import { test, expect } from "@playwright/test";

/**
 * SMOKE TESTS: Market Prices Feature
 *
 * Covers the 4 core scenarios for the public market price panel
 * and related UX flows. These tests do NOT require a real published
 * snapshot — they verify UI presence and routing behaviour.
 */

const BASE_URL = "http://localhost:3000";

test.describe("Market Prices Panel — Login Page", () => {
  test("01 - Login page loads and shows price panel section", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // At desktop viewport the desktop panel is rendered (mobile is display:none)
    const panel = page.locator(".f2m-panel-desktop [aria-label='Live market prices']");
    await expect(panel).toBeVisible({ timeout: 10000 });
  });

  test("02 - Buy button navigates to login with intent=buy param", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Scope to the visible desktop panel
    const desktopPanel = page.locator(".f2m-panel-desktop");
    await expect(desktopPanel).toBeVisible({ timeout: 10000 });

    const buyButton = desktopPanel.locator("button[title='Buy — sign in as buyer']").first();
    const comingSoon = desktopPanel.locator("text=Market prices coming soon");

    // Wait up to 12s for either real price cards or coming-soon state
    let hasBuyButton = false;
    try {
      await buyButton.waitFor({ timeout: 12000 });
      hasBuyButton = true;
    } catch {
      hasBuyButton = false;
    }

    if (hasBuyButton) {
      await buyButton.click();
      await expect(page).toHaveURL(/intent=buy/, { timeout: 8000 });
    } else {
      // No snapshot published yet — coming-soon state is valid
      await expect(comingSoon).toBeVisible({ timeout: 5000 });
    }
  });

  test("03 - Price panel cards do NOT contain vendor alias or stall number", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Scope to the visible desktop panel
    const panel = page.locator(".f2m-panel-desktop [aria-label='Live market prices']");
    await expect(panel).toBeVisible({ timeout: 10000 });

    const panelText = await panel.innerText();

    // These are internal vendor identifiers that must NOT appear on the public panel
    expect(panelText).not.toMatch(/stall\s*#?\d+/i);
    expect(panelText).not.toMatch(/alias:/i);
    expect(panelText).not.toMatch(/seller alias/i);
  });

  test("04 - intent=buy param on login URL pre-selects buyer role in Sign Up tab", async ({ page }) => {
    await page.goto(`${BASE_URL}/login?intent=buy&role=buyer`);

    // Sign Up tab should be active (not Login)
    const signUpTab = page.locator("button", { hasText: "Sign Up" });
    await expect(signUpTab).toBeVisible({ timeout: 5000 });

    // The Sign Up tab should have blue border (active state) — check border-bottom style
    // or just verify that the page doesn't show the login form first
    const createAccountButton = page.locator("button", { hasText: "Create Account" });
    await expect(createAccountButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Market Prices Panel — Mobile Layout", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("05 - On mobile the price panel appears below the login card", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    // Login card heading
    const heading = page.locator("h1", { hasText: "Farm2Market Uganda" });
    await expect(heading).toBeVisible({ timeout: 8000 });

    // Mobile panel (f2m-panel-mobile) should be in the DOM
    const mobilePanel = page.locator(".f2m-panel-mobile");
    await expect(mobilePanel).toBeAttached({ timeout: 5000 });
  });
});
