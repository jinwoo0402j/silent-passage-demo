const AUDIO_OPTIONS_KEY = "silent-passage-audio-options-v1";

export const AUDIO_OPTION_CHANNELS = [
  { id: "master", label: "Master", description: "All game audio" },
  { id: "bgm", label: "BGM", description: "Music loops" },
  { id: "sfx", label: "SFX", description: "Shots and interface sounds" },
  { id: "voice", label: "Voice", description: "Character voice playback" },
];

export const DEFAULT_AUDIO_OPTIONS = {
  master: 0.8,
  bgm: 0.7,
  sfx: 0.8,
  voice: 0.8,
};

function clampVolume(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, number));
}

export function normalizeAudioOptions(options = {}) {
  return {
    master: clampVolume(options.master, DEFAULT_AUDIO_OPTIONS.master),
    bgm: clampVolume(options.bgm, DEFAULT_AUDIO_OPTIONS.bgm),
    sfx: clampVolume(options.sfx, DEFAULT_AUDIO_OPTIONS.sfx),
    voice: clampVolume(options.voice, DEFAULT_AUDIO_OPTIONS.voice),
  };
}

export function loadAudioOptions() {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_AUDIO_OPTIONS };
  }
  try {
    return normalizeAudioOptions(JSON.parse(localStorage.getItem(AUDIO_OPTIONS_KEY) || "{}"));
  } catch {
    return { ...DEFAULT_AUDIO_OPTIONS };
  }
}

export function saveAudioOptions(options) {
  const normalized = normalizeAudioOptions(options);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(AUDIO_OPTIONS_KEY, JSON.stringify(normalized));
  }
  applyAudioOptions(normalized);
  return normalized;
}

export function resetAudioOptions() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(AUDIO_OPTIONS_KEY);
  }
  applyAudioOptions(DEFAULT_AUDIO_OPTIONS);
  return { ...DEFAULT_AUDIO_OPTIONS };
}

export function applyAudioOptions(options = loadAudioOptions()) {
  if (typeof window !== "undefined") {
    window.__silentPassageAudioOptions = normalizeAudioOptions(options);
    updateActiveAudioElements();
  }
  return getAudioOptions();
}

export function getAudioOptions() {
  if (typeof window !== "undefined" && window.__silentPassageAudioOptions) {
    return normalizeAudioOptions(window.__silentPassageAudioOptions);
  }
  return loadAudioOptions();
}

export function getAudioChannelVolume(channel, baseVolume = 1) {
  const options = getAudioOptions();
  const channelVolume = options[channel] ?? 1;
  return clampVolume(baseVolume, 1) * options.master * channelVolume;
}

export function registerAudioElement(element, channel, baseVolume = 1) {
  if (!element || typeof window === "undefined") {
    return;
  }
  window.__silentPassageAudioElements = window.__silentPassageAudioElements || new Set();
  window.__silentPassageAudioElements.add(element);
  element.dataset.audioChannel = channel;
  element.dataset.baseVolume = String(clampVolume(baseVolume, 1));
  element.volume = getAudioChannelVolume(channel, baseVolume);
}

export function updateActiveAudioElements() {
  if (typeof window === "undefined" || !window.__silentPassageAudioElements) {
    return;
  }
  window.__silentPassageAudioElements.forEach((element) => {
    if (!element?.dataset) {
      return;
    }
    element.volume = getAudioChannelVolume(
      element.dataset.audioChannel || "master",
      Number(element.dataset.baseVolume ?? 1),
    );
  });
}
