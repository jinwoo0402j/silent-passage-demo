import { getAudioChannelVolume } from "./audio-options.js?v=20260613-sound-options-v1";

const TTS_ENABLED_KEY = "silent-passage-tts-enabled-v1";
const VOICE_BANK_MANIFEST_URL = "./assets/voice/shelter/manifest.json?v=20260617-1";
const VOICE_BANK_MODES = new Set(["bank", "assets", "on"]);
let voiceBankManifestPromise = null;
let currentVoiceBankAudio = null;

function getSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

export function isTtsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  const mode = getSearchParams().get("tts");
  if (mode === "on" || shouldUseVoiceBank()) {
    return true;
  }
  if (mode === "off") {
    return false;
  }
  return window.localStorage?.getItem(TTS_ENABLED_KEY) === "on";
}

function shouldUseVoiceBank() {
  const mode = getSearchParams().get("tts");
  return VOICE_BANK_MODES.has(mode || "");
}

async function loadVoiceBankManifest() {
  if (typeof fetch === "undefined") {
    return null;
  }
  if (!voiceBankManifestPromise) {
    voiceBankManifestPromise = fetch(VOICE_BANK_MANIFEST_URL)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return voiceBankManifestPromise;
}

function scoreVoiceLine(entry, text, options = {}) {
  if (!entry || !entry.src) {
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
  const entries = Array.isArray(manifest?.lines) ? manifest.lines : [];
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

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return hash;
}

async function trySpeakVoiceBankLine(text, options = {}) {
  if (!shouldUseVoiceBank() || typeof window === "undefined" || typeof window.Audio === "undefined") {
    return false;
  }
  const manifest = await loadVoiceBankManifest();
  const line = pickVoiceBankLine(manifest, text, options);
  if (!line?.src) {
    return false;
  }
  try {
    if (currentVoiceBankAudio) {
      currentVoiceBankAudio.pause();
      currentVoiceBankAudio = null;
    }
    window.speechSynthesis?.cancel?.();
    const audio = new window.Audio(line.src);
    currentVoiceBankAudio = audio;
    audio.volume = getAudioChannelVolume("voice", 1);
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("ko")) ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith("en")) ||
    voices[0] ||
    null
  );
}

function speakBrowserTtsLine(line) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(line);
  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang || "ko-KR";
  } else {
    utterance.lang = "ko-KR";
  }
  utterance.volume = getAudioChannelVolume("voice", 1);
  utterance.rate = 0.92;
  utterance.pitch = 0.88;
  window.speechSynthesis.speak(utterance);
}

export async function speakFaceOffLine(text, options = {}) {
  if (!isTtsEnabled()) {
    return;
  }
  const line = String(text || "").trim();
  if (!line) {
    return;
  }
  try {
    const usedVoiceBank = await trySpeakVoiceBankLine(line, options);
    if (!usedVoiceBank && getSearchParams().get("tts") !== "bank") {
      speakBrowserTtsLine(line);
    }
  } catch {
    // TTS is optional; browser or OS voices may be unavailable.
  }
}
