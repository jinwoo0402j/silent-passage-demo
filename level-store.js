import { deepClone } from "./utils.js";

export const LEVEL_OVERRIDE_KEY = "rulebound-level-override-v2";
export const LEVEL_OVERRIDES_KEY = "rulebound-level-overrides-v3";
export const RUN_CONFIG_KEY = "rulebound-run-config-v1";
export const LEVEL_DATA_VERSION = 2;
export const LEVEL_OVERRIDES_VERSION = 3;

const DEFAULT_PLATFORM_COLOR = "#4b6075";
const DEFAULT_SIGN_TEXT = "표지";
const VALID_PROP_KINDS = new Set(["sign", "lantern", "backgroundTile"]);
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
  "slideShotWidthRatio",
  "slideShotHeightRatio",
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
  "slideShotAnchorX",
  "wallJumpAnchorX",
  "wallSlideAnchorX",
  "wallRunAnchorX",
  "braceHoldAnchorX",
  "braceReleaseAnchorX",
  "footAnchorY",
];
const PLAYER_CONFIG_FIELDS = [
  "speed",
  "jumpVelocity",
  "maxHp",
  "maxSanity",
  "maxBattery",
  "startingSanity",
  "attackDamage",
  "attackCooldown",
  "lightDrainPerSecond",
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
  ["aimPanMaxX", 0.36, 0, 0.75],
  ["aimPanMaxY", 0.27, 0, 0.55],
  ["aimPanLerp", 8.25, 0, 40],
  ["aimPanReturnLerp", 7.5, 0, 40],
];
const CAMERA_BOOLEAN_FIELDS = [
  ["lookAheadEnabled", true],
  ["dashAffectsCamera", false],
  ["braceAffectsCamera", false],
  ["mousePanAlways", true],
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

function safeArray(value, fallback = []) {
  return Array.isArray(value) ? deepClone(value) : deepClone(fallback);
}

function safeRecord(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? deepClone(value)
    : deepClone(fallback);
}

function safeId(value, fallback) {
  const raw = safeString(value, fallback);
  const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function extractEntrance(entrance = {}) {
  return {
    id: safeString(entrance.id, "start"),
    label: safeString(entrance.label, entrance.id || "Start"),
    x: safeNumber(entrance.x, 0),
    y: safeNumber(entrance.y, 0),
    facing: safeNumber(entrance.facing, 1),
  };
}

function sanitizeEntrance(entrance, index, fallback = null) {
  const base = fallback || {
    id: index === 0 ? "start" : `entrance-${index + 1}`,
    label: index === 0 ? "Start" : `Entrance ${index + 1}`,
    x: 0,
    y: 0,
    facing: 1,
  };
  const source = entrance && typeof entrance === "object" ? entrance : {};
  return {
    id: safeId(source.id, base.id),
    label: safeString(source.label, base.label),
    x: safeNumber(source.x, base.x),
    y: safeNumber(source.y, base.y),
    facing: Math.sign(safeNumber(source.facing, base.facing)) || 1,
  };
}

function extractRouteExit(exit = {}) {
  return {
    id: safeString(exit.id, "route-exit"),
    label: safeString(exit.label, exit.id || "Route Exit"),
    x: safeNumber(exit.x, 0),
    y: safeNumber(exit.y, 0),
    width: safeNumber(exit.width, 96, 24),
    height: safeNumber(exit.height, 192, 24),
    prompt: safeString(exit.prompt, "E: 다음 구역"),
    toLevelId: safeString(exit.toLevelId, ""),
    toEntranceId: safeString(exit.toEntranceId, "start"),
  };
}

function sanitizeRouteExit(exit, index, fallback = null) {
  const base = fallback || {
    id: `route-exit-${index + 1}`,
    label: `Route Exit ${index + 1}`,
    x: 0,
    y: 0,
    width: 96,
    height: 192,
    prompt: "E: 다음 구역",
    toLevelId: "",
    toEntranceId: "start",
  };
  const source = exit && typeof exit === "object" ? exit : {};
  return {
    id: safeId(source.id, base.id),
    label: safeString(source.label, base.label),
    x: safeNumber(source.x, base.x),
    y: safeNumber(source.y, base.y),
    width: safeNumber(source.width, base.width, 24),
    height: safeNumber(source.height, base.height, 24),
    prompt: safeString(source.prompt, base.prompt),
    toLevelId: safeString(source.toLevelId, base.toLevelId),
    toEntranceId: safeString(source.toEntranceId, base.toEntranceId || "start"),
  };
}

function createDefaultMapRoom(levelId = "level", label = "") {
  const roomLabel = safeString(label, levelId || "Room");
  return {
    id: "main",
    label: roomLabel || "Room",
    x: 0,
    y: 0,
    width: 180,
    height: 82,
  };
}

function extractMapRoom(room = {}, index = 0, levelId = "level", label = "") {
  const fallback = index === 0
    ? createDefaultMapRoom(levelId, label)
    : {
      id: `room-${index + 1}`,
      label: `Room ${index + 1}`,
      x: index * 220,
      y: 0,
      width: 180,
      height: 82,
    };
  return {
    id: safeString(room.id, fallback.id),
    label: safeString(room.label, fallback.label),
    x: safeNumber(room.x, fallback.x),
    y: safeNumber(room.y, fallback.y),
    width: safeNumber(room.width, fallback.width, 24),
    height: safeNumber(room.height, fallback.height, 24),
  };
}

function sanitizeMapRoom(room, index, fallback = null, levelId = "level", label = "") {
  const base = fallback || extractMapRoom({}, index, levelId, label);
  const source = room && typeof room === "object" ? room : {};
  return {
    id: safeId(source.id, base.id),
    label: safeString(source.label, base.label),
    x: safeNumber(source.x, base.x),
    y: safeNumber(source.y, base.y),
    width: safeNumber(source.width, base.width, 24),
    height: safeNumber(source.height, base.height, 24),
  };
}

function extractMapConfig(map = null, levelId = "level", label = "") {
  const rooms = Array.isArray(map?.rooms) && map.rooms.length
    ? map.rooms.map((room, index) => extractMapRoom(room, index, levelId, label))
    : [createDefaultMapRoom(levelId, label)];
  return { rooms };
}

function sanitizeMapConfig(map, fallback = null, levelId = "level", label = "") {
  const fallbackRooms = Array.isArray(fallback?.rooms) && fallback.rooms.length
    ? fallback.rooms
    : [createDefaultMapRoom(levelId, label)];
  const sourceRooms = Array.isArray(map?.rooms) && map.rooms.length
    ? map.rooms
    : fallbackRooms;
  const rooms = sourceRooms.map((room, index) => (
    sanitizeMapRoom(room, index, fallbackRooms[index], levelId, label)
  ));
  return {
    rooms: rooms.length ? rooms : [createDefaultMapRoom(levelId, label)],
  };
}

function extractExtractionGate(gate = null) {
  return gate
    ? {
      x: gate.x,
      y: gate.y,
      width: gate.width,
      height: gate.height,
      prompt: gate.prompt,
    }
    : null;
}

function sanitizeExtractionGate(gate, fallback = null) {
  if (gate === null) {
    return null;
  }
  const base = fallback || {
    x: 0,
    y: 0,
    width: 96,
    height: 192,
    prompt: "E: 추출",
  };
  if (!gate && !fallback) {
    return null;
  }
  const source = gate && typeof gate === "object" ? gate : {};
  return {
    x: safeNumber(source.x, base.x),
    y: safeNumber(source.y, base.y),
    width: safeNumber(source.width, base.width, 24),
    height: safeNumber(source.height, base.height, 24),
    prompt: safeString(source.prompt, base.prompt),
  };
}

function extractPlayerConfig(player = {}) {
  return Object.fromEntries(
    PLAYER_CONFIG_FIELDS.map((field) => [field, player[field]]),
  );
}

function sanitizePlayerConfig(player, fallbackPlayer) {
  return Object.fromEntries(
    PLAYER_CONFIG_FIELDS.map((field) => [
      field,
      safeNumber(player?.[field], fallbackPlayer?.[field]),
    ]),
  );
}

function extractPlayerMovement(movement = {}) {
  return Object.fromEntries(
    Object.entries(movement)
      .filter(([, value]) => ["number", "boolean", "string"].includes(typeof value)),
  );
}

function sanitizePlayerMovement(movement, baseMovement = {}) {
  const source = movement && typeof movement === "object" ? movement : {};
  return Object.fromEntries(
    Object.entries(baseMovement).map(([field, fallback]) => {
      if (typeof fallback === "boolean") {
        return [field, safeBoolean(source[field], fallback)];
      }
      if (typeof fallback === "string") {
        return [field, safeString(source[field], fallback)];
      }
      return [field, safeNumber(source[field], fallback)];
    }),
  );
}

function extractLootCrate(crate = {}) {
  return safeRecord(crate);
}

function sanitizeLootCrate(crate, index, baseCrate = null) {
  const fallback = baseCrate || {
    id: `loot-crate-${index + 1}`,
    x: 0,
    y: 0,
    width: 72,
    height: 48,
    label: "Supply cache",
    prompt: "E: Open cache",
    lootTable: "streetCache",
    searchTime: 0.75,
  };
  const source = crate && typeof crate === "object" ? crate : {};
  const next = {
    ...safeRecord(fallback),
    ...safeRecord(source),
    id: safeString(source.id, fallback.id || `loot-crate-${index + 1}`),
    x: safeNumber(source.x, fallback.x),
    y: safeNumber(source.y, fallback.y),
    width: safeNumber(source.width, fallback.width, 24),
    height: safeNumber(source.height, fallback.height, 24),
    label: safeString(source.label, fallback.label || "Supply cache"),
    prompt: safeString(source.prompt, fallback.prompt || "E: Open cache"),
    lootTable: safeString(source.lootTable, fallback.lootTable || "streetCache"),
    searchTime: safeNumber(source.searchTime, fallback.searchTime ?? 0.75, 0),
  };
  if (Array.isArray(source.items)) {
    next.items = safeArray(source.items);
  } else if (Array.isArray(fallback.items)) {
    next.items = safeArray(fallback.items);
  } else {
    delete next.items;
  }
  return next;
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
  const source = platform && typeof platform === "object" ? platform : null;

  const kind = source
    ? safeString(source.kind, "solid")
    : safeString(fallback.kind, "solid");
  const next = {
    x: safeNumber(source?.x, fallback.x),
    y: safeNumber(source?.y, fallback.y),
    width: safeNumber(source?.width, fallback.width, 12),
    height: safeNumber(source?.height, fallback.height, 12),
    color: safeString(source?.color, fallback.color || DEFAULT_PLATFORM_COLOR),
  };
  if (kind === "slope") {
    next.kind = "slope";
    next.slopeDirection = ["up-right", "down-right"].includes(source?.slopeDirection)
      ? source.slopeDirection
      : ["up-right", "down-right"].includes(fallback.slopeDirection)
        ? fallback.slopeDirection
        : "down-right";
  }
  return next;
}

function sanitizeProp(prop, index, baseProp = null) {
  const fallback = baseProp || {
    kind: "lantern",
    x: 240 + index * 80,
    y: 860,
    text: DEFAULT_SIGN_TEXT,
  };
  const kind = VALID_PROP_KINDS.has(prop?.kind) ? prop.kind : fallback.kind;

  if (kind === "sign") {
    return {
      kind,
      x: safeNumber(prop?.x, fallback.x),
      y: safeNumber(prop?.y, fallback.y),
      text: safeString(prop?.text, fallback.text || DEFAULT_SIGN_TEXT),
    };
  }

  if (kind === "backgroundTile") {
    return {
      kind,
      x: safeNumber(prop?.x, fallback.x),
      y: safeNumber(prop?.y, fallback.y),
      width: safeNumber(prop?.width, fallback.width || 64, 8),
      height: safeNumber(prop?.height, fallback.height || 64, 8),
      color: safeString(prop?.color, fallback.color || "#4f6f7d"),
    };
  }

  return {
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
    slideShotWidthRatio: safeNumber(render?.slideShotWidthRatio, baseRender.slideShotWidthRatio, 0.1),
    slideShotHeightRatio: safeNumber(render?.slideShotHeightRatio, baseRender.slideShotHeightRatio, 0.1),
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
    slideShotAnchorX: safeRange(render?.slideShotAnchorX, baseRender.slideShotAnchorX, 0, 1),
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
    levelId: data.currentLevelId || data.levelId || data.id || null,
    label: data.levelLabel || data.label || null,
    world: {
      mode: data.world.mode,
      width: data.world.width,
      height: data.world.height,
      gravity: data.world.gravity,
      groundY: data.world.groundY,
      duskAt: data.world.duskAt,
      nightAt: data.world.nightAt,
      sanityDrain: data.world.sanityDrain,
      startMessage: data.world.startMessage,
      startClueLog: safeArray(data.world.startClueLog),
      labObjectives: safeArray(data.world.labObjectives),
      camera: extractCamera(data.world.camera),
    },
    player: {
      spawn: {
        x: data.player.spawn.x,
        y: data.player.spawn.y,
      },
      ...extractPlayerConfig(data.player),
      movement: extractPlayerMovement(data.player.movement),
      render: extractPlayerRender(data.player.render),
    },
    ui: {
      layout: extractUiLayout(data.ui?.layout),
    },
    faceOff: {
      enemyLineCharDelay: data.faceOff?.enemyLineCharDelay,
      enemyLineHoldDuration: data.faceOff?.enemyLineHoldDuration,
      choiceSlideDuration: data.faceOff?.choiceSlideDuration,
    },
    map: extractMapConfig(
      data.map,
      data.currentLevelId || data.levelId || data.id || "level",
      data.levelLabel || data.label || data.currentLevelId || data.levelId || "Room",
    ),
    entrances: (data.entrances || []).map((entrance) => extractEntrance(entrance)),
    routeExits: (data.routeExits || []).map((exit) => extractRouteExit(exit)),
    extractionGate: extractExtractionGate(data.extractionGate),
    platforms: (data.platforms || []).map((platform) => ({
      kind: platform.kind,
      slopeDirection: platform.slopeDirection,
      x: platform.x,
      y: platform.y,
      width: platform.width,
      height: platform.height,
      color: platform.color,
    })),
    props: (data.props || []).map((prop) => {
      if (prop.kind === "sign") {
        return { kind: prop.kind, x: prop.x, y: prop.y, text: prop.text };
      }
      if (prop.kind === "backgroundTile") {
        return {
          kind: prop.kind,
          x: prop.x,
          y: prop.y,
          width: prop.width,
          height: prop.height,
          color: prop.color,
        };
      }
      return { kind: prop.kind, x: prop.x, y: prop.y };
    }),
    braceWalls: (data.braceWalls || []).map((wall) => ({
      id: wall.id,
      x: wall.x,
      y: wall.y,
      width: wall.width,
      height: wall.height,
    })),
    humanoidEnemies: (data.humanoidEnemies || []).map((enemy) => safeRecord(enemy)),
    hostileDrones: (data.hostileDrones || []).map((drone) => extractHostileDrone(drone)),
    lootTables: safeRecord(data.lootTables),
    lootCrates: (data.lootCrates || []).map((crate) => extractLootCrate(crate)),
  };
}

export function normalizeEditableLevelData(raw, baseData) {
  const fallback = extractEditableLevelData(baseData);
  const source = raw && typeof raw === "object" ? raw : {};

  return {
    version: LEVEL_DATA_VERSION,
    levelId: safeString(source.levelId, fallback.levelId),
    label: safeString(source.label, fallback.label),
    world: {
      mode: safeString(source.world?.mode, fallback.world.mode),
      width: safeNumber(source.world?.width, fallback.world.width, 640),
      height: safeNumber(source.world?.height, fallback.world.height, 360),
      gravity: safeNumber(source.world?.gravity, fallback.world.gravity, 0),
      groundY: safeNumber(source.world?.groundY, fallback.world.groundY, 0),
      duskAt: safeNumber(source.world?.duskAt, fallback.world.duskAt, 0),
      nightAt: safeNumber(source.world?.nightAt, fallback.world.nightAt, 0),
      sanityDrain: safeNumber(source.world?.sanityDrain, fallback.world.sanityDrain, 0),
      startMessage: safeString(source.world?.startMessage, fallback.world.startMessage),
      startClueLog: safeArray(source.world?.startClueLog, fallback.world.startClueLog),
      labObjectives: safeArray(source.world?.labObjectives, fallback.world.labObjectives),
      camera: sanitizeCamera(source.world?.camera, fallback.world.camera),
    },
    player: {
      spawn: {
        x: safeNumber(source.player?.spawn?.x, fallback.player.spawn.x),
        y: safeNumber(source.player?.spawn?.y, fallback.player.spawn.y),
      },
      ...sanitizePlayerConfig(source.player, fallback.player),
      movement: sanitizePlayerMovement(source.player?.movement, baseData.player.movement),
      render: sanitizePlayerRender(source.player?.render, fallback.player.render),
    },
    ui: {
      layout: sanitizeUiLayout(source.ui?.layout, fallback.ui.layout),
    },
    faceOff: {
      enemyLineCharDelay: safeNumber(source.faceOff?.enemyLineCharDelay, fallback.faceOff.enemyLineCharDelay, 0.035),
      enemyLineHoldDuration: safeNumber(source.faceOff?.enemyLineHoldDuration, fallback.faceOff.enemyLineHoldDuration, 0.35),
      choiceSlideDuration: safeNumber(source.faceOff?.choiceSlideDuration, fallback.faceOff.choiceSlideDuration, 0.26),
    },
    map: sanitizeMapConfig(
      source.map,
      fallback.map,
      source.levelId || fallback.levelId || "level",
      source.label || fallback.label || "Room",
    ),
    entrances: Array.isArray(source.entrances) && source.entrances.length
      ? source.entrances.map((entrance, index) => sanitizeEntrance(entrance, index, fallback.entrances?.[index]))
      : (fallback.entrances || []).map((entrance, index) => sanitizeEntrance(entrance, index)),
    routeExits: Array.isArray(source.routeExits)
      ? source.routeExits.map((exit, index) => sanitizeRouteExit(exit, index, fallback.routeExits?.[index]))
      : (fallback.routeExits || []).map((exit, index) => sanitizeRouteExit(exit, index)),
    extractionGate: Object.prototype.hasOwnProperty.call(source, "extractionGate")
      ? sanitizeExtractionGate(source.extractionGate, fallback.extractionGate)
      : sanitizeExtractionGate(fallback.extractionGate),
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
    humanoidEnemies: Array.isArray(source.humanoidEnemies)
      ? source.humanoidEnemies.map((enemy, index) => safeRecord(enemy, fallback.humanoidEnemies?.[index] || {}))
      : (fallback.humanoidEnemies || []).map((enemy) => safeRecord(enemy)),
    hostileDrones: Array.isArray(source.hostileDrones)
      ? source.hostileDrones.map((drone, index) => sanitizeHostileDrone(drone, index, fallback.hostileDrones?.[index]))
      : (fallback.hostileDrones || []).map((drone, index) => sanitizeHostileDrone(drone, index)),
    lootTables: safeRecord(source.lootTables, fallback.lootTables),
    lootCrates: Array.isArray(source.lootCrates)
      ? source.lootCrates.map((crate, index) => sanitizeLootCrate(crate, index, fallback.lootCrates?.[index]))
      : (fallback.lootCrates || []).map((crate, index) => sanitizeLootCrate(crate, index)),
  };
}

export function mergeLevelData(baseData, override) {
  const next = deepClone(baseData);
  if (!override) {
    return next;
  }

  const normalized = normalizeEditableLevelData(override, baseData);
  next.world.mode = normalized.world.mode;
  next.world.width = normalized.world.width;
  next.world.height = normalized.world.height;
  next.world.gravity = normalized.world.gravity;
  next.world.groundY = normalized.world.groundY;
  next.world.duskAt = normalized.world.duskAt;
  next.world.nightAt = normalized.world.nightAt;
  next.world.sanityDrain = normalized.world.sanityDrain;
  next.world.startMessage = normalized.world.startMessage;
  next.world.startClueLog = normalized.world.startClueLog;
  next.world.labObjectives = normalized.world.labObjectives;
  next.world.camera = {
    ...next.world.camera,
    ...normalized.world.camera,
  };
  next.player.spawn = normalized.player.spawn;
  PLAYER_CONFIG_FIELDS.forEach((field) => {
    next.player[field] = normalized.player[field];
  });
  next.player.movement = {
    ...next.player.movement,
    ...normalized.player.movement,
  };
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
  next.faceOff = {
    ...next.faceOff,
    ...normalized.faceOff,
  };
  next.currentLevelId = normalized.levelId || next.currentLevelId || next.defaultLevelId || null;
  next.levelId = next.currentLevelId;
  next.levelLabel = normalized.label || normalized.levelId || next.levelLabel || null;
  next.label = next.levelLabel;
  next.map = normalized.map;
  next.entrances = normalized.entrances;
  next.routeExits = normalized.routeExits;
  next.extractionGate = normalized.extractionGate ? { ...normalized.extractionGate } : null;
  next.platforms = normalized.platforms;
  next.props = normalized.props;
  next.braceWalls = normalized.braceWalls;
  next.humanoidEnemies = normalized.humanoidEnemies;
  next.hostileDrones = normalized.hostileDrones;
  next.lootTables = normalized.lootTables;
  next.lootCrates = normalized.lootCrates;

  return next;
}

function readLevelOverridesPayload() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LEVEL_OVERRIDES_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.levels || typeof parsed.levels !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLevelOverridesPayload(payload) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LEVEL_OVERRIDES_KEY, JSON.stringify({
    version: LEVEL_OVERRIDES_VERSION,
    levels: payload?.levels || {},
  }));
}

