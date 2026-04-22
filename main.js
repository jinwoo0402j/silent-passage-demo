const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("statusText");
const editorToggleButton = document.getElementById("editorToggle");
const copyLevelButton = document.getElementById("copyLevelButton");
const resetDraftButton = document.getElementById("resetDraftButton");
const editorTypeSelect = document.getElementById("editorType");
const editorItemSelect = document.getElementById("editorItem");
const editorJson = document.getElementById("editorJson");
const applySelectionButton = document.getElementById("applySelectionButton");
const deleteSelectionButton = document.getElementById("deleteSelectionButton");
const addPlatformButton = document.getElementById("addPlatformButton");
const addLandmarkButton = document.getElementById("addLandmarkButton");
const addInteractableButton = document.getElementById("addInteractableButton");
const editorStatus = document.getElementById("editorStatus");

if (!window.LEVEL_DATA || !window.LEVEL_DATA.world || !window.LEVEL_DATA.level) {
  throw new Error("LEVEL_DATA is missing. Load level-data.js before main.js.");
}

const STORAGE_KEY = "silent-passage-level-draft-v1";
const PLAYER_SIZE = { width: 42, height: 60 };
const VIEW = {
  width: canvas.width,
  height: canvas.height,
};
const WORLD = window.LEVEL_DATA.world;
const DEFAULT_LEVEL = deepClone(window.LEVEL_DATA.level);
const level = loadLevelDraft();

const EDITOR_TYPES = [
  { key: "playerSpawn", label: "Player Spawn" },
  { key: "finishZone", label: "Finish Zone" },
  { key: "platforms", label: "Platforms" },
  { key: "landmarks", label: "Landmarks" },
  { key: "interactables", label: "Interactables" },
];

const state = {
  mode: "title",
  pressed: new Set(),
  justPressed: new Set(),
  player: createPlayer(),
  cameraX: 0,
  cameraY: 0,
  pulse: 0,
  particles: [],
  lastMessage: "Press Enter to begin",
  completionSeconds: 0,
  debugVisible: false,
  editorVisible: false,
  editorDragging: false,
  editorDragMoved: false,
  editorDragOffsetX: 0,
  editorDragOffsetY: 0,
  selectedType: "platforms",
  selectedIndex: 0,
};

const discoveries = new Map();
const revealed = new Set();

function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function loadLevelDraft() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return deepClone(DEFAULT_LEVEL);
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return deepClone(DEFAULT_LEVEL);
    }
    return {
      playerSpawn: parsed.playerSpawn || deepClone(DEFAULT_LEVEL.playerSpawn),
      finishZone: parsed.finishZone || deepClone(DEFAULT_LEVEL.finishZone),
      platforms: Array.isArray(parsed.platforms) ? parsed.platforms : deepClone(DEFAULT_LEVEL.platforms),
      landmarks: Array.isArray(parsed.landmarks) ? parsed.landmarks : deepClone(DEFAULT_LEVEL.landmarks),
      interactables: Array.isArray(parsed.interactables) ? parsed.interactables : deepClone(DEFAULT_LEVEL.interactables),
    };
  } catch {
    return deepClone(DEFAULT_LEVEL);
  }
}

function saveLevelDraft(message) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(level, null, 2));
    setEditorStatus(message);
  } catch {
    setEditorStatus("Draft could not be written to local storage.");
  }
}

function setEditorStatus(message) {
  editorStatus.textContent = message;
}

function resetDraftToDefault() {
  const reset = deepClone(DEFAULT_LEVEL);
  level.playerSpawn = reset.playerSpawn;
  level.finishZone = reset.finishZone;
  level.platforms = reset.platforms;
  level.landmarks = reset.landmarks;
  level.interactables = reset.interactables;
  window.localStorage.removeItem(STORAGE_KEY);
  rebuildDiscoveries();
  state.selectedType = "platforms";
  state.selectedIndex = 0;
  resetRun();
  syncEditorUI();
  setEditorStatus("Draft reset to the committed level data.");
}

function createPlayer() {
  return {
    x: level.playerSpawn.x,
    y: level.playerSpawn.y,
    width: PLAYER_SIZE.width,
    height: PLAYER_SIZE.height,
    vx: 0,
    vy: 0,
    speed: 380,
    jumpVelocity: -840,
    onGround: false,
    facing: 1,
  };
}

