export const SPRINT_TUNING_KEY = "rulebound-sprint-tuning-v2";

export const SPRINT_TUNING_FIELDS = [
  { key: "runSpeed", label: "Run Speed", min: 120, max: 900, step: 10 },
  { key: "sprintSpeed", label: "Sprint Speed", min: 180, max: 1400, step: 10 },
  { key: "dashDistance", label: "Dash Distance", min: 24, max: 240, step: 1 },
  { key: "maxDashCount", label: "Dash Count", min: 1, max: 6, step: 1 },
  { key: "sprintBuildMs", label: "Sprint Build", min: 0, max: 1800, step: 10 },
  { key: "sprintDecayMs", label: "Sprint Decay", min: 0, max: 1200, step: 10 },
  { key: "sprintJumpCarryMs", label: "Sprint Jump Carry", min: 0, max: 1200, step: 10 },
  { key: "sprintJumpMinSpeed", label: "Sprint Jump Min", min: 0, max: 1400, step: 10 },
  { key: "verticalMomentumDecayMs", label: "Momentum Decay", min: 120, max: 3000, step: 10 },
  { key: "verticalMomentumComboMs", label: "Momentum Combo", min: 120, max: 3000, step: 10 },
  { key: "verticalMomentumSpeedBoost", label: "Momentum Speed Boost", min: 0, max: 0.7, step: 0.01 },
  { key: "verticalMomentumStageSeconds", label: "MOM Stage Seconds", min: 0.25, max: 8, step: 0.05 },
  { key: "verticalMomentumStageSpeedBoost", label: "MOM Stage Max Speed", min: 0, max: 0.35, step: 0.01 },
  { key: "verticalMomentumSpeedBuild", label: "Momentum Speed Build", min: 0, max: 1.2, step: 0.01 },
  { key: "verticalMomentumJumpBoost", label: "Momentum Jump Boost", min: 0, max: 0.5, step: 0.01 },
  { key: "verticalMomentumWallBoost", label: "Momentum Wall Boost", min: 0, max: 0.7, step: 0.01 },
  { key: "verticalMomentumRecoilBoost", label: "Momentum Recoil Boost", min: 0, max: 0.6, step: 0.01 },
  { key: "slideMinSpeed", label: "Slide Min Speed", min: 0, max: 1400, step: 10 },
  { key: "slideDurationMs", label: "Slide Duration", min: 80, max: 1600, step: 10 },
  { key: "slideFriction", label: "Slide Friction", min: 0, max: 2400, step: 10 },
  { key: "slideSpeedMultiplier", label: "Slide Speed Mult", min: 0.5, max: 2.5, step: 0.01 },
  { key: "slideJumpCarryMs", label: "Slide Jump Carry", min: 0, max: 1600, step: 10 },
  { key: "slideJumpMinSpeed", label: "Slide Jump Min", min: 0, max: 2200, step: 10 },
  { key: "slideJumpSpeedMultiplier", label: "Slide Jump Mult", min: 0.5, max: 3, step: 0.01 },
  { key: "braceDetectPaddingX", label: "Brace Detect X", min: 0, max: 96, step: 1 },
  { key: "braceDetectPaddingY", label: "Brace Detect Y", min: 0, max: 96, step: 1 },
  { key: "braceHoldStartSpeed", label: "Brace Start Speed", min: 0, max: 300, step: 1 },
  { key: "braceHoldMaxDurationMs", label: "Brace Hold Limit", min: 100, max: 300, step: 10 },
  { key: "braceHoldAccel", label: "Brace Fall Accel", min: 0, max: 1200, step: 10 },
  { key: "braceHoldFallSpeed", label: "Brace Max Fall", min: 0, max: 600, step: 1 },
  { key: "braceHoldMoveMultiplier", label: "Brace Move Mult", min: 0, max: 1.5, step: 0.01 },
  { key: "groundAccelerationSeconds", label: "Ground Accel Seconds", min: 0.1, max: 2.5, step: 0.05 },
  { key: "groundDecelerationSeconds", label: "Ground Decel Seconds", min: 0.05, max: 0.4, step: 0.01 },
  { key: "groundTurnSeconds", label: "Ground Turn Seconds", min: 0.05, max: 0.4, step: 0.01 },
  { key: "groundReleaseFriction", label: "Ground Release Friction", min: 0, max: 3600, step: 10 },
  { key: "groundOverspeedDrag", label: "Ground Overspeed Drag", min: 0, max: 3600, step: 10 },
  { key: "airAddForceMultiplier", label: "Air Add Force Mult", min: 0, max: 1.5, step: 0.01 },
  { key: "airReleaseFrictionMultiplier", label: "Air Release Friction", min: 0, max: 1, step: 0.01 },
  { key: "airOverspeedDragMultiplier", label: "Air Overspeed Drag", min: 0, max: 1.5, step: 0.01 },
  { key: "recoilShotCharges", label: "Recoil Shot Count", min: 1, max: 4, step: 1 },
  { key: "recoilShotForce", label: "Recoil Shot Force", min: 120, max: 6000, step: 10 },
  { key: "recoilShotMaxHorizontalSpeed", label: "Recoil Max X Speed", min: 120, max: 6000, step: 10 },
  { key: "recoilShotMaxUpSpeed", label: "Recoil Max Up Speed", min: 120, max: 6000, step: 10 },
  { key: "recoilShotMaxFallSpeed", label: "Recoil Max Fall Speed", min: 120, max: 6000, step: 10 },
  { key: "maxFallSpeed", label: "Max Fall Speed", min: 120, max: 3200, step: 10 },
  { key: "fallSoftExtraSpeed", label: "Fall Soft Extra", min: 0, max: 1200, step: 10 },
  { key: "fallSoftGravityMultiplier", label: "Fall Soft Gravity", min: 0, max: 0.4, step: 0.01 },
  { key: "recoilShotStackSpeedMultiplier", label: "Recoil Stack Cap", min: 1, max: 6, step: 0.1 },
  { key: "recoilShotFocusTimeScale", label: "Focus Time Scale", min: 0.05, max: 1, step: 0.01 },
  { key: "recoilSpinDurationMs", label: "Recoil Spin Time", min: 60, max: 520, step: 10 },
  { key: "recoilSpinLoopCount", label: "Recoil Spin Loops", min: 1, max: 4, step: 1 },
  { key: "airInertiaDecelMultiplier", label: "Air Inertia Decel", min: 0.05, max: 1, step: 0.01 },
  { key: "airTurnDecelMultiplier", label: "Air Turn Decel", min: 0.05, max: 1.5, step: 0.01 },
];