function readLegacyLevelOverride(baseData) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LEVEL_OVERRIDE_KEY);
    if (!raw) {
      return null;
    }
    return normalizeEditableLevelData(JSON.parse(raw), createBaseLevelData(baseData, getDefaultLevelId(baseData)));
  } catch {
    return null;
  }
}

export function getDefaultLevelId(baseData) {
  return baseData.defaultLevelId
    || Object.keys(baseData.levels || {})[0]
    || baseData.currentLevelId
    || "movement-lab-01";
}

export function getUrlLevelId() {
  const params = getUrlSearchParams();
  return params ? params.get("level") : null;
}

function getUrlSearchParams() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

function getUrlFlag(name) {
  const params = getUrlSearchParams();
  if (!params) {
    return false;
  }
  const value = params.get(name);
  return value === "1" || value === "true" || value === name;
}

export function shouldUseLocalLevelOverrideFromUrl() {
  const params = getUrlSearchParams();
  return getUrlFlag("localOverride")
    || params?.get("mode") === "level-test";
}

export function getLevelIds(baseData) {
  const ids = new Set(Object.keys(baseData.levels || {}));
  const payload = readLevelOverridesPayload();
  Object.keys(payload?.levels || {}).forEach((id) => ids.add(id));
  if (ids.size === 0) {
    ids.add(getDefaultLevelId(baseData));
  }
  return [...ids];
}

