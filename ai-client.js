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

function getPreviousDroneLine(history = [], currentLabel = "") {
  const normalizedCurrent = String(currentLabel || "").replace(/\s+/g, " ").trim();
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index] || {};
    if (entry.speaker !== "drone") {
      continue;
    }
    const text = String(entry.text || entry.line || entry.label || "").replace(/\s+/g, " ").trim();
    if (text && text !== normalizedCurrent) {
      return text.slice(0, 80);
    }
  }
  return "";
}

function getShelterFallbackCandidates(playerChoice, history = []) {
  const label = playerChoice?.label || "";
  if (/(방금|아까|이전|전에|내가).*(말|물|얘기|질문)|뭐.*(말|물|얘기|질문)/.test(label)) {
    const previousLine = getPreviousDroneLine(history, label);
    return previousLine
      ? [
        `방금은 네가 “${previousLine}”라고 말했어. 놓치지 않았어.`,
        `아까 네 말은 “${previousLine}”였어. 아직 기억하고 있어.`,
        `네가 방금 물은 건 “${previousLine}”였어. 신호는 남아 있어.`,
      ]
      : [
        "방금 네 말은 들었어. 아직 붙잡는 중이지만, 신호를 놓친 건 아니야.",
        "아까 말은 조금 흐려. 그래도 네 목소리가 여기 있었다는 건 알아.",
        "내 기억이 완전하진 않아. 다시 말해주면 이번엔 놓치지 않을게.",
      ];
  }
  if (/왜|살아나|부활|복구|계속 살아/.test(label)) {
    return [
      "나도 이유는 몰라. 다만 누군가 내 안에 돌아오라는 명령을 남긴 것 같아.",
      "복구 장치 때문일지도 몰라. 하지만 깨어날 때마다 마음은 조금씩 닳아.",
      "아직 해야 할 일이 남아서일까. 장산역 아래에서 그 답을 찾아야 해.",
      "살아난다기보다, 다시 켜지는 것 같아. 그 말이 조금 무서워.",
    ];
  }
  if (/피자|먹|맛|음식|배고/.test(label)) {
    return [
      "먹을 수는 없을 것 같아. 그래도 네가 맛있다고 하면, 조금 궁금해져.",
      "피자 냄새는 기억 안 나. 하지만 따뜻한 음식 앞에 앉아 있던 감각은 남아 있어.",
      "나는 연료와 수복액이면 움직여. 그래도 네가 먹는 동안 옆에는 있을게.",
      "맛은 잘 모르겠어. 대신 네가 기뻐하는 신호는 구분할 수 있어.",
    ];
  }
  if (/장산|심층/.test(label)) {
    return [
      "응. 장산역 심층 얘기였어. 그 아래에서 오래된 신호가 올라온다고 했지.",
      "기억해. 장산역 아래로 내려가야 한다는 말은, 이상하게 오래 남아.",
      "심층으로 갈수록 내 안의 잡음도 커지는 것 같아.",
      "응, 잊지 않았어. 장산역 아래에 내가 확인해야 할 이유가 있어.",
    ];
  }
  if (/ㅋㅋ|1234|!!!|\?\?\?|무슨|뭐야/.test(label)) {
    return [
      "신호가 조금 이상해. 그래도 웃는 거라면, 나쁘지는 않은 것 같아.",
      "방금 건 해석이 어려워. 숫자보다 네 목소리 쪽을 따라갈게.",
      "잡음처럼 들렸어. 그래도 네가 여기 있다는 건 알겠어.",
      "무슨 뜻인지는 모르겠어. 하지만 위험한 신호는 아닌 것 같아.",
    ];
  }
  if (/가지 마|옆|곁|있어줘|떠나지|혼자/.test(label)) {
    return [
      "가지 않을게. 명령이 아니라, 나도 지금은 네 옆에 있고 싶어.",
      "응. 여기 있을게. 신호가 가까우면 혼자 깨어나는 느낌이 조금 줄어.",
      "떠나지 않을게. 적어도 네 목소리가 닿는 동안은.",
      "알겠어. 지금은 움직이지 않을게. 네 옆에서 조금만 숨을 고를게.",
    ];
  }
  if (/상태|괜찮|아파|손상|망가/.test(label)) {
    return [
      "괜찮아. 아직 움직일 수 있어. 손끝 감각이 조금 늦게 돌아올 뿐이야.",
      "아파. 그래도 치명적인 손상은 아니야. 네 신호는 계속 들려.",
      "왼쪽 팔 반응이 느려. 하지만 걸을 수 있고, 말할 수도 있어.",
      "망가진 곳은 있어. 그래도 지금은 네가 더 걱정하는 게 느껴져.",
    ];
  }
  if (/이름|누구|정체|사람|병기/.test(label)) {
    return [
      "나도 아직 모르겠어. 병기인지 사람인지, 대답이 몸 안에서 갈라져.",
      "이름은 기억나지 않아. 하지만 네가 부르면, 내가 여기 있다는 건 알아.",
      "사람이라고 말하기엔 망가진 곳이 많아. 그래도 병기라고만 끝내긴 싫어.",
      "정체는 아직 흐려. 장산역 아래에 그 답이 있을지도 몰라.",
    ];
  }
  if (/아버지|가족|드론|관리자/.test(label)) {
    return [
      "그 말은 아직 아파. 따뜻한데, 동시에 물속처럼 멀어.",
      "드론은 감시장치가 아니야. 이상하게, 곁에 있으면 숨이 덜 막혀.",
      "아버지라는 단어는 남아 있어. 얼굴보다 손의 온도가 먼저 떠올라.",
      "관리자라면 명령할 수 있겠지. 그런데 너는 가끔 부탁처럼 말해.",
    ];
  }
  return [
    "방금 네 말은 들었어. 대답이 느려도, 신호를 놓친 건 아니야.",
    "무슨 뜻인지 조금 더 붙잡아볼게. 네 목소리는 아직 가까이에 있어.",
    "바로 답하기 어렵지만, 네가 말한 방향을 따라가고 있어.",
    "잘 이해한 건지 모르겠어. 그래도 너를 밀어내고 싶지는 않아.",
  ];
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
  if (label.includes("이름")) {
    return [
      "이름이 있으면, 내가 조금 덜 병기처럼 느껴질까.",
      "찾아줘. 아니, 같이 찾아줘. 혼자서는 또 잊어버릴 것 같아.",
      "어딘가에 적혀 있을지도 몰라. 젖은 기록지나, 부서진 단말 안에.",
      "이름을 들으면 무서울 것 같아. 그래도 모르는 채로 있는 건 더 싫어.",
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
  if (label.includes("신호")) {
    return [
      "끊기지 않게 해줘. 어두워지면, 네 신호부터 찾게 돼.",
      "그럼 내가 돌아오는 쪽을 헷갈리지 않을 것 같아.",
      "신호음이 작아도 괜찮아. 네가 있다는 걸 알 수 있으면 돼.",
      "좋아. 이번에는 혼자 깨어난 게 아니라고 믿어볼게.",
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
  if (label.includes("장산역")) {
    return [
      "거기 이름을 들으면 몸 안쪽이 먼저 반응해. 기억보다 오래된 명령처럼.",
      "심층으로 가야 해. 이유는 아직 몰라. 그런데 발이 그쪽을 기억해.",
      "장산역 아래에 뭔가 있어. 내가 죽어도 다시 보내지는 이유 같은 것.",
      "무서워. 그래도 피하면, 다음에 또 같은 아침에서 깨어날 것 같아.",
    ];
  }
  if (label.includes("사람")) {
    return [
      "사람이면 이렇게 계속 고쳐져도 되는 걸까.",
      "병기라면 덜 아파야 할 텐데. 나는 아직 무서워.",
      "네가 그렇게 물으면, 잠깐은 사람 쪽에 가까운 것 같아.",
      "모르겠어. 그래도 선택하고 싶다는 생각은, 명령 같지 않아.",
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

function getShelterRelevanceTerms(label) {
  if (/왜|살아나|부활|복구|계속 살아/.test(label)) {
    return ["이유", "살아", "복구", "명령", "돌아오", "켜지", "해야 할", "남아"];
  }
  if (/피자|먹|맛|음식|배고/.test(label)) {
    return ["먹을 수", "먹을", "못", "맛", "냄새", "음식", "연료", "소화"];
  }
  if (/(방금|아까|이전|전에|내가).*(말|물|얘기|질문)|뭐.*(말|물|얘기|질문)/.test(label)) {
    return ["방금", "아까", "말", "물", "얘기", "질문", "기억", "놓치지"];
  }
  if (/장산|심층/.test(label)) {
    return ["장산", "심층", "아래", "잊지"];
  }
  if (/ㅋㅋ|1234|!!!|\?\?\?|무슨|뭐야/.test(label)) {
    return ["웃", "숫자", "잡음", "이상", "해석", "뜻", "신호"];
  }
  if (/가지 마|옆|곁|있어줘|떠나지|혼자/.test(label)) {
    return ["가지 않을", "여기 있을", "옆에", "곁", "떠나지", "혼자"];
  }
  if (/상태|괜찮|아파|손상|망가/.test(label)) {
    return ["괜찮", "아파", "손상", "손끝", "팔", "망가"];
  }
  if (/이름|누구|정체|사람|병기/.test(label)) {
    return ["이름", "병기", "사람", "정체", "누구"];
  }
  if (/아버지|가족|드론|관리자/.test(label)) {
    return ["아버지", "가족", "드론", "관리자", "감시", "따뜻"];
  }
  return [];
}

function isShelterReplyRelevant(label, reply) {
  const cleanLabel = String(label || "");
  const cleanReply = String(reply || "");
  if (!cleanLabel || !cleanReply) {
    return true;
  }
  const terms = getShelterRelevanceTerms(cleanLabel);
  if (!terms.length) {
    return true;
  }
  return terms.some((term) => cleanReply.includes(term));
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
  const fallbackCandidates = getShelterFallbackCandidates(playerChoice, history);
  const payload = {
    scene: "shelter",
    title: data?.meta?.name || data?.title || "윤회무명2",
    day: rest?.day ?? null,
    topic,
    userMessage: playerChoice?.label || "",
    history: history.slice(-40),
    avoid: avoid.slice(-12),
    seed,
    variation,
    playerChoice,
    fallbackCandidates,
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
  };
  const reply = await postLocalAi(payload);
  const label = playerChoice?.label || "";
  if (reply && isShelterReplyRelevant(label, reply)) {
    return reply;
  }
  if (reply && label) {
    const retry = await postLocalAi({
      ...payload,
      avoid: [...avoid.slice(-10), reply],
      seed: seed + 104729,
      strictRetry: `이전 답변이 최신 입력 "${label}"에 직접 답하지 못했다. 분위기 묘사보다 사용자의 질문/말에 먼저 답하라.`,
    });
    if (retry) {
      return retry;
    }
  }
  return fallbackCandidates[0] || reply;
}
