import "./ui-lock.css";
import { applyConfigLock } from "./config-lock";
import {
  mountResultStates,
  setReporterState,
  startTest,
} from "./result-states";
import { onReporterStateChange } from "./reporter";
import { mountToolbar } from "./toolbar";
import { navigationEvent } from "../events/navigation";
import { getDirectApplicantTestMode } from "./mode";

function injectNoIndexMeta(): void {
  const meta = document.createElement("meta");
  meta.name = "robots";
  meta.content = "noindex,nofollow";
  document.head.appendChild(meta);
}

export function boot(): void {
  document.body.classList.add("applicant-mode");
  injectNoIndexMeta();

  applyConfigLock();
  mountResultStates();
  mountToolbar();

  onReporterStateChange((s) => {
    setReporterState(s);
  });

  // Skipped firebase auth flow normally drives the initial navigate + loading-class removal
  document.body.classList.remove("loading");
  navigationEvent.dispatch({
    url: location.pathname + location.search + location.hash,
    options: { force: true },
  });

  const directMode = getDirectApplicantTestMode();
  if (directMode !== null) startTest(directMode);
}