function clampNumber(value, min, max, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, next));
}

function normalizeFieldValue(value, field, baseMovement) {
  const clamped = clampNumber(value, field.min, field.max, baseMovement[field.key]);
  const stepText = String(field.step);
  const isIntegerStep = !stepText.includes(".");
  return isIntegerStep ? Math.round(clamped) : clamped;
}

export function extractSprintTuning(movement = {}) {
  return Object.fromEntries(
    SPRINT_TUNING_FIELDS.map(({ key }) => [key, movement[key]]),
  );
}

export function normalizeSprintTuning(raw, baseMovement) {
  const source = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(
    SPRINT_TUNING_FIELDS.map((field) => [
      field.key,
      normalizeFieldValue(source[field.key], field, baseMovement),
    ]),
  );
}

export function applySprintTuning(targetMovement, raw, baseMovement) {
  const normalized = normalizeSprintTuning(raw, baseMovement);
  SPRINT_TUNING_FIELDS.forEach(({ key }) => {
    targetMovement[key] = normalized[key];
  });
  return normalized;
}

export function loadSprintTuning(baseMovement) {
  if (typeof window === "undefined") {
    return extractSprintTuning(baseMovement);
  }

  try {
    const raw = window.localStorage.getItem(SPRINT_TUNING_KEY);
    if (!raw) {
      return extractSprintTuning(baseMovement);
    }
    return normalizeSprintTuning(JSON.parse(raw), baseMovement);
  } catch {
    return extractSprintTuning(baseMovement);
  }
}

export function saveSprintTuning(raw, baseMovement) {
  const normalized = normalizeSprintTuning(raw, baseMovement);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SPRINT_TUNING_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function clearSprintTuning() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SPRINT_TUNING_KEY);
  }
}
