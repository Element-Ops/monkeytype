import { findGetParameter } from "../utils/misc";

const token = findGetParameter("t");

export function getApplicantToken(): string | null {
  return token;
}

export function isApplicantMode(): boolean {
  return token !== null;
}
