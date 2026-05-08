import { createSignal, JSX, Match, Show, Switch } from "solid-js";
import { render } from "solid-js/web";

import type { ReporterResult } from "./reporter";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "expired" }
  | { kind: "duplicate" }
  | { kind: "rejected"; reason?: string }
  | {
      kind: "network-failure";
      wpm: number;
      acc: number;
      raw: number;
    };

const [state, setState] = createSignal<State>({ kind: "idle" });

export function setSubmitting(): void {
  setState({ kind: "submitting" });
}

export function setReporterState(reporter: ReporterResult): void {
  if (reporter.status === "submitted") {
    setState({ kind: "success" });
  } else if (reporter.status === "expired") {
    setState({ kind: "expired" });
  } else if (reporter.status === "duplicate") {
    setState({ kind: "duplicate" });
  } else if (reporter.status === "rejected") {
    setState({ kind: "rejected", reason: reporter.reason });
  } else if (reporter.status === "network-failure") {
    setState({
      kind: "network-failure",
      wpm: Math.round(reporter.result.wpm),
      acc: Math.round(reporter.result.acc * 10) / 10,
      raw: Math.round(reporter.result.rawWpm),
    });
  }
}

const RECRUITER_EMAIL =
  (import.meta.env["VITE_APPLICANT_FALLBACK_EMAIL"] as string | undefined) ??
  "recruiter@elementops.com";

function ApplicantOverlay(): JSX.Element {
  return (
    <Show when={state().kind !== "idle"}>
      <div id="applicantOverlay">
        <div class="applicantOverlayCard">
          <Switch>
            <Match when={state().kind === "submitting"}>
              <div class="applicantOverlaySpinner"></div>
              <h2>Submitting your result...</h2>
              <p>Please don&apos;t close this window.</p>
            </Match>

            <Match when={state().kind === "success"}>
              <h2>Submitted</h2>
              <p>Your result was recorded. You can close this window.</p>
            </Match>

            <Match when={state().kind === "expired"}>
              <h2>Link expired</h2>
              <p>This typing test link has expired. Contact your recruiter.</p>
            </Match>

            <Match when={state().kind === "duplicate"}>
              <h2>Already submitted</h2>
              <p>This test has already been submitted.</p>
            </Match>

            <Match when={state().kind === "rejected"}>
              <h2>Result rejected</h2>
              <p>
                Your result couldn&apos;t be accepted. Please contact your
                recruiter at {RECRUITER_EMAIL}.
              </p>
            </Match>

            <Match when={state().kind === "network-failure"}>
              {(_) => {
                const s = state() as Extract<
                  State,
                  { kind: "network-failure" }
                >;
                return (
                  <>
                    <h2>Connection issue</h2>
                    <p>
                      We couldn&apos;t reach the server. Please save your score
                      and email it to {RECRUITER_EMAIL}:
                    </p>
                    <div class="applicantStats">
                      WPM: {s.wpm} &nbsp; ACC: {s.acc}% &nbsp; RAW: {s.raw}
                    </div>
                  </>
                );
              }}
            </Match>
          </Switch>
        </div>
      </div>
    </Show>
  );
}

export function mountResultStates(): void {
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(() => <ApplicantOverlay />, host);
}
