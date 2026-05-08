import { GAME_DATA as STATIC_GAME_DATA } from "./level-data.js?v=20260507-slope-slide-physics-v1";
import {
  clearLevelOverride,
  createBaseLevelData,
  createGameDataWithExternalLevels,
  createRuntimeGameData,
  deleteLocalLevel,
  extractEditableLevelData,
  getLevelRouteReferences,
  getLevelSummaries,
  getRunStartLevelId,
  isBuiltInLevel,
  isLocalOnlyLevel,
  mergeLevelData,
  normalizeEditableLevelData,
  saveRunStartLevelId,
  saveLevelOverride,
} from "./level-store.js?v=20260507-slope-slide-physics-v1";
import { clamp, deepClone } from "./utils.js";

const GAME_DATA = await createGameDataWithExternalLevels(STATIC_GAME_DATA);

const TOOL_IDS = {
  SELECT: "select",
  PLATFORM: "platform",
  SLOPE_DOWN: "slopeDown",
  SLOPE_UP: "slopeUp",
  BRACE_WALL: "braceWall",
  BACKGROUND_TILE: "backgroundTile",
  SIGN: "sign",
  LANTERN: "lantern",
  SPAWN: "spawn",
  ENTRANCE: "entrance",
  ROUTE_EXIT: "routeExit",
  GATE: "gate",
  CRATE: "crate",
  ENEMY: "enemy",
  DRONE: "drone",
};

const TOOL_SHORTCUTS = {
  Digit1: TOOL_IDS.SELECT,
  Numpad1: TOOL_IDS.SELECT,
  Digit2: TOOL_IDS.PLATFORM,
  Numpad2: TOOL_IDS.PLATFORM,
  Digit9: TOOL_IDS.SLOPE_DOWN,
  Numpad9: TOOL_IDS.SLOPE_DOWN,
  KeyU: TOOL_IDS.SLOPE_UP,
  Digit3: TOOL_IDS.BRACE_WALL,
  Numpad3: TOOL_IDS.BRACE_WALL,
  KeyB: TOOL_IDS.BACKGROUND_TILE,
  Digit4: TOOL_IDS.SIGN,
  Numpad4: TOOL_IDS.SIGN,
  Digit5: TOOL_IDS.SPAWN,
  Numpad5: TOOL_IDS.SPAWN,
  Digit6: TOOL_IDS.ENTRANCE,
  Numpad6: TOOL_IDS.ENTRANCE,
  Digit7: TOOL_IDS.ROUTE_EXIT,
  Numpad7: TOOL_IDS.ROUTE_EXIT,
  Digit8: TOOL_IDS.GATE,
  Numpad8: TOOL_IDS.GATE,
  KeyC: TOOL_IDS.CRATE,
  KeyH: TOOL_IDS.ENEMY,
  KeyO: TOOL_IDS.DRONE,
};

const TOOL_SHORTCUT_LABELS = {
  [TOOL_IDS.SELECT]: "1",
  [TOOL_IDS.PLATFORM]: "2",
  [TOOL_IDS.SLOPE_DOWN]: "9",
  [TOOL_IDS.SLOPE_UP]: "U",
  [TOOL_IDS.BRACE_WALL]: "3",
  [TOOL_IDS.BACKGROUND_TILE]: "B",
  [TOOL_IDS.SIGN]: "4",
  [TOOL_IDS.SPAWN]: "5",
  [TOOL_IDS.ENTRANCE]: "6",
  [TOOL_IDS.ROUTE_EXIT]: "7",
  [TOOL_IDS.GATE]: "8",
  [TOOL_IDS.CRATE]: "C",
  [TOOL_IDS.ENEMY]: "H",
  [TOOL_IDS.DRONE]: "O",
};

const TOOL_HINTS = {
  [TOOL_IDS.SELECT]: "선택 후 드래그",
  [TOOL_IDS.PLATFORM]: "드래그로 플랫폼 생성",
  [TOOL_IDS.SLOPE_DOWN]: "드래그로 오른쪽 내리막 경사로 생성",
  [TOOL_IDS.SLOPE_UP]: "드래그로 오른쪽 오르막 경사로 생성",
  [TOOL_IDS.SIGN]: "클릭으로 표지 배치",
  [TOOL_IDS.LANTERN]: "클릭으로 랜턴 배치",
  [TOOL_IDS.SPAWN]: "클릭으로 스폰 이동",
  [TOOL_IDS.GATE]: "클릭으로 출구 이동",
};

TOOL_HINTS[TOOL_IDS.BRACE_WALL] = "드래그로 벽 짚기 볼륨 생성";
TOOL_HINTS[TOOL_IDS.BACKGROUND_TILE] = "Drag to place a non-colliding background tile";

TOOL_HINTS[TOOL_IDS.ENTRANCE] = "좌클릭으로 레벨 입구 배치";
TOOL_HINTS[TOOL_IDS.ROUTE_EXIT] = "좌클릭으로 레벨 이동 출구 배치";

TOOL_HINTS[TOOL_IDS.CRATE] = "Click to place a loot crate";
TOOL_HINTS[TOOL_IDS.ENEMY] = "Click to place a humanoid enemy";
TOOL_HINTS[TOOL_IDS.DRONE] = "Click to place a hostile drone";

const PLAYER_RENDER_GROUPS = [
  ["idle", "Idle"],
  ["run", "Run"],
  ["sprint", "Sprint"],
  ["jump", "Jump"],
  ["fall", "Fall"],
  ["dash", "Dash"],
  ["crouch", "Crouch"],
  ["wallJump", "Wall Jump"],
  ["wallSlide", "Wall Slide"],
  ["wallRun", "Wall Run"],
  ["braceHold", "Brace Hold"],
  ["braceRelease", "Brace Release"],
];

const HUD_LAYOUT_GROUPS = [
  {
    title: "Toast",
    group: "toast",
    fields: [
      ["x", "X"],
      ["y", "Y"],
      ["width", "폭"],
    ],
  },
  {
    title: "Minimap",
    group: "minimap",
    fields: [
      ["x", "X"],
      ["y", "Y"],
      ["radius", "반경"],
    ],
  },
  {
    title: "Objective",
    group: "objective",
    fields: [
      ["x", "X"],
      ["y", "Y"],
      ["gap", "간격"],
    ],
  },
  {
    title: "Status",
    group: "status",
    fields: [
      ["x", "X"],
      ["y", "Y"],
      ["width", "폭"],
      ["gap", "간격"],
    ],
  },
  {
    title: "Portrait",
    group: "portrait",
    fields: [
      ["x", "X"],
      ["y", "Y"],
      ["radius", "반경"],
    ],
  },
  {
    title: "Actions",
    group: "actions",
    fields: [
      ["moveX", "Move X"],
      ["moveY", "Move Y"],
      ["dashX", "Dash X"],
      ["dashY", "Dash Y"],
      ["jumpX", "Jump X"],
      ["jumpY", "Jump Y"],
      ["crouchX", "Crouch X"],
      ["crouchY", "Crouch Y"],
      ["useX", "Use X"],
      ["useY", "Use Y"],
    ],
  },
];

const CAMERA_SCREEN_WIDTH = 1280;
const CAMERA_SCREEN_HEIGHT = 720;
const CAMERA_FOCUS_X = 420 / CAMERA_SCREEN_WIDTH;
const CAMERA_FOCUS_Y = 360 / CAMERA_SCREEN_HEIGHT;

const CAMERA_TUNING_GROUPS = [
  {
    title: "기본",
    fields: [
      {
        key: "lookAheadEnabled",
        label: "방향 시야",
        type: "checkbox",
        defaultValue: true,
        help: "끄면 예전 고정 카메라처럼 플레이어를 기준점에 둔다.",
      },
      {
        key: "dashAffectsCamera",
        label: "대시 카메라 반응",
        type: "checkbox",
        defaultValue: false,
        help: "끄면 대시 순간에는 방향 전환, 대시 줌, 속도 줌을 적용하지 않는다.",
      },
      {
        key: "braceAffectsCamera",
        label: "벽짚기 카메라 반응",
        type: "checkbox",
        defaultValue: false,
        help: "끄면 벽짚기/방출 중 현재 카메라 초점과 줌을 유지한다.",
      },
      {
        key: "minZoom",
        label: "최대 줌아웃",
        min: 0.1,
        max: 1,
        step: 0.01,
        defaultValue: 0.88,
        help: "기본 줌 대비 최저 배율. 0.88은 최대 12% 더 넓게 본다.",
      },
      {
        key: "neutralFocusX",
        label: "기본 초점 X",
        min: 0.24,
        max: 0.76,
        step: 0.01,
        defaultValue: 0.5,
        help: "0.5가 화면 중앙. 낮으면 캐릭터가 왼쪽, 높으면 오른쪽에 선다.",
      },
      {
        key: "neutralFocusY",
        label: "기본 초점 Y",
        min: 0.28,
        max: 0.72,
        step: 0.01,
        defaultValue: 0.5,
        help: "0.5가 화면 중앙. 높이면 캐릭터가 아래로 가서 위쪽이 더 보인다.",
      },
    ],
  },
  {
    title: "방향 여백",
    fields: [
      {
        key: "walkLookAhead",
        label: "걷기 시야",
        min: 0,
        max: 0.35,
        step: 0.01,
        defaultValue: 0.08,
        help: "일반 이동 때 진행 방향으로 열어주는 화면 비율.",
      },
      {
        key: "sprintLookAhead",
        label: "달리기 시야",
        min: 0,
        max: 0.35,
        step: 0.01,
        defaultValue: 0.18,
        help: "달릴 때 앞쪽 정보를 얼마나 더 보여줄지 정한다.",
      },
      {
        key: "sprintJumpLookAhead",
        label: "달점프 시야",
        min: 0,
        max: 0.4,
        step: 0.01,
        defaultValue: 0.25,
        help: "달리기 점프 유지 중 앞쪽을 더 크게 연다.",
      },
      {
        key: "dashLookAhead",
        label: "대시 시야",
        min: 0,
        max: 0.35,
        step: 0.01,
        defaultValue: 0,
        help: "대시 중 진행 방향으로 열어주는 여백.",
      },
      {
        key: "wallRunLookAhead",
        label: "벽달리기 수평 시야",
        min: 0,
        max: 0.35,
        step: 0.01,
        defaultValue: 0,
        help: "벽달리기 중 수평 이탈 방향으로 열어주는 여백.",
      },
      {
        key: "wallRunUpLookAhead",
        label: "벽달리기 위쪽 시야",
        min: 0,
        max: 0.35,
        step: 0.01,
        defaultValue: 0.22,
        help: "벽달리기 중 캐릭터를 아래에 두고 위쪽 경로를 더 보여준다.",
      },
      {
        key: "braceLookAhead",
        label: "벽짚기 시야",
        min: 0,
        max: 0.35,
        step: 0.01,
        defaultValue: 0,
        help: "벽짚기/방출 중 다음 이동 방향을 얼마나 보여줄지.",
      },
      {
        key: "fallLookAhead",
        label: "낙하 시야",
        min: 0,
        max: 0.35,
        step: 0.01,
        defaultValue: 0.12,
        help: "빠르게 떨어질 때 진행 방향 쪽 여백.",
      },
    ],
  },
  {
    title: "속도 줌",
    fields: [
      {
        key: "sprintCameraMinSpeed",
        label: "달리기 인식 속도",
        min: 0,
        max: 1200,
        step: 10,
        defaultValue: 260,
        help: "이 속도 이상일 때 달리기 카메라가 켜진다.",
      },
      {
        key: "speedZoomStart",
        label: "줌아웃 시작 속도",
        min: 0,
        max: 1600,
        step: 10,
        defaultValue: 260,
        help: "이 속도부터 속도 기반 줌아웃이 시작된다.",
      },
      {
        key: "speedZoomFull",
        label: "줌아웃 최대 속도",
        min: 1,
        max: 2400,
        step: 10,
        defaultValue: 980,
        help: "이 속도에서 속도 기반 줌아웃이 최대치가 된다.",
      },
      {
        key: "speedZoomMin",
        label: "속도 최대 줌아웃",
        min: 0.1,
        max: 1,
        step: 0.01,
        defaultValue: 0.88,
        help: "속도만으로 내려갈 수 있는 최저 줌 배율.",
      },
      {
        key: "sprintZoom",
        label: "달리기 줌",
        min: 0.1,
        max: 1,
        step: 0.01,
        defaultValue: 0.96,
        help: "달리는 동안 기본 줌에 곱하는 값.",
      },
      {
        key: "sprintJumpZoom",
        label: "달점프 줌",
        min: 0.1,
        max: 1,
        step: 0.01,
        defaultValue: 0.92,
        help: "달리기 점프 중 기본 줌에 곱하는 값.",
      },
      {
        key: "dashZoom",
        label: "대시 줌",
        min: 0.1,
        max: 1,
        step: 0.01,
        defaultValue: 1,
        help: "대시 중 기본 줌에 곱하는 값.",
      },
      {
        key: "wallRunZoom",
        label: "벽달리기 줌",
        min: 0.1,
        max: 1,
        step: 0.01,
        defaultValue: 0.94,
        help: "벽달리기 중 기본 줌에 곱하는 값.",
      },
      {
        key: "braceZoom",
        label: "벽짚기 줌",
        min: 0.1,
        max: 1,
        step: 0.01,
        defaultValue: 1,
        help: "벽짚기/방출 중 기본 줌에 곱하는 값.",
      },
    ],
  },
  {
    title: "반응",
    fields: [
      {
        key: "upwardFocusOffset",
        label: "상승 초점",
        min: -0.35,
        max: 0.35,
        step: 0.01,
        defaultValue: 0.18,
        help: "양수면 캐릭터를 아래에 두고 위쪽을 더 보여준다.",
      },
      {
        key: "fallingFocusOffset",
        label: "낙하 초점",
        min: -0.35,
        max: 0.35,
        step: 0.01,
        defaultValue: -0.14,
        help: "음수면 캐릭터를 위에 두고 아래쪽을 더 보여준다.",
      },
      {
        key: "directionSpeedThreshold",
        label: "방향 전환 속도",
        min: 0,
        max: 300,
        step: 5,
        defaultValue: 70,
        help: "이 속도 이상 움직일 때 카메라 방향을 새로 잡는다.",
      },
      {
        key: "directionLerp",
        label: "방향 반응",
        min: 0,
        max: 30,
        step: 0.1,
        defaultValue: 6,
        help: "높을수록 좌우 시선 전환이 빠르다.",
      },
      {
        key: "focusLerp",
        label: "초점 반응",
        min: 0,
        max: 30,
        step: 0.1,
        defaultValue: 5.5,
        help: "높을수록 카메라 위치가 빠르게 따라온다.",
      },
      {
        key: "zoomLerp",
        label: "줌 반응",
        min: 0,
        max: 30,
        step: 0.1,
        defaultValue: 4.2,
        help: "높을수록 줌 인/아웃 변화가 빠르다.",
      },
    ],
  },
];
CAMERA_TUNING_GROUPS.push({
  title: "Aim Pan",
  fields: [
    {
      key: "mousePanAlways",
      label: "Mouse Pan Always",
      type: "checkbox",
      defaultValue: true,
      help: "Test toggle: camera follows mouse edge pan even without right-click aim.",
    },
    {
      key: "aimPanMaxX",
      label: "Aim Pan X",
      min: 0,
      max: 0.75,
      step: 0.01,
      defaultValue: 0.36,
      help: "Right-click aim camera horizontal pan range. 0.36 is 1.5x the old 0.24 default.",
    },
    {
      key: "aimPanMaxY",
      label: "Aim Pan Y",
      min: 0,
      max: 0.55,
      step: 0.01,
      defaultValue: 0.27,
      help: "Right-click aim camera vertical pan range. 0.27 is 1.5x the old 0.18 default.",
    },
    {
      key: "aimPanLerp",
      label: "Aim Pan Speed",
      min: 0,
      max: 40,
      step: 0.1,
      defaultValue: 8.25,
      help: "Right-click aim camera pan-in speed. 8.25 is 1.5x the old 5.5 default.",
    },
    {
      key: "aimPanReturnLerp",
      label: "Aim Pan Return",
      min: 0,
      max: 40,
      step: 0.1,
      defaultValue: 7.5,
      help: "Camera pan return speed after aim input relaxes.",
    },
  ],
});
const CAMERA_TUNING_FIELDS = CAMERA_TUNING_GROUPS.flatMap((group) => group.fields);
const CAMERA_TUNING_FIELD_MAP = new Map(CAMERA_TUNING_FIELDS.map((field) => [field.key, field]));

const COLORS = {
  accent: "#e7f47e",
  accentAlt: "#93eaff",
  danger: "#ff7d93",
  panel: "rgba(13, 28, 41, 0.86)",
  panelEdge: "rgba(147, 234, 255, 0.32)",
  gridMinor: "rgba(255, 255, 255, 0.04)",
  gridMajor: "rgba(147, 234, 255, 0.12)",
  worldEdge: "rgba(255, 255, 255, 0.18)",
  ground: "rgba(131, 158, 118, 0.18)",
  gate: "rgba(231, 244, 126, 0.82)",
  gateFill: "rgba(231, 244, 126, 0.12)",
  routeExit: "rgba(231, 244, 126, 0.82)",
  routeExitFill: "rgba(231, 244, 126, 0.1)",
  entrance: "rgba(147, 234, 255, 0.9)",
  spawn: "rgba(147, 234, 255, 0.9)",
  sign: "rgba(239, 248, 252, 0.94)",
  lantern: "rgba(231, 244, 126, 0.88)",
  backgroundTileStroke: "rgba(147, 234, 255, 0.46)",
  crate: "rgba(147, 234, 255, 0.9)",
  crateFill: "rgba(147, 234, 255, 0.13)",
  enemy: "rgba(255, 125, 147, 0.9)",
  enemyFill: "rgba(255, 125, 147, 0.13)",
  drone: "rgba(255, 190, 102, 0.9)",
  droneFill: "rgba(255, 190, 102, 0.13)",
};

const IMAGE_CACHE = new Map();

