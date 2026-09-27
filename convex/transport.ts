/**
 * Transport directory.
 *
 * Transporters are service providers every role can find. The app does not
 * handle payment or take responsibility for the trip: it verifies vehicles
 * (logbook and insurance) and drivers (licence), shows who is available, and
 * carries bookings and feedback. Phone numbers are not shown; booking and
 * feedback happen in the app, payment is agreed off it.
 *
 * After a completed trip the person who booked rates it in FarmCoins, 0 to
 * 10, and those coins are credited to the transporter as a reward.
 *
 * Vehicles and drivers are verified by a Storage and Transport Officer or a super admin.
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime } from "./utils";
import { isIsoDate } from "./exportMarketsShared";
import { notify, todayUganda, isStorageOfficer, requireAdmin } from "./exportMarkets";

type Ctx = QueryCtx | MutationCtx;

export const TRANSPORT_VEHICLE_TYPES = ["open_pickup", "box_body", "cold_storage", "lorry", "tipper", "motorcycle", "other"];
export const MAX_TRIP_FARMCOINS = 10;

async function requireTransporter(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "transporter") throw new Error("Only transporter accounts can do this");
  return user;
}

async function requireOfficer(ctx: Ctx, adminId: Id<"users">) {
  const admin = await requireAdmin(ctx, adminId);
  if (!isStorageOfficer(admin)) throw new Error("Only a Storage and Transport Officer or super admin can verify transport");
  return admin;
}

async function profileOf(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db.query("transporterProfiles").withIndex("by_userId", (q) => q.eq("userId", userId)).first();
}

/** Verified vehicles with valid insurance and verified drivers with valid licences. */
async function verifiedFleet(ctx: Ctx, transporterId: Id<"users">, today: string) {
  const vehicles = (await ctx.db.query("transportVehicles").withIndex("by_transporterId", (q) => q.eq("transporterId", transporterId)).take(100)).filter(
    (x) => x.status === "verified" && x.insuranceExpiry >= today
  );
  const drivers = (await ctx.db.query("transportDrivers").withIndex("by_transporterId", (q) => q.eq("transporterId", transporterId)).take(100)).filter(
    (x) => x.status === "verified" && x.licenceExpiry >= today
  );
  return { vehicles, drivers, listed: vehicles.length > 0 && drivers.length > 0 };
}

async function tripStats(ctx: Ctx, transporterId: Id<"users">) {
  const trips = await ctx.db.query("transportBookings").withIndex("by_transporterId", (q) => q.eq("transporterId", transporterId)).take(1000);
  const rated = trips.filter((t) => t.farmcoinRating !== undefined);
  return {
    completedTrips: trips.filter((t) => t.status === "completed").length,
    averageFarmcoins: rated.length ? Math.round((rated.reduce((a, t) => a + (t.farmcoinRating ?? 0), 0) / rated.length) * 10) / 10 : null,
    ratings: rated.length,
  };
}

// ------------------------------------------------------------------
// Directory (every role)
// ------------------------------------------------------------------

export const listTransporters = query({
  args: { userId: v.id("users"), today: v.string(), district: v.optional(v.string()), vehicleType: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await ctx.db.get(args.userId);
    if (!viewer) return [];
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const transporters = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "transporter")).take(1000);
    const want = (args.district ?? "").trim().toLowerCase();
    const rows = [];
    for (const t of transporters) {
      if (t.state !== "active" || t._id === viewer._id) continue;
      const profile = await profileOf(ctx, t._id);
      if (!profile?.available) continue;
      const fleet = await verifiedFleet(ctx, t._id, today);
      if (!fleet.listed) continue;
      const served = profile.districtsServed ?? [];
      if (want && !served.some((d) => d.toLowerCase() === want)) continue;
      if (args.vehicleType && !fleet.vehicles.some((x) => x.vehicleType === args.vehicleType)) continue;
      rows.push({
        transporterId: t._id,
        alias: `Transporter ${t.alias}`,
        availableFrom: profile.availableFrom && profile.availableFrom > today ? profile.availableFrom : null,
        districtsServed: served,
        priceGuide: profile.priceGuide ?? null,
        vehicles: fleet.vehicles.map((x) => ({ vehicleType: x.vehicleType, capacityTonnes: x.capacityTonnes })),
        ...(await tripStats(ctx, t._id)),
      });
    }
    rows.sort((a, b) => (b.averageFarmcoins ?? -1) - (a.averageFarmcoins ?? -1));
    return rows;
  },
});