function rebuildDiscoveries() {
  discoveries.clear();
  for (const landmark of level.landmarks) {
    discoveries.set(landmark.id, false);
  }
  for (const thing of level.interactables) {
    discoveries.set(thing.id, false);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function snap(value) {
  const grid = WORLD.gridSize || 40;
  return Math.round(value / grid) * grid;
}

function syncCamera() {
  const player = state.player;
  const targetX = player.x - VIEW.width * 0.38;
  const targetY = player.y - VIEW.height * 0.55;
  state.cameraX = clamp(targetX, 0, WORLD.width - VIEW.width);
  state.cameraY = clamp(targetY, 0, WORLD.height - VIEW.height);
}

function getCollection(type) {
  if (type === "platforms" || type === "landmarks" || type === "interactables") {
    return level[type];
  }
  return null;
}

function getSelectedObject() {
  const collection = getCollection(state.selectedType);
  if (collection) {
    return collection[state.selectedIndex] || null;
  }
  return level[state.selectedType];
}

function getTypeLabel(type) {
  return EDITOR_TYPES.find((entry) => entry.key === type)?.label || type;
}

function getItemLabel(type, item, index) {
  if (!item) {
    return "Missing";
  }
  if (type === "platforms") {
    return `P${index} (${item.x}, ${item.y})`;
  }
  if (type === "landmarks" || type === "interactables") {
    return `${item.id || `${type}-${index + 1}`} (${item.x}, ${item.y})`;
  }
  return getTypeLabel(type);
}

function normalizeObject(type, value, index) {
  const numberOr = (input, fallback) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const stringOr = (input, fallback) => typeof input === "string" && input.length > 0 ? input : fallback;

  if (type === "playerSpawn") {
    return {
      x: numberOr(value.x, level.playerSpawn.x),
      y: numberOr(value.y, level.playerSpawn.y),
    };
  }

  if (type === "finishZone") {
    return {
      x: numberOr(value.x, level.finishZone.x),
      y: numberOr(value.y, level.finishZone.y),
      width: numberOr(value.width, level.finishZone.width),
      height: numberOr(value.height, level.finishZone.height),
    };
  }

  if (type === "platforms") {
    return {
      x: numberOr(value.x, 0),
      y: numberOr(value.y, 0),
      width: Math.max(20, numberOr(value.width, 160)),
      height: Math.max(10, numberOr(value.height, 24)),
      color: stringOr(value.color, "#61788f"),
      hidden: Boolean(value.hidden),
      ...(value.revealId ? { revealId: String(value.revealId) } : {}),
    };
  }

  if (type === "landmarks") {
    return {
      id: stringOr(value.id, `landmark-${index + 1}`),
      x: numberOr(value.x, 0),
      y: numberOr(value.y, 0),
      width: Math.max(20, numberOr(value.width, 44)),
      height: Math.max(20, numberOr(value.height, 64)),
      title: stringOr(value.title, `Landmark ${index + 1}`),
      body: stringOr(value.body, "A point of interest."),
      autoRadius: Math.max(0, numberOr(value.autoRadius, 160)),
    };
  }

  if (type === "interactables") {
    return {
      id: stringOr(value.id, `interactable-${index + 1}`),
      x: numberOr(value.x, 0),
      y: numberOr(value.y, 0),
      width: Math.max(20, numberOr(value.width, 48)),
      height: Math.max(20, numberOr(value.height, 64)),
      title: stringOr(value.title, `Interactable ${index + 1}`),
      body: stringOr(value.body, "Interactive object."),
      reveals: Array.isArray(value.reveals) ? value.reveals.map(String) : [],
    };
  }

  return value;
}

function setSelectedObject(nextValue) {
  const normalized = normalizeObject(state.selectedType, nextValue, state.selectedIndex);
  const collection = getCollection(state.selectedType);

  if (collection) {
    collection[state.selectedIndex] = normalized;
  } else {
    level[state.selectedType] = normalized;
  }

  rebuildDiscoveries();
  if (state.selectedType === "playerSpawn") {
    state.player.x = level.playerSpawn.x;
    state.player.y = level.playerSpawn.y;
    syncCamera();
  }
  syncEditorUI();
}

function syncEditorTypeOptions() {
  editorTypeSelect.innerHTML = "";
  EDITOR_TYPES.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.key;
    option.textContent = entry.label;
    editorTypeSelect.appendChild(option);
  });
}

