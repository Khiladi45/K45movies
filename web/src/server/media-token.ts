import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { HttpError } from "./http";
import { referenceKey } from "./references";

type MediaKind = "media" | "subtitle" | "key";

export type MediaTarget = {
  url: string;
  kind: MediaKind;
  headers?: Record<string, string>;
  origin?: string;
  expires: number;
};

function key() {
  return createHash("sha256").update("k45-media-v1\0").update(referenceKey()).digest();
}

export function mediaUrl(target: MediaTarget) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(target)), cipher.final()]);
  return "/api/proxy/media/" + Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function mediaTarget(token: string): MediaTarget {
  if (!/^[\w-]{40,16000}$/.test(token)) throw new HttpError(400, "Invalid media link.");
  let target: MediaTarget;
  try {
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    target = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString());
  } catch {
    throw new HttpError(403, "Invalid media link.");
  }
  if (target.expires < Date.now()) throw new HttpError(410, "This stream link expired. Refresh the source.");
  return target;
}