export function getRequestedLevelId(baseData, requestedLevelId = null) {
  const requested = safeString(requestedLevelId, "").trim();
  const levelIds = getLevelIds(baseData);
  if (requested && levelIds.includes(requested)) {
    return requested;
  }
  return getDefaultLevelId(baseData);
}

function readRunConfigPayload() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(RUN_CONFIG_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeRunConfigPayload(payload) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(RUN_CONFIG_KEY, JSON.stringify({
    version: 1,
    startLevelId: payload?.startLevelId || "",
  }));
}

export function getRunStartLevelId(baseData) {
  const configured = safeString(readRunConfigPayload()?.startLevelId, "").trim();
  const levelIds = getLevelIds(baseData);
  if (configured && levelIds.includes(configured)) {
    return configured;
  }
  return getDefaultLevelId(baseData);
}

export function saveRunStartLevelId(baseData, levelId) {
  const requested = safeString(levelId, "").trim();
  const nextLevelId = getRequestedLevelId(baseData, requested);
  writeRunConfigPayload({ startLevelId: nextLevelId });
  return nextLevelId;
}

export function getLevelDefinition(baseData, levelId) {
  return baseData.levels?.[levelId] || null;
}

export function createBaseLevelData(baseData, requestedLevelId = null) {
  const levelId = requestedLevelId || getDefaultLevelId(baseData);
  const levelDefinition = getLevelDefinition(baseData, levelId) || {
    id: levelId,
    levelId,
    label: levelId,
  };
  const next = mergeLevelData(baseData, {
    ...levelDefinition,
    levelId: levelDefinition.levelId || levelDefinition.id || levelId,
    label: levelDefinition.label || levelDefinition.id || levelId,
  });
  next.defaultLevelId = getDefaultLevelId(baseData);
  next.currentLevelId = levelId;
  next.levelId = levelId;
  next.levelLabel = levelDefinition.label || next.levelLabel || levelId;
  next.label = next.levelLabel;
  return next;
}

