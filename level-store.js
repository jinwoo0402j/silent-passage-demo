import { deepClone } from "./utils.js";

export const LEVEL_OVERRIDE_KEY = "rulebound-level-override-v2";
export const LEVEL_DATA_VERSION = 1;

const DEFAULT_PLATFORM_COLOR = "#4b6075";
const DEFAULT_SIGN_TEXT = "표지";
const VALID_PROP_KINDS = new Set(["sign", "lantern"]);
const PLAYER_RENDER_FIELDS = [
  "widthRatio",
  "heightRatio",
  "idleWidthRatio",
  "idleHeightRatio",
  "runWidthRatio",
  "runHeightRatio",
  "sprintWidthRatio",
  "sprintHeightRatio",
  "jumpWidthRatio",
  "jumpHeightRatio",
  "fallWidthRatio",
  "fallHeightRatio",
  "dashWidthRatio",
  "dashHeightRatio",
  "crouchWidthRatio",
  "crouchHeightRatio",
  "wallJumpWidthRatio",
  "wallJumpHeightRatio",
  "wallSlideWidthRatio",
  "wallSlideHeightRatio",
  "wallRunWidthRatio",
  "wallRunHeightRatio",
  "braceHoldWidthRatio",
  "braceHoldHeightRatio",
  "braceReleaseWidthRatio",
  "braceReleaseHeightRatio",
  "idleAnchorX",
  "runAnchorX",
  "sprintAnchorX",
  "jumpAnchorX",
  "fallAnchorX",
  "dashAnchorX",
  "crouchAnchorX",
  "wallJumpAnchorX",
  "wallSlideAnchorX",
  "wallRunAnchorX",
  "braceHoldAnchorX",
  "braceReleaseAnchorX",
  "footAnchorY",
];
const UI_LAYOUT_FIELDS = {
  toast: ["x", "y", "width"],
  minimap: ["x", "y", "radius"],
  objective: ["x", "y", "gap"],
  status: ["x", "y", "width", "gap"],
  portrait: ["x", "y", "radius"],
  actions: ["moveX", "moveY", "dashX", "dashY", "jumpX", "jumpY", "crouchX", "crouchY", "useX", "useY"],
  results: ["cardX", "cardY", "cardW", "cardH", "artX", "artY", "artW", "artH"],
};
const CAMERA_NUMBER_FIELDS = [
  ["zoom", 1, 0.5, 2.5],
  ["minZoom", 0.88, 0.1, 1],
  ["neutralFocusX", 0.5, 0.24, 0.76],
  ["neutralFocusY", 0.5, 0.28, 0.72],
  ["walkLookAhead", 0.08, 0, 0.35],
  ["sprintLookAhead", 0.18, 0, 0.35],
  ["sprintJumpLookAhead", 0.25, 0, 0.4],
  ["dashLookAhead", 0.18, 0, 0.35],
  ["wallRunLookAhead", 0, 0, 0.35],
  ["wallRunUpLookAhead", 0.22, 0, 0.35],
  ["braceLookAhead", 0.14, 0, 0.35],
  ["fallLookAhead", 0.12, 0, 0.35],
  ["directionSpeedThreshold", 70, 0, 300],
  ["sprintCameraMinSpeed", 260, 0, 1200],
  ["speedZoomStart", 260, 0, 1600],
  ["speedZoomFull", 980, 1, 2400],
  ["speedZoomMin", 0.88, 0.1, 1],
  ["upwardFocusOffset", 0.18, -0.35, 0.35],
  ["fallingFocusOffset", -0.14, -0.35, 0.35],
  ["sprintZoom", 0.96, 0.1, 1],
  ["sprintJumpZoom", 0.92, 0.1, 1],
  ["dashZoom", 0.95, 0.1, 1],
  ["wallRunZoom", 0.94, 0.1, 1],
  ["braceZoom", 0.96, 0.1, 1],
  ["directionLerp", 6, 0, 30],
  ["focusLerp", 5.5, 0, 30],
  ["zoomLerp", 4.2, 0, 30],
];
const CAMERA_BOOLEAN_FIELDS = [
  ["lookAheadEnabled", true],
  ["dashAffectsCamera", false],
  ["braceAffectsCamera", false],
];
const HOSTILE_DRONE_NUMBER_FIELDS = [
  ["x", 0, null],
  ["y", 0, null],
  ["width", 54, 12],
  ["height", 34, 12],
  ["maxHp", 2, 1],
  ["damage", 10, 0],
  ["diveDamage", 12, 0],
  ["speed", 170, 0],
  ["acceleration", 7, 0],
  ["activationRadius", 720, 0],
  ["preferredRange", 280, 0],
  ["hoverOffsetY", 120, -1000],
  ["fireRange", 620, 0],
  ["initialCooldown", 0.8, 0],
  ["fireCooldown", 1.4, 0.1],
  ["telegraphDuration", 0.58, 0],
  ["beamLife", 0.12, 0.01],
  ["beamLength", 860, 0],
  ["beamRadius", 18, 0],
  ["diveSpeed", 1380, 0],
  ["diveMaxDuration", 0.68, 0.01],
  ["diveRecoverTime", 0.36, 0],
  ["flapRate", 14, 0],
  ["flapAmplitude", 18, 0],
  ["solidInsetX", 8, 0],
  ["solidInsetY", 7, 0],
  ["backCatchPaddingX", 0, 0],
  ["backCatchForgivenessY", 0, 0],
  ["damageInsetX", 5, 0],
  ["damageInsetY", 5, 0],
  ["bobSeed", 0, null],
];
const HOSTILE_DRONE_BOOLEAN_FIELDS = [
  ["diveAttack", true],
  ["solid", true],
  ["physicsSolid", true],
  ["braceTarget", true],
];

