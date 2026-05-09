export type ApplicantTestMode = "intro" | "practice" | "real";

let mode: ApplicantTestMode = "intro";

const listeners = new Set<(m: ApplicantTestMode) => void>();

export function getApplicantTestMode(): ApplicantTestMode {
  return mode;
}

export function setApplicantTestMode(next: ApplicantTestMode): void {
  if (mode === next) return;
  mode = next;
  for (const fn of listeners) fn(mode);
}

export function onApplicantModeChange(
  fn: (m: ApplicantTestMode) => void,
): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
