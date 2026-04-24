export const SPRINT_TUNING_KEY = "rulebound-sprint-tuning-v1";

export const SPRINT_TUNING_FIELDS = [
  { key: "runSpeed", label: "Run Speed", min: 120, max: 900, step: 10 },
  { key: "sprintSpeed", label: "Sprint Speed", min: 180, max: 1400, step: 10 },
  { key: "dashDistance", label: "Dash Distance", min: 24, max: 240, step: 1 },
  { key: "maxDashCount", label: "Dash Count", min: 1, max: 6, step: 1 },
  { key: "sprintBuildMs", label: "Sprint Build", min: 0, max: 1800, step: 10 },
  { key: "sprintDecayMs", label: "Sprint Decay", min: 0, max: 1200, step: 10 },
  { key: "sprintJumpCarryMs", label: "Sprint Jump Carry", min: 0, max: 1200, step: 10 },
  { key: "sprintJumpMinSpeed", label: "Sprint Jump Min", min: 0, max: 1400, step: 10 },
  { key: "braceDetectPaddingX", label: "Brace Detect X", min: 0, max: 96, step: 1 },
  { key: "braceDetectPaddingY", label: "Brace Detect Y", min: 0, max: 96, step: 1 },
  { key: "braceHoldStartSpeed", label: "Brace Start Speed", min: 0, max: 300, step: 1 },
  { key: "braceHoldAccel", label: "Brace Fall Accel", min: 0, max: 1200, step: 10 },
  { key: "braceHoldFallSpeed", label: "Brace Max Fall", min: 0, max: 600, step: 1 },
  { key: "braceHoldMoveMultiplier", label: "Brace Move Mult", min: 0, max: 1.5, step: 0.01 },
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
