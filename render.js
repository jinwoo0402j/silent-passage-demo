import {
  MOVEMENT_STATES,
  SCENES,
  computeArmWeaponStats,
  ensureWeaponLoadoutState,
  hasUnlocked,
} from "./state.js";
import { clamp, formatOutcome, lerp } from "./utils.js";

const imageCache = new Map();
let spriteTintCanvas = null;
let spriteTintContext = null;
const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 720;
const MAP_EXPLORE_CELL_SIZE = 320;
const LOW_PERFORMANCE_MODE = typeof window !== "undefined"
  && (
    window.__SILENT_PASSAGE_PERF === "lite" ||
    new URLSearchParams(window.location.search).get("perf") === "lite"
  );
const LOOT_RARITY_META = {
  common: { label: "COMMON", color: "#dce7ec", glow: "rgba(220, 231, 236, 0.16)" },
  uncommon: { label: "UNCOMMON", color: "#8ef0c2", glow: "rgba(142, 240, 194, 0.2)" },
  rare: { label: "RARE", color: "#87e1ff", glow: "rgba(135, 225, 255, 0.28)" },
  epic: { label: "EPIC", color: "#b79cff", glow: "rgba(183, 156, 255, 0.3)" },
  relic: { label: "RELIC", color: "#f6e98a", glow: "rgba(246, 233, 138, 0.34)" },
};

function isMovementLab(data) {
  return data.world.mode === "movementLab";
}

function isEntityDisabled(entity) {
  return !entity || entity.disabled || entity.state === "disabled" || entity.dead;
}

function getCameraZoom(data) {
  return clamp(data.world?.camera?.zoom ?? 1, 0.5, 2.5);
}

function getRunCameraZoom(run, data) {
  return clamp(run?.cameraZoom ?? getCameraZoom(data), 0.5, 2.5);
}

function getUiTheme(data) {
  return {
    themeId: data.ui?.themeId || "default",
    accent: data.ui?.accent || "#e7f47e",
    accentSecondary: data.ui?.accentSecondary || "#93eaff",
    textMain: "#f5f8fb",
    textDim: "rgba(239, 245, 251, 0.74)",
    textMute: "rgba(239, 245, 251, 0.48)",
    panel: "rgba(8, 12, 18, 0.48)",
    panelStrong: "rgba(4, 10, 16, 0.74)",
    panelSoft: "rgba(14, 22, 30, 0.32)",
    line: "rgba(255, 255, 255, 0.14)",
    lineStrong: "rgba(255, 255, 255, 0.26)",
    skyTop: "#dbe7f1",
    skyMid: "#96a8bb",
    skyLow: "#354756",
    groundDark: "#24333d",
    groundMid: "#43545c",
    groundLight: "#74827c",
    shadow: "rgba(0, 0, 0, 0.34)",
  };
}

function getImageAsset(src) {
  if (!src) {
    return null;
  }
  if (!imageCache.has(src)) {
    const image = new Image();
    image.src = src;
    imageCache.set(src, image);
  }
  return imageCache.get(src);
}

function getSpriteTintSurface(width, height) {
  if (typeof document === "undefined") {
    return null;
  }
  if (!spriteTintCanvas) {
    spriteTintCanvas = document.createElement("canvas");
    spriteTintContext = spriteTintCanvas.getContext("2d");
  }
  if (!spriteTintContext) {
    return null;
  }
  if (spriteTintCanvas.width !== width || spriteTintCanvas.height !== height) {
    spriteTintCanvas.width = width;
    spriteTintCanvas.height = height;
  }
  spriteTintContext.setTransform(1, 0, 0, 1, 0, 0);
  spriteTintContext.globalAlpha = 1;
  spriteTintContext.globalCompositeOperation = "source-over";
  spriteTintContext.filter = "none";
  spriteTintContext.shadowBlur = 0;
  spriteTintContext.clearRect(0, 0, width, height);
  return {
    canvas: spriteTintCanvas,
    context: spriteTintContext,
  };
}

function drawSpriteTint(ctx, frame, fillTint) {
  const sourceWidth = Number.isFinite(frame.sourceWidth) ? frame.sourceWidth : frame.image.naturalWidth;
  const sourceHeight = Number.isFinite(frame.sourceHeight) ? frame.sourceHeight : frame.image.naturalHeight;
  const sourceX = Number.isFinite(frame.sourceWidth) ? (frame.sourceX ?? 0) : 0;
  const sourceY = Number.isFinite(frame.sourceHeight) ? (frame.sourceY ?? 0) : 0;
  const tintWidth = Math.max(1, Math.ceil(sourceWidth));
  const tintHeight = Math.max(1, Math.ceil(sourceHeight));
  const surface = getSpriteTintSurface(tintWidth, tintHeight);
  if (!surface) {
    return;
  }

  const tintCtx = surface.context;
  tintCtx.drawImage(
    frame.image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    tintWidth,
    tintHeight
  );
  tintCtx.globalCompositeOperation = "source-atop";
  tintCtx.fillStyle = fillTint;
  tintCtx.fillRect(0, 0, tintWidth, tintHeight);
  tintCtx.globalCompositeOperation = "source-over";

  ctx.drawImage(
    surface.canvas,
    0,
    0,
    tintWidth,
    tintHeight,
    -frame.drawWidth * frame.anchorX,
    -frame.drawHeight * frame.footAnchorY,
    frame.drawWidth,
    frame.drawHeight
  );
}

function beveledPath(ctx, x, y, width, height, cut = 18) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + width - cut, y);
  ctx.lineTo(x + width, y + cut);
  ctx.lineTo(x + width, y + height - cut);
  ctx.lineTo(x + width - cut, y + height);
  ctx.lineTo(x + cut, y + height);
  ctx.lineTo(x, y + height - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function drawBeveledPanel(ctx, theme, x, y, width, height, options = {}) {
  const {
    cut = 18,
    fill = theme.panel,
    stroke = theme.line,
    glow = false,
    innerLines = true,
  } = options;

  ctx.save();
  beveledPath(ctx, x, y, width, height, cut);
  ctx.fillStyle = fill;
  ctx.fill();

  if (glow) {
    ctx.shadowColor = theme.accentSecondary;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = "rgba(147, 234, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  beveledPath(ctx, x, y, width, height, cut);
  ctx.stroke();

  if (innerLines) {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + cut + 18, y + 14);
    ctx.lineTo(x + width - cut - 48, y + 14);
    ctx.lineTo(x + width - 18, y + 44);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 16, y + height - 18);
    ctx.lineTo(x + 84, y + height - 18);
    ctx.moveTo(x + width - 132, y + height - 18);
    ctx.lineTo(x + width - 42, y + height - 18);
    ctx.stroke();
  }

  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, color = "#f4efe2", font = ctx.font) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = font;
  const words = text.split(" ");
  let line = "";
  let lineIndex = 0;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      line = word;
      lineIndex += 1;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, x, y + lineIndex * lineHeight);
  }

  ctx.restore();
}

function drawStandingArt(ctx, data, key, x, y, width, height, alpha = 1) {
  const src = data.art?.[key]?.src;
  const image = getImageAsset(src);
  if (!image || !image.complete || !image.naturalWidth) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
}

function drawImageCover(ctx, image, x, y, width, height, alpha = 1) {
  if (!image || !image.complete || !image.naturalWidth || !image.naturalHeight) {
    return false;
  }

  const imageAspect = image.naturalWidth / image.naturalHeight;
  const frameAspect = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (imageAspect > frameAspect) {
    sw = image.naturalHeight * frameAspect;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / frameAspect;
    sy = (image.naturalHeight - sh) / 2;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  ctx.restore();
  return true;
}

function drawArtPanel(ctx, theme, data, key, x, y, width, height, options = {}) {
  const {
    cut = 18,
    fill = "rgba(7, 12, 18, 0.42)",
    stroke = "rgba(255,255,255,0.16)",
    glow = true,
    alpha = 1,
    overlay = "rgba(6, 10, 16, 0.12)",
  } = options;

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut,
    fill,
    stroke,
    glow,
    innerLines: false,
  });

  const src = data.art?.[key]?.src;
  const image = getImageAsset(src);
  if (!image || !image.complete || !image.naturalWidth) {
    return false;
  }

  ctx.save();
  beveledPath(ctx, x + 3, y + 3, width - 6, height - 6, cut);
  ctx.clip();
  drawImageCover(ctx, image, x, y, width, height, alpha);
  if (overlay) {
    ctx.fillStyle = overlay;
    ctx.fillRect(x, y, width, height);
  }
  ctx.restore();
  return true;
}

function drawFullscreenOverlayArt(ctx, data, key, alpha = 1) {
  const src = data.art?.[key]?.src;
  const image = getImageAsset(src);
  if (!image || !image.complete || !image.naturalWidth) {
    return false;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, 0, 0, 1280, 720);
  ctx.restore();
  return true;
}

function drawPortraitAsset(ctx, data, centerX, centerY, radius) {
  const assetKey = data.ui?.portraitAssetKey;
  const src = data.art?.[assetKey]?.src;
  const crop = data.ui?.portraitCrop;
  const image = getImageAsset(src);

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  const portraitGradient = ctx.createLinearGradient(centerX, centerY - radius, centerX, centerY + radius);
  portraitGradient.addColorStop(0, "rgba(210, 229, 243, 0.94)");
  portraitGradient.addColorStop(1, "rgba(48, 72, 92, 0.94)");
  ctx.fillStyle = portraitGradient;
  ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

  if (image && image.complete && image.naturalWidth && crop) {
    ctx.drawImage(
      image,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      centerX - radius,
      centerY - radius,
      radius * 2,
      radius * 2
    );
  }

  ctx.restore();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(147, 234, 255, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 6, -1.2, 1.5);
  ctx.stroke();
}

function drawCharacterBackdrop(ctx, theme, x, y, width, height) {
  const left = x - 26;
  const top = y + 18;
  const right = x + width + 22;
  const bottom = y + height - 12;

  ctx.save();

  const glow = ctx.createRadialGradient(
    x + width * 0.55,
    y + height * 0.36,
    28,
    x + width * 0.55,
    y + height * 0.36,
    width * 0.62
  );
  glow.addColorStop(0, "rgba(147, 234, 255, 0.18)");
  glow.addColorStop(0.48, "rgba(147, 234, 255, 0.08)");
  glow.addColorStop(1, "rgba(147, 234, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x + width * 0.55, y + height * 0.36, width * 0.64, 0, Math.PI * 2);
  ctx.fill();

  drawBeveledPanel(ctx, theme, left, top, right - left, bottom - top, {
    cut: 24,
    fill: "rgba(8, 14, 22, 0.22)",
    stroke: "rgba(147, 234, 255, 0.38)",
    glow: true,
  });

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left + 42, top + 16);
  ctx.lineTo(right - 88, top + 16);
  ctx.lineTo(right - 20, top + 84);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(left + 16, bottom - 66);
  ctx.lineTo(left + 16, top + 92);
  ctx.lineTo(left + 70, top + 38);
  ctx.stroke();

  ctx.strokeStyle = "rgba(147, 234, 255, 0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(right - 126, top + 26);
  ctx.lineTo(right - 82, top + 26);
  ctx.moveTo(right - 70, top + 26);
  ctx.lineTo(right - 46, top + 26);
  ctx.moveTo(left + 52, bottom - 28);
  ctx.lineTo(left + 92, bottom - 28);
  ctx.stroke();

  ctx.restore();
}

function sceneLabel(scene) {
  if (scene === SCENES.TITLE) {
    return "타이틀";
  }
  if (scene === SCENES.SHELTER) {
    return "쉘터";
  }
  if (scene === SCENES.EXPEDITION) {
    return "탐사";
  }
  if (scene === SCENES.RESULTS) {
    return "결과";
  }
  return "실패";
}

function objectiveLines(state) {
  if (state.scene === SCENES.TITLE) {
    if (isMovementLab(state.data)) {
      return [
        "실험실 입장",
        "몸 감각 점검",
      ];
    }
    return [
      "쉘터 연결",
      "규칙 확인",
    ];
  }

  if (state.scene === SCENES.SHELTER) {
    if (isMovementLab(state.data)) {
      return [
        "출격",
        "지형 점검",
        "오른쪽 출구",
      ];
    }
    return [
      "출격",
      "규칙 확인",
      "귀환",
    ];
  }

  if (state.scene === SCENES.EXPEDITION && state.run) {
    if (isMovementLab(state.data)) {
      return state.data.world.labObjectives;
    }

    const run = state.run;
    const lines = [];
    if (!run.inventory.badge) {
      lines.push("Recover the transit badge from the western locker.");
    }
    if (!run.encounters.guard.outcome) {
      lines.push("Release the warden by presenting the badge and holding still, or harvest it.");
    }
    if (!run.encounters.ritualist.outcome) {
      lines.push("Read the ritual order and align the pedestals, or harvest the ritualist.");
    }
    lines.push("Extract before the yard turns fully hostile.");
    return lines;
  }

  if (state.scene === SCENES.RESULTS) {
    return isMovementLab(state.data)
      ? [
        "감각 점검",
        "다시 출격",
      ]
      : [
        "결과 확인",
        "쉘터 복귀",
      ];
  }

  return [
    "런 무효",
    "쉘터 복귀",
  ];
}