function getScaleConfig(data = GAME_DATA) {
  const scale = data.scale || {};
  const tileSize = Math.max(8, Number(scale.tileSize) || 32);
  const subTileSize = Math.max(1, Number(scale.subTileSize) || tileSize / 2);
  const playerWidthTiles = Number(scale.playerWidthTiles)
    || ((data.player?.size?.width || 48) / tileSize);
  const playerHeightTiles = Number(scale.playerHeightTiles)
    || ((data.player?.size?.height || 80) / tileSize);
  const crouchHeightTiles = Number(scale.crouchHeightTiles)
    || ((data.player?.movement?.crouchHeight || 48) / tileSize);

  return {
    tileSize,
    subTileSize,
    playerWidthTiles,
    playerHeightTiles,
    crouchHeightTiles,
  };
}

function getDefaultPlatform(scale) {
  return {
    width: scale.tileSize * 6,
    height: scale.tileSize,
    color: "#54697b",
  };
}

function isSlopeTool(tool) {
  return tool === TOOL_IDS.SLOPE_DOWN || tool === TOOL_IDS.SLOPE_UP;
}

function getSlopeDirectionForTool(tool) {
  return tool === TOOL_IDS.SLOPE_UP ? "up-right" : "down-right";
}

function getPlatformSlopeDirection(platform) {
  return platform?.slopeDirection === "up-right" ? "up-right" : "down-right";
}

function getPreviewPlatformRect(editor) {
  if (!editor.preview || editor.preview.kind !== "platform") {
    return null;
  }
  const scale = getScaleConfig(editor.data);
  const defaultPlatform = getDefaultPlatform(scale);
  const x = Math.min(editor.preview.start.x, editor.preview.end.x);
  const y = Math.min(editor.preview.start.y, editor.preview.end.y);
  return {
    x,
    y,
    width: Math.max(12, Math.abs(editor.preview.end.x - editor.preview.start.x) || defaultPlatform.width),
    height: Math.max(12, Math.abs(editor.preview.end.y - editor.preview.start.y) || defaultPlatform.height),
    kind: editor.preview.platformKind || "solid",
    slopeDirection: editor.preview.slopeDirection || "down-right",
  };
}

function getPreviewBackgroundTileRect(editor) {
  if (!editor.preview || editor.preview.kind !== "backgroundTile") {
    return null;
  }
  const scale = getScaleConfig(editor.data);
  const x = Math.min(editor.preview.start.x, editor.preview.end.x);
  const y = Math.min(editor.preview.start.y, editor.preview.end.y);
  return {
    x,
    y,
    width: Math.max(8, Math.abs(editor.preview.end.x - editor.preview.start.x) || scale.tileSize * 2),
    height: Math.max(8, Math.abs(editor.preview.end.y - editor.preview.start.y) || scale.tileSize * 2),
  };
}

function getPlayerRenderConfig(data) {
  return data.player?.render || {};
}

function getPlayerPoseConfig(data, pose) {
  const renderConfig = getPlayerRenderConfig(data);
  const fallbackAssetKey = renderConfig.fallbackAssetKey || "playerSide";
  const poseMap = {
    idle: {
      assetKey: renderConfig.idleAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.idleWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.idleHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.idleAnchorX ?? 0.28,
    },
    run: {
      assetKey: renderConfig.runAssetKey || renderConfig.idleAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.runWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.runHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.runAnchorX ?? 0.16,
    },
    sprint: {
      assetKey: renderConfig.sprintAssetKey || renderConfig.runAssetKey || renderConfig.idleAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.sprintWidthRatio ?? renderConfig.runWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.sprintHeightRatio ?? renderConfig.runHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.sprintAnchorX ?? renderConfig.runAnchorX ?? 0.18,
    },
    jump: {
      assetKey: renderConfig.jumpAssetKey || renderConfig.idleAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.jumpWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.jumpHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.jumpAnchorX ?? 0.48,
    },
    fall: {
      assetKey: renderConfig.fallAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.fallWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.fallHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.fallAnchorX ?? 0.46,
    },
    dash: {
      assetKey: renderConfig.dashAssetKey || renderConfig.runAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.dashWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.dashHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.dashAnchorX ?? 0.34,
    },
    crouch: {
      assetKey: renderConfig.crouchAssetKey || renderConfig.idleAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.crouchWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.crouchHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.crouchAnchorX ?? 0.48,
    },
    wallJump: {
      assetKey: renderConfig.wallJumpAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.wallJumpWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.wallJumpHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.wallJumpAnchorX ?? 0.34,
    },
    wallSlide: {
      assetKey: renderConfig.wallSlideAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.wallSlideWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.wallSlideHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.wallSlideAnchorX ?? 0.38,
    },
    wallRun: {
      assetKey: renderConfig.wallRunAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.wallRunWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.wallRunHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.wallRunAnchorX ?? 0.34,
    },
    braceHold: {
      assetKey: renderConfig.braceHoldAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.braceHoldWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.braceHoldHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.braceHoldAnchorX ?? 0.38,
    },
    braceRelease: {
      assetKey: renderConfig.braceReleaseAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.braceReleaseWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.braceReleaseHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.braceReleaseAnchorX ?? 0.34,
    },
  };

  return {
    ...(poseMap[pose] || poseMap.idle),
    footAnchorY: renderConfig.footAnchorY ?? 0.978,
  };
}

function getUiLayoutConfig(data) {
  return data.ui?.layout || {};
}

function getImageAsset(src) {
  if (!src || typeof Image === "undefined") {
    return null;
  }

  if (!IMAGE_CACHE.has(src)) {
    const image = new Image();
    image.src = src;
    image.addEventListener("load", () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("editor-rerender"));
      }
    }, { once: true });
    IMAGE_CACHE.set(src, image);
  }

  return IMAGE_CACHE.get(src);
}

