import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { verifyAdminRole } from "./auth";

/**
 * Helper function to check if user is a superadmin
 */
function isSuperAdmin(user: { adminLevel?: "super" | "junior"; adminCategory?: string }): boolean {
  return user.adminLevel === "super" || (user.adminLevel === undefined && !user.adminCategory);
}

/**
 * Add a new tutorial video
 * Only superadmins can add tutorials
 * Extracts YouTube video ID from URL for embedding
 */
export const addTutorial = mutation({
  args: {
    adminId: v.id("users"),
    roleCategory: v.union(
      v.literal("farmer"),
      v.literal("trader"),
      v.literal("buyer"),
      v.literal("admin"),
      v.literal("all")
    ),
    title: v.string(),
    youtubeUrl: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify superadmin
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can add tutorials");
    }

    const user = await ctx.db.get(args.adminId);
    if (!user || !isSuperAdmin(user)) {
      throw new Error("Only superadmins can add tutorials");
    }

    // Extract YouTube video ID from URL
    // Supports: https://www.youtube.com/watch?v=VIDEO_ID and https://youtu.be/VIDEO_ID
    let youtubeVideoId = "";
    const youtubeUrl = args.youtubeUrl.trim();

    if (youtubeUrl.includes("youtube.com")) {
      const match = youtubeUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (match) youtubeVideoId = match[1];
    } else if (youtubeUrl.includes("youtu.be")) {
      const match = youtubeUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (match) youtubeVideoId = match[1];
    }

    if (!youtubeVideoId) {
      throw new Error("Invalid YouTube URL. Please use https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID");
    }

    // Get max order for role category
    const existing = await ctx.db
      .query("tutorialVideos")
      .withIndex("by_role_order", (q) => q.eq("roleCategory", args.roleCategory))
      .collect();

    const maxOrder = existing.length > 0
      ? Math.max(...existing.map((t) => t.order))
      : -1;

    // Create tutorial
    const videoId = await ctx.db.insert("tutorialVideos", {
      roleCategory: args.roleCategory,
      title: args.title,
      youtubeUrl: youtubeUrl,
      youtubeVideoId: youtubeVideoId,
      description: args.description || undefined,
      duration: undefined, // Would be fetched from YouTube API in production
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
      order: maxOrder + 1,
      active: true,
      viewCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: args.adminId,
    });

    return videoId;
  },
});

/**
 * Update a tutorial video
 * Only superadmins can update
 */
export const updateTutorial = mutation({
  args: {
    adminId: v.id("users"),
    videoId: v.id("tutorialVideos"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    youtubeUrl: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify superadmin
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can update tutorials");
    }

    const user = await ctx.db.get(args.adminId);
    if (!user || !isSuperAdmin(user)) {
      throw new Error("Only superadmins can update tutorials");
    }

    // Get existing tutorial
    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Tutorial not found");

    // If YouTube URL changed, extract new video ID
    let updates: any = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.active !== undefined) updates.active = args.active;

    if (args.youtubeUrl !== undefined) {
      const youtubeUrl = args.youtubeUrl.trim();
      let youtubeVideoId = "";

      if (youtubeUrl.includes("youtube.com")) {
        const match = youtubeUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (match) youtubeVideoId = match[1];
      } else if (youtubeUrl.includes("youtu.be")) {
        const match = youtubeUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (match) youtubeVideoId = match[1];
      }

      if (!youtubeVideoId) {
        throw new Error("Invalid YouTube URL");
      }

      updates.youtubeUrl = youtubeUrl;
      updates.youtubeVideoId = youtubeVideoId;
      updates.thumbnailUrl = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
    }

    await ctx.db.patch(args.videoId, updates);
    return args.videoId;
  },
});

/**
 * Delete a tutorial video
 * Only superadmins can delete
 */
export const deleteTutorial = mutation({
  args: {
    adminId: v.id("users"),
    videoId: v.id("tutorialVideos"),
  },
  handler: async (ctx, args) => {
    // Verify superadmin
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can delete tutorials");
    }

    const user = await ctx.db.get(args.adminId);
    if (!user || !isSuperAdmin(user)) {
      throw new Error("Only superadmins can delete tutorials");
    }

    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Tutorial not found");

    await ctx.db.delete(args.videoId);
    return { success: true };
  },
});

