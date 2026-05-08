import objectHash from "object-hash";
import type { CompletedEvent } from "@monkeytype/schemas/results";

const WEBHOOK_URL = import.meta.env["VITE_N8N_RESULT_WEBHOOK_URL"] as
  | string
  | undefined;

const RETRY_DELAYS_MS = [1000, 3000, 9000];

export type ReporterResult =
  | { status: "submitted" }
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

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const res = await postOnce(body);

    if (res.ok) {
      notify({ status: "submitted" });
      return null;
    }

    // terminal statuses — don't retry
    if (res.status === 410) {
      notify({ status: "expired" });
      return null;
    }
    if (res.status === 409) {
      notify({ status: "duplicate" });
      return null;
    }
    if (res.status === 422 || res.status === 401) {
      notify({ status: "rejected", reason: res.text });
      return null;
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) =>
        setTimeout(r, RETRY_DELAYS_MS[attempt] as number),
      );
    }
  }

  notify({ status: "network-failure", result });
  return null;
}
