import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VOICE_ROOT = path.join(ROOT, "assets", "voice", "shelter");
const SOURCE_LINES = path.join(VOICE_ROOT, "voice-lines.json");
const PRESET_ROOT = path.join(VOICE_ROOT, "presets");
const PRESET_INDEX = path.join(VOICE_ROOT, "voice-presets.json");
const SERVER_URL = "http://127.0.0.1:5000";
const STORAGE_KEY = "silent-passage-shelter-voice-preset-v1";

const BASE_CONFIG = {
  serverUrl: SERVER_URL,
  modelName: "jvnv-F2-jp",
  modelId: 2,
  speakerName: "jvnv-F2-jp",
  speakerId: 0,
  language: "JP",
  outputFormat: "wav",
  defaults: {
    style: "Neutral",
    styleWeight: 1,
    sdpRatio: 0.16,
    noise: 0.44,
    noiseW: 0.66,
    length: 1.16,
    autoSplit: true,
    splitInterval: 0.3,
    assistText: "",
    assistTextWeight: 0.3,
  },
  emotionStyles: {
    neutral: { style: "Neutral", styleWeight: 1, length: 1.16 },
    warm: { style: "Neutral", styleWeight: 1, length: 1.16 },
    anxious: { style: "Neutral", styleWeight: 0.95, length: 1.16 },
    tired: { style: "Sad", styleWeight: 0.72, length: 1.22 },
    hurt: { style: "Sad", styleWeight: 0.76, length: 1.2 },
    angry: { style: "Angry", styleWeight: 0.76, length: 1.12 },
  },
};

