#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const levelsRoot = path.join(repoRoot, "levels");
const manifestPath = path.join(levelsRoot, "manifest.json");

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectJsonFiles(targetDir) {
  if (!(await exists(targetDir))) {
    return [];
  }

  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const childPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      return collectJsonFiles(childPath);
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      return [childPath];
    }
    return [];
  }));
  return files.flat();
}

function toManifestPath(filePath) {
  return path.relative(levelsRoot, filePath).split(path.sep).join("/");
}

function getPathVersion(filePath) {
  const match = path.basename(filePath).match(/\.v(\d+)\.json$/i);
  return match ? Number(match[1]) || 0 : 0;
}

async function getSingleLevelId(filePath) {
  try {
    const document = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (document && typeof document === "object" && !Array.isArray(document)) {
      if (typeof document.levelId === "string" && document.levelId.trim()) {
        return document.levelId.trim();
      }
      if (document.levels && typeof document.levels === "object" && !Array.isArray(document.levels)) {
        const ids = Object.keys(document.levels).filter(Boolean);
        return ids.length === 1 ? ids[0] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function getCanonicalJsonFiles(files) {
  const canonicalByLevelId = new Map();
  const passthrough = [];

  for (const filePath of files) {
    const levelId = await getSingleLevelId(filePath);
    if (!levelId) {
      passthrough.push(filePath);
      continue;
    }

    const candidate = {
      filePath,
      manifestPath: toManifestPath(filePath),
      version: getPathVersion(filePath),
    };
    const current = canonicalByLevelId.get(levelId);
    if (
      !current
      || candidate.version > current.version
      || (candidate.version === current.version && candidate.manifestPath > current.manifestPath)
    ) {
      canonicalByLevelId.set(levelId, candidate);
    }
  }

  return [
    ...passthrough,
    ...[...canonicalByLevelId.values()].map((entry) => entry.filePath),
  ].sort();
}

async function readExistingManifest() {
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const [draftFiles, acceptedFiles, previous] = await Promise.all([
  collectJsonFiles(path.join(levelsRoot, "drafts")),
  collectJsonFiles(path.join(levelsRoot, "accepted")),
  readExistingManifest(),
]);

const canonicalDraftFiles = await getCanonicalJsonFiles(draftFiles);
const canonicalAcceptedFiles = await getCanonicalJsonFiles(acceptedFiles);

const manifest = {
  version: 1,
  ...previous,
  drafts: canonicalDraftFiles.map(toManifestPath).sort(),
  accepted: canonicalAcceptedFiles.map(toManifestPath).sort(),
};

await fs.mkdir(levelsRoot, { recursive: true });
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Updated levels/manifest.json`);
console.log(`drafts: ${manifest.drafts.length}`);
console.log(`accepted: ${manifest.accepted.length}`);
if (canonicalDraftFiles.length !== draftFiles.length || canonicalAcceptedFiles.length !== acceptedFiles.length) {
  console.log("canonicalized duplicate levelId exports to the highest .vNNN.json file");
}

