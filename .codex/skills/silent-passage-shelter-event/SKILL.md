---
name: silent-passage-shelter-event
description: Design, script, and implement Silent Passage shelter events from rough user ideas. Use when the user asks to create, revise, approve, or implement shelter scenes, Type-07A father/daughter conversations, cinematic subtitle events, choice branches, emotion/image changes, story flags, trust effects, or the reusable event-writing workflow for this repository.
---

# Silent Passage Shelter Event

## Workflow

Use this skill to turn a rough shelter event idea into a playable implementation.

1. Inspect the current repo before editing. Check `level-data.js`, `systems.js`, `render.js`, and any recent diffs touching shelter talk, emotion assets, or save/meta behavior.
2. Convert the idea into an event beat: trigger, opening line, 2-3 player choices, Type-07A response per choice, emotion per branch, story flags, trust/material effects, and follow-up hooks.
3. Keep dialogue plain, concrete, and game-like. Avoid abstract metaphors, literary phrasing, ornate grief, and lines that sound written rather than spoken.
4. Present the event script to the user before implementation. Include event id, trigger, opening line, choices, branch replies, emotion/image changes, flags/effects, and implementation notes.
5. Wait for explicit user confirmation before editing gameplay files. Do not implement from the script draft unless the user approves it or directly asks to implement that exact script.
6. After confirmation, prefer data-driven events under `GAME_DATA.shelter.events` in `level-data.js`. Only change engine code when the approved structure cannot be represented by the existing schema.
7. Preserve existing general shelter talk. Scripted events should take priority only while eligible, then fall back to normal rotating talk choices.
8. Use existing emotion keys: `neutral`, `anxious`, `warm`, `tired`, `hurt`, `angry`. These drive shelter portrait/memorial image changes in `render.js`.
9. Record one-shot completion with `meta.storyFlags` using a stable flag such as `shelter-event:<event-id>`.
10. Validate with `node --check level-data.js`, `node --check systems.js`, `node --check render.js`, `node scripts/validate-levels.mjs`, and a focused runtime import check that `createRuntimeGameData(...).shelter.events` contains the new event.
11. If browser verification is available, open `http://127.0.0.1:4173/?perf=lite&partsLoop=1`, enter shelter talk, and confirm the line, choices, emotion image, and selected branch effect.

## Current Direction

- Treat the active Type-07A visual baseline as the black twin-tail shelter character in `shelterHomeCharmCg` unless the user chooses a different approved CG.
- Scripted events should feel cinematic: one subtitle line at a time, no visible dialogue box, minimal lower-left key hints, and choices as a lower-left text list after the last line.
- Keep the administrator effectively her father. Player choice labels should sound like a dad speaking directly to his daughter.
- Type-07A should sound bright, cute, direct, and young-adult casual. She can complain, tease, get shy, and ask for reassurance, but avoid childish baby talk.
- When the user says to continue after approving a script, implement that approved script and run verification. When the user asks "what next?", propose the next concrete event beat before editing.

## Pace And Verification

- For small shelter presentation changes such as subtitle timing, font size, BGM fades, key hints, or minor UI placement, use a fast loop: inspect only the directly relevant code, make the scoped change, run targeted syntax checks, and do one browser smoke check if visual/audio behavior matters.
- Do not repeat browser screenshots, deep state probes, or broad validation loops unless the first check shows a problem, the change touches shared event/data contracts, or the user asks for deeper testing.
- For new or revised scripted events, keep the slower approval path and full validation checklist because story flags, choices, effects, and runtime data can regress later scenes.

## Reference

Read `references/project-schema.md` when implementing or revising event data, engine behavior, validation checks, or skill improvements.

## Output

Before approval, report the proposed script and ask for confirmation. After implementation, report the implemented event first, then list files changed and verification. Mention weak or skipped browser verification separately from passed static/runtime checks.
