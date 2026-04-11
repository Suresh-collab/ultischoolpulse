/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as children from "../children.js";
import type * as classTracker from "../classTracker.js";
import type * as classwork from "../classwork.js";
import type * as crons from "../crons.js";
import type * as digests from "../digests.js";
import type * as exams from "../exams.js";
import type * as homework from "../homework.js";
import type * as http from "../http.js";
import type * as processEntry from "../processEntry.js";
import type * as schoolEntries from "../schoolEntries.js";
import type * as uploads from "../uploads.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  children: typeof children;
  classTracker: typeof classTracker;
  classwork: typeof classwork;
  crons: typeof crons;
  digests: typeof digests;
  exams: typeof exams;
  homework: typeof homework;
  http: typeof http;
  processEntry: typeof processEntry;
  schoolEntries: typeof schoolEntries;
  uploads: typeof uploads;
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
