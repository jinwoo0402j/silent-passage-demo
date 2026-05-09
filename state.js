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
  HOVER: "hover",
  DASH: "dash",
  CROUCH: "crouch",
  CROUCH_WALK: "crouch_walk",
  SLIDE: "slide",
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

function createHostileDroneState(definition) {
  return {
    ...deepClone(definition),
    hp: definition.maxHp,
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
    aimLength: definition.beamLength ?? definition.fireRange ?? 620,
    hitFlash: 0,
    bobSeed: definition.bobSeed ?? Math.random() * Math.PI * 2,
  };
}

function createHumanoidEnemyState(definition) {
  return {
    ...deepClone(definition),
    hp: definition.maxHp ?? 100,
    disableMeter: 0,
    state: definition.disabled ? "disabled" : "patrol",
    active: false,
    dead: Boolean(definition.disabled),
    surrendered: false,
    dealt: false,
    released: false,
    facing: definition.facing ?? -1,
    stagger: definition.stagger ?? 0,
    staggerMax: definition.staggerMax ?? 100,
    staggerDecayDelay: definition.staggerDecayDelay ?? 1,
    staggerDecayRate: definition.staggerDecayRate ?? 35,
    staggerDecayTimer: 0,
    staggerBreakTimer: 0,
    staggerKnockbackVx: 0,
    escapeTargetX: definition.escapeTargetX ?? null,
    crawlSpeed: definition.crawlSpeed ?? 34,
    exhaustionHits: 0,
    staggerTimer: 0,
    knockdownFacing: definition.facing ?? -1,
    trigger: 0,
    dialogueFailures: 0,
    dialogueStage: 0,
    hitFlash: 0,
    outcome: null,
  };
}

function createLootItemState(definition, index) {
  const quantity = Math.max(1, Math.floor(Number(definition.quantity ?? 1)));
  const value = Math.max(0, Number(definition.value ?? definition.materials ?? 0));
  const lootTime = Math.max(0.1, Number(definition.lootTime ?? 0.6));
  const weight = Math.max(0.1, Number(definition.weight ?? 1));
  const slotSize = Math.max(1, Math.floor(Number(definition.slotSize ?? 1)));
  const revealDelay = Number(definition.revealDelay);

  return {
    ...deepClone(definition),
    id: definition.id || `loot-item-${index + 1}`,
    name: definition.name || "Unknown item",
    rarity: definition.rarity || "common",
    quantity,
    value,
    lootTime,
    weight,
    slotSize,
    revealDelay: Number.isFinite(revealDelay) ? Math.max(0, revealDelay) : null,
    lootProgress: 0,
    transferProgress: 0,
    revealed: Boolean(definition.revealed),
    revealFlash: 0,
    blockedTimer: 0,
    looted: false,
  };
}

function createLootCrateState(definition, data, index) {
  const tableItems = Array.isArray(definition.items)
    ? definition.items
    : data.lootTables?.[definition.lootTable] || [];
  const items = tableItems.map((item, itemIndex) => createLootItemState(item, itemIndex));
  const searchTime = Math.max(0.2, Number(definition.searchTime ?? 0.75 + items.length * 0.18));
  items.forEach((item, itemIndex) => {
    if (item.revealDelay === null) {
      item.revealDelay = Math.min(searchTime * 0.92, (itemIndex + 1) * (searchTime / (items.length + 1)));
    }
  });

  return {
    ...deepClone(definition),
    id: definition.id || `loot-crate-${index + 1}`,
    width: Math.max(24, Number(definition.width ?? 72)),
    height: Math.max(24, Number(definition.height ?? 48)),
    label: definition.label || "Supply cache",
    prompt: definition.prompt || "E: Open cache",
    opened: false,
    searchTime,
    searchProgress: 0,
    scanComplete: items.length === 0,
    searched: items.length === 0,
    rareSignalTimer: 0,
    items,
  };
}

function createTemporaryBlockState(definition, index) {
  return {
    ...deepClone(definition),
    id: definition.id || `temporary-block-${index + 1}`,
    x: Number(definition.x ?? 0),
    y: Number(definition.y ?? 0),
    width: Math.max(12, Number(definition.width ?? 96)),
    height: Math.max(12, Number(definition.height ?? 96)),
    color: definition.color || "#5f7588",
    hideDuration: Math.max(0.1, Number(definition.hideDuration ?? 1.6)),
    hiddenTimer: 0,
    hitFlash: 0,
    respawnFlash: 0,
  };
}

