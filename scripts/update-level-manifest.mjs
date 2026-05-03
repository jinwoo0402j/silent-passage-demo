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

const manifest = {
  version: 1,
  ...previous,
  drafts: draftFiles.map(toManifestPath).sort(),
  accepted: acceptedFiles.map(toManifestPath).sort(),
};

await fs.mkdir(levelsRoot, { recursive: true });
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Updated levels/manifest.json`);
console.log(`drafts: ${manifest.drafts.length}`);
console.log(`accepted: ${manifest.accepted.length}`);

