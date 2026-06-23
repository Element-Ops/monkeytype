import { findGetParameter } from "../utils/misc";

const token = findGetParameter("t");

type DecodedPayload = {
  r?: unknown;
  e?: unknown;
  n?: unknown;
  name?: unknown;
};

function decodePayload(t: string | null): DecodedPayload | null {
  if (t === null) return null;
  const dotIdx = t.lastIndexOf(".");
  if (dotIdx < 1) return null;
  const tokenB64 = t.slice(0, dotIdx);
  try {
    const padded = tokenB64.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (padded.length % 4)) % 4;
    return JSON.parse(atob(padded + "=".repeat(padLen))) as DecodedPayload;
  } catch {
    return null;
  }
}

const payload = decodePayload(token);

export function getApplicantToken(): string | null {
  return token;
}

export function isApplicantMode(): boolean {
  return token !== null;
}

export function getApplicantName(): string | null {
  if (typeof payload?.name !== "string") return null;
  // Strip any "(DUP)" marker the source data appends to duplicate entries so
  // greetings read "Hi Kavin Sula," rather than "Hi Kavin Sula (DUP),".
  return payload.name.replace(/\s*\(DUP\)\s*/gi, " ").trim();
}
