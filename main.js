import { GAME_DATA } from "./level-data.js?v=20260505-faceoff-e-v1";
import {
  createGameDataWithExternalLevels,
  createRuntimeGameData,
  extractEditableLevelData,
  saveLevelOverride,
  shouldUseLocalLevelOverrideFromUrl,
} from "./level-store.js?v=20260505-level-source-v2";
import {
  SPRINT_TUNING_FIELDS,
  applySprintTuning,
  clearSprintTuning,
  extractSprintTuning,
  loadSprintTuning,
  saveSprintTuning,
} from "./movement-tuning.js?v=20260501-run-start-v1";
import { renderGame } from "./render.js?v=20260505-player-bullets-v1";
import { saveCurrentGame } from "./save-game.js?v=20260505-level-source-v2";
import { SCENES, createInitialState, createRunState } from "./state.js?v=20260505-player-bullets-v1";
import { bindInput, updateGame } from "./systems.js?v=20260505-rmb-bullet-time-v1";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const liveEditButton = document.getElementById("liveEditButton");
const debugButton = document.getElementById("debugButton");
const movementTuningButton = document.getElementById("movementTuningButton");
const movementTuningPanel = document.getElementById("movementTuningPanel");
const movementTuningFields = document.getElementById("movementTuningFields");
const movementTuningCloseButton = document.getElementById("movementTuningCloseButton");
const movementTuningSaveButton = document.getElementById("movementTuningSaveButton");
const movementTuningResetButton = document.getElementById("movementTuningResetButton");
const sceneActionButton = document.getElementById("sceneActionButton");
const touchControls = document.getElementById("touchControls");
const touchButtons = Array.from(document.querySelectorAll(".touch-button"));
const faceOffDebugPanel = document.createElement("pre");
faceOffDebugPanel.setAttribute("aria-label", "Face-off debug");
Object.assign(faceOffDebugPanel.style, {
  position: "fixed",
  left: "10px",
  bottom: "10px",
  zIndex: "99999",
  margin: "0",
  padding: "10px 12px",
  maxWidth: "520px",
  maxHeight: "46vh",
  overflow: "auto",
  pointerEvents: "none",
  color: "#dff7ff",
  background: "rgba(0, 0, 0, 0.78)",
  border: "1px solid rgba(255,255,255,0.28)",
  borderRadius: "6px",
  font: "12px/1.35 Consolas, 'Cascadia Mono', monospace",
  whiteSpace: "pre-wrap",
  textShadow: "0 1px 2px rgba(0,0,0,0.75)",
});
document.body.appendChild(faceOffDebugPanel);
const inputTraceDownloadButton = document.createElement("button");
inputTraceDownloadButton.type = "button";
inputTraceDownloadButton.textContent = "Input Log";
inputTraceDownloadButton.title = "Download input trace log";
Object.assign(inputTraceDownloadButton.style, {
  position: "fixed",
  left: "10px",
  bottom: "calc(46vh + 28px)",
  zIndex: "100000",
  display: "none",
  padding: "8px 10px",
  border: "1px solid rgba(147,234,255,0.5)",
  borderRadius: "6px",
  color: "#dff7ff",
  background: "rgba(0, 0, 0, 0.78)",
  font: "700 12px/1 Consolas, 'Cascadia Mono', monospace",
  cursor: "pointer",
});
document.body.appendChild(inputTraceDownloadButton);
const inputTracePanel = document.createElement("section");
inputTracePanel.setAttribute("aria-label", "Input trace output");
Object.assign(inputTracePanel.style, {
  position: "fixed",
  inset: "48px 48px auto auto",
  zIndex: "100001",
  display: "none",
  width: "min(720px, calc(100vw - 96px))",
  maxHeight: "calc(100vh - 96px)",
  padding: "12px",
  border: "1px solid rgba(147,234,255,0.52)",
  borderRadius: "8px",
  background: "rgba(0,0,0,0.88)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
});
const inputTraceTextArea = document.createElement("textarea");
inputTraceTextArea.readOnly = true;
Object.assign(inputTraceTextArea.style, {
  width: "100%",
  height: "min(520px, calc(100vh - 174px))",
  resize: "vertical",
  margin: "0 0 10px",
  padding: "10px",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: "6px",
  color: "#dff7ff",
  background: "rgba(4,10,16,0.94)",
  font: "12px/1.4 Consolas, 'Cascadia Mono', monospace",
});
const inputTraceCloseButton = document.createElement("button");
inputTraceCloseButton.type = "button";
inputTraceCloseButton.textContent = "Close";
Object.assign(inputTraceCloseButton.style, {
  padding: "8px 10px",
  border: "1px solid rgba(255,255,255,0.28)",
  borderRadius: "6px",
  color: "#dff7ff",
  background: "rgba(15,52,70,0.72)",
  font: "700 12px/1 Consolas, 'Cascadia Mono', monospace",
  cursor: "pointer",
});
inputTracePanel.append(inputTraceTextArea, inputTraceCloseButton);
document.body.appendChild(inputTracePanel);
const CROW_TUNING_FIELDS = [
  { key: "width", label: "Crow Width", min: 36, max: 320, step: 1 },
  { key: "height", label: "Crow Height", min: 24, max: 220, step: 1 },
  { key: "fireCooldown", label: "Crow Attack Cooldown", min: 0.25, max: 14, step: 0.05 },
  { key: "initialCooldown", label: "Crow First Attack", min: 0, max: 14, step: 0.05 },
  { key: "diveSpeed", label: "Crow Dive Speed", min: 300, max: 3200, step: 10 },
  { key: "backCatchPaddingX", label: "Crow Back Width Bonus", min: 0, max: 120, step: 1 },
  { key: "backCatchForgivenessY", label: "Crow Back Snap Height", min: 0, max: 72, step: 1 },
];
const FACE_OFF_TUNING_FIELDS = [
  { key: "enemyLineCharDelay", label: "Text Char Delay", min: 0.015, max: 0.12, step: 0.005 },
  { key: "enemyLineHoldDuration", label: "Enemy Line Hold", min: 0.2, max: 3, step: 0.05 },
  { key: "choiceSlideDuration", label: "Choice Slide", min: 0.08, max: 1, step: 0.02 },
];

const dom = {
  canvas,
  ctx,
  liveEditButton,
  debugButton,
  movementTuningButton,
  movementTuningPanel,
  movementTuningFields,
  movementTuningCloseButton,
  movementTuningSaveButton,
  movementTuningResetButton,
  sceneActionButton,
  touchControls,
  touchButtons,
};