function drawBackdropBase(ctx, theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(0.38, "#9fb2c5");
  sky.addColorStop(0.72, theme.skyMid);
  sky.addColorStop(1, theme.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 720);

  const bloom = ctx.createRadialGradient(830, 182, 40, 830, 182, 420);
  bloom.addColorStop(0, "rgba(255,255,255,0.76)");
  bloom.addColorStop(0.35, "rgba(233, 242, 248, 0.22)");
  bloom.addColorStop(1, "rgba(233, 242, 248, 0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, 1280, 720);
}

function drawSkyArches(ctx, theme, pulse, offset = 0) {
  const arches = [
    { x: 94 - offset * 0.06, y: 408, radius: 316, thickness: 76, alpha: 0.14 },
    { x: 412 - offset * 0.14, y: 372, radius: 258, thickness: 58, alpha: 0.16 },
    { x: 892 - offset * 0.22, y: 324, radius: 318, thickness: 82, alpha: 0.18 },
    { x: 1172 - offset * 0.3, y: 306, radius: 218, thickness: 64, alpha: 0.18 },
  ];

  arches.forEach((arch, index) => {
    ctx.strokeStyle = `rgba(41, 57, 72, ${arch.alpha})`;
    ctx.lineWidth = arch.thickness;
    ctx.beginPath();
    ctx.arc(arch.x, arch.y, arch.radius, 3.85, 6.2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255,255,255,${0.06 + index * 0.02})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(arch.x + 10, arch.y - 4, arch.radius + arch.thickness * 0.18, 4.02, 6.08);
    ctx.stroke();
  });

  ctx.strokeStyle = "rgba(17, 27, 38, 0.28)";
  ctx.lineWidth = 4;
  for (let index = 0; index < 12; index += 1) {
    const x = 180 + index * 88 - offset * (0.08 + index * 0.004);
    const height = 120 + (index % 4) * 34;
    ctx.beginPath();
    ctx.moveTo(x, 430 - height * 0.42);
    ctx.lineTo(x - 24, 610);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  for (let index = 0; index < 8; index += 1) {
    const x = 520 + index * 76 - offset * 0.18;
    ctx.beginPath();
    ctx.moveTo(x, 76 + Math.sin(pulse * 0.4 + index) * 10);
    ctx.lineTo(x + 48, 146 + Math.cos(pulse * 0.2 + index) * 12);
    ctx.stroke();
  }
}

function drawFogBands(ctx) {
  const mist = ctx.createLinearGradient(0, 300, 0, 620);
  mist.addColorStop(0, "rgba(244,248,252,0)");
  mist.addColorStop(0.22, "rgba(232,239,244,0.24)");
  mist.addColorStop(0.6, "rgba(214,224,232,0.16)");
  mist.addColorStop(1, "rgba(214,224,232,0)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, 250, 1280, 380);

  const lowFog = ctx.createLinearGradient(0, 470, 0, 720);
  lowFog.addColorStop(0, "rgba(217,226,232,0)");
  lowFog.addColorStop(0.36, "rgba(217,226,232,0.16)");
  lowFog.addColorStop(1, "rgba(35,46,56,0.56)");
  ctx.fillStyle = lowFog;
  ctx.fillRect(0, 460, 1280, 260);
}

function drawBirdFlocks(ctx, pulse, offset = 0) {
  ctx.strokeStyle = "rgba(46, 63, 82, 0.28)";
  ctx.lineWidth = 1.2;
  for (let index = 0; index < 28; index += 1) {
    const x = 320 + index * 18 - offset * 0.12 + Math.sin(pulse * 0.3 + index) * 4;
    const y = 130 + (index % 5) * 14 + Math.cos(pulse * 0.4 + index) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 5, y - 3);
    ctx.lineTo(x + 10, y);
    ctx.stroke();
  }
}

function drawScreenGroundWash(ctx) {
  const wash = ctx.createLinearGradient(0, 468, 0, 720);
  wash.addColorStop(0, "rgba(36, 51, 61, 0)");
  wash.addColorStop(0.4, "rgba(40, 54, 61, 0.32)");
  wash.addColorStop(1, "rgba(17, 27, 33, 0.82)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 456, 1280, 264);

  ctx.fillStyle = "rgba(138, 163, 112, 0.32)";
  ctx.beginPath();
  ctx.moveTo(0, 690);
  ctx.quadraticCurveTo(280, 592, 640, 640);
  ctx.quadraticCurveTo(980, 602, 1280, 664);
  ctx.lineTo(1280, 720);
  ctx.lineTo(0, 720);
  ctx.closePath();
  ctx.fill();
}

function drawScenicBackdrop(ctx, theme, pulse, offset = 0) {
  drawBackdropBase(ctx, theme);
  drawSkyArches(ctx, theme, pulse, offset);
  drawBirdFlocks(ctx, pulse, offset);
  drawFogBands(ctx);
  drawScreenGroundWash(ctx);
}

function drawTitleScene(ctx, state, data) {
  const theme = getUiTheme(data);
  drawScenicBackdrop(ctx, theme, state.pulse, 0);

  drawBeveledPanel(ctx, theme, 58, 42, 526, 300, {
    fill: "rgba(7, 13, 20, 0.54)",
    stroke: "rgba(255,255,255,0.16)",
    glow: true,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 14px 'Segoe UI', sans-serif";
  ctx.fillText("이동 실험실", 88, 82);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 60px 'Trebuchet MS', sans-serif";
  ctx.fillText(data.title.name, 86, 152);

  ctx.fillStyle = theme.textDim;
  ctx.font = "18px 'Segoe UI', sans-serif";
  ctx.fillText(data.title.subtitle, 88, 188);

  wrapText(
    ctx,
    data.title.description,
    88,
    236,
    440,
    30,
    theme.textDim,
    "16px 'Segoe UI', sans-serif"
  );

  ctx.fillStyle = theme.accent;
  ctx.font = "600 16px 'Segoe UI', sans-serif";
  ctx.fillText(isMovementLab(data) ? "C: 입장" : "C: 쉘터", 88, 314);

  drawCharacterBackdrop(ctx, theme, 722, 54, 454, 636);
  drawStandingArt(ctx, data, "operatorStanding", 742, 54, 420, 636, 0.98);

  drawBeveledPanel(ctx, theme, 1006, 404, 228, 174, {
    fill: "rgba(10, 18, 24, 0.42)",
    stroke: "rgba(255,255,255,0.18)",
  });
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText("개요", 1032, 434);
  objectiveLines(state).slice(0, 3).forEach((line, index) => {
    ctx.fillStyle = index === 0 ? theme.textMain : theme.textDim;
    ctx.font = "15px 'Segoe UI', sans-serif";
    ctx.fillText(`${index + 1}`, 1032, 468 + index * 34);
    wrapText(ctx, line, 1054, 468 + index * 34, 148, 22, ctx.fillStyle, "15px 'Segoe UI', sans-serif");
  });
}

function drawShelterScene(ctx, state, data) {
  const theme = getUiTheme(data);
  drawScenicBackdrop(ctx, theme, state.pulse * 0.9, 40);

  drawBeveledPanel(ctx, theme, 62, 54, 566, 336, {
    fill: "rgba(7, 12, 18, 0.58)",
    stroke: "rgba(255,255,255,0.18)",
    glow: true,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 14px 'Segoe UI', sans-serif";
  ctx.fillText("쉘터", 92, 92);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 54px 'Trebuchet MS', sans-serif";
  ctx.fillText("Type-07A", 90, 154);

  ctx.fillStyle = theme.textDim;
  ctx.font = "18px 'Segoe UI', sans-serif";
  ctx.fillText(`${data.shelterNpc.name}, ${data.shelterNpc.role}`, 92, 186);

  wrapText(
    ctx,
    data.shelterNpc.dialogue,
    92,
    238,
    470,
    34,
    theme.textDim,
    "18px 'Segoe UI', sans-serif"
  );

  ctx.fillStyle = theme.accent;
  ctx.font = "600 16px 'Segoe UI', sans-serif";
  ctx.fillText("C: 출격", 92, 360);

  drawBeveledPanel(ctx, theme, 92, 418, 404, 164, {
    fill: "rgba(8, 14, 22, 0.42)",
    stroke: "rgba(255,255,255,0.14)",
  });
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText("목표", 120, 448);
  objectiveLines(state).forEach((line, index) => {
    ctx.fillStyle = theme.textDim;
    ctx.font = "15px 'Segoe UI', sans-serif";
    ctx.fillText("•", 120, 484 + index * 34);
    wrapText(ctx, line, 136, 484 + index * 34, 324, 22, theme.textDim, "15px 'Segoe UI', sans-serif");
  });

  drawCharacterBackdrop(ctx, theme, 744, 70, 472, 652);
  drawStandingArt(ctx, data, "operatorStanding", 762, 80, 452, 650, 1);
}

function drawResultsScene(ctx, state, data, isFailure = false) {
  const theme = getUiTheme(data);
  drawScenicBackdrop(ctx, theme, state.pulse * 0.6, 90);

  ctx.fillStyle = "rgba(7, 10, 16, 0.56)";
  ctx.fillRect(0, 0, 1280, 720);

  drawBeveledPanel(ctx, theme, 170, 116, 940, 488, {
    fill: isFailure ? "rgba(33, 16, 18, 0.8)" : "rgba(8, 14, 22, 0.8)",
    stroke: "rgba(255,255,255,0.14)",
    glow: true,
  });

  drawPortraitAsset(ctx, data, 1000, 190, 58);

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 14px 'Segoe UI', sans-serif";
  ctx.fillText(isFailure ? "리셋" : "결과", 214, 168);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 48px 'Trebuchet MS', sans-serif";
  ctx.fillText(
    isMovementLab(data)
      ? (isFailure ? "실험 리셋" : "실험 종료")
      : (isFailure ? "런 실패" : "귀환 결과"),
    214,
    226
  );

  if (isMovementLab(data)) {
    wrapText(
      ctx,
      isFailure
        ? "실험이 초기화됐다."
        : "이동 감각 점검을 마쳤다.",
      214,
      278,
      620,
      34,
      theme.textDim,
      "18px 'Segoe UI', sans-serif"
    );

    ctx.fillStyle = theme.textMain;
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText(
      `구간: ${state.resultSummary?.timePhase === "night" ? "밤" : state.resultSummary?.timePhase === "dusk" ? "황혼" : "낮"}`,
      214,
      402
    );
    ctx.fillText(`자재: ${state.resultSummary?.materials || 0}`, 214, 438);
    ctx.fillText("상태: HUD 점검", 214, 474);
  } else if (isFailure) {
    wrapText(
      ctx,
      state.resultSummary?.reason === "sanity"
        ? "정신이 먼저 무너졌다."
        : "기체가 먼저 무너졌다.",
      214,
      278,
      620,
      34,
      theme.textDim,
      "18px 'Segoe UI', sans-serif"
    );
    ctx.fillStyle = theme.textMain;
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText(`손실 자재: ${state.resultSummary?.lostMaterials || 0}`, 214, 400);
  } else {
    const summary = state.resultSummary;
    wrapText(
      ctx,
      summary.nightReached
        ? "밤 이후 귀환."
        : "밤 전 귀환.",
      214,
      278,
      620,
      34,
      theme.textDim,
      "18px 'Segoe UI', sans-serif"
    );

    ctx.fillStyle = theme.textMain;
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText(`자재: ${summary.materials}`, 214, 392);
    ctx.fillText(`신뢰: ${summary.trustDelta >= 0 ? `+${summary.trustDelta}` : summary.trustDelta}`, 214, 428);
    ctx.fillText(`감시자: ${formatOutcome(summary.outcomes.guard)}`, 214, 464);
    ctx.fillText(`의식자: ${formatOutcome(summary.outcomes.ritualist)}`, 214, 500);
  }

  ctx.fillStyle = theme.accent;
  ctx.font = "600 16px 'Segoe UI', sans-serif";
  ctx.fillText("C: 복귀", 214, 564);
}

function drawWorldMegastructures(ctx, run) {
  const arches = [
    { x: 320, y: 940, radius: 520, thickness: 78, alpha: 0.18 },
    { x: 1380, y: 910, radius: 560, thickness: 92, alpha: 0.22 },
    { x: 2320, y: 930, radius: 480, thickness: 72, alpha: 0.18 },
    { x: 3240, y: 902, radius: 430, thickness: 60, alpha: 0.16 },
  ];

  arches.forEach((arch) => {
    ctx.strokeStyle = `rgba(31, 43, 57, ${arch.alpha})`;
    ctx.lineWidth = arch.thickness;
    ctx.beginPath();
    ctx.arc(arch.x, arch.y, arch.radius, 3.8, 6.06);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(arch.x + 16, arch.y - 10, arch.radius + arch.thickness * 0.2, 3.98, 6.0);
    ctx.stroke();
  });

  ctx.strokeStyle = "rgba(32, 46, 59, 0.28)";
  ctx.lineWidth = 5;
  for (let index = 0; index < 26; index += 1) {
    const x = 120 + index * 136;
    const height = 160 + (index % 5) * 40;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(run.time * 0.2 + index) * 6, 520 - height * 0.25);
    ctx.lineTo(x - 32, 960);
    ctx.stroke();
  }
}

function drawPlatformMass(ctx, platform, theme) {
  const topGradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height);
  topGradient.addColorStop(0, "rgba(212, 230, 236, 0.24)");
  topGradient.addColorStop(0.18, "rgba(112, 130, 139, 0.46)");
  topGradient.addColorStop(1, "rgba(25, 38, 46, 0.86)");
  ctx.fillStyle = topGradient;
  ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(platform.x, platform.y + platform.height - 8, platform.width, 8);

  ctx.fillStyle = "rgba(241, 249, 252, 0.34)";
  ctx.fillRect(platform.x, platform.y, platform.width, 3);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(platform.x, platform.y + 10);
  ctx.lineTo(platform.x + platform.width, platform.y + 10);
  ctx.stroke();

  const patchWidth = Math.max(24, platform.width * 0.22);
  ctx.fillStyle = "rgba(189, 224, 151, 0.34)";
  ctx.beginPath();
  ctx.ellipse(platform.x + patchWidth, platform.y + 8, patchWidth, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (platform.width > 140) {
    ctx.beginPath();
    ctx.ellipse(platform.x + platform.width * 0.7, platform.y + 8, patchWidth * 0.7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTerrain(ctx, data) {
  data.platforms.forEach((platform) => {
    drawPlatformMass(ctx, platform, getUiTheme(data));
  });

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  for (let index = 0; index < 24; index += 1) {
    const x = 120 + index * 140;
    ctx.beginPath();
    ctx.moveTo(x, 958);
    ctx.lineTo(x + 26, 928 - (index % 4) * 12);
    ctx.stroke();
  }
}

function drawGroundShine(ctx) {
  ctx.fillStyle = "rgba(219, 239, 176, 0.34)";
  ctx.beginPath();
  ctx.moveTo(180, 1010);
  ctx.quadraticCurveTo(620, 832, 1100, 910);
  ctx.quadraticCurveTo(1680, 864, 2260, 936);
  ctx.quadraticCurveTo(2740, 874, 3340, 934);
  ctx.lineTo(3340, 1080);
  ctx.lineTo(180, 1080);
  ctx.closePath();
  ctx.fill();
}

function drawGate(ctx, data, theme) {
  const gate = data.extractionGate;
  if (!gate) {
    return;
  }
  drawBeveledPanel(ctx, theme, gate.x - 14, gate.y - 18, gate.width + 28, gate.height + 24, {
    cut: 16,
    fill: "rgba(10, 20, 26, 0.22)",
    stroke: "rgba(147, 234, 255, 0.42)",
    glow: true,
  });
  ctx.fillStyle = "rgba(147, 234, 255, 0.16)";
  ctx.fillRect(gate.x, gate.y, gate.width, gate.height);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(gate.x + 10, gate.y, 6, gate.height);
  ctx.fillRect(gate.x + gate.width - 16, gate.y, 6, gate.height);
}

function drawRouteExits(ctx, data, theme) {
  (data.routeExits || []).forEach((routeExit) => {
    drawBeveledPanel(ctx, theme, routeExit.x - 14, routeExit.y - 18, routeExit.width + 28, routeExit.height + 24, {
      cut: 16,
      fill: "rgba(10, 20, 26, 0.2)",
      stroke: "rgba(231, 244, 126, 0.42)",
      glow: true,
    });
    ctx.fillStyle = "rgba(231, 244, 126, 0.12)";
    ctx.fillRect(routeExit.x, routeExit.y, routeExit.width, routeExit.height);
    ctx.strokeStyle = "rgba(231, 244, 126, 0.58)";
    ctx.lineWidth = 2;
    ctx.strokeRect(routeExit.x, routeExit.y, routeExit.width, routeExit.height);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "700 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(routeExit.label || "Route", routeExit.x + routeExit.width / 2, routeExit.y - 24);
    ctx.textAlign = "left";
  });
}

function drawBraceWalls(ctx, data, theme) {
  (data.braceWalls || []).forEach((wall) => {
    const gradient = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.width, wall.y);
    gradient.addColorStop(0, "rgba(120, 218, 255, 0.06)");
    gradient.addColorStop(0.5, "rgba(147, 234, 255, 0.2)");
    gradient.addColorStop(1, "rgba(120, 218, 255, 0.06)");
    ctx.fillStyle = gradient;
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

    ctx.strokeStyle = "rgba(147, 234, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);

    ctx.strokeStyle = "rgba(231, 244, 126, 0.32)";
    ctx.lineWidth = 1.5;
    for (let y = wall.y + 12; y < wall.y + wall.height - 12; y += 18) {
      ctx.beginPath();
      ctx.moveTo(wall.x + 8, y);
      ctx.lineTo(wall.x + wall.width - 8, y - 6);
      ctx.stroke();
    }

    ctx.fillStyle = theme.accentSecondary;
    ctx.fillRect(wall.x + wall.width * 0.5 - 3, wall.y + 10, 6, 22);
  });
}

function drawProps(ctx, data, pulse, theme) {
  data.props.forEach((prop) => {
    if (prop.kind === "lantern") {
      const glow = 0.18 + Math.sin(pulse * 2 + prop.x * 0.02) * 0.06;
      ctx.fillStyle = `rgba(231, 244, 126, ${glow})`;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.fillRect(prop.x - 3, prop.y - 18, 6, 18);
      return;
    }

    if (prop.kind === "sign") {
      drawBeveledPanel(ctx, theme, prop.x - 38, prop.y - 38, 76, 28, {
        cut: 8,
        fill: "rgba(8, 14, 22, 0.58)",
        stroke: "rgba(255,255,255,0.16)",
        innerLines: false,
      });
      ctx.fillStyle = theme.textMain;
      ctx.font = "12px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(prop.text, prop.x, prop.y - 18);
      ctx.textAlign = "left";
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y - 10);
      ctx.lineTo(prop.x, prop.y + 22);
      ctx.stroke();
    }
  });
}

function getLootRarityMeta(rarity) {
  return LOOT_RARITY_META[rarity] || LOOT_RARITY_META.common;
}

function getActiveLootCrate(run) {
  if (!run.loot?.active || !run.loot.crateId) {
    return null;
  }
  return (run.lootCrates || []).find((crate) => crate.id === run.loot.crateId) || null;
}

function drawLootCrates(ctx, run, theme) {
  (run.lootCrates || []).forEach((crate) => {
    const x = crate.x;
    const y = crate.y;
    const width = crate.width;
    const height = crate.height;
    const rarePulse = clamp(crate.rareSignalTimer ?? 0, 0, 1);
    const active = run.loot?.crateId === crate.id;
    const alpha = crate.searched ? 0.42 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (active || rarePulse > 0) {
      ctx.shadowColor = rarePulse > 0 ? "#f6e98a" : theme.accentSecondary;
      ctx.shadowBlur = 24 + rarePulse * 18;
    }

    drawBeveledPanel(ctx, theme, x, y, width, height, {
      cut: 8,
      fill: crate.opened ? "rgba(18, 30, 39, 0.82)" : "rgba(10, 17, 24, 0.9)",
      stroke: active ? "rgba(147, 234, 255, 0.86)" : "rgba(255, 255, 255, 0.2)",
      innerLines: false,
    });

    ctx.shadowBlur = 0;
    ctx.fillStyle = crate.opened ? "rgba(135, 225, 255, 0.18)" : "rgba(231, 244, 126, 0.16)";
    ctx.fillRect(x + 8, y + 8, width - 16, 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(x + width * 0.5 - 2, y + 8, 4, height - 14);
    ctx.strokeStyle = crate.searched ? "rgba(255,255,255,0.12)" : "rgba(147, 234, 255, 0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + height * 0.56);
    ctx.lineTo(x + width - 12, y + height * 0.56);
    ctx.stroke();

    if (!crate.searched) {
      const blink = 0.35 + Math.sin((run.time ?? 0) * 4 + x * 0.03) * 0.18;
      ctx.fillStyle = `rgba(147, 234, 255, ${blink})`;
      ctx.fillRect(x + width - 18, y + 12, 8, 8);
    }

    ctx.restore();
  });
}

function drawLootLeftArt(ctx, state, data, theme, x, y, width, height) {
  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 18,
    fill: "rgba(5, 11, 17, 0.72)",
    stroke: "rgba(255,255,255,0.14)",
    glow: true,
  });

  ctx.save();
  beveledPath(ctx, x, y, width, height, 18);
  ctx.clip();

  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "rgba(38, 70, 86, 0.52)");
  gradient.addColorStop(0.55, "rgba(9, 17, 26, 0.16)");
  gradient.addColorStop(1, "rgba(135, 225, 255, 0.12)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  drawStandingArt(ctx, data, "operatorStanding", x + 30, y + 34, width * 0.86, height * 0.94, 0.92);

  const crateX = x + 56;
  const crateY = y + height - 138;
  drawBeveledPanel(ctx, theme, crateX, crateY, width - 112, 82, {
    cut: 12,
    fill: "rgba(6, 13, 19, 0.88)",
    stroke: "rgba(147, 234, 255, 0.4)",
    innerLines: false,
  });
  ctx.fillStyle = "rgba(147, 234, 255, 0.16)";
  ctx.fillRect(crateX + 16, crateY + 18, width - 144, 9);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(crateX + (width - 112) * 0.5 - 3, crateY + 12, 6, 62);

  const crate = getActiveLootCrate(state.run);
  if (crate?.rareSignalTimer > 0) {
    const glow = clamp(crate.rareSignalTimer, 0, 1);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(246, 233, 138, ${0.1 + glow * 0.2})`;
    ctx.fillRect(x, y, width, height);
  }

  ctx.restore();
}

function drawLootSlot(ctx, theme, item, index, selected, x, y, width, height) {
  const visible = Boolean(item?.revealed || item?.looted);
  const meta = getLootRarityMeta(item.rarity);
  const progress = item.looted
    ? 1
    : clamp((item.transferProgress ?? item.lootProgress ?? 0) / Math.max(0.1, item.lootTime ?? 0.6), 0, 1);
  const revealFlash = clamp(item.revealFlash ?? 0, 0, 1);
  const blocked = clamp(item.blockedTimer ?? 0, 0, 1);

  ctx.save();
  ctx.globalAlpha = item.looted ? 0.4 : 1;

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 12,
    fill: visible
      ? (selected ? "rgba(13, 26, 36, 0.9)" : "rgba(7, 13, 20, 0.72)")
      : "rgba(255,255,255,0.045)",
    stroke: selected ? meta.color : "rgba(255,255,255,0.12)",
    innerLines: false,
  });

  if (!visible) {
    ctx.strokeStyle = "rgba(147, 234, 255, 0.14)";
    ctx.lineWidth = 1;
    for (let offset = -height; offset < width; offset += 18) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + height);
      ctx.lineTo(x + offset + height, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.font = "700 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("UNKNOWN", x + width / 2, y + height / 2 + 4);
    ctx.textAlign = "left";
    ctx.restore();
    return;
  }

  if ((selected && !item.looted) || revealFlash > 0) {
    ctx.fillStyle = revealFlash > 0 ? `rgba(147, 234, 255, ${0.16 + revealFlash * 0.22})` : meta.glow;
    ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
  }

  const iconX = x + 16;
  const iconY = y + 20;
  drawBeveledPanel(ctx, theme, iconX, iconY, 58, 58, {
    cut: 10,
    fill: "rgba(255,255,255,0.08)",
    stroke: meta.color,
    innerLines: false,
  });
  ctx.fillStyle = meta.glow;
  ctx.fillRect(iconX + 7, iconY + 7, 44, 44);
  ctx.fillStyle = meta.color;
  ctx.beginPath();
  ctx.moveTo(iconX + 29, iconY + 12);
  ctx.lineTo(iconX + 46, iconY + 29);
  ctx.lineTo(iconX + 29, iconY + 46);
  ctx.lineTo(iconX + 12, iconY + 29);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = meta.color;
  ctx.font = "700 11px 'Segoe UI', sans-serif";
  ctx.fillText(meta.label, x + 88, y + 24);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 16px 'Segoe UI', sans-serif";
  ctx.fillText(item.name, x + 88, y + 50);

  ctx.fillStyle = theme.textDim;
  ctx.font = "12px 'Segoe UI', sans-serif";
  const typeLabel = item.type ? String(item.type).toUpperCase() : "ITEM";
  ctx.fillText(typeLabel, x + 88, y + 72);
  ctx.textAlign = "right";
  ctx.fillText(`x${item.quantity ?? 1}`, x + width - 18, y + 24);
  ctx.fillText(`${Number(item.weight ?? 1).toFixed(1)}kg`, x + width - 18, y + 48);
  ctx.fillText(`+${Math.round(item.value ?? 0)}`, x + width - 18, y + 72);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fillRect(x + 16, y + height - 16, width - 32, 5);
  ctx.fillStyle = item.looted ? "rgba(255,255,255,0.42)" : meta.color;
  ctx.fillRect(x + 16, y + height - 16, (width - 32) * progress, 5);

  if (item.looted) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "700 11px 'Segoe UI', sans-serif";
    ctx.fillText("PACKED", x + 88, y + height - 25);
  } else if (selected) {
    ctx.fillStyle = blocked > 0 ? "#ff9fb4" : theme.textDim;
    ctx.font = "700 11px 'Segoe UI', sans-serif";
    ctx.fillText(blocked > 0 ? "PACK FULL" : "HOLD E TO TAKE", x + 88, y + height - 25);
  }

  ctx.restore();
}

function drawLootDetailPanel(ctx, theme, item, x, y, width, height) {
  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 14,
    fill: "rgba(5, 12, 18, 0.72)",
    stroke: "rgba(255,255,255,0.12)",
    innerLines: false,
  });

  if (!item || !item.revealed) {
    ctx.fillStyle = theme.textMute;
    ctx.font = "700 12px 'Segoe UI', sans-serif";
    ctx.fillText("SIGNAL", x + 22, y + 30);
    ctx.fillStyle = theme.textDim;
    ctx.font = "15px 'Segoe UI', sans-serif";
    ctx.fillText("수색 중인 슬롯", x + 22, y + 60);
    return;
  }

  const meta = getLootRarityMeta(item.rarity);
  ctx.fillStyle = meta.color;
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.fillText(meta.label, x + 22, y + 30);
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 22px 'Segoe UI', sans-serif";
  ctx.fillText(item.name, x + 22, y + 64);

  ctx.fillStyle = theme.textDim;
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText(`TYPE ${String(item.type || "item").toUpperCase()}`, x + 22, y + 102);
  ctx.fillText(`VALUE ${Math.round(item.value ?? 0)}`, x + 22, y + 126);
  ctx.fillText(`WEIGHT ${Number(item.weight ?? 1).toFixed(1)}kg`, x + 22, y + 150);
  ctx.fillText(`TRANSFER ${Number(item.lootTime ?? 0.6).toFixed(1)}s`, x + 22, y + 174);
}

function drawLootOverlay(ctx, state, data, theme) {
  const run = state.run;
  const crate = getActiveLootCrate(run);
  if (!crate) {
    return;
  }

  const rareSignal = clamp(run.loot?.rareSignalTimer ?? 0, 0, 1);
  const searchProgress = clamp((crate.searchProgress ?? 0) / Math.max(0.1, crate.searchTime ?? 1), 0, 1);
  const selectedItem = crate.items[run.loot.selectedIndex] || null;
  ctx.save();
  ctx.fillStyle = "rgba(2, 6, 10, 0.38)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  if (rareSignal > 0) {
    ctx.strokeStyle = `rgba(246, 233, 138, ${0.18 + rareSignal * 0.44})`;
    ctx.lineWidth = 3 + rareSignal * 5;
    ctx.strokeRect(24, 24, SCREEN_WIDTH - 48, SCREEN_HEIGHT - 48);
  }

  drawLootLeftArt(ctx, state, data, theme, 34, 126, 350, 548);

  const panelX = 428;
  const panelY = 72;
  const panelW = 808;
  const panelH = 602;
  drawBeveledPanel(ctx, theme, panelX, panelY, panelW, panelH, {
    cut: 20,
    fill: "rgba(4, 10, 16, 0.82)",
    stroke: rareSignal > 0 ? "rgba(246, 233, 138, 0.68)" : "rgba(147, 234, 255, 0.2)",
    glow: rareSignal > 0,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.fillText(crate.scanComplete ? "CONTAINER" : "SEARCHING", panelX + 34, panelY + 38);
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 30px 'Segoe UI', sans-serif";
  ctx.fillText(crate.label, panelX + 34, panelY + 75);

  const remaining = crate.items.filter((item) => !item.looted).length;
  ctx.textAlign = "right";
  ctx.fillStyle = theme.textDim;
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText(`${remaining}/${crate.items.length} ITEMS`, panelX + panelW - 34, panelY + 48);
  ctx.fillText("W/S SELECT  ·  ESC CLOSE", panelX + panelW - 34, panelY + 72);
  ctx.textAlign = "left";

  ctx.save();
  ctx.fillStyle = "rgba(4, 10, 16, 0.92)";
  ctx.fillRect(panelX + panelW - 390, panelY + 57, 358, 22);
  ctx.textAlign = "right";
  ctx.fillStyle = theme.textDim;
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText("WASD SELECT  ·  HOLD E TAKE  ·  ESC CLOSE", panelX + panelW - 34, panelY + 72);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(panelX + 34, panelY + 94, panelW - 68, 6);
  ctx.fillStyle = crate.scanComplete ? theme.accentSecondary : theme.accent;
  ctx.fillRect(panelX + 34, panelY + 94, (panelW - 68) * searchProgress, 6);
  ctx.fillStyle = crate.scanComplete ? theme.textDim : theme.accent;
  ctx.font = "700 11px 'Segoe UI', sans-serif";
  ctx.fillText(crate.scanComplete ? "CONTENTS IDENTIFIED" : "SCANNING CONTENTS", panelX + 34, panelY + 118);

  const listX = panelX + 34;
  const listY = panelY + 142;
  const cardW = 238;
  const cardH = 112;
  const gap = 14;
  const columns = 3;

  if (!crate.items.length) {
    ctx.fillStyle = theme.textDim;
    ctx.font = "18px 'Segoe UI', sans-serif";
    ctx.fillText("비어 있음", listX, listY + 36);
  }

  crate.items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawLootSlot(
      ctx,
      theme,
      item,
      index,
      index === run.loot.selectedIndex,
      listX + column * (cardW + gap),
      listY + row * (cardH + gap),
      cardW,
      cardH
    );
  });

  const detailY = listY + Math.ceil(Math.max(1, crate.items.length) / columns) * (cardH + gap) + 10;
  drawLootDetailPanel(ctx, theme, selectedItem, listX, detailY, 344, 190);

  const packX = listX + 372;
  const packY = detailY;
  const packW = panelW - 68 - 372;
  const packH = 190;
  drawBeveledPanel(ctx, theme, packX, packY, packW, packH, {
    cut: 14,
    fill: "rgba(5, 12, 18, 0.68)",
    stroke: "rgba(255,255,255,0.12)",
    innerLines: false,
  });
  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.fillText("BACKPACK", packX + 22, packY + 30);
  const capacity = Math.max(1, run.lootCapacity ?? 16);
  const weight = clamp((run.lootWeight ?? 0) / capacity, 0, 1);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(packX + 22, packY + 50, packW - 44, 8);
  ctx.fillStyle = weight > 0.82 ? "#ff9fb4" : theme.accentSecondary;
  ctx.fillRect(packX + 22, packY + 50, (packW - 44) * weight, 8);
  ctx.fillStyle = theme.textDim;
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(`${Number(run.lootWeight ?? 0).toFixed(1)} / ${capacity.toFixed(1)}kg`, packX + 22, packY + 78);

  const recent = run.lootInventory.slice(-3);
  if (!recent.length) {
    ctx.fillStyle = theme.textMute;
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillText("NO SECURED ITEMS", packX + 22, packY + 116);
  }
  recent.forEach((item, index) => {
    const meta = getLootRarityMeta(item.rarity);
    const chipY = packY + 104 + index * 24;
    ctx.fillStyle = meta.glow;
    ctx.fillRect(packX + 22, chipY - 12, packW - 44, 18);
    ctx.fillStyle = meta.color;
    ctx.font = "700 11px 'Segoe UI', sans-serif";
    ctx.fillText(item.name, packX + 30, chipY + 1);
  });

  ctx.fillStyle = "rgba(147, 234, 255, 0.12)";
  ctx.fillRect(panelX + 34, panelY + panelH - 44, panelW - 68, 1);
  ctx.fillStyle = theme.textDim;
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(`획득 재료 ${Math.round(run.materials)}  ·  보관 ${run.lootInventory.length}`, panelX + 34, panelY + panelH - 20);
  ctx.fillStyle = "rgba(4, 10, 16, 0.94)";
  ctx.fillRect(panelX + 34, panelY + panelH - 38, 320, 22);
  ctx.fillStyle = theme.textDim;
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(`MATERIAL ${Math.round(run.materials)}  ·  SECURED ${run.lootInventory.length}`, panelX + 34, panelY + panelH - 20);
  ctx.restore();
}

function drawLootPanelTitle(ctx, theme, title, meta, x, y, width) {
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 20px 'Segoe UI', sans-serif";
  ctx.fillText(title, x, y);
  if (meta) {
    ctx.textAlign = "right";
    ctx.fillStyle = theme.textDim;
    ctx.font = "700 12px 'Segoe UI', sans-serif";
    ctx.fillText(meta, x + width, y - 2);
    ctx.textAlign = "left";
  }
}

function drawLootRummageArt(ctx, state, data, theme, x, y, width, height) {
  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 20,
    fill: "rgba(3, 8, 13, 0.7)",
    stroke: "rgba(147, 234, 255, 0.16)",
    glow: true,
    innerLines: false,
  });

  ctx.save();
  beveledPath(ctx, x, y, width, height, 20);
  ctx.clip();

  const background = ctx.createLinearGradient(x, y, x + width * 0.8, y + height);
  background.addColorStop(0, "rgba(22, 36, 48, 0.78)");
  background.addColorStop(0.55, "rgba(7, 14, 22, 0.54)");
  background.addColorStop(1, "rgba(18, 34, 42, 0.72)");
  ctx.fillStyle = background;
  ctx.fillRect(x, y, width, height);

  const customArt = getImageAsset(data.art?.lootRummage?.src);
  if (customArt && customArt.complete && customArt.naturalWidth) {
    const scale = Math.min(width / customArt.naturalWidth, height / customArt.naturalHeight);
    const drawWidth = customArt.naturalWidth * scale;
    const drawHeight = customArt.naturalHeight * scale;
    ctx.globalAlpha = 0.96;
    ctx.drawImage(
      customArt,
      x + (width - drawWidth) / 2,
      y + (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    ctx.globalAlpha = 1;
  } else {
    drawStandingArt(ctx, data, "operatorStanding", x - 8, y + 18, width * 0.98, height * 0.94, 0.9);

    const chestX = x + 34;
    const chestY = y + height - 190;
    const chestW = width - 68;
    const chestH = 124;

    ctx.save();
    ctx.translate(chestX + chestW / 2, chestY + 16);
    ctx.rotate(-0.08);
    drawBeveledPanel(ctx, theme, -chestW / 2, -24, chestW, 56, {
      cut: 14,
      fill: "rgba(83, 70, 50, 0.92)",
      stroke: "rgba(231, 244, 126, 0.32)",
      innerLines: false,
    });
    ctx.fillStyle = "rgba(190, 165, 100, 0.55)";
    ctx.fillRect(-chestW / 2 + 22, -10, chestW - 44, 8);
    ctx.restore();

    drawBeveledPanel(ctx, theme, chestX, chestY + 34, chestW, chestH, {
      cut: 16,
      fill: "rgba(48, 39, 30, 0.96)",
      stroke: "rgba(147, 234, 255, 0.28)",
      innerLines: false,
    });
    ctx.fillStyle = "rgba(147, 234, 255, 0.12)";
    ctx.fillRect(chestX + 18, chestY + 54, chestW - 36, 10);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(chestX + chestW / 2 - 4, chestY + 44, 8, chestH - 18);
  }

  const crate = getActiveLootCrate(state.run);
  const pulse = clamp(crate?.rareSignalTimer ?? 0, 0, 1);
  if (pulse > 0) {
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(246, 233, 138, ${0.08 + pulse * 0.18})`;
    ctx.fillRect(x, y, width, height);
  }

  ctx.restore();
}

function drawLootCell(ctx, theme, item, selected, x, y, size) {
  const visible = Boolean(item?.revealed || item?.looted);
  const meta = visible ? getLootRarityMeta(item.rarity) : null;
  const progress = item?.looted
    ? 1
    : clamp((item?.transferProgress ?? item?.lootProgress ?? 0) / Math.max(0.1, item?.lootTime ?? 0.6), 0, 1);
  const revealFlash = clamp(item?.revealFlash ?? 0, 0, 1);
  const blocked = clamp(item?.blockedTimer ?? 0, 0, 1);

  drawBeveledPanel(ctx, theme, x, y, size, size, {
    cut: 10,
    fill: visible ? "rgba(8, 15, 24, 0.82)" : "rgba(255,255,255,0.035)",
    stroke: selected && visible ? meta.color : "rgba(255,255,255,0.13)",
    innerLines: false,
  });

  if (selected && visible) {
    ctx.fillStyle = meta.glow;
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
  }
  if (revealFlash > 0) {
    ctx.fillStyle = `rgba(147, 234, 255, ${0.12 + revealFlash * 0.28})`;
    ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
  }

  if (!visible) {
    ctx.strokeStyle = "rgba(147, 234, 255, 0.12)";
    ctx.lineWidth = 1;
    for (let offset = -size; offset < size; offset += 15) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y + size);
      ctx.lineTo(x + offset + size, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.26)";
    ctx.font = "700 20px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("?", x + size / 2, y + size / 2 + 8);
    ctx.textAlign = "left";
    return;
  }

  ctx.fillStyle = meta.glow;
  ctx.fillRect(x + 11, y + 12, size - 22, size - 24);
  ctx.fillStyle = meta.color;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y + 17);
  ctx.lineTo(x + size - 18, y + size / 2);
  ctx.lineTo(x + size / 2, y + size - 20);
  ctx.lineTo(x + 18, y + size / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = item.looted ? "rgba(255,255,255,0.36)" : meta.color;
  ctx.fillRect(x + 8, y + size - 9, (size - 16) * progress, 4);

  ctx.fillStyle = blocked > 0 ? "#ff9fb4" : "rgba(255,255,255,0.72)";
  ctx.font = "700 10px 'Segoe UI', sans-serif";
  ctx.fillText(item.looted ? "PACK" : `x${item.quantity ?? 1}`, x + 8, y + 14);

  ctx.textAlign = "right";
  ctx.fillStyle = meta.color;
  ctx.fillText(String(item.rarity || "").toUpperCase().slice(0, 1), x + size - 8, y + 14);
  ctx.textAlign = "left";
}

function drawBackpackCell(ctx, theme, item, x, y, size) {
  const hasItem = Boolean(item);
  const meta = hasItem ? getLootRarityMeta(item.rarity) : null;
  drawBeveledPanel(ctx, theme, x, y, size, size, {
    cut: 10,
    fill: hasItem ? "rgba(8, 15, 24, 0.78)" : "rgba(255,255,255,0.03)",
    stroke: hasItem ? meta.color : "rgba(255,255,255,0.1)",
    innerLines: false,
  });
  if (!hasItem) {
    return;
  }

  ctx.fillStyle = meta.glow;
  ctx.fillRect(x + 9, y + 9, size - 18, size - 24);
  ctx.fillStyle = meta.color;
  ctx.beginPath();
  ctx.roundRect?.(x + 22, y + 17, size - 44, size - 38, 6);
  if (ctx.roundRect) {
    ctx.fill();
  } else {
    ctx.fillRect(x + 22, y + 17, size - 44, size - 38);
  }
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.font = "700 10px 'Segoe UI', sans-serif";
  ctx.fillText(item.name.slice(0, 10), x + 8, y + size - 8);
}

function drawLootDetailCompact(ctx, theme, item, x, y, width, height) {
  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 16,
    fill: "rgba(5, 12, 18, 0.74)",
    stroke: "rgba(255,255,255,0.12)",
    innerLines: false,
  });

  if (!item || !item.revealed) {
    ctx.fillStyle = theme.textMute;
    ctx.font = "700 12px 'Segoe UI', sans-serif";
    ctx.fillText("ITEM DETAIL", x + 22, y + 30);
    ctx.fillStyle = theme.textDim;
    ctx.font = "15px 'Segoe UI', sans-serif";
    ctx.fillText("Scanning container...", x + 22, y + 66);
    return;
  }

  const meta = getLootRarityMeta(item.rarity);
  const progress = item.looted
    ? 1
    : clamp((item.transferProgress ?? item.lootProgress ?? 0) / Math.max(0.1, item.lootTime ?? 0.6), 0, 1);

  ctx.fillStyle = meta.color;
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.fillText(meta.label, x + 22, y + 30);
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 22px 'Segoe UI', sans-serif";
  ctx.fillText(item.name, x + 22, y + 64);

  ctx.fillStyle = theme.textDim;
  ctx.font = "13px 'Segoe UI', sans-serif";
  ctx.fillText(`TYPE  ${String(item.type || "item").toUpperCase()}`, x + 22, y + 102);
  ctx.fillText(`VALUE ${Math.round(item.value ?? 0)}`, x + 22, y + 126);
  ctx.fillText(`WEIGHT ${Number(item.weight ?? 1).toFixed(1)}kg`, x + 22, y + 150);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x + 22, y + height - 36, width - 44, 7);
  ctx.fillStyle = item.looted ? "rgba(255,255,255,0.4)" : meta.color;
  ctx.fillRect(x + 22, y + height - 36, (width - 44) * progress, 7);
}

function drawLootOverlayV2(ctx, state, data, theme) {
  const run = state.run;
  const crate = getActiveLootCrate(run);
  if (!crate) {
    return;
  }

  const rareSignal = clamp(run.loot?.rareSignalTimer ?? 0, 0, 1);
  const searchProgress = clamp((crate.searchProgress ?? 0) / Math.max(0.1, crate.searchTime ?? 1), 0, 1);
  const selectedItem = crate.items[run.loot.selectedIndex] || null;
  const remaining = crate.items.filter((item) => !item.looted).length;

  ctx.save();
  ctx.fillStyle = "rgba(1, 5, 10, 0.58)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const haze = ctx.createRadialGradient(760, 280, 120, 760, 280, 720);
  haze.addColorStop(0, "rgba(76, 118, 150, 0.16)");
  haze.addColorStop(0.55, "rgba(6, 12, 20, 0.34)");
  haze.addColorStop(1, "rgba(0, 0, 0, 0.42)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  if (rareSignal > 0) {
    ctx.strokeStyle = `rgba(246, 233, 138, ${0.2 + rareSignal * 0.42})`;
    ctx.lineWidth = 3 + rareSignal * 5;
    ctx.strokeRect(28, 28, SCREEN_WIDTH - 56, SCREEN_HEIGHT - 56);
  }

  const artX = 30;
  const artY = 58;
  const artW = 330;
  const artH = 616;
  drawLootRummageArt(ctx, state, data, theme, artX, artY, artW, artH);

  const containerX = 386;
  const containerY = 82;
  const containerW = 298;
  const containerH = 276;
  drawBeveledPanel(ctx, theme, containerX, containerY, containerW, containerH, {
    cut: 18,
    fill: "rgba(5, 11, 18, 0.78)",
    stroke: "rgba(147, 234, 255, 0.16)",
    innerLines: false,
  });
  drawLootPanelTitle(ctx, theme, "CONTAINER", `${remaining}/${crate.items.length}`, containerX + 22, containerY + 36, containerW - 44);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(containerX + 22, containerY + 55, containerW - 44, 6);
  ctx.fillStyle = crate.scanComplete ? theme.accentSecondary : theme.accent;
  ctx.fillRect(containerX + 22, containerY + 55, (containerW - 44) * searchProgress, 6);

  const cellSize = 56;
  const cellGap = 10;
  const gridX = containerX + 22;
  const gridY = containerY + 82;
  const slots = Math.max(8, crate.items.length);
  for (let index = 0; index < slots; index += 1) {
    const item = crate.items[index];
    const column = index % 4;
    const row = Math.floor(index / 4);
    drawLootCell(
      ctx,
      theme,
      item || { revealed: false, looted: false },
      index === run.loot.selectedIndex,
      gridX + column * (cellSize + cellGap),
      gridY + row * (cellSize + cellGap),
      cellSize
    );
  }

  const detailX = 386;
  const detailY = 384;
  const detailW = 298;
  const detailH = 290;
  drawLootDetailCompact(ctx, theme, selectedItem, detailX, detailY, detailW, detailH);

  const packX = 710;
  const packY = 82;
  const packW = 538;
  const packH = 592;
  drawBeveledPanel(ctx, theme, packX, packY, packW, packH, {
    cut: 20,
    fill: "rgba(4, 10, 16, 0.82)",
    stroke: "rgba(147, 234, 255, 0.16)",
    glow: rareSignal > 0,
    innerLines: false,
  });

  const capacity = Math.max(1, run.lootCapacity ?? 16);
  const weightRatio = clamp((run.lootWeight ?? 0) / capacity, 0, 1);
  drawLootPanelTitle(ctx, theme, "BACKPACK", `${run.lootInventory.length}/16`, packX + 26, packY + 38, packW - 52);
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fillRect(packX + 26, packY + 58, packW - 52, 7);
  ctx.fillStyle = weightRatio > 0.82 ? "#ff9fb4" : theme.accentSecondary;
  ctx.fillRect(packX + 26, packY + 58, (packW - 52) * weightRatio, 7);
  ctx.fillStyle = theme.textDim;
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(`${Number(run.lootWeight ?? 0).toFixed(1)} / ${capacity.toFixed(1)}kg`, packX + 26, packY + 84);

  const packGridX = packX + 26;
  const packGridY = packY + 112;
  const packCell = 72;
  const packGap = 12;
  for (let index = 0; index < 16; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    drawBackpackCell(
      ctx,
      theme,
      run.lootInventory[index],
      packGridX + column * (packCell + packGap),
      packGridY + row * (packCell + packGap),
      packCell
    );
  }

  const sideX = packX + 380;
  const sideY = packY + 112;
  drawLootPanelTitle(ctx, theme, "QUICK", "4/4", sideX, sideY - 10, 120);
  for (let index = 0; index < 4; index += 1) {
    drawBackpackCell(ctx, theme, run.lootInventory[index + 16], sideX, sideY + index * 78, 66);
  }
  drawLootPanelTitle(ctx, theme, "SAFE", "0/1", sideX, sideY + 348, 120);
  drawBackpackCell(ctx, theme, null, sideX, sideY + 374, 66);

  ctx.restore();
}

function drawEntity(ctx, entity, palette, label) {
  if (isEntityDisabled(entity) || entity.state === "released") {
    return;
  }
  const bodyColor = entity.hitFlash > 0 ? palette.flash : palette.body;
  ctx.fillStyle = bodyColor;
  ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
  ctx.fillStyle = palette.eye;
  ctx.fillRect(entity.x + (entity.facing === 1 ? entity.width - 16 : 6), entity.y + 16, 10, 10);
  ctx.fillStyle = palette.trim;
  ctx.fillRect(entity.x + 10, entity.y + entity.height - 14, entity.width - 20, 6);
  if (label) {
    ctx.fillStyle = "#ede7d7";
    ctx.font = "13px 'Segoe UI', sans-serif";
    ctx.fillText(label, entity.x - 6, entity.y - 10);
  }
}

function isHumanoidDrawable(entity) {
  return Boolean(
    entity &&
    !entity.dead &&
    entity.state !== "dead" &&
    entity.state !== "escaped" &&
    entity.state !== "released"
  );
}

function drawHumanoidEnemy(ctx, enemy) {
  if (!isHumanoidDrawable(enemy)) {
    return;
  }

  const cx = enemy.x + enemy.width * 0.5;
  const hitFlash = enemy.hitFlash > 0;
  const resolved = enemy.state === "disabled" || enemy.state === "surrendered" || enemy.state === "dealt";
  const coat = hitFlash ? "#f3f6f7" : resolved ? "#5b6063" : enemy.active ? "#34383d" : "#4b5055";
  const line = enemy.active ? "rgba(255, 118, 132, 0.7)" : "rgba(255,255,255,0.28)";

  if (enemy.state === "knockedDown") {
    const baseY = enemy.y + enemy.height - 10;
    const exhaustion = enemy.exhaustionHits ?? 0;
    const exhaustionLimit = Math.max(1, enemy.exhaustionLimit ?? 2);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 8, enemy.width * 0.92, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, baseY - 18);
    ctx.scale(enemy.facing === -1 ? -1 : 1, 1);
    ctx.strokeStyle = hitFlash ? "#ffffff" : "rgba(220,224,226,0.82)";
    ctx.fillStyle = hitFlash ? "#ffffff" : "#3f444a";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-34, 6);
    ctx.lineTo(26, -1);
    ctx.lineTo(44, 8);
    ctx.stroke();

    ctx.fillStyle = hitFlash ? "#ffffff" : "#c8c9c6";
    ctx.beginPath();
    ctx.arc(46, -6, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hitFlash ? "#ffffff" : "rgba(255,118,132,0.64)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(2, 4);
    ctx.lineTo(-28, 24);
    ctx.moveTo(-14, 4);
    ctx.lineTo(-45, 20);
    ctx.stroke();

    ctx.restore();

    drawBeveledPanel(ctx, { font: "700 12px 'Segoe UI', sans-serif" }, enemy.x - 9, enemy.y - 24, enemy.width + 18, 22, {
      fill: "rgba(8, 10, 14, 0.62)",
      stroke: "rgba(255,255,255,0.2)",
      cut: 5,
      innerLines: false,
    });
    ctx.fillStyle = "rgba(245,248,251,0.82)";
    ctx.font = "700 11px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`탈진 ${exhaustion}/${exhaustionLimit}`, cx, enemy.y - 9);
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx, enemy.y + enemy.height + 5, enemy.width * 0.48, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, resolved ? enemy.y + 24 : enemy.y);
  ctx.scale(enemy.facing === -1 ? -1 : 1, 1);
  if (enemy.state === "disabled") {
    ctx.rotate(-0.82);
  }

  ctx.fillStyle = hitFlash ? "#ffffff" : "#c8c9c6";
  ctx.beginPath();
  ctx.arc(0, 16, 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = coat;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-22, 34);
  ctx.lineTo(22, 34);
  ctx.lineTo(18, 78);
  ctx.lineTo(8, 104);
  ctx.lineTo(-8, 104);
  ctx.lineTo(-18, 78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = resolved ? "rgba(220,220,220,0.56)" : line;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(20, 48);
  ctx.lineTo(resolved ? 33 : 43, resolved ? 80 : 58);
  ctx.lineTo(resolved ? 42 : 52, resolved ? 88 : 55);
  ctx.stroke();

  ctx.strokeStyle = "rgba(230,230,230,0.84)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-8, 102);
  ctx.lineTo(-16, 132);
  ctx.moveTo(8, 102);
  ctx.lineTo(16, 132);
  ctx.stroke();
  ctx.restore();

  const hpRatio = clamp((enemy.hp ?? enemy.maxHp ?? 100) / Math.max(1, enemy.maxHp ?? 100), 0, 1);
  const staggerRatio = clamp((enemy.stagger ?? 0) / Math.max(1, enemy.staggerMax ?? 100), 0, 1);
  const triggerRatio = clamp((enemy.trigger ?? 0) / 4.5, 0, 1);
  const breakActive = (enemy.staggerBreakTimer ?? 0) > 0;
  const barX = enemy.x;
  const barW = enemy.width;

  if (breakActive) {
    ctx.save();
    ctx.fillStyle = "rgba(8, 10, 14, 0.72)";
    ctx.fillRect(enemy.x + enemy.width * 0.5 - 25, enemy.y - 34, 50, 14);
    ctx.fillStyle = "#e7f47e";
    ctx.font = "800 10px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BREAK", enemy.x + enemy.width * 0.5, enemy.y - 23);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(barX, enemy.y - 18, barW, 4);
  ctx.fillStyle = "#dce7ec";
  ctx.fillRect(barX, enemy.y - 18, barW * hpRatio, 4);
  if (staggerRatio > 0.02 || breakActive) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(barX, enemy.y - 12, barW, 3);
    ctx.fillStyle = breakActive ? "#e7f47e" : "rgba(231, 244, 126, 0.86)";
    ctx.fillRect(barX, enemy.y - 12, barW * (breakActive ? 1 : staggerRatio), 3);
  }
  if (triggerRatio > 0.02) {
    ctx.fillStyle = "rgba(255, 88, 104, 0.78)";
    ctx.fillRect(barX, enemy.y - 7, barW * triggerRatio, 3);
  }
}

function drawHumanoidEnemies(ctx, run) {
  (run.humanoidEnemies || []).forEach((enemy) => drawHumanoidEnemy(ctx, enemy));
}

function drawHostileCrow(ctx, run, crow) {
  const cx = crow.x + crow.width * 0.5;
  const cy = crow.y + crow.height * 0.5;
  const time = run.time ?? 0;
  const flap = Math.sin(time * (crow.flapRate ?? 13) + crow.bobSeed);
  const diveActive = crow.diveTimer > 0;
  const hitFlash = crow.hitFlash > 0;
  const speedAngle = clamp((crow.vy ?? 0) / 900, -0.45, 0.45);
  const bodyColor = hitFlash ? "#f8fbfd" : diveActive ? "#05070b" : "#071018";
  const wingColor = hitFlash ? "#dff6ff" : "#03070d";
  const featherColor = hitFlash ? "#f6fbff" : "#101a25";
  const eyeColor = diveActive ? "#ff7892" : "#87e1ff";
  const wingReach = 34 + Math.max(0, -flap) * 14;
  const wingLift = -10 - flap * 22;
  const wingDrop = 11 + flap * 10;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = `rgba(7, 12, 20, ${diveActive ? 0.2 : 0.14})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + crow.height * 0.34, crow.width * 0.52, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(crow.facing === -1 ? -1 : 1, 1);
  ctx.rotate(speedAngle + (diveActive ? -0.08 : 0));

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = featherColor;
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.moveTo(-24, 4);
  ctx.lineTo(-42, -2);
  ctx.lineTo(-36, 8);
  ctx.lineTo(-48, 12);
  ctx.lineTo(-24, 14);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = wingColor;
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.bezierCurveTo(-24, wingLift - 6, -wingReach, wingLift, -wingReach - 12, wingDrop);
  ctx.bezierCurveTo(-wingReach * 0.62, wingDrop + 6, -20, 12, -2, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(2, 2, 26, 15, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wingColor;
  ctx.beginPath();
  ctx.moveTo(2, -4);
  ctx.bezierCurveTo(18, wingLift - 8, 34 + wingReach * 0.44, wingLift + 3, 38 + wingReach * 0.34, wingDrop + 4);
  ctx.bezierCurveTo(24, wingDrop + 10, 10, 13, 0, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(24, -4, 12, 10, 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = diveActive ? "#ff7892" : "#1f2e3a";
  ctx.beginPath();
  ctx.moveTo(35, -5);
  ctx.lineTo(47, -1);
  ctx.lineTo(35, 3);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = diveActive ? "rgba(255, 120, 146, 0.9)" : "rgba(135, 225, 255, 0.9)";
  ctx.shadowBlur = diveActive ? 12 : 8;
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(28, -7, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = diveActive ? "rgba(255, 120, 146, 0.58)" : "rgba(135, 225, 255, 0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.quadraticCurveTo(10, -8, 24, -4);
  ctx.stroke();

  if (diveActive) {
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(135, 225, 255, 0.36)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-28, 9);
    ctx.lineTo(-54, 16);
    ctx.stroke();
  }

  ctx.restore();

  if (crow.hp < crow.maxHp && crow.hp > 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(crow.x + 5, crow.y - 10, crow.width - 10, 4);
    ctx.fillStyle = "#87e1ff";
    ctx.fillRect(crow.x + 5, crow.y - 10, (crow.width - 10) * (crow.hp / crow.maxHp), 4);
  }
}

function drawHostileDrones(ctx, run) {
  (run.hostileDrones || []).forEach((drone) => {
    if (isEntityDisabled(drone) || drone.dead) {
      return;
    }
    if (drone.visualKind === "crow") {
      drawHostileCrow(ctx, run, drone);
      return;
    }

    const cx = drone.x + drone.width * 0.5;
    const cy = drone.y + drone.height * 0.5;
    const pulse = 0.5 + Math.sin((run.time ?? 0) * 8 + drone.bobSeed) * 0.5;
    const bodyColor = drone.hitFlash > 0 ? "#f8fbfd" : drone.active ? "#17283a" : "#243646";
    const glowColor = drone.active ? "rgba(135, 225, 255, 0.72)" : "rgba(147, 234, 255, 0.36)";

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(135, 225, 255, ${0.12 + pulse * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, drone.width * 0.72, drone.height * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(drone.facing === -1 ? -1 : 1, 1);

    ctx.fillStyle = "rgba(5, 12, 20, 0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 10, drone.width * 0.44, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-drone.width * 0.38, -4);
    ctx.lineTo(-drone.width * 0.2, -drone.height * 0.42);
    ctx.lineTo(drone.width * 0.32, -drone.height * 0.34);
    ctx.lineTo(drone.width * 0.48, 0);
    ctx.lineTo(drone.width * 0.24, drone.height * 0.34);
    ctx.lineTo(-drone.width * 0.34, drone.height * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#87e1ff";
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = drone.active ? 14 : 8;
    ctx.beginPath();
    ctx.ellipse(drone.width * 0.2, -1, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(135, 225, 255, 0.86)";
    ctx.fillRect(-drone.width * 0.18, -drone.height * 0.2, 18, 4);
    ctx.fillStyle = `rgba(135, 225, 255, ${0.35 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(-drone.width * 0.44, 0);
    ctx.lineTo(-drone.width * 0.64, -8);
    ctx.lineTo(-drone.width * 0.64, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (drone.hp < drone.maxHp && drone.hp > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(drone.x, drone.y - 10, drone.width, 4);
      ctx.fillStyle = "#87e1ff";
      ctx.fillRect(drone.x, drone.y - 10, drone.width * (drone.hp / drone.maxHp), 4);
    }
  });
}

function drawDroneTelegraphs(ctx, run) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  (run.hostileDrones || []).forEach((drone) => {
    if (isEntityDisabled(drone) || drone.dead || !(drone.aimTimer > 0)) {
      return;
    }

    const duration = Math.max(0.001, drone.aimDuration || drone.telegraphDuration || 0.58);
    const charge = clamp(1 - drone.aimTimer / duration, 0, 1);
    const flicker = 0.7 + Math.sin((run.time ?? 0) * 48) * 0.18;
    const startX = drone.aimStartX;
    const startY = drone.aimStartY;
    const endX = drone.aimEndX;
    const endY = drone.aimEndY;

    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -(run.time ?? 0) * 160;
    ctx.strokeStyle = `rgba(255, 105, 142, ${(0.18 + charge * 0.48) * flicker})`;
    ctx.lineWidth = 2 + charge * 4;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(135, 225, 255, ${0.24 + charge * 0.48})`;
    ctx.lineWidth = 1.2 + charge * 1.8;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 + charge * 0.34})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(endX, endY, 10 + charge * 10, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

function drawEnemyShots(ctx, run) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  (run.enemyShots || []).forEach((shot) => {
    if (shot.type === "beam") {
      const duration = Math.max(0.001, shot.duration || shot.life || 0.12);
      const lifeRatio = clamp(shot.life / duration, 0, 1);
      const coreAlpha = 0.45 + lifeRatio * 0.5;

      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(135, 225, 255, 0.82)";
      ctx.shadowBlur = 22;
      ctx.strokeStyle = `rgba(38, 191, 255, ${0.18 + lifeRatio * 0.3})`;
      ctx.lineWidth = 16 * lifeRatio + 8;
      ctx.beginPath();
      ctx.moveTo(shot.startX, shot.startY);
      ctx.lineTo(shot.endX, shot.endY);
      ctx.stroke();

      ctx.shadowBlur = 8;
      ctx.strokeStyle = `rgba(255, 255, 255, ${coreAlpha})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(shot.startX, shot.startY);
      ctx.lineTo(shot.endX, shot.endY);
      ctx.stroke();

      ctx.shadowBlur = 0;
      return;
    }

    const speed = Math.max(1, Math.hypot(shot.vx, shot.vy));
    const dirX = shot.vx / speed;
    const dirY = shot.vy / speed;
    ctx.strokeStyle = "rgba(135, 225, 255, 0.52)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shot.x - dirX * 24, shot.y - dirY * 24);
    ctx.lineTo(shot.x, shot.y);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 159, 180, 0.94)";
    ctx.shadowColor = "rgba(135, 225, 255, 0.8)";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function getPlayerPose(player) {
  if (player.recoilSpinTimer > 0 && !player.onGround) {
    return "recoilSpin";
  }
  if (player.recoilShotActive) {
    return "recoilShot";
  }
  if (player.recoilFocusActive || (player.recoilFocusBlend ?? 0) > 0.12) {
    if (player.recoilAimPitch === -1) {
      return "recoilFocusUp";
    }
    if (player.recoilAimPitch === 1) {
      return "recoilFocusDown";
    }
    return "recoilFocus";
  }
  if (player.wallRunActive) {
    return "wallRun";
  }
  if (player.braceHolding) {
    return "braceHold";
  }
  if (player.braceReleaseTimer > 0) {
    return "braceRelease";
  }
  if (player.movementState === MOVEMENT_STATES.WALL_JUMP_LOCK) {
    return "wallJump";
  }
  if (player.movementState === MOVEMENT_STATES.DASH) {
    return "dash";
  }
  if (player.movementState === MOVEMENT_STATES.SLIDE) {
    return "slide";
  }
  if (
    player.movementState === MOVEMENT_STATES.CROUCH ||
    player.movementState === MOVEMENT_STATES.CROUCH_WALK
  ) {
    return "crouch";
  }
  if (player.movementState === MOVEMENT_STATES.WALL_SLIDE) {
    return "wallSlide";
  }
  if (player.movementState === MOVEMENT_STATES.HOVER) {
    return "hover";
  }
  if (player.movementState === MOVEMENT_STATES.FALL) {
    return "fall";
  }
  if (
    player.movementState === MOVEMENT_STATES.JUMP_RISE ||
    player.movementState === MOVEMENT_STATES.WALL_JUMP_LOCK
  ) {
    return "jump";
  }
  if (player.onGround && player.sprintActive && Math.abs(player.vx) > 36) {
    return "sprint";
  }
  if (player.onGround && Math.abs(player.vx) > 36) {
    return "run";
  }
  return "idle";
}

function getPlayerPoseConfig(data, pose) {
  const renderConfig = data.player?.render || {};
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
    hover: {
      assetKey: renderConfig.hoverAssetKey || renderConfig.fallAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.hoverWidthRatio ?? renderConfig.fallWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.hoverHeightRatio ?? renderConfig.fallHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.hoverAnchorX ?? renderConfig.fallAnchorX ?? 0.44,
      footAnchorY: renderConfig.hoverFootAnchorY ?? renderConfig.footAnchorY ?? 0.76,
      sourceFacing: renderConfig.hoverSourceFacing ?? 1,
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
    slide: {
      assetKey: renderConfig.slideAssetKey || renderConfig.crouchAssetKey || renderConfig.dashAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.slideWidthRatio ?? renderConfig.crouchWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.slideHeightRatio ?? renderConfig.crouchHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.slideAnchorX ?? renderConfig.crouchAnchorX ?? 0.42,
    },
    recoilShot: {
      assetKey: renderConfig.recoilShotAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.recoilShotWidthRatio ?? renderConfig.jumpWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.recoilShotHeightRatio ?? renderConfig.jumpHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.recoilShotAnchorX ?? renderConfig.jumpAnchorX ?? 0.38,
    },
    recoilSpin: {
      assetKey: renderConfig.recoilSpinAssetKey || renderConfig.recoilShotAssetKey || renderConfig.fallAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.recoilSpinWidthRatio ?? renderConfig.recoilShotWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.recoilSpinHeightRatio ?? renderConfig.recoilShotHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.recoilSpinAnchorX ?? 0.5,
      footAnchorY: renderConfig.recoilSpinFootAnchorY ?? renderConfig.footAnchorY ?? 0.8,
      frameCount: renderConfig.recoilSpinFrameCount ?? 4,
      loopCount: renderConfig.recoilSpinLoopCount ?? 1,
      sourceFacing: renderConfig.recoilSpinSourceFacing ?? 1,
    },
    recoilFocus: {
      assetKey: renderConfig.recoilFocusAssetKey || renderConfig.recoilShotAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.recoilFocusWidthRatio ?? renderConfig.recoilShotWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.recoilFocusHeightRatio ?? renderConfig.recoilShotHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.recoilFocusAnchorX ?? renderConfig.recoilShotAnchorX ?? 0.34,
    },
    recoilFocusUp: {
      assetKey: renderConfig.recoilFocusUpAssetKey || renderConfig.recoilFocusAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.recoilFocusUpWidthRatio ?? renderConfig.recoilFocusWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.recoilFocusUpHeightRatio ?? renderConfig.recoilFocusHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.recoilFocusUpAnchorX ?? renderConfig.recoilFocusAnchorX ?? 0.34,
    },
    recoilFocusDown: {
      assetKey: renderConfig.recoilFocusDownAssetKey || renderConfig.recoilFocusAssetKey || renderConfig.jumpAssetKey || fallbackAssetKey,
      widthRatio: renderConfig.recoilFocusDownWidthRatio ?? renderConfig.recoilFocusWidthRatio ?? renderConfig.widthRatio ?? 1,
      heightRatio: renderConfig.recoilFocusDownHeightRatio ?? renderConfig.recoilFocusHeightRatio ?? renderConfig.heightRatio ?? 1,
      anchorX: renderConfig.recoilFocusDownAnchorX ?? renderConfig.recoilFocusAnchorX ?? 0.34,
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

  const config = poseMap[pose] || poseMap.idle;
  return {
    ...config,
    footAnchorY: config.footAnchorY ?? renderConfig.footAnchorY ?? 0.978,
  };
}

function getPlayerSpriteFrame(player, data, pose, time = 0) {
  const poseConfig = getPlayerPoseConfig(data, pose);
  const src = data.art?.[poseConfig.assetKey]?.src;
  const image = getImageAsset(src);
  if (!image || !image.complete || !image.naturalWidth) {
    return null;
  }

  let scaleX = 1;
  let scaleY = 1;
  let rotation = 0;
  let yLift = 0;
  const frameCount = Math.max(1, Math.floor(poseConfig.frameCount ?? 1));
  const sourceWidth = image.naturalWidth / frameCount;
  const sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (pose === "idle") {
    yLift = Math.sin(time * 2.2) * 2;
  } else if (pose === "run") {
    yLift = Math.sin(time * 18) * 4;
    rotation = -0.035;
  } else if (pose === "sprint") {
    yLift = Math.sin(time * 24) * 5;
    rotation = -0.055;
    scaleX = 1.03;
    scaleY = 0.98;
  } else if (pose === "jump") {
    rotation = player.movementState === MOVEMENT_STATES.FALL ? 0.05 : -0.06;
    yLift = player.movementState === MOVEMENT_STATES.WALL_JUMP_LOCK ? 4 : 2;
    if (player.movementState === MOVEMENT_STATES.WALL_SLIDE) {
      rotation = player.wallDirection === 1 ? 0.12 : -0.12;
      yLift = 2;
    }
  } else if (pose === "fall") {
    yLift = 1;
  } else if (pose === "hover") {
    yLift = Math.sin(time * 10) * 1.5;
    rotation = player.facing === -1 ? -0.015 : 0.015;
    scaleY = 0.99;
  } else if (pose === "wallJump") {
    yLift = 2;
  } else if (pose === "wallSlide") {
    yLift = 2;
  } else if (pose === "wallRun") {
    yLift = Math.sin(time * 15) * 2;
  } else if (pose === "braceHold") {
    yLift = Math.sin(time * 5) * 1.5;
  } else if (pose === "braceRelease") {
    yLift = 1;
  } else if (pose === "dash") {
    scaleX = 1.04;
    scaleY = 0.96;
    rotation = -0.025;
  } else if (pose === "slide") {
    yLift = -8;
    scaleX = 1.03;
    scaleY = 0.98;
    rotation = 0.015;
  } else if (pose === "recoilShot") {
    yLift = 1;
    const aimFacing = player.recoilAimFacing || player.facing || 1;
    rotation = aimFacing === -1 ? 0.035 : -0.035;
  } else if (pose === "recoilSpin") {
    yLift = 1;
    const duration = Math.max(0.001, player.recoilSpinDuration || 0.22);
    const progress = Math.max(0, Math.min(0.999, 1 - (player.recoilSpinTimer / duration)));
    const loopCount = Math.max(1, Math.floor(poseConfig.loopCount ?? 1));
    const frameIndex = Math.floor(progress * frameCount * loopCount) % frameCount;
    sourceX = frameIndex * sourceWidth;
  } else if (pose === "recoilFocus") {
    yLift = 1;
    const aimFacing = player.recoilAimFacing || player.facing || 1;
    rotation = aimFacing === -1 ? 0.025 : -0.025;
  } else if (pose === "recoilFocusUp") {
    yLift = 1;
    const aimFacing = player.recoilAimFacing || player.facing || 1;
    rotation = aimFacing === -1 ? -0.015 : 0.015;
  } else if (pose === "recoilFocusDown") {
    yLift = 1;
    const aimFacing = player.recoilAimFacing || player.facing || 1;
    rotation = aimFacing === -1 ? 0.015 : -0.015;
  } else if (pose === "crouch") {
    yLift = -6;
  }

  const imageAspect = sourceWidth / sourceHeight;
  const drawHeight = Math.max(1, player.height * poseConfig.heightRatio);
  const drawWidth = Math.max(1, drawHeight * imageAspect * poseConfig.widthRatio);

  const footX = player.x + player.width * 0.5;
  const footY = player.y + player.height + yLift;
  const facing = (pose === "recoilFocus" || pose === "recoilFocusUp" || pose === "recoilFocusDown" || pose === "recoilShot")
    ? (player.recoilAimFacing || player.facing || 1)
    : pose === "recoilSpin"
      ? (player.recoilSpinFacing || player.facing || 1)
    : player.facing;
  const anchorX = facing === -1 ? poseConfig.anchorX : 1 - poseConfig.anchorX;

  return {
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    drawWidth,
    drawHeight,
    footX,
    footY,
    anchorX,
    facing,
    footAnchorY: poseConfig.footAnchorY,
    rotation,
    scaleX,
    scaleY,
    sourceFacing: poseConfig.sourceFacing ?? -1,
  };
}

function drawPlayerFrame(ctx, frame, player, options = {}) {
  const {
    alpha = 1,
    fillTint = null,
    glowColor = null,
    glowBlur = 0,
  } = options;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(frame.footX, frame.footY);
  const facing = frame.facing || player.facing || 1;
  ctx.rotate(frame.rotation * facing);
  const sourceFacing = frame.sourceFacing ?? -1;
  ctx.scale(facing === sourceFacing ? 1 : -1, 1);
  ctx.scale(frame.scaleX, frame.scaleY);

  if (glowColor && glowBlur > 0) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowBlur;
  }

  if (Number.isFinite(frame.sourceWidth) && Number.isFinite(frame.sourceHeight)) {
    ctx.drawImage(
      frame.image,
      frame.sourceX ?? 0,
      frame.sourceY ?? 0,
      frame.sourceWidth,
      frame.sourceHeight,
      -frame.drawWidth * frame.anchorX,
      -frame.drawHeight * frame.footAnchorY,
      frame.drawWidth,
      frame.drawHeight
    );
  } else {
    ctx.drawImage(
      frame.image,
      -frame.drawWidth * frame.anchorX,
      -frame.drawHeight * frame.footAnchorY,
      frame.drawWidth,
      frame.drawHeight
    );
  }

  if (fillTint) {
    drawSpriteTint(ctx, frame, fillTint);
  }

  ctx.restore();
}

function drawAfterimages(ctx, run, data) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  run.afterimages.forEach((image) => {
    const alpha = Math.max(0, image.life / 0.18);
    const centerX = image.x + image.width * 0.5 - image.facing * 12;
    const centerY = image.y + image.height * 0.56;
    const trailWidth = 26 + alpha * 24;
    const trailHeight = 40 + alpha * 18;

    ctx.globalAlpha = alpha * 0.22;
    ctx.shadowColor = "rgba(147, 234, 255, 0.5)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(168, 237, 255, 0.85)";
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY,
      trailWidth,
      trailHeight,
      image.facing === 1 ? -0.28 : 0.28,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(220, 247, 255, ${alpha * 0.42})`;
    ctx.beginPath();
    ctx.moveTo(centerX - image.facing * (trailWidth + 18), centerY - trailHeight * 0.26);
    ctx.lineTo(centerX + image.facing * 12, centerY + 4);
    ctx.stroke();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

function getRecoilFocusTrailPoint(image) {
  return {
    x: image.x + image.width * 0.5,
    y: image.y + image.height * 0.48,
  };
}

function drawRecoilFocusTrailPath(ctx, run) {
  const images = run.recoilFocusAfterimages || [];
  if (images.length < 2) {
    return;
  }

  const points = images.map((image) => getRecoilFocusTrailPoint(image));
  points.push({
    x: run.player.x + run.player.width * 0.5,
    y: run.player.y + run.player.height * 0.48,
  });

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const focusBlend = Math.max(0.25, run.player.recoilFocusBlend ?? 0);
  ctx.strokeStyle = `rgba(72, 132, 255, ${0.24 * focusBlend})`;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const controlX = (previous.x + point.x) * 0.5;
    const controlY = (previous.y + point.y) * 0.5;
    ctx.quadraticCurveTo(previous.x, previous.y, controlX, controlY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  ctx.strokeStyle = `rgba(135, 225, 255, ${0.2 * focusBlend})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 12]);
  ctx.beginPath();
  ctx.moveTo(points[0].x + 6, points[0].y - 4);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const controlX = (previous.x + point.x) * 0.5 + 6;
    const controlY = (previous.y + point.y) * 0.5 - 4;
    ctx.quadraticCurveTo(previous.x + 6, previous.y - 4, controlX, controlY);
  }
  ctx.lineTo(last.x + 6, last.y - 4);
  ctx.stroke();
  ctx.restore();
}

function drawRecoilFocusAfterimages(ctx, run, data) {
  const images = run.recoilFocusAfterimages || [];
  if (!images.length) {
    return;
  }

  if (!LOW_PERFORMANCE_MODE) {
    drawRecoilFocusTrailPath(ctx, run);
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  images.forEach((image, index) => {
    if (LOW_PERFORMANCE_MODE && index < images.length - 1 && index % 2 === 0) {
      return;
    }
    const duration = Math.max(0.001, image.duration ?? 0.44);
    const lifeRatio = clamp(image.life / duration, 0, 1);
    if (lifeRatio <= 0) {
      return;
    }

    const ghostPlayer = {
      ...image,
      recoilFocusActive: image.recoilFocusActive || image.recoilFocusBlend > 0.12,
    };
    const pose = getPlayerPose(ghostPlayer);
    const frame = getPlayerSpriteFrame(ghostPlayer, data, pose, image.time ?? run.time ?? 0);
    if (!frame) {
      return;
    }

    const color = index % 2 === 0
      ? "rgba(72, 132, 255, 0.78)"
      : "rgba(135, 225, 255, 0.72)";
    const alpha = (0.08 + lifeRatio * 0.23) * Math.max(0.35, image.recoilFocusBlend ?? run.player.recoilFocusBlend ?? 0);
    const drift = (1 - lifeRatio) * 5;
    const shiftedFrame = {
      ...frame,
      footX: frame.footX + (index % 2 === 0 ? drift : -drift),
      footY: frame.footY - drift * 0.35,
    };

    drawPlayerFrame(ctx, shiftedFrame, ghostPlayer, {
      alpha,
      fillTint: LOW_PERFORMANCE_MODE ? "rgba(58, 128, 255, 0.42)" : "rgba(58, 128, 255, 0.56)",
      glowColor: color,
      glowBlur: (LOW_PERFORMANCE_MODE ? 7 : 14) * lifeRatio,
    });

    if (!LOW_PERFORMANCE_MODE && lifeRatio > 0.32 && index >= images.length - 5) {
      const chromaFrame = {
        ...shiftedFrame,
        footX: shiftedFrame.footX + (index % 2 === 0 ? 3 : -3),
      };
      drawPlayerFrame(ctx, chromaFrame, ghostPlayer, {
        alpha: alpha * 0.32,
        fillTint: "rgba(135, 225, 255, 0.42)",
        glowColor: "rgba(135, 225, 255, 0.58)",
        glowBlur: 8,
      });
    }
  });
  ctx.restore();
}

function drawRecoilFocusMapDim(ctx, run, data) {
  const blend = clamp(run.player.recoilFocusBlend ?? 0, 0, 1);
  if (blend <= 0.02) {
    return;
  }

  const cameraZoom = getRunCameraZoom(run, data);
  const viewportX = run.cameraX;
  const viewportY = run.cameraY;
  const viewportWidth = SCREEN_WIDTH / cameraZoom;
  const viewportHeight = SCREEN_HEIGHT / cameraZoom;
  const playerX = run.player.x + run.player.width * 0.5;
  const playerY = run.player.y + run.player.height * 0.48;

  ctx.save();
  ctx.fillStyle = `rgba(1, 6, 18, ${0.34 * blend})`;
  ctx.fillRect(viewportX, viewportY, viewportWidth, viewportHeight);

  ctx.globalCompositeOperation = "screen";
  const glow = ctx.createRadialGradient(playerX, playerY, 18, playerX, playerY, 210);
  glow.addColorStop(0, `rgba(72, 132, 255, ${0.14 * blend})`);
  glow.addColorStop(0.42, `rgba(135, 225, 255, ${0.055 * blend})`);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(viewportX, viewportY, viewportWidth, viewportHeight);
  ctx.restore();
}

function drawPlayerHalo(ctx, player) {
  const centerX = player.x + player.width * 0.5;
  const centerY = player.y + player.height * 0.52;
  const gradient = ctx.createRadialGradient(centerX, centerY, 12, centerX, centerY, 88);
  gradient.addColorStop(0, "rgba(248, 252, 255, 0.26)");
  gradient.addColorStop(0.38, "rgba(168, 237, 255, 0.14)");
  gradient.addColorStop(1, "rgba(168, 237, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 88, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayerFallback(ctx, player) {
  const dashTint = player.movementState === MOVEMENT_STATES.DASH ? "#dcf4ff" : "#f8fbfd";
  const flash = player.invulnTimer > 0 && Math.floor(player.invulnTimer * 12) % 2 === 0;
  ctx.fillStyle = flash ? "#ffd0b7" : dashTint;
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.fillStyle = "#1a2430";
  const eyeY = player.y + Math.max(10, player.height * 0.25);
  const eyeX = player.x + (player.facing === 1 ? player.width - 18 : 8);
  ctx.fillRect(eyeX, eyeY, 10, 10);
  ctx.fillStyle = player.lightActive ? "#e7f47e" : "#88a1b7";
  ctx.fillRect(player.x + 12, player.y + player.height - 20, 20, 8);
}

function drawPlayerSprite(ctx, player, data, time = 0) {
  const pose = getPlayerPose(player);
  const frame = getPlayerSpriteFrame(player, data, pose, time);
  if (!frame) {
    return false;
  }

  const flash = player.invulnTimer > 0 && Math.floor(player.invulnTimer * 12) % 2 === 0;
  drawPlayerFrame(ctx, frame, player, {
    glowColor: player.movementState === MOVEMENT_STATES.DASH
      ? "rgba(211, 241, 255, 0.65)"
      : player.movementState === MOVEMENT_STATES.HOVER
        ? "rgba(147, 234, 255, 0.48)"
        : player.lightActive
          ? "rgba(231, 244, 126, 0.28)"
          : null,
    glowBlur: player.movementState === MOVEMENT_STATES.DASH
      ? 22
      : player.movementState === MOVEMENT_STATES.HOVER
        ? 18
        : player.lightActive
          ? 16
          : 0,
    fillTint: flash
      ? "rgba(255, 209, 183, 0.44)"
      : player.movementState === MOVEMENT_STATES.DASH
        ? "rgba(220, 244, 255, 0.18)"
        : null,
  });
  return true;
}

function drawPlayer(ctx, run, data) {
  const player = run.player;
  if (player.sprintActive) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(147, 234, 255, 0.42)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    const trailX = player.facing === 1 ? player.x - 52 : player.x + player.width + 52;
    ctx.moveTo(player.x + player.width * 0.5, player.y + player.height * 0.72);
    ctx.lineTo(trailX, player.y + player.height * 0.68);
    ctx.stroke();
    ctx.restore();
  }
  if (player.wallRunActive) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(184, 240, 255, 0.78)";
    ctx.lineWidth = 2.6;
    const edgeX = player.wallDirection === -1 ? player.x : player.x + player.width;
    for (let index = 0; index < 3; index += 1) {
      const offset = index * 10;
      ctx.beginPath();
      ctx.moveTo(edgeX, player.y + player.height - 4 - offset);
      ctx.lineTo(edgeX + player.wallDirection * 18, player.y + player.height - 30 - offset);
      ctx.stroke();
    }
    ctx.restore();
  } else if (player.wallRunBoostActive) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "rgba(231, 244, 126, 0.58)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + player.width * 0.3, player.y + player.height * 0.82);
    ctx.quadraticCurveTo(
      player.x + player.width * 0.5 - player.facing * 26,
      player.y + player.height * 0.44,
      player.x + player.width * 0.5 - player.facing * 54,
      player.y + player.height * 0.96
    );
    ctx.stroke();
    ctx.restore();
  }
  drawPlayerHalo(ctx, player);
  const rendered = drawPlayerSprite(ctx, player, data, run.time);
  if (!rendered) {
    drawPlayerFallback(ctx, player);
  }

  if (player.movementState === MOVEMENT_STATES.WALL_SLIDE) {
    ctx.strokeStyle = "rgba(147, 234, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x - 2, player.y - 2, player.width + 4, player.height + 4);
  }
}