function safeNumber(value, fallback, minimum = null) {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  if (minimum !== null) {
    return Math.max(minimum, next);
  }
  return next;
}

function safeRange(value, fallback, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, safeNumber(value, fallback)));
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function extractCamera(camera = {}) {
  return {
    ...Object.fromEntries(
      CAMERA_NUMBER_FIELDS.map(([field, fallback, minimum, maximum]) => [
        field,
        safeRange(camera?.[field], fallback, minimum, maximum),
      ]),
    ),
    ...Object.fromEntries(
      CAMERA_BOOLEAN_FIELDS.map(([field, fallback]) => [
        field,
        safeBoolean(camera?.[field], fallback),
      ]),
    ),
  };
}

function sanitizeCamera(camera, baseCamera) {
  return {
    ...Object.fromEntries(
      CAMERA_NUMBER_FIELDS.map(([field, fallback, minimum, maximum]) => [
        field,
        safeRange(camera?.[field], baseCamera?.[field] ?? fallback, minimum, maximum),
      ]),
    ),
    ...Object.fromEntries(
      CAMERA_BOOLEAN_FIELDS.map(([field, fallback]) => [
        field,
        safeBoolean(camera?.[field], baseCamera?.[field] ?? fallback),
      ]),
    ),
  };
}

function sanitizePlatform(platform, index, basePlatform = null) {
  const fallback = basePlatform || {
    x: index * 180,
    y: 720,
    width: 240,
    height: 32,
    color: DEFAULT_PLATFORM_COLOR,
  };

  return {
    x: safeNumber(platform?.x, fallback.x),
    y: safeNumber(platform?.y, fallback.y),
    width: safeNumber(platform?.width, fallback.width, 12),
    height: safeNumber(platform?.height, fallback.height, 12),
    color: safeString(platform?.color, fallback.color || DEFAULT_PLATFORM_COLOR),
  };
}

function sanitizeProp(prop, index, baseProp = null) {
  const fallback = baseProp || {
    kind: "lantern",
    x: 240 + index * 80,
    y: 860,
    text: DEFAULT_SIGN_TEXT,
  };
  const kind = VALID_PROP_KINDS.has(prop?.kind) ? prop.kind : fallback.kind;

  return kind === "sign"
    ? {
      kind,
      x: safeNumber(prop?.x, fallback.x),
      y: safeNumber(prop?.y, fallback.y),
      text: safeString(prop?.text, fallback.text || DEFAULT_SIGN_TEXT),
    }
    : {
      kind,
      x: safeNumber(prop?.x, fallback.x),
      y: safeNumber(prop?.y, fallback.y),
    };
}

function sanitizeBraceWall(wall, index, baseWall = null) {
  const fallback = baseWall || {
    id: `brace-${index + 1}`,
    x: 360 + index * 180,
    y: 620,
    width: 32,
    height: 160,
  };

  return {
    id: safeString(wall?.id, fallback.id || `brace-${index + 1}`),
    x: safeNumber(wall?.x, fallback.x),
    y: safeNumber(wall?.y, fallback.y),
    width: safeNumber(wall?.width, fallback.width, 12),
    height: safeNumber(wall?.height, fallback.height, 12),
  };
}

