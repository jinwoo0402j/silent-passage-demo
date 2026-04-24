import { deepClone } from "./utils.js";

export const SCENES = {
  TITLE: "title",
  SHELTER: "shelter",
  EXPEDITION: "expedition",
  RESULTS: "results",
  GAME_OVER: "gameOver",
};

export const MOVEMENT_STATES = {
  GROUNDED: "grounded",
  JUMP_RISE: "jump_rise",
  FALL: "fall",
  DASH: "dash",
  CROUCH: "crouch",
  CROUCH_WALK: "crouch_walk",
  WALL_SLIDE: "wall_slide",
  WALL_JUMP_LOCK: "wall_jump_lock",
};

const SAVE_KEY = "rulebound-extraction-meta-v1";
const CAMERA_SCREEN_WIDTH = 1280;
const CAMERA_SCREEN_HEIGHT = 720;
const CAMERA_FOCUS_X = 420 / CAMERA_SCREEN_WIDTH;
const CAMERA_FOCUS_Y = 360 / CAMERA_SCREEN_HEIGHT;

const DEFAULT_META = {
  trust: 0,
  bankedMaterials: 0,
  unlockedAbilities: [],
  storyFlags: [],
  lastOutcome: null,
  completedRuns: 0,
};

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getCameraConfig(data) {
  return data.world.camera || {};
}

function createGuardState(definition) {
  return {
    ...deepClone(definition),
    hp: definition.maxHp,
    state: definition.disabled ? "disabled" : "patrol",
    facing: 1,
    patrolDirection: 1,
    warningTimer: 0,
    searchTimer: 0,
    attackCooldown: 0,
    inspectProgress: 0,
    calmTimer: 0,
    outcome: null,
    wasProvoked: false,
    cluesSeen: [],
    hitFlash: 0,
  };
}

function createRitualistState(definition) {
  return {
    ...deepClone(definition),
    hp: definition.maxHp,
    state: definition.disabled ? "disabled" : "ritual",
    facing: -1,
    patrolIndex: 0,
    attackCooldown: 0,
    calmTimer: 0,
    sequenceProgress: 0,
    pedestals: definition.pedestals.map((pedestal) => ({
      ...deepClone(pedestal),
      active: false,
    })),
    outcome: null,
    wasProvoked: false,
    cluesSeen: [],
    hitFlash: 0,
  };
}

function createThreatState(definition) {
  return {
    ...deepClone(definition),
    hp: definition.maxHp,
    active: false,
    dead: Boolean(definition.disabled),
    patrolDirection: 1,
    facing: -1,
    attackCooldown: 0,
    hitFlash: 0,
  };
}

export function loadMetaState() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return deepClone(DEFAULT_META);
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return deepClone(DEFAULT_META);
    }
    return {
      trust: Number.isFinite(parsed.trust) ? parsed.trust : DEFAULT_META.trust,
      bankedMaterials: Number.isFinite(parsed.bankedMaterials) ? parsed.bankedMaterials : DEFAULT_META.bankedMaterials,
      unlockedAbilities: Array.isArray(parsed.unlockedAbilities) ? parsed.unlockedAbilities.map(String) : [],
      storyFlags: Array.isArray(parsed.storyFlags) ? parsed.storyFlags.map(String) : [],
      lastOutcome: parsed.lastOutcome || null,
      completedRuns: Number.isFinite(parsed.completedRuns) ? parsed.completedRuns : 0,
    };
  } catch {
    return deepClone(DEFAULT_META);
  }
}

export function saveMetaState(meta) {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
}

export function hasUnlocked(meta, abilityId) {
  return meta.unlockedAbilities.includes(abilityId);
}