function drawThreatSense(ctx, run, state) {
  if (!hasUnlocked(state.meta, "threatSense") || !run.player.lightActive) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(163, 233, 255, 0.8)";
  ctx.lineWidth = 2;

  run.threats.forEach((threat) => {
    if (!threat.active || threat.dead) {
      return;
    }
    ctx.strokeRect(threat.x - 6, threat.y - 6, threat.width + 12, threat.height + 12);
  });

  ["guard", "ritualist"].forEach((id) => {
    const encounter = run.encounters[id];
    if (isEntityDisabled(encounter) || encounter.state === "released") {
      return;
    }
    ctx.strokeRect(encounter.x - 6, encounter.y - 6, encounter.width + 12, encounter.height + 12);
  });

  run.interactables.forEach((item) => {
    if (item.used) {
      return;
    }
    ctx.strokeStyle = "rgba(231, 244, 126, 0.7)";
    ctx.strokeRect(item.x - 4, item.y - 4, item.width + 8, item.height + 8);
  });

  ctx.restore();
}

function drawAttackFx(ctx, run) {
  run.attackFx.forEach((effect) => {
    ctx.strokeStyle = `rgba(244, 239, 226, ${effect.life / 0.12})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 44, effect.facing === 1 ? -0.8 : 1.9, effect.facing === 1 ? 0.8 : 3.7);
    ctx.stroke();
  });
}

function drawRecoilFx(ctx, run) {
  run.recoilFx.forEach((effect) => {
    const alpha = Math.max(0, effect.life / effect.duration);
    const normalX = -effect.dirY;
    const normalY = effect.dirX;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    for (let index = -1; index <= 1; index += 1) {
      const spread = index * 0.16;
      const dirX = effect.dirX + normalX * spread;
      const dirY = effect.dirY + normalY * spread;
      const length = 130 + Math.abs(index) * 34;
      ctx.strokeStyle = `rgba(233, 247, 255, ${0.72 * alpha})`;
      ctx.lineWidth = index === 0 ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.x + dirX * length, effect.y + dirY * length);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(147, 234, 255, ${0.4 * alpha})`;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 34 * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawWeaponModulesWorld(ctx, run) {
  (run.playerBullets || []).forEach((bullet) => {
    const alpha = clamp((bullet.life ?? 0) / Math.max(0.001, bullet.duration ?? 0.2), 0, 1);
    const dirX = bullet.dirX ?? 1;
    const dirY = bullet.dirY ?? 0;
    const trail = bullet.trailLength ?? 62;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(233, 247, 255, 0.86)";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = `rgba(233, 247, 255, ${0.9 * alpha})`;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(bullet.x - dirX * trail, bullet.y - dirY * trail);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();

    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(231, 244, 126, ${0.62 * alpha})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(bullet.x - dirX * trail * 0.52, bullet.y - dirY * trail * 0.52);
    ctx.lineTo(bullet.x + dirX * 7, bullet.y + dirY * 7);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius ?? 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  (run.weaponBarriers || []).forEach((barrier) => {
    const alpha = clamp((barrier.life ?? 0) / Math.max(0.001, barrier.duration ?? 0.2), 0, 1);
    const angle = Math.atan2(barrier.dirY ?? 0, barrier.dirX ?? 1);
    ctx.save();
    ctx.translate(barrier.x, barrier.y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(231, 244, 126, ${0.12 * alpha})`;
    ctx.fillRect(-barrier.width * 0.5, -barrier.height * 0.5, barrier.width, barrier.height);
    ctx.strokeStyle = `rgba(231, 244, 126, ${0.72 * alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-barrier.width * 0.42, -barrier.height * 0.34);
    ctx.lineTo(barrier.width * 0.42, -barrier.height * 0.12);
    ctx.lineTo(barrier.width * 0.42, barrier.height * 0.12);
    ctx.lineTo(-barrier.width * 0.42, barrier.height * 0.34);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });

  (run.weaponMissiles || []).forEach((missile) => {
    const alpha = clamp((missile.life ?? 0) / Math.max(0.001, missile.duration ?? 0.9), 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = `rgba(135, 225, 255, ${0.58 * alpha})`;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(missile.x - (missile.dirX ?? 1) * 24, missile.y - (missile.dirY ?? 0) * 24);
    ctx.lineTo(missile.x, missile.y);
    ctx.stroke();
    ctx.fillStyle = `rgba(245, 248, 251, ${0.86 * alpha})`;
    ctx.beginPath();
    ctx.arc(missile.x, missile.y, missile.radius ?? 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawDamageNumbers(ctx, run) {
  (run.damageNumbers || []).forEach((number) => {
    const ratio = clamp((number.life ?? 0) / Math.max(0.001, number.duration ?? 0.7), 0, 1);
    const text = number.label || `-${number.amount ?? 0}`;
    ctx.save();
    ctx.globalAlpha = Math.min(1, ratio * 1.45);
    ctx.font = number.label ? "800 15px 'Segoe UI', sans-serif" : "800 18px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(3, 6, 10, 0.8)";
    ctx.strokeText(text, number.x, number.y);
    ctx.fillStyle = number.color || "#f5f8fb";
    ctx.shadowColor = number.color || "rgba(245, 248, 251, 0.78)";
    ctx.shadowBlur = 8;
    ctx.fillText(text, number.x, number.y);
    ctx.restore();
  });
}

function drawRecoilAimWorld(ctx, run) {
  const aim = run.recoilAim;
  const blend = aim?.aiming
    ? Math.max(run.player.recoilFocusBlend ?? 0, aim.active ? 0.75 : 0.34)
    : (run.player.recoilFocusBlend ?? 0);
  if (!aim || blend <= 0.02) {
    return;
  }

  const alpha = Math.min(1, blend);
  const shotLength = 180;
  const recoilLength = 116;
  const shotEndX = aim.originX + aim.shotDirX * shotLength;
  const shotEndY = aim.originY + aim.shotDirY * shotLength;
  const recoilEndX = aim.originX + aim.recoilDirX * recoilLength;
  const recoilEndY = aim.originY + aim.recoilDirY * recoilLength;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(233, 247, 255, ${0.58 * alpha})`;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(aim.originX, aim.originY);
  ctx.lineTo(shotEndX, shotEndY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = `rgba(231, 244, 126, ${0.82 * alpha})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(aim.originX, aim.originY);
  ctx.lineTo(recoilEndX, recoilEndY);
  ctx.stroke();

  const arrowAngle = Math.atan2(aim.recoilDirY, aim.recoilDirX);
  ctx.fillStyle = `rgba(231, 244, 126, ${0.9 * alpha})`;
  ctx.beginPath();
  ctx.moveTo(recoilEndX, recoilEndY);
  ctx.lineTo(
    recoilEndX - Math.cos(arrowAngle - 0.55) * 18,
    recoilEndY - Math.sin(arrowAngle - 0.55) * 18,
  );
  ctx.lineTo(
    recoilEndX - Math.cos(arrowAngle + 0.55) * 18,
    recoilEndY - Math.sin(arrowAngle + 0.55) * 18,
  );
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(147, 234, 255, ${0.5 * alpha})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(shotEndX, shotEndY, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawParticles(ctx, run) {
  run.particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawRecoilFocusOverlay(ctx, run, data) {
  const blend = run.player.recoilFocusBlend ?? 0;
  if (blend <= 0.02) {
    return;
  }

  const cameraZoom = getRunCameraZoom(run, data);
  const playerX = (run.player.x - run.cameraX + run.player.width / 2) * cameraZoom;
  const playerY = (run.player.y - run.cameraY + run.player.height * 0.48) * cameraZoom;
  const aim = run.recoilAim;
  const effectTime = Number.isFinite(run.time) ? run.time : 0;

  ctx.save();

  ctx.fillStyle = `rgba(3, 8, 18, ${0.025 * blend})`;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.globalCompositeOperation = "screen";
  const pulse = 0.5 + Math.sin(effectTime * 18) * 0.5;
  const edgeAlpha = (0.1 + pulse * 0.05) * blend;
  const leftEdge = ctx.createLinearGradient(0, 0, SCREEN_WIDTH * 0.38, 0);
  leftEdge.addColorStop(0, `rgba(72, 132, 255, ${edgeAlpha})`);
  leftEdge.addColorStop(0.48, `rgba(135, 225, 255, ${edgeAlpha * 0.42})`);
  leftEdge.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = leftEdge;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const rightEdge = ctx.createLinearGradient(SCREEN_WIDTH, 0, SCREEN_WIDTH * 0.62, 0);
  rightEdge.addColorStop(0, `rgba(135, 225, 255, ${edgeAlpha * 0.88})`);
  rightEdge.addColorStop(0.54, `rgba(72, 132, 255, ${edgeAlpha * 0.36})`);
  rightEdge.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = rightEdge;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const auraRadius = 175 * cameraZoom;
  const aura = ctx.createRadialGradient(
    playerX,
    playerY,
    18 * cameraZoom,
    playerX,
    playerY,
    auraRadius,
  );
  aura.addColorStop(0, `rgba(175, 234, 255, ${0.22 * blend})`);
  aura.addColorStop(0.35, `rgba(72, 132, 255, ${0.12 * blend})`);
  aura.addColorStop(0.74, `rgba(135, 225, 255, ${0.055 * blend})`);
  aura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const facingFallback = Number.isFinite(run.player.facing) ? -run.player.facing : -1;
  const ghostDirX = aim?.recoilDirX ?? run.player.recoilDirX ?? facingFallback;
  const ghostDirY = aim?.recoilDirY ?? run.player.recoilDirY ?? 0;
  const ghostColors = ["175, 234, 255", "72, 132, 255", "135, 225, 255"];
  ctx.lineCap = "round";
  for (let index = 0; index < 3; index += 1) {
    const offset = (index + 1) * 18 * cameraZoom;
    const ghostX = playerX + ghostDirX * offset;
    const ghostY = playerY + ghostDirY * offset * 0.5;
    ctx.strokeStyle = `rgba(${ghostColors[index]}, ${(0.26 * blend) / (index + 1)})`;
    ctx.lineWidth = Math.max(1, (3 - index) * cameraZoom);
    ctx.beginPath();
    ctx.ellipse(
      ghostX,
      ghostY,
      (38 + index * 10) * cameraZoom,
      (60 + index * 9) * cameraZoom,
      ghostDirX * -0.18,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  const scanOffset = (effectTime * 520) % 22;
  if (!LOW_PERFORMANCE_MODE) {
    ctx.fillStyle = `rgba(135, 225, 255, ${0.028 * blend})`;
    for (let y = -scanOffset; y < SCREEN_HEIGHT; y += 22) {
      ctx.fillRect(0, y, SCREEN_WIDTH, 1);
    }
  }

  ctx.strokeStyle = `rgba(72, 132, 255, ${0.12 * blend})`;
  ctx.lineWidth = 2;
  for (let index = 0; index < (LOW_PERFORMANCE_MODE ? 2 : 4); index += 1) {
    const y = ((effectTime * 180 + index * 173) % (SCREEN_HEIGHT + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      SCREEN_WIDTH * 0.28,
      y - 18 * cameraZoom,
      SCREEN_WIDTH * 0.62,
      y + 24 * cameraZoom,
      SCREEN_WIDTH,
      y - 8 * cameraZoom,
    );
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "screen";

  if (aim) {
    const targetX = (aim.targetX - run.cameraX) * cameraZoom;
    const targetY = (aim.targetY - run.cameraY) * cameraZoom;
    ctx.strokeStyle = `rgba(147, 234, 255, ${0.72 * blend})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(targetX - 22, targetY);
    ctx.lineTo(targetX - 8, targetY);
    ctx.moveTo(targetX + 8, targetY);
    ctx.lineTo(targetX + 22, targetY);
    ctx.moveTo(targetX, targetY - 22);
    ctx.lineTo(targetX, targetY - 8);
    ctx.moveTo(targetX, targetY + 8);
    ctx.lineTo(targetX, targetY + 22);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDarknessOverlay(ctx, run, data) {
  if (isMovementLab(data)) {
    return;
  }

  const cameraZoom = getRunCameraZoom(run, data);
  const base = run.timePhase === "day" ? 0.04 : run.timePhase === "dusk" ? 0.18 : 0.42;
  const sanityPenalty = run.sanity < 40 ? 0.18 : run.sanity < 70 ? 0.08 : 0;
  ctx.save();
  ctx.fillStyle = `rgba(3, 5, 8, ${base + sanityPenalty})`;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const playerX = (run.player.x - run.cameraX + run.player.width / 2) * cameraZoom;
  const playerY = (run.player.y - run.cameraY + run.player.height / 2) * cameraZoom;
  const radius = (run.player.lightActive ? 250 : run.timePhase === "night" ? 134 : run.timePhase === "dusk" ? 210 : 340) * cameraZoom;
  const light = ctx.createRadialGradient(playerX, playerY, 18, playerX, playerY, radius);
  light.addColorStop(0, "rgba(0,0,0,0.96)");
  light.addColorStop(0.5, "rgba(0,0,0,0.4)");
  light.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(playerX, playerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorldPrompt(ctx, run, theme) {
  if (!run.prompt || !run.promptWorld) {
    return;
  }
  const x = run.promptWorld.x;
  const y = run.promptWorld.y;
  const width = Math.max(210, ctx.measureText(run.prompt).width + 34);
  drawBeveledPanel(ctx, theme, x - width / 2, y - 34, width, 34, {
    cut: 10,
    fill: "rgba(6, 12, 18, 0.74)",
    stroke: "rgba(255,255,255,0.18)",
    innerLines: false,
  });
  ctx.fillStyle = theme.accent;
  ctx.font = "14px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(run.prompt, x, y - 12);
  ctx.textAlign = "left";
}

function drawLiveEditWorldOverlay(ctx, state, data) {
  const liveEdit = state.liveEdit;
  if (!liveEdit?.active) {
    return;
  }

  const hovered = liveEdit.hoverPlatformIndex !== null
    ? data.platforms[liveEdit.hoverPlatformIndex]
    : null;
  const selected = liveEdit.selectedPlatformIndex !== null
    ? data.platforms[liveEdit.selectedPlatformIndex]
    : null;

  if (hovered) {
    ctx.fillStyle = "rgba(147, 234, 255, 0.08)";
    ctx.fillRect(hovered.x, hovered.y, hovered.width, hovered.height);
    ctx.strokeStyle = "rgba(147, 234, 255, 0.72)";
    ctx.lineWidth = 2;
    ctx.strokeRect(hovered.x, hovered.y, hovered.width, hovered.height);
  }

  if (selected) {
    ctx.fillStyle = "rgba(231, 244, 126, 0.1)";
    ctx.fillRect(selected.x, selected.y, selected.width, selected.height);
    ctx.strokeStyle = "rgba(231, 244, 126, 0.92)";
    ctx.lineWidth = 3;
    ctx.strokeRect(selected.x, selected.y, selected.width, selected.height);
    ctx.fillStyle = "rgba(231, 244, 126, 0.96)";
    ctx.font = "16px 'Segoe UI', sans-serif";
    ctx.fillText(
      `블록 ${liveEdit.selectedPlatformIndex + 1} · ${Math.round(selected.x)}, ${Math.round(selected.y)}`,
      selected.x,
      selected.y - 12,
    );
  }
}

function drawDebugWorldOverlay(ctx, state, data) {
  if (!state.debug?.active || state.scene !== SCENES.EXPEDITION || !state.run) {
    return;
  }

  const { run } = state;
  const { player } = run;

  ctx.save();

  data.platforms.forEach((platform, index) => {
    ctx.fillStyle = "rgba(82, 214, 255, 0.12)";
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.strokeStyle = "rgba(126, 232, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = "rgba(210, 248, 255, 0.92)";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.fillText(`#${index + 1}`, platform.x + 6, platform.y + 16);
  });

  (data.braceWalls || []).forEach((wall, index) => {
    ctx.fillStyle = "rgba(147, 234, 255, 0.08)";
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    ctx.strokeStyle = "rgba(147, 234, 255, 0.92)";
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
    ctx.fillStyle = "rgba(210, 248, 255, 0.94)";
    ctx.fillText(`B${index + 1}`, wall.x + 6, wall.y + 16);
  });

  ctx.fillStyle = "rgba(255, 236, 126, 0.16)";
  ctx.fillRect(player.x, player.y, player.width, player.height);
  ctx.strokeStyle = "rgba(255, 236, 126, 0.95)";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(player.x, player.y, player.width, player.height);

  if (player.height !== player.standHeight) {
    ctx.strokeStyle = "rgba(255, 199, 126, 0.9)";
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(player.x, player.y - (player.standHeight - player.height), player.width, player.standHeight);
    ctx.setLineDash([]);
  }

  const cameraZoom = getRunCameraZoom(run, data);
  const viewportWidth = SCREEN_WIDTH / cameraZoom;
  const viewportHeight = SCREEN_HEIGHT / cameraZoom;
  const focusX = run.cameraX + viewportWidth * (run.cameraFocusX ?? 0.5);
  const focusY = run.cameraY + viewportHeight * (run.cameraFocusY ?? 0.5);
  ctx.strokeStyle = "rgba(231, 244, 126, 0.78)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(focusX - 18, focusY);
  ctx.lineTo(focusX + 18, focusY);
  ctx.moveTo(focusX, focusY - 18);
  ctx.lineTo(focusX, focusY + 18);
  ctx.stroke();
  ctx.strokeStyle = "rgba(231, 244, 126, 0.32)";
  ctx.beginPath();
  ctx.moveTo(player.x + player.width * 0.5, player.y + player.height * 0.5);
  ctx.lineTo(focusX, focusY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(126, 255, 170, 0.92)";
  ctx.lineWidth = 2;
  if (data.extractionGate) {
    ctx.strokeRect(data.extractionGate.x, data.extractionGate.y, data.extractionGate.width, data.extractionGate.height);
  }
  (data.routeExits || []).forEach((routeExit) => {
    ctx.strokeRect(routeExit.x, routeExit.y, routeExit.width, routeExit.height);
  });

  ctx.fillStyle = "rgba(8, 14, 22, 0.84)";
  ctx.fillRect(player.x - 4, player.y - 64, 448, 58);
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(
    `P ${Math.round(player.x)},${Math.round(player.y)} · ${Math.round(player.width)}x${Math.round(player.height)}`,
    player.x + 4,
    player.y - 36
  );
  const debugFlags = [
    player.apexGravityActive ? "Apex" : null,
    player.jumpCornerCorrected ? "JumpFix" : null,
    player.dashCornerCorrected ? "DashFix" : null,
    player.wallGraceTimer > 0 ? "WallGrace" : null,
    player.bufferedLandingJumpActive ? "LandJump" : null,
    player.wallSlideGraceActive ? "SlideGrace" : null,
    player.dashCarryActive ? "DashCarry" : null,
    player.sprintActive ? "Sprint" : null,
    player.sprintJumpBoostActive ? "SprintJump" : null,
    player.slideTimer > 0 ? "Slide" : null,
    player.slideJumpBoostActive ? "SlideJump" : null,
    player.dashJumpBoostActive ? "DashJump" : null,
    player.speedRetentionActive ? "SpeedRet" : null,
    player.wallRunActive ? "WallRun" : null,
    player.wallRunBoostActive ? "RunBoost" : null,
    player.dashResetActive ? "DashReset" : null,
    player.braceHoldActive ? "BraceHold" : null,
    player.braceActive ? "Brace" : null,
  ].filter(Boolean).join(" · ");
  ctx.fillStyle = "rgba(210, 248, 255, 0.92)";
  ctx.fillText(
    `Coy ${player.coyoteTimer.toFixed(2)}  Buf ${player.jumpBufferTimer.toFixed(2)}  Wall ${player.wallGraceTimer.toFixed(2)}  Slide ${player.wallSlideGraceTimer.toFixed(2)}  Dash ${player.dashCarryTimer.toFixed(2)}  Sprint ${player.sprintCharge.toFixed(2)}  Brace ${player.braceCooldownTimer.toFixed(2)}  Ret ${player.speedRetentionTimer.toFixed(2)}${debugFlags ? `  ${debugFlags}` : ""}`,
    player.x + 4,
    player.y - 18
  );

  ctx.restore();
}

function drawDebugCameraOverlay(ctx, state, data) {
  if (!state.debug?.active || state.scene !== SCENES.EXPEDITION || !state.run) {
    return;
  }

  const { run } = state;
  const cameraZoom = getRunCameraZoom(run, data);
  const baseZoom = getCameraZoom(data);
  ctx.save();
  ctx.fillStyle = "rgba(6, 10, 16, 0.76)";
  ctx.fillRect(18, SCREEN_HEIGHT - 82, 440, 58);
  ctx.strokeStyle = "rgba(231, 244, 126, 0.42)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, SCREEN_HEIGHT - 82, 440, 58);
  ctx.fillStyle = "rgba(236, 249, 255, 0.94)";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(
    `CAM base ${baseZoom.toFixed(2)}  z ${cameraZoom.toFixed(2)} -> ${Number(run.cameraTargetZoom ?? cameraZoom).toFixed(2)}`,
    34,
    SCREEN_HEIGHT - 56,
  );
  ctx.fillText(
    `focus ${Number(run.cameraFocusX ?? 0.5).toFixed(2)}, ${Number(run.cameraFocusY ?? 0.5).toFixed(2)}   look ${Number(run.cameraLookDirection ?? 0).toFixed(2)}   ahead ${Number(run.cameraLookAhead ?? 0).toFixed(2)}   speed ${Number(run.cameraSpeedRatio ?? 0).toFixed(2)}`,
    34,
    SCREEN_HEIGHT - 34,
  );
  ctx.restore();
}

function drawSceneToast(ctx, state, data, theme) {
  const label = sceneLabel(state.scene).toUpperCase();
  const message = state.statusText;
  const width = state.scene === SCENES.EXPEDITION ? 326 : 306;
  drawBeveledPanel(ctx, theme, 28, 24, width, 72, {
    cut: 16,
    fill: "rgba(5, 10, 16, 0.66)",
    stroke: "rgba(255,255,255,0.14)",
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.fillText(label, 52, 48);

  wrapText(ctx, message, 52, 72, width - 48, 20, theme.textMain, "14px 'Segoe UI', sans-serif");
}

function drawObjectiveCard(ctx, state, data, theme) {
  const lines = objectiveLines(state).slice(0, 5);
  const panelHeight = 74 + lines.length * 34;
  const x = 1000;
  const y = state.scene === SCENES.EXPEDITION ? 184 : 196;
  drawBeveledPanel(ctx, theme, x, y, 242, panelHeight, {
    cut: 16,
    fill: "rgba(6, 12, 18, 0.44)",
    stroke: "rgba(255,255,255,0.14)",
  });

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText(data.ui?.objectiveTitle || "목표", x + 26, y + 30);

  lines.forEach((line, index) => {
    const lineY = y + 60 + index * 34;
    ctx.strokeStyle = index === 0 ? theme.accent : "rgba(255,255,255,0.26)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 18, lineY - 5);
    ctx.lineTo(x + 30, lineY - 5);
    ctx.stroke();

    wrapText(ctx, line, x + 38, lineY, 178, 20, index === 0 ? theme.textMain : theme.textDim, "14px 'Segoe UI', sans-serif");
  });
}

function drawMiniMap(ctx, state, data, theme) {
  if (state.scene !== SCENES.EXPEDITION || !state.run || !data.ui?.minimap?.enabled) {
    return;
  }

  const run = state.run;
  const centerX = 1156;
  const centerY = 102;
  const radius = 76;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  const fill = ctx.createRadialGradient(centerX, centerY, 16, centerX, centerY, radius);
  fill.addColorStop(0, "rgba(224, 240, 212, 0.94)");
  fill.addColorStop(0.55, "rgba(73, 117, 128, 0.92)");
  fill.addColorStop(1, "rgba(10, 22, 28, 0.96)");
  ctx.fillStyle = fill;
  ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX + radius, centerY);
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY + radius);
  ctx.stroke();

  data.platforms.forEach((platform) => {
    const x = centerX - radius * 0.82 + (platform.x / data.world.width) * radius * 1.64;
    const width = Math.max(3, (platform.width / data.world.width) * radius * 1.64);
    const y = centerY - radius * 0.52 + (platform.y / data.world.height) * radius * 0.92;
    ctx.strokeStyle = platform.height >= 100 ? "rgba(22, 38, 44, 0.8)" : "rgba(244, 249, 252, 0.44)";
    ctx.lineWidth = platform.height >= 100 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  });

  const destination = data.extractionGate || (data.routeExits || [])[0];
  if (destination) {
    const gateX = centerX - radius * 0.82 + (destination.x / data.world.width) * radius * 1.64;
    const gateY = centerY - radius * 0.52 + (destination.y / data.world.height) * radius * 0.92;
    ctx.fillStyle = data.extractionGate ? theme.accent : theme.accentSecondary;
    ctx.beginPath();
    ctx.moveTo(gateX, gateY - 5);
    ctx.lineTo(gateX + 5, gateY);
    ctx.lineTo(gateX, gateY + 5);
    ctx.lineTo(gateX - 5, gateY);
    ctx.closePath();
    ctx.fill();
  }

  const playerX = centerX - radius * 0.82 + (run.player.x / data.world.width) * radius * 1.64;
  const playerY = centerY - radius * 0.52 + (run.player.y / data.world.height) * radius * 0.92;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(playerX + run.player.facing * 6, playerY);
  ctx.lineTo(playerX - run.player.facing * 4, playerY - 4);
  ctx.lineTo(playerX - run.player.facing * 2, playerY);
  ctx.lineTo(playerX - run.player.facing * 4, playerY + 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(147, 234, 255, 0.74)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius + 5, -1.18, 0.9);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 18px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("북", centerX, 24);
  ctx.textAlign = "left";
}

function drawHudGlyph(ctx, type, x, y, activeColor) {
  ctx.save();
  ctx.strokeStyle = activeColor;
  ctx.fillStyle = activeColor;
  ctx.lineWidth = 2;
  ctx.translate(x, y);

  if (type === "move") {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(-4, -8);
    ctx.lineTo(4, -8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(-4, 8);
    ctx.lineTo(4, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(8, -4);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill();
  } else if (type === "jump") {
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.quadraticCurveTo(0, -10, 10, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 2);
    ctx.lineTo(4, 0);
    ctx.lineTo(7, 7);
    ctx.closePath();
    ctx.fill();
  } else if (type === "dash") {
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(-2, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(10, -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, 10);
    ctx.lineTo(4, 4);
    ctx.lineTo(4, 8);
    ctx.lineTo(14, 0);
    ctx.stroke();
  } else if (type === "crouch") {
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-2, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(10, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-3, -5, 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "use") {
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(2, 6);
    ctx.lineTo(8, -6);
    ctx.stroke();
  }

  ctx.restore();
}

function drawActionNode(ctx, theme, x, y, type, label, keyLabel, prominent = false) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, prominent ? 30 : 24, 0, Math.PI * 2);
  ctx.fillStyle = prominent ? "rgba(8, 12, 18, 0.72)" : "rgba(8, 12, 18, 0.52)";
  ctx.fill();
  ctx.strokeStyle = prominent ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.16)";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawHudGlyph(ctx, type, x, y, prominent ? theme.accent : "#edf6fb");

  ctx.fillStyle = theme.textDim;
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + (prominent ? 42 : 34));
  ctx.fillStyle = theme.accent;
  ctx.font = "700 11px 'Segoe UI', sans-serif";
  ctx.fillText(keyLabel, x, y + (prominent ? 54 : 46));
  ctx.textAlign = "left";
  ctx.restore();
}

function drawActionCluster(ctx, theme) {
  drawActionNode(ctx, theme, 118, 610, "move", "이동", "A D", true);
  drawActionNode(ctx, theme, 54, 550, "jump", "점프", "W");
  drawActionNode(ctx, theme, 186, 570, "dash", "대시", "Space");
  drawActionNode(ctx, theme, 56, 676, "crouch", "숙이기", "↓");
  drawActionNode(ctx, theme, 184, 684, "use", "사용", "Z");
}

function getDashUiState(run, data) {
  const maxCharges = Math.max(1, Math.floor(data.player.movement.maxDashCount ?? 1));
  const currentCharges = Math.max(
    0,
    Math.min(
      maxCharges,
      Number.isFinite(run.player.dashCharges)
        ? run.player.dashCharges
        : (run.player.dashAvailable ? maxCharges : 0)
    )
  );
  const cooldownMax = Math.max(0.001, (data.player.movement.dashCooldownMs ?? 0) / 1000);
  const cooldownProgress = run.player.dashCooldownTimer > 0
    ? 1 - run.player.dashCooldownTimer / cooldownMax
    : 0;
  const value = run.player.dashCooldownTimer > 0 && currentCharges < maxCharges
    ? (currentCharges + cooldownProgress) / maxCharges
    : currentCharges / maxCharges;
  const countText = `${currentCharges}/${maxCharges}`;

  return {
    value: Math.max(0.08, Math.min(1, value)),
    statusText: run.player.dashCooldownTimer > 0
      ? `대시 충전 ${countText}`
      : currentCharges > 0
        ? `대시 준비 ${countText}`
        : `대시 소모 ${countText}`,
  };
}

function getRecoilShotUiState(run, data) {
  const maxCharges = Math.max(1, Math.floor(data.player.movement.recoilShotCharges ?? 1));
  const currentCharges = Math.max(0, Math.min(maxCharges, run.player.recoilShotCharges ?? maxCharges));
  const cooldownMax = Math.max(0.001, (data.player.movement.recoilShotCooldownMs ?? 0) / 1000);
  const cooldownProgress = run.player.recoilShotCooldownTimer > 0
    ? 1 - run.player.recoilShotCooldownTimer / cooldownMax
    : 1;
  return currentCharges > 0
    ? currentCharges / maxCharges
    : Math.max(0, Math.min(1, cooldownProgress));
}

function drawStatusBars(ctx, run, data, theme) {
  const panelX = 842;
  const panelY = 560;
  const panelW = 392;
  const panelH = 132;
  drawBeveledPanel(ctx, theme, panelX, panelY, panelW, panelH, {
    cut: 18,
    fill: "rgba(6, 11, 17, 0.72)",
    stroke: "rgba(255,255,255,0.14)",
  });

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText("STATUS", panelX + 26, panelY + 28);

  const dashState = getDashUiState(run, data);
  const bars = [
    { label: "HP", value: run.hp / data.player.maxHp, color: "#fbfefe" },
    { label: "BAT", value: run.battery / data.player.maxBattery, color: theme.accentSecondary },
    { label: "DASH", value: dashState.value, color: theme.accent },
  ];

  bars.forEach((bar, index) => {
    const x = panelX + 24;
    const y = panelY + 46 + index * 24;
    const width = 238;
    ctx.fillStyle = theme.textDim;
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillText(bar.label, x, y);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x + 62, y - 8, width, 8);
    ctx.fillStyle = bar.color;
    ctx.fillRect(x + 62, y - 8, width * Math.max(0, Math.min(1, bar.value)), 8);
  });

  drawPortraitAsset(ctx, data, panelX + panelW - 52, panelY + 68, 42);

  ctx.fillStyle = theme.textDim;
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText(dashState.statusText, panelX + 26, panelY + 118);
}


function drawHud(ctx, state, data) {
  const theme = getUiTheme(data);

  drawSceneToast(ctx, state, data, theme);
  drawObjectiveCard(ctx, state, data, theme);

  if (state.scene === SCENES.EXPEDITION && state.run) {
    drawMiniMap(ctx, state, data, theme);
    drawActionCluster(ctx, theme);
    drawStatusBars(ctx, state.run, data, theme);
  }
}

function getFaceOffTarget(run) {
  if (!run?.faceOff?.active || !run.faceOff.targetId) {
    return null;
  }
  return (run.humanoidEnemies || []).find((enemy) => enemy.id === run.faceOff.targetId) || null;
}

function getFaceOffDialogueChance(enemy, option) {
  const social = enemy?.social || {};
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
  chance -= Math.max(0, enemy?.dialogueFailures ?? 0) * 0.08;
  if ((enemy?.dialogueStage ?? 0) > 0 && option.successEffect === "dealProgress") {
    chance -= 0.1;
  }
  return clamp(chance, 0.05, 0.92);
}

function drawFaceOffTimeline(ctx, theme, faceOff, enemy) {
  const x = 214;
  const y = 34;
  const exhaustion = `${enemy?.exhaustionHits ?? 0}/${Math.max(1, enemy?.exhaustionLimit ?? 2)}`;
  const chips = [
    { label: "KNOCKDOWN", width: 142, danger: true },
    { label: "도주 중지", width: 126 },
    { label: `탈진 ${exhaustion}`, width: 116 },
    { label: "R: 놓아주기", width: 142 },
    { label: "ESC / 우클릭 취소", width: 176 },
  ];
  const displayChips = [
    { label: "KNOCKDOWN", width: 142, danger: true },
    { label: "CRAWL PAUSED", width: 142 },
    { label: `EXHAUST ${exhaustion}`, width: 132 },
    { label: "Q: RELEASE", width: 126 },
    { label: "ESC / RMB: CANCEL", width: 174 },
  ];
  const gap = 12;
  const totalWidth = displayChips.reduce((sum, chip) => sum + chip.width, 0) + gap * (displayChips.length - 1);
  let cursorX = x + (SCREEN_WIDTH - x * 2 - totalWidth) / 2;

  ctx.save();
  displayChips.forEach((chip) => {
    drawBeveledPanel(ctx, theme, cursorX, y, chip.width, 38, {
      fill: chip.danger ? "rgba(42, 12, 16, 0.66)" : "rgba(8, 10, 14, 0.58)",
      stroke: chip.danger ? "rgba(255, 96, 112, 0.48)" : "rgba(255,255,255,0.2)",
      cut: 9,
      innerLines: false,
    });
    ctx.fillStyle = chip.danger ? "rgba(255, 172, 180, 0.92)" : "rgba(245,248,251,0.82)";
    ctx.font = "700 14px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(chip.label, cursorX + chip.width / 2, y + 24);
    cursorX += chip.width + gap;
  });
  ctx.restore();
}

function addFaceOffRoundRectPath(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
}

function drawFaceOffTargetBackdrop(ctx, data) {
  const width = 650;
  const height = 612;
  const x = SCREEN_WIDTH / 2 - width / 2;
  const y = 74;
  const hasBackdropOverride = Object.prototype.hasOwnProperty.call(data.faceOff || {}, "targetBackdropAssetKey");
  const assetKey = hasBackdropOverride ? data.faceOff?.targetBackdropAssetKey : data.faceOff?.targetArtAssetKey;
  const src = assetKey ? data.art?.[assetKey]?.src : null;
  const image = getImageAsset(src);

  ctx.save();
  ctx.beginPath();
  addFaceOffRoundRectPath(ctx, x, y, width, height, 8);
  ctx.clip();

  if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    const sx = image.naturalWidth * 0.22;
    const sy = image.naturalHeight * 0.02;
    const sw = image.naturalWidth * 0.56;
    const sh = image.naturalHeight * 0.94;
    ctx.filter = "grayscale(1) contrast(1.08) brightness(0.62) blur(0.7px)";
    ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
    ctx.filter = "none";
  } else {
    const fallback = ctx.createLinearGradient(0, y, 0, y + height);
    fallback.addColorStop(0, "rgba(3, 5, 8, 0.94)");
    fallback.addColorStop(0.54, "rgba(8, 11, 16, 0.9)");
    fallback.addColorStop(1, "rgba(0, 0, 0, 0.96)");
    ctx.fillStyle = fallback;
    ctx.fillRect(x, y, width, height);
  }

  const haze = ctx.createRadialGradient(
    x + width * 0.52,
    y + height * 0.33,
    20,
    x + width * 0.52,
    y + height * 0.4,
    width * 0.62
  );
  haze.addColorStop(0, "rgba(255,255,255,0.08)");
  haze.addColorStop(0.48, "rgba(255,255,255,0.02)");
  haze.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(x, y, width, height);

  const vignette = ctx.createRadialGradient(
    x + width * 0.5,
    y + height * 0.48,
    width * 0.2,
    x + width * 0.5,
    y + height * 0.5,
    width * 0.76
  );
  vignette.addColorStop(0, "rgba(0,0,0,0.02)");
  vignette.addColorStop(0.58, "rgba(0,0,0,0.22)");
  vignette.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = vignette;
  ctx.fillRect(x, y, width, height);

  const floorShade = ctx.createLinearGradient(0, y + height * 0.52, 0, y + height);
  floorShade.addColorStop(0, "rgba(0,0,0,0)");
  floorShade.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = floorShade;
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.restore();
}

function drawFaceOffTargetArt(ctx, data) {
  const assetKey = data.faceOff?.targetArtAssetKey;
  const src = assetKey ? data.art?.[assetKey]?.src : null;
  const image = getImageAsset(src);
  if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return false;
  }

  const crop = data.faceOff?.targetArtCrop || {};
  const sx = clamp(crop.sx ?? 0.33, 0, 0.95) * image.naturalWidth;
  const sy = clamp(crop.sy ?? 0.02, 0, 0.95) * image.naturalHeight;
  const sw = clamp(crop.sw ?? 0.36, 0.05, 1) * image.naturalWidth;
  const sh = clamp(crop.sh ?? 0.94, 0.05, 1) * image.naturalHeight;
  const drawH = 708;
  const drawW = drawH * (sw / Math.max(1, sh));
  const x = SCREEN_WIDTH / 2 - drawW / 2;
  const y = 46;

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = "rgba(0,0,0,0.48)";
  ctx.shadowBlur = 16;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, drawW, drawH);
  ctx.shadowBlur = 0;

  const fade = ctx.createLinearGradient(0, y, 0, y + drawH);
  fade.addColorStop(0, "rgba(0,0,0,0.34)");
  fade.addColorStop(0.18, "rgba(0,0,0,0)");
  fade.addColorStop(0.76, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.56)");
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = fade;
  ctx.fillRect(x, y, drawW, drawH);
  ctx.restore();
  return true;
}

function drawFaceOffSilhouette(ctx, theme, data, faceOff) {
  const cx = SCREEN_WIDTH / 2;
  const top = 138;
  const selected = faceOff.selectedPart;
  const hover = faceOff.hoverPart;
  drawFaceOffTargetBackdrop(ctx, data);
  const hasTargetArt = drawFaceOffTargetArt(ctx, data);
  const zones = [
    { id: "head", label: "머리", x: cx - 45, y: top, width: 90, height: 86, shape: "ellipse" },
    { id: "torso", label: "몸통", x: cx - 74, y: top + 98, width: 148, height: 190 },
    { id: "leftArm", label: "왼팔", x: cx - 158, y: top + 116, width: 68, height: 170 },
    { id: "rightArm", label: "오른 팔", x: cx + 90, y: top + 116, width: 68, height: 170 },
    { id: "leftLeg", label: "왼 다리", x: cx - 78, y: top + 287, width: 64, height: 205 },
    { id: "rightLeg", label: "오른 다리", x: cx + 14, y: top + 287, width: 64, height: 205 },
  ];

  ctx.save();
  ctx.shadowColor = hasTargetArt ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)";
  ctx.shadowBlur = hasTargetArt ? 8 : 18;
  zones.forEach((zone) => {
    const active = zone.id === selected || zone.id === hover;
    ctx.fillStyle = hasTargetArt
      ? active ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.015)"
      : active ? "rgba(235,238,240,0.34)" : "rgba(218,222,225,0.16)";
    ctx.strokeStyle = active ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.24)";
    ctx.lineWidth = active ? 2 : 1.2;
    ctx.beginPath();
    if (zone.shape === "ellipse") {
      ctx.ellipse(zone.x + zone.width / 2, zone.y + zone.height / 2, zone.width / 2, zone.height / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.roundRect?.(zone.x, zone.y, zone.width, zone.height, 12);
      if (!ctx.roundRect) {
        ctx.rect(zone.x, zone.y, zone.width, zone.height);
      }
    }
    ctx.fill();
    ctx.stroke();

    const labelX = zone.id.includes("right") ? zone.x + zone.width + 18 : zone.x - 18;
    const align = zone.id.includes("right") ? "left" : "right";
    const labelY = zone.y + zone.height * 0.5;
    drawBeveledPanel(ctx, theme, align === "left" ? labelX : labelX - 78, labelY - 15, 78, 30, {
      fill: active ? "rgba(32, 36, 42, 0.78)" : "rgba(8, 10, 14, 0.48)",
      stroke: active ? "rgba(255,255,255,0.46)" : "rgba(255,255,255,0.16)",
      cut: 7,
      innerLines: false,
    });
    ctx.fillStyle = active ? "#ffffff" : "rgba(245,248,251,0.68)";
    ctx.font = "700 13px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(zone.label, align === "left" ? labelX + 39 : labelX - 39, labelY + 5);
  });
  ctx.restore();

}

function drawFaceOffCrosshair(ctx, state) {
  const mouse = state.mouse || {};
  const x = mouse.screenX ?? SCREEN_WIDTH / 2;
  const y = mouse.screenY ?? SCREEN_HEIGHT / 2;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 72, 86, 0.86)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.moveTo(x - 28, y);
  ctx.lineTo(x - 10, y);
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + 28, y);
  ctx.moveTo(x, y - 28);
  ctx.lineTo(x, y - 10);
  ctx.moveTo(x, y + 10);
  ctx.lineTo(x, y + 28);
  ctx.stroke();
  ctx.restore();
}

function drawFaceOffFingerGun(ctx, state, data) {
  const assetKey = data.faceOff?.fingerGunAssetKey;
  const src = assetKey ? data.art?.[assetKey]?.src : null;
  const image = getImageAsset(src);
  if (!image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    return;
  }

  const mouse = state.mouse || {};
  const aimX = mouse.screenX ?? SCREEN_WIDTH / 2;
  const aimY = mouse.screenY ?? SCREEN_HEIGHT / 2;
  const crop = data.faceOff?.fingerGunCrop || {};
  const sx = clamp(crop.sx ?? 0.39, 0, 0.95) * image.naturalWidth;
  const sy = clamp(crop.sy ?? 0.08, 0, 0.95) * image.naturalHeight;
  const sw = clamp(crop.sw ?? 0.61, 0.05, 1) * image.naturalWidth;
  const sh = clamp(crop.sh ?? 0.92, 0.05, 1) * image.naturalHeight;
  const drawW = data.faceOff?.fingerGunWidth ?? 640;
  const drawH = drawW * (sh / Math.max(1, sw));
  const anchor = data.faceOff?.fingerGunAnchor || {};
  const anchorX = clamp(anchor.x ?? 0.035, 0, 1);
  const anchorY = clamp(anchor.y ?? 0.2, 0, 1);
  const x = aimX - drawW * anchorX;
  const y = aimY - drawH * anchorY;

  ctx.save();
  ctx.globalAlpha = 0.98;
  ctx.shadowColor = "rgba(0,0,0,0.52)";
  ctx.shadowBlur = 18;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, drawW, drawH);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawFaceOffAcquireGauge(ctx, state) {
  const faceOff = state.run?.faceOff;
  if (!faceOff || faceOff.active || !faceOff.acquireTargetId || !(faceOff.acquireProgress > 0)) {
    return;
  }

  const mouse = state.mouse || {};
  const x = mouse.screenX ?? SCREEN_WIDTH / 2;
  const y = mouse.screenY ?? SCREEN_HEIGHT / 2;
  const progress = clamp(faceOff.acquireProgress ?? 0, 0, 1);
  const radius = 24;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * progress;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = progress >= 1 ? "rgba(255,255,255,0.94)" : "rgba(255, 72, 86, 0.86)";
  ctx.shadowColor = "rgba(255, 72, 86, 0.52)";
  ctx.shadowBlur = 10;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, radius, startAngle, endAngle);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(255, 72, 86, 0.72)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 34, y);
  ctx.lineTo(x - 14, y);
  ctx.moveTo(x + 14, y);
  ctx.lineTo(x + 34, y);
  ctx.moveTo(x, y - 34);
  ctx.lineTo(x, y - 14);
  ctx.moveTo(x, y + 14);
  ctx.lineTo(x, y + 34);
  ctx.stroke();
  ctx.restore();
}

function drawFaceOffDialogue(ctx, theme, data, enemy, faceOff) {
  const reveal = clamp(faceOff.choiceRevealProgress ?? 0, 0, 1);
  if (reveal <= 0) {
    return;
  }
  const options = data.faceOff?.dialogueOptions || [];
  const cardW = 286;
  const cardH = 58;
  const lowerGap = 30;
  const lowerStartX = SCREEN_WIDTH / 2 - (cardW * 2 + lowerGap) / 2;
  const eased = 1 - Math.pow(1 - reveal, 3);
  const baseY = lerp(744, 632, eased);
  const layout = {
    KeyW: {
      x: SCREEN_WIDTH / 2 - cardW / 2,
      y: baseY - 66,
      direction: "up",
    },
    KeyA: {
      x: lowerStartX,
      y: baseY,
      direction: "left",
    },
    KeyD: {
      x: lowerStartX + cardW + lowerGap,
      y: baseY,
      direction: "right",
    },
  };
  ctx.save();
  ctx.globalAlpha = reveal;
  options.forEach((option) => {
    const slot = layout[option.key];
    if (!slot) {
      return;
    }
    const { x, y } = slot;
    const selected = faceOff.selectedDialogueKey === option.key;
    const chance = Math.round(getFaceOffDialogueChance(enemy, option) * 100);
    drawBeveledPanel(ctx, theme, x, y, cardW, cardH, {
      fill: selected ? "rgba(34, 38, 44, 0.76)" : "rgba(8, 10, 14, 0.56)",
      stroke: selected ? "rgba(255,255,255,0.44)" : "rgba(255,255,255,0.18)",
      cut: 11,
      innerLines: false,
    });
    ctx.fillStyle = "rgba(245,248,251,0.72)";
    ctx.font = "700 14px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(option.key.replace("Key", ""), x + 16, y + 24);
    drawFaceOffDialogueArrow(ctx, x + 34, y + 39, slot.direction, selected);
    ctx.fillStyle = "#f5f8fb";
    ctx.font = "700 17px 'Segoe UI', sans-serif";
    ctx.fillText(option.label, x + 68, y + 24);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(245,248,251,0.78)";
    ctx.font = "700 15px 'Segoe UI', sans-serif";
    ctx.fillText(`${chance}%`, x + cardW - 18, y + 43);
  });
  ctx.restore();
}

function drawFaceOffDialogueArrow(ctx, x, y, direction, selected) {
  const size = 9;
  ctx.save();
  ctx.strokeStyle = selected ? "rgba(255,255,255,0.94)" : "rgba(245,248,251,0.58)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (direction === "up") {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x, y - size);
    ctx.moveTo(x - size * 0.65, y - size * 0.25);
    ctx.lineTo(x, y - size);
    ctx.lineTo(x + size * 0.65, y - size * 0.25);
  } else if (direction === "left") {
    ctx.moveTo(x + size, y);
    ctx.lineTo(x - size, y);
    ctx.moveTo(x - size * 0.25, y - size * 0.65);
    ctx.lineTo(x - size, y);
    ctx.lineTo(x - size * 0.25, y + size * 0.65);
  } else {
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x + size * 0.25, y - size * 0.65);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size * 0.25, y + size * 0.65);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFaceOffWeaponPanel(ctx, theme, run, data) {
  const hud = getSelectedArmHud(run, data);
  const x = 64;
  const y = 92;
  const width = 320;
  const height = 152;
  const reloadRatio = (hud.arm.reloadTimer ?? 0) > 0
    ? 1 - clamp((hud.arm.reloadTimer ?? 0) / Math.max(0.001, hud.arm.reloadDuration || hud.stats.reloadDuration), 0, 1)
    : 1;

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 14,
    fill: "rgba(4, 8, 12, 0.68)",
    stroke: "rgba(255,255,255,0.22)",
    innerLines: false,
  });

  ctx.fillStyle = "rgba(245,248,251,0.64)";
  ctx.font = "800 10px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("CURRENT ARM", x + 18, y + 20);

  drawArmSlotChip(ctx, theme, "1 LEFT", hud.side === "left", x + 16, y + 32);
  drawArmSlotChip(ctx, theme, "2 RIGHT", hud.side === "right", x + 88, y + 32);

  ctx.fillStyle = theme.textMain;
  ctx.font = "800 16px 'Segoe UI', sans-serif";
  ctx.fillText(hud.stats.label, x + 166, y + 52);

  ctx.fillStyle = hud.magazine > 0 ? "#f5f8fb" : "#ff9fb4";
  ctx.font = "900 28px 'Segoe UI', sans-serif";
  ctx.fillText(`${hud.magazine}/${hud.stats.magazineSize}`, x + 20, y + 88);

  ctx.fillStyle = theme.textDim;
  ctx.font = "800 12px 'Segoe UI', sans-serif";
  ctx.fillText(`${hud.stats.ammoType.toUpperCase()} ${hud.reserve}`, x + 104, y + 84);
  ctx.fillText((hud.arm.reloadTimer ?? 0) > 0 ? "RELOADING" : "READY", x + 104, y + 100);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x + 166, y + 68, 110, 6);
  ctx.fillStyle = (hud.arm.reloadTimer ?? 0) > 0 ? theme.accent : theme.accentSecondary;
  ctx.fillRect(x + 166, y + 68, 110 * reloadRatio, 6);

  const moduleLabels = (hud.arm.modules || []).slice(0, 3).map((moduleId) => data.weaponModules?.[moduleId]?.shortLabel || moduleId.slice(0, 3).toUpperCase());
  moduleLabels.forEach((label, index) => {
    const chipX = x + 166 + index * 32;
    drawBeveledPanel(ctx, theme, chipX, y + 82, 28, 18, {
      cut: 5,
      fill: "rgba(255,255,255,0.06)",
      stroke: "rgba(255,255,255,0.12)",
      innerLines: false,
    });
    ctx.fillStyle = theme.textDim;
    ctx.font = "800 8px 'Segoe UI', sans-serif";
    ctx.fillText(label, chipX + 4, y + 95);
  });

  const commands = ["1/2 ARM", "LMB FIRE", "R RELOAD", "Q RELEASE"];
  commands.forEach((label, index) => {
    const chipX = x + 16 + index * 74;
    drawBeveledPanel(ctx, theme, chipX, y + 116, 66, 22, {
      cut: 6,
      fill: label === "Q RELEASE" ? "rgba(42, 12, 16, 0.42)" : "rgba(255,255,255,0.06)",
      stroke: label === "Q RELEASE" ? "rgba(255, 96, 112, 0.34)" : "rgba(255,255,255,0.14)",
      innerLines: false,
    });
    ctx.fillStyle = label === "Q RELEASE" ? "rgba(255, 188, 194, 0.92)" : "rgba(245,248,251,0.72)";
    ctx.font = "800 8px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, chipX + 33, y + 131);
  });
}

function getFaceOffShotShake(faceOff) {
  const duration = Math.max(0.001, faceOff.shotShakeDuration ?? 0.22);
  const ratio = clamp((faceOff.shotShakeTimer ?? 0) / duration, 0, 1);
  if (ratio <= 0) {
    return { x: 0, y: 0, ratio: 0 };
  }
  const intensity = (faceOff.shotShakeIntensity ?? 18) * ratio * ratio;
  const time = performance.now() * 0.045;
  return {
    x: Math.sin(time * 2.17) * intensity + Math.sin(time * 5.3) * intensity * 0.35,
    y: Math.cos(time * 2.9) * intensity * 0.62,
    ratio,
  };
}

function drawFaceOffShotFlash(ctx, state, faceOff) {
  const duration = Math.max(0.001, faceOff.shotFlashDuration ?? 0.16);
  const ratio = clamp((faceOff.shotFlashTimer ?? 0) / duration, 0, 1);
  if (ratio <= 0) {
    return;
  }

  const mouse = state.mouse || {};
  const x = mouse.screenX ?? SCREEN_WIDTH / 2;
  const y = mouse.screenY ?? SCREEN_HEIGHT / 2;
  const coreAlpha = 0.36 * ratio;
  const ringAlpha = 0.72 * ratio;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const blast = ctx.createRadialGradient(x, y, 8, x, y, 190);
  blast.addColorStop(0, `rgba(255,255,255,${coreAlpha})`);
  blast.addColorStop(0.18, `rgba(255,80,94,${0.24 * ratio})`);
  blast.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = blast;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.strokeStyle = `rgba(255,255,255,${ringAlpha})`;
  ctx.lineWidth = 3 + ratio * 5;
  ctx.beginPath();
  ctx.arc(x, y, 26 + (1 - ratio) * 68, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,72,86,${0.7 * ratio})`;
  ctx.lineWidth = 2;
  for (let index = 0; index < 10; index += 1) {
    const angle = (Math.PI * 2 * index) / 10 + ratio * 0.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * 24, y + Math.sin(angle) * 24);
    ctx.lineTo(x + Math.cos(angle) * (88 + (1 - ratio) * 38), y + Math.sin(angle) * (88 + (1 - ratio) * 38));
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(255,255,255,${0.16 * ratio})`;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.restore();
}

function drawFaceOffEnemySpeech(ctx, theme, faceOff) {
  const text = faceOff.enemyLineVisible || "";
  if (!text && !faceOff.enemyLine) {
    return;
  }
  const reveal = clamp(faceOff.choiceRevealProgress ?? 0, 0, 1);
  if (reveal >= 1) {
    return;
  }

  const stateLabel = faceOff.encounterState === "ambushed"
    ? "기습 당함"
    : faceOff.encounterState === "dialogue"
      ? "대화"
      : faceOff.encounterState === "knockdown"
        ? "넉다운"
      : "교전";
  const x = SCREEN_WIDTH / 2 - 310;
  const y = lerp(606, 728, 1 - Math.pow(1 - reveal, 3));
  const width = 620;
  const height = 78;

  ctx.save();
  ctx.globalAlpha = 1 - reveal * 0.88;
  drawBeveledPanel(ctx, theme, x, y, width, height, {
    fill: "rgba(6, 8, 12, 0.82)",
    stroke: "rgba(255,255,255,0.28)",
    cut: 12,
    innerLines: false,
  });

  ctx.fillStyle = faceOff.encounterState === "ambushed"
    ? "rgba(255,255,255,0.78)"
    : faceOff.encounterState === "dialogue"
      ? "rgba(210,230,255,0.82)"
      : faceOff.encounterState === "knockdown"
        ? "rgba(255,172,180,0.82)"
      : "rgba(255,118,132,0.82)";
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(stateLabel, x + 22, y + 24);

  ctx.fillStyle = "#f5f8fb";
  ctx.font = "700 20px 'Segoe UI', sans-serif";
  ctx.fillText(text, x + 22, y + 54);

  if (faceOff.enemyLineIndex < (faceOff.enemyLine?.length ?? 0)) {
    const blink = Math.sin(performance.now() * 0.012) > 0 ? 1 : 0.25;
    ctx.fillStyle = `rgba(245,248,251,${blink})`;
    ctx.fillRect(x + 24 + ctx.measureText(text).width + 6, y + 38, 8, 20);
  }
  ctx.restore();
}

function drawFaceOffOverlay(ctx, state, data, theme) {
  const run = state.run;
  const faceOff = run?.faceOff;
  if (!faceOff?.active) {
    return;
  }

  const enemy = getFaceOffTarget(run);
  ctx.save();
  const entryDuration = Math.max(0.001, faceOff.entryTransitionDuration ?? 1);
  const entryProgress = clamp(1 - (faceOff.entryTransitionTimer ?? 0) / entryDuration, 0, 1);
  ctx.globalAlpha = clamp(entryProgress * 1.35, 0.2, 1);
  const shake = getFaceOffShotShake(faceOff);
  if (shake.ratio > 0) {
    ctx.translate(shake.x, shake.y);
  }
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.fillStyle = "rgba(255,255,255,0.018)";
  ctx.fillRect(0, 100, SCREEN_WIDTH, 430);

  drawFaceOffTimeline(ctx, theme, faceOff, enemy);
  drawFaceOffSilhouette(ctx, theme, data, faceOff);
  drawFaceOffFingerGun(ctx, state, data);
  drawFaceOffCrosshair(ctx, state);
  drawFaceOffEnemySpeech(ctx, theme, faceOff);
  drawFaceOffDialogue(ctx, theme, data, enemy, faceOff);
  drawFaceOffWeaponPanel(ctx, theme, run, data);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(245,248,251,0.82)";
  ctx.font = "700 15px 'Segoe UI', sans-serif";
  ctx.fillText(enemy?.label || "Human target", SCREEN_WIDTH / 2, 116);
  if (faceOff.message) {
    ctx.fillStyle = faceOff.result ? "rgba(255,255,255,0.92)" : "rgba(245,248,251,0.58)";
    ctx.font = "700 13px 'Segoe UI', sans-serif";
    ctx.fillText(faceOff.message, SCREEN_WIDTH / 2, 138);
  }
  ctx.restore();

  drawFaceOffShotFlash(ctx, state, faceOff);
}

function getFaceOffEntryProgress(run) {
  const faceOff = run?.faceOff;
  if (!faceOff?.active) {
    return 0;
  }
  const duration = Math.max(0.001, faceOff.entryTransitionDuration ?? 1);
  if ((faceOff.entryTransitionStartedAt ?? 0) > 0 && typeof performance !== "undefined") {
    const elapsed = Math.max(0, (performance.now() - faceOff.entryTransitionStartedAt) / 1000);
    return clamp(1 - elapsed / duration, 0, 1);
  }
  return clamp((faceOff.entryTransitionTimer ?? 0) / duration, 0, 1);
}

function getFaceOffEntryElapsedProgress(run) {
  const remaining = getFaceOffEntryProgress(run);
  return remaining > 0 ? 1 - remaining : 0;
}

function getFaceOffTargetScreenPoint(run, data, cameraZoom) {
  const target = getFaceOffTarget(run);
  if (!target) {
    return {
      x: SCREEN_WIDTH / 2,
      y: SCREEN_HEIGHT * 0.48,
    };
  }

  return {
    x: (target.x + target.width * 0.5 - run.cameraX) * cameraZoom,
    y: (target.y + target.height * 0.42 - run.cameraY) * cameraZoom,
  };
}

function applyFaceOffEntryCameraTransform(ctx, run, data, cameraZoom) {
  const remaining = getFaceOffEntryProgress(run);
  if (remaining <= 0) {
    return;
  }

  const progress = getFaceOffEntryElapsedProgress(run);
  const zoomProgress = clamp(progress / 0.5, 0, 1);
  const eased = 1 - Math.pow(1 - zoomProgress, 3);
  const entryScale = 1 + (data.faceOff?.entryZoomScale ?? 1.62) * eased;
  const focus = getFaceOffTargetScreenPoint(run, data, cameraZoom);

  ctx.translate(SCREEN_WIDTH * 0.5, SCREEN_HEIGHT * 0.48);
  ctx.scale(entryScale, entryScale);
  ctx.translate(-focus.x, -focus.y);
}

function drawFaceOffEntryTransition(ctx, run, data) {
  const remaining = getFaceOffEntryProgress(run);
  if (remaining <= 0) {
    return;
  }

  const progress = getFaceOffEntryElapsedProgress(run);
  const zoomProgress = clamp(progress / 0.5, 0, 1);
  const eased = 1 - Math.pow(1 - zoomProgress, 3);
  const streakAlpha = progress < 0.5
    ? clamp(1 - progress / 0.5, 0, 1)
    : 0;
  const whiteAlpha = progress < 0.5
    ? clamp(progress / 0.5, 0, 1) * 0.24
    : clamp(1 - (progress - 0.5) / 0.5, 0, 1);
  const focus = getFaceOffTargetScreenPoint(run, data, getRunCameraZoom(run, data));

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = `rgba(255,255,255,${0.22 * streakAlpha})`;
  ctx.lineWidth = 2;
  for (let index = 0; index < 18; index += 1) {
    const angle = (Math.PI * 2 * index) / 18 + eased * 0.22;
    const inner = 70 + eased * 120;
    const outer = 320 + eased * 220;
    ctx.beginPath();
    ctx.moveTo(focus.x + Math.cos(angle) * inner, focus.y + Math.sin(angle) * inner);
    ctx.lineTo(focus.x + Math.cos(angle) * outer, focus.y + Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
  const vignette = ctx.createRadialGradient(focus.x, focus.y, 80, focus.x, focus.y, 640);
  vignette.addColorStop(0, `rgba(0,0,0,${0.04 * streakAlpha})`);
  vignette.addColorStop(0.55, `rgba(0,0,0,${0.18 * streakAlpha})`);
  vignette.addColorStop(1, `rgba(0,0,0,${0.78 * streakAlpha})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.strokeStyle = `rgba(255, 72, 86, ${0.55 * streakAlpha})`;
  ctx.lineWidth = 1.5 + eased * 2;
  ctx.beginPath();
  ctx.arc(focus.x, focus.y, 26 + eased * 42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = `rgba(255,255,255,${whiteAlpha})`;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.restore();
}

function renderExpedition(ctx, state, data) {
  const run = state.run;
  const theme = getUiTheme(data);
  const cameraZoom = getRunCameraZoom(run, data);

  drawScenicBackdrop(ctx, theme, state.pulse, run.cameraX);

  ctx.save();
  applyFaceOffEntryCameraTransform(ctx, run, data, cameraZoom);
  ctx.translate(-run.cameraX * cameraZoom, -run.cameraY * cameraZoom);
  ctx.scale(cameraZoom, cameraZoom);
  drawWorldMegastructures(ctx, run);
  drawGroundShine(ctx);
  drawTerrain(ctx, data);
  drawGate(ctx, data, theme);
  drawRouteExits(ctx, data, theme);
  drawBraceWalls(ctx, data, theme);
  drawProps(ctx, data, state.pulse, theme);
  drawLootCrates(ctx, run, theme);
  drawEntity(ctx, run.encounters.guard, {
    body: "#86a9c7",
    flash: "#eef5ff",
    eye: "#182434",
    trim: "#d5d9de",
  }, "감시자");

  drawEntity(ctx, run.encounters.ritualist, {
    body: "#9e8798",
    flash: "#fff2d0",
    eye: "#2b1f29",
    trim: "#f0d082",
  }, "의식자");

  run.threats.forEach((threat) => {
    if (!run.nightActive || threat.dead) {
      return;
    }
    drawEntity(ctx, threat, {
      body: "#334656",
      flash: "#a6d8ff",
      eye: "#d9f2ff",
      trim: "#6d8eaa",
    });
  });

  drawDroneTelegraphs(ctx, run);
  drawHumanoidEnemies(ctx, run);
  drawHostileDrones(ctx, run);
  drawEnemyShots(ctx, run);
  drawRecoilFocusMapDim(ctx, run, data);
  drawAfterimages(ctx, run, data);
  drawRecoilFocusAfterimages(ctx, run, data);
  drawPlayer(ctx, run, data);
  drawRecoilAimWorld(ctx, run);
  drawAttackFx(ctx, run);
  drawRecoilFx(ctx, run);
  drawWeaponModulesWorld(ctx, run);
  drawParticles(ctx, run);
  drawDamageNumbers(ctx, run);
  drawDebugWorldOverlay(ctx, state, data);
  drawLiveEditWorldOverlay(ctx, state, data);
  drawWorldPrompt(ctx, run, theme);
  ctx.restore();

  drawRecoilFocusOverlay(ctx, run, data);
  drawDarknessOverlay(ctx, run, data);
  drawFaceOffEntryTransition(ctx, run, data);
  ctx.save();
  ctx.translate(-run.cameraX * cameraZoom, -run.cameraY * cameraZoom);
  ctx.scale(cameraZoom, cameraZoom);
  drawThreatSense(ctx, run, state);
  ctx.restore();

  drawHudV5(ctx, state, data);
  drawLootOverlayV2(ctx, state, data, theme);
  drawFaceOffAcquireGauge(ctx, state);
  drawFaceOffOverlay(ctx, state, data, theme);
  drawDebugCameraOverlay(ctx, state, data);
}

function drawTitleSceneV2(ctx, state, data) {
  const theme = getUiTheme(data);
  drawScenicBackdrop(ctx, theme, state.pulse, 0);

  ctx.fillStyle = "rgba(5, 10, 16, 0.22)";
  ctx.fillRect(0, 0, 540, 720);

  drawBeveledPanel(ctx, theme, 56, 62, 420, 214, {
    fill: "rgba(7, 13, 20, 0.54)",
    stroke: "rgba(255,255,255,0.16)",
    glow: true,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText("프로토타입", 84, 96);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 62px 'Trebuchet MS', sans-serif";
  ctx.fillText("TYPE-07A", 82, 160);

  ctx.fillStyle = theme.textDim;
  ctx.font = "18px 'Segoe UI', sans-serif";
  ctx.fillText("규칙 해석 익스트랙션", 86, 194);
  ctx.fillText("생체기계 조작 · 저텍스트 UI", 86, 224);

  ctx.fillStyle = theme.accent;
  ctx.font = "700 16px 'Segoe UI', sans-serif";
  ctx.fillText(state.save?.hasRun ? "C: 이어하기  ·  N: 새 런" : "C: 시작", 84, 254);

  drawArtPanel(ctx, theme, data, "titlePanel", 540, 74, 664, 574, {
    cut: 24,
    fill: "rgba(8, 14, 22, 0.2)",
    stroke: "rgba(255,255,255,0.16)",
    glow: true,
    alpha: 0.98,
    overlay: "rgba(6, 10, 16, 0.04)",
  });

  drawBeveledPanel(ctx, theme, 56, 584, 238, 74, {
    fill: "rgba(8, 12, 18, 0.36)",
    stroke: "rgba(255,255,255,0.12)",
    innerLines: false,
  });
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.fillText("이동 실험실", 82, 612);
  ctx.fillStyle = theme.textDim;
  ctx.font = "15px 'Segoe UI', sans-serif";
  ctx.fillText("SD 캐릭터와 UI 시안 적용", 82, 640);
}

function drawShelterSceneV2(ctx, state, data) {
  const theme = getUiTheme(data);
  drawScenicBackdrop(ctx, theme, state.pulse * 0.9, 40);

  drawBeveledPanel(ctx, theme, 58, 70, 366, 228, {
    fill: "rgba(7, 12, 18, 0.6)",
    stroke: "rgba(255,255,255,0.18)",
    glow: true,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText("쉘터", 84, 102);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 48px 'Trebuchet MS', sans-serif";
  ctx.fillText("Type-07A", 82, 160);

  ctx.fillStyle = theme.textDim;
  ctx.font = "17px 'Segoe UI', sans-serif";
  ctx.fillText("오퍼레이터 · 동기화 관측", 86, 192);
  ctx.fillText("필요한 정보만 남긴다.", 86, 224);

  const chipY = 246;
  const chips = [
    { x: 82, label: "신뢰", value: String(state.meta.trust) },
    { x: 176, label: "자재", value: String(state.meta.bankedMaterials) },
    { x: 270, label: "해금", value: String(state.meta.unlockedAbilities.length) },
  ];

  chips.forEach((chip) => {
    drawBeveledPanel(ctx, theme, chip.x, chipY, 74, 42, {
      cut: 12,
      fill: "rgba(8, 12, 18, 0.34)",
      stroke: "rgba(255,255,255,0.12)",
      innerLines: false,
    });
    ctx.fillStyle = theme.textMute;
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillText(chip.label, chip.x + 14, chipY + 18);
    ctx.fillStyle = theme.textMain;
    ctx.font = "700 15px 'Segoe UI', sans-serif";
    ctx.fillText(chip.value, chip.x + 14, chipY + 35);
  });

  ctx.fillStyle = theme.accent;
  ctx.font = "700 16px 'Segoe UI', sans-serif";
  ctx.fillText("C: 출격", 84, 320);

  drawArtPanel(ctx, theme, data, "shelterPanel", 458, 88, 732, 520, {
    cut: 24,
    fill: "rgba(7, 12, 18, 0.24)",
    stroke: "rgba(255,255,255,0.16)",
    glow: true,
    alpha: 0.96,
    overlay: "rgba(6, 10, 16, 0.08)",
  });
}

function drawSceneToastV2(ctx, state, theme) {
  const label = state.scene === SCENES.EXPEDITION ? "탐사" : sceneLabel(state.scene);
  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.fillText(label, 52, 42);

  ctx.fillStyle = theme.textMain;
  ctx.font = "14px 'Segoe UI', sans-serif";
  wrapText(ctx, state.statusText, 52, 66, 238, 18, theme.textMain, "14px 'Segoe UI', sans-serif");
}

function drawObjectiveCardV2(ctx, state, data, theme) {
  let lines = [];
  if (state.scene === SCENES.EXPEDITION && state.run) {
    if (isMovementLab(data)) {
      lines = [
        "달리기",
        "점프",
        "벽 슬라이드",
        "출구 도달",
      ];
    } else {
      if (!state.run.inventory.badge) {
        lines.push("배지 확보");
      }
      if (!state.run.encounters.guard.outcome) {
        lines.push("경비형 처리");
      }
      if (!state.run.encounters.ritualist.outcome) {
        lines.push("의식형 처리");
      }
      lines.push("출구 귀환");
    }
  }

  lines.slice(0, 4).forEach((line, index) => {
    const y = 256 + index * 42;
    ctx.strokeStyle = index === 0 ? theme.accent : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1038, y - 6);
    ctx.lineTo(1050, y - 6);
    ctx.stroke();
    ctx.fillStyle = index === 0 ? theme.textMain : theme.textDim;
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillText(line, 1062, y);
  });
}

function drawMiniMapV2(ctx, state, data, theme) {
  if (state.scene !== SCENES.EXPEDITION || !state.run || !data.ui?.minimap?.enabled) {
    return;
  }

  const run = state.run;
  const centerX = 1148;
  const centerY = 122;
  const radius = 56;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  const fill = ctx.createRadialGradient(centerX, centerY, 14, centerX, centerY, radius);
  fill.addColorStop(0, "rgba(224, 240, 212, 0.88)");
  fill.addColorStop(0.55, "rgba(73, 117, 128, 0.82)");
  fill.addColorStop(1, "rgba(10, 22, 28, 0.92)");
  ctx.fillStyle = fill;
  ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX + radius, centerY);
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY + radius);
  ctx.stroke();

  data.platforms.forEach((platform) => {
    const x = centerX - radius * 0.82 + (platform.x / data.world.width) * radius * 1.64;
    const width = Math.max(3, (platform.width / data.world.width) * radius * 1.64);
    const y = centerY - radius * 0.52 + (platform.y / data.world.height) * radius * 0.92;
    ctx.strokeStyle = platform.height >= 100 ? "rgba(22, 38, 44, 0.76)" : "rgba(244, 249, 252, 0.32)";
    ctx.lineWidth = platform.height >= 100 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  });

  const destination = data.extractionGate || (data.routeExits || [])[0];
  if (destination) {
    const gateX = centerX - radius * 0.82 + (destination.x / data.world.width) * radius * 1.64;
    const gateY = centerY - radius * 0.52 + (destination.y / data.world.height) * radius * 0.92;
    ctx.fillStyle = data.extractionGate ? theme.accent : theme.accentSecondary;
    ctx.beginPath();
    ctx.moveTo(gateX, gateY - 4);
    ctx.lineTo(gateX + 4, gateY);
    ctx.lineTo(gateX, gateY + 4);
    ctx.lineTo(gateX - 4, gateY);
    ctx.closePath();
    ctx.fill();
  }

  const playerX = centerX - radius * 0.82 + (run.player.x / data.world.width) * radius * 1.64;
  const playerY = centerY - radius * 0.52 + (run.player.y / data.world.height) * radius * 0.92;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(playerX + run.player.facing * 5, playerY);
  ctx.lineTo(playerX - run.player.facing * 3, playerY - 3);
  ctx.lineTo(playerX - run.player.facing * 1, playerY);
  ctx.lineTo(playerX - run.player.facing * 3, playerY + 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawActionClusterV2(ctx, theme) {
  const labels = [
    { x: 46, y: 648, text: "A D" },
    { x: 168, y: 649, text: "RMB/LMB" },
    { x: 44, y: 699, text: "W" },
    { x: 126, y: 706, text: "↓" },
    { x: 210, y: 690, text: "Z" },
  ];

  labels.forEach((label) => {
    ctx.fillStyle = theme.textDim;
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillText(label.text, label.x, label.y);
  });
}

function drawStatusBarsV2(ctx, run, data, theme) {
  const dashState = getDashUiState(run, data);
  const bars = [
    { value: run.hp / data.player.maxHp, color: "#fbfefe" },
    { value: run.battery / data.player.maxBattery, color: theme.accentSecondary },
    { value: dashState.value, color: theme.accent },
  ];

  bars.forEach((bar, index) => {
    const x = 870;
    const y = 596 + index * 29;
    const width = 236;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, width, 8);
    ctx.fillStyle = bar.color;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, bar.value)), 8);
  });
}


function drawStatusPortraitV2(ctx, data) {
  drawPortraitAsset(ctx, data, 1149, 628, 46);
}

function drawHudV2(ctx, state, data) {
  const theme = getUiTheme(data);
  if (state.scene !== SCENES.EXPEDITION || !state.run) {
    return;
  }

  drawMiniMapV2(ctx, state, data, theme);
  drawObjectiveCardV2(ctx, state, data, theme);
  drawStatusBarsV2(ctx, state.run, data, theme);
  drawFullscreenOverlayArt(ctx, data, "expeditionHudOverlay", 0.98);
  drawSceneToastV2(ctx, state, theme);
  drawActionClusterV2(ctx, theme);
  drawStatusPortraitV2(ctx, data);
}

function getUiLayoutV3(data) {
  const layout = data.ui?.layout || {};
  return {
    toast: {
      x: layout.toast?.x ?? 52,
      y: layout.toast?.y ?? 42,
      width: layout.toast?.width ?? 238,
    },
    minimap: {
      x: layout.minimap?.x ?? 1148,
      y: layout.minimap?.y ?? 122,
      radius: layout.minimap?.radius ?? 56,
    },
    objective: {
      x: layout.objective?.x ?? 1062,
      y: layout.objective?.y ?? 256,
      gap: layout.objective?.gap ?? 42,
    },
    status: {
      x: layout.status?.x ?? 870,
      y: layout.status?.y ?? 596,
      width: layout.status?.width ?? 236,
      gap: layout.status?.gap ?? 29,
    },
    portrait: {
      x: layout.portrait?.x ?? 1149,
      y: layout.portrait?.y ?? 628,
      radius: layout.portrait?.radius ?? 46,
    },
    actions: {
      moveX: layout.actions?.moveX ?? 46,
      moveY: layout.actions?.moveY ?? 648,
      dashX: layout.actions?.dashX ?? 168,
      dashY: layout.actions?.dashY ?? 649,
      jumpX: layout.actions?.jumpX ?? 44,
      jumpY: layout.actions?.jumpY ?? 699,
      crouchX: layout.actions?.crouchX ?? 126,
      crouchY: layout.actions?.crouchY ?? 706,
      useX: layout.actions?.useX ?? 210,
      useY: layout.actions?.useY ?? 690,
    },
    results: {
      cardX: layout.results?.cardX ?? 150,
      cardY: layout.results?.cardY ?? 104,
      cardW: layout.results?.cardW ?? 980,
      cardH: layout.results?.cardH ?? 512,
      artX: layout.results?.artX ?? 560,
      artY: layout.results?.artY ?? 144,
      artW: layout.results?.artW ?? 514,
      artH: layout.results?.artH ?? 244,
    },
  };
}

function getObjectiveLinesV3(state, data) {
  if (state.scene !== SCENES.EXPEDITION || !state.run) {
    return [];
  }

  if (isMovementLab(data)) {
    return data.world.labObjectives.slice(0, 4);
  }

  const lines = [];
  if (!state.run.inventory.badge) {
    lines.push("배지 확보");
  }
  if (!state.run.encounters.guard.outcome) {
    lines.push("경비형 처리");
  }
  if (!state.run.encounters.ritualist.outcome) {
    lines.push("의식형 처리");
  }
  lines.push("출구 귀환");
  return lines.slice(0, 4);
}

function drawTitleSceneV3(ctx, state, data) {
  const theme = getUiTheme(data);
  drawScenicBackdrop(ctx, theme, state.pulse, 0);

  ctx.fillStyle = "rgba(5, 10, 16, 0.22)";
  ctx.fillRect(0, 0, 540, 720);

  drawBeveledPanel(ctx, theme, 56, 62, 420, 214, {
    fill: "rgba(7, 13, 20, 0.54)",
    stroke: "rgba(255,255,255,0.16)",
    glow: true,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText("브라우저 프로토타입", 84, 96);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 62px 'Trebuchet MS', sans-serif";
  ctx.fillText("TYPE-07A", 82, 160);

  ctx.fillStyle = theme.textDim;
  ctx.font = "18px 'Segoe UI', sans-serif";
  ctx.fillText("규칙 해석 익스트랙션", 86, 194);
  ctx.fillText("저텍스트 HUD · SD 플레이어", 86, 224);

  ctx.fillStyle = theme.accent;
  ctx.font = "700 16px 'Segoe UI', sans-serif";
  ctx.fillText(state.save?.hasRun ? "C: 이어하기  ·  N: 새 런" : "C: 시작", 84, 254);

  drawArtPanel(ctx, theme, data, "titlePanel", 540, 74, 664, 574, {
    cut: 24,
    fill: "rgba(8, 14, 22, 0.2)",
    stroke: "rgba(255,255,255,0.16)",
    glow: true,
    alpha: 0.98,
    overlay: "rgba(6, 10, 16, 0.04)",
  });

  drawBeveledPanel(ctx, theme, 56, 584, 252, 74, {
    fill: "rgba(8, 12, 18, 0.36)",
    stroke: "rgba(255,255,255,0.12)",
    innerLines: false,
  });
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 12px 'Segoe UI', sans-serif";
  ctx.fillText("Movement Lab", 82, 612);
  ctx.fillStyle = theme.textDim;
  ctx.font = "15px 'Segoe UI', sans-serif";
  ctx.fillText("움직임과 HUD 배치를 점검한다.", 82, 640);
}

function drawShelterSceneV3(ctx, state, data) {
  const theme = getUiTheme(data);
  drawScenicBackdrop(ctx, theme, state.pulse * 0.9, 40);

  drawBeveledPanel(ctx, theme, 58, 70, 366, 228, {
    fill: "rgba(7, 12, 18, 0.6)",
    stroke: "rgba(255,255,255,0.18)",
    glow: true,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText("쉘터", 84, 102);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 48px 'Trebuchet MS', sans-serif";
  ctx.fillText("Type-07A", 82, 160);

  ctx.fillStyle = theme.textDim;
  ctx.font = "17px 'Segoe UI', sans-serif";
  ctx.fillText("오퍼레이터 · 동기화 관측", 86, 192);
  ctx.fillText("필요한 정보만 남긴다.", 86, 224);

  const chipY = 246;
  const chips = [
    { x: 82, label: "신뢰", value: String(state.meta.trust) },
    { x: 176, label: "자재", value: String(state.meta.bankedMaterials) },
    { x: 270, label: "해금", value: String(state.meta.unlockedAbilities.length) },
  ];

  chips.forEach((chip) => {
    drawBeveledPanel(ctx, theme, chip.x, chipY, 74, 42, {
      cut: 12,
      fill: "rgba(8, 12, 18, 0.34)",
      stroke: "rgba(255,255,255,0.12)",
      innerLines: false,
    });
    ctx.fillStyle = theme.textMute;
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillText(chip.label, chip.x + 14, chipY + 18);
    ctx.fillStyle = theme.textMain;
    ctx.font = "700 15px 'Segoe UI', sans-serif";
    ctx.fillText(chip.value, chip.x + 14, chipY + 35);
  });

  ctx.fillStyle = theme.accent;
  ctx.font = "700 16px 'Segoe UI', sans-serif";
  ctx.fillText("C: 출격", 84, 320);

  drawArtPanel(ctx, theme, data, "shelterPanel", 458, 88, 732, 520, {
    cut: 24,
    fill: "rgba(7, 12, 18, 0.24)",
    stroke: "rgba(255,255,255,0.16)",
    glow: true,
    alpha: 0.96,
    overlay: "rgba(6, 10, 16, 0.08)",
  });
}

function drawMiniMapV3(ctx, state, data, theme, layout) {
  if (state.scene !== SCENES.EXPEDITION || !state.run || !data.ui?.minimap?.enabled) {
    return;
  }

  const run = state.run;
  const centerX = layout.minimap.x;
  const centerY = layout.minimap.y;
  const radius = layout.minimap.radius;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  const fill = ctx.createRadialGradient(centerX, centerY, 14, centerX, centerY, radius);
  fill.addColorStop(0, "rgba(224, 240, 212, 0.88)");
  fill.addColorStop(0.55, "rgba(73, 117, 128, 0.82)");
  fill.addColorStop(1, "rgba(10, 22, 28, 0.92)");
  ctx.fillStyle = fill;
  ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX + radius, centerY);
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY + radius);
  ctx.stroke();

  data.platforms.forEach((platform) => {
    const x = centerX - radius * 0.82 + (platform.x / data.world.width) * radius * 1.64;
    const width = Math.max(3, (platform.width / data.world.width) * radius * 1.64);
    const y = centerY - radius * 0.52 + (platform.y / data.world.height) * radius * 0.92;
    ctx.strokeStyle = platform.height >= 100 ? "rgba(22, 38, 44, 0.76)" : "rgba(244, 249, 252, 0.32)";
    ctx.lineWidth = platform.height >= 100 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.stroke();
  });

  const destination = data.extractionGate || (data.routeExits || [])[0];
  if (destination) {
    const gateX = centerX - radius * 0.82 + (destination.x / data.world.width) * radius * 1.64;
    const gateY = centerY - radius * 0.52 + (destination.y / data.world.height) * radius * 0.92;
    ctx.fillStyle = data.extractionGate ? theme.accent : theme.accentSecondary;
    ctx.beginPath();
    ctx.moveTo(gateX, gateY - 4);
    ctx.lineTo(gateX + 4, gateY);
    ctx.lineTo(gateX, gateY + 4);
    ctx.lineTo(gateX - 4, gateY);
    ctx.closePath();
    ctx.fill();
  }

  const playerX = centerX - radius * 0.82 + (run.player.x / data.world.width) * radius * 1.64;
  const playerY = centerY - radius * 0.52 + (run.player.y / data.world.height) * radius * 0.92;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(playerX + run.player.facing * 5, playerY);
  ctx.lineTo(playerX - run.player.facing * 3, playerY - 3);
  ctx.lineTo(playerX - run.player.facing * 1, playerY);
  ctx.lineTo(playerX - run.player.facing * 3, playerY + 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawObjectiveCardV3(ctx, state, data, theme, layout) {
  const lines = getObjectiveLinesV3(state, data);
  lines.forEach((line, index) => {
    const y = layout.objective.y + index * layout.objective.gap;
    ctx.strokeStyle = index === 0 ? theme.accent : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(layout.objective.x - 24, y - 6);
    ctx.lineTo(layout.objective.x - 12, y - 6);
    ctx.stroke();
    ctx.fillStyle = index === 0 ? theme.textMain : theme.textDim;
    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillText(line, layout.objective.x, y);
  });
}

function drawStatusBarsV3(ctx, run, data, theme, layout) {
  const shotValue = getRecoilShotUiState(run, data);
  const focusValue = clamp((run.focus ?? run.focusMax ?? 100) / Math.max(1, run.focusMax ?? 100), 0, 1);
  const bars = [
    { label: "HP", value: run.hp / data.player.maxHp, color: "#fbfefe" },
    { label: "BAT", value: run.battery / data.player.maxBattery, color: theme.accentSecondary },
    { label: "FOCUS", value: focusValue, color: run.focusActive ? "#87e1ff" : "#729cff" },
    { label: "SHOT", value: shotValue, color: run.player.recoilFocusActive ? "#e7f47e" : theme.accent },
  ];

  drawBeveledPanel(ctx, theme, layout.status.x - 18, layout.status.y - 20, layout.status.width + 118, 96, {
    cut: 14,
    fill: "rgba(8, 12, 18, 0.34)",
    stroke: "rgba(255,255,255,0.1)",
    innerLines: false,
  });

  bars.forEach((bar, index) => {
    const x = layout.status.x;
    const y = layout.status.y + index * layout.status.gap;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, layout.status.width, 8);
    ctx.fillStyle = bar.color;
    ctx.fillRect(x, y, layout.status.width * Math.max(0, Math.min(1, bar.value)), 8);
    ctx.fillStyle = theme.textDim;
    ctx.font = "800 9px 'Segoe UI', sans-serif";
    ctx.fillText(bar.label, x + layout.status.width + 12, y + 8);
  });
}

function getEmotionPortraitIndex(run, data) {
  const player = run.player;
  const hpRatio = clamp(run.hp / (data.player.maxHp || 100), 0, 1);

  if (player.invulnTimer > 0) {
    return 6;
  }
  if (hpRatio <= 0.24) {
    return 6;
  }
  if (hpRatio <= 0.5) {
    return 4;
  }
  if (hpRatio <= 0.75) {
    return 1;
  }
  return 0;
}

function getCharacterHudStatus(run) {
  const player = run.player;
  const hpRatio = run.hp / 100;

  if (player.invulnTimer > 0 || hpRatio <= 0.22) {
    return { label: "LOW HP", color: "#ff9fb4" };
  }
  if (player.recoilShotActive || player.recoilSpinTimer > 0) {
    return { label: "RECOIL", color: "#87e1ff" };
  }
  if (player.recoilFocusActive || (player.recoilFocusBlend ?? 0) > 0.18) {
    return { label: "FOCUS", color: "#87e1ff" };
  }
  if (player.hoverActive && !player.onGround) {
    return { label: "HOVER", color: "#93eaff" };
  }
  if (player.movementState === MOVEMENT_STATES.SLIDE) {
    return { label: "SLIDE", color: "#e7f47e" };
  }
  if (player.movementState === MOVEMENT_STATES.DASH || player.sprintActive) {
    return { label: "SPEED", color: "#e7f47e" };
  }
  if (player.recoilShotCooldownTimer > 0) {
    return { label: "RELOAD", color: "#d5e7ef" };
  }
  return { label: "READY", color: "#f5f8fb" };
}

function drawMeterBar(ctx, theme, x, y, width, height, value, color, label) {
  const safeValue = Math.max(0, Math.min(1, value));
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * safeValue, height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = theme.textDim;
  ctx.font = "700 10px 'Segoe UI', sans-serif";
  ctx.fillText(label, x, y - 6);
}

function drawEmotionSheetPortrait(ctx, data, emotionIndex, x, y, size) {
  const assetKey = data.ui?.emotionPortraitSheetAssetKey;
  const src = data.art?.[assetKey]?.src;
  const image = getImageAsset(src);
  const sheet = data.ui?.emotionPortraitSheet || {};
  const columns = Math.max(1, Math.floor(sheet.columns ?? 3));
  const rows = Math.max(1, Math.floor(sheet.rows ?? 3));

  ctx.save();
  beveledPath(ctx, x, y, size, size, 16);
  ctx.clip();

  const gradient = ctx.createLinearGradient(x, y, x, y + size);
  gradient.addColorStop(0, "rgba(192, 229, 250, 0.96)");
  gradient.addColorStop(1, "rgba(27, 48, 66, 0.96)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, size, size);

  if (image && image.complete && image.naturalWidth) {
    const index = Math.max(0, Math.min(columns * rows - 1, emotionIndex));
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cellWidth = image.naturalWidth / columns;
    const cellHeight = image.naturalHeight / rows;
    const inset = Math.max(2, Math.min(cellWidth, cellHeight) * 0.012);
    ctx.drawImage(
      image,
      column * cellWidth + inset,
      row * cellHeight + inset,
      cellWidth - inset * 2,
      cellHeight - inset * 2,
      x,
      y,
      size,
      size
    );
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
  ctx.lineWidth = 3;
  beveledPath(ctx, x, y, size, size, 16);
  ctx.stroke();

  ctx.strokeStyle = "rgba(135, 225, 255, 0.72)";
  ctx.lineWidth = 2;
  beveledPath(ctx, x - 5, y - 5, size + 10, size + 10, 18);
  ctx.stroke();
}

function drawPortraitHpVeil(ctx, hpRatio, x, y, size, hitFlash) {
  const safeHp = clamp(hpRatio, 0, 1);
  const missingHeight = size * (1 - safeHp);
  const energyHeight = size * safeHp;
  const danger = safeHp <= 0.3;
  const energyColor = danger ? "255, 116, 154" : "135, 225, 255";

  ctx.save();
  beveledPath(ctx, x, y, size, size, 16);
  ctx.clip();

  if (missingHeight > 0.5) {
    const damageGradient = ctx.createLinearGradient(x, y, x, y + missingHeight);
    damageGradient.addColorStop(0, "rgba(2, 8, 14, 0.68)");
    damageGradient.addColorStop(1, "rgba(2, 8, 14, 0.18)");
    ctx.fillStyle = damageGradient;
    ctx.fillRect(x, y, size, missingHeight);
  }

  if (energyHeight > 0.5) {
    const energyTop = y + size - energyHeight;
    const energyGradient = ctx.createLinearGradient(x, energyTop, x, y + size);
    energyGradient.addColorStop(0, `rgba(${energyColor}, 0.02)`);
    energyGradient.addColorStop(1, `rgba(${energyColor}, ${danger ? 0.28 : 0.22})`);
    ctx.fillStyle = energyGradient;
    ctx.fillRect(x, energyTop, size, energyHeight);

    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = `rgba(${energyColor}, ${danger ? 0.72 : 0.54})`;
    ctx.lineWidth = danger ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 8, energyTop);
    ctx.lineTo(x + size - 8, energyTop);
    ctx.stroke();
  }

  if (hitFlash > 0) {
    const flash = clamp(hitFlash / 0.85, 0, 1);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `rgba(255, 116, 154, ${0.08 + flash * 0.18})`;
    ctx.fillRect(x, y, size, size);
  }

  ctx.restore();

  ctx.strokeStyle = danger
    ? `rgba(255, 116, 154, ${0.62 + Math.sin(performance.now() * 0.012) * 0.14})`
    : "rgba(135, 225, 255, 0.72)";
  ctx.lineWidth = danger ? 3 : 2;
  beveledPath(ctx, x - 5, y - 5, size + 10, size + 10, 18);
  ctx.stroke();
}

function drawShotCores(ctx, run, data, x, y) {
  const maxCharges = Math.max(1, Math.floor(data.player.movement.recoilShotCharges ?? 1));
  const currentCharges = Math.max(0, Math.min(maxCharges, run.player.recoilShotCharges ?? maxCharges));
  const cooldownMax = Math.max(0.001, (data.player.movement.recoilShotCooldownMs ?? 180) / 1000);
  const cooldownProgress = run.player.recoilShotCooldownTimer > 0
    ? 1 - run.player.recoilShotCooldownTimer / cooldownMax
    : 1;

  for (let index = 0; index < maxCharges; index += 1) {
    const cx = x + index * 22;
    ctx.fillStyle = index < currentCharges ? "rgba(135, 225, 255, 0.95)" : "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.arc(cx, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (index >= currentCharges && index === 0 && cooldownProgress < 1) {
      ctx.strokeStyle = "rgba(135, 225, 255, 0.82)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, cooldownProgress));
      ctx.stroke();
    }
  }
}

function getSelectedArmHud(run, data) {
  const weapons = ensureWeaponLoadoutState(run, data);
  const side = weapons.selectedSide === "right" ? "right" : "left";
  const arm = weapons.arms[side];
  const stats = computeArmWeaponStats(data, arm);
  return {
    weapons,
    side,
    arm,
    stats,
    magazine: Math.max(0, Math.floor(arm.magazine ?? 0)),
    reserve: Math.max(0, Math.floor(weapons.reserveAmmo?.[stats.ammoType] ?? 0)),
  };
}

function drawArmSlotChip(ctx, theme, label, active, x, y) {
  drawBeveledPanel(ctx, theme, x, y, 64, 28, {
    cut: 7,
    fill: active ? "rgba(135, 225, 255, 0.24)" : "rgba(8, 12, 18, 0.46)",
    stroke: active ? "rgba(135,225,255,0.62)" : "rgba(255,255,255,0.14)",
    innerLines: false,
  });
  ctx.fillStyle = active ? "#f5f8fb" : theme.textDim;
  ctx.font = "800 12px 'Segoe UI', sans-serif";
  ctx.fillText(label, x + 16, y + 18);
}

function drawWeaponHudV3(ctx, run, data, theme) {
  const hud = getSelectedArmHud(run, data);
  const x = 24;
  const y = 132;
  const width = 314;
  const height = 108;
  const reloadRatio = (hud.arm.reloadTimer ?? 0) > 0
    ? 1 - clamp((hud.arm.reloadTimer ?? 0) / Math.max(0.001, hud.arm.reloadDuration || hud.stats.reloadDuration), 0, 1)
    : 1;

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 14,
    fill: "rgba(4, 10, 16, 0.58)",
    stroke: "rgba(255,255,255,0.2)",
    innerLines: false,
  });

  ctx.fillStyle = "rgba(245,248,251,0.66)";
  ctx.font = "800 10px 'Segoe UI', sans-serif";
  ctx.fillText("DUAL ARMS", x + 18, y + 18);

  drawArmSlotChip(ctx, theme, "1 LEFT", hud.side === "left", x + 16, y + 28);
  drawArmSlotChip(ctx, theme, "2 RIGHT", hud.side === "right", x + 88, y + 28);

  ctx.fillStyle = theme.textMain;
  ctx.font = "800 16px 'Segoe UI', sans-serif";
  ctx.fillText(hud.stats.label, x + 174, y + 48);

  ctx.fillStyle = hud.magazine > 0 ? "#f5f8fb" : "#ff9fb4";
  ctx.font = "900 28px 'Segoe UI', sans-serif";
  ctx.fillText(`${hud.magazine}/${hud.stats.magazineSize}`, x + 20, y + 82);

  ctx.fillStyle = theme.textDim;
  ctx.font = "800 12px 'Segoe UI', sans-serif";
  ctx.fillText(`${hud.stats.ammoType.toUpperCase()} ${hud.reserve}`, x + 104, y + 78);
  ctx.fillText((hud.arm.reloadTimer ?? 0) > 0 ? "RELOAD" : "R RELOAD", x + 104, y + 94);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x + 174, y + 64, 112, 7);
  ctx.fillStyle = (hud.arm.reloadTimer ?? 0) > 0 ? theme.accent : theme.accentSecondary;
  ctx.fillRect(x + 174, y + 64, 112 * reloadRatio, 7);

  const moduleLabels = (hud.arm.modules || []).slice(0, 3).map((moduleId) => data.weaponModules?.[moduleId]?.shortLabel || moduleId.slice(0, 3).toUpperCase());
  moduleLabels.forEach((label, index) => {
    const chipX = x + 174 + index * 40;
    drawBeveledPanel(ctx, theme, chipX, y + 78, 34, 20, {
      cut: 5,
      fill: "rgba(255,255,255,0.06)",
      stroke: "rgba(255,255,255,0.12)",
      innerLines: false,
    });
    ctx.fillStyle = theme.textDim;
    ctx.font = "800 9px 'Segoe UI', sans-serif";
    ctx.fillText(label, chipX + 5, y + 92);
  });
}

function drawCharacterStatusHudV3(ctx, state, data) {
  const run = state.run;
  const x = 24;
  const y = 22;
  const portraitSize = 94;
  const hpRatio = clamp(run.hp / (data.player.maxHp || 100), 0, 1);

  ctx.save();
  ctx.fillStyle = "rgba(4, 10, 16, 0.3)";
  beveledPath(ctx, x - 9, y - 9, portraitSize + 18, portraitSize + 18, 20);
  ctx.fill();
  ctx.restore();

  drawEmotionSheetPortrait(ctx, data, getEmotionPortraitIndex(run, data), x, y, portraitSize);
  drawPortraitHpVeil(ctx, hpRatio, x, y, portraitSize, run.player.invulnTimer ?? 0);
}


function drawActionClusterV3(ctx, theme, layout) {
  const labels = [
    { x: layout.actions.moveX, y: layout.actions.moveY, text: "A D" },
    { x: layout.actions.dashX, y: layout.actions.dashY, text: "Space" },
    { x: layout.actions.jumpX, y: layout.actions.jumpY, text: "W" },
    { x: layout.actions.crouchX, y: layout.actions.crouchY, text: "↓" },
    { x: layout.actions.useX, y: layout.actions.useY, text: "Z" },
  ];

  labels.forEach((label) => {
    ctx.fillStyle = theme.textDim;
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillText(label.text, label.x, label.y);
  });
}

function drawSceneToastV3(ctx, state, theme, layout) {
  drawBeveledPanel(ctx, theme, layout.toast.x - 18, layout.toast.y - 22, layout.toast.width + 32, 52, {
    cut: 12,
    fill: "rgba(8, 12, 18, 0.3)",
    stroke: "rgba(255,255,255,0.1)",
    innerLines: false,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 11px 'Segoe UI', sans-serif";
  ctx.fillText("탐사", layout.toast.x, layout.toast.y - 2);

  ctx.fillStyle = theme.textMain;
  ctx.font = "12px 'Segoe UI', sans-serif";
  wrapText(
    ctx,
    state.statusText,
    layout.toast.x,
    layout.toast.y + 16,
    layout.toast.width,
    16,
    theme.textMain,
    "12px 'Segoe UI', sans-serif",
  );
}

function drawStatusPortraitV3(ctx, data, layout) {
  drawPortraitAsset(ctx, data, layout.portrait.x, layout.portrait.y, layout.portrait.radius);
}

function getMapLevelSummary(data, run, levelId) {
  const summaries = data.levelSummaries || [];
  const summary = summaries.find((entry) => entry.id === levelId) || null;
  const currentLevelId = run?.currentLevelId || data.currentLevelId || data.defaultLevelId;
  if (levelId === currentLevelId) {
    return {
      ...summary,
      id: levelId,
      label: data.levelLabel || data.label || summary?.label || levelId,
      map: data.map || summary?.map,
      world: {
        width: data.world?.width ?? summary?.world?.width ?? 1280,
        height: data.world?.height ?? summary?.world?.height ?? 720,
        groundY: data.world?.groundY ?? summary?.world?.groundY ?? 0,
      },
      platforms: data.platforms || summary?.platforms || [],
      braceWalls: data.braceWalls || summary?.braceWalls || [],
      lootCrates: run?.lootCrates || summary?.lootCrates || [],
      humanoidEnemies: run?.humanoidEnemies || summary?.humanoidEnemies || [],
      routeExits: data.routeExits || summary?.routeExits || [],
      extractionGate: data.extractionGate ?? summary?.extractionGate ?? null,
    };
  }
  return summary || {
    id: levelId,
    label: levelId,
    map: null,
    routeExits: [],
    extractionGate: null,
  };
}

function getMapRooms(summary) {
  if (Array.isArray(summary?.map?.rooms) && summary.map.rooms.length) {
    return summary.map.rooms;
  }
  return [{
    id: "main",
    label: summary?.label || summary?.id || "Room",
    x: 0,
    y: 0,
    width: 180,
    height: 82,
  }];
}

function getLevelMapCenter(summary) {
  const rooms = getMapRooms(summary);
  const bounds = rooms.reduce((acc, room) => ({
    minX: Math.min(acc.minX, room.x),
    minY: Math.min(acc.minY, room.y),
    maxX: Math.max(acc.maxX, room.x + room.width),
    maxY: Math.max(acc.maxY, room.y + room.height),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
  return {
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: (bounds.minY + bounds.maxY) * 0.5,
  };
}

function getRunMapSummaries(data, run) {
  const discoveredIds = new Set(run.map?.discoveredLevelIds || [run.currentLevelId || data.currentLevelId]);
  discoveredIds.add(run.currentLevelId || data.currentLevelId || data.defaultLevelId);
  return [...discoveredIds].map((levelId) => getMapLevelSummary(data, run, levelId));
}

function getRunMapBounds(summaries) {
  return summaries.flatMap((summary) => getMapRooms(summary)).reduce((acc, room) => ({
    minX: Math.min(acc.minX, room.x),
    minY: Math.min(acc.minY, room.y),
    maxX: Math.max(acc.maxX, room.x + room.width),
    maxY: Math.max(acc.maxY, room.y + room.height),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}

function drawCurrentMapChip(ctx, state, data, theme) {
  const run = state.run;
  const currentLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId;
  const summary = getMapLevelSummary(data, run, currentLevelId);
  const x = 140;
  const y = 26;
  const width = 258;
  const height = 48;

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 12,
    fill: "rgba(4, 10, 16, 0.48)",
    stroke: "rgba(255,255,255,0.16)",
    innerLines: false,
  });

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 10px 'Segoe UI', sans-serif";
  ctx.fillText("MAP", x + 20, y + 18);
  ctx.fillStyle = theme.textMain;
  ctx.font = "700 15px 'Segoe UI', sans-serif";
  ctx.fillText(summary.label || currentLevelId, x + 20, y + 36);
  ctx.fillStyle = theme.textMute;
  ctx.font = "700 11px 'Segoe UI', sans-serif";
  ctx.fillText("M", x + width - 38, y + 29);
}

function drawHudPanelLabel(ctx, theme, label, x, y) {
  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "800 10px 'Segoe UI', sans-serif";
  ctx.fillText(label, x, y);
}

function drawMeterBarV4(ctx, theme, x, y, width, label, value, color, options = {}) {
  const safeValue = clamp(value, 0, 1);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x, y, width, 9);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * safeValue, 9);
  ctx.strokeStyle = options.active ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, 9);
  ctx.fillStyle = options.active ? "#f5f8fb" : theme.textDim;
  ctx.font = "800 10px 'Segoe UI', sans-serif";
  ctx.fillText(label, x, y - 6);
}

function drawOperatorHudV4(ctx, state, data, theme) {
  const run = state.run;
  const x = 24;
  const y = 22;
  const width = 386;
  const height = 142;
  const portraitSize = 84;
  const status = getCharacterHudStatus(run);
  const focusValue = clamp((run.focus ?? run.focusMax ?? 100) / Math.max(1, run.focusMax ?? 100), 0, 1);

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 14,
    fill: "rgba(4, 10, 16, 0.56)",
    stroke: "rgba(255,255,255,0.16)",
    innerLines: false,
  });

  drawEmotionSheetPortrait(ctx, data, getEmotionPortraitIndex(run, data), x + 18, y + 22, portraitSize);
  drawPortraitHpVeil(ctx, clamp(run.hp / (data.player.maxHp || 100), 0, 1), x + 18, y + 22, portraitSize, run.player.invulnTimer ?? 0);

  drawHudPanelLabel(ctx, theme, "TYPE-07A", x + 124, y + 28);
  ctx.fillStyle = status.color;
  ctx.font = "900 18px 'Segoe UI', sans-serif";
  ctx.fillText(status.label, x + 124, y + 52);

  drawMeterBarV4(ctx, theme, x + 124, y + 76, 224, "HP", run.hp / data.player.maxHp, "#fbfefe", {
    active: run.hp / data.player.maxHp <= 0.3,
  });
  drawMeterBarV4(ctx, theme, x + 124, y + 104, 224, "FOCUS", focusValue, run.focusActive ? "#87e1ff" : "#729cff", {
    active: run.focusActive,
  });
  drawMeterBarV4(ctx, theme, x + 124, y + 132, 152, "BAT", run.battery / data.player.maxBattery, theme.accentSecondary);
}

function drawWeaponHudV4(ctx, run, data, theme) {
  const hud = getSelectedArmHud(run, data);
  const x = 926;
  const y = 556;
  const width = 330;
  const height = 138;
  const reloadRatio = (hud.arm.reloadTimer ?? 0) > 0
    ? 1 - clamp((hud.arm.reloadTimer ?? 0) / Math.max(0.001, hud.arm.reloadDuration || hud.stats.reloadDuration), 0, 1)
    : 1;

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 14,
    fill: "rgba(4, 10, 16, 0.62)",
    stroke: "rgba(255,255,255,0.18)",
    innerLines: false,
  });

  drawHudPanelLabel(ctx, theme, "WEAPON", x + 20, y + 24);
  ctx.fillStyle = theme.textMain;
  ctx.font = "900 18px 'Segoe UI', sans-serif";
  ctx.fillText(hud.stats.label, x + 20, y + 50);

  ctx.fillStyle = hud.magazine > 0 ? "#f5f8fb" : "#ff9fb4";
  ctx.font = "900 34px 'Segoe UI', sans-serif";
  ctx.fillText(`${hud.magazine}/${hud.stats.magazineSize}`, x + 20, y + 92);

  ctx.fillStyle = theme.textDim;
  ctx.font = "800 12px 'Segoe UI', sans-serif";
  ctx.fillText(`${hud.stats.ammoType.toUpperCase()} RES ${hud.reserve}`, x + 122, y + 78);
  ctx.fillText((hud.arm.reloadTimer ?? 0) > 0 ? "RELOADING" : "R RELOAD", x + 122, y + 96);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x + 122, y + 104, 176, 8);
  ctx.fillStyle = (hud.arm.reloadTimer ?? 0) > 0 ? theme.accent : theme.accentSecondary;
  ctx.fillRect(x + 122, y + 104, 176 * reloadRatio, 8);

  drawArmSlotChip(ctx, theme, "1 LEFT", hud.side === "left", x + 194, y + 20);
  drawArmSlotChip(ctx, theme, "2 RIGHT", hud.side === "right", x + 262, y + 20);

  const moduleLabels = (hud.arm.modules || []).slice(0, 3).map((moduleId) => data.weaponModules?.[moduleId]?.shortLabel || moduleId.slice(0, 3).toUpperCase());
  moduleLabels.forEach((label, index) => {
    const chipX = x + 20 + index * 42;
    drawBeveledPanel(ctx, theme, chipX, y + 110, 34, 18, {
      cut: 5,
      fill: "rgba(255,255,255,0.06)",
      stroke: "rgba(255,255,255,0.12)",
      innerLines: false,
    });
    ctx.fillStyle = theme.textDim;
    ctx.font = "800 9px 'Segoe UI', sans-serif";
    ctx.fillText(label, chipX + 5, y + 123);
  });
}

function drawNavigationHudV4(ctx, state, data, theme) {
  const run = state.run;
  const x = 934;
  const y = 216;
  const width = 298;
  const height = 204;
  const layout = {
    minimap: { x: x + width - 66, y: y + 72, radius: 46 },
    objective: { x: x + 22, y: y + 122, gap: 22 },
  };
  const currentLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId;
  const summary = getMapLevelSummary(data, run, currentLevelId);

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 14,
    fill: "rgba(4, 10, 16, 0.52)",
    stroke: "rgba(255,255,255,0.16)",
    innerLines: false,
  });

  drawHudPanelLabel(ctx, theme, "ROUTE", x + 22, y + 24);
  ctx.fillStyle = theme.textMain;
  ctx.font = "900 16px 'Segoe UI', sans-serif";
  ctx.fillText(summary.label || currentLevelId, x + 22, y + 50);
  ctx.fillStyle = theme.textMute;
  ctx.font = "800 11px 'Segoe UI', sans-serif";
  ctx.fillText("M MAP", x + 22, y + 72);

  drawMiniMapV3(ctx, state, data, theme, layout);
  drawObjectiveCardV3(ctx, state, data, theme, layout);
}

function drawPromptHudV4(ctx, state, theme) {
  const run = state.run;
  const text = run.prompt || (run.noticeTimer > 0 ? run.message : "");
  if (!text) {
    return;
  }

  const x = 24;
  const y = 646;
  drawBeveledPanel(ctx, theme, x, y, 360, 42, {
    cut: 12,
    fill: "rgba(4, 10, 16, 0.46)",
    stroke: "rgba(255,255,255,0.12)",
    innerLines: false,
  });
  ctx.fillStyle = run.prompt ? theme.accent : theme.textMain;
  ctx.font = "800 13px 'Segoe UI', sans-serif";
  ctx.fillText(text, x + 18, y + 26);
}

function drawMeterBarV5(ctx, theme, x, y, width, label, value, color, options = {}) {
  const safeValue = clamp(value, 0, 1);
  const height = options.height ?? 5;
  ctx.fillStyle = options.active ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.06)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * safeValue, height);
  ctx.strokeStyle = options.active ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = options.active ? "#f5f8fb" : theme.textDim;
  ctx.font = "800 8px 'Segoe UI', sans-serif";
  ctx.fillText(label, x, y - 4);
  if (options.valueText) {
    ctx.fillStyle = theme.textMute;
    ctx.font = "800 8px 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(options.valueText, x + width, y - 4);
    ctx.textAlign = "left";
  }
}

function drawQuickSlotIconV5(ctx, icon, x, y, color, scale = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (icon === "med") {
    ctx.fillRect(-3, -11, 6, 22);
    ctx.fillRect(-11, -3, 22, 6);
  } else if (icon === "cell") {
    ctx.strokeRect(-7, -12, 14, 24);
    ctx.fillRect(-3, -16, 6, 3);
    ctx.fillRect(-4, -6, 8, 13);
  } else {
    ctx.beginPath();
    ctx.moveTo(-7, 11);
    ctx.lineTo(7, -11);
    ctx.lineTo(10, -7);
    ctx.lineTo(-4, 13);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-9, 13);
    ctx.lineTo(-2, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function getQuickSlotItemsV5(run) {
  const inventoryItems = Array.isArray(run.inventory?.items) ? run.inventory.items : [];
  const slots = inventoryItems.slice(0, 3).map((item, index) => ({
    key: String(index + 3),
    label: (item.name || item.id || "ITEM").slice(0, 3).toUpperCase(),
    count: Math.max(1, Math.floor(item.quantity ?? 1)),
    icon: item.type === "medicine" || /med|kit|heal/i.test(item.name || item.id || "") ? "med" : "cell",
    active: true,
  }));
  const fallback = [
    { key: "3", label: "MED", count: 0, icon: "med", active: false },
    { key: "4", label: "BAT", count: 0, icon: "cell", active: false },
    { key: "5", label: "TOOL", count: 0, icon: "tool", active: false },
  ];
  while (slots.length < 3) {
    slots.push(fallback[slots.length]);
  }
  return slots;
}

function drawQuickSlotsHudV5(ctx, run, theme, x, y) {
  drawHudPanelLabel(ctx, theme, "ITEM", x, y - 8);
  getQuickSlotItemsV5(run).forEach((slot, index) => {
    const slotX = x + index * 38;
    const slotY = y;
    drawBeveledPanel(ctx, theme, slotX, slotY, 32, 36, {
      cut: 7,
      fill: slot.active ? "rgba(5, 12, 18, 0.34)" : "rgba(5, 12, 18, 0.18)",
      stroke: slot.active ? "rgba(147,234,255,0.28)" : "rgba(255,255,255,0.1)",
      innerLines: false,
    });
    ctx.fillStyle = slot.active ? "#f5f8fb" : theme.textMute;
    ctx.font = "900 9px 'Segoe UI', sans-serif";
    ctx.fillText(slot.key, slotX + 5, slotY + 11);
    drawQuickSlotIconV5(ctx, slot.icon, slotX + 16, slotY + 21, slot.active ? theme.textMain : "rgba(245,248,251,0.42)", 0.72);
    ctx.fillStyle = slot.active ? theme.accentSecondary : theme.textMute;
    ctx.font = "900 9px 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(slot.count), slotX + 28, slotY + 31);
    ctx.textAlign = "left";
  });
}

function drawOperatorHudV5(ctx, state, data, theme) {
  const run = state.run;
  const x = 22;
  const y = 618;
  const portraitSize = 48;
  const hpRatio = clamp(run.hp / (data.player.maxHp || 100), 0, 1);
  const focusMax = Math.max(1, run.focusMax ?? 100);
  const focusValue = clamp((run.focus ?? focusMax) / focusMax, 0, 1);
  const batteryRatio = clamp(run.battery / data.player.maxBattery, 0, 1);

  drawBeveledPanel(ctx, theme, x, y, 376, 78, {
    cut: 14,
    fill: "rgba(3, 8, 13, 0.26)",
    stroke: "rgba(255,255,255,0.1)",
    innerLines: false,
  });

  drawEmotionSheetPortrait(ctx, data, getEmotionPortraitIndex(run, data), x + 14, y + 15, portraitSize);
  drawPortraitHpVeil(ctx, hpRatio, x + 14, y + 15, portraitSize, run.player.invulnTimer ?? 0);

  ctx.fillStyle = theme.textMute;
  ctx.font = "800 8px 'Segoe UI', sans-serif";
  ctx.fillText("ID: 00231", x + 76, y + 16);

  drawMeterBarV5(ctx, theme, x + 76, y + 32, 118, "HP", hpRatio, hpRatio <= 0.3 ? "#ff9fb4" : "#fbfefe", {
    active: hpRatio <= 0.3,
    valueText: `${Math.max(0, Math.round(run.hp))}/${data.player.maxHp || 100}`,
  });
  drawMeterBarV5(ctx, theme, x + 76, y + 52, 118, "FOCUS", focusValue, run.focusActive ? "#87e1ff" : "#68d8ec", {
    active: run.focusActive,
    valueText: `${Math.round(run.focus ?? focusMax)}/${focusMax}`,
  });
  drawMeterBarV5(ctx, theme, x + 76, y + 72, 92, "BAT", batteryRatio, theme.accentSecondary, {
    valueText: `${Math.round(run.battery)}/${data.player.maxBattery}`,
  });

  drawQuickSlotsHudV5(ctx, run, theme, x + 224, y + 34);
}

function drawWeaponSilhouetteV5(ctx, x, y, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-36, -6);
  ctx.lineTo(20, -10);
  ctx.lineTo(42, -5);
  ctx.lineTo(22, 2);
  ctx.lineTo(-18, 4);
  ctx.lineTo(-24, 18);
  ctx.lineTo(-34, 18);
  ctx.lineTo(-30, 2);
  ctx.lineTo(-42, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(6, 2, 18, 5);
  ctx.restore();
}

function drawArmSlotChipV5(ctx, theme, label, active, x, y) {
  drawBeveledPanel(ctx, theme, x, y, 34, 18, {
    cut: 6,
    fill: active ? "rgba(135, 225, 255, 0.18)" : "rgba(8, 12, 18, 0.28)",
    stroke: active ? "rgba(135,225,255,0.48)" : "rgba(255,255,255,0.1)",
    innerLines: false,
  });
  ctx.fillStyle = active ? "#f5f8fb" : theme.textDim;
  ctx.font = "900 10px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + 17, y + 13);
  ctx.textAlign = "left";
}

function drawWeaponHudV5(ctx, run, data, theme) {
  const hud = getSelectedArmHud(run, data);
  const x = 1042;
  const y = 626;
  const width = 216;
  const height = 70;
  const reloadRatio = (hud.arm.reloadTimer ?? 0) > 0
    ? 1 - clamp((hud.arm.reloadTimer ?? 0) / Math.max(0.001, hud.arm.reloadDuration || hud.stats.reloadDuration), 0, 1)
    : 1;

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 12,
    fill: "rgba(3, 8, 13, 0.34)",
    stroke: "rgba(255,255,255,0.11)",
    innerLines: false,
  });

  drawArmSlotChipV5(ctx, theme, "1", hud.side === "left", x + 12, y + 10);
  drawArmSlotChipV5(ctx, theme, "2", hud.side === "right", x + 52, y + 10);

  ctx.fillStyle = theme.textDim;
  ctx.font = "800 8px 'Segoe UI', sans-serif";
  ctx.fillText(hud.side === "left" ? "LEFT" : "RIGHT", x + 14, y + 40);

  ctx.fillStyle = theme.textMain;
  ctx.font = "900 12px 'Segoe UI', sans-serif";
  const weaponLabel = String(hud.stats.label || "WEAPON").toUpperCase();
  ctx.fillText(weaponLabel.length > 13 ? `${weaponLabel.slice(0, 12)}.` : weaponLabel, x + 88, y + 32);

  drawWeaponSilhouetteV5(ctx, x + 156, y + 22, 0.5, hud.magazine > 0 ? "rgba(245,248,251,0.8)" : "rgba(255,159,180,0.82)");

  ctx.fillStyle = hud.magazine > 0 ? "#f5f8fb" : "#ff9fb4";
  ctx.font = "900 22px 'Segoe UI', sans-serif";
  ctx.fillText(`${hud.magazine}`, x + 14, y + 62);
  ctx.fillStyle = theme.textMute;
  ctx.font = "900 11px 'Segoe UI', sans-serif";
  ctx.fillText(`/${hud.stats.magazineSize}`, x + 42, y + 61);

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "800 8px 'Segoe UI', sans-serif";
  ctx.fillText(`${hud.stats.ammoType.toUpperCase()} ${hud.reserve}`, x + 88, y + 50);
  ctx.fillStyle = theme.textDim;
  ctx.fillText((hud.arm.reloadTimer ?? 0) > 0 ? "RELOADING" : "R RELOAD", x + 88, y + 63);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x + 154, y + 58, 42, 4);
  ctx.fillStyle = (hud.arm.reloadTimer ?? 0) > 0 ? theme.accent : theme.accentSecondary;
  ctx.fillRect(x + 154, y + 58, 42 * reloadRatio, 4);
}

function drawCompassHudV5(ctx, state, data, theme) {
  const run = state.run;
  const currentLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId;
  const summary = getMapLevelSummary(data, run, currentLevelId);
  const x = 482;
  const y = 18;
  const width = 316;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 24);
  ctx.lineTo(x + width, y + 24);
  ctx.stroke();
  for (let index = 0; index <= 16; index += 1) {
    const tickX = x + (width / 16) * index;
    const tall = index % 4 === 0;
    ctx.beginPath();
    ctx.moveTo(tickX, y + (tall ? 16 : 20));
    ctx.lineTo(tickX, y + 24);
    ctx.stroke();
  }
  ctx.fillStyle = theme.textDim;
  ctx.font = "900 11px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("W", x + 52, y + 10);
  ctx.fillText("N", x + width * 0.5, y + 10);
  ctx.fillText("E", x + width - 52, y + 10);
  ctx.fillStyle = theme.accentSecondary;
  ctx.fillText(String(summary.label || currentLevelId).toUpperCase().slice(0, 16), x + width * 0.5, y + 46);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawPromptHudV5(ctx, state, theme) {
  const run = state.run;
  const text = run.prompt || (run.noticeTimer > 0 ? run.message : "");
  if (!text && !run.focusActive && !run.focusDepleted) {
    return;
  }
  const label = text || (run.focusDepleted ? "FOCUS RECOVERING" : "RMB FOCUS");
  const x = 544;
  const y = 662;
  drawBeveledPanel(ctx, theme, x, y, 192, 28, {
    cut: 9,
    fill: "rgba(3, 8, 13, 0.28)",
    stroke: run.focusActive ? "rgba(135,225,255,0.36)" : "rgba(255,255,255,0.12)",
    innerLines: false,
  });
  ctx.fillStyle = text ? theme.accent : (run.focusDepleted ? "#ff9fb4" : theme.accentSecondary);
  ctx.font = "900 10px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + 96, y + 18);
  ctx.textAlign = "left";
}

function drawMapRoom(ctx, theme, room, transform, stateStyle, label) {
  const x = transform.x(room.x);
  const y = transform.y(room.y);
  const width = room.width * transform.scale;
  const height = room.height * transform.scale;

  ctx.save();
  beveledPath(ctx, x, y, width, height, 10);
  ctx.fillStyle = stateStyle.fill;
  ctx.fill();
  ctx.strokeStyle = stateStyle.stroke;
  ctx.lineWidth = stateStyle.lineWidth;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = stateStyle.text;
  ctx.font = stateStyle.font;
  ctx.textAlign = "center";
  ctx.fillText(label || room.label || room.id, x + width * 0.5, y + height * 0.5 + 5);
  ctx.textAlign = "left";
}

function drawMapExtractionIcon(ctx, theme, room, transform, dimmed = false) {
  const x = transform.x(room.x + room.width) - 18;
  const y = transform.y(room.y) + 18;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = dimmed ? "rgba(231,244,126,0.34)" : "rgba(231,244,126,0.82)";
  ctx.fillRect(-5, -5, 10, 10);
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-7, -7, 14, 14);
  ctx.restore();
}

function createLevelLayoutTransform(data, x, y, width, height) {
  const worldWidth = Math.max(1, Number(data.world?.width ?? 1280));
  const worldHeight = Math.max(1, Number(data.world?.height ?? 720));
  const padding = 18;
  const scale = Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight);
  const drawWidth = worldWidth * scale;
  const drawHeight = worldHeight * scale;
  const offsetX = x + (width - drawWidth) * 0.5;
  const offsetY = y + (height - drawHeight) * 0.5;
  return {
    scale,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight,
    worldWidth,
    worldHeight,
    x: (value) => offsetX + value * scale,
    y: (value) => offsetY + value * scale,
    w: (value) => value * scale,
    h: (value) => value * scale,
  };
}

function drawLevelLayoutRect(ctx, transform, rect, fill, stroke = null, lineWidth = 1) {
  const x = transform.x(rect.x);
  const y = transform.y(rect.y);
  const width = Math.max(1, transform.w(rect.width));
  const height = Math.max(1, transform.h(rect.height));
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, width, height);
  }
}

function getExploredMapCells(run, levelId) {
  const entries = run.map?.exploredCellsByLevel?.[levelId] || [];
  return new Set(entries);
}

function isRectExplored(rect, exploredCells) {
  if (!exploredCells.size) {
    return false;
  }
  const left = Math.floor(rect.x / MAP_EXPLORE_CELL_SIZE);
  const right = Math.floor((rect.x + rect.width) / MAP_EXPLORE_CELL_SIZE);
  const top = Math.floor(rect.y / MAP_EXPLORE_CELL_SIZE);
  const bottom = Math.floor((rect.y + rect.height) / MAP_EXPLORE_CELL_SIZE);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (exploredCells.has(`${x},${y}`)) {
        return true;
      }
    }
  }
  return false;
}

function drawExploredMapCells(ctx, transform, exploredCells) {
  if (!exploredCells.size) {
    return;
  }
  ctx.save();
  exploredCells.forEach((key) => {
    const [cellX, cellY] = key.split(",").map(Number);
    if (!Number.isFinite(cellX) || !Number.isFinite(cellY)) {
      return;
    }
    const x = transform.x(cellX * MAP_EXPLORE_CELL_SIZE);
    const y = transform.y(cellY * MAP_EXPLORE_CELL_SIZE);
    const size = MAP_EXPLORE_CELL_SIZE * transform.scale;
    ctx.fillStyle = "rgba(226, 235, 232, 0.075)";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  });
  ctx.restore();
}

function getCurrentMapDestination(run, data, discoveredRouteIds, exploredCells) {
  const currentLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId;
  const playerCenter = {
    x: run.player.x + run.player.width * 0.5,
    y: run.player.y + run.player.height * 0.5,
  };
  const candidates = (data.routeExits || [])
    .filter((routeExit) => discoveredRouteIds.has(`${currentLevelId}:${routeExit.id}`))
    .map((routeExit) => ({
      kind: "route",
      label: routeExit.label || "ROUTE",
      targetLabel: routeExit.toLevelId || routeExit.label || "NEXT",
      x: routeExit.x + routeExit.width * 0.5,
      y: routeExit.y + routeExit.height * 0.5,
      rect: routeExit,
    }));
  if (data.extractionGate) {
    const gate = data.extractionGate;
    if (isRectExplored(gate, exploredCells)) {
      candidates.push({
        kind: "extract",
        label: "EXTRACT",
        targetLabel: "EXTRACT",
        x: gate.x + gate.width * 0.5,
        y: gate.y + gate.height * 0.5,
        rect: gate,
      });
    }
  }
  candidates.sort((left, right) => (
    Math.hypot(left.x - playerCenter.x, left.y - playerCenter.y)
    - Math.hypot(right.x - playerCenter.x, right.y - playerCenter.y)
  ));
  return candidates[0] || null;
}

function drawMapDirectionLine(ctx, theme, transform, run, destination) {
  if (!destination) {
    return;
  }
  const playerX = run.player.x + run.player.width * 0.5;
  const playerY = run.player.y + run.player.height * 0.5;
  const startX = transform.x(playerX);
  const startY = transform.y(playerY);
  const endX = transform.x(destination.x);
  const endY = transform.y(destination.y);
  const angle = Math.atan2(endY - startY, endX - startX);

  ctx.save();
  ctx.strokeStyle = destination.kind === "extract" ? "rgba(231,244,126,0.55)" : "rgba(147,234,255,0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.translate(endX, endY);
  ctx.rotate(angle);
  ctx.fillStyle = destination.kind === "extract" ? theme.accent : theme.accentSecondary;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-7, -6);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function getLevelRuntimeForMap(data, run, levelId) {
  const currentLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId;
  const summary = getMapLevelSummary(data, run, levelId);
  const savedState = run.levelStates?.[levelId] || null;
  if (levelId === currentLevelId) {
    return {
      ...summary,
      lootCrates: run.lootCrates || summary.lootCrates || [],
      humanoidEnemies: run.humanoidEnemies || summary.humanoidEnemies || [],
    };
  }
  return {
    ...summary,
    lootCrates: savedState?.lootCrates || summary.lootCrates || [],
    humanoidEnemies: savedState?.humanoidEnemies || summary.humanoidEnemies || [],
  };
}

function createRoomLevelTransform(levelData, roomScreen) {
  const worldWidth = Math.max(1, Number(levelData.world?.width ?? 1280));
  const worldHeight = Math.max(1, Number(levelData.world?.height ?? 720));
  const padding = Math.max(5, Math.min(roomScreen.width, roomScreen.height) * 0.06);
  const scale = Math.min((roomScreen.width - padding * 2) / worldWidth, (roomScreen.height - padding * 2) / worldHeight);
  const drawWidth = worldWidth * scale;
  const drawHeight = worldHeight * scale;
  const offsetX = roomScreen.x + (roomScreen.width - drawWidth) * 0.5;
  const offsetY = roomScreen.y + (roomScreen.height - drawHeight) * 0.5;
  return {
    scale,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight,
    worldWidth,
    worldHeight,
    x: (value) => offsetX + value * scale,
    y: (value) => offsetY + value * scale,
    w: (value) => value * scale,
    h: (value) => value * scale,
  };
}

function getRoomBounds(rooms) {
  return rooms.reduce((acc, room) => ({
    minX: Math.min(acc.minX, room.x),
    minY: Math.min(acc.minY, room.y),
    maxX: Math.max(acc.maxX, room.x + room.width),
    maxY: Math.max(acc.maxY, room.y + room.height),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}

function createWorldMapNodeFromSummary(summary) {
  const rooms = getMapRooms(summary);
  const bounds = getRoomBounds(rooms);
  return {
    id: summary?.id || "level",
    levelId: summary?.id || "level",
    x: Number.isFinite(bounds.minX) ? bounds.minX : 0,
    y: Number.isFinite(bounds.minY) ? bounds.minY : 0,
    width: Number.isFinite(bounds.maxX - bounds.minX) ? Math.max(72, bounds.maxX - bounds.minX) : 180,
    height: Number.isFinite(bounds.maxY - bounds.minY) ? Math.max(52, bounds.maxY - bounds.minY) : 82,
  };
}

function normalizeWorldMapNode(node, summary) {
  const fallback = createWorldMapNodeFromSummary(summary || { id: node?.levelId || node?.id || "level" });
  const levelId = node?.levelId || node?.id || fallback.levelId;
  return {
    id: node?.id || levelId,
    levelId,
    x: Number.isFinite(node?.x) ? node.x : fallback.x,
    y: Number.isFinite(node?.y) ? node.y : fallback.y,
    width: Number.isFinite(node?.width) ? Math.max(48, node.width) : fallback.width,
    height: Number.isFinite(node?.height) ? Math.max(42, node.height) : fallback.height,
  };
}

function getWorldMapNodes(data) {
  const summaries = data.levelSummaries || [];
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
  const nodes = [];
  const seen = new Set();
  (Array.isArray(data.worldMap?.nodes) ? data.worldMap.nodes : []).forEach((node) => {
    const normalized = normalizeWorldMapNode(node, summaryById.get(node?.levelId || node?.id));
    nodes.push(normalized);
    seen.add(normalized.levelId);
  });
  summaries.forEach((summary) => {
    if (seen.has(summary.id)) {
      return;
    }
    nodes.push(createWorldMapNodeFromSummary(summary));
    seen.add(summary.id);
  });
  return nodes;
}

function getWorldMapEdges(data) {
  const summaries = data.levelSummaries || [];
  const edges = [];
  const seen = new Set();
  const pushEdge = (edge) => {
    if (!edge?.fromLevelId || !edge?.toLevelId) {
      return;
    }
    const routeId = edge.routeId || edge.routeExitId || "";
    const id = edge.id || `${edge.fromLevelId}:${routeId || edge.toLevelId}`;
    const key = `${edge.fromLevelId}:${edge.toLevelId}:${routeId}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    edges.push({
      id,
      fromLevelId: edge.fromLevelId,
      toLevelId: edge.toLevelId,
      routeId,
    });
  };
  (Array.isArray(data.worldMap?.edges) ? data.worldMap.edges : []).forEach(pushEdge);
  summaries.forEach((summary) => {
    (summary.routeExits || []).forEach((routeExit) => {
      pushEdge({
        fromLevelId: summary.id,
        toLevelId: routeExit.toLevelId,
        routeId: routeExit.id,
      });
    });
  });
  return edges;
}

function getFullMapNodeBounds(nodes) {
  return nodes.reduce((acc, node) => ({
    minX: Math.min(acc.minX, node.x),
    minY: Math.min(acc.minY, node.y),
    maxX: Math.max(acc.maxX, node.x + node.width),
    maxY: Math.max(acc.maxY, node.y + node.height),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
}

function createFullMapTransform(bounds, x, y, width, height, overlay = {}) {
  const safeWidth = Math.max(1, bounds.maxX - bounds.minX);
  const safeHeight = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = clamp(Number(overlay.zoom ?? 1), 0.55, 3.25);
  const baseScale = Math.min(width / (safeWidth + 96), height / (safeHeight + 96));
  const scale = baseScale * zoom;
  const panX = Number.isFinite(overlay.panX) ? overlay.panX : 0;
  const panY = Number.isFinite(overlay.panY) ? overlay.panY : 0;
  const offsetX = x + width * 0.5 + panX - (bounds.minX + safeWidth * 0.5) * scale;
  const offsetY = y + height * 0.5 + panY - (bounds.minY + safeHeight * 0.5) * scale;
  return {
    scale,
    zoom,
    x: (value) => offsetX + value * scale,
    y: (value) => offsetY + value * scale,
    w: (value) => value * scale,
    h: (value) => value * scale,
  };
}

function getWorldMapNodeScreenRect(node, fullTransform) {
  return {
    x: fullTransform.x(node.x),
    y: fullTransform.y(node.y),
    width: fullTransform.w(node.width),
    height: fullTransform.h(node.height),
  };
}

function getPrimaryRoomScreenRect(summary, fullTransform) {
  const node = createWorldMapNodeFromSummary(summary);
  return {
    room: getMapRooms(summary)[0],
    ...getWorldMapNodeScreenRect(node, fullTransform),
  };
}

function drawLevelContentInsideRoom(ctx, theme, levelData, run, levelId, roomScreen, options = {}) {
  const currentLevelId = run.currentLevelId || levelData.id;
  const current = levelId === currentLevelId;
  const exploredCells = getExploredMapCells(run, levelId);
  const transform = createRoomLevelTransform(levelData, roomScreen);

  drawBeveledPanel(ctx, theme, roomScreen.x, roomScreen.y, roomScreen.width, roomScreen.height, {
    cut: Math.max(8, Math.min(roomScreen.width, roomScreen.height) * 0.07),
    fill: current ? "rgba(7, 16, 22, 0.9)" : "rgba(7, 12, 17, 0.72)",
    stroke: current ? "rgba(147,234,255,0.84)" : "rgba(255,255,255,0.18)",
    innerLines: false,
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(roomScreen.x + 5, roomScreen.y + 5, roomScreen.width - 10, roomScreen.height - 10);
  ctx.clip();
  ctx.fillStyle = "rgba(5, 9, 13, 0.92)";
  ctx.fillRect(transform.offsetX, transform.offsetY, transform.drawWidth, transform.drawHeight);
  drawExploredMapCells(ctx, transform, exploredCells);

  if (Number.isFinite(levelData.world?.groundY) && isRectExplored({
    x: 0,
    y: levelData.world.groundY - MAP_EXPLORE_CELL_SIZE * 0.5,
    width: levelData.world.width,
    height: MAP_EXPLORE_CELL_SIZE,
  }, exploredCells)) {
    ctx.strokeStyle = "rgba(231,244,126,0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(transform.offsetX, transform.y(levelData.world.groundY));
    ctx.lineTo(transform.offsetX + transform.drawWidth, transform.y(levelData.world.groundY));
    ctx.stroke();
  }

  (levelData.platforms || []).forEach((platform) => {
    if (!isRectExplored(platform, exploredCells)) {
      return;
    }
    const solid = platform.height >= 100;
    drawLevelLayoutRect(
      ctx,
      transform,
      platform,
      solid ? "rgba(92, 115, 124, 0.78)" : "rgba(220, 231, 236, 0.56)",
      solid ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.36)",
      1,
    );
  });

  (levelData.braceWalls || []).forEach((wall) => {
    if (!isRectExplored(wall, exploredCells)) {
      return;
    }
    drawLevelLayoutRect(ctx, transform, wall, "rgba(147,234,255,0.18)", "rgba(147,234,255,0.5)", 1);
  });

  (levelData.routeExits || []).forEach((routeExit) => {
    const routeKey = `${levelId}:${routeExit.id}`;
    const known = options.discoveredRouteIds?.has(routeKey);
    const explored = isRectExplored(routeExit, exploredCells);
    if (!known && !explored) {
      return;
    }
    const targetKnown = known && run.map?.visitedLevelIds?.includes(routeExit.toLevelId);
    drawLevelLayoutMarker(
      ctx,
      theme,
      transform,
      routeExit.x + routeExit.width * 0.5,
      routeExit.y + routeExit.height * 0.5,
      targetKnown ? routeExit.toLevelId : "ROUTE",
      known ? "rgba(147,234,255,0.86)" : "rgba(231,244,126,0.6)",
      {
        fill: "rgba(5, 10, 15, 0.82)",
        textColor: known ? theme.accentSecondary : theme.accent,
      },
    );
  });

  if (levelData.extractionGate && isRectExplored(levelData.extractionGate, exploredCells)) {
    const gate = levelData.extractionGate;
    drawLevelLayoutMarker(ctx, theme, transform, gate.x + gate.width * 0.5, gate.y + gate.height * 0.5, "EXTRACT", "rgba(231,244,126,0.9)", {
      fill: "rgba(28, 31, 12, 0.82)",
      textColor: theme.accent,
    });
  }

  if (current) {
    const destination = getCurrentMapDestination(run, levelData, options.discoveredRouteIds || new Set(), exploredCells);
    drawMapDirectionLine(ctx, theme, transform, run, destination);
    const player = run.player;
    const markerX = transform.x(player.x + player.width * 0.5);
    const markerY = transform.y(player.y + player.height * 0.5);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(markerX + (player.facing || 1) * 8, markerY);
    ctx.lineTo(markerX - (player.facing || 1) * 5, markerY - 5);
    ctx.lineTo(markerX - (player.facing || 1) * 2, markerY);
    ctx.lineTo(markerX - (player.facing || 1) * 5, markerY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(147,234,255,0.95)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(transform.offsetX, transform.offsetY, transform.drawWidth, transform.drawHeight);
  ctx.restore();

  ctx.fillStyle = current ? theme.textMain : theme.textDim;
  ctx.font = current ? "700 13px 'Segoe UI', sans-serif" : "700 12px 'Segoe UI', sans-serif";
  ctx.fillText(levelData.label || levelId, roomScreen.x + 14, roomScreen.y + 22);
}

function isWorldMapEdgeKnown(edge, run, discoveredRouteIds, visitedIds) {
  if (visitedIds.has(edge.fromLevelId) && visitedIds.has(edge.toLevelId)) {
    return true;
  }
  return Boolean(edge.routeId && discoveredRouteIds.has(`${edge.fromLevelId}:${edge.routeId}`));
}

function isWorldMapNodeAdjacentToKnownRoute(node, edges, run, discoveredRouteIds, visitedIds) {
  return edges.some((edge) => (
    edge.toLevelId === node.levelId
    && visitedIds.has(edge.fromLevelId)
    && isWorldMapEdgeKnown(edge, run, discoveredRouteIds, visitedIds)
  ));
}

function drawWorldMapEdge(ctx, theme, edge, nodeByLevelId, transform, known) {
  const from = nodeByLevelId.get(edge.fromLevelId);
  const to = nodeByLevelId.get(edge.toLevelId);
  if (!from || !to) {
    return;
  }
  const fromRect = getWorldMapNodeScreenRect(from, transform);
  const toRect = getWorldMapNodeScreenRect(to, transform);
  ctx.save();
  ctx.strokeStyle = known ? "rgba(147,234,255,0.52)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = known ? 2.5 : 1.5;
  if (!known) {
    ctx.setLineDash([6, 9]);
  }
  ctx.beginPath();
  ctx.moveTo(fromRect.x + fromRect.width * 0.5, fromRect.y + fromRect.height * 0.5);
  ctx.lineTo(toRect.x + toRect.width * 0.5, toRect.y + toRect.height * 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawUnknownWorldMapNode(ctx, theme, node, transform, adjacentKnown = false) {
  const rect = getWorldMapNodeScreenRect(node, transform);
  ctx.save();
  beveledPath(ctx, rect.x, rect.y, rect.width, rect.height, Math.max(8, Math.min(rect.width, rect.height) * 0.08));
  ctx.fillStyle = adjacentKnown ? "rgba(12, 20, 25, 0.62)" : "rgba(9, 12, 16, 0.36)";
  ctx.fill();
  ctx.strokeStyle = adjacentKnown ? "rgba(147,234,255,0.34)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = adjacentKnown ? 1.5 : 1;
  ctx.setLineDash(adjacentKnown ? [7, 6] : [4, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.rect(rect.x + 6, rect.y + 6, rect.width - 12, rect.height - 12);
  ctx.clip();
  ctx.strokeStyle = adjacentKnown ? "rgba(147,234,255,0.08)" : "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let lineX = rect.x - rect.height; lineX < rect.x + rect.width + rect.height; lineX += 18) {
    ctx.beginPath();
    ctx.moveTo(lineX, rect.y + rect.height);
    ctx.lineTo(lineX + rect.height, rect.y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = adjacentKnown ? "rgba(239,245,251,0.42)" : "rgba(239,245,251,0.24)";
  ctx.font = "700 11px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(adjacentKnown ? "UNMAPPED ROUTE" : "UNMAPPED", rect.x + rect.width * 0.5, rect.y + rect.height * 0.5 + 4);
  ctx.textAlign = "left";
}

function drawFullRunLayoutMap(ctx, state, data, theme, x, y, width, height, discoveredRouteIds) {
  const run = state.run;
  const currentLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId;
  const visitedIds = new Set(run.map?.visitedLevelIds || [currentLevelId]);
  visitedIds.add(currentLevelId);
  const nodes = getWorldMapNodes(data);
  const edges = getWorldMapEdges(data);
  const nodeByLevelId = new Map(nodes.map((node) => [node.levelId, node]));
  const summaryById = new Map(nodes.map((node) => [node.levelId, getMapLevelSummary(data, run, node.levelId)]));
  const bounds = getFullMapNodeBounds(nodes);
  const transform = createFullMapTransform(bounds, x, y, width, height, run.mapOverlay || {});
  const showUnknownNodes = data.worldMap?.showUnknownNodes !== false;

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 16,
    fill: "rgba(5, 10, 15, 0.64)",
    stroke: "rgba(255,255,255,0.14)",
    innerLines: false,
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 10, y + 10, width - 20, height - 20);
  ctx.clip();

  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  for (let gx = x + 28; gx < x + width - 28; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, y + 16);
    ctx.lineTo(gx, y + height - 16);
    ctx.stroke();
  }
  for (let gy = y + 28; gy < y + height - 28; gy += 48) {
    ctx.beginPath();
    ctx.moveTo(x + 16, gy);
    ctx.lineTo(x + width - 16, gy);
    ctx.stroke();
  }

  edges.forEach((edge) => {
    drawWorldMapEdge(ctx, theme, edge, nodeByLevelId, transform, isWorldMapEdgeKnown(edge, run, discoveredRouteIds, visitedIds));
  });

  nodes.forEach((node) => {
    const visited = visitedIds.has(node.levelId);
    const adjacentKnown = isWorldMapNodeAdjacentToKnownRoute(node, edges, run, discoveredRouteIds, visitedIds);
    if (!visited) {
      if (showUnknownNodes || adjacentKnown) {
        drawUnknownWorldMapNode(ctx, theme, node, transform, adjacentKnown);
      }
      return;
    }
    const levelData = getLevelRuntimeForMap(data, run, node.levelId);
    const roomScreen = getWorldMapNodeScreenRect(node, transform);
    drawLevelContentInsideRoom(ctx, theme, levelData, run, node.levelId, roomScreen, { discoveredRouteIds });
  });

  ctx.restore();

  const exploredCount = Object.values(run.map?.exploredCellsByLevel || {}).reduce((total, cells) => (
    total + (Array.isArray(cells) ? cells.length : 0)
  ), 0);
  ctx.fillStyle = theme.textMute;
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillText(`world map / visited ${visitedIds.size}/${nodes.length} / zoom ${Math.round(transform.zoom * 100)}% / inked cells ${exploredCount}`, x + 22, y + 44);
}

function drawLevelLayoutMarker(ctx, theme, transform, x, y, label, color, options = {}) {
  const cx = transform.x(x);
  const cy = transform.y(y);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.strokeStyle = "rgba(255,255,255,0.68)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.restore();

  const labelX = cx + 14;
  const labelY = cy - 12;
  const text = String(label || "");
  if (!text) {
    return;
  }
  ctx.font = "700 10px 'Segoe UI', sans-serif";
  const chipW = Math.max(52, ctx.measureText(text).width + 22);
  drawBeveledPanel(ctx, theme, labelX, labelY - 13, chipW, 26, {
    cut: 8,
    fill: options.fill || "rgba(5, 10, 15, 0.76)",
    stroke: options.stroke || "rgba(255,255,255,0.18)",
    innerLines: false,
  });
  ctx.fillStyle = options.textColor || theme.textMain;
  ctx.fillText(text, labelX + 11, labelY + 4);
}

function drawCurrentLevelLayoutMap(ctx, state, data, theme, x, y, width, height, discoveredRouteIds) {
  const run = state.run;
  const currentLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId;
  const transform = createLevelLayoutTransform(data, x, y, width, height);
  const exploredCells = getExploredMapCells(run, currentLevelId);
  const totalCells = Math.max(
    1,
    Math.ceil(transform.worldWidth / MAP_EXPLORE_CELL_SIZE)
      * Math.ceil(transform.worldHeight / MAP_EXPLORE_CELL_SIZE),
  );
  const chartedPercent = Math.round(clamp(exploredCells.size / totalCells, 0, 1) * 100);
  const destination = getCurrentMapDestination(run, data, discoveredRouteIds, exploredCells);

  drawBeveledPanel(ctx, theme, x, y, width, height, {
    cut: 16,
    fill: "rgba(5, 10, 15, 0.64)",
    stroke: "rgba(255,255,255,0.14)",
    innerLines: false,
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 10, y + 10, width - 20, height - 20);
  ctx.clip();

  const skyGradient = ctx.createLinearGradient(0, transform.offsetY, 0, transform.offsetY + transform.drawHeight);
  skyGradient.addColorStop(0, "rgba(30, 49, 62, 0.72)");
  skyGradient.addColorStop(1, "rgba(8, 13, 18, 0.94)");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(transform.offsetX, transform.offsetY, transform.drawWidth, transform.drawHeight);
  drawExploredMapCells(ctx, transform, exploredCells);

  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  const majorGrid = 640;
  for (let gx = 0; gx <= transform.worldWidth; gx += majorGrid) {
    ctx.beginPath();
    ctx.moveTo(transform.x(gx), transform.offsetY);
    ctx.lineTo(transform.x(gx), transform.offsetY + transform.drawHeight);
    ctx.stroke();
  }
  for (let gy = 0; gy <= transform.worldHeight; gy += 320) {
    ctx.beginPath();
    ctx.moveTo(transform.offsetX, transform.y(gy));
    ctx.lineTo(transform.offsetX + transform.drawWidth, transform.y(gy));
    ctx.stroke();
  }

  if (Number.isFinite(data.world?.groundY)) {
    ctx.strokeStyle = "rgba(231,244,126,0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(transform.offsetX, transform.y(data.world.groundY));
    ctx.lineTo(transform.offsetX + transform.drawWidth, transform.y(data.world.groundY));
    ctx.stroke();
  }

  (data.platforms || []).forEach((platform) => {
    const solid = platform.height >= 100;
    const explored = isRectExplored(platform, exploredCells);
    drawLevelLayoutRect(
      ctx,
      transform,
      platform,
      solid
        ? (explored ? "rgba(94, 119, 128, 0.76)" : "rgba(72, 85, 92, 0.24)")
        : (explored ? "rgba(220, 231, 236, 0.54)" : "rgba(202, 220, 226, 0.14)"),
      solid
        ? (explored ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)")
        : (explored ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.1)"),
      solid ? 1 : 1.5,
    );
  });

  (data.braceWalls || []).forEach((wall) => {
    const explored = isRectExplored(wall, exploredCells);
    drawLevelLayoutRect(
      ctx,
      transform,
      wall,
      explored ? "rgba(147,234,255,0.18)" : "rgba(147,234,255,0.05)",
      explored ? "rgba(147,234,255,0.5)" : "rgba(147,234,255,0.16)",
      1.5,
    );
  });

  const cameraZoom = getRunCameraZoom(run, data);
  const cameraRect = {
    x: run.cameraX ?? 0,
    y: run.cameraY ?? 0,
    width: SCREEN_WIDTH / cameraZoom,
    height: SCREEN_HEIGHT / cameraZoom,
  };
  drawLevelLayoutRect(ctx, transform, cameraRect, "rgba(147,234,255,0.035)", "rgba(147,234,255,0.42)", 1.5);

  (run.lootCrates || []).forEach((crate) => {
    if (crate.searched) {
      return;
    }
    const cx = crate.x + crate.width * 0.5;
    const cy = crate.y + crate.height * 0.5;
    ctx.fillStyle = "rgba(246,233,138,0.64)";
    ctx.fillRect(transform.x(cx) - 2, transform.y(cy) - 2, 4, 4);
  });

  (run.humanoidEnemies || []).forEach((enemy) => {
    if (enemy.dead || enemy.state === "escaped" || enemy.state === "released") {
      return;
    }
    const cx = enemy.x + enemy.width * 0.5;
    const cy = enemy.y + enemy.height * 0.5;
    ctx.strokeStyle = enemy.state === "knockedDown" ? "rgba(231,244,126,0.72)" : "rgba(255,116,154,0.62)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(transform.x(cx), transform.y(cy), enemy.state === "knockedDown" ? 5 : 4, 0, Math.PI * 2);
    ctx.stroke();
  });

  (data.routeExits || []).forEach((routeExit) => {
    const routeKey = `${currentLevelId}:${routeExit.id}`;
    const known = discoveredRouteIds.has(routeKey);
    const explored = isRectExplored(routeExit, exploredCells);
    if (!known && !explored) {
      return;
    }
    const label = known
      ? `TO ${routeExit.toLevelId || "LEVEL"}`
      : "UNKNOWN ROUTE";
    drawLevelLayoutMarker(
      ctx,
      theme,
      transform,
      routeExit.x + routeExit.width * 0.5,
      routeExit.y + routeExit.height * 0.5,
      label,
      known ? "rgba(147,234,255,0.92)" : "rgba(231,244,126,0.62)",
      {
        fill: known ? "rgba(8, 24, 31, 0.82)" : "rgba(28, 31, 12, 0.76)",
        textColor: known ? theme.accentSecondary : theme.accent,
      },
    );
  });

  if (data.extractionGate) {
    const gate = data.extractionGate;
    drawLevelLayoutMarker(
      ctx,
      theme,
      transform,
      gate.x + gate.width * 0.5,
      gate.y + gate.height * 0.5,
      "EXTRACT",
      "rgba(231,244,126,0.92)",
      {
        fill: "rgba(28, 31, 12, 0.82)",
        textColor: theme.accent,
      },
    );
  }

  drawMapDirectionLine(ctx, theme, transform, run, destination);

  const player = run.player;
  const playerX = player.x + player.width * 0.5;
  const playerY = player.y + player.height * 0.5;
  const markerX = transform.x(playerX);
  const markerY = transform.y(playerY);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(markerX + (player.facing || 1) * 9, markerY);
  ctx.lineTo(markerX - (player.facing || 1) * 6, markerY - 6);
  ctx.lineTo(markerX - (player.facing || 1) * 3, markerY);
  ctx.lineTo(markerX - (player.facing || 1) * 6, markerY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(147,234,255,0.95)";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawBeveledPanel(ctx, theme, markerX + 14, markerY - 15, 46, 28, {
    cut: 8,
    fill: "rgba(5,10,15,0.78)",
    stroke: "rgba(147,234,255,0.42)",
    innerLines: false,
  });
  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 10px 'Segoe UI', sans-serif";
  ctx.fillText("YOU", markerX + 26, markerY + 3);

  ctx.strokeStyle = "rgba(255,255,255,0.26)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(transform.offsetX, transform.offsetY, transform.drawWidth, transform.drawHeight);
  ctx.restore();

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 13px 'Segoe UI', sans-serif";
  ctx.fillText(data.levelLabel || data.label || currentLevelId, x + 22, y + 26);
  ctx.fillStyle = theme.textMute;
  ctx.font = "11px 'Segoe UI', sans-serif";
  ctx.fillText(`survey map / inked ${chartedPercent}% / objective ${destination?.targetLabel || "-"}`, x + 22, y + 44);
}

function drawRunMapOverlay(ctx, state, data, theme) {
  const run = state.run;
  if (!run?.mapOverlay?.active) {
    return;
  }

  const currentLevelId = run.currentLevelId || data.currentLevelId || data.defaultLevelId;
  const discoveredRouteIds = new Set(run.map?.discoveredRouteIds || []);
  const panelX = 174;
  const panelY = 76;
  const panelW = 932;
  const panelH = 568;
  const layoutX = panelX + 44;
  const layoutY = panelY + 88;
  const layoutW = panelW - 88;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawBeveledPanel(ctx, theme, panelX, panelY, panelW, panelH, {
    cut: 22,
    fill: "rgba(5, 9, 14, 0.86)",
    stroke: "rgba(255,255,255,0.2)",
    glow: true,
    innerLines: true,
  });

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 28px 'Segoe UI', sans-serif";
  ctx.fillText("RUN MAP", panelX + 44, panelY + 58);
  ctx.fillStyle = theme.textMute;
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("Drag pan / Wheel zoom / M Esc close", panelX + panelW - 268, panelY + 56);

  drawFullRunLayoutMap(ctx, state, data, theme, layoutX, layoutY, layoutW, panelH - 166, discoveredRouteIds);

  const fullLegendY = panelY + panelH - 58;
  const fullLegend = [
    { color: "#ffffff", label: "you" },
    { color: "rgba(147,234,255,0.82)", label: "known route" },
    { color: "rgba(230,239,244,0.36)", label: "inked" },
    { color: "rgba(231,244,126,0.82)", label: "extract" },
  ];
  fullLegend.forEach((item, index) => {
    const legendX = panelX + 52 + index * 132;
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, fullLegendY - 10, 18, 10);
    ctx.fillStyle = theme.textMute;
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.fillText(item.label, legendX + 28, fullLegendY);
  });

  ctx.restore();
  return;

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let x = mapX; x <= mapX + mapW; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, mapY);
    ctx.lineTo(x, mapY + mapH);
    ctx.stroke();
  }
  for (let y = mapY; y <= mapY + mapH; y += 42) {
    ctx.beginPath();
    ctx.moveTo(mapX, y);
    ctx.lineTo(mapX + mapW, y);
    ctx.stroke();
  }

  for (const routeId of discoveredRouteIds) {
    const separator = routeId.indexOf(":");
    const sourceLevelId = separator >= 0 ? routeId.slice(0, separator) : currentLevelId;
    const sourceRouteId = separator >= 0 ? routeId.slice(separator + 1) : routeId;
    const sourceSummary = getMapLevelSummary(data, run, sourceLevelId);
    const routeExit = (sourceSummary.routeExits || []).find((exit) => exit.id === sourceRouteId);
    const targetSummary = routeExit?.toLevelId ? summaryById.get(routeExit.toLevelId) : null;
    if (!routeExit || !targetSummary) {
      continue;
    }
    const from = getLevelMapCenter(sourceSummary);
    const to = getLevelMapCenter(targetSummary);
    ctx.strokeStyle = "rgba(147, 234, 255, 0.42)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(transform.x(from.x), transform.y(from.y));
    ctx.lineTo(transform.x(to.x), transform.y(to.y));
    ctx.stroke();
  }

  summaries.forEach((summary) => {
    const visited = visitedIds.has(summary.id);
    const current = summary.id === currentLevelId;
    const style = {
      fill: visited ? "rgba(230, 239, 244, 0.18)" : "rgba(230, 239, 244, 0.055)",
      stroke: current
        ? "rgba(147, 234, 255, 0.92)"
        : visited
          ? "rgba(255,255,255,0.54)"
          : "rgba(255,255,255,0.2)",
      lineWidth: current ? 3 : 1.5,
      text: visited ? theme.textMain : "rgba(239,245,251,0.44)",
      font: visited ? "700 13px 'Segoe UI', sans-serif" : "700 13px 'Segoe UI', sans-serif",
    };
    const rooms = getMapRooms(summary);
    rooms.forEach((room, index) => {
      drawMapRoom(ctx, theme, room, transform, style, index === 0 ? summary.label : room.label);
    });
    if (summary.extractionGate) {
      drawMapExtractionIcon(ctx, theme, rooms[0], transform, !visited);
    }
    if (current) {
      const center = getLevelMapCenter(summary);
      const markerX = transform.x(center.x);
      const markerY = transform.y(center.y);
      ctx.fillStyle = theme.accentSecondary;
      ctx.beginPath();
      ctx.arc(markerX, markerY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  const legendY = panelY + panelH - 58;
  const legend = [
    { color: "#ffffff", label: "you" },
    { color: "rgba(147,234,255,0.82)", label: "route" },
    { color: "rgba(230,239,244,0.36)", label: "visited" },
    { color: "rgba(231,244,126,0.82)", label: "extract" },
  ];
  legend.forEach((item, index) => {
    const x = panelX + 52 + index * 118;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, legendY - 10, 18, 10);
    ctx.fillStyle = theme.textMute;
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.fillText(item.label, x + 28, legendY);
  });

  ctx.restore();
}

function drawHudV3(ctx, state, data) {
  if (state.scene !== SCENES.EXPEDITION || !state.run) {
    return;
  }
  const layout = getUiLayoutV3(data);
  drawCharacterStatusHudV3(ctx, state, data);
  const theme = getUiTheme(data);
  drawStatusBarsV3(ctx, state.run, data, theme, layout);
  drawWeaponHudV3(ctx, state.run, data, theme);
  drawCurrentMapChip(ctx, state, data, theme);
  drawRunMapOverlay(ctx, state, data, theme);
}

function drawHudV4(ctx, state, data) {
  if (state.scene !== SCENES.EXPEDITION || !state.run) {
    return;
  }

  const theme = getUiTheme(data);
  drawOperatorHudV4(ctx, state, data, theme);
  drawNavigationHudV4(ctx, state, data, theme);
  drawWeaponHudV4(ctx, state.run, data, theme);
  drawPromptHudV4(ctx, state, theme);
  drawRunMapOverlay(ctx, state, data, theme);
}

function drawHudV5(ctx, state, data) {
  if (state.scene !== SCENES.EXPEDITION || !state.run) {
    return;
  }

  const theme = getUiTheme(data);
  drawCompassHudV5(ctx, state, data, theme);
  drawOperatorHudV5(ctx, state, data, theme);
  drawWeaponHudV5(ctx, state.run, data, theme);
  drawPromptHudV5(ctx, state, theme);
  drawRunMapOverlay(ctx, state, data, theme);
}

function drawResultsSceneV3(ctx, state, data, isFailure = false) {
  const theme = getUiTheme(data);
  const layout = getUiLayoutV3(data);
  drawScenicBackdrop(ctx, theme, state.pulse * 0.6, 90);

  ctx.fillStyle = "rgba(7, 10, 16, 0.56)";
  ctx.fillRect(0, 0, 1280, 720);

  drawBeveledPanel(ctx, theme, layout.results.cardX, layout.results.cardY, layout.results.cardW, layout.results.cardH, {
    fill: isFailure ? "rgba(33, 16, 18, 0.8)" : "rgba(8, 14, 22, 0.8)",
    stroke: "rgba(255,255,255,0.14)",
    glow: true,
  });

  drawArtPanel(
    ctx,
    theme,
    data,
    "resultsPanel",
    layout.results.artX,
    layout.results.artY,
    layout.results.artW,
    layout.results.artH,
    {
      cut: 18,
      fill: "rgba(8, 14, 22, 0.2)",
      stroke: "rgba(255,255,255,0.16)",
      glow: false,
      alpha: 0.98,
      overlay: "rgba(8, 12, 18, 0.08)",
    },
  );

  const label = isFailure ? "실패" : "결과";
  const title = isMovementLab(data)
    ? (isFailure ? "실험 리셋" : "실험 종료")
    : (isFailure ? "런 실패" : "귀환 완료");

  ctx.fillStyle = theme.accentSecondary;
  ctx.font = "700 14px 'Segoe UI', sans-serif";
  ctx.fillText(label, 192, 154);

  ctx.fillStyle = theme.textMain;
  ctx.font = "700 48px 'Trebuchet MS', sans-serif";
  ctx.fillText(title, 190, 212);

  const chips = [];
  if (isMovementLab(data)) {
    chips.push({ label: "자재", value: String(state.resultSummary?.materials || 0) });
    chips.push({ label: "시간대", value: state.resultSummary?.timePhase === "night" ? "야간" : state.resultSummary?.timePhase === "dusk" ? "황혼" : "주간" });
    chips.push({ label: "상태", value: isFailure ? "다시 시작" : "검증 완료" });
  } else if (isFailure) {
    chips.push({ label: "손실", value: String(state.resultSummary?.lostMaterials || 0) });
    chips.push({ label: "원인", value: state.resultSummary?.reason === "sanity" ? "정신 붕괴" : "체력 소진" });
  } else {
    chips.push({ label: "자재", value: String(state.resultSummary?.materials || 0) });
    chips.push({ label: "신뢰", value: String(state.resultSummary?.trustDelta || 0) });
    chips.push({ label: "야간", value: state.resultSummary?.nightReached ? "도달" : "미도달" });
  }

  chips.forEach((chip, index) => {
    const x = 192 + index * 126;
    drawBeveledPanel(ctx, theme, x, 280, 110, 60, {
      cut: 12,
      fill: "rgba(8, 12, 18, 0.34)",
      stroke: "rgba(255,255,255,0.12)",
      innerLines: false,
    });
    ctx.fillStyle = theme.textMute;
    ctx.font = "11px 'Segoe UI', sans-serif";
    ctx.fillText(chip.label, x + 14, 302);
    ctx.fillStyle = theme.textMain;
    ctx.font = "700 18px 'Segoe UI', sans-serif";
    ctx.fillText(chip.value, x + 14, 326);
  });

  const detailLines = isMovementLab(data)
    ? [
      isFailure ? "이동 실험이 초기화되었다." : "이번 세션의 이동 감각을 정리한다.",
      "필요하면 에디터에서 HUD와 스프라이트 비율을 다시 맞춘다.",
    ]
    : isFailure
      ? ["이번 런의 획득물은 모두 사라졌다.", "쉘터로 돌아가 다시 준비한다."]
      : [
        `경비형 ${formatOutcome(state.resultSummary?.outcomes?.guard)}`,
        `의식형 ${formatOutcome(state.resultSummary?.outcomes?.ritualist)}`,
      ];

  detailLines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? theme.textMain : theme.textDim;
    ctx.font = "17px 'Segoe UI', sans-serif";
    ctx.fillText(line, 192, 392 + index * 34);
  });

  ctx.fillStyle = theme.accent;
  ctx.font = "700 16px 'Segoe UI', sans-serif";
  ctx.fillText("C: 계속", 192, 560);
}

export function renderGame(dom, state, data) {
  const { ctx, canvas } = dom;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.scene === SCENES.TITLE) {
    drawTitleSceneV3(ctx, state, data);
  } else if (state.scene === SCENES.SHELTER) {
    drawShelterSceneV3(ctx, state, data);
  } else if (state.scene === SCENES.EXPEDITION && state.run) {
    renderExpedition(ctx, state, data);
  } else if (state.scene === SCENES.RESULTS) {
    drawResultsSceneV3(ctx, state, data, false);
  } else if (state.scene === SCENES.GAME_OVER) {
    drawResultsSceneV3(ctx, state, data, true);
  }
}
