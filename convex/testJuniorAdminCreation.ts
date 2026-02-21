import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Test mutation to debug community admin creation issue
 * This will help us understand what's failing
 */
export const testCreateJuniorCommunityAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      console.log("=== Testing Junior Community Admin Creation ===");
      
      // Step 1: Create a super admin user directly in the database
      console.log("Step 1: Creating super admin...");
      const superAdminId = await ctx.db.insert("users", {
        email: `test_super_${Date.now()}@test.com`,
        role: "admin",
        alias: `super_${Date.now()}`,
        state: "active",
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        adminLevel: "super",
      });
      console.log("✅ Super admin created:", superAdminId);

      // Step 2: Try to create a junior community admin WITHOUT communities using auth.createUser
      console.log("\nStep 2: Creating junior community admin without communities...");
      try {
        const result = await ctx.runMutation(api.auth.createUser, {
          email: `test_junior_${Date.now()}@test.com`,
          role: "admin",
          adminLevel: "junior",
          adminCategory: "community",
          creatorAdminId: superAdminId,
          // Intentionally NOT providing assignedCommunityIds
        });
        console.log("✅ Junior community admin created successfully!");
        console.log("Result:", result);
        return { success: true, result };
      } catch (error: any) {
        console.log("❌ Error creating junior community admin:");
        console.log("Message:", error.message);
        console.log("Full error:", error);
        return { success: false, error: error.message };
      }
    } catch (error: any) {
      console.log("❌ Test failed with error:", error.message);
      return { success: false, error: error.message };
    }
  },
});

// Query to check if the user was created
export const checkTestUser = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    if (!user) {
      return { exists: false };
    }
    
    return {
      exists: true,
      userId: user._id,
      role: user.role,
      adminLevel: user.adminLevel,
      adminCategory: user.adminCategory,
      assignedCommunityIds: user.assignedCommunityIds,
    };
  },
});
