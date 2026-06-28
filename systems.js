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
} from "./state.js?v=20260628-camera-mouse-pan-removed";
import { getLevelIds, loadRuntimeLevelData } from "./level-store.js?v=20260628-camera-mouse-pan-removed";
import {
  clearSavedGame,
  hasSavedGame,
  restoreSavedGame,
  saveCurrentGame,
  shouldStartFromUrlLevel,
  startNewSavedRun,
  updateAutoSave,
} from "./save-game.js?v=20260526-sfx-v1";
import {
  getAudioChannelVolume,
  registerAudioElement,
} from "./audio-options.js?v=20260619-shelter-voice-v9";
import { getShelterSubtitleCharsPerSecond } from "./game-options.js?v=20260619-text-speed-v1";
import { requestFaceOffLine } from "./ai-client.js?v=20260618-direct-chat-v7";
import {
  speakFaceOffLine,
  speakShelterLine,
  stopTtsPlayback,
} from "./tts-client.js?v=20260620-sfx-v1";
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
const CAMERA_USER_ZOOM_IN_KEYS = ["Equal", "NumpadAdd"];
const CAMERA_USER_ZOOM_OUT_KEYS = ["Minus", "NumpadSubtract"];
const CAMERA_USER_ZOOM_MIN = 0.5;
const CAMERA_USER_ZOOM_MAX = 2;
const CAMERA_USER_ZOOM_STEP = 1.12;
const CAMERA_ABSOLUTE_ZOOM_MIN = 0.35;
const CAMERA_ABSOLUTE_ZOOM_MAX = 5;
const CAMERA_MAX_LERP_STEP_SECONDS = 1 / 30;
const CAMERA_ACTION_ZOOM_OUT_SCALE = 0.5;
const MOVE_LEFT_KEYS = ["ArrowLeft", "KeyA"];
const MOVE_RIGHT_KEYS = ["ArrowRight", "KeyD"];
const CROUCH_KEYS = ["ArrowDown", "KeyS"];
const JUMP_KEYS = ["Space", "KeyW", "KeyZ"];
const ZIPLINE_MOUNT_KEYS = ["ArrowUp"];
const DASH_KEYS = ["ShiftLeft", "ShiftRight"];
const SPRINT_KEYS = ["ShiftLeft", "ShiftRight"];
const LEGACY_MOVE_LEFT_KEYS = MOVE_LEFT_KEYS;
const LEGACY_MOVE_RIGHT_KEYS = MOVE_RIGHT_KEYS;
const LEGACY_CROUCH_KEYS = CROUCH_KEYS;
const LEGACY_JUMP_KEYS = JUMP_KEYS;
const LEGACY_ZIPLINE_MOUNT_KEYS = ZIPLINE_MOUNT_KEYS;
const LEGACY_DASH_KEYS = DASH_KEYS;
const LEGACY_INTERACT_KEYS = ["ArrowUp", "KeyE", "KeyZ"];
const LEGACY_ARM_SWITCH_KEYS = ["MouseMiddle"];
const LEGACY_RELOAD_KEYS = ["KeyR"];
const CAPSLOCK_DASH_TAP_SECONDS = 0.28;
const BULLET_TIME_KEYS = [];
const FOCUS_KEYS = ["KeyC"];
const INTERACTION_HOLD_SECONDS = 0.25;
const FIRE_KEYS = ["KeyX"];
const ARM_SWITCH_RELOAD_KEY = "KeyS";
const ARM_SWITCH_RELOAD_HOLD_SECONDS = 0.35;
const FOCUS_MAX = 100;
const FOCUS_DRAIN_PER_SECOND = 18;
const FOCUS_RECOVER_PER_SECOND = 22;
const FOCUS_MIN_TO_START = 8;
const FOCUS_TIME_SCALE = 0.22;
const WEAPON_HEAT_EMPTY_RATIO = 0.08;
const RECOIL_CHARGE_GRAVITY_MULTIPLIER = 0.32;
const RECOIL_CHARGE_VELOCITY_DRAG_PER_SECOND = 0.35;
const RECOIL_JUMP_CHARGE_HOLD_SECONDS = 0;
const RECOIL_JUMP_CHARGE_STEPS = 5;
const RECOIL_JUMP_CHARGE_COST_FALLOFF = 0.5;
const RECOIL_JUMP_CHARGE_MAX_MULTIPLIER = 2;
const RECOIL_JUMP_FOCUS_COST_SCALE = 0.5;
const RECOIL_JUMP_FOCUS_DRAIN_MULTIPLIER = 4.63;
const RECOIL_JUMP_INPUT_START_STEP_RATIO = 0.12;
const RECOIL_JUMP_FORCE_MULTIPLIER = 0.75;
const RECOIL_JUMP_MIN_STAGE_FORCE_RATIO = 0.5;
const RECOIL_JUMP_CHARGE_EFFECT_MIN_MULTIPLIER = 1.2;
const RECOIL_CHARGE_CAMERA_ZOOM_MIN = 0.36;
const RECOIL_FLIGHT_CAMERA_ZOOM_MIN = 0.44;
const RECOIL_FLIGHT_CAMERA_MIN_SECONDS = 0.34;
const RECOIL_FLIGHT_CAMERA_MAX_SECONDS = 0.72;
const RECOIL_CAMERA_RETURN_ZOOM_PER_SECOND = 0.72;
const RECOIL_CAMERA_RETURN_FOCUS_LERP = 1.45;
const RECOIL_CAMERA_LANDING_HOLD_CHARGE_LEVEL = 0.75;
const INTERACT_KEYS = ["KeyZ", "KeyF", "KeyE"];
const WORLD_INTERACT_KEYS = ["ArrowUp", "KeyE", "KeyZ"];
const NPC_DIALOGUE_UP_KEYS = ["ArrowUp", "KeyW"];
const NPC_DIALOGUE_DOWN_KEYS = ["ArrowDown", "KeyS"];
const NPC_DIALOGUE_CONFIRM_KEYS = ["KeyZ", "Enter", "Space"];
const ATTACK_KEYS = ["KeyV", "KeyF"];
const CONFIRM_KEYS = ["KeyC", "Enter", "KeyZ"];
const INVENTORY_KEYS = ["Tab"];
const NEW_RUN_KEYS = ["KeyN"];
const TITLE_MENU_ITEMS = ["new", "continue"];
const TITLE_MENU_UP_KEYS = ["ArrowUp", "KeyW"];
const TITLE_MENU_DOWN_KEYS = ["ArrowDown", "KeyS"];
const TITLE_MENU_CANCEL_KEYS = ["Escape"];
const OPENING_INTRO_ADVANCE_KEYS = ["KeyZ", "Enter", "KeyC"];
const OPENING_INTRO_SKIP_KEYS = ["Escape"];
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
const SHELTER_MENU_ITEMS = ["talk", "photo", "records", "background", "rest", "exit"];
const SHELTER_HOME_MENU_ITEMS = ["talk", "upgrade", "exit"];
const SHELTER_HUB_MENU_ITEMS = ["upgrade", "exit"];
const SHELTER_CHAT_SUBMIT_EVENT = "silent-passage-shelter-chat-submit";
const SHELTER_TALK_HISTORY_LIMIT = 40;
const SHELTER_TALK_EMOTIONS = new Set(["neutral", "anxious", "warm", "tired", "hurt", "angry"]);
const SHELTER_HOME_EMOTION_ART_ASSETS = {
  neutral: "shelterHomeNeutralCg",
  anxious: "shelterHomeAnxiousCg",
  warm: "shelterHomeWarmCg",
  tired: "shelterHomeTiredCg",
  hurt: "shelterHomeHurtCg",
  angry: "shelterHomeAngryCg",
};
const SHELTER_HOME_BASE_ART_ASSET_KEYS = new Set([
  "shelterFirstArrivalCg",
  "shelterHomeCharmCg",
  ...Object.values(SHELTER_HOME_EMOTION_ART_ASSETS),
]);
const SHELTER_TALK_TOPICS = [
  "오늘 피난처의 분위기를 말한다",
  "다음 원정에 대해 조용히 조언한다",
  "Type-07A의 몸 상태를 걱정한다",
  "잃어버린 기억에 대해 짧게 묻는다",
  "창밖 풍경을 보고 떠오른 생각을 말한다",
  "정비 중인 장비 소리를 듣고 한마디 한다",
  "잠깐 쉬어도 된다고 조심스럽게 말한다",
  "내일도 돌아오라는 말을 돌려서 한다",
  "드론 신호가 곁에 있을 때 느끼는 안정감을 숨기듯 말한다",
  "반복되는 부활의 피로를 짧게 인정한다",
  "장산역 심층으로 가야 하는 이유를 희미하게 떠올린다",
  "자신이 병기인지 사람인지 모르는 혼란을 낮게 말한다",
];
const SHELTER_TALK_VARIATIONS = [
  "one sensory detail",
  "one quiet question",
  "one practical warning",
  "one memory fragment",
  "one soft joke",
  "one unfinished thought",
];
const SHELTER_TALK_CHOICES = [
  {
    label: "상태는 괜찮아?",
    intent: "드론이 몸 상태와 손상 부위를 조심스럽게 확인한다",
    emotion: "hurt",
    reply: "괜찮다고 말하면 거짓말이야. 그래도 아직 움직일 수 있어.",
  },
  {
    label: "기억나는 게 있어?",
    intent: "관리자가 잃어버린 이름과 기억에 대해 낮게 묻는다",
    emotion: "tired",
    reply: "파도 소리랑 흰 방 조각뿐이야. 이름은 아직 떠오르지 않아.",
  },
  {
    label: "조금 쉬자.",
    intent: "드론이 출격보다 휴식을 먼저 권한다",
    emotion: "warm",
    reply: "응. 명령이 아니라 쉬자는 말이라서, 조금 숨이 놓여.",
  },
  {
    label: "난 여기 있어.",
    intent: "당신이 곁을 떠나지 않겠다고 짧게 말한다",
    emotion: "warm",
    reply: "그 말, 신호보다 더 잘 들려. 그러면 아직 혼자는 아니네.",
  },
  {
    label: "무서웠어?",
    intent: "드론이 반복되는 죽음과 부활의 공포를 묻는다",
    emotion: "anxious",
    reply: "무서웠어. 깨어날 때마다 내가 어디까지 남았는지 먼저 확인하게 돼.",
  },
  {
    label: "이번엔 네가 골라.",
    intent: "관리자가 명령이 아니라 선택을 맡긴다",
    emotion: "neutral",
    reply: "내가 골라도 된다면, 오늘은 무모하게 뛰어들고 싶지 않아.",
  },
  {
    label: "아버지 생각이 나?",
    intent: "당신이 아버지의 잔향을 조심스럽게 건드린다",
    emotion: "tired",
    reply: "얼굴은 흐릿한데, 기다리던 목소리만 남아 있어. 그래서 더 아파.",
  },
  {
    label: "나가면 내가 볼게.",
    intent: "드론이 다음 탐색에서 그녀를 지켜보겠다고 말한다",
    emotion: "warm",
    reply: "그럼 뒤를 맡길게. 네 신호가 있으면 발을 헛디디진 않을 것 같아.",
  },
  {
    label: "이름을 찾아보자.",
    intent: "관리자가 잃어버린 이름을 함께 찾자고 말한다",
    emotion: "tired",
    reply: "응. 번호 말고, 누가 불러주던 이름이 있었는지 알고 싶어.",
  },
  {
    label: "무리하지 마.",
    intent: "드론이 임무보다 그녀의 손상을 먼저 걱정한다",
    emotion: "hurt",
    reply: "알겠어. 부품보다 마음이 먼저 삐걱거릴 때가 있거든.",
  },
  {
    label: "장산역이 신경 쓰여?",
    intent: "관리자가 심층으로 향해야 하는 이유를 조심스럽게 묻는다",
    emotion: "angry",
    reply: "응. 아래에서 날 부르는 신호가 있어. 싫은데도 눈을 돌릴 수 없어.",
  },
  {
    label: "오늘은 여기서 멈추자.",
    intent: "당신이 반복되는 출격을 끊고 쉘터의 온기를 붙잡는다",
    emotion: "warm",
    reply: "좋아. 멈춰도 된다는 말이 이렇게 낯설 줄은 몰랐어.",
  },
  {
    label: "네가 사람이라면?",
    intent: "드론이 병기와 인간 사이의 정체성 혼란을 건드린다",
    emotion: "tired",
    reply: "사람이면 이런 질문에 바로 대답할 수 있었을까. 나는 아직 모르겠어.",
  },
  {
    label: "신호 계속 보낼게.",
    intent: "드론이 어둠 속에서도 연결을 유지하겠다고 약속한다",
    emotion: "anxious",
    reply: "끊기지 않게 해줘. 어둠 속에서는 그 소리 하나로 방향을 잡아.",
  },
  {
    label: "아픈 곳부터 말해줘.",
    intent: "관리자가 전투 보고가 아니라 통증을 먼저 묻는다",
    emotion: "hurt",
    reply: "오른쪽 어깨랑 목 뒤가 둔해. 하지만 제일 아픈 건 깨어난 직후야.",
  },
  {
    label: "이번엔 지켜보자.",
    intent: "드론이 성급한 전투보다 관찰과 생존을 권한다",
    emotion: "neutral",
    reply: "응. 싸우기 전에 먼저 보자. 이번엔 살아서 돌아오는 쪽을 고를래.",
  },
];
const SHELTER_ARRIVAL_SECONDS = 2.4;
const SHELTER_EXIT_COOLDOWN_SECONDS = 1.2;
const SHELTER_EVENT_BRIDGE_SECONDS = 1.15;
const SHELTER_CHOICE_REVEAL_DELAY_SECONDS = 0.42;
const SHELTER_CHOICE_REACTION_SECONDS = 0.48;
const SHELTER_TALK_DOOR_TRANSITION_SECONDS = 0.62;
const SHELTER_SUBTITLE_TYPE_MIN_SECONDS = 0.18;
const SHELTER_SUBTITLE_TYPE_MAX_SECONDS = 2.6;
const SHELTER_TYPING_SOUND_MAX_CATCHUP = 4;
const SHELTER_TYPING_SOUND_DEFAULT_INTERVAL = 0.045;
const SHELTER_TYPING_SOUND_GAIN = 12;
const SHELTER_TYPING_SOUND_PRESETS = {
  neutral: { base: 520, step: 13, volume: 0.036, interval: 0.045, duration: 0.034, tone: "triangle", filter: 1900 },
  warm: { base: 460, step: 10, volume: 0.04, interval: 0.052, duration: 0.04, tone: "sine", filter: 1500 },
  anxious: { base: 650, step: 18, volume: 0.029, interval: 0.038, duration: 0.028, tone: "triangle", filter: 2500 },
  tired: { base: 380, step: 8, volume: 0.028, interval: 0.07, duration: 0.046, tone: "sine", filter: 1200 },
  hurt: { base: 430, step: 9, volume: 0.026, interval: 0.085, duration: 0.042, tone: "triangle", filter: 1350 },
  angry: { base: 700, step: 22, volume: 0.033, interval: 0.04, duration: 0.028, tone: "square", filter: 3000 },
};
const SHELTER_NIGHT_LOCK_MESSAGE = "피난처는 밤에만 열려.";
const SHELTER_COOLDOWN_MESSAGE = "피난처 문이 아직 닫히는 중이야.";
const SHELTER_MENU_UP_KEYS = ["ArrowUp", "KeyW"];
const SHELTER_MENU_DOWN_KEYS = ["ArrowDown", "KeyS"];
const SHELTER_VIEW_LEFT_KEYS = ["ArrowLeft", "KeyA"];
const SHELTER_VIEW_RIGHT_KEYS = ["ArrowRight", "KeyD"];
const SHELTER_EXIT_KEYS = ["KeyC"];
const SHELTER_BACK_KEYS = ["Escape"];
const SHELTER_TALK_CONFIRM_KEYS = ["KeyZ", "Enter"];
const CG_PHOTO_LIMIT = 12;
const FACE_OFF_ENTRY_KEYS = ["ArrowUp", "KeyE", "KeyZ"];
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
const AIR_DASH_HOVER_SECONDS = 0.5;
const AIR_DASH_HOVER_RISE_SPEED = 35;
const AIR_DASH_HOVER_BRAKE = 420;
const SEARCH_MUSIC_SRC = "./assets/audio/search.mp3";
const SHELTER_MUSIC_SRC = "./assets/audio/bloom-through-concrete.mp3";
const VAULT_ESCAPE_MUSIC_SRC = "./assets/audio/escape.mp3";
const NPC_DIALOGUE_MUSIC_VOLUME = 0.16;
const NPC_DIALOGUE_MUSIC_FADE_SECONDS = 0.65;
const NPC_DIALOGUE_CAMERA_LERP = 8.5;
const NPC_DIALOGUE_CAMERA_HEAD_FOCUS_Y = 0.46;
const PROCEDURAL_SFX_OUTPUT_BOOST = 1.8;
const AIR_DASH_DIAGONAL_GRACE_SECONDS = 0.08;
const AIR_DASH_DISTANCE_MULTIPLIER = 1.25;
const AIR_DASH_INERTIA_RETAIN_RATIO = 0.25;
const CELESTE_END_DASH_SPEED_RATIO = 2 / 3;
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

function useLegacyControls(state) {
  return Boolean(state.capsLockActive && !state.forceModernControls);
}

function getMoveLeftKeys(state) {
  return useLegacyControls(state) ? LEGACY_MOVE_LEFT_KEYS : MOVE_LEFT_KEYS;
}

function getMoveRightKeys(state) {
  return useLegacyControls(state) ? LEGACY_MOVE_RIGHT_KEYS : MOVE_RIGHT_KEYS;
}

function getCrouchKeys(state) {
  return useLegacyControls(state) ? LEGACY_CROUCH_KEYS : CROUCH_KEYS;
}

function getJumpKeys(state) {
  return useLegacyControls(state) ? LEGACY_JUMP_KEYS : JUMP_KEYS;
}

function getZipLineMountKeys(state) {
  return useLegacyControls(state) ? LEGACY_ZIPLINE_MOUNT_KEYS : ZIPLINE_MOUNT_KEYS;
}

function getDashKeys(state) {
  return useLegacyControls(state) ? LEGACY_DASH_KEYS : DASH_KEYS;
}

function getInteractKeys(state) {
  return useLegacyControls(state) ? LEGACY_INTERACT_KEYS : WORLD_INTERACT_KEYS;
}

function getFaceOffEntryKeys(state) {
  return useLegacyControls(state) ? LEGACY_INTERACT_KEYS : FACE_OFF_ENTRY_KEYS;
}

function getArmSwitchKeys(state) {
  return useLegacyControls(state) ? LEGACY_ARM_SWITCH_KEYS : ARM_SWITCH_KEYS;
}

