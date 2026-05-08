import "./ui-lock.css";
import { applyConfigLock } from "./config-lock";
import { mountResultStates, setReporterState } from "./result-states";
import { onReporterStateChange } from "./reporter";
import { navigationEvent } from "../events/navigation";

export function boot(): void {
  document.body.classList.add("applicant-mode");

  applyConfigLock();
  mountResultStates();

  onReporterStateChange((s) => {
    setReporterState(s);
  });

  // Skipped firebase auth flow normally drives the initial navigate + loading-class removal
  document.body.classList.remove("loading");
  navigationEvent.dispatch({
    url: location.pathname + location.search + location.hash,
    options: { force: true },
  });
}
