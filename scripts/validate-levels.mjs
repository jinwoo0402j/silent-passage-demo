#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const levelsRoot = path.join(repoRoot, "levels");
const manifestPath = path.join(levelsRoot, "manifest.json");
const defaultLevelDirs = [
  path.join(repoRoot, "levels", "drafts"),
  path.join(repoRoot, "levels", "accepted"),
];

const { GAME_DATA } = await import(pathToFileURL(path.join(repoRoot, "level-data.js")).href);
const {
  createBaseLevelData,
  getLevelIds,
  normalizeEditableLevelData,
} = await import(pathToFileURL(path.join(repoRoot, "level-store.js")).href);

const errors = [];
const warnings = [];
const infos = [];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectJsonFiles(targetPath) {
  if (!(await exists(targetPath))) {
    return [];
  }

  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    return targetPath.toLowerCase().endsWith(".json") ? [targetPath] : [];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const childPath = path.join(targetPath, entry.name);
    return entry.isDirectory() ? collectJsonFiles(childPath) : collectJsonFiles(childPath);
  }));
  return nested.flat();
}

function pushError(file, message) {
  errors.push(`${file}: ${message}`);
}

function pushWarning(file, message) {
  warnings.push(`${file}: ${message}`);
}

function expandLevelDocument(document, fileLabel) {
  if (!isRecord(document)) {
    pushError(fileLabel, "JSON root must be an object.");
    return [];
  }

  if (isRecord(document.levels)) {
    return Object.entries(document.levels).map(([levelId, level]) => ({
      fileLabel,
      levelId: safeString(level?.levelId || level?.id, levelId),
      raw: {
        ...level,
        levelId: safeString(level?.levelId || level?.id, levelId),
      },
    }));
  }

  const levelId = safeString(document.levelId || document.id, "");
  if (!levelId) {
    pushError(fileLabel, "Missing levelId.");
    return [];
  }
  return [{ fileLabel, levelId, raw: document }];
}

function normalizeLevel(entry) {
  try {
    const base = createBaseLevelData(GAME_DATA, entry.levelId);
    const normalized = normalizeEditableLevelData({
      ...entry.raw,
      levelId: entry.levelId,
    }, base);
    return {
      ...entry,
      normalized,
    };
  } catch (error) {
    pushError(entry.fileLabel, `Failed to normalize level ${entry.levelId}: ${error.message}`);
    return null;
  }
}

