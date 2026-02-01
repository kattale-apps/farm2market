// Convex serviceLevels module placeholder
import { query } from "./_generated/server";

export const getServiceLevels = query({
  args: {},
  handler: async (ctx, args) => {
    return [
      { level: "Standard", description: "Standard service level" },
      { level: "Premium", description: "Premium service level" },
    ];
  },
});
