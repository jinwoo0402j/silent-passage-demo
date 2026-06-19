import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_VOICE_DIR = path.join(ROOT, "assets", "voice", "shelter");
const DEFAULT_LINES = path.join(DEFAULT_VOICE_DIR, "voice-lines.json");
const DEFAULT_CONFIG = path.join(DEFAULT_VOICE_DIR, "sbv2.config.json");

function parseArgs(argv) {
  const args = {
    voiceLines: DEFAULT_LINES,
    config: DEFAULT_CONFIG,
    voiceDir: DEFAULT_VOICE_DIR,
    limit: Infinity,
    only: "",
    overwrite: false,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--voice-lines") {
      args.voiceLines = path.resolve(argv[index + 1] || args.voiceLines);
      index += 1;
    } else if (arg === "--config") {
      args.config = path.resolve(argv[index + 1] || args.config);
      index += 1;
    } else if (arg === "--voice-dir") {
      args.voiceDir = path.resolve(argv[index + 1] || args.voiceDir);
      index += 1;
    } else if (arg === "--limit") {
      args.limit = Math.max(0, Number(argv[index + 1] || 0));
      index += 1;
    } else if (arg === "--only") {
      args.only = String(argv[index + 1] || "").trim();
      index += 1;
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    }
  }
  return args;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function mergeVoiceParams(config, line) {
  return {
    ...(config.defaults || {}),
    ...((config.emotionStyles || {})[line.emotion] || {}),
  };
}

function appendIfPresent(searchParams, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  searchParams.set(key, String(value));
}

function buildVoiceUrl(config, line) {
  const base = new URL("/voice", config.serverUrl || "http://127.0.0.1:5000");
  const params = mergeVoiceParams(config, line);
  base.searchParams.set("text", line.voiceText || line.text);
  appendIfPresent(base.searchParams, "encoding", "utf-8");
  appendIfPresent(base.searchParams, "model_name", config.modelName);
  appendIfPresent(base.searchParams, "model_id", config.modelId);
  appendIfPresent(base.searchParams, "speaker_name", config.speakerName);
  appendIfPresent(base.searchParams, "speaker_id", config.speakerId);
  appendIfPresent(base.searchParams, "language", line.language || config.language);
  appendIfPresent(base.searchParams, "style", params.style);
  appendIfPresent(base.searchParams, "style_weight", params.styleWeight);
  appendIfPresent(base.searchParams, "sdp_ratio", params.sdpRatio);
  appendIfPresent(base.searchParams, "noise", params.noise);
  appendIfPresent(base.searchParams, "noisew", params.noiseW);
  appendIfPresent(base.searchParams, "length", params.length);
  appendIfPresent(base.searchParams, "auto_split", params.autoSplit);
  appendIfPresent(base.searchParams, "split_interval", params.splitInterval);
  appendIfPresent(base.searchParams, "assist_text", line.assistText || params.assistText);
  appendIfPresent(base.searchParams, "assist_text_weight", params.assistTextWeight);
  appendIfPresent(base.searchParams, "reference_audio_path", params.referenceAudioPath);
  return base;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateLine(config, line, targetPath, dryRun) {
  const url = buildVoiceUrl(config, line);
  if (dryRun) {
    console.log(`[dry-run] ${line.id} -> ${targetPath}`);
    console.log(`          ${url.href.replace(line.voiceText || line.text, encodeURIComponent("<text>"))}`);
    return "dry-run";
  }
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SBV2 failed for ${line.id}: HTTP ${response.status} ${detail.slice(0, 300)}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("audio")) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SBV2 returned non-audio for ${line.id}: ${contentType} ${detail.slice(0, 300)}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);
  console.log(`Wrote ${targetPath}`);
  return "written";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [voiceLines, config] = await Promise.all([
    readJson(args.voiceLines),
    readJson(args.config),
  ]);
  const lines = Array.isArray(voiceLines.lines) ? voiceLines.lines : [];
  let selected = args.only
    ? lines.filter((line) => line.emotion === args.only || line.id === args.only || line.eventId === args.only)
    : lines;
  selected = selected.slice(0, Number.isFinite(args.limit) ? args.limit : selected.length);
  let written = 0;
  let skipped = 0;
  for (const line of selected) {
    if (!line.file || !line.text) {
      skipped += 1;
      continue;
    }
    const targetPath = path.join(args.voiceDir, line.file);
    if (!args.overwrite && await exists(targetPath)) {
      skipped += 1;
      continue;
    }
    const result = await generateLine(config, line, targetPath, args.dryRun);
    if (result === "written" || result === "dry-run") {
      written += 1;
    }
  }
  console.log(`Done. Generated=${written}, skipped=${skipped}, selected=${selected.length}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