function extractHostileDrone(drone = {}) {
  const next = {
    id: drone.id,
    type: drone.type || "hostileDrone",
    visualKind: drone.visualKind || "crow",
  };
  HOSTILE_DRONE_NUMBER_FIELDS.forEach(([field, fallback, minimum]) => {
    next[field] = safeNumber(drone[field], fallback, minimum);
  });
  HOSTILE_DRONE_BOOLEAN_FIELDS.forEach(([field, fallback]) => {
    if (typeof drone[field] === "boolean" || typeof drone[field] !== "undefined") {
      next[field] = safeBoolean(drone[field], fallback);
    }
  });
  next.patrol = {
    left: safeNumber(drone.patrol?.left, drone.x ?? 0),
    right: safeNumber(drone.patrol?.right, (drone.x ?? 0) + 240),
  };
  return next;
}

function sanitizeHostileDrone(drone, index, baseDrone = null) {
  const fallback = baseDrone || {
    id: `crow-${index + 1}`,
    type: "hostileDrone",
    visualKind: "crow",
    x: 600 + index * 420,
    y: 620,
    width: 144,
    height: 92,
    patrol: { left: 520 + index * 420, right: 900 + index * 420 },
  };
  const next = {
    id: safeString(drone?.id, fallback.id || `crow-${index + 1}`),
    type: safeString(drone?.type, fallback.type || "hostileDrone"),
    visualKind: safeString(drone?.visualKind, fallback.visualKind || "crow"),
  };
  HOSTILE_DRONE_NUMBER_FIELDS.forEach(([field, fallbackValue, minimum]) => {
    next[field] = safeNumber(drone?.[field], fallback[field] ?? fallbackValue, minimum);
  });
  HOSTILE_DRONE_BOOLEAN_FIELDS.forEach(([field, fallbackValue]) => {
    next[field] = safeBoolean(drone?.[field], fallback[field] ?? fallbackValue);
  });
  next.patrol = {
    left: safeNumber(drone?.patrol?.left, fallback.patrol?.left ?? next.x),
    right: safeNumber(drone?.patrol?.right, fallback.patrol?.right ?? next.x + 240),
  };
  return next;
}

function extractPlayerRender(render = {}) {
  return Object.fromEntries(
    PLAYER_RENDER_FIELDS.map((field) => [field, render[field]]),
  );
}

