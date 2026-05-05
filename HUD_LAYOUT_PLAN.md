# HUD Layout Plan

## Goal

Make the expedition HUD readable during combat by grouping information by decision speed instead of by implementation history.

## Layout

- Top left: operator status. Portrait, HP, Focus, battery, and current state.
- Top right: navigation. Current level, minimap, and the first three objective lines.
- Bottom right: weapon state. Selected arm, magazine, reserve ammo, reload progress, and module chips.
- Bottom left: compact controls and transient prompts only.
- Center/world: aim line, interaction prompt, threat telegraphs, and combat feedback.

## V4 Rules

- No overlapping HUD panels.
- Focus is a first-class combat resource beside HP.
- Weapon information owns the bottom-right corner and does not share space with status bars.
- Map/objective information stays out of the combat path and away from the character panel.
- V3 HUD functions stay in the file for rollback; `drawHudV4()` becomes the active call.

## Verification

- Load `index.html`.
- Enter expedition.
- Check 1280x720 screenshot for overlap and readable text.
- Hold `Space` and confirm Focus bar drains visibly.
- Right-click near screen edges and confirm aim camera still has room to move without HUD collision.
