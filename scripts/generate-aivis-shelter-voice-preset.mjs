import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VOICE_ROOT = path.join(ROOT, "assets", "voice", "shelter");
const SOURCE_LINES = path.join(VOICE_ROOT, "voice-lines.json");
const PRESET_ROOT = path.join(VOICE_ROOT, "presets");
const PRESET_INDEX = path.join(VOICE_ROOT, "voice-presets.json");
const ENGINE_URL = process.env.AIVIS_ENGINE_URL || "http://127.0.0.1:10101";
const STORAGE_KEY = "silent-passage-shelter-voice-preset-v1";

const PRESET = {
  id: "aivis-mai",
  label: "Aivis: まい",
  description: "AivisHub의 まい 모델. 요염한 젊은 여성 톤의 Type-07A 후보.",
  tags: ["aivis", "mai", "female", "acml-1.0"],
  manifest: "./assets/voice/shelter/presets/aivis-mai/manifest.json",
};

const MODEL = {
  generator: "AivisSpeech Engine",
  modelName: "まい",
  modelUuid: "e9339137-2ae3-4d41-9394-fb757a7e61e6",
  speakerName: "まい",
  speakerUuid: "41b7785f-35cc-4089-a360-dd8a63da5e75",
  styleName: "ノーマル",
  styleId: 1431611904,
  sourceUrl: "https://hub.aivis-project.com/aivm-models/e9339137-2ae3-4d41-9394-fb757a7e61e6",
  license: "ACML 1.0",
};

function hasArg(name) {
  return process.argv.includes(name);
}

function getArgNumber(name, fallback) {
  const value = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!value) {
    return fallback;
  }
  const numeric = Number(value.slice(name.length + 1));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function isJapaneseText(value = "") {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function ensureEngine() {
  const response = await fetch(`${ENGINE_URL}/version`);
  if (!response.ok) {
    throw new Error(`AivisSpeech Engine is not ready: ${response.status}`);
  }
}

function tuneQuery(query) {
  return {
    ...query,
    speedScale: 0.98,
    intonationScale: 0.96,
    tempoDynamicsScale: 0.92,
    volumeScale: 1.18,
    prePhonemeLength: 0.08,
    postPhonemeLength: 0.08,
  };
}

async function synthesize(text, outputFile) {
  const queryUrl = `${ENGINE_URL}/audio_query?speaker=${MODEL.styleId}&text=${encodeURIComponent(text)}`;
  const queryResponse = await fetch(queryUrl, { method: "POST" });
  if (!queryResponse.ok) {
    throw new Error(`audio_query failed: ${queryResponse.status} ${await queryResponse.text()}`);
  }

  const query = tuneQuery(await queryResponse.json());
  const synthesisResponse = await fetch(`${ENGINE_URL}/synthesis?speaker=${MODEL.styleId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!synthesisResponse.ok) {
    throw new Error(`synthesis failed: ${synthesisResponse.status} ${await synthesisResponse.text()}`);
  }

  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  const buffer = Buffer.from(await synthesisResponse.arrayBuffer());
  await fs.writeFile(outputFile, buffer);
  return buffer.length;
}

function toManifestLine(line, presetRoot) {
  const src = `./assets/voice/shelter/${presetRoot}/${line.file.replaceAll("\\", "/")}`;
  return {
    id: line.id,
    emotion: line.emotion,
    topic: line.topic,
    text: line.text,
    voiceText: line.voiceText,
    src,
    tags: [line.emotion, line.topic].filter(Boolean),
  };
}

function toDefaultManifestLine(line) {
  return {
    id: line.id,
    emotion: line.emotion,
    topic: line.topic,
    text: line.text,
    voiceText: line.voiceText,
    src: `./assets/voice/shelter/${line.file.replaceAll("\\", "/")}`,
    tags: [line.emotion, line.topic].filter(Boolean),
  };
}

async function upsertPresetIndex() {
  const index = await readJson(PRESET_INDEX).catch(() => ({
    version: 1,
    storageKey: STORAGE_KEY,
    defaultPreset: PRESET.id,
    presets: [],
  }));
  const presets = Array.isArray(index.presets)
    ? index.presets.filter((preset) => preset.id !== PRESET.id)
    : [];
  index.storageKey = index.storageKey || STORAGE_KEY;
  index.defaultPreset = PRESET.id;
  index.updatedAt = new Date().toISOString();
  index.presets = [PRESET, ...presets];
  await writeJson(PRESET_INDEX, index);
}

async function main() {
  const overwrite = hasArg("--overwrite");
  const makeDefault = hasArg("--make-default");
  const limit = getArgNumber("--limit", 2);
  await ensureEngine();

  const source = await readJson(SOURCE_LINES);
  const selectedLines = source.lines
    .filter((line) => line.file && line.voiceText && isJapaneseText(line.voiceText))
    .slice(0, limit);

  if (!selectedLines.length) {
    throw new Error("No Japanese voiceText lines found.");
  }

  const presetDir = path.join(PRESET_ROOT, PRESET.id);
  const generatedAt = new Date().toISOString();
  const manifestLines = [];
  const defaultLines = [];

  for (const line of selectedLines) {
    const presetOutput = path.join(presetDir, line.file);
    if (overwrite || !await fs.stat(presetOutput).then(() => true).catch(() => false)) {
      const size = await synthesize(line.voiceText, presetOutput);
      console.log(`Generated ${path.relative(ROOT, presetOutput)} (${size} bytes)`);
    } else {
      console.log(`Skipped ${path.relative(ROOT, presetOutput)}`);
    }
    manifestLines.push(toManifestLine(line, `presets/${PRESET.id}`));
    defaultLines.push(toDefaultManifestLine(line));

    if (makeDefault) {
      const defaultOutput = path.join(VOICE_ROOT, line.file);
      await fs.mkdir(path.dirname(defaultOutput), { recursive: true });
      await fs.copyFile(presetOutput, defaultOutput);
    }
  }

  const manifest = {
    version: 1,
    presetId: PRESET.id,
    label: PRESET.label,
    description: PRESET.description,
    tags: PRESET.tags,
    scene: source.scene || "shelter",
    speaker: source.speaker || "type-07a",
    voice: source.voice || "type07a",
    format: "wav",
    generator: MODEL.generator,
    modelName: MODEL.modelName,
    modelUuid: MODEL.modelUuid,
    speakerName: MODEL.speakerName,
    speakerUuid: MODEL.speakerUuid,
    styleName: MODEL.styleName,
    styleId: MODEL.styleId,
    license: MODEL.license,
    sourceUrl: MODEL.sourceUrl,
    generatedAt,
    playbackRate: 1,
    preservesPitch: true,
    lines: manifestLines,
  };

  await writeJson(path.join(presetDir, "manifest.json"), manifest);
  await upsertPresetIndex();

  if (makeDefault) {
    await writeJson(path.join(VOICE_ROOT, "manifest.json"), {
      ...manifest,
      description: "Default shelter voice bank generated from AivisSpeech まい.",
      lines: defaultLines,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