function sanitizePlayerRender(render, baseRender) {
  return {
    widthRatio: safeNumber(render?.widthRatio, baseRender.widthRatio, 0.1),
    heightRatio: safeNumber(render?.heightRatio, baseRender.heightRatio, 0.1),
    idleWidthRatio: safeNumber(render?.idleWidthRatio, baseRender.idleWidthRatio, 0.1),
    idleHeightRatio: safeNumber(render?.idleHeightRatio, baseRender.idleHeightRatio, 0.1),
    runWidthRatio: safeNumber(render?.runWidthRatio, baseRender.runWidthRatio, 0.1),
    runHeightRatio: safeNumber(render?.runHeightRatio, baseRender.runHeightRatio, 0.1),
    sprintWidthRatio: safeNumber(render?.sprintWidthRatio, baseRender.sprintWidthRatio, 0.1),
    sprintHeightRatio: safeNumber(render?.sprintHeightRatio, baseRender.sprintHeightRatio, 0.1),
    jumpWidthRatio: safeNumber(render?.jumpWidthRatio, baseRender.jumpWidthRatio, 0.1),
    jumpHeightRatio: safeNumber(render?.jumpHeightRatio, baseRender.jumpHeightRatio, 0.1),
    fallWidthRatio: safeNumber(render?.fallWidthRatio, baseRender.fallWidthRatio, 0.1),
    fallHeightRatio: safeNumber(render?.fallHeightRatio, baseRender.fallHeightRatio, 0.1),
    dashWidthRatio: safeNumber(render?.dashWidthRatio, baseRender.dashWidthRatio, 0.1),
    dashHeightRatio: safeNumber(render?.dashHeightRatio, baseRender.dashHeightRatio, 0.1),
    crouchWidthRatio: safeNumber(render?.crouchWidthRatio, baseRender.crouchWidthRatio, 0.1),
    crouchHeightRatio: safeNumber(render?.crouchHeightRatio, baseRender.crouchHeightRatio, 0.1),
    wallJumpWidthRatio: safeNumber(render?.wallJumpWidthRatio, baseRender.wallJumpWidthRatio, 0.1),
    wallJumpHeightRatio: safeNumber(render?.wallJumpHeightRatio, baseRender.wallJumpHeightRatio, 0.1),
    wallSlideWidthRatio: safeNumber(render?.wallSlideWidthRatio, baseRender.wallSlideWidthRatio, 0.1),
    wallSlideHeightRatio: safeNumber(render?.wallSlideHeightRatio, baseRender.wallSlideHeightRatio, 0.1),
    wallRunWidthRatio: safeNumber(render?.wallRunWidthRatio, baseRender.wallRunWidthRatio, 0.1),
    wallRunHeightRatio: safeNumber(render?.wallRunHeightRatio, baseRender.wallRunHeightRatio, 0.1),
    braceHoldWidthRatio: safeNumber(render?.braceHoldWidthRatio, baseRender.braceHoldWidthRatio, 0.1),
    braceHoldHeightRatio: safeNumber(render?.braceHoldHeightRatio, baseRender.braceHoldHeightRatio, 0.1),
    braceReleaseWidthRatio: safeNumber(render?.braceReleaseWidthRatio, baseRender.braceReleaseWidthRatio, 0.1),
    braceReleaseHeightRatio: safeNumber(render?.braceReleaseHeightRatio, baseRender.braceReleaseHeightRatio, 0.1),
    idleAnchorX: safeRange(render?.idleAnchorX, baseRender.idleAnchorX, 0, 1),
    runAnchorX: safeRange(render?.runAnchorX, baseRender.runAnchorX, 0, 1),
    sprintAnchorX: safeRange(render?.sprintAnchorX, baseRender.sprintAnchorX, 0, 1),
    jumpAnchorX: safeRange(render?.jumpAnchorX, baseRender.jumpAnchorX, 0, 1),
    fallAnchorX: safeRange(render?.fallAnchorX, baseRender.fallAnchorX, 0, 1),
    dashAnchorX: safeRange(render?.dashAnchorX, baseRender.dashAnchorX, 0, 1),
    crouchAnchorX: safeRange(render?.crouchAnchorX, baseRender.crouchAnchorX, 0, 1),
    wallJumpAnchorX: safeRange(render?.wallJumpAnchorX, baseRender.wallJumpAnchorX, 0, 1),
    wallSlideAnchorX: safeRange(render?.wallSlideAnchorX, baseRender.wallSlideAnchorX, 0, 1),
    wallRunAnchorX: safeRange(render?.wallRunAnchorX, baseRender.wallRunAnchorX, 0, 1),
    braceHoldAnchorX: safeRange(render?.braceHoldAnchorX, baseRender.braceHoldAnchorX, 0, 1),
    braceReleaseAnchorX: safeRange(render?.braceReleaseAnchorX, baseRender.braceReleaseAnchorX, 0, 1),
    footAnchorY: safeRange(render?.footAnchorY, baseRender.footAnchorY, 0, 1.5),
  };
}

function extractUiLayout(layout = {}) {
  return Object.fromEntries(
    Object.entries(UI_LAYOUT_FIELDS).map(([group, fields]) => [
      group,
      Object.fromEntries(fields.map((field) => [field, layout?.[group]?.[field]])),
    ]),
  );
}

function sanitizeUiLayout(layout, baseLayout) {
  return Object.fromEntries(
    Object.entries(UI_LAYOUT_FIELDS).map(([group, fields]) => [
      group,
      Object.fromEntries(
        fields.map((field) => [
          field,
          safeNumber(layout?.[group]?.[field], baseLayout[group][field], 0),
        ]),
      ),
    ]),
  );
}

export function extractEditableLevelData(data) {
  return {
    version: LEVEL_DATA_VERSION,
    world: {
      width: data.world.width,
      height: data.world.height,
      groundY: data.world.groundY,
      camera: extractCamera(data.world.camera),
    },
    player: {
      spawn: {
        x: data.player.spawn.x,
        y: data.player.spawn.y,
      },
      render: extractPlayerRender(data.player.render),
    },
    ui: {
      layout: extractUiLayout(data.ui?.layout),
    },
    extractionGate: {
      x: data.extractionGate.x,
      y: data.extractionGate.y,
      width: data.extractionGate.width,
      height: data.extractionGate.height,
      prompt: data.extractionGate.prompt,
    },
    platforms: data.platforms.map((platform) => ({
      x: platform.x,
      y: platform.y,
      width: platform.width,
      height: platform.height,
      color: platform.color,
    })),
    props: data.props.map((prop) => (
      prop.kind === "sign"
        ? { kind: prop.kind, x: prop.x, y: prop.y, text: prop.text }
        : { kind: prop.kind, x: prop.x, y: prop.y }
    )),
    braceWalls: (data.braceWalls || []).map((wall) => ({
      id: wall.id,
      x: wall.x,
      y: wall.y,
      width: wall.width,
      height: wall.height,
    })),
    hostileDrones: (data.hostileDrones || []).map((drone) => extractHostileDrone(drone)),
  };
}

