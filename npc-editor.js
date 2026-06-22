import { GAME_DATA as STATIC_GAME_DATA } from "./level-data.js?v=20260619-shelter-voice-v9";
import {
  createGameDataWithExternalLevels,
  getLevelSummaries,
} from "./level-store.js?v=20260622-npc-v1";
import { clamp, deepClone } from "./utils.js";

const GAME_DATA = await createGameDataWithExternalLevels(STATIC_GAME_DATA);
const NPC_MANIFEST_URL = "./npcs/manifest.json";

const dom = {
  npcSelect: document.getElementById("npcSelect"),
  addNpcButton: document.getElementById("addNpcButton"),
  saveNpcButton: document.getElementById("saveNpcButton"),
  statusLabel: document.getElementById("statusLabel"),
  profileFields: document.getElementById("profileFields"),
  placementSelect: document.getElementById("placementSelect"),
  addPlacementButton: document.getElementById("addPlacementButton"),
  deletePlacementButton: document.getElementById("deletePlacementButton"),
  placementFields: document.getElementById("placementFields"),
  dialogueFields: document.getElementById("dialogueFields"),
  nodeSelect: document.getElementById("nodeSelect"),
  addNodeButton: document.getElementById("addNodeButton"),
  deleteNodeButton: document.getElementById("deleteNodeButton"),
  nodeFields: document.getElementById("nodeFields"),
  choiceFields: document.getElementById("choiceFields"),
  levelSelect: document.getElementById("levelSelect"),
  stageTitle: document.getElementById("stageTitle"),
  canvas: document.getElementById("npcCanvas"),
};

const ctx = dom.canvas.getContext("2d");
const levelSummaries = getLevelSummaries(GAME_DATA, { applyLevelOverride: true });

