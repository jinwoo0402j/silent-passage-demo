export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function approach(current, target, amount) {
  if (current < target) {
    return Math.min(current + amount, target);
  }
  return Math.max(current - amount, target);
}

export function lerp(current, target, alpha) {
  return current + (target - current) * alpha;
}

export function createRect(x, y, width, height) {
  return { x, y, width, height };
}

export function getCenter(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function uniquePush(list, value) {
  if (!list.includes(value)) {
    list.push(value);
  }
}

export function formatOutcome(outcome) {
  if (outcome === "released") {
    return "구원";
  }
  if (outcome === "harvested") {
    return "수확";
  }
  if (outcome === "failed") {
    return "실패";
  }
  return "회피";
}