function syncEditorItemOptions() {
  const type = state.selectedType;
  const collection = getCollection(type);
  editorItemSelect.innerHTML = "";

  if (collection) {
    collection.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = getItemLabel(type, item, index);
      editorItemSelect.appendChild(option);
    });
    state.selectedIndex = clamp(state.selectedIndex, 0, Math.max(0, collection.length - 1));
    editorItemSelect.disabled = collection.length === 0;
    if (collection.length > 0) {
      editorItemSelect.value = String(state.selectedIndex);
    }
  } else {
    const option = document.createElement("option");
    option.value = "0";
    option.textContent = getTypeLabel(type);
    editorItemSelect.appendChild(option);
    editorItemSelect.disabled = true;
    state.selectedIndex = 0;
  }
}

function syncSelectionTextarea() {
  const selected = getSelectedObject();
  editorJson.value = selected ? JSON.stringify(selected, null, 2) : "";
  deleteSelectionButton.disabled = !getCollection(state.selectedType);
}

function syncEditorUI() {
  document.body.classList.toggle("editor-active", state.editorVisible);
  editorToggleButton.textContent = state.editorVisible ? "Close Design Mode" : "Open Design Mode";
  editorTypeSelect.value = state.selectedType;
  syncEditorItemOptions();
  syncSelectionTextarea();
}

function selectEditorTarget(type, index = 0) {
  state.selectedType = type;
  state.selectedIndex = index;
  syncEditorUI();
}

function createNewObject(type) {
  const centerX = snap(state.cameraX + VIEW.width * 0.5);
  const centerY = snap(state.cameraY + VIEW.height * 0.6);

  if (type === "platforms") {
    return {
      x: centerX,
      y: centerY,
      width: 160,
      height: 24,
      color: "#708596",
      hidden: false,
    };
  }

  if (type === "landmarks") {
    return {
      id: `landmark-${level.landmarks.length + 1}`,
      x: centerX,
      y: centerY - 80,
      width: 44,
      height: 72,
      title: `Landmark ${level.landmarks.length + 1}`,
      body: "New visual discovery point.",
      autoRadius: 160,
    };
  }

  return {
    id: `interactable-${level.interactables.length + 1}`,
    x: centerX,
    y: centerY - 80,
    width: 48,
    height: 64,
    title: `Interactable ${level.interactables.length + 1}`,
    body: "New interaction.",
    reveals: [],
  };
}

function addObject(type) {
  const collection = getCollection(type);
  const next = normalizeObject(type, createNewObject(type), collection.length);
  collection.push(next);
  rebuildDiscoveries();
  selectEditorTarget(type, collection.length - 1);
  saveLevelDraft(`${getTypeLabel(type)} added to the draft.`);
}

function deleteSelectedObject() {
  const collection = getCollection(state.selectedType);
  if (!collection || collection.length === 0) {
    return;
  }
  collection.splice(state.selectedIndex, 1);
  rebuildDiscoveries();
  state.selectedIndex = Math.max(0, state.selectedIndex - 1);
  syncEditorUI();
  saveLevelDraft(`${getTypeLabel(state.selectedType)} removed from the draft.`);
}

function copyFullLevel() {
  const exportText = `window.LEVEL_DATA = ${JSON.stringify({ world: WORLD, level }, null, 2)};\n`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(exportText)
      .then(() => setEditorStatus("Copied the full level payload. Paste it into level-data.js if you want to commit it."))
      .catch(() => setEditorStatus("Clipboard write failed. Copy the JSON from the browser console instead."));
    return;
  }
  setEditorStatus("Clipboard API is unavailable in this browser.");
}

function toggleEditorMode(forceValue) {
  state.editorVisible = typeof forceValue === "boolean" ? forceValue : !state.editorVisible;
  if (state.editorVisible) {
    state.debugVisible = true;
    setEditorStatus("Design mode on. Drag objects in the canvas or edit the selection JSON.");
  } else {
    state.editorDragging = false;
    setEditorStatus("Design mode off.");
  }
  syncEditorUI();
}

function getCanvasWorldPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX + state.cameraX,
    y: (event.clientY - rect.top) * scaleY + state.cameraY,
  };
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function getEditorTargets() {
  const targets = [];

  targets.push({
    type: "playerSpawn",
    index: 0,
    rect: {
      x: level.playerSpawn.x,
      y: level.playerSpawn.y,
      width: PLAYER_SIZE.width,
      height: PLAYER_SIZE.height,
    },
  });

  targets.push({
    type: "finishZone",
    index: 0,
    rect: level.finishZone,
  });

  level.platforms.forEach((platform, index) => {
    targets.push({ type: "platforms", index, rect: platform });
  });
  level.landmarks.forEach((landmark, index) => {
    targets.push({ type: "landmarks", index, rect: landmark });
  });
  level.interactables.forEach((item, index) => {
    targets.push({ type: "interactables", index, rect: item });
  });

  return targets;
}

function getTargetAtPoint(point) {
  const priority = ["interactables", "landmarks", "finishZone", "playerSpawn", "platforms"];
  const targets = getEditorTargets().filter((target) => pointInRect(point, target.rect));
  targets.sort((left, right) => priority.indexOf(left.type) - priority.indexOf(right.type));
  return targets[0] || null;
}

function applyDragPosition(point) {
  const selected = getSelectedObject();
  if (!selected) {
    return;
  }

  const width = selected.width || PLAYER_SIZE.width;
  const height = selected.height || PLAYER_SIZE.height;
  selected.x = clamp(snap(point.x - state.editorDragOffsetX), 0, WORLD.width - width);
  selected.y = clamp(snap(point.y - state.editorDragOffsetY), 0, WORLD.height - height);

  if (state.selectedType === "playerSpawn") {
    state.player.x = selected.x;
    state.player.y = selected.y;
    syncCamera();
  }

  syncSelectionTextarea();
}

canvas.addEventListener("mousedown", (event) => {
  if (!state.editorVisible) {
    return;
  }

  const point = getCanvasWorldPoint(event);
  const target = getTargetAtPoint(point);
  if (!target) {
    return;
  }

  selectEditorTarget(target.type, target.index);
  state.editorDragging = true;
  state.editorDragMoved = false;
  state.editorDragOffsetX = point.x - target.rect.x;
  state.editorDragOffsetY = point.y - target.rect.y;
});

window.addEventListener("mousemove", (event) => {
  if (!state.editorVisible || !state.editorDragging) {
    return;
  }

  const point = getCanvasWorldPoint(event);
  applyDragPosition(point);
  state.editorDragMoved = true;
});

window.addEventListener("mouseup", () => {
  if (!state.editorDragging) {
    return;
  }

  state.editorDragging = false;
  if (state.editorDragMoved) {
    saveLevelDraft(`${getTypeLabel(state.selectedType)} moved in the draft.`);
  }
});

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "F2", "F3"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "F2") {
    state.debugVisible = !state.debugVisible;
    return;
  }

  if (event.code === "F3") {
    toggleEditorMode();
    return;
  }

  if (!state.pressed.has(event.code)) {
    state.justPressed.add(event.code);
  }
  state.pressed.add(event.code);
});

window.addEventListener("keyup", (event) => {
  state.pressed.delete(event.code);
});

editorToggleButton.addEventListener("click", () => toggleEditorMode());
copyLevelButton.addEventListener("click", () => copyFullLevel());
resetDraftButton.addEventListener("click", () => resetDraftToDefault());
applySelectionButton.addEventListener("click", () => {
  try {
    const parsed = JSON.parse(editorJson.value);
    setSelectedObject(parsed);
    saveLevelDraft(`${getTypeLabel(state.selectedType)} JSON applied.`);
  } catch {
    setEditorStatus("Selection JSON is invalid. Fix it and apply again.");
  }
});
deleteSelectionButton.addEventListener("click", () => deleteSelectedObject());
addPlatformButton.addEventListener("click", () => addObject("platforms"));
addLandmarkButton.addEventListener("click", () => addObject("landmarks"));
addInteractableButton.addEventListener("click", () => addObject("interactables"));
editorTypeSelect.addEventListener("change", (event) => {
  selectEditorTarget(event.target.value, 0);
});
editorItemSelect.addEventListener("change", (event) => {
  state.selectedIndex = Number(event.target.value);
  syncEditorUI();
});

