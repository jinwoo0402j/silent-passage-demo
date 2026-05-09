import {
  MOVEMENT_STATES,
  SCENES,
  computeArmWeaponStats,
  createLevelRuntimeState,
  createRunState,
  ensureWeaponLoadoutState,
  hasUnlocked,
  saveMetaState,
} from "./state.js?v=20260507-slope-slide-physics-v1";
import { getLevelIds, loadRuntimeLevelData } from "./level-store.js?v=20260507-slope-slide-physics-v1";
import {
  clearSavedGame,
  hasSavedGame,
  restoreSavedGame,
  saveCurrentGame,
  shouldStartFromUrlLevel,
  startNewSavedRun,
  updateAutoSave,
} from "./save-game.js?v=20260505-level-source-v2";
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
const JUMP_KEYS = ["KeyW"];
const DASH_KEYS = ["Space", "KeyX"];
const SPRINT_KEYS = ["Space"];
const BULLET_TIME_KEYS = [];
const AIM_CAMERA_EDGE_MARGIN = 112;
const FOCUS_MAX = 100;
const FOCUS_DRAIN_PER_SECOND = 36;
const FOCUS_RECOVER_PER_SECOND = 22;
const FOCUS_MIN_TO_START = 8;
const FOCUS_REENTRY_RATIO = 0.5;
const FOCUS_TIME_SCALE = 0.22;
const INTERACT_KEYS = ["KeyZ", "KeyE"];
const ATTACK_KEYS = ["KeyV", "KeyF"];
const CONFIRM_KEYS = ["KeyC", "Enter"];
const NEW_RUN_KEYS = ["KeyN"];
const LOOT_PREV_KEYS = ["ArrowUp", "KeyW"];
const LOOT_NEXT_KEYS = ["ArrowDown", "KeyS"];
const LOOT_LEFT_KEYS = ["ArrowLeft", "KeyA"];
const LOOT_RIGHT_KEYS = ["ArrowRight", "KeyD"];
const LOOT_CLOSE_KEYS = ["Escape", "KeyQ"];
const DEBUG_KEYS = ["F3", "Backquote"];
const RESTART_KEYS = ["F5"];
const ARM_LEFT_KEYS = ["Digit1"];
const ARM_RIGHT_KEYS = ["Digit2"];
const ARM_SWITCH_KEYS = ["ShiftLeft", "ShiftRight"];
const RELOAD_KEYS = ["KeyR"];
const MAP_KEYS = ["KeyM"];
const MAP_CLOSE_KEYS = ["Escape", "KeyM"];
const MAP_EXPLORE_CELL_SIZE = 320;
const MAP_EXPLORE_RADIUS_CELLS = 1;
const FACE_OFF_ENTRY_KEYS = ["KeyE"];
const FACE_OFF_DIALOGUE_KEYS = ["KeyW", "KeyA", "KeyD"];
const FACE_OFF_CANCEL_KEYS = ["Escape"];
const FACE_OFF_RELEASE_KEY = "KeyQ";
const HUMANOID_RESOLVED_STATES = new Set(["disabled", "surrendered", "dealt", "released", "escaped", "dead"]);
const HUMANOID_RESOLVED_OUTCOMES = new Set(["kill", "disable", "surrender", "deal", "release", "escape"]);
const LOW_PERFORMANCE_MODE = typeof window !== "undefined"
  && (
    window.__SILENT_PASSAGE_PERF === "lite" ||
    new URLSearchParams(window.location.search).get("perf") === "lite"
  );
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
    || run?.loot?.active;
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
  return (block?.hiddenTimer ?? 0) > 0;
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

function getSlopeSurfaceY(platform, worldX) {
  const t = clamp((worldX - platform.x) / Math.max(1, platform.width), 0, 1);
  return platform.slopeDirection === "up-right"
    ? platform.y + platform.height * (1 - t)
    : platform.y + platform.height * t;
}

function getSlopeDownhillDirection(platform) {
  return platform.slopeDirection === "up-right" ? -1 : 1;
}

