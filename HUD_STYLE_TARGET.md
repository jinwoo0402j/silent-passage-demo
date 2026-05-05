# HUD Style Target

## Direction

Use a quiet tactical HUD inspired by extraction shooter screenshots, adapted for a 2D side-view action game.

The HUD should feel like a combat instrument layer, not a dashboard. The center of the screen must stay open for movement, aiming, enemy reads, and Face-off transitions.

Generated concept reference:
- `assets/ui/hud-v5-concept.png`
- `assets/ui/hud-v5-concept-v2.png`

## Information Priority

Primary:
- HP
- Focus
- Current weapon magazine
- Reload / empty state
- Aim and interaction prompts

Secondary:
- Battery
- Air shot charge
- Reserve ammo
- Left/right arm selection

Situational:
- Minimap
- Objectives
- Route name
- Quick slots

## Layout Target

- Bottom left: thin status rail with HP, Focus, battery, and small numeric ID/status.
- Bottom left: compact portrait system first, then HP, Focus, battery, and small numeric ID/status.
- Bottom left adjacent: item-use quick slots next to the portrait/status cluster.
- Bottom right: compact weapon rail with left/right arm slots, magazine number, reserve ammo, reload bar, and weapon silhouette/icon.
- Right edge: avoid persistent quick-slot stack unless a later inventory mode needs it.
- Top center: very small compass/time strip if needed.
- Center/world: crosshair, aim line, interaction prompt, and combat telegraphs.
- Map/objective details should be collapsed by default and expanded through map overlay, not always shown as a large panel.

## Visual Language

- Transparent dark glass panels, thin white lines, muted blue-gray fills.
- Sparse high-contrast accents: cyan for Focus, white for HP, pale green/yellow for interactable prompts, red/pink only for danger.
- Minimal text. Prefer numbers, bars, short labels, and compact icons.
- No large portrait card during normal play.
- No big floating blocks near the character unless the player opens a mode overlay.

## V5 Implementation Notes

- Keep V3/V4 functions available for rollback.
- Build `drawHudV5()` as a new active HUD path.
- Start with shape primitives in Canvas; icon polish can come later.
- Make layout constants local to the V5 functions first, then move to data only after the shape settles.
- Translate the generated concept into current game data, not a literal copy: keep the top compass optional, use current HP/Focus/Battery values, and keep weapon panels tied to the existing left/right arm + ammo model.
- Use a bottom-center Focus key hint only while Space is available, held, or recovering from depletion; it should not become a permanent tutorial block.
- Preserve the portrait system, but keep it small enough to read as an instrument tile rather than a character card.
- Compact pass target: bottom HUD panels should feel like thin instrument rails, not solid boxes. Prefer lower alpha fills, 1px strokes, smaller type, and shorter bars before adding more decoration.
