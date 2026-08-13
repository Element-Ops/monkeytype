import { restartTestEvent } from "../events/test";
import {
  getApplicantTestMode,
  getDirectApplicantTestMode,
  onApplicantModeChange,
  setApplicantTestMode,
} from "./mode";
import { showIntro } from "./result-states";

export function mountToolbar(): void {
  const toolbar = document.createElement("div");
  toolbar.id = "applicantToolbar";
  toolbar.innerHTML = `
    <button type="button" class="applicantBtn applicantBtnSecondary" data-action="retry">
      Retry Practice
    </button>
    ${
      getDirectApplicantTestMode() === null
        ? `<button type="button" class="applicantBtn applicantBtnSecondary" data-action="exit">
      Exit to Menu
    </button>`
        : ""
    }
  `;
  document.body.appendChild(toolbar);

  toolbar.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLElement | null;
    if (target === null) return;
    const action = target.dataset["action"];
    if (action === "retry") {
      restartTestEvent.dispatch({});
    } else if (action === "exit") {
      setApplicantTestMode("intro");
      showIntro();
    }
  });

  applyModeClass(getApplicantTestMode());
  onApplicantModeChange(applyModeClass);
}

function applyModeClass(mode: "intro" | "practice" | "real"): void {
  document.body.classList.remove(
    "applicant-mode-intro",
    "applicant-mode-practice",
    "applicant-mode-real",
  );
  document.body.classList.add(`applicant-mode-${mode}`);
}
