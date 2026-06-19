import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "assets", "voice", "shelter", "voice-lines.json");
const EMOTIONS = new Set(["neutral", "anxious", "warm", "tired", "hurt", "angry"]);

function parseArgs(argv) {
  const args = {
    out: DEFAULT_OUT,
    includeGeneric: true,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      args.out = path.resolve(argv[index + 1] || args.out);
      index += 1;
    } else if (arg === "--no-generic") {
      args.includeGeneric = false;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    }
  }
  return args;
}

function normalizeEmotion(emotion = "neutral") {
  const value = String(emotion || "").trim();
  return EMOTIONS.has(value) ? value : "neutral";
}

function splitDialogueLines(text = "") {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractQuotedDialogue(text = "") {
  const matches = [];
  const quotePattern = /[“"「『‘']([^”"」』’']+)[”"」』’']/gu;
  let match = quotePattern.exec(String(text || ""));
  while (match) {
    const quoted = String(match[1] || "").trim();
    if (quoted) {
      matches.push(quoted);
    }
    match = quotePattern.exec(String(text || ""));
  }
  return matches;
}

function normalizeVoiceTexts(text = "", { allowUnquoted = false } = {}) {
  const result = [];
  splitDialogueLines(text).forEach((line) => {
    const quoted = extractQuotedDialogue(line);
    if (quoted.length) {
      result.push(...quoted);
    } else if (allowUnquoted) {
      result.push(line);
    }
  });
  return result.map((line) => line.trim()).filter(Boolean);
}

function hashText(value = "") {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function slug(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function createVoiceLine({ text, emotion, topic, eventId, nodeId, source, index }) {
  const normalizedEmotion = normalizeEmotion(emotion);
  const idParts = [
    "type07a",
    normalizedEmotion,
    slug(eventId || source || "generic") || "generic",
    hashText(`${eventId}|${nodeId}|${source}|${index}|${text}`),
  ];
  const id = idParts.filter(Boolean).join("_");
  return {
    id,
    scene: "shelter",
    speaker: "type-07a",
    emotion: normalizedEmotion,
    topic: String(topic || eventId || source || "shelter").trim(),
    eventId: String(eventId || ""),
    nodeId: String(nodeId || ""),
    source: String(source || ""),
    text,
    voiceText: text,
    file: `${normalizedEmotion}/${id}.wav`,
  };
}

async function importLevelData() {
  const levelDataUrl = `${pathToFileURL(path.join(ROOT, "level-data.js")).href}?voiceLines=${Date.now()}`;
  const { GAME_DATA } = await import(levelDataUrl);
  return GAME_DATA;
}

function collectEventVoiceLines(data) {
  const lines = [];
  const events = Array.isArray(data?.shelter?.events) ? data.shelter.events : [];
  events.forEach((event) => {
    const eventId = String(event.id || "");
    normalizeVoiceTexts(event.transitionLine || event.bridgeLine || "", { allowUnquoted: false })
      .forEach((text, index) => {
        lines.push(createVoiceLine({
          text,
          emotion: event.transitionEmotion || event.emotion,
          topic: event.title || eventId,
          eventId,
          nodeId: "",
          source: "event-transition",
          index,
        }));
      });
    const nodes = Array.isArray(event.nodes) ? event.nodes : [];
    nodes.forEach((node) => {
      normalizeVoiceTexts(node.line || "", { allowUnquoted: false }).forEach((text, index) => {
        lines.push(createVoiceLine({
          text,
          emotion: node.emotion || event.emotion,
          topic: event.title || eventId,
          eventId,
          nodeId: node.id || "",
          source: "event-node",
          index,
        }));
      });
      const choices = Array.isArray(node.choices) ? node.choices : [];
      choices.forEach((choice, choiceIndex) => {
        normalizeVoiceTexts(choice.reply || "", { allowUnquoted: true }).forEach((text, lineIndex) => {
          lines.push(createVoiceLine({
            text,
            emotion: choice.emotion || node.emotion || event.emotion,
            topic: choice.intent || event.title || eventId,
            eventId,
            nodeId: node.id || "",
            source: `event-choice-${choiceIndex}`,
            index: lineIndex,
          }));
        });
      });
    });
  });
  return lines;
}

function findArrayLiteral(source, constName) {
  const marker = `const ${constName} = [`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    return "";
  }
  const start = source.indexOf("[", markerIndex);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return "";
}

async function collectGenericVoiceLines() {
  const source = await fs.readFile(path.join(ROOT, "systems.js"), "utf8");
  const literal = findArrayLiteral(source, "SHELTER_TALK_CHOICES");
  if (!literal) {
    return [];
  }
  const choices = Function(`"use strict"; return (${literal});`)();
  const lines = [];
  choices.forEach((choice, choiceIndex) => {
    const replyTexts = [];
    if (typeof choice.reply === "string") {
      replyTexts.push(choice.reply);
    }
    if (Array.isArray(choice.replies)) {
      replyTexts.push(...choice.replies);
    }
    replyTexts.forEach((reply, replyIndex) => {
      normalizeVoiceTexts(reply, { allowUnquoted: true }).forEach((text, lineIndex) => {
        lines.push(createVoiceLine({
          text,
          emotion: choice.emotion,
          topic: choice.intent || choice.label || "generic shelter reply",
          eventId: "",
          nodeId: "",
          source: "generic-reply",
          index: `${choiceIndex}-${replyIndex}-${lineIndex}`,
        }));
      });
    });
  });
  return lines;
}

function dedupeLines(lines) {
  const seen = new Map();
  lines.forEach((line) => {
    const key = `${line.text}|${line.emotion}|${line.topic}`;
    if (!seen.has(key)) {
      seen.set(key, line);
    }
  });
  return [...seen.values()];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const data = await importLevelData();
  const eventLines = collectEventVoiceLines(data);
  const genericLines = args.includeGeneric ? await collectGenericVoiceLines() : [];
  const lines = dedupeLines([...eventLines, ...genericLines]);
  const payload = {
    version: 2,
    scene: "shelter",
    speaker: "type-07a",
    voice: "type07a",
    generator: "Style-Bert-VITS2",
    format: "wav",
    generatedAt: new Date().toISOString(),
    lines,
  };
  if (args.dryRun) {
    console.log(JSON.stringify({
      eventLines: eventLines.length,
      genericLines: genericLines.length,
      total: lines.length,
    }, null, 2));
    return;
  }
  await fs.mkdir(path.dirname(args.out), { recursive: true });
  await fs.writeFile(args.out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${args.out} with ${lines.length} voice line(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
