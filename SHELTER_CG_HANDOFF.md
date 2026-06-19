# Shelter CG Handoff

## Goal

Create six real full-screen Type-07A shelter dialogue CGs. These must be different illustrations, not color-graded copies of one image.

## Required Output

- Resolution: 16:9 PNG, preferably 1536x864 or larger.
- Location: `assets/cg/`
- File names:
  - `shelter-home-emotion-neutral-03.png`
  - `shelter-home-emotion-anxious-03.png`
  - `shelter-home-emotion-warm-03.png`
  - `shelter-home-emotion-tired-03.png`
  - `shelter-home-emotion-hurt-03.png`
  - `shelter-home-emotion-angry-03.png`
- No text, no watermark, no UI, no speech bubble.
- Keep the character clearly adult and non-explicit.

## Character Baseline

Type-07A is a young-adult anime heroine with glossy black twin tails, pale skin, sharp expressive eyes, black tactical bodysuit, and cyan/teal tech accents. The current active visual baseline is `assets/cg/shelter-home-charm-01.png`.

## Shared Scene Direction

Use a cinematic sci-fi shelter room: couch, repair bench, cables, monitors, cool cyan equipment lights, warm ceiling light, lived-in but clean. The CG should feel like visual novel story art, not a portrait sprite on a plain background.

Keep enough negative space near the lower center for subtitles. Important face/hand details should not sit under the bottom subtitle area.

## Emotion Beats

- `neutral`: relaxed shelter idle, calm eye contact, ordinary conversation energy.
- `anxious`: worried glance, body slightly guarded, cooler lighting, she looks like she is listening for a bad signal.
- `warm`: shy or relieved smile, softer posture, warmer light, father/daughter reassurance mood.
- `tired`: seated or leaning posture, lowered shoulders, exhausted but still present.
- `hurt`: physically or emotionally pained, hand near wound/chest/arm, not graphic.
- `angry`: determined or upset, sharper eyes, clenched hand or forward posture, not screaming.

## Suggested Prompt Base

```text
Create a 16:9 cinematic visual novel CG, no text, no watermark.
Subject: Type-07A, clearly adult young woman, glossy black twin tails, pale skin, expressive sharp eyes, black tactical bodysuit with cyan tech accents, non-explicit.
Scene: compact sci-fi shelter room with couch, repair bench, cables, monitors, cyan equipment lights and warm ceiling light, lived-in but clean.
Style: polished contemporary Korean/Japanese anime game CG, clean linework, premium visual novel illustration, detailed background, cinematic lighting, strong silhouette.
Composition: full-screen story CG, character visible from waist or knees up, face readable, lower center kept clear for subtitles.
Emotion: <replace with one emotion beat>.
Avoid: same pose across variants, simple color filter changes, text, UI, watermark, nudity, explicit pose.
```

## Wiring

After files are added, update these six entries in `level-data.js`:

```js
shelterHomeNeutralCg
shelterHomeAnxiousCg
shelterHomeWarmCg
shelterHomeTiredCg
shelterHomeHurtCg
shelterHomeAngryCg
```

Use a new cache suffix such as `?v=20260619-emotion-cg-v3`, then bump the `main.js` import cache in `index.html` if needed.

## Preview And Validation

Preview one emotion directly:

```text
http://127.0.0.1:4173/?perf=lite&resetShelter=1&shelterCgPreview=angry
```

Run:

```powershell
node scripts/validate-shelter-cg-assets.mjs
node --check level-data.js
node --check main.js
node --check render.js
node scripts/validate-levels.mjs
```