function formatTiles(value, tileSize) {
  const rounded = Math.round((value / tileSize) * 100) / 100;
  return `${String(rounded).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}T`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function snapValue(value, step) {
  if (!step || step <= 1) {
    return Math.round(value);
  }
  return Math.round(value / step) * step;
}

function snapPoint(point, step) {
  return {
    x: snapValue(point.x, step),
    y: snapValue(point.y, step),
  };
}

function pathRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getEditorDom() {
  const canvas = document.getElementById("editorCanvas");
  if (!canvas) {
    return null;
  }

  return {
    canvas,
    ctx: canvas.getContext("2d"),
    collapsiblePanels: [...document.querySelectorAll(".editor-panel.is-collapsible")],
    toolButtons: [...document.querySelectorAll("[data-tool]")],
    levelSelect: document.getElementById("levelSelect"),
    levelNameInput: document.getElementById("levelNameInput"),
    runStartLevelSelect: document.getElementById("runStartLevelSelect"),
    levelMetaLabel: document.getElementById("levelMetaLabel"),
    duplicateLevelButton: document.getElementById("duplicateLevelButton"),
    newLevelButton: document.getElementById("newLevelButton"),
    deleteLevelButton: document.getElementById("deleteLevelButton"),
    mapRoomsFields: document.getElementById("mapRoomsFields"),
    addMapRoomButton: document.getElementById("addMapRoomButton"),
    worldWidthInput: document.getElementById("worldWidthInput"),
    worldHeightInput: document.getElementById("worldHeightInput"),
    groundYInput: document.getElementById("groundYInput"),
    snapInput: document.getElementById("snapInput"),
    cameraZoomInput: document.getElementById("cameraZoomInput"),
    cameraTuningFields: document.getElementById("cameraTuningFields"),
    scaleTileLabel: document.getElementById("scaleTileLabel"),
    scaleSubTileLabel: document.getElementById("scaleSubTileLabel"),
    scalePlayerLabel: document.getElementById("scalePlayerLabel"),
    snapAllButton: document.getElementById("snapAllButton"),
    playerPreviewPose: document.getElementById("playerPreviewPose"),
    playerRenderFields: document.getElementById("playerRenderFields"),
    hudLayoutFields: document.getElementById("hudLayoutFields"),
    selectionLabel: document.getElementById("selectionLabel"),
    selectionFields: document.getElementById("selectionFields"),
    deleteSelectionButton: document.getElementById("deleteSelectionButton"),
    saveButton: document.getElementById("saveButton"),
    downloadButton: document.getElementById("downloadButton"),
    importButton: document.getElementById("importButton"),
    importInput: document.getElementById("importInput"),
    collapseAllButton: document.getElementById("collapseAllButton"),
    expandAllButton: document.getElementById("expandAllButton"),
    fitViewButton: document.getElementById("fitViewButton"),
    resetButton: document.getElementById("resetButton"),
    playLevelLink: document.getElementById("playLevelLink"),
    statusLabel: document.getElementById("statusLabel"),
    toolHint: document.getElementById("toolHint"),
    viewLabel: document.getElementById("viewLabel"),
  };
}

function createDefaultEditorMapRoom(data, index = 0) {
  const label = index === 0
    ? (data.levelLabel || data.label || data.currentLevelId || "Room")
    : `Room ${index + 1}`;
  return {
    id: index === 0 ? "main" : `room-${index + 1}`,
    label,
    x: index * 220,
    y: 0,
    width: 180,
    height: 82,
  };
}

function ensureEditorMapRooms(data) {
  data.map = data.map || {};
  if (!Array.isArray(data.map.rooms) || data.map.rooms.length === 0) {
    data.map.rooms = [createDefaultEditorMapRoom(data, 0)];
  }
  data.map.rooms = data.map.rooms.map((room, index) => {
    const source = room && typeof room === "object" ? room : {};
    return {
      ...createDefaultEditorMapRoom(data, index),
      ...source,
      width: Math.max(24, Number(source.width ?? 180) || 180),
      height: Math.max(24, Number(source.height ?? 82) || 82),
    };
  });
  return data.map.rooms;
}

function prepareEditorData(data) {
  data.braceWalls = data.braceWalls || [];
  data.entrances = data.entrances || [];
  data.routeExits = data.routeExits || [];
  data.lootCrates = data.lootCrates || [];
  data.humanoidEnemies = data.humanoidEnemies || [];
  data.hostileDrones = data.hostileDrones || [];
  ensureEditorMapRooms(data);
  if (data.entrances.length === 0) {
    data.entrances.push({
      id: "start",
      label: "Start",
      x: data.player.spawn.x,
      y: data.player.spawn.y,
      facing: 1,
    });
  }
  data.levelSummaries = getLevelSummaries(GAME_DATA);
  return data;
}

function createEditorState() {
  const data = prepareEditorData(createRuntimeGameData(GAME_DATA, null, {
    applyLevelOverride: true,
  }));
  const scale = getScaleConfig(data);

  return {
    data,
    tool: TOOL_IDS.SELECT,
    selected: null,
    previewPose: "idle",
    snap: scale.subTileSize,
    dirty: false,
    statusTone: "",
    statusText: "저장됨",
    pointerWorld: { x: 0, y: 0 },
    preview: null,
    drag: null,
    view: {
      x: 0,
      y: 0,
      zoom: 0.45,
      width: 1280,
      height: 720,
      dpr: 1,
    },
    history: {
      undoStack: [],
      redoStack: [],
      limit: 80,
    },
    renderQueued: false,
  };
}

function queueRender(editor, dom) {
  if (editor.renderQueued) {
    return;
  }
  editor.renderQueued = true;
  requestAnimationFrame(() => {
    editor.renderQueued = false;
    renderEditor(editor, dom);
  });
}

function resizeCanvas(editor, dom) {
  const rect = dom.canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(320, Math.floor(rect.height));
  const dpr = window.devicePixelRatio || 1;

  if (
    dom.canvas.width !== Math.floor(width * dpr)
    || dom.canvas.height !== Math.floor(height * dpr)
  ) {
    dom.canvas.width = Math.floor(width * dpr);
    dom.canvas.height = Math.floor(height * dpr);
  }

  editor.view.width = width;
  editor.view.height = height;
  editor.view.dpr = dpr;
  dom.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setStatus(editor, dom, text, tone = "", dirty = editor.dirty) {
  editor.statusText = text;
  editor.statusTone = tone;
  editor.dirty = dirty;
  dom.statusLabel.textContent = dirty ? `수정됨 · ${text}` : text;
  dom.statusLabel.classList.toggle("is-dirty", dirty && tone !== "error");
  dom.statusLabel.classList.toggle("is-error", tone === "error");
}

function markDirty(editor, dom) {
  setStatus(editor, dom, "저장 필요", "", true);
}

function captureEditorSnapshot(editor) {
  return {
    override: extractEditableLevelData(editor.data),
    snap: editor.snap,
    previewPose: editor.previewPose,
    selected: deepClone(editor.selected),
  };
}

function getSnapshotKey(snapshot) {
  return JSON.stringify(snapshot);
}

function pushUndoSnapshot(editor, snapshot) {
  const key = getSnapshotKey(snapshot);
  const last = editor.history.undoStack.at(-1);
  if (last?.key === key) {
    return false;
  }

  editor.history.undoStack.push({ key, snapshot });
  if (editor.history.undoStack.length > editor.history.limit) {
    editor.history.undoStack.shift();
  }
  editor.history.redoStack = [];
  return true;
}

function pushUndo(editor) {
  return pushUndoSnapshot(editor, captureEditorSnapshot(editor));
}

function clampEditorViewToWorld(editor) {
  const maxX = Math.max(0, editor.data.world.width - editor.view.width / editor.view.zoom);
  const maxY = Math.max(0, editor.data.world.height - editor.view.height / editor.view.zoom);
  editor.view.x = clamp(editor.view.x, 0, maxX);
  editor.view.y = clamp(editor.view.y, 0, maxY);
}

function applyEditorSnapshot(editor, dom, snapshot, dirty = true) {
  const levelId = snapshot.override?.levelId || editor.data.currentLevelId || GAME_DATA.defaultLevelId;
  editor.data = prepareEditorData(mergeLevelData(createBaseLevelData(GAME_DATA, levelId), snapshot.override));
  editor.snap = snapshot.snap;
  editor.previewPose = snapshot.previewPose || "idle";
  editor.preview = null;
  editor.drag = null;
  editor.pointerWorld = { x: 0, y: 0 };
  editor.selected = normalizeSelection(snapshot.selected);
  syncWorldInputs(editor, dom);
  renderPlayerRenderFields(editor, dom);
  renderHudLayoutFields(editor, dom);
  renderSelectionFields(editor, dom);
  renderPlayerPreviewPoseOptions(editor, dom);
  clampEditorViewToWorld(editor);
  if (dirty) {
    markDirty(editor, dom);
  } else {
    setStatus(editor, dom, "복원됨", "", false);
  }
  queueRender(editor, dom);
}

function undoEditor(editor, dom) {
  const entry = editor.history.undoStack.pop();
  if (!entry) {
    setStatus(editor, dom, "되돌릴 작업 없음", "", editor.dirty);
    return;
  }

  const current = captureEditorSnapshot(editor);
  editor.history.redoStack.push({
    key: getSnapshotKey(current),
    snapshot: current,
  });
  applyEditorSnapshot(editor, dom, entry.snapshot, true);
  setStatus(editor, dom, "실행 취소", "", true);
}

function updateScaleInfo(editor, dom) {
  const scale = getScaleConfig(editor.data);
  dom.scaleTileLabel.textContent = `1T · ${scale.tileSize}`;
  dom.scaleSubTileLabel.textContent = `서브 · ${scale.subTileSize}`;
  dom.scalePlayerLabel.textContent = `캐릭터 · ${formatTiles(editor.data.player.size.width, scale.tileSize)} × ${formatTiles(editor.data.player.size.height, scale.tileSize)}`;
}

function getCameraTuningValue(camera, field) {
  if (field.type === "checkbox") {
    return typeof camera?.[field.key] === "boolean" ? camera[field.key] : field.defaultValue;
  }
  const value = Number(camera?.[field.key]);
  return Number.isFinite(value) ? value : field.defaultValue;
}

function formatCameraInputValue(value, field) {
  if (Number.isInteger(field.step)) {
    return String(Math.round(value));
  }
  return Number(value).toFixed(field.step >= 0.1 ? 1 : 2);
}

function clampCameraFieldValue(value, field) {
  if (field.type === "checkbox") {
    return Boolean(value);
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }
  return clamp(numericValue, field.min, field.max);
}

function renderCameraTuningFields(editor, dom) {
  if (!dom.cameraTuningFields) {
    return;
  }

  const camera = editor.data.world.camera || {};
  dom.cameraTuningFields.innerHTML = CAMERA_TUNING_GROUPS.map((group) => {
    const fields = group.fields.map((field) => {
      const value = getCameraTuningValue(camera, field);
      if (field.type === "checkbox") {
        return `
          <label class="field camera-field camera-toggle full">
            <span>${escapeHtml(field.label)}</span>
            <input data-camera-field="${escapeHtml(field.key)}" type="checkbox" ${value ? "checked" : ""}>
            <small>${escapeHtml(field.help)}</small>
          </label>
        `;
      }
      return `
        <label class="field camera-field">
          <span>${escapeHtml(field.label)}</span>
          <input
            data-camera-field="${escapeHtml(field.key)}"
            type="number"
            min="${field.min}"
            max="${field.max}"
            step="${field.step}"
            value="${formatCameraInputValue(value, field)}"
          >
          <small>${escapeHtml(field.help)}</small>
        </label>
      `;
    }).join("");
    return `<div class="field-heading">${escapeHtml(group.title)}</div>${fields}`;
  }).join("");
}

function getEditorCameraZoom(data) {
  return clamp(data.world.camera?.zoom ?? 1, 0.5, 2.5);
}

function getEditorCameraFocusX(data, direction = 0) {
  const camera = data.world.camera || {};
  const neutral = camera.lookAheadEnabled ? (camera.neutralFocusX ?? 0.5) : CAMERA_FOCUS_X;
  if (!camera.lookAheadEnabled || direction === 0) {
    return neutral;
  }
  const lookAhead = camera.sprintLookAhead ?? camera.walkLookAhead ?? 0.08;
  return clamp(neutral - Math.sign(direction) * lookAhead, 0.24, 0.76);
}

function getEditorCameraFocusY(data) {
  const camera = data.world.camera || {};
  return camera.lookAheadEnabled ? (camera.neutralFocusY ?? 0.5) : CAMERA_FOCUS_Y;
}

function getEditorCameraGuide(editor, point = editor.data.player.spawn, options = {}) {
  const zoom = getEditorCameraZoom(editor.data);
  const width = CAMERA_SCREEN_WIDTH / zoom;
  const height = CAMERA_SCREEN_HEIGHT / zoom;
  const maxX = Math.max(0, editor.data.world.width - width);
  const maxY = Math.max(0, editor.data.world.height - height);
  const focusX = getEditorCameraFocusX(editor.data, options.direction ?? 0);
  const focusY = getEditorCameraFocusY(editor.data);
  const centerX = point.x + editor.data.player.size.width * 0.5;
  const centerY = point.y + editor.data.player.size.height * 0.5;
  const x = clamp(centerX - width * focusX, 0, maxX);
  const y = clamp(centerY - height * focusY, 0, maxY);
  return { x, y, width, height, zoom, focusX, focusY, direction: options.direction ?? 0 };
}

function syncWorldInputs(editor, dom) {
  dom.worldWidthInput.value = Math.round(editor.data.world.width);
  dom.worldHeightInput.value = Math.round(editor.data.world.height);
  dom.groundYInput.value = Math.round(editor.data.world.groundY);
  dom.snapInput.value = Math.round(editor.snap);
  dom.cameraZoomInput.value = getEditorCameraZoom(editor.data).toFixed(2);
  renderCameraTuningFields(editor, dom);
  renderPlayerPreviewPoseOptions(editor, dom);
  renderLevelControls(editor, dom);
  renderMapRoomFields(editor, dom);
  updateScaleInfo(editor, dom);
}

function renderLevelControls(editor, dom) {
  if (!dom.levelSelect || !dom.levelNameInput) {
    return;
  }
  const summaries = getLevelSummaries(GAME_DATA);
  editor.data.levelSummaries = summaries;
  dom.levelSelect.innerHTML = summaries
    .map((level) => {
      const source = level.builtIn ? "built-in" : "local";
      const dirty = level.hasOverride && level.builtIn ? " *" : "";
      return `<option value="${escapeHtml(level.id)}">${escapeHtml(level.label || level.id)} (${source}${dirty})</option>`;
    })
    .join("");
  const runStartLevelId = getRunStartLevelId(GAME_DATA);
  if (dom.runStartLevelSelect) {
    dom.runStartLevelSelect.innerHTML = summaries
      .map((level) => `<option value="${escapeHtml(level.id)}">${escapeHtml(level.label || level.id)}</option>`)
      .join("");
    dom.runStartLevelSelect.value = runStartLevelId;
  }
  const currentLevelId = editor.data.currentLevelId || editor.data.defaultLevelId || summaries[0]?.id || "";
  const currentSummary = summaries.find((level) => level.id === currentLevelId);
  const builtIn = isBuiltInLevel(GAME_DATA, currentLevelId);
  const localOnly = isLocalOnlyLevel(GAME_DATA, currentLevelId);
  dom.levelSelect.value = currentLevelId;
  dom.levelNameInput.value = editor.data.levelLabel || editor.data.label || editor.data.currentLevelId || "";
  if (dom.levelMetaLabel) {
    const source = builtIn ? "built-in" : "local";
    const override = currentSummary?.hasOverride ? " · edited" : "";
    const defaultMark = currentLevelId === editor.data.defaultLevelId ? " · default start" : "";
    const runStartMark = currentLevelId === runStartLevelId ? " / run start" : "";
    dom.levelMetaLabel.textContent = `${source}${override}${defaultMark}${runStartMark}`;
  }
  if (dom.deleteLevelButton) {
    dom.deleteLevelButton.disabled = !localOnly;
    dom.deleteLevelButton.textContent = localOnly ? "Delete Local" : "Built-in Protected";
  }
  if (dom.playLevelLink) {
    const encodedLevelId = encodeURIComponent(currentLevelId || editor.data.defaultLevelId || "movement-lab-01");
    dom.playLevelLink.href = `./index.html?level=${encodedLevelId}&directLevel=1&localOverride=1`;
  }
}

function renderMapRoomFields(editor, dom) {
  if (!dom.mapRoomsFields) {
    return;
  }
  const rooms = ensureEditorMapRooms(editor.data);
  dom.mapRoomsFields.innerHTML = rooms.map((room, index) => `
    <div class="field-heading full">Room ${index + 1}</div>
    <label class="field">
      <span>ID</span>
      <input data-map-room-index="${index}" data-map-room-field="id" type="text" value="${escapeHtml(room.id)}">
    </label>
    <label class="field">
      <span>Label</span>
      <input data-map-room-index="${index}" data-map-room-field="label" type="text" value="${escapeHtml(room.label)}">
    </label>
    <label class="field">
      <span>X</span>
      <input data-map-room-index="${index}" data-map-room-field="x" type="number" step="1" value="${Math.round(room.x)}">
    </label>
    <label class="field">
      <span>Y</span>
      <input data-map-room-index="${index}" data-map-room-field="y" type="number" step="1" value="${Math.round(room.y)}">
    </label>
    <label class="field">
      <span>Width</span>
      <input data-map-room-index="${index}" data-map-room-field="width" type="number" min="24" step="1" value="${Math.round(room.width)}">
    </label>
    <label class="field">
      <span>Height</span>
      <input data-map-room-index="${index}" data-map-room-field="height" type="number" min="24" step="1" value="${Math.round(room.height)}">
    </label>
    <button
      type="button"
      class="ghost-button"
      data-map-room-delete="${index}"
      ${rooms.length <= 1 ? "disabled" : ""}
    >Delete Room</button>
  `).join("");
}

function applyMapRoomField(editor, dom, index, field, rawValue) {
  const rooms = ensureEditorMapRooms(editor.data);
  const room = rooms[index];
  if (!room || !["id", "label", "x", "y", "width", "height"].includes(field)) {
    return;
  }
  const before = captureEditorSnapshot(editor);
  if (field === "id" || field === "label") {
    room[field] = String(rawValue ?? "");
  } else {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return;
    }
    room[field] = field === "width" || field === "height" ? Math.max(24, value) : value;
  }

  const after = captureEditorSnapshot(editor);
  if (getSnapshotKey(before) === getSnapshotKey(after)) {
    return;
  }
  pushUndoSnapshot(editor, before);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function addMapRoom(editor, dom) {
  const before = captureEditorSnapshot(editor);
  const rooms = ensureEditorMapRooms(editor.data);
  rooms.push(createDefaultEditorMapRoom(editor.data, rooms.length));
  pushUndoSnapshot(editor, before);
  renderMapRoomFields(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function deleteMapRoom(editor, dom, index) {
  const rooms = ensureEditorMapRooms(editor.data);
  if (rooms.length <= 1 || !rooms[index]) {
    return;
  }
  const before = captureEditorSnapshot(editor);
  rooms.splice(index, 1);
  pushUndoSnapshot(editor, before);
  renderMapRoomFields(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function slugifyLevelId(value, fallback = "level") {
  const slug = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function createUniqueLevelId(editor, seed) {
  const existing = new Set(getLevelSummaries(GAME_DATA).map((level) => level.id));
  const base = slugifyLevelId(seed, "level");
  let candidate = base;
  let suffix = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function getLevelEntranceOptions(levelId) {
  if (!levelId) {
    return [{ id: "start", label: "Start" }];
  }
  try {
    const targetData = createRuntimeGameData(GAME_DATA, levelId);
    const entrances = (targetData.entrances || []).map((entrance) => ({
      id: entrance.id,
      label: entrance.label || entrance.id,
    }));
    return entrances.length ? entrances : [{ id: "start", label: "Start" }];
  } catch {
    return [{ id: "start", label: "Start" }];
  }
}

function getSpawnRect(data) {
  return {
    x: data.player.spawn.x,
    y: data.player.spawn.y,
    width: data.player.size.width,
    height: data.player.size.height,
  };
}

function getEntranceRect(entrance) {
  return {
    x: entrance.x - 18,
    y: entrance.y - 52,
    width: 36,
    height: 52,
  };
}

function syncStartEntranceToSpawn(editor) {
  const start = (editor.data.entrances || []).find((entrance) => entrance.id === "start");
  if (!start) {
    return;
  }
  start.x = editor.data.player.spawn.x;
  start.y = editor.data.player.spawn.y;
}

function getPropRect(prop) {
  if (prop.kind === "backgroundTile") {
    return {
      x: prop.x,
      y: prop.y,
      width: Math.max(8, Number(prop.width) || 64),
      height: Math.max(8, Number(prop.height) || 64),
    };
  }

  if (prop.kind === "sign") {
    return {
      x: prop.x - 44,
      y: prop.y - 64,
      width: 88,
      height: 42,
    };
  }

  return {
    x: prop.x - 20,
    y: prop.y - 20,
    width: 40,
    height: 40,
  };
}

function getEnemyRect(enemy) {
  return enemy;
}

function getDroneRect(drone) {
  return drone;
}

function getLootCrateRect(crate) {
  return crate;
}

function getBraceWallRect(wall) {
  return wall;
}

function getSelectedEntity(editor) {
  if (!editor.selected || isMultiSelection(editor.selected)) {
    return null;
  }

  if (editor.selected.kind === "platform") {
    return editor.data.platforms[editor.selected.index] || null;
  }
  if (editor.selected.kind === "braceWall") {
    return editor.data.braceWalls[editor.selected.index] || null;
  }

  if (editor.selected.kind === "prop") {
    return editor.data.props[editor.selected.index] || null;
  }
  if (editor.selected.kind === "enemy") {
    return editor.data.humanoidEnemies[editor.selected.index] || null;
  }
  if (editor.selected.kind === "drone") {
    return editor.data.hostileDrones[editor.selected.index] || null;
  }
  if (editor.selected.kind === "crate") {
    return editor.data.lootCrates[editor.selected.index] || null;
  }
  if (editor.selected.kind === "spawn") {
    return editor.data.player.spawn;
  }
  if (editor.selected.kind === "entrance") {
    return editor.data.entrances[editor.selected.index] || null;
  }
  if (editor.selected.kind === "routeExit") {
    return editor.data.routeExits[editor.selected.index] || null;
  }
  if (editor.selected.kind === "gate") {
    return editor.data.extractionGate || null;
  }

  return null;
}

function isMultiSelection(selection) {
  return selection?.kind === "multi" && Array.isArray(selection.items) && selection.items.length > 0;
}

function getSelectionItems(selection = null) {
  if (!selection) {
    return [];
  }
  return isMultiSelection(selection) ? selection.items : [selection];
}

function normalizeSelection(selection) {
  if (!selection) {
    return null;
  }

  if (!isMultiSelection(selection)) {
    return selection;
  }

  const items = [];
  const seen = new Set();
  for (const item of selection.items) {
    if (!item) {
      continue;
    }

    const key = `${item.kind}:${item.index ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(item);
  }

  if (items.length === 0) {
    return null;
  }
  if (items.length === 1) {
    return items[0];
  }

  return { kind: "multi", items };
}

function isSelectionItemSelected(selection, candidate) {
  return getSelectionItems(selection).some((item) => (
    item.kind === candidate.kind
    && item.index === candidate.index
  ));
}

function getSelectionRect(editor, selection = editor.selected) {
  if (!selection) {
    return null;
  }

  if (isMultiSelection(selection)) {
    const rects = selection.items
      .map((item) => getSelectionRect(editor, item))
      .filter(Boolean);

    if (rects.length === 0) {
      return null;
    }

    const minX = Math.min(...rects.map((rect) => rect.x));
    const minY = Math.min(...rects.map((rect) => rect.y));
    const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
    const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  if (selection.kind === "platform") {
    return editor.data.platforms[selection.index] || null;
  }
  if (selection.kind === "braceWall") {
    return editor.data.braceWalls[selection.index] || null;
  }
  if (selection.kind === "prop") {
    const prop = editor.data.props[selection.index];
    return prop ? getPropRect(prop) : null;
  }
  if (selection.kind === "enemy") {
    const enemy = editor.data.humanoidEnemies[selection.index];
    return enemy ? getEnemyRect(enemy) : null;
  }
  if (selection.kind === "drone") {
    const drone = editor.data.hostileDrones[selection.index];
    return drone ? getDroneRect(drone) : null;
  }
  if (selection.kind === "crate") {
    const crate = editor.data.lootCrates[selection.index];
    return crate ? getLootCrateRect(crate) : null;
  }
  if (selection.kind === "spawn") {
    return getSpawnRect(editor.data);
  }
  if (selection.kind === "entrance") {
    const entrance = editor.data.entrances[selection.index];
    return entrance ? getEntranceRect(entrance) : null;
  }
  if (selection.kind === "routeExit") {
    return editor.data.routeExits[selection.index] || null;
  }
  if (selection.kind === "gate") {
    return editor.data.extractionGate || null;
  }

  return null;
}

function getSelectionOrigin(editor, selection = editor.selected) {
  if (!selection) {
    return null;
  }

  if (isMultiSelection(selection)) {
    const rect = getSelectionRect(editor, selection);
    return rect ? { x: rect.x, y: rect.y } : null;
  }

  if (selection.kind === "platform") {
    const entity = editor.data.platforms[selection.index];
    return entity ? { x: entity.x, y: entity.y } : null;
  }
  if (selection.kind === "braceWall") {
    const entity = editor.data.braceWalls[selection.index];
    return entity ? { x: entity.x, y: entity.y } : null;
  }
  if (selection.kind === "prop") {
    const entity = editor.data.props[selection.index];
    return entity ? { x: entity.x, y: entity.y } : null;
  }
  if (selection.kind === "enemy") {
    const entity = editor.data.humanoidEnemies[selection.index];
    return entity ? { x: entity.x, y: entity.y } : null;
  }
  if (selection.kind === "drone") {
    const entity = editor.data.hostileDrones[selection.index];
    return entity ? { x: entity.x, y: entity.y } : null;
  }
  if (selection.kind === "crate") {
    const entity = editor.data.lootCrates[selection.index];
    return entity ? { x: entity.x, y: entity.y } : null;
  }
  if (selection.kind === "spawn") {
    return { x: editor.data.player.spawn.x, y: editor.data.player.spawn.y };
  }
  if (selection.kind === "entrance") {
    const entrance = editor.data.entrances[selection.index];
    return entrance ? { x: entrance.x, y: entrance.y } : null;
  }
  if (selection.kind === "routeExit") {
    const routeExit = editor.data.routeExits[selection.index];
    return routeExit ? { x: routeExit.x, y: routeExit.y } : null;
  }
  if (selection.kind === "gate") {
    return editor.data.extractionGate
      ? { x: editor.data.extractionGate.x, y: editor.data.extractionGate.y }
      : null;
  }

  return null;
}

function getSelectionOrigins(editor, selection = editor.selected) {
  return getSelectionItems(selection)
    .map((item) => {
      const origin = getSelectionOrigin(editor, item);
      if (!origin) {
        return null;
      }
      return { selection: item, origin };
    })
    .filter(Boolean);
}

function describeSelection(editor) {
  const scale = getScaleConfig(editor.data);

  if (editor.selected?.kind === "entrance") {
    const entrance = editor.data.entrances[editor.selected.index];
    return entrance ? `Entrance · ${entrance.id}` : "No selection";
  }

  if (editor.selected?.kind === "routeExit") {
    const routeExit = editor.data.routeExits[editor.selected.index];
    return routeExit ? `Route Exit · ${routeExit.toLevelId || "no target"}` : "No selection";
  }

  if (editor.selected?.kind === "gate" && !editor.data.extractionGate) {
    return "Extraction Gate 없음";
  }

  if (!editor.selected) {
    return `선택 없음 · 스냅 ${editor.snap}`;
  }

  if (editor.selected.kind === "enemy") {
    const enemy = editor.data.humanoidEnemies[editor.selected.index];
    return enemy ? `Enemy ${editor.selected.index + 1} - ${enemy.label || enemy.id || "humanoid"}` : "No selection";
  }

  if (editor.selected.kind === "drone") {
    const drone = editor.data.hostileDrones[editor.selected.index];
    return drone ? `Drone ${editor.selected.index + 1} - ${drone.id || "hostile drone"}` : "No selection";
  }

  if (editor.selected.kind === "crate") {
    const crate = editor.data.lootCrates[editor.selected.index];
    return crate ? `Crate ${editor.selected.index + 1} - ${crate.label || crate.id || "loot crate"}` : "No selection";
  }

  if (isMultiSelection(editor.selected)) {
    const items = getSelectionItems(editor.selected);
    const platformCount = items.filter((item) => item.kind === "platform").length;
    const braceWallCount = items.filter((item) => item.kind === "braceWall").length;
    const propCount = items.filter((item) => item.kind === "prop").length;
    const crateCount = items.filter((item) => item.kind === "crate").length;
    const parts = [];
    if (braceWallCount > 0) {
      parts.push(`벽 짚기 ${braceWallCount}`);
    }
    if (platformCount > 0) {
      parts.push(`플랫폼 ${platformCount}`);
    }
    if (propCount > 0) {
      parts.push(`소품 ${propCount}`);
    }
    if (crateCount > 0) {
      parts.push(`Crate ${crateCount}`);
    }
    return `${items.length}개 선택${parts.length ? ` · ${parts.join(", ")}` : ""}`;
  }

  if (editor.selected.kind === "platform") {
    const platform = editor.data.platforms[editor.selected.index];
    if (!platform) {
      return "선택 없음";
    }
    const platformLabel = platform.kind === "slope" ? "경사로" : "플랫폼";
    return `${platformLabel} ${editor.selected.index + 1} · ${formatTiles(platform.width, scale.tileSize)} × ${formatTiles(platform.height, scale.tileSize)}`;
  }

  if (editor.selected.kind === "braceWall") {
    const wall = editor.data.braceWalls[editor.selected.index];
    if (!wall) {
      return "선택 없음";
    }
    return `벽 짚기 ${editor.selected.index + 1} · ${formatTiles(wall.width, scale.tileSize)} × ${formatTiles(wall.height, scale.tileSize)}`;
  }

  if (editor.selected.kind === "prop") {
    const prop = editor.data.props[editor.selected.index];
    if (prop?.kind === "backgroundTile") {
      return `Background tile ${editor.selected.index + 1}`;
    }
    return prop?.kind === "sign"
      ? `표지 ${editor.selected.index + 1}`
      : `랜턴 ${editor.selected.index + 1}`;
  }

  if (editor.selected.kind === "spawn") {
    return `스폰 · ${formatTiles(editor.data.player.size.width, scale.tileSize)} × ${formatTiles(editor.data.player.size.height, scale.tileSize)}`;
  }

  if (editor.selected.kind === "gate") {
    return `출구 · ${formatTiles(editor.data.extractionGate.width, scale.tileSize)} × ${formatTiles(editor.data.extractionGate.height, scale.tileSize)}`;
  }

  return "선택 없음";
}

function canDeleteSelection(selection) {
  const items = getSelectionItems(selection);
  return items.length > 0 && items.every((item) => (
    item.kind === "platform"
    || item.kind === "braceWall"
    || item.kind === "prop"
    || item.kind === "crate"
    || item.kind === "enemy"
    || item.kind === "drone"
    || item.kind === "routeExit"
    || (item.kind === "entrance" && item.index > 0)
  ));
}

function renderSelectionFields(editor, dom) {
  dom.selectionLabel.textContent = describeSelection(editor);
  dom.deleteSelectionButton.disabled = !editor.selected || !canDeleteSelection(editor.selected);

  if (!editor.selected) {
    dom.selectionFields.innerHTML = "";
    return;
  }

  if (isMultiSelection(editor.selected)) {
    dom.selectionFields.innerHTML = `<p class="selection-note">여러 개 선택됨. 이동, 방향키, Delete를 바로 쓸 수 있다.</p>`;
    return;
  }

  const entity = getSelectedEntity(editor);
  if (!entity) {
    dom.selectionFields.innerHTML = "";
    return;
  }

  const fields = [];

  const addNumber = (label, field, value, options = {}) => {
    const attributes = [
      `type="number"`,
      `step="${options.step ?? 1}"`,
      `data-field="${field}"`,
      `value="${Math.round(Number(value) * 100) / 100}"`,
    ];
    if (options.min !== undefined) {
      attributes.push(`min="${options.min}"`);
    }
    if (options.max !== undefined) {
      attributes.push(`max="${options.max}"`);
    }
    fields.push(`<label class="field"><span>${label}</span><input ${attributes.join(" ")}></label>`);
  };

  const addColor = (label, field, value) => {
    fields.push(`<label class="field"><span>${label}</span><input type="color" data-field="${field}" value="${escapeHtml(value)}"></label>`);
  };

  const addText = (label, field, value) => {
    fields.push(`<label class="field full"><span>${label}</span><input type="text" data-field="${field}" value="${escapeHtml(value)}"></label>`);
  };

  const addSelect = (label, field, value, options) => {
    const safeValue = String(value || "");
    const optionList = [...options];
    if (safeValue && !optionList.some((option) => option.value === safeValue)) {
      optionList.push({ value: safeValue, label: `Missing: ${safeValue}` });
    }
    fields.push(`
      <label class="field full">
        <span>${label}</span>
        <select data-field="${field}">
          ${optionList.map((option) => `
            <option value="${escapeHtml(option.value)}"${option.value === safeValue ? " selected" : ""}>${escapeHtml(option.label)}</option>
          `).join("")}
        </select>
      </label>
    `);
  };

  if (editor.selected.kind === "platform") {
    addSelect("Type", "kind", entity.kind || "solid", [
      { value: "solid", label: "Solid block" },
      { value: "slope", label: "Slope block" },
    ]);
    if (entity.kind === "slope") {
      addSelect("Slope", "slopeDirection", getPlatformSlopeDirection(entity), [
        { value: "down-right", label: "Down right" },
        { value: "up-right", label: "Up right" },
      ]);
    }
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    addNumber("가로", "width", entity.width, { min: 12 });
    addNumber("세로", "height", entity.height, { min: 12 });
    addColor("색", "color", entity.color);
  } else if (editor.selected.kind === "braceWall") {
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    addNumber("폭", "width", entity.width, { min: 12 });
    addNumber("높이", "height", entity.height, { min: 12 });
  } else if (editor.selected.kind === "prop") {
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    if (entity.kind === "sign") {
      addText("문구", "text", entity.text || "");
    }
    if (entity.kind === "backgroundTile") {
      addNumber("Width", "width", entity.width, { min: 8 });
      addNumber("Height", "height", entity.height, { min: 8 });
      addColor("Color", "color", entity.color || "#4f6f7d");
    }
  } else if (editor.selected.kind === "enemy") {
    addText("ID", "id", entity.id || "");
    addText("Label", "label", entity.label || "");
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    addNumber("Width", "width", entity.width, { min: 12 });
    addNumber("Height", "height", entity.height, { min: 12 });
    addNumber("HP", "maxHp", entity.maxHp ?? 140, { min: 1 });
    addNumber("Damage", "damage", entity.damage ?? 12, { min: 0 });
    addNumber("Fire Range", "fireRange", entity.fireRange ?? 760, { min: 0 });
    addNumber("Patrol L", "patrol.left", entity.patrol?.left ?? entity.x);
    addNumber("Patrol R", "patrol.right", entity.patrol?.right ?? entity.x + 220);
  } else if (editor.selected.kind === "drone") {
    addText("ID", "id", entity.id || "");
    addSelect("Visual", "visualKind", entity.visualKind || "crow", [
      { value: "crow", label: "Crow" },
    ]);
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    addNumber("Width", "width", entity.width, { min: 12 });
    addNumber("Height", "height", entity.height, { min: 12 });
    addNumber("HP", "maxHp", entity.maxHp ?? 2, { min: 1 });
    addNumber("Damage", "damage", entity.damage ?? 10, { min: 0 });
    addNumber("Fire Range", "fireRange", entity.fireRange ?? 760, { min: 0 });
    addNumber("Patrol L", "patrol.left", entity.patrol?.left ?? entity.x);
    addNumber("Patrol R", "patrol.right", entity.patrol?.right ?? entity.x + 360);
  } else if (editor.selected.kind === "crate") {
    addText("ID", "id", entity.id || "");
    addText("Label", "label", entity.label || "");
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    addNumber("Width", "width", entity.width, { min: 24 });
    addNumber("Height", "height", entity.height, { min: 24 });
    addText("Prompt", "prompt", entity.prompt || "");
    addText("Loot Table", "lootTable", entity.lootTable || "streetCache");
    addNumber("Search Time", "searchTime", entity.searchTime ?? 0.75, { min: 0, step: 0.05 });
  } else if (editor.selected.kind === "spawn") {
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
  } else if (editor.selected.kind === "entrance") {
    addText("ID", "id", entity.id || "");
    addText("Label", "label", entity.label || "");
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    addNumber("Facing", "facing", entity.facing ?? 1, { min: -1, max: 1 });
  } else if (editor.selected.kind === "routeExit") {
    addText("ID", "id", entity.id || "");
    addText("Label", "label", entity.label || "");
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    addNumber("Width", "width", entity.width, { min: 24 });
    addNumber("Height", "height", entity.height, { min: 24 });
    addText("Prompt", "prompt", entity.prompt || "");
    const levelOptions = getLevelSummaries(GAME_DATA).map((level) => ({
      value: level.id,
      label: level.label || level.id,
    }));
    const targetLevelId = entity.toLevelId || levelOptions[0]?.value || "";
    const entranceOptions = getLevelEntranceOptions(targetLevelId).map((entrance) => ({
      value: entrance.id,
      label: entrance.label || entrance.id,
    }));
    addSelect("To Level", "toLevelId", targetLevelId, levelOptions);
    addSelect("To Entrance", "toEntranceId", entity.toEntranceId || entranceOptions[0]?.value || "start", entranceOptions);
  } else if (editor.selected.kind === "gate") {
    addNumber("X", "x", entity.x);
    addNumber("Y", "y", entity.y);
    addNumber("가로", "width", entity.width, { min: 24 });
    addNumber("세로", "height", entity.height, { min: 24 });
    addText("프롬프트", "prompt", entity.prompt || "");
  }

  dom.selectionFields.innerHTML = fields.join("");
}

function renderPlayerRenderFields(editor, dom) {
  const render = getPlayerRenderConfig(editor.data);
  const fields = [];

  const addNumber = (label, field, value, options = {}) => {
    const attributes = [
      `type="number"`,
      `step="${options.step ?? 0.01}"`,
      `data-render-field="${field}"`,
      `value="${(Number(value ?? 0) || 0).toFixed(2)}"`,
    ];
    if (options.min !== undefined) {
      attributes.push(`min="${options.min}"`);
    }
    if (options.max !== undefined) {
      attributes.push(`max="${options.max}"`);
    }
    fields.push(`<label class="field"><span>${label}</span><input ${attributes.join(" ")}></label>`);
  };

  fields.push(`<div class="field-heading">Base</div>`);
  addNumber("폭 기본값", "widthRatio", render.widthRatio ?? 1, { min: 0.1 });
  addNumber("높이 기본값", "heightRatio", render.heightRatio ?? 1, { min: 0.1 });

  PLAYER_RENDER_GROUPS.forEach(([pose, label]) => {
    fields.push(`<div class="field-heading">${label}</div>`);
    addNumber("폭 비율", `${pose}WidthRatio`, render[`${pose}WidthRatio`] ?? 1, { min: 0.1 });
    addNumber("높이 비율", `${pose}HeightRatio`, render[`${pose}HeightRatio`] ?? 1, { min: 0.1 });
    addNumber("앵커 X", `${pose}AnchorX`, render[`${pose}AnchorX`] ?? 0.5, {
      min: 0,
      max: 1,
    });
  });

  fields.push(`<div class="field-heading">Global</div>`);
  addNumber("발 기준 Y", "footAnchorY", render.footAnchorY ?? 0.98, { min: 0, max: 1.5 });

  dom.playerRenderFields.innerHTML = fields.join("");
}

function renderPlayerPreviewPoseOptions(editor, dom) {
  if (!dom.playerPreviewPose) {
    return;
  }

  const availablePoses = new Set(PLAYER_RENDER_GROUPS.map(([pose]) => pose));
  if (!availablePoses.has(editor.previewPose)) {
    editor.previewPose = "idle";
  }

  dom.playerPreviewPose.innerHTML = PLAYER_RENDER_GROUPS
    .map(([pose, label]) => `<option value="${pose}">${label}</option>`)
    .join("");
  dom.playerPreviewPose.value = editor.previewPose;
}

function renderHudLayoutFields(editor, dom) {
  const layout = getUiLayoutConfig(editor.data);
  const fields = [];

  HUD_LAYOUT_GROUPS.forEach((groupDef) => {
    fields.push(`<div class="field-heading">${groupDef.title}</div>`);
    groupDef.fields.forEach(([field, label]) => {
      const value = layout[groupDef.group]?.[field] ?? 0;
      fields.push(
        `<label class="field"><span>${label}</span><input type="number" step="1" min="0" data-layout-group="${groupDef.group}" data-layout-field="${field}" value="${Math.round(value)}"></label>`,
      );
    });
  });

  dom.hudLayoutFields.innerHTML = fields.join("");
}

function getToolShortcutLabel(tool) {
  return TOOL_SHORTCUT_LABELS[tool] || "";
}

function getToolHint(tool) {
  const shortcut = getToolShortcutLabel(tool);
  const hint = TOOL_HINTS[tool] || "";
  return shortcut && hint ? `${shortcut}: ${hint}` : hint;
}

function isTextEditingTarget(target) {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target instanceof HTMLElement && target.isContentEditable;
}

function renderToolShortcutLabels(dom) {
  dom.toolButtons.forEach((button) => {
    const shortcut = getToolShortcutLabel(button.dataset.tool);
    if (!shortcut) {
      return;
    }
    const label = button.dataset.originalLabel || button.textContent.trim();
    button.dataset.originalLabel = label;
    button.dataset.shortcut = shortcut;
    button.title = `${shortcut}: ${label}`;
    button.textContent = `${shortcut} ${label}`;
  });
}

function handleToolShortcut(editor, dom, event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    return false;
  }
  const tool = TOOL_SHORTCUTS[event.code];
  if (!tool) {
    return false;
  }
  event.preventDefault();
  setTool(editor, dom, tool);
  return true;
}

function setTool(editor, dom, tool) {
  editor.tool = tool;
  dom.toolButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  });
  dom.toolHint.textContent = getToolHint(tool);
}

function setAllPanelsOpen(dom, isOpen) {
  dom.collapsiblePanels.forEach((panel) => {
    panel.open = isOpen;
  });
}

function setSelection(editor, dom, selection) {
  editor.selected = normalizeSelection(selection);
  renderSelectionFields(editor, dom);
  queueRender(editor, dom);
}

function fitViewToWorld(editor, dom) {
  const padding = 80;
  const zoom = clamp(
    Math.min(
      (editor.view.width - padding * 2) / editor.data.world.width,
      (editor.view.height - padding * 2) / editor.data.world.height,
    ),
    0.08,
    1.6,
  );

  editor.view.zoom = zoom;
  editor.view.x = editor.data.world.width / 2 - editor.view.width / (2 * zoom);
  editor.view.y = editor.data.world.height / 2 - editor.view.height / (2 * zoom);
  queueRender(editor, dom);
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height
  );
}

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
  );
}

function getRectFromPoints(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function getSelectionsInRect(editor, rect) {
  const items = [];

  (editor.data.routeExits || []).forEach((routeExit, index) => {
    if (rectsIntersect(rect, routeExit)) {
      items.push({ kind: "routeExit", index });
    }
  });

  (editor.data.entrances || []).forEach((entrance, index) => {
    if (rectsIntersect(rect, getEntranceRect(entrance))) {
      items.push({ kind: "entrance", index });
    }
  });

  editor.data.braceWalls.forEach((wall, index) => {
    if (rectsIntersect(rect, getBraceWallRect(wall))) {
      items.push({ kind: "braceWall", index });
    }
  });

  editor.data.props.forEach((prop, index) => {
    if (rectsIntersect(rect, getPropRect(prop))) {
      items.push({ kind: "prop", index });
    }
  });

  (editor.data.humanoidEnemies || []).forEach((enemy, index) => {
    if (rectsIntersect(rect, getEnemyRect(enemy))) {
      items.push({ kind: "enemy", index });
    }
  });

  (editor.data.hostileDrones || []).forEach((drone, index) => {
    if (rectsIntersect(rect, getDroneRect(drone))) {
      items.push({ kind: "drone", index });
    }
  });

  (editor.data.lootCrates || []).forEach((crate, index) => {
    if (rectsIntersect(rect, getLootCrateRect(crate))) {
      items.push({ kind: "crate", index });
    }
  });

  editor.data.platforms.forEach((platform, index) => {
    if (rectsIntersect(rect, platform)) {
      items.push({ kind: "platform", index });
    }
  });

  return normalizeSelection({ kind: "multi", items });
}

function hitTest(editor, point) {
  if (pointInRect(point, getSpawnRect(editor.data))) {
    return { kind: "spawn" };
  }
  if (editor.data.extractionGate && pointInRect(point, editor.data.extractionGate)) {
    return { kind: "gate" };
  }

  for (let index = editor.data.routeExits.length - 1; index >= 0; index -= 1) {
    if (pointInRect(point, editor.data.routeExits[index])) {
      return { kind: "routeExit", index };
    }
  }

  for (let index = editor.data.entrances.length - 1; index >= 0; index -= 1) {
    if (pointInRect(point, getEntranceRect(editor.data.entrances[index]))) {
      return { kind: "entrance", index };
    }
  }

  for (let index = editor.data.props.length - 1; index >= 0; index -= 1) {
    if (pointInRect(point, getPropRect(editor.data.props[index]))) {
      return { kind: "prop", index };
    }
  }

  for (let index = (editor.data.hostileDrones || []).length - 1; index >= 0; index -= 1) {
    if (pointInRect(point, getDroneRect(editor.data.hostileDrones[index]))) {
      return { kind: "drone", index };
    }
  }

  for (let index = (editor.data.humanoidEnemies || []).length - 1; index >= 0; index -= 1) {
    if (pointInRect(point, getEnemyRect(editor.data.humanoidEnemies[index]))) {
      return { kind: "enemy", index };
    }
  }

  for (let index = (editor.data.lootCrates || []).length - 1; index >= 0; index -= 1) {
    if (pointInRect(point, getLootCrateRect(editor.data.lootCrates[index]))) {
      return { kind: "crate", index };
    }
  }

  for (let index = editor.data.braceWalls.length - 1; index >= 0; index -= 1) {
    if (pointInRect(point, getBraceWallRect(editor.data.braceWalls[index]))) {
      return { kind: "braceWall", index };
    }
  }

  for (let index = editor.data.platforms.length - 1; index >= 0; index -= 1) {
    if (pointInRect(point, editor.data.platforms[index])) {
      return { kind: "platform", index };
    }
  }

  return null;
}

function screenToWorld(editor, screenX, screenY) {
  return {
    x: screenX / editor.view.zoom + editor.view.x,
    y: screenY / editor.view.zoom + editor.view.y,
  };
}

function getCanvasPoint(dom, event) {
  const rect = dom.canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function deleteSelection(editor, dom) {
  if (!editor.selected) {
    return;
  }

  const items = getSelectionItems(editor.selected);
  const platformIndexes = new Set(
    items.filter((item) => item.kind === "platform").map((item) => item.index),
  );
  const braceWallIndexes = new Set(
    items.filter((item) => item.kind === "braceWall").map((item) => item.index),
  );
  const propIndexes = new Set(
    items.filter((item) => item.kind === "prop").map((item) => item.index),
  );
  const enemyIndexes = new Set(
    items.filter((item) => item.kind === "enemy").map((item) => item.index),
  );
  const droneIndexes = new Set(
    items.filter((item) => item.kind === "drone").map((item) => item.index),
  );
  const crateIndexes = new Set(
    items.filter((item) => item.kind === "crate").map((item) => item.index),
  );
  const routeExitIndexes = new Set(
    items.filter((item) => item.kind === "routeExit").map((item) => item.index),
  );
  const entranceIndexes = new Set(
    items.filter((item) => item.kind === "entrance" && item.index > 0).map((item) => item.index),
  );

  if (
    platformIndexes.size === 0
    && braceWallIndexes.size === 0
    && propIndexes.size === 0
    && enemyIndexes.size === 0
    && droneIndexes.size === 0
    && crateIndexes.size === 0
    && routeExitIndexes.size === 0
    && entranceIndexes.size === 0
  ) {
    return;
  }

  pushUndo(editor);

  editor.data.platforms = editor.data.platforms.filter((_, index) => !platformIndexes.has(index));
  editor.data.braceWalls = editor.data.braceWalls.filter((_, index) => !braceWallIndexes.has(index));
  editor.data.props = editor.data.props.filter((_, index) => !propIndexes.has(index));
  editor.data.humanoidEnemies = editor.data.humanoidEnemies.filter((_, index) => !enemyIndexes.has(index));
  editor.data.hostileDrones = editor.data.hostileDrones.filter((_, index) => !droneIndexes.has(index));
  editor.data.lootCrates = editor.data.lootCrates.filter((_, index) => !crateIndexes.has(index));
  editor.data.routeExits = editor.data.routeExits.filter((_, index) => !routeExitIndexes.has(index));
  editor.data.entrances = editor.data.entrances.filter((_, index) => !entranceIndexes.has(index));

  editor.selected = null;
  renderSelectionFields(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function updateWorldFromInputs(editor, dom) {
  const scale = getScaleConfig(editor.data);
  const nextWidth = Math.max(scale.tileSize * 20, Number(dom.worldWidthInput.value) || editor.data.world.width);
  const nextHeight = Math.max(scale.tileSize * 10, Number(dom.worldHeightInput.value) || editor.data.world.height);
  const nextGroundY = Math.max(0, Number(dom.groundYInput.value) || editor.data.world.groundY);
  const nextSnap = Math.max(1, Number(dom.snapInput.value) || editor.snap);
  const nextZoom = clamp(Number(dom.cameraZoomInput.value) || getEditorCameraZoom(editor.data), 0.5, 2.5);

  if (
    nextWidth === editor.data.world.width
    && nextHeight === editor.data.world.height
    && nextGroundY === editor.data.world.groundY
    && nextSnap === editor.snap
    && nextZoom === getEditorCameraZoom(editor.data)
  ) {
    syncWorldInputs(editor, dom);
    return;
  }

  pushUndo(editor);
  editor.data.world.width = nextWidth;
  editor.data.world.height = nextHeight;
  editor.data.world.groundY = nextGroundY;
  editor.snap = nextSnap;
  editor.data.world.camera = {
    ...editor.data.world.camera,
    zoom: nextZoom,
  };
  syncWorldInputs(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function applyCameraTuningField(editor, dom, fieldKey, rawValue) {
  const field = CAMERA_TUNING_FIELD_MAP.get(fieldKey);
  if (!field) {
    return;
  }

  const camera = editor.data.world.camera || {};
  const nextValue = clampCameraFieldValue(rawValue, field);
  if (nextValue === null) {
    renderCameraTuningFields(editor, dom);
    return;
  }

  const currentValue = getCameraTuningValue(camera, field);
  if (currentValue === nextValue) {
    renderCameraTuningFields(editor, dom);
    return;
  }

  pushUndo(editor);
  editor.data.world.camera = {
    ...camera,
    [field.key]: nextValue,
  };
  renderCameraTuningFields(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function applySelectionField(editor, dom, field, value) {
  const entity = getSelectedEntity(editor);
  if (!entity) {
    return;
  }

  if (
    field === "color"
    || field === "kind"
    || field === "slopeDirection"
    || field === "text"
    || field === "prompt"
    || field === "id"
    || field === "label"
    || field === "visualKind"
    || field === "lootTable"
    || field === "toLevelId"
    || field === "toEntranceId"
  ) {
    if (entity[field] === value) {
      return;
    }
    pushUndo(editor);
    if (field === "kind") {
      if (value === "slope") {
        entity.kind = "slope";
        entity.slopeDirection = getPlatformSlopeDirection(entity);
      } else {
        delete entity.kind;
        delete entity.slopeDirection;
      }
    } else if (field === "slopeDirection") {
      if (editor.selected?.kind !== "platform" || entity.kind !== "slope") {
        renderSelectionFields(editor, dom);
        return;
      }
      entity.slopeDirection = value === "up-right" ? "up-right" : "down-right";
      entity.kind = "slope";
    } else {
      entity[field] = value;
    }
    if (editor.selected?.kind === "routeExit" && field === "toLevelId") {
      const entrances = getLevelEntranceOptions(value);
      if (!entrances.some((entrance) => entrance.id === entity.toEntranceId)) {
        entity.toEntranceId = entrances[0]?.id || "start";
      }
    }
    renderSelectionFields(editor, dom);
    markDirty(editor, dom);
    queueRender(editor, dom);
    return;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return;
  }

  if (field.includes(".")) {
    const [group, key] = field.split(".");
    if (!group || !key) {
      return;
    }
    const currentGroup = entity[group] && typeof entity[group] === "object" ? entity[group] : {};
    if (currentGroup[key] === numericValue) {
      return;
    }
    pushUndo(editor);
    entity[group] = {
      ...currentGroup,
      [key]: numericValue,
    };
    renderSelectionFields(editor, dom);
    markDirty(editor, dom);
    queueRender(editor, dom);
    return;
  }

  let nextValue = numericValue;
  if (field === "width" || field === "height") {
    nextValue = Math.max(12, numericValue);
  }

  if (
    (editor.selected?.kind === "gate" || editor.selected?.kind === "routeExit")
    && (field === "width" || field === "height")
  ) {
    nextValue = Math.max(24, numericValue);
  }

  if (editor.selected?.kind === "entrance" && field === "facing") {
    nextValue = Math.sign(numericValue) || 1;
  }

  if (entity[field] === nextValue) {
    return;
  }

  pushUndo(editor);
  entity[field] = nextValue;
  if (editor.selected?.kind === "spawn" && (field === "x" || field === "y")) {
    syncStartEntranceToSpawn(editor);
  }
  renderSelectionFields(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function applyPlayerRenderField(editor, dom, field, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return;
  }

  const render = editor.data.player.render;
  const isAnchor = field.endsWith("AnchorX");
  const isFoot = field === "footAnchorY";
  const minimum = isAnchor || isFoot ? 0 : 0.1;
  const maximum = isAnchor ? 1 : (isFoot ? 1.5 : Number.POSITIVE_INFINITY);
  const nextValue = clamp(numericValue, minimum, maximum);
  if (render[field] === nextValue) {
    return;
  }

  pushUndo(editor);
  render[field] = nextValue;

  renderPlayerRenderFields(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function applyHudLayoutField(editor, dom, group, field, value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return;
  }

  if (!editor.data.ui.layout[group]) {
    editor.data.ui.layout[group] = {};
  }
  const nextValue = Math.max(0, numericValue);
  if (editor.data.ui.layout[group][field] === nextValue) {
    return;
  }

  pushUndo(editor);
  editor.data.ui.layout[group][field] = nextValue;
  renderHudLayoutFields(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function moveSelectionTo(editor, dom, selection, x, y, step = editor.snap, options = {}) {
  const {
    syncUi = true,
    touchDirty = true,
  } = options;
  const snappedX = snapValue(x, step);
  const snappedY = snapValue(y, step);

  if (selection.kind === "platform") {
    const entity = editor.data.platforms[selection.index];
    if (!entity) {
      return;
    }
    entity.x = snappedX;
    entity.y = snappedY;
  } else if (selection.kind === "braceWall") {
    const entity = editor.data.braceWalls[selection.index];
    if (!entity) {
      return;
    }
    entity.x = snappedX;
    entity.y = snappedY;
  } else if (selection.kind === "prop") {
    const entity = editor.data.props[selection.index];
    if (!entity) {
      return;
    }
    entity.x = snappedX;
    entity.y = snappedY;
  } else if (selection.kind === "enemy") {
    const entity = editor.data.humanoidEnemies[selection.index];
    if (!entity) {
      return;
    }
    const deltaX = snappedX - entity.x;
    entity.x = snappedX;
    entity.y = snappedY;
    if (entity.patrol) {
      if (Number.isFinite(entity.patrol.left)) {
        entity.patrol.left += deltaX;
      }
      if (Number.isFinite(entity.patrol.right)) {
        entity.patrol.right += deltaX;
      }
    }
  } else if (selection.kind === "drone") {
    const entity = editor.data.hostileDrones[selection.index];
    if (!entity) {
      return;
    }
    const deltaX = snappedX - entity.x;
    entity.x = snappedX;
    entity.y = snappedY;
    if (entity.patrol) {
      if (Number.isFinite(entity.patrol.left)) {
        entity.patrol.left += deltaX;
      }
      if (Number.isFinite(entity.patrol.right)) {
        entity.patrol.right += deltaX;
      }
    }
  } else if (selection.kind === "crate") {
    const entity = editor.data.lootCrates[selection.index];
    if (!entity) {
      return;
    }
    entity.x = snappedX;
    entity.y = snappedY;
  } else if (selection.kind === "spawn") {
    editor.data.player.spawn.x = snappedX;
    editor.data.player.spawn.y = snappedY;
    syncStartEntranceToSpawn(editor);
  } else if (selection.kind === "entrance") {
    const entity = editor.data.entrances[selection.index];
    if (!entity) {
      return;
    }
    entity.x = snappedX;
    entity.y = snappedY;
  } else if (selection.kind === "routeExit") {
    const entity = editor.data.routeExits[selection.index];
    if (!entity) {
      return;
    }
    entity.x = snappedX;
    entity.y = snappedY;
  } else if (selection.kind === "gate") {
    if (!editor.data.extractionGate) {
      return;
    }
    editor.data.extractionGate.x = snappedX;
    editor.data.extractionGate.y = snappedY;
  }

  if (syncUi) {
    renderSelectionFields(editor, dom);
  }

  if (touchDirty) {
    markDirty(editor, dom);
  }
}

function moveSelectionsByDelta(editor, dom, origins, deltaX, deltaY, step = 1, options = {}) {
  const {
    syncUi = true,
    touchDirty = true,
  } = options;

  if (!origins.length) {
    return;
  }

  origins.forEach(({ selection, origin }) => {
    moveSelectionTo(
      editor,
      dom,
      selection,
      origin.x + deltaX,
      origin.y + deltaY,
      step,
      { syncUi: false, touchDirty: false },
    );
  });

  if (syncUi) {
    renderSelectionFields(editor, dom);
  }

  if (touchDirty) {
    markDirty(editor, dom);
  }
}

function createPlatformFromPreview(editor, dom) {
  if (!editor.preview || editor.preview.kind !== "platform") {
    return;
  }

  pushUndo(editor);

  const rect = getPreviewPlatformRect(editor);
  if (!rect) {
    return;
  }

  const platform = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: getDefaultPlatform(getScaleConfig(editor.data)).color,
  };
  if (rect.kind === "slope") {
    platform.kind = "slope";
    platform.slopeDirection = getPlatformSlopeDirection(rect);
  }

  editor.data.platforms.push(platform);
  setSelection(editor, dom, { kind: "platform", index: editor.data.platforms.length - 1 });
  markDirty(editor, dom);
}

function createBraceWallFromPreview(editor, dom) {
  if (!editor.preview || editor.preview.kind !== "braceWall") {
    return;
  }

  pushUndo(editor);

  const start = editor.preview.start;
  const end = editor.preview.end;
  const wall = {
    id: `brace-${Date.now()}`,
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.max(12, Math.abs(end.x - start.x) || 32),
    height: Math.max(12, Math.abs(end.y - start.y) || 160),
  };

  editor.data.braceWalls.push(wall);
  setSelection(editor, dom, { kind: "braceWall", index: editor.data.braceWalls.length - 1 });
  markDirty(editor, dom);
}

function createBackgroundTileFromPreview(editor, dom) {
  if (!editor.preview || editor.preview.kind !== "backgroundTile") {
    return;
  }

  pushUndo(editor);

  const rect = getPreviewBackgroundTileRect(editor);
  if (!rect) {
    return;
  }

  const prop = {
    kind: "backgroundTile",
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: "#4f6f7d",
  };
  editor.data.props.push(prop);
  setSelection(editor, dom, { kind: "prop", index: editor.data.props.length - 1 });
  markDirty(editor, dom);
}

function placeProp(editor, dom, kind, point) {
  pushUndo(editor);
  const snapped = snapPoint(point, editor.snap);
  const prop = kind === "sign"
    ? { kind, x: snapped.x, y: snapped.y, text: "표지" }
    : { kind, x: snapped.x, y: snapped.y };
  editor.data.props.push(prop);
  setSelection(editor, dom, { kind: "prop", index: editor.data.props.length - 1 });
  markDirty(editor, dom);
}

function placeSpawnAt(editor, dom, point) {
  pushUndo(editor);
  const rect = getSpawnRect(editor.data);
  const snapped = snapPoint({
    x: point.x - rect.width / 2,
    y: point.y - rect.height,
  }, editor.snap);
  editor.data.player.spawn.x = snapped.x;
  editor.data.player.spawn.y = snapped.y;
  syncStartEntranceToSpawn(editor);
  setSelection(editor, dom, { kind: "spawn" });
  markDirty(editor, dom);
}

function placeEntranceAt(editor, dom, point) {
  pushUndo(editor);
  const snapped = snapPoint(point, editor.snap);
  const entrance = {
    id: `entrance-${Date.now()}`,
    label: "Entrance",
    x: snapped.x,
    y: snapped.y,
    facing: 1,
  };
  editor.data.entrances.push(entrance);
  setSelection(editor, dom, { kind: "entrance", index: editor.data.entrances.length - 1 });
  markDirty(editor, dom);
}

function getDefaultRouteTarget(editor) {
  const currentId = editor.data.currentLevelId;
  const target = getLevelSummaries(GAME_DATA).find((level) => level.id !== currentId);
  return target?.id || currentId || editor.data.defaultLevelId || "movement-lab-01";
}

function placeRouteExitAt(editor, dom, point) {
  pushUndo(editor);
  const width = 96;
  const height = 192;
  const snapped = snapPoint({
    x: point.x - width / 2,
    y: point.y - height,
  }, editor.snap);
  const routeExit = {
    id: `route-exit-${Date.now()}`,
    label: "Route Exit",
    x: snapped.x,
    y: snapped.y,
    width,
    height,
    prompt: "E: 다음 구역",
    toLevelId: getDefaultRouteTarget(editor),
    toEntranceId: "start",
  };
  editor.data.routeExits.push(routeExit);
  setSelection(editor, dom, { kind: "routeExit", index: editor.data.routeExits.length - 1 });
  markDirty(editor, dom);
}

function placeEnemyAt(editor, dom, point) {
  pushUndo(editor);
  const width = 58;
  const height = 104;
  const snapped = snapPoint({
    x: point.x - width / 2,
    y: point.y - height,
  }, editor.snap);
  const enemy = {
    id: `enemy-${Date.now()}`,
    type: "humanoidEnemy",
    label: "Enemy",
    x: snapped.x,
    y: snapped.y,
    width,
    height,
    maxHp: 140,
    damage: 12,
    fireRange: 760,
    triggerRate: 10,
    rangedProjectile: true,
    projectileDamage: 12,
    projectileSpeed: 820,
    projectileRadius: 8,
    projectileLife: 2.1,
    projectileColor: "#ffbe66",
    knockdownEnabled: true,
    patrol: {
      left: snapped.x - 110,
      right: snapped.x + 220,
    },
  };
  editor.data.humanoidEnemies.push(enemy);
  setSelection(editor, dom, { kind: "enemy", index: editor.data.humanoidEnemies.length - 1 });
  markDirty(editor, dom);
}

function placeDroneAt(editor, dom, point) {
  pushUndo(editor);
  const width = 144;
  const height = 92;
  const snapped = snapPoint({
    x: point.x - width / 2,
    y: point.y - height / 2,
  }, editor.snap);
  const drone = {
    id: `crow-${Date.now()}`,
    type: "hostileDrone",
    visualKind: "crow",
    x: snapped.x,
    y: snapped.y,
    width,
    height,
    maxHp: 2,
    damage: 10,
    diveDamage: 12,
    speed: 205,
    acceleration: 6.4,
    activationRadius: 920,
    preferredRange: 285,
    hoverOffsetY: 138,
    fireRange: 760,
    initialCooldown: 2.4,
    fireCooldown: 9,
    telegraphDuration: 0.58,
    beamLife: 0.12,
    beamLength: 860,
    beamRadius: 18,
    diveSpeed: 1040,
    diveMaxDuration: 0.68,
    diveRecoverTime: 0.36,
    flapRate: 14,
    flapAmplitude: 18,
    solidInsetX: 8,
    solidInsetY: 7,
    damageInsetX: 5,
    damageInsetY: 5,
    bobSeed: Math.round((Date.now() % 1000) / 100) / 10,
    diveAttack: true,
    solid: true,
    physicsSolid: true,
    braceTarget: true,
    patrol: {
      left: snapped.x - 180,
      right: snapped.x + 360,
    },
  };
  editor.data.hostileDrones.push(drone);
  setSelection(editor, dom, { kind: "drone", index: editor.data.hostileDrones.length - 1 });
  markDirty(editor, dom);
}

function createDefaultCrateItem(crateId) {
  return {
    id: `${crateId}-item-1`,
    name: "Field supplies",
    rarity: "common",
    type: "material",
    quantity: 1,
    value: 12,
    weight: 1,
    lootTime: 0.35,
    revealDelay: 0,
  };
}

function placeLootCrateAt(editor, dom, point) {
  pushUndo(editor);
  const width = 78;
  const height = 50;
  const snapped = snapPoint({
    x: point.x - width / 2,
    y: point.y - height,
  }, editor.snap);
  const crateId = `loot-crate-${Date.now()}`;
  const crate = {
    id: crateId,
    x: snapped.x,
    y: snapped.y,
    width,
    height,
    label: "Supply cache",
    prompt: "E: Open cache",
    lootTable: "streetCache",
    searchTime: 0.75,
    items: [createDefaultCrateItem(crateId)],
  };
  editor.data.lootCrates.push(crate);
  setSelection(editor, dom, { kind: "crate", index: editor.data.lootCrates.length - 1 });
  markDirty(editor, dom);
}

function placeGateAt(editor, dom, point) {
  pushUndo(editor);
  const gate = editor.data.extractionGate || {
    x: 0,
    y: 0,
    width: 96,
    height: 192,
    prompt: "E: 추출",
  };
  const snapped = snapPoint({
    x: point.x - gate.width / 2,
    y: point.y - gate.height,
  }, editor.snap);
  editor.data.extractionGate = gate;
  editor.data.extractionGate.x = snapped.x;
  editor.data.extractionGate.y = snapped.y;
  setSelection(editor, dom, { kind: "gate" });
  markDirty(editor, dom);
}

function handlePointerDown(editor, dom, event) {
  const screen = getCanvasPoint(dom, event);
  const world = screenToWorld(editor, screen.x, screen.y);
  editor.pointerWorld = world;

  if (event.button === 2) {
    editor.drag = {
      kind: "pan",
      startScreen: screen,
      startView: { x: editor.view.x, y: editor.view.y },
    };
    queueRender(editor, dom);
    return;
  }

  if (event.button !== 0) {
    return;
  }

  const snapped = snapPoint(world, editor.snap);

  if (editor.tool === TOOL_IDS.SELECT) {
    const hit = hitTest(editor, world);
    if (hit) {
      const selection = isSelectionItemSelected(editor.selected, hit) ? editor.selected : hit;
      if (selection !== editor.selected) {
        setSelection(editor, dom, selection);
      }

      const origins = getSelectionOrigins(editor, selection);
      if (origins.length > 0) {
        editor.drag = {
          kind: "move",
          selection,
          startWorld: snapped,
          origins,
          lastDeltaX: 0,
          lastDeltaY: 0,
          didMutate: false,
          historyPushed: false,
        };
      }
    } else {
      editor.preview = {
        kind: "marquee",
        start: world,
        end: world,
      };
      editor.drag = {
        kind: "marquee",
      };
    }
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.PLATFORM || isSlopeTool(editor.tool)) {
    editor.preview = {
      kind: "platform",
      start: snapped,
      end: snapped,
      platformKind: isSlopeTool(editor.tool) ? "slope" : "solid",
      slopeDirection: getSlopeDirectionForTool(editor.tool),
    };
    editor.drag = {
      kind: "previewPlatform",
    };
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.BRACE_WALL) {
    editor.preview = {
      kind: "braceWall",
      start: snapped,
      end: snapped,
    };
    editor.drag = {
      kind: "previewBraceWall",
    };
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.BACKGROUND_TILE) {
    editor.preview = {
      kind: "backgroundTile",
      start: snapped,
      end: snapped,
    };
    editor.drag = {
      kind: "previewBackgroundTile",
    };
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.SIGN) {
    placeProp(editor, dom, "sign", world);
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.LANTERN) {
    placeProp(editor, dom, "lantern", world);
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.SPAWN) {
    placeSpawnAt(editor, dom, world);
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.ENTRANCE) {
    placeEntranceAt(editor, dom, world);
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.ROUTE_EXIT) {
    placeRouteExitAt(editor, dom, world);
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.ENEMY) {
    placeEnemyAt(editor, dom, world);
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.DRONE) {
    placeDroneAt(editor, dom, world);
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.CRATE) {
    placeLootCrateAt(editor, dom, world);
    queueRender(editor, dom);
    return;
  }

  if (editor.tool === TOOL_IDS.GATE) {
    placeGateAt(editor, dom, world);
    queueRender(editor, dom);
  }
}

function handlePointerMove(editor, dom, event) {
  const screen = getCanvasPoint(dom, event);
  const world = screenToWorld(editor, screen.x, screen.y);
  const previousPointer = editor.pointerWorld;
  editor.pointerWorld = world;

  if (!editor.drag) {
    if (editor.tool === TOOL_IDS.SELECT) {
      return;
    }

    const previousSnap = snapPoint(previousPointer, editor.snap);
    const nextSnap = snapPoint(world, editor.snap);
    if (previousSnap.x === nextSnap.x && previousSnap.y === nextSnap.y) {
      return;
    }

    queueRender(editor, dom);
    return;
  }

  if (editor.drag.kind === "pan") {
    const deltaX = (screen.x - editor.drag.startScreen.x) / editor.view.zoom;
    const deltaY = (screen.y - editor.drag.startScreen.y) / editor.view.zoom;
    editor.view.x = editor.drag.startView.x - deltaX;
    editor.view.y = editor.drag.startView.y - deltaY;
    queueRender(editor, dom);
    return;
  }

  if (editor.drag.kind === "move") {
    const snapped = snapPoint(world, editor.snap);
    const deltaX = snapped.x - editor.drag.startWorld.x;
    const deltaY = snapped.y - editor.drag.startWorld.y;

    if (deltaX === editor.drag.lastDeltaX && deltaY === editor.drag.lastDeltaY) {
      return;
    }

    editor.drag.lastDeltaX = deltaX;
    editor.drag.lastDeltaY = deltaY;
    editor.drag.didMutate = true;
    if (!editor.drag.historyPushed) {
      pushUndo(editor);
      editor.drag.historyPushed = true;
    }
    moveSelectionsByDelta(
      editor,
      dom,
      editor.drag.origins,
      deltaX,
      deltaY,
      1,
      { syncUi: false, touchDirty: false },
    );
    queueRender(editor, dom);
    return;
  }

  if (editor.drag.kind === "marquee" && editor.preview?.kind === "marquee") {
    const rect = getRectFromPoints(editor.preview.start, world);
    const previousRect = getRectFromPoints(editor.preview.start, editor.preview.end);
    if (
      rect.x === previousRect.x
      && rect.y === previousRect.y
      && rect.width === previousRect.width
      && rect.height === previousRect.height
    ) {
      return;
    }

    editor.preview.end = world;
    queueRender(editor, dom);
    return;
  }

  if (editor.drag.kind === "previewPlatform" && editor.preview) {
    editor.preview.end = snapPoint(world, editor.snap);
    queueRender(editor, dom);
    return;
  }

  if (editor.drag.kind === "previewBraceWall" && editor.preview) {
    editor.preview.end = snapPoint(world, editor.snap);
    queueRender(editor, dom);
    return;
  }

  if (editor.drag.kind === "previewBackgroundTile" && editor.preview) {
    editor.preview.end = snapPoint(world, editor.snap);
    queueRender(editor, dom);
  }
}

function handlePointerUp(editor, dom) {
  if (editor.drag?.kind === "move" && editor.drag.didMutate) {
    renderSelectionFields(editor, dom);
    markDirty(editor, dom);
  }

  if (editor.drag?.kind === "marquee" && editor.preview?.kind === "marquee") {
    const rect = getRectFromPoints(editor.preview.start, editor.preview.end);
    const nextSelection = rect.width < 4 && rect.height < 4
      ? null
      : getSelectionsInRect(editor, rect);
    editor.preview = null;
    setSelection(editor, dom, nextSelection);
  }

  if (editor.drag?.kind === "previewPlatform") {
    createPlatformFromPreview(editor, dom);
    editor.preview = null;
  }

  if (editor.drag?.kind === "previewBraceWall") {
    createBraceWallFromPreview(editor, dom);
    editor.preview = null;
  }

  if (editor.drag?.kind === "previewBackgroundTile") {
    createBackgroundTileFromPreview(editor, dom);
    editor.preview = null;
  }

  editor.drag = null;
  queueRender(editor, dom);
}

function handleWheel(editor, dom, event) {
  event.preventDefault();
  const screen = getCanvasPoint(dom, event);
  const before = screenToWorld(editor, screen.x, screen.y);
  const nextZoom = clamp(editor.view.zoom * (1 - event.deltaY * 0.0012), 0.08, 2.8);
  editor.view.zoom = nextZoom;
  editor.view.x = before.x - screen.x / nextZoom;
  editor.view.y = before.y - screen.y / nextZoom;
  queueRender(editor, dom);
}

function nudgeSelection(editor, dom, dx, dy, fine) {
  if (!editor.selected) {
    return;
  }

  const origins = getSelectionOrigins(editor);
  if (origins.length === 0) {
    return;
  }

  const step = fine ? 1 : editor.snap;
  moveSelectionsByDelta(editor, dom, origins, dx * step, dy * step, 1);
  queueRender(editor, dom);
}

function loadEditorLevel(editor, dom, levelId, options = {}) {
  if (!levelId || levelId === editor.data.currentLevelId) {
    renderLevelControls(editor, dom);
    return;
  }
  if (editor.dirty && options.saveCurrent !== false) {
    saveLevelOverride(extractEditableLevelData(editor.data), GAME_DATA, editor.data.currentLevelId);
  }
  editor.data = prepareEditorData(createRuntimeGameData(GAME_DATA, levelId, {
    applyLevelOverride: true,
  }));
  editor.snap = getScaleConfig(editor.data).subTileSize;
  editor.preview = null;
  editor.drag = null;
  editor.previewPose = "idle";
  editor.history.undoStack = [];
  editor.history.redoStack = [];
  setSelection(editor, dom, null);
  syncWorldInputs(editor, dom);
  renderSelectionFields(editor, dom);
  renderPlayerRenderFields(editor, dom);
  renderHudLayoutFields(editor, dom);
  setStatus(editor, dom, "레벨 전환 완료", "", false);
  fitViewToWorld(editor, dom);
}

function duplicateCurrentLevel(editor, dom) {
  const copy = extractEditableLevelData(editor.data);
  const baseName = copy.levelId || editor.data.currentLevelId || "level";
  copy.levelId = createUniqueLevelId(editor, `${baseName}-copy`);
  copy.label = `${copy.label || baseName} Copy`;
  saveLevelOverride(copy, GAME_DATA, copy.levelId);
  loadEditorLevel(editor, dom, copy.levelId, { saveCurrent: false });
}

function createNewLevel(editor, dom) {
  const copy = extractEditableLevelData(editor.data);
  copy.levelId = createUniqueLevelId(editor, "new-level");
  copy.label = "New Level";
  copy.routeExits = [];
  copy.extractionGate = null;
  copy.entrances = [{
    id: "start",
    label: "Start",
    x: copy.player.spawn.x,
    y: copy.player.spawn.y,
    facing: 1,
  }];
  copy.map = {
    rooms: [{
      id: "main",
      label: copy.label,
      x: 0,
      y: 0,
      width: 180,
      height: 82,
    }],
  };
  saveLevelOverride(copy, GAME_DATA, copy.levelId);
  loadEditorLevel(editor, dom, copy.levelId, { saveCurrent: false });
}

function deleteCurrentLocalLevel(editor, dom) {
  const levelId = editor.data.currentLevelId || editor.data.levelId;
  if (!isLocalOnlyLevel(GAME_DATA, levelId)) {
    setStatus(editor, dom, "Only local levels can be deleted.", "error", editor.dirty);
    renderLevelControls(editor, dom);
    return;
  }

  const references = getLevelRouteReferences(GAME_DATA, levelId);
  if (references.length > 0) {
    const refs = references
      .map((ref) => `${ref.levelId}:${ref.routeId || ref.routeLabel || "route"}`)
      .join(", ");
    setStatus(editor, dom, `Delete blocked. Referenced by ${refs}.`, "error", editor.dirty);
    return;
  }

  if (typeof window !== "undefined" && !window.confirm(`Delete local level "${levelId}"? This cannot be undone.`)) {
    setStatus(editor, dom, "Delete cancelled.", "", editor.dirty);
    return;
  }

  const result = deleteLocalLevel(GAME_DATA, levelId);
  if (!result.ok) {
    const reason = result.reason === "built-in"
      ? "Built-in levels cannot be deleted."
      : "Only local levels can be deleted.";
    setStatus(editor, dom, reason, "error", editor.dirty);
    renderLevelControls(editor, dom);
    return;
  }

  const fallbackLevelId = GAME_DATA.defaultLevelId || getLevelSummaries(GAME_DATA)[0]?.id || "movement-lab-01";
  editor.dirty = false;
  loadEditorLevel(editor, dom, fallbackLevelId, { saveCurrent: false });
  setStatus(editor, dom, `Deleted local level ${levelId}.`, "", false);
}

function updateLevelLabel(editor, dom, value) {
  const next = String(value || "").trim() || editor.data.currentLevelId;
  if (editor.data.levelLabel === next && editor.data.label === next) {
    renderLevelControls(editor, dom);
    return;
  }
  pushUndo(editor);
  editor.data.levelLabel = next;
  editor.data.label = next;
  renderLevelControls(editor, dom);
  renderMapRoomFields(editor, dom);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function updateRunStartLevel(editor, dom, levelId) {
  const nextLevelId = saveRunStartLevelId(GAME_DATA, levelId);
  renderLevelControls(editor, dom);
  setStatus(editor, dom, `Run start level set to ${nextLevelId}.`, "", editor.dirty);
}

function saveEditorLevel(editor, dom) {
  saveLevelOverride(extractEditableLevelData(editor.data), GAME_DATA, editor.data.currentLevelId);
  renderLevelControls(editor, dom);
  setStatus(editor, dom, "로컬 저장 완료", "", false);
}

function createLevelExportFileName(editor) {
  const levelId = String(
    editor.data.currentLevelId
      || editor.data.levelId
      || editor.data.id
      || "level",
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "level";
  return `${levelId}.v001.json`;
}

async function readLevelManifestFromDirectory(directory) {
  const fallback = {
    version: 1,
    drafts: [],
    accepted: [],
  };

  try {
    const manifestFile = await directory.getFileHandle("manifest.json", { create: false });
    const text = await (await manifestFile.getFile()).text();
    const parsed = JSON.parse(text);
    return {
      ...fallback,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      drafts: Array.isArray(parsed?.drafts) ? parsed.drafts : [],
      accepted: Array.isArray(parsed?.accepted) ? parsed.accepted : [],
    };
  } catch {
    return fallback;
  }
}

async function writeLevelManifestToDirectory(directory, manifest) {
  const file = await directory.getFileHandle("manifest.json", { create: true });
  const writable = await file.createWritable();
  await writable.write(`${JSON.stringify({
    version: 1,
    drafts: Array.from(new Set(manifest.drafts || [])).sort(),
    accepted: Array.from(new Set(manifest.accepted || [])).sort(),
  }, null, 2)}\n`);
  await writable.close();
}

async function saveLevelJsonToDraftFolder(editor, dom, fileName, json) {
  if (typeof window === "undefined" || typeof window.showDirectoryPicker !== "function") {
    return false;
  }

  try {
    setStatus(editor, dom, "Choose the repository levels folder. The editor will write to levels/drafts/.", "", editor.dirty);
    const directory = await window.showDirectoryPicker({
      id: "silent-passage-levels",
      mode: "readwrite",
      startIn: "documents",
    });
    if (directory.name && directory.name !== "levels") {
      setStatus(editor, dom, `Choose the repository levels folder, not ${directory.name}.`, "error", editor.dirty);
      return true;
    }
    const draftsDirectory = await directory.getDirectoryHandle("drafts", { create: true });
    const file = await draftsDirectory.getFileHandle(fileName, { create: true });
    const writable = await file.createWritable();
    await writable.write(json);
    await writable.close();

    const manifest = await readLevelManifestFromDirectory(directory);
    manifest.drafts = Array.from(new Set([...(manifest.drafts || []), `drafts/${fileName}`])).sort();
    await writeLevelManifestToDirectory(directory, manifest);

    setStatus(editor, dom, `Saved drafts/${fileName} and updated levels/manifest.json.`, "", editor.dirty);
    return true;
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.warn("Draft folder save failed", error);
    }
    return false;
  }
}

async function downloadLevelJson(editor, dom) {
  const fileName = createLevelExportFileName(editor);
  const json = JSON.stringify(extractEditableLevelData(editor.data), null, 2);
  if (await saveLevelJsonToDraftFolder(editor, dom, fileName, json)) {
    return;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(editor, dom, `Downloaded ${fileName}. Move it to levels/drafts/.`, "", editor.dirty);
  return;
  setStatus(editor, dom, "JSON 저장 완료", "", editor.dirty);
}

async function importLevelFile(editor, dom, file) {
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const levelId = parsed.levelId || editor.data.currentLevelId || GAME_DATA.defaultLevelId;
    const baseLevel = createBaseLevelData(GAME_DATA, levelId);
    const normalized = normalizeEditableLevelData(parsed, baseLevel);
    const before = captureEditorSnapshot(editor);
    const nextSnapshot = {
      override: normalized,
      snap: getScaleConfig(mergeLevelData(baseLevel, normalized)).subTileSize,
      previewPose: "idle",
      selected: null,
    };
    if (getSnapshotKey(before) !== getSnapshotKey(nextSnapshot)) {
      pushUndoSnapshot(editor, before);
    }
    editor.data = prepareEditorData(mergeLevelData(baseLevel, normalized));
    editor.snap = getScaleConfig(editor.data).subTileSize;
    saveLevelOverride(normalized, GAME_DATA, normalized.levelId);
    editor.previewPose = "idle";
    setSelection(editor, dom, null);
    syncWorldInputs(editor, dom);
    renderSelectionFields(editor, dom);
    renderPlayerRenderFields(editor, dom);
    renderHudLayoutFields(editor, dom);
    setStatus(editor, dom, "JSON 불러오기 완료", "", false);
    fitViewToWorld(editor, dom);
  } catch {
    setStatus(editor, dom, "JSON 불러오기 실패", "error", editor.dirty);
  }
}

function resetEditorLevel(editor, dom) {
  const before = captureEditorSnapshot(editor);
  const levelId = editor.data.currentLevelId || GAME_DATA.defaultLevelId;
  clearLevelOverride(GAME_DATA, levelId);
  editor.data = prepareEditorData(createRuntimeGameData(GAME_DATA, levelId, {
    applyLevelOverride: isLocalOnlyLevel(GAME_DATA, levelId),
  }));
  editor.snap = getScaleConfig(editor.data).subTileSize;
  editor.preview = null;
  editor.drag = null;
  editor.previewPose = "idle";
  setSelection(editor, dom, null);
  syncWorldInputs(editor, dom);
  renderSelectionFields(editor, dom);
  renderPlayerRenderFields(editor, dom);
  renderHudLayoutFields(editor, dom);
  const after = captureEditorSnapshot(editor);
  if (getSnapshotKey(before) !== getSnapshotKey(after)) {
    pushUndoSnapshot(editor, before);
  }
  setStatus(editor, dom, "기본값 복원", "", false);
  fitViewToWorld(editor, dom);
}

function snapEntireLevelToScale(editor, dom) {
  const before = captureEditorSnapshot(editor);
  const scale = getScaleConfig(editor.data);
  const step = scale.subTileSize;
  const tile = scale.tileSize;

  editor.data.world.width = snapValue(editor.data.world.width, tile);
  editor.data.world.height = snapValue(editor.data.world.height, tile);
  editor.data.world.groundY = snapValue(editor.data.world.groundY, step);
  editor.data.player.spawn.x = snapValue(editor.data.player.spawn.x, step);
  editor.data.player.spawn.y = snapValue(editor.data.player.spawn.y, step);
  if (editor.data.extractionGate) {
    editor.data.extractionGate.x = snapValue(editor.data.extractionGate.x, step);
    editor.data.extractionGate.y = snapValue(editor.data.extractionGate.y, step);
    editor.data.extractionGate.width = Math.max(tile, snapValue(editor.data.extractionGate.width, step));
    editor.data.extractionGate.height = Math.max(tile, snapValue(editor.data.extractionGate.height, step));
  }

  editor.data.entrances = (editor.data.entrances || []).map((entrance) => ({
    ...entrance,
    x: snapValue(entrance.x, step),
    y: snapValue(entrance.y, step),
  }));

  editor.data.routeExits = (editor.data.routeExits || []).map((routeExit) => ({
    ...routeExit,
    x: snapValue(routeExit.x, step),
    y: snapValue(routeExit.y, step),
    width: Math.max(tile, snapValue(routeExit.width, step)),
    height: Math.max(tile, snapValue(routeExit.height, step)),
  }));

  editor.data.platforms = editor.data.platforms.map((platform) => ({
    ...platform,
    x: snapValue(platform.x, step),
    y: snapValue(platform.y, step),
    width: Math.max(step, snapValue(platform.width, step)),
    height: Math.max(step, snapValue(platform.height, step)),
  }));

  editor.data.braceWalls = editor.data.braceWalls.map((wall) => ({
    ...wall,
    x: snapValue(wall.x, step),
    y: snapValue(wall.y, step),
    width: Math.max(step, snapValue(wall.width, step)),
    height: Math.max(step, snapValue(wall.height, step)),
  }));

  editor.data.props = editor.data.props.map((prop) => ({
    ...prop,
    x: snapValue(prop.x, step),
    y: snapValue(prop.y, step),
    ...(prop.kind === "backgroundTile"
      ? {
        width: Math.max(step, snapValue(prop.width, step)),
        height: Math.max(step, snapValue(prop.height, step)),
      }
      : {}),
  }));

  editor.snap = step;
  syncWorldInputs(editor, dom);
  renderSelectionFields(editor, dom);
  renderPlayerRenderFields(editor, dom);
  renderHudLayoutFields(editor, dom);
  const after = captureEditorSnapshot(editor);
  if (getSnapshotKey(before) === getSnapshotKey(after)) {
    setStatus(editor, dom, "이미 정렬됨", "", editor.dirty);
    queueRender(editor, dom);
    return;
  }
  pushUndoSnapshot(editor, before);
  markDirty(editor, dom);
  queueRender(editor, dom);
}

function bindEvents(editor, dom) {
  renderToolShortcutLabels(dom);

  dom.toolButtons.forEach((button) => {
    button.addEventListener("click", () => setTool(editor, dom, button.dataset.tool));
  });

  dom.levelSelect?.addEventListener("change", () => loadEditorLevel(editor, dom, dom.levelSelect.value));
  dom.levelNameInput?.addEventListener("change", () => updateLevelLabel(editor, dom, dom.levelNameInput.value));
  dom.runStartLevelSelect?.addEventListener("change", () => updateRunStartLevel(editor, dom, dom.runStartLevelSelect.value));
  dom.duplicateLevelButton?.addEventListener("click", () => duplicateCurrentLevel(editor, dom));
  dom.newLevelButton?.addEventListener("click", () => createNewLevel(editor, dom));
  dom.deleteLevelButton?.addEventListener("click", () => deleteCurrentLocalLevel(editor, dom));
  dom.addMapRoomButton?.addEventListener("click", () => addMapRoom(editor, dom));

  const handleMapRoomFieldChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const index = Number(target.dataset.mapRoomIndex);
    const field = target.dataset.mapRoomField;
    if (!Number.isInteger(index) || !field) {
      return;
    }
    applyMapRoomField(editor, dom, index, field, target.value);
  };

  dom.mapRoomsFields?.addEventListener("input", handleMapRoomFieldChange);
  dom.mapRoomsFields?.addEventListener("change", handleMapRoomFieldChange);
  dom.mapRoomsFields?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const index = Number(target.dataset.mapRoomDelete);
    if (!Number.isInteger(index)) {
      return;
    }
    deleteMapRoom(editor, dom, index);
  });

  dom.collapseAllButton?.addEventListener("click", () => setAllPanelsOpen(dom, false));
  dom.expandAllButton?.addEventListener("click", () => setAllPanelsOpen(dom, true));

  [dom.worldWidthInput, dom.worldHeightInput, dom.groundYInput, dom.snapInput, dom.cameraZoomInput].forEach((input) => {
    input.addEventListener("change", () => updateWorldFromInputs(editor, dom));
  });

  dom.cameraTuningFields?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const field = target.dataset.cameraField;
    if (!field) {
      return;
    }
    applyCameraTuningField(editor, dom, field, target.type === "checkbox" ? target.checked : target.value);
  });

  dom.playerPreviewPose.addEventListener("change", () => {
    editor.previewPose = dom.playerPreviewPose.value;
    queueRender(editor, dom);
  });

  const handleSelectionFieldChange = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }
    const field = target.dataset.field;
    if (!field) {
      return;
    }
    applySelectionField(editor, dom, field, target.value);
  };

  dom.selectionFields.addEventListener("input", handleSelectionFieldChange);
  dom.selectionFields.addEventListener("change", handleSelectionFieldChange);

  dom.playerRenderFields.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const field = target.dataset.renderField;
    if (!field) {
      return;
    }
    applyPlayerRenderField(editor, dom, field, target.value);
  });

  dom.hudLayoutFields.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const group = target.dataset.layoutGroup;
    const field = target.dataset.layoutField;
    if (!group || !field) {
      return;
    }
    applyHudLayoutField(editor, dom, group, field, target.value);
  });

  dom.deleteSelectionButton.addEventListener("click", () => deleteSelection(editor, dom));
  dom.saveButton.addEventListener("click", () => saveEditorLevel(editor, dom));
  dom.downloadButton.addEventListener("click", () => downloadLevelJson(editor, dom));
  dom.importButton.addEventListener("click", () => dom.importInput.click());
  dom.snapAllButton.addEventListener("click", () => snapEntireLevelToScale(editor, dom));
  dom.importInput.addEventListener("change", () => {
    importLevelFile(editor, dom, dom.importInput.files?.[0] || null);
    dom.importInput.value = "";
  });
  dom.resetButton.addEventListener("click", () => resetEditorLevel(editor, dom));
  dom.fitViewButton.addEventListener("click", () => fitViewToWorld(editor, dom));

  dom.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  dom.canvas.addEventListener("pointerdown", (event) => handlePointerDown(editor, dom, event));
  window.addEventListener("pointermove", (event) => handlePointerMove(editor, dom, event));
  window.addEventListener("pointerup", () => handlePointerUp(editor, dom));
  dom.canvas.addEventListener("wheel", (event) => handleWheel(editor, dom, event), { passive: false });
  window.addEventListener("editor-rerender", () => queueRender(editor, dom));

  window.addEventListener("keydown", (event) => {
    const isTyping = isTextEditingTarget(event.target);

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      if (isTyping) {
        return;
      }
      event.preventDefault();
      undoEditor(editor, dom);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveEditorLevel(editor, dom);
      return;
    }

    if (isTyping) {
      return;
    }

    if (handleToolShortcut(editor, dom, event)) {
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelection(editor, dom);
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      fitViewToWorld(editor, dom);
      return;
    }

    if (event.code === "KeyG") {
      event.preventDefault();
      saveLevelOverride(extractEditableLevelData(editor.data), GAME_DATA, editor.data.currentLevelId);
      const levelId = encodeURIComponent(editor.data.currentLevelId || editor.data.defaultLevelId || "movement-lab-01");
      window.location.href = `./index.html?level=${levelId}&directLevel=1&localOverride=1`;
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudgeSelection(editor, dom, -1, 0, event.shiftKey);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nudgeSelection(editor, dom, 1, 0, event.shiftKey);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudgeSelection(editor, dom, 0, -1, event.shiftKey);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      nudgeSelection(editor, dom, 0, 1, event.shiftKey);
    }
  });

  window.addEventListener("resize", () => {
    resizeCanvas(editor, dom);
    queueRender(editor, dom);
  });
}

function drawCanvasBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#08111a");
  gradient.addColorStop(0.52, "#132231");
  gradient.addColorStop(1, "#243845");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(147, 234, 255, 0.08)";
  ctx.beginPath();
  ctx.ellipse(width * 0.2, height * 0.16, width * 0.2, height * 0.18, 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(231, 244, 126, 0.05)";
  ctx.beginPath();
  ctx.ellipse(width * 0.82, height * 0.22, width * 0.16, height * 0.14, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawWorldBackdrop(ctx, editor) {
  const { width, height, groundY } = editor.data.world;
  ctx.fillStyle = "rgba(7, 13, 21, 0.42)";
  ctx.fillRect(0, groundY, width, Math.max(0, height - groundY));

  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 30 / editor.view.zoom;
  for (let index = 0; index < 5; index += 1) {
    const x = width * (0.16 + index * 0.19);
    ctx.beginPath();
    ctx.arc(x, groundY - 40, 180 + index * 42, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(147, 234, 255, 0.05)";
  for (let index = 0; index < 11; index += 1) {
    const columnX = 160 + index * 290;
    ctx.fillRect(columnX, 110 + (index % 3) * 70, 16, groundY - 230);
  }
}

function drawGrid(ctx, editor) {
  const scale = getScaleConfig(editor.data);
  const minor = scale.subTileSize;
  const major = scale.tileSize;
  const startX = Math.floor(editor.view.x / minor) * minor;
  const endX = editor.view.x + editor.view.width / editor.view.zoom;
  const startY = Math.floor(editor.view.y / minor) * minor;
  const endY = editor.view.y + editor.view.height / editor.view.zoom;

  ctx.lineWidth = 1 / editor.view.zoom;

  for (let x = startX; x <= endX; x += minor) {
    ctx.strokeStyle = x % major === 0 ? COLORS.gridMajor : COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  for (let y = startY; y <= endY; y += minor) {
    ctx.strokeStyle = y % major === 0 ? COLORS.gridMajor : COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
}

function drawWorldBounds(ctx, editor) {
  ctx.lineWidth = 2 / editor.view.zoom;
  ctx.strokeStyle = COLORS.worldEdge;
  ctx.strokeRect(0, 0, editor.data.world.width, editor.data.world.height);

  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(
    0,
    editor.data.world.groundY,
    editor.data.world.width,
    Math.max(0, editor.data.world.height - editor.data.world.groundY),
  );
}

function drawCameraGuideLegacy(ctx, editor) {
  const rect = getEditorCameraGuide(editor);

  ctx.save();
  ctx.fillStyle = "rgba(147, 234, 255, 0.05)";
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.setLineDash([20 / editor.view.zoom, 12 / editor.view.zoom]);
  ctx.strokeStyle = "rgba(147, 234, 255, 0.58)";
  ctx.lineWidth = 2 / editor.view.zoom;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(147, 234, 255, 0.92)";
  ctx.font = `${18 / editor.view.zoom}px Segoe UI`;
  ctx.fillText(`Cam ×${rect.zoom.toFixed(2)}`, rect.x + 16 / editor.view.zoom, rect.y + 28 / editor.view.zoom);
  ctx.restore();
}

function drawCameraGuide(ctx, editor) {
  const neutralRect = getEditorCameraGuide(editor);
  const rightRect = getEditorCameraGuide(editor, editor.data.player.spawn, { direction: 1 });
  const leftRect = getEditorCameraGuide(editor, editor.data.player.spawn, { direction: -1 });

  ctx.save();

  const drawGuideRect = (rect, label, stroke, fill, dashed = true) => {
    ctx.fillStyle = fill;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    if (dashed) {
      ctx.setLineDash([20 / editor.view.zoom, 12 / editor.view.zoom]);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2 / editor.view.zoom;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.setLineDash([]);
    ctx.fillStyle = stroke;
    ctx.font = `${16 / editor.view.zoom}px Segoe UI`;
    ctx.fillText(label, rect.x + 16 / editor.view.zoom, rect.y + 28 / editor.view.zoom);
  };

  drawGuideRect(leftRect, "Cam left", "rgba(255, 236, 126, 0.45)", "rgba(255, 236, 126, 0.025)");
  drawGuideRect(rightRect, "Cam right", "rgba(231, 244, 126, 0.55)", "rgba(231, 244, 126, 0.03)");
  drawGuideRect(neutralRect, `Cam x${neutralRect.zoom.toFixed(2)}`, "rgba(147, 234, 255, 0.72)", "rgba(147, 234, 255, 0.05)", false);

  ctx.restore();
}

function drawPlatformBlock(ctx, editor, platform, selected) {
  ctx.fillStyle = platform.color || "#54697b";
  ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fillRect(platform.x, platform.y, platform.width, Math.max(2, platform.height * 0.18));

  ctx.strokeStyle = selected ? COLORS.accent : "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = (selected ? 3 : 1.2) / editor.view.zoom;
  ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
}

function drawSlopePlatform(ctx, editor, platform, selected, options = {}) {
  const fill = options.fill || platform.color || "#54697b";
  const stroke = options.stroke || (selected ? COLORS.accent : "rgba(255, 255, 255, 0.18)");
  const slopeDirection = getPlatformSlopeDirection(platform);

  ctx.fillStyle = fill;
  ctx.beginPath();
  if (slopeDirection === "up-right") {
    ctx.moveTo(platform.x, platform.y + platform.height);
    ctx.lineTo(platform.x + platform.width, platform.y);
    ctx.lineTo(platform.x + platform.width, platform.y + platform.height);
  } else {
    ctx.moveTo(platform.x, platform.y);
    ctx.lineTo(platform.x + platform.width, platform.y + platform.height);
    ctx.lineTo(platform.x, platform.y + platform.height);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  if (slopeDirection === "up-right") {
    ctx.moveTo(platform.x + platform.width, platform.y);
    ctx.lineTo(platform.x + platform.width, platform.y + Math.max(4, platform.height * 0.16));
    ctx.lineTo(platform.x + Math.max(6, platform.width * 0.12), platform.y + platform.height);
  } else {
    ctx.moveTo(platform.x, platform.y);
    ctx.lineTo(platform.x + Math.max(6, platform.width * 0.12), platform.y + platform.height);
    ctx.lineTo(platform.x, platform.y + platform.height);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = (selected ? 3 : 1.6) / editor.view.zoom;
  ctx.beginPath();
  if (slopeDirection === "up-right") {
    ctx.moveTo(platform.x, platform.y + platform.height);
    ctx.lineTo(platform.x + platform.width, platform.y);
  } else {
    ctx.moveTo(platform.x, platform.y);
    ctx.lineTo(platform.x + platform.width, platform.y + platform.height);
  }
  ctx.stroke();

  ctx.strokeStyle = selected ? COLORS.accent : "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = (selected ? 2 : 1) / editor.view.zoom;
  ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
}

function drawPlatforms(ctx, editor) {
  editor.data.platforms.forEach((platform, index) => {
    const selected = isSelectionItemSelected(editor.selected, { kind: "platform", index });
    if (platform.kind === "slope") {
      drawSlopePlatform(ctx, editor, platform, selected);
      return;
    }
    drawPlatformBlock(ctx, editor, platform, selected);
  });
}

function drawBraceWalls(ctx, editor) {
  editor.data.braceWalls.forEach((wall, index) => {
    const selected = isSelectionItemSelected(editor.selected, { kind: "braceWall", index });
    ctx.fillStyle = "rgba(147, 234, 255, 0.14)";
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    ctx.strokeStyle = selected ? COLORS.accent : "rgba(147, 234, 255, 0.6)";
    ctx.lineWidth = (selected ? 3 : 2) / editor.view.zoom;
    ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);

    ctx.strokeStyle = "rgba(231, 244, 126, 0.34)";
    ctx.lineWidth = 1.5 / editor.view.zoom;
    for (let y = wall.y + 12; y < wall.y + wall.height - 8; y += 18) {
      ctx.beginPath();
      ctx.moveTo(wall.x + 6, y);
      ctx.lineTo(wall.x + wall.width - 6, y - 6);
      ctx.stroke();
    }
  });
}

function drawProps(ctx, editor) {
  editor.data.props.forEach((prop, index) => {
    if (prop.kind === "backgroundTile") {
      return;
    }
    const selected = isSelectionItemSelected(editor.selected, { kind: "prop", index });
    if (prop.kind === "sign") {
      ctx.fillStyle = "rgba(11, 23, 35, 0.92)";
      ctx.strokeStyle = selected ? COLORS.accent : COLORS.sign;
      ctx.lineWidth = 2 / editor.view.zoom;
      pathRoundedRect(ctx, prop.x - 42, prop.y - 52, 84, 30, 8 / editor.view.zoom);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.sign;
      ctx.font = `${18 / editor.view.zoom}px Segoe UI`;
      ctx.textAlign = "center";
      ctx.fillText(prop.text || "표지", prop.x, prop.y - 32);
      ctx.textAlign = "left";
    } else {
      const gradient = ctx.createRadialGradient(prop.x, prop.y - 4, 2, prop.x, prop.y - 4, 24);
      gradient.addColorStop(0, "rgba(231, 244, 126, 0.92)");
      gradient.addColorStop(1, "rgba(231, 244, 126, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 4, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.lantern;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 4, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = selected ? COLORS.accent : "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 2 / editor.view.zoom;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 4, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

function drawBackgroundTiles(ctx, editor) {
  editor.data.props.forEach((prop, index) => {
    if (prop.kind !== "backgroundTile") {
      return;
    }
    const selected = isSelectionItemSelected(editor.selected, { kind: "prop", index });
    const rect = getPropRect(prop);
    ctx.fillStyle = prop.color || "#4f6f7d";
    ctx.globalAlpha = 0.72;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = selected ? COLORS.accent : COLORS.backgroundTileStroke;
    ctx.lineWidth = (selected ? 3 : 1.5) / editor.view.zoom;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  });
}

function drawPatrolRange(ctx, editor, entity, y, color) {
  if (!entity.patrol || !Number.isFinite(entity.patrol.left) || !Number.isFinite(entity.patrol.right)) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 / editor.view.zoom;
  ctx.setLineDash([10 / editor.view.zoom, 8 / editor.view.zoom]);
  ctx.beginPath();
  ctx.moveTo(entity.patrol.left, y);
  ctx.lineTo(entity.patrol.right, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(entity.patrol.left, y, 4 / editor.view.zoom, 0, Math.PI * 2);
  ctx.arc(entity.patrol.right, y, 4 / editor.view.zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHumanoidEnemies(ctx, editor) {
  (editor.data.humanoidEnemies || []).forEach((enemy, index) => {
    const selected = isSelectionItemSelected(editor.selected, { kind: "enemy", index });
    drawPatrolRange(ctx, editor, enemy, enemy.y + enemy.height + 12 / editor.view.zoom, "rgba(255, 125, 147, 0.48)");
    ctx.fillStyle = COLORS.enemyFill;
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    ctx.strokeStyle = selected ? COLORS.accent : COLORS.enemy;
    ctx.lineWidth = (selected ? 3 : 2) / editor.view.zoom;
    ctx.strokeRect(enemy.x, enemy.y, enemy.width, enemy.height);
    ctx.fillStyle = COLORS.enemy;
    ctx.beginPath();
    ctx.arc(enemy.x + enemy.width * 0.5, enemy.y + enemy.height * 0.22, Math.max(5, enemy.width * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${15 / editor.view.zoom}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.fillText(enemy.label || enemy.id || "Enemy", enemy.x + enemy.width / 2, enemy.y - 10 / editor.view.zoom);
    ctx.textAlign = "left";
  });
}

function drawHostileDrones(ctx, editor) {
  (editor.data.hostileDrones || []).forEach((drone, index) => {
    const selected = isSelectionItemSelected(editor.selected, { kind: "drone", index });
    drawPatrolRange(ctx, editor, drone, drone.y + drone.height + 12 / editor.view.zoom, "rgba(255, 190, 102, 0.48)");
    ctx.fillStyle = COLORS.droneFill;
    ctx.fillRect(drone.x, drone.y, drone.width, drone.height);
    ctx.strokeStyle = selected ? COLORS.accent : COLORS.drone;
    ctx.lineWidth = (selected ? 3 : 2) / editor.view.zoom;
    ctx.strokeRect(drone.x, drone.y, drone.width, drone.height);
    ctx.fillStyle = COLORS.drone;
    ctx.beginPath();
    ctx.ellipse(
      drone.x + drone.width * 0.5,
      drone.y + drone.height * 0.5,
      Math.max(8, drone.width * 0.28),
      Math.max(6, drone.height * 0.22),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.font = `${15 / editor.view.zoom}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.fillText(drone.id || "Drone", drone.x + drone.width / 2, drone.y - 10 / editor.view.zoom);
    ctx.textAlign = "left";
  });
}

function drawLootCrates(ctx, editor) {
  (editor.data.lootCrates || []).forEach((crate, index) => {
    const selected = isSelectionItemSelected(editor.selected, { kind: "crate", index });
    ctx.fillStyle = COLORS.crateFill;
    ctx.fillRect(crate.x, crate.y, crate.width, crate.height);
    ctx.strokeStyle = selected ? COLORS.accent : COLORS.crate;
    ctx.lineWidth = (selected ? 3 : 2) / editor.view.zoom;
    ctx.strokeRect(crate.x, crate.y, crate.width, crate.height);

    ctx.strokeStyle = "rgba(147, 234, 255, 0.42)";
    ctx.lineWidth = 1.5 / editor.view.zoom;
    ctx.beginPath();
    ctx.moveTo(crate.x + 8 / editor.view.zoom, crate.y + crate.height * 0.32);
    ctx.lineTo(crate.x + crate.width - 8 / editor.view.zoom, crate.y + crate.height * 0.32);
    ctx.moveTo(crate.x + crate.width * 0.5, crate.y + 4 / editor.view.zoom);
    ctx.lineTo(crate.x + crate.width * 0.5, crate.y + crate.height - 4 / editor.view.zoom);
    ctx.stroke();

    ctx.fillStyle = COLORS.crate;
    ctx.font = `${15 / editor.view.zoom}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.fillText(crate.label || crate.id || "Crate", crate.x + crate.width / 2, crate.y - 10 / editor.view.zoom);
    ctx.textAlign = "left";
  });
}

function getPlayerPreviewFrame(editor) {
  const pose = editor.previewPose;
  const poseConfig = getPlayerPoseConfig(editor.data, pose);
  const src = editor.data.art?.[poseConfig.assetKey]?.src;
  const image = getImageAsset(src);
  if (!image || !image.complete || !image.naturalWidth) {
    return null;
  }

  const rect = getSpawnRect(editor.data);
  const collisionHeight = pose === "crouch"
    ? editor.data.player.movement.crouchHeight
    : editor.data.player.size.height;
  const footX = rect.x + rect.width * 0.5;
  const footY = rect.y + rect.height;
  const drawHeight = Math.max(1, collisionHeight * poseConfig.heightRatio);
  const drawWidth = Math.max(1, drawHeight * (image.naturalWidth / image.naturalHeight) * poseConfig.widthRatio);

  return {
    image,
    drawWidth,
    drawHeight,
    footX,
    footY,
    anchorX: 1 - poseConfig.anchorX,
    footAnchorY: poseConfig.footAnchorY,
  };
}

function drawPlayerPreview(ctx, editor) {
  const frame = getPlayerPreviewFrame(editor);
  if (!frame) {
    return;
  }

  ctx.save();
  ctx.translate(frame.footX, frame.footY);
  ctx.scale(-1, 1);
  ctx.globalAlpha = 0.96;
  ctx.drawImage(
    frame.image,
    -frame.drawWidth * frame.anchorX,
    -frame.drawHeight * frame.footAnchorY,
    frame.drawWidth,
    frame.drawHeight,
  );
  ctx.restore();
}

function drawSpawn(ctx, editor) {
  const rect = getSpawnRect(editor.data);
  const selected = isSelectionItemSelected(editor.selected, { kind: "spawn" });

  drawPlayerPreview(ctx, editor);

  ctx.fillStyle = "rgba(147, 234, 255, 0.12)";
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  ctx.strokeStyle = selected ? COLORS.accent : COLORS.spawn;
  ctx.lineWidth = 2 / editor.view.zoom;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  ctx.fillStyle = COLORS.spawn;
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.width / 2, rect.y - 12);
  ctx.lineTo(rect.x + rect.width + 8, rect.y + 10);
  ctx.lineTo(rect.x + rect.width / 2, rect.y + 24);
  ctx.lineTo(rect.x - 8, rect.y + 10);
  ctx.closePath();
  ctx.fill();
}

function drawEntrances(ctx, editor) {
  (editor.data.entrances || []).forEach((entrance, index) => {
    const rect = getEntranceRect(entrance);
    const selected = isSelectionItemSelected(editor.selected, { kind: "entrance", index });
    ctx.fillStyle = "rgba(147, 234, 255, 0.1)";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = selected ? COLORS.accent : COLORS.entrance;
    ctx.lineWidth = (selected ? 3 : 2) / editor.view.zoom;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = COLORS.entrance;
    ctx.font = `${16 / editor.view.zoom}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.fillText(entrance.id || "entrance", entrance.x, rect.y - 10);
    ctx.beginPath();
    ctx.moveTo(entrance.x + (entrance.facing || 1) * 18, entrance.y - 20);
    ctx.lineTo(entrance.x - (entrance.facing || 1) * 8, entrance.y - 32);
    ctx.lineTo(entrance.x - (entrance.facing || 1) * 8, entrance.y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = "left";
  });
}

function drawRouteExits(ctx, editor) {
  (editor.data.routeExits || []).forEach((routeExit, index) => {
    const selected = isSelectionItemSelected(editor.selected, { kind: "routeExit", index });
    ctx.fillStyle = COLORS.routeExitFill;
    ctx.fillRect(routeExit.x, routeExit.y, routeExit.width, routeExit.height);
    ctx.strokeStyle = selected ? COLORS.accentAlt : COLORS.routeExit;
    ctx.lineWidth = (selected ? 3 : 2) / editor.view.zoom;
    ctx.strokeRect(routeExit.x, routeExit.y, routeExit.width, routeExit.height);
    ctx.fillStyle = COLORS.routeExit;
    ctx.font = `${16 / editor.view.zoom}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.fillText(routeExit.label || "Route", routeExit.x + routeExit.width / 2, routeExit.y - 12);
    ctx.fillText(routeExit.toLevelId || "-", routeExit.x + routeExit.width / 2, routeExit.y + routeExit.height + 22);
    ctx.textAlign = "left";
  });
}

function drawGate(ctx, editor) {
  const gate = editor.data.extractionGate;
  if (!gate) {
    return;
  }
  const selected = isSelectionItemSelected(editor.selected, { kind: "gate" });

  ctx.fillStyle = COLORS.gateFill;
  ctx.fillRect(gate.x, gate.y, gate.width, gate.height);
  ctx.strokeStyle = selected ? COLORS.accentAlt : COLORS.gate;
  ctx.lineWidth = 3 / editor.view.zoom;
  ctx.strokeRect(gate.x, gate.y, gate.width, gate.height);

  ctx.fillStyle = COLORS.gate;
  ctx.font = `${18 / editor.view.zoom}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.fillText("출구", gate.x + gate.width / 2, gate.y - 12);
  ctx.textAlign = "left";
}

function drawSelectionOutline(ctx, editor) {
  const rect = getSelectionRect(editor);
  if (!rect) {
    return;
  }

  ctx.save();
  ctx.setLineDash([10 / editor.view.zoom, 8 / editor.view.zoom]);
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2.5 / editor.view.zoom;
  ctx.strokeRect(
    rect.x - 4 / editor.view.zoom,
    rect.y - 4 / editor.view.zoom,
    rect.width + 8 / editor.view.zoom,
    rect.height + 8 / editor.view.zoom,
  );
  ctx.restore();
}

function drawPreview(ctx, editor) {
  if (editor.preview?.kind === "platform") {
    const rect = getPreviewPlatformRect(editor);
    if (rect?.kind === "slope") {
      drawSlopePlatform(ctx, editor, {
        ...rect,
        color: "rgba(147, 234, 255, 0.16)",
      }, false, {
        fill: "rgba(147, 234, 255, 0.16)",
        stroke: COLORS.accentAlt,
      });
    } else if (rect) {
      ctx.fillStyle = "rgba(147, 234, 255, 0.16)";
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = COLORS.accentAlt;
      ctx.lineWidth = 2 / editor.view.zoom;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  if (editor.preview?.kind === "braceWall") {
    const x = Math.min(editor.preview.start.x, editor.preview.end.x);
    const y = Math.min(editor.preview.start.y, editor.preview.end.y);
    const width = Math.max(12, Math.abs(editor.preview.end.x - editor.preview.start.x) || 32);
    const height = Math.max(12, Math.abs(editor.preview.end.y - editor.preview.start.y) || 160);
    ctx.fillStyle = "rgba(147, 234, 255, 0.12)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = COLORS.accentAlt;
    ctx.lineWidth = 2 / editor.view.zoom;
    ctx.strokeRect(x, y, width, height);
  }

  if (editor.preview?.kind === "backgroundTile") {
    const rect = getPreviewBackgroundTileRect(editor);
    if (rect) {
      ctx.fillStyle = "rgba(79, 111, 125, 0.42)";
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = COLORS.accentAlt;
      ctx.lineWidth = 2 / editor.view.zoom;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  if (editor.preview?.kind === "marquee") {
    const rect = getRectFromPoints(editor.preview.start, editor.preview.end);
    ctx.fillStyle = "rgba(147, 234, 255, 0.08)";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2 / editor.view.zoom;
    ctx.setLineDash([12 / editor.view.zoom, 8 / editor.view.zoom]);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    ctx.setLineDash([]);
  }

  if (editor.tool !== TOOL_IDS.SELECT && !editor.preview) {
    const snapped = snapPoint(editor.pointerWorld, editor.snap);
    ctx.strokeStyle = "rgba(147, 234, 255, 0.55)";
    ctx.lineWidth = 1.5 / editor.view.zoom;
    ctx.beginPath();
    ctx.arc(snapped.x, snapped.y, 12 / editor.view.zoom, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawScaleLegend(ctx, editor) {
  const scale = getScaleConfig(editor.data);
  const cardX = 20;
  const cardY = editor.view.height - 142;
  const cardWidth = 230;
  const cardHeight = 112;
  const tilePx = 22;
  const characterWidth = tilePx * scale.playerWidthTiles;
  const characterHeight = tilePx * scale.playerHeightTiles;

  ctx.fillStyle = COLORS.panel;
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  pathRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#edf6fb";
  ctx.font = "13px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("스케일", cardX + 16, cardY + 24);

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(cardX + 16, cardY + 54, tilePx, tilePx);
  ctx.strokeStyle = COLORS.accentAlt;
  ctx.strokeRect(cardX + 16, cardY + 54, tilePx, tilePx);

  ctx.fillStyle = "rgba(147, 234, 255, 0.14)";
  ctx.fillRect(cardX + 72, cardY + 54 + tilePx - characterHeight, characterWidth, characterHeight);
  ctx.strokeStyle = COLORS.accent;
  ctx.strokeRect(cardX + 72, cardY + 54 + tilePx - characterHeight, characterWidth, characterHeight);

  ctx.fillStyle = "#9fb4c5";
  ctx.fillText(`1T ${scale.tileSize}`, cardX + 16, cardY + 98);
  ctx.fillText(
    `캐릭터 ${formatTiles(editor.data.player.size.width, scale.tileSize)} × ${formatTiles(editor.data.player.size.height, scale.tileSize)}`,
    cardX + 72,
    cardY + 98,
  );
}

function drawHudLayoutPreview(ctx, editor) {
  const layout = getUiLayoutConfig(editor.data);
  const sx = editor.view.width / 1280;
  const sy = editor.view.height / 720;

  ctx.save();
  ctx.strokeStyle = "rgba(147, 234, 255, 0.62)";
  ctx.fillStyle = "rgba(147, 234, 255, 0.12)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([6, 6]);

  ctx.strokeRect(layout.toast.x * sx, (layout.toast.y - 16) * sy, layout.toast.width * sx, 42 * sy);
  ctx.beginPath();
  ctx.arc(layout.minimap.x * sx, layout.minimap.y * sy, layout.minimap.radius * Math.min(sx, sy), 0, Math.PI * 2);
  ctx.stroke();

  for (let index = 0; index < 4; index += 1) {
    const y = (layout.objective.y + index * layout.objective.gap) * sy;
    ctx.beginPath();
    ctx.moveTo((layout.objective.x - 24) * sx, (y - 6));
    ctx.lineTo((layout.objective.x + 120) * sx, (y - 6));
    ctx.stroke();
  }

  for (let index = 0; index < 3; index += 1) {
    ctx.strokeRect(
      layout.status.x * sx,
      (layout.status.y + index * layout.status.gap) * sy,
      layout.status.width * sx,
      8 * sy,
    );
  }

  ctx.beginPath();
  ctx.arc(layout.portrait.x * sx, layout.portrait.y * sy, layout.portrait.radius * Math.min(sx, sy), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawScreenOverlay(ctx, editor, dom) {
  ctx.fillStyle = COLORS.panel;
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  pathRoundedRect(ctx, 20, 20, 220, 116, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#edf6fb";
  ctx.font = "14px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("월드", 36, 48);
  ctx.fillStyle = "#9fb4c5";
  ctx.fillText(`${Math.round(editor.data.world.width)} × ${Math.round(editor.data.world.height)}`, 36, 72);
  ctx.fillText(`포인터 ${Math.round(editor.pointerWorld.x)}, ${Math.round(editor.pointerWorld.y)}`, 36, 94);
  ctx.fillText(`카메라 ×${getEditorCameraZoom(editor.data).toFixed(2)}`, 36, 116);

  dom.viewLabel.textContent = `${Math.round(editor.view.zoom * 100)}%`;
  drawScaleLegend(ctx, editor);
  drawHudLayoutPreview(ctx, editor);
}

function renderEditor(editor, dom) {
  resizeCanvas(editor, dom);
  const { ctx } = dom;

  ctx.clearRect(0, 0, editor.view.width, editor.view.height);
  drawCanvasBackground(ctx, editor.view.width, editor.view.height);

  ctx.save();
  ctx.translate(-editor.view.x * editor.view.zoom, -editor.view.y * editor.view.zoom);
  ctx.scale(editor.view.zoom, editor.view.zoom);
  drawWorldBackdrop(ctx, editor);
  drawGrid(ctx, editor);
  drawWorldBounds(ctx, editor);
  drawCameraGuide(ctx, editor);
  drawBackgroundTiles(ctx, editor);
  drawPlatforms(ctx, editor);
  drawBraceWalls(ctx, editor);
  drawProps(ctx, editor);
  drawLootCrates(ctx, editor);
  drawHumanoidEnemies(ctx, editor);
  drawHostileDrones(ctx, editor);
  drawRouteExits(ctx, editor);
  drawEntrances(ctx, editor);
  drawSpawn(ctx, editor);
  drawGate(ctx, editor);
  drawSelectionOutline(ctx, editor);
  drawPreview(ctx, editor);
  ctx.restore();

  drawScreenOverlay(ctx, editor, dom);
}

function initEditor() {
  const dom = getEditorDom();
  if (!dom) {
    return;
  }

  const editor = createEditorState();
  resizeCanvas(editor, dom);
  renderPlayerPreviewPoseOptions(editor, dom);
  syncWorldInputs(editor, dom);
  renderSelectionFields(editor, dom);
  renderPlayerRenderFields(editor, dom);
  renderHudLayoutFields(editor, dom);
  setTool(editor, dom, TOOL_IDS.SELECT);
  fitViewToWorld(editor, dom);
  bindEvents(editor, dom);
  queueRender(editor, dom);
}

if (typeof document !== "undefined") {
  initEditor();
}