export function createLevelRuntimeState(data) {
  return {
    interactables: (data.interactables || []).map((item) => ({
      ...deepClone(item),
      used: false,
    })),
    lootCrates: (data.lootCrates || []).map((crate, index) => createLootCrateState(crate, data, index)),
    temporaryBlocks: (data.temporaryBlocks || []).map((block, index) => createTemporaryBlockState(block, index)),
    loot: {
      active: false,
      crateId: null,
      selectedIndex: 0,
      holdItemId: null,
      holdProgress: 0,
      rareSignalTimer: 0,
      lastRarity: null,
    },
    encounters: {
      guard: createGuardState(data.encounters.find((entry) => entry.id === "guard")),
      ritualist: createRitualistState(data.encounters.find((entry) => entry.id === "ritualist")),
    },
    threats: data.nightThreats.map((threat) => createThreatState(threat)),
    hostileDrones: (data.hostileDrones || []).map((drone) => createHostileDroneState(drone)),
    humanoidEnemies: (data.humanoidEnemies || []).map((enemy) => createHumanoidEnemyState(enemy)),
    enemyShots: [],
    dodgeSlowTimer: 0,
    dodgeSlowDuration: 0,
    dodgeFx: [],
    playerBullets: [],
    damageNumbers: [],
    faceOff: {
      active: false,
      targetId: null,
      hoverPart: null,
      selectedPart: "torso",
      selectedDialogueKey: "KeyW",
      acquireTargetId: null,
      acquireTimer: 0,
      acquireProgress: 0,
      acquireDuration: data.faceOff?.acquireDuration ?? 1,
      entryTransitionTimer: 0,
      entryTransitionStartedAt: 0,
      entryTransitionDuration: data.faceOff?.entryZoomDuration ?? 1,
      cursorAssistTimer: 0,
      cursorAssistDuration: data.faceOff?.cursorAssistDuration ?? 0.34,
      cursorAssistStartX: CAMERA_SCREEN_WIDTH / 2,
      cursorAssistStartY: CAMERA_SCREEN_HEIGHT / 2,
      cursorAssistTargetX: CAMERA_SCREEN_WIDTH / 2,
      cursorAssistTargetY: 327,
      encounterState: "ambushed",
      enemyLine: "",
      enemyLineVisible: "",
      enemyLineIndex: 0,
      enemyLineTimer: 0,
      enemyLineCharDelay: data.faceOff?.enemyLineCharDelay ?? 0.035,
      choiceRevealTimer: 0,
      choiceRevealHold: data.faceOff?.enemyLineHoldDuration ?? 0.35,
      choiceRevealDuration: data.faceOff?.choiceSlideDuration ?? 0.26,
      choiceRevealProgress: 0,
      choicesReady: false,
      shotShakeTimer: 0,
      shotShakeDuration: data.faceOff?.shotShakeDuration ?? 0.22,
      shotShakeIntensity: data.faceOff?.shotShakeIntensity ?? 18,
      shotFlashTimer: 0,
      shotFlashDuration: data.faceOff?.shotFlashDuration ?? 0.16,
      timeline: 0,
      triggerLimit: data.faceOff?.triggerLimit ?? 4.5,
      result: null,
      resultTimer: 0,
      message: "",
    },
    prompt: "",
    promptWorld: null,
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

const ARM_SIDES = ["left", "right"];

function getDefaultArmState(data, side) {
  const defaultLoadout = data.defaultLoadout || {};
  const defaultArm = defaultLoadout.arms?.[side] || {};
  return {
    side,
    armId: defaultArm.armId || (side === "right" ? "pistol-arm-a" : "shotgun-arm-a"),
    magazine: defaultArm.magazine ?? null,
    modules: Array.isArray(defaultArm.modules) ? [...defaultArm.modules].slice(0, 3) : [],
    reloadTimer: 0,
    reloadDuration: 0,
    fireCooldownTimer: 0,
  };
}

export function getArmWeapon(data, armId) {
  return data.armWeapons?.[armId] || null;
}

export function getWeaponModule(data, moduleId) {
  return data.weaponModules?.[moduleId] || null;
}

export function computeArmWeaponStats(data, armState = {}) {
  const weapon = getArmWeapon(data, armState.armId) || {};
  const modules = Array.isArray(armState.modules) ? armState.modules.slice(0, 3) : [];
  let spreadMultiplier = 1;
  let recoilMultiplier = 1;
  let knockdownMultiplier = 1;
  let magazineBonus = 0;
  let missileCount = 0;
  let barrierDuration = 0;
  let barrierStrength = 0;
  let humanoidDamageBonus = 0;

  modules.forEach((moduleId) => {
    const effects = getWeaponModule(data, moduleId)?.effects || {};
    if (Number.isFinite(effects.spreadMultiplier)) {
      spreadMultiplier *= effects.spreadMultiplier;
    }
    if (Number.isFinite(effects.recoilMultiplier)) {
      recoilMultiplier *= effects.recoilMultiplier;
    }
    if (Number.isFinite(effects.knockdownMultiplier)) {
      knockdownMultiplier *= effects.knockdownMultiplier;
    }
    magazineBonus += Number.isFinite(effects.magazineBonus) ? effects.magazineBonus : 0;
    missileCount += Number.isFinite(effects.missileCount) ? effects.missileCount : 0;
    barrierDuration = Math.max(barrierDuration, Number.isFinite(effects.barrierDuration) ? effects.barrierDuration : 0);
    barrierStrength += Number.isFinite(effects.barrierStrength) ? effects.barrierStrength : 0;
    humanoidDamageBonus += Number.isFinite(effects.humanoidDamageBonus) ? effects.humanoidDamageBonus : 0;
  });

  const magazineSize = Math.max(1, Math.floor((weapon.magazineSize ?? 1) + magazineBonus));
  const damage = Math.max(0, Number(weapon.damage ?? 1));
  const humanoidDamage = Math.max(0, Number(weapon.humanoidDamage ?? damage) + humanoidDamageBonus);

  return {
    id: weapon.id || armState.armId || "unknown-arm",
    label: weapon.label || armState.armId || "Arm",
    type: weapon.type || "shotgun",
    fireMode: weapon.fireMode === "auto" ? "auto" : "semi",
    aimUi: weapon.aimUi || weapon.type || "shotgun",
    ammoType: weapon.ammoType || "shell",
    magazineSize,
    reloadDuration: Math.max(0.05, Number(weapon.reloadDuration ?? 0.8)),
    damage,
    humanoidDamage,
    droneDamage: Math.max(0, Number(weapon.droneDamage ?? damage)),
    spread: Math.max(0, Number(weapon.spread ?? 0) * spreadMultiplier),
    recoil: Math.max(0, Number(weapon.recoil ?? 0) * recoilMultiplier),
    fireCooldown: Math.max(0.03, Number(weapon.fireCooldown ?? 0.2)),
    range: Math.max(32, Number(weapon.range ?? 520)),
    hitRadius: Math.max(1, Number(weapon.hitRadius ?? 32)),
    headshotMultiplier: Math.max(1, Number(weapon.headshotMultiplier ?? 2)),
    knockdownPower: Math.max(0, Number(weapon.knockdownPower ?? 1) * knockdownMultiplier),
    staggerDamage: Math.max(0, Number(weapon.staggerDamage ?? 0) * knockdownMultiplier),
    airActionCost: Math.max(0, Math.floor(Number(weapon.airActionCost ?? 0))),
    missileCount: Math.max(0, Math.floor(missileCount)),
    barrierDuration,
    barrierStrength,
    modules,
  };
}

export function createWeaponLoadoutState(data) {
  const defaultLoadout = data.defaultLoadout || {};
  const reserveAmmo = {
    ...(defaultLoadout.reserveAmmo || {}),
  };
  const arms = {};

  ARM_SIDES.forEach((side) => {
    const armState = getDefaultArmState(data, side);
    const stats = computeArmWeaponStats(data, armState);
    armState.magazine = Number.isFinite(armState.magazine)
      ? clampValue(Math.floor(armState.magazine), 0, stats.magazineSize)
      : stats.magazineSize;
    arms[side] = armState;
    if (!Number.isFinite(reserveAmmo[stats.ammoType])) {
      reserveAmmo[stats.ammoType] = 0;
    }
  });

  return {
    selectedSide: defaultLoadout.selectedSide === "right" ? "right" : "left",
    reserveAmmo,
    arms,
  };
}

export function ensureWeaponLoadoutState(run, data) {
  const fallback = createWeaponLoadoutState(data);
  if (!run.weapons || typeof run.weapons !== "object") {
    run.weapons = fallback;
    return run.weapons;
  }

  run.weapons.selectedSide = run.weapons.selectedSide === "right" ? "right" : "left";
  run.weapons.reserveAmmo = {
    ...fallback.reserveAmmo,
    ...(run.weapons.reserveAmmo || {}),
  };
  run.weapons.arms = run.weapons.arms && typeof run.weapons.arms === "object"
    ? run.weapons.arms
    : {};

  ARM_SIDES.forEach((side) => {
    const fallbackArm = fallback.arms[side];
    const armState = {
      ...fallbackArm,
      ...(run.weapons.arms[side] || {}),
    };
    armState.side = side;
    armState.modules = Array.isArray(armState.modules) ? armState.modules.slice(0, 3) : [...fallbackArm.modules];
    armState.reloadTimer = Math.max(0, Number(armState.reloadTimer ?? 0));
    armState.reloadDuration = Math.max(0, Number(armState.reloadDuration ?? 0));
    armState.fireCooldownTimer = Math.max(0, Number(armState.fireCooldownTimer ?? 0));

    const stats = computeArmWeaponStats(data, armState);
    armState.magazine = Number.isFinite(armState.magazine)
      ? clampValue(Math.floor(armState.magazine), 0, stats.magazineSize)
      : stats.magazineSize;
    if (!Number.isFinite(run.weapons.reserveAmmo[stats.ammoType])) {
      run.weapons.reserveAmmo[stats.ammoType] = fallback.reserveAmmo[stats.ammoType] ?? 0;
    }
    run.weapons.arms[side] = armState;
  });

  return run.weapons;
}

export function createRunState(data, meta) {
  const movement = data.player.movement;
  const maxDashCount = Math.max(1, Math.floor(movement.maxDashCount ?? 1));
  const startEntrance = (data.entrances || []).find((entry) => entry.id === "start")
    || (data.entrances || [])[0]
    || data.player.spawn;
  const player = {
    x: startEntrance.x,
    y: startEntrance.y,
    width: data.player.size.width,
    height: data.player.size.height,
    standHeight: data.player.size.height,
    crouchHeight: movement.crouchHeight,
    vx: 0,
    vy: 0,
    facing: Math.sign(startEntrance.facing ?? 1) || 1,
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
    slideInvulnerable: movement.slideInvulnerable ?? true,
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
    slideTimer: 0,
    slideDirection: 0,
    slideSpeed: 0,
    slideFrictionFxTimer: 0,
    groundSlopeDirection: 0,
    hoverActive: false,
    hoverBoostActive: false,
    hoverParticleTimer: 0,
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
    standingOnDynamicId: null,
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
    slideJumpBoostActive: false,
    dashJumpBoostActive: false,
    speedRetentionActive: false,
    bufferedLandingJumpActive: false,
    wallSlideGraceActive: false,
    braceActive: false,
    braceHoldActive: false,
    wallRunBoostActive: false,
    dashResetActive: false,
    recoilShotMaxCharges: Math.max(1, Math.floor(movement.recoilShotCharges ?? 1)),
    recoilShotCharges: Math.max(1, Math.floor(movement.recoilShotCharges ?? 1)),
    recoilShotCooldownTimer: 0,
    recoilShotTimer: 0,
    recoilShotActive: false,
    recoilSpinTimer: 0,
    recoilSpinDuration: 0,
    recoilSpinFacing: 1,
    recoilShotAirborne: false,
    recoilShotFacing: 1,
    recoilShotPitch: 0,
    recoilFocusActive: false,
    recoilFocusBlend: 0,
    recoilAimFacing: 1,
    recoilAimPitch: 0,
    recoilAimX: 0,
    recoilAimY: 1,
    recoilDirX: 0,
    recoilDirY: -1,
    recoilCameraTimer: 0,
    recoilCameraDirX: 0,
    recoilCameraDirY: -1,
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
  const levelRuntime = createLevelRuntimeState(data);
  const currentLevelId = data.currentLevelId || data.defaultLevelId || "movement-lab-01";

  return {
    hp: data.player.maxHp,
    sanity: data.player.startingSanity,
    battery: data.player.maxBattery,
    materials: 0,
    lootWeight: 0,
    lootCapacity: Math.max(1, Number(data.player.lootCapacity ?? 16)),
    focus: 100,
    focusMax: 100,
    focusDepleted: false,
    focusActive: false,
    time: 0,
    timePhase: "day",
    nightActive: false,
    currentLevelId,
    levelStates: {},
    map: {
      visitedLevelIds: [currentLevelId],
      discoveredLevelIds: [currentLevelId],
      discoveredRouteIds: [],
      exploredCellsByLevel: {
        [currentLevelId]: [],
      },
    },
    mapOverlay: {
      active: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      dragging: false,
      dragPointerId: null,
      dragStartX: 0,
      dragStartY: 0,
      dragStartPanX: 0,
      dragStartPanY: 0,
    },
    weapons: createWeaponLoadoutState(data),
    player,
    interactables: data.interactables.map((item) => ({
      ...deepClone(item),
      used: false,
    })),
    lootCrates: (data.lootCrates || []).map((crate, index) => createLootCrateState(crate, data, index)),
    loot: {
      active: false,
      crateId: null,
      selectedIndex: 0,
      holdItemId: null,
      holdProgress: 0,
      rareSignalTimer: 0,
      lastRarity: null,
    },
    lootInventory: [],
    inventory: {
      badge: false,
      items: [],
    },
    encounters: {
      guard: createGuardState(data.encounters.find((entry) => entry.id === "guard")),
      ritualist: createRitualistState(data.encounters.find((entry) => entry.id === "ritualist")),
    },
    threats: data.nightThreats.map((threat) => createThreatState(threat)),
    hostileDrones: (data.hostileDrones || []).map((drone) => createHostileDroneState(drone)),
    humanoidEnemies: (data.humanoidEnemies || []).map((enemy) => createHumanoidEnemyState(enemy)),
    enemyShots: [],
    dodgeSlowTimer: 0,
    dodgeSlowDuration: 0,
    dodgeFx: [],
    playerBullets: [],
    damageNumbers: [],
    faceOff: {
      active: false,
      targetId: null,
      hoverPart: null,
      selectedPart: "torso",
      selectedDialogueKey: "KeyW",
      acquireTargetId: null,
      acquireTimer: 0,
      acquireProgress: 0,
      acquireDuration: data.faceOff?.acquireDuration ?? 1,
      entryTransitionTimer: 0,
      entryTransitionStartedAt: 0,
      entryTransitionDuration: data.faceOff?.entryZoomDuration ?? 1,
      cursorAssistTimer: 0,
      cursorAssistDuration: data.faceOff?.cursorAssistDuration ?? 0.34,
      cursorAssistStartX: CAMERA_SCREEN_WIDTH / 2,
      cursorAssistStartY: CAMERA_SCREEN_HEIGHT / 2,
      cursorAssistTargetX: CAMERA_SCREEN_WIDTH / 2,
      cursorAssistTargetY: 327,
      encounterState: "ambushed",
      enemyLine: "",
      enemyLineVisible: "",
      enemyLineIndex: 0,
      enemyLineTimer: 0,
      enemyLineCharDelay: data.faceOff?.enemyLineCharDelay ?? 0.035,
      choiceRevealTimer: 0,
      choiceRevealHold: data.faceOff?.enemyLineHoldDuration ?? 0.35,
      choiceRevealDuration: data.faceOff?.choiceSlideDuration ?? 0.26,
      choiceRevealProgress: 0,
      choicesReady: false,
      shotShakeTimer: 0,
      shotShakeDuration: data.faceOff?.shotShakeDuration ?? 0.22,
      shotShakeIntensity: data.faceOff?.shotShakeIntensity ?? 18,
      shotFlashTimer: 0,
      shotFlashDuration: data.faceOff?.shotFlashDuration ?? 0.16,
      timeline: 0,
      triggerLimit: data.faceOff?.triggerLimit ?? 4.5,
      result: null,
      resultTimer: 0,
      message: "",
    },
    ...levelRuntime,
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
    recoilFx: [],
    weaponMissiles: [],
    weaponBarriers: [],
    particles: [],
    afterimages: [],
    recoilFocusAfterimages: [],
    recoilFocusAfterimageTimer: 0,
    recoilFocusAfterimageSerial: 0,
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
    cameraFallHoldTimer: 0,
    cameraFallRatio: 0,
    cameraFallTargetYOffset: 0,
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
    mouse: {
      screenX: CAMERA_SCREEN_WIDTH / 2,
      screenY: CAMERA_SCREEN_HEIGHT / 2,
      primaryDown: false,
      secondaryDown: false,
      primaryJustPressed: false,
      secondaryJustPressed: false,
      clientX: null,
      clientY: null,
      onCanvas: false,
    },
    meta: loadMetaState(),
    run: null,
    save: {
      hasRun: false,
      lastSavedAt: null,
    },
    sceneTimer: 0,
    debugFrame: 0,
    debugLastNow: 0,
    debugLastDt: 0,
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
    testDebug: {
      active: false,
    },
    data,
  };
}