const BASE_GAME_DATA = await createGameDataWithExternalLevels(GAME_DATA);
const runtimeData = createRuntimeGameData(BASE_GAME_DATA, null, {
  applyLevelOverride: shouldUseLocalLevelOverrideFromUrl(),
});
const baseSprintTuning = extractSprintTuning(runtimeData.player.movement);
applySprintTuning(
  runtimeData.player.movement,
  loadSprintTuning(runtimeData.player.movement),
  runtimeData.player.movement,
);

const state = createInitialState(runtimeData);
window.__faceOffState = state;
window.__faceOffData = runtimeData;
bindInput(state);
inputTraceDownloadButton.addEventListener("click", () => {
  downloadInputTrace(state);
});
inputTraceCloseButton.addEventListener("click", () => {
  inputTracePanel.style.display = "none";
});

let lastFrame = performance.now();

function formatNumber(value, digits = 3) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : String(value);
}

function pushInputTrace(currentState, label, details = {}) {
  const debug = currentState.debug || (currentState.debug = {});
  const trace = Array.isArray(debug.inputTrace) ? debug.inputTrace : [];
  const frame = Number.isFinite(currentState.debugFrame) ? currentState.debugFrame : 0;
  const fields = Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
  trace.push(`#${frame} ${label}${fields ? ` ${fields}` : ""}`);
  debug.inputTrace = trace.slice(-500);
  window.__inputTraceText = debug.inputTrace.join("\n");
}

function getInputTraceDownloadText(currentState) {
  const run = currentState.run;
  const mouse = currentState.mouse || {};
  const aim = run?.recoilAim || {};
  const lines = [
    "FACE-OFF INPUT TRACE",
    `generatedAt=${new Date().toISOString()}`,
    `frame=${currentState.debugFrame ?? 0}`,
    `scene=${currentState.scene}`,
    `status=${currentState.statusText ?? ""}`,
    `mouse primary=${Boolean(mouse.primaryDown)} justPrimary=${Boolean(mouse.primaryJustPressed)} secondary=${Boolean(mouse.secondaryDown)} justSecondary=${Boolean(mouse.secondaryJustPressed)}`,
    `aim active=${Boolean(aim.active)} aiming=${Boolean(aim.aiming)} focus=${Boolean(run?.focusActive)} faceOff=${Boolean(run?.faceOff?.active)}`,
    "",
    ...(currentState.debug?.inputTrace || []),
  ];
  return lines.join("\n");
}