function resetRun() {
  state.player = createPlayer();
  state.particles.length = 0;
  state.completionSeconds = 0;
  state.mode = "title";
  state.lastMessage = "Press Enter to begin";
  state.pressed.clear();
  state.justPressed.clear();
  rebuildDiscoveries();
  revealed.clear();
  syncCamera();
  updateStatus();
}

function startRun() {
  state.mode = "playing";
  state.lastMessage = "Follow anything that feels intentional.";
  updateStatus();
}

function completeRun() {
  state.mode = "completed";
  state.lastMessage = `Run complete in ${state.completionSeconds.toFixed(1)}s. Press R to restart.`;
  burstParticles(
    level.finishZone.x + level.finishZone.width / 2,
    level.finishZone.y + 20,
    18,
    "#f7d979"
  );
  updateStatus();
}

function updateStatus() {
  const foundCount = Array.from(discoveries.values()).filter(Boolean).length;
  const total = discoveries.size;
  const suffix = state.mode === "playing" || state.mode === "completed"
    ? ` Discoveries ${foundCount}/${total}`
    : "";
  statusText.textContent = `${state.lastMessage}${suffix}`;
}

function isPressed(code) {
  return state.pressed.has(code);
}

function consumePress(code) {
  if (state.justPressed.has(code)) {
    state.justPressed.delete(code);
    return true;
  }
  return false;
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function burstParticles(x, y, amount, color) {
  for (let index = 0; index < amount; index += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 180,
      vy: -Math.random() * 200 - 40,
      life: 0.7 + Math.random() * 0.5,
      color,
      radius: 3 + Math.random() * 4,
    });
  }
}

function markDiscovery(id, message, x, y, color = "#f0d082") {
  if (discoveries.get(id)) {
    return;
  }

  discoveries.set(id, true);
  state.lastMessage = message;
  burstParticles(x, y, 12, color);
  updateStatus();
}

function reveal(ids, x, y) {
  let didReveal = false;
  for (const id of ids) {
    if (!revealed.has(id)) {
      revealed.add(id);
      didReveal = true;
    }
  }

  if (didReveal) {
    burstParticles(x, y, 16, "#ffd1a0");
  }
}

function resolvePlatforms(player, dt) {
  player.x += player.vx * dt;

  for (const platform of level.platforms) {
    if (platform.hidden && !revealed.has(platform.revealId)) {
      continue;
    }
    if (rectsOverlap(player, platform)) {
      if (player.vx > 0) {
        player.x = platform.x - player.width;
      } else if (player.vx < 0) {
        player.x = platform.x + platform.width;
      }
      player.vx = 0;
    }
  }

  player.y += player.vy * dt;
  player.onGround = false;

  for (const platform of level.platforms) {
    if (platform.hidden && !revealed.has(platform.revealId)) {
      continue;
    }
    if (rectsOverlap(player, platform)) {
      if (player.vy > 0) {
        player.y = platform.y - player.height;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0) {
        player.y = platform.y + platform.height;
        player.vy = 0;
      }
    }
  }

  if (player.y + player.height > WORLD.height) {
    player.y = WORLD.height - player.height;
    player.vy = 0;
    player.onGround = true;
  }

  player.x = clamp(player.x, 0, WORLD.width - player.width);
}

function updatePlayer(dt) {
  const player = state.player;
  const moveLeft = isPressed("KeyA") || isPressed("ArrowLeft");
  const moveRight = isPressed("KeyD") || isPressed("ArrowRight");
  const jump = consumePress("Space");

  if (moveLeft === moveRight) {
    player.vx = 0;
  } else if (moveLeft) {
    player.vx = -player.speed;
    player.facing = -1;
  } else if (moveRight) {
    player.vx = player.speed;
    player.facing = 1;
  }

  if (jump && player.onGround) {
    player.vy = player.jumpVelocity;
    player.onGround = false;
    burstParticles(player.x + player.width / 2, player.y + player.height, 6, "#d4e5ff");
  }

  player.vy += WORLD.gravity * dt;
  resolvePlatforms(player, dt);

  const targetX = player.x - VIEW.width * 0.38;
  const targetY = player.y - VIEW.height * 0.55;
  state.cameraX += (targetX - state.cameraX) * Math.min(1, dt * 4.2);
  state.cameraY += (targetY - state.cameraY) * Math.min(1, dt * 4.2);
  state.cameraX = clamp(state.cameraX, 0, WORLD.width - VIEW.width);
  state.cameraY = clamp(state.cameraY, 0, WORLD.height - VIEW.height);
}

