import { MOVEMENT_STATES, SCENES, hasUnlocked } from "./state.js";
import { clamp, formatOutcome } from "./utils.js";

const imageCache = new Map();
const SCREEN_WIDTH = 1280;
const SCREEN_HEIGHT = 720;

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

function getPlayerPose(player) {
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
  if (
    player.movementState === MOVEMENT_STATES.CROUCH ||
    player.movementState === MOVEMENT_STATES.CROUCH_WALK
  ) {
    return "crouch";
  }
  if (player.movementState === MOVEMENT_STATES.WALL_SLIDE) {
    return "wallSlide";
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
  } else if (pose === "crouch") {
    yLift = -6;
  }

  const imageAspect = image.naturalWidth / image.naturalHeight;
  const drawHeight = Math.max(1, player.height * poseConfig.heightRatio);
  const drawWidth = Math.max(1, drawHeight * imageAspect * poseConfig.widthRatio);

  const footX = player.x + player.width * 0.5;
  const footY = player.y + player.height + yLift;
  const anchorX = player.facing === -1 ? poseConfig.anchorX : 1 - poseConfig.anchorX;

  return {
    image,
    drawWidth,
    drawHeight,
    footX,
    footY,
    anchorX,
    footAnchorY: poseConfig.footAnchorY,
    rotation,
    scaleX,
    scaleY,
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
  ctx.rotate(frame.rotation * player.facing);
  ctx.scale(player.facing === -1 ? 1 : -1, 1);
  ctx.scale(frame.scaleX, frame.scaleY);

  if (glowColor && glowBlur > 0) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowBlur;
  }

  ctx.drawImage(
    frame.image,
    -frame.drawWidth * frame.anchorX,
    -frame.drawHeight * frame.footAnchorY,
    frame.drawWidth,
    frame.drawHeight
  );

  if (fillTint) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = fillTint;
    ctx.fillRect(
      -frame.drawWidth * frame.anchorX,
      -frame.drawHeight * frame.footAnchorY,
      frame.drawWidth,
      frame.drawHeight
    );
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
      : player.lightActive
        ? "rgba(231, 244, 126, 0.28)"
        : null,
    glowBlur: player.movementState === MOVEMENT_STATES.DASH ? 22 : player.lightActive ? 16 : 0,
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
  ctx.strokeRect(data.extractionGate.x, data.extractionGate.y, data.extractionGate.width, data.extractionGate.height);

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

  const gateX = centerX - radius * 0.82 + (data.extractionGate.x / data.world.width) * radius * 1.64;
  const gateY = centerY - radius * 0.52 + (data.extractionGate.y / data.world.height) * radius * 0.92;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(gateX, gateY - 5);
  ctx.lineTo(gateX + 5, gateY);
  ctx.lineTo(gateX, gateY + 5);
  ctx.lineTo(gateX - 5, gateY);
  ctx.closePath();
  ctx.fill();

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
  drawActionNode(ctx, theme, 118, 610, "move", "이동", "← →", true);
  drawActionNode(ctx, theme, 54, 550, "jump", "점프", "C");
  drawActionNode(ctx, theme, 186, 570, "dash", "대시", "X");
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

function renderExpedition(ctx, state, data) {
  const run = state.run;
  const theme = getUiTheme(data);
  const cameraZoom = getRunCameraZoom(run, data);

  drawScenicBackdrop(ctx, theme, state.pulse, run.cameraX);

  ctx.save();
  ctx.translate(-run.cameraX * cameraZoom, -run.cameraY * cameraZoom);
  ctx.scale(cameraZoom, cameraZoom);
  drawWorldMegastructures(ctx, run);
  drawGroundShine(ctx);
  drawTerrain(ctx, data);
  drawGate(ctx, data, theme);
  drawBraceWalls(ctx, data, theme);
  drawProps(ctx, data, state.pulse, theme);

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

  drawAfterimages(ctx, run, data);
  drawPlayer(ctx, run, data);
  drawAttackFx(ctx, run);
  drawParticles(ctx, run);
  drawDebugWorldOverlay(ctx, state, data);
  drawLiveEditWorldOverlay(ctx, state, data);
  drawWorldPrompt(ctx, run, theme);
  ctx.restore();

  drawDarknessOverlay(ctx, run, data);
  ctx.save();
  ctx.translate(-run.cameraX * cameraZoom, -run.cameraY * cameraZoom);
  ctx.scale(cameraZoom, cameraZoom);
  drawThreatSense(ctx, run, state);
  ctx.restore();

  drawHudV3(ctx, state, data);
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
  ctx.fillText("C: 시작", 84, 254);

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

  const gateX = centerX - radius * 0.82 + (data.extractionGate.x / data.world.width) * radius * 1.64;
  const gateY = centerY - radius * 0.52 + (data.extractionGate.y / data.world.height) * radius * 0.92;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(gateX, gateY - 4);
  ctx.lineTo(gateX + 4, gateY);
  ctx.lineTo(gateX, gateY + 4);
  ctx.lineTo(gateX - 4, gateY);
  ctx.closePath();
  ctx.fill();

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
    { x: 46, y: 648, text: "← →" },
    { x: 168, y: 649, text: "X" },
    { x: 44, y: 699, text: "C" },
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
  ctx.fillText("C: 시작", 84, 254);

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

  const gateX = centerX - radius * 0.82 + (data.extractionGate.x / data.world.width) * radius * 1.64;
  const gateY = centerY - radius * 0.52 + (data.extractionGate.y / data.world.height) * radius * 0.92;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(gateX, gateY - 4);
  ctx.lineTo(gateX + 4, gateY);
  ctx.lineTo(gateX, gateY + 4);
  ctx.lineTo(gateX - 4, gateY);
  ctx.closePath();
  ctx.fill();

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
  const dashState = getDashUiState(run, data);
  const bars = [
    { value: run.hp / data.player.maxHp, color: "#fbfefe" },
    { value: run.battery / data.player.maxBattery, color: theme.accentSecondary },
    { value: dashState.value, color: theme.accent },
  ];

  drawBeveledPanel(ctx, theme, layout.status.x - 18, layout.status.y - 20, layout.status.width + 118, 74, {
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
  });
}


function drawActionClusterV3(ctx, theme, layout) {
  const labels = [
    { x: layout.actions.moveX, y: layout.actions.moveY, text: "← →" },
    { x: layout.actions.dashX, y: layout.actions.dashY, text: "X" },
    { x: layout.actions.jumpX, y: layout.actions.jumpY, text: "C" },
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

function drawHudV3(ctx, state, data) {
  const theme = getUiTheme(data);
  if (state.scene !== SCENES.EXPEDITION || !state.run) {
    return;
  }

  const layout = getUiLayoutV3(data);
  drawStatusBarsV3(ctx, state.run, data, theme, layout);
  drawSceneToastV3(ctx, state, theme, layout);
  drawStatusPortraitV3(ctx, data, layout);
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
