/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminAudit from "../adminAudit.js";
import type * as adminFinance from "../adminFinance.js";
import type * as adminRedFlags from "../adminRedFlags.js";
import type * as auth from "../auth.js";
import type * as auth_index from "../auth/index.js";
import type * as auth_types from "../auth/types.js";
import type * as authentication_index from "../authentication/index.js";
import type * as authentication_types from "../authentication/types.js";
import type * as buyerDashboard from "../buyerDashboard.js";
import type * as buyers from "../buyers.js";
import type * as communities from "../communities.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as demoData from "../demoData.js";
import type * as errors from "../errors.js";
import type * as errors_index from "../errors/index.js";
import type * as errors_types from "../errors/types.js";
import type * as farmerDashboard from "../farmerDashboard.js";
import type * as farmerOnboarding from "../farmerOnboarding.js";
import type * as farmerProfile from "../farmerProfile.js";
import type * as http from "../http.js";
import type * as introspection from "../introspection.js";
import type * as inventoryBlocks from "../inventoryBlocks.js";
import type * as listings from "../listings.js";
import type * as locations from "../locations.js";
import type * as messages from "../messages.js";
import type * as negotiations from "../negotiations.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as pdfGeneration from "../pdfGeneration.js";
import type * as pesapal from "../pesapal.js";
import type * as pilotMode from "../pilotMode.js";
import type * as pilotSetup from "../pilotSetup.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as rateLimits from "../rateLimits.js";
import type * as rateLimits_index from "../rateLimits/index.js";
import type * as rateLimits_types from "../rateLimits/types.js";
import type * as scheduled from "../scheduled.js";
import type * as seedUgandaLocations from "../seedUgandaLocations.js";
import type * as storeAdmin from "../storeAdmin.js";
import type * as traderBuyerNegotiations from "../traderBuyerNegotiations.js";
import type * as traderDashboard from "../traderDashboard.js";
import type * as ugandaLocationsData from "../ugandaLocationsData.js";
import type * as userManagement_index from "../userManagement/index.js";
import type * as userManagement_types from "../userManagement/types.js";
import type * as userSettings from "../userSettings.js";
import type * as utils from "../utils.js";
import type * as utils_index from "../utils/index.js";
import type * as utils_types from "../utils/types.js";
import type * as wallet from "../wallet.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminAudit: typeof adminAudit;
  adminFinance: typeof adminFinance;
  adminRedFlags: typeof adminRedFlags;
  auth: typeof auth;
  "auth/index": typeof auth_index;
  "auth/types": typeof auth_types;
  "authentication/index": typeof authentication_index;
  "authentication/types": typeof authentication_types;
  buyerDashboard: typeof buyerDashboard;
  buyers: typeof buyers;
  communities: typeof communities;
  constants: typeof constants;
  crons: typeof crons;
  demoData: typeof demoData;
  errors: typeof errors;
  "errors/index": typeof errors_index;
  "errors/types": typeof errors_types;
  farmerDashboard: typeof farmerDashboard;
  farmerOnboarding: typeof farmerOnboarding;
  farmerProfile: typeof farmerProfile;
  http: typeof http;
  introspection: typeof introspection;
  inventoryBlocks: typeof inventoryBlocks;
  listings: typeof listings;
  locations: typeof locations;
  messages: typeof messages;
  negotiations: typeof negotiations;
  notifications: typeof notifications;
  payments: typeof payments;
  pdfGeneration: typeof pdfGeneration;
  pesapal: typeof pesapal;
  pilotMode: typeof pilotMode;
  pilotSetup: typeof pilotSetup;
  pushNotifications: typeof pushNotifications;
  rateLimits: typeof rateLimits;
  "rateLimits/index": typeof rateLimits_index;
  "rateLimits/types": typeof rateLimits_types;
  scheduled: typeof scheduled;
  seedUgandaLocations: typeof seedUgandaLocations;
  storeAdmin: typeof storeAdmin;
  traderBuyerNegotiations: typeof traderBuyerNegotiations;
  traderDashboard: typeof traderDashboard;
  ugandaLocationsData: typeof ugandaLocationsData;
  "userManagement/index": typeof userManagement_index;
  "userManagement/types": typeof userManagement_types;
  userSettings: typeof userSettings;
  utils: typeof utils;
  "utils/index": typeof utils_index;
  "utils/types": typeof utils_types;
  wallet: typeof wallet;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
