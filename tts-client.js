import {
  getAudioChannelVolume,
  registerAudioElement,
} from "./audio-options.js?v=20260619-shelter-voice-v9";

const TTS_ENABLED_KEY = "silent-passage-tts-enabled-v1";
const VOICE_PRESET_STORAGE_KEY = "silent-passage-shelter-voice-preset-v1";
const VOICE_BANK_MANIFEST_URL = "./assets/voice/shelter/manifest.json?v=20260619-shelter-voice-v9";
const VOICE_PRESET_MANIFEST_ROOT = "./assets/voice/shelter/presets";
const VOICE_BANK_MODES = new Set(["bank", "assets", "on"]);
const SHELTER_CHARACTER_SCENE = "shelter";
const TYPE_07A_SPEAKERS = new Set(["type-07a", "type07a", "shelter", "type_07a"]);
const voiceBankManifestPromises = new Map();
let currentVoiceBankAudio = null;

function getSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

function isStoredTtsEnabledForScene(options = {}) {
  return isShelterCharacterVoiceRequest(options) && loadTtsEnabled();
}

export function isTtsEnabled(options = {}) {
  if (typeof window === "undefined") {
    return false;
  }
  const mode = getSearchParams().get("tts");
  if (mode === "off") {
    return false;
  }
  if (!isShelterCharacterVoiceRequest(options)) {
    return false;
  }
  if (VOICE_BANK_MODES.has(mode || "")) {
    return true;
  }
  return isStoredTtsEnabledForScene(options);
}

function shouldUseVoiceBank(options = {}) {
  return isTtsEnabled(options);
}

function normalizeVoiceSpeaker(speaker = "") {
  return String(speaker || "").trim().toLowerCase().replace(/_/g, "-");
}

function isType07aSpeaker(speaker = "") {
  return TYPE_07A_SPEAKERS.has(normalizeVoiceSpeaker(speaker));
}

function isShelterCharacterVoiceRequest(options = {}) {
  return options?.scene === SHELTER_CHARACTER_SCENE
    && (isType07aSpeaker(options.speaker) || isType07aSpeaker(options.character) || options.characterLine === true);
}

export function loadTtsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage?.getItem(TTS_ENABLED_KEY) === "on";
}

export function saveTtsEnabled(enabled) {
  if (typeof window === "undefined") {
    return Boolean(enabled);
  }
  if (enabled) {
    window.localStorage?.setItem(TTS_ENABLED_KEY, "on");
  } else {
    window.localStorage?.removeItem(TTS_ENABLED_KEY);
    stopTtsPlayback();
  }
  return loadTtsEnabled();
}

export function resetTtsEnabled() {
  if (typeof window !== "undefined") {
    window.localStorage?.removeItem(TTS_ENABLED_KEY);
  }
  stopTtsPlayback();
  return false;
}

async function loadVoiceBankManifest() {
  if (typeof fetch === "undefined") {
    return null;
  }
  const manifestUrl = getVoiceBankManifestUrl();
  if (!voiceBankManifestPromises.has(manifestUrl)) {
    voiceBankManifestPromises.set(manifestUrl, fetch(manifestUrl)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null));
  }
  const manifest = await voiceBankManifestPromises.get(manifestUrl);
  if (manifest || manifestUrl === VOICE_BANK_MANIFEST_URL) {
    return manifest;
  }
  if (!voiceBankManifestPromises.has(VOICE_BANK_MANIFEST_URL)) {
    voiceBankManifestPromises.set(VOICE_BANK_MANIFEST_URL, fetch(VOICE_BANK_MANIFEST_URL)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null));
  }
  return voiceBankManifestPromises.get(VOICE_BANK_MANIFEST_URL);
}

function normalizeVoicePresetId(value = "") {
  const presetId = String(value || "").trim().toLowerCase();
  if (!presetId || presetId === "default" || presetId === "main" || presetId === "off") {
    return "";
  }
  return /^[a-z0-9-]+$/.test(presetId) ? presetId : "";
}

function getSelectedVoicePresetId() {
  if (typeof window === "undefined") {
    return "";
  }
  const searchParams = getSearchParams();
  if (searchParams.has("voicePreset")) {
    return normalizeVoicePresetId(searchParams.get("voicePreset"));
  }
  return normalizeVoicePresetId(window.localStorage?.getItem(VOICE_PRESET_STORAGE_KEY));
}

function getVoiceBankManifestUrl() {
  const presetId = getSelectedVoicePresetId();
  if (!presetId) {
    return VOICE_BANK_MANIFEST_URL;
  }
  return `${VOICE_PRESET_MANIFEST_ROOT}/${presetId}/manifest.json?v=20260619-shelter-voice-v9`;
}

