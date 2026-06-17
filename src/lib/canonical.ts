import { createHash, randomBytes } from "crypto";
import type { SendPayloadForHash } from "./types";

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableJson);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortForStableJson((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortForStableJson(value));
}

export function hashSendPayload(payload: SendPayloadForHash): string {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
}

export function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function createToken(prefix = "send"): string {
  return `${prefix}_${randomBytes(18).toString("hex")}`;
}

export function expiresInMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
