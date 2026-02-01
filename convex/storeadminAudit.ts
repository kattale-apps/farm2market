// Convex storeadminAudit module placeholder
import { query } from "./_generated/server";

export const getStoreAdminAudit = query({
  args: {},
  handler: async (ctx, args) => {
    return { audits: [] };
  },
});