function collectDuplicateValues(items, getValue) {
  const counts = new Map();
  items.forEach((item) => {
    const value = getValue(item);
    if (!value) {
      return;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

async function validateManifestAgainstFiles(jsonFiles) {
  if (!(await exists(manifestPath))) {
    pushWarning("levels/manifest.json", "manifest does not exist. Run node scripts/update-level-manifest.mjs.");
    return;
  }

  let manifest = null;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch (error) {
    pushError("levels/manifest.json", `Invalid JSON: ${error.message}`);
    return;
  }

  const expected = new Set(
    jsonFiles
      .map((filePath) => toPosix(path.relative(levelsRoot, filePath)))
      .filter((filePath) => filePath.startsWith("drafts/") || filePath.startsWith("accepted/")),
  );
  const actual = new Set([
    ...(Array.isArray(manifest.drafts) ? manifest.drafts : []),
    ...(Array.isArray(manifest.accepted) ? manifest.accepted : []),
  ]);

  expected.forEach((filePath) => {
    if (!actual.has(filePath)) {
      pushError("levels/manifest.json", `missing ${filePath}. Run node scripts/update-level-manifest.mjs.`);
    }
  });
  actual.forEach((filePath) => {
    if (!expected.has(filePath)) {
      pushError("levels/manifest.json", `references missing file ${filePath}. Run node scripts/update-level-manifest.mjs.`);
    }
  });
}

function validateRect(fileLabel, levelId, label, rect, options = {}) {
  const required = options.required !== false;
  if (!isRecord(rect)) {
    if (required) {
      pushError(fileLabel, `${levelId}: ${label} must be an object.`);
    }
    return;
  }

  ["x", "y"].forEach((field) => {
    if (!isFiniteNumber(rect[field])) {
      pushError(fileLabel, `${levelId}: ${label}.${field} must be a number.`);
    }
  });

  if (options.size !== false) {
    ["width", "height"].forEach((field) => {
      if (!isFiniteNumber(rect[field]) || Number(rect[field]) <= 0) {
        pushError(fileLabel, `${levelId}: ${label}.${field} must be a positive number.`);
      }
    });
  }
}

function validateLevel(entry, knownLevels) {
  const { fileLabel, levelId, normalized } = entry;

  if (!/^[a-z0-9][a-z0-9_-]*$/.test(levelId)) {
    pushError(fileLabel, `${levelId}: levelId must use lowercase letters, numbers, hyphen, or underscore.`);
  }

  validateRect(fileLabel, levelId, "world", normalized.world, { size: true });
  validateRect(fileLabel, levelId, "player.spawn", normalized.player?.spawn, { size: false });

  const entrances = Array.isArray(normalized.entrances) ? normalized.entrances : [];
  if (entrances.length === 0) {
    pushError(fileLabel, `${levelId}: at least one entrance is required.`);
  }

  collectDuplicateValues(entrances, (entrance) => entrance.id)
    .forEach((id) => pushError(fileLabel, `${levelId}: duplicate entrance id "${id}".`));

  entrances.forEach((entrance, index) => {
    if (!safeString(entrance.id, "")) {
      pushError(fileLabel, `${levelId}: entrance[${index}] is missing id.`);
    }
    validateRect(fileLabel, levelId, `entrance[${index}]`, entrance, { size: false });
  });

  const routeExits = Array.isArray(normalized.routeExits) ? normalized.routeExits : [];
  collectDuplicateValues(routeExits, (routeExit) => routeExit.id)
    .forEach((id) => pushError(fileLabel, `${levelId}: duplicate routeExit id "${id}".`));

  routeExits.forEach((routeExit, index) => {
    const label = `routeExits[${index}]`;
    if (!safeString(routeExit.id, "")) {
      pushError(fileLabel, `${levelId}: ${label} is missing id.`);
    }
    validateRect(fileLabel, levelId, label, routeExit, { size: true });

    const targetLevelId = safeString(routeExit.toLevelId, "");
    if (!targetLevelId) {
      pushError(fileLabel, `${levelId}: ${label}.toLevelId is required.`);
      return;
    }

    const target = knownLevels.get(targetLevelId);
    if (!target) {
      pushError(fileLabel, `${levelId}: ${label}.toLevelId "${targetLevelId}" does not exist.`);
      return;
    }

    const targetEntranceId = safeString(routeExit.toEntranceId, "start");
    const targetEntrances = Array.isArray(target.entrances) ? target.entrances : [];
    if (!targetEntrances.some((entrance) => entrance.id === targetEntranceId)) {
      pushError(
        fileLabel,
        `${levelId}: ${label}.toEntranceId "${targetEntranceId}" does not exist in ${targetLevelId}.`,
      );
    }
  });

  const extractionGate = normalized.extractionGate;
  if (extractionGate) {
    validateRect(fileLabel, levelId, "extractionGate", extractionGate, { size: true });
  }

  (normalized.platforms || []).forEach((platform, index) => {
    validateRect(fileLabel, levelId, `platforms[${index}]`, platform, { size: true });
  });
}

const cliTargets = process.argv.slice(2).map((target) => path.resolve(repoRoot, target));
const targets = cliTargets.length > 0 ? cliTargets : defaultLevelDirs;
const jsonFiles = (await Promise.all(targets.map(collectJsonFiles))).flat().sort();
if (cliTargets.length === 0) {
  await validateManifestAgainstFiles(jsonFiles);
}

if (jsonFiles.length === 0) {
  console.log("No level JSON files found under levels/drafts or levels/accepted.");
  process.exit(0);
}

const levelEntries = [];

for (const filePath of jsonFiles) {
  const fileLabel = toPosix(path.relative(repoRoot, filePath));
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const document = JSON.parse(raw);
    levelEntries.push(...expandLevelDocument(document, fileLabel));
  } catch (error) {
    pushError(fileLabel, `Invalid JSON: ${error.message}`);
  }
}

const normalizedEntries = levelEntries
  .map(normalizeLevel)
  .filter(Boolean);

const acceptedEntries = normalizedEntries.filter((entry) => entry.fileLabel.startsWith("levels/accepted/"));
const acceptedDuplicates = collectDuplicateValues(acceptedEntries, (entry) => entry.levelId);
acceptedDuplicates.forEach((levelId) => {
  pushError("levels/accepted", `duplicate accepted levelId "${levelId}".`);
});

const allDuplicateIds = collectDuplicateValues(normalizedEntries, (entry) => entry.levelId);
allDuplicateIds.forEach((levelId) => {
  const files = normalizedEntries
    .filter((entry) => entry.levelId === levelId)
    .map((entry) => entry.fileLabel)
    .join(", ");
  pushWarning(levelId, `levelId appears in multiple exported files: ${files}`);
});

const knownLevels = new Map();
getLevelIds(GAME_DATA).forEach((levelId) => {
  knownLevels.set(levelId, createBaseLevelData(GAME_DATA, levelId));
});
normalizedEntries.forEach((entry) => {
  knownLevels.set(entry.levelId, entry.normalized);
});

normalizedEntries.forEach((entry) => validateLevel(entry, knownLevels));
normalizedEntries.forEach((entry) => {
  infos.push(`[OK] ${entry.fileLabel} -> ${entry.levelId}`);
});

infos.forEach((message) => console.log(message));
warnings.forEach((message) => console.warn(`[WARN] ${message}`));
errors.forEach((message) => console.error(`[ERROR] ${message}`));

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s).`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${normalizedEntries.length} level export(s).`);
}