export function createRunState(data, meta) {
  const movement = data.player.movement;
  const maxDashCount = Math.max(1, Math.floor(movement.maxDashCount ?? 1));
  const player = {
    x: data.player.spawn.x,
    y: data.player.spawn.y,
    width: data.player.size.width,
    height: data.player.size.height,
    standHeight: data.player.size.height,
    crouchHeight: movement.crouchHeight,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    wasOnGround: true,
    movementState: MOVEMENT_STATES.GROUNDED,
    attackCooldown: 0,
    attackWindow: 0,
    attackHits: new Set(),
    attackDamage: data.player.attackDamage,
    lightActive: false,
    invulnTimer: 0,
    coyoteTimer: movement.coyoteTimeMs / 1000,
    jumpBufferTimer: 0,
    jumpHeldLastFrame: false,
    dashAvailable: true,
    dashMaxCount: maxDashCount,
    dashCharges: maxDashCount,
    dashInvulnerable: movement.dashInvulnerable,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashDirection: 0,
    dashCarryTimer: 0,
    dashCarrySpeed: 0,
    sprintCharge: 0,
    sprintDirection: 0,
    sprintPrimed: false,
    sprintJumpCarryTimer: 0,
    sprintJumpCarrySpeed: 0,
    wallDirection: 0,
    wallSliding: false,
    wallGraceTimer: 0,
    wallGraceDirection: 0,
    wallSlideGraceTimer: 0,
    wallSlideGraceDirection: 0,
    speedRetentionTimer: 0,
    retainedSpeed: 0,
    braceCooldownTimer: 0,
    braceConsumedWallId: null,
    braceHolding: false,
    braceHoldWallId: null,
    braceHoldDirection: 0,
    braceHoldLaunchDirection: 0,
    braceHoldSpeed: 0,
    braceReleaseTimer: 0,
    wallRunActive: false,
    wallRunDirection: 0,
    wallRunSpeed: 0,
    wallJumpLockTimer: 0,
    wallJumpLockDirection: 0,
    crouchRequested: false,
    crouchBlocked: false,
    wallSlideDustTimer: 0,
    dashTrailTimer: 0,
    canInteract: true,
    apexGravityActive: false,
    jumpCornerCorrected: false,
    dashCornerCorrected: false,
    dashCarryActive: false,
    sprintActive: false,
    sprintJumpBoostActive: false,
    dashJumpBoostActive: false,
    speedRetentionActive: false,
    bufferedLandingJumpActive: false,
    wallSlideGraceActive: false,
    braceActive: false,
    braceHoldActive: false,
    wallRunBoostActive: false,
    dashResetActive: false,
  };

  const cameraConfig = getCameraConfig(data);
  const cameraZoom = clampValue(cameraConfig.zoom ?? 1, 0.5, 2.5);
  const viewportWidth = CAMERA_SCREEN_WIDTH / cameraZoom;
  const viewportHeight = CAMERA_SCREEN_HEIGHT / cameraZoom;
  const maxCameraX = Math.max(0, data.world.width - viewportWidth);
  const maxCameraY = Math.max(0, data.world.height - viewportHeight);
  const focusX = cameraConfig.lookAheadEnabled ? (cameraConfig.neutralFocusX ?? 0.5) : CAMERA_FOCUS_X;
  const focusY = cameraConfig.lookAheadEnabled ? (cameraConfig.neutralFocusY ?? 0.5) : CAMERA_FOCUS_Y;
  const initialCameraX = clampValue(player.x - viewportWidth * focusX, 0, maxCameraX);
  const initialCameraY = clampValue(player.y - viewportHeight * focusY, 0, maxCameraY);

  return {
    hp: data.player.maxHp,
    sanity: data.player.startingSanity,
    battery: data.player.maxBattery,
    materials: 0,
    time: 0,
    timePhase: "day",
    nightActive: false,
    player,
    interactables: data.interactables.map((item) => ({
      ...deepClone(item),
      used: false,
    })),
    inventory: {
      badge: false,
    },
    encounters: {
      guard: createGuardState(data.encounters.find((entry) => entry.id === "guard")),
      ritualist: createRitualistState(data.encounters.find((entry) => entry.id === "ritualist")),
    },
    threats: data.nightThreats.map((threat) => createThreatState(threat)),
    clueLog: data.world.startClueLog?.length
      ? [...data.world.startClueLog]
      : [
        "피드를 먼저 읽어라.",
      ],
    clueSeen: [],
    prompt: "",
    promptWorld: null,
    message: data.world.startMessage || "투입 완료.",
    noticeTimer: 3.6,
    attackFx: [],
    particles: [],
    afterimages: [],
    cameraX: initialCameraX,
    cameraY: initialCameraY,
    cameraZoom,
    cameraFocusX: focusX,
    cameraFocusY: focusY,
    cameraLookDirection: player.facing,
    cameraTargetX: initialCameraX,
    cameraTargetY: initialCameraY,
    cameraTargetZoom: cameraZoom,
    cameraLookAhead: 0,
    cameraSpeedRatio: 0,
    pendingUnlocks: [],
    pendingStoryFlags: [],
    successfulReleaseIds: [],
    successfulHarvestIds: [],
    metaSnapshot: {
      trust: meta.trust,
      bankedMaterials: meta.bankedMaterials,
      unlockedAbilities: [...meta.unlockedAbilities],
    },
  };
}

export function createInitialState(data) {
  return {
    scene: SCENES.TITLE,
    pulse: 0,
    pressed: new Set(),
    justPressed: new Set(),
    meta: loadMetaState(),
    run: null,
    sceneTimer: 0,
    statusText: "C: 입장",
    resultSummary: null,
    currentControls: [],
    liveEdit: {
      active: false,
      hoverPlatformIndex: null,
      selectedPlatformIndex: null,
      drag: null,
      saveFlashTimer: 0,
    },
    debug: {
      active: false,
    },
    data,
  };
}
