import { createEffect, createSignal, JSX, Match, Show, Switch } from "solid-js";
import { render } from "solid-js/web";

import type { ReporterResult } from "./reporter";

import { restartTestEvent } from "../events/test";
import { setApplicantTestMode } from "./mode";
import { getApplicantName } from "./token";

type State =
  | { kind: "intro" }
  | { kind: "submitting" }
  | { kind: "success"; wpm: number; acc: number }
  | { kind: "practice-complete"; wpm: number; acc: number }
  | { kind: "expired" }
  | { kind: "duplicate" }
  | { kind: "rejected"; reason?: string }
  | { kind: "network-failure"; wpm: number; acc: number; raw: number };

const [state, setState] = createSignal<State>({ kind: "intro" });
const [closed, setClosed] = createSignal(false);
const [secondsLeft, setSecondsLeft] = createSignal<number | null>(null);

export function setSubmitting(): void {
  setClosed(false);
  setState({ kind: "submitting" });
}

export function notifyPracticeComplete(wpm: number, acc: number): void {
  setClosed(false);
  setState({
    kind: "practice-complete",
    wpm: Math.round(wpm * 10) / 10,
    acc: Math.round(acc * 10) / 10,
  });
}

export function setReporterState(reporter: ReporterResult): void {
  setClosed(false);
  if (reporter.status === "submitted") {
    setState({ kind: "success", wpm: reporter.wpm, acc: reporter.acc });
  } else if (reporter.status === "expired") {
    setState({ kind: "expired" });
  } else if (reporter.status === "duplicate") {
    setState({ kind: "duplicate" });
  } else if (reporter.status === "rejected") {
    setState({ kind: "rejected", reason: reporter.reason });
  } else if (reporter.status === "network-failure") {
    setState({
      kind: "network-failure",
      wpm: Math.round(reporter.result.wpm * 10) / 10,
      acc: Math.round(reporter.result.acc * 10) / 10,
      raw: Math.round(reporter.result.rawWpm),
    });
  }
}

const RECRUITER_EMAIL =
  (import.meta.env["VITE_APPLICANT_FALLBACK_EMAIL"] as string | undefined) ??
  "recruiter@elementops.com";

function startTest(mode: "practice" | "real"): void {
  setApplicantTestMode(mode);
  setClosed(true);
  restartTestEvent.dispatch({});
}

function dismiss(): void {
  setClosed(true);
  setSecondsLeft(null);
}

function ApplicantOverlay(): JSX.Element {
  // 60s auto-dismiss for success state only
  createEffect(() => {
    const s = state();
    if (s.kind !== "success" || closed()) {
      setSecondsLeft(null);
      return;
    }
    let remaining = 60;
    setSecondsLeft(remaining);
    const interval = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(interval);
        dismiss();
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  });

  const greeting = (): string => {
    const name = getApplicantName();
    return name !== null && name.length > 0 ? `Hi ${name},` : "Hi there,";
  };

  return (
    <Show when={!closed()}>
      <div id="applicantOverlay">
        <div class="applicantOverlayCard">
          <Switch>
            <Match when={state().kind === "intro"}>
              <h2>{greeting()}</h2>
              <p>
                Take a 1-minute typing test. Feel free to try the practice test
                first before taking the real one.
              </p>
              <p class="applicantSubtle">
                Practice runs the same test but isn&apos;t recorded. Only the
                real test counts.
              </p>
              <div class="applicantButtonRow">
                <button
                  type="button"
                  class="applicantBtn applicantBtnSecondary"
                  onClick={() => startTest("practice")}
                >
                  Take Practice
                </button>
                <button
                  type="button"
                  class="applicantBtn applicantBtnPrimary"
                  onClick={() => startTest("real")}
                >
                  Take Actual Typing Test
                </button>
              </div>
            </Match>

            <Match when={state().kind === "submitting"}>
              <div class="applicantOverlaySpinner"></div>
              <h2>Submitting your result...</h2>
              <p>Please don&apos;t close this window.</p>
            </Match>

            <Match when={state().kind === "success"}>
              {(_) => {
                const s = state() as Extract<State, { kind: "success" }>;
                return (
                  <>
                    <h2>Submitted</h2>
                    <div class="applicantStats">
                      WPM: {s.wpm} &nbsp; Accuracy: {s.acc}%
                    </div>
                    <p>Your result was recorded.</p>
                    <p class="applicantSubtle">
                      Closing in {secondsLeft()}s...
                    </p>
                    <div class="applicantButtonRow">
                      <button
                        type="button"
                        class="applicantBtn applicantBtnSecondary"
                        onClick={dismiss}
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              }}
            </Match>

            <Match when={state().kind === "practice-complete"}>
              {(_) => {
                const s = state() as Extract<
                  State,
                  { kind: "practice-complete" }
                >;
                return (
                  <>
                    <h2>Practice complete</h2>
                    <div class="applicantStats">
                      WPM: {s.wpm} &nbsp; Accuracy: {s.acc}%
                    </div>
                    <p>
                      Practice doesn&apos;t count. Take the real test when
                      you&apos;re ready.
                    </p>
                    <div class="applicantButtonRow">
                      <button
                        type="button"
                        class="applicantBtn applicantBtnSecondary"
                        onClick={() => startTest("practice")}
                      >
                        Practice Again
                      </button>
                      <button
                        type="button"
                        class="applicantBtn applicantBtnPrimary"
                        onClick={() => startTest("real")}
                      >
                        Take Real Test
                      </button>
                    </div>
                  </>
                );
              }}
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
