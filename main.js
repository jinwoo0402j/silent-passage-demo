import { GAME_DATA } from "./level-data.js?v=20260424-recoil-47";
import {
  createRuntimeGameData,
  extractEditableLevelData,
  saveLevelOverride,
} from "./level-store.js?v=20260424-recoil-47";
import {
  SPRINT_TUNING_FIELDS,
  applySprintTuning,
  clearSprintTuning,
  extractSprintTuning,
  loadSprintTuning,
  saveSprintTuning,
} from "./movement-tuning.js?v=20260424-recoil-47";
import { renderGame } from "./render.js?v=20260424-recoil-47";
import { SCENES, createInitialState, createRunState } from "./state.js?v=20260424-recoil-47";
import { bindInput, updateGame } from "./systems.js?v=20260424-recoil-47";

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
const CROW_TUNING_FIELDS = [
  { key: "width", label: "Crow Width", min: 36, max: 320, step: 1 },
  { key: "height", label: "Crow Height", min: 24, max: 220, step: 1 },
  { key: "fireCooldown", label: "Crow Attack Cooldown", min: 0.25, max: 14, step: 0.05 },
  { key: "initialCooldown", label: "Crow First Attack", min: 0, max: 14, step: 0.05 },
  { key: "diveSpeed", label: "Crow Dive Speed", min: 300, max: 3200, step: 10 },
  { key: "backCatchPaddingX", label: "Crow Back Width Bonus", min: 0, max: 120, step: 1 },
  { key: "backCatchForgivenessY", label: "Crow Back Snap Height", min: 0, max: 72, step: 1 },
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

const runtimeData = createRuntimeGameData(GAME_DATA);
const baseSprintTuning = extractSprintTuning(runtimeData.player.movement);
applySprintTuning(
  runtimeData.player.movement,
  loadSprintTuning(runtimeData.player.movement),
  runtimeData.player.movement,
);

const state = createInitialState(runtimeData);
bindInput(state);

let lastFrame = performance.now();

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
  saveLevelOverride(extractEditableLevelData(data), GAME_DATA);
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
  window.location.href = "./editor.html";
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
    return "입장";
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

  currentDom.movementTuningFields.innerHTML = `
    <div class="movement-tuning-section">Movement</div>
    ${movementFields}
    <div class="movement-tuning-section">Crow</div>
    ${crowFields}
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
  const syncMouseFromEvent = (event) => {
    if (isAimPointerLocked()) {
      if (
        (event.movementX !== 0 || event.movementY !== 0) &&
        typeof event.movementX === "number" &&
        typeof event.movementY === "number"
      ) {
        const rect = currentDom.canvas.getBoundingClientRect();
        const scaleX = currentDom.canvas.width / Math.max(1, rect.width);
        const scaleY = currentDom.canvas.height / Math.max(1, rect.height);
        currentState.mouse.screenX = clampValue(
          currentState.mouse.screenX + event.movementX * scaleX,
          0,
          currentDom.canvas.width
        );
        currentState.mouse.screenY = clampValue(
          currentState.mouse.screenY + event.movementY * scaleY,
          0,
          currentDom.canvas.height
        );
      }
      currentState.mouse.onCanvas = true;
      return;
    }

    const point = getCanvasPoint(currentDom.canvas, event);
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
  };
  const markSecondaryMouseDown = () => {
    currentState.mouse.secondaryDown = true;
  };
  const clearMouseButtons = () => {
    currentState.mouse.primaryDown = false;
    currentState.mouse.secondaryDown = false;
    currentState.mouse.primaryJustPressed = false;
    releaseAimPointerLock();
  };
  const syncMouseButtonsFromEvent = (event) => {
    if (typeof event.buttons !== "number") {
      return;
    }
    if (event.buttons === 0) {
      clearMouseButtons();
      return;
    }
    if ((event.buttons & 1) !== 0) {
      markPrimaryMouseDown();
    }
    if ((event.buttons & 2) !== 0) {
      markSecondaryMouseDown();
    }
  };
  const handleRecoilMouseDown = (event) => {
    syncMouseFromEvent(event);

    if (currentState.scene !== SCENES.EXPEDITION || currentState.liveEdit.active) {
      return false;
    }

    const buttons = typeof event.buttons === "number" ? event.buttons : 0;
    const secondaryPressed = event.button === 2 || (buttons & 2) !== 0;
    const primaryPressed = event.button === 0 || (buttons & 1) !== 0;
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
    syncCrowTuningToRun(currentState, data);
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
    if (!crowField) {
      return;
    }
    const next = applyCrowFieldValue(data, crowField, target.value);
    if (next === null) {
      return;
    }
    syncCrowTuningToRun(currentState, data);
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
    syncMouseFromEvent(event);
    syncMouseButtonsFromEvent(event);
  });

  currentDom.canvas.addEventListener("pointerdown", (event) => {
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
    handleRecoilMouseDown(event);
  });

  window.addEventListener("mousedown", (event) => {
    const buttons = typeof event.buttons === "number" ? event.buttons : 0;
    const aimingOrCombinedClick =
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
    if (currentState.mouse.secondaryDown || currentState.mouse.primaryDown) {
      syncMouseFromEvent(event);
      syncMouseButtonsFromEvent(event);
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
    const primaryReleaseDuringFocus = event.button === 0 && currentState.mouse.secondaryDown;
    if (primaryReleaseDuringFocus && !currentState.mouse.primaryDown) {
      markPrimaryMouseDown();
    }
    if (event.buttons === 0 && !primaryReleaseDuringFocus) {
      clearMouseButtons();
    } else if (event.buttons !== 0) {
      syncMouseButtonsFromEvent(event);
    }
    if (event.button === 0) {
      currentState.mouse.primaryDown = false;
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
    const primaryReleaseDuringFocus = event.button === 0 && currentState.mouse.secondaryDown;
    if (primaryReleaseDuringFocus && !currentState.mouse.primaryDown) {
      markPrimaryMouseDown();
    }
    if (event.buttons === 0 && !primaryReleaseDuringFocus) {
      clearMouseButtons();
      return;
    }
    if (event.buttons !== 0) {
      syncMouseButtonsFromEvent(event);
    }
    if (event.button === 0) {
      currentState.mouse.primaryDown = false;
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

    if (code === "KeyM") {
      event.preventDefault();
      consumeShortcutState(currentState, code);
      openLevelEditor(data, currentState);
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

  updateGame(state, runtimeData, dt);
  syncAimPointerLock(dom, state);
  syncLiveEditButton(dom, state, runtimeData);
  syncDebugButton(dom, state);
  syncMovementTuningButton(dom);
  syncBrowserControls(dom, state);
  renderGame(dom, state, runtimeData);
  requestAnimationFrame(frame);
}

bindUi(dom, state, runtimeData);
syncLiveEditButton(dom, state, runtimeData);
syncDebugButton(dom, state);
syncMovementTuningButton(dom);
syncBrowserControls(dom, state);
renderGame(dom, state, runtimeData);
requestAnimationFrame(frame);