export const bookTransport = mutation({
  args: {
    userId: v.id("users"),
    transporterId: v.id("users"),
    fromDistrict: v.string(),
    toDistrict: v.string(),
    pickupDate: v.string(),
    load: v.string(),
    weightKg: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const requester = await ctx.db.get(args.userId);
    if (!requester || requester.state !== "active") throw new Error("Please log in again");
    if (requester._id === args.transporterId) throw new Error("You cannot book yourself");
    const today = todayUganda();
    const profile = await profileOf(ctx, args.transporterId);
    if (!profile?.available || !(await verifiedFleet(ctx, args.transporterId, today)).listed) throw new Error("This transporter is not taking bookings");
    if (!isIsoDate(args.pickupDate) || args.pickupDate < today) throw new Error("Choose a pickup date from today");
    if (!args.fromDistrict.trim() || !args.toDistrict.trim() || !args.load.trim()) throw new Error("Say where from, where to and what is being moved");
    if (args.weightKg !== undefined && !(args.weightKg > 0)) throw new Error("Weight looks wrong");
    const bookingId = await ctx.db.insert("transportBookings", {
      requesterId: requester._id,
      transporterId: args.transporterId,
      fromDistrict: args.fromDistrict.trim(),
      toDistrict: args.toDistrict.trim(),
      pickupDate: args.pickupDate,
      load: args.load.trim().slice(0, 200),
      weightKg: args.weightKg,
      status: "requested",
      requesterNote: args.note?.trim().slice(0, 500) || undefined,
      createdAt: getUgandaTime(),
    });
    await notify(ctx, args.transporterId, "New transport booking", `${requester.alias} wants transport from ${args.fromDistrict} to ${args.toDistrict} on ${args.pickupDate}: ${args.load}.`);
    return { bookingId };
  },
});

async function tripRows(ctx: Ctx, rows: Doc<"transportBookings">[]) {
  const out = [];
  for (const r of rows) {
    const requester = await ctx.db.get(r.requesterId);
    const transporter = await ctx.db.get(r.transporterId);
    out.push({ ...r, requesterAlias: requester?.alias ?? "", transporterAlias: `Transporter ${transporter?.alias ?? ""}`.trim() });
  }
  return out;
}

export const listMyTransportBookings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("transportBookings").withIndex("by_requesterId", (q) => q.eq("requesterId", args.userId)).order("desc").take(100);
    return await tripRows(ctx, rows);
  },
});

export const cancelTransportBooking = mutation({
  args: { userId: v.id("users"), bookingId: v.id("transportBookings") },
  handler: async (ctx, args) => {
    const b = await ctx.db.get(args.bookingId);
    if (!b || b.requesterId !== args.userId) throw new Error("Booking not found");
    if (b.status !== "requested" && b.status !== "accepted") throw new Error("This trip can no longer be cancelled");
    await ctx.db.patch(b._id, { status: "cancelled" });
    await notify(ctx, b.transporterId, "Transport booking cancelled", `The trip on ${b.pickupDate} was cancelled.`);
    return { success: true };
  },
});

