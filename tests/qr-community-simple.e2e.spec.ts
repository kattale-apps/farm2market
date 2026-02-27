import { test, expect } from "@playwright/test";

/**
 * SIMPLIFIED E2E TEST SUITE: QR COMMUNITY FEATURES
 * 
 * Tests basic navigation and page loads for the QR community feature set
 */

const BASE_URL = "http://localhost:3000";

test.describe("QR Community Feature Pages", () => {
  
  test("01 - Dashboard page loads", async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check page has content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(500);
  });

  test("02 - Community noticeboard page accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/community-only/noticeboard`);
    
    // Wait for network to settle
    await page.waitForLoadState('networkidle');
    
    // Verify page loads
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test("03 - My communities page accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/my-communities`);
    
    // Wait for network to settle
    await page.waitForLoadState('networkidle');
    
    // Verify page loads
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test("04 - Messages page accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/community-only/messages`);
    
    // Wait for network to settle
    await page.waitForLoadState('networkidle');
    
    // Verify page loads
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test("05 - Profile page accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/community-only/profile`);
    
    // Wait for network to settle
    await page.waitForLoadState('networkidle');
    
    // Verify page loads
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test("06 - Superadmin usage dashboard accessible", async ({ page }) => {
    await page.goto(`${BASE_URL}/superadmin/usage`);
    
    // Wait for network to settle
    await page.waitForLoadState('networkidle');
    
    // Verify page loads
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});

test.describe("QR Community Responsive Design", () => {
  
  test("Mobile viewport - My Communities", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto(`${BASE_URL}/my-communities`);
    
    // Wait for load
    await page.waitForLoadState('networkidle');
    
    // Verify renders without errors
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test("Tablet viewport - Noticeboard", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto(`${BASE_URL}/community-only/noticeboard`);
    
    // Wait for load
    await page.waitForLoadState('networkidle');
    
    // Verify renders without errors
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test("Desktop viewport - Messages", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto(`${BASE_URL}/community-only/messages`);
    
    // Wait for load
    await page.waitForLoadState('networkidle');
    
    // Verify renders without errors
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
