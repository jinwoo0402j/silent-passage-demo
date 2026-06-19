#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const { GAME_DATA } = await import(pathToFileURL(path.join(repoRoot, "level-data.js")).href);

const emotionAssetKeys = {
  neutral: "shelterHomeNeutralCg",
  anxious: "shelterHomeAnxiousCg",
  warm: "shelterHomeWarmCg",
  tired: "shelterHomeTiredCg",
  hurt: "shelterHomeHurtCg",
  angry: "shelterHomeAngryCg",
};

const errors = [];
const warnings = [];

function stripQuery(src) {
  return String(src || "").split("?")[0].trim();
}

function resolveLocalAssetPath(src) {
  const clean = stripQuery(src);
  if (!clean || /^[a-z]+:/i.test(clean)) {
    return null;
  }
  return path.resolve(repoRoot, clean.replace(/^[./\\]+/, ""));
}

async function getPngDimensions(filePath) {
  const buffer = await fs.readFile(filePath);
  if (
    buffer.length < 24
    || buffer.toString("ascii", 1, 4) !== "PNG"
  ) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const seenSrc = new Map();

for (const [emotion, assetKey] of Object.entries(emotionAssetKeys)) {
  const src = GAME_DATA.art?.[assetKey]?.src;
  if (!src) {
    errors.push(`${emotion}: missing GAME_DATA.art.${assetKey}.src`);
    continue;
  }

  const cleanSrc = stripQuery(src);
  if (seenSrc.has(cleanSrc)) {
    warnings.push(`${emotion}: reuses ${cleanSrc} from ${seenSrc.get(cleanSrc)}`);
  } else {
    seenSrc.set(cleanSrc, emotion);
  }

  const assetPath = resolveLocalAssetPath(src);
  if (!assetPath) {
    warnings.push(`${emotion}: non-local asset cannot be checked: ${src}`);
    continue;
  }

  try {
    await fs.access(assetPath);
  } catch {
    errors.push(`${emotion}: file does not exist: ${path.relative(repoRoot, assetPath)}`);
    continue;
  }

  const dimensions = await getPngDimensions(assetPath);
  if (!dimensions) {
    warnings.push(`${emotion}: could not read PNG dimensions: ${path.relative(repoRoot, assetPath)}`);
    continue;
  }

  const aspect = dimensions.width / Math.max(1, dimensions.height);
  if (Math.abs(aspect - (16 / 9)) > 0.02) {
    warnings.push(`${emotion}: expected 16:9 CG, got ${dimensions.width}x${dimensions.height}`);
  }
}

warnings.forEach((warning) => {
  console.warn(`[WARN] ${warning}`);
});

if (errors.length) {
  errors.forEach((error) => {
    console.error(`[ERROR] ${error}`);
  });
  process.exitCode = 1;
} else {
  console.log(`[OK] Shelter CG assets validated (${Object.keys(emotionAssetKeys).length} emotion keys).`);
}
