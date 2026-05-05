# Face-off Design

## Current Direction

Face-off is no longer an interrupt that opens while aiming at an active humanoid enemy during overworld combat.

The revised intent is to keep the overworld combat flow intact. The player first wins the immediate fight in the overworld. Face-off then becomes a post-knockdown interaction with a defeated humanoid enemy.

## Core Flow

1. The player fights humanoid enemies in the overworld.
2. A humanoid enemy that takes enough gun damage enters a knockdown state instead of immediately opening Face-off.
3. A knocked-down humanoid enemy tries to survive. By default, they crawl away from the player or toward an escape direction.
4. The player approaches the knocked-down enemy and keeps aim on them for 1 second.
5. When the aim hold completes, Face-off opens.
6. In this Face-off state, the enemy cannot counterattack.
7. The player can shoot the enemy, talk to the enemy, or let the enemy go.

## Knockdown State

Knockdown is the new bridge between overworld combat and Face-off.

- Knockdown is caused by overworld gun damage.
- Knocked-down enemies are alive, vulnerable, and unable to fight normally.
- Knocked-down enemies can move by crawling.
- Crawling behavior can vary by enemy type.
- If the player does not initiate Face-off, the enemy may crawl away and escape.

## Face-off Entry

Face-off entry is only valid against a knocked-down humanoid enemy.

- Standing or actively fighting humanoid enemies should not trigger Face-off directly.
- Entry requires the player to aim at the knocked-down enemy for 1 second.
- The aim progress should be shown near the crosshair as a circular hold gauge.
- Face-off starts only when the hold gauge reaches 100%.
- The entry should feel like an intentional interaction, not an accidental combat interruption.

## Face-off Interaction

Face-off after knockdown is a control-and-choice scene.

- The enemy cannot shoot or counterattack during this Face-off.
- The player has a chance to execute the enemy.
- The player has a chance to talk and extract information or negotiate.
- The player has a chance to spare or release the enemy.
- The tension comes from the player's choice and the enemy's fear, not from a live trigger/timeline counterattack.

## Player Choices

### Shoot

The player can shoot the knocked-down enemy during Face-off.

- This can kill the enemy.
- This ends the interaction quickly.
- It should provide no dialogue, negotiation, or information reward.

### Talk

The player can choose dialogue options.

- Dialogue remains a combat-adjacent action, but the enemy cannot retaliate.
- Dialogue success should be based on enemy social stats and option difficulty.
- Dialogue success can produce surrender, information, deal, route, loot, or enemy-position rewards.
- Dialogue failure should affect trust, fear, aggression, or future availability, rather than causing immediate enemy gunfire.

### Release

The player can let the enemy go.

- The enemy survives.
- The enemy may crawl away, flee, or become non-hostile depending on enemy type and dialogue state.
- This can support future morality, reputation, witness, or recurring enemy systems.

## Removed Or Reduced Concepts

These concepts should be removed or reduced from the new default Face-off flow:

- Direct Face-off entry by aiming at an active standing humanoid enemy.
- Enemy trigger/timeline causing a counterattack during Face-off.
- Face-off as a live mid-combat interruption.
- Requiring the player to hold right click after Face-off has already opened.

## Result Types

The existing result categories can remain, but their meaning shifts.

- `kill`: The player executes or fatally shoots the enemy.
- `disable`: The enemy remains alive but is physically unable to continue or escape.
- `surrender`: The enemy gives up and stops resisting.
- `deal`: The enemy provides information, route access, loot hints, or other negotiated value.
- `release`: The player lets the enemy go. This is a new explicit result to support the revised flow.
- `escape`: The knocked-down enemy crawls away before Face-off starts. This is a new overworld result, not a Face-off result.

## Implementation Implications

- Humanoid enemies need a knockdown state separate from `dead`, `disabled`, and active combat states.
- Overworld gun damage should be able to transition humanoid enemies into knockdown.
- Knocked-down enemies need crawling movement and escape behavior.
- Face-off candidate detection should only consider knocked-down humanoid enemies.
- The Face-off acquire duration should be 1 second for knocked-down targets.
- Face-off timeline/counterattack logic should be disabled or repurposed for this mode.
- UI should communicate that this is an aftermath interaction: shoot, talk, or release.

## V1 Locked Decisions

- V1 applies only to `faceoff-guard-01`.
- Knocked-down enemies crawl 360px away from the knockdown point, opposite the player.
- Reaching the crawl target sets `escape`; this is an overworld result and grants no loot.
- `kill` and `disable` are the only results that should be loot-enabled later.
- `surrender`, `deal`, `release`, and `escape` grant no loot in V1.
- Additional overworld shots on a knocked-down enemy add `exhaustionHits`; the second hit kills.
- Face-off entry requires 1 second of aiming at a knocked-down target.
- Face-off freezes the world and does not require holding right click once opened.
- Face-off cancel closes the UI and resumes the enemy crawl.
- Dialogue failures no longer cause counterattack; they only change social pressure/chance.