function isSlopePlatformSeamPassThrough(player, platform, data, side, config) {
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

  for (const slope of getSlopePlatforms(data)) {
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
  return (data.platforms || []).filter((platform) => !isSlopePlatform(platform));
}

function getCollisionPlatforms(data, run = null) {
  const solids = getSolidLevelPlatforms(data);
  if (!run) {
    return solids;
  }
  return [...solids, ...getDynamicCollisionSolids(run)];
}

function collidesWithPlatforms(rect, data, run = null) {
  return getCollisionPlatforms(data, run).some((platform) => rectsOverlap(rect, platform));
}

function getPlayerSlopeProbeXs(player) {
  const centerX = player.x + player.width * 0.5;
  const direction = Math.sign(player.vx || player.facing || 1);
  const probeOffset = player.width * 0.36;
  const leadingX = clamp(centerX + direction * probeOffset, player.x + 2, player.x + player.width - 2);
  const trailingX = clamp(centerX - direction * probeOffset, player.x + 2, player.x + player.width - 2);
  return [leadingX, centerX, trailingX];
}

function canOccupyRect(rect, data, run = null) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= data.world.width &&
    rect.y + rect.height <= data.world.height &&
    !collidesWithPlatforms(rect, data, run)
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

function tryJumpCornerCorrection(player, data, config, run = null) {
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

      if (canOccupyRect(candidate, data, run)) {
        player.x = candidate.x;
        return true;
      }
    }
  }

  return false;
}

