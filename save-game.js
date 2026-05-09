import { SCENES, createRunState, saveMetaState } from "./state.js";
import { getRunStartLevelId, loadRuntimeLevelData } from "./level-store.js?v=20260505-level-source-v2";

const SAVE_SLOT_KEY = "rulebound-local-profile-v1";
const SAVE_VERSION = 1;
const AUTO_SAVE_INTERVAL = 1.4;

const LEVEL_STATE_KEYS = [
  "interactables",
  "lootCrates",
  "encounters",
  "threats",
  "hostileDrones",
  "humanoidEnemies",
  "temporaryBlocks",
];

const RUN_SCALAR_KEYS = [
  "hp",
  "sanity",
  "battery",
  "materials",
  "lootWeight",
  "lootCapacity",
  "focus",
  "focusMax",
  "focusDepleted",
  "focusActive",
  "time",
  "timePhase",
  "nightActive",
  "currentLevelId",
  "message",
  "noticeTimer",
  "cameraX",
  "cameraY",
  "cameraZoom",
  "cameraFocusX",
  "cameraFocusY",
  "cameraLookDirection",
  "cameraTargetX",
  "cameraTargetY",
  "cameraTargetZoom",
  "cameraLookAhead",
  "cameraSpeedRatio",
  "cameraFallHoldTimer",
  "cameraFallRatio",
  "cameraFallTargetYOffset",
];

function clonePlain(value, fallback = null) {
  if (value === undefined) {
    return fallback;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function readJson(key) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function captureLevelRuntimeState(run) {
  return Object.fromEntries(
    LEVEL_STATE_KEYS.map((key) => [key, clonePlain(run[key], [])]),
  );
}

function normalizePlayerForSave(player) {
  const snapshot = clonePlain(player, {});
  snapshot.attackHits = Array.from(player?.attackHits || []);
  return snapshot;
}

function restorePlayerSnapshot(target, snapshot = {}) {
  Object.assign(target, clonePlain(snapshot, {}));
  target.attackHits = new Set(Array.isArray(snapshot.attackHits) ? snapshot.attackHits : []);
}

function normalizeMapOverlayForSave(mapOverlay = {}) {
  return {
    active: false,
    zoom: Number.isFinite(mapOverlay.zoom) ? mapOverlay.zoom : 1,
    panX: Number.isFinite(mapOverlay.panX) ? mapOverlay.panX : 0,
    panY: Number.isFinite(mapOverlay.panY) ? mapOverlay.panY : 0,
    dragging: false,
    dragPointerId: null,
    dragStartX: 0,
    dragStartY: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
  };
}

function clearTransientRunState(run) {
  run.enemyShots = [];
  run.attackFx = [];
  run.recoilFx = [];
  run.weaponMissiles = [];
  run.weaponBarriers = [];
  run.particles = [];
  run.afterimages = [];
  run.recoilFocusAfterimages = [];
  run.recoilFocusAfterimageTimer = 0;
  run.recoilFocusAfterimageSerial = 0;
  run.prompt = "";
  run.promptWorld = null;
  run.loot = {
    active: false,
    crateId: null,
    selectedIndex: 0,
    holdItemId: null,
    holdProgress: 0,
    rareSignalTimer: 0,
    lastRarity: null,
  };
  if (run.faceOff) {
    run.faceOff.active = false;
    run.faceOff.targetId = null;
    run.faceOff.acquireTargetId = null;
    run.faceOff.acquireTimer = 0;
    run.faceOff.acquireProgress = 0;
    run.faceOff.result = null;
    run.faceOff.resultTimer = 0;
    run.faceOff.message = "";
  }
  if (run.recoilAim) {
    run.recoilAim.active = false;
    run.recoilAim.aiming = false;
  }
  if (run.player) {
    run.player.attackWindow = 0;
    run.player.attackHits = new Set();
    run.player.lightActive = false;
    run.player.recoilFocusActive = false;
    run.player.recoilFocusBlend = 0;
  }
}

function captureRunForSave(run) {
  const currentLevelId = run.currentLevelId || "movement-lab-01";
  const levelStates = clonePlain(run.levelStates || {}, {});
  levelStates[currentLevelId] = captureLevelRuntimeState(run);

  const snapshot = {
    player: normalizePlayerForSave(run.player),
    levelStates,
    map: clonePlain(run.map || {}, {}),
    mapOverlay: normalizeMapOverlayForSave(run.mapOverlay),
    weapons: clonePlain(run.weapons || {}, {}),
    lootInventory: clonePlain(run.lootInventory || [], []),
    inventory: clonePlain(run.inventory || {}, {}),
    clueLog: clonePlain(run.clueLog || [], []),
    clueSeen: clonePlain(run.clueSeen || [], []),
    pendingUnlocks: clonePlain(run.pendingUnlocks || [], []),
    pendingStoryFlags: clonePlain(run.pendingStoryFlags || [], []),
    successfulReleaseIds: clonePlain(run.successfulReleaseIds || [], []),
    successfulHarvestIds: clonePlain(run.successfulHarvestIds || [], []),
    metaSnapshot: clonePlain(run.metaSnapshot || {}, {}),
  };

  RUN_SCALAR_KEYS.forEach((key) => {
    snapshot[key] = clonePlain(run[key], run[key]);
  });
  return snapshot;
}

function applyLevelRuntimeState(run, levelState = null) {
  if (!levelState) {
    return;
  }
  LEVEL_STATE_KEYS.forEach((key) => {
    if (levelState[key]) {
      run[key] = clonePlain(levelState[key], run[key]);
    }
  });
}

function applyRunSnapshot(run, snapshot) {
  RUN_SCALAR_KEYS.forEach((key) => {
    if (snapshot[key] !== undefined) {
      run[key] = clonePlain(snapshot[key], snapshot[key]);
    }
  });

  restorePlayerSnapshot(run.player, snapshot.player);
  run.levelStates = clonePlain(snapshot.levelStates || {}, {});
  run.map = clonePlain(snapshot.map || run.map || {}, run.map || {});
  run.mapOverlay = normalizeMapOverlayForSave(snapshot.mapOverlay || {});
  run.weapons = clonePlain(snapshot.weapons || run.weapons || {}, run.weapons || {});
  run.lootInventory = clonePlain(snapshot.lootInventory || [], []);
  run.inventory = clonePlain(snapshot.inventory || {}, {});
  run.clueLog = clonePlain(snapshot.clueLog || [], []);
  run.clueSeen = clonePlain(snapshot.clueSeen || [], []);
  run.pendingUnlocks = clonePlain(snapshot.pendingUnlocks || [], []);
  run.pendingStoryFlags = clonePlain(snapshot.pendingStoryFlags || [], []);
  run.successfulReleaseIds = clonePlain(snapshot.successfulReleaseIds || [], []);
  run.successfulHarvestIds = clonePlain(snapshot.successfulHarvestIds || [], []);
  run.metaSnapshot = clonePlain(snapshot.metaSnapshot || run.metaSnapshot || {}, {});

  applyLevelRuntimeState(run, run.levelStates?.[run.currentLevelId]);
  clearTransientRunState(run);
  run.autoSaveTimer = AUTO_SAVE_INTERVAL;
}

export function shouldStartFromUrlLevel() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("directLevel") === "1" || params.get("mode") === "level-test";
  } catch {
    return false;
  }
}

