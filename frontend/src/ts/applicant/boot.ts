import "./ui-lock.css";
import { applyConfigLock } from "./config-lock";
import { mountResultStates, setReporterState } from "./result-states";
import { onReporterStateChange } from "./reporter";

export function boot(): void {
  document.body.classList.add("applicant-mode");

  applyConfigLock();
  mountResultStates();

  onReporterStateChange((s) => {
    setReporterState(s);
  });
}
