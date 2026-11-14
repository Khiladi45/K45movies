import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { linkSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { HttpError } from "./http";

export type ReferenceKind = "title" | "episodes" | "source";

let localKey: Buffer | undefined;

function referenceKey() {
  const configured = process.env.K45_REFERENCE_SECRET;
  if (configured) {
    if (configured.length < 32) throw new HttpError(503, "The provider reference key is too short.");
    return configured;
  }
  if (localKey) return localKey;

  // Keep browser bookmarks valid across local restarts. Shared or read-only
  // deployments supply one configured secret to every instance.
  const path = resolve(".k45-reference-key");
  try {
    localKey = readFileSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const candidate = path + "." + randomBytes(12).toString("hex");
    writeFileSync(candidate, randomBytes(32), { mode: 0o600, flag: "wx" });
    try {
      linkSync(candidate, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    } finally {
      unlinkSync(candidate);
    }
    localKey = readFileSync(path);
  }
  if (localKey.length !== 32) {
    localKey = undefined;
    throw new HttpError(503, "The local provider reference key is invalid.");
  }
  return localKey;
}

function signature(provider: string, kind: ReferenceKind, value: string) {
  return createHmac("sha256", referenceKey()).update(provider + "\0" + kind + "\0" + value).digest().subarray(0, 18);
}

export function encodeReference(provider: string, kind: ReferenceKind, value: string) {
  return Buffer.from(value).toString("base64url") + "." + signature(provider, kind, value).toString("base64url");
}

export function decodeReference(provider: string, kind: ReferenceKind, reference: string) {
  const [encoded, mac, extra] = reference.split(".");
  if (!encoded || !mac || extra !== undefined || !/^[\w-]+$/.test(encoded) || !/^[\w-]+$/.test(mac)) {
    throw new HttpError(400, "Invalid provider reference.");
  }
  const value = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = signature(provider, kind, value);
  const received = Buffer.from(mac, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new HttpError(400, "This provider link is unavailable. Open the title again.");
  }
  return value;
}
