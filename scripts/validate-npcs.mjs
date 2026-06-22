#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const npcsRoot = path.join(repoRoot, "npcs");
const manifestPath = path.join(npcsRoot, "manifest.json");
const levelsManifestPath = path.join(repoRoot, "levels", "manifest.json");

const errors = [];
const warnings = [];

const { GAME_DATA } = await import(pathToFileURL(path.join(repoRoot, "level-data.js")).href);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    errors.push(`${path.relative(repoRoot, filePath)}: invalid JSON: ${error.message}`);
    return null;
  }
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectLevelRefs() {
  const refs = new Map();
  Object.entries(GAME_DATA.levels || {}).forEach(([levelId, level]) => {
    refs.set(levelId, {
      routes: new Set((level.routeExits || []).map((route) => route.id).filter(Boolean)),
    });
  });

  if (!(await exists(levelsManifestPath))) {
    return refs;
  }
  const manifest = await readJson(levelsManifestPath);
  const levelPaths = [
    ...(Array.isArray(manifest?.drafts) ? manifest.drafts : []),
    ...(Array.isArray(manifest?.accepted) ? manifest.accepted : []),
  ];
  for (const entry of levelPaths) {
    const levelPath = path.join(repoRoot, "levels", entry);
    const document = await readJson(levelPath);
    if (!isRecord(document)) {
      continue;
    }
    const levels = isRecord(document.levels)
      ? Object.entries(document.levels).map(([levelId, level]) => ({ ...level, levelId: safeString(level?.levelId || level?.id, levelId) }))
      : [{ ...document, levelId: safeString(document.levelId || document.id, "") }];
    levels.forEach((level) => {
      if (!level.levelId) {
        return;
      }
      refs.set(level.levelId, {
        routes: new Set((level.routeExits || []).map((route) => route.id).filter(Boolean)),
      });
    });
  }
  return refs;
}

function validateStoryFlags(fileLabel, label, flags) {
  if (!Array.isArray(flags)) {
    return;
  }
  flags.forEach((flag, index) => {
    if (!safeString(flag, "")) {
      errors.push(`${fileLabel}: ${label}[${index}] must be a non-empty string.`);
    }
  });
}

function validateChoice(fileLabel, nodeLabel, choice, index) {
  if (!isRecord(choice)) {
    errors.push(`${fileLabel}: ${nodeLabel}.choices[${index}] must be an object.`);
    return null;
  }
  const id = safeString(choice.id, "");
  if (!id) {
    errors.push(`${fileLabel}: ${nodeLabel}.choices[${index}].id is required.`);
  }
  if (!safeString(choice.label, "")) {
    errors.push(`${fileLabel}: ${nodeLabel}.choices[${index}].label is required.`);
  }
  if (choice.effects !== undefined && !isRecord(choice.effects)) {
    errors.push(`${fileLabel}: ${nodeLabel}.choices[${index}].effects must be an object.`);
  }
  validateStoryFlags(fileLabel, `${nodeLabel}.choices[${index}].effects.storyFlags`, choice.effects?.storyFlags);
  if (choice.postAction !== undefined && !isRecord(choice.postAction)) {
    errors.push(`${fileLabel}: ${nodeLabel}.choices[${index}].postAction must be an object.`);
  }
  if (choice.postAction?.type && !["route"].includes(choice.postAction.type)) {
    errors.push(`${fileLabel}: ${nodeLabel}.choices[${index}].postAction.type is unsupported.`);
  }
  return id;
}

function validateDialogue(fileLabel, placementLabel, dialogue) {
  if (!isRecord(dialogue)) {
    errors.push(`${fileLabel}: ${placementLabel}.dialogue must be an object.`);
    return;
  }
  if (!isFiniteNumber(dialogue.timerSeconds)) {
    errors.push(`${fileLabel}: ${placementLabel}.dialogue.timerSeconds must be a number.`);
  }
  if (!Array.isArray(dialogue.nodes) || !dialogue.nodes.length) {
    errors.push(`${fileLabel}: ${placementLabel}.dialogue.nodes must have at least one node.`);
    return;
  }
  const nodeIds = new Set();
  dialogue.nodes.forEach((node, nodeIndex) => {
    if (!isRecord(node)) {
      errors.push(`${fileLabel}: ${placementLabel}.dialogue.nodes[${nodeIndex}] must be an object.`);
      return;
    }
    const nodeId = safeString(node.id, "");
    const nodeLabel = `${placementLabel}.dialogue.nodes.${nodeId || nodeIndex}`;
    if (!nodeId) {
      errors.push(`${fileLabel}: ${nodeLabel}.id is required.`);
    }
    if (nodeIds.has(nodeId)) {
      errors.push(`${fileLabel}: duplicate dialogue node id ${nodeId}.`);
    }
    nodeIds.add(nodeId);
    if (!safeString(node.line, "")) {
      errors.push(`${fileLabel}: ${nodeLabel}.line is required.`);
    }
    const choiceIds = new Set();
    const choices = Array.isArray(node.choices) ? node.choices : [];
    if (choices.length > 3) {
      errors.push(`${fileLabel}: ${nodeLabel}.choices may show at most 3 choices; use timeoutChoice for silence.`);
    }
    choices.forEach((choice, choiceIndex) => {
      const choiceId = validateChoice(fileLabel, nodeLabel, choice, choiceIndex);
      if (choiceId) {
        if (choiceIds.has(choiceId)) {
          errors.push(`${fileLabel}: duplicate choice id ${choiceId} in ${nodeLabel}.`);
        }
        choiceIds.add(choiceId);
      }
    });
    if (node.timeoutChoice) {
      validateChoice(fileLabel, `${nodeLabel}.timeoutChoice`, node.timeoutChoice, 0);
    } else if (node.timeoutChoiceId && !choiceIds.has(node.timeoutChoiceId)) {
      errors.push(`${fileLabel}: ${nodeLabel}.timeoutChoiceId does not match a visible choice and no timeoutChoice is provided.`);
    }
  });
  if (dialogue.startNodeId && !nodeIds.has(dialogue.startNodeId)) {
    errors.push(`${fileLabel}: ${placementLabel}.dialogue.startNodeId not found.`);
  }
  dialogue.nodes.forEach((node) => {
    [...(node.choices || []), node.timeoutChoice].filter(Boolean).forEach((choice) => {
      if (choice.nextNodeId && !nodeIds.has(choice.nextNodeId)) {
        errors.push(`${fileLabel}: ${placementLabel}.${node.id}.${choice.id}.nextNodeId not found.`);
      }
    });
  });
}

