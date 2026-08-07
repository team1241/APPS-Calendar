/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as announcements from "../announcements.js";
import type * as dev_seed from "../dev/seed.js";
import type * as donations from "../donations.js";
import type * as eventTypes from "../eventTypes.js";
import type * as events from "../events.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_clerk from "../lib/clerk.js";
import type * as lib_userProfiles from "../lib/userProfiles.js";
import type * as subscriptions from "../subscriptions.js";
import type * as subteams from "../subteams.js";
import type * as userMaintenance from "../userMaintenance.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  announcements: typeof announcements;
  "dev/seed": typeof dev_seed;
  donations: typeof donations;
  eventTypes: typeof eventTypes;
  events: typeof events;
  "lib/auth": typeof lib_auth;
  "lib/clerk": typeof lib_clerk;
  "lib/userProfiles": typeof lib_userProfiles;
  subscriptions: typeof subscriptions;
  subteams: typeof subteams;
  userMaintenance: typeof userMaintenance;
  users: typeof users;
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