export function normalizeEditableLevelData(raw, baseData) {
  const fallback = extractEditableLevelData(baseData);
  const source = raw && typeof raw === "object" ? raw : {};

  return {
    version: LEVEL_DATA_VERSION,
    world: {
      width: safeNumber(source.world?.width, fallback.world.width, 640),
      height: safeNumber(source.world?.height, fallback.world.height, 360),
      groundY: safeNumber(source.world?.groundY, fallback.world.groundY, 0),
      camera: sanitizeCamera(source.world?.camera, fallback.world.camera),
    },
    player: {
      spawn: {
        x: safeNumber(source.player?.spawn?.x, fallback.player.spawn.x),
        y: safeNumber(source.player?.spawn?.y, fallback.player.spawn.y),
      },
      render: sanitizePlayerRender(source.player?.render, fallback.player.render),
    },
    ui: {
      layout: sanitizeUiLayout(source.ui?.layout, fallback.ui.layout),
    },
    extractionGate: {
      x: safeNumber(source.extractionGate?.x, fallback.extractionGate.x),
      y: safeNumber(source.extractionGate?.y, fallback.extractionGate.y),
      width: safeNumber(source.extractionGate?.width, fallback.extractionGate.width, 24),
      height: safeNumber(source.extractionGate?.height, fallback.extractionGate.height, 24),
      prompt: safeString(source.extractionGate?.prompt, fallback.extractionGate.prompt),
    },
    platforms: Array.isArray(source.platforms) && source.platforms.length
      ? source.platforms.map((platform, index) => sanitizePlatform(platform, index, fallback.platforms[index]))
      : fallback.platforms.map((platform, index) => sanitizePlatform(platform, index)),
    props: Array.isArray(source.props)
      ? source.props
        .filter((prop) => VALID_PROP_KINDS.has(prop?.kind))
        .map((prop, index) => sanitizeProp(prop, index, fallback.props[index]))
      : fallback.props.map((prop, index) => sanitizeProp(prop, index)),
    braceWalls: Array.isArray(source.braceWalls)
      ? source.braceWalls.map((wall, index) => sanitizeBraceWall(wall, index, fallback.braceWalls?.[index]))
      : (fallback.braceWalls || []).map((wall, index) => sanitizeBraceWall(wall, index)),
    hostileDrones: Array.isArray(source.hostileDrones)
      ? source.hostileDrones.map((drone, index) => sanitizeHostileDrone(drone, index, fallback.hostileDrones?.[index]))
      : (fallback.hostileDrones || []).map((drone, index) => sanitizeHostileDrone(drone, index)),
  };
}

export function mergeLevelData(baseData, override) {
  const next = deepClone(baseData);
  if (!override) {
    return next;
  }

  const normalized = normalizeEditableLevelData(override, baseData);
  next.world.width = normalized.world.width;
  next.world.height = normalized.world.height;
  next.world.groundY = normalized.world.groundY;
  next.world.camera = {
    ...next.world.camera,
    ...normalized.world.camera,
  };
  next.player.spawn = normalized.player.spawn;
  next.player.render = {
    ...next.player.render,
    ...normalized.player.render,
  };
  next.ui = {
    ...next.ui,
    layout: {
      ...next.ui.layout,
      ...normalized.ui.layout,
    },
  };
  next.extractionGate = {
    ...next.extractionGate,
    ...normalized.extractionGate,
  };
  next.platforms = normalized.platforms;
  next.props = normalized.props;
  next.braceWalls = normalized.braceWalls;
  next.hostileDrones = normalized.hostileDrones;

  return next;
}

export function loadLevelOverride(baseData) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LEVEL_OVERRIDE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeEditableLevelData(JSON.parse(raw), baseData);
  } catch {
    return null;
  }
}

export function saveLevelOverride(override, baseData) {
  const normalized = normalizeEditableLevelData(override, baseData);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LEVEL_OVERRIDE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function clearLevelOverride() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEVEL_OVERRIDE_KEY);
  }
}

export function createRuntimeGameData(baseData) {
  return mergeLevelData(baseData, loadLevelOverride(baseData));
}