function downloadInputTrace(currentState) {
  const text = getInputTraceDownloadText(currentState);
  window.__inputTraceText = text;
  try {
    localStorage.setItem("face-off-input-trace", text);
  } catch {
    // Best-effort debug capture.
  }
  inputTraceTextArea.value = text;
  inputTracePanel.style.display = "block";
  inputTraceTextArea.focus();
  inputTraceTextArea.select();
  inputTraceDownloadButton.textContent = "Log Ready";
  setTimeout(() => {
    inputTraceDownloadButton.textContent = "Input Log";
  }, 1400);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = url;
  link.download = `face-off-input-trace-${stamp}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateFaceOffDebugPanel(currentState, now, error = null) {
  const run = currentState.run;
  const faceOff = run?.faceOff;
  const faceOffEnemy = faceOff?.targetId
    ? (run?.humanoidEnemies || []).find((enemy) => enemy.id === faceOff.targetId)
    : null;
  const shouldShow = Boolean(
    error ||
    currentState.debug?.active
  );
  faceOffDebugPanel.hidden = !shouldShow;
  inputTraceDownloadButton.style.display = shouldShow ? "block" : "none";
  if (!shouldShow) {
    return;
  }

  const entryDuration = Math.max(0.001, faceOff?.entryTransitionDuration ?? 1);
  const entryStartedAt = faceOff?.entryTransitionStartedAt ?? 0;
  const entryElapsed = entryStartedAt > 0 ? Math.max(0, (now - entryStartedAt) / 1000) : 0;
  const entryRenderRemaining = entryStartedAt > 0
    ? Math.max(0, 1 - entryElapsed / entryDuration)
    : Math.max(0, (faceOff?.entryTransitionTimer ?? 0) / entryDuration);
  const pressed = Array.from(currentState.pressed || []).join(",");
  const justPressed = Array.from(currentState.justPressed || []).join(",");
  const text = [
    "FACE-OFF DEBUG",
    `frame=${currentState.debugFrame} now=${formatNumber(now / 1000, 2)} dt=${formatNumber(currentState.debugLastDt, 4)}`,
    `scene=${currentState.scene} status=${currentState.statusText}`,
    `active=${Boolean(faceOff?.active)} target=${faceOff?.targetId ?? "-"} acquire=${faceOff?.acquireTargetId ?? "-"} progress=${formatNumber(faceOff?.acquireProgress ?? 0)}`,
    `entryTimer=${formatNumber(faceOff?.entryTransitionTimer ?? 0)} startedAt=${formatNumber(entryStartedAt / 1000, 2)} elapsed=${formatNumber(entryElapsed)} renderRemain=${formatNumber(entryRenderRemaining)}`,
    `line=${faceOff?.enemyLineIndex ?? 0}/${faceOff?.enemyLine?.length ?? 0} choice=${formatNumber(faceOff?.choiceRevealProgress ?? 0)} ready=${Boolean(faceOff?.choicesReady)}`,
    `result=${faceOff?.result ?? "-"} resultTimer=${formatNumber(faceOff?.resultTimer ?? 0)} message=${faceOff?.message ?? "-"}`,
    `aftermath=${faceOffEnemy?.state ?? "-"} exhaustion=${faceOffEnemy?.exhaustionHits ?? 0}/${faceOffEnemy?.exhaustionLimit ?? 2} hover=${faceOff?.hoverPart ?? "-"} selected=${faceOff?.selectedPart ?? "-"}`,
    `loot=${Boolean(run?.loot?.active)} liveEdit=${Boolean(currentState.liveEdit?.active)} recoilAim=${Boolean(run?.recoilAim?.active)} secondary=${Boolean(currentState.mouse?.secondaryDown)}`,
    `mouse=${formatNumber(currentState.mouse?.screenX ?? 0, 1)},${formatNumber(currentState.mouse?.screenY ?? 0, 1)} primary=${Boolean(currentState.mouse?.primaryDown)} justPrimary=${Boolean(currentState.mouse?.primaryJustPressed)}`,
    "INPUT TRACE RECENT",
    ...(currentState.debug?.inputTrace || []).slice(-32),
    `pressed=[${pressed}] just=[${justPressed}]`,
    error ? `ERROR=${error?.stack || error?.message || String(error)}` : "",
  ].filter(Boolean).join("\n");
  faceOffDebugPanel.textContent = text;
  window.__faceOffDebugText = text;
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getCameraZoom(data, currentState = null) {
  return clampValue(currentState?.run?.cameraZoom ?? data.world.camera?.zoom ?? 1, 0.5, 2.5);
}

function isLiveEditAvailable(currentState, data) {
  return currentState.scene === SCENES.EXPEDITION && currentState.run && data.world.mode === "movementLab";
}

function saveRuntimeOverride(data, currentState) {
  saveLevelOverride(extractEditableLevelData(data), BASE_GAME_DATA, data.currentLevelId);
  saveSprintTuning(extractSprintTuning(data.player.movement), GAME_DATA.player.movement);
  if (currentState?.liveEdit) {
    currentState.liveEdit.saveFlashTimer = 1.2;
  }
}

function saveLiveEdit(data, currentState) {
  saveRuntimeOverride(data, currentState);
}

function toggleLiveEdit(currentState) {
  currentState.liveEdit.active = !currentState.liveEdit.active;
  currentState.liveEdit.hoverPlatformIndex = null;
  currentState.liveEdit.selectedPlatformIndex = null;
  currentState.liveEdit.drag = null;
  if (currentState.liveEdit.active && currentState.run) {
    currentState.run.player.vx = 0;
    currentState.run.player.vy = 0;
    currentState.run.player.attackWindow = 0;
    currentState.run.player.dashTimer = 0;
    currentState.run.player.lightActive = false;
  }
}

function jumpToExpedition(currentState, data) {
  if (currentState.scene === SCENES.EXPEDITION && currentState.run) {
    return;
  }

  currentState.resultSummary = null;
  currentState.liveEdit.active = false;
  currentState.run = createRunState(data, currentState.meta);
  currentState.scene = SCENES.EXPEDITION;
  currentState.sceneTimer = 0;
}

function openLevelEditor(data, currentState) {
  saveRuntimeOverride(data, currentState);
  const levelId = encodeURIComponent(data.currentLevelId || data.defaultLevelId || "movement-lab-01");
  window.location.href = `./editor.html?level=${levelId}`;
}

function getCanvasPoint(targetCanvas, event) {
  const rect = targetCanvas.getBoundingClientRect();
  const scaleX = targetCanvas.width / rect.width;
  const scaleY = targetCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function screenToWorld(currentState, data, screen) {
  const zoom = getCameraZoom(data, currentState);
  return {
    x: screen.x / zoom + currentState.run.cameraX,
    y: screen.y / zoom + currentState.run.cameraY,
  };
}

function pointInPlatform(point, platform) {
  return (
    point.x >= platform.x
    && point.x <= platform.x + platform.width
    && point.y >= platform.y
    && point.y <= platform.y + platform.height
  );
}

function findPlatformAtPoint(data, point) {
  for (let index = data.platforms.length - 1; index >= 0; index -= 1) {
    if (pointInPlatform(point, data.platforms[index])) {
      return index;
    }
  }
  return null;
}

function snapValue(value, step) {
  return Math.round(value / step) * step;
}

function pressVirtualKey(currentState, code) {
  if (!currentState.pressed.has(code)) {
    currentState.justPressed.add(code);
  }
  currentState.pressed.add(code);
}

function releaseVirtualKey(currentState, code) {
  currentState.pressed.delete(code);
}

function consumeShortcutState(currentState, code) {
  currentState.justPressed.delete(code);
  currentState.pressed.delete(code);
}

function getSceneActionLabel(currentState) {
  if (currentState.scene === SCENES.TITLE) {
    return currentState.save?.hasRun ? "이어하기" : "입장";
  }
  if (currentState.scene === SCENES.SHELTER) {
    return "출격";
  }
  if (currentState.scene === SCENES.RESULTS) {
    return "계속";
  }
  if (currentState.scene === SCENES.GAME_OVER) {
    return "재시도";
  }
  return "";
}

function syncLiveEditButton(currentDom, currentState, data) {
  if (!currentDom.liveEditButton) {
    return;
  }

  const available = isLiveEditAvailable(currentState, data);
  currentDom.liveEditButton.hidden = false;
  currentDom.liveEditButton.disabled = false;
  currentDom.liveEditButton.textContent = currentState.liveEdit.active
    ? "편집 ON"
    : available
      ? "라이브 편집"
      : "탐사 후 사용";
  currentDom.liveEditButton.classList.toggle("is-active", currentState.liveEdit.active);
  currentDom.liveEditButton.classList.toggle("is-unavailable", !available);
  currentDom.liveEditButton.setAttribute("aria-pressed", currentState.liveEdit.active ? "true" : "false");
  currentDom.liveEditButton.title = available
    ? "플랫폼을 바로 드래그해서 위치를 바꾼다"
    : "탐사 화면에서만 켤 수 있다";
}

function syncDebugButton(currentDom, currentState) {
  if (!currentDom.debugButton) {
    return;
  }

  currentDom.debugButton.textContent = currentState.debug.active ? "디버그 ON" : "디버그";
  currentDom.debugButton.classList.toggle("is-active", currentState.debug.active);
  currentDom.debugButton.setAttribute("aria-pressed", currentState.debug.active ? "true" : "false");
  currentDom.debugButton.title = "B, F3, ` 으로 토글";
}

function syncMovementTuningButton(currentDom) {
  if (!currentDom.movementTuningButton || !currentDom.movementTuningPanel) {
    return;
  }

  const isOpen = !currentDom.movementTuningPanel.hidden;
  currentDom.movementTuningButton.classList.toggle("is-active", isOpen);
  currentDom.movementTuningButton.setAttribute("aria-pressed", isOpen ? "true" : "false");
}

