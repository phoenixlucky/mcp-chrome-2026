/**
 * @fileoverview JSON base type definitions
 * @description Defines JSON-related types used in Record-Replay V3
 */

/** JSON primitive type */
export type JsonPrimitive = string | number | boolean | null;

/** JSON object type */
export interface JsonObject {
  [key: string]: JsonValue;
}

/** JSON array type */
export type JsonArray = JsonValue[];

/** Any JSON value type */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/** ISO 8601 date-time string */
export type ISODateTimeString = string;

/** Unix millisecond timestamp */
export type UnixMillis = number;