export function loadLevelOverrides(baseData) {
  const payload = readLevelOverridesPayload();
  if (payload) {
    return Object.fromEntries(
      Object.entries(payload.levels || {}).map(([levelId, override]) => [
        levelId,
        normalizeEditableLevelData(override, createBaseLevelData(baseData, levelId)),
      ]),
    );
  }

  const legacy = readLegacyLevelOverride(baseData);
  return legacy ? { [getDefaultLevelId(baseData)]: legacy } : {};
}

export function loadLevelOverride(baseData, requestedLevelId = null) {
  const levelId = requestedLevelId || getRequestedLevelId(baseData, getUrlLevelId());
  return loadLevelOverrides(baseData)[levelId] || null;
}

export function getLevelSummaries(baseData) {
  const overrides = loadLevelOverrides(baseData);
  return getLevelIds(baseData).map((id) => {
    const definition = getLevelDefinition(baseData, id);
    const override = overrides[id];
    const baseLevel = createBaseLevelData(baseData, id);
    const effective = override ? mergeLevelData(baseLevel, override) : baseLevel;
    const label = override?.label || definition?.label || effective.levelLabel || id;
    return {
      id,
      label,
      builtIn: Boolean(definition),
      hasOverride: Boolean(override),
      map: extractMapConfig(effective.map, id, label),
      world: {
        width: safeNumber(effective.world?.width, 1280, 1),
        height: safeNumber(effective.world?.height, 720, 1),
        groundY: safeNumber(effective.world?.groundY, 0),
      },
      platforms: (effective.platforms || []).map((platform) => ({
        kind: platform.kind,
        slopeDirection: platform.slopeDirection,
        x: platform.x,
        y: platform.y,
        width: platform.width,
        height: platform.height,
      })),
      braceWalls: (effective.braceWalls || []).map((wall) => ({
        id: wall.id,
        x: wall.x,
        y: wall.y,
        width: wall.width,
        height: wall.height,
      })),
      lootCrates: (effective.lootCrates || []).map((crate) => ({
        id: crate.id,
        x: crate.x,
        y: crate.y,
        width: crate.width,
        height: crate.height,
      })),
      humanoidEnemies: (effective.humanoidEnemies || []).map((enemy) => ({
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        width: enemy.width,
        height: enemy.height,
      })),
      routeExits: (effective.routeExits || []).map((exit) => extractRouteExit(exit)),
      extractionGate: extractExtractionGate(effective.extractionGate),
    };
  });
}