function renderMovementTuningFields(currentDom, movement) {
  if (!currentDom.movementTuningFields) {
    return;
  }

  const formatValue = (value, step) => {
    const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
    const stepText = String(step);
    const decimals = stepText.includes(".") ? stepText.split(".")[1].length : 0;
    return decimals > 0 ? safeValue.toFixed(decimals) : String(Math.round(safeValue));
  };

  const movementFields = SPRINT_TUNING_FIELDS.map(({ key, label, min, max, step }) => `
    <label class="movement-tuning-field">
      <span>${label}</span>
      <input
        type="number"
        min="${min}"
        max="${max}"
        step="${step}"
        data-sprint-field="${key}"
        value="${formatValue(movement[key], step)}"
      >
    </label>
  `).join("");

  const crow = runtimeData.hostileDrones?.find((entry) => entry.visualKind === "crow") ?? runtimeData.hostileDrones?.[0];
  const crowFields = crow
    ? CROW_TUNING_FIELDS.map(({ key, label, min, max, step }) => `
      <label class="movement-tuning-field">
        <span>${label}</span>
        <input
          type="number"
          min="${min}"
          max="${max}"
          step="${step}"
          data-crow-field="${key}"
          value="${formatValue(crow[key], step)}"
        >
      </label>
    `).join("")
    : "";
  const faceOff = runtimeData.faceOff ?? {};
  const faceOffFields = FACE_OFF_TUNING_FIELDS.map(({ key, label, min, max, step }) => `
    <label class="movement-tuning-field">
      <span>${label}</span>
      <input
        type="number"
        min="${min}"
        max="${max}"
        step="${step}"
        data-faceoff-field="${key}"
        value="${formatValue(faceOff[key], step)}"
      >
    </label>
  `).join("");

  currentDom.movementTuningFields.innerHTML = `
    <div class="movement-tuning-section">Movement</div>
    ${movementFields}
    <div class="movement-tuning-section">Crow</div>
    ${crowFields}
    <div class="movement-tuning-section">Face-off Dialogue</div>
    ${faceOffFields}
  `;
}

function setMovementTuningPanelOpen(currentDom, isOpen) {
  if (!currentDom.movementTuningPanel) {
    return;
  }

  currentDom.movementTuningPanel.hidden = !isOpen;
  syncMovementTuningButton(currentDom);
}

function applySprintFieldValue(data, field, value) {
  const config = SPRINT_TUNING_FIELDS.find((entry) => entry.key === field);
  if (!config) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const stepText = String(config.step);
  const isIntegerStep = !stepText.includes(".");
  const clamped = Math.max(config.min, Math.min(config.max, numeric));
  const next = isIntegerStep ? Math.round(clamped) : clamped;
  data.player.movement[field] = next;
  return next;
}

function applyFaceOffFieldValue(data, field, value) {
  const config = FACE_OFF_TUNING_FIELDS.find((entry) => entry.key === field);
  if (!config || !data.faceOff) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const stepText = String(config.step);
  const decimals = stepText.includes(".") ? stepText.split(".")[1].length : 0;
  const clamped = Math.max(config.min, Math.min(config.max, numeric));
  const next = Number(clamped.toFixed(decimals));
  data.faceOff[field] = next;
  return next;
}

function syncFaceOffTuningToRun(currentState, data) {
  const faceOff = currentState.run?.faceOff;
  if (!faceOff || !data.faceOff) {
    return;
  }

  faceOff.enemyLineCharDelay = data.faceOff.enemyLineCharDelay ?? faceOff.enemyLineCharDelay;
  faceOff.choiceRevealHold = data.faceOff.enemyLineHoldDuration ?? faceOff.choiceRevealHold;
  faceOff.choiceRevealDuration = data.faceOff.choiceSlideDuration ?? faceOff.choiceRevealDuration;
}

function syncMovementTuningToRun(currentState, data) {
  const player = currentState.run?.player;
  if (!player) {
    return;
  }

  const nextMax = Math.max(1, Math.floor(data.player.movement.maxDashCount ?? 1));
  if (!Number.isFinite(player.dashMaxCount) || player.dashMaxCount <= 0) {
    player.dashMaxCount = nextMax;
  }
  if (!Number.isFinite(player.dashCharges)) {
    player.dashCharges = player.dashMaxCount;
  }

  if (nextMax !== player.dashMaxCount) {
    const grewBy = nextMax - player.dashMaxCount;
    player.dashMaxCount = nextMax;
    player.dashCharges = clampValue(
      player.dashCharges + Math.max(0, grewBy),
      0,
      player.dashMaxCount,
    );
  } else {
    player.dashCharges = clampValue(player.dashCharges, 0, player.dashMaxCount);
  }

  player.dashAvailable = player.dashCharges > 0 && player.dashCooldownTimer === 0;

  const nextShotMax = Math.max(1, Math.floor(data.player.movement.recoilShotCharges ?? 1));
  if (!Number.isFinite(player.recoilShotMaxCharges) || player.recoilShotMaxCharges <= 0) {
    player.recoilShotMaxCharges = nextShotMax;
  }
  if (!Number.isFinite(player.recoilShotCharges)) {
    player.recoilShotCharges = player.recoilShotMaxCharges;
  }

  if (nextShotMax !== player.recoilShotMaxCharges) {
    const grewBy = nextShotMax - player.recoilShotMaxCharges;
    player.recoilShotMaxCharges = nextShotMax;
    player.recoilShotCharges = clampValue(
      player.recoilShotCharges + Math.max(0, grewBy),
      0,
      player.recoilShotMaxCharges,
    );
  } else {
    player.recoilShotCharges = clampValue(player.recoilShotCharges, 0, player.recoilShotMaxCharges);
  }
}

function syncBrowserControls(currentDom, currentState) {
  document.body.classList.toggle("is-map-overlay-active", Boolean(currentState.run?.mapOverlay?.active));

  if (currentDom.sceneActionButton) {
    const sceneActionVisible = currentState.scene !== SCENES.EXPEDITION;
    currentDom.sceneActionButton.hidden = !sceneActionVisible;
    currentDom.sceneActionButton.textContent = getSceneActionLabel(currentState);
  }

  if (currentDom.touchControls) {
    const hidden = currentState.scene !== SCENES.EXPEDITION || currentState.liveEdit.active;
    currentDom.touchControls.hidden = hidden;
    if (hidden) {
      currentDom.touchButtons.forEach((button) => {
        button.classList.remove("is-pressed");
        if (button.dataset.code) {
          releaseVirtualKey(currentState, button.dataset.code);
        }
      });
    }
  }
}

function bindTouchHold(button, currentState, code) {
  const release = () => {
    button.classList.remove("is-pressed");
    releaseVirtualKey(currentState, code);
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.classList.add("is-pressed");
    pressVirtualKey(currentState, code);
    if (button.setPointerCapture) {
      button.setPointerCapture(event.pointerId);
    }
  });

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("pointerleave", (event) => {
    if (event.buttons === 0) {
      release();
    }
  });
}

