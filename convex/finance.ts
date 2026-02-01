// Convex finance module placeholder
import { query } from "./_generated/server";

export const getFinanceSummary = query({
  args: {},
  handler: async (ctx, args) => {
    return { summary: "Finance summary placeholder" };
  },
});