/**
 * Reorder tutorials within a role category
 * Only superadmins can reorder
 */
export const reorderTutorials = mutation({
  args: {
    adminId: v.id("users"),
    roleCategory: v.union(
      v.literal("farmer"),
      v.literal("trader"),
      v.literal("buyer"),
      v.literal("admin"),
      v.literal("all")
    ),
    videoIds: v.array(v.id("tutorialVideos")),
  },
  handler: async (ctx, args) => {
    // Verify superadmin
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can reorder tutorials");
    }

    const user = await ctx.db.get(args.adminId);
    if (!user || !isSuperAdmin(user)) {
      throw new Error("Only superadmins can reorder tutorials");
    }

    // Update order for each video
    for (let i = 0; i < args.videoIds.length; i++) {
      const video = await ctx.db.get(args.videoIds[i]);
      if (!video) continue;
      if (video.roleCategory !== args.roleCategory) continue;

      await ctx.db.patch(args.videoIds[i], {
        order: i,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Increment view count for a tutorial
 * Called when user watches a tutorial
 */
export const incrementViewCount = mutation({
  args: {
    videoId: v.id("tutorialVideos"),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Tutorial not found");

    const currentCount = video.viewCount || 0;
    await ctx.db.patch(args.videoId, {
      viewCount: currentCount + 1,
    });

    return { viewCount: currentCount + 1 };
  },
});

/**
 * Get tutorials for a specific role
 * Returns active tutorials ordered by display order
 * Members use this to browse tutorials for their role
 */
export const getTutorialsByRole = query({
  args: {
    roleCategory: v.union(
      v.literal("farmer"),
      v.literal("trader"),
      v.literal("buyer"),
      v.literal("admin"),
      v.literal("all")
    ),
  },
  handler: async (ctx, args) => {
    // Get role-specific tutorials + all-role tutorials
    const roleVideos = await ctx.db
      .query("tutorialVideos")
      .withIndex("by_role_order", (q) => q.eq("roleCategory", args.roleCategory))
      .filter((q) => q.eq(q.field("active"), true))
      .collect();

    const allVideos = await ctx.db
      .query("tutorialVideos")
      .withIndex("by_role_order", (q) => q.eq("roleCategory", "all"))
      .filter((q) => q.eq(q.field("active"), true))
      .collect();

    // Combine and sort by order
    const combined = [...roleVideos, ...allVideos].sort((a, b) => a.order - b.order);

    return combined.map((video) => ({
      _id: video._id,
      title: video.title,
      description: video.description,
      youtubeVideoId: video.youtubeVideoId,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      viewCount: video.viewCount || 0,
    }));
  },
});

/**
 * Get all tutorials for superadmin management
 * Returns all tutorials (active and inactive) with full metadata
 */
export const getAllTutorials = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify superadmin
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin" || !isSuperAdmin(user)) {
      throw new Error("Only superadmins can view all tutorials");
    }

    const videos = await ctx.db
      .query("tutorialVideos")
      .order("asc")
      .collect();

    // Group by role category for easier management
    const grouped = {
      farmer: [] as typeof videos,
      trader: [] as typeof videos,
      buyer: [] as typeof videos,
      admin: [] as typeof videos,
      all: [] as typeof videos,
    };

    videos.forEach((v) => {
      if (grouped[v.roleCategory]) {
        grouped[v.roleCategory].push(v);
      }
    });

    return grouped;
  },
});

/**
 * Get a single tutorial for editing
 * Only superadmins can access
 */
export const getTutorialForEdit = query({
  args: {
    adminId: v.id("users"),
    videoId: v.id("tutorialVideos"),
  },
  handler: async (ctx, args) => {
    // Verify superadmin
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin" || !isSuperAdmin(user)) {
      throw new Error("Only superadmins can edit tutorials");
    }

    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Tutorial not found");

    return video;
  },
});