function bindUi(currentDom, currentState, data) {
  const getWorldPoint = (event) => screenToWorld(currentState, data, getCanvasPoint(currentDom.canvas, event));
  const pointerLockAimEnabled = false;
  const isAimPointerLocked = () => document.pointerLockElement === currentDom.canvas;
  const requestAimPointerLock = () => {
    if (!pointerLockAimEnabled) {
      return;
    }
    if (isAimPointerLocked() || !currentDom.canvas.requestPointerLock) {
      return;
    }
    try {
      const lockRequest = currentDom.canvas.requestPointerLock();
      if (lockRequest && typeof lockRequest.catch === "function") {
        lockRequest.catch(() => {});
      }
    } catch {
      // Pointer lock is a reliability upgrade for mouse chords; normal mouse input remains as fallback.
    }
  };
  const releaseAimPointerLock = () => {
    if (isAimPointerLocked() && document.exitPointerLock) {
      document.exitPointerLock();
    }
  };
  const isFaceOffVirtualCursorActive = () => (
    currentState.scene === SCENES.EXPEDITION &&
    currentState.run?.faceOff?.active
  );
  const isMapOverlayActive = () => (
    currentState.scene === SCENES.EXPEDITION &&
    Boolean(currentState.run?.mapOverlay?.active)
  );
  const getMapOverlay = () => currentState.run?.mapOverlay || null;
  const stopMapOverlayDrag = () => {
    const overlay = getMapOverlay();
    if (!overlay) {
      return;
    }
    overlay.dragging = false;
    overlay.dragPointerId = null;
  };
  const syncVirtualMouseFromMovement = (event) => {
    const rect = currentDom.canvas.getBoundingClientRect();
    const scaleX = currentDom.canvas.width / Math.max(1, rect.width);
    const scaleY = currentDom.canvas.height / Math.max(1, rect.height);
    let movementX = typeof event.movementX === "number" ? event.movementX : 0;
    let movementY = typeof event.movementY === "number" ? event.movementY : 0;
    if (movementX === 0 && movementY === 0) {
      const previousClientX = Number.isFinite(currentState.mouse.clientX) ? currentState.mouse.clientX : event.clientX;
      const previousClientY = Number.isFinite(currentState.mouse.clientY) ? currentState.mouse.clientY : event.clientY;
      movementX = event.clientX - previousClientX;
      movementY = event.clientY - previousClientY;
    }
    currentState.mouse.clientX = event.clientX;
    currentState.mouse.clientY = event.clientY;
    currentState.mouse.screenX = clampValue(
      currentState.mouse.screenX + movementX * scaleX,
      0,
      currentDom.canvas.width
    );
    currentState.mouse.screenY = clampValue(
      currentState.mouse.screenY + movementY * scaleY,
      0,
      currentDom.canvas.height
    );
    currentState.mouse.onCanvas = true;
  };
  const syncMouseFromEvent = (event) => {
    if (isFaceOffVirtualCursorActive()) {
      syncVirtualMouseFromMovement(event);
      return;
    }

    if (isAimPointerLocked()) {
      if (
        (event.movementX !== 0 || event.movementY !== 0) &&
        typeof event.movementX === "number" &&
        typeof event.movementY === "number"
      ) {
        syncVirtualMouseFromMovement(event);
      }
      currentState.mouse.onCanvas = true;
      return;
    }

    const point = getCanvasPoint(currentDom.canvas, event);
    currentState.mouse.clientX = event.clientX;
    currentState.mouse.clientY = event.clientY;
    currentState.mouse.screenX = clampValue(point.x, 0, currentDom.canvas.width);
    currentState.mouse.screenY = clampValue(point.y, 0, currentDom.canvas.height);
    currentState.mouse.onCanvas = (
      point.x >= 0 &&
      point.x <= currentDom.canvas.width &&
      point.y >= 0 &&
      point.y <= currentDom.canvas.height
    );
  };
  const markPrimaryMouseDown = () => {
    if (!currentState.mouse.primaryDown) {
      currentState.mouse.primaryJustPressed = true;
    }
    currentState.mouse.primaryDown = true;
    pushInputTrace(currentState, "markP", {
      p: Number(currentState.mouse.primaryDown),
      pj: Number(currentState.mouse.primaryJustPressed),
      s: Number(currentState.mouse.secondaryDown),
    });
  };
  const markSecondaryMouseDown = () => {
    if (!currentState.mouse.secondaryDown) {
      currentState.mouse.secondaryJustPressed = true;
    }
    currentState.mouse.secondaryDown = true;
    pushInputTrace(currentState, "markS", {
      p: Number(currentState.mouse.primaryDown),
      pj: Number(currentState.mouse.primaryJustPressed),
      s: Number(currentState.mouse.secondaryDown),
      sj: Number(currentState.mouse.secondaryJustPressed),
    });
  };
  const clearMouseButtons = () => {
    currentState.mouse.primaryDown = false;
    currentState.mouse.secondaryDown = false;
    currentState.mouse.primaryJustPressed = false;
    currentState.mouse.secondaryJustPressed = false;
    stopMapOverlayDrag();
    releaseAimPointerLock();
  };
  const clearPrimaryMouseButton = () => {
    currentState.mouse.primaryDown = false;
  };
  const releasePrimaryMouseButton = () => {
    currentState.mouse.primaryDown = false;
  };
  const releaseMouseButtons = () => {
    currentState.mouse.primaryDown = false;
    currentState.mouse.secondaryDown = false;
    currentState.mouse.secondaryJustPressed = false;
    stopMapOverlayDrag();
    releaseAimPointerLock();
  };
  const syncMouseButtonsFromEvent = (event) => {
    if (typeof event.buttons !== "number") {
      return;
    }
    if (event.buttons === 0) {
      if (currentState.mouse.secondaryDown && event.button !== 2) {
        clearPrimaryMouseButton();
        pushInputTrace(currentState, "sync0KeepS", {
          b: event.button,
          bs: event.buttons,
          pj: Number(currentState.mouse.primaryJustPressed),
        });
        return;
      }
      releaseMouseButtons();
      pushInputTrace(currentState, "sync0Release", {
        b: event.button,
        bs: event.buttons,
        pj: Number(currentState.mouse.primaryJustPressed),
      });
      return;
    }
    const primaryPressed = (event.buttons & 1) !== 0;
    const secondaryPressed = (event.buttons & 2) !== 0;
    if (primaryPressed && !currentState.mouse.primaryDown) {
      pushInputTrace(currentState, "syncPrimaryEdge", {
        b: event.button,
        bs: event.buttons,
        pj: Number(currentState.mouse.primaryJustPressed),
        s: Number(currentState.mouse.secondaryDown),
      });
      markPrimaryMouseDown();
    } else if (!primaryPressed && currentState.mouse.primaryDown) {
      pushInputTrace(currentState, "syncPrimaryRelease", {
        b: event.button,
        bs: event.buttons,
        pj: Number(currentState.mouse.primaryJustPressed),
        s: Number(currentState.mouse.secondaryDown),
      });
      releasePrimaryMouseButton();
    }
    if (secondaryPressed) {
      markSecondaryMouseDown();
    }
  };
  const handleRecoilMouseDown = (event) => {
    syncMouseFromEvent(event);

    if (isMapOverlayActive()) {
      return false;
    }

    if (currentState.scene !== SCENES.EXPEDITION || currentState.liveEdit.active) {
      return false;
    }

    const buttons = typeof event.buttons === "number" ? event.buttons : 0;
    const secondaryPressed = event.button === 2 || (buttons & 2) !== 0;
    const primaryPressed = event.button === 0 || (buttons & 1) !== 0;
    pushInputTrace(currentState, `down:${event.type}`, {
      b: event.button,
      bs: buttons,
      pp: Number(primaryPressed),
      sp: Number(secondaryPressed),
      p: Number(currentState.mouse.primaryDown),
      pj: Number(currentState.mouse.primaryJustPressed),
      s: Number(currentState.mouse.secondaryDown),
    });
    if (!primaryPressed && !secondaryPressed) {
      return false;
    }

    if (secondaryPressed) {
      markSecondaryMouseDown();
      requestAimPointerLock();
    }
    if (primaryPressed) {
      markPrimaryMouseDown();
    }
    event.preventDefault();
    return true;
  };
  const beginMapOverlayDrag = (event) => {
    if (!isMapOverlayActive() || event.button !== 0) {
      return false;
    }
    syncMouseFromEvent(event);
    const overlay = getMapOverlay();
    if (!overlay) {
      return false;
    }
    overlay.dragging = true;
    overlay.dragPointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
    overlay.dragStartX = currentState.mouse.screenX;
    overlay.dragStartY = currentState.mouse.screenY;
    overlay.dragStartPanX = Number.isFinite(overlay.panX) ? overlay.panX : 0;
    overlay.dragStartPanY = Number.isFinite(overlay.panY) ? overlay.panY : 0;
    currentDom.canvas.style.cursor = "grabbing";
    event.preventDefault();
    return true;
  };
  const updateMapOverlayDrag = (event) => {
    if (!isMapOverlayActive()) {
      return false;
    }
    syncMouseFromEvent(event);
    const overlay = getMapOverlay();
    if (!overlay) {
      return false;
    }
    if (!overlay.dragging || (Number.isFinite(overlay.dragPointerId) && event.pointerId !== overlay.dragPointerId)) {
      currentDom.canvas.style.cursor = "grab";
      return false;
    }
    overlay.panX = overlay.dragStartPanX + currentState.mouse.screenX - overlay.dragStartX;
    overlay.panY = overlay.dragStartPanY + currentState.mouse.screenY - overlay.dragStartY;
    currentDom.canvas.style.cursor = "grabbing";
    event.preventDefault();
    return true;
  };
  const zoomMapOverlay = (event) => {
    if (!isMapOverlayActive()) {
      return false;
    }
    const overlay = getMapOverlay();
    if (!overlay) {
      return false;
    }
    const currentZoom = clampValue(Number(overlay.zoom ?? 1), 0.55, 3.25);
    const nextZoom = clampValue(currentZoom * Math.exp(-event.deltaY * 0.0015), 0.55, 3.25);
    overlay.zoom = nextZoom;
    event.preventDefault();
    return true;
  };
  let flashTimer = null;

  renderMovementTuningFields(currentDom, data.player.movement);
  setMovementTuningPanelOpen(currentDom, false);

  currentDom.sceneActionButton?.addEventListener("click", () => {
    pressVirtualKey(currentState, "KeyC");
    window.setTimeout(() => releaseVirtualKey(currentState, "KeyC"), 80);
  });

  currentDom.debugButton?.addEventListener("click", () => {
    currentState.debug.active = !currentState.debug.active;
    syncDebugButton(currentDom, currentState);
  });

  currentDom.liveEditButton?.addEventListener("click", () => {
    if (!isLiveEditAvailable(currentState, data)) {
      currentDom.liveEditButton.classList.remove("is-flash");
      void currentDom.liveEditButton.offsetWidth;
      currentDom.liveEditButton.classList.add("is-flash");
      if (flashTimer) {
        clearTimeout(flashTimer);
      }
      flashTimer = window.setTimeout(() => {
        currentDom.liveEditButton.classList.remove("is-flash");
        flashTimer = null;
      }, 280);
      return;
    }
    toggleLiveEdit(currentState);
    syncLiveEditButton(currentDom, currentState, data);
  });

  currentDom.movementTuningButton?.addEventListener("click", () => {
    setMovementTuningPanelOpen(currentDom, currentDom.movementTuningPanel.hidden);
  });

  currentDom.movementTuningCloseButton?.addEventListener("click", () => {
    setMovementTuningPanelOpen(currentDom, false);
  });

  currentDom.movementTuningSaveButton?.addEventListener("click", () => {
    saveRuntimeOverride(data, currentState);
    syncMovementTuningToRun(currentState, data);
    syncCrowTuningToRun(currentState, data);
    syncFaceOffTuningToRun(currentState, data);
    renderMovementTuningFields(currentDom, data.player.movement);
  });

  currentDom.movementTuningResetButton?.addEventListener("click", () => {
    clearSprintTuning();
    applySprintTuning(data.player.movement, baseSprintTuning, GAME_DATA.player.movement);
    syncMovementTuningToRun(currentState, data);
    data.hostileDrones = GAME_DATA.hostileDrones.map((crow) => ({
      ...crow,
      patrol: crow.patrol ? { ...crow.patrol } : undefined,
    }));
    data.faceOff.enemyLineCharDelay = GAME_DATA.faceOff.enemyLineCharDelay;
    data.faceOff.enemyLineHoldDuration = GAME_DATA.faceOff.enemyLineHoldDuration;
    data.faceOff.choiceSlideDuration = GAME_DATA.faceOff.choiceSlideDuration;
    syncCrowTuningToRun(currentState, data);
    syncFaceOffTuningToRun(currentState, data);
    renderMovementTuningFields(currentDom, data.player.movement);
  });

  currentDom.movementTuningFields?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const field = target.dataset.sprintField;
    if (field) {
      const next = applySprintFieldValue(data, field, target.value);
      if (next === null) {
        return;
      }
      syncMovementTuningToRun(currentState, data);
      target.value = String(next);
      return;
    }

    const crowField = target.dataset.crowField;
    if (crowField) {
      const next = applyCrowFieldValue(data, crowField, target.value);
      if (next === null) {
        return;
      }
      syncCrowTuningToRun(currentState, data);
      target.value = String(next);
      return;
    }

    const faceOffField = target.dataset.faceoffField;
    if (!faceOffField) {
      return;
    }
    const next = applyFaceOffFieldValue(data, faceOffField, target.value);
    if (next === null) {
      return;
    }
    syncFaceOffTuningToRun(currentState, data);
    target.value = String(next);
  });

  currentDom.touchButtons.forEach((button) => {
    const code = button.dataset.code;
    if (code) {
      bindTouchHold(button, currentState, code);
    }
  });

  currentDom.canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  currentDom.canvas.addEventListener("pointermove", (event) => {
    if (updateMapOverlayDrag(event)) {
      return;
    }
    syncMouseFromEvent(event);
    syncMouseButtonsFromEvent(event);
  });

  currentDom.canvas.addEventListener("pointerdown", (event) => {
    if (beginMapOverlayDrag(event)) {
      if (currentDom.canvas.setPointerCapture) {
        try {
          currentDom.canvas.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is best-effort; window-level pointer handlers still finish the drag.
        }
      }
      return;
    }
    if (handleRecoilMouseDown(event)) {
      if (currentDom.canvas.setPointerCapture) {
        try {
          currentDom.canvas.setPointerCapture(event.pointerId);
        } catch {
          // Pointer lock can make pointer capture invalid; mouse input is already routed to the canvas.
        }
      }
    }
  });

  currentDom.canvas.addEventListener("mousedown", (event) => {
    if (isMapOverlayActive()) {
      event.preventDefault();
      return;
    }
    handleRecoilMouseDown(event);
  });

  currentDom.canvas.addEventListener("wheel", (event) => {
    zoomMapOverlay(event);
  }, { passive: false });

  window.addEventListener("mousedown", (event) => {
    const buttons = typeof event.buttons === "number" ? event.buttons : 0;
    const aimingOrCombinedClick =
      isFaceOffVirtualCursorActive() ||
      currentState.mouse.secondaryDown ||
      event.button === 2 ||
      (buttons & 2) !== 0 ||
      ((buttons & 1) !== 0 && (buttons & 2) !== 0);
    if (!aimingOrCombinedClick) {
      return;
    }

    handleRecoilMouseDown(event);
  }, true);

  currentDom.canvas.addEventListener("pointerdown", (event) => {
    if (!isLiveEditAvailable(currentState, data) || event.button !== 0 || !currentState.liveEdit.active) {
      return;
    }

    const world = getWorldPoint(event);
    const hitIndex = findPlatformAtPoint(data, world);
    currentState.liveEdit.selectedPlatformIndex = hitIndex;
    currentState.liveEdit.hoverPlatformIndex = hitIndex;

    if (hitIndex === null) {
      currentState.liveEdit.drag = null;
      return;
    }

    const platform = data.platforms[hitIndex];
    currentState.liveEdit.drag = {
      index: hitIndex,
      offsetX: world.x - platform.x,
      offsetY: world.y - platform.y,
      moved: false,
    };
    event.preventDefault();
  });

  window.addEventListener("pointermove", (event) => {
    if (updateMapOverlayDrag(event)) {
      return;
    }

    if (isFaceOffVirtualCursorActive() || currentState.mouse.secondaryDown || currentState.mouse.primaryDown) {
      syncMouseFromEvent(event);
      syncMouseButtonsFromEvent(event);
    }

    if (isFaceOffVirtualCursorActive()) {
      currentDom.canvas.style.cursor = "none";
      return;
    }

    if (!isLiveEditAvailable(currentState, data) || !currentState.run) {
      currentDom.canvas.style.cursor = "";
      return;
    }

    if (!currentState.liveEdit.active) {
      currentDom.canvas.style.cursor = "";
      return;
    }

    const world = getWorldPoint(event);
    currentDom.canvas.style.cursor = currentState.liveEdit.drag ? "grabbing" : "grab";

    if (currentState.liveEdit.drag) {
      const platform = data.platforms[currentState.liveEdit.drag.index];
      if (!platform) {
        currentState.liveEdit.drag = null;
        return;
      }

      const snap = data.scale?.subTileSize ?? 16;
      const nextX = snapValue(world.x - currentState.liveEdit.drag.offsetX, snap);
      const nextY = snapValue(world.y - currentState.liveEdit.drag.offsetY, snap);
      const maxX = Math.max(0, data.world.width - platform.width);
      const maxY = Math.max(0, data.world.height - platform.height);
      if (nextX !== platform.x || nextY !== platform.y) {
        platform.x = clampValue(nextX, 0, maxX);
        platform.y = clampValue(nextY, 0, maxY);
        currentState.liveEdit.drag.moved = true;
      }
      return;
    }

    currentState.liveEdit.hoverPlatformIndex = findPlatformAtPoint(data, world);
  });

  window.addEventListener("pointerup", (event) => {
    if (isMapOverlayActive()) {
      stopMapOverlayDrag();
    }
    const primaryReleaseDuringFocus = event.button === 0 && currentState.mouse.secondaryDown;
    pushInputTrace(currentState, `up:${event.type}`, {
      b: event.button,
      bs: typeof event.buttons === "number" ? event.buttons : "?",
      prf: Number(primaryReleaseDuringFocus),
      pj: Number(currentState.mouse.primaryJustPressed),
      s: Number(currentState.mouse.secondaryDown),
    });
    if (event.buttons === 0 && !primaryReleaseDuringFocus) {
      releaseMouseButtons();
    } else if (event.buttons !== 0) {
      syncMouseButtonsFromEvent(event);
    }
    if (event.button === 0) {
      releasePrimaryMouseButton();
    }
    if (event.button === 2) {
      currentState.mouse.secondaryDown = false;
      releaseAimPointerLock();
    }

    if (!isLiveEditAvailable(currentState, data) || !currentState.liveEdit.active || !currentState.liveEdit.drag) {
      return;
    }

    if (currentState.liveEdit.drag.moved) {
      saveLiveEdit(data, currentState);
    }

    currentState.liveEdit.drag = null;
  });

  window.addEventListener("mouseup", (event) => {
    if (isMapOverlayActive()) {
      stopMapOverlayDrag();
    }
    const primaryReleaseDuringFocus = event.button === 0 && currentState.mouse.secondaryDown;
    pushInputTrace(currentState, `up:${event.type}`, {
      b: event.button,
      bs: typeof event.buttons === "number" ? event.buttons : "?",
      prf: Number(primaryReleaseDuringFocus),
      pj: Number(currentState.mouse.primaryJustPressed),
      s: Number(currentState.mouse.secondaryDown),
    });
    if (event.buttons === 0 && !primaryReleaseDuringFocus) {
      releaseMouseButtons();
      return;
    }
    if (event.buttons !== 0) {
      syncMouseButtonsFromEvent(event);
    }
    if (event.button === 0) {
      releasePrimaryMouseButton();
    }
    if (event.button === 2) {
      currentState.mouse.secondaryDown = false;
      releaseAimPointerLock();
    }
  });

  window.addEventListener("pointercancel", clearMouseButtons);

  document.addEventListener("pointerlockchange", () => {
    if (isAimPointerLocked()) {
      return;
    }
    if (currentState.mouse.secondaryDown) {
      currentState.mouse.secondaryDown = false;
      currentState.mouse.primaryDown = false;
      currentState.mouse.secondaryJustPressed = false;
    }
  });

  window.addEventListener("blur", () => {
    clearMouseButtons();
  });

  window.addEventListener("keydown", (event) => {
    const lowerKey = event.key.toLowerCase();
    const code = event.code;

    if ((event.ctrlKey || event.metaKey) && lowerKey === "s") {
      event.preventDefault();
      saveRuntimeOverride(data, currentState);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && code === "KeyM") {
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      consumeShortcutState(currentState, code);
      openLevelEditor(data, currentState);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.repeat && ["KeyP", "KeyL", "KeyB", "KeyM", "KeyT"].includes(code)) {
      event.preventDefault();
      return;
    }

    if (code === "KeyP") {
      event.preventDefault();
      consumeShortcutState(currentState, code);
      jumpToExpedition(currentState, data);
      return;
    }

    if (code === "KeyL" && isLiveEditAvailable(currentState, data)) {
      event.preventDefault();
      consumeShortcutState(currentState, code);
      toggleLiveEdit(currentState);
      syncLiveEditButton(currentDom, currentState, data);
      return;
    }

    if (code === "KeyB") {
      event.preventDefault();
      consumeShortcutState(currentState, code);
      currentState.debug.active = !currentState.debug.active;
      syncDebugButton(currentDom, currentState);
      return;
    }

    if (code === "KeyT") {
      event.preventDefault();
      consumeShortcutState(currentState, code);
      setMovementTuningPanelOpen(currentDom, currentDom.movementTuningPanel.hidden);
    }
  });
}

