import {
  MOVEMENT_STATES,
  SCENES,
  createRunState,
  hasUnlocked,
  saveMetaState,
} from "./state.js";
import {
  approach,
  clamp,
  createRect,
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
const JUMP_KEYS = ["KeyC", "Space"];
const DASH_KEYS = ["KeyX", "ShiftLeft", "ShiftRight"];
const SPRINT_KEYS = ["ShiftLeft", "ShiftRight"];
const INTERACT_KEYS = ["KeyZ", "KeyE"];
const ATTACK_KEYS = ["KeyV", "KeyF"];
const CONFIRM_KEYS = ["KeyC", "Enter"];
const LOOT_PREV_KEYS = ["ArrowUp", "KeyW"];
const LOOT_NEXT_KEYS = ["ArrowDown", "KeyS"];
const LOOT_LEFT_KEYS = ["ArrowLeft", "KeyA"];
const LOOT_RIGHT_KEYS = ["ArrowRight", "KeyD"];
const LOOT_CLOSE_KEYS = ["Escape", "KeyQ"];
const DEBUG_KEYS = ["F3", "Backquote"];
const RESTART_KEYS = ["KeyR"];
const LOW_PERFORMANCE_MODE = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("perf") === "lite";
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

function updateEffects(run, dt, visualDt = dt) {
  run.attackFx = run.attackFx.filter((effect) => {
    effect.life -= dt;
    return effect.life > 0;
  });

  run.recoilFx = run.recoilFx.filter((effect) => {
    effect.life -= dt;
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
  const focusActive = Boolean(aim?.active && player.recoilShotCharges > 0);
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
  const targetX = player.x + player.width * 0.5 - viewportWidth * run.cameraFocusX;
  const fallTargetYOffset = applyFallCamera ? fallCamera.targetYOffset : 0;
  const targetY = player.y + player.height * 0.5 + fallTargetYOffset - viewportHeight * run.cameraFocusY;
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

function getDynamicCollisionSolids(run) {
  if (!run?.hostileDrones?.length) {
    return [];
  }
  return run.hostileDrones
    .map((entity) => getHostileAirborneSolidRect(entity))
    .filter(Boolean);
}

function getCollisionPlatforms(data, run = null) {
  if (!run) {
    return data.platforms;
  }
  return [...data.platforms, ...getDynamicCollisionSolids(run)];
}

function collidesWithPlatforms(rect, data, run = null) {
  return getCollisionPlatforms(data, run).some((platform) => rectsOverlap(rect, platform));
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
  setPlayerHeight(player, player.crouchHeight);
  player.slideTimer = (config.slideDurationMs ?? 0) / 1000;
  player.slideDirection = direction;
  player.slideSpeed = Math.max(speed, minSpeed) * (config.slideSpeedMultiplier ?? 1);
  player.vx = player.slideDirection * player.slideSpeed;
  player.facing = player.slideDirection;
  player.crouchBlocked = false;
  return true;
}

function updateSlide(player, config, dt) {
  if (player.slideTimer <= 0 || player.slideDirection === 0) {
    return false;
  }

  player.slideSpeed = Math.max(0, player.slideSpeed - (config.slideFriction ?? 0) * dt);
  if (player.slideSpeed <= 0) {
    clearSlide(player);
    return false;
  }

  player.vx = player.slideDirection * player.slideSpeed;
  player.facing = player.slideDirection;
  return true;
}

function armSlideJumpCarry(player, config) {
  const direction = player.slideDirection || Math.sign(player.vx) || player.facing || 1;
  const speed = Math.max(
    Math.abs(player.vx),
    Math.abs(player.slideSpeed),
    config.slideJumpMinSpeed ?? config.sprintJumpMinSpeed ?? 0
  ) * (config.slideJumpSpeedMultiplier ?? 1);

  player.sprintJumpCarryTimer = (config.slideJumpCarryMs ?? config.sprintJumpCarryMs ?? 0) / 1000;
  player.sprintJumpCarrySpeed = direction * speed;
  player.slideJumpBoostActive = true;
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
  };

  const previousX = player.x;
  player.x += player.vx * dt;

  for (const platform of getCollisionPlatforms(data, run)) {
    if (!rectsOverlap(player, platform)) {
      continue;
    }

    if (previousX + player.width <= platform.x + EPSILON) {
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

function damagePlayer(run, amount, direction, sourceText) {
  if (run.player.invulnTimer > 0 || (run.player.dashTimer > 0 && run.player.dashInvulnerable)) {
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

function setMovementState(player) {
  if (player.dashTimer > 0) {
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

function applyRecoilShotDamage(run, config, aim) {
  const drones = run.hostileDrones || [];
  if (!drones.length) {
    return;
  }

  const shotLength = config.recoilShotHitRange ?? 520;
  const hitRadius = config.recoilShotHitRadius ?? 42;
  const damage = config.recoilShotDamage ?? 2;
  const startX = aim.originX;
  const startY = aim.originY;
  const endX = startX + aim.shotDirX * shotLength;
  const endY = startY + aim.shotDirY * shotLength;

  drones.forEach((drone) => {
    if (isEntityDisabled(drone) || drone.dead) {
      return;
    }

    const centerX = drone.x + drone.width * 0.5;
    const centerY = drone.y + drone.height * 0.5;
    const distance = distanceFromPointToSegment(centerX, centerY, startX, startY, endX, endY);
    if (distance > hitRadius + Math.max(drone.width, drone.height) * 0.35) {
      return;
    }

    drone.active = true;
    drone.hp = Math.max(0, drone.hp - damage);
    drone.hitFlash = 0.16;
    drone.vx += aim.shotDirX * 180;
    drone.vy += aim.shotDirY * 100;
    spawnDirectedParticles(run, centerX, centerY, 9, "#87e1ff", aim.shotDirX, aim.shotDirY, 340, 0.76);
    if (drone.hp === 0) {
      destroyHostileDrone(run, drone);
    }
  });
}

function updateRecoilAim(run, data, state, dt) {
  const player = run.player;
  const config = getMovementConfig(data);
  syncRecoilShotCapacity(player, config);

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
  const active = Boolean(state.mouse?.secondaryDown && canUseRecoilShot(player));
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
  if (active) {
    player.recoilAimFacing = aimFacing;
    player.recoilAimPitch = aimPitch;
  }
  player.recoilAimX = shotDirX;
  player.recoilAimY = shotDirY;
  player.recoilDirX = recoilDirX;
  player.recoilDirY = recoilDirY;

  run.recoilAim = {
    active,
    focusBlend: player.recoilFocusBlend,
    canFire: canUseRecoilShot(player),
    originX: origin.x,
    originY: origin.y,
    targetX: target.x,
    targetY: target.y,
    aimFacing,
    aimPitch,
    shotDirX,
    shotDirY,
    recoilDirX,
    recoilDirY,
  };
}

function performRecoilShot(player, run, config) {
  if (!run.recoilAim?.active || !canUseRecoilShot(player)) {
    return false;
  }

  const aim = run.recoilAim;
  const force = config.recoilShotForce ?? 840;
  const maxHorizontal = config.recoilShotMaxHorizontalSpeed ?? 1180;
  const maxUp = Math.abs(config.recoilShotMaxUpSpeed ?? 1180);
  const maxFall = Math.abs(config.recoilShotMaxFallSpeed ?? 760);
  const recoilX = aim.recoilDirX;
  const recoilY = aim.recoilDirY;
  const firedAirborne = !player.onGround;

  clearBraceHold(player);
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  player.recoilShotCharges = Math.max(0, player.recoilShotCharges - 1);
  player.recoilShotCooldownTimer = (config.recoilShotCooldownMs ?? 180) / 1000;
  player.recoilShotTimer = 0.16;
  player.recoilShotActive = true;
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
    player.recoilAimFacing = Math.sign(aim.shotDirX);
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
  });
  applyRecoilShotDamage(run, config, aim);
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
  pushNotice(run, "반동 사격");
  run.recoilAim.active = false;
  player.recoilFocusActive = false;
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

function updateMovementVfx(run, dt) {
  const player = run.player;

  player.wallSlideDustTimer = Math.max(0, player.wallSlideDustTimer - dt);
  player.dashTrailTimer = Math.max(0, player.dashTrailTimer - dt);
  player.hoverParticleTimer = Math.max(0, player.hoverParticleTimer - dt);

  if (player.dashTimer > 0 && player.dashTrailTimer === 0) {
    player.dashTrailTimer = 0.03;
    pushAfterimage(run, player);
  }

  if (player.wallSliding && player.wallSlideDustTimer === 0) {
    player.wallSlideDustTimer = 0.08;
    const offsetX = player.wallDirection === 1 ? player.x + player.width : player.x;
    spawnParticles(run, offsetX, player.y + player.height - 4, 2, "#9bbad1");
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
  player.slideTimer = Math.max(0, player.slideTimer - dt);
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
  }
  if (player.speedRetentionTimer === 0) {
    player.retainedSpeed = 0;
  }
  if (player.attackWindow === 0) {
    player.attackHits.clear();
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
    const firedRecoilShot = performRecoilShot(player, run, config);
    if (firedRecoilShot && state.mouse) {
      state.mouse.secondaryDown = false;
      state.mouse.primaryDown = false;
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
    sprintHeld &&
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

    updateMovementVfx(run, dt);
    player.jumpHeldLastFrame = jumpHeld;
    setMovementState(player);
    return;
  }

  const canWallJump =
    player.jumpBufferTimer > 0 &&
    !player.onGround &&
    wallJumpSourceDirection !== 0 &&
    player.height === player.standHeight;
  const canWallRun = wantsWallRun && !canWallJump;
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

      updateMovementVfx(run, dt);
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
  } else if (player.wallRunActive && (!sprintHeld || !holdingWallRunLine)) {
    clearWallRun(player);
  }

  if (player.wallRunActive) {
    updateWallRun(player, config, dt);
  } else if (canGroundJump) {
    const slideJumping = player.slideTimer > 0;
    if (slideJumping) {
      armSlideJumpCarry(player, config);
      tryExitCrouch(player, data);
    }
    if (!slideJumping && player.sprintCharge >= 0.55 && Math.abs(player.vx) >= config.runSpeed * 0.92) {
      armSprintJumpCarry(player, config);
    }
    performJump(player, run, config.jumpVelocity);
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
    const baseTargetSpeed = player.height === player.crouchHeight && player.onGround
      ? moveAxis * config.runSpeed * config.crouchSpeedMultiplier
      : moveAxis * getSprintTargetSpeed(player, config, moveAxis, sprintHeld && player.sprintPrimed);
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
      player.crouchBlocked = false;
    } else if (crouchHeld) {
      tryEnterCrouch(player, data);
    } else {
      tryExitCrouch(player, data);
    }
  } else {
    player.crouchBlocked = false;
    if (player.slideTimer > 0) {
      clearSlide(player);
    }
    if (player.wallDirection !== 0) {
      player.wallGraceTimer = config.wallCoyoteTimeMs / 1000;
      player.wallGraceDirection = player.wallDirection;
    }
  }

  player.canInteract = true;
  updateMovementVfx(run, dt);
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

function updateGuard(run, dt) {
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
  const inDetection = distance < guard.detectionRadius;
  const inCheckpoint = rectsOverlap(player, guard.checkpointZone);
  const canInspect = run.inventory.badge && inCheckpoint && !isMoving && !player.lightActive;

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
    guard.facing = playerCenter.x >= guardCenter.x ? 1 : -1;
    const direction = playerCenter.x >= guardCenter.x ? 1 : -1;
    guard.x += direction * guard.chaseSpeed * dt;

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

    if (distance < guard.attackRange && guard.attackCooldown === 0) {
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

function updateRitualist(run, dt) {
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

    if (inArea && player.lightActive) {
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
    ritualist.facing = direction;
    ritualist.x += direction * ritualist.chaseSpeed * dt;

    if (distance < ritualist.attackRange && ritualist.attackCooldown === 0) {
      ritualist.attackCooldown = 1.1;
      damagePlayer(run, ritualist.damage, direction, "의식자 타격.");
    }

    if (inArea || distance < 360) {
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

function updateThreats(run, dt) {
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

    if (distance < 340) {
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

    const droneCenter = getCenter(drone);
    const distance = distanceBetween(playerCenter, droneCenter);
    const activationRadius = drone.activationRadius ?? 720;
    if (distance < activationRadius) {
      drone.active = true;
    } else if (distance > activationRadius * 1.35) {
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
      nextDistance < (drone.fireRange ?? 620) &&
      drone.attackCooldown === 0 &&
      drone.aimTimer === 0 &&
      drone.recoverTimer === 0
    ) {
      beginDroneTelegraph(run, drone, playerCenter, nextCenter);
    }
  }
}

function updateEnemyShots(run, data, dt) {
  const player = run.player;
  run.enemyShots = (run.enemyShots || []).filter((shot) => {
    if (shot.type === "beam") {
      shot.life -= dt;
      if (!shot.hasHit) {
        shot.hasHit = true;
        if (lineIntersectsRect(shot.startX, shot.startY, shot.endX, shot.endY, player, shot.radius ?? 0)) {
          damagePlayer(run, shot.damage, Math.sign(shot.dirX) || 1, "Crow line hit.");
          spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.5, 10, "#87e1ff");
        }
      }
      return shot.life > 0;
    }

    shot.life -= dt;
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

    if (rectsOverlap(shotRect, player)) {
      damagePlayer(run, shot.damage, Math.sign(shot.vx) || 1, "Crow shot hit.");
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

  const gate = data.extractionGate;
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
  state.run = null;
  state.scene = SCENES.GAME_OVER;
  state.sceneTimer = 0;
  setStatus(state, "런 실패. C");
}

function restartCurrentRun(state, data) {
  state.run = createRunState(data, state.meta);
  state.scene = SCENES.EXPEDITION;
  state.sceneTimer = 0;
  if (state.liveEdit) {
    state.liveEdit.active = false;
    state.liveEdit.hoverPlatformIndex = null;
    state.liveEdit.drag = null;
  }
  setStatus(state, "스폰으로 복귀.");
}

function updateInteractions(state, data, interactionPressed) {
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

  if (!interactionPressed) {
    return;
  }

  if (nearest.kind === "extract") {
    applyExtraction(state, data);
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
  if (state.liveEdit?.active) {
    run.prompt = "";
    run.promptWorld = null;
    if (run.recoilAim) {
      run.recoilAim.active = false;
    }
    run.player.recoilFocusActive = false;
    updateEffects(run, dt);
    syncCamera(run, data, dt);
    if (state.liveEdit.saveFlashTimer > 0) {
      state.liveEdit.saveFlashTimer = Math.max(0, state.liveEdit.saveFlashTimer - dt);
    }
    setStatus(state, state.liveEdit.saveFlashTimer > 0
      ? "라이브 편집 · 저장됨 · F2/L 종료"
      : "라이브 편집 · 블록 드래그 · F2/L 종료");
    return;
  }

  if (consumeEitherPress(state, RESTART_KEYS)) {
    restartCurrentRun(state, data);
    return;
  }

  const lootWasActive = Boolean(run.loot?.active);
  if (lootWasActive) {
    if (run.recoilAim) {
      run.recoilAim.active = false;
    }
    run.player.recoilFocusActive = false;
  } else {
    updateRecoilAim(run, data, state, dt);
  }
  const focusTimeScale = run.recoilAim?.active
    ? clamp(data.player.movement.recoilShotFocusTimeScale ?? 0.22, 0.05, 1)
    : 1;
  const simDt = dt * focusTimeScale;
  let interactionPressed = consumeEitherPress(state, INTERACT_KEYS);
  let attackPressed = lootWasActive ? false : consumeEitherPress(state, ATTACK_KEYS);
  const recoilShotPressed = !lootWasActive && Boolean(state.mouse?.primaryJustPressed);
  if (state.mouse) {
    state.mouse.primaryJustPressed = false;
  }

  const lootActive = lootWasActive ? updateLootInteraction(state, data, simDt) : false;
  if (lootWasActive) {
    interactionPressed = false;
    attackPressed = false;
  } else {
    updatePlayer(run, data, state, simDt, {
      attackPressed,
      interactionPressed,
      recoilShotPressed,
    });
    if (run.player.movementState === MOVEMENT_STATES.DASH) {
      interactionPressed = false;
      attackPressed = false;
    }
  }
  updateTimePhase(run, data, simDt);
  updateGuard(run, simDt);
  updateRitualist(run, simDt);
  updateThreats(run, simDt);
  updateHostileDrones(run, data, simDt);
  updateEnemyShots(run, data, simDt);
  updateAttackHits(run);
  if (lootActive) {
    run.prompt = "";
    run.promptWorld = null;
  } else {
    updateInteractions(state, data, interactionPressed && run.player.canInteract);
  }
  if (state.scene !== SCENES.EXPEDITION) {
    return;
  }
  updateEffects(run, simDt, dt);
  syncCamera(run, data, dt);

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
}

function updateShelter(state) {
  setStatus(state, isMovementLab(state.data) ? "대기 중. C: 출격" : "쉘터 대기. C: 출격");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    state.run = createRunState(state.data, state.meta);
    state.scene = SCENES.EXPEDITION;
    state.sceneTimer = 0;
    setStatus(state, "출격 중.");
  }
}

function updateTitle(state) {
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
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyC", "KeyE", "KeyQ", "KeyX", "KeyZ", "KeyV", "ShiftLeft", "ShiftRight", "Escape", "F2", "F3", "KeyL", "Backquote"].includes(event.code)) {
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
  }
  state.justPressed.clear();
}

export function hasThreatSense(state) {
  return hasUnlocked(state.meta, "threatSense");
}