const editor = {
  docs: [],
  manifest: { version: 1, drafts: [], accepted: [] },
  npcIndex: 0,
  placementIndex: 0,
  nodeIndex: 0,
  levelId: levelSummaries[0]?.id || "movement-lab-01",
  dirty: false,
  drag: null,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeId(value, fallback = "id") {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function getDoc() {
  return editor.docs[clamp(editor.npcIndex, 0, Math.max(0, editor.docs.length - 1))] || null;
}

function getPlacement() {
  const doc = getDoc();
  return doc?.placements?.[clamp(editor.placementIndex, 0, Math.max(0, (doc.placements || []).length - 1))] || null;
}

function getNode() {
  const placement = getPlacement();
  const nodes = placement?.dialogue?.nodes || [];
  return nodes[clamp(editor.nodeIndex, 0, Math.max(0, nodes.length - 1))] || null;
}

function markDirty() {
  editor.dirty = true;
  setStatus("수정됨.");
}

function setStatus(message) {
  dom.statusLabel.textContent = message;
}

function normalizeDoc(document, sourcePath = "") {
  const profile = document?.profile && typeof document.profile === "object" ? document.profile : {};
  const npcId = safeId(profile.id, sourcePath.split("/").pop()?.replace(/\.v\d+\.json$/i, "") || "npc");
  return {
    version: Number(document?.version || 1),
    sourcePath,
    profile: {
      id: npcId,
      name: String(profile.name || npcId),
      role: String(profile.role || ""),
      visual: {
        kind: String(profile.visual?.kind || "silhouette"),
        color: String(profile.visual?.color || "#d7e7dc"),
        accentColor: String(profile.visual?.accentColor || "#93eaff"),
      },
    },
    placements: Array.isArray(document?.placements)
      ? document.placements.map((placement, index) => normalizePlacement(placement, npcId, index))
      : [],
  };
}

function normalizePlacement(placement = {}, npcId = "npc", index = 0) {
  const dialogue = placement.dialogue && typeof placement.dialogue === "object" ? placement.dialogue : {};
  const nodes = Array.isArray(dialogue.nodes) && dialogue.nodes.length
    ? dialogue.nodes.map((node, nodeIndex) => normalizeNode(node, nodeIndex))
    : [normalizeNode({ id: "start", line: "“여기서 말을 건다.”", choices: [] }, 0)];
  return {
    id: safeId(placement.id, `${npcId}-placement-${index + 1}`),
    levelId: String(placement.levelId || editor.levelId || "movement-lab-01"),
    x: Number.isFinite(Number(placement.x)) ? Number(placement.x) : 640,
    y: Number.isFinite(Number(placement.y)) ? Number(placement.y) : 640,
    width: Number.isFinite(Number(placement.width)) ? Number(placement.width) : 58,
    height: Number.isFinite(Number(placement.height)) ? Number(placement.height) : 96,
    facing: Math.sign(Number(placement.facing ?? 1)) || 1,
    interactPrompt: String(placement.interactPrompt || "Z: 대화"),
    interceptRouteExitId: String(placement.interceptRouteExitId || ""),
    showWhen: {
      requiredStoryFlags: Array.isArray(placement.showWhen?.requiredStoryFlags) ? placement.showWhen.requiredStoryFlags.map(String) : [],
      missingStoryFlags: Array.isArray(placement.showWhen?.missingStoryFlags) ? placement.showWhen.missingStoryFlags.map(String) : [],
    },
    dialogue: {
      startNodeId: String(dialogue.startNodeId || nodes[0]?.id || "start"),
      timerSeconds: Number.isFinite(Number(dialogue.timerSeconds)) ? Number(dialogue.timerSeconds) : 6,
      timeoutChoiceId: String(dialogue.timeoutChoiceId || ""),
      nodes,
    },
  };
}

function normalizeNode(node = {}, index = 0) {
  return {
    id: safeId(node.id, index === 0 ? "start" : `node-${index + 1}`),
    line: String(node.line || ""),
    choices: Array.isArray(node.choices) ? node.choices.map((choice, choiceIndex) => normalizeChoice(choice, choiceIndex)).slice(0, 3) : [],
    timeoutChoice: node.timeoutChoice ? normalizeChoice(node.timeoutChoice, 99) : null,
    timeoutChoiceId: String(node.timeoutChoiceId || ""),
  };
}

function normalizeChoice(choice = {}, index = 0) {
  return {
    id: safeId(choice.id, `choice-${index + 1}`),
    label: String(choice.label || `선택 ${index + 1}`),
    reply: String(choice.reply || ""),
    nextNodeId: String(choice.nextNodeId || ""),
    effects: {
      storyFlags: Array.isArray(choice.effects?.storyFlags) ? choice.effects.storyFlags.map(String) : [],
    },
    postAction: choice.postAction && typeof choice.postAction === "object" ? deepClone(choice.postAction) : {},
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status}`);
  }
  return response.json();
}

async function loadNpcDocs() {
  try {
    editor.manifest = await fetchJson(NPC_MANIFEST_URL);
  } catch {
    editor.manifest = { version: 1, drafts: [], accepted: [] };
  }
  const entries = [
    ...(Array.isArray(editor.manifest.drafts) ? editor.manifest.drafts : []),
    ...(Array.isArray(editor.manifest.accepted) ? editor.manifest.accepted : []),
    ...(Array.isArray(editor.manifest.npcs) ? editor.manifest.npcs : []),
  ];
  const docs = [];
  for (const entry of entries) {
    const sourcePath = typeof entry === "string" ? entry : entry?.path;
    if (!sourcePath) {
      continue;
    }
    try {
      const document = await fetchJson(new URL(sourcePath, new URL(NPC_MANIFEST_URL, window.location.href)).href);
      docs.push(normalizeDoc(document, sourcePath));
    } catch (error) {
      console.warn(`Failed to load NPC ${sourcePath}`, error);
    }
  }
  editor.docs = docs.length ? docs : [createBlankNpc()];
  editor.npcIndex = 0;
  editor.placementIndex = 0;
  editor.nodeIndex = 0;
  editor.levelId = getPlacement()?.levelId || editor.levelId;
  editor.dirty = false;
  setStatus(docs.length ? "NPC 데이터 로드됨." : "새 NPC 초안 생성됨.");
}

function createBlankNpc() {
  return normalizeDoc({
    version: 1,
    profile: {
      id: "new-npc",
      name: "새 NPC",
      role: "지역 거주민",
      visual: { kind: "silhouette", color: "#d7e7dc", accentColor: "#93eaff" },
    },
    placements: [
      {
        id: "new-npc-start",
        levelId: editor.levelId,
        x: 640,
        y: 640,
        width: 58,
        height: 96,
        interactPrompt: "Z: 대화",
        dialogue: {
          startNodeId: "start",
          timerSeconds: 6,
          nodes: [{ id: "start", line: "“처음 만났네.”", choices: [] }],
        },
      },
    ],
  }, "drafts/new-npc.v001.json");
}

function field(label, html) {
  return `<label class="field full"><span>${escapeHtml(label)}</span>${html}</label>`;
}

function input(value, dataKey, type = "text") {
  return `<input type="${type}" data-key="${escapeHtml(dataKey)}" value="${escapeHtml(value)}">`;
}

function textarea(value, dataKey, rows = 3) {
  return `<textarea data-key="${escapeHtml(dataKey)}" rows="${rows}">${escapeHtml(value)}</textarea>`;
}

function select(value, dataKey, options) {
  const safeValue = String(value || "");
  const optionList = [...options];
  if (safeValue && !optionList.some((option) => option.value === safeValue)) {
    optionList.push({ value: safeValue, label: `Missing: ${safeValue}` });
  }
  return `<select data-key="${escapeHtml(dataKey)}">${optionList.map((option) => (
    `<option value="${escapeHtml(option.value)}"${option.value === safeValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`
  )).join("")}</select>`;
}

function levelOptions() {
  return levelSummaries.map((level) => ({ value: level.id, label: level.label || level.id }));
}

function routeOptions(levelId) {
  const level = levelSummaries.find((summary) => summary.id === levelId);
  return [
    { value: "", label: "없음" },
    ...((level?.routeExits || []).map((route) => ({ value: route.id, label: `${route.id} -> ${route.toLevelId || "-"}` }))),
  ];
}

function renderAll() {
  renderSelectors();
  renderProfileFields();
  renderPlacementFields();
  renderDialogueFields();
  drawCanvas();
}

function renderSelectors() {
  dom.npcSelect.innerHTML = editor.docs.map((doc, index) => (
    `<option value="${index}"${index === editor.npcIndex ? " selected" : ""}>${escapeHtml(doc.profile.name || doc.profile.id)}</option>`
  )).join("");
  dom.levelSelect.innerHTML = levelOptions().map((level) => (
    `<option value="${escapeHtml(level.value)}"${level.value === editor.levelId ? " selected" : ""}>${escapeHtml(level.label)}</option>`
  )).join("");
  const doc = getDoc();
  dom.placementSelect.innerHTML = (doc?.placements || []).map((placement, index) => (
    `<option value="${index}"${index === editor.placementIndex ? " selected" : ""}>${escapeHtml(placement.id)}</option>`
  )).join("");
  const placement = getPlacement();
  const nodes = placement?.dialogue?.nodes || [];
  dom.nodeSelect.innerHTML = nodes.map((node, index) => (
    `<option value="${index}"${index === editor.nodeIndex ? " selected" : ""}>${escapeHtml(node.id)}</option>`
  )).join("");
  dom.stageTitle.textContent = `${editor.levelId} · NPC Placement`;
}

function renderProfileFields() {
  const doc = getDoc();
  if (!doc) {
    dom.profileFields.innerHTML = "";
    return;
  }
  dom.profileFields.innerHTML = [
    field("ID", input(doc.profile.id, "profile.id")),
    field("이름", input(doc.profile.name, "profile.name")),
    field("역할", input(doc.profile.role, "profile.role")),
    field("색", input(doc.profile.visual.color, "profile.visual.color", "color")),
    field("강조색", input(doc.profile.visual.accentColor, "profile.visual.accentColor", "color")),
  ].join("");
}

function renderPlacementFields() {
  const placement = getPlacement();
  if (!placement) {
    dom.placementFields.innerHTML = "";
    return;
  }
  dom.placementFields.innerHTML = [
    field("ID", input(placement.id, "placement.id")),
    field("Level", select(placement.levelId, "placement.levelId", levelOptions())),
    field("X", input(placement.x, "placement.x", "number")),
    field("Y", input(placement.y, "placement.y", "number")),
    field("Width", input(placement.width, "placement.width", "number")),
    field("Height", input(placement.height, "placement.height", "number")),
    field("Facing", input(placement.facing, "placement.facing", "number")),
    field("Prompt", input(placement.interactPrompt, "placement.interactPrompt")),
    field("Route Intercept", select(placement.interceptRouteExitId, "placement.interceptRouteExitId", routeOptions(placement.levelId))),
    field("Required Flags", input(placement.showWhen.requiredStoryFlags.join(", "), "placement.showWhen.requiredStoryFlags")),
    field("Missing Flags", input(placement.showWhen.missingStoryFlags.join(", "), "placement.showWhen.missingStoryFlags")),
  ].join("");
}

function renderDialogueFields() {
  const placement = getPlacement();
  const node = getNode();
  if (!placement || !node) {
    dom.dialogueFields.innerHTML = "";
    dom.nodeFields.innerHTML = "";
    dom.choiceFields.innerHTML = "";
    return;
  }
  const nodeOptions = placement.dialogue.nodes.map((entry) => ({ value: entry.id, label: entry.id }));
  dom.dialogueFields.innerHTML = [
    field("Start Node", select(placement.dialogue.startNodeId, "dialogue.startNodeId", nodeOptions)),
    field("Timer Seconds", input(placement.dialogue.timerSeconds, "dialogue.timerSeconds", "number")),
  ].join("");
  dom.nodeFields.innerHTML = [
    field("Node ID", input(node.id, "node.id")),
    field("Line", textarea(node.line, "node.line", 4)),
    field("Timeout Choice ID", input(node.timeoutChoiceId, "node.timeoutChoiceId")),
  ].join("");
  const choicesHtml = (node.choices || []).map((choice, index) => renderChoice(choice, index, false)).join("");
  const timeoutHtml = renderChoice(node.timeoutChoice || normalizeChoice({ id: "silent", label: "……" }, 99), 0, true);
  dom.choiceFields.innerHTML = `
    <div class="field-heading">Visible Choices</div>
    ${choicesHtml || '<p class="panel-helper">선택지 없음.</p>'}
    <button type="button" class="ghost-button" id="addChoiceButton">Add Choice</button>
    <div class="field-heading">Timeout Choice</div>
    ${timeoutHtml}
  `;
  const addChoiceButton = document.getElementById("addChoiceButton");
  addChoiceButton?.addEventListener("click", () => {
    if (node.choices.length >= 3) {
      setStatus("보이는 선택지는 최대 3개.");
      return;
    }
    node.choices.push(normalizeChoice({ id: `choice-${node.choices.length + 1}`, label: "새 선택" }, node.choices.length));
    markDirty();
    renderAll();
  });
}

function renderChoice(choice, index, timeout) {
  const prefix = timeout ? "timeoutChoice" : `choice.${index}`;
  const flags = Array.isArray(choice.effects?.storyFlags) ? choice.effects.storyFlags.join(", ") : "";
  return `
    <section class="editor-panel compact" data-choice-panel="${escapeHtml(prefix)}">
      <div class="field-grid">
        ${field("ID", input(choice.id, `${prefix}.id`))}
        ${field("Label", input(choice.label, `${prefix}.label`))}
        ${field("Reply", textarea(choice.reply, `${prefix}.reply`, 3))}
        ${field("Next Node", input(choice.nextNodeId || "", `${prefix}.nextNodeId`))}
        ${field("Story Flags", input(flags, `${prefix}.effects.storyFlags`))}
        ${field("Post Action", select(choice.postAction?.type || "", `${prefix}.postAction.type`, [
          { value: "", label: "없음" },
          { value: "route", label: "Route after delay" },
        ]))}
        ${field("Delay", input(choice.postAction?.delaySeconds ?? "", `${prefix}.postAction.delaySeconds`, "number"))}
      </div>
      ${timeout ? "" : `<button type="button" class="ghost-button" data-delete-choice="${index}">Delete Choice</button>`}
    </section>
  `;
}

function getByPath(root, pathKey) {
  return pathKey.split(".").reduce((target, key) => target?.[key], root);
}

function setByPath(root, pathKey, value) {
  const parts = pathKey.split(".");
  let target = root;
  parts.slice(0, -1).forEach((key) => {
    target[key] = target[key] && typeof target[key] === "object" ? target[key] : {};
    target = target[key];
  });
  target[parts.at(-1)] = value;
}

function parseFlags(value) {
  return String(value || "")
    .split(",")
    .map((flag) => flag.trim())
    .filter(Boolean);
}

function applyFieldChange(key, rawValue) {
  const doc = getDoc();
  const placement = getPlacement();
  const node = getNode();
  if (!doc) {
    return;
  }
  const numericKeys = new Set([
    "placement.x",
    "placement.y",
    "placement.width",
    "placement.height",
    "placement.facing",
    "dialogue.timerSeconds",
  ]);
  const value = numericKeys.has(key) ? Number(rawValue) : rawValue;
  if (key.startsWith("profile.")) {
    setByPath(doc, key, value);
  } else if (placement && key.startsWith("placement.")) {
    if (key.endsWith("requiredStoryFlags") || key.endsWith("missingStoryFlags")) {
      setByPath(placement, key.replace(/^placement\./, ""), parseFlags(rawValue));
    } else {
      setByPath(placement, key.replace(/^placement\./, ""), value);
      if (key === "placement.levelId") {
        editor.levelId = rawValue;
      }
    }
  } else if (placement && key.startsWith("dialogue.")) {
    setByPath(placement.dialogue, key.replace(/^dialogue\./, ""), value);
  } else if (node && key.startsWith("node.")) {
    setByPath(node, key.replace(/^node\./, ""), value);
  } else if (node && key.startsWith("choice.")) {
    const [, indexText, ...rest] = key.split(".");
    const choice = node.choices[Number(indexText)];
    if (choice) {
      const pathKey = rest.join(".");
      setChoiceField(choice, pathKey, rawValue);
    }
  } else if (node && key.startsWith("timeoutChoice.")) {
    node.timeoutChoice = node.timeoutChoice || normalizeChoice({ id: "silent", label: "……" }, 99);
    setChoiceField(node.timeoutChoice, key.replace(/^timeoutChoice\./, ""), rawValue);
  }
  if (key === "profile.id") {
    doc.profile.id = safeId(doc.profile.id, "npc");
  }
  if (key === "placement.id") {
    placement.id = safeId(placement.id, "placement");
  }
  if (key === "node.id") {
    node.id = safeId(node.id, "node");
  }
  markDirty();
  renderAll();
}

function setChoiceField(choice, pathKey, rawValue) {
  if (pathKey === "effects.storyFlags") {
    choice.effects = choice.effects || {};
    choice.effects.storyFlags = parseFlags(rawValue);
    return;
  }
  if (pathKey === "postAction.type") {
    choice.postAction = choice.postAction || {};
    if (rawValue) {
      choice.postAction.type = rawValue;
    } else {
      choice.postAction = {};
    }
    return;
  }
  if (pathKey === "postAction.delaySeconds") {
    choice.postAction = choice.postAction || {};
    const number = Number(rawValue);
    if (Number.isFinite(number)) {
      choice.postAction.delaySeconds = number;
    } else {
      delete choice.postAction.delaySeconds;
    }
    return;
  }
  setByPath(choice, pathKey, pathKey === "id" ? safeId(rawValue, "choice") : rawValue);
}

function bindDynamicInputs() {
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }
    const key = target.dataset.key;
    if (key) {
      applyFieldChange(key, target.value);
    }
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-delete-choice]");
    if (!button) {
      return;
    }
    const node = getNode();
    const index = Number(button.dataset.deleteChoice);
    if (node && Number.isInteger(index)) {
      node.choices.splice(index, 1);
      markDirty();
      renderAll();
    }
  });
}

function getLevelSummary() {
  return levelSummaries.find((summary) => summary.id === editor.levelId) || levelSummaries[0];
}

function getCanvasTransform() {
  const level = getLevelSummary();
  const width = Math.max(1, level?.world?.width || 1280);
  const height = Math.max(1, level?.world?.height || 720);
  const scale = Math.min((dom.canvas.width - 80) / width, (dom.canvas.height - 80) / height);
  return {
    scale,
    offsetX: (dom.canvas.width - width * scale) / 2,
    offsetY: (dom.canvas.height - height * scale) / 2,
  };
}

function worldToScreen(point) {
  const transform = getCanvasTransform();
  return {
    x: transform.offsetX + point.x * transform.scale,
    y: transform.offsetY + point.y * transform.scale,
  };
}

function screenToWorld(point) {
  const transform = getCanvasTransform();
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale,
  };
}

function drawCanvas() {
  const level = getLevelSummary();
  if (!ctx || !level) {
    return;
  }
  ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
  const transform = getCanvasTransform();
  ctx.save();
  ctx.translate(transform.offsetX, transform.offsetY);
  ctx.scale(transform.scale, transform.scale);
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  ctx.fillRect(0, 0, level.world.width, level.world.height);
  ctx.strokeStyle = "rgba(147,234,255,0.22)";
  ctx.lineWidth = 4 / transform.scale;
  ctx.strokeRect(0, 0, level.world.width, level.world.height);

  (level.platforms || []).forEach((platform) => {
    ctx.fillStyle = platform.kind === "water" ? "rgba(89, 168, 208, 0.34)" : "rgba(117, 138, 145, 0.48)";
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  });
  (level.routeExits || []).forEach((route) => {
    ctx.strokeStyle = route.id === getPlacement()?.interceptRouteExitId ? "#f6e98a" : "rgba(231,244,126,0.72)";
    ctx.lineWidth = 5 / transform.scale;
    ctx.strokeRect(route.x, route.y, route.width, route.height);
  });

  const doc = getDoc();
  (doc?.placements || [])
    .filter((placement) => placement.levelId === editor.levelId)
    .forEach((placement, index) => {
      const selected = index === editor.placementIndex;
      ctx.fillStyle = selected ? "rgba(246,233,138,0.74)" : "rgba(215,231,220,0.62)";
      ctx.strokeStyle = selected ? "#f6e98a" : "#93eaff";
      ctx.lineWidth = selected ? 6 / transform.scale : 3 / transform.scale;
      ctx.beginPath();
      ctx.ellipse(
        placement.x + placement.width / 2,
        placement.y + placement.height / 2,
        placement.width / 2,
        placement.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#edf3f5";
      ctx.font = `${14 / transform.scale}px Segoe UI`;
      ctx.fillText(placement.id, placement.x, placement.y - 12 / transform.scale);
    });
  ctx.restore();
}

function getCanvasPoint(event) {
  const rect = dom.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (dom.canvas.width / rect.width),
    y: (event.clientY - rect.top) * (dom.canvas.height / rect.height),
  };
}

function findPlacementAt(point) {
  const doc = getDoc();
  const transform = getCanvasTransform();
  let best = null;
  (doc?.placements || []).forEach((placement, index) => {
    if (placement.levelId !== editor.levelId) {
      return;
    }
    const center = worldToScreen({ x: placement.x + placement.width / 2, y: placement.y + placement.height / 2 });
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    if (distance < Math.max(14, placement.width * transform.scale) && (!best || distance < best.distance)) {
      best = { index, placement, distance };
    }
  });
  return best;
}

function bindCanvas() {
  dom.canvas.addEventListener("pointerdown", (event) => {
    const hit = findPlacementAt(getCanvasPoint(event));
    if (!hit) {
      return;
    }
    editor.placementIndex = hit.index;
    editor.levelId = hit.placement.levelId;
    const world = screenToWorld(getCanvasPoint(event));
    editor.drag = {
      pointerId: event.pointerId,
      offsetX: world.x - hit.placement.x,
      offsetY: world.y - hit.placement.y,
    };
    dom.canvas.setPointerCapture(event.pointerId);
    renderAll();
  });
  dom.canvas.addEventListener("pointermove", (event) => {
    if (!editor.drag) {
      return;
    }
    const placement = getPlacement();
    if (!placement) {
      return;
    }
    const world = screenToWorld(getCanvasPoint(event));
    placement.x = Math.round(world.x - editor.drag.offsetX);
    placement.y = Math.round(world.y - editor.drag.offsetY);
    markDirty();
    renderAll();
  });
  const endDrag = () => {
    editor.drag = null;
  };
  dom.canvas.addEventListener("pointerup", endDrag);
  dom.canvas.addEventListener("pointercancel", endDrag);
}

function serializeDoc(doc) {
  const copy = deepClone(doc);
  delete copy.sourcePath;
  return copy;
}

function getNpcFileName(doc) {
  const sourceName = doc.sourcePath?.split("/")?.pop();
  return sourceName || `${safeId(doc.profile.id, "npc")}.v001.json`;
}

async function readNpcManifestFromDirectory(directory) {
  try {
    const file = await directory.getFileHandle("manifest.json", { create: false });
    const text = await (await file.getFile()).text();
    const parsed = JSON.parse(text);
    return {
      version: Number(parsed.version || 1),
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      accepted: Array.isArray(parsed.accepted) ? parsed.accepted : [],
    };
  } catch {
    return { version: 1, drafts: [], accepted: [] };
  }
}

async function writeJsonFile(fileHandle, value) {
  const writable = await fileHandle.createWritable();
  await writable.write(`${JSON.stringify(value, null, 2)}\n`);
  await writable.close();
}

async function saveToNpcFolder(doc) {
  if (!window.showDirectoryPicker) {
    return false;
  }
  try {
    setStatus("repo의 npcs 폴더를 선택.");
    const directory = await window.showDirectoryPicker({ mode: "readwrite" });
    const draftsDirectory = await directory.getDirectoryHandle("drafts", { create: true });
    const fileName = getNpcFileName(doc);
    const file = await draftsDirectory.getFileHandle(fileName, { create: true });
    await writeJsonFile(file, serializeDoc(doc));
    const manifest = await readNpcManifestFromDirectory(directory);
    const draftPath = `drafts/${fileName}`;
    manifest.drafts = Array.from(new Set([...(manifest.drafts || []), draftPath])).sort();
    const manifestFile = await directory.getFileHandle("manifest.json", { create: true });
    await writeJsonFile(manifestFile, manifest);
    doc.sourcePath = draftPath;
    editor.manifest = manifest;
    editor.dirty = false;
    setStatus(`${draftPath} 저장됨.`);
    return true;
  } catch (error) {
    console.warn("NPC folder save failed", error);
    return false;
  }
}

function downloadDoc(doc) {
  const blob = new Blob([`${JSON.stringify(serializeDoc(doc), null, 2)}\n`], { type: "application/json" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = getNpcFileName(doc);
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  setStatus(`${anchor.download} 다운로드됨. npcs/drafts/로 옮겨.`);
}

function addPlacement() {
  const doc = getDoc();
  if (!doc) {
    return;
  }
  const placement = normalizePlacement({
    id: `${doc.profile.id}-placement-${doc.placements.length + 1}`,
    levelId: editor.levelId,
    x: 640,
    y: 640,
    dialogue: {
      startNodeId: "start",
      timerSeconds: 6,
      nodes: [{ id: "start", line: "“여기서 말을 건다.”", choices: [] }],
    },
  }, doc.profile.id, doc.placements.length);
  doc.placements.push(placement);
  editor.placementIndex = doc.placements.length - 1;
  editor.nodeIndex = 0;
  markDirty();
  renderAll();
}

function addNode() {
  const placement = getPlacement();
  if (!placement) {
    return;
  }
  placement.dialogue.nodes.push(normalizeNode({
    id: `node-${placement.dialogue.nodes.length + 1}`,
    line: "“새 대사.”",
    choices: [],
  }, placement.dialogue.nodes.length));
  editor.nodeIndex = placement.dialogue.nodes.length - 1;
  markDirty();
  renderAll();
}

function bindStaticControls() {
  dom.npcSelect.addEventListener("change", () => {
    editor.npcIndex = Number(dom.npcSelect.value) || 0;
    editor.placementIndex = 0;
    editor.nodeIndex = 0;
    editor.levelId = getPlacement()?.levelId || editor.levelId;
    renderAll();
  });
  dom.levelSelect.addEventListener("change", () => {
    editor.levelId = dom.levelSelect.value;
    renderAll();
  });
  dom.placementSelect.addEventListener("change", () => {
    editor.placementIndex = Number(dom.placementSelect.value) || 0;
    editor.nodeIndex = 0;
    editor.levelId = getPlacement()?.levelId || editor.levelId;
    renderAll();
  });
  dom.nodeSelect.addEventListener("change", () => {
    editor.nodeIndex = Number(dom.nodeSelect.value) || 0;
    renderAll();
  });
  dom.addNpcButton.addEventListener("click", () => {
    editor.docs.push(createBlankNpc());
    editor.npcIndex = editor.docs.length - 1;
    editor.placementIndex = 0;
    editor.nodeIndex = 0;
    markDirty();
    renderAll();
  });
  dom.addPlacementButton.addEventListener("click", addPlacement);
  dom.deletePlacementButton.addEventListener("click", () => {
    const doc = getDoc();
    if (!doc || doc.placements.length <= 1) {
      setStatus("placement는 최소 1개 필요.");
      return;
    }
    doc.placements.splice(editor.placementIndex, 1);
    editor.placementIndex = clamp(editor.placementIndex, 0, doc.placements.length - 1);
    editor.nodeIndex = 0;
    markDirty();
    renderAll();
  });
  dom.addNodeButton.addEventListener("click", addNode);
  dom.deleteNodeButton.addEventListener("click", () => {
    const placement = getPlacement();
    if (!placement || placement.dialogue.nodes.length <= 1) {
      setStatus("node는 최소 1개 필요.");
      return;
    }
    placement.dialogue.nodes.splice(editor.nodeIndex, 1);
    editor.nodeIndex = clamp(editor.nodeIndex, 0, placement.dialogue.nodes.length - 1);
    placement.dialogue.startNodeId = placement.dialogue.nodes[0]?.id || "start";
    markDirty();
    renderAll();
  });
  dom.saveNpcButton.addEventListener("click", async () => {
    const doc = getDoc();
    if (!doc) {
      return;
    }
    if (!(await saveToNpcFolder(doc))) {
      downloadDoc(doc);
    }
    renderAll();
  });
}

bindDynamicInputs();
bindStaticControls();
bindCanvas();
await loadNpcDocs();
renderAll();
