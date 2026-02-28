import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Add a delivery location to a store
 */
export const addDeliveryLocation = mutation({
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    address: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store) {
      throw new Error("Store not found");
    }

    const locationId = Math.random().toString(36).substr(2, 9); // Simple unique ID
    const newLocation = {
      locationId,
      name: args.name.trim(),
      address: args.address.trim(),
      lat: args.lat,
      lng: args.lng,
      createdAt: Date.now(),
    };

    const currentLocations = store.deliveryLocations || [];
    const updatedLocations = [...currentLocations, newLocation];

    await ctx.db.patch(args.storeId, {
      deliveryLocations: updatedLocations,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      locationId,
      message: "Delivery location added successfully",
    };
  },
});

/**
 * Remove a delivery location from a store
 */
export const removeDeliveryLocation = mutation({
  args: {
    storeId: v.id("stores"),
    locationId: v.string(),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store) {
      throw new Error("Store not found");
    }

    const currentLocations = store.deliveryLocations || [];
    const locationExists = currentLocations.some(
      (loc) => loc.locationId === args.locationId
    );

    if (!locationExists) {
      throw new Error("Delivery location not found");
    }

    const updatedLocations = currentLocations.filter(
      (loc) => loc.locationId !== args.locationId
    );

    await ctx.db.patch(args.storeId, {
      deliveryLocations: updatedLocations,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: "Delivery location removed successfully",
    };
  },
});

/**
 * Get store with all its delivery locations
 */
export const getStoreWithLocations = query({
  args: {
    storeId: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store) {
      return null;
    }

    return {
      _id: store._id,
      adminId: store.adminId,
      communityId: store.communityId,
      storeName: store.storeName,
      deliveryLocations: store.deliveryLocations || [],
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    };
  },
});

/**
 * Get all stores for a junior admin
 */
export const getAdminStores = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const stores = await ctx.db
      .query("stores")
      .filter((q) => q.eq(q.field("adminId"), args.adminId))
      .collect();

    return stores.map((store) => ({
      _id: store._id,
      adminId: store.adminId,
      communityId: store.communityId,
      storeName: store.storeName,
      deliveryLocations: store.deliveryLocations || [],
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    }));
  },
});