function getReloadKeys(state) {
  return useLegacyControls(state) ? LEGACY_RELOAD_KEYS : RELOAD_KEYS;
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

function clearMouseCombatPrimaryInput(state) {
  if (!state.mouse) {
    return;
  }
  state.mouse.primaryDown = false;
  state.mouse.primaryJustPressed = false;
}

function consumeRelease(state, code) {
  if (state.justReleased?.has(code)) {
    state.justReleased.delete(code);
    return true;
  }
  return false;
}

function consumeEitherRelease(state, codes) {
  return codes.some((code) => consumeRelease(state, code));
}

function getKeyHoldSeconds(state, code) {
  return Number(state.keyHoldSeconds?.get(code) ?? 0);
}

function consumeReleasedKeyHoldSeconds(state, code) {
  const duration = Number(state.releasedKeyHoldSeconds?.get(code) ?? 0);
  state.releasedKeyHoldSeconds?.delete(code);
  return duration;
}

function consumeShortReleasedKey(state, codes, maxSeconds = INTERACTION_HOLD_SECONDS) {
  const code = codes.find((entry) => state.justReleased?.has(entry));
  if (!code) {
    return false;
  }
  consumeRelease(state, code);
  return consumeReleasedKeyHoldSeconds(state, code) <= maxSeconds;
}

function updateKeyHoldDurations(state, dt) {
  if (!state.keyHoldSeconds) {
    state.keyHoldSeconds = new Map();
  }
  if (!state.releasedKeyHoldSeconds) {
    state.releasedKeyHoldSeconds = new Map();
  }
  state.pressed.forEach((code) => {
    state.keyHoldSeconds.set(code, Number(state.keyHoldSeconds.get(code) ?? 0) + dt);
  });
}

function updateCapsLockDashInput(state, player, dt, moveLeft, moveRight) {
  player.capsDashTapTimer = Math.max(0, (player.capsDashTapTimer ?? 0) - dt);
  const capsLockActive = Boolean(state.capsLockActive);

  if (!capsLockActive) {
    player.capsDashHoldDirection = 0;
    player.capsDashLastTapDirection = 0;
    player.capsDashTapTimer = 0;
    return {
      dashPressed: false,
      sprintHeld: false,
    };
  }

  let dashPressed = false;
  let tapDirection = 0;
  if (state.justPressed.has("KeyA") || state.justPressed.has("ArrowLeft")) {
    tapDirection = -1;
  } else if (state.justPressed.has("KeyD") || state.justPressed.has("ArrowRight")) {
    tapDirection = 1;
  }

  if (tapDirection !== 0) {
    if (
      player.capsDashLastTapDirection === tapDirection &&
      (player.capsDashTapTimer ?? 0) > 0
    ) {
      dashPressed = true;
      player.capsDashHoldDirection = tapDirection;
      player.capsDashTapTimer = 0;
      player.capsDashLastTapDirection = 0;
    } else {
      player.capsDashLastTapDirection = tapDirection;
      player.capsDashTapTimer = CAPSLOCK_DASH_TAP_SECONDS;
    }
  }

  const holdDirection = player.capsDashHoldDirection || 0;
  const holdingDashDirection = holdDirection < 0
    ? moveLeft && !moveRight
    : holdDirection > 0
      ? moveRight && !moveLeft
      : false;
  if (!holdingDashDirection) {
    player.capsDashHoldDirection = 0;
  }

  return {
    dashPressed,
    sprintHeld: holdingDashDirection,
  };
}

function updateUserCameraZoom(state) {
  const run = state.run;
  if (!run || state.scene !== SCENES.EXPEDITION || run.mapOverlay?.active) {
    return;
  }

  const zoomIn = consumeEitherPress(state, CAMERA_USER_ZOOM_IN_KEYS);
  const zoomOut = consumeEitherPress(state, CAMERA_USER_ZOOM_OUT_KEYS);
  if (zoomIn === zoomOut) {
    return;
  }

  const current = clamp(run.cameraUserZoom ?? 1, CAMERA_USER_ZOOM_MIN, CAMERA_USER_ZOOM_MAX);
  const next = clamp(
    current * (zoomIn ? CAMERA_USER_ZOOM_STEP : 1 / CAMERA_USER_ZOOM_STEP),
    CAMERA_USER_ZOOM_MIN,
    CAMERA_USER_ZOOM_MAX,
  );
  run.cameraUserZoom = next;
  run.message = `Camera zoom ${Math.round(next * 100)}%`;
  run.noticeTimer = 1.2;
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
  state.justReleased?.clear();
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

function spawnConcreteBlockShards(run, block, originX, originY, directionX, directionY, amount = 14) {
  const dirLength = Math.max(0.001, Math.hypot(directionX, directionY));
  const dirX = directionX / dirLength;
  const dirY = directionY / dirLength;
  const baseAngle = Math.atan2(dirY, dirX);
  const palette = ["#8b8d86", "#74776f", "#62665f", "#9a9b92", "#515650"];
  const left = block.x;
  const right = block.x + block.width;
  const top = block.y;
  const bottom = block.y + block.height;
  for (let index = 0; index < amount; index += 1) {
    const edgeBias = Math.random();
    const sourceX = edgeBias < 0.62
      ? clamp(originX + (Math.random() - 0.5) * block.width * 0.62, left, right)
      : left + Math.random() * block.width;
    const sourceY = edgeBias < 0.62
      ? clamp(originY + (Math.random() - 0.5) * block.height * 0.62, top, bottom)
      : top + Math.random() * block.height;
    const angle = baseAngle + (Math.random() - 0.5) * 1.22;
    const velocity = 260 + Math.random() * 520;
    const size = 10 + Math.random() * 24;
    const life = 0.55 + Math.random() * 0.42;
    run.particles.push({
      shape: "concreteShard",
      x: sourceX,
      y: sourceY,
      vx: Math.cos(angle) * velocity + dirX * 120,
      vy: Math.sin(angle) * velocity + dirY * 120 - Math.random() * 120,
      life,
      maxLife: life,
      color: palette[index % palette.length],
      radius: size * 0.5,
      width: size * (0.8 + Math.random() * 0.9),
      height: size * (0.45 + Math.random() * 0.7),
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 14,
    });
  }
}

function getParticleCollisionRect(particle) {
  const width = Math.max(2, particle.width ?? particle.radius * 2);
  const height = Math.max(2, particle.height ?? particle.radius * 2);
  return createRect(particle.x - width * 0.5, particle.y - height * 0.5, width, height);
}

function resolveConcreteShardCollision(particle, data, previousX, previousY) {
  if (particle.shape !== "concreteShard" || !data) {
    return;
  }
  const platforms = getSolidLevelPlatforms(data);
  if (!platforms.length) {
    return;
  }
  const rect = getParticleCollisionRect(particle);
  for (const platform of platforms) {
    if (!rectsOverlap(rect, platform)) {
      continue;
    }
    const previousRect = {
      ...rect,
      x: previousX - rect.width * 0.5,
      y: previousY - rect.height * 0.5,
    };
    if (previousRect.y + previousRect.height <= platform.y && particle.vy > 0) {
      particle.y = platform.y - rect.height * 0.5 - 0.1;
      particle.vy *= -0.16;
      particle.vx *= 0.48;
      particle.spin *= 0.42;
    } else if (previousRect.y >= platform.y + platform.height && particle.vy < 0) {
      particle.y = platform.y + platform.height + rect.height * 0.5 + 0.1;
      particle.vy *= -0.12;
      particle.vx *= 0.62;
      particle.spin *= 0.5;
    } else if (previousRect.x + previousRect.width <= platform.x && particle.vx > 0) {
      particle.x = platform.x - rect.width * 0.5 - 0.1;
      particle.vx *= -0.18;
      particle.vy *= 0.72;
      particle.spin *= 0.55;
    } else if (previousRect.x >= platform.x + platform.width && particle.vx < 0) {
      particle.x = platform.x + platform.width + rect.width * 0.5 + 0.1;
      particle.vx *= -0.18;
      particle.vy *= 0.72;
      particle.spin *= 0.55;
    } else {
      particle.x = previousX;
      particle.y = previousY;
      particle.vx *= -0.12;
      particle.vy *= -0.12;
      particle.spin *= 0.35;
    }
    particle.life = Math.min(particle.life, Math.max(0.22, (particle.maxLife ?? particle.life) * 0.58));
    return;
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
    const previousX = particle.x;
    const previousY = particle.y;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 360 * dt;
    particle.rotation = (particle.rotation ?? 0) + (particle.spin ?? 0) * dt;
    resolveConcreteShardCollision(particle, data, previousX, previousY);
    return particle.life > 0;
  });

  if ((run.screenShakeTimer ?? 0) > 0) {
    run.screenShakeTimer = Math.max(0, run.screenShakeTimer - visualDt);
    if (run.screenShakeTimer === 0) {
      run.screenShakeIntensity = 0;
    }
  }

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

function getActiveCameraZone(run, data) {
  const player = run?.player;
  if (!player || !Array.isArray(data.cameraZones)) {
    return null;
  }
  const centerX = player.x + player.width * 0.5;
  const centerY = player.y + player.height * 0.5;
  let activeZone = null;
  let activePriority = Number.NEGATIVE_INFINITY;
  data.cameraZones.forEach((zone) => {
    if (
      !zone ||
      zone.enabled === false ||
      centerX < zone.x ||
      centerX > zone.x + zone.width ||
      centerY < zone.y ||
      centerY > zone.y + zone.height
    ) {
      return;
    }
    const priority = Number(zone.priority ?? 0);
    if (priority >= activePriority) {
      activeZone = zone;
      activePriority = priority;
    }
  });
  return activeZone;
}

function getCameraZoneFrame(zone) {
  if (!zone) {
    return null;
  }
  const width = Math.max(24, Number(zone.width ?? CAMERA_SCREEN_WIDTH));
  const height = Math.max(24, Number(zone.height ?? CAMERA_SCREEN_HEIGHT));
  const fitZoom = Math.min(CAMERA_SCREEN_WIDTH / width, CAMERA_SCREEN_HEIGHT / height);
  const zoomScale = Math.max(0.1, Number(zone.zoom ?? 1));
  const minZoomScale = Math.max(0.1, Number(zone.minZoom ?? zoomScale));
  const zoom = clamp(fitZoom * zoomScale, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  return {
    x: Number(zone.x ?? 0),
    y: Number(zone.y ?? 0),
    width,
    height,
    zoom,
    minZoom: clamp(fitZoom * minZoomScale, CAMERA_ABSOLUTE_ZOOM_MIN, zoom),
  };
}

function getEffectiveCameraConfig(data, run) {
  const config = getCameraConfig(data);
  const activeZone = getActiveCameraZone(run, data);
  const zoneFrame = getCameraZoneFrame(activeZone);
  const zoneConfig = activeZone
    ? {
      zoom: zoneFrame.zoom,
      minZoom: zoneFrame.minZoom,
      neutralFocusX: activeZone.focusX,
      neutralFocusY: activeZone.focusY,
      zoomLerp: activeZone.zoomLerp,
      focusLerp: activeZone.focusLerp,
      cameraZoneFrame: zoneFrame,
    }
    : null;
  const mergedConfig = zoneConfig
    ? Object.fromEntries(
      Object.entries({ ...config, ...zoneConfig }).filter(([, value]) => value !== undefined && value !== null),
    )
    : config;
  const baseZoom = mergedConfig.zoom ?? 1;
  const userZoom = clamp(run?.cameraUserZoom ?? 1, CAMERA_USER_ZOOM_MIN, CAMERA_USER_ZOOM_MAX);
  if (run) {
    run.activeCameraZoneId = activeZone?.id || null;
    run.activeCameraZoneLabel = activeZone?.label || null;
  }
  return {
    ...mergedConfig,
    zoom: clamp(baseZoom * userZoom, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX),
  };
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
  const firedActive = player.recoilCameraTimer > 0 || player.recoilCameraHoldUntilLanding;

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

  const inputDirection = Math.sign(player.cameraInputDirection ?? 0);
  if (inputDirection !== 0) {
    return inputDirection;
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

function isCameraInputLookActive(player, config) {
  if (Math.sign(player.cameraInputDirection ?? 0) === 0) {
    return false;
  }
  if (player.dashTimer > 0 && config.dashAffectsCamera === false) {
    return false;
  }
  if (isBraceCameraState(player) && config.braceAffectsCamera === false) {
    return false;
  }
  return true;
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
  const inputBoost = isCameraInputLookActive(player, config)
    ? Math.max(0, Number(config.inputLookAheadBoost ?? 0) || 0)
    : 0;
  const withInputBoost = (value) => value + inputBoost;
  if (player.dashTimer > 0 && config.dashAffectsCamera !== false) {
    return withInputBoost(config.dashLookAhead ?? 0.18);
  }
  if (player.wallRunActive) {
    return withInputBoost(config.wallRunLookAhead ?? 0);
  }
  if (isBraceCameraState(player) && config.braceAffectsCamera !== false) {
    return withInputBoost(config.braceLookAhead ?? 0.14);
  }
  const sprintCameraActive = isSprintCameraActive(player, config);
  if (!player.onGround && player.sprintJumpCarryTimer > 0 && sprintCameraActive) {
    return withInputBoost(config.sprintJumpLookAhead ?? 0.25);
  }
  if (sprintCameraActive) {
    const lookAhead = player.onGround
      ? (config.sprintLookAhead ?? 0.18)
      : (config.sprintJumpLookAhead ?? 0.25);
    return withInputBoost(lookAhead);
  }
  if (!player.onGround && player.vy > 220) {
    return withInputBoost(config.fallLookAhead ?? 0.12);
  }
  return withInputBoost(config.walkLookAhead ?? 0.08);
}

function getFallCameraRatio(player, config) {
  const start = config.fallDownSpeedStart ?? 240;
  const full = Math.max(start + 1, config.fallDownSpeedFull ?? 1120);
  if (player.onGround || player.vy <= start) {
    return 0;
  }
  return clamp((player.vy - start) / (full - start), 0, 1);
}

function getSpeedDownCameraRatio(player, config) {
  const maxLookAhead = Math.max(0, Number(config.speedDownLookAhead ?? 0) || 0);
  if (maxLookAhead <= 0) {
    return 0;
  }
  if (
    player.wallRunActive ||
    player.wallRunBoostActive ||
    isBraceCameraState(player) ||
    (!player.onGround && player.vy < -240)
  ) {
    return 0;
  }

  const horizontalSpeed = Math.abs(player.vx);
  const start = config.speedDownLookAheadStart ?? config.sprintCameraMinSpeed ?? 360;
  const full = Math.max(start + 1, config.speedDownLookAheadFull ?? config.speedZoomFull ?? 620);
  const baseRatio = clamp((horizontalSpeed - start) / (full - start), 0, 1);
  if (baseRatio <= 0) {
    return 0;
  }

  const highSpeedFallback = horizontalSpeed >= full;
  const actionActive = isSprintCameraActive(player, config) ||
    !player.onGround ||
    player.zipLineActive ||
    highSpeedFallback;
  if (!actionActive) {
    return 0;
  }

  const movementMultiplier = player.onGround
    ? (config.speedDownGroundMultiplier ?? 0.18)
    : (config.speedDownAirMultiplier ?? 1.15);
  const fallStart = Math.max(1, config.fallDownSpeedStart ?? 240);
  const fallRatio = player.vy > 0 ? clamp(player.vy / fallStart, 0, 1) : 0;
  const fallMultiplier = lerp(1, config.speedDownFallMultiplier ?? 1.25, fallRatio);
  return clamp(baseRatio * movementMultiplier * fallMultiplier, 0, 1);
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
    const centerOffset = Math.max(0, Number(config.fallCameraCenterOffset ?? 0) || 0) * run.cameraFallRatio;
    run.cameraFallTargetYOffset = centerOffset + getFallLandingCameraOffset(player, data, config, run.cameraFallRatio);
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

function getCameraVerticalFocus(player, config, fallCamera = null, speedDownRatio = null) {
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
    const legacyOffset = Math.max(0, Math.abs(Number(config.fallingFocusOffset ?? -0.14) || 0));
    const legacyFallFocus = neutralFocusY - legacyOffset;
    const startFocusY = config.fallDownFocusStartY ?? lerp(neutralFocusY, legacyFallFocus, 0.55);
    const fullFocusY = config.fallDownFocusFullY ?? lerp(neutralFocusY, legacyFallFocus, 1.25);
    return lerp(startFocusY, fullFocusY, fallRatio);
  }
  const downRatio = speedDownRatio ?? getSpeedDownCameraRatio(player, config);
  if (downRatio > 0) {
    const downLookAhead = Math.max(0, Number(config.speedDownLookAhead ?? 0) || 0);
    return neutralFocusY - downLookAhead * downRatio;
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
  const baseZoom = clamp(config.zoom ?? 1, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  if (
    (player.dashTimer > 0 && config.dashAffectsCamera === false)
    || (isBraceCameraState(player) && config.braceAffectsCamera === false)
  ) {
    return {
      ratio: 0,
      zoom: baseZoom,
      speed: 0,
    };
  }

  const start = config.speedZoomStart ?? 260;
  const full = Math.max(start + 1, config.speedZoomFull ?? 980);
  const speed = getCameraSpeed(player, config);
  const ratio = clamp((speed - start) / (full - start), 0, 1);
  return getSpeedZoomFromRatio(config, ratio, speed);
}

function getSpeedZoomFromRatio(config, ratio, speed = 0) {
  const baseZoom = clamp(config.zoom ?? 1, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  const safeRatio = clamp(ratio, 0, 1);
  const speedZoomMin = baseZoom * getReducedCameraZoomRatio(config.speedZoomMin ?? config.minZoom, 0.88);
  return {
    ratio: safeRatio,
    zoom: clamp(lerp(baseZoom, speedZoomMin, safeRatio), CAMERA_ABSOLUTE_ZOOM_MIN, baseZoom),
    speed,
  };
}

function clearSpeedCameraState(run) {
  if (!run) {
    return;
  }
  run.cameraSpeedHoldRatio = 0;
  run.cameraSpeedRawRatio = 0;
  run.cameraSpeedHoldReturning = false;
}

function updateSpeedCameraHoldState(run, player, config, dt, rawSpeedZoom = null) {
  const current = rawSpeedZoom || getSpeedZoomState(player, config);
  const previousHoldRatio = clamp(run.cameraSpeedHoldRatio ?? 0, 0, 1);
  const holdMinRatio = clamp(config.speedCameraHoldMinRatio ?? 0.12, 0, 1);
  const releaseSpeed = Math.max(0, Number(config.speedCameraReleaseSpeed ?? 48) || 0);
  const returnLerp = Math.max(0, Number(config.speedCameraReturnLerp ?? config.zoomLerp ?? 2.2) || 0);
  let holdRatio = previousHoldRatio;
  let returning = false;

  if (current.ratio >= holdMinRatio) {
    holdRatio = Math.max(previousHoldRatio, current.ratio);
  } else if (previousHoldRatio > 0 && current.speed > releaseSpeed) {
    holdRatio = previousHoldRatio;
  } else if (previousHoldRatio > 0) {
    returning = true;
    holdRatio = lerp(previousHoldRatio, current.ratio, Math.min(1, dt * returnLerp));
    if (holdRatio < 0.01) {
      holdRatio = 0;
      returning = false;
    }
  }

  run.cameraSpeedRawRatio = current.ratio;
  run.cameraSpeedHoldRatio = holdRatio;
  run.cameraSpeedHoldReturning = returning;
  return getSpeedZoomFromRatio(config, Math.max(current.ratio, holdRatio), current.speed);
}

function getCameraScaledZoom(baseZoom, value, fallback) {
  return clamp(baseZoom * getReducedCameraZoomRatio(value, fallback), CAMERA_ABSOLUTE_ZOOM_MIN, baseZoom);
}

function getReducedCameraZoomRatio(value, fallback) {
  const zoomRatio = clamp(value ?? fallback, 0.1, 1);
  return 1 - (1 - zoomRatio) * CAMERA_ACTION_ZOOM_OUT_SCALE;
}

function clearFallCameraState(run) {
  if (!run) {
    return;
  }
  run.cameraFallRatio = 0;
  run.cameraFallHoldTimer = 0;
  run.cameraFallTargetYOffset = 0;
}

function beginRecoilCameraReturn(player, run = null) {
  if (!player) {
    return;
  }
  player.recoilCameraReturning = true;
  if (run) {
    run.cameraFallHoldTimer = 0;
  }
}

function updateRecoilCameraTimers(player, dt, run = null) {
  if (player.recoilCameraHoldUntilLanding && player.onGround) {
    releaseRecoilCameraAfterLanding(player, run);
    return;
  }

  const previousTimer = Math.max(0, Number(player.recoilCameraTimer ?? 0));
  player.recoilCameraTimer = Math.max(0, previousTimer - dt);
  if (previousTimer > 0 && player.recoilCameraTimer === 0) {
    if (player.recoilCameraHoldUntilLanding && !player.onGround) {
      return;
    }
    beginRecoilCameraReturn(player, run);
  }
}

function releaseRecoilCameraAfterLanding(player, run = null) {
  if (!player.recoilCameraHoldUntilLanding) {
    return;
  }
  player.recoilCameraHoldUntilLanding = false;
  player.recoilCameraTimer = 0;
  beginRecoilCameraReturn(player, run);
}

function getCameraTargetZoom(player, config, fallCamera = null, speedZoomOverride = null) {
  const baseZoom = clamp(config.zoom ?? 1, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  let targetZoom = baseZoom;
  let sprintZoomFloor = null;
  let actionZoomFloor = baseZoom * getReducedCameraZoomRatio(config.minZoom ?? config.speedZoomMin, 0.88);
  if (player.wallRunActive || player.wallRunBoostActive) {
    targetZoom = getCameraScaledZoom(baseZoom, config.wallRunZoom, 0.94);
  } else if (player.dashTimer > 0 && config.dashAffectsCamera !== false) {
    targetZoom = getCameraScaledZoom(baseZoom, config.dashZoom, 0.95);
  } else if (isBraceCameraState(player) && config.braceAffectsCamera !== false) {
    targetZoom = getCameraScaledZoom(baseZoom, config.braceZoom, 0.96);
  } else if (!player.onGround && player.sprintJumpCarryTimer > 0 && isSprintCameraActive(player, config)) {
    targetZoom = getCameraScaledZoom(baseZoom, config.sprintJumpZoom, 0.92);
    sprintZoomFloor = targetZoom;
  } else if (isSprintCameraActive(player, config)) {
    targetZoom = player.onGround
      ? getCameraScaledZoom(baseZoom, config.sprintZoom, 0.96)
      : getCameraScaledZoom(baseZoom, config.sprintJumpZoom, 0.92);
    sprintZoomFloor = targetZoom;
  }

  if (player.recoilJumpChargeActive) {
    const chargeProgress = clamp(
      ((player.recoilJumpChargeMultiplier ?? 1) - 1) / Math.max(0.001, RECOIL_JUMP_CHARGE_MAX_MULTIPLIER - 1),
      0,
      1,
    );
    const chargeZoom = baseZoom * lerp(0.9, RECOIL_CHARGE_CAMERA_ZOOM_MIN, chargeProgress);
    targetZoom = Math.min(targetZoom, chargeZoom);
    actionZoomFloor = Math.min(actionZoomFloor, baseZoom * RECOIL_CHARGE_CAMERA_ZOOM_MIN);
  } else if (player.recoilCameraTimer > 0 || player.recoilCameraHoldUntilLanding) {
    const flightZoom = baseZoom * RECOIL_FLIGHT_CAMERA_ZOOM_MIN;
    targetZoom = Math.min(targetZoom, flightZoom);
    actionZoomFloor = Math.min(actionZoomFloor, flightZoom);
  }

  const fallRatio = fallCamera?.ratio ?? 0;
  if (fallRatio > 0) {
    const fallZoom = baseZoom * getReducedCameraZoomRatio(config.fallZoom, 0.9);
    targetZoom = Math.min(targetZoom, lerp(baseZoom, fallZoom, fallRatio));
  }

  const speedZoom = speedZoomOverride || getSpeedZoomState(player, config);
  if (speedZoom.ratio > 0) {
    const speedZoomTarget = sprintZoomFloor === null
      ? speedZoom.zoom
      : Math.max(speedZoom.zoom, sprintZoomFloor);
    targetZoom = Math.min(targetZoom, speedZoomTarget);
  }

  const minZoom = clamp(
    actionZoomFloor,
    CAMERA_ABSOLUTE_ZOOM_MIN,
    baseZoom,
  );
  return clamp(targetZoom, minZoom, baseZoom);
}

function constrainCameraToPlayer(cameraX, cameraY, run, data, viewportWidth, viewportHeight, config) {
  const player = run.player;
  const maxX = Math.max(0, data.world.width - viewportWidth);
  const maxY = Math.max(0, data.world.height - viewportHeight);
  const maxMarginX = Math.max(0, (viewportWidth - player.width) * 0.5);
  const maxMarginY = Math.max(0, (viewportHeight - player.height) * 0.5);
  const marginX = Math.min(
    config.keepPlayerVisibleMarginX ?? viewportWidth * 0.16,
    maxMarginX,
  );
  const marginY = Math.min(
    config.keepPlayerVisibleMarginY ?? viewportHeight * 0.14,
    maxMarginY,
  );

  let minCameraX = player.x + player.width + marginX - viewportWidth;
  let maxCameraX = player.x - marginX;
  let minCameraY = player.y + player.height + marginY - viewportHeight;
  let maxCameraY = player.y - marginY;

  if (minCameraX > maxCameraX) {
    const centeredX = player.x + player.width * 0.5 - viewportWidth * 0.5;
    minCameraX = centeredX;
    maxCameraX = centeredX;
  }
  if (minCameraY > maxCameraY) {
    const centeredY = player.y + player.height * 0.5 - viewportHeight * 0.5;
    minCameraY = centeredY;
    maxCameraY = centeredY;
  }

  const minWorldCameraY = Math.min(0, minCameraY, maxCameraY);
  return {
    x: clamp(clamp(cameraX, minCameraX, maxCameraX), 0, maxX),
    y: clamp(clamp(cameraY, minCameraY, maxCameraY), minWorldCameraY, maxY),
  };
}

function syncCamera(run, data, dt) {
  const config = getEffectiveCameraConfig(data, run);
  const cameraDt = Math.min(
    Math.max(0, dt),
    config.maxLerpStepSeconds ?? CAMERA_MAX_LERP_STEP_SECONDS,
  );
  const zoneFrame = config.cameraZoneFrame || null;
  if (!config.lookAheadEnabled) {
    const zoom = clamp(config.zoom ?? 1, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
    const viewportWidth = CAMERA_SCREEN_WIDTH / zoom;
    const viewportHeight = CAMERA_SCREEN_HEIGHT / zoom;
    const targetX = zoneFrame
      ? zoneFrame.x + zoneFrame.width * 0.5 - viewportWidth * 0.5
      : run.player.x - viewportWidth * CAMERA_FOCUS_X;
    const targetY = zoneFrame
      ? zoneFrame.y + zoneFrame.height * 0.5 - viewportHeight * 0.5
      : run.player.y - viewportHeight * CAMERA_FOCUS_Y;
    const maxX = Math.max(0, data.world.width - viewportWidth);
    const maxY = Math.max(0, data.world.height - viewportHeight);
    run.cameraZoom = zoom;
    run.cameraFocusX = CAMERA_FOCUS_X;
    run.cameraFocusY = CAMERA_FOCUS_Y;
    run.cameraTargetX = targetX;
    run.cameraTargetY = targetY;
    run.cameraTargetZoom = zoom;
    run.cameraLookAhead = 0;
    run.cameraDownLookAhead = 0;
    run.cameraSpeedRatio = 0;
    clearSpeedCameraState(run);
    const nextX = clamp(lerp(run.cameraX, targetX, Math.min(1, cameraDt * 4.5)), 0, maxX);
    const nextY = clamp(lerp(run.cameraY, targetY, Math.min(1, cameraDt * 4.5)), 0, maxY);
    const camera = zoneFrame
      ? { x: nextX, y: nextY }
      : constrainCameraToPlayer(
        nextX,
        nextY,
        run,
        data,
        viewportWidth,
        viewportHeight,
        config,
      );
    run.cameraX = camera.x;
    run.cameraY = camera.y;
    return;
  }

  const player = run.player;
  const freezeActionCamera = (
    (player.dashTimer > 0 && config.dashAffectsCamera === false)
    || (isBraceCameraState(player) && config.braceAffectsCamera === false)
  );
  const recoilCamera = freezeActionCamera ? null : getRecoilCameraState(run, config);
  const recoilReturning = !freezeActionCamera && Boolean(player.recoilCameraReturning);
  const fallCamera = updateFallCameraState(run, player, data, config, cameraDt);
  const recoilFallFollow = Boolean(
    recoilCamera &&
    player.recoilCameraHoldUntilLanding &&
    fallCamera.ratio > 0
  );
  const applyFallCamera = !freezeActionCamera && !recoilReturning && fallCamera.ratio > 0 && (
    recoilFallFollow ||
    (!recoilCamera && (fallCamera.active || player.onGround))
  );
  const speedDownCameraRatio = (!freezeActionCamera && !recoilCamera && !recoilReturning && fallCamera.ratio <= 0)
    ? getSpeedDownCameraRatio(player, config)
    : 0;
  const targetLookDirection = freezeActionCamera
    ? (run.cameraLookDirection || player.facing || 1)
    : recoilCamera && Math.abs(recoilCamera.directionX) > 0.08
      ? Math.sign(recoilCamera.directionX)
    : recoilReturning
      ? (run.cameraLookDirection || player.facing || 1)
    : getCameraLookDirection(player, run, config);
  const directionLerpRate = isCameraInputLookActive(player, config)
    ? (config.inputDirectionLerp ?? config.directionLerp ?? 6)
    : (config.directionLerp ?? 6);
  const directionLerp = Math.min(1, cameraDt * directionLerpRate);
  run.cameraLookDirection = lerp(run.cameraLookDirection || targetLookDirection, targetLookDirection, directionLerp);
  const focusLookDirection = clamp(run.cameraLookDirection || targetLookDirection || player.facing || 1, -1, 1);

  const lookAhead = freezeActionCamera
    ? (run.cameraLookAhead ?? 0)
    : recoilReturning
      ? 0
    : recoilCamera
      ? Math.abs(recoilCamera.directionX) * recoilCamera.horizontalLookAhead
      : getCameraLookAhead(player, config);
  const focusXMin = clamp(config.lookAheadMinFocusX ?? 0.24, 0.08, 0.5);
  const focusXMax = clamp(config.lookAheadMaxFocusX ?? 0.76, 0.5, 0.92);
  const neutralFocusX = config.neutralFocusX ?? 0.5;
  const neutralFocusY = config.neutralFocusY ?? 0.5;
  const targetFocusX = zoneFrame
    ? 0.5
    : freezeActionCamera
    ? clamp(run.cameraFocusX ?? neutralFocusX, focusXMin, focusXMax)
    : recoilReturning
    ? clamp(neutralFocusX, focusXMin, focusXMax)
    : clamp(
      neutralFocusX - focusLookDirection * lookAhead,
      focusXMin,
      focusXMax,
    );
  const minFocusY = fallCamera.ratio > 0
    ? (config.fallMinFocusY ?? 0.18)
    : 0.28;
  const fallTargetFocusY = clamp(
    getCameraVerticalFocus(player, config, fallCamera, speedDownCameraRatio),
    minFocusY,
    0.72,
  );
  const recoilTargetFocusY = recoilCamera
    ? clamp(
      neutralFocusY - recoilCamera.directionY * recoilCamera.verticalLookAhead,
      recoilFallFollow ? minFocusY : 0.28,
      0.72,
    )
    : null;
  const targetFocusY = zoneFrame
    ? 0.5
    : freezeActionCamera
    ? clamp(run.cameraFocusY ?? neutralFocusY, 0.28, 0.72)
    : recoilReturning
    ? clamp(neutralFocusY, 0.28, 0.72)
    : recoilCamera
      ? recoilFallFollow
        ? Math.min(recoilTargetFocusY, fallTargetFocusY)
        : recoilTargetFocusY
    : fallTargetFocusY;
  const focusLerp = Math.min(1, cameraDt * (
    player.recoilCameraReturning
      ? RECOIL_CAMERA_RETURN_FOCUS_LERP
      : (config.focusLerp ?? 5.5)
  ));
  const fallFocusRate = lerp(
    config.fallFocusLerp ?? 8.5,
    config.fallCatchUpLerp ?? Math.max(config.fallFocusLerp ?? 8.5, 12),
    fallCamera.ratio,
  );
  const verticalFocusLerp = Math.min(1, cameraDt * (
    player.recoilCameraReturning
      ? RECOIL_CAMERA_RETURN_FOCUS_LERP
    : applyFallCamera
      ? fallFocusRate
      : speedDownCameraRatio > 0
        ? (config.speedDownFocusLerp ?? config.focusLerp ?? 5.5)
      : fallCamera.ratio > 0
        ? (config.fallReturnLerp ?? 3.6)
        : (config.focusLerp ?? 5.5)
  ));
  run.cameraFocusX = lerp(run.cameraFocusX ?? targetFocusX, targetFocusX, focusLerp);
  run.cameraFocusY = lerp(run.cameraFocusY ?? targetFocusY, targetFocusY, verticalFocusLerp);

  const baseCameraZoom = clamp(config.zoom ?? 1, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  const rawSpeedZoom = freezeActionCamera || recoilReturning
    ? { ratio: 0, zoom: freezeActionCamera ? clamp(run.cameraZoom ?? baseCameraZoom, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX) : baseCameraZoom, speed: 0 }
    : getSpeedZoomState(player, config);
  const speedZoom = freezeActionCamera || recoilReturning
    ? rawSpeedZoom
    : updateSpeedCameraHoldState(run, player, config, cameraDt, rawSpeedZoom);
  if (recoilReturning) {
    clearSpeedCameraState(run);
  }
  const targetZoom = freezeActionCamera
    ? rawSpeedZoom.zoom
    : recoilReturning
      ? baseCameraZoom
    : getCameraTargetZoom(player, config, fallCamera, speedZoom);
  const zoomLerp = Math.min(1, cameraDt * (config.zoomLerp ?? 4.2));
  const linearRecoilCameraReturn = !freezeActionCamera && Boolean(player.recoilCameraReturning);
  const currentZoom = clamp(run.cameraZoom ?? (config.zoom ?? 1), CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  let nextZoom;
  if (linearRecoilCameraReturn) {
    const zoomStep = RECOIL_CAMERA_RETURN_ZOOM_PER_SECOND * cameraDt;
    nextZoom = targetZoom >= currentZoom
      ? Math.min(targetZoom, currentZoom + zoomStep)
      : Math.max(targetZoom, currentZoom - zoomStep);
  } else {
    nextZoom = lerp(currentZoom, targetZoom, zoomLerp);
  }
  if (linearRecoilCameraReturn) {
    const zoomDone = Math.abs(nextZoom - targetZoom) <= 0.001;
    const focusDone = Math.abs((run.cameraFocusX ?? targetFocusX) - targetFocusX) <= 0.004 &&
      Math.abs((run.cameraFocusY ?? targetFocusY) - targetFocusY) <= 0.004;
    const fallDone = fallCamera.ratio <= 0.01 && fallCamera.targetYOffset <= 0.5;
    if (zoomDone && focusDone && fallDone) {
      nextZoom = targetZoom;
      player.recoilCameraReturning = false;
    }
  }
  const zoom = clamp(
    nextZoom,
    CAMERA_ABSOLUTE_ZOOM_MIN,
    CAMERA_ABSOLUTE_ZOOM_MAX,
  );
  run.cameraZoom = zoom;

  const viewportWidth = CAMERA_SCREEN_WIDTH / zoom;
  const viewportHeight = CAMERA_SCREEN_HEIGHT / zoom;
  run.aimCameraPanX = 0;
  run.aimCameraPanY = 0;
  const targetX = zoneFrame
    ? zoneFrame.x + zoneFrame.width * 0.5 - viewportWidth * 0.5
    : player.x + player.width * 0.5 - viewportWidth * run.cameraFocusX;
  const fallTargetYOffset = applyFallCamera ? fallCamera.targetYOffset : 0;
  const targetY = zoneFrame
    ? zoneFrame.y + zoneFrame.height * 0.5 - viewportHeight * 0.5
    : player.y + player.height * 0.5 + fallTargetYOffset - viewportHeight * run.cameraFocusY;
  const maxX = Math.max(0, data.world.width - viewportWidth);
  const maxY = Math.max(0, data.world.height - viewportHeight);
  run.cameraTargetX = targetX;
  run.cameraTargetY = targetY;
  run.cameraTargetZoom = targetZoom;
  run.cameraLookAhead = lookAhead;
  run.cameraDownLookAhead = speedDownCameraRatio;
  run.cameraSpeedRatio = speedZoom.ratio;
  const nextX = clamp(lerp(run.cameraX, targetX, focusLerp), 0, maxX);
  const nextY = clamp(lerp(run.cameraY, targetY, verticalFocusLerp), 0, maxY);
  const camera = zoneFrame
    ? { x: nextX, y: nextY }
    : constrainCameraToPlayer(
      nextX,
      nextY,
      run,
      data,
      viewportWidth,
      viewportHeight,
      config,
    );
  run.cameraX = camera.x;
  run.cameraY = camera.y;
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

  const zoom = clamp(
    run.cameraZoom ?? getEffectiveCameraConfig(data, run).zoom ?? 1,
    CAMERA_ABSOLUTE_ZOOM_MIN,
    CAMERA_ABSOLUTE_ZOOM_MAX,
  );
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

function getJumpMaxHeight(data, config) {
  const jumpVelocity = Math.abs(config.jumpVelocity ?? data.player.jumpVelocity ?? 0);
  const gravity = Math.max(1, Number(data.world?.gravity ?? 1));
  return (jumpVelocity * jumpVelocity) / (2 * gravity);
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

function isEscapeBarrierActive(run, barrier) {
  const vault = run?.vaultEscape;
  const trigger = barrier?.trigger || "vaultEscape";
  if (trigger === "lockdown") {
    return Boolean(vault?.lockdownActive);
  }
  return Boolean(vault?.active || vault?.lockdownActive);
}

function getEscapeBarrierSolidRect(run, barrier) {
  if (!barrier || !isEscapeBarrierActive(run, barrier)) {
    return null;
  }
  return {
    id: barrier.id,
    type: "escapeBarrier",
    x: barrier.x,
    y: barrier.y,
    width: barrier.width,
    height: barrier.height,
    dynamicEntityId: barrier.id,
    dynamicEntity: barrier,
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
  const escapeBarrierSolids = (run?.escapeBarriers || [])
    .map((barrier) => getEscapeBarrierSolidRect(run, barrier))
    .filter(Boolean);
  return [...droneSolids, ...temporaryBlockSolids, ...escapeBarrierSolids];
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
  return (data.platforms || []).filter((platform) => (
    !isSlopePlatform(platform) &&
    !isWaterPlatform(platform) &&
    platform.kind !== "oneWay" &&
    platform.kind !== "damage" &&
    platform.kind !== "recallDamage"
  ));
}

function isOneWayPlatform(platform) {
  return platform?.kind === "oneWay";
}

function getOneWayPlatforms(data) {
  return (data.platforms || []).filter((platform) => isOneWayPlatform(platform));
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

function moveEntityHorizontallyWithWalls(entity, data, deltaX, run = null) {
  if (!entity || deltaX === 0) {
    return false;
  }
  const direction = Math.sign(deltaX);
  const maxX = Math.max(0, (data.world?.width ?? entity.x + entity.width) - entity.width);
  entity.x = clamp(entity.x + deltaX, 0, maxX);

  let blocked = false;
  for (const platform of getCollisionPlatforms(data, run)) {
    if (!rectsOverlap(entity, platform)) {
      continue;
    }
    blocked = true;
    entity.x = direction > 0
      ? Math.min(entity.x, platform.x - entity.width)
      : Math.max(entity.x, platform.x + platform.width);
  }
  entity.x = clamp(entity.x, 0, maxX);
  return blocked;
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
  return !collidesWithPlatforms(nextRect, data);
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

function getBraceWallId(wall) {
  if (!wall) {
    return null;
  }
  return wall.id
    ?? wall.dynamicEntityId
    ?? `${wall.x}:${wall.y}:${wall.width}:${wall.height}`;
}

function isPlayerInsideBraceWall(player, wall) {
  return Boolean(wall && rectsOverlap(player, wall));
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
  const verticalCollisionPlatforms = [
    ...collisionPlatforms,
    ...getOneWayPlatforms(data),
  ];

  for (const platform of verticalCollisionPlatforms) {
    const oneWayPlatform = isOneWayPlatform(platform);
    const catchDynamicTop = !oneWayPlatform && shouldCatchDynamicTop(player, platform, previousY);
    if (!catchDynamicTop && !rectsOverlap(player, platform)) {
      continue;
    }

    if (oneWayPlatform) {
      const previousFootY = previousY + player.height;
      if (
        player.vy < -EPSILON ||
        previousFootY > platform.y + EPSILON
      ) {
        continue;
      }
      contacts.landingSpeed = player.vy;
      player.y = platform.y - player.height;
      player.vy = 0;
      contacts.onGround = true;
      contacts.groundEntityId = platform.dynamicEntityId ?? null;
      groundPlatform = platform;
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
    return false;
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
  playGameSfx("damage", { cooldownMs: 120 });
  return true;
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
  playGameSfx("water", { cooldownMs: 280 });
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

function getPlayerHazardBlockContact(player, data) {
  const probe = {
    x: player.x - 1,
    y: player.y - 1,
    width: player.width + 2,
    height: player.height + 2,
  };
  return (data.platforms || []).find((platform) => (
    (platform.kind === "damage" || platform.kind === "recallDamage") &&
    rectsOverlap(probe, platform)
  )) || null;
}

function updatePlayerLastSafeGround(player, data) {
  if (!player?.onGround || getPlayerHazardBlockContact(player, data)) {
    return;
  }
  player.lastSafeGroundX = player.x;
  player.lastSafeGroundY = player.y;
}

function recallPlayerToLastSafeGround(run, data) {
  const player = run.player;
  const fallback = (data.entrances || []).find((entry) => entry.id === "start")
    || (data.entrances || [])[0]
    || data.player.spawn;
  player.x = Number.isFinite(player.lastSafeGroundX) ? player.lastSafeGroundX : fallback.x;
  player.y = Number.isFinite(player.lastSafeGroundY) ? player.lastSafeGroundY : fallback.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.wasOnGround = true;
  player.dashTimer = 0;
  player.dashWindupTimer = 0;
  player.dashCarryTimer = 0;
  player.dashCarrySpeed = 0;
  player.sprintJumpCarryTimer = 0;
  player.sprintJumpCarrySpeed = 0;
  player.wallDirection = 0;
  player.wallSliding = false;
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;
  player.canInteract = true;
  clearAirDashHover(player);
  clearHover(player);
  clearWallRun(player);
  clearBraceHold(player);
  clearZipLine(player);
  spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.5, 14, "#5ebeff");
}

function updateDamageBlockContact(run, data) {
  const block = getPlayerHazardBlockContact(run.player, data);
  if (!block) {
    return false;
  }
  const playerCenter = getCenter(run.player);
  const blockCenter = getCenter(block);
  const direction = Math.sign(playerCenter.x - blockCenter.x) || run.player.facing || 1;
  const damaged = damagePlayer(run, block.damage ?? 10, direction, block.kind === "recallDamage" ? "Recall damage block contact." : "Damage block contact.");
  if (damaged && block.kind === "recallDamage") {
    recallPlayerToLastSafeGround(run, data);
    return true;
  }
  return false;
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

function applyFaceOffLineText(faceOff, text) {
  faceOff.enemyLine = text;
  faceOff.enemyLineVisible = "";
  faceOff.enemyLineIndex = 0;
  faceOff.enemyLineTimer = 0;
  faceOff.spokenLine = "";
}

function queueFaceOffLocalAiLine(run, data, enemy, encounterState, lineKey, fallback, option = null) {
  const faceOff = run.faceOff;
  if (!faceOff?.active) {
    return;
  }
  const requestId = (faceOff.aiRequestId ?? 0) + 1;
  faceOff.aiRequestId = requestId;
  faceOff.aiPending = true;
  requestFaceOffLine({ data, enemy, encounterState, lineKey, fallback, option }).then((reply) => {
    if (!reply || !run.faceOff?.active || run.faceOff.aiRequestId !== requestId) {
      return;
    }
    run.faceOff.aiPending = false;
    applyFaceOffLineText(run.faceOff, reply);
    run.faceOff.message = "local AI";
  }).catch(() => {
    if (run.faceOff?.aiRequestId === requestId) {
      run.faceOff.aiPending = false;
    }
  });
}

function setFaceOffEnemyLine(run, data, encounterState, lineKey, fallback, option = null) {
  const faceOff = run.faceOff;
  if (!faceOff) {
    return;
  }
  faceOff.encounterState = encounterState;
  applyFaceOffLineText(faceOff, getFaceOffEnemyLine(data, lineKey, fallback));
  faceOff.enemyLineCharDelay = getFaceOffConfig(data).enemyLineCharDelay ?? 0.035;
  faceOff.choiceRevealTimer = 0;
  faceOff.choiceRevealHold = getFaceOffConfig(data).enemyLineHoldDuration ?? 0.35;
  faceOff.choiceRevealDuration = getFaceOffConfig(data).choiceSlideDuration ?? 0.26;
  faceOff.choiceRevealProgress = 0;
  faceOff.choicesReady = false;
  queueFaceOffLocalAiLine(run, data, getFaceOffTarget(run), encounterState, lineKey, faceOff.enemyLine, option);
}

function updateFaceOffLineTts(faceOff) {
  if (!faceOff?.enemyLine || faceOff.enemyLineIndex < faceOff.enemyLine.length) {
    return;
  }
  if (faceOff.spokenLine === faceOff.enemyLine) {
    return;
  }
  faceOff.spokenLine = faceOff.enemyLine;
  speakFaceOffLine(faceOff.enemyLine);
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
    const volume = getAudioChannelVolume("sfx", 0.035);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.006);
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
    const sfxVolume = getAudioChannelVolume("sfx", 1);
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.16 * sfxVolume), now + 0.006);
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
    thumpGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.18 * sfxVolume), now + 0.004);
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

function getGameAudioContext() {
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

function getShotAudioContext() {
  return getGameAudioContext();
}

function createNoiseBuffer(context, duration, curve = 1.8) {
  const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < bufferSize; index += 1) {
    const progress = index / bufferSize;
    channel[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, curve);
  }
  return buffer;
}

function getAudioClockSeconds() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now() / 1000;
  }
  return Date.now() / 1000;
}

function getShelterTypingSoundPreset(emotion) {
  return SHELTER_TYPING_SOUND_PRESETS[normalizeShelterTalkEmotion(emotion, "neutral")]
    || SHELTER_TYPING_SOUND_PRESETS.neutral;
}

function shouldSkipShelterTypingChar(char) {
  return !String(char || "").trim();
}

function isShelterTypingPunctuation(char) {
  return /[.!?。！？…]$/u.test(String(char || ""));
}

function createShelterTypingNoiseBuffer(context, duration) {
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    const decay = 1 - index / sampleCount;
    channel[index] = (Math.random() * 2 - 1) * decay * decay;
  }
  return buffer;
}

function playSfxTone(context, options = {}) {
  const now = context.currentTime + (options.delay ?? 0);
  const duration = Math.max(0.01, options.duration ?? 0.12);
  const volumeScale = Number.isFinite(options.volumeScale)
    ? clamp(Number(options.volumeScale), 0, 1)
    : getAudioChannelVolume("sfx", 1);
  if (volumeScale <= 0) {
    return;
  }
  const peakGain = Math.max(0.0001, (options.gain ?? 0.05) * volumeScale * PROCEDURAL_SFX_OUTPUT_BOOST);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(Math.max(1, options.frequency ?? 220), now);
  if (Number.isFinite(options.endFrequency)) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), now + duration);
  }
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + (options.attack ?? 0.006));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.01);
}

function playSfxNoise(context, options = {}) {
  const now = context.currentTime + (options.delay ?? 0);
  const duration = Math.max(0.01, options.duration ?? 0.12);
  const volumeScale = Number.isFinite(options.volumeScale)
    ? clamp(Number(options.volumeScale), 0, 1)
    : getAudioChannelVolume("sfx", 1);
  if (volumeScale <= 0) {
    return;
  }
  const peakGain = Math.max(0.0001, (options.gain ?? 0.05) * volumeScale * PROCEDURAL_SFX_OUTPUT_BOOST);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = createNoiseBuffer(context, duration, options.curve ?? 1.8);
  filter.type = options.filterType || "bandpass";
  filter.frequency.setValueAtTime(Math.max(1, options.frequency ?? 900), now);
  if (Number.isFinite(options.endFrequency)) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), now + duration);
  }
  filter.Q.setValueAtTime(Math.max(0.01, options.q ?? 0.9), now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + (options.attack ?? 0.006));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(now);
  source.stop(now + duration + 0.01);
}

export function playGameSfx(kind, options = {}) {
  const context = getShotAudioContext();
  if (!context) {
    return;
  }
  try {
    const cooldownMs = options.cooldownMs ?? 0;
    if (cooldownMs > 0 && typeof window !== "undefined") {
      const nowMs = Date.now();
      const cooldowns = window.__silentPassageSfxCooldowns || {};
      window.__silentPassageSfxCooldowns = cooldowns;
      if (nowMs - (cooldowns[kind] || 0) < cooldownMs) {
        return;
      }
      cooldowns[kind] = nowMs;
    }

    if (kind === "uiMove" || kind === "promptFocus") {
      const prompt = kind === "promptFocus";
      playSfxTone(context, {
        type: "sine",
        frequency: prompt ? 520 : 440,
        endFrequency: prompt ? 660 : 560,
        duration: prompt ? 0.055 : 0.045,
        gain: prompt ? 0.032 : 0.046,
      });
    } else if (kind === "uiConfirm") {
      playSfxTone(context, { type: "triangle", frequency: 420, endFrequency: 780, duration: 0.08, gain: 0.064 });
      playSfxTone(context, { type: "sine", frequency: 620, endFrequency: 920, duration: 0.07, gain: 0.036, delay: 0.028 });
    } else if (kind === "uiBack") {
      playSfxTone(context, { type: "triangle", frequency: 380, endFrequency: 210, duration: 0.075, gain: 0.052 });
    } else if (kind === "uiDenied") {
      playSfxTone(context, { type: "square", frequency: 170, endFrequency: 110, duration: 0.09, gain: 0.064 });
      playSfxNoise(context, { filterType: "bandpass", frequency: 520, duration: 0.065, gain: 0.042 });
    } else if (kind === "shelterMenuOpen") {
      playSfxNoise(context, { filterType: "bandpass", frequency: 620, endFrequency: 1180, duration: 0.16, gain: 0.052, curve: 2.2 });
      playSfxTone(context, { type: "triangle", frequency: 220, endFrequency: 330, duration: 0.12, gain: 0.044 });
    } else if (kind === "shelterUpgrade") {
      playSfxTone(context, { type: "triangle", frequency: 392, endFrequency: 784, duration: 0.18, gain: 0.078 });
      playSfxTone(context, { type: "sine", frequency: 587, endFrequency: 1174, duration: 0.16, gain: 0.05, delay: 0.06 });
      playSfxNoise(context, { filterType: "highpass", frequency: 1800, duration: 0.12, gain: 0.036 });
    } else if (kind === "photoShutter") {
      playSfxNoise(context, { filterType: "highpass", frequency: 2400, duration: 0.052, gain: 0.092, curve: 1.3 });
      playSfxTone(context, { type: "square", frequency: 120, endFrequency: 70, duration: 0.052, gain: 0.034 });
    } else if (kind === "recordFlip") {
      playSfxNoise(context, { filterType: "bandpass", frequency: 820, endFrequency: 540, duration: 0.11, gain: 0.052, curve: 1.5 });
    } else if (kind === "terminalStart") {
      playSfxTone(context, { type: "square", frequency: 196, endFrequency: 196, duration: 0.08, gain: 0.058 });
      playSfxTone(context, { type: "square", frequency: 294, endFrequency: 440, duration: 0.11, gain: 0.048, delay: 0.055 });
      playSfxNoise(context, { filterType: "highpass", frequency: 1700, duration: 0.12, gain: 0.034, delay: 0.025 });
    } else if (kind === "lockdownStart") {
      playSfxTone(context, { type: "square", frequency: 88, endFrequency: 58, duration: 0.24, gain: 0.094 });
      playSfxNoise(context, { filterType: "bandpass", frequency: 720, endFrequency: 260, duration: 0.2, gain: 0.076 });
    } else if (kind === "extractConfirm") {
      playSfxTone(context, { type: "triangle", frequency: 294, endFrequency: 587, duration: 0.16, gain: 0.076 });
      playSfxTone(context, { type: "sine", frequency: 440, endFrequency: 880, duration: 0.12, gain: 0.046, delay: 0.075 });
    } else if (kind === "shelterLocked") {
      playSfxTone(context, { type: "square", frequency: 150, endFrequency: 96, duration: 0.11, gain: 0.056 });
      playSfxNoise(context, { filterType: "lowpass", frequency: 440, duration: 0.11, gain: 0.034 });
    } else if (kind === "vaultCollect") {
      playSfxTone(context, { type: "triangle", frequency: 330, endFrequency: 720, duration: 0.13, gain: 0.078 });
      playSfxNoise(context, { filterType: "bandpass", frequency: 1180, duration: 0.09, gain: 0.046, delay: 0.025 });
    } else if (kind === "jump") {
      playSfxTone(context, { type: "triangle", frequency: 180, endFrequency: 420, duration: 0.1, gain: 0.055 });
      playSfxNoise(context, { filterType: "highpass", frequency: 900, duration: 0.08, gain: 0.026 });
    } else if (kind === "wallJump" || kind === "braceVault") {
      playSfxTone(context, { type: "sawtooth", frequency: 140, endFrequency: 520, duration: 0.13, gain: 0.045 });
      playSfxNoise(context, { filterType: "bandpass", frequency: 1250, duration: 0.12, gain: 0.042 });
    } else if (kind === "dash") {
      playSfxNoise(context, { filterType: "highpass", frequency: 1800, endFrequency: 460, duration: 0.16, gain: 0.075 });
      playSfxTone(context, { type: "square", frequency: 118, endFrequency: 72, duration: 0.12, gain: 0.035 });
    } else if (kind === "land") {
      const intensity = clamp(Number(options.intensity ?? 540) / 900, 0.4, 1.5);
      playSfxTone(context, { type: "triangle", frequency: 92, endFrequency: 48, duration: 0.11, gain: 0.055 * intensity });
      playSfxNoise(context, { filterType: "lowpass", frequency: 620, duration: 0.12, gain: 0.045 * intensity });
    } else if (kind === "footstep") {
      playSfxNoise(context, { filterType: "lowpass", frequency: 520, duration: 0.055, gain: 0.018, curve: 2.4 });
    } else if (kind === "slide") {
      playSfxNoise(context, { filterType: "bandpass", frequency: 860, endFrequency: 380, duration: 0.18, gain: 0.04 });
    } else if (kind === "hover") {
      playSfxTone(context, { type: "sine", frequency: 210, endFrequency: 310, duration: 0.18, gain: 0.034 });
      playSfxNoise(context, { filterType: "highpass", frequency: 1300, duration: 0.16, gain: 0.026 });
    } else if (kind === "damage") {
      playSfxTone(context, { type: "sawtooth", frequency: 150, endFrequency: 58, duration: 0.18, gain: 0.085 });
      playSfxNoise(context, { filterType: "bandpass", frequency: 760, duration: 0.16, gain: 0.07 });
    } else if (kind === "water") {
      playSfxNoise(context, { filterType: "lowpass", frequency: 980, endFrequency: 220, duration: 0.32, gain: 0.12, curve: 1.2 });
      playSfxTone(context, { type: "sine", frequency: 130, endFrequency: 72, duration: 0.28, gain: 0.045 });
    } else if (kind === "route") {
      playSfxTone(context, { type: "sine", frequency: 196, endFrequency: 392, duration: 0.22, gain: 0.045 });
      playSfxTone(context, { type: "triangle", frequency: 294, endFrequency: 588, duration: 0.22, gain: 0.026, delay: 0.04 });
    } else if (kind === "routeArrive") {
      playSfxTone(context, { type: "triangle", frequency: 520, endFrequency: 260, duration: 0.18, gain: 0.04 });
    } else if (kind === "zipStart") {
      playSfxNoise(context, { filterType: "highpass", frequency: 2400, endFrequency: 780, duration: 0.2, gain: 0.06 });
      playSfxTone(context, { type: "sawtooth", frequency: 260, endFrequency: 180, duration: 0.18, gain: 0.025 });
    } else if (kind === "zipExit") {
      playSfxNoise(context, { filterType: "bandpass", frequency: 1500, duration: 0.11, gain: 0.04 });
    } else if (kind === "lootOpen") {
      playSfxTone(context, { type: "square", frequency: 118, endFrequency: 82, duration: 0.12, gain: 0.04 });
      playSfxNoise(context, { filterType: "bandpass", frequency: 820, duration: 0.16, gain: 0.052 });
    } else if (kind === "lootCollect") {
      const rare = Number(options.rarityRank ?? 0) >= 2;
      playSfxTone(context, { type: "triangle", frequency: rare ? 520 : 390, endFrequency: rare ? 1040 : 640, duration: 0.16, gain: rare ? 0.06 : 0.038 });
      playSfxTone(context, { type: "sine", frequency: rare ? 780 : 520, endFrequency: rare ? 1320 : 780, duration: 0.14, gain: rare ? 0.035 : 0.02, delay: 0.045 });
    } else if (kind === "lootDenied") {
      playSfxTone(context, { type: "square", frequency: 180, endFrequency: 120, duration: 0.1, gain: 0.035 });
    } else if (kind === "enemyShot") {
      playSfxNoise(context, { filterType: "bandpass", frequency: 1320, duration: 0.1, gain: 0.07 });
      playSfxTone(context, { type: "square", frequency: 330, endFrequency: 180, duration: 0.08, gain: 0.028 });
    } else if (kind === "impact") {
      playSfxNoise(context, { filterType: "bandpass", frequency: 900, endFrequency: 260, duration: 0.12, gain: 0.05 });
    } else if (kind === "melee") {
      playSfxNoise(context, { filterType: "highpass", frequency: 1700, endFrequency: 560, duration: 0.09, gain: 0.05 });
    }
  } catch {
    // Procedural audio is optional; gameplay should never depend on it.
  }
}

function createLoopingNoiseBuffer(context, duration = 2.8) {
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let smoothed = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const white = Math.random() * 2 - 1;
    smoothed = smoothed * 0.86 + white * 0.14;
    channel[index] = white * 0.58 + smoothed * 0.42;
  }
  return buffer;
}

function createRainAmbience(context) {
  const source = context.createBufferSource();
  const highpass = context.createBiquadFilter();
  const lowpass = context.createBiquadFilter();
  const color = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = createLoopingNoiseBuffer(context, 3.4);
  source.loop = true;
  highpass.type = "highpass";
  highpass.frequency.setValueAtTime(620, context.currentTime);
  highpass.Q.setValueAtTime(0.25, context.currentTime);
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(4300, context.currentTime);
  lowpass.Q.setValueAtTime(0.4, context.currentTime);
  color.type = "peaking";
  color.frequency.setValueAtTime(1700, context.currentTime);
  color.Q.setValueAtTime(0.7, context.currentTime);
  color.gain.setValueAtTime(1.8, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(color);
  color.connect(gain);
  gain.connect(context.destination);
  source.start(context.currentTime);
  return {
    context,
    source,
    highpass,
    lowpass,
    color,
    gain,
  };
}

function getRainAmbienceTargetVolume(state, data) {
  if (state?.scene !== SCENES.EXPEDITION || !state.run || isMovementLab(data)) {
    return 0;
  }
  const run = state.run;
  const phase = run.timePhase || "day";
  const outdoorsVolume = phase === "night" ? 0.078 : phase === "dusk" ? 0.064 : 0.052;
  const shelterVolume = run.shelterRest?.active ? 0.028 : outdoorsVolume;
  const vaultBoost = isVaultEscapeActive(run) || isVaultLockdownActive(run) ? 0.01 : 0;
  const faceOffDip = run.faceOff?.active ? 0.68 : 1;
  return getAudioChannelVolume("sfx", Math.min(0.092, shelterVolume + vaultBoost) * faceOffDip);
}

function updateRainAmbience(state, data) {
  if (typeof window === "undefined") {
    return;
  }
  const targetVolume = getRainAmbienceTargetVolume(state, data);
  let ambience = window.__silentPassageRainAmbience;
  if (targetVolume <= 0.0001 && !ambience) {
    return;
  }
  try {
    if (!ambience) {
      const context = getGameAudioContext();
      if (!context) {
        return;
      }
      ambience = createRainAmbience(context);
      window.__silentPassageRainAmbience = ambience;
    }
    const now = ambience.context.currentTime;
    ambience.gain.gain.setTargetAtTime(Math.max(0.0001, targetVolume), now, targetVolume > 0.0001 ? 0.85 : 0.55);
    ambience.lowpass.frequency.setTargetAtTime(targetVolume > 0.035 ? 4700 : 3900, now, 0.8);
  } catch {
    window.__silentPassageRainAmbience = null;
  }
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

function playShelterTypingSound(emotion, char, visibleCount = 0) {
  if (shouldSkipShelterTypingChar(char)) {
    return;
  }
  try {
    const context = getGameAudioContext();
    if (!context) {
      return;
    }
    const preset = getShelterTypingSoundPreset(emotion);
    const punctuation = isShelterTypingPunctuation(char);
    const seed = ((String(char).codePointAt(0) || 0) + visibleCount * 17) % 7;
    const volume = getAudioChannelVolume(
      "typing",
      preset.volume * SHELTER_TYPING_SOUND_GAIN * (punctuation ? 0.82 : 1),
    );
    if (volume <= 0.0001) {
      return;
    }
    const now = context.currentTime;
    const toneDuration = preset.duration * (punctuation ? 1.28 : 1);
    const oscillator = context.createOscillator();
    const toneFilter = context.createBiquadFilter();
    const toneGain = context.createGain();
    oscillator.type = preset.tone;
    oscillator.frequency.setValueAtTime(
      (punctuation ? preset.base * 0.78 : preset.base) + seed * preset.step,
      now,
    );
    toneFilter.type = "bandpass";
    toneFilter.frequency.setValueAtTime(preset.filter, now);
    toneFilter.Q.setValueAtTime(punctuation ? 2.4 : 3.2, now);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.004);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + toneDuration);
    oscillator.connect(toneFilter);
    toneFilter.connect(toneGain);
    toneGain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + toneDuration + 0.012);

    const noiseDuration = Math.min(0.018, toneDuration);
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = createShelterTypingNoiseBuffer(context, noiseDuration);
    noiseFilter.type = "highpass";
    noiseFilter.frequency.setValueAtTime(punctuation ? 720 : 1100, now);
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.72), now + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDuration);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(context.destination);
    noise.start(now);
    noise.stop(now + noiseDuration + 0.004);
  } catch {
    // Typing feedback is optional; browsers may block audio until a user gesture.
  }
}

function getShelterVisibleTypedCharacterCount(line, progress) {
  const letters = Array.from(String(line || ""));
  if (!letters.length) {
    return 0;
  }
  return clamp(Math.ceil(letters.length * progress), 1, letters.length);
}

function updateShelterTypingSoundForLine(host, line, progress, emotion, lineKey) {
  if (!host || typeof line !== "string" || !line) {
    return;
  }
  const letters = Array.from(line);
  const visibleCount = getShelterVisibleTypedCharacterCount(line, progress);
  host.typingSound = host.typingSound && typeof host.typingSound === "object" ? host.typingSound : {};
  if (host.typingSound.lineKey !== lineKey) {
    host.typingSound = {
      lineKey,
      visibleCount: 0,
      lastPlayedAt: 0,
    };
  }
  const previousCount = clamp(Math.floor(host.typingSound.visibleCount || 0), 0, letters.length);
  if (visibleCount <= previousCount) {
    host.typingSound.visibleCount = visibleCount;
    return;
  }
  const delta = visibleCount - previousCount;
  host.typingSound.visibleCount = visibleCount;
  if (delta > SHELTER_TYPING_SOUND_MAX_CATCHUP) {
    return;
  }
  const newLetters = letters.slice(previousCount, visibleCount);
  const audibleChar = [...newLetters].reverse().find((char) => !shouldSkipShelterTypingChar(char));
  if (!audibleChar) {
    return;
  }
  const now = getAudioClockSeconds();
  const preset = getShelterTypingSoundPreset(emotion);
  const minInterval = Number.isFinite(preset.interval)
    ? preset.interval
    : SHELTER_TYPING_SOUND_DEFAULT_INTERVAL;
  if (now - Number(host.typingSound.lastPlayedAt || 0) < minInterval) {
    return;
  }
  host.typingSound.lastPlayedAt = now;
  playShelterTypingSound(emotion, audibleChar, visibleCount);
}

function setAudioElementFadeVolume(element, fadeVolume = 1) {
  if (!element?.dataset) {
    return;
  }
  element.dataset.fadeVolume = String(clamp(Number(fadeVolume), 0, 1));
}

function applyLoopingAudioTrackVolume(track) {
  const element = track?.element;
  if (!element) {
    return;
  }
  const fadeVolume = clamp(Number(track.fadeVolume ?? 1), 0, 1);
  setAudioElementFadeVolume(element, fadeVolume);
  element.volume = getAudioChannelVolume("bgm", Number(track.baseVolume ?? 1) * fadeVolume);
}

function fadeLoopingAudioTrack(track, targetFadeVolume, duration = 0.7, options = {}) {
  if (!track?.element) {
    return;
  }
  const now = getAudioClockSeconds();
  updateLoopingAudioTrackFade(track, now);
  track.fade = {
    from: clamp(Number(track.fadeVolume ?? 1), 0, 1),
    to: clamp(Number(targetFadeVolume), 0, 1),
    startedAt: now,
    duration: Math.max(0.02, Number(duration) || 0.02),
    stopWhenDone: Boolean(options.stopWhenDone),
    resetWhenStopped: Boolean(options.resetWhenStopped),
  };
  applyLoopingAudioTrackVolume(track);
}

function updateLoopingAudioTrackFade(track, now = getAudioClockSeconds()) {
  if (!track?.element || !track.fade) {
    if (track?.element) {
      applyLoopingAudioTrackVolume(track);
    }
    return;
  }
  const fade = track.fade;
  const progress = clamp((now - fade.startedAt) / Math.max(0.02, fade.duration), 0, 1);
  track.fadeVolume = lerp(fade.from, fade.to, progress);
  applyLoopingAudioTrackVolume(track);
  if (progress < 1) {
    return;
  }
  const stopWhenDone = fade.stopWhenDone;
  const resetWhenStopped = fade.resetWhenStopped;
  track.fade = null;
  track.fadeVolume = fade.to;
  applyLoopingAudioTrackVolume(track);
  if (stopWhenDone) {
    try {
      track.element.pause();
      if (resetWhenStopped) {
        track.element.currentTime = 0;
      }
      track.pending = false;
    } catch {
      // Music should never affect gameplay.
    }
  }
}

function updateLoopingAudioFades() {
  if (typeof window === "undefined") {
    return;
  }
  ["__searchMusic", "__shelterMusic", "__npcDialogueMusic", "__vaultEscapeMusic"].forEach((slotName) => {
    const track = window[slotName];
    if (track?.kind === "file") {
      updateLoopingAudioTrackFade(track);
    }
  });
}

function getLoopingAudioTrack(slotName, src, volume = 0.45) {
  if (typeof window === "undefined" || typeof window.Audio === "undefined") {
    return null;
  }
  const existing = window[slotName];
  if (existing?.kind === "file" && existing.src === src && existing.element) {
    return existing;
  }
  const element = new window.Audio(src);
  element.loop = true;
  element.preload = "auto";
  setAudioElementFadeVolume(element, 1);
  registerAudioElement(element, "bgm", volume);
  const track = {
    kind: "file",
    src,
    element,
    baseVolume: volume,
    fadeVolume: 1,
    fade: null,
    pending: false,
    blocked: false,
    lastPlayAttemptAt: 0,
  };
  window[slotName] = track;
  return track;
}

function playLoopingAudioTrack(slotName, src, volume = 0.45, playbackRate = 1, options = {}) {
  const track = getLoopingAudioTrack(slotName, src, volume);
  const element = track?.element;
  if (!element) {
    return null;
  }
  const fadeSeconds = Math.max(0, Number(options.fadeSeconds ?? 0) || 0);
  const wasPaused = element.paused;
  track.baseVolume = volume;
  if (wasPaused && fadeSeconds > 0) {
    track.fadeVolume = 0;
    track.fade = null;
    setAudioElementFadeVolume(element, 0);
  } else if (wasPaused) {
    track.fadeVolume = 1;
    track.fade = null;
    setAudioElementFadeVolume(element, 1);
  }
  registerAudioElement(element, "bgm", volume);
  element.playbackRate = playbackRate;
  applyLoopingAudioTrackVolume(track);
  if (!element.paused || track.pending) {
    if (fadeSeconds > 0 && track.fade?.to === 0) {
      fadeLoopingAudioTrack(track, 1, fadeSeconds);
    }
    return track;
  }
  const now = Date.now();
  if (track.blocked && now - (track.lastPlayAttemptAt || 0) < 1000) {
    return track;
  }
  track.lastPlayAttemptAt = now;
  track.pending = true;
  track.blocked = false;
  const playPromise = element.play();
  if (playPromise?.then) {
    playPromise
      .then(() => {
        track.pending = false;
        track.blocked = false;
        if (fadeSeconds > 0) {
          fadeLoopingAudioTrack(track, 1, fadeSeconds);
        } else {
          track.fadeVolume = 1;
          track.fade = null;
          applyLoopingAudioTrackVolume(track);
        }
      })
      .catch(() => {
        track.pending = false;
        track.blocked = true;
      });
  } else {
    track.pending = false;
    if (fadeSeconds > 0) {
      fadeLoopingAudioTrack(track, 1, fadeSeconds);
    }
  }
  return track;
}

function stopLoopingAudioTrack(slotName, reset = false, fadeSeconds = 0) {
  if (typeof window === "undefined") {
    return;
  }
  const track = window[slotName];
  const element = track?.element;
  if (!element) {
    return;
  }
  if (!element.paused && fadeSeconds > 0) {
    fadeLoopingAudioTrack(track, 0, fadeSeconds, {
      stopWhenDone: true,
      resetWhenStopped: reset,
    });
    return;
  }
  try {
    element.pause();
    if (reset) {
      element.currentTime = 0;
    }
    track.pending = false;
    track.fade = null;
    track.fadeVolume = 0;
    applyLoopingAudioTrackVolume(track);
  } catch {
    // Music should never affect gameplay.
  }
}

function updateSearchMusic(run) {
  if (typeof window === "undefined") {
    return;
  }
  const vault = run?.vaultEscape;
  if (!run || vault?.active || vault?.lockdownActive || run.faceOff?.active) {
    stopLoopingAudioTrack("__searchMusic", false, 0.75);
    return;
  }
  stopLoopingAudioTrack("__npcDialogueMusic", false, NPC_DIALOGUE_MUSIC_FADE_SECONDS);
  stopLoopingAudioTrack("__shelterMusic", false, 0.9);
  playLoopingAudioTrack("__searchMusic", SEARCH_MUSIC_SRC, 0.34, 1, { fadeSeconds: 0.9 });
}

function stopSearchMusic(reset = false, fadeSeconds = 0.75) {
  stopLoopingAudioTrack("__searchMusic", reset, fadeSeconds);
}

function updateNpcDialogueMusic(active) {
  if (typeof window === "undefined") {
    return;
  }
  if (!active) {
    stopLoopingAudioTrack("__npcDialogueMusic", false, NPC_DIALOGUE_MUSIC_FADE_SECONDS);
    return;
  }
  stopSearchMusic(false, 0.45);
  stopLoopingAudioTrack("__shelterMusic", false, 0.45);
  playLoopingAudioTrack("__npcDialogueMusic", SHELTER_MUSIC_SRC, NPC_DIALOGUE_MUSIC_VOLUME, 1, {
    fadeSeconds: NPC_DIALOGUE_MUSIC_FADE_SECONDS,
  });
}

function updateShelterMusic(state) {
  if (typeof window === "undefined") {
    return;
  }
  if (state?.scene !== SCENES.SHELTER) {
    stopLoopingAudioTrack("__shelterMusic", false, 1.1);
    return;
  }
  stopSearchMusic(false, 0.85);
  stopVaultEscapeMusic(0.55);
  playLoopingAudioTrack("__shelterMusic", SHELTER_MUSIC_SRC, 0.44, 1, { fadeSeconds: 1.45 });
}

function playVaultPulse(audio, frequency, duration, gainValue, type = "square") {
  const context = audio?.context;
  const master = audio?.master;
  if (!context || !master) {
    return;
  }
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function startVaultEscapeMusic(run) {
  if (!run?.vaultEscape || typeof window === "undefined") {
    return;
  }
  stopSearchMusic(false, 0.3);
  stopLoopingAudioTrack("__shelterMusic", false, 0.45);
  const fileTrack = playLoopingAudioTrack("__vaultEscapeMusic", VAULT_ESCAPE_MUSIC_SRC, 0.58, 1, { fadeSeconds: 0.18 });
  if (fileTrack) {
    return;
  }
  try {
    const context = getGameAudioContext();
    if (!context) {
      return;
    }
    stopVaultEscapeMusic(0.02);
    const master = context.createGain();
    const bass = context.createOscillator();
    const bassFilter = context.createBiquadFilter();
    const bassGain = context.createGain();
    const now = context.currentTime;
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(getAudioChannelVolume("bgm", 0.055), now + 0.08);
    bass.type = "sawtooth";
    bass.frequency.setValueAtTime(55, now);
    bassFilter.type = "lowpass";
    bassFilter.frequency.setValueAtTime(210, now);
    bassGain.gain.setValueAtTime(0.028, now);
    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(master);
    master.connect(context.destination);
    bass.start(now);
    window.__vaultEscapeMusic = {
      context,
      master,
      bass,
      bassFilter,
      bassGain,
      nextBeatAt: now,
      step: 0,
    };
  } catch {
    // Music is optional; browsers may block audio until a user gesture.
  }
}

function stopVaultEscapeMusic(fadeSeconds = 0.16) {
  if (typeof window === "undefined" || !window.__vaultEscapeMusic) {
    return;
  }
  const audio = window.__vaultEscapeMusic;
  if (audio.kind === "file") {
    stopLoopingAudioTrack("__vaultEscapeMusic", true, fadeSeconds);
    return;
  }
  window.__vaultEscapeMusic = null;
  try {
    const now = audio.context.currentTime;
    audio.master?.gain.cancelScheduledValues(now);
    audio.master?.gain.setValueAtTime(Math.max(0.0001, audio.master.gain.value || 0.0001), now);
    audio.master?.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    audio.bass?.stop(now + fadeSeconds + 0.02);
    window.setTimeout(() => {
      try {
        audio.master?.disconnect();
      } catch {
        // Already disconnected.
      }
    }, Math.ceil((fadeSeconds + 0.05) * 1000));
  } catch {
    // Audio shutdown should never affect gameplay.
  }
}

function updateVaultEscapeMusic(run) {
  if (typeof window === "undefined") {
    return;
  }
  const vault = run?.vaultEscape;
  if (!vault?.active && !vault?.lockdownActive) {
    stopVaultEscapeMusic();
    return;
  }
  let audio = window.__vaultEscapeMusic;
  if (!audio) {
    startVaultEscapeMusic(run);
    audio = window.__vaultEscapeMusic;
  }
  if (audio?.kind === "file") {
    const duration = Math.max(1, Number(vault.duration ?? 45));
    const timeLeft = Math.max(0, Number(vault.timeLeft ?? 0));
    const urgency = vault.lockdownActive ? 1 : clamp(1 - timeLeft / duration, 0, 1);
    const volume = vault.lockdownActive ? 0.68 : lerp(0.52, 0.62, urgency);
    const playbackRate = vault.lockdownActive ? 1.08 : lerp(1, 1.04, urgency);
    playLoopingAudioTrack("__vaultEscapeMusic", VAULT_ESCAPE_MUSIC_SRC, volume, playbackRate, { fadeSeconds: 0.18 });
    return;
  }
  if (!audio?.context) {
    return;
  }
  try {
    const now = audio.context.currentTime;
    const duration = Math.max(1, Number(vault.duration ?? 45));
    const timeLeft = Math.max(0, Number(vault.timeLeft ?? 0));
    const urgency = vault.lockdownActive ? 1 : clamp(1 - timeLeft / duration, 0, 1);
    const interval = vault.lockdownActive ? 0.115 : lerp(0.34, 0.15, urgency);
    const bassFrequency = vault.lockdownActive ? 42 : lerp(52, 76, urgency);
    audio.master.gain.setTargetAtTime(getAudioChannelVolume("bgm", vault.lockdownActive ? 0.075 : 0.055), now, 0.04);
    audio.bass.frequency.setTargetAtTime(bassFrequency, now, 0.05);
    audio.bassFilter.frequency.setTargetAtTime(vault.lockdownActive ? 440 : lerp(190, 340, urgency), now, 0.05);
    if (now < audio.nextBeatAt) {
      return;
    }
    const pattern = [0, 3, 7, 10, 12, 10, 7, 3];
    const note = pattern[audio.step % pattern.length];
    const frequency = 220 * 2 ** (note / 12);
    playVaultPulse(audio, frequency, 0.075, vault.lockdownActive ? 0.06 : 0.038, "square");
    if (audio.step % 4 === 0 || vault.lockdownActive) {
      playVaultPulse(audio, vault.lockdownActive ? 76 : 62, 0.11, 0.052, "triangle");
    }
    audio.step += 1;
    audio.nextBeatAt = now + interval;
  } catch {
    stopVaultEscapeMusic(0.02);
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
  if ((weaponContext.arm.fireCooldownTimer ?? 0) > 0) {
    faceOff.message = `${weaponContext.stats.label}: cooling`;
    return;
  }
  if ((weaponContext.arm.magazine ?? 0) <= 0) {
    faceOff.message = `${weaponContext.stats.label}: empty`;
    setFaceOffEnemyLine(run, data, "knockdown", "failed", "珥앸룄 鍮꾩뿀??");
    return;
  }
  if (!hasWeaponHeat(run, weaponContext)) {
    faceOff.message = `${weaponContext.stats.label}: heat low`;
    setFaceOffEnemyLine(run, data, "knockdown", "failed", "珥앸룄 鍮꾩뿀??");
    return;
  }

  spendWeaponHeat(run, weaponContext);
  weaponContext.arm.magazine = weaponContext.stats.magazineSize;
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
  setFaceOffEnemyLine(run, data, "dialogue", "dialogue", "留먮줈 ?앸궡怨??띕떎硫?鍮⑤━ 留먰빐.", option);

  if (Math.random() <= chance) {
    if (option.successEffect === "dealProgress") {
      enemy.dialogueStage = (enemy.dialogueStage ?? 0) + 1;
      if (enemy.dialogueStage >= 2) {
        setFaceOffEnemyLine(run, data, "dialogue", "persuadeDeal", "醫뗭븘. 猷⑦듃 ?섎굹???뚮젮二쇱?.", option);
        finishFaceOff(run, enemy, "deal", "deal");
      } else {
        setFaceOffEnemyLine(run, data, "dialogue", "persuadeLead", "?뺣낫? ?ㅺ? 萸?以????덈뒗??", option);
        faceOff.message = "deal lead";
      }
      return;
    }
    if (option.type === "threaten") {
      setFaceOffEnemyLine(run, data, "dialogue", "threatenSuccess", "?뚯븯?? 珥??대젮?볦쓣寃?", option);
    } else if (option.type === "deescalate") {
      setFaceOffEnemyLine(run, data, "dialogue", "deescalateSuccess", "醫뗭븘... ?좉퉸 硫덉텛吏.", option);
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
    setFaceOffEnemyLine(run, data, "dialogue", "threatenFail", "洹??묐컯? ???듯빐.", option);
  } else if (option.type === "deescalate") {
    setFaceOffEnemyLine(run, data, "dialogue", "deescalateFail", "硫덉텛??嫄???履쎌씠??", option);
  } else {
    setFaceOffEnemyLine(run, data, "dialogue", "persuadeFail", "移쒓뎄 媛숈? ?뚮━ ?섏? 留?", option);
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
  if (consumeEitherPress(state, getReloadKeys(state))) {
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
  updateFaceOffLineTts(faceOff);
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

  clearMouseCombatPrimaryInput(state);
  if (consumeEitherPress(state, ATTACK_KEYS) || consumeEitherPress(state, FIRE_KEYS)) {
    applyFaceOffAttack(run, data, enemy);
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

function endBraceHoldWithCooldown(player, config, wallId = player.braceHoldWallId) {
  if (wallId) {
    player.braceConsumedWallId = wallId;
    player.braceCooldownTimer = (config.braceCooldownMs ?? 420) / 1000;
  }
  clearBraceHold(player);
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

function clearAirDashHover(player) {
  player.airDashHoverTimer = 0;
  player.airDashDirectionGraceTimer = 0;
  player.airDashDirectionPending = false;
  player.airDashPendingDirX = 0;
  player.airDashPendingDirY = 0;
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
  player.airDashHoverConsumed = false;
}

function refillDashFromWall(player, config) {
  syncDashCapacity(player, config);
  player.dashCharges = player.dashMaxCount;
  player.dashAvailable = true;
  player.dashCooldownTimer = 0;
  player.airDashHoverConsumed = false;
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

function getShotgunArmContext(run, data) {
  const weapons = ensureWeaponLoadoutState(run, data);
  const side = ["left", "right"].find((candidate) => {
    const stats = computeArmWeaponStats(data, weapons.arms[candidate]);
    return stats.type === "shotgun";
  }) || "left";
  const arm = weapons.arms[side];
  const stats = computeArmWeaponStats(data, arm);
  return {
    weapons,
    side,
    arm,
    stats,
  };
}

function resetShotgunFireCooldown(run, data) {
  const shotgunContext = getShotgunArmContext(run, data);
  shotgunContext.arm.fireCooldownTimer = 0;
  const selected = getSelectedArmContext(run, data);
  run.player.recoilShotCooldownTimer = Math.max(
    selected.arm.fireCooldownTimer ?? 0,
    0,
  );
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

function getWeaponHeatCost(context) {
  if (!context?.stats) {
    return 6;
  }
  if (Number.isFinite(context.stats.heatCost)) {
    return Math.max(0, Number(context.stats.heatCost));
  }
  if (context.stats.type === "shotgun") {
    return 10;
  }
  if (context.stats.type === "machinegun") {
    return 1.6;
  }
  return 6;
}

function clearRecoilJumpChargeState(player, clearPending = false) {
  if (!player) {
    return;
  }
  player.recoilJumpChargeActive = false;
  player.recoilJumpChargeFocusSpent = 0;
  player.recoilJumpChargeMultiplier = 1;
  player.recoilJumpChargeEffectStep = 0;
  if (clearPending) {
    player.recoilJumpChargePendingMultiplier = 1;
    player.recoilJumpChargePendingShot = false;
  }
}

function triggerHeatManagementFailure(run, player = run?.player) {
  if (!run) {
    return;
  }
  const alreadyLocked = Boolean(run.focusDepleted);
  run.focusMax = Math.max(1, Number(run.focusMax ?? FOCUS_MAX));
  run.focus = 0;
  run.focusActive = false;
  run.focusDepleted = true;
  run.heatFailureNotified = true;
  clearRecoilJumpChargeState(player, true);
  if (!alreadyLocked) {
    pushNotice(run, "Heat management failure.", 1.8);
  }
}

function refreshHeatManagementLock(run) {
  if (!run?.focusDepleted) {
    return;
  }
  if (run.focus >= run.focusMax) {
    run.focusDepleted = false;
    run.heatFailureNotified = false;
  }
}

function hasWeaponHeat(run, context, multiplier = 1) {
  const focusMax = Math.max(1, Number(run.focusMax ?? FOCUS_MAX));
  const available = clamp(Number(run.focus ?? focusMax), 0, focusMax);
  const minimum = Math.max(focusMax * WEAPON_HEAT_EMPTY_RATIO, getWeaponHeatCost(context) * multiplier);
  return !run.focusDepleted && available >= minimum;
}

function spendWeaponHeat(run, context, multiplier = 1) {
  const focusMax = Math.max(1, Number(run.focusMax ?? FOCUS_MAX));
  const cost = getWeaponHeatCost(context) * multiplier;
  run.focusMax = focusMax;
  run.focus = Math.max(0, clamp(Number(run.focus ?? focusMax), 0, focusMax) - cost);
  if (run.focus <= 0) {
    triggerHeatManagementFailure(run);
  }
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
  if ((context.arm.fireCooldownTimer ?? 0) > 0) {
    return false;
  }
  return hasWeaponHeat(run, context);
}

function canChargeRecoilJumpWeapon(run, data, player) {
  if (!canFireWeaponPose(player)) {
    return false;
  }
  const context = getShotgunArmContext(run, data);
  const focusMax = Math.max(1, Number(run.focusMax ?? FOCUS_MAX));
  const availableHeat = clamp(Number(run.focus ?? focusMax), 0, focusMax);
  const chargeAlreadyActive = Boolean(
    player.recoilJumpChargeActive ||
    (player.recoilJumpChargeFocusSpent ?? 0) > 0
  );
  const recoilJumpInProgress = Boolean(
    player.recoilShotActive ||
    player.recoilShotTimer > 0 ||
    player.recoilSpinTimer > 0 ||
    player.recoilCameraTimer > 0 ||
    player.recoilCameraHoldUntilLanding
  );
  const hasChargeHeat = chargeAlreadyActive
    ? !run.focusDepleted && availableHeat > 0
    : hasWeaponHeat(run, context);
  return Boolean(
    context.stats.equipped &&
    context.stats.type === "shotgun" &&
    (recoilJumpInProgress || (context.arm.fireCooldownTimer ?? 0) === 0) &&
    hasChargeHeat
  );
}

function clearRecoilJumpForce(player) {
  const hadRecoilJumpForce = Boolean(
    player.recoilShotActive ||
    player.recoilShotTimer > 0 ||
    player.recoilSpinTimer > 0 ||
    player.recoilCameraTimer > 0 ||
    player.recoilCameraHoldUntilLanding ||
    player.recoilCameraReturning ||
    Math.abs(player.vx ?? 0) > 0 ||
    Math.abs(player.vy ?? 0) > 0
  );
  player.recoilShotTimer = 0;
  player.recoilShotActive = false;
  player.recoilSpinTimer = 0;
  player.recoilSpinDuration = 0;
  player.recoilCameraTimer = 0;
  player.recoilCameraHoldUntilLanding = false;
  player.recoilCameraReturning = false;
  player.recoilCameraDirX = 0;
  player.recoilCameraDirY = -1;
  player.dashCarryTimer = 0;
  player.dashCarrySpeed = 0;
  player.sprintJumpCarryTimer = 0;
  player.sprintJumpCarrySpeed = 0;
  return hadRecoilJumpForce;
}

function startReloadArmContext(run, context) {
  if (!context?.stats?.equipped) {
    pushNotice(run, "No weapon equipped", 1.2);
    return false;
  }
  context.arm.magazine = context.stats.magazineSize;
  context.arm.reloadTimer = 0;
  context.arm.reloadDuration = 0;
  pushNotice(run, `${context.stats.label} uses heat`, 1.2);
  return true;
}

function startReloadSelectedArm(run, data) {
  if (isMeleeSlotSelected(run, data)) {
    pushNotice(run, "Breach tool does not reload", 1.2);
    return false;
  }
  return startReloadArmContext(run, getSelectedArmContext(run, data));
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
    arm.reloadTimer = 0;
    arm.reloadDuration = 0;
    arm.magazine = stats.magazineSize;
  });

  const selected = getSelectedArmContext(run, data);
  run.player.recoilShotCooldownTimer = Math.max(
    selected.arm.fireCooldownTimer ?? 0,
    0,
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
  if (consumeEitherPress(state, getArmSwitchKeys(state))) {
    switchSelectedArm(run, data);
  }
  if (consumeEitherPress(state, getReloadKeys(state))) {
    startReloadSelectedArm(run, data);
  }
  if (!useLegacyControls(state)) {
    updateArmSwitchReloadInput(run, data, state);
  }
  updateWeaponTimers(run, data, dt);
}

function updateArmSwitchReloadInput(run, data, state) {
  const player = run.player;
  const switchHeld = isPressed(state, ARM_SWITCH_RELOAD_KEY);
  const holdSeconds = getKeyHoldSeconds(state, ARM_SWITCH_RELOAD_KEY);
  if (
    switchHeld &&
    holdSeconds >= ARM_SWITCH_RELOAD_HOLD_SECONDS &&
    !player.armSwitchReloadHoldConsumed
  ) {
    player.armSwitchReloadHoldConsumed = true;
    startReloadSelectedArm(run, data);
    return;
  }

  if (!state.justReleased?.has(ARM_SWITCH_RELOAD_KEY)) {
    return;
  }

  consumeRelease(state, ARM_SWITCH_RELOAD_KEY);
  const releasedHoldSeconds = consumeReleasedKeyHoldSeconds(state, ARM_SWITCH_RELOAD_KEY);
  if (releasedHoldSeconds < ARM_SWITCH_RELOAD_HOLD_SECONDS && !player.armSwitchReloadHoldConsumed) {
    switchSelectedArm(run, data);
  }
  player.armSwitchReloadHoldConsumed = false;
}

function shouldChargeRecoilJump(run, data, state) {
  if (useLegacyControls(state)) {
    return false;
  }
  const player = run.player;
  if (!player) {
    return false;
  }
  if (!FIRE_KEYS.some((code) => isPressed(state, code))) {
    return false;
  }
  const fireHoldSeconds = Math.max(...FIRE_KEYS.map((code) => getKeyHoldSeconds(state, code)), 0);
  if (fireHoldSeconds < RECOIL_JUMP_CHARGE_HOLD_SECONDS) {
    return false;
  }
  return Boolean(
    canAimWeapon(player) &&
    canChargeRecoilJumpWeapon(run, data, player)
  );
}

function getRecoilJumpEffectiveFocusMax(run) {
  const focusMax = Math.max(1, Number(run.focusMax ?? FOCUS_MAX));
  return focusMax * RECOIL_JUMP_FOCUS_COST_SCALE;
}

function getRecoilJumpChargeStageCostWeight(step) {
  const steps = Math.max(1, RECOIL_JUMP_CHARGE_STEPS);
  const clampedStep = clamp(Math.floor(step), 1, steps);
  return Math.pow(RECOIL_JUMP_CHARGE_COST_FALLOFF, clampedStep - 1);
}

function getRecoilJumpChargeTotalCostWeight() {
  let total = 0;
  for (let step = 1; step <= RECOIL_JUMP_CHARGE_STEPS; step += 1) {
    total += getRecoilJumpChargeStageCostWeight(step);
  }
  return Math.max(0.001, total);
}

function getRecoilJumpChargeStageCost(run, step) {
  return getRecoilJumpEffectiveFocusMax(run)
    * (getRecoilJumpChargeStageCostWeight(step) / getRecoilJumpChargeTotalCostWeight());
}

function getRecoilJumpChargeStageThreshold(run, step) {
  const steps = Math.max(1, RECOIL_JUMP_CHARGE_STEPS);
  const clampedStep = clamp(Math.floor(step), 1, steps);
  let threshold = 0;
  for (let index = 1; index <= clampedStep; index += 1) {
    threshold += getRecoilJumpChargeStageCost(run, index);
  }
  return threshold;
}

function getRecoilJumpChargeDrainMultiplier(run, player) {
  const spentStep = getRecoilJumpChargeStepFromSpent(run, player.recoilJumpChargeFocusSpent);
  const currentStep = clamp(spentStep, 1, RECOIL_JUMP_CHARGE_STEPS);
  const averageStepCost = getRecoilJumpEffectiveFocusMax(run) / Math.max(1, RECOIL_JUMP_CHARGE_STEPS);
  return getRecoilJumpChargeStageCost(run, currentStep) / Math.max(0.001, averageStepCost);
}

function getRecoilJumpChargeStepFromSpent(run, spent) {
  const effectiveFocusMax = getRecoilJumpEffectiveFocusMax(run);
  const safeSpent = clamp(Number(spent ?? 0), 0, effectiveFocusMax);
  if (safeSpent <= 0) {
    return 0;
  }
  for (let step = 1; step <= RECOIL_JUMP_CHARGE_STEPS; step += 1) {
    if (safeSpent <= getRecoilJumpChargeStageThreshold(run, step)) {
      return step;
    }
  }
  return RECOIL_JUMP_CHARGE_STEPS;
}

function getRecoilJumpChargeMultiplier(run, player) {
  const spentStep = getRecoilJumpChargeStepFromSpent(run, player.recoilJumpChargeFocusSpent);
  if (spentStep <= 0) {
    return 1;
  }
  const progress = spentStep / RECOIL_JUMP_CHARGE_STEPS;
  return lerp(1, RECOIL_JUMP_CHARGE_MAX_MULTIPLIER, progress);
}

function getRecoilJumpChargeStep(run, player) {
  return getRecoilJumpChargeStepFromSpent(run, player.recoilJumpChargeFocusSpent);
}

function updateRecoilJumpLastDirection(player, state, forceFallback = false) {
  const pressedDirection = getKeyboardDirectionPressedVector(state);
  if (pressedDirection) {
    player.recoilJumpLastDirX = pressedDirection.x;
    player.recoilJumpLastDirY = pressedDirection.y;
    return;
  }
  if (forceFallback || !Number.isFinite(player.recoilJumpLastDirX) || !Number.isFinite(player.recoilJumpLastDirY)) {
    player.recoilJumpLastDirX = Math.sign(player.facing || 1) || 1;
    player.recoilJumpLastDirY = 0;
  }
}

function spawnRecoilJumpChargeEffect(run, player, step) {
  const progress = clamp(step / RECOIL_JUMP_CHARGE_STEPS, 0, 1);
  const color = progress >= 0.8 ? "#f5fbff" : progress >= 0.45 ? "#93eaff" : "#62d6ff";
  const centerX = player.x + player.width * 0.5;
  const centerY = player.y + player.height * 0.5;
  const radius = Math.max(player.width, player.height) * (0.58 + progress * 0.18);
  run.recoilFx.push({
    x: centerX,
    y: centerY,
    dirX: 0,
    dirY: -1,
    color,
    radius,
    life: 0.22 + progress * 0.16,
    duration: 0.22 + progress * 0.16,
    weaponType: "recoil-charge",
    scale: 0.85 + progress * 0.7,
    progress,
  });
}

function updateWeaponFireReloadInput(run, data, state) {
  if (useLegacyControls(state)) {
    return false;
  }
  const player = run.player;
  const fireReleasedCode = FIRE_KEYS.find((code) => state.justReleased?.has(code));
  if (!fireReleasedCode) {
    return false;
  }

  consumeRelease(state, fireReleasedCode);
  consumeReleasedKeyHoldSeconds(state, fireReleasedCode);
  const releasedRecoilCharge = Boolean(player.recoilJumpChargeActive || player.recoilJumpChargeFocusSpent > 0);
  player.recoilJumpChargePendingMultiplier = releasedRecoilCharge
    ? getRecoilJumpChargeMultiplier(run, player)
    : 1;
  player.recoilJumpChargeActive = false;
  player.recoilJumpChargeFocusSpent = 0;
  player.recoilJumpChargeMultiplier = 1;
  player.recoilJumpChargeEffectStep = 0;
  player.recoilJumpChargePendingShot = releasedRecoilCharge;
  const selectedContext = getSelectedArmContext(run, data);
  const shouldFire = releasedRecoilCharge || (
    selectedContext.stats.equipped &&
    !player.weaponReloadHoldConsumed
  );
  if (typeof document !== "undefined") {
    document.documentElement.dataset.lastFireInput = "released";
    document.documentElement.dataset.lastFireWeapon = selectedContext.stats.type || "";
    document.documentElement.dataset.lastFireShould = String(Boolean(shouldFire));
  }
  player.weaponReloadHoldConsumed = false;
  return shouldFire;
}

function isDashInputQueued(state) {
  return getDashKeys(state).some((code) => state.justPressed.has(code));
}

function getMouseWorld(state, run) {
  const mouse = state.mouse || {};
  const zoom = clamp(run.cameraZoom ?? 1, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  return {
    x: (mouse.screenX ?? CAMERA_SCREEN_WIDTH / 2) / zoom + run.cameraX,
    y: (mouse.screenY ?? CAMERA_SCREEN_HEIGHT / 2) / zoom + run.cameraY,
  };
}

function getKeyboardAimVector(state, player) {
  const left = isPressed(state, "ArrowLeft");
  const right = isPressed(state, "ArrowRight");
  const up = isPressed(state, "ArrowUp");
  const down = isPressed(state, "ArrowDown");
  let dirX = (right ? 1 : 0) - (left ? 1 : 0);
  let dirY = (down ? 1 : 0) - (up ? 1 : 0);

  if (dirX === 0 && dirY === 0) {
    dirX = Math.sign(player.recoilAimX || player.facing || 1) || 1;
    dirY = 0;
  }

  const length = Math.max(0.001, Math.hypot(dirX, dirY));
  return {
    x: dirX / length,
    y: dirY / length,
  };
}

function getKeyboardDirectionVector(state, player, fallbackX = player?.facing || 1) {
  const left = isPressed(state, "ArrowLeft");
  const right = isPressed(state, "ArrowRight");
  const up = isPressed(state, "ArrowUp");
  const down = isPressed(state, "ArrowDown");
  let dirX = (right ? 1 : 0) - (left ? 1 : 0);
  let dirY = (down ? 1 : 0) - (up ? 1 : 0);

  if (dirX === 0 && dirY === 0) {
    dirX = Math.sign(fallbackX || 1) || 1;
    dirY = 0;
  }

  const length = Math.max(0.001, Math.hypot(dirX, dirY));
  return {
    x: dirX / length,
    y: dirY / length,
  };
}

function getKeyboardDirectionPressedVector(state) {
  const left = isPressed(state, "ArrowLeft");
  const right = isPressed(state, "ArrowRight");
  const up = isPressed(state, "ArrowUp");
  const down = isPressed(state, "ArrowDown");
  const dirX = (right ? 1 : 0) - (left ? 1 : 0);
  const dirY = (down ? 1 : 0) - (up ? 1 : 0);
  if (dirX === 0 && dirY === 0) {
    return null;
  }
  const length = Math.max(0.001, Math.hypot(dirX, dirY));
  return {
    x: dirX / length,
    y: dirY / length,
  };
}

function getKeyboardAimWorldTarget(state, run, origin, player) {
  const keyboardAim = getKeyboardAimVector(state, player);
  const range = 640;
  return {
    x: origin.x + keyboardAim.x * range,
    y: origin.y + keyboardAim.y * range,
  };
}

function getRecoilAimFromShotDirection(player, shotDirX, shotDirY, options = {}) {
  const origin = getRecoilShotOrigin(player);
  const length = Math.max(0.001, Math.hypot(shotDirX, shotDirY));
  const shotX = shotDirX / length;
  const shotY = shotDirY / length;
  const recoilX = -shotX;
  const recoilY = -shotY;
  const range = options.range ?? 640;
  const aimFacing = Math.abs(shotX) > 0.08
    ? Math.sign(shotX)
    : (player.recoilAimFacing || player.facing || 1);
  const aimPitch = shotY < -0.45
    ? -1
    : shotY > 0.45
      ? 1
      : 0;
  return {
    active: Boolean(options.active),
    aiming: Boolean(options.aiming),
    focusBlend: player.recoilFocusBlend ?? 0,
    canFire: true,
    originX: origin.x,
    originY: origin.y,
    targetX: origin.x + shotX * range,
    targetY: origin.y + shotY * range,
    aimFacing,
    aimPitch,
    shotDirX: shotX,
    shotDirY: shotY,
    recoilDirX: recoilX,
    recoilDirY: recoilY,
  };
}

function getRecoilJumpShotAim(player, run, state) {
  let selectedDirection = {
    x: Number(player.recoilJumpLastDirX),
    y: Number(player.recoilJumpLastDirY),
  };
  if (!Number.isFinite(selectedDirection.x) || !Number.isFinite(selectedDirection.y) || Math.hypot(selectedDirection.x, selectedDirection.y) < 0.001) {
    selectedDirection = getKeyboardDirectionVector(state, player, player.facing || 1);
  } else {
    const length = Math.max(0.001, Math.hypot(selectedDirection.x, selectedDirection.y));
    selectedDirection.x /= length;
    selectedDirection.y /= length;
  }
  return getRecoilAimFromShotDirection(player, -selectedDirection.x, -selectedDirection.y, {
    active: Boolean(run.focusActive),
    aiming: true,
  });
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
      const blocked = moveEntityHorizontallyWithWalls(enemy, data, knockback * dt);
      enemy.staggerKnockbackVx = approach(
        blocked ? 0 : knockback,
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
  const baseRange = weaponStats.range ?? 520;
  const aimDistance = distanceBetween(
    { x: aim.originX, y: aim.originY },
    { x: aim.targetX ?? aim.originX, y: aim.targetY ?? aim.originY },
  );
  const range = Math.max(baseRange, aimDistance + (weaponStats.aimOvershootRange ?? 320));
  const startOffset = 18;
  run.playerBullets = run.playerBullets || [];
  run.playerBullets.push({
    id: `player-bullet-${Math.round((run.time ?? 0) * 1000)}-${run.playerBullets.length}`,
    originX: aim.originX,
    originY: aim.originY,
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

function isPointInSector(originX, originY, dirX, dirY, pointX, pointY, range, angle) {
  const dx = pointX - originX;
  const dy = pointY - originY;
  const distance = Math.hypot(dx, dy);
  if (distance <= EPSILON) {
    return true;
  }
  if (distance > range) {
    return false;
  }
  const dirLength = Math.max(0.001, Math.hypot(dirX, dirY));
  const dot = ((dx / distance) * (dirX / dirLength)) + ((dy / distance) * (dirY / dirLength));
  return dot >= Math.cos(angle * 0.5);
}

function isRectInSector(originX, originY, dirX, dirY, rect, range, angle) {
  const nearestX = clamp(originX, rect.x, rect.x + rect.width);
  const nearestY = clamp(originY, rect.y, rect.y + rect.height);
  const samples = [
    [rect.x + rect.width * 0.5, rect.y + rect.height * 0.5],
    [nearestX, nearestY],
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x + rect.width * 0.5, rect.y],
    [rect.x + rect.width * 0.5, rect.y + rect.height],
    [rect.x, rect.y + rect.height * 0.5],
    [rect.x + rect.width, rect.y + rect.height * 0.5],
  ];
  return samples.some(([pointX, pointY]) => (
    isPointInSector(originX, originY, dirX, dirY, pointX, pointY, range, angle)
  ));
}

function getHumanoidBulletDamage(run, bullet, enemy) {
  const baseDamage = bullet.humanoidDamage ?? 50;
  if (bullet.weaponStats?.type !== "shotgun") {
    return baseDamage;
  }
  const closeRange = Math.max(0, Number(bullet.weaponStats.closeRange ?? 0));
  const closeRangeAngle = Math.max(0.1, Number(bullet.weaponStats.closeRangeAngle ?? 1.35));
  const closeRangeDamageMultiplier = Math.max(1, Number(bullet.weaponStats.closeRangeDamageMultiplier ?? 1));
  if (closeRange <= 0 || closeRangeDamageMultiplier <= 1) {
    return baseDamage;
  }
  const originX = Number.isFinite(bullet.originX) ? bullet.originX : run.player.x + run.player.width * 0.5;
  const originY = Number.isFinite(bullet.originY) ? bullet.originY : run.player.y + run.player.height * 0.46;
  return isRectInSector(originX, originY, bullet.dirX, bullet.dirY, enemy, closeRange, closeRangeAngle)
    ? baseDamage * closeRangeDamageMultiplier
    : baseDamage;
}

function getBlastRectHit(blastX, blastY, radius, rect) {
  const nearestX = clamp(blastX, rect.x, rect.x + rect.width);
  const nearestY = clamp(blastY, rect.y, rect.y + rect.height);
  const distance = Math.hypot(nearestX - blastX, nearestY - blastY);
  if (distance > radius) {
    return null;
  }
  return {
    nearestX,
    nearestY,
    distance,
    falloff: clamp(1 - distance / Math.max(1, radius), 0, 1),
  };
}

function pushBlastKnockback(entity, blastX, blastY, force, lift = 0) {
  const centerX = entity.x + entity.width * 0.5;
  const centerY = entity.y + entity.height * 0.5;
  const dx = centerX - blastX;
  const dy = centerY - blastY;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  entity.vx = (entity.vx ?? 0) + (dx / length) * force;
  entity.vy = (entity.vy ?? 0) + (dy / length) * force - lift;
}

function pushScreenShake(run, duration, intensity, dirX = 0, dirY = 0) {
  const nextIntensity = Math.max(0, Number(intensity ?? 0));
  const currentIntensity = Math.max(0, Number(run.screenShakeIntensity ?? 0));
  if (nextIntensity < currentIntensity && (run.screenShakeTimer ?? 0) > 0) {
    return;
  }
  run.screenShakeDuration = Math.max(0.001, Number(duration ?? 0.16));
  run.screenShakeTimer = run.screenShakeDuration;
  run.screenShakeIntensity = nextIntensity;
  run.screenShakeDirX = Number.isFinite(dirX) ? dirX : 0;
  run.screenShakeDirY = Number.isFinite(dirY) ? dirY : 0;
}

function isRecoilJumpStage5Block(block) {
  return block?.breakRule === "recoilJumpStage5" || block?.requiresRecoilJumpStage5 === true;
}

function isRecoilJumpStage5Charge(chargeLevel) {
  return Number(chargeLevel ?? 0) >= 0.99;
}

function destroyTemporaryBlock(run, block, x, y, label = "OPEN") {
  block.maxHp = Math.max(1, Number(block.maxHp ?? 1));
  block.hp = 0;
  block.hitFlash = 0.2;
  block.destroyed = true;
  block.hiddenTimer = 0;
  spawnDamageNumber(run, x, y - 12, 0, "#93eaff", label);
}

function spawnRecoilBlast(run, data, weaponStats, aim, recoilChargeMultiplier = 1, visualChargeLevel = null) {
  const chargeLevel = Number.isFinite(visualChargeLevel)
    ? clamp(visualChargeLevel, 0, 1)
    : clamp((recoilChargeMultiplier - 1) / 0.5, 0, 1);
  const baseRadius = weaponStats.explosionRadius
    ?? weaponStats.blastRadius
    ?? (weaponStats.type === "shotgun" ? 112 : 82);
  const radius = Math.max(36, baseRadius * clamp(0.92 + chargeLevel * 0.9, 0.85, 1.85));
  const blastOffset = Math.max(34, weaponStats.explosionOffset ?? weaponStats.blastOffset ?? (weaponStats.type === "shotgun" ? 72 : 58));
  const blastX = aim.originX + aim.shotDirX * blastOffset;
  const blastY = aim.originY + aim.shotDirY * blastOffset;
  const aimContext = {
    shotDirX: aim.shotDirX,
    shotDirY: aim.shotDirY,
  };

  run.recoilFx.push({
    type: "weapon-blast",
    x: blastX,
    y: blastY,
    originX: aim.originX,
    originY: aim.originY,
    dirX: aim.shotDirX,
    dirY: aim.shotDirY,
    radius,
    life: 0.34,
    duration: 0.34,
    weaponType: weaponStats.type,
    charge: recoilChargeMultiplier,
    chargeLevel,
  });

  if (chargeLevel > 0.01) {
    const shakeStep = Math.ceil(chargeLevel * RECOIL_JUMP_CHARGE_STEPS);
    const earlyShake = 2 + chargeLevel * 4;
    const lateShake = 10 + chargeLevel * 18;
    const shakeIntensity = shakeStep <= 3 ? earlyShake : lateShake;
    const shakeDuration = shakeStep <= 3
      ? 0.08 + chargeLevel * 0.08
      : 0.14 + chargeLevel * 0.22;
    pushScreenShake(run, shakeDuration, shakeIntensity, aim.shotDirX, aim.shotDirY);
  }

  for (const block of run.temporaryBlocks || []) {
    if (isTemporaryBlockHidden(block)) {
      continue;
    }
    const hit = getBlastRectHit(blastX, blastY, radius * 0.92, block);
    if (!hit) {
      continue;
    }
    if (isRecoilJumpStage5Block(block)) {
      if (!isRecoilJumpStage5Charge(chargeLevel)) {
        block.hitFlash = 0.16;
        spawnDamageNumber(run, hit.nearestX, hit.nearestY - 12, 0, "#93eaff", "LV5");
        spawnDirectedParticles(run, hit.nearestX, hit.nearestY, 7, "#93eaff", aim.shotDirX, aim.shotDirY, 360, 0.72);
        continue;
      }
      destroyTemporaryBlock(run, block, hit.nearestX, hit.nearestY, "LV5 OPEN");
      spawnConcreteBlockShards(run, block, hit.nearestX, hit.nearestY, aim.shotDirX, aim.shotDirY, 17);
      spawnDirectedParticles(run, hit.nearestX, hit.nearestY, 22, "#f5fbff", aim.shotDirX, aim.shotDirY, 620, 1);
      continue;
    }
    const damage = Math.max(1, Number(weaponStats.damage ?? 1)) * lerp(0.65, 1.25, hit.falloff);
    block.maxHp = Math.max(1, Number(block.maxHp ?? 1));
    block.hp = Math.max(0, Number(block.hp ?? block.maxHp) - damage);
    block.hitFlash = 0.2;
    spawnDamageNumber(run, hit.nearestX, hit.nearestY - 12, damage, "#93eaff", block.hp <= 0 ? "OPEN" : "BLAST");
    spawnDirectedParticles(run, hit.nearestX, hit.nearestY, block.hp <= 0 ? 18 : 10, "#93eaff", aim.shotDirX, aim.shotDirY, 500, 0.95);
    if (block.hp <= 0) {
      spawnConcreteBlockShards(run, block, hit.nearestX, hit.nearestY, aim.shotDirX, aim.shotDirY, 14);
      block.destroyed = true;
      block.hiddenTimer = 0;
    }
  }

  for (const drone of run.hostileDrones || []) {
    if (isEntityDisabled(drone) || drone.dead) {
      continue;
    }
    const hit = getBlastRectHit(blastX, blastY, radius, drone);
    if (!hit) {
      continue;
    }
    const damage = Math.max(1, Number(weaponStats.droneDamage ?? weaponStats.damage ?? 2)) * lerp(0.48, 1.1, hit.falloff);
    const centerX = drone.x + drone.width * 0.5;
    const centerY = drone.y + drone.height * 0.5;
    drone.active = true;
    drone.hp = Math.max(0, drone.hp - damage);
    drone.hitFlash = 0.2;
    pushBlastKnockback(drone, blastX, blastY, 120 + hit.falloff * 260, 60);
    spawnDamageNumber(run, centerX, centerY - 10, damage, "#87e1ff", "BLAST");
    spawnDirectedParticles(run, centerX, centerY, 13, "#87e1ff", centerX - blastX, centerY - blastY, 460, 0.85);
    if (drone.hp === 0) {
      spawnDamageNumber(run, centerX, centerY - 28, 0, "#f5f8fb", "DOWN");
      destroyHostileDrone(run, drone);
    }
  }

  for (const enemy of run.humanoidEnemies || []) {
    if (!isHumanoidFaceOffAvailable(enemy) || !isHumanoidInFaceOffScope(enemy)) {
      continue;
    }
    const hit = getBlastRectHit(blastX, blastY, radius, enemy);
    if (!hit) {
      continue;
    }
    const centerX = enemy.x + enemy.width * 0.5;
    const centerY = enemy.y + enemy.height * 0.5;
    if (enemy.state === "knockedDown") {
      applyKnockedDownRecoilHit(run, enemy, aimContext);
      spawnDamageNumber(run, centerX, centerY - 16, weaponStats.humanoidDamage ?? 0, "#ffd6ba", "BLAST");
      continue;
    }

    const damage = Math.max(1, Number(weaponStats.humanoidDamage ?? 50)) * lerp(0.48, 1.05, hit.falloff);
    enemy.active = true;
    enemy.state = enemy.state === "patrol" ? "combat" : enemy.state;
    enemy.hp = Math.max(0, (enemy.hp ?? enemy.maxHp ?? 100) - damage);
    enemy.hitFlash = 0.24;
    enemy.trigger = 0;
    pushBlastKnockback(enemy, blastX, blastY, 90 + hit.falloff * 210, 72);
    spawnDamageNumber(run, centerX, centerY - 8, damage, "#ffd6ba", "BLAST");
    spawnDirectedParticles(run, centerX, centerY, 16, "#ffd6ba", centerX - blastX, centerY - blastY, 430, 0.82);
    if (enemy.hp <= 0) {
      knockDownHumanoidEnemy(run, data, enemy);
      continue;
    }
    applyHumanoidStaggerDamage(run, enemy, weaponStats || {}, aimContext);
  }
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
    if (isRecoilJumpStage5Block(block)) {
      block.hitFlash = 0.16;
      spawnDamageNumber(run, hitX, hitY - 12, 0, "#93eaff", "LV5");
      spawnDirectedParticles(run, hitX, hitY, 7, "#93eaff", -bullet.dirX, -bullet.dirY, 320, 0.7);
      return;
    }
    const damage = Math.max(1, Number(bullet.damage ?? 1));
    block.maxHp = Math.max(1, Number(block.maxHp ?? 1));
    block.hp = Math.max(0, Number(block.hp ?? block.maxHp) - damage);
    block.hitFlash = 0.18;
    spawnDamageNumber(run, hitX, hitY - 12, damage, "#93eaff", block.hp <= 0 ? "OPEN" : null);
    spawnDirectedParticles(run, hitX, hitY, block.hp <= 0 ? 16 : 8, "#93eaff", -bullet.dirX, -bullet.dirY, 420, 0.82);
    if (block.hp <= 0) {
      spawnConcreteBlockShards(run, block, hitX, hitY, bullet.dirX, bullet.dirY, 13);
      block.destroyed = true;
      block.hiddenTimer = 0;
    }
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

    const baseDamage = getHumanoidBulletDamage(run, bullet, enemy);
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

function updateFocusState(run, data, state, dt) {
  const player = run.player;
  run.focusMax = Math.max(1, Number(run.focusMax ?? FOCUS_MAX));
  run.focus = clamp(Number(run.focus ?? run.focusMax), 0, run.focusMax);
  run.focusDepleted = Boolean(run.focusDepleted);
  refreshHeatManagementLock(run);

  const recoilJumpChargeRequested = shouldChargeRecoilJump(run, data, state);
  const requested =
    BULLET_TIME_KEYS.some((key) => isPressed(state, key)) ||
    recoilJumpChargeRequested ||
    (!useLegacyControls(state) && FOCUS_KEYS.some((key) => isPressed(state, key))) ||
    Boolean(useLegacyControls(state) && state.mouse?.secondaryDown && canAimWeapon(player));
  const wasActive = Boolean(run.focusActive);
  const canStart = (
    !run.focusDepleted &&
    (wasActive ? run.focus > 0 : run.focus > FOCUS_MIN_TO_START)
  );
  const active = Boolean(requested && canStart);

  if (active) {
    const focusBefore = run.focus;
    const focusDrainPerSecond = FOCUS_DRAIN_PER_SECOND * (
      recoilJumpChargeRequested
        ? RECOIL_JUMP_FOCUS_DRAIN_MULTIPLIER * getRecoilJumpChargeDrainMultiplier(run, player)
        : 1
    );
    run.focus = Math.max(0, run.focus - focusDrainPerSecond * dt);
    if (recoilJumpChargeRequested) {
      if (!player.recoilJumpChargeActive) {
        const clearedPreviousRecoilJump = clearRecoilJumpForce(player);
        if (clearedPreviousRecoilJump) {
          const context = getSelectedArmContext(run, data);
          if (context.stats.type === "shotgun") {
            context.arm.fireCooldownTimer = 0;
            player.recoilShotCooldownTimer = 0;
          }
        }
        const firstInputCharge = getRecoilJumpChargeStageThreshold(run, 1)
          * RECOIL_JUMP_INPUT_START_STEP_RATIO;
        player.recoilJumpChargeFocusSpent = firstInputCharge;
        updateRecoilJumpLastDirection(player, state, true);
      }
      player.recoilJumpChargeActive = true;
      updateRecoilJumpLastDirection(player, state);
      player.recoilJumpChargeFocusSpent = clamp(
        (player.recoilJumpChargeFocusSpent ?? 0) + Math.max(0, focusBefore - run.focus),
        0,
        getRecoilJumpEffectiveFocusMax(run)
      );
      player.recoilJumpChargeMultiplier = getRecoilJumpChargeMultiplier(run, player);
      const chargeStep = getRecoilJumpChargeStep(run, player);
      if (
        chargeStep > (player.recoilJumpChargeEffectStep ?? 0) &&
        player.recoilJumpChargeMultiplier >= RECOIL_JUMP_CHARGE_EFFECT_MIN_MULTIPLIER
      ) {
        spawnRecoilJumpChargeEffect(run, player, chargeStep);
      }
      player.recoilJumpChargeEffectStep = Math.max(player.recoilJumpChargeEffectStep ?? 0, chargeStep);
    }
    if (run.focus <= 0) {
      triggerHeatManagementFailure(run, player);
    }
  } else {
    run.focus = Math.min(run.focusMax, run.focus + FOCUS_RECOVER_PER_SECOND * dt);
    refreshHeatManagementLock(run);
    if (!recoilJumpChargeRequested || !active) {
      clearRecoilJumpChargeState(player);
    }
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
  const target = useLegacyControls(state)
    ? getMouseWorld(state, run)
    : getKeyboardAimWorldTarget(state, run, origin, player);
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
  const aiming = Boolean((
    (!useLegacyControls(state) && FOCUS_KEYS.some((key) => isPressed(state, key))) ||
    (useLegacyControls(state) && state.mouse?.secondaryDown)
  ) && canAimWeapon(player));
  const active = Boolean(run.focusActive);
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
    shotDirX,
    shotDirY,
    recoilDirX,
    recoilDirY,
  };
}

function performRecoilShot(player, run, data, config, state = null, options = {}) {
  const aim = options.aimOverride || run.recoilAim;
  if (!options.contextOverride && isMeleeSlotSelected(run, data)) {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.lastShotResult = "block:melee";
    }
    if (state) {
      pushInputTrace(state, "shotBlock:melee", {});
    }
    return false;
  }
  if (!aim || !canFireWeaponPose(player)) {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.lastShotResult = `block:aim:${Number(Boolean(aim))}:${Number(canFireWeaponPose(player))}`;
    }
    if (state) {
      pushInputTrace(state, "shotBlock:aim", {
        hasAim: Number(Boolean(aim)),
        canAim: Number(canFireWeaponPose(player)),
      });
    }
    return false;
  }

  const recoilJumpShot = Boolean(player.recoilJumpChargePendingShot);
  const context = options.contextOverride || (
    recoilJumpShot ? getShotgunArmContext(run, data) : getSelectedArmContext(run, data)
  );
  if (!context.stats.equipped) {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.lastShotResult = "block:empty";
    }
    if (state) {
      pushInputTrace(state, "shotBlock:empty", { side: context.side });
    }
    pushNotice(run, "No weapon equipped", 1.1);
    return false;
  }
  if (options.requireWeaponType && context.stats.type !== options.requireWeaponType) {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.lastShotResult = "block:type";
    }
    return false;
  }
  if (!canFireWeaponPose(player) || (context.arm.fireCooldownTimer ?? 0) > 0) {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.lastShotResult = `block:cool:${Number(canFireWeaponPose(player))}:${Number(context.arm.fireCooldownTimer ?? 0).toFixed(2)}`;
    }
    if (state) {
      pushInputTrace(state, "shotBlock:cool", {
        canAim: Number(canFireWeaponPose(player)),
        cd: (context.arm.fireCooldownTimer ?? 0).toFixed(2),
      });
    }
    return false;
  }
  if (!recoilJumpShot && !hasWeaponHeat(run, context)) {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.lastShotResult = "block:heat";
    }
    if (state) {
      pushInputTrace(state, "shotBlock:heat", {
        heat: Math.round(run.focus ?? run.focusMax ?? FOCUS_MAX),
        cost: getWeaponHeatCost(context),
      });
    }
    pushNotice(run, "Heat too low.", 1.1);
    return false;
  }

  if (state) {
    pushInputTrace(state, "shotGo", {
      aim: Number(Boolean(aim.aiming)),
      focus: Number(Boolean(run.focusActive)),
      heat: Math.round(run.focus ?? run.focusMax ?? FOCUS_MAX),
      cd: (context.arm.fireCooldownTimer ?? 0).toFixed(2),
    });
  }
  const aimed = Boolean(aim.aiming);
  const bodyEffects = getPlayerBodyCombatEffects(run, context.side);
  const spreadMultiplier = (aimed ? 0.65 : 2.65) * (run.focusActive ? 0.75 : 1) * bodyEffects.spreadMultiplier;
  const spread = (context.stats.spread ?? 0) * spreadMultiplier;
  const recoilX = aim.recoilDirX;
  const recoilY = aim.recoilDirY;
  if (spread > 0.001) {
    const shotAngle = Math.atan2(aim.shotDirY, aim.shotDirX) + (Math.random() - 0.5) * spread;
    aim.shotDirX = Math.cos(shotAngle);
    aim.shotDirY = Math.sin(shotAngle);
  }
  const firedAirborne = !player.onGround;
  const pendingChargeMultiplier = Math.max(1, Number(player.recoilJumpChargePendingMultiplier ?? 1));
  player.recoilJumpChargePendingMultiplier = 1;
  const firstStageMultiplier = lerp(1, RECOIL_JUMP_CHARGE_MAX_MULTIPLIER, 1 / RECOIL_JUMP_CHARGE_STEPS);
  const maxStageForceMultiplier = RECOIL_JUMP_CHARGE_MAX_MULTIPLIER * RECOIL_JUMP_FORCE_MULTIPLIER;
  const minStageForceMultiplier = firstStageMultiplier
    * RECOIL_JUMP_FORCE_MULTIPLIER
    * RECOIL_JUMP_MIN_STAGE_FORCE_RATIO;
  const chargeStageProgress = clamp(
    (pendingChargeMultiplier - firstStageMultiplier) / Math.max(0.001, RECOIL_JUMP_CHARGE_MAX_MULTIPLIER - firstStageMultiplier),
    0,
    1
  );
  const recoilChargeMultiplier = pendingChargeMultiplier > 1
    ? lerp(minStageForceMultiplier, maxStageForceMultiplier, chargeStageProgress)
    : 1;
  const force = (context.stats.recoil ?? config.recoilShotForce ?? 840)
    * recoilChargeMultiplier
    * (1 + (firedAirborne ? getVerticalMomentumBoost(player, config, "verticalMomentumRecoilBoost", 0.14) : 0));
  const maxHorizontal = (config.recoilShotMaxHorizontalSpeed ?? 1180) * recoilChargeMultiplier;
  const maxUp = Math.abs(config.recoilShotMaxUpSpeed ?? 1180) * recoilChargeMultiplier;
  const maxFall = Math.abs(config.recoilShotMaxFallSpeed ?? 760) * recoilChargeMultiplier;
  const stackSpeedMultiplier = Math.max(1, Number(config.recoilShotStackSpeedMultiplier ?? 3));
  const stackMaxHorizontal = maxHorizontal * stackSpeedMultiplier;
  const stackMaxUp = maxUp * stackSpeedMultiplier;
  const stackMaxFall = maxFall * stackSpeedMultiplier;
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
  if (!recoilJumpShot) {
    spendWeaponHeat(run, context, firedAirborne ? 1.12 : 1);
  }
  context.arm.magazine = context.stats.magazineSize;
  context.arm.reloadTimer = 0;
  context.arm.reloadDuration = 0;
  context.arm.fireCooldownTimer = context.stats.fireCooldown * bodyEffects.fireCooldownMultiplier;
  player.recoilShotCooldownTimer = Math.max(context.arm.fireCooldownTimer ?? 0, 0);
  player.recoilShotTimer = Math.max(0.04, (config.recoilAirShotPoseMs ?? 160) / 1000);
  player.recoilShotActive = true;
  player.recoilShotAirborne = firedAirborne;
  player.recoilShotFacing = shotFacing;
  player.recoilShotPitch = shotPitch;
  player.recoilJumpChargeActive = false;
  player.recoilJumpChargeFocusSpent = 0;
  player.recoilJumpChargeMultiplier = 1;
  player.recoilJumpChargeEffectStep = 0;
  player.recoilJumpChargePendingShot = false;
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
  const visualChargeLevel = pendingChargeMultiplier > 1
    ? clamp((pendingChargeMultiplier - 1) / Math.max(0.001, RECOIL_JUMP_CHARGE_MAX_MULTIPLIER - 1), 0.2, 1)
    : 0;
  player.recoilCameraTimer = Math.max(
    (config.recoilShotCameraHoldMs ?? 240) / 1000,
    lerp(RECOIL_FLIGHT_CAMERA_MIN_SECONDS, RECOIL_FLIGHT_CAMERA_MAX_SECONDS, visualChargeLevel),
  );
  player.recoilCameraHoldUntilLanding = visualChargeLevel >= RECOIL_CAMERA_LANDING_HOLD_CHARGE_LEVEL;
  player.recoilCameraReturning = false;
  player.recoilCameraDirX = recoilX;
  player.recoilCameraDirY = recoilY;
  player.vx = clamp(player.vx + recoilX * force, -stackMaxHorizontal, stackMaxHorizontal);
  player.vy = clamp(player.vy + recoilY * force, -stackMaxUp, stackMaxFall);
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
  if (firedAirborne && Math.abs(recoilY) > 0.2) {
    grantVerticalMomentum(player, run, config, 0.18, "recoil");
  }

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
  spawnRecoilBlast(run, data, context.stats, aim, recoilChargeMultiplier, visualChargeLevel);
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
  if (recoilChargeMultiplier >= RECOIL_JUMP_CHARGE_EFFECT_MIN_MULTIPLIER) {
    const chargeProgress = chargeStageProgress;
    spawnDirectedParticles(run, aim.originX, aim.originY, 8 + Math.round(chargeProgress * 14), "#f5fbff", recoilX, recoilY, 520 + chargeProgress * 420, 1.05);
    spawnDirectedParticles(run, aim.originX, aim.originY, 5 + Math.round(chargeProgress * 8), "#62d6ff", aim.shotDirX, aim.shotDirY, 640 + chargeProgress * 360, 0.72);
  }
  pushNotice(run, `${context.stats.label} fired`, 1.15);
  if (options.aimOverride) {
    run.recoilAim = {
      ...aim,
      active: Boolean(run.focusActive),
    };
  } else {
    run.recoilAim.active = Boolean(run.focusActive);
  }
  player.recoilFocusActive = Boolean(run.focusActive);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.lastShotResult = `fired:${context.stats.type}`;
  }
  return true;
}

function startAirDashHover(player, run, config) {
  clearBraceHold(player);
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  clearRecoilSpin(player);
  syncDashCapacity(player, config);
  player.dashCharges = Math.max(0, player.dashCharges - 1);
  player.dashAvailable = false;
  player.dashCooldownTimer = config.dashCooldownMs / 1000;
  player.airDashHoverTimer = AIR_DASH_HOVER_SECONDS;
  player.airDashDirectionGraceTimer = 0;
  player.airDashDirectionPending = false;
  player.airDashPendingDirX = 0;
  player.airDashPendingDirY = 0;
  player.airDashHoverConsumed = true;
  player.hoverActive = true;
  player.hoverBoostActive = true;
  player.hoverParticleTimer = 0;
  player.jumpBufferTimer = 0;
  player.coyoteTimer = 0;
  player.onGround = false;
  player.canInteract = false;
  player.vy = Math.min(player.vy, -AIR_DASH_HOVER_RISE_SPEED);
  spawnDirectedParticles(
    run,
    player.x + player.width * 0.5,
    player.y + player.height + 4,
    10,
    "#93eaff",
    0,
    1,
    280,
    0.5
  );
}

function getDashDurationSeconds(config) {
  return Math.max(0.001, (config.dashDurationMs ?? 0) / 1000);
}

function getDashSpeed(config, player) {
  const duration = getDashDurationSeconds(config);
  const distance = (config.dashDistance ?? 0) * (player.dashDistanceScale ?? 1);
  return (distance / duration) * getMomentumSpeedMultiplier(player, config);
}

function startDash(player, run, config, direction, directionY = 0, distanceScale = 1, consumeDashCharge = true) {
  clearBraceHold(player);
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  clearAirDashHover(player);
  clearRecoilSpin(player);
  const length = Math.max(0.001, Math.hypot(direction, directionY));
  const dashX = direction / length;
  const dashY = directionY / length;
  syncDashCapacity(player, config);
  if (consumeDashCharge) {
    player.dashCharges = Math.max(0, player.dashCharges - 1);
  }
  player.dashAvailable = false;
  player.dashDirection = Math.sign(dashX) || player.facing || 1;
  player.dashVectorX = dashX;
  player.dashVectorY = dashY;
  player.dashDistanceScale = Math.max(0.05, Number(distanceScale) || 1);
  player.dashStartedAirborne = !player.onGround;
  player.dashWindupTimer = (config.dashWindupMs ?? 0) / 1000;
  player.dashTimer = player.dashWindupTimer > 0 ? 0 : getDashDurationSeconds(config);
  player.dashCooldownTimer = config.dashCooldownMs / 1000;
  player.dashCarryTimer = 0;
  player.dashCarrySpeed = 0;
  player.speedRetentionTimer = 0;
  player.retainedSpeed = 0;
  player.wallJumpLockTimer = 0;
  player.wallJumpLockDirection = 0;
  const speed = getDashSpeed(config, player);
  player.vx = speed * dashX;
  player.vy = speed * dashY;
  player.facing = Math.sign(dashX) || player.facing || 1;
  player.canInteract = false;
  player.dashTrailTimer = 0;
  pushAfterimage(run, player);
  spawnParticles(run, player.x + player.width / 2, player.y + player.height / 2, 8, "#d1efff");
  playGameSfx("dash", { cooldownMs: 80 });
}

function startDashBurst(player, config) {
  player.dashWindupTimer = 0;
  player.dashTimer = getDashDurationSeconds(config);
  const speed = getDashSpeed(config, player);
  player.vx = speed * (player.dashVectorX ?? player.dashDirection ?? 1);
  player.vy = speed * (player.dashVectorY ?? 0);
}

function retainAirDashInertia(value) {
  return Number.isFinite(value) ? value * AIR_DASH_INERTIA_RETAIN_RATIO : 0;
}

function stopAirDashOnTerrainCollision(player) {
  player.dashTimer = 0;
  player.dashWindupTimer = 0;
  player.vx = retainAirDashInertia(player.vx);
  player.vy = retainAirDashInertia(player.vy);
  player.dashCarrySpeed = retainAirDashInertia(player.dashCarrySpeed);
  player.retainedSpeed = retainAirDashInertia(player.retainedSpeed);
  player.sprintJumpCarrySpeed = retainAirDashInertia(player.sprintJumpCarrySpeed);
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;
  player.dashStartedAirborne = false;
}

function getStopInertiaDecel(player, config, baseDecel) {
  const initialMultiplier = config.stopInertiaInitialDecelMultiplier ?? 0.26;
  const maxMultiplier = config.stopInertiaMaxDecelMultiplier ?? 1.28;
  const rampSeconds = Math.max(0.001, config.stopInertiaRampSeconds ?? 0.52);
  const progress = clamp((player.noMoveInputTimer ?? 0) / rampSeconds, 0, 1);
  return baseDecel * lerp(initialMultiplier, maxMultiplier, progress * progress);
}

function armDashCarry(player, config, speed, dashDirection) {
  const carryDirection = Math.sign(speed);
  const expectedDirection = Math.sign(dashDirection);
  if (!Number.isFinite(speed) || speed === 0 || (expectedDirection !== 0 && carryDirection !== expectedDirection)) {
    player.dashCarryTimer = 0;
    player.dashCarrySpeed = 0;
    return;
  }
  player.dashCarryTimer = (config.dashCarryWindowMs ?? 0) / 1000;
  player.dashCarrySpeed = speed;
}

function armSprintAfterAirDash(player, config, moveAxis = 0) {
  const dashDirection = Math.sign(player.dashVectorX ?? player.dashDirection ?? 0);
  if (dashDirection === 0) {
    return;
  }
  const heldDirection = Math.sign(moveAxis);
  const sprintDirection = heldDirection !== 0 && heldDirection === dashDirection
    ? heldDirection
    : dashDirection;
  const sprintSpeed = Math.max(config.runSpeed ?? 0, config.sprintSpeed ?? config.runSpeed ?? 0);
  player.sprintPrimed = true;
  player.sprintDirection = sprintDirection;
  player.sprintCharge = 1;
  player.sprintActive = true;
  player.facing = sprintDirection;
  if (sprintSpeed > 0 && Math.abs(player.vx) < sprintSpeed) {
    player.vx = sprintSpeed * sprintDirection;
  }
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

function getVerticalMomentumRatio(player) {
  return clamp(Number(player.verticalMomentum ?? 0), 0, 1);
}

function getVerticalMomentumStage(value) {
  if (value >= 0.7) {
    return 3;
  }
  if (value >= 0.35) {
    return 2;
  }
  if (value > 0.04) {
    return 1;
  }
  return 0;
}

function getVerticalMomentumBoost(player, config, field, fallback = 0) {
  return getVerticalMomentumRatio(player) * Math.max(0, Number(config[field] ?? fallback));
}

function getMomentumSpeedMultiplier(player, config) {
  const speedBoost = Math.max(0, Number(config.verticalMomentumSpeedBoost ?? 0.22));
  return 1 + getVerticalMomentumRatio(player) * speedBoost;
}

function getMomentumSpeedBuildRatio(player, config) {
  const runSpeed = Math.max(1, Number(config.runSpeed ?? 300));
  const sprintSpeed = Math.max(runSpeed + 1, Number(config.sprintSpeed ?? runSpeed * 1.7));
  const speed = Math.hypot(player.vx ?? 0, player.vy ?? 0);
  const startSpeed = runSpeed * 0.8;
  const fullSpeed = Math.max(startSpeed + 1, sprintSpeed * 1.2);
  return clamp((speed - startSpeed) / (fullSpeed - startSpeed), 0, 1);
}

function shouldBuildMomentumFromSpeed(player) {
  return !player.onGround
    || player.dashTimer > 0
    || player.slideTimer > 0
    || player.wallRunActive
    || player.recoilShotActive
    || player.sprintCharge > 0.15
    || Math.abs(player.vx ?? 0) > 1;
}

function getBoostedUpVelocity(player, config, velocity, field, fallback = 0) {
  const sign = Math.sign(velocity) || -1;
  const magnitude = Math.abs(velocity) * (1 + getVerticalMomentumBoost(player, config, field, fallback));
  return sign < 0 ? -magnitude : magnitude;
}

function grantVerticalMomentum(player, run, config, amount, action) {
  const gain = Math.max(0, Number(amount) || 0);
  if (gain <= 0) {
    return;
  }
  const previousStage = getVerticalMomentumStage(player.verticalMomentum ?? 0);
  player.verticalMomentum = clamp((player.verticalMomentum ?? 0) + gain, 0, 1);
  player.verticalMomentumTimer = Math.max(
    player.verticalMomentumTimer ?? 0,
    Math.max(0.05, (config.verticalMomentumComboMs ?? 900) / 1000),
  );
  player.verticalMomentumStage = getVerticalMomentumStage(player.verticalMomentum);
  player.verticalMomentumFlashTimer = 0.18;
  player.verticalMomentumLastAction = action;
  player.verticalMomentumBoostActive = true;
  if (player.verticalMomentumStage > previousStage && player.verticalMomentumStage >= 2) {
    spawnParticles(run, player.x + player.width / 2, player.y + player.height / 2, 4 + player.verticalMomentumStage * 2, "#93eaff");
  }
}

function updateVerticalMomentum(player, config, dt) {
  player.verticalMomentumFlashTimer = Math.max(0, (player.verticalMomentumFlashTimer ?? 0) - dt);
  player.verticalMomentumBoostActive = false;
  player.verticalMomentumTimer = Math.max(0, (player.verticalMomentumTimer ?? 0) - dt);
  const speedBuildRatio = shouldBuildMomentumFromSpeed(player)
    ? getMomentumSpeedBuildRatio(player, config)
    : 0;
  if (speedBuildRatio > 0) {
    const speedBuild = Math.max(0, Number(config.verticalMomentumSpeedBuild ?? 0.24));
    player.verticalMomentum = clamp((player.verticalMomentum ?? 0) + speedBuildRatio * speedBuild * dt, 0, 1);
    player.verticalMomentumTimer = Math.max(player.verticalMomentumTimer ?? 0, 0.18);
  }
  const decayMs = player.onGround
    ? (config.verticalMomentumGroundDecayMs ?? Math.min(config.verticalMomentumDecayMs ?? 1150, 520))
    : (config.verticalMomentumDecayMs ?? 1150);
  if (player.verticalMomentumTimer <= 0) {
    player.verticalMomentum = Math.max(0, (player.verticalMomentum ?? 0) - dt / Math.max(0.05, decayMs / 1000));
  }
  player.verticalMomentumStage = getVerticalMomentumStage(player.verticalMomentum ?? 0);
}

function performJump(player, run, velocity, config = null) {
  clearBraceHold(player);
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  clearRecoilSpin(player);
  const movementConfig = config || {};
  player.vy = getBoostedUpVelocity(player, movementConfig, velocity, "verticalMomentumJumpBoost", 0.1);
  player.onGround = false;
  player.jumpBufferTimer = 0;
  player.coyoteTimer = 0;
  grantVerticalMomentum(player, run, movementConfig, 0.12, "jump");
  spawnParticles(run, player.x + player.width / 2, player.y + player.height, 6, "#d8ebff");
  playGameSfx("jump", { cooldownMs: 60 });
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
  const wallBoost = 1 + getVerticalMomentumBoost(player, config, "verticalMomentumWallBoost", 0.16);
  player.vx = direction * config.wallJumpHorizontal * wallBoost;
  player.vy = -config.wallJumpVertical * wallBoost;
  player.facing = direction;
  player.jumpBufferTimer = 0;
  player.onGround = false;
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  grantVerticalMomentum(player, run, config, 0.22, "wallJump");
  spawnParticles(run, player.x + player.width / 2, player.y + player.height / 2, 8, "#cde9ff");
  playGameSfx("wallJump", { cooldownMs: 60 });
}

function enterBraceHold(player, run, data, config, wall, moveAxis) {
  clearWallRun(player);
  clearSlide(player);
  clearHover(player);
  clearRecoilSpin(player);
  const playerCenterX = player.x + player.width * 0.5;
  const wallCenterX = wall.x + wall.width * 0.5;
  const holdDirection = playerCenterX <= wallCenterX ? 1 : -1;
  const launchDirection = moveAxis || Math.sign(player.vx) || player.facing || holdDirection;

  player.braceHolding = true;
  player.braceHoldWallId = getBraceWallId(wall);
  player.braceHoldDirection = holdDirection;
  player.braceHoldLaunchDirection = launchDirection;
  player.braceHoldSpeed = Math.max(
    Math.abs(player.vy),
    Math.abs(player.vx),
    config.braceHoldStartSpeed ?? 0,
    config.runSpeed ?? 0,
  );
  player.vx = launchDirection * player.braceHoldSpeed;
  player.vy = 0;
  player.facing = launchDirection;
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
  resetShotgunFireCooldown(run, data);
  spawnParticles(run, wall.x + wall.width * 0.5, player.y + player.height * 0.45, 6, "#8fe1ff");
  playGameSfx("wallJump", { cooldownMs: 80 });
  pushNotice(run, "踰?怨좎젙");
}

function updateBraceHold(player, data, config, wall, dt, moveAxis) {
  player.braceHoldSpeed = Math.min(
    config.braceHoldMaxSpeed ?? config.wallRunMaxSpeed ?? 920,
    Math.max(
      player.braceHoldSpeed,
      Math.abs(player.vx),
      config.braceHoldStartSpeed ?? 0,
      config.runSpeed ?? 0,
    ) + (config.braceHoldAccel ?? config.wallRunAccel ?? 0) * dt
  );
  if (moveAxis !== 0) {
    player.facing = player.braceHoldLaunchDirection || moveAxis;
  } else if (Math.abs(player.vx) > 12) {
    player.braceHoldLaunchDirection = Math.sign(player.vx);
  }
  const direction = player.braceHoldLaunchDirection || player.facing || 1;
  player.vx = direction * player.braceHoldSpeed;
  player.vy = 0;
  player.onGround = false;
  player.canInteract = false;
  player.braceHoldActive = true;
}

function enterWallRun(player, run, data, config, wallDirection) {
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
  resetShotgunFireCooldown(run, data);
  spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.45, 4, "#b8f0ff");
  playGameSfx("wallJump", { cooldownMs: 90 });
}

function updateWallRun(player, config, dt) {
  const wallBoost = 1 + getVerticalMomentumBoost(player, config, "verticalMomentumWallBoost", 0.16);
  player.wallRunSpeed = Math.min(
    (config.wallRunMaxSpeed ?? 0) * wallBoost,
    player.wallRunSpeed + (config.wallRunAccel ?? 0) * dt
  );
  player.vy = -player.wallRunSpeed;
  player.vx = player.wallRunDirection * Math.max((config.runSpeed ?? 0) * 0.22 * wallBoost, 88);
  player.onGround = false;
}

function launchFromWallRun(player, run, config) {
  const direction = player.wallRunDirection || player.wallDirection || 0;
  const exitDirection = direction === 0 ? player.facing || 1 : -direction;
  const wallBoost = 1 + getVerticalMomentumBoost(player, config, "verticalMomentumWallBoost", 0.16);
  player.vx = exitDirection * Math.max(Math.abs(player.vx), (config.wallRunExitHorizontal ?? 0) * wallBoost);
  player.vy = -Math.max(player.wallRunSpeed, (config.wallRunExitMinBoost ?? 0) * wallBoost);
  player.facing = exitDirection;
  player.jumpBufferTimer = 0;
  player.wallGraceTimer = 0;
  player.wallGraceDirection = 0;
  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;
  player.wallRunBoostActive = true;
  grantVerticalMomentum(player, run, config, 0.2, "wallRun");
  spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.35, 10, "#b8f0ff");
  playGameSfx("braceVault", { cooldownMs: 80 });
  pushNotice(run, "踰???諛쒖궗");
  clearWallRun(player);
}

function startHover(player, run, config) {
  player.hoverActive = true;
  player.hoverBoostActive = true;
  player.hoverParticleTimer = 0;
  player.jumpBufferTimer = 0;
  player.coyoteTimer = 0;
  const hoverLift = getVerticalMomentumRatio(player) * Math.max(0, config.verticalMomentumHoverLift ?? 0);
  if (hoverLift > 0) {
    player.vy = Math.min(player.vy, -hoverLift);
  }
  grantVerticalMomentum(player, run, config, 0.1, "hover");
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
  playGameSfx("hover", { cooldownMs: 160 });
}

function performBraceVault(player, run, config, wall, moveAxis) {
  const direction = moveAxis || player.braceHoldLaunchDirection || Math.sign(player.vx) || player.facing || 1;
  endBraceHoldWithCooldown(player, config, getBraceWallId(wall));
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
  grantVerticalMomentum(player, run, config, 0.18, "brace");
  spawnParticles(run, wall.x + wall.width * 0.5, player.y + player.height * 0.45, 10, "#8fe1ff");
  playGameSfx("braceVault", { cooldownMs: 80 });
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
  const jumpKeys = getJumpKeys(state);
  const moveLeft = isEitherPressed(state, getMoveLeftKeys(state));
  const moveRight = isEitherPressed(state, getMoveRightKeys(state));
  const rawMoveAxis = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
  player.cameraInputDirection = rawMoveAxis;
  const airDashDirection = getKeyboardDirectionPressedVector(state);
  let moveAxis = rawMoveAxis;
  const crouchHeld = isEitherPressed(state, getCrouchKeys(state));
  const crouchPressed = consumeEitherPress(state, getCrouchKeys(state));
  const jumpPressed = consumeEitherPress(state, jumpKeys);
  const jumpHeld = isEitherPressed(state, jumpKeys);
  const jumpKeyReleased = consumeEitherRelease(state, jumpKeys);
  const capsDashInput = updateCapsLockDashInput(state, player, dt, moveLeft, moveRight);
  let dashPressed = consumeEitherPress(state, getDashKeys(state)) || capsDashInput.dashPressed;
  const sprintPressed = consumeEitherPress(state, SPRINT_KEYS);
  const sprintHeld = isEitherPressed(state, SPRINT_KEYS) || capsDashInput.sprintHeld;
  const activeBraceWall = getActiveBraceWall(player, data, run);
  const heldBraceWall = getBraceWallById(data, player.braceHoldWallId, run);
  const wasSprintActive = Boolean(player.sprintActive || player.sprintCharge > 0.55);
  const jumpReleased = !jumpHeld && player.jumpHeldLastFrame;

  player.dashInvulnerable = config.dashInvulnerable;
  player.slideInvulnerable = config.slideInvulnerable ?? true;
  player.wasOnGround = player.onGround;
  player.crouchRequested = crouchHeld;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attackWindow = Math.max(0, player.attackWindow - dt);
  if (player.attackWindow <= 0) {
    player.attackToolActive = false;
  }
  player.attackAirHoldTimer = Math.max(0, (player.attackAirHoldTimer ?? 0) - dt);
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
  const wasAirDashHovering = (player.airDashHoverTimer ?? 0) > 0;
  player.airDashHoverTimer = Math.max(0, (player.airDashHoverTimer ?? 0) - dt);
  player.airDashDirectionGraceTimer = Math.max(0, (player.airDashDirectionGraceTimer ?? 0) - dt);
  if (wasAirDashHovering && player.airDashHoverTimer === 0) {
    clearHover(player);
  }
  player.recoilShotCooldownTimer = Math.max(0, player.recoilShotCooldownTimer - dt);
  player.recoilShotTimer = Math.max(0, player.recoilShotTimer - dt);
  player.recoilSpinTimer = Math.max(0, player.recoilSpinTimer - dt);
  updateRecoilCameraTimers(player, dt, run);
  player.sprintJumpCarryTimer = Math.max(0, player.sprintJumpCarryTimer - dt);
  updateVerticalMomentum(player, config, dt);
  decaySlideTimer(player, config, dt);
  player.slideGroundGraceTimer = Math.max(0, (player.slideGroundGraceTimer ?? 0) - dt);
  player.wallGraceTimer = Math.max(0, player.wallGraceTimer - dt);
  player.wallSlideGraceTimer = Math.max(0, player.wallSlideGraceTimer - dt);
  player.speedRetentionTimer = Math.max(0, player.speedRetentionTimer - dt);
  player.braceCooldownTimer = Math.max(0, player.braceCooldownTimer - dt);
  if (player.braceCooldownTimer === 0) {
    player.braceConsumedWallId = null;
  }
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
  player.verticalMomentumBoostActive = player.verticalMomentumFlashTimer > 0;
  player.braceHoldActive = false;
  player.wallRunBoostActive = false;
  player.dashResetActive = false;
  player.hoverBoostActive = Boolean(player.hoverActive && !player.onGround);
  player.recoilShotActive = player.recoilShotTimer > 0;
  const recoilMovementLocked = Boolean(
    player.recoilShotActive ||
    player.recoilSpinTimer > 0 ||
    player.recoilJumpChargeActive
  );
  if (recoilMovementLocked) {
    moveAxis = 0;
    dashPressed = false;
  }
  player.noMoveInputTimer = moveAxis === 0
    ? (player.noMoveInputTimer ?? 0) + dt
    : 0;

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
  if (player.onGround) {
    player.attackAirHoldTimer = 0;
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

  if (dashPressed || sprintPressed || sprintHeld) {
    player.sprintPrimed = true;
  }

  if (jumpReleased && !player.braceHolding && player.vy < 0) {
    player.vy *= config.jumpCutMultiplier;
  }

  if (
    player.dashCarryTimer > 0 &&
    (
      (moveAxis !== 0 && Math.sign(moveAxis) !== Math.sign(player.dashCarrySpeed)) ||
      (Math.abs(player.vx) > EPSILON && Math.sign(player.vx) !== Math.sign(player.dashCarrySpeed))
    )
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

  const sprintReleaseMaintained = Boolean(
    !sprintHeld &&
    player.sprintPrimed &&
    wasSprintActive &&
    player.onGround &&
    player.height === player.standHeight &&
    moveAxis !== 0 &&
    (
      player.sprintDirection === 0 ||
      player.sprintDirection === moveAxis
    )
  );
  const sprintInputHeld = sprintHeld || sprintReleaseMaintained;

  const canBuildSprint =
    sprintInputHeld &&
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
  const airDashSprintCompatible =
    player.sprintPrimed &&
    !player.onGround &&
    player.height === player.standHeight &&
    player.sprintCharge > 0 &&
    moveAxis !== 0 &&
    (
      player.sprintDirection === 0 ||
      player.sprintDirection === moveAxis
    );
  const preserveAirSprint =
    (sprintInputHeld || sprintJumpCarryCompatible || airDashSprintCompatible) &&
    (player.sprintPrimed || sprintJumpCarryCompatible || airDashSprintCompatible) &&
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
      if (!sprintInputHeld && player.dashTimer === 0) {
        player.sprintPrimed = false;
      }
    }
  }

  if (player.onGround) {
    if (crouchPressed && tryStartSlide(player, data, config, moveAxis)) {
      playGameSfx("slide", { cooldownMs: 140 });
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
    const recoilJumpAimOverride = player.recoilJumpChargePendingShot
      ? getRecoilJumpShotAim(player, run, state)
      : null;
    const firedRecoilShot = performRecoilShot(player, run, data, config, state, {
      aimOverride: recoilJumpAimOverride,
    });
    if (!firedRecoilShot) {
      player.recoilJumpChargePendingMultiplier = 1;
      player.recoilJumpChargePendingShot = false;
    }
    if (firedRecoilShot && state.mouse && !keepPrimaryHeld) {
      state.mouse.primaryDown = false;
      state.mouse.primaryJustPressed = false;
    }
  }

  const wallJumpSourceDirection =
    player.wallRunActive && player.wallRunDirection !== 0
      ? player.wallRunDirection
      : player.wallDirection !== 0
      ? player.wallDirection
      : player.wallGraceTimer > 0
        ? player.wallGraceDirection
        : 0;
  const pressingTowardWall =
    wallJumpSourceDirection !== 0 &&
    moveAxis === wallJumpSourceDirection;
  const wantsWallRun =
    !player.onGround &&
    wallJumpSourceDirection !== 0 &&
    pressingTowardWall &&
    player.height === player.standHeight &&
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    !player.braceHolding;

  if (
    (player.airDashHoverTimer ?? 0) > 0 &&
    !airDashDirection &&
    Math.hypot(player.airDashPendingDirX || 0, player.airDashPendingDirY || 0) <= 0.001
  ) {
    player.airDashDirectionPending = false;
    player.airDashDirectionGraceTimer = 0;
  }

  if (
    (player.airDashHoverTimer ?? 0) > 0 &&
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    player.height === player.standHeight
  ) {
    if (airDashDirection) {
      player.airDashPendingDirX = airDashDirection.x;
      player.airDashPendingDirY = airDashDirection.y;
    }
    const pendingDashX = player.airDashPendingDirX || 0;
    const pendingDashY = player.airDashPendingDirY || 0;
    const hasPendingAirDashDirection = Math.hypot(pendingDashX, pendingDashY) > 0.001;
    const airDashDiagonalReady = Math.abs(pendingDashX) > 0.001 && Math.abs(pendingDashY) > 0.001;
    if (hasPendingAirDashDirection && !player.airDashDirectionPending && !airDashDiagonalReady) {
      player.airDashDirectionPending = true;
      player.airDashDirectionGraceTimer = Math.min(
        AIR_DASH_DIAGONAL_GRACE_SECONDS,
        player.airDashHoverTimer ?? AIR_DASH_DIAGONAL_GRACE_SECONDS
      );
    }
    if (
      hasPendingAirDashDirection &&
      (
        airDashDiagonalReady ||
        (player.airDashDirectionPending && (player.airDashDirectionGraceTimer ?? 0) === 0)
      )
    ) {
      const airDashDistanceScale = (getJumpMaxHeight(data, config) * AIR_DASH_DISTANCE_MULTIPLIER) / Math.max(1, Number(config.dashDistance ?? 1));
      startDash(player, run, config, pendingDashX, pendingDashY, airDashDistanceScale, false);
    }
  }

  if (
    dashPressed &&
    !wantsWallRun &&
    !player.airDashHoverConsumed &&
    player.dashAvailable &&
    player.dashTimer === 0 &&
    player.dashWindupTimer === 0 &&
    player.dashCooldownTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    player.height === player.standHeight
  ) {
    if (!player.onGround) {
      startAirDashHover(player, run, config);
      if (airDashDirection) {
        player.airDashPendingDirX = airDashDirection.x;
        player.airDashPendingDirY = airDashDirection.y;
      }
    } else {
      const direction = moveAxis || player.facing;
      if (direction !== 0) {
        startDash(player, run, config, direction, 0, 1);
      }
    }
  }

  if (player.dashWindupTimer > 0) {
    player.dashWindupTimer = Math.max(0, player.dashWindupTimer - dt);
    player.vx = 0;
    player.vy = 0;
    player.canInteract = false;
    player.facing = Math.sign(player.dashVectorX || player.dashDirection || 0) || player.facing;
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
    const dashSpeed = getDashSpeed(config, player);
    player.vx = dashSpeed * (player.dashVectorX ?? player.dashDirection ?? 1);
    player.vy = dashSpeed * (player.dashVectorY ?? 0);
    player.facing = Math.sign(player.dashVectorX || player.dashDirection || 0) || player.facing;
    player.canInteract = false;

    const contacts = resolvePlayerCollisions(player, data, dt, config, run);
    if (updateDamageBlockContact(run, data)) {
      updateMovementVfx(run, data, dt);
      player.jumpHeldLastFrame = jumpHeld;
      setMovementState(player);
      return;
    }
    const landed = !player.wasOnGround && contacts.onGround;
    player.dashCornerCorrected = contacts.dashCornerCorrected;
    const dashStartedAirborne = Boolean(player.dashStartedAirborne);
    const airDashHitTerrain = Boolean(
      dashStartedAirborne &&
      (contacts.dashBlocked || contacts.hitHead || contacts.onGround)
    );
    if (airDashHitTerrain) {
      stopAirDashOnTerrainCollision(player);
      armSprintAfterAirDash(player, config, moveAxis);
      player.onGround = contacts.onGround;
      player.standingOnDynamicId = contacts.onGround ? (contacts.groundEntityId ?? null) : null;
      player.wallDirection = contacts.wallLeft ? -1 : contacts.wallRight ? 1 : 0;
      player.wallSliding = false;
      updateMovementVfx(run, data, dt);
      player.jumpHeldLastFrame = jumpHeld;
      setMovementState(player);
      return;
    } else if (contacts.dashBlocked) {
      player.dashTimer = 0;
    }
    if (landed) {
      releaseRecoilCameraAfterLanding(player, run);
      refillDashFromGround(player, config);
      refillRecoilShot(player, config);
      clearAirDashHover(player);
      clearHover(player);
      clearRecoilSpin(player);
      player.coyoteTimer = config.coyoteTimeMs / 1000;
      playGameSfx("land", { intensity: contacts.landingSpeed, cooldownMs: 70 });
      updatePlayerLastSafeGround(player, data);
    }
    player.onGround = contacts.onGround;
    player.standingOnDynamicId = contacts.onGround ? (contacts.groundEntityId ?? null) : null;
    player.wallDirection = contacts.wallLeft ? -1 : contacts.wallRight ? 1 : 0;
    player.wallSliding = false;
    if (!airDashHitTerrain && !player.onGround && player.wallDirection !== 0) {
      player.wallGraceTimer = config.wallCoyoteTimeMs / 1000;
      player.wallGraceDirection = player.wallDirection;
    } else if (player.onGround || airDashHitTerrain) {
      player.wallGraceTimer = 0;
      player.wallGraceDirection = 0;
      player.wallSlideGraceTimer = 0;
      player.wallSlideGraceDirection = 0;
    }

    if (player.onGround && !dashStartedAirborne) {
      if (crouchPressed && tryStartSlide(player, data, config, moveAxis)) {
        playGameSfx("slide", { cooldownMs: 140 });
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
    } else if (player.onGround) {
      player.crouchBlocked = false;
    }

    const dashCarryDirection = player.dashVectorX ?? player.dashDirection ?? 0;
    if ((landed || player.dashTimer === 0) && dashStartedAirborne && !airDashHitTerrain) {
      player.vx = retainAirDashInertia(player.vx);
      player.vy = retainAirDashInertia(player.vy);
      player.dashCarrySpeed = retainAirDashInertia(player.dashCarrySpeed);
      player.retainedSpeed = retainAirDashInertia(player.retainedSpeed);
      player.sprintJumpCarrySpeed = retainAirDashInertia(player.sprintJumpCarrySpeed);
      armSprintAfterAirDash(player, config, moveAxis);
    } else if ((landed || player.dashTimer === 0) && !contacts.dashBlocked && !airDashHitTerrain && dashCarryDirection !== 0) {
      const resolvedVelocityDirection = Math.sign(player.vx);
      const expectedCarryDirection = Math.sign(dashCarryDirection);
      if (resolvedVelocityDirection === 0 || resolvedVelocityDirection !== expectedCarryDirection) {
        player.dashCarryTimer = 0;
        player.dashCarrySpeed = 0;
      } else {
        const dashCarrySpeed = player.vx * CELESTE_END_DASH_SPEED_RATIO;
        armDashCarry(player, config, dashCarrySpeed, dashCarryDirection);
      }
    }
    if (player.dashTimer === 0) {
      player.dashStartedAirborne = false;
    }

    if (!dashStartedAirborne && landed && player.jumpBufferTimer > 0 && player.height === player.standHeight) {
      if (player.sprintCharge >= 0.55 && Math.abs(player.vx) >= config.runSpeed * 0.92) {
        armSprintJumpCarry(player, config);
      }
      performJump(player, run, config.jumpVelocity, config);
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
    player.wallJumpLockTimer === 0 &&
    !player.braceHolding;
  const canWallRun = wantsWallRun && !canWallJump;
  const canGroundJump =
    player.jumpBufferTimer > 0 &&
    player.coyoteTimer > 0 &&
    (player.height === player.standHeight || player.slideTimer > 0);
  const canBrace =
    jumpPressed &&
    activeBraceWall &&
    !(
      player.braceConsumedWallId === getBraceWallId(activeBraceWall) &&
      player.braceCooldownTimer > 0
    ) &&
    !player.onGround &&
    player.height === player.standHeight &&
    player.dashTimer === 0 &&
    player.wallJumpLockTimer === 0 &&
    !canWallJump;

  if (canWallJump) {
    performWallJump(player, run, config, wallJumpSourceDirection);
  } else if (canBrace) {
    enterBraceHold(player, run, data, config, activeBraceWall, moveAxis);
  }

  if (player.braceHolding) {
    const braceWall = getBraceWallById(data, player.braceHoldWallId, run) ?? activeBraceWall;
    const braceDirectionReversed = moveAxis !== 0 &&
      Math.sign(moveAxis) !== Math.sign(player.braceHoldLaunchDirection || player.facing || 1);
    if (braceDirectionReversed) {
      endBraceHoldWithCooldown(player, config, getBraceWallId(braceWall));
    } else if (!braceWall || player.height !== player.standHeight) {
      endBraceHoldWithCooldown(player, config, getBraceWallId(braceWall));
    } else if (!isPlayerInsideBraceWall(player, braceWall)) {
      performBraceVault(player, run, config, braceWall, moveAxis);
      applySprintJumpCarry(player);
    } else if (jumpReleased || jumpKeyReleased) {
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
      const braceHitCollision = Boolean(
        contacts.hitHead ||
        contacts.onGround ||
        contacts.wallLeft ||
        contacts.wallRight ||
        contacts.dashBlocked
      );

      if (landed) {
        releaseRecoilCameraAfterLanding(player, run);
        refillDashFromGround(player, config);
        player.coyoteTimer = config.coyoteTimeMs / 1000;
      }

      if (braceHitCollision) {
        endBraceHoldWithCooldown(player, config, getBraceWallId(braceWall));
        updateMovementVfx(run, data, dt);
        player.jumpHeldLastFrame = jumpHeld;
        setMovementState(player);
        return;
      }

      if (!isPlayerInsideBraceWall(player, braceWall)) {
        performBraceVault(player, run, config, braceWall, moveAxis);
        applySprintJumpCarry(player);
        updateMovementVfx(run, data, dt);
        player.jumpHeldLastFrame = jumpHeld;
        setMovementState(player);
        return;
      }

      if (player.onGround) {
        endBraceHoldWithCooldown(player, config, getBraceWallId(braceWall));
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
      endBraceHoldWithCooldown(player, config, getBraceWallId(braceWall));
    }
  }

  if (canWallRun) {
    if (!player.wallRunActive || player.wallRunDirection !== wallJumpSourceDirection) {
      enterWallRun(player, run, data, config, wallJumpSourceDirection);
    }
  } else if (player.wallRunActive && jumpReleased) {
    launchFromWallRun(player, run, config);
  } else if (player.wallRunActive && !pressingTowardWall) {
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
    performJump(player, run, jumpVelocity, config);
    applySprintJumpCarry(player);
    applyDashJumpCarry(player, config);
  }

  const canStartHover = false;

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
  } else if (recoilMovementLocked) {
    // Preserve weapon recoil velocity while its inertia window is active.
  } else {
    const downhillSprintActive = isMovingDownhillOnSlope(player, moveAxis);
    const baseTargetSpeed = player.height === player.crouchHeight && player.onGround
      ? moveAxis * config.runSpeed * config.crouchSpeedMultiplier
      : moveAxis * (
        downhillSprintActive
          ? (config.sprintSpeed ?? config.runSpeed)
          : getSprintTargetSpeed(player, config, moveAxis, sprintInputHeld && player.sprintPrimed)
      );
    const targetSpeed = player.sprintJumpCarryTimer > 0 && moveAxis !== 0
      ? moveAxis * Math.max(Math.abs(baseTargetSpeed), Math.abs(player.sprintJumpCarrySpeed))
      : baseTargetSpeed;
    const momentumTargetSpeed = targetSpeed * getMomentumSpeedMultiplier(player, config);

    const airControl = config.airControlMultiplier ?? 1;
    const accel = player.onGround
      ? config.groundAccel
      : config.groundAccel * airControl;
    const decel = player.onGround
      ? config.groundDecel
      : config.groundDecel * airControl;
    const currentDirection = Math.sign(player.vx);
    const targetDirection = Math.sign(momentumTargetSpeed);
    const preservingAirInertia = (
      !player.onGround &&
      Math.abs(player.vx) > Math.abs(momentumTargetSpeed) &&
      (moveAxis === 0 || currentDirection === targetDirection)
    );
    const reversingAirDirection = (
      !player.onGround &&
      moveAxis !== 0 &&
      currentDirection !== 0 &&
      targetDirection !== 0 &&
      currentDirection !== targetDirection
    );

    const stopDecel = moveAxis === 0 && player.onGround
      ? getStopInertiaDecel(player, config, decel)
      : decel;
    let horizontalChangeRate = moveAxis !== 0 ? accel : stopDecel;
    if (preservingAirInertia) {
      horizontalChangeRate = decel * (config.airInertiaDecelMultiplier ?? 0.18);
    } else if (reversingAirDirection) {
      horizontalChangeRate = decel * (config.airTurnDecelMultiplier ?? 0.52);
    }
    player.vx = approach(player.vx, momentumTargetSpeed, horizontalChangeRate * dt);

    if (
      player.onGround &&
      player.dashCarryTimer > 0 &&
      player.dashCarrySpeed !== 0 &&
      (moveAxis === 0 || Math.sign(moveAxis) === Math.sign(player.dashCarrySpeed)) &&
      Math.abs(player.vx) < Math.abs(player.dashCarrySpeed)
    ) {
      const dashCarryExpectedDirection = Math.sign(player.dashVectorX ?? player.dashDirection ?? 0);
      if (dashCarryExpectedDirection !== 0 && Math.sign(player.dashCarrySpeed) !== dashCarryExpectedDirection) {
        player.dashCarryTimer = 0;
        player.dashCarrySpeed = 0;
      } else {
        player.vx = approach(
          player.vx,
          player.dashCarrySpeed,
          config.groundAccel * 1.2 * dt
        );
        player.dashCarryActive = true;
      }
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
    (canBuildSprint || (!player.onGround && (sprintJumpCarryCompatible || airDashSprintCompatible)))
  ) {
    player.sprintActive = true;
  }
  player.lightActive = isPressed(state, "KeyQ") && run.battery > 0 && player.dashTimer === 0 && player.dashWindupTimer === 0;
  if (player.lightActive) {
    run.battery = Math.max(0, run.battery - data.player.lightDrainPerSecond * dt);
    if (run.battery === 0) {
      player.lightActive = false;
      pushNotice(run, "諛고꽣由??뚯쭊.");
    }
  }

  if (attackPressed && player.attackCooldown === 0 && player.height === player.standHeight) {
    const meleeEffects = getPlayerBodyCombatEffects(run, null);
    player.attackCooldown = data.player.attackCooldown * (meleeToolActive ? meleeEffects.meleeCooldownMultiplier : 1);
    player.attackWindow = 0.12;
    player.attackToolActive = meleeToolActive;
    player.attackToolActive = meleeToolActive;
    if (!player.onGround) {
      player.attackAirHoldTimer = (config.attackAirHoldMs ?? 160) / 1000;
      if (player.vy > 0) {
        player.vy = 0;
      }
    }
    player.attackHits.clear();
    run.attackFx.push({
      x: player.x + player.width / 2,
      y: player.y + player.height / 2,
      facing: player.facing,
      life: 0.12,
    });
    playGameSfx("melee", { cooldownMs: 100 });
  }

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
      (!jumpHeld && (player.airDashHoverTimer ?? 0) === 0) ||
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

  if ((player.airDashHoverTimer ?? 0) > 0) {
    player.vy = approach(player.vy, 0, AIR_DASH_HOVER_BRAKE * dt);
  }

  const gravityMultiplier = player.recoilJumpChargeActive
    ? RECOIL_CHARGE_GRAVITY_MULTIPLIER
    : (player.airDashHoverTimer ?? 0) > 0
    ? 0
    : player.hoverActive
    ? (config.hoverGravityMultiplier ?? 0.18)
    : player.attackAirHoldTimer > 0
      ? 0
    : player.apexGravityActive
      ? (config.apexGravityMultiplier ?? 1)
      : 1;
  const baseMaxFallSpeed = Number.isFinite(config.maxFallSpeed)
    ? Math.max(120, config.maxFallSpeed)
    : null;
  const fallSoftExtraSpeed = Math.max(0, Number(config.fallSoftExtraSpeed ?? 0) || 0);
  const softFallActive = Boolean(
    baseMaxFallSpeed !== null &&
    fallSoftExtraSpeed > 0 &&
    !player.wallRunActive &&
    !player.hoverActive &&
    player.vy >= baseMaxFallSpeed &&
    gravityMultiplier > 0
  );
  const effectiveGravityMultiplier = softFallActive
    ? gravityMultiplier * clamp(config.fallSoftGravityMultiplier ?? 0.08, 0, 1)
    : gravityMultiplier;
  const vyBeforeGravity = player.vy;
  if (!player.wallRunActive) {
    player.vy += data.world.gravity * effectiveGravityMultiplier * dt;
  }
  if (!player.wallRunActive && !player.hoverActive && player.vy > 0 && baseMaxFallSpeed !== null) {
    const maxFallSpeed = baseMaxFallSpeed + fallSoftExtraSpeed;
    player.vy = Math.min(player.vy, maxFallSpeed);
    if (fallSoftExtraSpeed > 0 && vyBeforeGravity < baseMaxFallSpeed && player.vy > baseMaxFallSpeed) {
      player.vy = baseMaxFallSpeed;
    }
  }
  if (player.attackAirHoldTimer > 0) {
    player.vy = approach(player.vy, 0, (config.attackAirHoldBrake ?? 4200) * dt);
  }
  if (player.hoverActive) {
    player.vy = Math.min(player.vy, config.hoverFallSpeed ?? 160);
  }

  const vxBeforeResolve = player.vx;
  const contacts = resolvePlayerCollisions(player, data, dt, config, run);
  if (updateDamageBlockContact(run, data)) {
    updateMovementVfx(run, data, dt);
    player.jumpHeldLastFrame = jumpHeld;
    setMovementState(player);
    return;
  }
  const landed = !player.wasOnGround && contacts.onGround;
  player.jumpCornerCorrected = contacts.jumpCornerCorrected;
  player.dashCornerCorrected = contacts.dashCornerCorrected;

  player.onGround = contacts.onGround;
  player.standingOnDynamicId = contacts.onGround ? (contacts.groundEntityId ?? null) : null;
  player.wallDirection = contacts.wallLeft ? -1 : contacts.wallRight ? 1 : 0;
  player.wallSliding = false;

  if (player.wallRunActive) {
    if (player.wallDirection === 0 || player.onGround || contacts.hitHead) {
      launchFromWallRun(player, run, config);
    } else {
      player.wallRunDirection = player.wallDirection;
      player.wallSliding = false;
    }
  }

  player.wallSlideGraceTimer = 0;
  player.wallSlideGraceDirection = 0;

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
    releaseRecoilCameraAfterLanding(player, run);
    refillDashFromGround(player, config);
    refillRecoilShot(player, config);
    clearAirDashHover(player);
    clearHover(player);
    clearRecoilSpin(player);
    const burstSize = contacts.landingSpeed > 480 ? 10 : 5;
    spawnParticles(run, player.x + player.width / 2, player.y + player.height, burstSize, "#c5d8e6");
    playGameSfx("land", { intensity: contacts.landingSpeed, cooldownMs: 70 });
    if (player.jumpBufferTimer > 0 && player.height === player.standHeight) {
      if (player.sprintCharge >= 0.55 && Math.abs(player.vx) >= config.runSpeed * 0.92) {
        armSprintJumpCarry(player, config);
      }
      performJump(player, run, config.jumpVelocity, config);
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
    clearAirDashHover(player);
    clearHover(player);
    clearRecoilSpin(player);
    refillDashFromGround(player, config);
    refillRecoilShot(player, config);
    updatePlayerLastSafeGround(player, data);
    if (crouchPressed && tryStartSlide(player, data, config, moveAxis)) {
      playGameSfx("slide", { cooldownMs: 140 });
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
  if (
    player.onGround &&
    player.height === player.standHeight &&
    player.slideTimer <= 0 &&
    Math.abs(player.vx) > 150
  ) {
    player.footstepTimer = Math.max(0, (player.footstepTimer ?? 0) - dt);
    if (player.footstepTimer === 0) {
      playGameSfx("footstep", { cooldownMs: 55 });
      const speedRatio = clamp(Math.abs(player.vx) / Math.max(1, config.sprintSpeed ?? config.runSpeed ?? 900), 0.45, 1.35);
      player.footstepTimer = clamp(0.28 / speedRatio, 0.14, 0.34);
    }
  } else {
    player.footstepTimer = 0;
  }
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
    if (moveEntityHorizontallyWithWalls(guard, data, guard.patrolDirection * guard.speed * dt, run)) {
      guard.patrolDirection *= -1;
    }
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
      moveEntityHorizontallyWithWalls(guard, data, direction * guard.chaseSpeed * dt, run);
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
      if (moveEntityHorizontallyWithWalls(ritualist, data, direction * ritualist.speed * dt, run)) {
        ritualist.patrolIndex = (ritualist.patrolIndex + 1) % ritualist.patrolPoints.length;
      }
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
      moveEntityHorizontallyWithWalls(ritualist, data, direction * ritualist.chaseSpeed * dt, run);
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
      moveEntityHorizontallyWithWalls(threat, data, direction * threat.chaseSpeed * dt, run);

      if (distance < threat.attackRange && threat.attackCooldown === 0) {
        threat.attackCooldown = 1;
        damagePlayer(run, threat.damage, direction, "?대몺 ???꾪삊????튇??");
      }
    } else {
      if (moveEntityHorizontallyWithWalls(threat, data, threat.patrolDirection * threat.speed * dt, run)) {
        threat.patrolDirection *= -1;
      }
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
  playGameSfx("enemyShot", { cooldownMs: 120 });
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
  playGameSfx("enemyShot", { cooldownMs: 120 });
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
  player.y = Math.min(player.y + dy, data.world.height - player.height);
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
  const maxX = Math.max(0, (data.world?.width ?? targetX + enemy.width) - enemy.width);
  enemy.knockdownFacing = direction;
  enemy.facing = direction;
  const previousX = enemy.x;
  const nextX = enemy.x + direction * speed * dt;
  const reached = direction > 0 ? nextX >= targetX : nextX <= targetX;
  const blocked = moveEntityHorizontallyWithWalls(
    enemy,
    data,
    (reached ? targetX : nextX) - enemy.x,
    run,
  );

  if (blocked) {
    enemy.escapeTargetX = previousX;
    return;
  }

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
  playGameSfx("enemyShot", { cooldownMs: 120 });
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
  playGameSfx("enemyShot", { cooldownMs: 120 });
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

function isHumanoidWallAhead(enemy, data, direction, run = null) {
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
  return getCollisionPlatforms(data, run).some((platform) => (
    !isSlopePlatform(platform) &&
    rectsOverlap(probe, platform)
  ));
}

function getHumanoidPatrolDirection(enemy, data, run = null) {
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

  if (isHumanoidWallAhead(enemy, data, direction, run) || !hasHumanoidGroundAhead(enemy, data, direction)) {
    direction *= -1;
  }

  enemy.patrolDirection = direction;
  return direction;
}

function updateHumanoidGroundPhysics(enemy, data, dt, direction = 0, run = null) {
  ensureHumanoidGroundState(enemy);
  const config = getMovementConfig(data);
  const desiredDirection = Math.sign(direction) || 0;
  const maxFallSpeed = enemy.maxFallSpeed ?? config.maxFallSpeed ?? 1600;
  const speed = Math.max(0, enemy.patrolSpeed ?? enemy.speed ?? 70);

  enemy.vx = enemy.onGround ? desiredDirection * speed : 0;
  enemy.vy = Math.min(maxFallSpeed, (enemy.vy ?? 0) + (data.world?.gravity ?? 0) * dt);

  const contacts = resolvePlayerCollisions(enemy, data, dt, config, run);
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
      const direction = getHumanoidPatrolDirection(enemy, data, run);
      updateHumanoidGroundPhysics(enemy, data, dt, direction, run);
      continue;
    }

    updateHumanoidGroundPhysics(enemy, data, dt, 0, run);

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
    const spilled = spillLootCrate(run, crate, { broken: true, directionX });
    if (spilled) {
      playGameSfx("lootOpen", { cooldownMs: 160 });
    }
    return spilled;
  }
  playGameSfx("impact", { cooldownMs: 80 });
  return true;
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
  pushNotice(run, `${crate.label} 媛쒕큺.`);
  spawnParticles(run, crate.x + crate.width / 2, crate.y + 8, 8, "#93eaff");
  playGameSfx("lootOpen", { cooldownMs: 160 });
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
    playGameSfx("lootDenied", { cooldownMs: 140 });
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
  playGameSfx("lootCollect", { rarityRank, cooldownMs: 80 });

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
  updateRecoilCameraTimers(player, dt, run);
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
  if (isSelectableLootItem(item) && isEitherPressed(state, getInteractKeys(state))) {
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

function getInteractionTargets(state, run, data) {
  const playerCenter = getCenter(run.player);
  const targets = [];
  const escapeActive = isVaultEscapeActive(run);

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
  if (gate && !escapeActive) {
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

  for (const exit of run.escapeExits || []) {
    if (!escapeActive) {
      continue;
    }
    const exitRect = createRect(exit.x, exit.y, exit.width, exit.height);
    if (distanceBetween(playerCenter, getCenter(exitRect)) < 118) {
      targets.push({
        id: exit.id,
        kind: "escapeExit",
        escapeExit: exit,
        text: normalizeInteractionPrompt(exit.prompt || "E: Escape"),
        x: exit.x + exit.width / 2,
        y: exit.y - 12,
      });
    }
  }

  for (const routeExit of data.routeExits || []) {
    if (escapeActive) {
      continue;
    }
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

  for (const placement of getActiveNpcPlacements(state, data)) {
    if (distanceBetween(playerCenter, getCenter(placement)) < 104) {
      targets.push({
        id: placement.id,
        kind: "npc",
        npcPlacement: placement,
        text: normalizeInteractionPrompt(placement.interactPrompt || "Z: 대화"),
        x: placement.x + placement.width / 2,
        y: placement.y - 12,
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

  for (const door of run.vaultDoors || []) {
    if (door.hacked || run.vaultEscape?.completed) {
      continue;
    }
    if (distanceBetween(playerCenter, getCenter(door)) < 112) {
      targets.push({
        id: door.id,
        kind: "vaultDoor",
        vaultDoor: door,
        text: normalizeInteractionPrompt(door.prompt || "E: Hack vault"),
        x: door.x + door.width / 2,
        y: door.y - 12,
      });
    }
  }

  for (const loot of run.vaultLoot || []) {
    if (loot.collected || !escapeActive) {
      continue;
    }
    if (distanceBetween(playerCenter, getCenter(loot)) < 86) {
      targets.push({
        id: loot.id,
        kind: "vaultLoot",
        vaultLoot: loot,
        text: normalizeInteractionPrompt(loot.prompt || "E: Take supplies"),
        x: loot.x + loot.width / 2,
        y: loot.y - 12,
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
        text: normalizeInteractionPrompt(crate.opened ? "Z: ?곸옄 ?뺤씤" : crate.prompt),
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
  const prompt = zipLine?.prompt || "Up: Zipline";
  return prompt.replace(/^(?:Space\/D|Space\/Z|D\/Z|D|C|E|Z|Up)\s*:/i, "Up:");
}

function normalizeInteractionPrompt(prompt) {
  return (prompt || "").replace(/^(?:D\/Z|D|C|E|Z|Up)\s*:/i, "Up:");
}

function normalizeExtractionPrompt(prompt) {
  return (prompt || "Z: Exit").replace(/^(?:D\/Z|D|C|E|Z|Up)\s*:/i, "Z:");
}

function getMetaStoryFlags(state) {
  state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
  state.meta.storyFlags = Array.isArray(state.meta.storyFlags) ? state.meta.storyFlags : [];
  return state.meta.storyFlags;
}

function npcShowWhenMatches(state, showWhen = {}) {
  const flags = getMetaStoryFlags(state);
  const required = Array.isArray(showWhen.requiredStoryFlags) ? showWhen.requiredStoryFlags : [];
  const missing = Array.isArray(showWhen.missingStoryFlags) ? showWhen.missingStoryFlags : [];
  return required.every((flag) => flags.includes(flag))
    && missing.every((flag) => !flags.includes(flag));
}

function getActiveNpcPlacements(state, data) {
  const levelId = data.currentLevelId || state.run?.currentLevelId || data.levelId || data.defaultLevelId || "";
  return Array.isArray(data.npcPlacements)
    ? data.npcPlacements.filter((placement) => (
      placement
      && placement.levelId === levelId
      && npcShowWhenMatches(state, placement.showWhen)
      && Array.isArray(placement.dialogue?.nodes)
      && placement.dialogue.nodes.length > 0
    ))
    : [];
}

function getNpcRouteInterceptPlacement(state, data, routeExitId) {
  const targetRouteId = String(routeExitId || "");
  if (!targetRouteId) {
    return null;
  }
  return getActiveNpcPlacements(state, data).find((placement) => placement.interceptRouteExitId === targetRouteId) || null;
}

function getNpcProfile(data, placement) {
  return data.npcProfiles?.[placement?.npcId] || {
    id: placement?.npcId || "npc",
    name: placement?.npcId || "NPC",
    role: "",
    visual: { kind: "silhouette" },
  };
}

function getNpcDialogueNode(placement, nodeId = "") {
  const nodes = Array.isArray(placement?.dialogue?.nodes) ? placement.dialogue.nodes : [];
  const targetId = nodeId || placement?.dialogue?.startNodeId || nodes[0]?.id || "";
  return nodes.find((node) => node.id === targetId) || nodes[0] || null;
}

function getNpcDialogueChoice(dialogue, choiceId = "") {
  const choices = Array.isArray(dialogue?.choices) ? dialogue.choices : [];
  if (choiceId) {
    return choices.find((choice) => choice.id === choiceId) || null;
  }
  return choices[clamp(Math.floor(dialogue?.choiceIndex || 0), 0, Math.max(0, choices.length - 1))] || null;
}

function getNpcDialoguePlacement(run, data) {
  const placementId = run?.npcDialogue?.placementId || "";
  if (!placementId) {
    return null;
  }
  return (Array.isArray(data?.npcPlacements) ? data.npcPlacements : [])
    .find((placement) => placement.id === placementId) || null;
}

function syncNpcDialogueCamera(run, data, dt, snap = false, placementOverride = null) {
  const placement = placementOverride || getNpcDialoguePlacement(run, data);
  const player = run?.player;
  if (!run || !player || !placement) {
    return false;
  }

  const config = getEffectiveCameraConfig(data, run);
  const baseZoom = clamp(config.zoom ?? run.cameraZoom ?? 1, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  const npcCenterX = placement.x + placement.width * 0.5;
  const npcHeadY = placement.y + placement.height * 0.18;
  const playerCenterX = player.x + player.width * 0.5;
  const playerCenterY = player.y + player.height * 0.46;
  const desiredViewportWidth = Math.max(720, Math.abs(npcCenterX - playerCenterX) + 520);
  const desiredViewportHeight = Math.max(420, Math.abs(npcHeadY - playerCenterY) + 360);
  const fitZoom = Math.min(
    CAMERA_SCREEN_WIDTH / desiredViewportWidth,
    CAMERA_SCREEN_HEIGHT / desiredViewportHeight,
  );
  const targetZoom = clamp(Math.min(baseZoom, fitZoom), CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  const viewportWidth = CAMERA_SCREEN_WIDTH / targetZoom;
  const viewportHeight = CAMERA_SCREEN_HEIGHT / targetZoom;
  const focusX = (npcCenterX + playerCenterX) * 0.5;
  const targetX = focusX - viewportWidth * 0.5;
  const targetY = npcHeadY - viewportHeight * NPC_DIALOGUE_CAMERA_HEAD_FOCUS_Y;
  const maxX = Math.max(0, data.world.width - viewportWidth);
  const maxY = Math.max(0, data.world.height - viewportHeight);
  const cameraX = clamp(targetX, 0, maxX);
  const cameraY = clamp(targetY, 0, maxY);
  const lerpRatio = snap ? 1 : Math.min(1, Math.max(0, dt) * NPC_DIALOGUE_CAMERA_LERP);

  run.cameraFocusX = 0.5;
  run.cameraFocusY = NPC_DIALOGUE_CAMERA_HEAD_FOCUS_Y;
  run.cameraTargetX = cameraX;
  run.cameraTargetY = cameraY;
  run.cameraTargetZoom = targetZoom;
  run.cameraLookAhead = 0;
  run.cameraSpeedRatio = 0;
  run.cameraZoom = snap
    ? targetZoom
    : clamp(lerp(run.cameraZoom ?? targetZoom, targetZoom, lerpRatio), CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
  run.cameraX = snap ? cameraX : clamp(lerp(run.cameraX, cameraX, lerpRatio), 0, maxX);
  run.cameraY = snap ? cameraY : clamp(lerp(run.cameraY, cameraY, lerpRatio), 0, maxY);
  return true;
}

function setNpcDialogueNode(run, placement, nodeId, state) {
  const node = getNpcDialogueNode(placement, nodeId);
  if (!node || !run?.npcDialogue) {
    return false;
  }
  const dialogue = run.npcDialogue;
  dialogue.nodeId = node.id;
  dialogue.line = String(node.line || "");
  dialogue.choices = Array.isArray(node.choices) ? deepClone(node.choices).slice(0, 3) : [];
  dialogue.choiceIndex = 0;
  dialogue.timerSeconds = clamp(Number(placement.dialogue?.timerSeconds ?? 6), 1, 30);
  dialogue.timeoutChoice = node.timeoutChoice ? deepClone(node.timeoutChoice) : null;
  dialogue.timeoutChoiceId = String(node.timeoutChoiceId || placement.dialogue?.timeoutChoiceId || "");
  dialogue.timerElapsed = 0;
  dialogue.completed = false;
  dialogue.postAction = null;
  dialogue.completedAt = 0;
  dialogue.startedAt = Number.isFinite(state?.pulse) ? state.pulse : 0;
  return true;
}

function applyNpcChoiceEffects(state, effects = {}) {
  const storyFlags = Array.isArray(effects.storyFlags) ? effects.storyFlags : [];
  let changed = false;
  storyFlags.forEach((flag) => {
    changed = addMetaStoryFlag(state, String(flag || "")) || changed;
  });
  if (changed) {
    saveMetaState(state.meta);
  }
  return changed;
}

function finishNpcDialogue(state, data) {
  const run = state.run;
  const dialogue = run?.npcDialogue;
  if (!dialogue?.active) {
    return false;
  }
  const postAction = dialogue.postAction && typeof dialogue.postAction === "object" ? dialogue.postAction : {};
  const pendingRouteExit = dialogue.pendingRouteExit ? deepClone(dialogue.pendingRouteExit) : null;
  run.npcDialogue = {
    active: false,
    placementId: "",
    npcId: "",
    nodeId: "",
    line: "",
    choices: [],
    choiceIndex: 0,
    timerSeconds: 6,
    timerElapsed: 0,
    timeoutChoiceId: "",
    timeoutChoice: null,
    completed: false,
    completedAt: 0,
    postAction: null,
    pendingRouteExit: null,
  };
  run.prompt = "";
  run.promptWorld = null;
  updateNpcDialogueMusic(false);
  if (postAction.type === "route" && pendingRouteExit) {
    const routeExit = {
      ...pendingRouteExit,
      toLevelId: postAction.toLevelId || pendingRouteExit.toLevelId,
      toEntranceId: postAction.toEntranceId || pendingRouteExit.toEntranceId || "start",
      returnEntranceId: postAction.returnEntranceId || pendingRouteExit.returnEntranceId || "start",
    };
    beginRouteFadeTransition(state, data, routeExit);
  } else {
    saveCurrentGame(state, data);
  }
  return true;
}

function chooseNpcDialogueChoice(state, data, choice) {
  const run = state.run;
  const dialogue = run?.npcDialogue;
  if (!dialogue?.active || !choice) {
    return false;
  }
  const placement = getActiveNpcPlacements(state, data).find((candidate) => candidate.id === dialogue.placementId)
    || (Array.isArray(data.npcPlacements) ? data.npcPlacements.find((candidate) => candidate.id === dialogue.placementId) : null);
  applyNpcChoiceEffects(state, choice.effects || {});
  playGameSfx("uiConfirm", { cooldownMs: 120 });
  if (choice.nextNodeId && placement && setNpcDialogueNode(run, placement, choice.nextNodeId, state)) {
    return true;
  }
  dialogue.line = String(choice.reply || "");
  dialogue.choices = [];
  dialogue.choiceIndex = 0;
  dialogue.timerElapsed = 0;
  dialogue.completed = true;
  dialogue.completedAt = Number.isFinite(state?.pulse) ? state.pulse : 0;
  dialogue.postAction = choice.postAction && typeof choice.postAction === "object" ? deepClone(choice.postAction) : null;
  return true;
}

function beginNpcDialogue(state, data, placement, options = {}) {
  const run = state.run;
  if (!run || !placement) {
    return false;
  }
  const profile = getNpcProfile(data, placement);
  run.npcDialogue = {
    active: true,
    placementId: placement.id,
    npcId: profile.id,
    nodeId: "",
    line: "",
    choices: [],
    choiceIndex: 0,
    timerSeconds: 6,
    timerElapsed: 0,
    timeoutChoiceId: "",
    timeoutChoice: null,
    completed: false,
    completedAt: 0,
    postAction: null,
    pendingRouteExit: options.routeExit ? deepClone(options.routeExit) : null,
    startedAt: Number.isFinite(state?.pulse) ? state.pulse : 0,
  };
  run.prompt = "";
  run.promptWorld = null;
  playGameSfx("promptFocus", { cooldownMs: 120 });
  const started = setNpcDialogueNode(run, placement, placement.dialogue?.startNodeId, state);
  if (started) {
    updateNpcDialogueMusic(true);
    syncNpcDialogueCamera(run, data, 0, true, placement);
    setStatus(state, `${profile.name}: 대화`);
  } else {
    run.npcDialogue.active = false;
    updateNpcDialogueMusic(false);
  }
  return started;
}

function updateNpcDialogue(state, data, dt) {
  const run = state.run;
  const dialogue = run?.npcDialogue;
  if (!dialogue?.active) {
    return false;
  }

  updateNpcDialogueMusic(true);
  syncNpcDialogueCamera(run, data, dt);
  run.prompt = "";
  run.promptWorld = null;
  if (run.mapOverlay) {
    run.mapOverlay.active = false;
  }
  if (run.recoilAim) {
    run.recoilAim.active = false;
    run.recoilAim.aiming = false;
  }
  run.focusActive = false;
  run.player.recoilFocusActive = false;

  if (dialogue.completed) {
    const postAction = dialogue.postAction && typeof dialogue.postAction === "object" ? dialogue.postAction : {};
    const elapsed = Math.max(0, (Number.isFinite(state?.pulse) ? state.pulse : 0) - (dialogue.completedAt || 0));
    const delay = clamp(Number(postAction.delaySeconds ?? 0), 0, 4);
    if ((postAction.type === "route" && elapsed >= delay) || consumeEitherPress(state, NPC_DIALOGUE_CONFIRM_KEYS)) {
      finishNpcDialogue(state, data);
    }
    setStatus(state, "NPC 대화. Z 계속.");
    return true;
  }

  const choices = Array.isArray(dialogue.choices) ? dialogue.choices : [];
  if (!choices.length) {
    if (consumeEitherPress(state, NPC_DIALOGUE_CONFIRM_KEYS)) {
      finishNpcDialogue(state, data);
    }
    setStatus(state, "NPC 대화. Z 닫기.");
    return true;
  }

  if (consumeEitherPress(state, NPC_DIALOGUE_UP_KEYS)) {
    dialogue.choiceIndex = (Math.max(0, Math.floor(dialogue.choiceIndex || 0)) + choices.length - 1) % choices.length;
    dialogue.timerElapsed = 0;
    playGameSfx("uiMove", { cooldownMs: 80 });
  }
  if (consumeEitherPress(state, NPC_DIALOGUE_DOWN_KEYS)) {
    dialogue.choiceIndex = (Math.max(0, Math.floor(dialogue.choiceIndex || 0)) + 1) % choices.length;
    dialogue.timerElapsed = 0;
    playGameSfx("uiMove", { cooldownMs: 80 });
  }

  dialogue.timerSeconds = clamp(Number(dialogue.timerSeconds || 6), 1, 30);
  dialogue.timerElapsed = clamp(Number(dialogue.timerElapsed || 0) + dt, 0, dialogue.timerSeconds);
  if (dialogue.timerElapsed >= dialogue.timerSeconds) {
    const timeoutChoice = dialogue.timeoutChoice
      || getNpcDialogueChoice(dialogue, dialogue.timeoutChoiceId)
      || choices[choices.length - 1]
      || choices[0];
    chooseNpcDialogueChoice(state, data, timeoutChoice);
    return true;
  }

  if (consumeEitherPress(state, NPC_DIALOGUE_CONFIRM_KEYS)) {
    chooseNpcDialogueChoice(state, data, getNpcDialogueChoice(dialogue));
  }

  setStatus(state, "NPC 대화. W/S 선택, Z 응답.");
  return true;
}

function isVaultEscapeActive(run) {
  return Boolean(run?.vaultEscape?.active && !run.vaultEscape.completed && !run.vaultEscape.failed);
}

function isVaultLockdownActive(run) {
  return Boolean(run?.vaultEscape?.lockdownActive && !run.vaultEscape.completed);
}

export function beginVaultEscape(run, door) {
  if (!run?.vaultEscape || !door || isVaultEscapeActive(run) || run.vaultEscape.completed) {
    return false;
  }
  door.hacked = true;
  const duration = Math.max(1, Number(door.duration ?? run.vaultEscape.duration ?? 60));
  run.vaultEscape.active = true;
  run.vaultEscape.failed = false;
  run.vaultEscape.lockdownActive = false;
  run.vaultEscape.lockdownTimer = 0;
  run.vaultEscape.completed = false;
  run.vaultEscape.doorId = door.id;
  run.vaultEscape.duration = duration;
  run.vaultEscape.timeLeft = duration;
  run.vaultEscape.collected = (run.vaultLoot || []).filter((loot) => loot.collected).length;
  run.vaultEscape.valueCollected = (run.vaultLoot || []).reduce((sum, loot) => (
    sum + (loot.collected ? Math.max(0, Number(loot.value ?? 25)) : 0)
  ), 0);
  run.vaultEscape.totalLoot = (run.vaultLoot || []).length;
  run.vaultEscape.totalValue = (run.vaultLoot || []).reduce((sum, loot) => sum + Math.max(0, Number(loot.value ?? 25)), 0);
  closeLootCrate(run);
  pushNotice(run, "Vault alarm armed. Grab supplies and escape.");
  spawnParticles(run, door.x + door.width / 2, door.y + door.height / 2, 18, "#ff7a66");
  playGameSfx("terminalStart", { cooldownMs: 180 });
  startVaultEscapeMusic(run);
  return true;
}

function beginVaultLockdown(run) {
  if (!run?.vaultEscape || isVaultLockdownActive(run)) {
    return false;
  }
  run.vaultEscape.active = false;
  run.vaultEscape.failed = true;
  run.vaultEscape.lockdownActive = true;
  run.vaultEscape.lockdownDuration = Math.max(0.4, Number(run.vaultEscape.lockdownDuration ?? 1.6));
  run.vaultEscape.lockdownTimer = run.vaultEscape.lockdownDuration;
  run.vaultEscape.timeLeft = 0;
  closeLootCrate(run);
  run.message = "LOCKDOWN. All exits sealed.";
  run.noticeTimer = Math.max(run.noticeTimer ?? 0, run.vaultEscape.lockdownDuration);
  pushNotice(run, run.message);
  spawnParticles(run, run.player.x + run.player.width / 2, run.player.y + run.player.height / 2, 24, "#ff7a66");
  playGameSfx("lockdownStart", { cooldownMs: 260 });
  updateVaultEscapeMusic(run);
  return true;
}

function collectVaultLoot(run, loot) {
  if (!run?.vaultEscape || !loot || loot.collected || !isVaultEscapeActive(run)) {
    return false;
  }
  const value = Math.max(0, Number(loot.value ?? 25));
  loot.collected = true;
  loot.collectedAt = run.time ?? 0;
  run.materials += value;
  run.vaultEscape.collected = Math.min(
    run.vaultEscape.totalLoot,
    (run.vaultEscape.collected ?? 0) + 1,
  );
  run.vaultEscape.valueCollected = Math.min(
    run.vaultEscape.totalValue,
    (run.vaultEscape.valueCollected ?? 0) + value,
  );
  pushNotice(run, `${loot.label || "Supplies"} secured.`);
  spawnParticles(run, loot.x + loot.width / 2, loot.y + loot.height / 2, 12, "#e7f47e");
  playGameSfx("vaultCollect", { cooldownMs: 90 });
  return true;
}

function updateVaultEscapeTimer(state, data, dt) {
  const run = state.run;
  if (isVaultLockdownActive(run)) {
    updateLootLockedPlayer(run, dt);
    run.vaultEscape.lockdownTimer = Math.max(0, (run.vaultEscape.lockdownTimer ?? 0) - dt);
    updateVaultEscapeMusic(run);
    if (run.vaultEscape.lockdownTimer > 0) {
      return true;
    }
    run.vaultEscape.lockdownActive = false;
    applyFailure(state, data, "vaultLockdown");
    return true;
  }
  if (!isVaultEscapeActive(run)) {
    return false;
  }
  run.vaultEscape.timeLeft = Math.max(0, (run.vaultEscape.timeLeft ?? 0) - dt);
  updateVaultEscapeMusic(run);
  if (run.vaultEscape.timeLeft > 0) {
    return false;
  }
  beginVaultLockdown(run);
  return true;
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
  if (!nearest) {
    return false;
  }
  const mountPressed = consumeEitherPress(state, getZipLineMountKeys(state));
  if (!mountPressed) {
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

function getVaultResultSummary(run) {
  const vault = run?.vaultEscape;
  const loot = run?.vaultLoot || [];
  const doors = run?.vaultDoors || [];
  const attempted = Boolean(
    vault?.active ||
    vault?.completed ||
    vault?.failed ||
    vault?.doorId ||
    doors.some((door) => door.hacked) ||
    loot.some((item) => item.collected),
  );
  if (!attempted && loot.length === 0 && doors.length === 0) {
    return null;
  }

  const totalLoot = Math.max(0, Number(vault?.totalLoot ?? loot.length) || 0);
  const totalValue = Math.max(0, Number(vault?.totalValue ?? loot.reduce((sum, item) => (
    sum + Math.max(0, Number(item.value ?? 25))
  ), 0)) || 0);
  const collected = Math.max(0, Number(vault?.collected ?? loot.filter((item) => item.collected).length) || 0);
  const valueCollected = Math.max(0, Number(vault?.valueCollected ?? loot.reduce((sum, item) => (
    sum + (item.collected ? Math.max(0, Number(item.value ?? 25)) : 0)
  ), 0)) || 0);
  const recoveryRate = totalValue > 0
    ? valueCollected / totalValue
    : totalLoot > 0
      ? collected / totalLoot
      : 0;

  return {
    attempted,
    completed: Boolean(vault?.completed),
    failed: Boolean(vault?.failed),
    lockedDown: Boolean(vault?.failed || vault?.lockdownActive),
    doorId: vault?.doorId || null,
    collected,
    totalLoot,
    valueCollected,
    totalValue,
    recoveryRate,
    perfect: totalLoot > 0 && collected >= totalLoot,
    duration: Math.max(0, Number(vault?.duration ?? 0) || 0),
    timeLeft: Math.max(0, Number(vault?.timeLeft ?? 0) || 0),
  };
}

function applyExtraction(state, data) {
  const run = state.run;
  const securedLoot = summarizeSecuredLoot(run);
  const objectives = summarizeRunObjectives(run, securedLoot);
  const vaultSummary = getVaultResultSummary(run);
  stopVaultEscapeMusic();
  stopSearchMusic();
  if (isMovementLab(data)) {
    state.resultSummary = {
      success: true,
      labSession: true,
      materials: run.materials,
      securedLoot,
      objectives,
      timePhase: run.timePhase,
      vault: vaultSummary,
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
      vault: vaultSummary,
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
    vault: vaultSummary,
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
  const vaultSummary = getVaultResultSummary(state.run);
  stopVaultEscapeMusic();
  stopSearchMusic();
  if (isMovementLab(data)) {
    state.resultSummary = {
      success: false,
      labSession: true,
      reason,
      lostMaterials: 0,
      lostLoot,
      objectives,
      vault: vaultSummary,
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
    vault: vaultSummary,
  };
  clearSavedGame();
  state.run = null;
  state.scene = SCENES.GAME_OVER;
  state.sceneTimer = 0;
  setStatus(state, "???ㅽ뙣. C/Z");
}

function restartCurrentRun(state, data) {
  stopVaultEscapeMusic();
  stopSearchMusic(true);
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
  "vaultDoors",
  "vaultLoot",
  "escapeExits",
  "escapeBarriers",
  "vaultEscape",
  "encounters",
  "threats",
  "hostileDrones",
  "humanoidEnemies",
  "temporaryBlocks",
];

function captureLevelRuntimeState(run) {
  return {
    __levelSignature: createLevelStateSignature(run),
    ...Object.fromEntries(
    LEVEL_STATE_KEYS.map((key) => [key, deepClone(run[key])]),
    ),
  };
}

function getLevelSignatureNumber(source, key) {
  const value = source?.[key];
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function createLevelEntitySignature(entity) {
  return {
    id: typeof entity?.id === "string" ? entity.id : "",
    x: getLevelSignatureNumber(entity, "x"),
    y: getLevelSignatureNumber(entity, "y"),
    width: getLevelSignatureNumber(entity, "width"),
    height: getLevelSignatureNumber(entity, "height"),
  };
}

function createLevelStateSignature(run) {
  const signature = {};
  LEVEL_STATE_KEYS.forEach((key) => {
    signature[key] = (Array.isArray(run?.[key]) ? run[key] : [])
      .map((entity) => createLevelEntitySignature(entity));
  });
  return signature;
}

function levelStateSignatureMatches(run, savedState) {
  if (!savedState?.__levelSignature) {
    return false;
  }
  return JSON.stringify(savedState.__levelSignature) === JSON.stringify(createLevelStateSignature(run));
}

function installLevelRuntimeState(run, data, savedState = null) {
  const fresh = createLevelRuntimeState(data);
  const canUseSavedState = levelStateSignatureMatches(fresh, savedState);
  LEVEL_STATE_KEYS.forEach((key) => {
    run[key] = canUseSavedState && savedState?.[key] ? deepClone(savedState[key]) : fresh[key];
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
  player.lastSafeGroundX = player.x;
  player.lastSafeGroundY = player.y;
  player.vx = 0;
  player.vy = 0;
  player.facing = Math.sign(entrance?.facing ?? player.facing ?? 1) || 1;
  player.onGround = true;
  player.wasOnGround = true;
  player.movementState = MOVEMENT_STATES.GROUNDED;
  player.attackCooldown = 0;
  player.attackWindow = 0;
  player.attackToolActive = false;
  player.attackAirHoldTimer = 0;
  player.attackHits = new Set();
  player.lightActive = false;
  player.dashTimer = 0;
  player.dashWindupTimer = 0;
  player.dashCooldownTimer = 0;
  player.dashDirection = 0;
  player.dashVectorX = 1;
  player.dashVectorY = 0;
  player.dashDistanceScale = 1;
  player.dashStartedAirborne = false;
  player.verticalMomentum = 0;
  player.verticalMomentumTimer = 0;
  player.verticalMomentumStage = 0;
  player.verticalMomentumFlashTimer = 0;
  player.verticalMomentumLastAction = null;
  player.verticalMomentumBoostActive = false;
  player.slideTimer = 0;
  clearAirDashHover(player);
  player.airDashHoverConsumed = false;
  player.hoverActive = false;
  player.hoverBoostActive = false;
  player.wallSliding = false;
  player.wallRunActive = false;
  player.braceHolding = false;
  player.braceHoldWallId = null;
  player.braceHoldDirection = 0;
  player.braceHoldLaunchDirection = 0;
  player.braceHoldSpeed = 0;
  player.braceConsumedWallId = null;
  player.braceCooldownTimer = 0;
  player.braceHoldActive = false;
  player.braceReleaseTimer = 0;
  player.recoilShotTimer = 0;
  player.recoilShotActive = false;
  player.recoilShotAirborne = false;
  player.recoilShotFacing = player.facing || 1;
  player.recoilShotPitch = 0;
  player.recoilCameraTimer = 0;
  player.recoilCameraHoldUntilLanding = false;
  player.recoilCameraReturning = false;
  player.recoilFocusActive = false;
  player.recoilFocusBlend = 0;
  player.weaponReloadHoldConsumed = false;
  player.armSwitchReloadHoldConsumed = false;
  player.recoilJumpChargeActive = false;
  player.recoilJumpChargeFocusSpent = 0;
  player.recoilJumpChargeMultiplier = 1;
  player.recoilJumpChargePendingMultiplier = 1;
  player.recoilJumpChargePendingShot = false;
  player.recoilJumpLastDirX = player.facing || 1;
  player.recoilJumpLastDirY = 0;
  player.recoilJumpChargeEffectStep = 0;
  clearZipLine(player);
  run.waterRespawnPoint = {
    levelId: run.currentLevelId || data.currentLevelId || data.defaultLevelId || "movement-lab-01",
    x: player.x,
    y: player.y,
    facing: player.facing || 1,
  };
}

function clearLevelTransitionEffects(run) {
  run.npcDialogue = {
    active: false,
    placementId: "",
    npcId: "",
    nodeId: "",
    line: "",
    choices: [],
    choiceIndex: 0,
    timerSeconds: 6,
    timerElapsed: 0,
    timeoutChoiceId: "",
    timeoutChoice: null,
    completed: false,
    completedAt: 0,
    postAction: null,
    pendingRouteExit: null,
  };
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
  run.screenShakeTimer = 0;
  run.screenShakeIntensity = 0;
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
  const config = getEffectiveCameraConfig(data, run);
  const zoom = clamp(config.zoom ?? run.cameraZoom ?? 1, CAMERA_ABSOLUTE_ZOOM_MIN, CAMERA_ABSOLUTE_ZOOM_MAX);
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
  run.cameraY = clamp(targetY, Math.min(0, targetY), maxY);
  run.cameraTargetX = targetX;
  run.cameraTargetY = targetY;
  run.cameraTargetZoom = zoom;
  run.cameraLookDirection = run.player.facing || 1;
  run.cameraLookAhead = 0;
  run.cameraDownLookAhead = 0;
  run.cameraSpeedRatio = 0;
  clearSpeedCameraState(run);
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

function getShelterScriptedEvents(data) {
  return Array.isArray(data.shelter?.events)
    ? data.shelter.events.filter((event) => event && typeof event === "object" && typeof event.id === "string")
    : [];
}

function getShelterScriptedEvent(data, eventId) {
  return getShelterScriptedEvents(data).find((event) => event.id === eventId) || null;
}

function getShelterScriptedEventNode(event, nodeId = "") {
  const nodes = Array.isArray(event?.nodes) ? event.nodes : [];
  const targetId = nodeId || event?.startNodeId || nodes[0]?.id || "";
  return nodes.find((node) => node && typeof node === "object" && node.id === targetId) || nodes[0] || null;
}

function getShelterEventCompletionFlag(event) {
  return event?.completionFlag || (event?.id ? `shelter-event:${event.id}` : "");
}

function getShelterEventBridgeConfig(event) {
  const transition = event?.transition && typeof event.transition === "object" ? event.transition : {};
  const node = getShelterScriptedEventNode(event, event?.startNodeId);
  const line = String(transition.line || event?.transitionLine || event?.bridgeLine || "").trim();
  const rawDuration = Number(transition.seconds ?? event?.transitionSeconds ?? event?.bridgeSeconds);
  const duration = Number.isFinite(rawDuration)
    ? clamp(rawDuration, 0.45, 3)
    : SHELTER_EVENT_BRIDGE_SECONDS;
  return {
    line,
    duration,
    emotion: normalizeShelterTalkEmotion(
      transition.emotion || event?.transitionEmotion,
      normalizeShelterTalkEmotion(node?.emotion, normalizeShelterTalkEmotion(event?.emotion, "neutral")),
    ),
    artAssetKey: normalizeShelterArtAssetKey(transition.backgroundAssetKey)
      || normalizeShelterArtAssetKey(transition.artAssetKey)
      || normalizeShelterArtAssetKey(event?.transitionAssetKey)
      || getShelterEventStartArtAssetKey(event, node),
  };
}

function hasMetaStoryFlag(state, flag) {
  return Boolean(flag && Array.isArray(state?.meta?.storyFlags) && state.meta.storyFlags.includes(flag));
}

function addMetaStoryFlag(state, flag) {
  if (!flag) {
    return false;
  }
  state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
  state.meta.storyFlags = Array.isArray(state.meta.storyFlags) ? state.meta.storyFlags : [];
  if (state.meta.storyFlags.includes(flag)) {
    return false;
  }
  state.meta.storyFlags.push(flag);
  return true;
}

function canStartShelterScriptedEvent(state, event) {
  if (!event?.id) {
    return false;
  }
  const trigger = event.trigger && typeof event.trigger === "object" ? event.trigger : {};
  const completionFlag = getShelterEventCompletionFlag(event);
  if (event.once !== false && hasMetaStoryFlag(state, completionFlag)) {
    return false;
  }
  if (trigger.requiredStoryFlag && !hasMetaStoryFlag(state, trigger.requiredStoryFlag)) {
    return false;
  }
  if (trigger.missingStoryFlag && hasMetaStoryFlag(state, trigger.missingStoryFlag)) {
    return false;
  }
  return true;
}

function getNextShelterScriptedEvent(state, data) {
  return getShelterScriptedEvents(data).find((event) => canStartShelterScriptedEvent(state, event)) || null;
}

function getNextAutoShelterScriptedEvent(state, data) {
  return getShelterScriptedEvents(data).find((event) => {
    const trigger = event.trigger && typeof event.trigger === "object" ? event.trigger : {};
    return trigger.autoStart === true && canStartShelterScriptedEvent(state, event);
  }) || null;
}

function normalizeShelterAutoEventBridge(host) {
  const bridge = host?.autoEventBridge;
  if (!bridge || typeof bridge !== "object" || !bridge.eventId) {
    if (host && bridge) {
      host.autoEventBridge = null;
    }
    return null;
  }
  bridge.line = String(bridge.line || "").trim();
  bridge.duration = Number.isFinite(bridge.duration)
    ? clamp(Number(bridge.duration), 0.45, 3)
    : SHELTER_EVENT_BRIDGE_SECONDS;
  bridge.startedAt = Number.isFinite(bridge.startedAt) ? Number(bridge.startedAt) : 0;
  bridge.emotion = normalizeShelterTalkEmotion(bridge.emotion, "neutral");
  bridge.artAssetKey = normalizeShelterArtAssetKey(bridge.artAssetKey);
  return bridge;
}

function beginShelterAutoEventBridge(host, state, event) {
  if (!host || !event?.id) {
    return false;
  }
  const bridge = getShelterEventBridgeConfig(event);
  if (!bridge.line) {
    return false;
  }
  host.autoEventBridge = {
    eventId: event.id,
    line: bridge.line,
    duration: bridge.duration,
    startedAt: Number.isFinite(state?.pulse) ? state.pulse : 0,
    emotion: bridge.emotion,
    artAssetKey: bridge.artAssetKey,
    voiceLineKey: "",
  };
  return true;
}

function stepShelterAutoEventBridge(talk, state, data, host) {
  const bridge = normalizeShelterAutoEventBridge(host);
  if (!bridge) {
    return "none";
  }
  const event = getShelterScriptedEvent(data, bridge.eventId);
  if (!event || !canStartShelterScriptedEvent(state, event)) {
    host.autoEventBridge = null;
    return "none";
  }
  const bridgeDuration = Math.max(
    bridge.duration,
    getShelterLineTypeDuration(bridge.line) + 0.2,
  );
  const elapsed = Math.max(0, (Number.isFinite(state?.pulse) ? state.pulse : 0) - bridge.startedAt);
  const skip = consumeEitherPress(state, SHELTER_TALK_CONFIRM_KEYS);
  if (!skip) {
    playShelterBridgeVoiceLine(bridge, state);
    updateShelterBridgeTypingSound(bridge, state);
  }
  if (elapsed < bridgeDuration && !skip) {
    setStatus(state, "Shelter scene.");
    return "bridging";
  }
  host.autoEventBridge = null;
  stopTtsPlayback();
  talk.blockScriptedEventStart = false;
  return startShelterScriptedEvent(talk, event, state) ? "started" : "none";
}

function normalizeShelterTalkEmotion(emotion, fallback = "neutral") {
  return SHELTER_TALK_EMOTIONS.has(emotion) ? emotion : fallback;
}

function normalizeShelterArtAssetKey(assetKey = "") {
  return typeof assetKey === "string" ? assetKey.trim() : "";
}

function getShelterDialogueArtAssetKey(emotion, fallbackAssetKey = "") {
  const fallback = normalizeShelterArtAssetKey(fallbackAssetKey);
  if (fallback && !SHELTER_HOME_BASE_ART_ASSET_KEYS.has(fallback)) {
    return fallback;
  }
  const emotionKey = normalizeShelterArtAssetKey(
    SHELTER_HOME_EMOTION_ART_ASSETS[normalizeShelterTalkEmotion(emotion, "neutral")],
  );
  return emotionKey || fallback;
}

function getShelterDialogueSegments(text = "") {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isShelterScriptedTalk(talk) {
  return Boolean(talk?.event?.eventId || talk?.lastChoice?.eventId || talk?.eventArtAssetKey);
}

function getShelterPulseTime(state) {
  return Number.isFinite(state?.pulse) ? state.pulse : 0;
}

function normalizeShelterTalkTransition(talk) {
  const transition = talk?.transition;
  if (!transition || typeof transition !== "object") {
    return null;
  }
  const direction = transition.direction === "out" ? "out" : "in";
  transition.direction = direction;
  transition.startedAt = Number.isFinite(transition.startedAt) ? Number(transition.startedAt) : 0;
  transition.duration = Number.isFinite(transition.duration)
    ? clamp(Number(transition.duration), 0.2, 1.4)
    : SHELTER_TALK_DOOR_TRANSITION_SECONDS;
  return transition;
}

function beginShelterTalkTransition(talk, state = null, direction = "in") {
  if (!talk) {
    return;
  }
  talk.transition = {
    direction: direction === "out" ? "out" : "in",
    startedAt: getShelterPulseTime(state),
    duration: SHELTER_TALK_DOOR_TRANSITION_SECONDS,
  };
}

function updateShelterTalkTransition(talk, state = null) {
  const transition = normalizeShelterTalkTransition(talk);
  if (!transition) {
    return "none";
  }
  const elapsed = Math.max(0, getShelterPulseTime(state) - transition.startedAt);
  if (elapsed < transition.duration) {
    setStatus(state, "Shelter scene.");
    return "running";
  }
  const direction = transition.direction;
  talk.transition = null;
  return direction === "out" ? "exit-complete" : "done";
}

function markShelterLineShown(talk, state = null) {
  if (talk) {
    talk.lineShownAt = getShelterPulseTime(state);
  }
}

function resetShelterLineProgress(talk, state = null) {
  if (talk) {
    talk.lineIndex = 0;
    talk.typingSound = null;
    talk.voiceLineKey = "";
    markShelterLineShown(talk, state);
  }
}

function canAdvanceShelterLine(talk) {
  if (!isShelterScriptedTalk(talk) || talk?.pending) {
    return false;
  }
  const segments = getShelterDialogueSegments(talk.line);
  const lineIndex = clamp(Math.floor(talk.lineIndex || 0), 0, Math.max(0, segments.length - 1));
  return segments.length > 1 && lineIndex < segments.length - 1;
}

function advanceShelterLine(talk, state = null) {
  if (!canAdvanceShelterLine(talk)) {
    return false;
  }
  const segments = getShelterDialogueSegments(talk.line);
  talk.lineIndex = clamp(Math.floor(talk.lineIndex || 0) + 1, 0, Math.max(0, segments.length - 1));
  talk.typingSound = null;
  markShelterLineShown(talk, state);
  playShelterCurrentVoiceLine(talk, state);
  return true;
}

function isShelterLineComplete(talk) {
  if (!isShelterScriptedTalk(talk)) {
    return true;
  }
  const segments = getShelterDialogueSegments(talk.line);
  const lineIndex = clamp(Math.floor(talk.lineIndex || 0), 0, Math.max(0, segments.length - 1));
  return lineIndex >= segments.length - 1;
}

function getShelterCurrentLineAge(talk, state = null) {
  const shownAt = Number.isFinite(talk?.lineShownAt) ? talk.lineShownAt : -999;
  return Math.max(0, getShelterPulseTime(state) - shownAt);
}

function getShelterCurrentDialogueSegment(talk) {
  const segments = getShelterDialogueSegments(talk?.line || "");
  if (!segments.length) {
    return "";
  }
  const lineIndex = clamp(Math.floor(talk?.lineIndex || 0), 0, Math.max(0, segments.length - 1));
  return segments[lineIndex] || segments[0] || "";
}

function extractShelterQuotedDialogue(line = "") {
  const text = String(line || "").trim();
  if (!text) {
    return "";
  }
  const matches = [];
  const quotePattern = /[“"「『‘']([^”"」』’']+)[”"」』’']/gu;
  let match = quotePattern.exec(text);
  while (match) {
    const quoted = String(match[1] || "").trim();
    if (quoted) {
      matches.push(quoted);
    }
    match = quotePattern.exec(text);
  }
  return matches.join(" ").trim();
}

function isShelterScriptedVoiceContext(talk) {
  return Boolean(talk?.event?.eventId || talk?.lastChoice?.eventId || talk?.eventResult);
}

function getShelterCharacterVoiceText(line = "", options = {}) {
  const text = String(line || "").trim();
  if (!text) {
    return "";
  }
  const quoted = extractShelterQuotedDialogue(text);
  if (quoted) {
    return quoted;
  }
  return options.allowUnquoted ? text : "";
}

function getShelterCurrentLineIndex(talk) {
  return clamp(
    Math.floor(talk?.lineIndex || 0),
    0,
    Math.max(0, getShelterDialogueSegments(talk?.line || "").length - 1),
  );
}

function getShelterVoiceLineKey(talk, line, emotion) {
  return [
    "shelter",
    talk?.event?.eventId || "free",
    talk?.event?.nodeId || "",
    talk?.requestId || 0,
    getShelterCurrentLineIndex(talk),
    emotion || talk?.emotion || "neutral",
    line,
  ].join("|");
}

function playShelterCurrentVoiceLine(talk, state = null, options = {}) {
  const line = getShelterCurrentDialogueSegment(talk);
  if (!line || talk?.pending || talk?.choiceReaction) {
    return;
  }
  const voiceText = getShelterCharacterVoiceText(line, {
    allowUnquoted: !isShelterScriptedVoiceContext(talk),
  });
  if (!voiceText) {
    return;
  }
  const emotion = normalizeShelterTalkEmotion(talk?.emotion, "neutral");
  const lineKey = getShelterVoiceLineKey(talk, voiceText, emotion);
  if (talk.voiceLineKey === lineKey) {
    return;
  }
  talk.voiceLineKey = lineKey;
  speakShelterLine(voiceText, {
    emotion,
    topic: options.topic || talk?.lastChoice?.intent || "",
    choice: talk?.lastChoice?.label || "",
    eventId: talk?.event?.eventId || "",
    nodeId: talk?.event?.nodeId || "",
    lineIndex: getShelterCurrentLineIndex(talk),
    startedAt: getShelterPulseTime(state),
  });
}

function playShelterBridgeVoiceLine(bridge, state = null) {
  const line = String(bridge?.line || "").trim();
  if (!line) {
    return;
  }
  const voiceText = getShelterCharacterVoiceText(line, { allowUnquoted: false });
  if (!voiceText) {
    return;
  }
  const emotion = normalizeShelterTalkEmotion(bridge?.emotion, "neutral");
  const lineKey = `bridge|${bridge?.eventId || ""}|${emotion}|${voiceText}`;
  if (bridge.voiceLineKey === lineKey) {
    return;
  }
  bridge.voiceLineKey = lineKey;
  speakShelterLine(voiceText, {
    emotion,
    eventId: bridge?.eventId || "",
    topic: "bridge",
    startedAt: getShelterPulseTime(state),
  });
}

function getShelterLineTypeDuration(line) {
  const length = Array.from(String(line || "").trim()).length;
  if (!length) {
    return 0;
  }
  return clamp(
    length / getShelterSubtitleCharsPerSecond(),
    SHELTER_SUBTITLE_TYPE_MIN_SECONDS,
    SHELTER_SUBTITLE_TYPE_MAX_SECONDS,
  );
}

function getShelterCurrentLineTypeProgress(talk, state = null) {
  if (!isShelterScriptedTalk(talk) || talk?.pending) {
    return 1;
  }
  const duration = getShelterLineTypeDuration(getShelterCurrentDialogueSegment(talk));
  if (duration <= 0) {
    return 1;
  }
  return clamp(getShelterCurrentLineAge(talk, state) / duration, 0, 1);
}

function updateShelterTalkTypingSound(talk, state = null) {
  if (!isShelterScriptedTalk(talk) || talk?.pending || talk?.choiceReaction || normalizeShelterTalkTransition(talk)) {
    return;
  }
  const line = getShelterCurrentDialogueSegment(talk);
  const duration = getShelterLineTypeDuration(line);
  if (!line || duration <= 0) {
    return;
  }
  const lineIndex = clamp(Math.floor(talk?.lineIndex || 0), 0, Math.max(0, getShelterDialogueSegments(talk.line).length - 1));
  const progress = clamp(getShelterCurrentLineAge(talk, state) / duration, 0, 1);
  const lineKey = `talk:${talk.requestId || 0}:${lineIndex}:${line}`;
  updateShelterTypingSoundForLine(talk, line, progress, talk.emotion, lineKey);
}

function updateShelterBridgeTypingSound(bridge, state = null) {
  const line = String(bridge?.line || "").trim();
  const duration = getShelterLineTypeDuration(line);
  if (!line || duration <= 0) {
    return;
  }
  const startedAt = Number.isFinite(bridge?.startedAt) ? bridge.startedAt : getShelterPulseTime(state);
  const progress = clamp((getShelterPulseTime(state) - startedAt) / duration, 0, 1);
  const lineKey = `bridge:${bridge.eventId || ""}:${startedAt}:${line}`;
  updateShelterTypingSoundForLine(bridge, line, progress, bridge.emotion, lineKey);
}

function isShelterCurrentLineTypedComplete(talk, state = null) {
  return getShelterCurrentLineTypeProgress(talk, state) >= 1;
}

function completeShelterCurrentLineTyping(talk, state = null) {
  if (!isShelterScriptedTalk(talk) || !talk) {
    return false;
  }
  const duration = getShelterLineTypeDuration(getShelterCurrentDialogueSegment(talk));
  talk.lineShownAt = getShelterPulseTime(state) - duration;
  return true;
}

function isShelterChoiceRevealReady(talk, state = null) {
  if (!isShelterScriptedTalk(talk)) {
    return true;
  }
  const currentLineTypeDuration = getShelterLineTypeDuration(getShelterCurrentDialogueSegment(talk));
  return isShelterLineComplete(talk)
    && isShelterCurrentLineTypedComplete(talk, state)
    && getShelterCurrentLineAge(talk, state) >= currentLineTypeDuration + SHELTER_CHOICE_REVEAL_DELAY_SECONDS;
}

function canSelectShelterTalkChoice(talk, state = null) {
  if (!isShelterScriptedTalk(talk)) {
    return true;
  }
  return Boolean(talk?.event?.eventId)
    && !talk?.choiceReaction
    && isShelterChoiceRevealReady(talk, state);
}

function getShelterEventStartArtAssetKey(event, node = null) {
  return normalizeShelterArtAssetKey(node?.backgroundAssetKey)
    || normalizeShelterArtAssetKey(node?.artAssetKey)
    || normalizeShelterArtAssetKey(event?.backgroundAssetKey)
    || normalizeShelterArtAssetKey(event?.artAssetKey);
}

function getShelterChoiceReplyArtAssetKey(choice) {
  return normalizeShelterArtAssetKey(choice?.backgroundAssetKey)
    || normalizeShelterArtAssetKey(choice?.artAssetKey);
}

function normalizeShelterEventChoice(choice, event) {
  if (!choice || typeof choice !== "object") {
    return null;
  }
  const label = String(choice.label || "").trim();
  if (!label) {
    return null;
  }
  return {
    ...choice,
    label,
    intent: String(choice.intent || event?.title || event?.id || "scripted shelter event"),
    reply: String(choice.reply || "").trim(),
    emotion: normalizeShelterTalkEmotion(choice.emotion, normalizeShelterTalkEmotion(event?.emotion, "neutral")),
    eventId: event?.id || "",
  };
}

function getShelterActiveEventNode(data, talk) {
  const eventId = talk?.event?.eventId || "";
  const event = getShelterScriptedEvent(data, eventId);
  if (!event) {
    return null;
  }
  return {
    event,
    node: getShelterScriptedEventNode(event, talk.event.nodeId),
  };
}

function getShelterEventChoices(data, talk) {
  const active = getShelterActiveEventNode(data, talk);
  if (!active?.node) {
    return null;
  }
  const choices = Array.isArray(active.node.choices)
    ? active.node.choices.map((choice) => normalizeShelterEventChoice(choice, active.event)).filter(Boolean)
    : [];
  return choices.length ? choices.slice(0, 3) : null;
}

function startShelterScriptedEvent(talk, event, state = null) {
  const node = getShelterScriptedEventNode(event, event?.startNodeId);
  if (!event?.id || !node) {
    return false;
  }
  talk.event = {
    eventId: event.id,
    nodeId: node.id,
  };
  talk.line = String(node.line || event.title || "").trim() || "……";
  talk.emotion = normalizeShelterTalkEmotion(node.emotion, normalizeShelterTalkEmotion(event.emotion, "neutral"));
  talk.eventBaseArtAssetKey = getShelterEventStartArtAssetKey(event, node);
  talk.eventArtAssetKey = getShelterDialogueArtAssetKey(talk.emotion, talk.eventBaseArtAssetKey);
  talk.lastChoice = null;
  talk.reaction = null;
  talk.choiceReaction = null;
  talk.eventResult = null;
  talk.pending = false;
  talk.blockScriptedEventStart = false;
  resetShelterLineProgress(talk, state);
  playShelterCurrentVoiceLine(talk, state, { topic: event.title || event.id || "" });
  return true;
}

function prepareShelterScriptedEvent(talk, state, data) {
  if (!talk || !state || !data) {
    return false;
  }
  if (talk.event?.eventId && getShelterActiveEventNode(data, talk)?.node) {
    return true;
  }
  talk.event = null;
  if (talk.blockScriptedEventStart) {
    return false;
  }
  const event = getNextShelterScriptedEvent(state, data);
  return event ? startShelterScriptedEvent(talk, event, state) : false;
}

function prepareShelterAutoEvent(talk, state, data) {
  return updateShelterAutoEvent(talk, state, data) === "started";
}

function updateShelterAutoEvent(talk, state, data, bridgeHost = null) {
  if (!talk || !state || !data || talk.event?.eventId) {
    return "none";
  }
  if (talk.blockScriptedEventStart) {
    return "none";
  }
  if (bridgeHost) {
    const bridgeState = stepShelterAutoEventBridge(talk, state, data, bridgeHost);
    if (bridgeState !== "none") {
      return bridgeState;
    }
  }
  const event = getNextAutoShelterScriptedEvent(state, data);
  if (!event) {
    return "none";
  }
  if (bridgeHost && beginShelterAutoEventBridge(bridgeHost, state, event)) {
    setStatus(state, "Shelter scene.");
    return "bridging";
  }
  return startShelterScriptedEvent(talk, event, state) ? "started" : "none";
}

function applyShelterEventChoiceEffects(state, data, playerChoice) {
  if (!state || !playerChoice?.eventId) {
    return false;
  }
  let changed = false;
  const effects = playerChoice.effects && typeof playerChoice.effects === "object" ? playerChoice.effects : {};
  if (Number.isFinite(effects.trust)) {
    state.meta = state.meta && typeof state.meta === "object" ? state.meta : {};
    state.meta.trust = clamp(Number(state.meta.trust || 0) + effects.trust, -1, 1);
    changed = true;
  }
  if (Array.isArray(effects.storyFlags)) {
    effects.storyFlags.forEach((flag) => {
      changed = addMetaStoryFlag(state, String(flag || "")) || changed;
    });
  }

  const event = getShelterScriptedEvent(data, playerChoice.eventId);
  if (event && playerChoice.endEvent !== false && !playerChoice.nextNodeId) {
    changed = addMetaStoryFlag(state, getShelterEventCompletionFlag(event)) || changed;
  }
  if (changed) {
    saveMetaState(state.meta);
  }
  return changed;
}

function createShelterEventResult(playerChoice, event) {
  if (!playerChoice?.eventId || !event) {
    return null;
  }
  const effects = playerChoice.effects && typeof playerChoice.effects === "object" ? playerChoice.effects : {};
  const lines = [];
  if (Number.isFinite(effects.trust) && Number(effects.trust) !== 0) {
    const trustDelta = Math.round(Number(effects.trust) * 100);
    lines.push(`신뢰도 ${trustDelta > 0 ? "+" : ""}${trustDelta}`);
  }
  const recordsUpdated = playerChoice.endEvent !== false
    || (Array.isArray(effects.storyFlags) && effects.storyFlags.length > 0);
  if (recordsUpdated) {
    lines.push("기록 갱신");
  }
  if (!lines.length) {
    lines.push("변화 없음");
  }
  return {
    title: "대화 종료",
    lines,
    choiceLabel: typeof playerChoice.label === "string" ? playerChoice.label : "",
  };
}

function isShelterEventResultReady(talk, state = null) {
  const currentLineTypeDuration = getShelterLineTypeDuration(getShelterCurrentDialogueSegment(talk));
  return Boolean(talk?.eventResult)
    && !talk.pending
    && !talk.choiceReaction
    && isShelterLineComplete(talk)
    && isShelterCurrentLineTypedComplete(talk, state)
    && getShelterCurrentLineAge(talk, state) >= currentLineTypeDuration + 0.24;
}

function beginShelterTalkExit(talk, state = null) {
  if (!talk) {
    return;
  }
  stopTtsPlayback();
  talk.pending = false;
  talk.choiceReaction = null;
  beginShelterTalkTransition(talk, state, "out");
  setStatus(state, "Shelter scene.");
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
    return "night";
  }
  if (run?.timePhase === "dusk") {
    return "dusk";
  }
  return "day";
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
    talk: {
      requestId: 0,
      pending: false,
      topicIndex: 0,
      line: "",
      history: [],
      choices: [],
      choiceIndex: 0,
      lastChoice: null,
      reaction: null,
      error: "",
      lineIndex: 0,
      lineShownAt: 0,
      choiceReaction: null,
      transition: null,
      eventResult: null,
      blockScriptedEventStart: false,
    },
    autoEventBridge: null,
    recordsIndex: 0,
    backgroundIndex: 0,
  };
}

function ensureShelterTalkState(rest) {
  rest.talk = rest.talk && typeof rest.talk === "object" ? rest.talk : {};
  rest.talk.requestId = Number.isFinite(rest.talk.requestId) ? rest.talk.requestId : 0;
  rest.talk.pending = Boolean(rest.talk.pending);
  rest.talk.topicIndex = Number.isFinite(rest.talk.topicIndex) ? Math.max(0, Math.floor(rest.talk.topicIndex)) : 0;
  rest.talk.line = typeof rest.talk.line === "string" ? rest.talk.line : "";
  rest.talk.history = Array.isArray(rest.talk.history) ? rest.talk.history.slice(-SHELTER_TALK_HISTORY_LIMIT) : [];
  rest.talk.choices = Array.isArray(rest.talk.choices) ? rest.talk.choices.slice(0, 3) : [];
  rest.talk.choiceIndex = Number.isFinite(rest.talk.choiceIndex) ? clamp(Math.floor(rest.talk.choiceIndex), 0, Math.max(0, rest.talk.choices.length - 1)) : 0;
  rest.talk.lastChoice = rest.talk.lastChoice && typeof rest.talk.lastChoice === "object" ? rest.talk.lastChoice : null;
  rest.talk.reaction = rest.talk.reaction && typeof rest.talk.reaction === "object" ? rest.talk.reaction : null;
  rest.talk.error = typeof rest.talk.error === "string" ? rest.talk.error : "";
  rest.talk.emotion = typeof rest.talk.emotion === "string" ? rest.talk.emotion : "neutral";
  rest.talk.lineIndex = Number.isFinite(rest.talk.lineIndex) ? Math.max(0, Math.floor(rest.talk.lineIndex)) : 0;
  rest.talk.lineShownAt = Number.isFinite(rest.talk.lineShownAt) ? Number(rest.talk.lineShownAt) : 0;
  rest.talk.choiceReaction = rest.talk.choiceReaction && typeof rest.talk.choiceReaction === "object" ? rest.talk.choiceReaction : null;
  rest.talk.transition = rest.talk.transition && typeof rest.talk.transition === "object" ? rest.talk.transition : null;
  rest.talk.eventResult = rest.talk.eventResult && typeof rest.talk.eventResult === "object" ? rest.talk.eventResult : null;
  rest.talk.event = rest.talk.event && typeof rest.talk.event === "object" ? rest.talk.event : null;
  rest.talk.eventBaseArtAssetKey = normalizeShelterArtAssetKey(rest.talk.eventBaseArtAssetKey);
  rest.talk.eventArtAssetKey = normalizeShelterArtAssetKey(rest.talk.eventArtAssetKey);
  rest.talk.voiceLineKey = typeof rest.talk.voiceLineKey === "string" ? rest.talk.voiceLineKey : "";
  rest.talk.blockScriptedEventStart = Boolean(rest.talk.blockScriptedEventStart);
  return rest.talk;
}

function getShelterTalkChoices(talk, state = null, data = null) {
  if (state && data) {
    prepareShelterScriptedEvent(talk, state, data);
  }
  const eventChoices = data ? getShelterEventChoices(data, talk) : null;
  if (eventChoices) {
    return eventChoices;
  }
  const start = (Math.floor(talk.topicIndex || 0) + Math.floor(talk.requestId || 0)) % SHELTER_TALK_CHOICES.length;
  return [0, 1, 2].map((offset) => SHELTER_TALK_CHOICES[(start + offset) % SHELTER_TALK_CHOICES.length]);
}

function prepareShelterTalkChoices(talk, state = null, data = null) {
  talk.choices = getShelterTalkChoices(talk, state, data);
  talk.choiceIndex = clamp(Math.floor(talk.choiceIndex || 0), 0, Math.max(0, talk.choices.length - 1));
  if (!talk.line) {
    talk.line = "……말해도 돼. 듣고 있어.";
  }
}

function inferShelterTalkEmotion(text = "", playerChoice = null) {
  const source = `${playerChoice?.label || ""} ${playerChoice?.intent || ""} ${text || ""}`;
  if (/무서|두려|불안|가지 마|곁에|버려|혼자|떨|신호가 흐려|이어지지/.test(source)) {
    return "anxious";
  }
  if (/아버지|그리|기억|이름|사람이었|병기|왜 계속|모르겠/.test(source)) {
    return "tired";
  }
  if (/괜찮|고마|덜 무서|믿|옆에|따뜻|쉬|안도|좋아/.test(source)) {
    return "warm";
  }
  if (/망가|아파|상처|피|파손|고장|죽|닳/.test(source)) {
    return "hurt";
  }
  if (/도망치지|선택|지킬|명령|위험|전투|원인|가야/.test(source)) {
    return "angry";
  }
  return "neutral";
}

function getSelectedShelterTalkChoice(talk, state = null, data = null) {
  prepareShelterTalkChoices(talk, state, data);
  return talk.choices[clamp(Math.floor(talk.choiceIndex || 0), 0, talk.choices.length - 1)] || talk.choices[0] || null;
}

function getShelterChoiceReply(playerChoice, talk) {
  if (!playerChoice) {
    return "……말해도 돼. 듣고 있어.";
  }
  if (Array.isArray(playerChoice.replies) && playerChoice.replies.length) {
    const index = Math.abs(Math.floor(talk?.requestId || 0)) % playerChoice.replies.length;
    return String(playerChoice.replies[index] || "").trim();
  }
  if (playerChoice.nextNodeId && !String(playerChoice.reply || "").trim()) {
    return "";
  }
  return String(playerChoice.reply || "").trim() || "응. 들었어. 그 말은 놓치지 않을게.";
}

function getShelterChoiceEmotion(playerChoice, reply = "") {
  const emotion = typeof playerChoice?.emotion === "string" ? playerChoice.emotion : "";
  return ["neutral", "anxious", "warm", "tired", "hurt", "angry"].includes(emotion)
    ? emotion
    : inferShelterTalkEmotion(reply, playerChoice);
}

function getShelterChoiceDisplay(talk, playerChoice, data = null) {
  const reply = getShelterChoiceReply(playerChoice, talk);
  const emotion = getShelterChoiceEmotion(playerChoice, reply);
  const event = playerChoice?.eventId ? getShelterScriptedEvent(data, playerChoice.eventId) : null;
  const nextNode = playerChoice?.nextNodeId ? getShelterScriptedEventNode(event, playerChoice.nextNodeId) : null;
  const nextNodeLine = String(nextNode?.line || "").trim();
  const showNextNode = Boolean(nextNode && !reply && nextNodeLine);
  const displayLine = showNextNode ? nextNodeLine : reply;
  const displayEmotion = showNextNode
    ? normalizeShelterTalkEmotion(nextNode.emotion, emotion)
    : emotion;
  const inheritedArtAssetKey = normalizeShelterArtAssetKey(talk?.eventBaseArtAssetKey)
    || normalizeShelterArtAssetKey(talk?.eventArtAssetKey)
    || getShelterEventStartArtAssetKey(event, nextNode);
  const baseArtAssetKey = showNextNode
    ? (getShelterEventStartArtAssetKey(event, nextNode) || inheritedArtAssetKey)
    : inheritedArtAssetKey;
  const eventArtAssetKey = getShelterChoiceReplyArtAssetKey(playerChoice)
    || getShelterDialogueArtAssetKey(displayEmotion, baseArtAssetKey);
  return {
    reply,
    emotion,
    event,
    nextNode,
    showNextNode,
    displayLine,
    displayEmotion,
    eventArtAssetKey,
  };
}

function normalizeShelterChoiceReaction(talk) {
  const reaction = talk?.choiceReaction;
  if (!reaction || typeof reaction !== "object" || !reaction.playerChoice) {
    if (talk && reaction) {
      talk.choiceReaction = null;
    }
    return null;
  }
  reaction.duration = Number.isFinite(reaction.duration)
    ? clamp(Number(reaction.duration), 0.18, 1.4)
    : SHELTER_CHOICE_REACTION_SECONDS;
  reaction.startedAt = Number.isFinite(reaction.startedAt) ? reaction.startedAt : 0;
  reaction.topic = typeof reaction.topic === "string" ? reaction.topic : "";
  return reaction;
}

function beginShelterChoiceReaction(talk, playerChoice, topic = "", state = null, data = null) {
  if (!talk || !playerChoice?.eventId) {
    return false;
  }
  stopTtsPlayback();
  const display = getShelterChoiceDisplay(talk, playerChoice, data);
  const event = display.event;
  const rawDuration = Number(event?.choiceReactionSeconds ?? playerChoice.choiceReactionSeconds);
  const duration = Number.isFinite(rawDuration)
    ? clamp(rawDuration, 0.18, 1.4)
    : SHELTER_CHOICE_REACTION_SECONDS;
  talk.choiceReaction = {
    playerChoice,
    topic,
    startedAt: getShelterPulseTime(state),
    duration,
  };
  talk.pending = true;
  talk.error = "";
  talk.eventResult = null;
  talk.lastChoice = playerChoice;
  talk.emotion = display.displayEmotion;
  talk.eventArtAssetKey = display.eventArtAssetKey || talk.eventArtAssetKey;
  talk.reaction = {
    emotion: display.displayEmotion,
    startedAt: getShelterPulseTime(state),
    requestId: talk.requestId,
    choice: playerChoice?.label || "",
  };
  return true;
}

function stepShelterChoiceReaction(talk, state = null, data = null) {
  const reaction = normalizeShelterChoiceReaction(talk);
  if (!reaction) {
    return false;
  }
  const elapsed = Math.max(0, getShelterPulseTime(state) - reaction.startedAt);
  if (elapsed < reaction.duration) {
    setStatus(state, "Shelter scene.");
    return true;
  }
  const playerChoice = reaction.playerChoice;
  const topic = reaction.topic;
  talk.choiceReaction = null;
  commitShelterChoiceReply(talk, playerChoice, topic, state, data);
  return true;
}

function commitShelterChoiceReply(talk, playerChoice, topic = "", state = null, data = null) {
  const display = getShelterChoiceDisplay(talk, playerChoice, data);
  const { event, nextNode, displayLine, displayEmotion, eventArtAssetKey } = display;
  talk.pending = false;
  talk.error = "";
  talk.line = displayLine;
  talk.lastChoice = playerChoice;
  talk.emotion = displayEmotion;
  talk.choiceReaction = null;
  talk.eventResult = null;
  resetShelterLineProgress(talk, state);
  talk.eventArtAssetKey = eventArtAssetKey;
  talk.reaction = {
    emotion: displayEmotion,
    startedAt: getShelterPulseTime(state),
    requestId: talk.requestId,
    choice: playerChoice?.label || "",
  };
  if (playerChoice?.eventId) {
    applyShelterEventChoiceEffects(state, data, playerChoice);
    if (playerChoice.nextNodeId) {
      talk.event = {
        eventId: playerChoice.eventId,
        nodeId: playerChoice.nextNodeId,
      };
      talk.eventBaseArtAssetKey = getShelterEventStartArtAssetKey(event, nextNode) || talk.eventBaseArtAssetKey;
      talk.eventArtAssetKey = talk.eventArtAssetKey || getShelterEventStartArtAssetKey(event, nextNode);
    } else if (playerChoice.endEvent !== false) {
      talk.event = null;
      talk.blockScriptedEventStart = true;
      talk.eventResult = createShelterEventResult(playerChoice, event);
    }
  }
  if (playerChoice?.label) {
    talk.history.push({ speaker: "drone", text: playerChoice.label });
  }
  if (displayLine) {
    talk.history.push({ speaker: "shelter", text: displayLine });
  }
  talk.history = talk.history.slice(-SHELTER_TALK_HISTORY_LIMIT);
  prepareShelterTalkChoices(talk, state, data);
  playShelterCurrentVoiceLine(talk, state, { topic: playerChoice?.intent || topic });
}

function submitShelterChatText() {
  return false;
}

function queueShelterTalkLine(state, data, playerChoice = null) {
  const run = state.run;
  const rest = run?.shelterRest;
  if (!rest?.active) {
    return;
  }
  const talk = ensureShelterTalkState(rest);
  const topic = SHELTER_TALK_TOPICS[talk.topicIndex % SHELTER_TALK_TOPICS.length];
  talk.topicIndex = (talk.topicIndex + 1) % SHELTER_TALK_TOPICS.length;
  talk.requestId += 1;
  if (beginShelterChoiceReaction(talk, playerChoice, topic, state, data)) {
    setStatus(state, "Shelter scene.");
    return;
  }
  commitShelterChoiceReply(talk, playerChoice, topic, state, data);
  setStatus(state, "Shelter talk. W/S choose. Z listen. Esc back.");
}

function ensureHomeShelterTalkState(state) {
  state.shelter = state.shelter && typeof state.shelter === "object" ? state.shelter : {};
  state.shelter.talk = state.shelter.talk && typeof state.shelter.talk === "object" ? state.shelter.talk : {};
  const talk = state.shelter.talk;
  talk.active = Boolean(talk.active);
  talk.requestId = Number.isFinite(talk.requestId) ? talk.requestId : 0;
  talk.pending = Boolean(talk.pending);
  talk.topicIndex = Number.isFinite(talk.topicIndex) ? Math.max(0, Math.floor(talk.topicIndex)) : 0;
  talk.line = typeof talk.line === "string" ? talk.line : "";
  talk.history = Array.isArray(talk.history) ? talk.history.slice(-SHELTER_TALK_HISTORY_LIMIT) : [];
  talk.choices = Array.isArray(talk.choices) ? talk.choices.slice(0, 3) : [];
  talk.choiceIndex = Number.isFinite(talk.choiceIndex) ? clamp(Math.floor(talk.choiceIndex), 0, Math.max(0, talk.choices.length - 1)) : 0;
  talk.lastChoice = talk.lastChoice && typeof talk.lastChoice === "object" ? talk.lastChoice : null;
  talk.reaction = talk.reaction && typeof talk.reaction === "object" ? talk.reaction : null;
  talk.error = typeof talk.error === "string" ? talk.error : "";
  talk.emotion = typeof talk.emotion === "string" ? talk.emotion : "neutral";
  talk.lineIndex = Number.isFinite(talk.lineIndex) ? Math.max(0, Math.floor(talk.lineIndex)) : 0;
  talk.lineShownAt = Number.isFinite(talk.lineShownAt) ? Number(talk.lineShownAt) : 0;
  talk.choiceReaction = talk.choiceReaction && typeof talk.choiceReaction === "object" ? talk.choiceReaction : null;
  talk.transition = talk.transition && typeof talk.transition === "object" ? talk.transition : null;
  talk.eventResult = talk.eventResult && typeof talk.eventResult === "object" ? talk.eventResult : null;
  talk.event = talk.event && typeof talk.event === "object" ? talk.event : null;
  talk.eventBaseArtAssetKey = normalizeShelterArtAssetKey(talk.eventBaseArtAssetKey);
  talk.eventArtAssetKey = normalizeShelterArtAssetKey(talk.eventArtAssetKey);
  talk.voiceLineKey = typeof talk.voiceLineKey === "string" ? talk.voiceLineKey : "";
  talk.blockScriptedEventStart = Boolean(talk.blockScriptedEventStart);
  return talk;
}

function queueHomeShelterTalkLine(state, data, playerChoice = null) {
  const talk = ensureHomeShelterTalkState(state);
  const topic = SHELTER_TALK_TOPICS[talk.topicIndex % SHELTER_TALK_TOPICS.length];
  talk.topicIndex = (talk.topicIndex + 1) % SHELTER_TALK_TOPICS.length;
  talk.active = true;
  talk.requestId += 1;
  if (beginShelterChoiceReaction(talk, playerChoice, topic, state, data)) {
    setStatus(state, "Shelter scene.");
    return;
  }
  commitShelterChoiceReply(talk, playerChoice, topic, state, data);
  setStatus(state, "Shelter talk. W/S choose. Z listen. Esc back.");
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
  run.heatFailureNotified = false;
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
  if (typeof data.__afterRuntimeLevelLoad === "function") {
    data.__afterRuntimeLevelLoad(data);
  }
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
  playGameSfx("route", { cooldownMs: 200 });
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
    playGameSfx("routeArrive", { cooldownMs: 200 });
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
    talk: {
      requestId: 0,
      pending: false,
      topicIndex: 0,
      line: "",
      history: [],
      choices: [],
      choiceIndex: 0,
      lastChoice: null,
      error: "",
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

function getZipLineTravelFacing(zipLine, direction, fallback = 1) {
  const vector = getZipLineVector(zipLine);
  const travelX = vector.x * (direction || 1);
  return Math.sign(travelX) || Math.sign(fallback) || 1;
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
  const vector = getZipLineVector(zipLine);
  const facing = Math.sign(player.facing) || 1;
  const direction = Math.abs(vector.x) > EPSILON && Math.sign(vector.x) !== facing ? -1 : 1;
  const point = getZipLinePoint(zipLine, progress);
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
  player.facing = getZipLineTravelFacing(zipLine, direction, facing);
  player.sprintActive = true;
  player.sprintCharge = 1;
  player.canInteract = false;
  clearBraceHold(player);
  clearWallRun(player);
  clearHover(player);
  clearRecoilSpin(player);
  playGameSfx("zipStart", { cooldownMs: 160 });
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
    const travelFacing = getZipLineTravelFacing(zipLine, direction, player.facing);
    const exitSpeed = Math.max(player.zipLineSpeed || 0, (config.sprintSpeed ?? config.runSpeed) * 1.05);
    clearZipLine(player);
    player.vx = travelFacing * exitSpeed * 0.62;
    player.vy = config.jumpVelocity ?? data.player.jumpVelocity ?? -900;
    player.onGround = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    player.facing = travelFacing;
    armSprintJumpCarry(player, config);
    spawnParticles(run, player.x + player.width * 0.5, player.y + player.height * 0.35, 10, "#e7f47e");
    playGameSfx("zipExit", { cooldownMs: 120 });
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
  player.y = Math.min(point.y - player.height * 0.38, data.world.height - player.height);
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
      playGameSfx("zipExit", { cooldownMs: 120 });
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
      const intercept = getNpcRouteInterceptPlacement(state, data, routeExit.id);
      if (intercept) {
        return beginNpcDialogue(state, data, intercept, { routeExit });
      }
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

  const nearest = getInteractionTargets(state, run, data);
  if (!nearest) {
    run.lastPromptTargetId = "";
    return;
  }

  run.prompt = nearest.text;
  run.promptWorld = { x: nearest.x, y: nearest.y };
  const promptTargetId = `${nearest.kind}:${nearest.id || ""}`;
  if (run.lastPromptTargetId !== promptTargetId) {
    run.lastPromptTargetId = promptTargetId;
    playGameSfx("promptFocus", { cooldownMs: 180 });
  }

  if (!canInteract) {
    return;
  }

  if (nearest.kind === "faceOff") {
    const faceOffPressed = consumeEitherPress(state, getFaceOffEntryKeys(state))
      || isEitherPressed(state, getFaceOffEntryKeys(state));
    if (!faceOffPressed) {
      return;
    }
    enterFaceOff(run, data, nearest.enemy, state);
    return;
  }

  const interactPressed = consumeEitherPress(state, getInteractKeys(state));
  if (!interactPressed) {
    return;
  }

  if (nearest.kind === "extract") {
    playGameSfx("extractConfirm", { cooldownMs: 220 });
    applyExtraction(state, data);
    return;
  }

  if (nearest.kind === "escapeExit") {
    if (run.vaultEscape) {
      run.vaultEscape.active = false;
      run.vaultEscape.completed = true;
      run.vaultEscape.lockdownActive = false;
      run.vaultEscape.lockdownTimer = 0;
    }
    pushNotice(run, "Escaped before lockdown.");
    playGameSfx("extractConfirm", { cooldownMs: 220 });
    applyExtraction(state, data);
    return;
  }

  if (nearest.kind === "shelterLocked") {
    playGameSfx("shelterLocked", { cooldownMs: 180 });
    setRunNotice(run, nearest.text, 2);
    setStatus(state, nearest.text);
    return;
  }

  if (nearest.kind === "npc") {
    beginNpcDialogue(state, data, nearest.npcPlacement);
    return;
  }

  if (nearest.kind === "routeExit") {
    const intercept = getNpcRouteInterceptPlacement(state, data, nearest.routeExit?.id);
    if (intercept) {
      beginNpcDialogue(state, data, intercept, { routeExit: nearest.routeExit });
      return;
    }
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

  if (nearest.kind === "vaultDoor") {
    beginVaultEscape(run, nearest.vaultDoor);
    return;
  }

  if (nearest.kind === "vaultLoot") {
    collectVaultLoot(run, nearest.vaultLoot);
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
      playGameSfx("shelterMenuOpen", { cooldownMs: 240 });
      setStatus(state, "?쇰궃泥??湲?");
      const talk = ensureShelterTalkState(rest);
      const autoEventState = updateShelterAutoEvent(talk, state, data, rest);
      if (autoEventState === "started") {
        rest.phase = "talk";
        rest.timer = 0;
        prepareShelterTalkChoices(talk, state, data);
        beginShelterTalkTransition(talk, state, "in");
        setStatus(state, "Shelter talk. W/S choose. Z listen. Esc back.");
      } else if (autoEventState === "bridging") {
        setStatus(state, "Shelter scene.");
      }
      saveCurrentGame(state, data);
    } else {
      setStatus(state, "?쇰궃泥??먯뇙 以?");
    }
    updateAutoSave(state, data, dt);
    return true;
  }

  if (rest.phase === "menu") {
    const talk = ensureShelterTalkState(rest);
    const autoEventState = updateShelterAutoEvent(talk, state, data, rest);
    if (autoEventState === "started") {
      rest.phase = "talk";
      rest.timer = 0;
      prepareShelterTalkChoices(talk, state, data);
      beginShelterTalkTransition(talk, state, "in");
      setStatus(state, "Shelter talk. W/S choose. Z listen. Esc back.");
      updateAutoSave(state, data, dt);
      return true;
    }
    if (autoEventState === "bridging") {
      setStatus(state, "Shelter scene.");
      updateAutoSave(state, data, dt);
      return true;
    }
    if (consumeEitherPress(state, SHELTER_MENU_UP_KEYS)) {
      rest.menuIndex = (Math.max(0, Math.floor(rest.menuIndex || 0)) + SHELTER_MENU_ITEMS.length - 1) % SHELTER_MENU_ITEMS.length;
      playGameSfx("uiMove", { cooldownMs: 50 });
    }
    if (consumeEitherPress(state, SHELTER_MENU_DOWN_KEYS)) {
      rest.menuIndex = (Math.max(0, Math.floor(rest.menuIndex || 0)) + 1) % SHELTER_MENU_ITEMS.length;
      playGameSfx("uiMove", { cooldownMs: 50 });
    }
    if (consumeEitherPress(state, SHELTER_EXIT_KEYS)) {
      playGameSfx("uiBack", { cooldownMs: 120 });
      leaveShelterRest(state, data);
      return true;
    }
    if (consumeEitherPress(state, INTERACT_KEYS) || consumeEitherPress(state, CONFIRM_KEYS)) {
      const item = SHELTER_MENU_ITEMS[clamp(Math.floor(rest.menuIndex || 0), 0, SHELTER_MENU_ITEMS.length - 1)];
      playGameSfx(item === "exit" ? "uiBack" : "uiConfirm", { cooldownMs: 120 });
      if (item === "talk") {
        rest.phase = "talk";
        rest.timer = 0;
        const talk = ensureShelterTalkState(rest);
        talk.blockScriptedEventStart = false;
        prepareShelterTalkChoices(talk, state, data);
        if (!talk.line) {
          talk.line = "……말해도 돼. 듣고 있어.";
        }
        beginShelterTalkTransition(talk, state, "in");
        setStatus(state, "Shelter talk. W/S choose. Z listen. Esc back.");
      } else if (item === "photo") {
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

  if (rest.phase === "talk") {
    const talk = ensureShelterTalkState(rest);
    prepareShelterTalkChoices(talk, state, data);
    const transitionState = updateShelterTalkTransition(talk, state);
    if (transitionState === "running") {
      updateAutoSave(state, data, dt);
      return true;
    }
    if (transitionState === "exit-complete") {
      rest.phase = "menu";
      rest.timer = 0;
      talk.pending = false;
      talk.choiceReaction = null;
      talk.eventResult = null;
      setStatus(state, "Shelter menu.");
      updateAutoSave(state, data, dt);
      return true;
    }
    if (stepShelterChoiceReaction(talk, state, data)) {
      setStatus(state, "Shelter scene.");
      updateAutoSave(state, data, dt);
      return true;
    }
    if (isShelterEventResultReady(talk, state)) {
      const closeConfirmed = consumeEitherPress(state, SHELTER_TALK_CONFIRM_KEYS);
      const closeBack = !closeConfirmed && consumeEitherPress(state, SHELTER_BACK_KEYS);
      if (closeConfirmed || closeBack) {
        playGameSfx(closeBack ? "uiBack" : "uiConfirm", { cooldownMs: 120 });
        beginShelterTalkExit(talk, state);
      } else {
        setStatus(state, "Shelter result. Z close.");
      }
      updateAutoSave(state, data, dt);
      return true;
    }
    if (consumeEitherPress(state, SHELTER_BACK_KEYS)) {
      playGameSfx("uiBack", { cooldownMs: 120 });
      beginShelterTalkExit(talk, state);
      updateAutoSave(state, data, dt);
      return true;
    }
    updateShelterTalkTypingSound(talk, state);
    if (!talk.line) {
      talk.line = "……말해도 돼. 듣고 있어.";
    }
    if (!talk.pending) {
      if (consumeEitherPress(state, SHELTER_TALK_CONFIRM_KEYS)) {
        playGameSfx("uiConfirm", { cooldownMs: 90 });
        if (!isShelterCurrentLineTypedComplete(talk, state)) {
          completeShelterCurrentLineTyping(talk, state);
          updateAutoSave(state, data, dt);
          return true;
        }
        if (advanceShelterLine(talk, state)) {
          updateAutoSave(state, data, dt);
          return true;
        }
        if (canSelectShelterTalkChoice(talk, state)) {
          const playerChoice = getSelectedShelterTalkChoice(talk, state, data);
          queueShelterTalkLine(state, data, playerChoice);
        }
      } else if (isShelterLineComplete(talk) && canSelectShelterTalkChoice(talk, state)) {
        if (consumeEitherPress(state, SHELTER_MENU_UP_KEYS)) {
          talk.choiceIndex = (Math.max(0, Math.floor(talk.choiceIndex || 0)) + talk.choices.length - 1) % talk.choices.length;
          playGameSfx("uiMove", { cooldownMs: 50 });
        }
        if (consumeEitherPress(state, SHELTER_MENU_DOWN_KEYS)) {
          talk.choiceIndex = (Math.max(0, Math.floor(talk.choiceIndex || 0)) + 1) % talk.choices.length;
          playGameSfx("uiMove", { cooldownMs: 50 });
        }
      }
    }
    setStatus(state, talk.pending ? "Shelter talk. Waiting..." : "Shelter talk. W/S choose. Z listen. Esc back.");
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
      playGameSfx("uiBack", { cooldownMs: 120 });
    }
    if (consumeEitherPress(state, SHELTER_BACK_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
      resetShelterPhoto(rest);
      playGameSfx("uiBack", { cooldownMs: 120 });
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
      playGameSfx("photoShutter", { cooldownMs: 180 });
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
      playGameSfx("uiBack", { cooldownMs: 120 });
    } else if (consumeEitherPress(state, SHELTER_BACK_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
      resetShelterPhoto(rest);
      playGameSfx("uiBack", { cooldownMs: 120 });
    } else if (consumeEitherPress(state, CONFIRM_KEYS)) {
      if (saveShelterPhoto(state, data)) {
        rest.phase = "records";
        rest.timer = 0;
        saveCurrentGame(state, data);
        playGameSfx("uiConfirm", { cooldownMs: 120 });
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
      playGameSfx("recordFlip", { cooldownMs: 90 });
    }
    if (consumeEitherPress(state, SHELTER_VIEW_RIGHT_KEYS)) {
      rest.recordsIndex = photos.length ? (Math.max(0, Math.floor(rest.recordsIndex || 0)) + 1) % photos.length : 0;
      playGameSfx("recordFlip", { cooldownMs: 90 });
    }
    if (consumeEitherPress(state, SHELTER_BACK_KEYS) || consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
      playGameSfx("uiBack", { cooldownMs: 120 });
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
      playGameSfx("recordFlip", { cooldownMs: 90 });
    }
    if (consumeEitherPress(state, SHELTER_VIEW_RIGHT_KEYS)) {
      rest.backgroundIndex = backgrounds.length ? (Math.max(0, Math.floor(rest.backgroundIndex || 0)) + 1) % backgrounds.length : 0;
      playGameSfx("recordFlip", { cooldownMs: 90 });
    }
    if (consumeEitherPress(state, SHELTER_BACK_KEYS) || consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
      rest.phase = "menu";
      rest.timer = 0;
      playGameSfx("uiBack", { cooldownMs: 120 });
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
  if (updateNpcDialogue(state, data, dt)) {
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

  updateSearchMusic(run);
  updateMapExploration(run, data);

  if (updateInventoryOverlayInput(state, data)) {
    return;
  }

  if (updateMapOverlayInput(state, data)) {
    return;
  }

  updateUserCameraZoom(state);

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
  const keyboardRecoilShotPressed = !lootWasActive && !run.faceOff?.active && !meleeSlotSelected
    ? updateWeaponFireReloadInput(run, data, state)
    : false;
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
  const queuedRecoilShotPressed = !lootWasActive && !meleeSlotSelected && keyboardRecoilShotPressed;
  const reserveRecoilShotForWeapon = queuedRecoilShotPressed
    && (Boolean(run.recoilAim?.aiming) || selectedWeaponAutomatic);
  if (queuedRecoilShotPressed || state.mouse?.secondaryDown || run.recoilAim?.aiming || run.focusActive) {
    pushInputTrace(state, "preFace", {
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
  clearMouseCombatPrimaryInput(state);
  const focusActive = updateFocusState(run, data, state, dt);
  if (run.player.recoilJumpChargeActive) {
    const chargeDrag = Math.min(1, RECOIL_CHARGE_VELOCITY_DRAG_PER_SECOND * dt);
    run.player.vx = approach(run.player.vx, 0, Math.abs(run.player.vx) * chargeDrag);
    run.player.vy = approach(run.player.vy, 0, Math.abs(run.player.vy) * chargeDrag * 0.45);
    run.player.dashCarryTimer = 0;
    run.player.dashCarrySpeed = 0;
    run.player.sprintJumpCarryTimer = 0;
    run.player.sprintJumpCarrySpeed = 0;
  }
  const focusTimeScale = focusActive
    ? clamp(data.player.movement.focusTimeScale ?? FOCUS_TIME_SCALE, 0.05, 1)
    : 1;
  const dodgeTimeScale = (run.dodgeSlowTimer ?? 0) > 0 ? 0.38 : 1;
  const dashActionActive = Boolean(
    isDashInputQueued(state) ||
    run.player.dashWindupTimer > 0 ||
    run.player.dashTimer > 0
  );
  const actionTimeScale = dashActionActive ? 1 : focusTimeScale;
  const simDt = dt * actionTimeScale * dodgeTimeScale;
  if (isVaultLockdownActive(run)) {
    updateVaultEscapeTimer(state, data, simDt);
    if (state.scene !== SCENES.EXPEDITION) {
      return;
    }
    updateEffects(run, simDt, dt, data);
    syncCamera(run, data, dt);
    setStatus(state, "LOCKDOWN. All exits sealed.");
    return;
  }
  let attackPressed = lootWasActive ? false : consumeEitherPress(state, ATTACK_KEYS);
  const recoilShotPressed = reserveRecoilShotForWeapon
    || (!lootWasActive && !meleeSlotSelected && keyboardRecoilShotPressed);
  if (recoilShotPressed || queuedRecoilShotPressed) {
    pushInputTrace(state, "shotQueued", {
      shot: Number(Boolean(recoilShotPressed)),
      reserve: Number(Boolean(reserveRecoilShotForWeapon)),
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
  if (updateVaultEscapeTimer(state, data, simDt)) {
    return;
  }
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
  const vault = isVaultEscapeActive(run)
    ? ` Vault ${Math.ceil(run.vaultEscape.timeLeft)}s ${run.vaultEscape.collected}/${run.vaultEscape.totalLoot}`
    : "";
  setStatus(state, `${phaseLabel}${notice}${vault}`);
  updateAutoSave(state, data, dt);
}

function updateShelter(state, dt = 0) {
  state.shelter = state.shelter && typeof state.shelter === "object" ? state.shelter : { menuIndex: 0 };
  state.shelter.menuIndex = clamp(Math.floor(state.shelter.menuIndex || 0), 0, SHELTER_HOME_MENU_ITEMS.length - 1);
  state.shelter.upgradeIndex = clamp(Math.floor(state.shelter.upgradeIndex || 0), 0, Math.max(0, SHELTER_UPGRADES.length - 1));
  state.shelterMenu = state.shelter;
  const talk = ensureHomeShelterTalkState(state);

  if (updateOpeningIntro(state, state.data, dt)) {
    return;
  }

  if (!talk.active) {
    const autoEventState = updateShelterAutoEvent(talk, state, state.data, state.shelter);
    if (autoEventState === "started") {
      talk.active = true;
      prepareShelterTalkChoices(talk, state, state.data);
      beginShelterTalkTransition(talk, state, "in");
      setStatus(state, "Shelter talk. W/S choose. Z listen. Esc back.");
      return;
    }
    if (autoEventState === "bridging") {
      setStatus(state, "Shelter scene.");
      return;
    }
  }

  const startShelterTalk = () => {
    talk.active = true;
    talk.blockScriptedEventStart = false;
    prepareShelterTalkChoices(talk, state, state.data);
    if (!talk.line) {
      talk.line = "……말해도 돼. 듣고 있어.";
    }
    beginShelterTalkTransition(talk, state, "in");
    setStatus(state, "Shelter talk. W/S choose. Z listen. Esc back.");
  };

  const startShelterSortie = () => {
    startNewSavedRun(state, state.data);
    setStatus(state, "출격 중");
  };

  const handleShelterUpgrade = () => {
    const upgrade = SHELTER_UPGRADES[state.shelter.upgradeIndex] || SHELTER_UPGRADES[0];
    if (!upgrade) {
      return true;
    }
    const level = getShelterUpgradeLevel(state.meta, upgrade.id);
    const cost = getShelterUpgradeCost(upgrade, level);
    if (cost === null) {
      setStatus(state, `${upgrade.label} 최대 단계`);
      playGameSfx("uiDenied", { cooldownMs: 140 });
      return true;
    }
    if ((state.meta.bankedMaterials || 0) < cost) {
      setStatus(state, `자재 부족 · ${cost} 필요`);
      playGameSfx("uiDenied", { cooldownMs: 140 });
      return true;
    }
    state.meta.upgrades = normalizeMetaUpgrades(state.meta.upgrades);
    state.meta.bankedMaterials = Math.max(0, (state.meta.bankedMaterials || 0) - cost);
    state.meta.upgrades[upgrade.id] = level + 1;
    saveMetaState(state.meta);
    setStatus(state, `${upgrade.label} Lv.${level + 1} 업그레이드 완료`);
    playGameSfx("shelterUpgrade", { cooldownMs: 180 });
    return true;
  };

  if (talk.active) {
    prepareShelterTalkChoices(talk, state, state.data);
    const transitionState = updateShelterTalkTransition(talk, state);
    if (transitionState === "running") {
      return;
    }
    if (transitionState === "exit-complete") {
      talk.active = false;
      talk.pending = false;
      talk.choiceReaction = null;
      talk.eventResult = null;
      setStatus(state, "Shelter menu.");
      return;
    }
    if (stepShelterChoiceReaction(talk, state, state.data)) {
      setStatus(state, "Shelter scene.");
      return;
    }
    if (isShelterEventResultReady(talk, state)) {
      const closeConfirmed = consumeEitherPress(state, SHELTER_TALK_CONFIRM_KEYS);
      const closeBack = !closeConfirmed && consumeEitherPress(state, SHELTER_BACK_KEYS);
      if (closeConfirmed || closeBack) {
        playGameSfx(closeBack ? "uiBack" : "uiConfirm", { cooldownMs: 120 });
        beginShelterTalkExit(talk, state);
      } else {
        setStatus(state, "Shelter result. Z close.");
      }
      return;
    }
    if (consumeEitherPress(state, SHELTER_BACK_KEYS)) {
      playGameSfx("uiBack", { cooldownMs: 120 });
      beginShelterTalkExit(talk, state);
      return;
    }
    updateShelterTalkTypingSound(talk, state);
    if (!talk.pending) {
      if (!talk.line) {
        talk.line = "……말해도 돼. 듣고 있어.";
      }
      if (consumeEitherPress(state, SHELTER_TALK_CONFIRM_KEYS)) {
        playGameSfx("uiConfirm", { cooldownMs: 90 });
        if (!isShelterCurrentLineTypedComplete(talk, state)) {
          completeShelterCurrentLineTyping(talk, state);
          return;
        }
        if (advanceShelterLine(talk, state)) {
          return;
        }
        if (canSelectShelterTalkChoice(talk, state)) {
          const playerChoice = getSelectedShelterTalkChoice(talk, state, state.data);
          queueHomeShelterTalkLine(state, state.data, playerChoice);
          return;
        }
      } else if (isShelterLineComplete(talk) && canSelectShelterTalkChoice(talk, state)) {
        if (consumeEitherPress(state, SHELTER_MENU_UP_KEYS)) {
          talk.choiceIndex = (Math.max(0, Math.floor(talk.choiceIndex || 0)) + talk.choices.length - 1) % talk.choices.length;
          playGameSfx("uiMove", { cooldownMs: 50 });
        }
        if (consumeEitherPress(state, SHELTER_MENU_DOWN_KEYS)) {
          talk.choiceIndex = (Math.max(0, Math.floor(talk.choiceIndex || 0)) + 1) % talk.choices.length;
          playGameSfx("uiMove", { cooldownMs: 50 });
        }
      }
    }
    setStatus(state, talk.pending ? "Shelter talk. Waiting..." : "Shelter talk. W/S choose. Z listen. Esc back.");
    return;
  }

  const pointerAction = getShelterHomePointerAction(state);
  if (pointerAction) {
    state.mouse.primaryJustPressed = false;
    if (pointerAction === "talk") {
      playGameSfx("uiConfirm", { cooldownMs: 120 });
      startShelterTalk();
      return;
    }
    if (pointerAction === "upgrade") {
      state.shelter.menuIndex = SHELTER_HOME_MENU_ITEMS.indexOf("upgrade");
      playGameSfx("shelterMenuOpen", { cooldownMs: 160 });
      setStatus(state, "업그레이드 선택");
      return;
    }
    playGameSfx("uiConfirm", { cooldownMs: 120 });
    startShelterSortie();
    return;
  }

  if (consumeEitherPress(state, SHELTER_MENU_UP_KEYS)) {
    state.shelter.menuIndex = (Math.max(0, Math.floor(state.shelter.menuIndex || 0)) + SHELTER_HOME_MENU_ITEMS.length - 1) % SHELTER_HOME_MENU_ITEMS.length;
    playGameSfx("uiMove", { cooldownMs: 50 });
  }
  if (consumeEitherPress(state, SHELTER_MENU_DOWN_KEYS)) {
    state.shelter.menuIndex = (Math.max(0, Math.floor(state.shelter.menuIndex || 0)) + 1) % SHELTER_HOME_MENU_ITEMS.length;
    playGameSfx("uiMove", { cooldownMs: 50 });
  }

  const selected = SHELTER_HOME_MENU_ITEMS[clamp(Math.floor(state.shelter.menuIndex || 0), 0, SHELTER_HOME_MENU_ITEMS.length - 1)];
  if (selected === "upgrade") {
    if (consumeEitherPress(state, SHELTER_VIEW_LEFT_KEYS)) {
      state.shelter.upgradeIndex = (state.shelter.upgradeIndex + SHELTER_UPGRADES.length - 1) % SHELTER_UPGRADES.length;
      playGameSfx("uiMove", { cooldownMs: 50 });
      setStatus(state, "업그레이드 선택");
      return;
    }
    if (consumeEitherPress(state, SHELTER_VIEW_RIGHT_KEYS)) {
      state.shelter.upgradeIndex = (state.shelter.upgradeIndex + 1) % SHELTER_UPGRADES.length;
      playGameSfx("uiMove", { cooldownMs: 50 });
      setStatus(state, "업그레이드 선택");
      return;
    }
  }

  if (consumeEitherPress(state, SHELTER_EXIT_KEYS)) {
    playGameSfx("uiConfirm", { cooldownMs: 120 });
    startShelterSortie();
    return;
  }

  if (consumeEitherPress(state, INTERACT_KEYS) || consumeEitherPress(state, CONFIRM_KEYS)) {
    if (selected === "talk") {
      playGameSfx("uiConfirm", { cooldownMs: 120 });
      startShelterTalk();
      return;
    }
    if (selected === "upgrade") {
      handleShelterUpgrade();
      return;
    }
    playGameSfx("uiConfirm", { cooldownMs: 120 });
    startShelterSortie();
    return;
  }

  const selectedUpgrade = SHELTER_UPGRADES[state.shelter.upgradeIndex] || SHELTER_UPGRADES[0];
  const level = getShelterUpgradeLevel(state.meta, selectedUpgrade.id);
  const cost = getShelterUpgradeCost(selectedUpgrade, level);
  setStatus(state, selected === "upgrade"
    ? `${selectedUpgrade.label} Lv.${level}/${selectedUpgrade.maxLevel} · ${cost === null ? "최대" : `자재 ${cost}`}`
    : "Shelter. W/S menu. Z select. C sortie.");
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

function getTitlePointerMenuIndex(state, hasRun) {
  const mouse = state.mouse;
  if (!mouse?.primaryJustPressed || mouse.onCanvas === false) {
    return null;
  }
  const x = Number(mouse.screenX);
  const y = Number(mouse.screenY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const rowX = 82;
  const rowY = 316;
  const rowW = 344;
  const rowH = 56;
  const rowGap = 68;
  const count = hasRun ? TITLE_MENU_ITEMS.length : 1;
  for (let index = 0; index < count; index += 1) {
    const top = rowY + index * rowGap;
    if (x >= rowX && x <= rowX + rowW && y >= top && y <= top + rowH) {
      return index;
    }
  }
  return null;
}

function getOpeningIntroCuts(data) {
  return Array.isArray(data?.opening?.cuts)
    ? data.opening.cuts.filter((cut) => cut && typeof cut === "object")
    : [];
}

function getOpeningIntroCutDuration(cut) {
  const configured = Number(cut?.duration);
  const lineDuration = getShelterLineTypeDuration(String(cut?.line || "")) + 0.45;
  return Number.isFinite(configured)
    ? Math.max(clamp(configured, 0.8, 6), lineDuration)
    : clamp(lineDuration, 1.2, 6);
}

function beginOpeningIntro(state, data) {
  if (getOpeningIntroCuts(data).length <= 0) {
    return false;
  }
  state.openingIntro = {
    active: true,
    cutIndex: 0,
    timer: 0,
    completed: false,
  };
  state.sceneTimer = 0;
  setStatus(state, "Opening. Z/Enter advance. Esc skip.");
  return true;
}

function finishOpeningIntro(state) {
  state.openingIntro = {
    active: false,
    cutIndex: 0,
    timer: 0,
    completed: true,
  };
  state.sceneTimer = 0;
  setStatus(state, "쉘터 연결");
}

function updateOpeningIntro(state, data, dt = 0) {
  const intro = state.openingIntro && typeof state.openingIntro === "object"
    ? state.openingIntro
    : { active: false };
  if (!intro.active) {
    return false;
  }

  const cuts = getOpeningIntroCuts(data);
  if (cuts.length <= 0) {
    finishOpeningIntro(state);
    return true;
  }

  const skip = consumeEitherPress(state, OPENING_INTRO_SKIP_KEYS);
  const keyAdvance = !skip && consumeEitherPress(state, OPENING_INTRO_ADVANCE_KEYS);
  const pointerAdvance = !skip && !keyAdvance && Boolean(state.mouse?.primaryJustPressed && state.mouse.onCanvas !== false);
  if (pointerAdvance && state.mouse) {
    state.mouse.primaryJustPressed = false;
  }

  if (skip) {
    playGameSfx("uiBack", { cooldownMs: 120 });
    finishOpeningIntro(state);
    return true;
  }

  const cutIndex = clamp(Math.floor(intro.cutIndex || 0), 0, cuts.length - 1);
  const cut = cuts[cutIndex];
  intro.cutIndex = cutIndex;
  intro.timer = Math.max(0, Number(intro.timer || 0) + Math.max(0, dt));
  const done = intro.timer >= getOpeningIntroCutDuration(cut);

  if (keyAdvance || pointerAdvance || done) {
    if (keyAdvance || pointerAdvance) {
      playGameSfx("uiConfirm", { cooldownMs: 80 });
    }
    if (cutIndex >= cuts.length - 1) {
      finishOpeningIntro(state);
      return true;
    }
    intro.cutIndex = cutIndex + 1;
    intro.timer = 0;
  }

  setStatus(state, "Opening. Z/Enter advance. Esc skip.");
  return true;
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
  if (!beginOpeningIntro(state, state.data)) {
    setStatus(state, "출격 준비");
  }
}

export function activateTitleMenuSelection(state, data, menuIndex = null) {
  if (!state || state.scene !== SCENES.TITLE) {
    return false;
  }
  state.data = state.data || data;
  state.save = state.save || {};
  const hasRun = hasSavedGame();
  state.save.hasRun = hasRun;
  const titleMenu = ensureTitleMenuState(state, hasRun);
  if (Number.isFinite(menuIndex)) {
    titleMenu.menuIndex = clamp(Math.floor(menuIndex), 0, TITLE_MENU_ITEMS.length - 1);
  }

  if (titleMenu.confirmingNewRun) {
    playGameSfx("uiConfirm", { cooldownMs: 120 });
    enterTitleNewRun(state, hasRun);
    return true;
  }

  const selected = TITLE_MENU_ITEMS[clamp(Math.floor(titleMenu.menuIndex || 0), 0, TITLE_MENU_ITEMS.length - 1)];
  playGameSfx("uiConfirm", { cooldownMs: 120 });
  if (selected === "continue") {
    if (hasRun && restoreSavedGame(state, state.data)) {
      return true;
    }
    state.save.hasRun = false;
    titleMenu.menuIndex = 0;
    titleMenu.lastHasRun = false;
    setStatus(state, "저장된 런 없음");
    return true;
  }

  if (hasRun) {
    titleMenu.confirmingNewRun = true;
    setStatus(state, "기존 저장 삭제 확인");
    return true;
  }

  enterTitleNewRun(state, false);
  return true;
}

function updateTitle(state) {
  if (shouldStartFromUrlLevel()) {
    startNewSavedRun(state, state.data, { clearSaved: false, persist: false, useUrlLevel: true });
    setStatus(state, "?삥뇣節뀐쉘 ?삠꺕");
    return;
  }

  state.save = state.save || {};
  const hasRun = hasSavedGame();
  state.save.hasRun = hasRun;
  const titleMenu = ensureTitleMenuState(state, hasRun);
  const pointerMenuIndex = getTitlePointerMenuIndex(state, hasRun);
  if (pointerMenuIndex !== null) {
    state.mouse.primaryJustPressed = false;
    titleMenu.menuIndex = pointerMenuIndex;
    titleMenu.confirmingNewRun = false;
    playGameSfx("uiConfirm", { cooldownMs: 120 });
    const selected = TITLE_MENU_ITEMS[clamp(pointerMenuIndex, 0, TITLE_MENU_ITEMS.length - 1)];
    if (selected === "continue") {
      if (hasRun && restoreSavedGame(state, state.data)) {
        return;
      }
      state.save.hasRun = false;
      titleMenu.menuIndex = 0;
      titleMenu.lastHasRun = false;
      setStatus(state, "저장된 런 없음");
      return;
    }
    if (hasRun) {
      titleMenu.confirmingNewRun = true;
      setStatus(state, "기존 저장 삭제 확인");
      return;
    }
    enterTitleNewRun(state, false);
    return;
  }

  if (titleMenu.confirmingNewRun) {
    if (consumeEitherPress(state, TITLE_MENU_CANCEL_KEYS)) {
      titleMenu.confirmingNewRun = false;
      playGameSfx("uiBack", { cooldownMs: 120 });
      setStatus(state, "????痍⑥냼");
      return;
    }
    if (consumeEitherPress(state, TITLE_MENU_UP_KEYS) || consumeEitherPress(state, TITLE_MENU_DOWN_KEYS)) {
      titleMenu.confirmingNewRun = false;
      playGameSfx("uiMove", { cooldownMs: 50 });
      setStatus(state, "硫붿씤 硫붾돱");
      return;
    }
    if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
      playGameSfx("uiConfirm", { cooldownMs: 120 });
      enterTitleNewRun(state, hasRun);
      return;
    }
    setStatus(state, "湲곗〈 ?????젣 ?뺤씤: C/Z");
    return;
  }

  if (consumeEitherPress(state, TITLE_MENU_UP_KEYS)) {
    moveTitleMenu(titleMenu, hasRun, -1);
    playGameSfx("uiMove", { cooldownMs: 50 });
    setStatus(state, "硫붿씤 硫붾돱");
    return;
  }
  if (consumeEitherPress(state, TITLE_MENU_DOWN_KEYS)) {
    moveTitleMenu(titleMenu, hasRun, 1);
    playGameSfx("uiMove", { cooldownMs: 50 });
    setStatus(state, "硫붿씤 硫붾돱");
    return;
  }

  if (consumeEitherPress(state, NEW_RUN_KEYS)) {
    titleMenu.menuIndex = 0;
    playGameSfx("uiConfirm", { cooldownMs: 120 });
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
    playGameSfx("uiConfirm", { cooldownMs: 120 });
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
    playGameSfx("uiConfirm", { cooldownMs: 120 });
    state.scene = SCENES.SHELTER;
    state.sceneTimer = 0;
  }
}

function updateGameOver(state) {
  setStatus(state, isMovementLab(state.data) ? "?ㅽ뙣 ?붾㈃. C/Z" : "???ㅽ뙣. C/Z");
  if (consumeEitherPress(state, CONFIRM_KEYS) || consumeEitherPress(state, INTERACT_KEYS)) {
    playGameSfx("uiConfirm", { cooldownMs: 120 });
    state.scene = SCENES.SHELTER;
    state.sceneTimer = 0;
  }
}

function getShelterHomePointerAction(state) {
  const mouse = state.mouse;
  if (!mouse?.primaryJustPressed || mouse.onCanvas === false) {
    return null;
  }
  const x = Number(mouse.screenX);
  const y = Number(mouse.screenY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const rowX = 44;
  const rowY = 96;
  const rowW = 210;
  const rowH = 38;
  const rowGap = 47;
  for (let index = 0; index < SHELTER_HOME_MENU_ITEMS.length; index += 1) {
    const top = rowY + index * rowGap;
    if (x >= rowX && x <= rowX + rowW && y >= top && y <= top + rowH) {
      state.shelter.menuIndex = index;
      return SHELTER_HOME_MENU_ITEMS[index];
    }
  }
  return null;
}

export function bindInput(state) {
  const isTextInputTarget = (target) => {
    const tagName = String(target?.tagName || "").toLowerCase();
    return Boolean(target?.isContentEditable)
      || tagName === "input"
      || tagName === "textarea"
      || tagName === "select";
  };

  window.addEventListener(SHELTER_CHAT_SUBMIT_EVENT, (event) => {
    submitShelterChatText(state, event.detail?.text || "");
  });

  window.addEventListener("keydown", (event) => {
    if (isTextInputTarget(event.target)) {
      return;
    }
    if (typeof document !== "undefined") {
      document.documentElement.dataset.lastKeyDownCode = event.code || "";
      document.documentElement.dataset.lastKeyDownKey = event.key || "";
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Tab", "CapsLock", "Digit1", "Digit2", "Digit3", "Digit8", "NumpadMultiply", "NumpadAdd", "NumpadSubtract", "Minus", "Equal", "KeyA", "KeyD", "KeyS", "KeyW", "KeyC", "KeyE", "KeyF", "KeyM", "KeyN", "KeyQ", "KeyR", "KeyX", "KeyZ", "KeyV", "ShiftLeft", "ShiftRight", "Escape", "F2", "F3", "F5", "KeyL", "Backquote"].includes(event.code)) {
      event.preventDefault();
    }
    if (state.forceModernControls) {
      state.capsLockActive = false;
    } else if (typeof event.getModifierState === "function") {
      state.capsLockActive = event.getModifierState("CapsLock");
    }
    if (!state.pressed.has(event.code)) {
      state.justPressed.add(event.code);
      state.keyHoldSeconds?.set(event.code, 0);
    }
    state.pressed.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    if (isTextInputTarget(event.target)) {
      return;
    }
    if (state.forceModernControls) {
      state.capsLockActive = false;
    } else if (typeof event.getModifierState === "function") {
      state.capsLockActive = event.getModifierState("CapsLock");
    }
    if (state.pressed.has(event.code)) {
      state.releasedKeyHoldSeconds?.set(event.code, getKeyHoldSeconds(state, event.code));
      state.justReleased?.add(event.code);
    }
    state.pressed.delete(event.code);
    state.keyHoldSeconds?.delete(event.code);
  });
}

function syncRuntimeDebugDataset(state) {
  if (typeof document === "undefined") {
    return;
  }
  const dataset = document.documentElement.dataset;
  dataset.forceModernControls = String(Boolean(state.forceModernControls));
  dataset.capsLockActive = String(Boolean(state.capsLockActive));
  dataset.legacyControls = String(useLegacyControls(state));
  dataset.gameScene = state.scene || "";
  dataset.gameHasRun = String(Boolean(state.save?.hasRun));
  dataset.gameCurrentLevelId = state.run?.currentLevelId || "";
  dataset.faceOffActive = String(Boolean(state.run?.faceOff?.active));
  dataset.lootActive = String(Boolean(state.run?.loot?.active));
  dataset.selectedWeaponSlot = state.run?.weapons?.selectedSlot || "";
  dataset.selectedWeaponSide = state.run?.weapons?.selectedSide || "";
  dataset.recoilShotActive = String(Boolean(state.run?.player?.recoilShotActive));
  dataset.recoilShotTimer = String(Number(state.run?.player?.recoilShotTimer ?? 0).toFixed(3));
  dataset.recoilCameraHoldUntilLanding = String(Boolean(state.run?.player?.recoilCameraHoldUntilLanding));
  dataset.recoilCameraReturning = String(Boolean(state.run?.player?.recoilCameraReturning));
  dataset.recoilCameraTimer = String(Number(state.run?.player?.recoilCameraTimer ?? 0).toFixed(3));
  dataset.cameraSpeedRatio = String(Number(state.run?.cameraSpeedRatio ?? 0).toFixed(3));
  dataset.cameraSpeedRawRatio = String(Number(state.run?.cameraSpeedRawRatio ?? 0).toFixed(3));
  dataset.cameraSpeedHoldRatio = String(Number(state.run?.cameraSpeedHoldRatio ?? 0).toFixed(3));
  dataset.cameraSpeedHoldReturning = String(Boolean(state.run?.cameraSpeedHoldReturning));
  dataset.playerBulletCount = String(state.run?.playerBullets?.length ?? 0);
  dataset.mousePrimaryDown = String(Boolean(state.mouse?.primaryDown));
  dataset.mouseSecondaryDown = String(Boolean(state.mouse?.secondaryDown));
}

export function updateGame(state, data, dt) {
  state.pulse += dt;
  state.sceneTimer += dt;
  updateKeyHoldDurations(state, dt);

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
    updateShelter(state, dt);
  } else if (state.scene === SCENES.EXPEDITION) {
    updateExpedition(state, data, dt);
  } else if (state.scene === SCENES.RESULTS) {
    updateResults(state);
  } else if (state.scene === SCENES.GAME_OVER) {
    updateGameOver(state);
  }

  updateShelterMusic(state);
  updateRainAmbience(state, data);
  updateLoopingAudioFades();
  syncRuntimeDebugDataset(state);

  if (state.mouse) {
    state.mouse.primaryJustPressed = false;
    state.mouse.secondaryJustPressed = false;
  }
  state.justPressed.clear();
  state.justReleased?.clear();
  state.releasedKeyHoldSeconds?.clear();
}

export function hasThreatSense(state) {
  return hasUnlocked(state.meta, "threatSense");
}
