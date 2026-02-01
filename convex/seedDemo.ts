// Convex seedDemo module placeholder
import { mutation } from "./_generated/server";

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx, args) => {
    return { success: true, message: "Demo data seeded (placeholder)" };
  },
});