function syncAimPointerLock(currentDom, currentState) {
  if (
    document.pointerLockElement === currentDom.canvas &&
    (
      currentState.scene !== SCENES.EXPEDITION ||
      currentState.liveEdit.active ||
      !currentState.mouse?.secondaryDown
    ) &&
    document.exitPointerLock
  ) {
    document.exitPointerLock();
  }
}

function getCrowTuningConfig(field) {
  return CROW_TUNING_FIELDS.find((entry) => entry.key === field) ?? null;
}

function updateCrowCollisionInsets(crow) {
  crow.solidInsetX = Math.max(0, Math.round(crow.width * 0.11));
  crow.solidInsetY = Math.max(0, Math.round(crow.height * 0.15));
  crow.damageInsetX = Math.max(0, Math.round(crow.width * 0.07));
  crow.damageInsetY = Math.max(0, Math.round(crow.height * 0.11));
}

function applyCrowFieldValue(data, field, value) {
  const config = getCrowTuningConfig(field);
  if (!config || !Array.isArray(data.hostileDrones)) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const stepText = String(config.step);
  const isIntegerStep = !stepText.includes(".");
  const clamped = Math.max(config.min, Math.min(config.max, numeric));
  const next = isIntegerStep ? Math.round(clamped) : Number(clamped.toFixed(stepText.split(".")[1]?.length ?? 0));

  data.hostileDrones
    .filter((crow) => crow.visualKind === "crow")
    .forEach((crow) => {
      crow[field] = next;
      if (field === "width" || field === "height") {
        updateCrowCollisionInsets(crow);
      }
    });

  return next;
}

