/**
 * Tests for Community Form Table Validation
 * 
 * These tests ensure that:
 * 1. Forms WITH communityId pass validation
 * 2. Forms WITHOUT communityId fail validation
 * 3. Cross-community forms are filtered out
 * 
 * Run: npm test -- communityForms.test.ts
 * 
 * This catches violations early before they hit production.
 */

import {
  validateCommunityForm,
  filterCommunityForms,
  isCommunityForm,
} from "./types/communityForms";

describe("Community Form Validation", () => {
  const validForm = {
    _id: "form_123",
    communityId: "community_abc",
    farmerId: "farmer_123",
    status: "DRAFT" as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    section1: { farmName: "Test Farm" },
  };

  const formMissingCommunityId = {
    _id: "form_456",
    farmerId: "farmer_456",
    status: "SUBMITTED" as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // ─────────────────────────────────────────────────────────────
  // validateCommunityForm tests
  // ─────────────────────────────────────────────────────────────

  describe("validateCommunityForm", () => {
    test("✅ should pass for valid form with communityId", () => {
      expect(() =>
        validateCommunityForm(validForm, "Test Form")
      ).not.toThrow();
    });

    test("❌ should throw if form missing communityId", () => {
      expect(() =>
        validateCommunityForm(formMissingCommunityId, "Test Form")
      ).toThrow(/SECURITY ERROR.*communityId/);
    });

    test("❌ should throw if communityId doesn't match expected", () => {
      expect(() =>
        validateCommunityForm(
          validForm,
          "Test Form",
          "different_community"
        )
      ).toThrow(/belongs to community.*not/);
    });

    test("✅ should pass when communityId matches expected", () => {
      expect(() =>
        validateCommunityForm(
          validForm,
          "Test Form",
          "community_abc"
        )
      ).not.toThrow();
    });

    test("❌ should throw if form is null", () => {
      expect(() =>
        validateCommunityForm(null, "Test Form")
      ).toThrow(/not found/);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // filterCommunityForms tests
  // ─────────────────────────────────────────────────────────────

  describe("filterCommunityForms", () => {
    const forms = [
      { ...validForm, _id: "form_1", communityId: "community_a" },
      { ...validForm, _id: "form_2", communityId: "community_a" },
      { ...validForm, _id: "form_3", communityId: "community_b" }, // Wrong community
      { ...formMissingCommunityId, _id: "form_4" }, // Missing communityId
    ];

    test("✅ should filter forms by communityId", () => {
      const filtered = filterCommunityForms(forms, "community_a", false);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((f: any) => f._id)).toEqual(["form_1", "form_2"]);
    });

    test("❌ should throw when form missing communityId (throwOnMismatch=true)", () => {
      expect(() =>
        filterCommunityForms(forms, "community_a", true)
      ).toThrow(/missing communityId/);
    });

    test("✅ should skip invalid forms (throwOnMismatch=false)", () => {
      const filtered = filterCommunityForms(forms, "community_a", false);
      expect(filtered).toHaveLength(2); // Only forms with matching communityId
    });

    test("✅ should handle empty array", () => {
      const filtered = filterCommunityForms([], "community_a");
      expect(filtered).toEqual([]);
    });

    test("✅ should handle null values in array", () => {
      const filtered = filterCommunityForms(
        [validForm, null, { ...validForm, communityId: "other" }],
        "community_abc",
        false
      );
      expect(filtered).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // isCommunityForm type guard tests
  // ─────────────────────────────────────────────────────────────

  describe("isCommunityForm type guard", () => {
    test("✅ should return true for valid community form", () => {
      expect(isCommunityForm(validForm)).toBe(true);
    });

    test("❌ should return false if missing communityId", () => {
      expect(isCommunityForm(formMissingCommunityId)).toBe(false);
    });

    test("❌ should return false if wrong status", () => {
      expect(
        isCommunityForm({
          ...validForm,
          status: "INVALID_STATUS",
        })
      ).toBe(false);
    });

    test("❌ should return false for null", () => {
      expect(isCommunityForm(null)).toBe(false);
    });

    test("❌ should return false if missing timestamps", () => {
      expect(
        isCommunityForm({
          communityId: "com_123",
          farmerId: "farmer_123",
          status: "DRAFT",
          // Missing createdAt and updatedAt
        })
      ).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Integration tests
  // ─────────────────────────────────────────────────────────────

  describe("Integration: Full export validation flow", () => {
    test("Should catch when someone forgets communityId in new form table", () => {
      // Simulates adding a new form table without communityId
      const newFormWithoutCommunityId = {
        _id: "new_form_1",
        farmerId: "farmer_123",
        status: "DRAFT",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // ❌ MISSING: communityId
        bioFarmSpecificField: "some value",
      };

      // The validation should catch this
      expect(() =>
        validateCommunityForm(newFormWithoutCommunityId, "BioFarm Form")
      ).toThrow(/SECURITY ERROR.*communityId/);

      // The type guard should also reject it
      expect(isCommunityForm(newFormWithoutCommunityId)).toBe(false);

      // And filtering should fail
      expect(() =>
        filterCommunityForms([newFormWithoutCommunityId], "community_123", true)
      ).toThrow();
    });

    test("Should accept new form table with communityId", () => {
      const newFormWithCommunityId = {
        _id: "new_form_2",
        communityId: "bioFarm_community",
        farmerId: "farmer_123",
        status: "SUBMITTED",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        bioFarmSpecificField: "some value",
      };

      // All validations should pass
      expect(() =>
        validateCommunityForm(newFormWithCommunityId, "BioFarm Form", "bioFarm_community")
      ).not.toThrow();

      expect(isCommunityForm(newFormWithCommunityId)).toBe(true);

      const filtered = filterCommunityForms([newFormWithCommunityId], "bioFarm_community");
      expect(filtered).toHaveLength(1);
    });
  });
});