function scoreVoiceLine(entry, text, options = {}) {
  if (!entry || !getVoiceLineSrc(entry)) {
    return -1;
  }
  if (entry.scene && entry.scene !== SHELTER_CHARACTER_SCENE) {
    return -1;
  }
  if (entry.speaker && !isType07aSpeaker(entry.speaker)) {
    return -1;
  }
  if (entry.character && !isType07aSpeaker(entry.character)) {
    return -1;
  }
  if (entry.voice && !isType07aSpeaker(entry.voice)) {
    return -1;
  }
  let score = 0;
  const emotion = options.emotion || "";
  const topic = options.topic || options.intent || "";
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  if (entry.emotion && emotion && entry.emotion === emotion) {
    score += 8;
  }
  if (entry.topic && topic && entry.topic === topic) {
    score += 4;
  }
  if (tags.includes(emotion)) {
    score += 3;
  }
  if (tags.includes(topic)) {
    score += 2;
  }
  if (entry.text && text && entry.text === text) {
    score += 12;
  }
  return score;
}

function pickVoiceBankLine(manifest, text, options = {}) {
  const entries = Array.isArray(manifest?.lines)
    ? manifest.lines.map((entry) => ({
      scene: manifest.scene || SHELTER_CHARACTER_SCENE,
      speaker: manifest.speaker || manifest.character || manifest.voice || "type-07a",
      ...entry,
    }))
    : [];
  if (!entries.length) {
    return null;
  }
  let bestScore = -1;
  let best = [];
  entries.forEach((entry) => {
    const score = scoreVoiceLine(entry, text, options);
    if (score > bestScore) {
      bestScore = score;
      best = [entry];
    } else if (score === bestScore) {
      best.push(entry);
    }
  });
  if (bestScore <= 0 || !best.length) {
    return null;
  }
  const seed = Math.abs(hashString(`${text}|${options.emotion || ""}|${options.topic || ""}`));
  return best[seed % best.length] || null;
}

function getVoiceLineSrc(entry) {
  const source = String(entry?.src || entry?.file || "").trim();
  if (!source) {
    return "";
  }
  if (/^(?:https?:|data:|blob:|\.\/|\/)/.test(source)) {
    return source;
  }
  return `./assets/voice/shelter/${source}`;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function getVoicePlaybackRate(manifest, line) {
  return clampNumber(
    line?.playbackRate ?? line?.playback?.playbackRate ?? manifest?.playbackRate ?? manifest?.playback?.playbackRate,
    0.5,
    2,
    1,
  );
}

function getVoicePreservesPitch(manifest, line) {
  const value = line?.preservesPitch ?? line?.playback?.preservesPitch ?? manifest?.preservesPitch ?? manifest?.playback?.preservesPitch;
  return value === undefined ? true : value !== false;
}

function applyVoicePlaybackTuning(audio, manifest, line) {
  audio.playbackRate = getVoicePlaybackRate(manifest, line);
  const preservesPitch = getVoicePreservesPitch(manifest, line);
  if ("preservesPitch" in audio) {
    audio.preservesPitch = preservesPitch;
  }
  if ("mozPreservesPitch" in audio) {
    audio.mozPreservesPitch = preservesPitch;
  }
  if ("webkitPreservesPitch" in audio) {
    audio.webkitPreservesPitch = preservesPitch;
  }
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return hash;
}

async function trySpeakVoiceBankLine(text, options = {}) {
  if (!shouldUseVoiceBank(options) || typeof window === "undefined" || typeof window.Audio === "undefined") {
    return false;
  }
  const manifest = await loadVoiceBankManifest();
  const line = pickVoiceBankLine(manifest, text, options);
  const source = getVoiceLineSrc(line);
  if (!source) {
    return false;
  }
  let audio = null;
  try {
    stopTtsPlayback();
    audio = new window.Audio(source);
    currentVoiceBankAudio = audio;
    applyVoicePlaybackTuning(audio, manifest, line);
    registerAudioElement(audio, "voice", 1);
    audio.volume = getAudioChannelVolume("voice", 1);
    audio.addEventListener("ended", () => {
      if (currentVoiceBankAudio === audio) {
        currentVoiceBankAudio = null;
      }
    }, { once: true });
    await audio.play();
    return true;
  } catch {
    if (currentVoiceBankAudio === audio) {
      currentVoiceBankAudio = null;
    }
    return false;
  }
}

export function stopTtsPlayback() {
  if (currentVoiceBankAudio) {
    try {
      currentVoiceBankAudio.pause();
      currentVoiceBankAudio.currentTime = 0;
    } catch {
      // Voice playback is optional.
    }
    currentVoiceBankAudio = null;
  }
}

export async function speakFaceOffLine(text, options = {}) {
  if (!isTtsEnabled(options)) {
    return;
  }
  const line = String(text || "").trim();
  if (!line) {
    return;
  }
  try {
    await trySpeakVoiceBankLine(line, options);
  } catch {
    // Character voice playback is optional; generated assets may be unavailable.
  }
}

export function speakShelterLine(text, options = {}) {
  return speakFaceOffLine(text, {
    ...options,
    scene: SHELTER_CHARACTER_SCENE,
    speaker: options.speaker || "type-07a",
    characterLine: true,
  });
}