function updateDiscoveries() {
  const player = state.player;
  const playerCenter = {
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
  };

  for (const landmark of level.landmarks) {
    const dx = landmark.x + landmark.width / 2 - playerCenter.x;
    const dy = landmark.y + landmark.height / 2 - playerCenter.y;
    const distance = Math.hypot(dx, dy);
    if (landmark.autoRadius > 0 && distance < landmark.autoRadius) {
      markDiscovery(landmark.id, landmark.body, landmark.x, landmark.y, "#f7d979");
    }
  }

  const interactPressed = consumePress("KeyE");
  if (!interactPressed) {
    return;
  }

  for (const thing of level.interactables) {
    const expanded = {
      x: thing.x - 24,
      y: thing.y - 24,
      width: thing.width + 48,
      height: thing.height + 48,
    };
    if (rectsOverlap(player, expanded)) {
      markDiscovery(thing.id, thing.body, thing.x, thing.y, "#ffd0a8");
      reveal(thing.reveals, thing.x, thing.y);
      break;
    }
  }
}

function updateFinish(dt) {
  if (state.mode !== "playing") {
    return;
  }

  state.completionSeconds += dt;
  if (rectsOverlap(state.player, level.finishZone)) {
    completeRun();
  }
}

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 420 * dt;
    return particle.life > 0;
  });
}

function update(dt) {
  state.pulse += dt;

  if (consumePress("KeyR")) {
    resetRun();
    return;
  }

  if (!state.editorVisible && state.mode === "title" && consumePress("Enter")) {
    startRun();
  }

  if (!state.editorVisible && state.mode === "playing") {
    updatePlayer(dt);
    updateDiscoveries();
    updateFinish(dt);
  }

  updateParticles(dt);
  state.justPressed.clear();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, "#0b1320");
  sky.addColorStop(0.55, "#1c3147");
  sky.addColorStop(1, "#355268");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  for (let layer = 0; layer < 3; layer += 1) {
    const parallax = 0.12 + layer * 0.12;
    const baseY = 470 + layer * 85 - state.cameraY * (0.02 + layer * 0.015);
    ctx.fillStyle = ["#122032", "#17283a", "#1d3243"][layer];

    ctx.beginPath();
    ctx.moveTo(0, VIEW.height);
    for (let x = -100; x <= VIEW.width + 100; x += 160) {
      const worldX = x + state.cameraX * parallax;
      const wave = Math.sin(worldX * 0.0023 + layer) * 36;
      ctx.lineTo(x, baseY + wave - layer * 18);
    }
    ctx.lineTo(VIEW.width, VIEW.height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGrid() {
  if (!state.debugVisible) {
    return;
  }

  const gridSize = WORLD.gridSize || 40;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;

  const startX = Math.floor(state.cameraX / gridSize) * gridSize;
  const endX = state.cameraX + VIEW.width + gridSize;
  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, state.cameraY);
    ctx.lineTo(x, state.cameraY + VIEW.height);
    ctx.stroke();
  }

  const startY = Math.floor(state.cameraY / gridSize) * gridSize;
  const endY = state.cameraY + VIEW.height + gridSize;
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(state.cameraX, y);
    ctx.lineTo(state.cameraX + VIEW.width, y);
    ctx.stroke();
  }
}