export function readSavedGame() {
  const payload = readJson(SAVE_SLOT_KEY);
  if (!payload || payload.version !== SAVE_VERSION || !payload.run || !payload.run.currentLevelId) {
    return null;
  }
  return payload;
}

export function hasSavedGame() {
  return Boolean(readSavedGame());
}

export function clearSavedGame() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SAVE_SLOT_KEY);
  }
}

export function saveCurrentGame(state, data) {
  if (state.scene !== SCENES.EXPEDITION || !state.run) {
    return false;
  }
  const payload = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    currentLevelId: state.run.currentLevelId || data.currentLevelId || data.defaultLevelId,
    meta: clonePlain(state.meta || {}, {}),
    run: captureRunForSave(state.run),
  };
  const saved = writeJson(SAVE_SLOT_KEY, payload);
  if (saved) {
    state.save = state.save || {};
    state.save.hasRun = true;
    state.save.lastSavedAt = payload.savedAt;
  }
  return saved;
}

export function restoreSavedGame(state, data) {
  const payload = readSavedGame();
  if (!payload) {
    return false;
  }

  const levelId = payload.run.currentLevelId || payload.currentLevelId || data.defaultLevelId || "movement-lab-01";
  loadRuntimeLevelData(data, levelId);

  state.meta = {
    ...state.meta,
    ...clonePlain(payload.meta || {}, {}),
  };
  saveMetaState(state.meta);

  const run = createRunState(data, state.meta);
  applyRunSnapshot(run, payload.run);
  state.run = run;
  state.scene = SCENES.EXPEDITION;
  state.sceneTimer = 0;
  state.resultSummary = null;
  state.liveEdit.active = false;
  state.liveEdit.hoverPlatformIndex = null;
  state.liveEdit.selectedPlatformIndex = null;
  state.liveEdit.drag = null;
  state.save = state.save || {};
  state.save.hasRun = true;
  state.save.lastSavedAt = payload.savedAt || null;
  state.statusText = "저장된 런 이어하기";
  return true;
}

export function startNewSavedRun(state, data, options = {}) {
  const shouldPersist = options.persist !== false;
  if (options.clearSaved !== false) {
    clearSavedGame();
  }
  const baseData = data.__baseData || data;
  const startLevelId = shouldStartFromUrlLevel()
    ? data.currentLevelId || getRunStartLevelId(baseData)
    : getRunStartLevelId(baseData);
  loadRuntimeLevelData(data, startLevelId);
  state.run = createRunState(data, state.meta);
  state.scene = SCENES.EXPEDITION;
  state.sceneTimer = 0;
  state.resultSummary = null;
  state.liveEdit.active = false;
  state.liveEdit.hoverPlatformIndex = null;
  state.liveEdit.selectedPlatformIndex = null;
  state.liveEdit.drag = null;
  state.save = state.save || {};
  state.save.hasRun = hasSavedGame();
  if (shouldPersist) {
    saveCurrentGame(state, data);
  }
  return true;
}

export function updateAutoSave(state, data, dt) {
  if (state.scene !== SCENES.EXPEDITION || !state.run) {
    return;
  }
  state.run.autoSaveTimer = Number.isFinite(state.run.autoSaveTimer)
    ? state.run.autoSaveTimer - dt
    : AUTO_SAVE_INTERVAL;
  if (state.run.autoSaveTimer <= 0) {
    saveCurrentGame(state, data);
    state.run.autoSaveTimer = AUTO_SAVE_INTERVAL;
  }
}