export function isBuiltInLevel(baseData, levelId) {
  return Boolean(levelId && baseData.levels?.[levelId]);
}

export function isLocalOnlyLevel(baseData, levelId) {
  if (!levelId || isBuiltInLevel(baseData, levelId)) {
    return false;
  }
  return Boolean(loadLevelOverrides(baseData)[levelId]);
}

export function getLevelRouteReferences(baseData, targetLevelId) {
  const target = safeString(targetLevelId, "").trim();
  if (!target) {
    return [];
  }
  return getLevelSummaries(baseData).flatMap((summary) => (
    (summary.routeExits || [])
      .filter(() => summary.id !== target)
      .filter((routeExit) => routeExit.toLevelId === target)
      .map((routeExit) => ({
        levelId: summary.id,
        levelLabel: summary.label || summary.id,
        routeId: routeExit.id || "",
        routeLabel: routeExit.label || routeExit.id || "",
      }))
  ));
}

export function deleteLocalLevel(baseData, targetLevelId) {
  const levelId = safeString(targetLevelId, "").trim();
  if (!levelId) {
    return { ok: false, reason: "missing-level" };
  }
  if (isBuiltInLevel(baseData, levelId)) {
    return { ok: false, reason: "built-in" };
  }
  if (!loadLevelOverrides(baseData)[levelId]) {
    return { ok: false, reason: "not-local" };
  }
  const references = getLevelRouteReferences(baseData, levelId);
  if (references.length > 0) {
    return { ok: false, reason: "referenced", references };
  }
  clearLevelOverride(baseData, levelId);
  return { ok: true, levelId };
}