function syncCrowTuningToRun(currentState, data) {
  const runCrows = currentState.run?.hostileDrones;
  if (!Array.isArray(runCrows) || !Array.isArray(data.hostileDrones)) {
    return;
  }

  for (const source of data.hostileDrones) {
    const target = runCrows.find((crow) => crow.id === source.id);
    if (!target) {
      continue;
    }

    const centerX = target.x + target.width * 0.5;
    const centerY = target.y + target.height * 0.5;
    CROW_TUNING_FIELDS.forEach(({ key }) => {
      target[key] = source[key];
    });
    target.solidInsetX = source.solidInsetX;
    target.solidInsetY = source.solidInsetY;
    target.backCatchPaddingX = source.backCatchPaddingX;
    target.backCatchForgivenessY = source.backCatchForgivenessY;
    target.damageInsetX = source.damageInsetX;
    target.damageInsetY = source.damageInsetY;
    target.x = centerX - target.width * 0.5;
    target.y = centerY - target.height * 0.5;
    target.attackCooldown = Math.min(target.attackCooldown ?? 0, target.fireCooldown ?? target.attackCooldown ?? 0);
  }
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;
  state.debugFrame += 1;
  state.debugLastNow = now;
  state.debugLastDt = dt;

  try {
    updateGame(state, runtimeData, dt);
    syncAimPointerLock(dom, state);
    syncLiveEditButton(dom, state, runtimeData);
    syncDebugButton(dom, state);
    syncMovementTuningButton(dom);
    syncBrowserControls(dom, state);
    renderGame(dom, state, runtimeData);
    updateFaceOffDebugPanel(state, now);
  } catch (error) {
    console.error(error);
    updateFaceOffDebugPanel(state, now, error);
  }
  requestAnimationFrame(frame);
}

bindUi(dom, state, runtimeData);
syncLiveEditButton(dom, state, runtimeData);
syncDebugButton(dom, state);
syncMovementTuningButton(dom);
syncBrowserControls(dom, state);
window.addEventListener("beforeunload", () => {
  saveCurrentGame(state, runtimeData);
});
renderGame(dom, state, runtimeData);
updateFaceOffDebugPanel(state, performance.now());
requestAnimationFrame(frame);