/** Either side marks the trip done. */
export const completeTrip = mutation({
  args: { userId: v.id("users"), bookingId: v.id("transportBookings") },
  handler: async (ctx, args) => {
    const b = await ctx.db.get(args.bookingId);
    if (!b || (b.requesterId !== args.userId && b.transporterId !== args.userId)) throw new Error("Booking not found");
    if (b.status !== "accepted") throw new Error("Only an accepted trip can be marked done");
    await ctx.db.patch(b._id, { status: "completed", completedAt: getUgandaTime() });
    if (args.userId === b.transporterId) {
      await notify(ctx, b.requesterId, "Rate your trip", `Your trip on ${b.pickupDate} is marked done. Rate the transporter with 0 to ${MAX_TRIP_FARMCOINS} FarmCoins.`);
    }
    return { success: true };
  },
});

/** The requester rates a completed trip in FarmCoins; the coins go to the transporter. */
export const rateTrip = mutation({
  args: { userId: v.id("users"), bookingId: v.id("transportBookings"), farmcoins: v.number(), feedback: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const b = await ctx.db.get(args.bookingId);
    if (!b || b.requesterId !== args.userId) throw new Error("Booking not found");
    if (b.status !== "completed") throw new Error("Rate the trip once it is done");
    if (b.farmcoinRating !== undefined) throw new Error("You already rated this trip");
    if (!Number.isInteger(args.farmcoins) || args.farmcoins < 0 || args.farmcoins > MAX_TRIP_FARMCOINS) {
      throw new Error(`Give between 0 and ${MAX_TRIP_FARMCOINS} FarmCoins`);
    }
    const now = getUgandaTime();
    await ctx.db.patch(b._id, { farmcoinRating: args.farmcoins, feedback: args.feedback?.trim().slice(0, 500) || undefined, ratedAt: now });
    if (args.farmcoins > 0) {
      // Transporters hold FarmCoins in the same account type as exporters.
      const latest = await ctx.db
        .query("farmcoinLedger")
        .withIndex("by_trader", (q) => q.eq("traderId", b.transporterId))
        .order("desc")
        .first();
      const balance = (latest?.balanceAfter ?? 0) + args.farmcoins;
      await ctx.db.insert("farmcoinLedger", {
        accountType: "trader",
        traderId: b.transporterId,
        delta: args.farmcoins,
        balanceAfter: balance,
        source: "transport_rating_reward",
        utid: generateUTID("fcr"),
        transportBookingId: b._id,
        reason: `Trip rating: ${args.farmcoins} FarmCoin${args.farmcoins === 1 ? "" : "s"}`,
        createdAt: now,
      });
    }
    await notify(ctx, b.transporterId, "Trip rated", `Your trip on ${b.pickupDate} earned ${args.farmcoins} FarmCoin${args.farmcoins === 1 ? "" : "s"}.${args.feedback ? ` Feedback: ${args.feedback}` : ""}`);
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Transporter side
// ------------------------------------------------------------------

export const getMyTransportWorkspace = query({
  args: { userId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const user = await requireTransporter(ctx, args.userId);
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const profile = await profileOf(ctx, user._id);
    const vehicles = await ctx.db.query("transportVehicles").withIndex("by_transporterId", (q) => q.eq("transporterId", user._id)).take(100);
    const drivers = await ctx.db.query("transportDrivers").withIndex("by_transporterId", (q) => q.eq("transporterId", user._id)).take(100);
    const trips = await ctx.db.query("transportBookings").withIndex("by_transporterId", (q) => q.eq("transporterId", user._id)).order("desc").take(200);
    return {
      profile: profile
        ? { available: profile.available ?? false, availableFrom: profile.availableFrom ?? null, districtsServed: profile.districtsServed ?? [], priceGuide: profile.priceGuide ?? "" }
        : null,
      listed: (await verifiedFleet(ctx, user._id, today)).listed && profile?.available === true,
      vehicles,
      drivers,
      trips: await tripRows(ctx, trips),
      ...(await tripStats(ctx, user._id)),
    };
  },
});

export const setAvailability = mutation({
  args: { userId: v.id("users"), available: v.boolean(), availableFrom: v.optional(v.string()), districtsServed: v.array(v.string()), priceGuide: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireTransporter(ctx, args.userId);
    const profile = await profileOf(ctx, user._id);
    if (!profile) throw new Error("Complete your transporter onboarding first");
    const districts = [...new Set(args.districtsServed.map((d) => d.trim()).filter(Boolean))].slice(0, 40);
    if (args.available && districts.length === 0) throw new Error("Add at least one district you serve");
    if (args.availableFrom && !isIsoDate(args.availableFrom)) throw new Error("Choose a valid date");
    await ctx.db.patch(profile._id, { available: args.available, availableFrom: args.availableFrom || undefined, districtsServed: districts, priceGuide: args.priceGuide?.trim().slice(0, 120) || undefined });
    return { success: true };
  },
});

export const generateTransportUploadUrl = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireTransporter(ctx, args.userId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const addVehicle = mutation({
  args: {
    userId: v.id("users"),
    plateNumber: v.string(),
    vehicleType: v.string(),
    capacityTonnes: v.number(),
    insuranceExpiry: v.string(),
    logbookStorageId: v.id("_storage"),
    insuranceStorageId: v.id("_storage"),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await requireTransporter(ctx, args.userId);
    if (!args.plateNumber.trim()) throw new Error("Enter the number plate");
    if (!TRANSPORT_VEHICLE_TYPES.includes(args.vehicleType)) throw new Error("Choose the vehicle type");
    if (!(args.capacityTonnes > 0 && args.capacityTonnes < 200)) throw new Error("Capacity looks wrong");
    if (!isIsoDate(args.insuranceExpiry) || args.insuranceExpiry < todayUganda()) throw new Error("The insurance must not have expired");
    const id = await ctx.db.insert("transportVehicles", {
      transporterId: user._id,
      plateNumber: args.plateNumber.trim().toUpperCase().slice(0, 20),
      vehicleType: args.vehicleType,
      capacityTonnes: args.capacityTonnes,
      insuranceExpiry: args.insuranceExpiry,
      logbookStorageId: args.logbookStorageId,
      insuranceStorageId: args.insuranceStorageId,
      photoStorageId: args.photoStorageId,
      status: "pending",
      createdAt: getUgandaTime(),
    });
    return { vehicleId: id };
  },
});

export const addDriver = mutation({
  args: { userId: v.id("users"), name: v.string(), licenceNumber: v.string(), licenceClass: v.optional(v.string()), licenceExpiry: v.string(), licenceStorageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await requireTransporter(ctx, args.userId);
    if (!args.name.trim() || !args.licenceNumber.trim()) throw new Error("Enter the driver's name and licence number");
    if (!isIsoDate(args.licenceExpiry) || args.licenceExpiry < todayUganda()) throw new Error("The licence must not have expired");
    const id = await ctx.db.insert("transportDrivers", {
      transporterId: user._id,
      name: args.name.trim().slice(0, 120),
      licenceNumber: args.licenceNumber.trim().slice(0, 40),
      licenceClass: args.licenceClass?.trim() || undefined,
      licenceExpiry: args.licenceExpiry,
      licenceStorageId: args.licenceStorageId,
      status: "pending",
      createdAt: getUgandaTime(),
    });
    return { driverId: id };
  },
});

export const removeVehicleOrDriver = mutation({
  args: { userId: v.id("users"), vehicleId: v.optional(v.id("transportVehicles")), driverId: v.optional(v.id("transportDrivers")) },
  handler: async (ctx, args) => {
    const user = await requireTransporter(ctx, args.userId);
    if (args.vehicleId) {
      const x = await ctx.db.get(args.vehicleId);
      if (!x || x.transporterId !== user._id) throw new Error("Vehicle not found");
      for (const s of [x.logbookStorageId, x.insuranceStorageId, x.photoStorageId]) if (s) await ctx.storage.delete(s);
      await ctx.db.delete(x._id);
    }
    if (args.driverId) {
      const d = await ctx.db.get(args.driverId);
      if (!d || d.transporterId !== user._id) throw new Error("Driver not found");
      await ctx.storage.delete(d.licenceStorageId);
      await ctx.db.delete(d._id);
    }
    return { success: true };
  },
});

export const respondToTransportBooking = mutation({
  args: { userId: v.id("users"), bookingId: v.id("transportBookings"), accept: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const b = await ctx.db.get(args.bookingId);
    if (!b || b.transporterId !== args.userId) throw new Error("Booking not found");
    if (b.status !== "requested") throw new Error("This booking was already answered");
    await ctx.db.patch(b._id, { status: args.accept ? "accepted" : "declined", transporterNote: args.note?.trim().slice(0, 500) || undefined });
    await notify(
      ctx,
      b.requesterId,
      args.accept ? "Transport booking accepted" : "Transport booking declined",
      `Your trip from ${b.fromDistrict} to ${b.toDistrict} on ${b.pickupDate} was ${args.accept ? "accepted" : "declined"}.${args.note ? ` ${args.note}` : ""} Agree payment with the transporter directly.`
    );
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Verification (Storage and Transport Officer / super admin)
// ------------------------------------------------------------------

export const listTransportForReview = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireOfficer(ctx, args.adminId);
    const vehicles = await ctx.db.query("transportVehicles").withIndex("by_status", (q) => q.eq("status", "pending")).take(200);
    const drivers = await ctx.db.query("transportDrivers").withIndex("by_status", (q) => q.eq("status", "pending")).take(200);
    const url = (id: Id<"_storage"> | undefined) => (id ? ctx.storage.getUrl(id) : Promise.resolve(null));
    const alias = async (id: Id<"users">) => (await ctx.db.get(id))?.alias ?? "";
    return {
      vehicles: await Promise.all(
        vehicles.map(async (x) => ({ ...x, transporterAlias: await alias(x.transporterId), logbookUrl: await url(x.logbookStorageId), insuranceUrl: await url(x.insuranceStorageId), photoUrl: await url(x.photoStorageId) }))
      ),
      drivers: await Promise.all(drivers.map(async (d) => ({ ...d, transporterAlias: await alias(d.transporterId), licenceUrl: await url(d.licenceStorageId) }))),
    };
  },
});

export const reviewTransportItem = mutation({
  args: {
    adminId: v.id("users"),
    vehicleId: v.optional(v.id("transportVehicles")),
    driverId: v.optional(v.id("transportDrivers")),
    decision: v.union(v.literal("verify"), v.literal("reject")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireOfficer(ctx, args.adminId);
    const notes = args.notes?.trim() || undefined;
    if (args.decision === "reject" && !notes) throw new Error("Give a reason");
    const patch = { status: args.decision === "verify" ? ("verified" as const) : ("rejected" as const), reviewedBy: admin._id, reviewedAt: getUgandaTime(), reviewNotes: notes };
    let owner: Id<"users"> | null = null;
    let what = "";
    if (args.vehicleId) {
      const x = await ctx.db.get(args.vehicleId);
      if (!x) throw new Error("Vehicle not found");
      await ctx.db.patch(x._id, patch);
      owner = x.transporterId;
      what = `Vehicle ${x.plateNumber}`;
    } else if (args.driverId) {
      const d = await ctx.db.get(args.driverId);
      if (!d) throw new Error("Driver not found");
      await ctx.db.patch(d._id, patch);
      owner = d.transporterId;
      what = `Driver ${d.name}`;
    } else throw new Error("Nothing to review");
    await notify(ctx, owner, args.decision === "verify" ? `${what} verified` : `${what} rejected`, args.decision === "verify" ? `${what} was verified.` : `${what} was rejected: ${notes}`);
    return { success: true };
  },
});