function normalizeRuntimeLevelOptions(options = {}) {
  return {
    applyLevelOverride: options.applyLevelOverride !== false,
  };
}

function attachRuntimeMetadata(runtimeData, baseData, levelId, options = {}) {
  const runtimeLevelOptions = normalizeRuntimeLevelOptions(options);
  runtimeData.defaultLevelId = getDefaultLevelId(baseData);
  runtimeData.currentLevelId = levelId;
  runtimeData.levelId = levelId;
  runtimeData.levelLabel = runtimeData.levelLabel || runtimeData.label || levelId;
  runtimeData.label = runtimeData.levelLabel;
  runtimeData.levelSummaries = getLevelSummaries(baseData);
  Object.defineProperty(runtimeData, "__baseData", {
    value: baseData,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(runtimeData, "__runtimeLevelOptions", {
    value: runtimeLevelOptions,
    enumerable: false,
    configurable: true,
  });
  return runtimeData;
}

export function saveLevelOverride(override, baseData, requestedLevelId = null) {
  const levelId = safeId(
    requestedLevelId || override?.levelId || override?.id || baseData.currentLevelId || getDefaultLevelId(baseData),
    getDefaultLevelId(baseData),
  );
  const baseLevel = createBaseLevelData(baseData, levelId);
  const normalized = normalizeEditableLevelData({
    ...override,
    levelId,
  }, baseLevel);
  normalized.levelId = levelId;

  if (typeof window !== "undefined") {
    const payload = readLevelOverridesPayload() || {
      version: LEVEL_OVERRIDES_VERSION,
      levels: {},
    };
    payload.levels = payload.levels || {};
    payload.levels[levelId] = normalized;
    writeLevelOverridesPayload(payload);
  }
  return normalized;
}

export function clearLevelOverride(baseDataOrLevelId = null, requestedLevelId = null) {
  if (typeof window !== "undefined") {
    const levelId = typeof baseDataOrLevelId === "string"
      ? baseDataOrLevelId
      : requestedLevelId;

    if (!levelId) {
      window.localStorage.removeItem(LEVEL_OVERRIDE_KEY);
      window.localStorage.removeItem(LEVEL_OVERRIDES_KEY);
      return;
    }

    if (
      baseDataOrLevelId &&
      typeof baseDataOrLevelId === "object" &&
      levelId === getDefaultLevelId(baseDataOrLevelId)
    ) {
      window.localStorage.removeItem(LEVEL_OVERRIDE_KEY);
    }

    const payload = readLevelOverridesPayload();
    if (!payload?.levels) {
      return;
    }
    delete payload.levels[levelId];
    if (Object.keys(payload.levels).length === 0) {
      window.localStorage.removeItem(LEVEL_OVERRIDES_KEY);
    } else {
      writeLevelOverridesPayload(payload);
    }
  }
}

const DEFAULT_LEVEL_MANIFEST_URL = "./levels/manifest.json";

function getManifestLevelEntries(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return [];
  }

  const entries = [];
  const addPath = (source, kind = "level") => {
    if (typeof source === "string" && source.trim()) {
      entries.push({ path: source.trim(), kind });
    } else if (source && typeof source === "object" && typeof source.path === "string" && source.path.trim()) {
      entries.push({
        ...source,
        path: source.path.trim(),
        kind: source.kind || kind,
      });
    }
  };

  if (Array.isArray(manifest.levels)) {
    manifest.levels.forEach((entry) => addPath(entry, "level"));
  }
  if (Array.isArray(manifest.drafts)) {
    manifest.drafts.forEach((entry) => addPath(entry, "draft"));
  }
  if (Array.isArray(manifest.accepted)) {
    manifest.accepted.forEach((entry) => addPath(entry, "accepted"));
  }

  return entries;
}

function getExternalLevelDocuments(document, fallbackLevelId) {
  if (!document || typeof document !== "object") {
    return [];
  }

  if (document.levels && typeof document.levels === "object" && !Array.isArray(document.levels)) {
    return Object.entries(document.levels).map(([levelId, level]) => ({
      ...level,
      levelId: safeString(level?.levelId || level?.id, levelId),
    }));
  }

  const levelId = safeString(document.levelId || document.id, fallbackLevelId);
  return levelId ? [{ ...document, levelId }] : [];
}

function getExternalLevelFallbackId(entryPath) {
  return safeId(
    String(entryPath || "external-level")
      .split("/")
      .pop()
      ?.replace(/\.json$/i, "") || "external-level",
    "external-level",
  );
}

function toManifestUrl(entryPath, manifestUrl) {
  const baseUrl = typeof window !== "undefined"
    ? new URL(manifestUrl, window.location.href)
    : new URL(manifestUrl, import.meta.url);
  return new URL(entryPath, baseUrl).href;
}

function getExternalLevelPathVersion(entryPath) {
  const match = String(entryPath || "").match(/\.v(\d+)\.json$/i);
  return match ? Number(match[1]) || 0 : 0;
}

function getExternalLevelKindRank(kind) {
  if (kind === "accepted") {
    return 3;
  }
  if (kind === "level") {
    return 2;
  }
  if (kind === "draft") {
    return 1;
  }
  return 0;
}

function shouldReplaceExternalLevelSource(previousSource, nextSource) {
  if (!previousSource) {
    return true;
  }

  const previousKindRank = getExternalLevelKindRank(previousSource.kind);
  const nextKindRank = getExternalLevelKindRank(nextSource.kind);
  if (nextKindRank !== previousKindRank) {
    return nextKindRank > previousKindRank;
  }

  const previousVersion = getExternalLevelPathVersion(previousSource.path);
  const nextVersion = getExternalLevelPathVersion(nextSource.path);
  if (nextVersion !== previousVersion) {
    return nextVersion > previousVersion;
  }

  return String(nextSource.path || "") > String(previousSource.path || "");
}

export async function createGameDataWithExternalLevels(baseData, manifestUrl = DEFAULT_LEVEL_MANIFEST_URL) {
  const next = deepClone(baseData);
  next.levels = {
    ...(next.levels || {}),
  };
  next.externalLevelSources = {};

  if (typeof fetch !== "function") {
    return next;
  }

  let manifest = null;
  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) {
      return next;
    }
    manifest = await response.json();
  } catch (error) {
    console.warn("Failed to load level manifest", error);
    return next;
  }

  const entries = getManifestLevelEntries(manifest);
  for (const entry of entries) {
    const entryUrl = toManifestUrl(entry.path, manifestUrl);
    try {
      const response = await fetch(entryUrl, { cache: "no-store" });
      if (!response.ok) {
        console.warn(`Failed to load external level ${entry.path}: ${response.status}`);
        continue;
      }
      const document = await response.json();
      getExternalLevelDocuments(document, getExternalLevelFallbackId(entry.path)).forEach((levelDocument) => {
        const levelId = safeId(levelDocument.levelId || levelDocument.id, getExternalLevelFallbackId(entry.path));
        const source = {
          path: entry.path,
          kind: entry.kind || "level",
        };
        if (!shouldReplaceExternalLevelSource(next.externalLevelSources[levelId], source)) {
          return;
        }
        const baseLevel = createBaseLevelData(next, levelId);
        const normalized = normalizeEditableLevelData({
          ...levelDocument,
          levelId,
        }, baseLevel);
        next.levels[levelId] = {
          ...normalized,
          id: levelId,
          levelId,
          label: normalized.label || levelDocument.label || levelId,
        };
        next.externalLevelSources[levelId] = source;
      });
    } catch (error) {
      console.warn(`Failed to load external level ${entry.path}`, error);
    }
  }

  return next;
}

