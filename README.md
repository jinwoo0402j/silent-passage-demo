# Rulebound Extraction

Browser-first vertical slice for validating a 2D side-view extraction loop built around rule-bound NPC encounters.

The current browser build is switched to a `movement lab` layout. Expedition content is stripped out so you can tune run, jump, dash, crouch, and wall control before placing a real authored map.

## What this prototype tests

- Whether `Release` versus `Harvest` creates a meaningful moral and mechanical trade-off
- Whether clue-driven rule interpretation is strong enough to carry the encounter design
- Whether dusk and night pressure create urgency without becoming a hard fail timer

## Play loop

1. Open the shelter link
2. Deploy into the quarantine yard
3. Read the `Checkpoint Warden` and `Loop Adherent`
4. Choose `Release`, `Harvest`, or extraction without resolution
5. Return to shelter with materials, trust changes, and possible unlocks

## Controls

- `C` or `Enter`: advance title, shelter, results, and failure scenes
- `ArrowLeft` / `ArrowRight` (`A` / `D` fallback): move
- `C` (`Space` fallback): jump, and brace off depth walls in mid-air
- `X`: dash, then hold to transition into sprint
- `ArrowDown` (`S` fallback): crouch and crouch-walk
- `Z` (`E` fallback): interact, align pedestals, extract
- `V` (`F` fallback): attack / harvest
- `R`: restart the current expedition from spawn
- `Q` (hold): lamp, and `Threat Sense` once unlocked
- `F3` or `` ` ``: toggle collision debug overlay

## Current Lab Notes

- Dash now has a short cooldown and still refreshes after landing.
- Sprint is a ground-only acceleration layer that comes off the `X` button.
- `Brace walls` are non-solid volumes you can press `C` on in mid-air for an extra climb.
- NPC encounters, ritual logic, and night pressure are disabled in the lab map.
- Exit from the far-right gate to leave the lab and return to shelter.

## Run rules

- `Release` restores sanity and unlocks story fragments
- `Harvest` grants materials and unlocks `Threat Sense`, but reduces sanity
- `Night` lowers visibility, drains sanity, and activates hostile dark threats
- If `HP` or `Sanity` reaches `0`, the current run is lost and nothing from that run is banked

## Local run

Use a local static server. The app now relies on ES modules.

```powershell
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Files

- `index.html`: static shell and sidebar HUD
- `main.js`: module entry and frame loop
- `level-data.js`: world layout, encounters, interactables, and meta content
- `state.js`: scene state, run state, and saved meta progression
- `systems.js`: movement, combat, encounters, extraction, and progression logic
- `render.js`: canvas rendering and sidebar updates
- `utils.js`: shared math and formatting helpers
- `styles.css`: layout and visual framing

## Notes

- Meta progression is stored in browser local storage
- This slice is intentionally placeholder-heavy on art and audio
- The implementation target is browser validation, not Unity parity