function drawGroundDecor() {
  for (let x = 40; x < WORLD.width; x += 240) {
    const screenX = x - state.cameraX;
    if (screenX < -120 || screenX > VIEW.width + 120) {
      continue;
    }

    const pulse = 0.55 + Math.sin(state.pulse * 1.4 + x * 0.02) * 0.12;
    ctx.fillStyle = `rgba(242, 213, 135, ${pulse})`;
    ctx.fillRect(x, 926, 12, 34);
    ctx.beginPath();
    ctx.arc(x + 6, 916, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLandmarks() {
  for (const landmark of level.landmarks) {
    const active = discoveries.get(landmark.id);
    const glow = 0.45 + Math.sin(state.pulse * 2.8 + landmark.x * 0.01) * 0.18;

    ctx.fillStyle = active ? "#ffdf9c" : `rgba(214, 194, 138, ${glow})`;
    ctx.fillRect(landmark.x, landmark.y, landmark.width, landmark.height);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(landmark.x, landmark.y, landmark.width, 5);
  }
}

function drawInteractables() {
  for (const thing of level.interactables) {
    const active = discoveries.get(thing.id);
    ctx.fillStyle = active ? "#f7c2a8" : "#8f6f62";
    ctx.fillRect(thing.x, thing.y, thing.width, thing.height);

    if (!active) {
      const near = rectsOverlap(state.player, {
        x: thing.x - 24,
        y: thing.y - 24,
        width: thing.width + 48,
        height: thing.height + 48,
      });
      if (near && state.mode === "playing") {
        ctx.fillStyle = "#f8e2b9";
        ctx.font = "20px Verdana";
        ctx.fillText("E", thing.x + thing.width / 2 - 6, thing.y - 10);
      }
    }
  }
}

function drawFinishZone() {
  const glow = 0.4 + Math.sin(state.pulse * 3.2) * 0.18;
  ctx.fillStyle = `rgba(247, 217, 121, ${glow})`;
  ctx.fillRect(level.finishZone.x, level.finishZone.y, level.finishZone.width, level.finishZone.height);
  ctx.fillStyle = "#e1b95d";
  ctx.fillRect(level.finishZone.x + 16, level.finishZone.y, 18, level.finishZone.height);
}

function drawSpawnMarker() {
  if (!state.editorVisible) {
    return;
  }

  ctx.strokeStyle = "#8fd0ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(level.playerSpawn.x, level.playerSpawn.y, PLAYER_SIZE.width, PLAYER_SIZE.height);
  ctx.beginPath();
  ctx.moveTo(level.playerSpawn.x + PLAYER_SIZE.width / 2, level.playerSpawn.y - 12);
  ctx.lineTo(level.playerSpawn.x + PLAYER_SIZE.width / 2, level.playerSpawn.y + PLAYER_SIZE.height + 12);
  ctx.moveTo(level.playerSpawn.x - 12, level.playerSpawn.y + PLAYER_SIZE.height / 2);
  ctx.lineTo(level.playerSpawn.x + PLAYER_SIZE.width + 12, level.playerSpawn.y + PLAYER_SIZE.height / 2);
  ctx.stroke();
}

function drawPlayer() {
  const player = state.player;
  ctx.fillStyle = "#f5efe0";
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.fillStyle = "#29384a";
  ctx.fillRect(player.x + (player.facing === 1 ? 25 : 7), player.y + 15, 10, 10);
  ctx.fillStyle = "#d1b978";
  ctx.fillRect(player.x + 10, player.y + 42, 22, 8);

  if (state.debugVisible || state.editorVisible) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x, player.y, player.width, player.height);
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDebugWorldLabels() {
  if (!state.debugVisible) {
    return;
  }

  ctx.font = "14px Verdana";
  ctx.fillStyle = "#f7f3df";

  for (const [index, platform] of level.platforms.entries()) {
    if (platform.hidden && !revealed.has(platform.revealId)) {
      continue;
    }
    ctx.fillText(`P${index} ${platform.x},${platform.y}`, platform.x, platform.y - 8);
  }

  for (const landmark of level.landmarks) {
    ctx.fillText(landmark.id, landmark.x, landmark.y - 8);
  }

  for (const thing of level.interactables) {
    ctx.fillText(thing.id, thing.x, thing.y - 8);
  }

  ctx.fillText(`spawn ${level.playerSpawn.x},${level.playerSpawn.y}`, level.playerSpawn.x, level.playerSpawn.y - 8);
  ctx.fillText(`finish ${level.finishZone.x},${level.finishZone.y}`, level.finishZone.x, level.finishZone.y - 8);
}

function drawEditorSelection() {
  if (!state.editorVisible) {
    return;
  }

  const selected = getSelectedObject();
  if (!selected) {
    return;
  }

  const width = selected.width || PLAYER_SIZE.width;
  const height = selected.height || PLAYER_SIZE.height;
  ctx.strokeStyle = "#f0d082";
  ctx.lineWidth = 3;
  ctx.strokeRect(selected.x, selected.y, width, height);
}

function drawWorld() {
  ctx.save();
  ctx.translate(-state.cameraX, -state.cameraY);

  drawGroundDecor();
  drawGrid();

  for (const platform of level.platforms) {
    if (platform.hidden && !revealed.has(platform.revealId)) {
      continue;
    }
    ctx.fillStyle = platform.color;
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(platform.x, platform.y, platform.width, 6);
  }

  drawFinishZone();
  drawLandmarks();
  drawInteractables();
  drawSpawnMarker();
  drawPlayer();
  drawParticles();
  drawEditorSelection();
  drawDebugWorldLabels();

  ctx.restore();
}

function drawOverlay() {
  if (state.editorVisible || (state.mode !== "title" && state.mode !== "completed")) {
    return;
  }

  ctx.fillStyle = state.mode === "title" ? "rgba(3, 7, 12, 0.38)" : "rgba(16, 10, 4, 0.42)";
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f5efe0";
  ctx.font = "700 54px Trebuchet MS";

  if (state.mode === "title") {
    ctx.fillText("Follow the passage", VIEW.width / 2, 180);
    ctx.font = "24px Verdana";
    ctx.fillStyle = "#d5dbe4";
    ctx.fillText("Reach the bright gate. Curiosity should reward you before you get there.", VIEW.width / 2, 235);
    ctx.fillText("Start with Enter. Restart anytime with R.", VIEW.width / 2, 272);
  } else {
    ctx.fillText("Threshold crossed", VIEW.width / 2, 190);
    ctx.font = "24px Verdana";
    ctx.fillStyle = "#f4ddb1";
    const foundCount = Array.from(discoveries.values()).filter(Boolean).length;
    ctx.fillText(`Discoveries found: ${foundCount}/${discoveries.size}`, VIEW.width / 2, 246);
    ctx.fillText(`Time: ${state.completionSeconds.toFixed(1)} seconds`, VIEW.width / 2, 282);
    ctx.fillText("Share feedback outside the build. Did you want to see what was ahead?", VIEW.width / 2, 330);
    ctx.fillText("Press R to run again.", VIEW.width / 2, 366);
  }

  ctx.textAlign = "start";
}

function drawMessageBar() {
  if (state.mode !== "playing" && !state.editorVisible) {
    return;
  }

  ctx.fillStyle = "rgba(7, 11, 17, 0.56)";
  ctx.fillRect(24, 24, VIEW.width - 48, 54);
  ctx.fillStyle = "#f2ede2";
  ctx.font = "18px Verdana";
  ctx.fillText(state.editorVisible ? "Design mode active. Drag, edit JSON, copy the full level when ready." : state.lastMessage, 42, 58);
}

function drawDebugHud() {
  if (!state.debugVisible && !state.editorVisible) {
    return;
  }

  const player = state.player;
  const selected = getSelectedObject();
  const selectedLine = selected
    ? `${state.selectedType}${getCollection(state.selectedType) ? `[${state.selectedIndex}]` : ""}: ${Math.round(selected.x)}, ${Math.round(selected.y)}`
    : "selection: none";
  const lines = [
    state.editorVisible ? "LEVEL DESIGN" : "LEVEL DEBUG",
    `player: ${Math.round(player.x)}, ${Math.round(player.y)}`,
    `camera: ${Math.round(state.cameraX)}, ${Math.round(state.cameraY)}`,
    `spawn: ${level.playerSpawn.x}, ${level.playerSpawn.y}`,
    `finish: ${level.finishZone.x}, ${level.finishZone.y}`,
    `grid: ${WORLD.gridSize || 40}`,
    selectedLine,
  ];

  ctx.fillStyle = "rgba(4, 8, 12, 0.78)";
  ctx.fillRect(24, 86, 340, 176);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.strokeRect(24, 86, 340, 176);
  ctx.fillStyle = "#f5efe0";
  ctx.font = "16px Verdana";

  lines.forEach((line, index) => {
    ctx.fillText(line, 42, 118 + index * 22);
  });
}

function render() {
  drawBackground();
  drawWorld();
  drawMessageBar();
  drawOverlay();
  drawDebugHud();
}

let previous = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - previous) / 1000);
  previous = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

rebuildDiscoveries();
syncEditorTypeOptions();
resetRun();
syncEditorUI();
requestAnimationFrame(loop);
