/**
 * Inventory Block Management
 * 
 * Handles creation of 100kg blocks from trader inventory
 * - Checks when inventory reaches 100kg
 * - Creates 100kg blocks for buyers
 * - Notifies traders when blocks are created
 */

import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";

/**
 * Check and create 100kg blocks for a trader
 * This is called after inventory is created or updated
 * Internal function to avoid circular references
 */
export const checkAndCreate100kgBlocks = internalMutation({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all inventory for this trader that is in_storage and not already a 100kg block
    const allInventory = await ctx.db
      .query("traderInventory")
      .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "in_storage"),
          q.eq(q.field("is100kgBlock"), false)
        )
      )
      .collect();

    // Group by produce type and delivery point (blocks must be the same produce and place)
    const inventoryByProduceLocation = new Map<string, typeof allInventory>();
    
    for (const inv of allInventory) {
      const key = `${inv.produceType}_${inv.deliveryProcessorId ?? "none"}`;
      if (!inventoryByProduceLocation.has(key)) {
        inventoryByProduceLocation.set(key, []);
      }
      inventoryByProduceLocation.get(key)!.push(inv);
    }

    const blocksCreated: Array<{
      blockUtid: string;
      produceType: string;
      deliveryProcessorId?: Id<"users">;
      totalKilos: number;
    }> = [];

    // For each produce/location combination, check if we can create 100kg blocks
    for (const [key, inventoryList] of inventoryByProduceLocation.entries()) {
      // Calculate total available kilos
      let totalAvailableKilos = 0;
      const unitIds: Id<"listingUnits">[] = [];
      let deliveryProcessorId: Id<"users"> | undefined = undefined;
      let produceType: string | null = null;
      let qualityRating: string | undefined = undefined;
      let unitPrice: number | null = null;

      for (const inv of inventoryList) {
        totalAvailableKilos += inv.totalKilos;
        unitIds.push(...inv.listingUnitIds);
        if (!deliveryProcessorId) deliveryProcessorId = inv.deliveryProcessorId;
        if (!produceType) produceType = inv.produceType;
        if (!qualityRating && inv.qualityRating) qualityRating = inv.qualityRating;
        if (!unitPrice) unitPrice = inv.unitPrice;
      }

      if (!produceType || !unitPrice) continue;

      // Sort inventory by acquiredAt (oldest first) to create blocks from oldest inventory
      inventoryList.sort((a, b) => a.acquiredAt - b.acquiredAt);

      // Sort inventory by acquiredAt (oldest first) to create blocks from oldest inventory
      const sortedInventory = [...inventoryList].sort((a, b) => a.acquiredAt - b.acquiredAt);

      // Create 100kg blocks while we have >= 100kg available
      let remainingInventory = sortedInventory;
      while (totalAvailableKilos >= 100) {
        // Select units to make up 100kg block (from oldest inventory first)
        const blockUnitIds: Id<"listingUnits">[] = [];
        let blockKilos = 0;
        const inventoryToUpdate: Array<{ id: Id<"traderInventory">; remainingUnits: Id<"listingUnits">[]; remainingKilos: number }> = [];
        const inventoryToDelete: Id<"traderInventory">[] = [];

        // Collect units from inventory entries until we have 100kg
        for (const inv of remainingInventory) {
          if (blockKilos >= 100) break;

          const neededKilos = 100 - blockKilos;
          
          if (inv.totalKilos >= neededKilos) {
            // Take enough units to make 100kg (approximately 10 units = 100kg)
            // Since units are ~10kg each, we need 10 units for 100kg
            const unitsNeeded = Math.ceil(neededKilos / 10);
            const unitsToTake = Math.min(unitsNeeded, inv.listingUnitIds.length);
            
            blockUnitIds.push(...inv.listingUnitIds.slice(0, unitsToTake));
            blockKilos += unitsToTake * 10; // Each unit is ~10kg

            // Update or delete this inventory entry
            if (inv.listingUnitIds.length > unitsToTake) {
              // Update inventory with remaining units
              const remainingUnits = inv.listingUnitIds.slice(unitsToTake);
              const remainingKilos = remainingUnits.length * 10; // Approximate
              await ctx.db.patch(inv._id, {
                listingUnitIds: remainingUnits,
                totalKilos: remainingKilos,
              });
              inventoryToUpdate.push({
                id: inv._id,
                remainingUnits,
                remainingKilos,
              });
            } else {
              // Delete this inventory entry (all units used)
              await ctx.db.delete(inv._id);
              inventoryToDelete.push(inv._id);
            }
          } else {
            // Take all units from this inventory
            blockUnitIds.push(...inv.listingUnitIds);
            blockKilos += inv.totalKilos;
            await ctx.db.delete(inv._id);
            inventoryToDelete.push(inv._id);
          }
        }

        // Create 100kg block
        if (blockKilos >= 100 && blockUnitIds.length > 0) {
          const blockUtid = generateUTID("admin");
          await ctx.db.insert("traderInventory", {
            traderId: args.traderId,
            listingUnitIds: blockUnitIds,
            totalKilos: 100, // Exactly 100kg block
            blockSize: 100,
            produceType,
            deliveryProcessorId,
            qualityRating,
            unitPrice,
            acquiredAt: getUgandaTime(), // Timestamp when block was created
            storageStartTime: getUgandaTime(),
            status: "in_storage",
            utid: blockUtid,
            is100kgBlock: true, // Mark as 100kg block
          });

          blocksCreated.push({
            blockUtid,
            produceType,
            deliveryProcessorId,
            totalKilos: 100,
          });

          // Update remaining inventory list for next iteration
          remainingInventory = remainingInventory
            .filter(inv => !inventoryToDelete.includes(inv._id))
            .map(inv => {
              const update = inventoryToUpdate.find(u => u.id === inv._id);
              if (update) {
                return {
                  ...inv,
                  listingUnitIds: update.remainingUnits,
                  totalKilos: update.remainingKilos,
                };
              }
              return inv;
            });
          totalAvailableKilos = remainingInventory.reduce((sum, inv) => sum + inv.totalKilos, 0);
        } else {
          break; // Not enough kilos or units for another block
        }
      }
    }

    // Notify trader if blocks were created
    if (blocksCreated.length > 0) {
      const trader = await ctx.db.get(args.traderId);
      if (trader) {
        const blockDetails = blocksCreated.map(b => 
          `${b.totalKilos}kg ${b.produceType} (UTID: ${b.blockUtid})`
        ).join(", ");
        
        await ctx.db.insert("notifications", {
          userId: args.traderId,
          type: "system",
          title: "New 100kg Block(s) Created",
          message: `Your inventory has reached 100kg and new block(s) have been created for buyers: ${blockDetails}`,
          utid: blocksCreated[0].blockUtid,
          read: false,
          createdAt: getUgandaTime(),
        });
      }
    }

    return { blocksCreated: blocksCreated.length, blocks: blocksCreated };
  },
});