function validateNpcDocument(fileLabel, document, levelRefs) {
  if (!isRecord(document)) {
    errors.push(`${fileLabel}: root must be an object.`);
    return;
  }
  const profile = document.profile;
  if (!isRecord(profile)) {
    errors.push(`${fileLabel}: profile is required.`);
    return;
  }
  const npcId = safeString(profile.id, "");
  if (!npcId) {
    errors.push(`${fileLabel}: profile.id is required.`);
  }
  if (!safeString(profile.name, "")) {
    errors.push(`${fileLabel}: profile.name is required.`);
  }
  if (!Array.isArray(document.placements) || !document.placements.length) {
    errors.push(`${fileLabel}: placements must have at least one placement.`);
    return;
  }
  const placementIds = new Set();
  document.placements.forEach((placement, index) => {
    if (!isRecord(placement)) {
      errors.push(`${fileLabel}: placements[${index}] must be an object.`);
      return;
    }
    const id = safeString(placement.id, "");
    const label = `placements.${id || index}`;
    if (!id) {
      errors.push(`${fileLabel}: ${label}.id is required.`);
    }
    if (placementIds.has(id)) {
      errors.push(`${fileLabel}: duplicate placement id ${id}.`);
    }
    placementIds.add(id);
    const levelId = safeString(placement.levelId, "");
    if (!levelId) {
      errors.push(`${fileLabel}: ${label}.levelId is required.`);
    } else if (!levelRefs.has(levelId)) {
      warnings.push(`${fileLabel}: ${label}.levelId ${levelId} not found in known level files.`);
    }
    ["x", "y", "width", "height"].forEach((field) => {
      if (!isFiniteNumber(placement[field])) {
        errors.push(`${fileLabel}: ${label}.${field} must be a number.`);
      }
    });
    if (placement.interceptRouteExitId && levelRefs.has(levelId)) {
      const routeIds = levelRefs.get(levelId).routes;
      if (!routeIds.has(placement.interceptRouteExitId)) {
        errors.push(`${fileLabel}: ${label}.interceptRouteExitId not found on ${levelId}.`);
      }
    }
    validateStoryFlags(fileLabel, `${label}.showWhen.requiredStoryFlags`, placement.showWhen?.requiredStoryFlags);
    validateStoryFlags(fileLabel, `${label}.showWhen.missingStoryFlags`, placement.showWhen?.missingStoryFlags);
    validateDialogue(fileLabel, label, placement.dialogue);
  });
}

if (!(await exists(manifestPath))) {
  errors.push("npcs/manifest.json: missing.");
} else {
  const levelRefs = await collectLevelRefs();
  const manifest = await readJson(manifestPath);
  const entries = [
    ...(Array.isArray(manifest?.drafts) ? manifest.drafts : []),
    ...(Array.isArray(manifest?.accepted) ? manifest.accepted : []),
    ...(Array.isArray(manifest?.npcs) ? manifest.npcs : []),
  ];
  if (!entries.length) {
    warnings.push("npcs/manifest.json: no NPC files listed.");
  }
  for (const entry of entries) {
    const relative = typeof entry === "string" ? entry : entry?.path;
    if (!safeString(relative, "")) {
      errors.push("npcs/manifest.json: entry path must be a string.");
      continue;
    }
    const filePath = path.join(npcsRoot, relative);
    const document = await readJson(filePath);
    validateNpcDocument(`npcs/${toPosix(relative)}`, document, levelRefs);
  }
}

warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

if (errors.length) {
  errors.forEach((error) => console.error(`Error: ${error}`));
  process.exit(1);
}

console.log("NPC validation passed.");
