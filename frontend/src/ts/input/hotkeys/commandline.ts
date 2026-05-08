import { hotkeys } from "../../states/hotkeys";
import { showModal } from "../../states/modals";
import { isAnyPopupVisible } from "../../utils/misc";
import { isApplicantMode } from "../../applicant/token";
import { createHotkey } from "./utils";

function openCommandline(): void {
  if (isApplicantMode()) return;
  if (isAnyPopupVisible()) return;
  showModal("Commandline");
}

createHotkey(() => hotkeys.commandline, openCommandline);
createHotkey("Mod+Shift+P", openCommandline);
