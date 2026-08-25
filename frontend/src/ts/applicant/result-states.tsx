import { createSignal, JSX, Match, Show, Switch } from "solid-js";
import { render } from "solid-js/web";

import type { ReporterResult } from "./reporter";

import { restartTestEvent } from "../events/test";
import { getDirectApplicantTestMode, setApplicantTestMode } from "./mode";
import { getApplicantName } from "./token";

type State =
  | { kind: "intro" }
  | { kind: "confirm-real" }
  | { kind: "submitting" }
  | { kind: "success"; wpm: number; acc: number }
  | { kind: "practice-complete"; wpm: number; acc: number }
  | { kind: "expired" }
  | { kind: "duplicate" }
  | { kind: "rejected"; reason?: string }
  | { kind: "network-failure"; wpm: number; acc: number; raw: number };

const [state, setState] = createSignal<State>({ kind: "intro" });
const [previousState, setPreviousState] = createSignal<State | null>(null);
const [closed, setClosed] = createSignal(false);

export function setSubmitting(): void {
  setClosed(false);
  setState({ kind: "submitting" });
}

export function showIntro(): void {
  setClosed(false);
  setState({ kind: "intro" });
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

export function startTest(mode: "practice" | "real"): void {
  setApplicantTestMode(mode);
  setPreviousState(null);
  setClosed(true);
  restartTestEvent.dispatch({});
}

function requestRealTest(): void {
  setPreviousState(state());
  setState({ kind: "confirm-real" });
}

function cancelRealTest(): void {
  const prev = previousState();
  setPreviousState(null);
  setState(prev ?? { kind: "intro" });
}

function ApplicantOverlay(): JSX.Element {
  const greeting = (): string => {
    const firstName = getApplicantName()?.split(/\s+/)[0];
    return firstName ? `Hi ${firstName},` : "Hi there,";
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
              <div class="applicantWarning">
                <strong>You only get one attempt at the actual test.</strong>{" "}
                Please start recording yourself with Loom before clicking
                &ldquo;Take Actual Typing Test&rdquo;.
              </div>
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
                  onClick={requestRealTest}
                >
                  Take Actual Typing Test
                </button>
              </div>
            </Match>

            <Match when={state().kind === "confirm-real"}>
              <h2>Ready to take the actual test?</h2>
              <p>This is your only attempt. Before you start, make sure:</p>
              <ul class="applicantChecklist">
                <li>You&apos;re recording yourself on Loom</li>
                <li>You&apos;re in a quiet environment</li>
                <li>You&apos;re ready to focus for 60 seconds</li>
              </ul>
              <p class="applicantSubtle">
                Your result will be submitted automatically when the test ends.
              </p>
              <div class="applicantButtonRow">
                <button
                  type="button"
                  class="applicantBtn applicantBtnSecondary"
                  onClick={cancelRealTest}
                >
                  Not yet
                </button>
                <button
                  type="button"
                  class="applicantBtn applicantBtnPrimary"
                  onClick={() => startTest("real")}
                >
                  Yes, start the test
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
                    <Show
                      when={getDirectApplicantTestMode() === "real"}
                      fallback={<p>You may close this tab.</p>}
                    >
                      <p>
                        You may close this tab and return to the Applicant
                        Video.
                      </p>
                    </Show>
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
                      <Show when={getDirectApplicantTestMode() !== "practice"}>
                        <button
                          type="button"
                          class="applicantBtn applicantBtnPrimary"
                          onClick={requestRealTest}
                        >
                          Take Real Test
                        </button>
                      </Show>
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