export function createRuntimeGameData(baseData, requestedLevelId = null, options = {}) {
  const runtimeLevelOptions = normalizeRuntimeLevelOptions(options);
  const explicitLevelId = requestedLevelId || getUrlLevelId();
  const levelId = getRequestedLevelId(baseData, explicitLevelId || getRunStartLevelId(baseData));
  const baseLevel = createBaseLevelData(baseData, levelId);
  const override = runtimeLevelOptions.applyLevelOverride ? loadLevelOverride(baseData, levelId) : null;
  const runtimeData = override ? mergeLevelData(baseLevel, override) : baseLevel;
  return attachRuntimeMetadata(runtimeData, baseData, levelId, runtimeLevelOptions);
}

export function loadRuntimeLevelData(runtimeData, targetLevelId, options = null) {
  const baseData = runtimeData.__baseData || runtimeData;
  const runtimeLevelOptions = normalizeRuntimeLevelOptions(options || runtimeData.__runtimeLevelOptions || {});
  const next = createRuntimeGameData(baseData, targetLevelId, runtimeLevelOptions);
  Object.keys(runtimeData).forEach((key) => {
    delete runtimeData[key];
  });
  Object.assign(runtimeData, next);
  return attachRuntimeMetadata(runtimeData, baseData, next.currentLevelId, runtimeLevelOptions);
}
