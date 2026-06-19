const GAME_OPTIONS_KEY = "silent-passage-game-options-v1";

export const GAME_OPTION_CONTROLS = [
  {
    id: "textSpeed",
    label: "Text Speed",
    description: "Shelter dialogue reveal speed",
    min: 15,
    max: 90,
    step: 1,
    unit: "cps",
  },
];

export const DEFAULT_GAME_OPTIONS = {
  textSpeed: 30,
};

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, number));
}

export function normalizeGameOptions(options = {}) {
  return {
    textSpeed: clampNumber(options.textSpeed, 15, 90, DEFAULT_GAME_OPTIONS.textSpeed),
  };
}

export function loadGameOptions() {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_GAME_OPTIONS };
  }
  try {
    return normalizeGameOptions(JSON.parse(localStorage.getItem(GAME_OPTIONS_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_GAME_OPTIONS };
  }
}

export function saveGameOptions(options) {
  const normalized = normalizeGameOptions(options);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(GAME_OPTIONS_KEY, JSON.stringify(normalized));
  }
  applyGameOptions(normalized);
  return normalized;
}

export function resetGameOptions() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(GAME_OPTIONS_KEY);
  }
  applyGameOptions(DEFAULT_GAME_OPTIONS);
  return { ...DEFAULT_GAME_OPTIONS };
}

export function applyGameOptions(options = loadGameOptions()) {
  if (typeof window !== "undefined") {
    window.__silentPassageGameOptions = normalizeGameOptions(options);
  }
  return getGameOptions();
}

export function getGameOptions() {
  if (typeof window !== "undefined" && window.__silentPassageGameOptions) {
    return normalizeGameOptions(window.__silentPassageGameOptions);
  }
  return loadGameOptions();
}

export function getShelterSubtitleCharsPerSecond(fallback = DEFAULT_GAME_OPTIONS.textSpeed) {
  return clampNumber(getGameOptions().textSpeed, 15, 90, fallback);
}
