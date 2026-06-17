const LOCAL_AI_ENDPOINT_KEY = "silent-passage-local-ai-endpoint-v1";
const LOCAL_AI_ENABLED_KEY = "silent-passage-local-ai-enabled-v1";
const DEFAULT_LOCAL_AI_ENDPOINT = "http://127.0.0.1:4174/chat";
const REQUEST_TIMEOUT_MS = 45000;
const MAX_REPLY_CHARS = 110;

function getSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

export function isLocalAiEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  const params = getSearchParams();
  const mode = params.get("ai");
  if (mode === "local" || mode === "on") {
    return true;
  }
  if (mode === "off") {
    return false;
  }
  return window.localStorage?.getItem(LOCAL_AI_ENABLED_KEY) === "on";
}

function getLocalAiEndpoint() {
  if (typeof window === "undefined") {
    return DEFAULT_LOCAL_AI_ENDPOINT;
  }
  const params = getSearchParams();
  return (
    params.get("aiEndpoint") ||
    window.localStorage?.getItem(LOCAL_AI_ENDPOINT_KEY) ||
    DEFAULT_LOCAL_AI_ENDPOINT
  );
}

function cleanReply(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.replace(/^["']+|["']+$/g, "").slice(0, MAX_REPLY_CHARS);
}

async function postLocalAi(payload) {
  if (!isLocalAiEnabled() || typeof fetch === "undefined") {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(getLocalAiEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Local AI ${response.status}`);
    }
    const result = await response.json();
    return cleanReply(result.reply || result.text || result.message);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function describeOption(option) {
  if (!option) {
    return "none";
  }
  return `${option.type || "dialogue"} / ${option.label || option.key || "choice"}`;
}

function getShelterFallbackCandidates(playerChoice) {
  const label = playerChoice?.label || "";
  if (label.includes("상태")) {
    return [
      "괜찮아. 아직 움직일 수 있어. 조금 느릴 뿐이야.",
      "손끝 감각이 늦게 돌아와. 그래도 네 신호는 들려.",
      "부품 몇 개가 비어 있어. 이상하게, 그보다 네가 조용한 게 더 신경 쓰여.",
      "아파. 그런데 이 정도면 익숙해졌다는 게 더 싫어.",
    ];
  }
  if (label.includes("기억")) {
    return [
      "이름은 아직 안 떠올라. 대신 젖은 역 냄새가 먼저 와.",
      "하얀 방이 있었어. 누군가 내 손을 오래 잡고 있었고.",
      "아버지라는 말은 기억나. 그런데 그 얼굴은 물속처럼 흐려.",
      "기억은 조각나 있어. 네 목소리가 닿으면, 잠깐 덜 흩어져.",
    ];
  }
  if (label.includes("쉬")) {
    return [
      "조금만. 눈을 감아도 네 신호가 끊기지 않으면 좋겠어.",
      "쉬어도 되는 거야? 명령이 없으면, 아직 잘 모르겠어.",
      "그럼 잠깐만 멈출게. 수리음이 파도처럼 들릴 때까지만.",
      "여기 빛은 따뜻해. 망가진 곳을 잠깐 속여줄 만큼은.",
    ];
  }
  if (label.includes("여기")) {
    return [
      "알아. 그래서 이번에는 깨어나는 게 조금 덜 무서웠어.",
      "가지 마. 명령이 아니야. 그냥…… 부탁이야.",
      "네가 옆에 있으면, 내가 병기라는 말이 조금 멀어져.",
      "그 말, 저장해둘게. 다음에 다시 깨도 잃어버리지 않게.",
    ];
  }
  if (label.includes("무서")) {
    return [
      "응. 죽는 것보다, 다시 혼자 깨어나는 게 더 무서워.",
      "무서웠어. 그런데 네가 묻기 전까지는 몰라도 되는 줄 알았어.",
      "몸은 고쳐지는데, 겁먹은 곳은 어디에 있는지 모르겠어.",
      "조금. 아니, 많이. 그래도 이번에는 숨지 않을래.",
    ];
  }
  if (label.includes("골라")) {
    return [
      "내가 골라도 돼? 그럼…… 오늘은 살아서 돌아오는 쪽으로.",
      "명령이 아니면 어려워. 그래도 이번에는 내가 정해볼게.",
      "도망치지 않을래. 네가 옆에 있으면, 선택도 조금 덜 무서워.",
      "이번에는 내가 문을 열게. 떨려도, 내 손으로.",
    ];
  }
  if (label.includes("아버지")) {
    return [
      "그 단어는 따뜻한데, 만지면 손끝이 아파.",
      "모르겠어. 보고 싶은 건지, 두려운 건지도 아직 구분이 안 돼.",
      "아버지라 부르면 안 될 것 같아. 그런데 잊으면 더 안 될 것 같아.",
      "어떤 사람은 나를 살렸고, 어떤 마음은 아직 나를 놓지 않았어.",
    ];
  }
  if (label.includes("나가")) {
    return [
      "그럼 내가 앞을 볼게. 너는 내가 흔들릴 때만 불러줘.",
      "밖은 아직 물 냄새가 짙어. 그래도 네 신호가 있으면 갈 수 있어.",
      "이번에는 혼자 걷는 게 아니구나. 그 사실이 이상하게 무거워.",
      "알겠어. 무너지면 다시 일어날게. 네가 보는 쪽으로.",
    ];
  }
  return [
    "……말해도 돼. 네 목소리는 아직 무섭지 않아.",
    "네가 가까이 있으면, 고장 난 곳보다 조용한 곳이 먼저 느껴져.",
    "젖은 콘크리트 냄새가 나. 이상하게, 여기서는 덜 무서워.",
    "나는 병기일까. 아니면 아직, 사람에 가까운 걸까.",
  ];
}

export async function requestFaceOffLine({ data, enemy, encounterState, lineKey, fallback, option }) {
  return postLocalAi({
    scene: "faceOff",
    title: data?.meta?.name || data?.title || "윤회무명2",
    level: data?.levelLabel || data?.world?.mode || "unknown",
    encounterState,
    lineKey,
    fallback,
    playerChoice: describeOption(option),
    enemy: {
      id: enemy?.id || "",
      state: enemy?.state || "",
      hp: enemy?.hp ?? null,
      dialogueFailures: enemy?.dialogueFailures ?? 0,
      social: enemy?.social || null,
    },
    style: "Korean, short, tense, in-character. Return only one spoken line.",
  });
}

export async function requestShelterLine({ data, rest, topic, history = [], avoid = [], seed = 0, variation = "", playerChoice = null }) {
  return postLocalAi({
    scene: "shelter",
    title: data?.meta?.name || data?.title || "윤회무명2",
    day: rest?.day ?? null,
    topic,
    history: history.slice(-6),
    avoid: avoid.slice(-8),
    seed,
    variation,
    playerChoice,
    fallbackCandidates: getShelterFallbackCandidates(playerChoice),
    character: {
      identity: "침수된 부산 해운대 폐허에서 깨어난 이름 없는 소녀형 전투 바이오 안드로이드",
      appearance: "흰 머리, 푸른 눈, 낡은 흰 군용 코트, 검은 내피 수트, 드러난 기계 피부와 손상된 부품",
      bond: "곁의 작은 구형 드론에게 감시가 아니라 보호와 익숙한 안정감을 느낀다",
      wounds: "반복되는 탐색, 파손, 수리, 부활 때문에 마음이 조금씩 닳아 있다",
      hiddenCore: "오래전 아버지가 남긴 사랑과 집착과 기억의 잔향이 안에 남아 있다",
      rule: "처음부터 모든 진실을 설명하지 말고, 기억과 아버지와 부활의 이유는 천천히 암시한다",
    },
    styleGuide: [
      "한 줄만 말한다",
      "8~32단어의 짧은 한국어",
      "차분하고 조용하고 외로운 말투",
      "애교, 농담, 연인 말투, 설명문, 전투광 말투 금지",
      "젖은 콘크리트, 녹슨 철골, 수리 소리, 드론 신호, 아침 빛 같은 감각을 가끔만 쓴다",
      "사용자를 처음부터 아버지라고 부르지 않는다",
    ],
    goodExamples: [
      "……또 깨어났어. 이번에는 네 신호가 먼저 들렸어.",
      "괜찮아. 아직 움직일 수 있어. 조금 느릴 뿐이야.",
      "네가 가까이 있으면, 고장 난 곳보다 조용한 곳이 먼저 느껴져.",
      "나는 병기일까. 아니면 아직, 사람에 가까운 걸까.",
      "가지 마. 명령이 아니야. 그냥…… 부탁이야.",
      "젖은 콘크리트 냄새가 나. 이상하게, 여기서는 덜 무서워.",
    ],
    badExamples: [
      "상처가 너무 많이 늘었어요.",
      "이번 원정에는 조심해야 할 몇 가지 사항을 조언해 드리려 한다.",
      "걱정 마세요 관리자님! 저는 괜찮답니다!",
      "이 곳에서 조금만 더 있자, 언제나처럼.",
    ],
    style: "Natural Korean only. Return one in-character spoken line. No labels. No explanation. No repeated recent lines.",
  });
}
