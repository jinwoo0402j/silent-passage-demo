# Silent Passage Shelter Event Schema

## Current Implementation Pattern

The project is a vanilla JavaScript browser game rooted at `D:\silent-passage-demo`.

Relevant files:

- `level-data.js`: owns static game data. Add shelter event scripts under `GAME_DATA.shelter.events`.
- `systems.js`: owns input, state transitions, shelter talk choice selection, choice effects, and `meta.storyFlags` persistence.
- `render.js`: draws shelter talk and maps `talk.emotion` to portrait or memorial images.
- `state.js`: owns persisted meta shape. Existing `meta.storyFlags` and `meta.trust` are sufficient for most shelter events.
- `level-store.js`: creates runtime level data. Verify that `shelter.events` survives `createRuntimeGameData`.

Current shelter presentation:

- Scripted shelter events render as cinematic subtitles, not a boxed visual-novel dialogue panel.
- Dialogue advances one displayed line at a time with `Z` or `Enter`.
- Event choices appear only after the current node's final line.
- Choices render as a lower-left vertical text list with `W/S` selection and `Z/Enter` confirmation.
- Final branch replies show subtitle text only; the player exits back to shelter with `Esc`.
- Event-specific CG should be set with `backgroundAssetKey` or choice `backgroundAssetKey`. Use `shelterHomeCharmCg` for the current black twin-tail character baseline unless a new approved CG is available.

## Event Data Shape

Use this shape unless the repo has evolved:

```js
GAME_DATA.shelter = {
  // existing fields...
  events: [
    {
      id: "stable-event-id",
      title: "Human-readable event title",
      once: true,
      completionFlag: "shelter-event:stable-event-id",
      trigger: {
        missingStoryFlag: "shelter-event:stable-event-id",
        requiredStoryFlag: "optional-prerequisite-flag"
      },
      startNodeId: "start",
      nodes: [
        {
          id: "start",
          emotion: "anxious",
          line: "Opening line shown before choices.",
          choices: [
            {
              label: "Choice label",
              intent: "Short author-facing intent for voice/topic metadata",
              emotion: "warm",
              reply: "Type-07A branch response.",
              effects: {
                trust: 0.03,
                storyFlags: ["branch-specific-flag"]
              }
            }
          ]
        }
      ]
    }
  ]
};
```

Supported emotion keys are `neutral`, `anxious`, `warm`, `tired`, `hurt`, and `angry`.

Use `nextNodeId` on a choice only when a multi-step event is required. Without `nextNodeId`, a choice ends the event and writes the completion flag unless `endEvent: false` is set.

## Approval Gate

Before editing gameplay files, show the user a script draft with:

- event id and title
- trigger and one-shot/completion behavior
- opening line
- each player choice
- each branch reply
- emotion/image state per branch
- flags, trust, materials, unlocks, or follow-up effects
- implementation notes and any engine changes required

Wait for explicit confirmation before implementation. If the user asks for changes, revise the script and ask again. Only implement after approval or after the user directly asks to implement that exact draft.

## Event Writing Heuristics

- Keep each event to one clear emotional turn unless the user asks for a longer sequence.
- Use 2-3 choices for the current UI. More choices need UI work.
- Each choice should change either emotional tone, information gained, trust, future flag, or follow-up availability.
- Keep branch replies short enough for the shelter dialogue panel.
- Treat image changes through `emotion`; request or generate new art only when the existing six emotions cannot communicate the branch.
- Use stable ASCII ids and flags. Korean is fine for player-facing labels and dialogue.

## Dialogue Tone

Default to direct, grounded, spoken dialogue. The shelter tone should feel like a tired character and a close operator talking in a dangerous base, not like literary narration.

Core relationship:

- The administrator is effectively Type-07A's father.
- Write choices as a father talking to his daughter, not as a neutral system operator talking to an asset.
- Type-07A should sound like a young adult daughter who loves her father: casual, bright, cute, defensive when embarrassed, quick to complain, and emotionally open in short bursts.
- If the scene requires ambiguity about whether she recognizes him as her father, make that explicit in the draft and ask before implementation.

Prefer:

- short sentences
- concrete sensory or mechanical details
- understated emotion
- clear action/result language
- choices the player understands immediately

Avoid:

- abstract metaphors such as "inside me someone knocked"
- ornate grief such as "someone's hand slipped away"
- philosophical phrasing unless the user explicitly asks for it
- repeated ellipses used as drama filler
- lines that explain the theme instead of reacting to the situation
- over-formal or operator-like choice labels when a warmer fatherly line is available

Example rewrite direction:

- Too literary: "사라지는 순간에 누군가의 손도 같이 놓친 것 같아."
- Better: "끊겼어. 근데 기분은 별로야. 뭔가 확인하기 전에 지운 것 같아."

## Validation Checklist

Run these checks after implementation:

```powershell
node --check .\level-data.js
node --check .\systems.js
node --check .\render.js
node .\scripts\validate-levels.mjs
```

Run a focused runtime check:

```powershell
node --input-type=module -e "globalThis.window={location:{search:''},localStorage:{getItem(){return null},setItem(){},removeItem(){}}}; const [{GAME_DATA},{createRuntimeGameData}] = await Promise.all([import('./level-data.js?probe='+Date.now()), import('./level-store.js?probe='+Date.now())]); const runtime=createRuntimeGameData(GAME_DATA,null,{applyLevelOverride:false,useUrlLevel:false}); console.log(runtime.shelter?.events?.map((event)=>event.id));"
```

If browser control works, start the local server and visually verify:

```powershell
Start-Process -FilePath powershell -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','D:\silent-passage-demo\scripts\serve-local.ps1') -WindowStyle Hidden
```

Open `http://127.0.0.1:4173/?perf=lite&partsLoop=1`, enter shelter talk, choose a branch, and confirm:

- opening line appears
- three choices fit
- branch reply appears
- emotion image changes
- completion and branch flags persist in `meta.storyFlags`

## Improvements Learned From First Trial

- Do not only add text to the rotating generic talk list. A data-driven `GAME_DATA.shelter.events` layer gives repeatable triggers, branch effects, and one-shot completion.
- Verify both the source file and the runtime data. In this project, loaded level data passes through `createRuntimeGameData`, so source presence alone is not enough.
- Browser visual checks can be flaky in the in-app browser. Treat static syntax and runtime import checks as primary, and label browser screenshots as visual smoke evidence.
- Include `partsLoop=1` in browser checks to enter the shelter quickly.
- Split long opening beats into continuation nodes with `nextNodeId` instead of putting all lines before the first real choice. Verify the continuation node, final branch reply, completion flag, branch flag, and trust effect in the browser smoke.
- Add or bump cachebuster query strings when event data, render code, or CG URLs change.
- If an event-specific CG exists but is slow to appear, preload it in `index.html` and avoid falling back to a mismatched character image during loading.