const PRESETS = [
  {
    id: "model-amitaro",
    label: "모델 원본: amitaro",
    description: "설치 모델 amitaro의 기본 음색. 튜닝을 거의 넣지 않은 비교용.",
    tags: ["model", "amitaro", "raw"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "amitaro",
      modelId: 0,
      speakerName: "あみたろ",
      defaults: {
        style: "Neutral",
        styleWeight: 1,
        sdpRatio: 0.2,
        noise: 0.6,
        noiseW: 0.8,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1 },
        anxious: { style: "Neutral", styleWeight: 1, length: 1 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "model-jvnv-f1",
    label: "모델 원본: jvnv-F1",
    description: "jvnv 여성 1번 모델. 성숙하고 낮은 후보.",
    tags: ["model", "female", "f1"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "jvnv-F1-jp",
      modelId: 1,
      speakerName: "jvnv-F1-jp",
      defaults: {
        style: "Neutral",
        styleWeight: 1,
        sdpRatio: 0.2,
        noise: 0.6,
        noiseW: 0.8,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1 },
        anxious: { style: "Neutral", styleWeight: 1, length: 1 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "model-jvnv-f2",
    label: "모델 원본: jvnv-F2",
    description: "jvnv 여성 2번 모델. 현재 튜닝들의 주 기반 음색.",
    tags: ["model", "female", "f2"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "jvnv-F2-jp",
      modelId: 2,
      speakerName: "jvnv-F2-jp",
      defaults: {
        style: "Neutral",
        styleWeight: 1,
        sdpRatio: 0.2,
        noise: 0.6,
        noiseW: 0.8,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1 },
        anxious: { style: "Neutral", styleWeight: 1, length: 1 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "model-koharune-ami",
    label: "모델 원본: 小春音アミ",
    description: "캐릭터성이 강한 모델. 어린 톤인지 확인하는 비교용.",
    tags: ["model", "character", "young"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "koharune-ami",
      modelId: 5,
      speakerName: "小春音アミ",
      defaults: {
        style: "ノーマル",
        styleWeight: 1,
        sdpRatio: 0.2,
        noise: 0.6,
        noiseW: 0.8,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "ノーマル", styleWeight: 1, length: 1 },
        anxious: { style: "ノーマル", styleWeight: 1, length: 1 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "new-amazingood",
    label: "새 모델: amazinGood",
    description: "새로 받은 girl-jp-extra의 age20 female amazinGood 원음색.",
    tags: ["new-model", "female", "amazinGood"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "girl-jp-extra",
      speakerName: "NotAnime-JP-age20female-amazinGood",
      defaults: {
        style: "amazinGood(normal)",
        styleWeight: 1,
        sdpRatio: 0.18,
        noise: 0.55,
        noiseW: 0.74,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "amazinGood(normal)", styleWeight: 1, length: 1 },
        anxious: { style: "amazinGood(down)", styleWeight: 0.9, length: 1.04 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "new-calmcloud",
    label: "새 모델: calmCloud",
    description: "새로 받은 girl-jp-extra의 age20 female calmCloud 원음색.",
    tags: ["new-model", "female", "calmCloud"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "girl-jp-extra",
      speakerName: "NotAnime-JP-age20female-calmCloud",
      defaults: {
        style: "calmCloud(normal)",
        styleWeight: 1,
        sdpRatio: 0.16,
        noise: 0.52,
        noiseW: 0.7,
        length: 1.04,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "calmCloud(normal)", styleWeight: 1, length: 1.04 },
        anxious: { style: "calmCloud(down)", styleWeight: 0.9, length: 1.08 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "new-coolcute",
    label: "새 모델: coolcute",
    description: "새로 받은 girl-jp-extra의 age20 female coolcute 원음색.",
    tags: ["new-model", "female", "coolcute"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "girl-jp-extra",
      speakerName: "NotAnime-JP-age20female-coolcute",
      defaults: {
        style: "coolcute(normal)",
        styleWeight: 1,
        sdpRatio: 0.16,
        noise: 0.52,
        noiseW: 0.7,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "coolcute(normal)", styleWeight: 1, length: 1 },
        anxious: { style: "coolcute(sad)", styleWeight: 0.85, length: 1.04 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "new-finecrystal",
    label: "새 모델: fineCrystal",
    description: "새로 받은 girl-jp-extra의 age20 female fineCrystal 원음색.",
    tags: ["new-model", "female", "fineCrystal"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "girl-jp-extra",
      speakerName: "NotAnime-JP-age20female-fineCrystal",
      defaults: {
        style: "fineCrystal(normal)",
        styleWeight: 1,
        sdpRatio: 0.16,
        noise: 0.5,
        noiseW: 0.68,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "fineCrystal(normal)", styleWeight: 1, length: 1 },
        anxious: { style: "fineCrystal(sad)", styleWeight: 0.85, length: 1.04 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "new-lightfire",
    label: "새 모델: lightFire",
    description: "새로 받은 girl-jp-extra의 age20 male lightFire 비교용.",
    tags: ["new-model", "male", "reference"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "girl-jp-extra",
      speakerName: "NotAnime-JP-age20male-lightFire",
      defaults: {
        style: "lightFire(normal)",
        styleWeight: 1,
        sdpRatio: 0.18,
        noise: 0.55,
        noiseW: 0.74,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "lightFire(normal)", styleWeight: 1, length: 1 },
        anxious: { style: "lightFire(question)", styleWeight: 0.9, length: 1.02 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうだな。",
      "ここが、俺たちの仮住まいなのか。",
    ],
  },
  {
    id: "rikka-cool",
    label: "새 모델: Rikka cool",
    description: "RikkaBotan CC BY-SA 모델의 cool 원음색. 차갑고 얇은 후보.",
    tags: ["new-model", "cc-by-sa", "cool"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "rikka-cool",
      speakerName: "Rikka_Botan_JP_COOL",
      defaults: {
        style: "Neutral",
        styleWeight: 1,
        sdpRatio: 0.16,
        noise: 0.48,
        noiseW: 0.68,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1 },
        anxious: { style: "Neutral", styleWeight: 1, length: 1.02 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "rikka-sweet",
    label: "새 모델: Rikka sweet",
    description: "RikkaBotan CC BY-SA 모델의 sweet 원음색. 밝고 귀여운 후보.",
    tags: ["new-model", "cc-by-sa", "sweet"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "rikka-sweet",
      speakerName: "Rikka_Botan_JP_SWEET",
      defaults: {
        style: "Neutral",
        styleWeight: 1,
        sdpRatio: 0.18,
        noise: 0.52,
        noiseW: 0.72,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1 },
        anxious: { style: "Neutral", styleWeight: 1, length: 1.02 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "rikka-asmr",
    label: "새 모델: Rikka asmr",
    description: "RikkaBotan CC BY-SA 모델의 ASMR 원음색. 속삭임/저자극 후보.",
    tags: ["new-model", "cc-by-sa", "asmr"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "rikka-asmr",
      speakerName: "Rikka_Botan_JP_ASMR",
      defaults: {
        style: "Neutral",
        styleWeight: 1,
        sdpRatio: 0.16,
        noise: 0.48,
        noiseW: 0.68,
        length: 1.04,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1.04 },
        anxious: { style: "Neutral", styleWeight: 1, length: 1.06 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。",
    ],
  },
  {
    id: "model-jvnv-m1",
    label: "모델 원본: jvnv-M1",
    description: "jvnv 남성 1번 모델. 참고 비교용.",
    tags: ["model", "male", "reference"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "jvnv-M1-jp",
      modelId: 3,
      speakerName: "jvnv-M1-jp",
      defaults: {
        style: "Neutral",
        styleWeight: 1,
        sdpRatio: 0.2,
        noise: 0.6,
        noiseW: 0.8,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1 },
        anxious: { style: "Neutral", styleWeight: 1, length: 1 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうだな。",
      "ここが、俺たちの仮住まいなのか。",
    ],
  },
  {
    id: "model-jvnv-m2",
    label: "모델 원본: jvnv-M2",
    description: "jvnv 남성 2번 모델. 참고 비교용.",
    tags: ["model", "male", "reference"],
    runtimePlayback: { playbackRate: 1, preservesPitch: true },
    config: {
      modelName: "jvnv-M2-jp",
      modelId: 4,
      speakerName: "jvnv-M2-jp",
      defaults: {
        style: "Neutral",
        styleWeight: 1,
        sdpRatio: 0.2,
        noise: 0.6,
        noiseW: 0.8,
        length: 1,
        assistText: "",
        assistTextWeight: 0,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1 },
        anxious: { style: "Neutral", styleWeight: 1, length: 1 },
      },
    },
    voiceText: [
      "ここ、思ったより使えそうだな。",
      "ここが、俺たちの仮住まいなのか。",
    ],
  },
  {
    id: "calm-bishoujo",
    label: "차분한 미소녀",
    description: "맑고 얇은 톤은 남기고 감정만 살짝 누른 기준점.",
    tags: ["clear", "soft", "baseline"],
    runtimePlayback: { playbackRate: 1.1, preservesPitch: false },
    config: {
      defaults: {
        styleWeight: 0.98,
        sdpRatio: 0.18,
        noise: 0.44,
        noiseW: 0.66,
        length: 1.18,
        assistText: "落ち着いて、澄んだ声で静かに話して。",
        assistTextWeight: 0.32,
      },
      emotionStyles: {
        warm: { style: "Happy", styleWeight: 1, length: 1.16, noise: 0.43, assistTextWeight: 0.36 },
        anxious: { style: "Surprise", styleWeight: 0.72, length: 1.16, sdpRatio: 0.18, noiseW: 0.68, assistTextWeight: 0.28 },
      },
    },
    voiceText: [
      "わあ……ここ、思ったよりちゃんとしてるじゃない。",
      "ねえ、お父さん。ここって私たちの仮住まいみたいなもの？ ……少し、好きかも。",
    ],
  },
  {
    id: "cool-beauty",
    label: "냉미녀",
    description: "감정선을 낮게 눌러 조용하고 차가운 인상.",
    tags: ["cool", "restrained", "low"],
    runtimePlayback: { playbackRate: 1.04, preservesPitch: false },
    config: {
      defaults: {
        styleWeight: 0.9,
        sdpRatio: 0.12,
        noise: 0.4,
        noiseW: 0.58,
        length: 1.24,
        assistText: "感情を抑えて、冷静で澄んだ声で静かに話して。",
        assistTextWeight: 0.28,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 0.92, length: 1.22, noise: 0.4, assistTextWeight: 0.26 },
        anxious: { style: "Neutral", styleWeight: 0.88, length: 1.22, sdpRatio: 0.12, noiseW: 0.6, assistTextWeight: 0.24 },
      },
    },
    voiceText: [
      "……ここ、思ったよりまともね。",
      "お父さん。ここが、私たちの仮住まい？ ……悪くないわ。",
    ],
  },
  {
    id: "proud-commanding",
    label: "단호한 도도",
    description: "낮게 웃지 않고 또렷하게 끊는, 자신감 있는 미녀 톤.",
    tags: ["firm", "proud", "beauty"],
    runtimePlayback: { playbackRate: 1.06, preservesPitch: false },
    config: {
      defaults: {
        styleWeight: 0.96,
        sdpRatio: 0.14,
        noise: 0.41,
        noiseW: 0.62,
        length: 1.16,
        assistText: "自信を持って、少し高慢に、冷静で美しい声で話して。",
        assistTextWeight: 0.36,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 1, length: 1.14, noise: 0.4, assistTextWeight: 0.34 },
        anxious: { style: "Neutral", styleWeight: 0.96, length: 1.14, sdpRatio: 0.14, noiseW: 0.62, assistTextWeight: 0.32 },
      },
    },
    voiceText: [
      "……想像よりは使えるわね。",
      "お父さん。ここを拠点にするのね。いいわ、私が確認する。",
    ],
  },
  {
    id: "elegant-beauty",
    label: "우아한 미녀",
    description: "차갑기보다 고급스럽고 정돈된 미녀 톤.",
    tags: ["elegant", "polished", "adult"],
    runtimePlayback: { playbackRate: 1.08, preservesPitch: false },
    config: {
      defaults: {
        styleWeight: 1,
        sdpRatio: 0.16,
        noise: 0.43,
        noiseW: 0.66,
        length: 1.16,
        assistText: "上品で落ち着いた、美しい声で静かに話して。",
        assistTextWeight: 0.4,
      },
      emotionStyles: {
        warm: { style: "Happy", styleWeight: 0.78, length: 1.14, noise: 0.42, assistTextWeight: 0.42 },
        anxious: { style: "Neutral", styleWeight: 0.92, length: 1.16, sdpRatio: 0.16, noiseW: 0.64, assistTextWeight: 0.34 },
      },
    },
    voiceText: [
      "……悪くないわ。想像より、整っている。",
      "お父さま。ここが仮の住まいなのね。……ええ、上出来よ。",
    ],
  },
  {
    id: "mature-cool",
    label: "성숙한 쿨",
    description: "조금 더 낮고 성숙한 후보. 미소녀보다 성인 미녀 쪽.",
    tags: ["mature", "low", "reserved"],
    runtimePlayback: { playbackRate: 1.04, preservesPitch: false },
    config: {
      modelName: "jvnv-F1-jp",
      modelId: 1,
      speakerName: "jvnv-F1-jp",
      defaults: {
        styleWeight: 0.92,
        sdpRatio: 0.12,
        noise: 0.4,
        noiseW: 0.58,
        length: 1.18,
        assistText: "低めで落ち着いた、冷静な美しい声で話して。",
        assistTextWeight: 0.3,
      },
      emotionStyles: {
        warm: { style: "Neutral", styleWeight: 0.94, length: 1.18, noise: 0.4, assistTextWeight: 0.28 },
        anxious: { style: "Neutral", styleWeight: 0.9, length: 1.18, sdpRatio: 0.12, noiseW: 0.58, assistTextWeight: 0.24 },
      },
    },
    voiceText: [
      "……ここ、思ったより使えそうね。",
      "お父さん。ここが、私たちの仮住まいなのね。……わかったわ。",
    ],
  },
];

function parseArgs(argv) {
  const args = { only: "", overwrite: false, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--only") {
      args.only = String(argv[index + 1] || "").trim();
      index += 1;
    } else if (arg === "--overwrite") {
      args.overwrite = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    }
  }
  return args;
}

function mergeDeep(base, override) {
  const result = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeDeep(base?.[key] || {}, value);
    } else {
      result[key] = value;
    }
  });
  return result;
}

function appendIfPresent(searchParams, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }
  searchParams.set(key, String(value));
}

function mergeVoiceParams(config, line) {
  return {
    ...(config.defaults || {}),
    ...((config.emotionStyles || {})[line.emotion] || {}),
  };
}

function buildVoiceUrl(config, line) {
  const base = new URL("/voice", config.serverUrl || SERVER_URL);
  const params = mergeVoiceParams(config, line);
  base.searchParams.set("text", line.voiceText || line.text);
  appendIfPresent(base.searchParams, "encoding", "utf-8");
  appendIfPresent(base.searchParams, "model_name", config.modelName);
  appendIfPresent(base.searchParams, "model_id", config.modelId);
  appendIfPresent(base.searchParams, "speaker_name", config.speakerName);
  appendIfPresent(base.searchParams, "speaker_id", config.speakerId);
  appendIfPresent(base.searchParams, "language", line.language || config.language);
  appendIfPresent(base.searchParams, "style", params.style);
  appendIfPresent(base.searchParams, "style_weight", params.styleWeight);
  appendIfPresent(base.searchParams, "sdp_ratio", params.sdpRatio);
  appendIfPresent(base.searchParams, "noise", params.noise);
  appendIfPresent(base.searchParams, "noisew", params.noiseW);
  appendIfPresent(base.searchParams, "length", params.length);
  appendIfPresent(base.searchParams, "auto_split", params.autoSplit);
  appendIfPresent(base.searchParams, "split_interval", params.splitInterval);
  appendIfPresent(base.searchParams, "assist_text", line.assistText || params.assistText);
  appendIfPresent(base.searchParams, "assist_text_weight", params.assistTextWeight);
  return base;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateLine(config, line, targetPath, options) {
  if (!options.overwrite && await exists(targetPath)) {
    console.log(`Skipped ${targetPath}`);
    return;
  }
  const url = buildVoiceUrl(config, line);
  if (options.dryRun) {
    console.log(`[dry-run] ${line.id} -> ${targetPath}`);
    return;
  }
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SBV2 failed for ${line.id}: HTTP ${response.status} ${detail.slice(0, 300)}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("audio")) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SBV2 returned non-audio for ${line.id}: ${contentType} ${detail.slice(0, 300)}`);
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
  console.log(`Wrote ${targetPath}`);
}

function makePresetLines(sourceLines, preset) {
  return sourceLines.slice(0, 2).map((line, index) => ({
    ...line,
    voiceText: preset.voiceText[index] || line.voiceText || line.text,
  }));
}

function makeManifest(source, preset, config, lines) {
  return {
    version: 1,
    presetId: preset.id,
    label: preset.label,
    description: preset.description,
    tags: preset.tags,
    scene: source.scene || "shelter",
    speaker: source.speaker || "type-07a",
    voice: source.voice || "type07a",
    format: source.format || "wav",
    generator: source.generator || "Style-Bert-VITS2",
    modelName: config.modelName,
    generatedAt: new Date().toISOString(),
    playbackRate: preset.runtimePlayback.playbackRate,
    preservesPitch: preset.runtimePlayback.preservesPitch,
    lines: lines.map((line) => ({
      id: line.id,
      emotion: line.emotion,
      topic: line.topic,
      text: line.text,
      voiceText: line.voiceText,
      src: `./assets/voice/shelter/presets/${preset.id}/${line.file.replaceAll("\\", "/")}`,
      tags: [line.emotion, line.topic].filter(Boolean),
    })),
  };
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source = JSON.parse(await fs.readFile(SOURCE_LINES, "utf8"));
  const sourceLines = Array.isArray(source.lines) ? source.lines : [];
  const selectedPresets = PRESETS.filter((preset) => !args.only || preset.id === args.only);
  if (!selectedPresets.length) {
    throw new Error(`No matching preset: ${args.only}`);
  }

  for (const preset of selectedPresets) {
    const presetDir = path.join(PRESET_ROOT, preset.id);
    const config = mergeDeep(BASE_CONFIG, {
      ...preset.config,
      runtimePlayback: preset.runtimePlayback,
    });
    const lines = makePresetLines(sourceLines, preset);
    const presetLineData = {
      version: source.version || 2,
      scene: source.scene || "shelter",
      speaker: source.speaker || "type-07a",
      voice: source.voice || "type07a",
      generator: source.generator || "Style-Bert-VITS2",
      format: source.format || "wav",
      generatedAt: new Date().toISOString(),
      lines,
    };

    await writeJson(path.join(presetDir, "sbv2.config.json"), config);
    await writeJson(path.join(presetDir, "voice-lines.json"), presetLineData);
    for (const line of lines) {
      await generateLine(config, line, path.join(presetDir, line.file), args);
    }
    await writeJson(path.join(presetDir, "manifest.json"), makeManifest(source, preset, config, lines));
  }

  const index = {
    version: 1,
    storageKey: STORAGE_KEY,
    defaultPreset: "cool-beauty",
    updatedAt: new Date().toISOString(),
    presets: PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      description: preset.description,
      tags: preset.tags,
      manifest: `./assets/voice/shelter/presets/${preset.id}/manifest.json`,
    })),
  };
  await writeJson(PRESET_INDEX, index);
  console.log(`Wrote ${PRESET_INDEX}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
