import objectHash from "object-hash";
import type { CompletedEvent } from "@monkeytype/schemas/results";
import { getApplicantName, getApplicantRecordId } from "./token";

const WEBHOOK_URL = import.meta.env["VITE_N8N_RESULT_WEBHOOK_URL"] as
  | string
  | undefined;

const RETRY_DELAYS_MS = [1000, 3000, 9000];

export type ReporterResult =
  | { status: "submitted"; wpm: number; acc: number }
  | { status: "expired" }
  | { status: "duplicate" }
  | { status: "rejected"; reason?: string }
  | { status: "network-failure"; result: CompletedEvent };

export type ReporterListener = (state: ReporterResult) => void;

let listener: ReporterListener | null = null;

export function onReporterStateChange(fn: ReporterListener): void {
  listener = fn;
}

function notify(state: ReporterResult): void {
  listener?.(state);
}

function preparePayload(completedEvent: CompletedEvent): CompletedEvent {
  const result = structuredClone(completedEvent);
  const mutable = result as unknown as Record<string, unknown>;
  if (result.testDuration > 122) {
    mutable["chartData"] = "toolong";
    mutable["keySpacing"] = "toolong";
    mutable["keyDuration"] = "toolong";
  }
  delete mutable["hash"];
  result.hash = objectHash(result);
  return result;
}

async function postOnce(
  body: string,
): Promise<{ ok: boolean; status: number; text: string }> {
  if (WEBHOOK_URL === undefined || WEBHOOK_URL === "") {
    return { ok: false, status: 0, text: "missing webhook url" };
  }
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: String(e) };
  }
}

// ---------- Never lose a result ----------
// n8n froze for 18 h on 2026-10-12 and results sent then were lost. Now every real result
// also goes, as a backup, to the recruitment site's own server log (separate from n8n);
// a result that couldn't be sent is kept in the browser and retried; and the applicant
// always sees the normal "Submitted" screen (their numbers are in their recording).
const BACKUP_URL = "https://recruitment.elementops.it.com/api/client-log";
const PENDING_KEY = "applicant:typing:pending";
type Pending = { body: string; at: number };

function backupResult(event: CompletedEvent, token: string, saved: string): void {
  try {
    const body = JSON.stringify({
      rid: getApplicantRecordId(),
      flow: "typing",
      sessionId: token.slice(-16),
      ua: navigator.userAgent,
      events: [
        {
          ts: new Date().toISOString(),
          event: "typing_result",
          level: "info",
          page: "typing",
          // numbers first: the server log line keeps the first 600 characters
          details: {
            wpm: Math.round(event.wpm * 10) / 10,
            acc: Math.round(event.acc * 10) / 10,
            raw: Math.round(event.rawWpm),
            secs: Math.round(event.testDuration),
            saved,
            name: getApplicantName(),
          },
        },
      ],
    });
    if (import.meta.env.DEV) {
      console.info("[backupResult]", body); // local dev: don't write to the live log
      return;
    }
    // text/plain keeps it a simple cross-site request (no preflight)
    if (navigator.sendBeacon?.(BACKUP_URL, new Blob([body], { type: "text/plain" }))) return;
    void fetch(BACKUP_URL, { method: "POST", mode: "no-cors", keepalive: true, headers: { "content-type": "text/plain" }, body }).catch(() => undefined);
  } catch {
    // best effort
  }
}

function readPending(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as Pending[];
  } catch {
    return [];
  }
}
function writePending(list: Pending[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable
  }
}

// Retry results that couldn't be sent earlier. Dropped once sent, once n8n gives a definite
// answer (expired / duplicate / rejected), or after 7 days.
export async function flushPending(): Promise<void> {
  const list = readPending();
  if (list.length === 0) return;
  const keep: Pending[] = [];
  for (const p of list) {
    if (Date.now() - p.at > 7 * 864e5) continue;
    const res = await postOnce(p.body);
    if (!res.ok && (res.status === 0 || res.status >= 500)) keep.push(p);
  }
  writePending(keep);
}

export async function send(
  completedEvent: CompletedEvent,
  token: string,
): Promise<null> {
  const result = preparePayload(completedEvent);
  const body = JSON.stringify({
    token,
    result,
    submittedAt: Date.now(),
  });

  const shown: ReporterResult = {
    status: "submitted",
    wpm: Math.round(completedEvent.wpm * 10) / 10,
    acc: Math.round(completedEvent.acc * 10) / 10,
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await postOnce(body);

    if (res.ok) {
      backupResult(completedEvent, token, "yes");
      notify(shown);
      return null;
    }

    // terminal statuses — don't retry
    if (res.status === 409) {
      notify({ status: "duplicate" });
      return null;
    }
    if (res.status === 410 || res.status === 422 || res.status === 401) {
      // Link expired / result refused: still the normal screen for the applicant; we sort it out.
      backupResult(completedEvent, token, res.status === 410 ? "expired" : `rejected ${res.status}`);
      notify(shown);
      return null;
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) =>
        setTimeout(r, RETRY_DELAYS_MS[attempt] as number),
      );
    }
  }

  // Couldn't reach n8n: keep it and retry in the background; the applicant sees the normal screen.
  writePending([...readPending().filter((p) => p.body !== body), { body, at: Date.now() }]);
  backupResult(completedEvent, token, "network");
  notify(shown);
  return null;
}
