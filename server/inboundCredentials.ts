import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { nanoid } from "nanoid";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const PREFIX = "in_";

export type PresentedCredential = {
  publicId: string;
  secret: string;
};

export async function hashInboundSecret(secret: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(secret, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyInboundSecret(secret: string, encoded: string) {
  const [algorithm, salt, encodedHash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, "base64url");
  const derived = (await scrypt(secret, salt, expected.length)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function createInboundCredential() {
  const publicId = `${PREFIX}${nanoid(16)}`;
  const secret = randomBytes(36).toString("base64url");
  return {
    publicId,
    secret,
    presented: `${publicId}.${secret}`,
  };
}

export function parseInboundCredential(value: string | undefined): PresentedCredential | null {
  if (!value) return null;
  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;
  const publicId = value.slice(0, separator).trim();
  const secret = value.slice(separator + 1).trim();
  if (!publicId.startsWith(PREFIX) || publicId.length > 64 || secret.length < 32) return null;
  return { publicId, secret };
}
