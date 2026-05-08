import { Config } from "@monkeytype/schemas/configs";
import { setConfig } from "../config/setters";
import { configEvent } from "../events/config";

const LOCKED: Partial<Config> = {
  mode: "time",
  time: 60,
  language: "english",
  punctuation: false,
  numbers: false,
  funbox: [],
  difficulty: "normal",
  lazyMode: false,
  blindMode: false,
  stopOnError: "off",
  minWpm: "off",
  minAcc: "off",
  minBurst: "off",
  freedomMode: false,
  strictSpace: false,
  ads: "off",
  resultSaving: true,
  quickRestart: "off",
};

let applying = false;

function applyAll(): void {
  applying = true;
  try {
    for (const key of Object.keys(LOCKED) as (keyof Config)[]) {
      const value = LOCKED[key];
      if (value === undefined) continue;
      setConfig(key, value, { nosave: true });
    }
  } finally {
    applying = false;
  }
}

export function applyConfigLock(): void {
  applyAll();

  configEvent.subscribe((event) => {
    if (applying) return;
    if (event.key === "fullConfigChange") return;
    if (Object.prototype.hasOwnProperty.call(LOCKED, event.key)) {
      applyAll();
    }
  });
}
