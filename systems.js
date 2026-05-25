import {
  MOVEMENT_STATES,
  SCENES,
  SHELTER_UPGRADES,
  computeArmWeaponStats,
  createLevelRuntimeState,
  createRunState,
  ensureWeaponLoadoutState,
  ensurePartInventory,
  getShelterUpgradeCost,
  getShelterUpgradeLevel,
  hasUnlocked,
  normalizeMetaUpgrades,
  saveMetaState,
} from "./state.js?v=20260525-route-touch-v3";
import { getLevelIds, loadRuntimeLevelData } from "./level-store.js?v=20260525-route-touch-v3";
import {
  clearSavedGame,
  hasSavedGame,
  restoreSavedGame,
  saveCurrentGame,
  shouldStartFromUrlLevel,
  startNewSavedRun,
  updateAutoSave,
} from "./save-game.js?v=20260525-route-touch-v3";
import {
  approach,
  clamp,
  createRect,
  deepClone,
  distanceBetween,
  getCenter,
  lerp,
  rectsOverlap,
  uniquePush,
} from "./utils.js";

const EPSILON = 0.01;
const CAMERA_SCREEN_WIDTH = 1280;
const CAMERA_SCREEN_HEIGHT = 720;
const CAMERA_FOCUS_X = 420 / CAMERA_SCREEN_WIDTH;
const CAMERA_FOCUS_Y = 360 / CAMERA_SCREEN_HEIGHT;
const MOVE_LEFT_KEYS = ["ArrowLeft", "KeyA"];
const MOVE_RIGHT_KEYS = ["ArrowRight", "KeyD"];
const CROUCH_KEYS = ["ArrowDown", "KeyS"];
const JUMP_KEYS = ["Space", "KeyW"];
const ZIPLINE_MOUNT_KEYS = ["Space"];
const DASH_KEYS = ["CapsLock", "ShiftLeft", "ShiftRight", "KeyX"];
const SPRINT_KEYS = ["CapsLock"];
const BULLET_TIME_KEYS = [];
const AIM_CAMERA_EDGE_MARGIN = 112;
const FOCUS_MAX = 100;
const FOCUS_DRAIN_PER_SECOND = 36;
const FOCUS_RECOVER_PER_SECOND = 22;
const FOCUS_MIN_TO_START = 8;
const FOCUS_REENTRY_RATIO = 0.5;
const FOCUS_TIME_SCALE = 0.22;
const INTERACT_KEYS = ["KeyZ", "KeyF"];
const ATTACK_KEYS = ["KeyV"];
const CONFIRM_KEYS = ["KeyC", "Enter"];
const INVENTORY_KEYS = ["Tab"];
const NEW_RUN_KEYS = ["KeyN"];
const TITLE_MENU_ITEMS = ["new", "continue"];
const TITLE_MENU_UP_KEYS = ["ArrowUp", "KeyW"];
const TITLE_MENU_DOWN_KEYS = ["ArrowDown", "KeyS"];
const TITLE_MENU_CANCEL_KEYS = ["Escape"];
const LOOT_PREV_KEYS = ["ArrowUp", "KeyW"];
const LOOT_NEXT_KEYS = ["ArrowDown", "KeyS"];
const LOOT_LEFT_KEYS = ["ArrowLeft", "KeyA"];
const LOOT_RIGHT_KEYS = ["ArrowRight", "KeyD"];
const LOOT_CLOSE_KEYS = ["Escape", "KeyQ"];
const DEBUG_KEYS = ["F3", "Backquote"];
const DEBUG_SET_NIGHT_KEYS = ["Digit8"];
const NIGHT_TRANSITION_SECONDS = 1.4;
const RESTART_KEYS = ["F5"];
const ARM_LEFT_KEYS = ["Digit1"];
const ARM_RIGHT_KEYS = ["Digit2"];
const ARM_MELEE_KEYS = ["Digit3"];
const ARM_SWITCH_KEYS = ["MouseMiddle"];
const ARM_WHEEL_PREV_KEYS = ["MouseWheelUp"];
const ARM_WHEEL_NEXT_KEYS = ["MouseWheelDown"];
const RELOAD_KEYS = ["KeyR"];
const MAP_KEYS = ["KeyM"];
const MAP_CLOSE_KEYS = ["Escape", "KeyM"];
const INVENTORY_CATEGORY_KEYS = ["all", "weapon", "ammo", "healing", "material", "misc"];
const INVENTORY_GRID_COLUMNS = 5;
const INVENTORY_GRID_ROWS = 4;
const INVENTORY_PANEL_X = 18;
const INVENTORY_PANEL_Y = 28;
const INVENTORY_RIGHT_X = INVENTORY_PANEL_X + 794;
const INVENTORY_RIGHT_Y = INVENTORY_PANEL_Y + 58;
const INVENTORY_RIGHT_W = 434;
const INVENTORY_GRID_GAP = 4;
const INVENTORY_GRID_CELL = Math.floor((INVENTORY_RIGHT_W - 34 - INVENTORY_GRID_GAP * (INVENTORY_GRID_COLUMNS - 1)) / INVENTORY_GRID_COLUMNS);
const INVENTORY_GRID_X = INVENTORY_RIGHT_X + 17;
const INVENTORY_GRID_Y = INVENTORY_RIGHT_Y + 68;
const INVENTORY_TAB_X = INVENTORY_RIGHT_X + 17;
const INVENTORY_TAB_Y = INVENTORY_RIGHT_Y + 14;
const INVENTORY_TAB_W = (INVENTORY_RIGHT_W - 34) / INVENTORY_CATEGORY_KEYS.length;
const MAP_EXPLORE_CELL_SIZE = 320;
const MAP_EXPLORE_RADIUS_CELLS = 1;
const SHELTER_MENU_ITEMS = ["photo", "records", "background", "rest", "exit"];
const SHELTER_HUB_MENU_ITEMS = ["upgrade", "exit"];
const SHELTER_ARRIVAL_SECONDS = 2.4;
const SHELTER_EXIT_COOLDOWN_SECONDS = 1.2;
const SHELTER_NIGHT_LOCK_MESSAGE = "밤에만 피난처로 이동 가능.";
const SHELTER_COOLDOWN_MESSAGE = "피난처 문이 닫히는 중.";
const SHELTER_MENU_UP_KEYS = ["ArrowUp", "KeyW"];
const SHELTER_MENU_DOWN_KEYS = ["ArrowDown", "KeyS"];
const SHELTER_VIEW_LEFT_KEYS = ["ArrowLeft", "KeyA"];
const SHELTER_VIEW_RIGHT_KEYS = ["ArrowRight", "KeyD"];
const SHELTER_EXIT_KEYS = ["KeyC"];
const SHELTER_BACK_KEYS = ["Escape"];
const CG_PHOTO_LIMIT = 12;
const FACE_OFF_ENTRY_KEYS = ["KeyZ"];
const FACE_OFF_DIALOGUE_KEYS = ["KeyW", "KeyA", "KeyD", "KeyS"];
const FACE_OFF_MENU_UP_KEYS = ["KeyW", "ArrowUp"];
const FACE_OFF_MENU_DOWN_KEYS = ["KeyS", "ArrowDown"];
const FACE_OFF_MENU_CONFIRM_KEYS = ["Space", "Enter"];
const FACE_OFF_CANCEL_KEYS = ["Escape"];
const FACE_OFF_RESULT_EXIT_BUTTON = {
  x: CAMERA_SCREEN_WIDTH / 2 - 180,
  y: 586,
  width: 360,
  height: 58,
};
const FACE_OFF_RELEASE_KEY = "KeyQ";
const HUMANOID_RESOLVED_STATES = new Set(["disabled", "surrendered", "dealt", "released", "escaped", "dead"]);
const HUMANOID_RESOLVED_OUTCOMES = new Set(["kill", "disable", "surrender", "deal", "release", "escape"]);
const LOW_PERFORMANCE_MODE = typeof window !== "undefined"
  && (
    window.__SILENT_PASSAGE_PERF === "lite" ||
    new URLSearchParams(window.location.search).get("perf") === "lite"
  );
const shelterCgImageCache = new Map();
const RECOIL_FOCUS_AFTERIMAGE_INTERVAL = LOW_PERFORMANCE_MODE ? 0.14 : 0.08;
const RECOIL_FOCUS_AFTERIMAGE_LIFE = 1;
const RECOIL_FOCUS_AFTERIMAGE_MAX = LOW_PERFORMANCE_MODE ? 6 : 12;
const LOOT_RARITY_RANKS = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  relic: 4,
};

function isMovementLab(data) {
  return data.world.mode === "movementLab";
}

function isEntityDisabled(entity) {
  return !entity || entity.disabled || entity.state === "disabled" || entity.dead;
}

function isPressed(state, code) {
  return state.pressed.has(code);
}

function isEitherPressed(state, codes) {
  return codes.some((code) => isPressed(state, code));
}

function consumePress(state, code) {
  if (state.justPressed.has(code)) {
    state.justPressed.delete(code);
    return true;
  }
  return false;
}

function consumeEitherPress(state, codes) {
  return codes.some((code) => consumePress(state, code));
}

function setStatus(state, message) {
  state.statusText = message;
}

function pushInputTrace(state, label, details = {}) {
  const debug = state.debug || (state.debug = {});
  const trace = Array.isArray(debug.inputTrace) ? debug.inputTrace : [];
  const frame = Number.isFinite(state.debugFrame) ? state.debugFrame : 0;
  const fields = Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  trace.push(`#${frame} ${label}${fields ? ` ${fields}` : ""}`);
  debug.inputTrace = trace.slice(-500);
  if (typeof window !== "undefined") {
    window.__inputTraceText = debug.inputTrace.join("\n");
  }
}

function getRunCurrentLevelId(run, data) {
  return run?.currentLevelId || data.currentLevelId || data.defaultLevelId || "movement-lab-01";
}

function ensureRunMapState(run, data) {
  const currentLevelId = getRunCurrentLevelId(run, data);
  run.map = run.map || {};
  run.map.visitedLevelIds = Array.isArray(run.map.visitedLevelIds) ? run.map.visitedLevelIds : [];
  run.map.discoveredLevelIds = Array.isArray(run.map.discoveredLevelIds) ? run.map.discoveredLevelIds : [];
  run.map.discoveredRouteIds = Array.isArray(run.map.discoveredRouteIds) ? run.map.discoveredRouteIds : [];
  run.map.exploredCellsByLevel = run.map.exploredCellsByLevel && typeof run.map.exploredCellsByLevel === "object"
    ? run.map.exploredCellsByLevel
    : {};
  run.map.exploredCellsByLevel[currentLevelId] = Array.isArray(run.map.exploredCellsByLevel[currentLevelId])
    ? run.map.exploredCellsByLevel[currentLevelId]
    : [];
  uniquePush(run.map.visitedLevelIds, currentLevelId);
  uniquePush(run.map.discoveredLevelIds, currentLevelId);
  run.mapOverlay = run.mapOverlay || {};
  run.mapOverlay.active = Boolean(run.mapOverlay.active);
  run.mapOverlay.zoom = clamp(Number(run.mapOverlay.zoom ?? 1), 0.55, 3.25);
  run.mapOverlay.panX = Number.isFinite(run.mapOverlay.panX) ? run.mapOverlay.panX : 0;
  run.mapOverlay.panY = Number.isFinite(run.mapOverlay.panY) ? run.mapOverlay.panY : 0;
  run.mapOverlay.dragging = Boolean(run.mapOverlay.dragging);
  run.mapOverlay.dragPointerId = Number.isFinite(run.mapOverlay.dragPointerId) ? run.mapOverlay.dragPointerId : null;
  run.mapOverlay.dragStartX = Number.isFinite(run.mapOverlay.dragStartX) ? run.mapOverlay.dragStartX : 0;
  run.mapOverlay.dragStartY = Number.isFinite(run.mapOverlay.dragStartY) ? run.mapOverlay.dragStartY : 0;
  run.mapOverlay.dragStartPanX = Number.isFinite(run.mapOverlay.dragStartPanX) ? run.mapOverlay.dragStartPanX : 0;
  run.mapOverlay.dragStartPanY = Number.isFinite(run.mapOverlay.dragStartPanY) ? run.mapOverlay.dragStartPanY : 0;
  return run.map;
}

function revealMapCell(map, levelId, cellX, cellY) {
  const cells = map.exploredCellsByLevel[levelId];
  uniquePush(cells, `${cellX},${cellY}`);
}

function revealMapArea(run, data, worldX, worldY, radiusCells = MAP_EXPLORE_RADIUS_CELLS) {
  if (!run || !Number.isFinite(worldX) || !Number.isFinite(worldY)) {
    return;
  }
  const levelId = getRunCurrentLevelId(run, data);
  const map = ensureRunMapState(run, data);
  const cellX = Math.floor(worldX / MAP_EXPLORE_CELL_SIZE);
  const cellY = Math.floor(worldY / MAP_EXPLORE_CELL_SIZE);
  for (let y = cellY - radiusCells; y <= cellY + radiusCells; y += 1) {
    for (let x = cellX - radiusCells; x <= cellX + radiusCells; x += 1) {
      revealMapCell(map, levelId, x, y);
    }
  }
}

function updateMapExploration(run, data) {
  if (!run?.player) {
    return;
  }
  const playerCenter = getCenter(run.player);
  revealMapArea(run, data, playerCenter.x, playerCenter.y);
}

function getRouteDiscoveryId(levelId, routeExit) {
  return `${levelId}:${routeExit?.id || "route-exit"}`;
}

function discoverLevel(run, data, levelId) {
  if (!run || !levelId) {
    return;
  }
  const map = ensureRunMapState(run, data);
  uniquePush(map.discoveredLevelIds, levelId);
}

function visitLevel(run, data, levelId) {
  if (!run || !levelId) {
    return;
  }
  const map = ensureRunMapState(run, data);
  map.exploredCellsByLevel[levelId] = Array.isArray(map.exploredCellsByLevel[levelId])
    ? map.exploredCellsByLevel[levelId]
    : [];
  uniquePush(map.discoveredLevelIds, levelId);
  uniquePush(map.visitedLevelIds, levelId);
}

function discoverRouteExit(run, data, routeExit) {
  if (!run || !routeExit?.toLevelId) {
    return;
  }
  const currentLevelId = getRunCurrentLevelId(run, data);
  const map = ensureRunMapState(run, data);
  uniquePush(map.discoveredRouteIds, getRouteDiscoveryId(currentLevelId, routeExit));
  revealMapArea(run, data, routeExit.x + routeExit.width * 0.5, routeExit.y + routeExit.height * 0.5, 1);
}

function clearTransientMapInput(state) {
  state.justPressed.clear();
  if (state.mouse) {
    state.mouse.primaryJustPressed = false;
    state.mouse.secondaryJustPressed = false;
  }
}

function isMapOverlayBlocked(state, run) {
  return state.scene !== SCENES.EXPEDITION
    || state.liveEdit?.active
    || run?.faceOff?.active
    || run?.loot?.active
    || run?.inventoryOverlay?.active;
}

function isInventoryOverlayBlocked(state, run) {
  return state.scene !== SCENES.EXPEDITION
    || state.liveEdit?.active
    || run?.faceOff?.active
    || run?.loot?.active
    || run?.mapOverlay?.active;
}

function getInventoryOverlayState(run) {
  const overlay = run.inventoryOverlay || (run.inventoryOverlay = {});
  overlay.active = Boolean(overlay.active);
  overlay.category = INVENTORY_CATEGORY_KEYS.includes(overlay.category) ? overlay.category : "all";
  overlay.selectedIndex = Math.max(0, Math.floor(Number(overlay.selectedIndex ?? 0)));
  return overlay;
}

function countInventoryOverlayItems(run, data) {
  const overlay = getInventoryOverlayState(run);
  const weapons = ensureWeaponLoadoutState(run, data);
  const selectedArm = weapons.arms?.[weapons.selectedSide] || weapons.arms?.right || {};
  const stats = computeArmWeaponStats(data, selectedArm);
  const reserve = Math.max(0, Math.floor(weapons.reserveAmmo?.[stats.ammoType] ?? 0));
  const materials = Math.max(0, Math.round(run.materials ?? 0));
  const lootItems = Array.isArray(run.lootInventory) ? run.lootInventory : [];
  const inventoryItems = Array.isArray(run.inventory?.items) ? run.inventory.items : [];
  const base = [
    { category: "weapon", label: stats.equipped ? stats.label : "M-9 PISTOL" },
    { category: "ammo", label: "9MM", count: reserve },
    { category: "healing", label: "MED", count: 3 },
    { category: "misc", label: "CELL", count: 2 },
    { category: "material", label: "PARTS", count: Math.max(1, materials || 12) },
    { category: "healing", label: "VIAL", count: 2 },
    { category: "healing", label: "INJ", count: 1 },
    { category: "material", label: "MOD", count: 1 },
    { category: "misc", label: "TAPE", count: 4 },
    { category: "misc", label: "DOC", count: 9 },
    ...inventoryItems,
    ...lootItems,
  ];
  const seen = new Set();
  const filtered = base.filter((item, index) => {
    if (!item) {
      return false;
    }
    const category = item.category || (item.slot ? "material" : "misc");
    if (overlay.category !== "all" && category !== overlay.category) {
      return false;
    }
    const key = `${category}:${item.id || item.name || item.label || index}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return Math.min(filtered.length, INVENTORY_GRID_COLUMNS * INVENTORY_GRID_ROWS);
}

function clampInventoryOverlaySelection(run, data) {
  const overlay = getInventoryOverlayState(run);
  const count = countInventoryOverlayItems(run, data);
  overlay.selectedIndex = clamp(overlay.selectedIndex, 0, Math.max(0, count - 1));
  return count;
}

function moveInventoryOverlaySelection(run, data, dx, dy) {
  const overlay = getInventoryOverlayState(run);
  const count = clampInventoryOverlaySelection(run, data);
  if (count <= 0) {
    overlay.selectedIndex = 0;
    return;
  }
  const current = clamp(overlay.selectedIndex, 0, count - 1);
  const column = current % INVENTORY_GRID_COLUMNS;
  const row = Math.floor(current / INVENTORY_GRID_COLUMNS);
  const nextColumn = clamp(column + dx, 0, INVENTORY_GRID_COLUMNS - 1);
  const nextRow = clamp(row + dy, 0, INVENTORY_GRID_ROWS - 1);
  overlay.selectedIndex = clamp(nextRow * INVENTORY_GRID_COLUMNS + nextColumn, 0, count - 1);
}

function hitInventoryOverlayCategory(mx, my) {
  if (my < INVENTORY_TAB_Y - 8 || my > INVENTORY_TAB_Y + 34) {
    return null;
  }
  const index = Math.floor((mx - INVENTORY_TAB_X) / INVENTORY_TAB_W);
  return INVENTORY_CATEGORY_KEYS[index] || null;
}

function hitInventoryOverlayGridIndex(mx, my) {
  for (let index = 0; index < INVENTORY_GRID_COLUMNS * INVENTORY_GRID_ROWS; index += 1) {
    const column = index % INVENTORY_GRID_COLUMNS;
    const row = Math.floor(index / INVENTORY_GRID_COLUMNS);
    const x = INVENTORY_GRID_X + column * (INVENTORY_GRID_CELL + INVENTORY_GRID_GAP);
    const y = INVENTORY_GRID_Y + row * (INVENTORY_GRID_CELL + INVENTORY_GRID_GAP);
    if (mx >= x && mx <= x + INVENTORY_GRID_CELL && my >= y && my <= y + INVENTORY_GRID_CELL) {
      return index;
    }
  }
  return -1;
}

function updateActiveInventoryOverlayInput(state, data, run) {
  const overlay = getInventoryOverlayState(run);
  let interacted = false;

  if (consumeEitherPress(state, ["ArrowLeft", "KeyA"])) {
    moveInventoryOverlaySelection(run, data, -1, 0);
    interacted = true;
  }
  if (consumeEitherPress(state, ["ArrowRight", "KeyD"])) {
    moveInventoryOverlaySelection(run, data, 1, 0);
    interacted = true;
  }
  if (consumeEitherPress(state, ["ArrowUp", "KeyW"])) {
    moveInventoryOverlaySelection(run, data, 0, -1);
    interacted = true;
  }
  if (consumeEitherPress(state, ["ArrowDown", "KeyS"])) {
    moveInventoryOverlaySelection(run, data, 0, 1);
    interacted = true;
  }

  for (let index = 0; index < INVENTORY_CATEGORY_KEYS.length; index += 1) {
    if (consumeEitherPress(state, [`Digit${index + 1}`])) {
      overlay.category = INVENTORY_CATEGORY_KEYS[index];
      overlay.selectedIndex = 0;
      interacted = true;
    }
  }

  if (state.mouse?.primaryJustPressed) {
    const mx = state.mouse.screenX ?? 0;
    const my = state.mouse.screenY ?? 0;
    const category = hitInventoryOverlayCategory(mx, my);
    if (category) {
      overlay.category = category;
      overlay.selectedIndex = 0;
      interacted = true;
    } else {
      const index = hitInventoryOverlayGridIndex(mx, my);
      if (index >= 0 && index < countInventoryOverlayItems(run, data)) {
        overlay.selectedIndex = index;
        interacted = true;
      }
    }
  }

  clampInventoryOverlaySelection(run, data);
  if (interacted) {
    setStatus(state, `Inventory: ${overlay.category.toUpperCase()} #${overlay.selectedIndex + 1}`);
  }
  return interacted;
}

function updateInventoryOverlayInput(state, data) {
  const run = state.run;
  if (!run?.inventoryOverlay) {
    return false;
  }
  const overlay = getInventoryOverlayState(run);

  if (isInventoryOverlayBlocked(state, run)) {
    if (overlay.active) {
      overlay.active = false;
    }
    return false;
  }

  if (overlay.active) {
    if (consumeEitherPress(state, [...INVENTORY_KEYS, ...LOOT_CLOSE_KEYS])) {
      overlay.active = false;
      clearTransientMapInput(state);
      setStatus(state, "Inventory closed");
      return true;
    }
    updateActiveInventoryOverlayInput(state, data, run);
    clearTransientMapInput(state);
    if (run.recoilAim) {
      run.recoilAim.active = false;
      run.recoilAim.aiming = false;
    }
    run.player.recoilFocusActive = false;
    setStatus(state, "Inventory");
    return true;
  }

  if (consumeEitherPress(state, INVENTORY_KEYS)) {
    overlay.active = true;
    clampInventoryOverlaySelection(run, data);
    clearTransientMapInput(state);
    if (run.recoilAim) {
      run.recoilAim.active = false;
      run.recoilAim.aiming = false;
    }
    run.player.recoilFocusActive = false;
    setStatus(state, "Inventory");
    return true;
  }

  return false;
}

function updateMapOverlayInput(state, data) {
  const run = state.run;
  if (!run) {
    return false;
  }
  ensureRunMapState(run, data);

  if (isMapOverlayBlocked(state, run)) {
    if (run.mapOverlay?.active) {
      run.mapOverlay.active = false;
      run.mapOverlay.dragging = false;
      run.mapOverlay.dragPointerId = null;
    }
    return false;
  }

  if (run.mapOverlay?.active) {
    if (consumeEitherPress(state, MAP_CLOSE_KEYS)) {
      run.mapOverlay.active = false;
      run.mapOverlay.dragging = false;
      run.mapOverlay.dragPointerId = null;
      clearTransientMapInput(state);
      setStatus(state, "Map closed");
      return true;
    }
    clearTransientMapInput(state);
    if (run.recoilAim) {
      run.recoilAim.active = false;
      run.recoilAim.aiming = false;
    }
    run.player.recoilFocusActive = false;
    setStatus(state, "Map");
    return true;
  }

  if (consumeEitherPress(state, MAP_KEYS)) {
    run.mapOverlay.active = true;
    run.mapOverlay.dragging = false;
    run.mapOverlay.dragPointerId = null;
    clearTransientMapInput(state);
    if (run.recoilAim) {
      run.recoilAim.active = false;
      run.recoilAim.aiming = false;
    }
    run.player.recoilFocusActive = false;
    setStatus(state, "Map");
    return true;
  }

  return false;
}

function pushNotice(run, message, duration = 3.4) {
  run.message = message;
  run.noticeTimer = duration;
}

function pushClue(run, key, message) {
  if (run.clueSeen.includes(key)) {
    return;
  }
  run.clueSeen.push(key);
  run.clueLog.unshift(message);
  run.clueLog = run.clueLog.slice(0, 6);
}

function spawnParticles(run, x, y, amount, color) {
  for (let index = 0; index < amount; index += 1) {
    run.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 200,
      vy: -Math.random() * 180 - 30,
      life: 0.5 + Math.random() * 0.45,
      color,
      radius: 3 + Math.random() * 3.5,
    });
  }
}

function spawnDirectedParticles(run, x, y, amount, color, directionX, directionY, speed = 360, spread = 0.42) {
  const baseAngle = Math.atan2(directionY, directionX);
  for (let index = 0; index < amount; index += 1) {
    const angle = baseAngle + (Math.random() - 0.5) * spread;
    const velocity = speed * (0.72 + Math.random() * 0.48);
    run.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.18 + Math.random() * 0.22,
      color,
      radius: 2.4 + Math.random() * 2.8,
    });
  }
}

function spawnDamageNumber(run, x, y, amount, color = "#f5f8fb", label = null, options = {}) {
  run.damageNumbers = run.damageNumbers || [];
  run.damageNumbers.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 24,
    vy: options.vy ?? (-72 - Math.random() * 28),
    amount: Math.round(amount),
    label,
    color,
    critical: Boolean(options.critical),
    scale: options.scale ?? 1,
    life: options.duration ?? 0.72,
    duration: options.duration ?? 0.72,
  });
}

function pushAfterimage(run, player) {
  run.afterimages.push({
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
    facing: player.facing,
    life: 0.18,
  });
}

function pushRecoilFocusAfterimage(run, player, options = {}) {
  if (!run.recoilFocusAfterimages) {
    run.recoilFocusAfterimages = [];
  }

  const life = options.life ?? RECOIL_FOCUS_AFTERIMAGE_LIFE;
  run.recoilFocusAfterimageSerial = (run.recoilFocusAfterimageSerial ?? 0) + 1;
  run.recoilFocusAfterimages.push({
    x: player.x + (options.offsetX ?? 0),
    y: player.y + (options.offsetY ?? 0),
    width: player.width,
    height: player.height,
    standHeight: player.standHeight,
    crouchHeight: player.crouchHeight,
    vx: player.vx,
    vy: player.vy,
    facing: player.facing,
    onGround: player.onGround,
    movementState: player.movementState,
    wallDirection: player.wallDirection,
    wallSliding: player.wallSliding,
    wallRunActive: player.wallRunActive,
    braceHolding: player.braceHolding,
    braceReleaseTimer: player.braceReleaseTimer,
    dashTimer: player.dashTimer,
    dashDirection: player.dashDirection,
    sprintActive: player.sprintActive,
    slideTimer: player.slideTimer,
    hoverActive: player.hoverActive,
    wallJumpLockTimer: player.wallJumpLockTimer,
    lightActive: player.lightActive,
    invulnTimer: 0,
    recoilShotActive: player.recoilShotActive,
    recoilSpinTimer: player.recoilSpinTimer,
    recoilSpinDuration: player.recoilSpinDuration,
    recoilSpinFacing: player.recoilSpinFacing,
    recoilFocusActive: player.recoilFocusActive,
    recoilFocusBlend: player.recoilFocusBlend,
    recoilAimFacing: player.recoilAimFacing,
    recoilAimPitch: player.recoilAimPitch,
    recoilAimX: player.recoilAimX,
    recoilAimY: player.recoilAimY,
    recoilDirX: player.recoilDirX,
    recoilDirY: player.recoilDirY,
    life,
    duration: life,
    time: run.time ?? 0,
    serial: run.recoilFocusAfterimageSerial,
  });
  if (run.recoilFocusAfterimages.length > RECOIL_FOCUS_AFTERIMAGE_MAX) {
    run.recoilFocusAfterimages = run.recoilFocusAfterimages.slice(-RECOIL_FOCUS_AFTERIMAGE_MAX);
  }
}

function updateRecoilFocusAfterimages(run, dt) {
  if (!run.recoilFocusAfterimages) {
    run.recoilFocusAfterimages = [];
  }

  run.recoilFocusAfterimages = run.recoilFocusAfterimages.filter((image) => {
    image.life -= dt;
    return image.life > 0;
  });

  const player = run.player;
  const focusBlend = player.recoilFocusBlend ?? 0;
  const focusVisible = Boolean(run.recoilAim?.active || focusBlend > 0.18 || player.recoilShotActive);
  if (!focusVisible) {
    run.recoilFocusAfterimageTimer = 0;
    return;
  }

  run.recoilFocusAfterimageTimer = (run.recoilFocusAfterimageTimer ?? 0) - dt;
  if (run.recoilFocusAfterimageTimer > 0) {
    return;
  }

  pushRecoilFocusAfterimage(run, player);
  run.recoilFocusAfterimageTimer += RECOIL_FOCUS_AFTERIMAGE_INTERVAL;
}

function updateTemporaryBlocks(run, dt) {
  (run.temporaryBlocks || []).forEach((block) => {
    block.hitFlash = Math.max(0, (block.hitFlash ?? 0) - dt);
    block.respawnFlash = Math.max(0, (block.respawnFlash ?? 0) - dt);
    if (block.destroyed) {
      block.hiddenTimer = 0;
      return;
    }
    if ((block.hiddenTimer ?? 0) <= 0) {
      return;
    }

    block.hiddenTimer = Math.max(0, block.hiddenTimer - dt);
    if (block.hiddenTimer > 0) {
      return;
    }

    if (run.player && rectsOverlap(run.player, block)) {
      block.hiddenTimer = 0.08;
      return;
    }

    block.respawnFlash = 0.22;
  });
}

function updateEffects(run, dt, visualDt = dt, data = null) {
  run.attackFx = run.attackFx.filter((effect) => {
    effect.life -= dt;
    return effect.life > 0;
  });

  run.recoilFx = run.recoilFx.filter((effect) => {
    effect.life -= dt;
    return effect.life > 0;
  });
  if (run.weaponKick) {
    run.weaponKick.timer = Math.max(0, (run.weaponKick.timer ?? 0) - visualDt);
    if (run.weaponKick.timer <= 0) {
      run.weaponKick = null;
    }
  }

  if (data) {
    updateTemporaryBlocks(run, dt);
    updateWeaponProjectiles(run, data, dt);
  }

  run.damageNumbers = (run.damageNumbers || []).filter((number) => {
    number.life -= visualDt;
    number.x += (number.vx ?? 0) * visualDt;
    number.y += (number.vy ?? 0) * visualDt;
    number.vy = (number.vy ?? 0) + 84 * visualDt;
    return number.life > 0;
  });

  run.dodgeSlowTimer = Math.max(0, (run.dodgeSlowTimer ?? 0) - visualDt);
  run.dodgeFx = (run.dodgeFx || []).filter((effect) => {
    effect.life -= visualDt;
    effect.y -= 42 * visualDt;
    return effect.life > 0;
  });

  run.afterimages = run.afterimages.filter((image) => {
    image.life -= dt;
    return image.life > 0;
  });

  updateRecoilFocusAfterimages(run, visualDt);

  run.particles = run.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 360 * dt;
    return particle.life > 0;
  });

  if (run.noticeTimer > 0) {
    run.noticeTimer = Math.max(0, run.noticeTimer - dt);
  }
  if (run.loot?.rareSignalTimer > 0) {
    run.loot.rareSignalTimer = Math.max(0, run.loot.rareSignalTimer - dt);
  }
  (run.lootCrates || []).forEach((crate) => {
    crate.hitFlash = Math.max(0, (crate.hitFlash ?? 0) - visualDt);
    if (crate.rareSignalTimer > 0) {
      crate.rareSignalTimer = Math.max(0, crate.rareSignalTimer - dt);
    }
  });
}

function getCameraConfig(data) {
  return data.world.camera || {};
}

function isBraceCameraState(player) {
  return Boolean(
    player.braceHolding ||
    player.braceReleaseTimer > 0 ||
    player.braceActive ||
    player.braceHoldActive
  );
}

function getWallRunCameraDirection(player) {
  const wallDirection = player.wallRunDirection || player.wallDirection || 0;
  return wallDirection === 0 ? 0 : -wallDirection;
}

function getRecoilCameraState(run, config) {
  const player = run.player;
  const aim = run.recoilAim;
  const focusActive = Boolean(aim?.active);
  const firedActive = player.recoilCameraTimer > 0;

  if (!focusActive && !firedActive) {
    return null;
  }

  const directionX = firedActive ? player.recoilCameraDirX : aim.recoilDirX;
  const directionY = firedActive ? player.recoilCameraDirY : aim.recoilDirY;
  const horizontalLookAhead = firedActive
    ? (config.recoilShotRecoilLookAhead ?? 0.18)
    : (config.recoilShotAimLookAhead ?? 0.1);
  const verticalLookAhead = firedActive
    ? (config.recoilShotRecoilUpLookAhead ?? 0.2)
    : (config.recoilShotAimUpLookAhead ?? 0.14);

  return {
    directionX,
    directionY,
    horizontalLookAhead,
    verticalLookAhead,
  };
}

function getAimEdgeAxis(position, size, margin = AIM_CAMERA_EDGE_MARGIN) {
  const safeSize = Math.max(1, size);
  const safeMargin = clamp(margin, 1, safeSize * 0.5);
  if (position <= safeMargin) {
    return -clamp((safeMargin - position) / safeMargin, 0, 1);
  }
  if (position >= safeSize - safeMargin) {
    return clamp((position - (safeSize - safeMargin)) / safeMargin, 0, 1);
  }
  return 0;
}

function getAimCameraEdgePan(mouse = {}) {
  return {
    x: getAimEdgeAxis(mouse.screenX ?? CAMERA_SCREEN_WIDTH / 2, CAMERA_SCREEN_WIDTH),
    y: getAimEdgeAxis(mouse.screenY ?? CAMERA_SCREEN_HEIGHT / 2, CAMERA_SCREEN_HEIGHT),
  };
}

function updateAimCameraPan(run, config, viewportWidth, viewportHeight, dt, freezeActionCamera = false) {
  const aim = run.recoilAim;
  const active = Boolean(!freezeActionCamera && (aim?.aiming || config.mousePanAlways));
  const maxX = viewportWidth * clamp(config.aimPanMaxX ?? 0.36, 0, 0.75);
  const maxY = viewportHeight * clamp(config.aimPanMaxY ?? 0.27, 0, 0.55);
  const targetX = active ? (aim.edgePanX ?? 0) * maxX : 0;
  const targetY = active ? (aim.edgePanY ?? 0) * maxY : 0;
  const lerpRate = active ? (config.aimPanLerp ?? 8.25) : (config.aimPanReturnLerp ?? 7.5);
  const blend = Math.min(1, dt * lerpRate);
  run.aimCameraPanX = lerp(run.aimCameraPanX ?? 0, targetX, blend);
  run.aimCameraPanY = lerp(run.aimCameraPanY ?? 0, targetY, blend);
  if (Math.abs(run.aimCameraPanX) < 0.5) {
    run.aimCameraPanX = 0;
  }
  if (Math.abs(run.aimCameraPanY) < 0.5) {
    run.aimCameraPanY = 0;
  }
  return {
    x: run.aimCameraPanX,
    y: run.aimCameraPanY,
  };
}

function getCameraLookDirection(player, run, config) {
  if (player.dashTimer > 0 && config.dashAffectsCamera === false) {
    return run.cameraLookDirection || player.facing || 1;
  }
  if (isBraceCameraState(player) && config.braceAffectsCamera === false) {
    return run.cameraLookDirection || player.facing || 1;
  }

  if (player.wallRunActive) {
    const wallRunCameraDirection = getWallRunCameraDirection(player);
    if (wallRunCameraDirection !== 0) {
      return wallRunCameraDirection;
    }
  }

  const speedThreshold = config.directionSpeedThreshold ?? 70;
  if (Math.abs(player.vx) > speedThreshold) {
    return Math.sign(player.vx);
  }
  if (isBraceCameraState(player) && player.braceHoldLaunchDirection !== 0) {
    return player.braceHoldLaunchDirection;
  }
  return run.cameraLookDirection || player.facing || 1;
}

function isSprintCameraActive(player, config) {
  const minSpeed = config.sprintCameraMinSpeed ?? 260;
  return (
    Math.abs(player.vx) >= minSpeed &&
    (
      player.sprintActive ||
      player.sprintCharge > 0.55 ||
      player.sprintJumpCarryTimer > 0
    )
  );
}

function getCameraLookAhead(player, config) {
  if (player.dashTimer > 0 && config.dashAffectsCamera !== false) {
    return config.dashLookAhead ?? 0.18;
  }
  if (player.wallRunActive) {
    return config.wallRunLookAhead ?? 0;
  }
  if (isBraceCameraState(player) && config.braceAffectsCamera !== false) {
    return config.braceLookAhead ?? 0.14;
  }
  const sprintCameraActive = isSprintCameraActive(player, config);
  if (!player.onGround && player.sprintJumpCarryTimer > 0 && sprintCameraActive) {
    return config.sprintJumpLookAhead ?? 0.25;
  }
  if (sprintCameraActive) {
    return player.onGround
      ? (config.sprintLookAhead ?? 0.18)
      : (config.sprintJumpLookAhead ?? 0.25);
  }
  if (!player.onGround && player.vy > 220) {
    return config.fallLookAhead ?? 0.12;
  }
  return config.walkLookAhead ?? 0.08;
}

function getFallCameraRatio(player, config) {
  const start = config.fallDownSpeedStart ?? 240;
  const full = Math.max(start + 1, config.fallDownSpeedFull ?? 1120);
  if (player.onGround || player.vy <= start) {
    return 0;
  }
  return clamp((player.vy - start) / (full - start), 0, 1);
}

function findFallLandingSurfaceY(player, data, config) {
  if (player.vy <= 0 || !Array.isArray(data.platforms)) {
    return null;
  }

  const footY = player.y + player.height;
  const probeDistance = config.fallLandingProbeDistance ?? 620;
  const maxTime = config.fallLandingProbeMaxTime ?? 0.72;
  const centerX = player.x + player.width * 0.5;
  let nearestY = Number.POSITIVE_INFINITY;

  data.platforms.forEach((platform) => {
    if (isWaterPlatform(platform)) {
      return;
    }
    const gap = platform.y - footY;
    if (gap <= 0 || gap > probeDistance) {
      return;
    }

    const timeToSurface = clamp(gap / Math.max(player.vy, 1), 0, maxTime);
    const projectedCenterX = centerX + player.vx * timeToSurface;
    const left = projectedCenterX - player.width * 0.5;
    const right = projectedCenterX + player.width * 0.5;
    const margin = Math.max(24, Math.abs(player.vx) * 0.08);
    if (right < platform.x - margin || left > platform.x + platform.width + margin) {
      return;
    }

    nearestY = Math.min(nearestY, platform.y);
  });

  return Number.isFinite(nearestY) ? nearestY : null;
}

function getFallLandingCameraOffset(player, data, config, ratio) {
  if (ratio <= 0) {
    return 0;
  }

  const landingY = findFallLandingSurfaceY(player, data, config);
  if (landingY === null) {
    return 0;
  }

  const footY = player.y + player.height;
  const gap = Math.max(0, landingY - footY);
  const pull = config.fallLandingCameraPull ?? 0.22;
  const maxOffset = config.fallLandingCameraMaxOffset ?? 150;
  return clamp(gap * pull * ratio, 0, maxOffset);
}

function updateFallCameraState(run, player, data, config, dt) {
  const rawRatio = getFallCameraRatio(player, config);
  const holdDuration = Math.max(0, (config.fallReturnHoldMs ?? 240) / 1000);

  if (rawRatio > 0) {
    run.cameraFallRatio = Math.max(rawRatio, (run.cameraFallRatio ?? 0) * 0.88);
    run.cameraFallHoldTimer = holdDuration;
    run.cameraFallTargetYOffset = getFallLandingCameraOffset(player, data, config, run.cameraFallRatio);
  } else {
    run.cameraFallHoldTimer = Math.max(0, (run.cameraFallHoldTimer ?? 0) - dt);
    if (run.cameraFallHoldTimer === 0) {
      const returnLerp = Math.min(1, dt * (config.fallReturnLerp ?? 3.6));
      run.cameraFallRatio = lerp(run.cameraFallRatio ?? 0, 0, returnLerp);
      run.cameraFallTargetYOffset = lerp(run.cameraFallTargetYOffset ?? 0, 0, returnLerp);
      if (run.cameraFallRatio < 0.01) {
        run.cameraFallRatio = 0;
      }
      if (Math.abs(run.cameraFallTargetYOffset) < 0.5) {
        run.cameraFallTargetYOffset = 0;
      }
    }
  }

  return {
    active: rawRatio > 0,
    held: rawRatio === 0 && (run.cameraFallHoldTimer ?? 0) > 0,
    ratio: clamp(run.cameraFallRatio ?? 0, 0, 1),
    targetYOffset: Math.max(0, run.cameraFallTargetYOffset ?? 0),
  };
}

function getCameraVerticalFocus(player, config, fallCamera = null) {
  const neutralFocusY = config.neutralFocusY ?? 0.5;
  if (player.wallRunActive) {
    return neutralFocusY + (config.wallRunUpLookAhead ?? 0.22);
  }
  if (player.wallRunBoostActive) {
    return neutralFocusY + (config.upwardFocusOffset ?? 0.18);
  }
  if (isBraceCameraState(player)) {
    return neutralFocusY + (config.upwardFocusOffset ?? 0.18) * 0.7;
  }
  if (!player.onGround && player.vy < -240) {
    return neutralFocusY + (config.upwardFocusOffset ?? 0.18) * 0.45;
  }
  const fallRatio = fallCamera?.ratio ?? getFallCameraRatio(player, config);
  if (fallRatio > 0) {
    const legacyFallFocus = neutralFocusY + (config.fallingFocusOffset ?? -0.14);
    const startFocusY = config.fallDownFocusStartY ?? lerp(neutralFocusY, legacyFallFocus, 0.55);
    const fullFocusY = config.fallDownFocusFullY ?? lerp(neutralFocusY, legacyFallFocus, 1.25);
    return lerp(startFocusY, fullFocusY, fallRatio);
  }
  return neutralFocusY;
}

function getCameraSpeed(player, config = {}) {
  const horizontalSpeed = Math.abs(player.vx);
  const verticalSpeed = (
    player.wallRunActive ||
    player.wallRunBoostActive ||
    isBraceCameraState(player) ||
    player.sprintJumpCarryTimer > 0
  )
    ? Math.abs(player.vy) * 0.55
    : 0;
  const fallSpeed = !player.onGround && player.vy > (config.fallDownSpeedStart ?? 240)
    ? Math.abs(player.vy) * (config.fallSpeedZoomMultiplier ?? 0.55)
    : 0;
  return Math.max(horizontalSpeed, verticalSpeed, fallSpeed);
}

function getSpeedZoomState(player, config) {
  const baseZoom = clamp(config.zoom ?? 1, 0.5, 2.5);
  if (
    (player.dashTimer > 0 && config.dashAffectsCamera === false)
    || (isBraceCameraState(player) && config.braceAffectsCamera === false)
  ) {
    return {
      ratio: 0,
      zoom: baseZoom,
    };
  }

  const start = config.speedZoomStart ?? 260;
  const full = Math.max(start + 1, config.speedZoomFull ?? 980);
  const ratio = clamp((getCameraSpeed(player, config) - start) / (full - start), 0, 1);
  const speedZoomMin = baseZoom * clamp(config.speedZoomMin ?? config.minZoom ?? 0.88, 0.1, 1);
  return {
    ratio,
    zoom: clamp(lerp(baseZoom, speedZoomMin, ratio), 0.5, baseZoom),
  };
}

function getCameraScaledZoom(baseZoom, value, fallback) {
  return clamp(baseZoom * clamp(value ?? fallback, 0.1, 1), 0.5, baseZoom);
}

function getCameraTargetZoom(player, config, fallCamera = null) {
  const baseZoom = clamp(config.zoom ?? 1, 0.5, 2.5);
  let targetZoom = baseZoom;
  if (player.wallRunActive || player.wallRunBoostActive) {
    targetZoom = getCameraScaledZoom(baseZoom, config.wallRunZoom, 0.94);
  } else if (player.dashTimer > 0 && config.dashAffectsCamera !== false) {
    targetZoom = getCameraScaledZoom(baseZoom, config.dashZoom, 0.95);
  } else if (isBraceCameraState(player) && config.braceAffectsCamera !== false) {
    targetZoom = getCameraScaledZoom(baseZoom, config.braceZoom, 0.96);
  } else if (!player.onGround && player.sprintJumpCarryTimer > 0 && isSprintCameraActive(player, config)) {
    targetZoom = getCameraScaledZoom(baseZoom, config.sprintJumpZoom, 0.92);
  } else if (isSprintCameraActive(player, config)) {
    targetZoom = player.onGround
      ? getCameraScaledZoom(baseZoom, config.sprintZoom, 0.96)
      : getCameraScaledZoom(baseZoom, config.sprintJumpZoom, 0.92);
  }

  const fallRatio = fallCamera?.ratio ?? 0;
  if (fallRatio > 0) {
    const fallZoom = baseZoom * clamp(config.fallZoom ?? 0.9, 0.1, 1);
    targetZoom = Math.min(targetZoom, lerp(baseZoom, fallZoom, fallRatio));
  }

  const speedZoom = getSpeedZoomState(player, config);
  if (speedZoom.ratio > 0) {
    targetZoom = Math.min(targetZoom, speedZoom.zoom);
  }

  const minZoom = baseZoom * clamp(config.minZoom ?? config.speedZoomMin ?? 0.88, 0.1, 1);
  return clamp(targetZoom, minZoom, baseZoom);
}

function syncCamera(run, data, dt) {
  const config = getCameraConfig(data);
  if (!config.lookAheadEnabled) {
    const zoom = clamp(config.zoom ?? 1, 0.5, 2.5);
    const viewportWidth = CAMERA_SCREEN_WIDTH / zoom;
    const viewportHeight = CAMERA_SCREEN_HEIGHT / zoom;
    const targetX = run.player.x - viewportWidth * CAMERA_FOCUS_X;
    const targetY = run.player.y - viewportHeight * CAMERA_FOCUS_Y;
    const maxX = Math.max(0, data.world.width - viewportWidth);
    const maxY = Math.max(0, data.world.height - viewportHeight);
    run.cameraZoom = zoom;
    run.cameraFocusX = CAMERA_FOCUS_X;
    run.cameraFocusY = CAMERA_FOCUS_Y;
    run.cameraTargetX = targetX;
    run.cameraTargetY = targetY;
    run.cameraTargetZoom = zoom;
    run.cameraLookAhead = 0;
    run.cameraSpeedRatio = 0;
    run.cameraX = clamp(lerp(run.cameraX, targetX, Math.min(1, dt * 4.5)), 0, maxX);
    run.cameraY = clamp(lerp(run.cameraY, targetY, Math.min(1, dt * 4.5)), 0, maxY);
    return;
  }

  const player = run.player;
  const freezeActionCamera = (
    (player.dashTimer > 0 && config.dashAffectsCamera === false)
    || (isBraceCameraState(player) && config.braceAffectsCamera === false)
  );
  const recoilCamera = freezeActionCamera ? null : getRecoilCameraState(run, config);
  const fallCamera = updateFallCameraState(run, player, data, config, dt);
  const applyFallCamera = !freezeActionCamera && !recoilCamera && fallCamera.ratio > 0 && (
    fallCamera.active ||
    player.onGround
  );
  const targetLookDirection = freezeActionCamera
    ? (run.cameraLookDirection || player.facing || 1)
    : recoilCamera && Math.abs(recoilCamera.directionX) > 0.08
      ? Math.sign(recoilCamera.directionX)
    : getCameraLookDirection(player, run, config);
  const directionLerp = Math.min(1, dt * (config.directionLerp ?? 6));
  run.cameraLookDirection = lerp(run.cameraLookDirection || targetLookDirection, targetLookDirection, directionLerp);
  const targetLookSign = Math.sign(targetLookDirection) || Math.sign(run.cameraLookDirection) || player.facing || 1;

  const lookAhead = freezeActionCamera
    ? (run.cameraLookAhead ?? 0)
    : recoilCamera
      ? Math.abs(recoilCamera.directionX) * recoilCamera.horizontalLookAhead
      : getCameraLookAhead(player, config);
  const targetFocusX = freezeActionCamera
    ? clamp(run.cameraFocusX ?? (config.neutralFocusX ?? 0.5), 0.24, 0.76)
    : clamp(
      (config.neutralFocusX ?? 0.5) - targetLookSign * lookAhead,
      0.24,
      0.76,
    );
  const targetFocusY = freezeActionCamera
    ? clamp(run.cameraFocusY ?? (config.neutralFocusY ?? 0.5), 0.28, 0.72)
    : recoilCamera
      ? clamp(
        (config.neutralFocusY ?? 0.5) - recoilCamera.directionY * recoilCamera.verticalLookAhead,
        0.28,
        0.72,
      )
    : clamp(getCameraVerticalFocus(player, config, fallCamera), 0.28, 0.72);
  const focusLerp = Math.min(1, dt * (config.focusLerp ?? 5.5));
  const verticalFocusLerp = Math.min(1, dt * (
    applyFallCamera
      ? (config.fallFocusLerp ?? 8.5)
      : fallCamera.ratio > 0
        ? (config.fallReturnLerp ?? 3.6)
        : (config.focusLerp ?? 5.5)
  ));
  run.cameraFocusX = lerp(run.cameraFocusX ?? targetFocusX, targetFocusX, focusLerp);
  run.cameraFocusY = lerp(run.cameraFocusY ?? targetFocusY, targetFocusY, verticalFocusLerp);

  const targetZoom = freezeActionCamera
    ? clamp(run.cameraZoom ?? (config.zoom ?? 1), 0.5, 2.5)
    : getCameraTargetZoom(player, config, fallCamera);
  const speedZoom = freezeActionCamera
    ? { ratio: 0, zoom: targetZoom }
    : getSpeedZoomState(player, config);
  const zoomLerp = Math.min(1, dt * (config.zoomLerp ?? 4.2));
  const zoom = clamp(lerp(run.cameraZoom ?? (config.zoom ?? 1), targetZoom, zoomLerp), 0.5, 2.5);
  run.cameraZoom = zoom;

  const viewportWidth = CAMERA_SCREEN_WIDTH / zoom;
  const viewportHeight = CAMERA_SCREEN_HEIGHT / zoom;
  const aimPan = updateAimCameraPan(run, config, viewportWidth, viewportHeight, dt, freezeActionCamera);
  const targetX = player.x + player.width * 0.5 - viewportWidth * run.cameraFocusX + aimPan.x;
  const fallTargetYOffset = applyFallCamera ? fallCamera.targetYOffset : 0;
  const targetY = player.y + player.height * 0.5 + fallTargetYOffset - viewportHeight * run.cameraFocusY + aimPan.y;
  const maxX = Math.max(0, data.world.width - viewportWidth);
  const maxY = Math.max(0, data.world.height - viewportHeight);
  run.cameraTargetX = targetX;
  run.cameraTargetY = targetY;
  run.cameraTargetZoom = targetZoom;
  run.cameraLookAhead = lookAhead;
  run.cameraSpeedRatio = speedZoom.ratio;
  run.cameraX = clamp(lerp(run.cameraX, targetX, focusLerp), 0, maxX);
  run.cameraY = clamp(lerp(run.cameraY, targetY, verticalFocusLerp), 0, maxY);
}

function getFaceOffCameraTarget(run) {
  const activeTarget = getFaceOffTarget(run);
  if (activeTarget) {
    return activeTarget;
  }
  const acquireTargetId = run.faceOff?.acquireTargetId;
  if (!acquireTargetId) {
    return null;
  }
  return (run.humanoidEnemies || []).find((enemy) => enemy.id === acquireTargetId) || null;
}

function lockCameraToFaceOffTarget(run, data, dt = 0, instant = true) {
  const target = getFaceOffCameraTarget(run);
  if (!target) {
    return;
  }

  const zoom = clamp(run.cameraZoom ?? getCameraConfig(data).zoom ?? 1, 0.5, 2.5);
  const viewportWidth = CAMERA_SCREEN_WIDTH / zoom;
  const viewportHeight = CAMERA_SCREEN_HEIGHT / zoom;
  const focusX = 0.5;
  const focusY = 0.48;
  const targetX = target.x + target.width * 0.5 - viewportWidth * focusX;
  const targetY = target.y + target.height * 0.42 - viewportHeight * focusY;
  const maxX = Math.max(0, data.world.width - viewportWidth);
  const maxY = Math.max(0, data.world.height - viewportHeight);

  run.cameraFocusX = focusX;
  run.cameraFocusY = focusY;
  run.cameraTargetX = targetX;
  run.cameraTargetY = targetY;
  if (instant) {
    run.cameraX = clamp(targetX, 0, maxX);
    run.cameraY = clamp(targetY, 0, maxY);
    return;
  }

  const cameraPull = Math.min(1, dt * (getFaceOffConfig(data).aimCameraPull ?? 5.5));
  run.cameraX = clamp(lerp(run.cameraX, targetX, cameraPull), 0, maxX);
  run.cameraY = clamp(lerp(run.cameraY, targetY, cameraPull), 0, maxY);
}

function getMovementConfig(data) {
  return data.player.movement;
}

function getSprintTargetSpeed(player, config, moveAxis, runHeld) {
  if (
    !runHeld ||
    moveAxis === 0 ||
    player.height !== player.standHeight
  ) {
    return config.runSpeed;
  }
  if (!player.onGround && player.sprintCharge <= 0) {
    return config.runSpeed;
  }
  return lerp(config.runSpeed, config.sprintSpeed ?? config.runSpeed, player.sprintCharge);
}

function isMovingDownhillOnSlope(player, moveAxis) {
  const downhillDirection = player.groundSlopeDirection ?? 0;
  return Boolean(
    player.onGround &&
    player.height === player.standHeight &&
    player.slideTimer <= 0 &&
    moveAxis !== 0 &&
    downhillDirection !== 0 &&
    Math.sign(moveAxis) === Math.sign(downhillDirection)
  );
}

function getHostileAirborneSolidRect(entity) {
  if (
    isEntityDisabled(entity) ||
    entity.dead ||
    entity.solid === false ||
    entity.physicsSolid === false ||
    entity.diveTimer > 0
  ) {
    return null;
  }

  const insetX = entity.solidInsetX ?? 5;
  const insetY = entity.solidInsetY ?? 4;
  return {
    id: entity.id,
    type: "airborneSolid",
    x: entity.x + insetX,
    y: entity.y + insetY,
    width: Math.max(12, entity.width - insetX * 2),
    height: Math.max(12, entity.height - insetY * 2),
    dynamicEntityId: entity.id,
    dynamicEntity: entity,
    dynamicBraceTarget: entity.braceTarget !== false,
    backCatchPaddingX: entity.backCatchPaddingX ?? 0,
    backCatchForgivenessY: entity.backCatchForgivenessY ?? 0,
  };
}

function isTemporaryBlockHidden(block) {
  return Boolean(block?.destroyed) || (block?.hiddenTimer ?? 0) > 0;
}

function getTemporaryBlockSolidRect(block) {
  if (!block || isTemporaryBlockHidden(block)) {
    return null;
  }
  return {
    id: block.id,
    type: "temporaryBlock",
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    dynamicEntityId: block.id,
    dynamicEntity: block,
    dynamicBraceTarget: false,
  };
}

function getDynamicCollisionSolids(run) {
  const droneSolids = (run?.hostileDrones || [])
    .map((entity) => getHostileAirborneSolidRect(entity))
    .filter(Boolean);
  const temporaryBlockSolids = (run?.temporaryBlocks || [])
    .map((block) => getTemporaryBlockSolidRect(block))
    .filter(Boolean);
  return [...droneSolids, ...temporaryBlockSolids];
}

function isSlopePlatform(platform) {
  return platform?.kind === "slope";
}

function isWaterPlatform(platform) {
  return platform?.kind === "water";
}

function getSlopeSurfaceY(platform, worldX) {
  const t = clamp((worldX - platform.x) / Math.max(1, platform.width), 0, 1);
  return platform.slopeDirection === "up-right"
    ? platform.y + platform.height * (1 - t)
    : platform.y + platform.height * t;
}

function getSlopeDownhillDirection(platform) {
  return platform.slopeDirection === "up-right" ? -1 : 1;
}

function isSlopePlatformSeamPassThrough(player, platform, data, side, config, slopePlatforms = null) {
  if (platform.dynamicEntityId) {
    return false;
  }

  const seamTolerance = config.slopePlatformSeamTolerancePx ?? 8;
  const snapDistance = config.slopeSnapDistance ?? 34;
  const platformSideX = side === "left" ? platform.x : platform.x + platform.width;
  const playerFootY = player.y + player.height;

  if (
    playerFootY < platform.y - snapDistance ||
    playerFootY > platform.y + seamTolerance ||
    player.y >= platform.y + platform.height - EPSILON
  ) {
    return false;
  }

  for (const slope of slopePlatforms || getSlopePlatforms(data)) {
    const slopeSideX = side === "left" ? slope.x + slope.width : slope.x;
    const slopeSideY = getSlopeSurfaceY(slope, slopeSideX);
    if (
      Math.abs(slopeSideX - platformSideX) <= seamTolerance &&
      Math.abs(slopeSideY - platform.y) <= seamTolerance
    ) {
      return true;
    }
  }

  return false;
}

function getConnectedSlopePlatformSeamX(slope, platform, config) {
  if (!slope || !platform || platform.dynamicEntityId) {
    return null;
  }

  const seamTolerance = config.slopePlatformSeamTolerancePx ?? 8;
  const checks = [
    { slopeX: slope.x, platformX: platform.x },
    { slopeX: slope.x, platformX: platform.x + platform.width },
    { slopeX: slope.x + slope.width, platformX: platform.x },
    { slopeX: slope.x + slope.width, platformX: platform.x + platform.width },
  ];

  for (const check of checks) {
    if (
      Math.abs(check.slopeX - check.platformX) <= seamTolerance &&
      Math.abs(getSlopeSurfaceY(slope, check.slopeX) - platform.y) <= seamTolerance
    ) {
      return (check.slopeX + check.platformX) * 0.5;
    }
  }

  return null;
}

function shouldHoldSolidGroundAtSlopeSeam(player, slope, groundPlatform, footX, config) {
  const seamX = getConnectedSlopePlatformSeamX(slope, groundPlatform, config);
  if (seamX === null) {
    return false;
  }

  const holdDistance = config.slopePlatformSeamHoldDistance ?? Math.max(12, player.width * 0.4);
  return (
    Math.abs(footX - seamX) <= holdDistance ||
    (seamX >= player.x - holdDistance && seamX <= player.x + player.width + holdDistance)
  );
}

function getSlopePlatforms(data) {
  return (data.platforms || []).filter((platform) => isSlopePlatform(platform));
}

function getSolidLevelPlatforms(data) {
  return (data.platforms || []).filter((platform) => !isSlopePlatform(platform) && !isWaterPlatform(platform));
}

function getCollisionPlatforms(data, run = null) {
  const solids = getSolidLevelPlatforms(data);
  if (!run) {
    return solids;
  }
  return [...solids, ...getDynamicCollisionSolids(run)];
}

function collidesWithPlatforms(rect, data, run = null, collisionPlatforms = null) {
  return (collisionPlatforms || getCollisionPlatforms(data, run)).some((platform) => rectsOverlap(rect, platform));
}

function getPlayerSlopeProbeXs(player) {
  const centerX = player.x + player.width * 0.5;
  const direction = Math.sign(player.vx || player.facing || 1);
  const probeOffset = player.width * 0.36;
  const leadingX = clamp(centerX + direction * probeOffset, player.x + 2, player.x + player.width - 2);
  const trailingX = clamp(centerX - direction * probeOffset, player.x + 2, player.x + player.width - 2);
  return [leadingX, centerX, trailingX];
}

function canOccupyRect(rect, data, run = null, collisionPlatforms = null) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= data.world.width &&
    rect.y + rect.height <= data.world.height &&
    !collidesWithPlatforms(rect, data, run, collisionPlatforms)
  );
}

function hasHorizontalOverlapWithPadding(rect, platform, paddingX = 0) {
  return (
    rect.x < platform.x + platform.width + paddingX &&
    rect.x + rect.width > platform.x - paddingX
  );
}

function shouldCatchDynamicTop(player, platform, previousY) {
  if (!platform.dynamicEntityId || player.vy < -EPSILON) {
    return false;
  }

  const paddingX = platform.backCatchPaddingX ?? 0;
  const forgivenessY = platform.backCatchForgivenessY ?? 0;
  if (paddingX <= 0 && forgivenessY <= 0) {
    return false;
  }

  const previousFootY = previousY + player.height;
  const currentFootY = player.y + player.height;
  return (
    hasHorizontalOverlapWithPadding(player, platform, paddingX) &&
    previousFootY <= platform.y + forgivenessY &&
    currentFootY >= platform.y - forgivenessY
  );
}

function canResizePlayer(player, data, targetHeight) {
  const nextRect = {
    x: player.x,
    y: player.y - (targetHeight - player.height),
    width: player.width,
    height: targetHeight,
  };
  return nextRect.y >= 0 && !collidesWithPlatforms(nextRect, data);
}

function getActiveBraceWall(player, data, run = null) {
  const walls = [
    ...(data.braceWalls || []),
    ...getDynamicCollisionSolids(run).filter((solid) => solid.dynamicBraceTarget),
  ];
  if (!walls.length) {
    return null;
  }
  const config = getMovementConfig(data);
  const paddingX = config.braceDetectPaddingX ?? 8;
  const paddingY = config.braceDetectPaddingY ?? 8;

  const probe = {
    x: player.x - paddingX,
    y: player.y - paddingY,
    width: player.width + paddingX * 2,
    height: player.height + paddingY * 2,
  };

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const wall of walls) {
    if (!rectsOverlap(probe, wall)) {
      continue;
    }
    const center = getCenter(wall);
    const playerCenter = getCenter(player);
    const distance = distanceBetween(center, playerCenter);
    if (distance < nearestDistance) {
      nearest = wall;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function getBraceWallById(data, wallId, run = null) {
  if (!wallId) {
    return null;
  }
  return (
    (data.braceWalls || []).find((wall) => wall.id === wallId) ??
    getDynamicCollisionSolids(run).find((wall) => wall.id === wallId) ??
    null
  );
}

function setPlayerHeight(player, targetHeight) {
  const feetY = player.y + player.height;
  player.height = targetHeight;
  player.y = feetY - targetHeight;
}

function tryEnterCrouch(player, data) {
  if (player.height === player.crouchHeight || !player.onGround) {
    return;
  }
  if (player.crouchHeight < player.height) {
    setPlayerHeight(player, player.crouchHeight);
  }
}

function tryExitCrouch(player, data) {
  if (player.height === player.standHeight) {
    player.crouchBlocked = false;
    return true;
  }
  if (canResizePlayer(player, data, player.standHeight)) {
    setPlayerHeight(player, player.standHeight);
    player.crouchBlocked = false;
    return true;
  }
  player.crouchBlocked = true;
  return false;
}

function clearSlide(player) {
  player.slideTimer = 0;
  player.slideDirection = 0;
  player.slideSpeed = 0;
  player.slideGroundGraceTimer = 0;
}

function tryStartSlide(player, data, config, moveAxis) {
  if (!player.onGround || player.slideTimer > 0 || player.height !== player.standHeight) {
    return false;
  }

  const speed = Math.abs(player.vx);
  const minSpeed = config.slideMinSpeed ?? config.runSpeed ?? 0;
  if (speed < minSpeed) {
    return false;
  }

  const direction = Math.sign(player.vx) || moveAxis || player.facing || 1;
  const slopeDirection = player.groundSlopeDirection ?? 0;
  const isUphill = slopeDirection !== 0 && Math.sign(direction) !== Math.sign(slopeDirection);
  if (isUphill && speed < (config.slideUphillStartMinSpeed ?? minSpeed * 1.35)) {
    return false;
  }
  setPlayerHeight(player, player.crouchHeight);
  player.slideDirection = direction;
  player.slideTimer = ((config.slideDurationMs ?? 0) / 1000)
    * (isUphill ? (config.slideUphillStartTimerMultiplier ?? 0.32) : 1);
  player.slideSpeed = Math.max(speed, minSpeed)
    * (config.slideSpeedMultiplier ?? 1)
    * (isUphill ? (config.slideUphillStartSpeedMultiplier ?? 0.58) : 1);
  player.vx = player.slideDirection * player.slideSpeed;
  player.facing = player.slideDirection;
  player.crouchBlocked = false;
  player.slideGroundGraceTimer = (config.slideGroundGraceMs ?? 90) / 1000;
  return true;
}

function getSlideSlopeRelation(player) {
  const slopeDirection = player.groundSlopeDirection ?? 0;
  const slideDirection = player.slideDirection || Math.sign(player.vx) || player.facing || 1;
  if (slopeDirection === 0 || slideDirection === 0) {
    return "flat";
  }
  return Math.sign(slideDirection) === Math.sign(slopeDirection) ? "downhill" : "uphill";
}

function decaySlideTimer(player, config, dt) {
  if (player.slideTimer <= 0) {
    return;
  }
  const relation = getSlideSlopeRelation(player);
  const drainMultiplier = relation === "downhill"
    ? (config.slideDownhillTimerDrainMultiplier ?? 0.32)
    : relation === "uphill"
      ? (config.slideUphillTimerDrainMultiplier ?? 3.4)
      : 1;
  player.slideTimer = Math.max(0, player.slideTimer - dt * drainMultiplier);
}

function updateSlide(player, config, dt) {
  if (player.slideTimer <= 0 || player.slideDirection === 0) {
    return false;
  }

  const relation = getSlideSlopeRelation(player);
  if (relation === "downhill") {
    const downhillFriction = config.slideDownhillFriction ?? 0;
    player.slideSpeed = Math.min(
      config.slideSlopeMaxSpeed ?? 1780,
      Math.max(0, player.slideSpeed - downhillFriction * dt) + (config.slideSlopeAccel ?? 520) * dt,
    );
  } else {
    const friction = relation === "uphill"
      ? (config.slideUphillFriction ?? (config.slideFriction ?? 0) * 2.1)
      : (config.slideFriction ?? 0);
    player.slideSpeed = Math.max(0, player.slideSpeed - friction * dt);
  }
  if (
    player.slideSpeed <= 0 ||
    (relation === "uphill" && player.slideSpeed <= (config.slideUphillStopSpeed ?? 420))
  ) {
    clearSlide(player);
    return false;
  }

  player.vx = player.slideDirection * player.slideSpeed;
  player.facing = player.slideDirection;
  return true;
}

function getSlideJumpSpeed(player) {
  return Math.max(Math.abs(player.vx ?? 0), Math.abs(player.slideSpeed ?? 0));
}

function isSlideJumpBoostReady(player, config) {
  return Boolean(
    player.slideTimer > 0 &&
    getSlideJumpSpeed(player) >= (config.slideJumpBoostMinSpeed ?? config.slideJumpMinSpeed ?? 0)
  );
}

function armSlideJumpCarry(player, run, config) {
  const direction = player.slideDirection || Math.sign(player.vx) || player.facing || 1;
  const speed = Math.max(
    Math.abs(player.vx),
    Math.abs(player.slideSpeed),
    config.slideJumpMinSpeed ?? config.sprintJumpMinSpeed ?? 0
  ) * (config.slideJumpSpeedMultiplier ?? 1);

  player.sprintJumpCarryTimer = (config.slideJumpCarryMs ?? config.sprintJumpCarryMs ?? 0) / 1000;
  player.sprintJumpCarrySpeed = direction * speed;
  player.slideJumpBoostActive = true;
  spawnDirectedParticles(
    run,
    player.x + player.width * 0.5,
    player.y + player.height - 4,
    22,
    "#e9f7ff",
    -direction,
    0.34,
    560,
    1.05,
  );
  spawnDirectedParticles(
    run,
    player.x + player.width * 0.5,
    player.y + player.height - 2,
    12,
    "#e7f47e",
    -direction,
    0.08,
    480,
    0.72,
  );
  pushAfterimage(run, player);
  clearSlide(player);
}

function tryJumpCornerCorrection(player, data, config, run = null, collisionPlatforms = null) {
  const baseDirection = Math.sign(player.vx) || player.facing || 1;
  const directions = [baseDirection, -baseDirection];

  for (const direction of directions) {
    for (let offset = 1; offset <= (config.jumpCornerCorrectionPx ?? 0); offset += 1) {
      const candidate = {
        x: player.x + direction * offset,
        y: player.y,
        width: player.width,
        height: player.height,
      };

      if (canOccupyRect(candidate, data, run, collisionPlatforms)) {
        player.x = candidate.x;
        return true;
      }
    }
  }

  return false;
}

function tryDashCornerCorrection(player, data, resolvedX, direction, config, run = null, collisionPlatforms = null) {
  const maxLift = config.dashCornerCorrectionPx ?? 0;
  for (let offset = 1; offset <= maxLift; offset += 1) {
    const candidates = [
      {
        x: resolvedX,
        y: player.y - offset,
        width: player.width,
        height: player.height,
      },
      {
        x: resolvedX + direction * 2,
        y: player.y - offset,
        width: player.width,
        height: player.height,
      },
    ];

    for (const candidate of candidates) {
      if (canOccupyRect(candidate, data, run, collisionPlatforms)) {
        player.x = candidate.x;
        player.y = candidate.y;
        return true;
      }
    }
  }

  return false;
}

function resolvePlayerCollisionStep(player, data, dt, config, run = null) {
  const contacts = {
    onGround: false,
    hitHead: false,
    wallLeft: false,
    wallRight: false,
    groundEntityId: null,
    wallEntityId: null,
    landingSpeed: 0,
    dashBlocked: false,
    dashCornerCorrected: false,
    jumpCornerCorrected: false,
    slopeDownhillDirection: 0,
  };
  player.groundSlopeDirection = 0;
  const collisionPlatforms = getCollisionPlatforms(data, run);
  const slopePlatforms = getSlopePlatforms(data);

  const previousX = player.x;
  player.x += player.vx * dt;
  let slopeSeamPlatform = null;

  for (const platform of collisionPlatforms) {
    if (!rectsOverlap(player, platform)) {
      continue;
    }

    if (previousX + player.width <= platform.x + EPSILON) {
      if (isSlopePlatformSeamPassThrough(player, platform, data, "left", config, slopePlatforms)) {
        slopeSeamPlatform = platform;
        continue;
      }
      const resolvedX = platform.x - player.width;
      if (
        player.dashTimer > 0 &&
        tryDashCornerCorrection(player, data, resolvedX, 1, config, run, collisionPlatforms)
      ) {
        contacts.dashCornerCorrected = true;
        continue;
      }
      contacts.dashBlocked = true;
      player.x = resolvedX;
      contacts.wallRight = true;
      contacts.wallEntityId = platform.dynamicEntityId ?? null;
    } else if (previousX >= platform.x + platform.width - EPSILON) {
      if (isSlopePlatformSeamPassThrough(player, platform, data, "right", config, slopePlatforms)) {
        slopeSeamPlatform = platform;
        continue;
      }
      const resolvedX = platform.x + platform.width;
      if (
        player.dashTimer > 0 &&
        tryDashCornerCorrection(player, data, resolvedX, -1, config, run, collisionPlatforms)
      ) {
        contacts.dashCornerCorrected = true;
        continue;
      }
      contacts.dashBlocked = true;
      player.x = resolvedX;
      contacts.wallLeft = true;
      contacts.wallEntityId = platform.dynamicEntityId ?? null;
    } else {
      const pushLeft = player.x + player.width - platform.x;
      const pushRight = platform.x + platform.width - player.x;
      if (pushLeft < pushRight) {
        if (isSlopePlatformSeamPassThrough(player, platform, data, "left", config, slopePlatforms)) {
          slopeSeamPlatform = platform;
          continue;
        }
        const resolvedX = player.x - pushLeft;
        if (
          player.dashTimer > 0 &&
          tryDashCornerCorrection(player, data, resolvedX, 1, config, run, collisionPlatforms)
        ) {
          contacts.dashCornerCorrected = true;
          continue;
        }
        contacts.dashBlocked = true;
        player.x -= pushLeft;
        contacts.wallRight = true;
        contacts.wallEntityId = platform.dynamicEntityId ?? null;
      } else {
        if (isSlopePlatformSeamPassThrough(player, platform, data, "right", config, slopePlatforms)) {
          slopeSeamPlatform = platform;
          continue;
        }
        const resolvedX = player.x + pushRight;
        if (
          player.dashTimer > 0 &&
          tryDashCornerCorrection(player, data, resolvedX, -1, config, run, collisionPlatforms)
        ) {
          contacts.dashCornerCorrected = true;
          continue;
        }
        contacts.dashBlocked = true;
        player.x += pushRight;
        contacts.wallLeft = true;
        contacts.wallEntityId = platform.dynamicEntityId ?? null;
      }
    }
    player.vx = 0;
  }

  if (player.x <= 0) {
    player.x = 0;
    contacts.wallLeft = true;
    contacts.dashBlocked = true;
    player.vx = Math.max(0, player.vx);
  }
  if (player.x + player.width >= data.world.width) {
    player.x = data.world.width - player.width;
    contacts.wallRight = true;
    contacts.dashBlocked = true;
    player.vx = Math.min(0, player.vx);
  }

  const previousY = player.y;
  player.y += player.vy * dt;
  player.onGround = false;
  let groundPlatform = null;

  for (const platform of collisionPlatforms) {
    const catchDynamicTop = shouldCatchDynamicTop(player, platform, previousY);
    if (!catchDynamicTop && !rectsOverlap(player, platform)) {
      continue;
    }

    if (catchDynamicTop || previousY + player.height <= platform.y + EPSILON) {
      contacts.landingSpeed = player.vy;
      player.y = platform.y - player.height;
      player.vy = 0;
      contacts.onGround = true;
      contacts.groundEntityId = platform.dynamicEntityId ?? null;
      groundPlatform = platform;
    } else if (previousY >= platform.y + platform.height - EPSILON) {
      if (player.vy < 0 && tryJumpCornerCorrection(player, data, config, run, collisionPlatforms)) {
        contacts.jumpCornerCorrected = true;
        continue;
      }
      player.y = platform.y + platform.height;
      player.vy = 0;
      contacts.hitHead = true;
    } else {
      const pushDown = player.y + player.height - platform.y;
      const pushUp = platform.y + platform.height - player.y;
      if (pushDown < pushUp) {
        contacts.landingSpeed = player.vy;
        player.y -= pushDown;
        player.vy = 0;
        contacts.onGround = true;
        contacts.groundEntityId = platform.dynamicEntityId ?? null;
        groundPlatform = platform;
      } else {
        if (player.vy < 0 && tryJumpCornerCorrection(player, data, config, run, collisionPlatforms)) {
          contacts.jumpCornerCorrected = true;
          continue;
        }
        player.y += pushUp;
        player.vy = 0;
        contacts.hitHead = true;
      }
    }
  }

  if (!contacts.onGround && slopeSeamPlatform && player.vy >= -EPSILON) {
    const seamTolerance = config.slopePlatformSeamTolerancePx ?? 8;
    const snapDistance = config.slopeSnapDistance ?? 34;
    const footY = player.y + player.height;
    if (
      hasHorizontalOverlapWithPadding(player, slopeSeamPlatform, seamTolerance) &&
      footY >= slopeSeamPlatform.y - snapDistance &&
      footY <= slopeSeamPlatform.y + seamTolerance
    ) {
      contacts.landingSpeed = player.vy;
      player.y = slopeSeamPlatform.y - player.height;
      player.vy = 0;
      contacts.onGround = true;
      contacts.groundEntityId = slopeSeamPlatform.dynamicEntityId ?? null;
      groundPlatform = slopeSeamPlatform;
    }
  }

  if (player.vy >= -EPSILON) {
    const footProbeXs = getPlayerSlopeProbeXs(player);
    const currentFootY = player.y + player.height;
    const previousFootY = previousY + player.height;
    let bestSlope = null;
    let bestSurfaceY = Number.POSITIVE_INFINITY;

    for (const platform of slopePlatforms) {
      if (player.x + player.width <= platform.x || player.x >= platform.x + platform.width) {
        continue;
      }

      for (const footX of footProbeXs) {
        if (footX < platform.x || footX > platform.x + platform.width) {
          continue;
        }
        const surfaceY = getSlopeSurfaceY(platform, footX);
        const snapDistance = config.slopeSnapDistance ?? 34;
        const catchDistance = config.slopeCatchDistance ?? Math.max(
          snapDistance,
          Math.abs(player.vy * dt) + player.width * 0.35,
        );
        if (
          !shouldHoldSolidGroundAtSlopeSeam(player, platform, groundPlatform, footX, config) &&
          currentFootY >= surfaceY - snapDistance &&
          previousFootY <= surfaceY + catchDistance &&
          surfaceY < bestSurfaceY
        ) {
          bestSlope = platform;
          bestSurfaceY = surfaceY;
        }
      }
    }

    if (bestSlope) {
      contacts.landingSpeed = player.vy;
      player.y = bestSurfaceY - player.height;
      player.vy = 0;
      contacts.onGround = true;
      contacts.slopeDownhillDirection = getSlopeDownhillDirection(bestSlope);
      player.groundSlopeDirection = contacts.slopeDownhillDirection;
    }
  }

  if (player.y < 0) {
    player.y = 0;
    player.vy = 0;
    contacts.hitHead = true;
  }
  if (player.y + player.height > data.world.height) {
    contacts.landingSpeed = player.vy;
    player.y = data.world.height - player.height;
    player.vy = 0;
    contacts.onGround = true;
  }

  return contacts;
}

function mergePlayerCollisionContacts(total, step) {
  total.hitHead = total.hitHead || step.hitHead;
  total.wallLeft = total.wallLeft || step.wallLeft;
  total.wallRight = total.wallRight || step.wallRight;
  total.dashBlocked = total.dashBlocked || step.dashBlocked;
  total.dashCornerCorrected = total.dashCornerCorrected || step.dashCornerCorrected;
  total.jumpCornerCorrected = total.jumpCornerCorrected || step.jumpCornerCorrected;
  if (step.onGround) {
    total.onGround = true;
    total.groundEntityId = step.groundEntityId ?? null;
    total.slopeDownhillDirection = step.slopeDownhillDirection;
  }
  total.wallEntityId = step.wallEntityId ?? total.wallEntityId;
  if (step.landingSpeed !== 0) {
    total.landingSpeed = step.landingSpeed;
  }
}

function resolvePlayerCollisions(player, data, dt, config, run = null) {
  const contacts = {
    onGround: false,
    hitHead: false,
    wallLeft: false,
    wallRight: false,
    groundEntityId: null,
    wallEntityId: null,
    landingSpeed: 0,
    dashBlocked: false,
    dashCornerCorrected: false,
    jumpCornerCorrected: false,
    slopeDownhillDirection: 0,
  };

  const maxStepDistance = config.playerCollisionMaxStepPx ?? 10;
  const maxSubsteps = config.playerCollisionMaxSubsteps ?? 8;
  const travelDistance = Math.max(Math.abs(player.vx * dt), Math.abs(player.vy * dt));
  const substeps = clamp(
    Math.ceil(travelDistance / Math.max(1, maxStepDistance)),
    1,
    maxSubsteps,
  );
  const stepDt = dt / substeps;

  for (let index = 0; index < substeps; index += 1) {
    const stepContacts = resolvePlayerCollisionStep(player, data, stepDt, config, run);
    mergePlayerCollisionContacts(contacts, stepContacts);
    if (
      (stepContacts.wallLeft || stepContacts.wallRight) &&
      Math.abs(player.vx) <= EPSILON &&
      Math.abs(player.vy) <= EPSILON
    ) {
      break;
    }
  }

  return contacts;
}

function damagePlayer(run, amount, direction, sourceText) {
  if (
    run.player.invulnTimer > 0 ||
    (run.player.dashTimer > 0 && run.player.dashInvulnerable) ||
    (run.player.slideTimer > 0 && run.player.slideInvulnerable)
  ) {
    return;
  }
  if (run.loot?.active) {
    closeLootCrate(run);
  }
  const coreEffects = getPlayerBodyCoreEffects(run);
  const hpDamage = Math.max(0, Number(amount || 0)) * coreEffects.incomingDamageMultiplier;
  run.hp = clamp(run.hp - hpDamage, 0, run.maxHp || 100);
  damagePlayerBodyPart(run, amount, direction);
  run.player.invulnTimer = 0.85;
  run.player.vx = direction * 190;
  run.player.vy = -260;
  pushNotice(run, sourceText);
  spawnParticles(run, run.player.x + run.player.width / 2, run.player.y + 20, 8, "#ffad8f");
}

function getWaterPlatforms(data) {
  return (data.platforms || []).filter((platform) => isWaterPlatform(platform));
}

function isPlayerTouchingWater(player, data) {
  const waterTiles = getWaterPlatforms(data);
  if (!waterTiles.length) {
    return false;
  }
  const probe = {
    x: player.x + player.width * 0.12,
    y: player.y + player.height * 0.08,
    width: player.width * 0.76,
    height: player.height * 0.9,
  };
  return waterTiles.some((tile) => rectsOverlap(probe, tile));
}

function updateWaterRespawnPoint(run, data) {
  const player = run?.player;
  if (!player || !player.onGround || isPlayerTouchingWater(player, data)) {
    return;
  }
  run.waterRespawnPoint = {
    levelId: run.currentLevelId || data.currentLevelId || data.defaultLevelId || "movement-lab-01",
    x: player.x,
    y: player.y,
    facing: player.facing || 1,
  };
}

function resetPlayerAfterWater(run, data) {
  const player = run.player;
  const checkpoint = run.waterRespawnPoint || {};
  const sameLevel = !checkpoint.levelId || checkpoint.levelId === (run.currentLevelId || data.currentLevelId);
  const entrance = (data.entrances || []).find((entry) => entry.id === "start")
    || (data.entrances || [])[0]
    || data.player.spawn;
  player.x = sameLevel && Number.isFinite(checkpoint.x)
    ? checkpoint.x
    : Number.isFinite(entrance?.x) ? entrance.x : data.player.spawn.x;
  player.y = sameLevel && Number.isFinite(checkpoint.y)
    ? checkpoint.y
    : Number.isFinite(entrance?.y) ? entrance.y : data.player.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.facing = Math.sign(checkpoint.facing ?? entrance?.facing ?? player.facing ?? 1) || 1;
  player.onGround = false;
  player.wasOnGround = false;
  player.wallDirection = 0;
  player.wallSliding = false;
  player.wallRunActive = false;
  player.braceHolding = false;
  player.braceHoldActive = false;
  player.dashTimer = 0;
  player.slideTimer = 0;
  clearZipLine(player);
  snapCameraToPlayer(run, data);
}

function handleWaterHazards(run, data) {
  const player = run?.player;
  if (!player || player.waterHazardCooldown > 0 || !isPlayerTouchingWater(player, data)) {
    updateWaterRespawnPoint(run, data);
    return;
  }
  const tile = getWaterPlatforms(data).find((water) => rectsOverlap(player, water)) || {};
  const damageRatio = clamp(Number(tile.damageRatio ?? 0.33), 0, 1);
  const damage = Math.max(1, Math.ceil((run.maxHp || data.player.maxHp || 100) * damageRatio));
  if (run.loot?.active) {
    closeLootCrate(run);
  }
  run.hp = clamp((run.hp ?? run.maxHp ?? data.player.maxHp ?? 100) - damage, 0, run.maxHp || data.player.maxHp || 100);
  damagePlayerBodyPart(run, damage, -(player.facing || 1));
  player.invulnTimer = Math.max(player.invulnTimer || 0, 0.45);
  pushNotice(run, "Water hazard.");
  spawnParticles(run, player.x + player.width / 2, player.y + player.height * 0.72, 14, "#67d9ff");
  player.waterHazardCooldown = 0.65;
  if (tile.respawn !== false) {
    resetPlayerAfterWater(run, data);
    run.message = "물에 휩쓸려 체크포인트로 복귀.";
    run.noticeTimer = 2;
  }
}

function ensurePlayerBodyStatus(run) {
  const defaults = {
    head: { label: "HEAD", hp: 100, maxHp: 100 },
    core: { label: "CORE", hp: 100, maxHp: 100 },
    leftArm: { label: "LEFT ARM", hp: 100, maxHp: 100 },
    rightArm: { label: "RIGHT ARM", hp: 100, maxHp: 100 },
    legs: { label: "LEGS", hp: 100, maxHp: 100 },
  };
  const legacyMockHp = { head: 92, core: 76, leftArm: 44, rightArm: 88, legs: 61 };
  if (!run.playerBodyVersion && run.playerBody && Object.entries(legacyMockHp).every(([key, hp]) => {
    const part = run.playerBody[key];
    return part && Number(part.hp) === hp && Number(part.maxHp ?? 100) === 100 && !(Number(part.recentHit) > 0);
  })) {
    run.playerBody = {};
  }
  run.playerBody = run.playerBody && typeof run.playerBody === "object" ? run.playerBody : {};
  Object.entries(defaults).forEach(([key, fallback]) => {
    const source = run.playerBody[key] || {};
    const maxHp = Math.max(1, Number(source.maxHp ?? fallback.maxHp));
    const hp = clamp(Number(source.hp ?? fallback.hp), 0, maxHp);
    run.playerBody[key] = {
      label: source.label || fallback.label,
      hp,
      maxHp,
      damaged: hp < maxHp,
      broken: hp <= 0,
      recentHit: Math.max(0, Number(source.recentHit ?? 0)),
    };
  });
  run.playerBodyVersion = 2;
  return run.playerBody;
}

function getPlayerBodyPartRatio(run, key) {
  const body = ensurePlayerBodyStatus(run);
  const part = body[key];
  if (!part) {
    return 1;
  }
  return clamp(Number(part.hp ?? part.maxHp ?? 100) / Math.max(1, Number(part.maxHp ?? 100)), 0, 1);
}

function stageValue(ratio, normal, damaged, critical, broken) {
  if (ratio <= 0) {
    return broken;
  }
  if (ratio <= 0.4) {
    return critical;
  }
  if (ratio <= 0.7) {
    return damaged;
  }
  return normal;
}

function getPlayerBodyMovementEffects(run) {
  const ratio = getPlayerBodyPartRatio(run, "legs");
  return {
    moveMultiplier: stageValue(ratio, 1, 0.88, 0.74, 0.52),
    sprintMultiplier: stageValue(ratio, 1, 0.86, 0.62, 0),
    jumpMultiplier: stageValue(ratio, 1, 0.9, 0.78, 0.62),
    dashMultiplier: stageValue(ratio, 1, 0.86, 0.7, 0.52),
    dashCooldownMultiplier: stageValue(ratio, 1, 1.12, 1.28, 1.55),
  };
}

function getPlayerBodyArmEffects(run, side = null) {
  const ratio = side === "left"
    ? getPlayerBodyPartRatio(run, "leftArm")
    : side === "right"
      ? getPlayerBodyPartRatio(run, "rightArm")
      : Math.min(getPlayerBodyPartRatio(run, "leftArm"), getPlayerBodyPartRatio(run, "rightArm"));
  return {
    recoilKickMultiplier: stageValue(ratio, 1, 1.18, 1.45, 1.95),
    spreadMultiplier: stageValue(ratio, 1, 1.12, 1.3, 1.6),
    reloadDurationMultiplier: stageValue(ratio, 1, 1.12, 1.3, 1.65),
    fireCooldownMultiplier: stageValue(ratio, 1, 1.06, 1.16, 1.32),
    meleeCooldownMultiplier: stageValue(ratio, 1, 1.15, 1.35, 1.75),
  };
}

function getPlayerBodyHeadEffects(run) {
  const ratio = getPlayerBodyPartRatio(run, "head");
  return {
    visionPenalty: stageValue(ratio, 0, 0.12, 0.24, 0.38),
    spreadMultiplier: stageValue(ratio, 1, 1.1, 1.25, 1.55),
    recoilKickMultiplier: stageValue(ratio, 1, 1.08, 1.18, 1.35),
  };
}

function getPlayerBodyCoreEffects(run) {
  const ratio = getPlayerBodyPartRatio(run, "core");
  return {
    incomingDamageMultiplier: stageValue(ratio, 1, 1.1, 1.25, 1.45),
    bleedDamagePerSecond: ratio <= 0 ? 2.5 : 0,
  };
}

function getPlayerBodyCombatEffects(run, side = null) {
  const arm = getPlayerBodyArmEffects(run, side);
  const head = getPlayerBodyHeadEffects(run);
  return {
    recoilKickMultiplier: arm.recoilKickMultiplier * head.recoilKickMultiplier,
    spreadMultiplier: arm.spreadMultiplier * head.spreadMultiplier,
    reloadDurationMultiplier: arm.reloadDurationMultiplier,
    fireCooldownMultiplier: arm.fireCooldownMultiplier,
    meleeCooldownMultiplier: arm.meleeCooldownMultiplier,
  };
}

function applyPlayerBodyMovementPenalties(config, effects) {
  const adjusted = { ...config };
  const scaleNumber = (key, multiplier) => {
    if (Number.isFinite(adjusted[key])) {
      adjusted[key] *= multiplier;
    }
  };
  scaleNumber("runSpeed", effects.moveMultiplier);
  if (Number.isFinite(adjusted.sprintSpeed)) {
    adjusted.sprintSpeed = effects.sprintMultiplier <= 0
      ? adjusted.runSpeed
      : adjusted.sprintSpeed * effects.moveMultiplier * effects.sprintMultiplier;
  }
  scaleNumber("jumpVelocity", effects.jumpMultiplier);
  scaleNumber("wallJumpVertical", effects.jumpMultiplier);
  scaleNumber("braceBoostVertical", effects.jumpMultiplier);
  scaleNumber("dashDistance", effects.dashMultiplier);
  scaleNumber("dashCarrySpeedMultiplier", effects.dashMultiplier);
  scaleNumber("wallJumpHorizontal", effects.moveMultiplier);
  scaleNumber("braceBoostHorizontal", effects.moveMultiplier);
  if (Number.isFinite(adjusted.dashCooldownMs)) {
    adjusted.dashCooldownMs *= effects.dashCooldownMultiplier;
  }
  return adjusted;
}

function applyPlayerBodyOngoingEffects(run, dt) {
  const coreEffects = getPlayerBodyCoreEffects(run);
  if (coreEffects.bleedDamagePerSecond > 0) {
    run.hp = clamp((run.hp ?? 0) - coreEffects.bleedDamagePerSecond * dt, 0, run.maxHp || 100);
  }
}

function damagePlayerBodyPart(run, amount, direction = 0) {
  const body = ensurePlayerBodyStatus(run);
  const roll = Math.random();
  const sideArm = direction >= 0 ? "leftArm" : "rightArm";
  const partKey = roll < 0.38
    ? "core"
    : roll < 0.62
      ? sideArm
      : roll < 0.82
        ? "legs"
        : roll < 0.92
          ? (sideArm === "leftArm" ? "rightArm" : "leftArm")
          : "head";
  const part = body[partKey];
  const partDamage = Math.max(1, Number(amount || 0) * (partKey === "head" ? 0.42 : partKey === "core" ? 0.58 : 0.72));
  part.hp = clamp((part.hp ?? part.maxHp ?? 100) - partDamage, 0, part.maxHp ?? 100);
  part.damaged = part.hp < (part.maxHp ?? 100);
  part.broken = part.hp <= 0;
  part.recentHit = 1.2;
}

function isPlayerDashDodging(player) {
  return Boolean(player.dashTimer > 0 && player.dashInvulnerable);
}

function isPlayerSlideDodging(player) {
  return Boolean(player.slideTimer > 0 && player.slideInvulnerable);
}

function isPlayerRunDodging(player, data) {
  const runSpeed = getMovementConfig(data).runSpeed ?? 440;
  return Boolean(
    player.onGround &&
    player.height === player.standHeight &&
    (
      player.sprintActive ||
      Math.abs(player.vx ?? 0) >= runSpeed * 0.62
    )
  );
}

function pushDodgeSandevistanAfterimages(run, shot) {
  const player = run.player;
  const direction = Math.sign(player.vx || player.facing || 1) || 1;
  const shotDirX = Math.sign(shot.vx || shot.dirX || -direction) || -direction;
  const offsets = [-52, -30, -12, 14, 34];
  offsets.forEach((offset, index) => {
    pushRecoilFocusAfterimage(run, {
      ...player,
      recoilFocusActive: true,
      recoilFocusBlend: 1,
      recoilAimFacing: player.recoilAimFacing || player.facing || 1,
      recoilDirX: -shotDirX,
      recoilDirY: 0,
    }, {
      offsetX: offset * direction,
      offsetY: (index - 2) * -2,
      life: 0.34 + index * 0.025,
    });
  });
}

function triggerProjectileDodge(run, shot, label = "DODGE") {
  if (shot.dodgeTriggered) {
    return;
  }
  shot.dodgeTriggered = true;
  run.dodgeSlowDuration = 0.42;
  run.dodgeSlowTimer = Math.max(run.dodgeSlowTimer ?? 0, run.dodgeSlowDuration);
  run.dodgeFx = run.dodgeFx || [];
  run.dodgeFx.push({
    x: run.player.x + run.player.width * 0.5,
    y: run.player.y + run.player.height * 0.42,
    label,
    life: 0.42,
    duration: 0.42,
  });
  pushDodgeSandevistanAfterimages(run, shot);
  spawnDirectedParticles(
    run,
    shot.x,
    shot.y,
    12,
    "#e9f7ff",
    -(shot.vx || shot.dirX || 1),
    -(shot.vy || shot.dirY || 0),
    320,
    0.95,
  );
}

function destroyHostileDrone(run, drone) {
  if (drone.dead) {
    return;
  }
  drone.dead = true;
  drone.active = false;
  drone.vx = 0;
  drone.vy = 0;
  spawnParticles(run, drone.x + drone.width / 2, drone.y + drone.height / 2, 18, "#87e1ff");
  spawnParticles(run, drone.x + drone.width / 2, drone.y + drone.height / 2, 8, "#ffd6ba");
}

function getFaceOffConfig(data) {
  return data.faceOff || {};
}

function getFaceOffBodyParts(data) {
  return getFaceOffConfig(data).bodyParts || [];
}

function getFaceOffDialogueOptions(data) {
  return getFaceOffConfig(data).dialogueOptions || [];
}

function getActiveFaceOffDialogueOptions(data, faceOff = null) {
  return Array.isArray(faceOff?.dialogueOptions) && faceOff.dialogueOptions.length
    ? faceOff.dialogueOptions
    : getFaceOffDialogueOptions(data);
}

function getFaceOffEventForEnemy(data, enemy) {
  if (!enemy?.id || !Array.isArray(data.faceOffEvents)) {
    return null;
  }
  return data.faceOffEvents.find((event) => (
    event?.trigger?.type === "enemy" && event.trigger.enemyId === enemy.id
  )) || null;
}

function getFaceOffEventLines(event) {
  return Array.isArray(event?.lines)
    ? event.lines.map((line) => String(line ?? "").trim()).filter(Boolean)
    : [];
}

function normalizeFaceOffEventChoices(event) {
  const sourceChoices = Array.isArray(event?.choices) ? event.choices : [];
  return sourceChoices.slice(0, FACE_OFF_DIALOGUE_KEYS.length).map((choice, index) => {
    const result = choice?.result && typeof choice.result === "object" ? choice.result : {};
    return {
      key: FACE_OFF_DIALOGUE_KEYS[index],
      label: choice?.label || `Choice ${index + 1}`,
      type: result.type || choice?.type || "knockdown",
      baseChance: 1,
      successEffect: result.type || choice?.type || "knockdown",
      eventChoiceId: choice?.id || `choice-${index + 1}`,
      eventResult: result,
    };
  });
}

function getHumanoidCenter(enemy) {
  return {
    x: enemy.x + enemy.width * 0.5,
    y: enemy.y + enemy.height * 0.46,
  };
}

function getFaceOffTarget(run) {
  const faceOff = run.faceOff;
  if (!faceOff?.active || !faceOff.targetId) {
    return null;
  }
  return (run.humanoidEnemies || []).find((enemy) => enemy.id === faceOff.targetId) || null;
}

function isHumanoidInFaceOffScope(enemy) {
  return Boolean(enemy && (enemy.id === "faceoff-guard-01" || enemy.knockdownEnabled));
}

function isHumanoidResolved(enemy) {
  return Boolean(
    enemy &&
    (
      enemy.disabled ||
      enemy.dead ||
      HUMANOID_RESOLVED_STATES.has(enemy.state) ||
      HUMANOID_RESOLVED_OUTCOMES.has(enemy.outcome)
    )
  );
}

function isHumanoidFaceOffAvailable(enemy) {
  return Boolean(enemy && !isHumanoidResolved(enemy));
}

function isHumanoidFaceOffCandidate(enemy) {
  return Boolean(
    isHumanoidFaceOffAvailable(enemy) &&
    isHumanoidInFaceOffScope(enemy) &&
    enemy.state === "knockedDown"
  );
}

function findFaceOffInteractionCandidate(run, data) {
  const config = getFaceOffConfig(data);
  const range = config.interactRange ?? 142;
  const playerCenter = getCenter(run.player);
  let best = null;
  let bestDistance = Infinity;

  for (const enemy of run.humanoidEnemies || []) {
    if (!isHumanoidFaceOffCandidate(enemy)) {
      continue;
    }
    const center = getHumanoidCenter(enemy);
    const distance = distanceBetween(playerCenter, center);
    if (distance > range + Math.max(enemy.width, enemy.height) * 0.5) {
      continue;
    }
    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }

  return best;
}

function getFaceOffEnemyLine(data, key, fallback) {
  const line = getFaceOffConfig(data).enemyLines?.[key];
  return typeof line === "string" && line.length ? line : fallback;
}

function setFaceOffEnemyLine(run, data, encounterState, lineKey, fallback) {
  const faceOff = run.faceOff;
  if (!faceOff) {
    return;
  }
  faceOff.encounterState = encounterState;
  faceOff.enemyLineQueue = null;
  faceOff.enemyLineQueueIndex = 0;
  faceOff.enemyLine = getFaceOffEnemyLine(data, lineKey, fallback);
  faceOff.enemyLineVisible = "";
  faceOff.enemyLineIndex = 0;
  faceOff.enemyLineTimer = 0;
  faceOff.enemyLineCharDelay = getFaceOffConfig(data).enemyLineCharDelay ?? 0.035;
  faceOff.choiceRevealTimer = 0;
  faceOff.choiceRevealHold = getFaceOffConfig(data).enemyLineHoldDuration ?? 0.35;
  faceOff.choiceRevealDuration = getFaceOffConfig(data).choiceSlideDuration ?? 0.26;
  faceOff.choiceRevealProgress = 0;
  faceOff.choicesReady = false;
}

function getFaceOffSelectedOption(faceOff, data) {
  const options = getActiveFaceOffDialogueOptions(data, faceOff);
  if (!options.length) {
    return null;
  }
  const current = options.find((option) => option.key === faceOff.selectedDialogueKey);
  return current || options[0];
}

function moveFaceOffSelectedOption(faceOff, data, direction) {
  const options = getActiveFaceOffDialogueOptions(data, faceOff);
  if (!options.length) {
    return;
  }
  const currentIndex = Math.max(0, options.findIndex((option) => option.key === faceOff.selectedDialogueKey));
  const nextIndex = (currentIndex + direction + options.length) % options.length;
  faceOff.selectedDialogueKey = options[nextIndex].key;
}

function isFaceOffResultExitButtonPressed(mouse) {
  if (!mouse?.primaryJustPressed) {
    return false;
  }
  const mx = mouse.screenX ?? 0;
  const my = mouse.screenY ?? 0;
  return (
    mx >= FACE_OFF_RESULT_EXIT_BUTTON.x &&
    mx <= FACE_OFF_RESULT_EXIT_BUTTON.x + FACE_OFF_RESULT_EXIT_BUTTON.width &&
    my >= FACE_OFF_RESULT_EXIT_BUTTON.y &&
    my <= FACE_OFF_RESULT_EXIT_BUTTON.y + FACE_OFF_RESULT_EXIT_BUTTON.height
  );
}

function setFaceOffLineText(faceOff, data, line) {
  faceOff.enemyLine = line || "";
  faceOff.enemyLineVisible = "";
  faceOff.enemyLineIndex = 0;
  faceOff.enemyLineTimer = 0;
  faceOff.enemyLineCharDelay = getFaceOffConfig(data).enemyLineCharDelay ?? 0.035;
  faceOff.choiceRevealTimer = 0;
  faceOff.choiceRevealHold = getFaceOffConfig(data).enemyLineHoldDuration ?? 0.35;
  faceOff.choiceRevealDuration = getFaceOffConfig(data).choiceSlideDuration ?? 0.26;
  faceOff.choiceRevealProgress = 0;
  faceOff.choicesReady = false;
}

function setFaceOffCustomLine(run, data, encounterState, line) {
  const faceOff = run.faceOff;
  if (!faceOff) {
    return;
  }
  faceOff.encounterState = encounterState;
  faceOff.enemyLineQueue = null;
  faceOff.enemyLineQueueIndex = 0;
  setFaceOffLineText(faceOff, data, line);
}

function setFaceOffCustomLines(run, data, encounterState, lines) {
  const faceOff = run.faceOff;
  if (!faceOff) {
    return;
  }
  const queue = (Array.isArray(lines) ? lines : [lines])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
  faceOff.encounterState = encounterState;
  faceOff.enemyLineQueue = queue;
  faceOff.enemyLineQueueIndex = 0;
  setFaceOffLineText(faceOff, data, queue[0] || "");
}

function getFaceOffShotReactionLine(part, damageResult, lethalPart = false) {
  const partId = part?.id || "";
  const brokeNow = Boolean(damageResult?.brokeNow);
  if (lethalPart && partId === "head") {
    return "??.. ???? ?쒕컻, 嫄곌릿 ?섏? 留?..";
  }
  if (lethalPart) {
    return "?⑥씠... ???ъ뼱?? 洹몃쭔... ?쒕컻...";
  }
  if (partId === "head") {
    return brokeNow ? "癒몃━媛 ?몃젮... ?꾨Т寃껊룄 ??蹂댁뿬..." : "癒몃━??????.. ?쒕컻 嫄곌릿 ?섏? 留?..";
  }
  if (partId === "torso") {
    return brokeNow ? "紐몄씠 ???吏곸뿬... ?⑥씠 留됲?..." : "??.. ?붾뒗 紐?踰꾪떚寃좎뼱...";
  }
  if (partId === "leftArm" || partId === "rightArm") {
    return brokeNow ? "?붿씠... ?붿씠 留먯쓣 ???ㅼ뼱..." : "????.. ?쒕컻, ?붿? ?섏? 留?..";
  }
  if (partId === "leftLeg" || partId === "rightLeg") {
    return brokeNow ? "?ㅻ━媛 ??몄뼱... ?꾨쭩??紐?媛..." : "?ㅻ━留뚯?... ?쒕컻 洹몃쭔...";
  }
  return brokeNow ? "留앷?議뚯뼱... ?댁젣 紐??吏곸뿬..." : "?꾪뙆... 洹몃쭔??..";
}

function getFaceOffBladeReactionLine(part, damageResult, lethalPart = false) {
  const partId = part?.id || "";
  const brokeNow = Boolean(damageResult?.brokeNow);
  if (lethalPart && partId === "head") {
    return "Blade to the head. It is over.";
  }
  if (lethalPart) {
    return "The blade finds the center line.";
  }
  if (brokeNow) {
    return `${part?.label || "Part"} disabled by the arm blade.`;
  }
  if (partId === "leftArm" || partId === "rightArm") {
    return "The arm blade bites into the guard.";
  }
  if (partId === "leftLeg" || partId === "rightLeg") {
    return "The blade cuts low and stops the advance.";
  }
  return "The arm blade carves through the opening.";
}

function playFaceOffBeep(faceOff) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const context = window.__faceOffAudioContext || new AudioContextClass();
    window.__faceOffAudioContext = context;
    if (context.state === "suspended") {
      context.resume?.();
    }
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const pitchSeed = (faceOff.enemyLineIndex ?? 0) % 5;
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(330 + pitchSeed * 18, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.04);
  } catch {
    // Audio is optional; browsers may block it until user gesture.
  }
}

function playFaceOffShotSound() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const context = window.__faceOffAudioContext || new AudioContextClass();
    window.__faceOffAudioContext = context;
    if (context.state === "suspended") {
      context.resume?.();
    }

    const now = context.currentTime;
    const duration = 0.18;
    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < bufferSize; index += 1) {
      const decay = 1 - index / bufferSize;
      channel[index] = (Math.random() * 2 - 1) * decay * decay;
    }

    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(1200, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(180, now + duration);
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(context.destination);
    noise.start(now);
    noise.stop(now + duration);

    const thump = context.createOscillator();
    const thumpGain = context.createGain();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(92, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.12);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.18, now + 0.004);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    thump.connect(thumpGain);
    thumpGain.connect(context.destination);
    thump.start(now);
    thump.stop(now + 0.17);
  } catch {
    // Shot feedback is visual-first; audio may be blocked by the browser.
  }
}

function playFaceOffBladeSound() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const context = window.__faceOffAudioContext || new AudioContextClass();
    window.__faceOffAudioContext = context;
    if (context.state === "suspended") {
      context.resume?.();
    }

    const now = context.currentTime;
    const duration = 0.13;
    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < bufferSize; index += 1) {
      const progress = index / bufferSize;
      channel[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, 1.7);
    }

    const hiss = context.createBufferSource();
    hiss.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    hiss.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    hiss.start(now);
    hiss.stop(now + duration);

    const scrape = context.createOscillator();
    const scrapeGain = context.createGain();
    scrape.type = "sawtooth";
    scrape.frequency.setValueAtTime(420, now);
    scrape.frequency.exponentialRampToValueAtTime(170, now + 0.09);
    scrapeGain.gain.setValueAtTime(0.0001, now);
    scrapeGain.gain.exponentialRampToValueAtTime(0.035, now + 0.004);
    scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    scrape.connect(scrapeGain);
    scrapeGain.connect(context.destination);
    scrape.start(now);
    scrape.stop(now + 0.11);
  } catch {
    // Blade feedback is optional; audio may be blocked by the browser.
  }
}

function getShotAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  const context = window.__silentPassageAudioContext || new AudioContextClass();
  window.__silentPassageAudioContext = context;
  if (context.state === "suspended") {
    context.resume?.();
  }
  return context;
}

function playWeaponShotSound(weaponStats = {}) {
  const context = getShotAudioContext();
  if (!context) {
    return;
  }
  try {
    const now = context.currentTime;
    const type = weaponStats.type || "pistol";
    const isShotgun = type === "shotgun";
    const isHeavy = type === "rifle" || type === "sniper";
    const duration = isShotgun ? 0.22 : isHeavy ? 0.16 : 0.12;
    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let index = 0; index < bufferSize; index += 1) {
      const progress = index / bufferSize;
      const decay = Math.pow(1 - progress, isShotgun ? 1.45 : 2.15);
      channel[index] = (Math.random() * 2 - 1) * decay;
    }

    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    const blastFilter = context.createBiquadFilter();
    blastFilter.type = "bandpass";
    blastFilter.frequency.setValueAtTime(isShotgun ? 760 : isHeavy ? 1280 : 1500, now);
    blastFilter.Q.setValueAtTime(isShotgun ? 0.58 : 0.82, now);
    const blastGain = context.createGain();
    blastGain.gain.setValueAtTime(0.0001, now);
    blastGain.gain.exponentialRampToValueAtTime(isShotgun ? 0.2 : isHeavy ? 0.16 : 0.11, now + 0.004);
    blastGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(blastFilter);
    blastFilter.connect(blastGain);
    blastGain.connect(context.destination);
    noise.start(now);
    noise.stop(now + duration);

    const thump = context.createOscillator();
    const thumpGain = context.createGain();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(isShotgun ? 78 : isHeavy ? 96 : 122, now);
    thump.frequency.exponentialRampToValueAtTime(isShotgun ? 34 : 52, now + duration * 0.8);
    thumpGain.gain.setValueAtTime(0.0001, now);
    thumpGain.gain.exponentialRampToValueAtTime(isShotgun ? 0.18 : 0.11, now + 0.006);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.88);
    thump.connect(thumpGain);
    thumpGain.connect(context.destination);
    thump.start(now);
    thump.stop(now + duration);

    const snap = context.createOscillator();
    const snapGain = context.createGain();
    snap.type = "square";
    snap.frequency.setValueAtTime(isHeavy ? 420 : 520, now);
    snapGain.gain.setValueAtTime(0.0001, now);
    snapGain.gain.exponentialRampToValueAtTime(isShotgun ? 0.028 : 0.038, now + 0.002);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    snap.connect(snapGain);
    snapGain.connect(context.destination);
    snap.start(now);
    snap.stop(now + 0.032);

    window.__lastWeaponShotSoundAt = Date.now();
  } catch {
    // Browser audio can be unavailable; firing still keeps visual feedback.
  }
}

function triggerWeaponShotFeedback(run, state, weaponStats, aim) {
  playWeaponShotSound(weaponStats);
  const recoilAmount = clamp((weaponStats?.recoil ?? 840) / 980, 0.45, 1.75);
  const duration = clamp((weaponStats?.fireCooldown ?? 0.16) * 0.72, 0.08, 0.18);
  const dirX = -Number(aim?.shotDirX || 0);
  const dirY = -Number(aim?.shotDirY || 0);
  run.weaponKick = {
    timer: duration,
    duration,
    intensity: 4.5 + recoilAmount * 5.5,
    dirX,
    dirY,
    seed: Math.random() * 1000,
  };
  if (state?.mouse) {
    const cursorKick = 3.2 + recoilAmount * 4.6;
    state.mouse.screenX = clamp(
      (state.mouse.screenX ?? CAMERA_SCREEN_WIDTH / 2) + dirX * cursorKick + (Math.random() - 0.5) * cursorKick * 0.75,
      0,
      CAMERA_SCREEN_WIDTH,
    );
    state.mouse.screenY = clamp(
      (state.mouse.screenY ?? CAMERA_SCREEN_HEIGHT / 2) + dirY * cursorKick + (Math.random() - 0.5) * cursorKick * 0.75,
      0,
      CAMERA_SCREEN_HEIGHT,
    );
  }
}

function triggerFaceOffShotFeedback(run, data) {
  const faceOff = run.faceOff;
  if (!faceOff) {
    return;
  }
  faceOff.shotShakeDuration = getFaceOffConfig(data).shotShakeDuration ?? 0.22;
  faceOff.shotShakeIntensity = getFaceOffConfig(data).shotShakeIntensity ?? 18;
  faceOff.shotShakeTimer = faceOff.shotShakeDuration;
  faceOff.shotFlashDuration = getFaceOffConfig(data).shotFlashDuration ?? 0.16;
  faceOff.shotFlashTimer = faceOff.shotFlashDuration;
  faceOff.visualState = "shot";
  faceOff.visualStateTimer = 0.75;
  playFaceOffShotSound();
}

function triggerFaceOffBladeFeedback(run, data) {
  const faceOff = run.faceOff;
  if (!faceOff) {
    return;
  }
  faceOff.shotShakeDuration = Math.max(0.08, (getFaceOffConfig(data).shotShakeDuration ?? 0.22) * 0.62);
  faceOff.shotShakeIntensity = Math.max(6, (getFaceOffConfig(data).shotShakeIntensity ?? 18) * 0.58);
  faceOff.shotShakeTimer = faceOff.shotShakeDuration;
  faceOff.shotFlashDuration = Math.max(0.06, (getFaceOffConfig(data).shotFlashDuration ?? 0.16) * 0.5);
  faceOff.shotFlashTimer = faceOff.shotFlashDuration;
  playFaceOffBladeSound();
}

function updateFaceOffEnemyLine(faceOff, dt) {
  if (!faceOff?.enemyLine || faceOff.enemyLineIndex >= faceOff.enemyLine.length) {
    return;
  }
  faceOff.enemyLineTimer += dt;
  const delay = Math.max(0.01, faceOff.enemyLineCharDelay ?? 0.035);
  while (faceOff.enemyLineTimer >= delay && faceOff.enemyLineIndex < faceOff.enemyLine.length) {
    faceOff.enemyLineTimer -= delay;
    faceOff.enemyLineIndex += 1;
    faceOff.enemyLineVisible = faceOff.enemyLine.slice(0, faceOff.enemyLineIndex);
    const char = faceOff.enemyLine[faceOff.enemyLineIndex - 1];
    if (char && char.trim()) {
      playFaceOffBeep(faceOff);
    }
  }
}

function isFaceOffEnemyLineComplete(faceOff) {
  return !faceOff?.enemyLine || faceOff.enemyLineIndex >= faceOff.enemyLine.length;
}

function updateFaceOffChoiceReveal(faceOff, data, dt) {
  if (!faceOff) {
    return;
  }
  if (!isFaceOffEnemyLineComplete(faceOff)) {
    faceOff.choiceRevealTimer = 0;
    faceOff.choiceRevealProgress = 0;
    faceOff.choicesReady = false;
    return;
  }

  const config = getFaceOffConfig(data);
  const hold = Math.max(0, config.enemyLineHoldDuration ?? faceOff.choiceRevealHold ?? 0.35);
  const duration = Math.max(0.001, config.choiceSlideDuration ?? faceOff.choiceRevealDuration ?? 0.26);
  faceOff.choiceRevealHold = hold;
  faceOff.choiceRevealDuration = duration;

  const queue = Array.isArray(faceOff.enemyLineQueue) ? faceOff.enemyLineQueue : [];
  const nextQueueIndex = (faceOff.enemyLineQueueIndex ?? 0) + 1;
  if (nextQueueIndex < queue.length) {
    faceOff.choiceRevealTimer = Math.min(hold, (faceOff.choiceRevealTimer ?? 0) + dt);
    faceOff.choiceRevealProgress = 0;
    faceOff.choicesReady = false;
    if (faceOff.choiceRevealTimer >= hold) {
      faceOff.enemyLineQueueIndex = nextQueueIndex;
      setFaceOffLineText(faceOff, data, queue[nextQueueIndex]);
    }
    return;
  }

  faceOff.choiceRevealTimer = Math.min(hold + duration, (faceOff.choiceRevealTimer ?? 0) + dt);
  faceOff.choiceRevealProgress = clamp((faceOff.choiceRevealTimer - hold) / duration, 0, 1);
  faceOff.choicesReady = faceOff.choiceRevealProgress >= 1;
}

function revealFaceOffChoicesNow(faceOff) {
  if (!faceOff) {
    return;
  }
  if (faceOff.enemyLine) {
    faceOff.enemyLineIndex = faceOff.enemyLine.length;
    faceOff.enemyLineVisible = faceOff.enemyLine;
  }
  if (Array.isArray(faceOff.enemyLineQueue) && faceOff.enemyLineQueue.length) {
    const lastIndex = faceOff.enemyLineQueue.length - 1;
    faceOff.enemyLineQueueIndex = lastIndex;
    faceOff.enemyLine = faceOff.enemyLineQueue[lastIndex] || faceOff.enemyLine;
    faceOff.enemyLineVisible = faceOff.enemyLine;
    faceOff.enemyLineIndex = faceOff.enemyLine.length;
  }
  faceOff.choiceRevealTimer = (faceOff.choiceRevealHold ?? 0) + (faceOff.choiceRevealDuration ?? 0.26);
  faceOff.choiceRevealProgress = 1;
  faceOff.choicesReady = true;
}

function enterFaceOff(run, data, enemy, state) {
  const faceOff = run.faceOff;
  if (!faceOff || faceOff.active || !isHumanoidFaceOffCandidate(enemy)) {
    return;
  }
  enemy.active = false;
  enemy.trigger = 0;
  enemy.staggerTimer = 0;
  faceOff.active = true;
  faceOff.targetId = enemy.id;
  faceOff.hoverPart = null;
  faceOff.selectedPart = "torso";
  faceOff.selectedDialogueKey = "KeyW";
  faceOff.acquireTargetId = enemy.id;
  faceOff.acquireTimer = getFaceOffConfig(data).acquireDuration ?? 1;
  faceOff.acquireProgress = 1;
  faceOff.acquireDuration = getFaceOffConfig(data).acquireDuration ?? 1;
  faceOff.entryTransitionDuration = getFaceOffConfig(data).entryZoomDuration ?? 1;
  faceOff.entryTransitionTimer = faceOff.entryTransitionDuration;
  faceOff.entryTransitionStartedAt = typeof performance !== "undefined" ? performance.now() : 0;
  faceOff.cursorAssistDuration = getFaceOffConfig(data).cursorAssistDuration ?? 0.34;
  faceOff.cursorAssistTimer = faceOff.cursorAssistDuration;
  faceOff.cursorAssistStartX = state.mouse?.screenX ?? CAMERA_SCREEN_WIDTH / 2;
  faceOff.cursorAssistStartY = state.mouse?.screenY ?? CAMERA_SCREEN_HEIGHT / 2;
  faceOff.cursorAssistTargetX = CAMERA_SCREEN_WIDTH / 2;
  faceOff.cursorAssistTargetY = getFaceOffConfig(data).targetAimAssistY ?? 386;
  faceOff.timeline = 0;
  faceOff.triggerLimit = getFaceOffConfig(data).triggerLimit ?? 4.5;
  faceOff.result = null;
  faceOff.resultTimer = 0;
  faceOff.message = "";
  faceOff.visualState = "plead";
  faceOff.visualStateTimer = 0;
  const event = getFaceOffEventForEnemy(data, enemy);
  if (event) {
    faceOff.eventId = event.id || "";
    faceOff.eventChoiceResults = {};
    faceOff.dialogueOptions = normalizeFaceOffEventChoices(event);
    faceOff.dialogueOptions.forEach((option) => {
      faceOff.eventChoiceResults[option.key] = option.eventResult || {};
    });
    faceOff.cinematic = event.cinematic || {};
    setFaceOffCustomLines(run, data, "event", getFaceOffEventLines(event));
  } else {
    faceOff.eventId = "";
    faceOff.eventChoiceResults = null;
    faceOff.dialogueOptions = null;
    faceOff.cinematic = null;
    setFaceOffEnemyLine(
      run,
      data,
      "knockdown",
      "knockdown",
      "?대젮以?.. 諛섍꺽???섎룄 ?놁뼱.",
    );
  }
  run.player.vx = 0;
  run.player.vy = Math.min(run.player.vy, 0);
  if (run.loot?.active) {
    closeLootCrate(run);
  }
}

function closeFaceOff(run, message = "") {
  if (!run.faceOff) {
    return;
  }
  run.faceOff.active = false;
  run.faceOff.targetId = null;
  run.faceOff.hoverPart = null;
  run.faceOff.acquireTargetId = null;
  run.faceOff.acquireTimer = 0;
  run.faceOff.acquireProgress = 0;
  run.faceOff.entryTransitionTimer = 0;
  run.faceOff.entryTransitionStartedAt = 0;
  run.faceOff.cursorAssistTimer = 0;
  run.faceOff.enemyLine = "";
  run.faceOff.enemyLineVisible = "";
  run.faceOff.enemyLineIndex = 0;
  run.faceOff.enemyLineTimer = 0;
  run.faceOff.enemyLineQueue = null;
  run.faceOff.enemyLineQueueIndex = 0;
  run.faceOff.eventId = "";
  run.faceOff.eventChoiceResults = null;
  run.faceOff.dialogueOptions = null;
  run.faceOff.cinematic = null;
  run.faceOff.choiceRevealTimer = 0;
  run.faceOff.choiceRevealProgress = 0;
  run.faceOff.choicesReady = false;
  run.faceOff.shotShakeTimer = 0;
  run.faceOff.shotFlashTimer = 0;
  run.faceOff.visualState = "idle";
  run.faceOff.visualStateTimer = 0;
  run.faceOff.result = null;
  run.faceOff.resultTimer = 0;
  run.faceOff.message = message;
}

function finishFaceOff(run, enemy, result, message) {
  if (!enemy || !run.faceOff) {
    return;
  }
  enemy.outcome = result;
  enemy.active = false;
  enemy.trigger = 0;
  enemy.attackCooldown = Math.max(enemy.attackCooldown ?? 0, 1.2);
  run.faceOff.result = result;
  run.faceOff.resultTimer = 0.55;
  run.faceOff.message = message;
  run.faceOff.visualState = result || "result";
  run.faceOff.visualStateTimer = 1.2;

  if (result === "kill") {
    killHumanoidEnemy(run, enemy, "");
  } else if (result === "disable") {
    enemy.state = "disabled";
    enemy.disabled = true;
    spawnParticles(run, enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.62, 14, "#dce7ec");
  } else if (result === "surrender") {
    enemy.surrendered = true;
    enemy.state = "surrendered";
    run.materials += 8;
    pushNotice(run, "Face-off: surrender.");
  } else if (result === "deal") {
    enemy.dealt = true;
    enemy.state = "dealt";
    run.materials += 16;
    pushClue(run, `${enemy.id}-deal`, "Face-off deal: supply route marked.");
    pushNotice(run, "Face-off: deal secured.");
  } else if (result === "release") {
    enemy.released = true;
    enemy.state = "released";
    enemy.escapeTargetX = null;
    pushNotice(run, "Face-off: released.");
  }
}

function getFaceOffAimPan(data, mouseY, screenHeight = CAMERA_SCREEN_HEIGHT) {
  const config = getFaceOffConfig(data);
  const pivotY = config.targetAimPivotY ?? 362;
  const lowerTravel = Math.max(1, screenHeight - pivotY);
  return clamp((mouseY - pivotY) / lowerTravel, 0, 1) * (config.targetAimPanMax ?? 330);
}

function getFaceOffTargetZones(data, mouseY, screenWidth = CAMERA_SCREEN_WIDTH, screenHeight = CAMERA_SCREEN_HEIGHT) {
  const config = getFaceOffConfig(data);
  const scale = config.targetAimScale ?? 1.62;
  const cx = screenWidth / 2;
  const top = (config.targetAimTop ?? 128) - getFaceOffAimPan(data, mouseY, screenHeight);
  const zone = (id, x, y, width, height) => ({
    id,
    x: cx + x * scale,
    y: top + y * scale,
    width: width * scale,
    height: height * scale,
  });
  return [
    zone("head", -45, 0, 90, 86),
    zone("torso", -74, 98, 148, 190),
    zone("leftArm", -158, 116, 68, 170),
    zone("rightArm", 90, 116, 68, 170),
    zone("leftLeg", -78, 287, 64, 205),
    zone("rightLeg", 14, 287, 64, 205),
  ];
}

function getFaceOffPartAtMouse(state, data) {
  const mouse = state.mouse || {};
  const mx = mouse.screenX ?? CAMERA_SCREEN_WIDTH / 2;
  const my = mouse.screenY ?? CAMERA_SCREEN_HEIGHT / 2;
  const zones = getFaceOffTargetZones(data, my);
  const hit = zones.find((zone) => (
    mx >= zone.x &&
    mx <= zone.x + zone.width &&
    my >= zone.y &&
    my <= zone.y + zone.height
  ));
  const parts = getFaceOffBodyParts(data);
  return hit && parts.some((part) => part.id === hit.id) ? hit.id : null;
}

function mapFaceOffPartToHumanoidPart(partId) {
  if (partId === "head" || partId === "torso" || partId === "core") {
    return "core";
  }
  if (partId === "leftArm" || partId === "rightArm" || partId === "arm") {
    return "arm";
  }
  if (partId === "leftLeg" || partId === "rightLeg" || partId === "leg") {
    return "leg";
  }
  return "core";
}

function getFaceOffPartBreakVisualState(partId) {
  if (partId === "head") {
    return "break-head";
  }
  if (partId === "torso" || partId === "core") {
    return "break-torso";
  }
  if (partId === "leftArm" || partId === "rightArm" || partId === "arm") {
    return "break-arm";
  }
  if (partId === "leftLeg" || partId === "rightLeg" || partId === "leg") {
    return "break-leg";
  }
  return "shot";
}

function getFaceOffPartHitVisualState(partId) {
  if (partId === "head") {
    return "hit-head";
  }
  if (partId === "torso" || partId === "core") {
    return "hit-torso";
  }
  if (partId === "leftArm" || partId === "rightArm" || partId === "arm") {
    return "hit-arm";
  }
  if (partId === "leftLeg" || partId === "rightLeg" || partId === "leg") {
    return "hit-leg";
  }
  return "shot";
}

function applyFaceOffPartDamage(enemy, partId, amount) {
  const partKey = mapFaceOffPartToHumanoidPart(partId);
  const partState = enemy?.parts?.[partKey];
  if (!partState) {
    return { partKey, hp: 0, maxHp: 1, broken: false, brokeNow: false };
  }
  const maxHp = Math.max(1, Number(partState.maxHp ?? partState.hp ?? 1));
  const beforeBroken = Boolean(partState.broken);
  const beforeHp = beforeBroken ? 0 : Math.max(0, Number(partState.hp ?? maxHp));
  const nextHp = Math.max(0, beforeHp - Math.max(0, amount));
  partState.maxHp = maxHp;
  partState.hp = nextHp;
  if (nextHp <= 0) {
    partState.broken = true;
  }
  return {
    partKey,
    hp: nextHp,
    maxHp,
    broken: Boolean(partState.broken),
    brokeNow: !beforeBroken && Boolean(partState.broken),
  };
}

function getDialogueChance(enemy, option) {
  const social = enemy.social || {};
  const resolve = Number(social.resolve ?? 0.5);
  const fear = Number(social.fear ?? 0.5);
  const trust = Number(social.trust ?? 0.5);
  const aggression = Number(social.aggression ?? 0.5);
  const reason = Number(social.reason ?? 0.5);
  let chance = Number(option.baseChance ?? 0.45);

  if (option.type === "threaten") {
    chance += fear * 0.24 - resolve * 0.16 - aggression * 0.08;
  } else if (option.type === "deescalate") {
    chance += reason * 0.18 + trust * 0.12 - aggression * 0.18;
  } else if (option.type === "persuade") {
    chance += trust * 0.2 + reason * 0.16 - resolve * 0.08;
  } else if (option.type === "stall") {
    chance += reason * 0.12 + fear * 0.08 - aggression * 0.1;
  }

  chance -= Math.max(0, enemy.dialogueFailures ?? 0) * 0.08;
  if ((enemy.dialogueStage ?? 0) > 0 && option.successEffect === "dealProgress") {
    chance -= 0.1;
  }
  return clamp(chance, 0.05, 0.92);
}

function applyFaceOffAttack(run, data, enemy) {
  const faceOff = run.faceOff;
  const parts = getFaceOffBodyParts(data);
  const part = parts.find((entry) => entry.id === faceOff.selectedPart) || parts.find((entry) => entry.id === "torso");
  if (!part) {
    return;
  }

  if (isMeleeSlotSelected(run, data)) {
    const partDamage = Math.max(1, Number(part.damage ?? 0)) * 0.88;
    const partDamageResult = applyFaceOffPartDamage(enemy, part.id, partDamage);
    const lethalPart = part.id === "head" || partDamage >= 68;
    const breakBonus = partDamageResult.brokeNow ? 34 : 0;
    enemy.disableMeter = Math.max(0, (enemy.disableMeter ?? 0) + ((part.disable ?? 0) + breakBonus) * 1.18);
    enemy.hitFlash = 0.2;
    enemy.staggerTimer = Math.max(enemy.staggerTimer ?? 0, enemy.knockdownStaggerDuration ?? 0.45);
    triggerFaceOffBladeFeedback(run, data);
    faceOff.visualState = partDamageResult.brokeNow
      ? getFaceOffPartBreakVisualState(part.id)
      : getFaceOffPartHitVisualState(part.id);
    faceOff.visualStateTimer = partDamageResult.brokeNow ? 1.15 : 0.82;
    setFaceOffCustomLine(run, data, "shot", getFaceOffBladeReactionLine(part, partDamageResult, lethalPart));
    spawnParticles(run, enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.45, 10, "#f3ff9a");

    if (lethalPart) {
      enemy.hp = 0;
      finishFaceOff(run, enemy, "kill", "kill");
      return;
    }
    if (enemy.disableMeter >= (enemy.disableThreshold ?? 100)) {
      finishFaceOff(run, enemy, "disable", "disable");
      return;
    }
    faceOff.message = partDamageResult.brokeNow
      ? `${part.label}: blade disabled`
      : `${part.label}: blade ${Math.ceil(partDamageResult.hp)}/${partDamageResult.maxHp}`;
    return;
  }

  const weaponContext = getSelectedArmContext(run, data);
  if ((weaponContext.arm.reloadTimer ?? 0) > 0) {
    faceOff.message = `${weaponContext.stats.label}: reloading`;
    return;
  }
  if ((weaponContext.arm.magazine ?? 0) <= 0) {
    faceOff.message = `${weaponContext.stats.label}: empty`;
    setFaceOffEnemyLine(run, data, "knockdown", "failed", "珥앸룄 鍮꾩뿀??");
    return;
  }

  weaponContext.arm.magazine = Math.max(0, Math.floor(weaponContext.arm.magazine ?? 0) - 1);
  weaponContext.arm.fireCooldownTimer = weaponContext.stats.fireCooldown;
  run.player.recoilShotCooldownTimer = weaponContext.arm.fireCooldownTimer;

  const weaponDamageScale = weaponContext.stats.type === "shotgun" ? 1 : 0.58;
  const partDamage = Math.max(0, Number(part.damage ?? 0)) * weaponDamageScale;
  const partDamageResult = applyFaceOffPartDamage(enemy, part.id, partDamage);
  const lethalPart = part.id === "head" || (part.id === "torso" && weaponContext.stats.type === "shotgun") || partDamage >= 50;
  const breakBonus = partDamageResult.brokeNow ? 26 : 0;
  enemy.disableMeter = Math.max(0, (enemy.disableMeter ?? 0) + ((part.disable ?? 0) + breakBonus) * Math.max(0.25, weaponContext.stats.knockdownPower ?? 1));
  enemy.hitFlash = 0.18;
  enemy.staggerTimer = enemy.knockdownStaggerDuration ?? 0.45;
  triggerFaceOffShotFeedback(run, data);
  faceOff.visualState = partDamageResult.brokeNow
    ? getFaceOffPartBreakVisualState(part.id)
    : getFaceOffPartHitVisualState(part.id);
  faceOff.visualStateTimer = partDamageResult.brokeNow ? 1.15 : 0.75;
  setFaceOffCustomLine(run, data, "shot", getFaceOffShotReactionLine(part, partDamageResult, lethalPart));
  spawnParticles(run, enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.45, 8, "#ffd6ba");

  if (lethalPart) {
    enemy.hp = 0;
    finishFaceOff(run, enemy, "kill", "kill");
    return;
  }
  if (enemy.disableMeter >= (enemy.disableThreshold ?? 100)) {
    finishFaceOff(run, enemy, "disable", "disable");
    return;
  }
  faceOff.message = partDamageResult.brokeNow
    ? `${part.label}: broken`
    : `${part.label}: hit ${Math.ceil(partDamageResult.hp)}/${partDamageResult.maxHp}`;
}

function getRecoverablePartIdFromFaceOff(run, data, enemy, result = {}) {
  if (result.partId) {
    return result.partId;
  }
  const selectedPart = run.faceOff?.selectedPart;
  const mappedPart = selectedPart === "rightArm" ? "arm" : selectedPart === "rightLeg" || selectedPart === "leftLeg" ? "leg" : selectedPart;
  const enemyPart = enemy?.parts?.[mappedPart];
  return enemyPart?.dropPartId || getFaceOffConfig(data).recoverablePartId || "";
}

function applyFaceOffEventResult(state, run, data, enemy, option) {
  const result = option.eventResult || {};
  const type = result.type || option.type;
  const resultMessage = result.message || option.label || "";
  run.faceOff.selectedDialogueKey = option.key;

  if (type === "recoverPart") {
    const partId = getRecoverablePartIdFromFaceOff(run, data, enemy, result);
    if (partId) {
      ensurePartInventory(state.meta, data);
      if (!state.meta.partInventory.some((part) => (part.id || part) === partId)) {
        state.meta.partInventory.push(partId);
      }
      ensurePartInventory(state.meta, data);
      saveMetaState(state.meta);
      pushNotice(run, "Face-off: parts recovered.");
    }
    setFaceOffCustomLine(run, data, "event", result.line || "?뚯닔 ?좏샇媛 ?먮걹?쇰줈 ??꺼 ?붾떎.");
    finishFaceOff(run, enemy, "disable", resultMessage || "parts recovered");
    return true;
  }

  if (type === "knockdown") {
    setFaceOffCustomLine(run, data, "event", result.line || "?곷?媛 ?꾩쟾??臾대젰?붾릱??");
    finishFaceOff(run, enemy, "disable", resultMessage || "disabled");
    return true;
  }

  if (type === "spare") {
    setFaceOffCustomLine(run, data, "event", result.line || "湲몄쓣 鍮꾩폒以??");
    finishFaceOff(run, enemy, "release", resultMessage || "released");
    return true;
  }

  if (type === "resumeCombat") {
    enemy.state = "patrol";
    enemy.active = true;
    enemy.disabled = false;
    enemy.staggerTimer = 0;
    enemy.hp = Math.max(1, enemy.hp || Math.floor((enemy.maxHp || 100) * 0.35));
    closeFaceOff(run, "resumeCombat");
    pushNotice(run, "Face-off: combat resumed.");
    return true;
  }

  if (type === "setFlag") {
    run.eventFlags = run.eventFlags || {};
    const flag = result.flag || `${run.faceOff?.eventId || enemy.id}:${option.eventChoiceId || option.key}`;
    run.eventFlags[flag] = result.value ?? true;
    setFaceOffCustomLine(run, data, "event", result.line || "?곹깭媛 湲곕줉?먮떎.");
    finishFaceOff(run, enemy, "deal", resultMessage || "recorded");
    return true;
  }

  return false;
}

function applyFaceOffDialogue(state, run, data, enemy, option) {
  if (option?.eventResult) {
    return applyFaceOffEventResult(state, run, data, enemy, option);
  }
  const faceOff = run.faceOff;
  const chance = getDialogueChance(enemy, option);
  faceOff.selectedDialogueKey = option.key;
  setFaceOffEnemyLine(run, data, "dialogue", "dialogue", "留먮줈 ?앸궡怨??띕떎硫?鍮⑤━ 留먰빐.");

  if (Math.random() <= chance) {
    if (option.successEffect === "dealProgress") {
      enemy.dialogueStage = (enemy.dialogueStage ?? 0) + 1;
      if (enemy.dialogueStage >= 2) {
        setFaceOffEnemyLine(run, data, "dialogue", "persuadeDeal", "醫뗭븘. 猷⑦듃 ?섎굹???뚮젮二쇱?.");
        finishFaceOff(run, enemy, "deal", "deal");
      } else {
        setFaceOffEnemyLine(run, data, "dialogue", "persuadeLead", "?뺣낫? ?ㅺ? 萸?以????덈뒗??");
        faceOff.message = "deal lead";
      }
      return;
    }
    if (option.type === "threaten") {
      setFaceOffEnemyLine(run, data, "dialogue", "threatenSuccess", "?뚯븯?? 珥??대젮?볦쓣寃?");
    } else if (option.type === "deescalate") {
      setFaceOffEnemyLine(run, data, "dialogue", "deescalateSuccess", "醫뗭븘... ?좉퉸 硫덉텛吏.");
    }
    finishFaceOff(run, enemy, "surrender", "surrender");
    return;
  }

  enemy.dialogueFailures = (enemy.dialogueFailures ?? 0) + 1;
  const social = enemy.social || {};
  enemy.social = social;
  social.trust = clamp(Number(social.trust ?? 0.5) - 0.04, 0, 1);
  social.fear = clamp(Number(social.fear ?? 0.5) + 0.04, 0, 1);
  social.aggression = clamp(Number(social.aggression ?? 0.5) + 0.03, 0, 1);
  if (option.type === "threaten") {
    setFaceOffEnemyLine(run, data, "dialogue", "threatenFail", "洹??묐컯? ???듯빐.");
  } else if (option.type === "deescalate") {
    setFaceOffEnemyLine(run, data, "dialogue", "deescalateFail", "硫덉텛??嫄???履쎌씠??");
  } else {
    setFaceOffEnemyLine(run, data, "dialogue", "persuadeFail", "移쒓뎄 媛숈? ?뚮━ ?섏? 留?");
  }
  faceOff.message = "dialogue failed";
}

function failFaceOff(run, data, enemy) {
  if (!enemy || !run.faceOff) {
    return;
  }
  setFaceOffEnemyLine(run, data, "knockdown", "failed", "?볦튂硫?湲곗뼱?쒕씪???꾨쭩移?嫄곗빞.");
  closeFaceOff(run, "cancelled");
}

function updateFaceOffCursorAssist(state, faceOff, dt) {
  if (!(faceOff.cursorAssistTimer > 0) || !state.mouse) {
    return;
  }

  const duration = Math.max(0.001, faceOff.cursorAssistDuration ?? 0.34);
  faceOff.cursorAssistTimer = Math.max(0, faceOff.cursorAssistTimer - dt);
  const progress = clamp(1 - faceOff.cursorAssistTimer / duration, 0, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  state.mouse.screenX = lerp(faceOff.cursorAssistStartX ?? CAMERA_SCREEN_WIDTH / 2, faceOff.cursorAssistTargetX ?? CAMERA_SCREEN_WIDTH / 2, eased);
  state.mouse.screenY = lerp(faceOff.cursorAssistStartY ?? CAMERA_SCREEN_HEIGHT / 2, faceOff.cursorAssistTargetY ?? 327, eased);
}

function updateFaceOffArmSelection(run, data, state) {
  if (consumeEitherPress(state, ARM_LEFT_KEYS)) {
    setSelectedArm(run, data, "left");
  }
  if (consumeEitherPress(state, ARM_RIGHT_KEYS)) {
    setSelectedArm(run, data, "right");
  }
}

function updateFaceOffWeaponRuntime(run, data, state, dt) {
  updateFaceOffArmSelection(run, data, state);
  if (consumeEitherPress(state, RELOAD_KEYS)) {
    startReloadSelectedArm(run, data);
  }
  updateWeaponTimers(run, data, dt);
}

function updateFaceOff(state, data, dt, activeDt = dt) {
  const run = state.run;
  const faceOff = run.faceOff;
  if (!faceOff?.active) {
    faceOff.acquireTargetId = null;
    faceOff.acquireTimer = 0;
    faceOff.acquireProgress = 0;
    return false;
  }

  const enemy = getFaceOffTarget(run);
  const entryTransitionTimer = Number.isFinite(faceOff.entryTransitionTimer) ? faceOff.entryTransitionTimer : 0;
  faceOff.entryTransitionTimer = Math.max(0, entryTransitionTimer - dt);
  faceOff.shotShakeTimer = Math.max(0, (faceOff.shotShakeTimer ?? 0) - dt);
  faceOff.shotFlashTimer = Math.max(0, (faceOff.shotFlashTimer ?? 0) - dt);
  faceOff.visualStateTimer = Math.max(0, (faceOff.visualStateTimer ?? 0) - dt);
  updateFaceOffCursorAssist(state, faceOff, dt);
  faceOff.aimX = state.mouse?.screenX ?? CAMERA_SCREEN_WIDTH / 2;
  faceOff.aimY = state.mouse?.screenY ?? CAMERA_SCREEN_HEIGHT / 2;

  if (faceOff.result) {
    faceOff.resultTimer = Math.max(0, (faceOff.resultTimer ?? 0) - dt);
    const exitPressed = consumeEitherPress(state, [...FACE_OFF_CANCEL_KEYS, ...INTERACT_KEYS, "Enter"]);
    const exitByMouse = Boolean(state.mouse?.secondaryJustPressed || isFaceOffResultExitButtonPressed(state.mouse));
    if (state.mouse) {
      state.mouse.secondaryJustPressed = false;
      state.mouse.primaryJustPressed = false;
    }
    if (exitPressed || exitByMouse) {
      closeFaceOff(run, faceOff.result);
      return false;
    }
    return true;
  }

  const cancelByMouse = Boolean(state.mouse?.secondaryJustPressed);
  const cancelPressed = consumeEitherPress(state, FACE_OFF_CANCEL_KEYS) || cancelByMouse;
  if (state.mouse) {
    state.mouse.secondaryJustPressed = false;
  }
  if (cancelPressed) {
    if (cancelByMouse && state.mouse) {
      state.mouse.secondaryDown = false;
    }
    closeFaceOff(run, "cancelled");
    return false;
  }

  updateFaceOffWeaponRuntime(run, data, state, dt);
  updateFaceOffEnemyLine(faceOff, dt);
  updateFaceOffChoiceReveal(faceOff, data, dt);

  if (!isHumanoidFaceOffCandidate(enemy)) {
    closeFaceOff(run);
    return false;
  }

  faceOff.hoverPart = getFaceOffPartAtMouse(state, data);
  if (faceOff.hoverPart) {
    faceOff.selectedPart = faceOff.hoverPart;
  }
  faceOff.timeline = 0;
  enemy.trigger = 0;

  if (consumePress(state, FACE_OFF_RELEASE_KEY)) {
    finishFaceOff(run, enemy, "release", "release");
    return true;
  }

  if (consumeEitherPress(state, FACE_OFF_MENU_UP_KEYS)) {
    moveFaceOffSelectedOption(faceOff, data, -1);
  }
  if (consumeEitherPress(state, FACE_OFF_MENU_DOWN_KEYS)) {
    moveFaceOffSelectedOption(faceOff, data, 1);
  }
  if (consumeEitherPress(state, FACE_OFF_MENU_CONFIRM_KEYS)) {
    if (!faceOff.choicesReady) {
      revealFaceOffChoicesNow(faceOff);
    }
    const option = getFaceOffSelectedOption(faceOff, data);
    if (option) {
      applyFaceOffDialogue(state, run, data, enemy, option);
    }
  }

  if (state.mouse?.primaryJustPressed) {
    applyFaceOffAttack(run, data, enemy);
  }
  if (state.mouse) {
    state.mouse.primaryJustPressed = false;
  }

  return Boolean(run.faceOff?.active);
}

function setMovementState(player) {
  if (player.zipLineActive) {
    player.movementState = MOVEMENT_STATES.ZIPLINE;
  } else if (player.dashTimer > 0) {
    player.movementState = MOVEMENT_STATES.DASH;
  } else if (player.dashWindupTimer > 0) {
    player.movementState = MOVEMENT_STATES.DASH;
  } else if (player.wallJumpLockTimer > 0) {
    player.movementState = MOVEMENT_STATES.WALL_JUMP_LOCK;
  } else if (player.wallRunActive) {
    player.movementState = MOVEMENT_STATES.WALL_SLIDE;
  } else if (player.braceHolding) {
    player.movementState = MOVEMENT_STATES.WALL_SLIDE;
  } else if (player.onGround && player.slideTimer > 0) {
    player.movementState = MOVEMENT_STATES.SLIDE;
  } else if (player.onGround && player.height === player.crouchHeight && Math.abs(player.vx) > 20) {
    player.movementState = MOVEMENT_STATES.CROUCH_WALK;
  } else if (player.onGround && player.height === player.crouchHeight) {
    player.movementState = MOVEMENT_STATES.CROUCH;
  } else if (player.hoverActive && !player.onGround) {
    player.movementState = MOVEMENT_STATES.HOVER;
  } else if (player.wallSliding) {
    player.movementState = MOVEMENT_STATES.WALL_SLIDE;
  } else if (!player.onGround && player.vy < 0) {
    player.movementState = MOVEMENT_STATES.JUMP_RISE;
  } else if (!player.onGround) {
    player.movementState = MOVEMENT_STATES.FALL;
  } else {
    player.movementState = MOVEMENT_STATES.GROUNDED;
  }
}

function clearZipLine(player) {
  player.zipLineActive = false;
  player.zipLineId = null;
  player.zipLineProgress = 0;
  player.zipLineDirection = 1;
  player.zipLineSpeed = 0;
}

function clearBraceHold(player) {
  player.braceHolding = false;
  player.braceHoldWallId = null;
  player.braceHoldDirection = 0;
  player.braceHoldLaunchDirection = 0;
  player.braceHoldSpeed = 0;
}

function clearWallRun(player) {
  player.wallRunActive = false;
  player.wallRunDirection = 0;
  player.wallRunSpeed = 0;
}

function clearHover(player) {
  player.hoverActive = false;
  player.hoverBoostActive = false;
  player.hoverParticleTimer = 0;
}

function clearRecoilSpin(player) {
  player.recoilSpinTimer = 0;
  player.recoilSpinDuration = 0;
}

function getMaxDashCount(config) {
  return Math.max(1, Math.floor(config.maxDashCount ?? 1));
}

function syncDashCapacity(player, config) {
  const nextMax = getMaxDashCount(config);
  if (!Number.isFinite(player.dashMaxCount) || player.dashMaxCount <= 0) {
    player.dashMaxCount = nextMax;
  }
  if (!Number.isFinite(player.dashCharges)) {
    player.dashCharges = player.dashMaxCount;
  }

  if (nextMax !== player.dashMaxCount) {
    const grewBy = nextMax - player.dashMaxCount;
    player.dashMaxCount = nextMax;
    player.dashCharges = clamp(player.dashCharges + Math.max(0, grewBy), 0, player.dashMaxCount);
  } else {
    player.dashCharges = clamp(player.dashCharges, 0, player.dashMaxCount);
  }

  player.dashAvailable = player.dashCharges > 0 && player.dashCooldownTimer === 0;
}

function refillDashFromGround(player, config) {
  syncDashCapacity(player, config);
  player.dashCharges = player.dashMaxCount;
  player.dashAvailable = player.dashCharges > 0 && player.dashCooldownTimer === 0;
}

function refillDashFromWall(player, config) {
  syncDashCapacity(player, config);
  player.dashCharges = player.dashMaxCount;
  player.dashAvailable = true;
  player.dashCooldownTimer = 0;
  player.dashResetActive = true;
}

function getMaxRecoilShotCount(config) {
  return Math.max(1, Math.floor(config.recoilShotCharges ?? 1));
}

function syncRecoilShotCapacity(player, config) {
  const nextMax = getMaxRecoilShotCount(config);
  if (!Number.isFinite(player.recoilShotMaxCharges) || player.recoilShotMaxCharges <= 0) {
    player.recoilShotMaxCharges = nextMax;
  }
  if (!Number.isFinite(player.recoilShotCharges)) {
    player.recoilShotCharges = player.recoilShotMaxCharges;
  }

  if (nextMax !== player.recoilShotMaxCharges) {
    const grewBy = nextMax - player.recoilShotMaxCharges;
    player.recoilShotMaxCharges = nextMax;
    player.recoilShotCharges = clamp(
      player.recoilShotCharges + Math.max(0, grewBy),
      0,
      player.recoilShotMaxCharges,
    );
  } else {
    player.recoilShotCharges = clamp(player.recoilShotCharges, 0, player.recoilShotMaxCharges);
  }
}

function refillRecoilShot(player, config) {
  syncRecoilShotCapacity(player, config);
  player.recoilShotCharges = player.recoilShotMaxCharges;
}

function getSelectedArmContext(run, data) {
  const weapons = ensureWeaponLoadoutState(run, data);
  const side = weapons.selectedSide === "right" ? "right" : "left";
  const arm = weapons.arms[side];
  const stats = computeArmWeaponStats(data, arm);
  return {
    weapons,
    side,
    arm,
    stats,
  };
}

function setSelectedArm(run, data, side) {
  const weapons = ensureWeaponLoadoutState(run, data);
  const nextSide = side === "right" ? "right" : "left";
  if (weapons.selectedSide === nextSide) {
    weapons.selectedSlot = nextSide;
    return;
  }
  const nextStats = computeArmWeaponStats(data, weapons.arms[nextSide]);
  if (!nextStats.equipped) {
    pushNotice(run, `${nextSide === "left" ? "Left" : "Right"} arm empty`, 1.25);
    return;
  }
  weapons.selectedSide = nextSide;
  weapons.selectedSlot = nextSide;
  const context = getSelectedArmContext(run, data);
  pushNotice(run, `${context.side === "left" ? "Left" : "Right"} arm: ${context.stats.label}`, 1.35);
}

function setSelectedMeleeSlot(run, data) {
  const weapons = ensureWeaponLoadoutState(run, data);
  if (weapons.selectedSlot === "melee") {
    return;
  }
  weapons.selectedSlot = "melee";
  pushNotice(run, "3 slot: Breach tool", 1.25);
}

function isMeleeSlotSelected(run, data) {
  return ensureWeaponLoadoutState(run, data).selectedSlot === "melee";
}

function switchSelectedArm(run, data) {
  const weapons = ensureWeaponLoadoutState(run, data);
  const nextSide = weapons.selectedSide === "right" ? "left" : "right";
  if (computeArmWeaponStats(data, weapons.arms[nextSide]).equipped) {
    setSelectedArm(run, data, nextSide);
  } else {
    pushNotice(run, `${nextSide === "left" ? "Left" : "Right"} arm empty`, 1.25);
  }
}

function getWeaponSlotCycle(run, data) {
  const weapons = ensureWeaponLoadoutState(run, data);
  return ["left", "right", "melee"].filter((slot) => (
    slot === "melee" || computeArmWeaponStats(data, weapons.arms[slot]).equipped
  ));
}

function cycleSelectedWeaponSlot(run, data, direction = 1) {
  const weapons = ensureWeaponLoadoutState(run, data);
  const slots = getWeaponSlotCycle(run, data);
  if (!slots.length) {
    setSelectedMeleeSlot(run, data);
    return;
  }
  const current = slots.includes(weapons.selectedSlot) ? weapons.selectedSlot : weapons.selectedSide;
  const currentIndex = Math.max(0, slots.indexOf(current));
  const nextSlot = slots[(currentIndex + (direction >= 0 ? 1 : -1) + slots.length) % slots.length];
  if (nextSlot === "melee") {
    setSelectedMeleeSlot(run, data);
  } else {
    setSelectedArm(run, data, nextSlot);
  }
}

function getReserveAmmo(context) {
  return Math.max(0, Math.floor(Number(context.weapons.reserveAmmo?.[context.stats.ammoType] ?? 0)));
}

function isAutomaticWeaponContext(context) {
  return context?.stats?.fireMode === "auto";
}

function isSelectedWeaponAutomatic(run, data) {
  if (isMeleeSlotSelected(run, data)) {
    return false;
  }
  return isAutomaticWeaponContext(getSelectedArmContext(run, data));
}

function canAimWeapon(player) {
  return Boolean(
    player.height === player.standHeight &&
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0
  );
}

function canFireWeaponPose(player) {
  return Boolean(
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0 &&
    (
      player.height === player.standHeight ||
      (player.onGround && player.slideTimer > 0)
    )
  );
}

function canFireSelectedWeapon(run, data, player) {
  if (isMeleeSlotSelected(run, data)) {
    return false;
  }
  if (!canFireWeaponPose(player)) {
    return false;
  }
  const context = getSelectedArmContext(run, data);
  if (!context.stats.equipped) {
    return false;
  }
  if ((context.arm.reloadTimer ?? 0) > 0 || (context.arm.fireCooldownTimer ?? 0) > 0) {
    return false;
  }
  if ((context.arm.magazine ?? 0) <= 0) {
    return false;
  }
  const airActionCost = player.onGround ? 0 : context.stats.airActionCost;
  return (player.recoilShotCharges ?? 0) >= airActionCost;
}

function startReloadSelectedArm(run, data) {
  if (isMeleeSlotSelected(run, data)) {
    pushNotice(run, "Breach tool does not reload", 1.2);
    return false;
  }
  const context = getSelectedArmContext(run, data);
  if (!context.stats.equipped) {
    pushNotice(run, "No weapon equipped", 1.2);
    return false;
  }
  const reserve = getReserveAmmo(context);
  const currentMagazine = Math.max(0, Math.floor(context.arm.magazine ?? 0));
  if ((context.arm.reloadTimer ?? 0) > 0) {
    pushNotice(run, `${context.stats.label} reloading`, 1.2);
    return false;
  }
  if (currentMagazine >= context.stats.magazineSize) {
    pushNotice(run, `${context.stats.label} magazine full`, 1.2);
    return false;
  }
  if (reserve <= 0) {
    pushNotice(run, `No ${context.stats.ammoType} reserve`, 1.2);
    return false;
  }

  const bodyEffects = getPlayerBodyCombatEffects(run, context.side);
  const reloadDuration = context.stats.reloadDuration * bodyEffects.reloadDurationMultiplier;
  context.arm.reloadTimer = reloadDuration;
  context.arm.reloadDuration = reloadDuration;
  pushNotice(run, `Reloading ${context.stats.label}`, 1.2);
  return true;
}

function completeArmReload(weapons, arm, stats) {
  const reserve = Math.max(0, Math.floor(Number(weapons.reserveAmmo?.[stats.ammoType] ?? 0)));
  const currentMagazine = Math.max(0, Math.floor(arm.magazine ?? 0));
  const needed = Math.max(0, stats.magazineSize - currentMagazine);
  const loaded = Math.min(needed, reserve);
  arm.magazine = currentMagazine + loaded;
  weapons.reserveAmmo[stats.ammoType] = reserve - loaded;
}

function updateWeaponTimers(run, data, dt) {
  const weapons = ensureWeaponLoadoutState(run, data);
  Object.values(weapons.arms || {}).forEach((arm) => {
    const stats = computeArmWeaponStats(data, arm);
    if (!stats.equipped) {
      arm.magazine = 0;
      arm.reloadTimer = 0;
      arm.reloadDuration = 0;
      arm.fireCooldownTimer = 0;
      return;
    }
    arm.fireCooldownTimer = Math.max(0, (arm.fireCooldownTimer ?? 0) - dt);
    if ((arm.reloadTimer ?? 0) > 0) {
      arm.reloadTimer = Math.max(0, arm.reloadTimer - dt);
      if (arm.reloadTimer === 0) {
        completeArmReload(weapons, arm, stats);
      }
    }
    arm.magazine = clamp(Math.floor(arm.magazine ?? stats.magazineSize), 0, stats.magazineSize);
  });

  const selected = getSelectedArmContext(run, data);
  run.player.recoilShotCooldownTimer = Math.max(
    selected.arm.fireCooldownTimer ?? 0,
    selected.arm.reloadTimer ?? 0,
  );
}

function updateWeaponRuntime(run, data, state, dt) {
  if (consumeEitherPress(state, ARM_LEFT_KEYS)) {
    setSelectedArm(run, data, "left");
  }
  if (consumeEitherPress(state, ARM_RIGHT_KEYS)) {
    setSelectedArm(run, data, "right");
  }
  if (consumeEitherPress(state, ARM_MELEE_KEYS)) {
    setSelectedMeleeSlot(run, data);
  }
  if (consumeEitherPress(state, ARM_SWITCH_KEYS)) {
    cycleSelectedWeaponSlot(run, data, 1);
  }
  if (consumeEitherPress(state, ARM_WHEEL_PREV_KEYS)) {
    cycleSelectedWeaponSlot(run, data, -1);
  }
  if (consumeEitherPress(state, ARM_WHEEL_NEXT_KEYS)) {
    cycleSelectedWeaponSlot(run, data, 1);
  }
  if (consumeEitherPress(state, RELOAD_KEYS)) {
    startReloadSelectedArm(run, data);
  }
  updateWeaponTimers(run, data, dt);
}

function getMouseWorld(state, run) {
  const mouse = state.mouse || {};
  const zoom = clamp(run.cameraZoom ?? 1, 0.5, 2.5);
  return {
    x: (mouse.screenX ?? CAMERA_SCREEN_WIDTH / 2) / zoom + run.cameraX,
    y: (mouse.screenY ?? CAMERA_SCREEN_HEIGHT / 2) / zoom + run.cameraY,
  };
}

function getRecoilShotOrigin(player) {
  return {
    x: player.x + player.width * 0.5,
    y: player.y + player.height * 0.48,
  };
}

function canUseRecoilShot(player) {
  return (
    player.height === player.standHeight &&
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0 &&
    player.recoilShotCharges > 0 &&
    player.recoilShotCooldownTimer === 0
  );
}

function distanceFromPointToSegment(pointX, pointY, startX, startY, endX, endY) {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= EPSILON) {
    return Math.hypot(pointX - startX, pointY - startY);
  }
  const t = clamp(((pointX - startX) * dx + (pointY - startY) * dy) / lengthSq, 0, 1);
  const nearestX = startX + dx * t;
  const nearestY = startY + dy * t;
  return Math.hypot(pointX - nearestX, pointY - nearestY);
}

function distanceFromPointToRect(pointX, pointY, rect) {
  const nearestX = clamp(pointX, rect.x, rect.x + rect.width);
  const nearestY = clamp(pointY, rect.y, rect.y + rect.height);
  return Math.hypot(pointX - nearestX, pointY - nearestY);
}

function getHumanoidStaggerMax(enemy) {
  return Math.max(1, Number(enemy?.staggerMax ?? 100));
}

function resetHumanoidStagger(enemy) {
  if (!enemy) {
    return;
  }
  enemy.stagger = 0;
  enemy.staggerDecayTimer = 0;
  enemy.staggerBreakTimer = 0;
  enemy.staggerKnockbackVx = 0;
}

function breakHumanoidStagger(run, enemy, aim) {
  const direction = Math.sign(aim.shotDirX)
    || Math.sign(enemy.x + enemy.width * 0.5 - (run.player.x + run.player.width * 0.5))
    || enemy.facing
    || 1;
  enemy.stagger = 0;
  enemy.staggerDecayTimer = 0;
  enemy.staggerBreakTimer = Math.max(enemy.staggerBreakTimer ?? 0, enemy.staggerBreakDuration ?? 0.42);
  enemy.staggerKnockbackVx = direction * Math.max(0, enemy.staggerKnockbackSpeed ?? 280);
  enemy.trigger = 0;
  enemy.attackCooldown = Math.max(enemy.attackCooldown ?? 0, enemy.staggerAttackLockDuration ?? 0.65);
  enemy.hitFlash = Math.max(enemy.hitFlash ?? 0, 0.2);
  enemy.active = true;
  spawnDirectedParticles(
    run,
    enemy.x + enemy.width * 0.5,
    enemy.y + enemy.height * 0.42,
    12,
    "#e7f47e",
    direction,
    -0.2,
    360,
    0.64,
  );
  pushNotice(run, "Humanoid guard stagger broken.");
}

function applyHumanoidStaggerDamage(run, enemy, weaponStats, aim) {
  const staggerDamage = Math.max(0, Number(weaponStats.staggerDamage ?? 0));
  if (staggerDamage <= 0 || enemy.state === "knockedDown") {
    return false;
  }

  const staggerMax = getHumanoidStaggerMax(enemy);
  enemy.stagger = clamp((enemy.stagger ?? 0) + staggerDamage, 0, staggerMax);
  enemy.staggerDecayTimer = Math.max(0, enemy.staggerDecayDelay ?? 1);
  if (enemy.stagger >= staggerMax && (enemy.hp ?? 0) > 0) {
    breakHumanoidStagger(run, enemy, aim);
    return true;
  }
  return false;
}

function updateHumanoidStaggerState(enemy, data, dt) {
  enemy.staggerBreakTimer = Math.max(0, (enemy.staggerBreakTimer ?? 0) - dt);
  if ((enemy.staggerBreakTimer ?? 0) > 0) {
    enemy.trigger = 0;
    const knockback = enemy.staggerKnockbackVx ?? 0;
    if (Math.abs(knockback) > 0.5) {
      const maxX = Math.max(0, (data.world?.width ?? enemy.x + enemy.width) - enemy.width);
      enemy.x = clamp(enemy.x + knockback * dt, 0, maxX);
      enemy.staggerKnockbackVx = approach(
        knockback,
        0,
        Math.max(0, enemy.staggerKnockbackFriction ?? 860) * dt,
      );
    }
    return;
  }
  enemy.staggerKnockbackVx = 0;

  if ((enemy.stagger ?? 0) <= 0) {
    enemy.stagger = 0;
    enemy.staggerDecayTimer = 0;
    return;
  }

  if ((enemy.staggerDecayTimer ?? 0) > 0) {
    enemy.staggerDecayTimer = Math.max(0, enemy.staggerDecayTimer - dt);
    return;
  }

  enemy.stagger = Math.max(0, (enemy.stagger ?? 0) - Math.max(0, enemy.staggerDecayRate ?? 35) * dt);
}

function killHumanoidEnemy(run, enemy, message = "Face-off target killed.") {
  if (!enemy) {
    return;
  }
  enemy.hp = 0;
  enemy.dead = true;
  enemy.active = false;
  enemy.state = "dead";
  enemy.outcome = "kill";
  enemy.trigger = 0;
  enemy.staggerTimer = 0;
  resetHumanoidStagger(enemy);
  spawnParticles(run, enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.42, 18, "#ffd6ba");
  if (message) {
    pushNotice(run, message);
  }
}

function knockDownHumanoidEnemy(run, data, enemy) {
  if (!enemy) {
    return;
  }
  const playerCenter = getCenter(run.player);
  const center = getHumanoidCenter(enemy);
  const awayFromPlayer = Math.sign(center.x - playerCenter.x) || Math.sign(enemy.facing || 1) || 1;
  const escapeDistance = enemy.escapeDistance ?? 360;
  const maxX = Math.max(0, (data.world?.width ?? enemy.x + escapeDistance) - enemy.width);
  const escapeTargetX = clamp(enemy.x + awayFromPlayer * escapeDistance, 0, maxX);

  enemy.hp = 0;
  enemy.state = "knockedDown";
  enemy.active = false;
  enemy.dead = false;
  enemy.disabled = false;
  enemy.surrendered = false;
  enemy.dealt = false;
  enemy.released = false;
  enemy.outcome = null;
  enemy.trigger = 0;
  enemy.attackCooldown = Math.max(enemy.attackCooldown ?? 0, 1.2);
  enemy.escapeTargetX = escapeTargetX;
  enemy.knockdownFacing = awayFromPlayer;
  enemy.facing = awayFromPlayer;
  enemy.exhaustionHits = 0;
  enemy.staggerTimer = enemy.knockdownStaggerDuration ?? 0.45;
  resetHumanoidStagger(enemy);
  enemy.hitFlash = 0.2;
  spawnParticles(run, center.x, center.y, 12, "#dce7ec");
  pushNotice(run, "Humanoid target knocked down.");
}

function applyKnockedDownRecoilHit(run, enemy, aim) {
  const limit = Math.max(1, enemy.exhaustionLimit ?? 2);
  enemy.exhaustionHits = Math.min(limit, (enemy.exhaustionHits ?? 0) + 1);
  enemy.staggerTimer = enemy.knockdownStaggerDuration ?? 0.65;
  enemy.hitFlash = 0.2;
  enemy.trigger = 0;
  spawnDirectedParticles(
    run,
    enemy.x + enemy.width * 0.5,
    enemy.y + enemy.height * 0.62,
    10,
    "#ffd6ba",
    aim.shotDirX,
    aim.shotDirY,
    320,
    0.7,
  );
  if (enemy.exhaustionHits >= limit) {
    killHumanoidEnemy(run, enemy, "Knocked-down target killed.");
  } else {
    pushNotice(run, `Knocked-down target exhausted ${enemy.exhaustionHits}/${limit}.`);
  }
}

function getSegmentRectHitT(startX, startY, endX, endY, rect, padding = 0) {
  const expanded = {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
  const dx = endX - startX;
  const dy = endY - startY;
  let tMin = 0;
  let tMax = 1;
  const sides = [
    [-dx, startX - expanded.x],
    [dx, expanded.x + expanded.width - startX],
    [-dy, startY - expanded.y],
    [dy, expanded.y + expanded.height - startY],
  ];

  for (const [p, q] of sides) {
    if (Math.abs(p) < EPSILON) {
      if (q < 0) {
        return null;
      }
      continue;
    }
    const t = q / p;
    if (p < 0) {
      tMin = Math.max(tMin, t);
    } else {
      tMax = Math.min(tMax, t);
    }
    if (tMin > tMax) {
      return null;
    }
  }

  return tMax >= 0 && tMin <= 1 ? clamp(tMin, 0, 1) : null;
}

function getHumanoidBulletHitZones(enemy) {
  const cx = enemy.x + enemy.width * 0.5;
  const height = Math.max(1, enemy.height);
  const headHeight = clamp(height * 0.3, 28, 34);
  const headWidth = clamp(enemy.width * 0.62, 32, 38);
  const bodyTop = enemy.y + headHeight - 2;
  return [
    {
      id: "head",
      critical: true,
      priority: 2,
      x: cx - headWidth * 0.5,
      y: enemy.y,
      width: headWidth,
      height: headHeight,
    },
    {
      id: "body",
      critical: false,
      priority: 1,
      x: enemy.x + enemy.width * 0.1,
      y: bodyTop,
      width: enemy.width * 0.8,
      height: Math.max(12, enemy.y + enemy.height - bodyTop),
    },
  ];
}

function spawnPlayerBullet(run, weaponStats, aim) {
  const speed = weaponStats.projectileSpeed ?? (weaponStats.type === "shotgun" ? 2050 : 2450);
  const range = weaponStats.range ?? 520;
  const startOffset = 18;
  run.playerBullets = run.playerBullets || [];
  run.playerBullets.push({
    id: `player-bullet-${Math.round((run.time ?? 0) * 1000)}-${run.playerBullets.length}`,
    x: aim.originX + aim.shotDirX * startOffset,
    y: aim.originY + aim.shotDirY * startOffset,
    prevX: aim.originX,
    prevY: aim.originY,
    dirX: aim.shotDirX,
    dirY: aim.shotDirY,
    speed,
    range,
    traveled: 0,
    radius: weaponStats.projectileRadius ?? 4,
    hitRadius: weaponStats.hitRadius ?? 42,
    damage: weaponStats.damage ?? 2,
    droneDamage: weaponStats.droneDamage ?? weaponStats.damage ?? 2,
    humanoidDamage: weaponStats.humanoidDamage ?? 50,
    weaponStats,
    life: Math.max(0.08, range / speed + 0.12),
    duration: Math.max(0.08, range / speed + 0.12),
    color: weaponStats.type === "shotgun" ? "#ffd6ba" : "#e9f7ff",
  });
}

function findPlayerBulletHit(run, data, bullet, startX, startY, endX, endY) {
  let best = null;
  const consider = (hit) => {
    if (
      hit &&
      (!best ||
        hit.t < best.t - 0.001 ||
        (Math.abs(hit.t - best.t) <= 0.001 && (hit.priority ?? 0) > (best.priority ?? 0)))
    ) {
      best = hit;
    }
  };

  for (const block of run.temporaryBlocks || []) {
    if (isTemporaryBlockHidden(block)) {
      continue;
    }
    const t = getSegmentRectHitT(startX, startY, endX, endY, block, bullet.radius ?? 0);
    if (t !== null) {
      consider({ type: "temporaryBlock", target: block, t, priority: 3 });
    }
  }

  for (const crate of run.lootCrates || []) {
    if (crate.searched || crate.spilled || crate.broken) {
      continue;
    }
    const t = getSegmentRectHitT(startX, startY, endX, endY, crate, bullet.radius ?? 0);
    if (t !== null) {
      consider({ type: "lootCrate", target: crate, t, priority: 2 });
    }
  }

  for (const platform of getCollisionPlatforms(data, run)) {
    const t = getSegmentRectHitT(startX, startY, endX, endY, platform, bullet.radius ?? 0);
    if (t !== null) {
      consider({ type: "world", target: platform, t });
    }
  }

  for (const drone of run.hostileDrones || []) {
    if (isEntityDisabled(drone) || drone.dead) {
      continue;
    }
    const padding = (bullet.hitRadius ?? 0) + Math.max(drone.width, drone.height) * 0.22;
    const t = getSegmentRectHitT(startX, startY, endX, endY, drone, padding);
    if (t !== null) {
      consider({ type: "drone", target: drone, t });
    }
  }

  for (const enemy of run.humanoidEnemies || []) {
    if (!isHumanoidFaceOffAvailable(enemy) || !isHumanoidInFaceOffScope(enemy)) {
      continue;
    }

    if (enemy.state === "knockedDown") {
      const padding = (bullet.hitRadius ?? 0) + Math.max(enemy.width, enemy.height) * 0.18;
      const t = getSegmentRectHitT(startX, startY, endX, endY, enemy, padding);
      if (t !== null) {
        consider({ type: "humanoid", target: enemy, t, part: "body", critical: false, priority: 1 });
      }
      continue;
    }

    const zonePadding = Math.max(2, (bullet.radius ?? 0) + (bullet.hitRadius ?? 0) * 0.08);
    for (const zone of getHumanoidBulletHitZones(enemy)) {
      const t = getSegmentRectHitT(startX, startY, endX, endY, zone, zonePadding);
      if (t !== null) {
        consider({
          type: "humanoid",
          target: enemy,
          t,
          part: zone.id,
          critical: zone.critical,
          priority: zone.priority,
        });
      }
    }
  }

  return best;
}

function applyPlayerBulletHit(run, data, bullet, hit) {
  const hitX = lerp(bullet.prevX, bullet.x, hit.t);
  const hitY = lerp(bullet.prevY, bullet.y, hit.t);
  const aim = {
    shotDirX: bullet.dirX,
    shotDirY: bullet.dirY,
  };

  if (hit.type === "world") {
    spawnDirectedParticles(run, hitX, hitY, 6, "#dce7ec", -bullet.dirX, -bullet.dirY, 220, 0.9);
    return;
  }

  if (hit.type === "temporaryBlock") {
    const block = hit.target;
    block.destroyed = true;
    block.hiddenTimer = 0;
    block.hitFlash = 0.18;
    spawnDamageNumber(run, hitX, hitY - 12, 0, "#93eaff", "OPEN");
    spawnDirectedParticles(run, hitX, hitY, 16, "#93eaff", -bullet.dirX, -bullet.dirY, 420, 0.82);
    return;
  }

  if (hit.type === "lootCrate") {
    const crateDamage = Math.max(
      1,
      Math.ceil(Math.max(1, Number(hit.target.maxHp ?? hit.target.hp ?? 2)) / 2),
    );
    damageLootCrate(run, hit.target, crateDamage, bullet.dirX, bullet.dirY, hitX, hitY);
    return;
  }

  if (hit.type === "drone") {
    const drone = hit.target;
    const damage = bullet.droneDamage ?? bullet.damage ?? 2;
    const centerX = drone.x + drone.width * 0.5;
    const centerY = drone.y + drone.height * 0.5;
    drone.active = true;
    drone.hp = Math.max(0, drone.hp - damage);
    drone.hitFlash = 0.16;
    drone.vx += bullet.dirX * 180;
    drone.vy += bullet.dirY * 100;
    spawnDamageNumber(run, centerX, centerY - 10, damage, "#87e1ff");
    spawnDirectedParticles(run, hitX, hitY, 11, "#87e1ff", bullet.dirX, bullet.dirY, 360, 0.8);
    if (drone.hp === 0) {
      spawnDamageNumber(run, centerX, centerY - 28, 0, "#f5f8fb", "DOWN");
      destroyHostileDrone(run, drone);
    }
    return;
  }

  if (hit.type === "humanoid") {
    const enemy = hit.target;
    const critical = Boolean(hit.critical);
    if (enemy.state === "knockedDown") {
      applyKnockedDownRecoilHit(run, enemy, aim);
      spawnDamageNumber(run, hitX, hitY - 16, bullet.humanoidDamage ?? 0, "#ffd6ba", "HIT");
      return;
    }

    const baseDamage = bullet.humanoidDamage ?? 50;
    const headshotMultiplier = bullet.weaponStats?.headshotMultiplier ?? 2;
    const damage = critical ? baseDamage * headshotMultiplier : baseDamage;
    const damageColor = critical ? "#ff334f" : "#ffd6ba";
    enemy.active = true;
    enemy.state = enemy.state === "patrol" ? "combat" : enemy.state;
    enemy.hp = Math.max(0, (enemy.hp ?? enemy.maxHp ?? 100) - damage);
    enemy.hitFlash = critical ? 0.32 : 0.2;
    enemy.trigger = 0;
    spawnDamageNumber(
      run,
      enemy.x + enemy.width * 0.5,
      critical ? enemy.y - 8 : enemy.y + enemy.height * 0.26,
      damage,
      damageColor,
      null,
      critical ? { critical: true, duration: 0.9, scale: 1.18, vy: -86 } : {},
    );
    spawnDirectedParticles(
      run,
      hitX,
      hitY,
      critical ? 20 : 13,
      damageColor,
      bullet.dirX,
      bullet.dirY,
      critical ? 470 : 390,
      0.78,
    );
    if (enemy.hp <= 0) {
      knockDownHumanoidEnemy(run, data, enemy);
      return;
    }
    applyHumanoidStaggerDamage(run, enemy, bullet.weaponStats || {}, aim);
  }
}

function updateFocusState(run, state, dt) {
  const player = run.player;
  run.focusMax = Math.max(1, Number(run.focusMax ?? FOCUS_MAX));
  run.focus = clamp(Number(run.focus ?? run.focusMax), 0, run.focusMax);
  run.focusDepleted = Boolean(run.focusDepleted);
  if (run.focusDepleted && run.focus >= run.focusMax * FOCUS_REENTRY_RATIO) {
    run.focusDepleted = false;
  }

  const requested =
    BULLET_TIME_KEYS.some((key) => isPressed(state, key)) ||
    Boolean(state.mouse?.secondaryDown && canAimWeapon(player));
  const wasActive = Boolean(run.focusActive);
  const canStart = (
    !run.focusDepleted &&
    (wasActive ? run.focus > 0 : run.focus > FOCUS_MIN_TO_START)
  );
  const active = Boolean(requested && canStart);

  if (active) {
    run.focus = Math.max(0, run.focus - FOCUS_DRAIN_PER_SECOND * dt);
    if (run.focus <= 0) {
      run.focus = 0;
      run.focusDepleted = true;
    }
  } else {
    run.focus = Math.min(run.focusMax, run.focus + FOCUS_RECOVER_PER_SECOND * dt);
  }

  run.focusActive = Boolean(active && run.focus > 0);
  if (run.recoilAim) {
    run.recoilAim.active = run.focusActive;
  }
  player.recoilFocusActive = run.focusActive;
  player.recoilFocusBlend = approach(
    player.recoilFocusBlend ?? 0,
    run.focusActive ? 1 : 0,
    dt * (run.focusActive ? 12 : 9),
  );

  return run.focusActive;
}

function getWeaponTargetCenter(target) {
  if (!target) {
    return null;
  }
  return {
    x: target.x + target.width * 0.5,
    y: target.y + target.height * 0.46,
  };
}

function getMissileTarget(run, missile) {
  if (missile.targetType === "drone") {
    return (run.hostileDrones || []).find((drone) => drone.id === missile.targetId && !isEntityDisabled(drone) && !drone.dead) || null;
  }
  if (missile.targetType === "humanoid") {
    return (run.humanoidEnemies || []).find((enemy) => enemy.id === missile.targetId && isHumanoidFaceOffAvailable(enemy)) || null;
  }
  return null;
}

function findAssistTarget(run, aim, maxRange = 680) {
  const startX = aim.originX;
  const startY = aim.originY;
  const endX = startX + aim.shotDirX * maxRange;
  const endY = startY + aim.shotDirY * maxRange;
  let best = null;
  let bestScore = Infinity;

  (run.humanoidEnemies || []).forEach((enemy) => {
    if (!isHumanoidFaceOffAvailable(enemy) || !isHumanoidInFaceOffScope(enemy)) {
      return;
    }
    const center = getWeaponTargetCenter(enemy);
    const distance = distanceFromPointToSegment(center.x, center.y, startX, startY, endX, endY);
    if (distance > 160) {
      return;
    }
    const score = distance + Math.hypot(center.x - startX, center.y - startY) * 0.03;
    if (score < bestScore) {
      best = { targetType: "humanoid", targetId: enemy.id };
      bestScore = score;
    }
  });

  (run.hostileDrones || []).forEach((drone) => {
    if (isEntityDisabled(drone) || drone.dead) {
      return;
    }
    const center = getWeaponTargetCenter(drone);
    const distance = distanceFromPointToSegment(center.x, center.y, startX, startY, endX, endY);
    if (distance > 150) {
      return;
    }
    const score = distance + Math.hypot(center.x - startX, center.y - startY) * 0.025;
    if (score < bestScore) {
      best = { targetType: "drone", targetId: drone.id };
      bestScore = score;
    }
  });

  return best;
}

function applyWeaponAssistDamage(run, data, missile, target) {
  if (!target) {
    return;
  }
  if (missile.targetType === "drone") {
    target.hp = Math.max(0, (target.hp ?? target.maxHp ?? 1) - (missile.droneDamage ?? 1));
    target.hitFlash = 0.14;
    spawnParticles(run, missile.x, missile.y, 7, "#87e1ff");
    if (target.hp <= 0) {
      destroyHostileDrone(run, target);
    }
    return;
  }

  if (target.state === "knockedDown") {
    target.staggerTimer = target.knockdownStaggerDuration ?? 0.35;
    target.hitFlash = 0.14;
    spawnParticles(run, missile.x, missile.y, 5, "#ffd6ba");
    return;
  }

  target.active = true;
  target.state = target.state === "patrol" ? "combat" : target.state;
  target.hp = Math.max(0, (target.hp ?? target.maxHp ?? 100) - (missile.humanoidDamage ?? 8));
  target.hitFlash = 0.14;
  spawnParticles(run, missile.x, missile.y, 7, "#ffd6ba");
  if (target.hp <= 0) {
    knockDownHumanoidEnemy(run, data, target);
  }
}

function spawnWeaponModuleEffects(run, data, aim, weaponStats) {
  if (weaponStats.missileCount > 0) {
    run.weaponMissiles = run.weaponMissiles || [];
    for (let index = 0; index < weaponStats.missileCount; index += 1) {
      const target = findAssistTarget(run, aim, weaponStats.range + 160);
      const spread = (index - (weaponStats.missileCount - 1) * 0.5) * 0.18;
      const normalX = -aim.shotDirY;
      const normalY = aim.shotDirX;
      run.weaponMissiles.push({
        x: aim.originX + aim.shotDirX * 12,
        y: aim.originY + aim.shotDirY * 12,
        dirX: aim.shotDirX + normalX * spread,
        dirY: aim.shotDirY + normalY * spread,
        targetType: target?.targetType ?? null,
        targetId: target?.targetId ?? null,
        speed: 520,
        turnRate: 9,
        radius: 7,
        life: 0.95,
        duration: 0.95,
        humanoidDamage: Math.max(4, weaponStats.humanoidDamage * 0.34),
        droneDamage: Math.max(1, weaponStats.droneDamage * 0.7),
      });
    }
  }

  if (weaponStats.barrierDuration > 0 && weaponStats.barrierStrength > 0) {
    run.weaponBarriers = run.weaponBarriers || [];
    run.weaponBarriers.push({
      x: aim.originX + aim.shotDirX * 48,
      y: aim.originY + aim.shotDirY * 48,
      dirX: aim.shotDirX,
      dirY: aim.shotDirY,
      width: 108,
      height: 62,
      life: weaponStats.barrierDuration,
      duration: weaponStats.barrierDuration,
      strength: weaponStats.barrierStrength,
    });
  }
}

function getBarrierRect(barrier) {
  return createRect(
    barrier.x - barrier.width * 0.5,
    barrier.y - barrier.height * 0.5,
    barrier.width,
    barrier.height,
  );
}

function updateWeaponProjectiles(run, data, dt) {
  run.playerBullets = (run.playerBullets || []).filter((bullet) => {
    bullet.life -= dt;
    if (bullet.life <= 0 || bullet.traveled >= bullet.range) {
      return false;
    }

    const step = Math.min((bullet.speed ?? 2200) * dt, (bullet.range ?? 0) - (bullet.traveled ?? 0));
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.dirX * step;
    bullet.y += bullet.dirY * step;
    bullet.traveled = (bullet.traveled ?? 0) + step;

    const hit = findPlayerBulletHit(run, data, bullet, bullet.prevX, bullet.prevY, bullet.x, bullet.y);
    if (hit) {
      applyPlayerBulletHit(run, data, bullet, hit);
      return false;
    }

    return (
      bullet.traveled < bullet.range &&
      bullet.x >= -80 &&
      bullet.y >= -80 &&
      bullet.x <= data.world.width + 80 &&
      bullet.y <= data.world.height + 80
    );
  });

  run.weaponBarriers = (run.weaponBarriers || []).filter((barrier) => {
    barrier.life -= dt;
    return barrier.life > 0;
  });

  run.weaponMissiles = (run.weaponMissiles || []).filter((missile) => {
    missile.life -= dt;
    if (missile.life <= 0) {
      return false;
    }

    const target = getMissileTarget(run, missile);
    const targetCenter = getWeaponTargetCenter(target);
    if (targetCenter) {
      const dx = targetCenter.x - missile.x;
      const dy = targetCenter.y - missile.y;
      const length = Math.max(0.001, Math.hypot(dx, dy));
      missile.dirX = lerp(missile.dirX, dx / length, clamp(dt * (missile.turnRate ?? 8), 0, 1));
      missile.dirY = lerp(missile.dirY, dy / length, clamp(dt * (missile.turnRate ?? 8), 0, 1));
      const safeLength = Math.max(0.001, Math.hypot(missile.dirX, missile.dirY));
      missile.dirX /= safeLength;
      missile.dirY /= safeLength;
    }

    missile.x += missile.dirX * (missile.speed ?? 520) * dt;
    missile.y += missile.dirY * (missile.speed ?? 520) * dt;

    if (
      missile.x < -80 ||
      missile.y < -80 ||
      missile.x > data.world.width + 80 ||
      missile.y > data.world.height + 80
    ) {
      return false;
    }

    const missileRect = createRect(
      missile.x - missile.radius,
      missile.y - missile.radius,
      missile.radius * 2,
      missile.radius * 2,
    );
    if (collidesWithPlatforms(missileRect, data)) {
      spawnParticles(run, missile.x, missile.y, 4, "#87e1ff");
      return false;
    }

    if (target && targetCenter && Math.hypot(targetCenter.x - missile.x, targetCenter.y - missile.y) <= Math.max(target.width, target.height) * 0.45 + missile.radius) {
      applyWeaponAssistDamage(run, data, missile, target);
      return false;
    }

    return true;
  });
}

function isShotBlockedByWeaponBarrier(run, shot) {
  const barriers = run.weaponBarriers || [];
  if (!barriers.length) {
    return false;
  }

  return barriers.some((barrier) => {
    const rect = getBarrierRect(barrier);
    if (shot.type === "beam") {
      return lineIntersectsRect(shot.startX, shot.startY, shot.endX, shot.endY, rect, shot.radius ?? 0);
    }
    const shotRect = createRect(
      shot.x - shot.radius,
      shot.y - shot.radius,
      shot.radius * 2,
      shot.radius * 2,
    );
    return rectsOverlap(shotRect, rect);
  });
}

function updateRecoilAim(run, data, state, dt) {
  const player = run.player;
  const config = getMovementConfig(data);
  syncRecoilShotCapacity(player, config);
  ensureWeaponLoadoutState(run, data);

  const origin = getRecoilShotOrigin(player);
  const target = getMouseWorld(state, run);
  let dx = target.x - origin.x;
  let dy = target.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length < 18) {
    dx = player.facing || 1;
    dy = 0.65;
  }
  const safeLength = Math.max(0.001, Math.hypot(dx, dy));
  const shotDirX = dx / safeLength;
  const shotDirY = dy / safeLength;
  const recoilDirX = -shotDirX;
  const recoilDirY = -shotDirY;
  const aiming = Boolean(state.mouse?.secondaryDown && canAimWeapon(player));
  const active = Boolean(run.focusActive);
  const edgePan = getAimCameraEdgePan(state.mouse);
  const aimFacing = Math.abs(shotDirX) > 0.08
    ? Math.sign(shotDirX)
    : (player.recoilAimFacing || player.facing || 1);
  const verticalPoseThreshold = config.recoilAimVerticalPoseThreshold ?? 0.45;
  const aimPitch = shotDirY < -verticalPoseThreshold
    ? -1
    : shotDirY > verticalPoseThreshold
      ? 1
      : 0;

  player.recoilFocusBlend = approach(
    player.recoilFocusBlend,
    active ? 1 : 0,
    dt * (active ? 7.5 : 10),
  );
  player.recoilFocusActive = active;
  if (aiming) {
    player.recoilAimFacing = aimFacing;
    player.recoilAimPitch = aimPitch;
  }
  player.recoilAimX = shotDirX;
  player.recoilAimY = shotDirY;
  player.recoilDirX = recoilDirX;
  player.recoilDirY = recoilDirY;

  run.recoilAim = {
    active,
    aiming,
    focusBlend: player.recoilFocusBlend,
    canFire: canFireSelectedWeapon(run, data, player),
    originX: origin.x,
    originY: origin.y,
    targetX: target.x,
    targetY: target.y,
    aimFacing,
    aimPitch,
    edgePanX: edgePan.x,
    edgePanY: edgePan.y,
    shotDirX,
    shotDirY,
    recoilDirX,
    recoilDirY,
  };
}

function performRecoilShot(player, run, data, config, state = null) {
  if (isMeleeSlotSelected(run, data)) {
    if (state) {
      pushInputTrace(state, "shotBlock:melee", {});
    }
    return false;
  }
  if (!run.recoilAim || !canFireWeaponPose(player)) {
    if (state) {
      pushInputTrace(state, "shotBlock:aim", {
        hasAim: Number(Boolean(run.recoilAim)),
        canAim: Number(canFireWeaponPose(player)),
      });
    }
    return false;
  }

  const context = getSelectedArmContext(run, data);
  if (!context.stats.equipped) {
    if (state) {
      pushInputTrace(state, "shotBlock:empty", { side: context.side });
    }
    pushNotice(run, "No weapon equipped", 1.1);
    return false;
  }
  if ((context.arm.magazine ?? 0) <= 0) {
    if (state) {
      pushInputTrace(state, "shotBlock:mag", { mag: context.arm.magazine ?? 0 });
    }
    startReloadSelectedArm(run, data);
    spawnParticles(run, run.recoilAim.originX, run.recoilAim.originY, 3, "#d5e7ef");
    return false;
  }
  if ((context.arm.reloadTimer ?? 0) > 0) {
    if (state) {
      pushInputTrace(state, "shotBlock:reload", { reload: (context.arm.reloadTimer ?? 0).toFixed(2) });
    }
    pushNotice(run, `${context.stats.label} reloading`, 1.1);
    return false;
  }
  const airActionCost = player.onGround ? 0 : context.stats.airActionCost;
  if (!canFireWeaponPose(player) || (context.arm.fireCooldownTimer ?? 0) > 0) {
    if (state) {
      pushInputTrace(state, "shotBlock:cool", {
        canAim: Number(canFireWeaponPose(player)),
        cd: (context.arm.fireCooldownTimer ?? 0).toFixed(2),
      });
    }
    return false;
  }
  if ((player.recoilShotCharges ?? 0) < airActionCost) {
    if (state) {
      pushInputTrace(state, "shotBlock:charge", {
        charges: player.recoilShotCharges ?? 0,
        cost: airActionCost,
      });
    }
    pushNotice(run, "No air action charge.", 1.1);
    return false;
  }

  const aim = run.recoilAim;
  if (state) {
    pushInputTrace(state, "shotGo", {
      aim: Number(Boolean(aim.aiming)),
      focus: Number(Boolean(run.focusActive)),
      mag: context.arm.magazine ?? 0,
      cd: (context.arm.fireCooldownTimer ?? 0).toFixed(2),
    });
  }
  const aimed = Boolean(aim.aiming);
  const bodyEffects = getPlayerBodyCombatEffects(run, context.side);
  const spreadMultiplier = (aimed ? 0.65 : 2.65) * (run.focusActive ? 0.75 : 1) * bodyEffects.spreadMultiplier;
  const spread = (context.stats.spread ?? 0) * spreadMultiplier;
  if (spread > 0.001) {
    const shotAngle = Math.atan2(aim.shotDirY, aim.shotDirX) + (Math.random() - 0.5) * spread;
    aim.shotDirX = Math.cos(shotAngle);
    aim.shotDirY = Math.sin(shotAngle);
    aim.recoilDirX = -aim.shotDirX;
    aim.recoilDirY = -aim.shotDirY;
  }
  const force = context.stats.recoil ?? config.recoilShotForce ?? 840;
  const maxHorizontal = config.recoilShotMaxHorizontalSpeed ?? 1180;
  const maxUp = Math.abs(config.recoilShotMaxUpSpeed ?? 1180);
  const maxFall = Math.abs(config.recoilShotMaxFallSpeed ?? 760);
  const recoilX = aim.recoilDirX;
  const recoilY = aim.recoilDirY;
  const firedAirborne = !player.onGround;
  const verticalPoseThreshold = config.recoilAimVerticalPoseThreshold ?? 0.45;
  const shotFacing = Math.abs(aim.shotDirX) > 0.08
    ? Math.sign(aim.shotDirX)
    : (player.recoilAimFacing || player.facing || 1);
  const shotPitch = aim.shotDirY < -verticalPoseThreshold
    ? -1
    : aim.shotDirY > verticalPoseThreshold
      ? 1
      : 0;

  clearBraceHold(player);
  clearWallRun(player);
  clearHover(player);
  context.arm.magazine = Math.max(0, Math.floor(context.arm.magazine ?? 0) - 1);
  context.arm.fireCooldownTimer = context.stats.fireCooldown * bodyEffects.fireCooldownMultiplier;
  if (context.arm.magazine <= 0) {
    startReloadSelectedArm(run, data);
  }
  player.recoilShotCharges = Math.max(0, player.recoilShotCharges - (firedAirborne ? airActionCost : 0));
  player.recoilShotCooldownTimer = Math.max(context.arm.fireCooldownTimer ?? 0, context.arm.reloadTimer ?? 0);
  player.recoilShotTimer = Math.max(0.04, (config.recoilAirShotPoseMs ?? 160) / 1000);
  player.recoilShotActive = true;
  player.recoilShotAirborne = firedAirborne;
  player.recoilShotFacing = shotFacing;
  player.recoilShotPitch = shotPitch;
  if (firedAirborne) {
    const spinLoopCount = Math.max(1, Math.floor(config.recoilSpinLoopCount ?? 1));
    player.recoilSpinDuration = ((config.recoilSpinDurationMs ?? 220) / 1000) * spinLoopCount;
    player.recoilSpinTimer = player.recoilSpinDuration;
    player.recoilSpinFacing = Math.abs(recoilX) > 0.08
      ? Math.sign(recoilX)
      : (player.facing || 1);
  } else {
    clearRecoilSpin(player);
  }
  player.recoilCameraTimer = (config.recoilShotCameraHoldMs ?? 240) / 1000;
  player.recoilCameraDirX = recoilX;
  player.recoilCameraDirY = recoilY;
  player.vx = clamp(player.vx + recoilX * force, -maxHorizontal, maxHorizontal);
  player.vy = clamp(player.vy + recoilY * force, -maxUp, maxFall);
  player.onGround = false;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
  if (Math.abs(aim.shotDirX) > 0.08) {
    player.recoilAimFacing = shotFacing;
    player.facing = player.recoilAimFacing;
  }
  player.wallJumpLockTimer = 0;
  player.wallJumpLockDirection = 0;
  player.wallSliding = false;
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;
  player.canInteract = false;

  run.recoilFx.push({
    x: aim.originX,
    y: aim.originY,
    dirX: aim.shotDirX,
    dirY: aim.shotDirY,
    life: 0.2,
    duration: 0.2,
    weaponType: context.stats.type,
  });
  triggerWeaponShotFeedback(run, state, {
    ...context.stats,
    recoil: context.stats.recoil * bodyEffects.recoilKickMultiplier,
  }, aim);
  spawnPlayerBullet(run, context.stats, aim);
  spawnWeaponModuleEffects(run, data, aim, context.stats);
  pushAfterimage(run, player);
  for (let index = 0; index < 4; index += 1) {
    const distance = index * 18;
    pushRecoilFocusAfterimage(run, player, {
      offsetX: -recoilX * distance,
      offsetY: -recoilY * distance * 0.72,
      life: RECOIL_FOCUS_AFTERIMAGE_LIFE + index * 0.035,
    });
  }
  spawnDirectedParticles(run, aim.originX, aim.originY, 12, "#e9f7ff", aim.shotDirX, aim.shotDirY, 520, 0.68);
  spawnDirectedParticles(run, aim.originX, aim.originY, 7, "#93eaff", recoilX, recoilY, 260, 0.9);
  pushNotice(run, `${context.stats.label} fired`, 1.15);
  run.recoilAim.active = Boolean(run.focusActive);
  player.recoilFocusActive = Boolean(run.focusActive);
  return true;
}

function startDash(player, run, config, direction) {
  clearBraceHold(player);
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  clearRecoilSpin(player);
  syncDashCapacity(player, config);
  player.dashCharges = Math.max(0, player.dashCharges - 1);
  player.dashAvailable = false;
  player.dashDirection = direction;
  player.dashWindupTimer = (config.dashWindupMs ?? 0) / 1000;
  player.dashTimer = player.dashWindupTimer > 0 ? 0 : config.dashDurationMs / 1000;
  player.dashCooldownTimer = config.dashCooldownMs / 1000;
  player.dashCarryTimer = 0;
  player.dashCarrySpeed = 0;
  player.speedRetentionTimer = 0;
  player.retainedSpeed = 0;
  player.wallJumpLockTimer = 0;
  player.wallJumpLockDirection = 0;
  player.vx = (config.dashDistance / (config.dashDurationMs / 1000)) * direction;
  player.vy = 0;
  player.facing = direction;
  player.canInteract = false;
  player.dashTrailTimer = 0;
  pushAfterimage(run, player);
  spawnParticles(run, player.x + player.width / 2, player.y + player.height / 2, 8, "#d1efff");
}

function startDashBurst(player, config) {
  player.dashWindupTimer = 0;
  player.dashTimer = config.dashDurationMs / 1000;
  player.vx = (config.dashDistance / (config.dashDurationMs / 1000)) * player.dashDirection;
  player.vy = 0;
}

function getStopInertiaDecel(player, config, baseDecel) {
  const initialMultiplier = config.stopInertiaInitialDecelMultiplier ?? 0.26;
  const maxMultiplier = config.stopInertiaMaxDecelMultiplier ?? 1.28;
  const rampSeconds = Math.max(0.001, config.stopInertiaRampSeconds ?? 0.52);
  const progress = clamp((player.noMoveInputTimer ?? 0) / rampSeconds, 0, 1);
  return baseDecel * lerp(initialMultiplier, maxMultiplier, progress * progress);
}

function armDashCarry(player, config, speed) {
  if (!Number.isFinite(speed) || speed === 0) {
    return;
  }
  player.dashCarryTimer = (config.dashCarryWindowMs ?? 0) / 1000;
  player.dashCarrySpeed = speed;
}

function armSpeedRetention(player, config, speed) {
  if (Math.abs(speed) < (config.wallSpeedRetentionMinSpeed ?? 0)) {
    return;
  }
  player.speedRetentionTimer = (config.wallSpeedRetentionMs ?? 0) / 1000;
  player.retainedSpeed = speed;
}

function applyDashJumpCarry(player, config) {
  if (player.dashCarryTimer <= 0 || player.dashCarrySpeed === 0) {
    return false;
  }

  const carryDirection = Math.sign(player.dashCarrySpeed) || player.facing;
  const carrySpeed = Math.max(
    Math.abs(player.vx),
    Math.abs(player.dashCarrySpeed),
    config.dashJumpMinSpeed ?? 0
  );
  player.vx = carryDirection * carrySpeed;
  player.facing = carryDirection;
  player.dashCarryTimer = 0;
  player.dashCarrySpeed = 0;
  player.dashJumpBoostActive = true;
  return true;
}

function armSprintJumpCarry(player, config) {
  const carrySpeed = Math.sign(player.vx || player.facing || 1)
    * Math.max(
      Math.abs(player.vx),
      config.sprintJumpMinSpeed ?? 0
    );
  player.sprintJumpCarryTimer = (config.sprintJumpCarryMs ?? 0) / 1000;
  player.sprintJumpCarrySpeed = carrySpeed;
}

function applySprintJumpCarry(player) {
  if (player.sprintJumpCarryTimer <= 0 || player.sprintJumpCarrySpeed === 0) {
    return false;
  }
  const carryDirection = Math.sign(player.sprintJumpCarrySpeed) || player.facing;
  const carrySpeed = Math.max(Math.abs(player.vx), Math.abs(player.sprintJumpCarrySpeed));
  player.vx = carryDirection * carrySpeed;
  player.facing = carryDirection;
  player.sprintJumpBoostActive = true;
  return true;
}

function performJump(player, run, velocity) {
  clearBraceHold(player);
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  clearRecoilSpin(player);
  player.vy = velocity;
  player.onGround = false;
  player.jumpBufferTimer = 0;
  player.coyoteTimer = 0;
  spawnParticles(run, player.x + player.width / 2, player.y + player.height, 6, "#d8ebff");
}

function performWallJump(player, run, config, wallDirection) {
  clearBraceHold(player);
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  clearRecoilSpin(player);
  const direction = -wallDirection || -player.facing;
  player.wallJumpLockDirection = direction;
  player.wallJumpLockTimer = config.wallJumpLockMs / 1000;
  player.vx = direction * config.wallJumpHorizontal;
  player.vy = -config.wallJumpVertical;
  player.facing = direction;
  player.jumpBufferTimer = 0;
  player.onGround = false;
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  spawnParticles(run, player.x + player.width / 2, player.y + player.height / 2, 8, "#cde9ff");
}

function enterBraceHold(player, run, config, wall, moveAxis) {
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  clearRecoilSpin(player);
  const playerCenterX = player.x + player.width * 0.5;
  const wallCenterX = wall.x + wall.width * 0.5;
  const holdDirection = playerCenterX <= wallCenterX ? 1 : -1;
  const launchDirection = moveAxis || Math.sign(player.vx) || player.facing || holdDirection;

  player.braceHolding = true;
  player.braceHoldWallId = wall.id;
  player.braceHoldDirection = holdDirection;
  player.braceHoldLaunchDirection = launchDirection;
  player.braceHoldSpeed = config.braceHoldStartSpeed ?? 0;
  player.vx = 0;
  player.vy = player.braceHoldSpeed;
  player.facing = holdDirection;
  player.onGround = false;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;
  player.wallJumpLockTimer = 0;
  player.wallJumpLockDirection = 0;
  player.canInteract = false;
  player.braceHoldActive = true;
  refillDashFromWall(player, config);
  refillRecoilShot(player, config);
  spawnParticles(run, wall.x + wall.width * 0.5, player.y + player.height * 0.45, 6, "#8fe1ff");
  pushNotice(run, "踰?怨좎젙");
}

function updateBraceHold(player, data, config, wall, dt, moveAxis) {
  const targetSpeed = moveAxis * config.runSpeed * (config.braceHoldMoveMultiplier ?? 0.7);
  const accel = config.groundAccel * config.airControlMultiplier;
  const decel = config.groundDecel * config.airControlMultiplier;

  player.vx = approach(player.vx, targetSpeed, (moveAxis !== 0 ? accel : decel) * dt);
  player.braceHoldSpeed = Math.min(
    config.braceHoldFallSpeed ?? 0,
    Math.max(player.braceHoldSpeed, config.braceHoldStartSpeed ?? 0) + (config.braceHoldAccel ?? 0) * dt
  );
  player.vy = player.braceHoldSpeed;
  if (moveAxis !== 0) {
    player.facing = moveAxis;
    player.braceHoldLaunchDirection = moveAxis;
  } else if (Math.abs(player.vx) > 12) {
    player.braceHoldLaunchDirection = Math.sign(player.vx);
  }
  player.onGround = false;
  player.canInteract = false;
  player.braceHoldActive = true;
}

function enterWallRun(player, run, config, wallDirection) {
  clearBraceHold(player);
  clearSlide(player);
  clearHover(player);
  clearRecoilSpin(player);
  player.wallRunActive = true;
  player.wallRunDirection = wallDirection;
  player.wallRunSpeed = Math.max(player.wallRunSpeed || 0, config.wallRunStartSpeed ?? 0, Math.max(0, -player.vy));
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;
  player.jumpBufferTimer = 0;
  player.onGround = false;
  refillDashFromWall(player, config);
  refillRecoilShot(player, config);
  spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.45, 4, "#b8f0ff");
}

function updateWallRun(player, config, dt) {
  player.wallRunSpeed = Math.min(
    (config.wallRunMaxSpeed ?? 0),
    player.wallRunSpeed + (config.wallRunAccel ?? 0) * dt
  );
  player.vy = -player.wallRunSpeed;
  player.vx = player.wallRunDirection * Math.max((config.runSpeed ?? 0) * 0.22, 88);
  player.onGround = false;
}

function launchFromWallRun(player, run, config) {
  const direction = player.wallRunDirection || player.wallDirection || 0;
  const exitDirection = direction === 0 ? player.facing || 1 : -direction;
  player.vx = exitDirection * Math.max(Math.abs(player.vx), config.wallRunExitHorizontal ?? 0);
  player.vy = -Math.max(player.wallRunSpeed, config.wallRunExitMinBoost ?? 0);
  player.facing = exitDirection;
  player.jumpBufferTimer = 0;
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;
  player.wallRunBoostActive = true;
  spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.35, 10, "#b8f0ff");
  pushNotice(run, "踰???諛쒖궗");
  clearWallRun(player);
}

function startHover(player, run, config) {
  player.hoverActive = true;
  player.hoverBoostActive = true;
  player.hoverParticleTimer = 0;
  player.jumpBufferTimer = 0;
  player.coyoteTimer = 0;
  if (player.vy > (config.hoverStartMaxFallSpeed ?? config.hoverFallSpeed ?? 180)) {
    player.vy = config.hoverStartMaxFallSpeed ?? config.hoverFallSpeed ?? 180;
  }
  spawnDirectedParticles(
    run,
    player.x + player.width * 0.5,
    player.y + player.height + 4,
    8,
    "#93eaff",
    0,
    1,
    260,
    0.5
  );
}

function performBraceVault(player, run, config, wall, moveAxis) {
  const direction = moveAxis || player.braceHoldLaunchDirection || Math.sign(player.vx) || player.facing || 1;
  clearBraceHold(player);
  player.vx = direction * Math.max(Math.abs(player.vx), config.braceBoostHorizontal ?? 0);
  player.vy = -(config.braceBoostVertical ?? Math.abs(config.jumpVelocity));
  player.facing = direction;
  player.onGround = false;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;
  player.braceReleaseTimer = 0.16;
  player.braceActive = true;
  spawnParticles(run, wall.x + wall.width * 0.5, player.y + player.height * 0.45, 10, "#8fe1ff");
  pushNotice(run, "踰?諛섎룞");
}

function updateMovementVfx(run, data, dt) {
  const player = run.player;
  const config = getMovementConfig(data);

  player.wallSlideDustTimer = Math.max(0, player.wallSlideDustTimer - dt);
  player.dashTrailTimer = Math.max(0, player.dashTrailTimer - dt);
  player.hoverParticleTimer = Math.max(0, player.hoverParticleTimer - dt);
  player.slideFrictionFxTimer = Math.max(0, (player.slideFrictionFxTimer ?? 0) - dt);

  if (player.dashTimer > 0 && player.dashTrailTimer === 0) {
    player.dashTrailTimer = 0.03;
    pushAfterimage(run, player);
  }

  if (player.wallSliding && player.wallSlideDustTimer === 0) {
    player.wallSlideDustTimer = 0.08;
    const offsetX = player.wallDirection === 1 ? player.x + player.width : player.x;
    spawnParticles(run, offsetX, player.y + player.height - 4, 2, "#9bbad1");
  }

  if (player.slideTimer > 0 && player.onGround && isSlideJumpBoostReady(player, config) && player.slideFrictionFxTimer === 0) {
    const direction = player.slideDirection || Math.sign(player.vx) || player.facing || 1;
    player.slideFrictionFxTimer = 0.035;
    spawnDirectedParticles(
      run,
      player.x + player.width * 0.5 - direction * player.width * 0.28,
      player.y + player.height - 3,
      4,
      "#f4dda6",
      -direction,
      -0.08,
      340,
      0.62,
    );
    spawnDirectedParticles(
      run,
      player.x + player.width * 0.5 - direction * player.width * 0.12,
      player.y + player.height - 2,
      2,
      "#dce7ec",
      -direction,
      0.05,
      220,
      0.46,
    );
  }

  if (player.hoverActive && !player.onGround && player.hoverParticleTimer === 0) {
    player.hoverParticleTimer = 0.045;
    spawnDirectedParticles(
      run,
      player.x + player.width * 0.42,
      player.y + player.height + 2,
      1,
      "#e9f7ff",
      -0.05,
      1,
      150,
      0.28
    );
    spawnDirectedParticles(
      run,
      player.x + player.width * 0.58,
      player.y + player.height + 2,
      1,
      "#93eaff",
      0.05,
      1,
      150,
      0.28
    );
  }
}

function updatePlayer(run, data, state, dt, input) {
  const player = run.player;
  const config = applyPlayerBodyMovementPenalties(
    getMovementConfig(data),
    getPlayerBodyMovementEffects(run),
  );
  const attackPressed = Boolean(input?.attackPressed);
  const meleeToolActive = Boolean(input?.meleeToolActive);
  const interactionPressed = Boolean(input?.interactionPressed);
  const recoilShotPressed = Boolean(input?.recoilShotPressed);
  const moveLeft = isEitherPressed(state, MOVE_LEFT_KEYS);
  const moveRight = isEitherPressed(state, MOVE_RIGHT_KEYS);
  const moveAxis = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
  const crouchHeld = isEitherPressed(state, CROUCH_KEYS);
  const crouchPressed = consumeEitherPress(state, CROUCH_KEYS);
  const jumpPressed = consumeEitherPress(state, JUMP_KEYS);
  const jumpHeld = isEitherPressed(state, JUMP_KEYS);
  const dashPressed = consumeEitherPress(state, DASH_KEYS);
  const sprintPressed = consumeEitherPress(state, SPRINT_KEYS);
  const sprintHeld = isEitherPressed(state, SPRINT_KEYS);
  const activeBraceWall = getActiveBraceWall(player, data, run);
  const heldBraceWall = getBraceWallById(data, player.braceHoldWallId, run);
  const wasWallSliding = player.wallSliding;
  const jumpReleased = !jumpHeld && player.jumpHeldLastFrame;
  player.noMoveInputTimer = moveAxis === 0
    ? (player.noMoveInputTimer ?? 0) + dt
    : 0;

  player.dashInvulnerable = config.dashInvulnerable;
  player.slideInvulnerable = config.slideInvulnerable ?? true;
  player.wasOnGround = player.onGround;
  player.crouchRequested = crouchHeld;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attackWindow = Math.max(0, player.attackWindow - dt);
  if (player.attackWindow <= 0) {
    player.attackToolActive = false;
  }
  player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  player.waterHazardCooldown = Math.max(0, Number(player.waterHazardCooldown || 0) - dt);
  Object.values(ensurePlayerBodyStatus(run)).forEach((part) => {
    part.recentHit = Math.max(0, (part.recentHit ?? 0) - dt);
  });
  applyPlayerBodyOngoingEffects(run, dt);
  player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
  player.wallJumpLockTimer = Math.max(0, player.wallJumpLockTimer - dt);
  player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - dt);
  player.dashCarryTimer = Math.max(0, player.dashCarryTimer - dt);
  player.recoilShotCooldownTimer = Math.max(0, player.recoilShotCooldownTimer - dt);
  player.recoilShotTimer = Math.max(0, player.recoilShotTimer - dt);
  player.recoilSpinTimer = Math.max(0, player.recoilSpinTimer - dt);
  player.recoilCameraTimer = Math.max(0, player.recoilCameraTimer - dt);
  player.sprintJumpCarryTimer = Math.max(0, player.sprintJumpCarryTimer - dt);
  decaySlideTimer(player, config, dt);
  player.slideGroundGraceTimer = Math.max(0, (player.slideGroundGraceTimer ?? 0) - dt);
  player.wallGraceTimer = Math.max(0, player.wallGraceTimer - dt);
  player.wallSlideGraceTimer = Math.max(0, player.wallSlideGraceTimer - dt);
  player.speedRetentionTimer = Math.max(0, player.speedRetentionTimer - dt);
  player.braceCooldownTimer = Math.max(0, player.braceCooldownTimer - dt);
  player.braceReleaseTimer = Math.max(0, player.braceReleaseTimer - dt);
  player.apexGravityActive = false;
  player.jumpCornerCorrected = false;
  player.dashCornerCorrected = false;
  player.dashCarryActive = false;
  player.sprintActive = false;
  player.sprintJumpBoostActive = false;
  player.slideJumpBoostActive = false;
  player.dashJumpBoostActive = false;
  player.speedRetentionActive = false;
  player.bufferedLandingJumpActive = false;
  player.wallSlideGraceActive = false;
  player.braceActive = false;
  player.braceHoldActive = false;
  player.wallRunBoostActive = false;
  player.dashResetActive = false;
  player.hoverBoostActive = Boolean(player.hoverActive && !player.onGround);
  player.recoilShotActive = player.recoilShotTimer > 0;

  syncDashCapacity(player, config);
  syncRecoilShotCapacity(player, config);

  if (player.dashCarryTimer === 0) {
    player.dashCarrySpeed = 0;
  }
  if (player.sprintJumpCarryTimer === 0) {
    player.sprintJumpCarrySpeed = 0;
  }
  if (player.slideTimer === 0) {
    player.slideDirection = 0;
    player.slideSpeed = 0;
    player.slideGroundGraceTimer = 0;
  }
  if (player.speedRetentionTimer === 0) {
    player.retainedSpeed = 0;
  }
  if (player.attackWindow === 0) {
    player.attackHits.clear();
  }

  if (player.zipLineActive) {
    if (updateZipLineRide(player, data, run, config, dt, jumpPressed)) {
      updateMovementVfx(run, data, dt);
      player.jumpHeldLastFrame = jumpHeld;
      setMovementState(player);
      return;
    }
  }

  if (!player.onGround && player.wallDirection !== 0) {
    player.wallGraceTimer = config.wallCoyoteTimeMs / 1000;
    player.wallGraceDirection = player.wallDirection;
  } else if (player.onGround) {
    player.wallGraceTimer = 0;
    player.wallGraceDirection = 0;
    player.wallSlideGraceTimer = 0;
    player.wallSlideGraceDirection = 0;
  }

  if (player.onGround) {
    player.coyoteTimer = config.coyoteTimeMs / 1000;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  if (jumpPressed) {
    player.jumpBufferTimer = config.jumpBufferMs / 1000;
  }

  if (dashPressed || sprintPressed) {
    player.sprintPrimed = true;
  }

  if (jumpReleased && !player.braceHolding && player.vy < 0) {
    player.vy *= config.jumpCutMultiplier;
  }

  if (
    player.dashCarryTimer > 0 &&
    moveAxis !== 0 &&
    Math.sign(moveAxis) !== Math.sign(player.dashCarrySpeed)
  ) {
    player.dashCarryTimer = 0;
    player.dashCarrySpeed = 0;
  }

  if (
    player.sprintJumpCarryTimer > 0 &&
    moveAxis !== 0 &&
    Math.sign(moveAxis) !== Math.sign(player.sprintJumpCarrySpeed)
  ) {
    player.sprintJumpCarryTimer = 0;
    player.sprintJumpCarrySpeed = 0;
  }

  const canBuildSprint =
    sprintHeld &&
    player.sprintPrimed &&
    player.onGround &&
    player.height === player.standHeight &&
    moveAxis !== 0;
  const sprintJumpCarryCompatible =
    player.sprintJumpCarryTimer > 0 &&
    player.sprintJumpCarrySpeed !== 0 &&
    (
      moveAxis === 0 ||
      Math.sign(moveAxis) === Math.sign(player.sprintJumpCarrySpeed)
    );
  const preserveAirSprint =
    (sprintHeld || sprintJumpCarryCompatible) &&
    (player.sprintPrimed || sprintJumpCarryCompatible) &&
    !player.onGround &&
    player.height === player.standHeight &&
    player.sprintCharge > 0 &&
    (
      moveAxis === 0 ||
      player.sprintDirection === 0 ||
      player.sprintDirection === moveAxis
    );

  if (canBuildSprint) {
    if (player.sprintDirection !== 0 && player.sprintDirection !== moveAxis) {
      player.sprintCharge = Math.max(0, player.sprintCharge - dt * 5);
    } else {
      player.sprintCharge = clamp(
        player.sprintCharge + dt / Math.max(0.001, (config.sprintBuildMs ?? 1) / 1000),
        0,
        1
      );
    }
    player.sprintDirection = moveAxis;
  } else if (preserveAirSprint) {
    if (moveAxis !== 0) {
      player.sprintDirection = moveAxis;
    }
  } else {
    player.sprintCharge = clamp(
      player.sprintCharge - dt / Math.max(0.001, (config.sprintDecayMs ?? 1) / 1000),
      0,
      1
    );
    if (player.sprintCharge === 0) {
      player.sprintDirection = 0;
      if (!sprintHeld && player.dashTimer === 0) {
        player.sprintPrimed = false;
      }
    }
  }

  if (player.onGround) {
    if (crouchPressed && tryStartSlide(player, data, config, moveAxis)) {
      // Slide startup already resized the player and preserved the incoming speed.
    } else if (player.slideTimer > 0) {
      player.crouchBlocked = false;
    } else if (crouchHeld) {
      tryEnterCrouch(player, data);
    } else {
      tryExitCrouch(player, data);
    }
    clearBraceHold(player);
    clearWallRun(player);
    clearHover(player);
    clearRecoilSpin(player);
    refillDashFromGround(player, config);
    refillRecoilShot(player, config);
    player.sprintJumpCarryTimer = 0;
    player.sprintJumpCarrySpeed = 0;
  }

  if (recoilShotPressed) {
    pushInputTrace(state, "playerShotInput", {
      aim: Number(Boolean(run.recoilAim?.aiming)),
      focus: Number(Boolean(run.focusActive)),
      face: Number(Boolean(run.faceOff?.active)),
    });
    const keepPrimaryHeld = isSelectedWeaponAutomatic(run, data);
    const firedRecoilShot = performRecoilShot(player, run, data, config, state);
    if (firedRecoilShot && state.mouse && !keepPrimaryHeld) {
      state.mouse.primaryDown = false;
      state.mouse.primaryJustPressed = false;
    }
  }

  const wallJumpSourceDirection =
    player.wallDirection !== 0
      ? player.wallDirection
      : player.wallGraceTimer > 0
        ? player.wallGraceDirection
        : 0;
  const holdingWallRunLine =
    wallJumpSourceDirection !== 0 &&
    (moveAxis === 0 || moveAxis === wallJumpSourceDirection);
  const wantsWallRun =
    !player.onGround &&
    wallJumpSourceDirection !== 0 &&
    holdingWallRunLine &&
    jumpHeld &&
    player.height === player.standHeight &&
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    !player.braceHolding;

  if (
    dashPressed &&
    !wantsWallRun &&
    player.dashAvailable &&
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0 &&
    player.dashCooldownTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    player.height === player.standHeight
  ) {
    const direction = moveAxis || player.facing;
    if (direction !== 0) {
      startDash(player, run, config, direction);
    }
  }

  if (player.dashWindupTimer > 0) {
    player.dashWindupTimer = Math.max(0, player.dashWindupTimer - dt);
    player.vx = 0;
    player.vy = 0;
    player.canInteract = false;
    player.facing = player.dashDirection || player.facing;
    player.onGround = false;
    player.wallSliding = false;
    player.wallDirection = 0;
    if (player.dashWindupTimer === 0) {
      startDashBurst(player, config);
    }
    updateMovementVfx(run, data, dt);
    player.jumpHeldLastFrame = jumpHeld;
    setMovementState(player);
    return;
  }

  if (player.dashTimer > 0) {
    player.dashTimer = Math.max(0, player.dashTimer - dt);
    player.vx = (config.dashDistance / (config.dashDurationMs / 1000)) * player.dashDirection;
    player.vy = 0;
    player.facing = player.dashDirection;
    player.canInteract = false;

    const contacts = resolvePlayerCollisions(player, data, dt, config, run);
    const landed = !player.wasOnGround && contacts.onGround;
    player.dashCornerCorrected = contacts.dashCornerCorrected;
    if (contacts.dashBlocked) {
      player.dashTimer = 0;
    }
    if (landed) {
      refillDashFromGround(player, config);
      refillRecoilShot(player, config);
      clearHover(player);
      clearRecoilSpin(player);
      player.coyoteTimer = config.coyoteTimeMs / 1000;
    }
    player.onGround = contacts.onGround;
    player.standingOnDynamicId = contacts.onGround ? (contacts.groundEntityId ?? null) : null;
    player.wallDirection = contacts.wallLeft ? -1 : contacts.wallRight ? 1 : 0;
    player.wallSliding = false;
    if (!player.onGround && player.wallDirection !== 0) {
      player.wallGraceTimer = config.wallCoyoteTimeMs / 1000;
      player.wallGraceDirection = player.wallDirection;
    } else if (player.onGround) {
      player.wallGraceTimer = 0;
      player.wallGraceDirection = 0;
      player.wallSlideGraceTimer = 0;
      player.wallSlideGraceDirection = 0;
    }

    if (player.onGround) {
      if (crouchPressed && tryStartSlide(player, data, config, moveAxis)) {
        // Slide startup already resized the player and preserved the incoming speed.
      } else if (player.slideTimer > 0) {
        player.crouchBlocked = false;
      } else if (crouchHeld) {
        tryEnterCrouch(player, data);
      } else {
        tryExitCrouch(player, data);
      }
    }

    if (player.dashTimer === 0) {
      player.canInteract = true;
    }

    if ((landed || player.dashTimer === 0) && !contacts.dashBlocked && player.dashDirection !== 0) {
      const dashSpeed = (config.dashDistance / (config.dashDurationMs / 1000))
        * (config.dashCarrySpeedMultiplier ?? 1)
        * player.dashDirection;
      armDashCarry(player, config, dashSpeed);
    }

    if (landed && player.jumpBufferTimer > 0 && player.height === player.standHeight) {
      if (player.sprintCharge >= 0.55 && Math.abs(player.vx) >= config.runSpeed * 0.92) {
        armSprintJumpCarry(player, config);
      }
      performJump(player, run, config.jumpVelocity);
      applySprintJumpCarry(player);
      applyDashJumpCarry(player, config);
      player.bufferedLandingJumpActive = true;
    }

    updateMovementVfx(run, data, dt);
    player.jumpHeldLastFrame = jumpHeld;
    setMovementState(player);
    return;
  }

  const canWallJump =
    player.jumpBufferTimer > 0 &&
    !player.onGround &&
    wallJumpSourceDirection !== 0 &&
    player.height === player.standHeight &&
    !wantsWallRun &&
    !player.wallRunActive;
  const canWallRun = wantsWallRun;
  const canGroundJump =
    player.jumpBufferTimer > 0 &&
    player.coyoteTimer > 0 &&
    (player.height === player.standHeight || player.slideTimer > 0);
  const canBrace =
    jumpPressed &&
    activeBraceWall &&
    !player.onGround &&
    player.height === player.standHeight &&
    player.dashTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    !canWallJump;

  if (canWallJump) {
    performWallJump(player, run, config, wallJumpSourceDirection);
  } else if (canBrace) {
    enterBraceHold(player, run, config, activeBraceWall, moveAxis);
  }

  if (player.braceHolding) {
    const braceWall = getBraceWallById(data, player.braceHoldWallId, run) ?? activeBraceWall;
    if (!braceWall || player.height !== player.standHeight) {
      clearBraceHold(player);
    } else if (jumpReleased) {
      performBraceVault(player, run, config, braceWall, moveAxis);
      applySprintJumpCarry(player);
    } else if (jumpHeld) {
      updateBraceHold(player, data, config, braceWall, dt, moveAxis);

      const contacts = resolvePlayerCollisions(player, data, dt, config, run);
      const landed = !player.wasOnGround && contacts.onGround;
      player.jumpCornerCorrected = contacts.jumpCornerCorrected;
      player.dashCornerCorrected = contacts.dashCornerCorrected;
      player.onGround = contacts.onGround;
      player.standingOnDynamicId = contacts.onGround ? (contacts.groundEntityId ?? null) : null;
      player.wallDirection = contacts.wallLeft ? -1 : contacts.wallRight ? 1 : 0;
      player.wallSliding = false;

      if (landed) {
        refillDashFromGround(player, config);
        player.coyoteTimer = config.coyoteTimeMs / 1000;
      }

      if (player.onGround) {
        clearBraceHold(player);
        player.wallGraceTimer = 0;
        player.wallGraceDirection = 0;
        player.wallSlideGraceTimer = 0;
        player.wallSlideGraceDirection = 0;
        refillDashFromGround(player, config);
      }

      updateMovementVfx(run, data, dt);
      player.jumpHeldLastFrame = jumpHeld;
      setMovementState(player);
      return;
    } else {
      clearBraceHold(player);
    }
  }

  if (canWallRun) {
    if (!player.wallRunActive || player.wallRunDirection !== wallJumpSourceDirection) {
      enterWallRun(player, run, config, wallJumpSourceDirection);
    }
  } else if (player.wallRunActive && jumpReleased) {
    launchFromWallRun(player, run, config);
  } else if (player.wallRunActive && (!jumpHeld || !holdingWallRunLine)) {
    clearWallRun(player);
  }

  if (player.wallRunActive) {
    updateWallRun(player, config, dt);
  } else if (canGroundJump) {
    const slideJumping = player.slideTimer > 0;
    const slideJumpBoostReady = slideJumping && isSlideJumpBoostReady(player, config);
    if (slideJumpBoostReady) {
      armSlideJumpCarry(player, run, config);
      tryExitCrouch(player, data);
    } else if (slideJumping) {
      clearSlide(player);
      tryExitCrouch(player, data);
    }
    if (!slideJumping && player.sprintCharge >= 0.55 && Math.abs(player.vx) >= config.runSpeed * 0.92) {
      armSprintJumpCarry(player, config);
    }
    const jumpVelocity = slideJumping
      ? -Math.abs(config.jumpVelocity ?? data.player.jumpVelocity ?? -900) * (slideJumpBoostReady ? (config.slideJumpVerticalMultiplier ?? 1.18) : 1)
      : config.jumpVelocity;
    performJump(player, run, jumpVelocity);
    applySprintJumpCarry(player);
    applyDashJumpCarry(player, config);
  }

  const canStartHover =
    jumpPressed &&
    !player.onGround &&
    player.height === player.standHeight &&
    player.dashTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    !player.wallRunActive &&
    !player.braceHolding &&
    !player.wallSliding &&
    !canWallJump &&
    !canBrace &&
    !canGroundJump &&
    player.vy >= (config.hoverStartMinVy ?? -40);

  if (canStartHover) {
    startHover(player, run, config);
  }

  if (player.wallJumpLockTimer > 0) {
    player.vx = player.wallJumpLockDirection * config.wallJumpHorizontal;
    player.facing = player.wallJumpLockDirection;
  } else if (player.wallRunActive) {
    player.facing = player.wallRunDirection === 0 ? player.facing : player.wallRunDirection;
  } else if (player.slideTimer > 0 && player.onGround && updateSlide(player, config, dt)) {
    player.crouchBlocked = false;
  } else {
    const downhillSprintActive = isMovingDownhillOnSlope(player, moveAxis);
    const baseTargetSpeed = player.height === player.crouchHeight && player.onGround
      ? moveAxis * config.runSpeed * config.crouchSpeedMultiplier
      : moveAxis * (
        downhillSprintActive
          ? (config.sprintSpeed ?? config.runSpeed)
          : getSprintTargetSpeed(player, config, moveAxis, sprintHeld && player.sprintPrimed)
      );
    const targetSpeed = player.sprintJumpCarryTimer > 0 && moveAxis !== 0
      ? moveAxis * Math.max(Math.abs(baseTargetSpeed), Math.abs(player.sprintJumpCarrySpeed))
      : baseTargetSpeed;

    const airControl = (config.airControlMultiplier ?? 1)
      * (player.hoverActive ? (config.hoverAirControlMultiplier ?? 1) : 1);
    const accel = player.onGround
      ? config.groundAccel
      : config.groundAccel * airControl;
    const decel = player.onGround
      ? config.groundDecel
      : config.groundDecel * airControl;

    const stopDecel = moveAxis === 0 && player.onGround
      ? getStopInertiaDecel(player, config, decel)
      : decel;
    player.vx = approach(player.vx, targetSpeed, (moveAxis !== 0 ? accel : stopDecel) * dt);

    if (
      player.onGround &&
      player.dashCarryTimer > 0 &&
      player.dashCarrySpeed !== 0 &&
      (moveAxis === 0 || Math.sign(moveAxis) === Math.sign(player.dashCarrySpeed)) &&
      Math.abs(player.vx) < Math.abs(player.dashCarrySpeed)
    ) {
      player.vx = approach(
        player.vx,
        player.dashCarrySpeed,
        config.groundAccel * 1.2 * dt
      );
      player.dashCarryActive = true;
    }

    if (
      !player.onGround &&
      player.sprintJumpCarryTimer > 0 &&
      player.sprintJumpCarrySpeed !== 0 &&
      (moveAxis === 0 || Math.sign(moveAxis) === Math.sign(player.sprintJumpCarrySpeed)) &&
      Math.abs(player.vx) < Math.abs(player.sprintJumpCarrySpeed)
    ) {
      player.vx = approach(
        player.vx,
        player.sprintJumpCarrySpeed,
        config.groundAccel * config.airControlMultiplier * 1.25 * dt
      );
      player.sprintJumpBoostActive = true;
    }

    if (moveAxis !== 0) {
      player.facing = moveAxis;
    }
  }

  if (
    player.sprintCharge > 0.12 &&
    (canBuildSprint || (!player.onGround && sprintJumpCarryCompatible))
  ) {
    player.sprintActive = true;
  }

  if (consumeEitherPress(state, ["KeyQ"])) {
    player.lightActive = !player.lightActive;
    pushNotice(run, player.lightActive ? "Flashlight on." : "Flashlight off.", 0.9);
  }
  if (Number.isFinite(run.maxBattery)) {
    run.battery = run.maxBattery;
  }

  if (attackPressed && player.attackCooldown === 0 && player.height === player.standHeight) {
    const meleeEffects = getPlayerBodyCombatEffects(run, null);
    player.attackCooldown = data.player.attackCooldown * (meleeToolActive ? meleeEffects.meleeCooldownMultiplier : 1);
    player.attackWindow = 0.12;
    player.attackToolActive = meleeToolActive;
    player.attackHits.clear();
    run.attackFx.push({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
      facing: player.facing,
      life: 0.12,
    });
  }

  const wallSlideSourceDirection =
    player.wallDirection !== 0
      ? player.wallDirection
      : player.wallSlideGraceTimer > 0
        ? player.wallSlideGraceDirection
        : 0;

  const wantsWallSlide =
    !player.onGround &&
    wallSlideSourceDirection !== 0 &&
    (((wallSlideSourceDirection === -1) && moveAxis < 0) || ((wallSlideSourceDirection === 1) && moveAxis > 0)) &&
    player.wallJumpLockTimer === 0 &&
    player.vy > 0;

  if (
    !player.onGround &&
    !player.wallSliding &&
    !player.wallRunActive &&
    jumpHeld &&
    Math.abs(player.vy) <= (config.apexGravityThreshold ?? 0)
  ) {
    player.apexGravityActive = true;
  }

  if (
    player.hoverActive &&
    (
      !jumpHeld ||
      player.onGround ||
      player.height !== player.standHeight ||
      player.wallRunActive ||
      player.braceHolding ||
      player.dashTimer > 0 ||
      player.wallJumpLockTimer > 0
    )
  ) {
    clearHover(player);
  }

  const gravityMultiplier = player.hoverActive
    ? (config.hoverGravityMultiplier ?? 0.18)
    : player.apexGravityActive
      ? (config.apexGravityMultiplier ?? 1)
      : 1;
  if (!player.wallRunActive) {
    player.vy += data.world.gravity * gravityMultiplier * dt;
  }
  if (player.hoverActive) {
    player.vy = Math.min(player.vy, config.hoverFallSpeed ?? 160);
  }
  if (wantsWallSlide && !player.wallRunActive) {
    player.vy = Math.min(player.vy, Math.abs(config.jumpVelocity) * config.wallSlideFallMultiplier);
  }

  const vxBeforeResolve = player.vx;
  const contacts = resolvePlayerCollisions(player, data, dt, config, run);
  const landed = !player.wasOnGround && contacts.onGround;
  player.jumpCornerCorrected = contacts.jumpCornerCorrected;
  player.dashCornerCorrected = contacts.dashCornerCorrected;

  player.onGround = contacts.onGround;
  player.standingOnDynamicId = contacts.onGround ? (contacts.groundEntityId ?? null) : null;
  player.wallDirection = contacts.wallLeft ? -1 : contacts.wallRight ? 1 : 0;
  player.wallSliding =
    !player.wallRunActive &&
    !player.onGround &&
    player.wallDirection !== 0 &&
    ((player.wallDirection === -1 && moveAxis < 0) || (player.wallDirection === 1 && moveAxis > 0)) &&
    player.vy > 0 &&
    player.wallJumpLockTimer === 0;

  if (player.wallRunActive) {
    if (player.wallDirection === 0 || player.onGround || contacts.hitHead) {
      launchFromWallRun(player, run, config);
    } else {
      player.wallRunDirection = player.wallDirection;
      player.wallSliding = false;
    }
  }

  if (player.wallSliding && !wasWallSliding) {
    refillDashFromWall(player, config);
    refillRecoilShot(player, config);
  }

  if (player.wallSliding) {
    player.wallSlideGraceTimer = (config.wallSlideGraceMs ?? 0) / 1000;
    player.wallSlideGraceDirection = player.wallDirection;
  } else if (
    !player.onGround &&
    player.wallSlideGraceTimer > 0 &&
    player.wallSlideGraceDirection !== 0 &&
    (((player.wallSlideGraceDirection === -1) && moveAxis < 0) || ((player.wallSlideGraceDirection === 1) && moveAxis > 0)) &&
    player.vy > 0 &&
    player.wallJumpLockTimer === 0
  ) {
    player.wallSliding = true;
    player.wallSlideGraceActive = true;
  }

  if (
    !player.onGround &&
    player.wallDirection !== 0 &&
    player.wallJumpLockTimer === 0
  ) {
    armSpeedRetention(player, config, vxBeforeResolve);
  }

  if (
    player.speedRetentionTimer > 0 &&
    player.wallDirection === 0 &&
    player.retainedSpeed !== 0 &&
    Math.abs(player.retainedSpeed) > Math.abs(player.vx)
  ) {
    player.vx = player.retainedSpeed;
    player.speedRetentionTimer = 0;
    player.retainedSpeed = 0;
    player.speedRetentionActive = true;
  }

  if (landed) {
    refillDashFromGround(player, config);
    refillRecoilShot(player, config);
    clearHover(player);
    clearRecoilSpin(player);
    const burstSize = contacts.landingSpeed > 480 ? 10 : 5;
    spawnParticles(run, player.x + player.width / 2, player.y + player.height, burstSize, "#c5d8e6");
    if (player.jumpBufferTimer > 0 && player.height === player.standHeight) {
      if (player.sprintCharge >= 0.55 && Math.abs(player.vx) >= config.runSpeed * 0.92) {
        armSprintJumpCarry(player, config);
      }
      performJump(player, run, config.jumpVelocity);
      applySprintJumpCarry(player);
      applyDashJumpCarry(player, config);
      player.bufferedLandingJumpActive = true;
    }
  }

  if (player.onGround) {
    player.coyoteTimer = config.coyoteTimeMs / 1000;
    player.wallGraceTimer = 0;
    player.wallGraceDirection = 0;
    player.wallSlideGraceTimer = 0;
    player.wallSlideGraceDirection = 0;
    clearBraceHold(player);
    clearHover(player);
    clearRecoilSpin(player);
    refillDashFromGround(player, config);
    refillRecoilShot(player, config);
    if (crouchPressed && tryStartSlide(player, data, config, moveAxis)) {
      // Slide startup already resized the player and preserved the incoming speed.
    } else if (player.slideTimer > 0) {
      player.slideGroundGraceTimer = (config.slideGroundGraceMs ?? 90) / 1000;
      player.crouchBlocked = false;
    } else if (crouchHeld) {
      tryEnterCrouch(player, data);
    } else {
      tryExitCrouch(player, data);
    }
  } else {
    player.crouchBlocked = false;
    if (player.slideTimer > 0) {
      if ((player.slideGroundGraceTimer ?? 0) > 0 && player.vy >= -EPSILON) {
        player.onGround = true;
        player.coyoteTimer = config.coyoteTimeMs / 1000;
        player.wallSliding = false;
      } else {
        clearSlide(player);
      }
    }
    if (player.wallDirection !== 0) {
      player.wallGraceTimer = config.wallCoyoteTimeMs / 1000;
      player.wallGraceDirection = player.wallDirection;
    }
  }

  if (isMovingDownhillOnSlope(player, moveAxis)) {
    player.sprintActive = true;
    player.sprintDirection = moveAxis;
    player.sprintCharge = Math.max(player.sprintCharge, config.slopeDownhillSprintCharge ?? 0.18);
  }

  player.canInteract = true;
  handleWaterHazards(run, data);
  updateMovementVfx(run, data, dt);
  player.jumpHeldLastFrame = jumpHeld;
  setMovementState(player);
}

function updateTimePhase(run, data, dt) {
  const previousPhase = run.timePhase;
  run.time += dt;

  if (run.time >= data.world.nightAt) {
    run.timePhase = "night";
  } else if (run.time >= data.world.duskAt) {
    run.timePhase = "dusk";
  } else {
    run.timePhase = "day";
  }

  if (previousPhase !== run.timePhase) {
    if (run.timePhase === "dusk") {
      pushNotice(run, "?⑺샎 吏꾩엯.");
      pushClue(run, "phase-dusk", "鍮쏆씠 ?쏀빐吏꾨떎. Q???쒖빞留?蹂댁“?쒕떎.");
    } else if (run.timePhase === "night") {
      run.nightActive = true;
      run.nightTransitionTimer = NIGHT_TRANSITION_SECONDS;
      pushNotice(run, "?쇨컙 ?꾪삊 ?쒖꽦.");
      pushClue(run, "phase-night", "諛ㅼ뿏 洹??鍮꾩슜??而ㅼ쭊??");
    }
  }

  if (previousPhase !== run.timePhase) {
    if (run.timePhase === "dusk") {
      run.nightTransitionTimer = Math.max(run.nightTransitionTimer || 0, NIGHT_TRANSITION_SECONDS * 0.72);
      pushNotice(run, "?⑺샎 吏꾩엯. ?쒖빞媛 醫곸븘吏꾨떎.");
    } else if (run.timePhase === "night") {
      pushNotice(run, "?쇨컙 ?꾪삊 ?쒖꽦. ?쒖빞媛 ?ш쾶 以꾩뼱?좊떎.");
    }
  }

  run.sanity = clamp(
    run.sanity - data.world.sanityDrain[run.timePhase] * dt,
    0,
    run.maxSanity || data.player.maxSanity
  );
}

function getAttackRect(player) {
  const width = player.attackToolActive ? 132 : 76;
  return createRect(
    player.facing === 1 ? player.x + player.width - 4 : player.x - width + 4,
    player.y + (player.attackToolActive ? 0 : 10),
    width,
    player.height - (player.attackToolActive ? 0 : 12)
  );
}

function resolveHarvest(run, encounter, abilityId = "threatSense") {
  if (encounter.outcome) {
    return;
  }
  encounter.outcome = "harvested";
  encounter.state = "dead";
  run.materials += encounter.harvestReward;
  run.sanity = clamp(run.sanity - encounter.harvestSanityCost, 0, run.maxSanity || 100);
  uniquePush(run.pendingUnlocks, abilityId);
  uniquePush(run.successfulHarvestIds, encounter.id);
  pushNotice(run, `${encounter.label} ?섑솗.`);
  spawnParticles(run, encounter.x + encounter.width / 2, encounter.y + 24, 16, "#ff8e72");
}

function resolveRelease(run, encounter) {
  if (encounter.outcome) {
    return;
  }
  encounter.outcome = "released";
  encounter.state = "released";
  run.sanity = clamp(run.sanity + encounter.releaseSanity, 0, run.maxSanity || 100);
  uniquePush(run.pendingStoryFlags, encounter.storyFlag);
  uniquePush(run.successfulReleaseIds, encounter.id);
  pushNotice(run, `${encounter.label} 援ъ썝.`);
  spawnParticles(run, encounter.x + encounter.width / 2, encounter.y + 16, 16, "#a8f7cf");
}

function updateAttackHits(run, data) {
  if (run.player.attackWindow <= 0) {
    return;
  }

  const attackRect = getAttackRect(run.player);
  const liveTargets = [
    run.encounters.guard,
    run.encounters.ritualist,
    ...run.threats,
    ...(run.hostileDrones || []),
    ...(run.humanoidEnemies || []),
  ];

  for (const target of liveTargets) {
    if (isEntityDisabled(target)) {
      continue;
    }
    if (run.player.attackHits.has(target.id)) {
      continue;
    }
    if (target.dead || target.state === "dead" || target.state === "released") {
      continue;
    }
    if (!rectsOverlap(attackRect, target)) {
      continue;
    }

    run.player.attackHits.add(target.id);
    const damage = run.player.attackToolActive && (target.type === "humanoid" || target.type === "humanoidEnemy")
      ? Math.max(run.player.attackDamage, 60)
      : run.player.attackDamage;
    target.hp = Math.max(0, target.hp - damage);
    target.hitFlash = 0.14;
    spawnDamageNumber(run, target.x + target.width * 0.5, target.y + 12, damage, "#ffd6ba");
    spawnParticles(run, target.x + target.width / 2, target.y + 22, 6, "#ffd6ba");

    if (target.type === "guard" && target.state !== "dead" && target.state !== "released") {
      target.state = "chase";
      target.wasProvoked = true;
      pushNotice(run, "寃臾??덉감媛 源⑥죱??");
    }

    if (target.type === "ritualist" && target.state !== "dead" && target.state !== "released") {
      target.state = "hostile";
      target.wasProvoked = true;
      pushNotice(run, "?섏떇???덈? ?ν븳??");
    }

    if (target.id.startsWith("shade")) {
      target.active = true;
    }

    if (target.hp === 0) {
      if (target.type === "hostileDrone") {
        destroyHostileDrone(run, target);
      } else if (target.type === "humanoid" || target.type === "humanoidEnemy") {
        knockDownHumanoidEnemy(run, data, target);
      } else if (target.type === "guard" || target.type === "ritualist") {
        resolveHarvest(run, target);
      } else {
        target.dead = true;
        spawnParticles(run, target.x + target.width / 2, target.y + 16, 12, "#9dd8ff");
      }
    }
  }

  for (const crate of run.lootCrates || []) {
    if (crate.searched || crate.spilled || crate.broken || run.player.attackHits.has(crate.id)) {
      continue;
    }
    if (!rectsOverlap(attackRect, crate)) {
      continue;
    }
    run.player.attackHits.add(crate.id);
    damageLootCrate(run, crate, Math.max(run.player.attackDamage, crate.maxHp ?? crate.hp ?? 1), run.player.facing || 1, -0.12);
  }
}

function updateGuard(run, data, dt) {
  const guard = run.encounters.guard;
  if (isEntityDisabled(guard) || guard.state === "released") {
    return;
  }

  guard.hitFlash = Math.max(0, guard.hitFlash - dt);
  guard.attackCooldown = Math.max(0, guard.attackCooldown - dt);

  const player = run.player;
  const playerCenter = getCenter(player);
  const guardCenter = getCenter(guard);
  const distance = distanceBetween(playerCenter, guardCenter);
  const isMoving = Math.abs(player.vx) > 24 || Math.abs(player.vy) > 90;
  const canSeePlayer = hasLineOfSightToPlayer(run, data, guardCenter, playerCenter);
  const inDetection = distance < guard.detectionRadius && canSeePlayer;
  const inCheckpoint = rectsOverlap(player, guard.checkpointZone);
  const canInspect = run.inventory.badge && inCheckpoint && canSeePlayer && !isMoving && !player.lightActive;

  if (guard.state === "patrol") {
    guard.x += guard.patrolDirection * guard.speed * dt;
    if (guard.x <= guard.patrol.left) {
      guard.x = guard.patrol.left;
      guard.patrolDirection = 1;
    }
    if (guard.x >= guard.patrol.right) {
      guard.x = guard.patrol.right;
      guard.patrolDirection = -1;
    }
    guard.facing = guard.patrolDirection;

    if (inDetection && (isMoving || player.lightActive)) {
      guard.state = "warn";
      guard.warningTimer = player.lightActive ? 0.2 : 0.8;
      pushClue(run, "guard-motion", guard.clues.motion);
      pushNotice(run, "?뺤? 寃쎄퀬.");
    }
  } else if (guard.state === "warn") {
    guard.facing = playerCenter.x >= guardCenter.x ? 1 : -1;
    guard.warningTimer = Math.max(0, guard.warningTimer - dt);

    if (canInspect) {
      guard.state = "inspect";
      guard.inspectProgress = 0;
      pushClue(run, "guard-still", guard.clues.still);
      pushNotice(run, "?뺤? ?좎?.");
    } else if (guard.warningTimer === 0) {
      if (inDetection && (isMoving || player.lightActive)) {
        guard.state = "chase";
        guard.wasProvoked = true;
        pushNotice(run, "媛먯떆?먭? 異붿쟻?쒕떎.");
      } else {
        guard.state = "patrol";
      }
    }
  } else if (guard.state === "chase") {
    const direction = playerCenter.x >= guardCenter.x ? 1 : -1;
    if (inDetection) {
      guard.facing = direction;
      guard.x += direction * guard.chaseSpeed * dt;
    }

    if (canInspect) {
      guard.state = "inspect";
      guard.inspectProgress = 0;
      pushClue(run, "guard-badge", guard.clues.badge);
      pushClue(run, "guard-still", guard.clues.still);
      pushNotice(run, "利앺몴 ?뺤씤. ?吏곸씠吏 留?");
    }

    if (!inDetection) {
      guard.searchTimer += dt;
      if (guard.searchTimer > 3) {
        guard.state = "patrol";
        guard.searchTimer = 0;
      }
    } else {
      guard.searchTimer = 0;
    }

    if (canSeePlayer && distance < guard.attackRange && guard.attackCooldown === 0) {
      guard.attackCooldown = 1;
      damagePlayer(run, guard.damage, direction, "媛먯떆??洹쇱젒 ?寃?");
    }
  } else if (guard.state === "inspect") {
    guard.facing = playerCenter.x >= guardCenter.x ? 1 : -1;
    if (!canInspect) {
      guard.state = "warn";
      guard.warningTimer = 0.45;
      guard.inspectProgress = 0;
      pushNotice(run, "寃臾?以묐떒. ?ㅼ떆 硫덉떠??");
      return;
    }

    guard.inspectProgress += dt;
    if (guard.inspectProgress >= 2.6) {
      resolveRelease(run, guard);
    }
  }
}

function resetRitualPedestals(ritualist) {
  ritualist.sequenceProgress = 0;
  for (const pedestal of ritualist.pedestals) {
    pedestal.active = false;
  }
}

function upsetRitual(run, ritualist, clueKey, clueText, notice) {
  ritualist.state = "hostile";
  ritualist.wasProvoked = true;
  ritualist.calmTimer = 0;
  resetRitualPedestals(ritualist);
  pushClue(run, clueKey, clueText);
  pushNotice(run, notice);
}

function usePedestal(run, pedestal) {
  const ritualist = run.encounters.ritualist;
  if (isEntityDisabled(ritualist) || ritualist.state === "released") {
    return;
  }
  if (ritualist.state === "hostile") {
    pushNotice(run, "?섏떇??源⑥죱?? ?좎떆 臾쇰윭?쒕씪.");
    return;
  }

  const expectedId = ritualist.correctOrder[ritualist.sequenceProgress];
  if (pedestal.id !== expectedId) {
    upsetRitual(
      run,
      ritualist,
      "ritual-wrong",
      ritualist.clues.wrong,
      "?쒖꽌 ?ㅻ쪟. ?섏떇???ㅼ쭛?뚮떎."
    );
    return;
  }

  const livePedestal = ritualist.pedestals.find((entry) => entry.id === pedestal.id);
  if (livePedestal) {
    livePedestal.active = true;
  }
  ritualist.sequenceProgress += 1;
  spawnParticles(run, pedestal.x + pedestal.width / 2, pedestal.y + 14, 10, "#f3dfa3");

  if (ritualist.sequenceProgress >= ritualist.correctOrder.length) {
    resolveRelease(run, ritualist);
    return;
  }

  pushNotice(run, `${pedestal.label} 諛섏쓳.`);
}

function updateRitualist(run, data, dt) {
  const ritualist = run.encounters.ritualist;
  if (isEntityDisabled(ritualist) || ritualist.state === "released") {
    return;
  }

  ritualist.hitFlash = Math.max(0, ritualist.hitFlash - dt);
  ritualist.attackCooldown = Math.max(0, ritualist.attackCooldown - dt);

  const player = run.player;
  const playerCenter = getCenter(player);
  const ritualCenter = getCenter(ritualist);
  const distance = distanceBetween(playerCenter, ritualCenter);
  const canSeePlayer = hasLineOfSightToPlayer(run, data, ritualCenter, playerCenter);
  const inArea = rectsOverlap(player, ritualist.ritualArea);

  if (inArea) {
    pushClue(run, "ritual-area", ritualist.clues.area);
  }

  if (ritualist.state === "ritual") {
    const target = ritualist.patrolPoints[ritualist.patrolIndex];
    const dx = target.x - ritualist.x;
    if (Math.abs(dx) < 8) {
      ritualist.patrolIndex = (ritualist.patrolIndex + 1) % ritualist.patrolPoints.length;
    } else {
      const direction = dx > 0 ? 1 : -1;
      ritualist.facing = direction;
      ritualist.x += direction * ritualist.speed * dt;
    }

    if (inArea && canSeePlayer && player.lightActive) {
      upsetRitual(
        run,
        ritualist,
        "ritual-light",
        ritualist.clues.light,
        "鍮쏆뿉 ?섏떇??源⑥죱??"
      );
    }
  } else if (ritualist.state === "hostile") {
    const direction = playerCenter.x >= ritualCenter.x ? 1 : -1;
    if (canSeePlayer) {
      ritualist.facing = direction;
      ritualist.x += direction * ritualist.chaseSpeed * dt;
    }

    if (canSeePlayer && distance < ritualist.attackRange && ritualist.attackCooldown === 0) {
      ritualist.attackCooldown = 1.1;
      damagePlayer(run, ritualist.damage, direction, "?섏떇???寃?");
    }

    if (canSeePlayer && (inArea || distance < 360)) {
      ritualist.calmTimer = 0;
    } else {
      ritualist.calmTimer += dt;
      if (ritualist.calmTimer > 4) {
        ritualist.state = "ritual";
        ritualist.calmTimer = 0;
        resetRitualPedestals(ritualist);
        pushNotice(run, "?섏떇???ㅼ떆 怨좎슂?댁쭊??");
      }
    }
  }
}

function updateThreats(run, data, dt) {
  for (const threat of run.threats) {
    if (isEntityDisabled(threat)) {
      continue;
    }
    threat.hitFlash = Math.max(0, threat.hitFlash - dt);
    threat.attackCooldown = Math.max(0, threat.attackCooldown - dt);

    if (!run.nightActive || threat.dead) {
      continue;
    }

    threat.active = true;
    const playerCenter = getCenter(run.player);
    const threatCenter = getCenter(threat);
    const distance = distanceBetween(playerCenter, threatCenter);
    const canSeePlayer = hasLineOfSightToPlayer(run, data, threatCenter, playerCenter);

    if (canSeePlayer && distance < 340) {
      const direction = playerCenter.x >= threatCenter.x ? 1 : -1;
      threat.facing = direction;
      threat.x += direction * threat.chaseSpeed * dt;

      if (distance < threat.attackRange && threat.attackCooldown === 0) {
        threat.attackCooldown = 1;
        damagePlayer(run, threat.damage, direction, "?대몺 ???꾪삊????튇??");
      }
    } else {
      threat.x += threat.patrolDirection * threat.speed * dt;
      if (threat.x <= threat.patrol.left) {
        threat.x = threat.patrol.left;
        threat.patrolDirection = 1;
      }
      if (threat.x >= threat.patrol.right) {
        threat.x = threat.patrol.right;
        threat.patrolDirection = -1;
      }
      threat.facing = threat.patrolDirection;
    }
  }
}

function hydrateHostileDroneState(drone) {
  const center = getCenter(drone);
  if (!Number.isFinite(drone.spawnX)) {
    drone.spawnX = drone.x;
  }
  if (!Number.isFinite(drone.spawnY)) {
    drone.spawnY = drone.y;
  }
  if (!Number.isFinite(drone.hp)) {
    drone.hp = drone.maxHp ?? 1;
  }
  if (!Number.isFinite(drone.vx)) {
    drone.vx = 0;
  }
  if (!Number.isFinite(drone.vy)) {
    drone.vy = 0;
  }
  if (!Number.isFinite(drone.aimTimer)) {
    drone.aimTimer = 0;
  }
  if (!Number.isFinite(drone.aimDuration)) {
    drone.aimDuration = 0;
  }
  if (!Number.isFinite(drone.aimDirX) || !Number.isFinite(drone.aimDirY)) {
    drone.aimDirX = drone.facing || -1;
    drone.aimDirY = 0;
  }
  if (!Number.isFinite(drone.aimLength)) {
    drone.aimLength = drone.beamLength ?? drone.fireRange ?? 760;
  }
  if (!Number.isFinite(drone.aimStartX) || !Number.isFinite(drone.aimStartY)) {
    drone.aimStartX = center.x;
    drone.aimStartY = center.y;
  }
  if (!Number.isFinite(drone.aimEndX) || !Number.isFinite(drone.aimEndY)) {
    drone.aimEndX = center.x + drone.aimDirX * drone.aimLength;
    drone.aimEndY = center.y + drone.aimDirY * drone.aimLength;
  }
  if (!Number.isFinite(drone.attackCooldown)) {
    drone.attackCooldown = drone.initialCooldown ?? 0.8;
  }
  if (!Number.isFinite(drone.recoverTimer)) {
    drone.recoverTimer = 0;
  }
  if (!Number.isFinite(drone.diveTimer)) {
    drone.diveTimer = 0;
  }
  if (!Number.isFinite(drone.diveDuration)) {
    drone.diveDuration = 0;
  }
  if (!Number.isFinite(drone.diveElapsed)) {
    drone.diveElapsed = 0;
  }
}

function createRuntimeHostileDrone(definition) {
  return {
    ...definition,
    hp: definition.maxHp ?? 1,
    vx: 0,
    vy: 0,
    active: false,
    dead: Boolean(definition.disabled),
    facing: -1,
    patrolDirection: 1,
    attackCooldown: definition.initialCooldown ?? 0.8,
    recoverTimer: 0,
    diveTimer: 0,
    diveDuration: 0,
    diveElapsed: 0,
    diveStartX: definition.x,
    diveStartY: definition.y,
    diveEndX: definition.x,
    diveEndY: definition.y,
    diveHasHit: false,
    spawnX: Number.isFinite(definition.spawnX) ? definition.spawnX : definition.x,
    spawnY: Number.isFinite(definition.spawnY) ? definition.spawnY : definition.y,
    returningHome: false,
    aimTimer: 0,
    aimDuration: 0,
    aimDirX: -1,
    aimDirY: 0,
    aimStartX: definition.x + definition.width * 0.5,
    aimStartY: definition.y + definition.height * 0.5,
    aimEndX: definition.x,
    aimEndY: definition.y,
    aimLength: definition.beamLength ?? definition.fireRange ?? 760,
    hitFlash: 0,
    bobSeed: definition.bobSeed ?? Math.random() * Math.PI * 2,
  };
}

function ensureHostileDrones(run, data) {
  if (!Array.isArray(run.enemyShots)) {
    run.enemyShots = [];
  }
  if (!Array.isArray(run.hostileDrones)) {
    run.hostileDrones = [];
  }
  if (!run.hostileDrones.length && data.hostileDrones?.length) {
    run.hostileDrones = data.hostileDrones.map((drone) => createRuntimeHostileDrone(drone));
  }
}

function updateDroneAimLine(drone, center) {
  const length = drone.aimLength ?? drone.beamLength ?? drone.fireRange ?? 760;
  drone.aimStartX = center.x;
  drone.aimStartY = center.y;
  drone.aimEndX = center.x + (drone.aimDirX || 1) * length;
  drone.aimEndY = center.y + (drone.aimDirY || 0) * length;
}

function beginDroneTelegraph(run, drone, playerCenter, droneCenter) {
  const dx = playerCenter.x - droneCenter.x;
  const dy = playerCenter.y - droneCenter.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const dirX = dx / length;
  const dirY = dy / length;
  const telegraphDuration = drone.telegraphDuration ?? 0.58;

  drone.aimTimer = telegraphDuration;
  drone.aimDuration = telegraphDuration;
  drone.aimDirX = dirX;
  drone.aimDirY = dirY;
  drone.aimLength = drone.beamLength ?? drone.fireRange ?? 760;
  updateDroneAimLine(drone, droneCenter);
  drone.attackCooldown = telegraphDuration + (drone.fireCooldown ?? 1.25);
  spawnDirectedParticles(run, droneCenter.x, droneCenter.y, 3, "#87e1ff", dirX, dirY, 220, 0.3);
}

function fireDroneBeam(run, drone) {
  const duration = drone.beamLife ?? 0.12;
  run.enemyShots.push({
    id: `${drone.id}-beam-${Math.round((run.time ?? 0) * 1000)}-${run.enemyShots.length}`,
    type: "beam",
    startX: drone.aimStartX,
    startY: drone.aimStartY,
    endX: drone.aimEndX,
    endY: drone.aimEndY,
    dirX: drone.aimDirX || 1,
    dirY: drone.aimDirY || 0,
    radius: drone.beamRadius ?? 18,
    damage: drone.damage ?? 10,
    life: duration,
    duration,
    hasHit: false,
  });
  spawnDirectedParticles(run, drone.aimStartX, drone.aimStartY, 7, "#87e1ff", drone.aimDirX || 1, drone.aimDirY || 0, 420, 0.22);
}

function fireFlyingRangedShot(run, drone, playerCenter) {
  run.enemyShots = run.enemyShots || [];
  const originX = drone.x + drone.width * 0.5;
  const originY = drone.y + drone.height * 0.5;
  const dx = playerCenter.x - originX;
  const dy = playerCenter.y - originY;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const speed = drone.projectileSpeed ?? 720;
  run.enemyShots.push({
    id: `${drone.id}-orb-${Math.round((run.time ?? 0) * 1000)}-${run.enemyShots.length}`,
    type: "flyingRanged",
    x: originX,
    y: originY,
    prevX: originX,
    prevY: originY,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    radius: drone.projectileRadius ?? 9,
    damage: drone.projectileDamage ?? drone.damage ?? 10,
    life: drone.projectileLife ?? 2.4,
    duration: drone.projectileLife ?? 2.4,
    color: drone.projectileColor || "#93eaff",
  });
  drone.hitFlash = Math.max(drone.hitFlash ?? 0, 0.08);
}

function startCrowDive(drone) {
  const length = Math.max(1, Math.hypot(drone.aimEndX - drone.aimStartX, drone.aimEndY - drone.aimStartY));
  const speed = drone.diveSpeed ?? 1320;
  const duration = clamp(length / Math.max(1, speed), 0.18, drone.diveMaxDuration ?? 0.72);

  drone.diveDuration = duration;
  drone.diveTimer = duration;
  drone.diveElapsed = 0;
  drone.diveHasHit = false;
  drone.diveStartX = drone.aimStartX - drone.width * 0.5;
  drone.diveStartY = drone.aimStartY - drone.height * 0.5;
  drone.diveEndX = drone.aimEndX - drone.width * 0.5;
  drone.diveEndY = drone.aimEndY - drone.height * 0.5;
  drone.x = drone.diveStartX;
  drone.y = drone.diveStartY;
  drone.vx = (drone.aimDirX || 1) * speed;
  drone.vy = (drone.aimDirY || 0) * speed;
  drone.facing = Math.sign(drone.aimDirX) || drone.facing || 1;
}

function getHostileBodyDamageRect(entity) {
  const insetX = entity.damageInsetX ?? 4;
  const insetY = entity.damageInsetY ?? 4;
  return createRect(
    entity.x + insetX,
    entity.y + insetY,
    Math.max(10, entity.width - insetX * 2),
    Math.max(10, entity.height - insetY * 2)
  );
}

function carryPlayerOnDynamicSolid(run, entity, previousX, previousY, data) {
  const player = run.player;
  if (player.standingOnDynamicId !== entity.id || entity.diveTimer > 0) {
    return;
  }
  const dx = entity.x - previousX;
  const dy = entity.y - previousY;
  if (Math.abs(dx) <= EPSILON && Math.abs(dy) <= EPSILON) {
    return;
  }
  player.x = clamp(player.x + dx, 0, data.world.width - player.width);
  player.y = clamp(player.y + dy, 0, data.world.height - player.height);
}

function updateCrowDive(run, data, drone, dt) {
  const previousX = drone.x;
  const previousY = drone.y;
  const duration = Math.max(0.001, drone.diveDuration || 0.24);
  drone.diveTimer = Math.max(0, drone.diveTimer - dt);
  drone.diveElapsed = Math.min(duration, drone.diveElapsed + dt);
  const progress = clamp(drone.diveElapsed / duration, 0, 1);
  const eased = 1 - Math.pow(1 - progress, 2.6);

  drone.x = lerp(drone.diveStartX, drone.diveEndX, eased);
  drone.y = lerp(drone.diveStartY, drone.diveEndY, eased);
  drone.x = clamp(drone.x, 0, data.world.width - drone.width);
  drone.y = clamp(drone.y, 40, data.world.height - drone.height - 40);
  drone.vx = (drone.x - previousX) / Math.max(dt, 0.001);
  drone.vy = (drone.y - previousY) / Math.max(dt, 0.001);
  drone.facing = Math.sign(drone.vx) || drone.facing || 1;

  if (!drone.diveHasHit && rectsOverlap(getHostileBodyDamageRect(drone), run.player)) {
    drone.diveHasHit = true;
    damagePlayer(run, drone.diveDamage ?? drone.damage ?? 10, Math.sign(drone.vx) || drone.facing || 1, "Crow dive hit.");
    spawnParticles(run, run.player.x + run.player.width * 0.5, run.player.y + run.player.height * 0.5, 12, "#87e1ff");
  }

  if (drone.diveTimer === 0) {
    drone.recoverTimer = drone.diveRecoverTime ?? 0.34;
    drone.vx *= 0.32;
    drone.vy *= 0.18;
  }
}

function lineIntersectsRect(startX, startY, endX, endY, rect, padding = 0) {
  const left = rect.x - padding;
  const right = rect.x + rect.width + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.height + padding;
  const dx = endX - startX;
  const dy = endY - startY;
  let tMin = 0;
  let tMax = 1;

  const tests = [
    [-dx, startX - left],
    [dx, right - startX],
    [-dy, startY - top],
    [dy, bottom - startY],
  ];

  for (const [p, q] of tests) {
    if (Math.abs(p) <= EPSILON) {
      if (q < 0) {
        return false;
      }
      continue;
    }
    const ratio = q / p;
    if (p < 0) {
      if (ratio > tMax) {
        return false;
      }
      tMin = Math.max(tMin, ratio);
    } else {
      if (ratio < tMin) {
        return false;
      }
      tMax = Math.min(tMax, ratio);
    }
  }

  return true;
}

function findTemporaryBlockLineHit(run, startX, startY, endX, endY, padding = 0) {
  for (const block of run.temporaryBlocks || []) {
    if (isTemporaryBlockHidden(block)) {
      continue;
    }
    if (lineIntersectsRect(startX, startY, endX, endY, block, padding)) {
      return block;
    }
  }
  return null;
}

function pointInsideRect(point, rect, padding = 0) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

function doesRectBlockSight(rect, from, to, padding = 0) {
  if (!rect || pointInsideRect(from, rect, padding) || pointInsideRect(to, rect, padding)) {
    return false;
  }
  return lineIntersectsRect(from.x, from.y, to.x, to.y, rect, padding);
}

function hasLineOfSightToPlayer(run, data, from, to, padding = 1) {
  for (const platform of getCollisionPlatforms(data, run)) {
    if (doesRectBlockSight(platform, from, to, padding)) {
      return false;
    }
  }
  for (const block of run.temporaryBlocks || []) {
    if (!isTemporaryBlockHidden(block) && doesRectBlockSight(block, from, to, padding)) {
      return false;
    }
  }
  return true;
}

function isFlyingRangedDrone(drone) {
  return drone?.visualKind === "flyingRanged";
}

function updateFlyingRangedDrone(run, data, drone, dt, playerCenter) {
  const center = getCenter(drone);
  const spawnX = Number.isFinite(drone.spawnX) ? drone.spawnX : drone.x;
  const spawnY = Number.isFinite(drone.spawnY) ? drone.spawnY : drone.y;
  const spawnCenter = {
    x: spawnX + drone.width * 0.5,
    y: spawnY + drone.height * 0.5,
  };
  const canSeePlayer = hasLineOfSightToPlayer(run, data, center, playerCenter);
  const distanceToPlayer = distanceBetween(center, playerCenter);
  const distanceToSpawn = distanceBetween(center, spawnCenter);
  const activationRadius = drone.activationRadius ?? 760;
  const leashRange = drone.leashRange ?? 760;
  const returnRange = drone.returnRange ?? 48;
  const desiredRange = drone.preferredRange ?? 320;
  const retreatRange = drone.retreatRange ?? Math.max(120, desiredRange * 0.62);
  const playerAwayX = playerCenter.x - center.x;
  const playerAwayY = playerCenter.y - center.y;
  const playerAwayLength = Math.max(0.001, Math.hypot(playerAwayX, playerAwayY));
  const dirToPlayerX = playerAwayX / playerAwayLength;
  const dirToPlayerY = playerAwayY / playerAwayLength;
  const playerMovingAway = (
    (run.player.vx ?? 0) * dirToPlayerX + (run.player.vy ?? 0) * dirToPlayerY
  ) > (drone.chaseVelocityThreshold ?? 36);

  if (distanceToSpawn > leashRange) {
    drone.returningHome = true;
    drone.active = false;
  } else if (canSeePlayer && distanceToPlayer < activationRadius && !drone.returningHome) {
    drone.active = true;
  } else if (!canSeePlayer || distanceToPlayer > activationRadius * 1.35) {
    drone.active = false;
  }

  if (drone.returningHome && distanceToSpawn <= returnRange) {
    drone.returningHome = false;
  }

  let targetX = spawnX;
  let targetY = spawnY;
  if (drone.active && canSeePlayer && !drone.returningHome) {
    if (distanceToPlayer < retreatRange) {
      targetX = playerCenter.x - dirToPlayerX * desiredRange - drone.width * 0.5;
      targetY = playerCenter.y - dirToPlayerY * desiredRange - drone.height * 0.5;
    } else if (playerMovingAway || distanceToPlayer > desiredRange * 1.18) {
      targetX = playerCenter.x - dirToPlayerX * desiredRange - drone.width * 0.5;
      targetY = playerCenter.y - dirToPlayerY * desiredRange - drone.height * 0.5;
    } else {
      targetX = drone.x;
      targetY = drone.y;
    }
    drone.facing = playerCenter.x >= center.x ? 1 : -1;
  } else {
    drone.facing = Math.sign(spawnCenter.x - center.x) || drone.facing || 1;
  }

  const flapBob = Math.sin((run.time ?? 0) * (drone.flapRate ?? 9) + (drone.bobSeed ?? 0)) * (drone.flapAmplitude ?? 10);
  targetX = clamp(targetX, 0, data.world.width - drone.width);
  targetY = clamp(targetY + flapBob, 40, data.world.height - drone.height - 40);

  const accel = drone.acceleration ?? 5.8;
  const maxSpeed = drone.speed ?? 185;
  const desiredVx = clamp((targetX - drone.x) * accel, -maxSpeed, maxSpeed);
  const desiredVy = clamp((targetY - drone.y) * accel, -maxSpeed, maxSpeed);
  drone.vx = lerp(drone.vx ?? 0, desiredVx, Math.min(1, dt * 6));
  drone.vy = lerp(drone.vy ?? 0, desiredVy, Math.min(1, dt * 6));
  drone.x = clamp(drone.x + drone.vx * dt, 0, data.world.width - drone.width);
  drone.y = clamp(drone.y + drone.vy * dt, 40, data.world.height - drone.height - 40);

  if (
    drone.active &&
    canSeePlayer &&
    !drone.returningHome &&
    distanceToPlayer < (drone.fireRange ?? 620) &&
    drone.attackCooldown === 0
  ) {
    fireFlyingRangedShot(run, drone, playerCenter);
    drone.attackCooldown = drone.fireCooldown ?? 1.45;
  }
}

function updateHostileDrones(run, data, dt) {
  ensureHostileDrones(run, data);
  const drones = run.hostileDrones || [];
  if (!drones.length) {
    return;
  }

  const player = run.player;
  const playerCenter = getCenter(player);
  for (const drone of drones) {
    if (isEntityDisabled(drone) || drone.dead) {
      if (drone) {
        drone.aimTimer = 0;
      }
      continue;
    }
    hydrateHostileDroneState(drone);

    drone.hitFlash = Math.max(0, drone.hitFlash - dt);
    drone.attackCooldown = Math.max(0, drone.attackCooldown - dt);
    drone.recoverTimer = Math.max(0, drone.recoverTimer - dt);
    const previousAimTimer = drone.aimTimer;
    drone.aimTimer = Math.max(0, drone.aimTimer - dt);
    const previousX = drone.x;
    const previousY = drone.y;

    if (drone.diveTimer > 0) {
      updateCrowDive(run, data, drone, dt);
      continue;
    }

    if (isFlyingRangedDrone(drone)) {
      updateFlyingRangedDrone(run, data, drone, dt, playerCenter);
      continue;
    }

    const droneCenter = getCenter(drone);
    const distance = distanceBetween(playerCenter, droneCenter);
    const canSeePlayer = hasLineOfSightToPlayer(run, data, droneCenter, playerCenter);
    const activationRadius = drone.activationRadius ?? 720;
    if (canSeePlayer && distance < activationRadius) {
      drone.active = true;
    } else if (!canSeePlayer || distance > activationRadius * 1.35) {
      drone.active = false;
    }
    if (!drone.active) {
      drone.aimTimer = 0;
    }

    let targetX;
    let targetY;
    if (drone.active) {
      const side = playerCenter.x >= droneCenter.x ? 1 : -1;
      drone.facing = side;
      const flapBob = Math.sin((run.time ?? 0) * (drone.flapRate ?? 13) + drone.bobSeed) * (drone.flapAmplitude ?? 16);
      targetX = playerCenter.x - side * (drone.preferredRange ?? 280) - drone.width * 0.5;
      targetY = playerCenter.y - (drone.hoverOffsetY ?? 120) - drone.height * 0.5 + flapBob;
    } else {
      drone.x += (drone.patrolDirection || 1) * (drone.patrolSpeed ?? drone.speed ?? 120) * dt;
      if (drone.patrol) {
        if (drone.x <= drone.patrol.left) {
          drone.x = drone.patrol.left;
          drone.patrolDirection = 1;
        }
        if (drone.x >= drone.patrol.right) {
          drone.x = drone.patrol.right;
          drone.patrolDirection = -1;
        }
      }
      drone.facing = drone.patrolDirection || 1;
      const flapBob = Math.sin((run.time ?? 0) * (drone.flapRate ?? 12) + drone.bobSeed) * (drone.flapAmplitude ?? 18);
      targetX = drone.x;
      targetY = drone.y + flapBob;
    }

    targetX = clamp(targetX, 0, data.world.width - drone.width);
    targetY = clamp(targetY, 80, data.world.height - drone.height - 80);

    const accel = drone.acceleration ?? 7;
    const maxSpeed = drone.speed ?? 170;
    const desiredVx = clamp((targetX - drone.x) * accel, -maxSpeed, maxSpeed);
    const desiredVy = clamp((targetY - drone.y) * accel, -maxSpeed, maxSpeed);
    drone.vx = lerp(drone.vx ?? 0, desiredVx, Math.min(1, dt * 7));
    drone.vy = lerp(drone.vy ?? 0, desiredVy, Math.min(1, dt * 7));
    drone.x += drone.vx * dt;
    drone.y += drone.vy * dt + Math.sin((run.time ?? 0) * 7 + drone.bobSeed) * 9 * dt;
    drone.x = clamp(drone.x, 0, data.world.width - drone.width);
    drone.y = clamp(drone.y, 80, data.world.height - drone.height - 80);
    carryPlayerOnDynamicSolid(run, drone, previousX, previousY, data);

    const nextCenter = getCenter(drone);
    if (drone.aimTimer > 0) {
      updateDroneAimLine(drone, nextCenter);
    }
    if (previousAimTimer > 0 && drone.aimTimer === 0 && drone.active) {
      updateDroneAimLine(drone, nextCenter);
      fireDroneBeam(run, drone);
      if (drone.diveAttack !== false) {
        startCrowDive(drone);
      }
    }

    const nextDistance = distanceBetween(playerCenter, nextCenter);
    if (
      drone.active &&
      canSeePlayer &&
      nextDistance < (drone.fireRange ?? 620) &&
      drone.attackCooldown === 0 &&
      drone.aimTimer === 0 &&
      drone.recoverTimer === 0
    ) {
      beginDroneTelegraph(run, drone, playerCenter, nextCenter);
    }
  }
}

function markHumanoidEscaped(run, enemy) {
  enemy.state = "escaped";
  enemy.outcome = "escape";
  enemy.active = false;
  enemy.trigger = 0;
  enemy.escapeTargetX = null;
  resetHumanoidStagger(enemy);
  pushNotice(run, "Knocked-down target escaped.");
}

function updateKnockedDownHumanoid(run, data, enemy, dt) {
  enemy.active = false;
  enemy.trigger = 0;
  enemy.staggerTimer = Math.max(0, (enemy.staggerTimer ?? 0) - dt);
  if (enemy.staggerTimer > 0) {
    return;
  }

  const fallbackDirection = Math.sign(enemy.knockdownFacing || enemy.facing || 1) || 1;
  const targetX = Number.isFinite(enemy.escapeTargetX)
    ? enemy.escapeTargetX
    : enemy.x + fallbackDirection * (enemy.escapeDistance ?? 360);
  const direction = Math.sign(targetX - enemy.x) || fallbackDirection;
  const speed = Math.max(0, enemy.crawlSpeed ?? 34);
  const nextX = enemy.x + direction * speed * dt;
  const reached = direction > 0 ? nextX >= targetX : nextX <= targetX;
  const maxX = Math.max(0, (data.world?.width ?? targetX + enemy.width) - enemy.width);
  enemy.knockdownFacing = direction;
  enemy.facing = direction;
  enemy.x = clamp(reached ? targetX : nextX, 0, maxX);

  if (reached || enemy.x <= 0 || enemy.x >= maxX) {
    markHumanoidEscaped(run, enemy);
  }
}

function fireHumanoidProjectile(run, enemy, playerCenter) {
  run.enemyShots = run.enemyShots || [];
  const originX = enemy.x + enemy.width * 0.5 + (enemy.facing || 1) * enemy.width * 0.32;
  const originY = enemy.y + enemy.height * 0.38;
  const dx = playerCenter.x - originX;
  const dy = playerCenter.y - originY;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const speed = enemy.projectileSpeed ?? 760;
  run.enemyShots.push({
    id: `${enemy.id}-round-${Math.round((run.time ?? 0) * 1000)}-${run.enemyShots.length}`,
    type: "humanoidBullet",
    x: originX,
    y: originY,
    prevX: originX,
    prevY: originY,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    radius: enemy.projectileRadius ?? 8,
    damage: enemy.projectileDamage ?? enemy.damage ?? 12,
    life: enemy.projectileLife ?? 2.2,
    duration: enemy.projectileLife ?? 2.2,
    color: enemy.projectileColor || "#ff9fb4",
  });
  enemy.hitFlash = Math.max(enemy.hitFlash ?? 0, 0.08);
}

function fireHumanoidArcProjectile(run, data, enemy, playerCenter) {
  run.enemyShots = run.enemyShots || [];
  const originX = enemy.x + enemy.width * 0.5 + (enemy.facing || 1) * enemy.width * 0.28;
  const originY = enemy.y + enemy.height * 0.22;
  const targetX = playerCenter.x;
  const targetY = playerCenter.y - (enemy.arcTargetLift ?? 8);
  const dx = targetX - originX;
  const dy = targetY - originY;
  const gravity = Math.max(1, enemy.projectileGravity ?? (data.world?.gravity ?? 2350) * 0.72);
  const speed = Math.max(1, enemy.projectileSpeed ?? 620);
  const minFlight = Math.max(0.2, enemy.projectileMinFlightTime ?? 0.55);
  const maxFlight = Math.max(minFlight, enemy.projectileMaxFlightTime ?? 1.7);
  const flightTime = clamp(
    enemy.projectileFlightTime ?? Math.abs(dx) / speed,
    minFlight,
    maxFlight,
  );
  const vx = dx / flightTime;
  const vy = (dy - 0.5 * gravity * flightTime * flightTime) / flightTime;

  run.enemyShots.push({
    id: `${enemy.id}-arc-${Math.round((run.time ?? 0) * 1000)}-${run.enemyShots.length}`,
    type: "humanoidArc",
    x: originX,
    y: originY,
    prevX: originX,
    prevY: originY,
    vx,
    vy,
    gravity,
    radius: enemy.projectileRadius ?? 10,
    damage: enemy.projectileDamage ?? enemy.damage ?? 14,
    life: enemy.projectileLife ?? 3.2,
    duration: enemy.projectileLife ?? 3.2,
    color: enemy.projectileColor || "#f6d36f",
  });
  enemy.hitFlash = Math.max(enemy.hitFlash ?? 0, 0.1);
}

function ensureHumanoidGroundState(enemy) {
  if (!Number.isFinite(enemy.vx)) {
    enemy.vx = 0;
  }
  if (!Number.isFinite(enemy.vy)) {
    enemy.vy = 0;
  }
  if (!Number.isFinite(enemy.patrolDirection) || enemy.patrolDirection === 0) {
    enemy.patrolDirection = 1;
  }
  if (!Number.isFinite(enemy.patrolCenterX)) {
    enemy.patrolCenterX = enemy.x + enemy.width * 0.5;
  }
  if (!Number.isFinite(enemy.patrolRadius)) {
    const centerX = enemy.patrolCenterX;
    const leftCenter = Number.isFinite(enemy.patrol?.left)
      ? enemy.patrol.left + enemy.width * 0.5
      : centerX - (enemy.defaultPatrolRadius ?? 180);
    const rightCenter = Number.isFinite(enemy.patrol?.right)
      ? enemy.patrol.right + enemy.width * 0.5
      : centerX + (enemy.defaultPatrolRadius ?? 180);
    enemy.patrolRadius = Math.max(
      enemy.minPatrolRadius ?? 48,
      Math.abs(centerX - leftCenter),
      Math.abs(rightCenter - centerX),
    );
  }
}

function getHumanoidGroundYAt(data, worldX, footY, maxDrop, lift = 8) {
  let bestY = Number.POSITIVE_INFINITY;
  for (const platform of data.platforms || []) {
    if (isWaterPlatform(platform)) {
      continue;
    }
    if (worldX < platform.x || worldX > platform.x + platform.width) {
      continue;
    }
    const surfaceY = isSlopePlatform(platform)
      ? getSlopeSurfaceY(platform, worldX)
      : platform.y;
    if (surfaceY >= footY - lift && surfaceY <= footY + maxDrop && surfaceY < bestY) {
      bestY = surfaceY;
    }
  }
  return Number.isFinite(bestY) ? bestY : null;
}

function hasHumanoidGroundAhead(enemy, data, direction) {
  if (!enemy.onGround || direction === 0) {
    return true;
  }
  const probeDistance = enemy.cliffProbeDistance ?? Math.max(10, enemy.width * 0.35);
  const maxDrop = enemy.cliffProbeDrop ?? Math.max(18, enemy.height * 0.55);
  const footY = enemy.y + enemy.height;
  const edgeX = direction > 0 ? enemy.x + enemy.width : enemy.x;
  return getHumanoidGroundYAt(data, edgeX + direction * probeDistance, footY, maxDrop) !== null;
}

function isHumanoidWallAhead(enemy, data, direction) {
  if (direction === 0) {
    return false;
  }
  const probeDistance = enemy.wallProbeDistance ?? Math.max(4, enemy.width * 0.12);
  const probe = {
    x: enemy.x + direction * probeDistance,
    y: enemy.y + 4,
    width: enemy.width,
    height: Math.max(1, enemy.height - 8),
  };
  return getCollisionPlatforms(data).some((platform) => (
    !isSlopePlatform(platform) &&
    rectsOverlap(probe, platform)
  ));
}

function getHumanoidPatrolDirection(enemy, data) {
  ensureHumanoidGroundState(enemy);
  let direction = Math.sign(enemy.patrolDirection || enemy.facing || 1) || 1;
  const centerX = enemy.x + enemy.width * 0.5;
  const leftLimit = enemy.patrolCenterX - enemy.patrolRadius;
  const rightLimit = enemy.patrolCenterX + enemy.patrolRadius;

  if (centerX <= leftLimit) {
    direction = 1;
  } else if (centerX >= rightLimit) {
    direction = -1;
  }

  if (isHumanoidWallAhead(enemy, data, direction) || !hasHumanoidGroundAhead(enemy, data, direction)) {
    direction *= -1;
  }

  enemy.patrolDirection = direction;
  return direction;
}

function updateHumanoidGroundPhysics(enemy, data, dt, direction = 0) {
  ensureHumanoidGroundState(enemy);
  const config = getMovementConfig(data);
  const desiredDirection = Math.sign(direction) || 0;
  const maxFallSpeed = enemy.maxFallSpeed ?? config.maxFallSpeed ?? 1600;
  const speed = Math.max(0, enemy.patrolSpeed ?? enemy.speed ?? 70);

  enemy.vx = enemy.onGround ? desiredDirection * speed : 0;
  enemy.vy = Math.min(maxFallSpeed, (enemy.vy ?? 0) + (data.world?.gravity ?? 0) * dt);

  const contacts = resolvePlayerCollisions(enemy, data, dt, config, null);
  enemy.onGround = contacts.onGround;
  enemy.wallDirection = contacts.wallLeft ? -1 : contacts.wallRight ? 1 : 0;
  if (contacts.onGround) {
    enemy.vy = 0;
  }
  if (
    desiredDirection !== 0 &&
    ((contacts.wallLeft && desiredDirection < 0) || (contacts.wallRight && desiredDirection > 0))
  ) {
    enemy.patrolDirection = -desiredDirection;
    enemy.vx = 0;
  }
  if (desiredDirection !== 0) {
    enemy.facing = desiredDirection;
  }
}

function updateHumanoidEnemies(run, data, dt) {
  const enemies = run.humanoidEnemies || [];
  if (!enemies.length) {
    return;
  }

  const player = run.player;
  const playerCenter = getCenter(player);
  for (const enemy of enemies) {
    if (!isHumanoidFaceOffAvailable(enemy)) {
      continue;
    }
    enemy.hitFlash = Math.max(0, (enemy.hitFlash ?? 0) - dt);
    enemy.attackCooldown = Math.max(0, (enemy.attackCooldown ?? enemy.initialCooldown ?? 0.9) - dt);

    if (enemy.state === "knockedDown") {
      updateKnockedDownHumanoid(run, data, enemy, dt);
      continue;
    }

    updateHumanoidStaggerState(enemy, data, dt);
    if ((enemy.staggerBreakTimer ?? 0) > 0) {
      continue;
    }

    const center = getHumanoidCenter(enemy);
    const distance = distanceBetween(playerCenter, center);
    const canSeePlayer = hasLineOfSightToPlayer(run, data, center, playerCenter);
    enemy.active = canSeePlayer && (enemy.active || distance < (enemy.activationRadius ?? 680));
    if (canSeePlayer) {
      enemy.facing = playerCenter.x >= center.x ? 1 : -1;
    }

    if (!enemy.active) {
      const direction = getHumanoidPatrolDirection(enemy, data);
      updateHumanoidGroundPhysics(enemy, data, dt, direction);
      continue;
    }

    updateHumanoidGroundPhysics(enemy, data, dt, 0);

    if (canSeePlayer && distance < (enemy.fireRange ?? 620)) {
      enemy.trigger = clamp((enemy.trigger ?? 0) + (enemy.triggerRate ?? 1) * dt * 0.35, 0, getFaceOffConfig(data).triggerLimit ?? 4.5);
      if (enemy.trigger >= (getFaceOffConfig(data).triggerLimit ?? 4.5) && enemy.attackCooldown === 0) {
        const direction = enemy.x >= player.x ? -1 : 1;
        if (enemy.attackPattern === "arc" || enemy.projectileArc) {
          fireHumanoidArcProjectile(run, data, enemy, playerCenter);
        } else if (enemy.rangedProjectile) {
          fireHumanoidProjectile(run, enemy, playerCenter);
        } else {
          damagePlayer(run, enemy.damage ?? 12, direction, "Gunman shot.");
        }
        enemy.attackCooldown = enemy.fireCooldown ?? 1.5;
        enemy.trigger = 0;
      }
    } else {
      enemy.trigger = Math.max(0, (enemy.trigger ?? 0) - dt * 0.75);
    }
  }
}

function getProjectileDodgeRect(player) {
  return createRect(
    player.x - 78,
    player.y - 58,
    player.width + 156,
    player.height + 116,
  );
}

function handleProjectileDodge(run, data, shot, shotRect, hitPlayer) {
  const player = run.player;
  const dashDodge = isPlayerDashDodging(player);
  const slideDodge = isPlayerSlideDodging(player);
  if (dashDodge || slideDodge) {
    const dodgeRect = getProjectileDodgeRect(player);
    const nearInvuln =
      hitPlayer ||
      lineIntersectsRect(shot.prevX ?? shot.x, shot.prevY ?? shot.y, shot.x, shot.y, dodgeRect, (shot.radius ?? 0) + 18);
    if (nearInvuln) {
      triggerProjectileDodge(run, shot, dashDodge ? "DASH" : "SLIDE");
      return hitPlayer ? "consumed" : "none";
    }
  }

  if (!hitPlayer && !shot.dodgeTriggered && isPlayerRunDodging(player, data)) {
    const dodgeRect = getProjectileDodgeRect(player);
    if (lineIntersectsRect(shot.prevX ?? shot.x, shot.prevY ?? shot.y, shot.x, shot.y, dodgeRect, (shot.radius ?? 0) + 24)) {
      triggerProjectileDodge(run, shot, player.sprintActive ? "SPRINT" : "RUN");
    }
  }

  return "none";
}

function updateEnemyShots(run, data, dt) {
  const player = run.player;
  run.enemyShots = (run.enemyShots || []).filter((shot) => {
    if (shot.type === "beam") {
      shot.life -= dt;
      if (!shot.hasHit) {
        shot.hasHit = true;
        if (isShotBlockedByWeaponBarrier(run, shot)) {
          spawnParticles(run, shot.endX, shot.endY, 6, "#e7f47e");
          return shot.life > 0;
        }
        const blockingBlock = findTemporaryBlockLineHit(
          run,
          shot.startX,
          shot.startY,
          shot.endX,
          shot.endY,
          shot.radius ?? 0,
        );
        if (blockingBlock) {
          spawnParticles(run, blockingBlock.x + blockingBlock.width * 0.5, blockingBlock.y + blockingBlock.height * 0.5, 8, "#93eaff");
          return shot.life > 0;
        }
        if (lineIntersectsRect(shot.startX, shot.startY, shot.endX, shot.endY, player, shot.radius ?? 0)) {
          damagePlayer(run, shot.damage, Math.sign(shot.dirX) || 1, "Crow line hit.");
          spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.5, 10, "#87e1ff");
        }
      }
      return shot.life > 0;
    }

    shot.life -= dt;
    shot.prevX = shot.x;
    shot.prevY = shot.y;
    if (Number.isFinite(shot.gravity)) {
      shot.vy += shot.gravity * dt;
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;

    if (
      shot.life <= 0 ||
      shot.x < -80 ||
      shot.y < -80 ||
      shot.x > data.world.width + 80 ||
      shot.y > data.world.height + 80
    ) {
      return false;
    }

    const shotRect = createRect(
      shot.x - shot.radius,
      shot.y - shot.radius,
      shot.radius * 2,
      shot.radius * 2
    );
    if (collidesWithPlatforms(shotRect, data)) {
      spawnParticles(run, shot.x, shot.y, 4, "#87e1ff");
      return false;
    }

    const blockingBlock = findTemporaryBlockLineHit(
      run,
      shot.prevX ?? shot.x,
      shot.prevY ?? shot.y,
      shot.x,
      shot.y,
      shot.radius ?? 0,
    );
    if (blockingBlock) {
      spawnParticles(run, shot.x, shot.y, 6, "#93eaff");
      return false;
    }

    if (isShotBlockedByWeaponBarrier(run, shot)) {
      spawnParticles(run, shot.x, shot.y, 5, "#e7f47e");
      return false;
    }

    const hitPlayer = rectsOverlap(shotRect, player) ||
      lineIntersectsRect(shot.prevX ?? shot.x, shot.prevY ?? shot.y, shot.x, shot.y, player, shot.radius ?? 0);
    const dodgeResult = handleProjectileDodge(run, data, shot, shotRect, hitPlayer);
    if (dodgeResult === "consumed") {
      spawnParticles(run, shot.x, shot.y, 8, "#e9f7ff");
      return false;
    }

    if (hitPlayer) {
      damagePlayer(run, shot.damage, Math.sign(shot.vx) || 1, shot.type === "humanoidArc" ? "Arc shot hit." : shot.type === "humanoidBullet" ? "Rifle shot hit." : "Crow shot hit.");
      spawnParticles(run, shot.x, shot.y, 8, "#ff9fb4");
      return false;
    }

    return true;
  });
}

function getLootRarityRank(rarity) {
  return LOOT_RARITY_RANKS[rarity] ?? 0;
}

function isSelectableLootItem(item) {
  return Boolean(item && item.revealed && !item.looted);
}

function getActiveLootCrate(run) {
  if (!run.loot?.active || !run.loot.crateId) {
    return null;
  }
  return (run.lootCrates || []).find((crate) => crate.id === run.loot.crateId) || null;
}

function findNextLootIndex(crate, startIndex = 0, direction = 1) {
  const items = crate?.items || [];
  if (!items.length || items.every((item) => !isSelectableLootItem(item))) {
    return -1;
  }

  const count = items.length;
  const step = direction >= 0 ? 1 : -1;
  for (let offset = 0; offset < count; offset += 1) {
    const index = (startIndex + offset * step + count * 4) % count;
    if (isSelectableLootItem(items[index])) {
      return index;
    }
  }
  return -1;
}

function getSelectedLootItem(crate, loot) {
  const items = crate?.items || [];
  if (!items.length) {
    return null;
  }
  const index = clamp(Math.floor(loot.selectedIndex ?? 0), 0, items.length - 1);
  loot.selectedIndex = index;
  return items[index] || null;
}

function selectLootItem(crate, loot, direction) {
  const items = crate?.items || [];
  if (!items.length) {
    loot.selectedIndex = 0;
    return;
  }
  const startIndex = (Math.floor(loot.selectedIndex ?? 0) + direction + items.length) % items.length;
  const nextIndex = findNextLootIndex(crate, startIndex, direction);
  if (nextIndex >= 0) {
    loot.selectedIndex = nextIndex;
    loot.holdItemId = null;
    loot.holdProgress = 0;
  }
}

function closeLootCrate(run) {
  if (!run.loot) {
    return;
  }
  run.loot.active = false;
  run.loot.crateId = null;
  run.loot.selectedIndex = 0;
  run.loot.holdItemId = null;
  run.loot.holdProgress = 0;
}

function getLootItemColor(item) {
  const rank = getLootRarityRank(item?.rarity);
  if (rank >= 3) {
    return "#f6e98a";
  }
  if (rank === 2) {
    return "#87e1ff";
  }
  if (rank === 1) {
    return "#a8f7cf";
  }
  return "#dce7ec";
}

function spillLootCrate(run, crate, options = {}) {
  if (!crate || crate.spilled || crate.searched) {
    return false;
  }

  const items = (crate.items || []).filter((item) => !item.looted);
  crate.opened = true;
  crate.spilled = true;
  crate.broken = Boolean(options.broken);
  crate.searched = items.length === 0;
  crate.scanComplete = true;
  crate.searchProgress = crate.searchTime;
  crate.hp = options.broken ? 0 : Math.max(1, crate.hp ?? crate.maxHp ?? 1);
  if (run.loot?.crateId === crate.id) {
    closeLootCrate(run);
  }

  run.spilledLoot = run.spilledLoot || [];
  const centerX = crate.x + crate.width * 0.5;
  const centerY = crate.y + crate.height * 0.5;
  const direction = Math.sign(options.directionX ?? run.player?.facing ?? 1) || 1;
  items.forEach((item, index) => {
    item.revealed = true;
    item.transferProgress = 0;
    item.lootProgress = 0;
    const side = index % 2 === 0 ? -1 : 1;
    const spread = (Math.floor(index / 2) + 1) * 42;
    run.spilledLoot.push({
      id: `${crate.id}-spill-${item.id || index}-${Math.round((run.time ?? 0) * 1000)}`,
      crateId: crate.id,
      item,
      x: centerX,
      y: centerY - 8,
      vx: direction * 78 + side * spread + (Math.random() - 0.5) * 52,
      vy: -280 - Math.random() * 155,
      radius: Math.max(10, Math.min(18, 10 + getLootRarityRank(item.rarity) * 2)),
      floorY: crate.y + crate.height - 8 + Math.random() * 16,
      life: 0,
      settled: false,
      collectDelay: 0.35,
      pulse: Math.random() * Math.PI * 2,
    });
  });

  spawnDirectedParticles(run, centerX, centerY, options.broken ? 22 : 14, "#93eaff", direction, -0.35, options.broken ? 460 : 320, 0.9);
  spawnDamageNumber(run, centerX, crate.y - 14, 0, options.broken ? "#ffd6ba" : "#93eaff", options.broken ? "BREAK" : "OPEN");
  pushNotice(run, `${crate.label} ${options.broken ? "?뚯넀." : "媛쒕큺."}`);
  return true;
}

function damageLootCrate(run, crate, amount, directionX = 0, directionY = 0, hitX = null, hitY = null) {
  if (!crate || crate.spilled || crate.searched || crate.broken) {
    return false;
  }
  const damage = Math.max(1, Number(amount ?? 1));
  const maxHp = Math.max(1, Number(crate.maxHp ?? crate.hp ?? 1));
  crate.maxHp = maxHp;
  crate.hp = Math.max(0, Number(crate.hp ?? maxHp) - damage);
  crate.hitFlash = 0.18;
  const x = Number.isFinite(hitX) ? hitX : crate.x + crate.width * 0.5;
  const y = Number.isFinite(hitY) ? hitY : crate.y + crate.height * 0.5;
  spawnDamageNumber(run, x, y - 12, damage, "#ffd6ba");
  spawnDirectedParticles(run, x, y, 9, "#ffd6ba", directionX || Math.sign(run.player?.facing ?? 1) || 1, directionY || -0.15, 280, 0.72);
  if (crate.hp <= 0) {
    return spillLootCrate(run, crate, { broken: true, directionX });
  }
  return true;
}

function openLootCrate(run, crate) {
  if (!crate || crate.searched) {
    return;
  }
  spillLootCrate(run, crate, { broken: false, directionX: Math.sign(run.player?.facing ?? 1) || 1 });
}

function moveLootSelection(crate, loot, delta) {
  const items = crate?.items || [];
  if (!items.length) {
    loot.selectedIndex = 0;
    return;
  }
  const startIndex = (Math.floor(loot.selectedIndex ?? 0) + delta + items.length * 4) % items.length;
  const direction = delta >= 0 ? 1 : -1;
  const nextIndex = findNextLootIndex(crate, startIndex, direction);
  if (nextIndex >= 0) {
    loot.selectedIndex = nextIndex;
    loot.holdItemId = null;
    loot.holdProgress = 0;
  }
}

function updateLootDiscovery(crate, loot, dt) {
  if (!crate || crate.scanComplete) {
    return;
  }

  crate.searchProgress = Math.min(crate.searchTime, (crate.searchProgress ?? 0) + dt);
  let firstRevealedIndex = -1;
  crate.items.forEach((item, index) => {
    if (!item.revealed && crate.searchProgress >= (item.revealDelay ?? 0)) {
      item.revealed = true;
      item.revealFlash = 0.48;
      if (firstRevealedIndex < 0) {
        firstRevealedIndex = index;
      }
    }
  });

  if (crate.searchProgress >= crate.searchTime) {
    crate.scanComplete = true;
    crate.items.forEach((item, index) => {
      if (!item.revealed) {
        item.revealed = true;
        item.revealFlash = 0.38;
        if (firstRevealedIndex < 0) {
          firstRevealedIndex = index;
        }
      }
    });
  }

  if (firstRevealedIndex >= 0 && !isSelectableLootItem(crate.items[loot.selectedIndex])) {
    loot.selectedIndex = firstRevealedIndex;
  }
}

function updateLootItemTimers(crate, dt) {
  (crate?.items || []).forEach((item) => {
    item.revealFlash = Math.max(0, (item.revealFlash ?? 0) - dt);
    item.blockedTimer = Math.max(0, (item.blockedTimer ?? 0) - dt);
  });
}

function collectLootItem(run, crate, item) {
  if (!item || item.looted) {
    return false;
  }

  const value = Math.max(0, Number(item.value ?? 0));
  const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
  const weight = Math.max(0.1, Number(item.weight ?? 1));
  const capacity = Math.max(1, Number(run.lootCapacity ?? 16));
  if ((run.lootWeight ?? 0) + weight > capacity) {
    item.blockedTimer = 0.75;
    item.transferProgress = 0;
    item.lootProgress = 0;
    pushNotice(run, "媛諛?怨듦컙 遺議?");
    return false;
  }

  const rarityRank = getLootRarityRank(item.rarity);
  item.looted = true;
  item.lootProgress = item.lootTime;
  item.transferProgress = item.lootTime;
  item.acquiredAt = run.time ?? 0;

  const acquired = {
    crateId: crate.id,
    id: item.id,
    name: item.name,
    rarity: item.rarity,
    type: item.type || "item",
    quantity,
    value,
    weight,
    acquiredAt: item.acquiredAt,
  };
  run.lootInventory.push(acquired);
  run.inventory.items.push(acquired);
  run.materials += value;
  run.lootWeight = Math.min(capacity, (run.lootWeight ?? 0) + weight);

  if (rarityRank >= 2) {
    run.loot.rareSignalTimer = 1.15;
    run.loot.lastRarity = item.rarity;
    crate.rareSignalTimer = 1.15;
    pushNotice(run, `${item.name} ?뺣낫. ?ш? 諛섏쓳 媛먯?.`);
    spawnParticles(run, crate.x + crate.width / 2, crate.y + crate.height / 2, 18, "#87e1ff");
    spawnParticles(run, crate.x + crate.width / 2, crate.y + crate.height / 2, 8, "#f6e98a");
  } else {
    pushNotice(run, `${item.name} ?뺣낫.`);
    spawnParticles(run, crate.x + crate.width / 2, crate.y + crate.height / 2, 10, "#93eaff");
  }

  crate.searched = crate.items.every((entry) => entry.looted);
  if (crate.searched) {
    pushNotice(run, `${crate.label} ?섏깋 ?꾨즺.`);
  }
  return true;
}

function collectSpilledLootItem(run, drop) {
  if (!drop?.item || drop.item.looted) {
    return true;
  }
  const crate = (run.lootCrates || []).find((entry) => entry.id === drop.crateId) || {
    id: drop.crateId || "spilled-loot",
    x: drop.x,
    y: drop.y,
    width: 1,
    height: 1,
    items: [drop.item],
  };
  const collected = collectLootItem(run, crate, drop.item);
  if (collected) {
    spawnParticles(run, drop.x, drop.y, 8, getLootItemColor(drop.item));
  } else {
    drop.collectDelay = 0.6;
  }
  return collected;
}

function getPointRectDistance(point, rect) {
  const closestX = clamp(point.x, rect.x, rect.x + rect.width);
  const closestY = clamp(point.y, rect.y, rect.y + rect.height);
  return distanceBetween(point, { x: closestX, y: closestY });
}

function updateSpilledLoot(run, data, dt) {
  const drops = run.spilledLoot || [];
  if (!drops.length) {
    return;
  }
  const gravity = Math.max(1, data.world?.gravity ?? 2350);
  run.spilledLoot = drops.filter((drop) => {
    drop.life = (drop.life ?? 0) + dt;
    drop.collectDelay = Math.max(0, (drop.collectDelay ?? 0) - dt);
    if (!drop.settled) {
      drop.vy += gravity * 0.82 * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      if (drop.y >= drop.floorY) {
        drop.y = drop.floorY;
        drop.vy = -Math.abs(drop.vy) * 0.24;
        drop.vx *= 0.58;
        if (Math.abs(drop.vy) < 72) {
          drop.vy = 0;
          drop.vx = 0;
          drop.settled = true;
        }
      }
    }

    if ((drop.collectDelay ?? 0) <= 0 && getPointRectDistance({ x: drop.x, y: drop.y }, run.player) < 120) {
      return !collectSpilledLootItem(run, drop);
    }
    return !drop.item?.looted;
  });
}

function updateLootLockedPlayer(run, dt) {
  const player = run.player;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attackWindow = Math.max(0, player.attackWindow - dt);
  player.invulnTimer = Math.max(0, player.invulnTimer - dt);
  player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - dt);
  player.recoilShotCooldownTimer = Math.max(0, player.recoilShotCooldownTimer - dt);
  player.recoilShotTimer = Math.max(0, player.recoilShotTimer - dt);
  player.recoilSpinTimer = Math.max(0, player.recoilSpinTimer - dt);
  player.recoilCameraTimer = Math.max(0, player.recoilCameraTimer - dt);
  player.slideTimer = Math.max(0, player.slideTimer - dt);
  player.vx = approach(player.vx, 0, 2400 * dt);
  player.vy = approach(player.vy, 0, 2600 * dt);
  player.crouchRequested = false;
  player.attackWindow = 0;
  player.canInteract = false;
  setMovementState(player);
}

function updateLootInteraction(state, data, dt) {
  const run = state.run;
  const loot = run.loot;
  if (!loot?.active) {
    return false;
  }

  const crate = getActiveLootCrate(run);
  if (!crate) {
    closeLootCrate(run);
    return false;
  }

  updateLootDiscovery(crate, loot, dt);
  updateLootItemTimers(crate, dt);

  run.prompt = "";
  run.promptWorld = null;

  if (consumeEitherPress(state, LOOT_CLOSE_KEYS)) {
    closeLootCrate(run);
    return false;
  }

  if (!crate.scanComplete) {
    updateLootLockedPlayer(run, dt);
    return true;
  }

  if (!isSelectableLootItem(crate.items[loot.selectedIndex])) {
    const nextIndex = findNextLootIndex(crate, 0, 1);
    if (nextIndex >= 0) {
      loot.selectedIndex = nextIndex;
    }
  }

  if (consumeEitherPress(state, LOOT_LEFT_KEYS)) {
    moveLootSelection(crate, loot, -1);
  }
  if (consumeEitherPress(state, LOOT_RIGHT_KEYS)) {
    moveLootSelection(crate, loot, 1);
  }
  if (consumeEitherPress(state, LOOT_PREV_KEYS)) {
    moveLootSelection(crate, loot, -3);
  }
  if (consumeEitherPress(state, LOOT_NEXT_KEYS)) {
    moveLootSelection(crate, loot, 3);
  }

  const item = getSelectedLootItem(crate, loot);
  if (isSelectableLootItem(item) && isEitherPressed(state, INTERACT_KEYS)) {
    if (loot.holdItemId !== item.id) {
      loot.holdItemId = item.id;
      loot.holdProgress = item.transferProgress;
    }
    item.transferProgress = Math.min(item.lootTime, item.transferProgress + dt);
    item.lootProgress = item.transferProgress;
    loot.holdProgress = item.transferProgress;

    if (item.transferProgress >= item.lootTime) {
      if (collectLootItem(run, crate, item)) {
        const nextIndex = findNextLootIndex(crate, loot.selectedIndex + 1, 1);
        if (nextIndex >= 0) {
          loot.selectedIndex = nextIndex;
        }
      }
      loot.holdItemId = null;
      loot.holdProgress = 0;
    }
  } else {
    loot.holdItemId = null;
    loot.holdProgress = 0;
  }

  updateLootLockedPlayer(run, dt);
  return true;
}

function getInteractionTargets(run, data) {
  const playerCenter = getCenter(run.player);
  const targets = [];

  const faceOffEnemy = findFaceOffInteractionCandidate(run, data);
  if (faceOffEnemy) {
    const center = getHumanoidCenter(faceOffEnemy);
    targets.push({
      id: faceOffEnemy.id,
      kind: "faceOff",
      enemy: faceOffEnemy,
      text: "Z: Face-off",
      x: center.x,
      y: faceOffEnemy.y - 14,
    });
  }

  const gate = data.extractionGate;
  if (gate) {
    const gateRect = createRect(gate.x, gate.y, gate.width, gate.height);
    if (distanceBetween(playerCenter, getCenter(gateRect)) < 110) {
      targets.push({
        id: "extract",
        kind: "extract",
        text: normalizeExtractionPrompt(gate.prompt),
        x: gate.x + gate.width / 2,
        y: gate.y - 12,
      });
    }
  }

  for (const routeExit of data.routeExits || []) {
    const exitRect = createRect(routeExit.x, routeExit.y, routeExit.width, routeExit.height);
    if (isTouchRouteExit(routeExit)) {
      if (distanceBetween(playerCenter, getCenter(exitRect)) < 118) {
        discoverRouteExit(run, data, routeExit);
      }
      continue;
    }
    if (distanceBetween(playerCenter, getCenter(exitRect)) < 118) {
      discoverRouteExit(run, data, routeExit);
      const shelterBlockReason = isShelterRouteExit(routeExit, data)
        ? getShelterRouteBlockReason(run)
        : "";
      targets.push({
        id: routeExit.id,
        kind: shelterBlockReason ? "shelterLocked" : "routeExit",
        routeExit,
        text: shelterBlockReason || normalizeInteractionPrompt(routeExit.prompt || "Z: ?ㅼ쓬 援ъ뿭"),
        x: routeExit.x + routeExit.width / 2,
        y: routeExit.y - 12,
      });
    }
  }

  for (const zipLine of data.zipLines || []) {
    const startDistance = distanceBetween(playerCenter, zipLine.start);
    const endDistance = distanceBetween(playerCenter, zipLine.end);
    const lineDistance = getPointToZipLineDistance(playerCenter, zipLine);
    const nearestNode = startDistance <= endDistance ? "start" : "end";
    const progress = getZipLineProgressForPoint(zipLine, playerCenter);
    const nearestPoint = lineDistance < Math.min(startDistance, endDistance)
      ? getZipLinePoint(zipLine, progress)
      : zipLine[nearestNode];
    if (Math.min(startDistance, endDistance, lineDistance) < 96) {
      targets.push({
        id: zipLine.id,
        kind: "zipLine",
        zipLine,
        text: getZipLinePrompt(zipLine),
        x: nearestPoint.x,
        y: nearestPoint.y - 18,
      });
    }
  }

  for (const item of run.interactables) {
    if (item.used) {
      continue;
    }
    if (distanceBetween(playerCenter, getCenter(item)) < 86) {
      targets.push({
        id: item.id,
        kind: item.kind,
        text: normalizeInteractionPrompt(item.prompt),
        x: item.x + item.width / 2,
        y: item.y - 10,
      });
    }
  }

  for (const crate of run.lootCrates || []) {
    if (crate.searched || crate.spilled) {
      continue;
    }
    if (distanceBetween(playerCenter, getCenter(crate)) < 104) {
      targets.push({
        id: crate.id,
        kind: "lootCrate",
        crate,
        text: normalizeInteractionPrompt(crate.prompt || "F: ?곸옄 ?닿린"),
        x: crate.x + crate.width / 2,
        y: crate.y - 12,
      });
    }
  }

  const ritualist = run.encounters.ritualist;
  if (!isEntityDisabled(ritualist) && ritualist.state !== "released") {
    for (const pedestal of ritualist.pedestals) {
      if (distanceBetween(playerCenter, getCenter(pedestal)) < 86) {
        targets.push({
          id: pedestal.id,
          kind: "pedestal",
          pedestal,
          text: `Z: ${pedestal.label}`,
          x: pedestal.x + pedestal.width / 2,
          y: pedestal.y - 12,
        });
      }
    }
  }

  targets.sort((left, right) => {
    const leftDistance = Math.abs(left.x - playerCenter.x);
    const rightDistance = Math.abs(right.x - playerCenter.x);
    return leftDistance - rightDistance;
  });

  return targets[0] || null;
}

function getZipLinePrompt(zipLine) {
  const prompt = zipLine?.prompt || "E: Zipline";
  return prompt.replace(/^(?:Space\/D|D\/Z|D|E)\s*:/i, "Space/Z:");
}

function normalizeInteractionPrompt(prompt) {
  return (prompt || "").replace(/^(?:D\/Z|D|E)\s*:/i, "Z:");
}

function normalizeExtractionPrompt(prompt) {
  return (prompt || "Z: 異붿텧").replace(/^(?:D\/Z|D|E)\s*:/i, "Z:");
}

function getNearestZipLineInteractionTarget(run, data) {
  const playerCenter = getCenter(run.player);
  let nearest = null;

  for (const zipLine of data.zipLines || []) {
    const startDistance = distanceBetween(playerCenter, zipLine.start);
    const endDistance = distanceBetween(playerCenter, zipLine.end);
    const lineDistance = getPointToZipLineDistance(playerCenter, zipLine);
    const distance = Math.min(startDistance, endDistance, lineDistance);
    if (distance >= 96) {
      continue;
    }

    const nearestNode = startDistance <= endDistance ? "start" : "end";
    const progress = getZipLineProgressForPoint(zipLine, playerCenter);
    const nearestPoint = lineDistance < Math.min(startDistance, endDistance)
      ? getZipLinePoint(zipLine, progress)
      : zipLine[nearestNode];

    if (!nearest || distance < nearest.distance) {
      nearest = {
        id: zipLine.id,
        kind: "zipLine",
        zipLine,
        distance,
        text: getZipLinePrompt(zipLine),
        x: nearestPoint.x,
        y: nearestPoint.y - 18,
      };
    }
  }

  return nearest;
}

function tryBeginZipLineRideFromMountInput(state, data) {
  const run = state.run;
  const player = run?.player;
  if (!run || !player || player.zipLineActive || !player.canInteract) {
    return false;
  }

  const nearest = getNearestZipLineInteractionTarget(run, data);
  if (!nearest || !consumeEitherPress(state, ZIPLINE_MOUNT_KEYS)) {
    return false;
  }

  run.prompt = nearest.text;
  run.promptWorld = { x: nearest.x, y: nearest.y };
  beginZipLineRide(run, data, nearest.zipLine);
  return true;
}

function getEncounterOutcome(encounter) {
  if (isEntityDisabled(encounter)) {
    return "ignored";
  }
  if (encounter.outcome) {
    return encounter.outcome;
  }
  return encounter.wasProvoked ? "failed" : "ignored";
}

function getRunSecuredLootItems(run) {
  const source = Array.isArray(run?.lootInventory) && run.lootInventory.length
    ? run.lootInventory
    : (Array.isArray(run?.inventory?.items) ? run.inventory.items : []);
  const seen = new Set();
  const items = [];
  source.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const key = `${item.crateId || "field"}:${item.id || item.name || index}:${item.acquiredAt ?? ""}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    items.push({
      crateId: item.crateId || "field",
      id: item.id || `loot-${index + 1}`,
      name: item.name || "Unknown item",
      rarity: item.rarity || "common",
      type: item.type || "item",
      quantity: Math.max(1, Math.floor(Number(item.quantity ?? 1))),
      value: Math.max(0, Number(item.value ?? 0)),
      weight: Math.max(0, Number(item.weight ?? 0)),
      acquiredAt: Number.isFinite(item.acquiredAt) ? item.acquiredAt : run?.time ?? 0,
    });
  });
  return items;
}

function summarizeSecuredLoot(run) {
  const items = getRunSecuredLootItems(run);
  const rarityCounts = {};
  let totalValue = 0;
  let totalWeight = 0;
  items.forEach((item) => {
    rarityCounts[item.rarity] = (rarityCounts[item.rarity] || 0) + 1;
    totalValue += item.value;
    totalWeight += item.weight;
  });
  const notableItems = [...items]
    .sort((a, b) => (
      getLootRarityRank(b.rarity) - getLootRarityRank(a.rarity)
      || b.value - a.value
      || a.name.localeCompare(b.name)
    ))
    .slice(0, 5);
  return {
    items,
    itemCount: items.length,
    totalValue: Math.round(totalValue),
    totalWeight: Number(totalWeight.toFixed(1)),
    rarityCounts,
    notableItems,
  };
}

function getRunObjectiveProgress(objective, run, securedLoot = summarizeSecuredLoot(run)) {
  if (!objective) {
    return { current: 0, target: 1, complete: false };
  }
  const target = Math.max(1, Number(objective.target ?? 1));
  let current = 0;
  if (objective.type === "lootValue") {
    current = securedLoot.totalValue;
  } else if (objective.type === "rareLoot") {
    current = securedLoot.items.filter((item) => getLootRarityRank(item.rarity) >= 2).length;
  } else {
    current = securedLoot.itemCount;
  }
  return {
    current: Math.max(0, current),
    target,
    complete: current >= target,
  };
}

function summarizeRunObjectives(run, securedLoot = summarizeSecuredLoot(run)) {
  const objectives = Array.isArray(run?.objectives) ? run.objectives : [];
  const entries = objectives.map((objective) => {
    const progress = getRunObjectiveProgress(objective, run, securedLoot);
    return {
      id: objective.id,
      label: objective.label || objective.id,
      type: objective.type,
      target: progress.target,
      current: progress.current,
      complete: progress.complete,
      rewardMaterials: Math.max(0, Math.round(Number(objective.rewardMaterials ?? 0))),
    };
  });
  const completed = entries.filter((entry) => entry.complete);
  return {
    entries,
    completed,
    completedCount: completed.length,
    totalCount: entries.length,
    rewardMaterials: completed.reduce((total, entry) => total + entry.rewardMaterials, 0),
  };
}

function applyExtraction(state, data) {
  const run = state.run;
  const securedLoot = summarizeSecuredLoot(run);
  const objectives = summarizeRunObjectives(run, securedLoot);
  if (isMovementLab(data)) {
    state.resultSummary = {
      success: true,
      labSession: true,
      materials: run.materials,
      securedLoot,
      objectives,
      timePhase: run.timePhase,
    };
    clearSavedGame();
    state.run = null;
    state.scene = SCENES.RESULTS;
    state.sceneTimer = 0;
    setStatus(state, "?ㅽ뿕 醫낅즺. C/Z");
    return;
  }

  const outcomes = {
    guard: getEncounterOutcome(run.encounters.guard),
    ritualist: getEncounterOutcome(run.encounters.ritualist),
  };
  const trustDelta =
    Object.values(outcomes).filter((entry) => entry === "released").length -
    Object.values(outcomes).filter((entry) => entry === "harvested").length;
  const newUnlocks = run.pendingUnlocks.filter((abilityId) => !state.meta.unlockedAbilities.includes(abilityId));
  const newStories = run.pendingStoryFlags.filter((storyId) => !state.meta.storyFlags.includes(storyId));
  const totalMaterials = run.materials + objectives.rewardMaterials;
  const securedAt = Date.now();
  const newlySecuredLoot = securedLoot.items.map((item) => ({
    ...item,
    runIndex: (state.meta.completedRuns || 0) + 1,
    securedAt,
  }));

  state.meta = {
    ...state.meta,
    trust: state.meta.trust + trustDelta,
    bankedMaterials: state.meta.bankedMaterials + totalMaterials,
    securedLoot: [
      ...(Array.isArray(state.meta.securedLoot) ? state.meta.securedLoot : []),
      ...newlySecuredLoot,
    ].slice(-120),
    unlockedAbilities: [...state.meta.unlockedAbilities, ...newUnlocks],
    storyFlags: [...state.meta.storyFlags, ...newStories],
    completedRuns: state.meta.completedRuns + 1,
    lastOutcome: {
      outcomes,
      trustDelta,
      materials: totalMaterials,
      baseMaterials: run.materials,
      objectiveRewardMaterials: objectives.rewardMaterials,
      objectives,
      securedLoot: {
        itemCount: securedLoot.itemCount,
        totalValue: securedLoot.totalValue,
        rarityCounts: securedLoot.rarityCounts,
      },
      nightReached: run.nightActive,
    },
  };
  saveMetaState(state.meta);
  clearSavedGame();

  state.resultSummary = {
    success: true,
    outcomes,
    trustDelta,
    materials: totalMaterials,
    baseMaterials: run.materials,
    objectiveRewardMaterials: objectives.rewardMaterials,
    objectives,
    securedLoot,
    newUnlocks,
    newStories: data.encounters
      .filter((encounter) => newStories.includes(encounter.storyFlag))
      .map((encounter) => ({
        id: encounter.storyFlag,
        text: encounter.storyText,
      })),
    nightReached: run.nightActive,
  };
  state.run = null;
  state.scene = SCENES.RESULTS;
  state.sceneTimer = 0;
  setStatus(state, "洹???꾨즺. C/Z");
}

function applyFailure(state, data, reason) {
  const lostLoot = summarizeSecuredLoot(state.run);
  const objectives = summarizeRunObjectives(state.run, lostLoot);
  if (isMovementLab(data)) {
    state.resultSummary = {
      success: false,
      labSession: true,
      reason,
      lostMaterials: 0,
      lostLoot,
      objectives,
    };
    clearSavedGame();
    state.run = null;
    state.scene = SCENES.GAME_OVER;
    state.sceneTimer = 0;
    setStatus(state, "?ㅽ뿕 由ъ뀑. C/Z");
    return;
  }

  state.resultSummary = {
    success: false,
    reason,
    lostMaterials: state.run.materials,
    lostLoot,
    objectives,
  };
  clearSavedGame();
  state.run = null;
  state.scene = SCENES.GAME_OVER;
  state.sceneTimer = 0;
  setStatus(state, "???ㅽ뙣. C/Z");
}

function restartCurrentRun(state, data) {
  clearSavedGame();
  state.run = createRunState(data, state.meta);
  state.scene = SCENES.EXPEDITION;
  state.sceneTimer = 0;
  if (state.liveEdit) {
    state.liveEdit.active = false;
    state.liveEdit.hoverPlatformIndex = null;
    state.liveEdit.drag = null;
  }
  setStatus(state, "?ㅽ룿?쇰줈 蹂듦?.");
  saveCurrentGame(state, data);
}

const LEVEL_STATE_KEYS = [
  "interactables",
  "lootCrates",
  "encounters",
  "threats",
  "hostileDrones",
  "humanoidEnemies",
  "temporaryBlocks",
];

function captureLevelRuntimeState(run) {
  return Object.fromEntries(
    LEVEL_STATE_KEYS.map((key) => [key, deepClone(run[key])]),
  );
}

function installLevelRuntimeState(run, data, savedState = null) {
  const fresh = createLevelRuntimeState(data);
  LEVEL_STATE_KEYS.forEach((key) => {
    run[key] = savedState?.[key] ? deepClone(savedState[key]) : fresh[key];
  });
  run.loot = fresh.loot;
  run.enemyShots = [];
  run.playerBullets = [];
  run.damageNumbers = [];
  run.spilledLoot = [];
  run.weaponKick = null;
  run.faceOff = fresh.faceOff;
  run.prompt = "";
  run.promptWorld = null;
}

function resetPlayerForLevelTransition(run, data, entranceId) {
  const entrance = (data.entrances || []).find((entry) => entry.id === entranceId)
    || (data.entrances || []).find((entry) => entry.id === "start")
    || (data.entrances || [])[0]
    || data.player.spawn;
  const player = run.player;

  player.x = Number.isFinite(entrance?.x) ? entrance.x : data.player.spawn.x;
  player.y = Number.isFinite(entrance?.y) ? entrance.y : data.player.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.facing = Math.sign(entrance?.facing ?? player.facing ?? 1) || 1;
  player.onGround = true;
  player.wasOnGround = true;
  player.movementState = MOVEMENT_STATES.GROUNDED;
  player.attackCooldown = 0;
  player.attackWindow = 0;
  player.attackToolActive = false;
  player.attackHits = new Set();
  player.lightActive = false;
  player.dashTimer = 0;
  player.dashWindupTimer = 0;
  player.dashCooldownTimer = 0;
  player.dashDirection = 0;
  player.slideTimer = 0;
  player.hoverActive = false;
  player.hoverBoostActive = false;
  player.wallSliding = false;
  player.wallRunActive = false;
  player.braceHolding = false;
  player.braceHoldActive = false;
  player.braceReleaseTimer = 0;
  player.recoilShotTimer = 0;
  player.recoilShotActive = false;
  player.recoilShotAirborne = false;
  player.recoilShotFacing = player.facing || 1;
  player.recoilShotPitch = 0;
  player.recoilFocusActive = false;
  player.recoilFocusBlend = 0;
  clearZipLine(player);
  run.waterRespawnPoint = {
    levelId: run.currentLevelId || data.currentLevelId || data.defaultLevelId || "movement-lab-01",
    x: player.x,
    y: player.y,
    facing: player.facing || 1,
  };
}

function clearLevelTransitionEffects(run) {
  if (run.mapOverlay) {
    run.mapOverlay.active = false;
  }
  if (run.recoilAim) {
    run.recoilAim.active = false;
    run.recoilAim.aiming = false;
  }
  clearZipLine(run.player);
  run.enemyShots = [];
  run.playerBullets = [];
  run.damageNumbers = [];
  run.spilledLoot = [];
  run.attackFx = [];
  run.recoilFx = [];
  run.weaponMissiles = [];
  run.weaponBarriers = [];
  run.weaponKick = null;
  run.particles = [];
  run.afterimages = [];
  run.recoilFocusAfterimages = [];
  run.recoilFocusAfterimageTimer = 0;
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
    run.faceOff.acquireTargetId = null;
    run.faceOff.acquireTimer = 0;
    run.faceOff.acquireProgress = 0;
  }
}

function snapCameraToPlayer(run, data) {
  const config = getCameraConfig(data);
  const zoom = clamp(config.zoom ?? run.cameraZoom ?? 1, 0.5, 2.5);
  const viewportWidth = CAMERA_SCREEN_WIDTH / zoom;
  const viewportHeight = CAMERA_SCREEN_HEIGHT / zoom;
  const focusX = config.lookAheadEnabled ? (config.neutralFocusX ?? 0.5) : CAMERA_FOCUS_X;
  const focusY = config.lookAheadEnabled ? (config.neutralFocusY ?? 0.5) : CAMERA_FOCUS_Y;
  const targetX = run.player.x + run.player.width * 0.5 - viewportWidth * focusX;
  const targetY = run.player.y + run.player.height * 0.5 - viewportHeight * focusY;
  const maxX = Math.max(0, data.world.width - viewportWidth);
  const maxY = Math.max(0, data.world.height - viewportHeight);

  run.cameraZoom = zoom;
  run.cameraFocusX = focusX;
  run.cameraFocusY = focusY;
  run.cameraX = clamp(targetX, 0, maxX);
  run.cameraY = clamp(targetY, 0, maxY);
  run.cameraTargetX = targetX;
  run.cameraTargetY = targetY;
  run.cameraTargetZoom = zoom;
  run.cameraLookDirection = run.player.facing || 1;
  run.cameraLookAhead = 0;
  run.cameraSpeedRatio = 0;
  run.cameraFallHoldTimer = 0;
  run.cameraFallRatio = 0;
  run.cameraFallTargetYOffset = 0;
}

function getShelterConfig(data) {
  return {
    levelId: data.shelter?.levelId || "shelter-hub-01",
    backgroundId: data.shelter?.backgroundId || "shelter-hub",
    arrivalCutsceneSeconds: Number.isFinite(data.shelter?.arrivalCutsceneSeconds)
      ? data.shelter.arrivalCutsceneSeconds
      : SHELTER_ARRIVAL_SECONDS,
  };
}

function isShelterRouteExit(routeExit, data) {
  const shelterLevelId = getShelterConfig(data).levelId;
  return routeExit?.kind === "shelter"
    || routeExit?.type === "shelter"
    || routeExit?.toLevelId === shelterLevelId;
}

function getShelterRouteBlockReason(run) {
  if (!run) {
    return SHELTER_NIGHT_LOCK_MESSAGE;
  }
  if (Number.isFinite(run.shelterExitCooldown) && run.shelterExitCooldown > 0) {
    return SHELTER_COOLDOWN_MESSAGE;
  }
  return run.timePhase === "night" ? "" : SHELTER_NIGHT_LOCK_MESSAGE;
}

function setRunNotice(run, message, duration = 1.8) {
  if (!run || !message) {
    return;
  }
  pushNotice(run, message);
  run.message = message;
  run.noticeTimer = duration;
}

function getRunTimePhaseLabel(run) {
  if (run?.timePhase === "night") {
    return "밤";
  }
  if (run?.timePhase === "dusk") {
    return "황혼";
  }
  return "주간";
}

function setDebugNightPhase(state, data) {
  const run = state.run;
  if (state.scene !== SCENES.EXPEDITION || !run) {
    return false;
  }
  const nightAt = Number.isFinite(data.world?.nightAt) ? data.world.nightAt : 150;
  run.time = Math.max(Number(run.time) || 0, nightAt);
  run.timePhase = "night";
  run.nightActive = true;
  run.nightTransitionTimer = NIGHT_TRANSITION_SECONDS;
  setRunNotice(run, "?뚯뒪?? 諛ㅼ쑝濡??꾪솚", 2);
  setStatus(state, run.message);
  saveCurrentGame(state, data);
  return true;
}

function createActiveShelterRestState(returnLevelId, returnEntranceId) {
  return {
    active: true,
    phase: "arrival",
    timer: 0,
    menuIndex: 0,
    returnLevelId: returnLevelId || null,
    returnEntranceId: returnEntranceId || "start",
    dayAdvanced: false,
    photo: {
      frameX: 0,
      frameY: 0,
      zoom: 1,
      capturedImage: null,
      flashTimer: 0,
    },
    recordsIndex: 0,
    backgroundIndex: 0,
  };
}

function resetShelterPhoto(rest) {
  rest.photo = {
    frameX: 0,
    frameY: 0,
    zoom: 1,
    capturedImage: null,
    flashTimer: 0,
  };
}

function getShelterPhotoScenes(data) {
  return Array.isArray(data.shelter?.photoScenes)
    ? data.shelter.photoScenes.filter((scene) => scene && typeof scene === "object")
    : [];
}

function normalizeShelterPhotoDay(day) {
  return Math.max(1, Math.floor(Number(day) || 1));
}

function getShelterPhotoSceneForDay(data, day) {
  const scenes = getShelterPhotoScenes(data);
  if (!scenes.length) {
    return null;
  }
  const normalizedDay = normalizeShelterPhotoDay(day);
  const exact = scenes.find((scene) => normalizeShelterPhotoDay(scene.day) === normalizedDay);
  return exact || scenes[(normalizedDay - 1) % scenes.length] || null;
}

function getShelterPhotoSceneSrc(data, scene) {
  if (!scene) {
    return "";
  }
  const assetSrc = scene.assetKey ? data.art?.[scene.assetKey]?.src : "";
  return assetSrc || scene.src || "";
}

function getShelterCgIllustrationSrc(data, backgroundId = getShelterConfig(data).backgroundId, day = null) {
  const sceneSrc = day == null
    ? ""
    : getShelterPhotoSceneSrc(data, getShelterPhotoSceneForDay(data, day));
  if (sceneSrc) {
    return sceneSrc;
  }
  if (backgroundId === "shelter-hub") {
    return data.art?.shelterHubConcept?.src || "";
  }
  return data.art?.shelterHubConcept?.src || "";
}

function getShelterCgIllustrationImage(data, backgroundId = getShelterConfig(data).backgroundId, day = null) {
  const src = getShelterCgIllustrationSrc(data, backgroundId, day);
  if (!src || typeof Image === "undefined") {
    return null;
  }
  if (!shelterCgImageCache.has(src)) {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    shelterCgImageCache.set(src, image);
  }
  return shelterCgImageCache.get(src);
}

function isShelterCgIllustrationReady(data, backgroundId = getShelterConfig(data).backgroundId, day = null) {
  const image = getShelterCgIllustrationImage(data, backgroundId, day);
  return Boolean(image?.complete && image.naturalWidth && image.naturalHeight);
}

function preloadShelterCgIllustration(data, day = null) {
  getShelterCgIllustrationImage(data, getShelterConfig(data).backgroundId, day);
}

function drawShelterCgFallback(ctx, width, height) {
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#dce8d2");
  background.addColorStop(0.46, "#6d9da0");
  background.addColorStop(1, "#111a20");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(246, 255, 235, 0.58)";
  ctx.fillRect(10, height * 0.72, width - 20, height * 0.18);
  ctx.fillStyle = "rgba(9, 24, 28, 0.64)";
  ctx.fillRect(28, height * 0.82, width - 56, height * 0.12);
}

function drawImageCoverPan(ctx, image, x, y, width, height, panX = 0, panY = 0, zoom = 1) {
  if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) {
    return false;
  }

  const imageAspect = image.naturalWidth / image.naturalHeight;
  const frameAspect = width / height;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (imageAspect > frameAspect) {
    sw = image.naturalHeight * frameAspect;
  } else {
    sh = image.naturalWidth / frameAspect;
  }

  const photoZoom = clamp(zoom, 1, 1.35);
  sw = Math.max(1, Math.min(image.naturalWidth, sw / photoZoom));
  sh = Math.max(1, Math.min(image.naturalHeight, sh / photoZoom));

  const maxShiftX = Math.max(0, (image.naturalWidth - sw) * 0.5);
  const maxShiftY = Math.max(0, (image.naturalHeight - sh) * 0.5);
  const sx = clamp((image.naturalWidth - sw) * 0.5 + clamp(panX, -1, 1) * maxShiftX * 0.7, 0, image.naturalWidth - sw);
  const sy = clamp((image.naturalHeight - sh) * 0.5 + clamp(panY, -1, 1) * maxShiftY * 0.7, 0, image.naturalHeight - sh);

  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  return true;
}

function ensureCgArchive(meta) {
  meta.cgArchive = meta.cgArchive && typeof meta.cgArchive === "object"
    ? meta.cgArchive
    : {};
  meta.cgArchive.photos = Array.isArray(meta.cgArchive.photos)
    ? meta.cgArchive.photos
    : [];
  meta.cgArchive.unlockedBackgroundIds = Array.isArray(meta.cgArchive.unlockedBackgroundIds)
    ? meta.cgArchive.unlockedBackgroundIds.map(String).filter(Boolean)
    : [];
  if (!meta.cgArchive.unlockedBackgroundIds.includes("shelter-hub")) {
    meta.cgArchive.unlockedBackgroundIds.unshift("shelter-hub");
  }
  return meta.cgArchive;
}

function refillWeaponsForShelter(run, data) {
  const weapons = ensureWeaponLoadoutState(run, data);
  const defaultReserve = data.defaultLoadout?.reserveAmmo || {};
  Object.keys(defaultReserve).forEach((ammoType) => {
    weapons.reserveAmmo[ammoType] = defaultReserve[ammoType];
  });
  Object.values(weapons.arms || {}).forEach((arm) => {
    const stats = computeArmWeaponStats(data, arm);
    if (!stats.equipped) {
      arm.magazine = 0;
      arm.reloadTimer = 0;
      arm.reloadDuration = 0;
      arm.fireCooldownTimer = 0;
      return;
    }
    arm.magazine = stats.magazineSize;
    arm.reloadTimer = 0;
    arm.reloadDuration = 0;
    arm.fireCooldownTimer = 0;
    if (!Number.isFinite(weapons.reserveAmmo[stats.ammoType])) {
      weapons.reserveAmmo[stats.ammoType] = defaultReserve[stats.ammoType] ?? stats.magazineSize;
    }
  });
}

function applyShelterRestRecovery(run, data) {
  run.hp = run.maxHp || data.player.maxHp;
  run.sanity = run.maxSanity || data.player.maxSanity;
  run.battery = run.maxBattery || data.player.maxBattery;
  run.focusMax = Number.isFinite(run.focusMax) ? run.focusMax : 100;
  run.focus = run.focusMax;
  run.focusActive = false;
  run.focusDepleted = false;
  run.time = 0;
  run.timePhase = "day";
  run.nightActive = false;
  run.nightTransitionTimer = 0;
  refillWeaponsForShelter(run, data);
}

function beginShelterRest(state, data, returnLevelId, returnEntranceId) {
  const run = state.run;
  if (!run) {
    return;
  }
  run.shelterRest = createActiveShelterRestState(returnLevelId, returnEntranceId);
  if (!run.shelterRest.dayAdvanced) {
    run.day = Math.max(1, Math.floor(run.day || 1)) + 1;
    run.shelterRest.dayAdvanced = true;
    applyShelterRestRecovery(run, data);
  }
  ensureCgArchive(state.meta || {});
  preloadShelterCgIllustration(data, run.day);
  run.message = `DAY ${run.day} 쨌 ?쇰궃泥??꾩갑`;
  run.noticeTimer = 2.6;
  setStatus(state, "?쇰궃泥??먯뇙 以?");
  saveCurrentGame(state, data);
}

function createShelterPhotoImage(run, data, rest) {
  if (typeof document === "undefined") {
    return "";
  }
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 270;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  const photo = rest.photo || {};
  const offsetX = clamp(Number(photo.frameX ?? 0), -1, 1);
  const offsetY = clamp(Number(photo.frameY ?? 0), -1, 1);
  const zoom = clamp(Number(photo.zoom ?? 1), 0.8, 1.35);
  const backgroundId = getShelterConfig(data).backgroundId;
  const cgImage = getShelterCgIllustrationImage(data, backgroundId, run.day);
  if (!drawImageCoverPan(ctx, cgImage, 0, 0, canvas.width, canvas.height, offsetX, offsetY, zoom)) {
    drawShelterCgFallback(ctx, canvas.width, canvas.height);
  }

  const shade = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  shade.addColorStop(0, "rgba(2, 7, 10, 0.05)");
  shade.addColorStop(0.58, "rgba(4, 12, 16, 0.02)");
  shade.addColorStop(1, "rgba(2, 6, 10, 0.18)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try {
    return canvas.toDataURL("image/jpeg", 0.78);
  } catch {
    return "";
  }
}

function saveShelterPhoto(state, data) {
  const run = state.run;
  const rest = run?.shelterRest;
  if (!run || !rest) {
    return false;
  }
  const image = rest.photo?.capturedImage || createShelterPhotoImage(run, data, rest);
  if (!image) {
    run.message = "CG ????ㅽ뙣.";
    run.noticeTimer = 1.8;
    return false;
  }
  const archive = ensureCgArchive(state.meta || {});
  const backgroundId = getShelterConfig(data).backgroundId;
  const photoScene = getShelterPhotoSceneForDay(data, run.day);
  if (!archive.unlockedBackgroundIds.includes(backgroundId)) {
    archive.unlockedBackgroundIds.push(backgroundId);
  }
  archive.photos.push({
    id: `shelter-photo-${Date.now()}`,
    day: Math.max(1, Math.floor(run.day || 1)),
    createdAt: Date.now(),
    backgroundId,
    sceneId: photoScene?.id || "",
    sceneLabel: photoScene?.label || "",
    image,
  });
  archive.photos = archive.photos.slice(-CG_PHOTO_LIMIT);
  saveMetaState(state.meta);
  rest.recordsIndex = Math.max(0, archive.photos.length - 1);
  run.message = "CG ?쇰윭?ㅽ듃 ???";
  run.noticeTimer = 2.2;
  return true;
}

function transitionToLevel(state, data, targetLevelId, entranceId = "start", options = {}) {
  const run = state.run;
  if (!run || !targetLevelId) {
    return null;
  }

  if (!getLevelIds(data.__baseData || data).includes(targetLevelId)) {
    run.message = `Route target not found: ${targetLevelId}`;
    run.noticeTimer = 2.6;
    setStatus(state, run.message);
    return null;
  }

  const fromLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId || "movement-lab-01";
  run.levelStates = run.levelStates || {};
  run.levelStates[fromLevelId] = captureLevelRuntimeState(run);

  loadRuntimeLevelData(data, targetLevelId);
  const resolvedTargetLevelId = data.currentLevelId || targetLevelId;
  const savedState = run.levelStates[resolvedTargetLevelId] || null;
  run.currentLevelId = resolvedTargetLevelId;
  visitLevel(run, data, resolvedTargetLevelId);

  installLevelRuntimeState(run, data, savedState);
  resetPlayerForLevelTransition(run, data, entranceId || "start");
  clearLevelTransitionEffects(run);
  snapCameraToPlayer(run, data);
  updateMapExploration(run, data);

  run.message = options.message || `${data.levelLabel || resolvedTargetLevelId} 吏꾩엯.`;
  run.noticeTimer = 2.6;
  setStatus(state, run.message);
  if (options.persist !== false) {
    saveCurrentGame(state, data);
  }
  return {
    fromLevelId,
    targetLevelId: resolvedTargetLevelId,
  };
}

function isTouchRouteExit(routeExit) {
  return routeExit?.trigger === "touch" || routeExit?.activation === "touch";
}

function beginRouteFadeTransition(state, data, routeExit) {
  const run = state.run;
  if (!run || !routeExit?.toLevelId || run.routeTransition?.active) {
    return false;
  }
  const shelterBlockReason = isShelterRouteExit(routeExit, data)
    ? getShelterRouteBlockReason(run)
    : "";
  if (shelterBlockReason) {
    setRunNotice(run, shelterBlockReason, 2);
    setStatus(state, shelterBlockReason);
    return false;
  }
  discoverRouteExit(run, data, routeExit);
  run.routeTransition = {
    active: true,
    phase: "fadeOut",
    timer: 0,
    duration: clamp(Number(routeExit.fadeSeconds ?? 0.42), 0.05, 2),
    routeExit: { ...routeExit },
    fromLevelId: run.currentLevelId || data.currentLevelId || data.defaultLevelId || "movement-lab-01",
  };
  run.prompt = "";
  run.promptWorld = null;
  setStatus(state, `${routeExit.label || "Route"} 이동 중`);
  return true;
}

function updateRouteFadeTransition(state, data, dt) {
  const run = state.run;
  const transition = run?.routeTransition;
  if (!run || !transition?.active) {
    return false;
  }

  run.prompt = "";
  run.promptWorld = null;
  transition.timer = Math.max(0, Number(transition.timer || 0) + dt);
  const duration = clamp(Number(transition.duration ?? 0.42), 0.05, 2);
  transition.duration = duration;

  if (transition.phase === "fadeOut" && transition.timer >= duration) {
    const routeExit = transition.routeExit;
    transitionToRouteExit(state, data, routeExit, { skipFade: true });
    if (!state.run) {
      return true;
    }
    state.run.routeTransition = {
      active: true,
      phase: "fadeIn",
      timer: 0,
      duration,
      routeExit: null,
      fromLevelId: transition.fromLevelId || null,
    };
    snapCameraToPlayer(state.run, data);
    return true;
  }

  if (transition.phase === "fadeIn" && transition.timer >= duration) {
    run.routeTransition = {
      active: false,
      phase: "idle",
      timer: 0,
      duration,
      routeExit: null,
      fromLevelId: null,
    };
    return true;
  }

  return true;
}

function transitionToRouteExit(state, data, routeExit, options = {}) {
  const run = state.run;
  if (!run || !routeExit?.toLevelId) {
    return;
  }
  if (!options.skipFade && isTouchRouteExit(routeExit)) {
    beginRouteFadeTransition(state, data, routeExit);
    return;
  }

  discoverRouteExit(run, data, routeExit);
  const fromLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId || "movement-lab-01";
  const shelterRoute = isShelterRouteExit(routeExit, data);
  if (shelterRoute) {
    const blockReason = getShelterRouteBlockReason(run);
    if (blockReason) {
      setRunNotice(run, blockReason, 2);
      setStatus(state, blockReason);
      return;
    }
  }
  const result = transitionToLevel(state, data, routeExit.toLevelId, routeExit.toEntranceId || "start", {
    persist: !shelterRoute,
    message: shelterRoute ? "?쇰궃泥?吏꾩엯." : undefined,
  });
  if (shelterRoute && result) {
    beginShelterRest(state, data, fromLevelId, routeExit.returnEntranceId || "start");
  }
}

function leaveShelterRest(state, data) {
  const run = state.run;
  const rest = run?.shelterRest;
  if (!run || !rest?.active) {
    return;
  }
  const targetLevelId = rest.returnLevelId || data.defaultLevelId || "movement-lab-01";
  const entranceId = rest.returnEntranceId || "start";
  const result = transitionToLevel(state, data, targetLevelId, entranceId, {
    persist: false,
    message: "?쇰궃泥?異쒕컻.",
  });
  if (!result) {
    return;
  }
  run.shelterRest = {
    active: false,
    phase: "inactive",
    timer: 0,
    menuIndex: 0,
    returnLevelId: null,
    returnEntranceId: "start",
    dayAdvanced: true,
    photo: {
      frameX: 0,
      frameY: 0,
      zoom: 1,
      capturedImage: null,
      flashTimer: 0,
    },
    recordsIndex: 0,
    backgroundIndex: 0,
  };
  run.shelterExitCooldown = SHELTER_EXIT_COOLDOWN_SECONDS;
  run.message = `${data.levelLabel || targetLevelId} 蹂듦?.`;
  run.noticeTimer = 2.6;
  setStatus(state, run.message);
  saveCurrentGame(state, data);
}

function getZipLineProgressForPoint(zipLine, point) {
  const dx = zipLine.end.x - zipLine.start.x;
  const dy = zipLine.end.y - zipLine.start.y;
  const lengthSq = Math.max(1, dx * dx + dy * dy);
  return clamp(((point.x - zipLine.start.x) * dx + (point.y - zipLine.start.y) * dy) / lengthSq, 0, 1);
}

function getZipLinePoint(zipLine, progress) {
  return {
    x: lerp(zipLine.start.x, zipLine.end.x, progress),
    y: lerp(zipLine.start.y, zipLine.end.y, progress),
  };
}

function getPointToZipLineDistance(point, zipLine) {
  const dx = zipLine.end.x - zipLine.start.x;
  const dy = zipLine.end.y - zipLine.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) {
    return Math.hypot(point.x - zipLine.start.x, point.y - zipLine.start.y);
  }
  const t = clamp(((point.x - zipLine.start.x) * dx + (point.y - zipLine.start.y) * dy) / lengthSq, 0, 1);
  const nearestX = zipLine.start.x + dx * t;
  const nearestY = zipLine.start.y + dy * t;
  return Math.hypot(point.x - nearestX, point.y - nearestY);
}

function getZipLineVector(zipLine) {
  const dx = zipLine.end.x - zipLine.start.x;
  const dy = zipLine.end.y - zipLine.start.y;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  return {
    x: dx / length,
    y: dy / length,
    length,
  };
}

function getZipLineEndpointNodeId(zipLine, progress) {
  return progress <= 0 ? zipLine.startNodeId : zipLine.endNodeId;
}

function getZipLineDirectionFromNode(zipLine, nodeId) {
  if (zipLine.startNodeId === nodeId) {
    return 1;
  }
  if (zipLine.endNodeId === nodeId) {
    return -1;
  }
  return 0;
}

function getNextZipLineAtNode(data, currentZipLine, nodeId, incomingX, incomingY) {
  if (!nodeId) {
    return null;
  }

  let best = null;
  let bestScore = -Infinity;
  for (const candidate of data.zipLines || []) {
    if (candidate.id === currentZipLine.id) {
      continue;
    }
    const direction = getZipLineDirectionFromNode(candidate, nodeId);
    if (direction === 0) {
      continue;
    }
    const vector = getZipLineVector(candidate);
    const outgoingX = vector.x * direction;
    const outgoingY = vector.y * direction;
    const score = incomingX * outgoingX + incomingY * outgoingY;
    if (score > bestScore) {
      bestScore = score;
      best = { zipLine: candidate, direction };
    }
  }
  return best;
}

function continueZipLineRideAtNode(player, data, currentZipLine, endpointProgress, config) {
  const nodeId = getZipLineEndpointNodeId(currentZipLine, endpointProgress);
  const vector = getZipLineVector(currentZipLine);
  const incomingX = vector.x * (player.zipLineDirection || 1);
  const incomingY = vector.y * (player.zipLineDirection || 1);
  const next = getNextZipLineAtNode(data, currentZipLine, nodeId, incomingX, incomingY);
  if (!next) {
    return false;
  }

  player.zipLineId = next.zipLine.id;
  player.zipLineDirection = next.direction;
  player.zipLineProgress = next.direction > 0 ? 0 : 1;
  player.zipLineSpeed = Math.max(
    player.zipLineSpeed || 0,
    next.zipLine.speed ?? 1480,
    (config.sprintSpeed ?? config.runSpeed) * 1.18,
  );
  return true;
}

function beginZipLineRide(run, data, zipLine) {
  const player = run.player;
  const playerCenter = getCenter(player);
  const progress = getZipLineProgressForPoint(zipLine, playerCenter);
  const direction = player.facing >= 0 ? 1 : -1;
  const point = getZipLinePoint(zipLine, direction > 0 ? Math.max(progress, 0) : Math.min(progress, 1));
  player.zipLineActive = true;
  player.zipLineId = zipLine.id;
  player.zipLineProgress = getZipLineProgressForPoint(zipLine, point);
  player.zipLineDirection = direction;
  player.zipLineSpeed = Math.max(zipLine.speed ?? 1480, (data.player.movement?.sprintSpeed ?? 1180) * 1.18);
  player.onGround = false;
  player.wasOnGround = false;
  player.vx = 0;
  player.vy = 0;
  player.x = point.x - player.width * 0.5;
  player.y = point.y - player.height * 0.38;
  player.facing = direction;
  player.sprintActive = true;
  player.sprintCharge = 1;
  player.canInteract = false;
  clearBraceHold(player);
  clearWallRun(player);
  clearHover(player);
  clearRecoilSpin(player);
  pushNotice(run, "Zipline engaged.");
}

function updateZipLineRide(player, data, run, config, dt, jumpPressed) {
  const zipLine = (data.zipLines || []).find((entry) => entry.id === player.zipLineId);
  if (!zipLine) {
    clearZipLine(player);
    return false;
  }

  if (jumpPressed) {
    const direction = player.zipLineDirection || player.facing || 1;
    const exitSpeed = Math.max(player.zipLineSpeed || 0, (config.sprintSpeed ?? config.runSpeed) * 1.05);
    clearZipLine(player);
    player.vx = direction * exitSpeed * 0.62;
    player.vy = config.jumpVelocity ?? data.player.jumpVelocity ?? -900;
    player.onGround = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    player.facing = direction;
    armSprintJumpCarry(player, config);
    spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.35, 10, "#e7f47e");
    return false;
  }

  const dx = zipLine.end.x - zipLine.start.x;
  const dy = zipLine.end.y - zipLine.start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const direction = player.zipLineDirection || 1;
  const speed = Math.max(player.zipLineSpeed || 0, (config.sprintSpeed ?? config.runSpeed) * 1.18);
  const previousPoint = getZipLinePoint(zipLine, player.zipLineProgress);
  player.zipLineProgress = clamp(player.zipLineProgress + direction * (speed * dt / length), 0, 1);
  const point = getZipLinePoint(zipLine, player.zipLineProgress);
  player.x = clamp(point.x - player.width * 0.5, 0, data.world.width - player.width);
  player.y = clamp(point.y - player.height * 0.38, 0, data.world.height - player.height);
  player.vx = (point.x - previousPoint.x) / Math.max(dt, 0.001);
  player.vy = (point.y - previousPoint.y) / Math.max(dt, 0.001);
  player.facing = Math.sign(player.vx) || direction;
  player.onGround = false;
  player.wasOnGround = false;
  player.wallSliding = false;
  player.wallDirection = 0;
  player.sprintActive = true;
  player.sprintCharge = 1;
  player.canInteract = false;

  if (player.zipLineProgress <= 0 || player.zipLineProgress >= 1) {
    const endpointProgress = player.zipLineProgress <= 0 ? 0 : 1;
    if (!continueZipLineRideAtNode(player, data, zipLine, endpointProgress, config)) {
      clearZipLine(player);
      player.vx *= 0.82;
      player.vy = Math.max(player.vy, 120);
      player.canInteract = true;
    }
  }

  return true;
}

function handleTouchRouteExits(state, data) {
  const run = state.run;
  const player = run?.player;
  if (!run || !player || run.routeTransition?.active) {
    return false;
  }
  for (const routeExit of data.routeExits || []) {
    if (!isTouchRouteExit(routeExit) || !routeExit.toLevelId) {
      continue;
    }
    const exitRect = createRect(routeExit.x, routeExit.y, routeExit.width, routeExit.height);
    if (rectsOverlap(player, exitRect)) {
      return beginRouteFadeTransition(state, data, routeExit);
    }
  }
  return false;
}

function updateInteractions(state, data, canInteract) {
  const run = state.run;
  run.prompt = "";
  run.promptWorld = null;

  const player = run.player;
  if (handleTouchRouteExits(state, data)) {
    return;
  }
  const guard = run.encounters.guard;
  const isMoving = Math.abs(player.vx) > 24 || Math.abs(player.vy) > 90;

  if (
    !isEntityDisabled(guard) &&
    guard.state !== "dead" &&
    guard.state !== "released" &&
    run.inventory.badge &&
    rectsOverlap(player, guard.checkpointZone) &&
    !isMoving &&
    !player.lightActive
  ) {
    run.prompt = "?뺤? ?좎?";
    run.promptWorld = {
      x: guard.checkpointZone.x + guard.checkpointZone.width / 2,
      y: guard.checkpointZone.y - 10,
    };
    return;
  }

  const braceWall = getActiveBraceWall(player, data, run);
  if (
    braceWall &&
    !player.onGround &&
    player.height === player.standHeight &&
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0
  ) {
    run.prompt = "C: 踰?吏싰린";
    run.promptWorld = {
      x: braceWall.x + braceWall.width * 0.5,
      y: braceWall.y - 12,
    };
    return;
  }

  const nearest = getInteractionTargets(run, data);
  if (!nearest) {
    return;
  }

  run.prompt = nearest.text;
  run.promptWorld = { x: nearest.x, y: nearest.y };

  if (!canInteract) {
    return;
  }

  if (nearest.kind === "faceOff") {
    if (!consumeEitherPress(state, FACE_OFF_ENTRY_KEYS)) {
      return;
    }
    enterFaceOff(run, data, nearest.enemy, state);
    return;
  }

  if (!consumeEitherPress(state, INTERACT_KEYS)) {
    return;
  }

  if (nearest.kind === "extract") {
    applyExtraction(state, data);
    return;
  }

  if (nearest.kind === "shelterLocked") {
    setRunNotice(run, nearest.text, 2);
    setStatus(state, nearest.text);
    return;
  }

  if (nearest.kind === "routeExit") {
    transitionToRouteExit(state, data, nearest.routeExit);
    return;
  }

  if (nearest.kind === "zipLine") {
    beginZipLineRide(run, data, nearest.zipLine);
    return;
  }

  if (nearest.kind === "pedestal") {
    usePedestal(run, nearest.pedestal);
    return;
  }

  if (nearest.kind === "lootCrate") {
    openLootCrate(run, nearest.crate);
    return;
  }

  const item = run.interactables.find((entry) => entry.id === nearest.id);
  if (!item) {
    return;
  }

  item.used = true;
  if (item.kind === "badge-locker") {
    run.inventory.badge = true;
    pushClue(run, "guard-badge", item.clue);
    pushNotice(run, "?듯뻾 諛곗? ?뺣낫.");
    spawnParticles(run, item.x + item.width / 2, item.y + 12, 12, "#f4dda6");
    return;
  }

  if (item.kind === "salvage") {
    run.materials += item.materials;
    pushClue(run, item.id, item.clue);
    pushNotice(run, `${item.materials} ?먯옱 ?뺣낫.`);
    spawnParticles(run, item.x + item.width / 2, item.y + 12, 10, "#8fe1ff");
  }
}

function updateShelterRestMode(state, data, dt) {
  const run = state.run;
  const rest = run?.shelterRest;
  if (!run || !rest?.active) {
    return false;
  }

  if (state.liveEdit?.active) {
    state.liveEdit.active = false;
  }
  run.prompt = "";
  run.promptWorld = null;
  if (run.mapOverlay) {
    run.mapOverlay.active = false;
    run.mapOverlay.dragging = false;
    run.mapOverlay.dragPointerId = null;
  }
  if (run.recoilAim) {
    run.recoilAim.active = false;
    run.recoilAim.aiming = false;
  }
  run.focusActive = false;
  run.player.recoilFocusActive = false;
  rest.timer = Number.isFinite(rest.timer) ? rest.timer + dt : dt;
  if (rest.photo) {
    rest.photo.flashTimer = Math.max(0, Number(rest.photo.flashTimer || 0) - dt);
  }

  if (rest.phase === "arrival") {
    const arrivalSeconds = getShelterConfig(data).arrivalCutsceneSeconds;
    if (rest.timer >= arrivalSeconds || consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
      rest.menuIndex = clamp(Math.floor(rest.menuIndex || 0), 0, SHELTER_MENU_ITEMS.length - 1);
      setStatus(state, "?쇰궃泥??湲?");
      saveCurrentGame(state, data);
    } else {
      setStatus(state, "?쇰궃泥??먯뇙 以?");
    }
    updateAutoSave(state, data, dt);
    return true;
  }

  if (rest.phase === "menu") {
    if (consumeEitherPress(state, SHELTER_MENU_UP_KEYS)) {
      rest.menuIndex = (Math.max(0, Math.floor(rest.menuIndex || 0)) + SHELTER_MENU_ITEMS.length - 1) % SHELTER_MENU_ITEMS.length;
    }
    if (consumeEitherPress(state, SHELTER_MENU_DOWN_KEYS)) {
      rest.menuIndex = (Math.max(0, Math.floor(rest.menuIndex || 0)) + 1) % SHELTER_MENU_ITEMS.length;
    }
    if (consumeEitherPress(state, SHELTER_EXIT_KEYS)) {
      leaveShelterRest(state, data);
      return true;
    }
    if (consumeEitherPress(state, INTERACT_KEYS) || consumeEitherPress(state, CONFIRM_KEYS)) {
      const item = SHELTER_MENU_ITEMS[clamp(Math.floor(rest.menuIndex || 0), 0, SHELTER_MENU_ITEMS.length - 1)];
      if (item === "photo") {
        rest.phase = "photo";
        rest.timer = 0;
        resetShelterPhoto(rest);
        preloadShelterCgIllustration(data, run.day);
        setStatus(state, "CG 珥ъ쁺 紐⑤뱶.");
      } else if (item === "records") {
        rest.phase = "records";
        rest.timer = 0;
        rest.recordsIndex = clamp(Math.floor(rest.recordsIndex || 0), 0, Math.max(0, ensureCgArchive(state.meta || {}).photos.length - 1));
        setStatus(state, "湲곕줉 蹂닿린.");
      } else if (item === "background") {
        rest.phase = "background";
        rest.timer = 0;
        rest.backgroundIndex = clamp(Math.floor(rest.backgroundIndex || 0), 0, Math.max(0, ensureCgArchive(state.meta || {}).unlockedBackgroundIds.length - 1));
        setStatus(state, "諛곌꼍 蹂닿린.");
      } else if (item === "exit") {
        leaveShelterRest(state, data);
        return true;
      } else {
        run.message = "?쇰궃泥??댁떇 ?꾨즺.";
        run.noticeTimer = 1.8;
        setStatus(state, run.message);
      }
    } else {
      setStatus(state, "피난처 · Z 선택 · C 나가기");
    }
    updateAutoSave(state, data, dt);
    return true;
  }

  if (rest.phase === "photo") {
    rest.photo = rest.photo || {};
    const moveX = (isEitherPressed(state, SHELTER_VIEW_RIGHT_KEYS) ? 1 : 0)
      - (isEitherPressed(state, SHELTER_VIEW_LEFT_KEYS) ? 1 : 0);
    const moveY = (isEitherPressed(state, SHELTER_MENU_DOWN_KEYS) ? 1 : 0)
      - (isEitherPressed(state, SHELTER_MENU_UP_KEYS) ? 1 : 0);
    rest.photo.frameX = clamp(Number(rest.photo.frameX || 0) + moveX * dt * 1.18, -1, 1);
    rest.photo.frameY = clamp(Number(rest.photo.frameY || 0) + moveY * dt * 1.18, -1, 1);
    if (consumeEitherPress(state, RESTART_KEYS) || consumeEitherPress(state, RELOAD_KEYS)) {
      resetShelterPhoto(rest);
    }
    if (consumeEitherPress(state, SHELTER_BACK_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
      resetShelterPhoto(rest);
    } else if (consumeEitherPress(state, INTERACT_KEYS)) {
      if (!isShelterCgIllustrationReady(data, getShelterConfig(data).backgroundId, run.day)) {
        preloadShelterCgIllustration(data, run.day);
        setStatus(state, "CG 濡쒕뵫 以?");
        updateAutoSave(state, data, dt);
        return true;
      }
      rest.photo.capturedImage = createShelterPhotoImage(run, data, rest);
      rest.photo.flashTimer = 0.22;
      rest.phase = "photoPreview";
      rest.timer = 0;
      setStatus(state, "CG 확인 · C 저장 / R 다시");
    } else {
      setStatus(state, "CG 珥ъ쁺 쨌 諛⑺뼢??WASD ?꾨젅??쨌 Z 珥ъ쁺");
    }
    updateAutoSave(state, data, dt);
    return true;
  }

  if (rest.phase === "photoPreview") {
    if (consumeEitherPress(state, RELOAD_KEYS)) {
      rest.phase = "photo";
      rest.timer = 0;
      rest.photo.capturedImage = null;
    } else if (consumeEitherPress(state, SHELTER_BACK_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
      resetShelterPhoto(rest);
    } else if (consumeEitherPress(state, CONFIRM_KEYS)) {
      if (saveShelterPhoto(state, data)) {
        rest.phase = "records";
        rest.timer = 0;
        saveCurrentGame(state, data);
      }
    } else {
      setStatus(state, "CG ?뺤씤 쨌 C ???/ R ?ъ눋??/ Esc 痍⑥냼");
    }
    updateAutoSave(state, data, dt);
    return true;
  }

  if (rest.phase === "records") {
    const photos = ensureCgArchive(state.meta || {}).photos;
    if (consumeEitherPress(state, SHELTER_VIEW_LEFT_KEYS)) {
      rest.recordsIndex = photos.length ? (Math.max(0, Math.floor(rest.recordsIndex || 0)) + photos.length - 1) % photos.length : 0;
    }
    if (consumeEitherPress(state, SHELTER_VIEW_RIGHT_KEYS)) {
      rest.recordsIndex = photos.length ? (Math.max(0, Math.floor(rest.recordsIndex || 0)) + 1) % photos.length : 0;
    }
    if (consumeEitherPress(state, SHELTER_BACK_KEYS) || consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
    } else {
      setStatus(state, "湲곕줉 蹂닿린 쨌 A/D ?섍린湲?쨌 Esc ?ㅻ줈");
    }
    updateAutoSave(state, data, dt);
    return true;
  }

  if (rest.phase === "background") {
    const backgrounds = ensureCgArchive(state.meta || {}).unlockedBackgroundIds;
    if (consumeEitherPress(state, SHELTER_VIEW_LEFT_KEYS)) {
      rest.backgroundIndex = backgrounds.length ? (Math.max(0, Math.floor(rest.backgroundIndex || 0)) + backgrounds.length - 1) % backgrounds.length : 0;
    }
    if (consumeEitherPress(state, SHELTER_VIEW_RIGHT_KEYS)) {
      rest.backgroundIndex = backgrounds.length ? (Math.max(0, Math.floor(rest.backgroundIndex || 0)) + 1) % backgrounds.length : 0;
    }
    if (consumeEitherPress(state, SHELTER_BACK_KEYS) || consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
    } else {
      setStatus(state, "諛곌꼍 蹂닿린 쨌 A/D ?섍린湲?쨌 Esc ?ㅻ줈");
    }
    updateAutoSave(state, data, dt);
    return true;
  }

  rest.phase = "menu";
  rest.timer = 0;
  updateAutoSave(state, data, dt);
  return true;
}

function updateExpedition(state, data, dt) {
  const run = state.run;
  if (updateShelterRestMode(state, data, dt)) {
    return;
  }
  if (Number.isFinite(run.shelterExitCooldown) && run.shelterExitCooldown > 0) {
    run.shelterExitCooldown = Math.max(0, run.shelterExitCooldown - dt);
  }
  if (Number.isFinite(run.nightTransitionTimer) && run.nightTransitionTimer > 0) {
    run.nightTransitionTimer = Math.max(0, run.nightTransitionTimer - dt);
  }
  updateRouteFadeTransition(state, data, dt);
  if (run.faceOff?.active && state.liveEdit?.active) {
    state.liveEdit.active = false;
  }
  if (state.liveEdit?.active) {
    if (run.mapOverlay) {
      run.mapOverlay.active = false;
    }
    run.prompt = "";
    run.promptWorld = null;
    if (run.recoilAim) {
      run.recoilAim.active = false;
      run.recoilAim.aiming = false;
    }
    run.player.recoilFocusActive = false;
    updateEffects(run, dt, dt, data);
    syncCamera(run, data, dt);
    if (state.liveEdit.saveFlashTimer > 0) {
      state.liveEdit.saveFlashTimer = Math.max(0, state.liveEdit.saveFlashTimer - dt);
    }
    setStatus(state, state.liveEdit.saveFlashTimer > 0
      ? "?쇱씠釉??몄쭛 쨌 ??λ맖 쨌 F2/L 醫낅즺"
      : "?쇱씠釉??몄쭛 쨌 釉붾줉 ?쒕옒洹?쨌 F2/L 醫낅즺");
    return;
  }

  updateMapExploration(run, data);

  if (updateInventoryOverlayInput(state, data)) {
    return;
  }

  if (updateMapOverlayInput(state, data)) {
    return;
  }

  if (!run.faceOff?.active && consumeEitherPress(state, RESTART_KEYS)) {
    restartCurrentRun(state, data);
    return;
  }

  if (run.faceOff?.active && run.loot?.active) {
    closeLootCrate(run);
  }
  const lootWasActive = Boolean(run.loot?.active);
  if (!lootWasActive && !run.faceOff?.active) {
    updateWeaponRuntime(run, data, state, dt);
  }
  const meleeSlotSelected = !lootWasActive && isMeleeSlotSelected(run, data);
  if (lootWasActive) {
    if (run.recoilAim) {
      run.recoilAim.active = false;
      run.recoilAim.aiming = false;
    }
    run.player.recoilFocusActive = false;
  } else if (meleeSlotSelected) {
    if (run.recoilAim) {
      run.recoilAim.active = false;
      run.recoilAim.aiming = false;
    }
    run.player.recoilFocusActive = false;
  } else {
    updateRecoilAim(run, data, state, dt);
  }
  const selectedWeaponAutomatic = !lootWasActive && !meleeSlotSelected && isSelectedWeaponAutomatic(run, data);
  const heldAutoFire = selectedWeaponAutomatic
    && Boolean(state.mouse?.primaryDown)
    && canFireWeaponPose(run.player);
  const queuedRecoilShotPressed = !lootWasActive && !meleeSlotSelected && (Boolean(state.mouse?.primaryJustPressed) || heldAutoFire);
  const reserveRecoilShotForWeapon = queuedRecoilShotPressed
    && (Boolean(run.recoilAim?.aiming) || selectedWeaponAutomatic);
  if (queuedRecoilShotPressed || state.mouse?.secondaryDown || run.recoilAim?.aiming || run.focusActive) {
    pushInputTrace(state, "preFace", {
      pj: Number(Boolean(state.mouse?.primaryJustPressed)),
      sec: Number(Boolean(state.mouse?.secondaryDown)),
      aim: Number(Boolean(run.recoilAim?.aiming)),
      focus: Number(Boolean(run.focusActive)),
      face: Number(Boolean(run.faceOff?.active)),
      reserve: Number(Boolean(reserveRecoilShotForWeapon)),
    });
  }
  if (reserveRecoilShotForWeapon && state.mouse) {
    state.mouse.primaryJustPressed = false;
  }
  const faceOffTimeScale = clamp(getFaceOffConfig(data).timeScale ?? 0.08, 0.02, 0.25);
  if (
    !reserveRecoilShotForWeapon &&
    (run.faceOff?.active || (!meleeSlotSelected && !lootWasActive)) &&
    updateFaceOff(state, data, dt, dt * faceOffTimeScale)
  ) {
    if (run.recoilAim) {
      run.recoilAim.active = true;
    }
    run.player.recoilFocusActive = true;
    run.player.recoilFocusBlend = Math.max(run.player.recoilFocusBlend ?? 0, 1);
    updateEffects(run, dt * faceOffTimeScale, dt, data);
    syncCamera(run, data, dt);
    lockCameraToFaceOffTarget(run, data);
    setStatus(state, run.faceOff?.message ? `Face-off: ${run.faceOff.message}` : "Face-off");
    return;
  }
  const focusActive = updateFocusState(run, state, dt);
  const focusTimeScale = focusActive
    ? clamp(data.player.movement.focusTimeScale ?? FOCUS_TIME_SCALE, 0.05, 1)
    : 1;
  const dodgeTimeScale = (run.dodgeSlowTimer ?? 0) > 0 ? 0.38 : 1;
  const simDt = dt * focusTimeScale * dodgeTimeScale;
  let attackPressed = lootWasActive ? false : consumeEitherPress(state, ATTACK_KEYS);
  if (!lootWasActive && meleeSlotSelected && Boolean(state.mouse?.primaryJustPressed)) {
    attackPressed = true;
  }
  const recoilShotPressed = reserveRecoilShotForWeapon || (!lootWasActive && Boolean(state.mouse?.primaryJustPressed));
  if (recoilShotPressed || queuedRecoilShotPressed) {
    pushInputTrace(state, "shotQueued", {
      shot: Number(Boolean(recoilShotPressed)),
      reserve: Number(Boolean(reserveRecoilShotForWeapon)),
      pj: Number(Boolean(state.mouse?.primaryJustPressed)),
    });
  }
  if (state.mouse) {
    state.mouse.primaryJustPressed = false;
    state.mouse.secondaryJustPressed = false;
  }

  const lootActive = lootWasActive ? updateLootInteraction(state, data, simDt) : false;
  if (lootWasActive) {
    attackPressed = false;
  } else {
    tryBeginZipLineRideFromMountInput(state, data);
    updatePlayer(run, data, state, simDt, {
      attackPressed,
      meleeToolActive: meleeSlotSelected,
      interactionPressed: false,
      recoilShotPressed,
    });
    if (run.player.movementState === MOVEMENT_STATES.DASH) {
      attackPressed = false;
    }
  }
  updateMapExploration(run, data);
  updateTimePhase(run, data, simDt);
  updateGuard(run, data, simDt);
  updateRitualist(run, data, simDt);
  updateThreats(run, data, simDt);
  updateHumanoidEnemies(run, data, simDt);
  updateHostileDrones(run, data, simDt);
  updateEnemyShots(run, data, simDt);
  updateAttackHits(run, data);
  updateSpilledLoot(run, data, simDt);
  if (lootActive) {
    run.prompt = "";
    run.promptWorld = null;
  } else {
    updateInteractions(state, data, run.player.canInteract);
  }
  if (state.scene !== SCENES.EXPEDITION) {
    return;
  }
  updateEffects(run, simDt, dt, data);
  syncCamera(run, data, dt);
  if (!run.faceOff?.active && run.faceOff?.acquireTargetId) {
    lockCameraToFaceOffTarget(run, data, dt, false);
  }

  if (run.hp <= 0) {
    applyFailure(state, data, "hp");
    return;
  }

  if (run.sanity <= 0) {
    applyFailure(state, data, "sanity");
    return;
  }

  const timePhaseLabel = getRunTimePhaseLabel(run);
  const phaseLabel = isMovementLab(data)
    ? `?ㅽ뿕 以?쨌 ${timePhaseLabel}.`
    : run.timePhase === "day"
      ? "???좎?."
      : run.timePhase === "dusk"
        ? "?⑺샎 ?뺣컯."
        : "?쇨컙 ?꾪삊.";
  const notice = run.noticeTimer > 0 ? ` ${run.message}` : "";
  setStatus(state, `${phaseLabel}${notice}`);
  updateAutoSave(state, data, dt);
}

function updateShelterLegacy(state) {
  setStatus(state, isMovementLab(state.data) ? "?쇰궃泥??湲? C: 異쒓꺽" : "?쇰궃泥??湲? C: 異쒓꺽");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    startNewSavedRun(state, state.data);
    setStatus(state, "異쒓꺽 以?");
  }
}

function updateShelter(state) {
  const menu = state.shelterMenu && typeof state.shelterMenu === "object"
    ? state.shelterMenu
    : {};
  menu.menuIndex = clamp(Math.floor(menu.menuIndex || 0), 0, SHELTER_HUB_MENU_ITEMS.length - 1);
  menu.upgradeIndex = clamp(Math.floor(menu.upgradeIndex || 0), 0, Math.max(0, SHELTER_UPGRADES.length - 1));
  state.shelterMenu = menu;

  if (consumeEitherPress(state, SHELTER_MENU_UP_KEYS)) {
    menu.menuIndex = (menu.menuIndex + SHELTER_HUB_MENU_ITEMS.length - 1) % SHELTER_HUB_MENU_ITEMS.length;
    setStatus(state, "?쇰궃泥?硫붾돱");
    return;
  }
  if (consumeEitherPress(state, SHELTER_MENU_DOWN_KEYS)) {
    menu.menuIndex = (menu.menuIndex + 1) % SHELTER_HUB_MENU_ITEMS.length;
    setStatus(state, "?쇰궃泥?硫붾돱");
    return;
  }

  const selectedMenuItem = SHELTER_HUB_MENU_ITEMS[menu.menuIndex] || "upgrade";
  if (selectedMenuItem === "upgrade") {
    if (consumeEitherPress(state, SHELTER_VIEW_LEFT_KEYS)) {
      menu.upgradeIndex = (menu.upgradeIndex + SHELTER_UPGRADES.length - 1) % SHELTER_UPGRADES.length;
      setStatus(state, "?낃렇?덉씠???좏깮");
      return;
    }
    if (consumeEitherPress(state, SHELTER_VIEW_RIGHT_KEYS)) {
      menu.upgradeIndex = (menu.upgradeIndex + 1) % SHELTER_UPGRADES.length;
      setStatus(state, "?낃렇?덉씠???좏깮");
      return;
    }
  }

  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    if (selectedMenuItem === "upgrade") {
      const upgrade = SHELTER_UPGRADES[menu.upgradeIndex] || SHELTER_UPGRADES[0];
      const level = getShelterUpgradeLevel(state.meta, upgrade.id);
      const cost = getShelterUpgradeCost(upgrade, level);
      if (cost === null) {
        setStatus(state, `${upgrade.label} 理쒕? ?④퀎`);
        return;
      }
      if ((state.meta.bankedMaterials || 0) < cost) {
        setStatus(state, `?먯옱 遺議? ${cost} ?꾩슂`);
        return;
      }
      state.meta.upgrades = normalizeMetaUpgrades(state.meta.upgrades);
      state.meta.bankedMaterials = Math.max(0, (state.meta.bankedMaterials || 0) - cost);
      state.meta.upgrades[upgrade.id] = level + 1;
      saveMetaState(state.meta);
      setStatus(state, `${upgrade.label} Lv.${level + 1} ?낃렇?덉씠???꾨즺`);
      return;
    }
    startNewSavedRun(state, state.data);
    setStatus(state, "출격 중");
    return;
  }

  const selectedUpgrade = SHELTER_UPGRADES[menu.upgradeIndex] || SHELTER_UPGRADES[0];
  const level = getShelterUpgradeLevel(state.meta, selectedUpgrade.id);
  const cost = getShelterUpgradeCost(selectedUpgrade, level);
  setStatus(state, selectedMenuItem === "upgrade"
    ? `${selectedUpgrade.label} Lv.${level}/${selectedUpgrade.maxLevel} · ${cost === null ? "최대" : `자재 ${cost}`}`
    : "출격 대기");
}

function ensureTitleMenuState(state, hasRun) {
  const titleMenu = state.titleMenu && typeof state.titleMenu === "object"
    ? state.titleMenu
    : {};
  if (titleMenu.lastHasRun !== hasRun) {
    titleMenu.menuIndex = hasRun ? 1 : 0;
    titleMenu.confirmingNewRun = false;
  } else {
    titleMenu.menuIndex = clamp(Math.floor(titleMenu.menuIndex || 0), 0, TITLE_MENU_ITEMS.length - 1);
    if (!hasRun) {
      titleMenu.menuIndex = 0;
      titleMenu.confirmingNewRun = false;
    }
  }
  titleMenu.lastHasRun = hasRun;
  state.titleMenu = titleMenu;
  return titleMenu;
}

function moveTitleMenu(titleMenu, hasRun, direction) {
  titleMenu.confirmingNewRun = false;
  if (!hasRun) {
    titleMenu.menuIndex = 0;
    return;
  }
  const count = TITLE_MENU_ITEMS.length;
  titleMenu.menuIndex = (Math.floor(titleMenu.menuIndex || 0) + direction + count) % count;
}

function enterTitleNewRun(state, hasRun) {
  if (hasRun) {
    clearSavedGame();
    state.save.hasRun = false;
    state.save.lastSavedAt = null;
  }
  state.titleMenu = {
    menuIndex: 0,
    confirmingNewRun: false,
    lastHasRun: false,
  };
  state.scene = SCENES.SHELTER;
  state.sceneTimer = 0;
  setStatus(state, "출격 준비");
}

function updateTitle(state) {
  if (shouldStartFromUrlLevel()) {
    startNewSavedRun(state, state.data, { clearSaved: false, persist: false });
    setStatus(state, "?삥뇣節뀐쉘 ?삠꺕");
    return;
  }

  state.save = state.save || {};
  const hasRun = hasSavedGame();
  state.save.hasRun = hasRun;
  const titleMenu = ensureTitleMenuState(state, hasRun);

  if (titleMenu.confirmingNewRun) {
    if (consumeEitherPress(state, TITLE_MENU_CANCEL_KEYS)) {
      titleMenu.confirmingNewRun = false;
      setStatus(state, "????痍⑥냼");
      return;
    }
    if (consumeEitherPress(state, TITLE_MENU_UP_KEYS) || consumeEitherPress(state, TITLE_MENU_DOWN_KEYS)) {
      titleMenu.confirmingNewRun = false;
      setStatus(state, "硫붿씤 硫붾돱");
      return;
    }
    if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
      enterTitleNewRun(state, hasRun);
      return;
    }
    setStatus(state, "湲곗〈 ?????젣 ?뺤씤: C/Z");
    return;
  }

  if (consumeEitherPress(state, TITLE_MENU_UP_KEYS)) {
    moveTitleMenu(titleMenu, hasRun, -1);
    setStatus(state, "硫붿씤 硫붾돱");
    return;
  }
  if (consumeEitherPress(state, TITLE_MENU_DOWN_KEYS)) {
    moveTitleMenu(titleMenu, hasRun, 1);
    setStatus(state, "硫붿씤 硫붾돱");
    return;
  }

  if (consumeEitherPress(state, NEW_RUN_KEYS)) {
    titleMenu.menuIndex = 0;
    if (hasRun) {
      titleMenu.confirmingNewRun = true;
      setStatus(state, "湲곗〈 ?????젣 ?뺤씤");
    } else {
      enterTitleNewRun(state, false);
    }
    return;
  }

  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    const selected = TITLE_MENU_ITEMS[clamp(Math.floor(titleMenu.menuIndex || 0), 0, TITLE_MENU_ITEMS.length - 1)];
    if (selected === "continue") {
      if (hasRun && restoreSavedGame(state, state.data)) {
        return;
      }
      state.save.hasRun = false;
      titleMenu.menuIndex = 0;
      titleMenu.lastHasRun = false;
      setStatus(state, "??λ맂 ???놁쓬");
      return;
    }
    if (hasRun) {
      titleMenu.confirmingNewRun = true;
      setStatus(state, "湲곗〈 ?????젣 ?뺤씤");
      return;
    }
    enterTitleNewRun(state, false);
    return;
  }

  setStatus(state, hasRun ? "W/S ?좏깮 쨌 C/Z ?ㅽ뻾" : "泥섏쓬遺??쨌 C/Z ?ㅽ뻾");
}

function updateResults(state) {
  setStatus(state, isMovementLab(state.data) ? "寃곌낵 ?붾㈃. C/Z" : "洹??寃곌낵. C/Z");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    state.scene = SCENES.SHELTER;
    state.sceneTimer = 0;
  }
}

function updateGameOver(state) {
  setStatus(state, isMovementLab(state.data) ? "?ㅽ뙣 ?붾㈃. C/Z" : "???ㅽ뙣. C/Z");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    state.scene = SCENES.SHELTER;
    state.sceneTimer = 0;
  }
}

export function bindInput(state) {
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Tab", "CapsLock", "Digit1", "Digit2", "Digit3", "Digit8", "NumpadMultiply", "KeyA", "KeyD", "KeyS", "KeyW", "KeyC", "KeyF", "KeyM", "KeyN", "KeyQ", "KeyR", "KeyX", "KeyZ", "KeyV", "ShiftLeft", "ShiftRight", "Escape", "F2", "F3", "F5", "KeyL", "Backquote"].includes(event.code)) {
      event.preventDefault();
    }
    if (!state.pressed.has(event.code)) {
      state.justPressed.add(event.code);
    }
    state.pressed.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    state.pressed.delete(event.code);
  });
}

export function updateGame(state, data, dt) {
  state.pulse += dt;
  state.sceneTimer += dt;

  if (consumeEitherPress(state, DEBUG_KEYS)) {
    state.debug.active = !state.debug.active;
  }

  if (
    (state.debug?.active || state.testDebug?.active)
    && consumeEitherPress(state, DEBUG_SET_NIGHT_KEYS)
    && setDebugNightPhase(state, data)
  ) {
    return;
  }

  if (
    consumeEitherPress(state, ["F2", "KeyL"])
    && state.scene === SCENES.EXPEDITION
    && isMovementLab(data)
    && state.run
  ) {
    state.liveEdit.active = !state.liveEdit.active;
    state.liveEdit.hoverPlatformIndex = null;
    state.liveEdit.drag = null;
    if (state.liveEdit.active) {
      state.run.player.vx = 0;
      state.run.player.vy = 0;
      state.run.player.attackWindow = 0;
      state.run.player.dashTimer = 0;
      state.run.player.dashWindupTimer = 0;
      state.run.player.lightActive = false;
    }
  }

  if (state.scene === SCENES.TITLE) {
    updateTitle(state);
  } else if (state.scene === SCENES.SHELTER) {
    updateShelter(state);
  } else if (state.scene === SCENES.EXPEDITION) {
    updateExpedition(state, data, dt);
  } else if (state.scene === SCENES.RESULTS) {
    updateResults(state);
  } else if (state.scene === SCENES.GAME_OVER) {
    updateGameOver(state);
  }

  if (state.mouse) {
    state.mouse.primaryJustPressed = false;
    state.mouse.secondaryJustPressed = false;
  }
  state.justPressed.clear();
}

export function hasThreatSense(state) {
  return hasUnlocked(state.meta, "threatSense");
}