function tryDashCornerCorrection(player, data, resolvedX, direction, config, run = null) {
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
      if (canOccupyRect(candidate, data, run)) {
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

  const previousX = player.x;
  player.x += player.vx * dt;
  let slopeSeamPlatform = null;

  for (const platform of getCollisionPlatforms(data, run)) {
    if (!rectsOverlap(player, platform)) {
      continue;
    }

    if (previousX + player.width <= platform.x + EPSILON) {
      if (isSlopePlatformSeamPassThrough(player, platform, data, "left", config)) {
        slopeSeamPlatform = platform;
        continue;
      }
      const resolvedX = platform.x - player.width;
      if (
        player.dashTimer > 0 &&
        tryDashCornerCorrection(player, data, resolvedX, 1, config, run)
      ) {
        contacts.dashCornerCorrected = true;
        continue;
      }
      contacts.dashBlocked = true;
      player.x = resolvedX;
      contacts.wallRight = true;
      contacts.wallEntityId = platform.dynamicEntityId ?? null;
    } else if (previousX >= platform.x + platform.width - EPSILON) {
      if (isSlopePlatformSeamPassThrough(player, platform, data, "right", config)) {
        slopeSeamPlatform = platform;
        continue;
      }
      const resolvedX = platform.x + platform.width;
      if (
        player.dashTimer > 0 &&
        tryDashCornerCorrection(player, data, resolvedX, -1, config, run)
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
        if (isSlopePlatformSeamPassThrough(player, platform, data, "left", config)) {
          slopeSeamPlatform = platform;
          continue;
        }
        const resolvedX = player.x - pushLeft;
        if (
          player.dashTimer > 0 &&
          tryDashCornerCorrection(player, data, resolvedX, 1, config, run)
        ) {
          contacts.dashCornerCorrected = true;
          continue;
        }
        contacts.dashBlocked = true;
        player.x -= pushLeft;
        contacts.wallRight = true;
        contacts.wallEntityId = platform.dynamicEntityId ?? null;
      } else {
        if (isSlopePlatformSeamPassThrough(player, platform, data, "right", config)) {
          slopeSeamPlatform = platform;
          continue;
        }
        const resolvedX = player.x + pushRight;
        if (
          player.dashTimer > 0 &&
          tryDashCornerCorrection(player, data, resolvedX, -1, config, run)
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

  for (const platform of getCollisionPlatforms(data, run)) {
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
      if (player.vy < 0 && tryJumpCornerCorrection(player, data, config, run)) {
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
        if (player.vy < 0 && tryJumpCornerCorrection(player, data, config, run)) {
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

    for (const platform of getSlopePlatforms(data)) {
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
  run.hp = clamp(run.hp - amount, 0, 100);
  run.player.invulnTimer = 0.85;
  run.player.vx = direction * 190;
  run.player.vy = -260;
  pushNotice(run, sourceText);
  spawnParticles(run, run.player.x + run.player.width / 2, run.player.y + 20, 8, "#ffad8f");
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
  playFaceOffShotSound();
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
  setFaceOffEnemyLine(
    run,
    data,
    "knockdown",
    "knockdown",
    "살려줘... 반격할 힘도 없어.",
  );
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
  run.faceOff.choiceRevealTimer = 0;
  run.faceOff.choiceRevealProgress = 0;
  run.faceOff.choicesReady = false;
  run.faceOff.shotShakeTimer = 0;
  run.faceOff.shotFlashTimer = 0;
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
  const weaponContext = getSelectedArmContext(run, data);
  if ((weaponContext.arm.reloadTimer ?? 0) > 0) {
    faceOff.message = `${weaponContext.stats.label}: reloading`;
    return;
  }
  if ((weaponContext.arm.magazine ?? 0) <= 0) {
    faceOff.message = `${weaponContext.stats.label}: empty`;
    setFaceOffEnemyLine(run, data, "knockdown", "failed", "총도 비었네.");
    return;
  }

  const parts = getFaceOffBodyParts(data);
  const part = parts.find((entry) => entry.id === faceOff.selectedPart) || parts.find((entry) => entry.id === "torso");
  if (!part) {
    return;
  }

  weaponContext.arm.magazine = Math.max(0, Math.floor(weaponContext.arm.magazine ?? 0) - 1);
  weaponContext.arm.fireCooldownTimer = weaponContext.stats.fireCooldown;
  run.player.recoilShotCooldownTimer = weaponContext.arm.fireCooldownTimer;

  const weaponDamageScale = weaponContext.stats.type === "shotgun" ? 1 : 0.58;
  const partDamage = Math.max(0, Number(part.damage ?? 0)) * weaponDamageScale;
  const lethalPart = part.id === "head" || (part.id === "torso" && weaponContext.stats.type === "shotgun") || partDamage >= 50;
  enemy.disableMeter = Math.max(0, (enemy.disableMeter ?? 0) + (part.disable ?? 0) * Math.max(0.25, weaponContext.stats.knockdownPower ?? 1));
  enemy.hitFlash = 0.18;
  enemy.staggerTimer = enemy.knockdownStaggerDuration ?? 0.45;
  triggerFaceOffShotFeedback(run, data);
  setFaceOffEnemyLine(run, data, "knockdown", "hit", "윽...!");
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
  faceOff.message = `${part.label}: hit`;
}

function applyFaceOffDialogue(run, data, enemy, option) {
  const faceOff = run.faceOff;
  const chance = getDialogueChance(enemy, option);
  faceOff.selectedDialogueKey = option.key;
  setFaceOffEnemyLine(run, data, "dialogue", "dialogue", "말로 끝내고 싶다면 빨리 말해.");

  if (Math.random() <= chance) {
    if (option.successEffect === "dealProgress") {
      enemy.dialogueStage = (enemy.dialogueStage ?? 0) + 1;
      if (enemy.dialogueStage >= 2) {
        setFaceOffEnemyLine(run, data, "dialogue", "persuadeDeal", "좋아. 루트 하나는 알려주지.");
        finishFaceOff(run, enemy, "deal", "deal");
      } else {
        setFaceOffEnemyLine(run, data, "dialogue", "persuadeLead", "정보? 네가 뭘 줄 수 있는데?");
        faceOff.message = "deal lead";
      }
      return;
    }
    if (option.type === "threaten") {
      setFaceOffEnemyLine(run, data, "dialogue", "threatenSuccess", "알았어. 총 내려놓을게.");
    } else if (option.type === "deescalate") {
      setFaceOffEnemyLine(run, data, "dialogue", "deescalateSuccess", "좋아... 잠깐 멈추지.");
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
    setFaceOffEnemyLine(run, data, "dialogue", "threatenFail", "그 협박은 안 통해.");
  } else if (option.type === "deescalate") {
    setFaceOffEnemyLine(run, data, "dialogue", "deescalateFail", "멈추는 건 네 쪽이야.");
  } else {
    setFaceOffEnemyLine(run, data, "dialogue", "persuadeFail", "친구 같은 소리 하지 마.");
  }
  faceOff.message = "dialogue failed";
}

function failFaceOff(run, data, enemy) {
  if (!enemy || !run.faceOff) {
    return;
  }
  setFaceOffEnemyLine(run, data, "knockdown", "failed", "놓치면 기어서라도 도망칠 거야.");
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
  updateFaceOffCursorAssist(state, faceOff, dt);
  faceOff.aimX = state.mouse?.screenX ?? CAMERA_SCREEN_WIDTH / 2;
  faceOff.aimY = state.mouse?.screenY ?? CAMERA_SCREEN_HEIGHT / 2;

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

  if (faceOff.result) {
    faceOff.resultTimer = Math.max(0, faceOff.resultTimer - dt);
    if (faceOff.resultTimer === 0) {
      closeFaceOff(run, faceOff.result);
    }
    return true;
  }

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

  if (!faceOff.choicesReady) {
    const pressedDialogueKey = FACE_OFF_DIALOGUE_KEYS.find((key) => consumePress(state, key));
    if (pressedDialogueKey) {
      revealFaceOffChoicesNow(faceOff);
      const option = getFaceOffDialogueOptions(data).find((entry) => entry.key === pressedDialogueKey);
      if (option) {
        applyFaceOffDialogue(run, data, enemy, option);
      }
    }
  } else {
    for (const key of FACE_OFF_DIALOGUE_KEYS) {
      if (consumePress(state, key)) {
        const option = getFaceOffDialogueOptions(data).find((entry) => entry.key === key);
        if (option) {
          applyFaceOffDialogue(run, data, enemy, option);
        }
      }
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
    return;
  }
  weapons.selectedSide = nextSide;
  const context = getSelectedArmContext(run, data);
  pushNotice(run, `${context.side === "left" ? "Left" : "Right"} arm: ${context.stats.label}`, 1.35);
}

function switchSelectedArm(run, data) {
  const weapons = ensureWeaponLoadoutState(run, data);
  setSelectedArm(run, data, weapons.selectedSide === "right" ? "left" : "right");
}

function getReserveAmmo(context) {
  return Math.max(0, Math.floor(Number(context.weapons.reserveAmmo?.[context.stats.ammoType] ?? 0)));
}

function isAutomaticWeaponContext(context) {
  return context?.stats?.fireMode === "auto";
}

function isSelectedWeaponAutomatic(run, data) {
  return isAutomaticWeaponContext(getSelectedArmContext(run, data));
}

function canAimWeapon(player) {
  return Boolean(player.height === player.standHeight && player.dashTimer === 0);
}

function canFireWeaponPose(player) {
  return Boolean(
    player.dashTimer === 0 &&
    (
      player.height === player.standHeight ||
      (player.onGround && player.slideTimer > 0)
    )
  );
}

function canFireSelectedWeapon(run, data, player) {
  if (!canFireWeaponPose(player)) {
    return false;
  }
  const context = getSelectedArmContext(run, data);
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
  const context = getSelectedArmContext(run, data);
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

  context.arm.reloadTimer = context.stats.reloadDuration;
  context.arm.reloadDuration = context.stats.reloadDuration;
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
  if (consumeEitherPress(state, ARM_SWITCH_KEYS)) {
    switchSelectedArm(run, data);
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

  for (const platform of data.platforms || []) {
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
    block.hiddenTimer = Math.max(0.1, block.hideDuration ?? 1.6);
    block.hitFlash = 0.18;
    spawnDamageNumber(run, hitX, hitY - 12, 0, "#93eaff", "OPEN");
    spawnDirectedParticles(run, hitX, hitY, 16, "#93eaff", -bullet.dirX, -bullet.dirY, 420, 0.82);
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
  const spreadMultiplier = (aimed ? 0.65 : 2.65) * (run.focusActive ? 0.75 : 1);
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
  context.arm.fireCooldownTimer = context.stats.fireCooldown;
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
  player.dashTimer = config.dashDurationMs / 1000;
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
  pushNotice(run, "벽 고정");
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
  pushNotice(run, "벽 런 발사");
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
  pushNotice(run, "벽 반동");
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
  const config = getMovementConfig(data);
  const attackPressed = Boolean(input?.attackPressed);
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

  player.dashInvulnerable = config.dashInvulnerable;
  player.slideInvulnerable = config.slideInvulnerable ?? true;
  player.wasOnGround = player.onGround;
  player.crouchRequested = crouchHeld;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attackWindow = Math.max(0, player.attackWindow - dt);
  player.invulnTimer = Math.max(0, player.invulnTimer - dt);
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
  const preserveAirSprint =
    sprintHeld &&
    player.sprintPrimed &&
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
    player.wallJumpLockTimer === 0 &&
    !player.braceHolding;

  if (
    dashPressed &&
    !wantsWallRun &&
    player.dashAvailable &&
    player.dashTimer === 0 &&
    player.dashCooldownTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    player.height === player.standHeight
  ) {
    const direction = moveAxis || player.facing;
    if (direction !== 0) {
      startDash(player, run, config, direction);
    }
  }

  if (player.lightActive && player.dashTimer > 0) {
    player.lightActive = false;
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

    player.vx = approach(player.vx, targetSpeed, (moveAxis !== 0 ? accel : decel) * dt);

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

  if (player.sprintCharge > 0.12 && canBuildSprint) {
    player.sprintActive = true;
  }

  player.lightActive = isPressed(state, "KeyQ") && run.battery > 0 && player.dashTimer === 0;
  if (player.lightActive) {
    run.battery = Math.max(0, run.battery - data.player.lightDrainPerSecond * dt);
    if (run.battery === 0) {
      player.lightActive = false;
      pushNotice(run, "배터리 소진.");
    }
  }

  if (attackPressed && player.attackCooldown === 0 && player.height === player.standHeight) {
    player.attackCooldown = data.player.attackCooldown;
    player.attackWindow = 0.12;
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
      pushNotice(run, "황혼 진입.");
      pushClue(run, "phase-dusk", "빛이 약해진다. Q는 시야만 보조한다.");
    } else if (run.timePhase === "night") {
      run.nightActive = true;
      pushNotice(run, "야간 위협 활성.");
      pushClue(run, "phase-night", "밤엔 귀환 비용이 커진다.");
    }
  }

  run.sanity = clamp(
    run.sanity - data.world.sanityDrain[run.timePhase] * dt,
    0,
    data.player.maxSanity
  );
}

function getAttackRect(player) {
  const width = 76;
  return createRect(
    player.facing === 1 ? player.x + player.width - 4 : player.x - width + 4,
    player.y + 10,
    width,
    player.height - 12
  );
}

function resolveHarvest(run, encounter, abilityId = "threatSense") {
  if (encounter.outcome) {
    return;
  }
  encounter.outcome = "harvested";
  encounter.state = "dead";
  run.materials += encounter.harvestReward;
  run.sanity = clamp(run.sanity - encounter.harvestSanityCost, 0, 100);
  uniquePush(run.pendingUnlocks, abilityId);
  uniquePush(run.successfulHarvestIds, encounter.id);
  pushNotice(run, `${encounter.label} 수확.`);
  spawnParticles(run, encounter.x + encounter.width / 2, encounter.y + 24, 16, "#ff8e72");
}

function resolveRelease(run, encounter) {
  if (encounter.outcome) {
    return;
  }
  encounter.outcome = "released";
  encounter.state = "released";
  run.sanity = clamp(run.sanity + encounter.releaseSanity, 0, 100);
  uniquePush(run.pendingStoryFlags, encounter.storyFlag);
  uniquePush(run.successfulReleaseIds, encounter.id);
  pushNotice(run, `${encounter.label} 구원.`);
  spawnParticles(run, encounter.x + encounter.width / 2, encounter.y + 16, 16, "#a8f7cf");
}

function updateAttackHits(run) {
  if (run.player.attackWindow <= 0) {
    return;
  }

  const attackRect = getAttackRect(run.player);
  const liveTargets = [
    run.encounters.guard,
    run.encounters.ritualist,
    ...run.threats,
    ...(run.hostileDrones || []),
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
    target.hp = Math.max(0, target.hp - run.player.attackDamage);
    target.hitFlash = 0.14;
    spawnParticles(run, target.x + target.width / 2, target.y + 22, 6, "#ffd6ba");

    if (target.type === "guard" && target.state !== "dead" && target.state !== "released") {
      target.state = "chase";
      target.wasProvoked = true;
      pushNotice(run, "검문 절차가 깨졌다.");
    }

    if (target.type === "ritualist" && target.state !== "dead" && target.state !== "released") {
      target.state = "hostile";
      target.wasProvoked = true;
      pushNotice(run, "의식이 너를 향한다.");
    }

    if (target.id.startsWith("shade")) {
      target.active = true;
    }

    if (target.hp === 0) {
      if (target.type === "hostileDrone") {
        destroyHostileDrone(run, target);
      } else if (target.type === "guard" || target.type === "ritualist") {
        resolveHarvest(run, target);
      } else {
        target.dead = true;
        spawnParticles(run, target.x + target.width / 2, target.y + 16, 12, "#9dd8ff");
      }
    }
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
      pushNotice(run, "정지 경고.");
    }
  } else if (guard.state === "warn") {
    guard.facing = playerCenter.x >= guardCenter.x ? 1 : -1;
    guard.warningTimer = Math.max(0, guard.warningTimer - dt);

    if (canInspect) {
      guard.state = "inspect";
      guard.inspectProgress = 0;
      pushClue(run, "guard-still", guard.clues.still);
      pushNotice(run, "정지 유지.");
    } else if (guard.warningTimer === 0) {
      if (inDetection && (isMoving || player.lightActive)) {
        guard.state = "chase";
        guard.wasProvoked = true;
        pushNotice(run, "감시자가 추적한다.");
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
      pushNotice(run, "증표 확인. 움직이지 마.");
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
      damagePlayer(run, guard.damage, direction, "감시자 근접 타격.");
    }
  } else if (guard.state === "inspect") {
    guard.facing = playerCenter.x >= guardCenter.x ? 1 : -1;
    if (!canInspect) {
      guard.state = "warn";
      guard.warningTimer = 0.45;
      guard.inspectProgress = 0;
      pushNotice(run, "검문 중단. 다시 멈춰라.");
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
    pushNotice(run, "의식이 깨졌다. 잠시 물러서라.");
    return;
  }

  const expectedId = ritualist.correctOrder[ritualist.sequenceProgress];
  if (pedestal.id !== expectedId) {
    upsetRitual(
      run,
      ritualist,
      "ritual-wrong",
      ritualist.clues.wrong,
      "순서 오류. 의식이 뒤집힌다."
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

  pushNotice(run, `${pedestal.label} 반응.`);
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
        "빛에 의식이 깨졌다."
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
      damagePlayer(run, ritualist.damage, direction, "의식자 타격.");
    }

    if (canSeePlayer && (inArea || distance < 360)) {
      ritualist.calmTimer = 0;
    } else {
      ritualist.calmTimer += dt;
      if (ritualist.calmTimer > 4) {
        ritualist.state = "ritual";
        ritualist.calmTimer = 0;
        resetRitualPedestals(ritualist);
        pushNotice(run, "의식이 다시 고요해진다.");
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
        damagePlayer(run, threat.damage, direction, "어둠 속 위협이 덮친다.");
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
  for (const platform of data.platforms || []) {
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

function openLootCrate(run, crate) {
  if (!crate || crate.searched) {
    return;
  }
  const selectedIndex = findNextLootIndex(crate, 0, 1);
  crate.opened = true;
  crate.scanComplete = crate.scanComplete || crate.items.every((item) => item.revealed || item.looted);
  run.loot.active = true;
  run.loot.crateId = crate.id;
  run.loot.selectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
  run.loot.holdItemId = null;
  run.loot.holdProgress = 0;
  run.loot.lastRarity = null;
  pushNotice(run, `${crate.label} 개봉.`);
  spawnParticles(run, crate.x + crate.width / 2, crate.y + 8, 8, "#93eaff");
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
    pushNotice(run, "가방 공간 부족.");
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
    pushNotice(run, `${item.name} 확보. 희귀 반응 감지.`);
    spawnParticles(run, crate.x + crate.width / 2, crate.y + crate.height / 2, 18, "#87e1ff");
    spawnParticles(run, crate.x + crate.width / 2, crate.y + crate.height / 2, 8, "#f6e98a");
  } else {
    pushNotice(run, `${item.name} 확보.`);
    spawnParticles(run, crate.x + crate.width / 2, crate.y + crate.height / 2, 10, "#93eaff");
  }

  crate.searched = crate.items.every((entry) => entry.looted);
  if (crate.searched) {
    pushNotice(run, `${crate.label} 수색 완료.`);
  }
  return true;
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
      text: "E: Face-off",
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
        text: gate.prompt,
        x: gate.x + gate.width / 2,
        y: gate.y - 12,
      });
    }
  }

  for (const routeExit of data.routeExits || []) {
    const exitRect = createRect(routeExit.x, routeExit.y, routeExit.width, routeExit.height);
    if (distanceBetween(playerCenter, getCenter(exitRect)) < 118) {
      discoverRouteExit(run, data, routeExit);
      targets.push({
        id: routeExit.id,
        kind: "routeExit",
        routeExit,
        text: routeExit.prompt || "E: 다음 구역",
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
        text: zipLine.prompt || "E: Zipline",
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
        text: item.prompt,
        x: item.x + item.width / 2,
        y: item.y - 10,
      });
    }
  }

  for (const crate of run.lootCrates || []) {
    if (crate.searched) {
      continue;
    }
    if (distanceBetween(playerCenter, getCenter(crate)) < 104) {
      targets.push({
        id: crate.id,
        kind: "lootCrate",
        crate,
        text: crate.opened ? "E: 상자 확인" : crate.prompt,
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
          text: `E: ${pedestal.label}`,
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

function getEncounterOutcome(encounter) {
  if (isEntityDisabled(encounter)) {
    return "ignored";
  }
  if (encounter.outcome) {
    return encounter.outcome;
  }
  return encounter.wasProvoked ? "failed" : "ignored";
}

function applyExtraction(state, data) {
  const run = state.run;
  if (isMovementLab(data)) {
    state.resultSummary = {
      success: true,
      labSession: true,
      materials: run.materials,
      timePhase: run.timePhase,
    };
    clearSavedGame();
    state.run = null;
    state.scene = SCENES.RESULTS;
    state.sceneTimer = 0;
    setStatus(state, "실험 종료. C");
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

  state.meta = {
    ...state.meta,
    trust: state.meta.trust + trustDelta,
    bankedMaterials: state.meta.bankedMaterials + run.materials,
    unlockedAbilities: [...state.meta.unlockedAbilities, ...newUnlocks],
    storyFlags: [...state.meta.storyFlags, ...newStories],
    completedRuns: state.meta.completedRuns + 1,
    lastOutcome: {
      outcomes,
      trustDelta,
      materials: run.materials,
      nightReached: run.nightActive,
    },
  };
  saveMetaState(state.meta);
  clearSavedGame();

  state.resultSummary = {
    success: true,
    outcomes,
    trustDelta,
    materials: run.materials,
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
  setStatus(state, "귀환 완료. C");
}

function applyFailure(state, data, reason) {
  if (isMovementLab(data)) {
    state.resultSummary = {
      success: false,
      labSession: true,
      reason,
      lostMaterials: 0,
    };
    clearSavedGame();
    state.run = null;
    state.scene = SCENES.GAME_OVER;
    state.sceneTimer = 0;
    setStatus(state, "실험 리셋. C");
    return;
  }

  state.resultSummary = {
    success: false,
    reason,
    lostMaterials: state.run.materials,
  };
  clearSavedGame();
  state.run = null;
  state.scene = SCENES.GAME_OVER;
  state.sceneTimer = 0;
  setStatus(state, "런 실패. C");
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
  setStatus(state, "스폰으로 복귀.");
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
  player.attackHits = new Set();
  player.lightActive = false;
  player.dashTimer = 0;
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
  run.attackFx = [];
  run.recoilFx = [];
  run.weaponMissiles = [];
  run.weaponBarriers = [];
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

function transitionToRouteExit(state, data, routeExit) {
  const run = state.run;
  if (!run || !routeExit?.toLevelId) {
    return;
  }

  if (!getLevelIds(data.__baseData || data).includes(routeExit.toLevelId)) {
    run.message = `Route target not found: ${routeExit.toLevelId}`;
    run.noticeTimer = 2.6;
    setStatus(state, run.message);
    return;
  }

  discoverRouteExit(run, data, routeExit);
  const fromLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId || "movement-lab-01";
  run.levelStates = run.levelStates || {};
  run.levelStates[fromLevelId] = captureLevelRuntimeState(run);

  loadRuntimeLevelData(data, routeExit.toLevelId);
  const targetLevelId = data.currentLevelId || routeExit.toLevelId;
  const savedState = run.levelStates[targetLevelId] || null;
  run.currentLevelId = targetLevelId;
  visitLevel(run, data, targetLevelId);

  installLevelRuntimeState(run, data, savedState);
  resetPlayerForLevelTransition(run, data, routeExit.toEntranceId || "start");
  clearLevelTransitionEffects(run);
  snapCameraToPlayer(run, data);
  updateMapExploration(run, data);

  run.message = `${data.levelLabel || targetLevelId} 진입.`;
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

function updateInteractions(state, data, canInteract) {
  const run = state.run;
  run.prompt = "";
  run.promptWorld = null;

  const player = run.player;
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
    run.prompt = "정지 유지";
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
    player.dashTimer === 0
  ) {
    run.prompt = "C: 벽 짚기";
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
    pushNotice(run, "통행 배지 확보.");
    spawnParticles(run, item.x + item.width / 2, item.y + 12, 12, "#f4dda6");
    return;
  }

  if (item.kind === "salvage") {
    run.materials += item.materials;
    pushClue(run, item.id, item.clue);
    pushNotice(run, `${item.materials} 자재 확보.`);
    spawnParticles(run, item.x + item.width / 2, item.y + 12, 10, "#8fe1ff");
  }
}

function updateExpedition(state, data, dt) {
  const run = state.run;
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
      ? "라이브 편집 · 저장됨 · F2/L 종료"
      : "라이브 편집 · 블록 드래그 · F2/L 종료");
    return;
  }

  updateMapExploration(run, data);

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
  if (lootWasActive) {
    if (run.recoilAim) {
      run.recoilAim.active = false;
      run.recoilAim.aiming = false;
    }
    run.player.recoilFocusActive = false;
  } else {
    updateRecoilAim(run, data, state, dt);
  }
  const selectedWeaponAutomatic = !lootWasActive && isSelectedWeaponAutomatic(run, data);
  const heldAutoFire = selectedWeaponAutomatic
    && Boolean(state.mouse?.primaryDown)
    && canFireWeaponPose(run.player);
  const queuedRecoilShotPressed = !lootWasActive && (Boolean(state.mouse?.primaryJustPressed) || heldAutoFire);
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
    (run.faceOff?.active || !lootWasActive) &&
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
    updatePlayer(run, data, state, simDt, {
      attackPressed,
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
  updateAttackHits(run);
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

  const phaseLabel = isMovementLab(data)
    ? "실험 중."
    : run.timePhase === "day"
      ? "낮 유지."
      : run.timePhase === "dusk"
        ? "황혼 압박."
        : "야간 위협.";
  const notice = run.noticeTimer > 0 ? ` ${run.message}` : "";
  setStatus(state, `${phaseLabel}${notice}`);
  updateAutoSave(state, data, dt);
}

function updateShelter(state) {
  setStatus(state, isMovementLab(state.data) ? "대기 중. C: 출격" : "쉘터 대기. C: 출격");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    startNewSavedRun(state, state.data);
    setStatus(state, "출격 중.");
  }
}

function updateTitle(state) {
  if (shouldStartFromUrlLevel()) {
    startNewSavedRun(state, state.data, { clearSaved: false, persist: false });
    setStatus(state, "・懋ｲｩ ・・");
    return;
  }

  state.save = state.save || {};
  state.save.hasRun = hasSavedGame();
  if (state.save.hasRun && consumeEitherPress(state, NEW_RUN_KEYS)) {
    clearSavedGame();
    state.save.hasRun = false;
    state.scene = SCENES.SHELTER;
    state.sceneTimer = 0;
    setStatus(state, "새 런 준비");
    return;
  }
  if (state.save.hasRun && (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS))) {
    restoreSavedGame(state, state.data);
    return;
  }
  if (state.save.hasRun) {
    setStatus(state, "C: 이어하기 / N: 새 런");
    return;
  }
  setStatus(state, isMovementLab(state.data) ? "C: 입장" : "C: 쉘터");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    state.scene = SCENES.SHELTER;
    state.sceneTimer = 0;
    setStatus(state, "연결 완료.");
  }
}

function updateResults(state) {
  setStatus(state, isMovementLab(state.data) ? "결과 화면. C" : "귀환 결과. C");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    state.scene = SCENES.SHELTER;
    state.sceneTimer = 0;
  }
}

function updateGameOver(state) {
  setStatus(state, isMovementLab(state.data) ? "실패 화면. C" : "런 실패. C");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    state.scene = SCENES.SHELTER;
    state.sceneTimer = 0;
  }
}

export function bindInput(state) {
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Digit1", "Digit2", "Digit8", "NumpadMultiply", "KeyA", "KeyD", "KeyW", "KeyC", "KeyE", "KeyM", "KeyN", "KeyQ", "KeyR", "KeyX", "KeyZ", "KeyV", "ShiftLeft", "ShiftRight", "Escape", "F2", "F3", "F5", "KeyL", "Backquote"].includes(event.code)) {
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
