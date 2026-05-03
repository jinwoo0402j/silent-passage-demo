# Silent Passage Demo

2D side-view extraction action prototype focused on movement, dual-arm weapons, connected levels, and aftermath Face-off interactions.

## Quick Links

- Game: `index.html`
- Level Editor: `editor.html`
- Level Design Handoff Page: `level-design.html`
- Level design workflow: [levels/README.md](levels/README.md)
- Level validation script: [scripts/validate-levels.mjs](scripts/validate-levels.mjs)
- GitHub Pages deploy workflow: [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml)

If GitHub Pages is enabled for the repository, the deployed build is expected at:

```text
https://jinwoo0402j.github.io/silent-passage-demo/
```

The Pages workflow deploys from `main`. Branch work appears on GitHub immediately after push, but the public Pages build updates after the branch is merged to `main` or the workflow is manually dispatched from `main`.

## Current Prototype Scope

- 2D platform action movement
- Shotgun recoil movement
- Air-only bullet time while aiming
- Slide, hover, wall brace, dash, sprint, and wall-run movement tuning
- Connected run levels with `entrance` and `routeExit`
- Hollow-Knight-style run map overlay
- Local run start level setting
- Dual-arm weapon loadout: left shotgun arm, right pistol arm
- Face-off aftermath flow for knocked-down humanoid enemies
- Level editor support for local level creation and JSON export

## Local Run

Use a local static server because the app uses ES modules.

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://localhost:4173/index.html
```

Open the editor:

```text
http://localhost:4173/editor.html
```

## Level Designer Workflow

Designers should not rely on browser localStorage as the team handoff format. The editor's local save is only for that browser profile.

Team handoff uses exported JSON files under `levels/`.

1. Create a branch.

   ```powershell
   git checkout -b level/faceoff-checkpoint-pass-01
   ```

2. Build the level in `editor.html`.

3. Export with `JSON 저장`.

4. Put the file under `levels/drafts/`.

   ```text
   levels/drafts/faceoff-checkpoint-01.v001.json
   ```

5. Validate.

   ```powershell
   node scripts/validate-levels.mjs
   ```

6. Commit and push.

   ```powershell
   git add levels/drafts/faceoff-checkpoint-01.v001.json
   git commit -m "Add draft faceoff checkpoint level"
   git push origin level/faceoff-checkpoint-pass-01
   ```

7. Open a PR using the level design PR template.

More detail: [levels/README.md](levels/README.md)

## Editor Tool Shortcuts

- `1`: select
- `2`: platform
- `3`: brace wall
- `4`: sign
- `5`: spawn
- `6`: entrance
- `7`: route exit
- `8`: extraction exit

Use `route exit` for level-to-level movement. Use `extraction exit` only for ending the run.

## Validation

Validate all level JSON exports:

```powershell
node scripts/validate-levels.mjs
```

Validate a specific file or folder:

```powershell
node scripts/validate-levels.mjs levels/drafts/faceoff-checkpoint-01.v001.json
```

The validator checks:

- JSON parse errors
- missing or malformed `levelId`
- duplicate entrance IDs
- duplicate route exit IDs
- missing target levels
- missing target entrances
- invalid position and size fields

## Key Files

- [index.html](index.html): game shell
- [editor.html](editor.html): level editor shell
- [level-data.js](level-data.js): built-in level and gameplay data
- [level-store.js](level-store.js): level save/load, overrides, run start, and editor data normalization
- [state.js](state.js): scene and run state
- [systems.js](systems.js): input, movement, combat, level transitions, and interactions
- [render.js](render.js): canvas rendering
- [save-game.js](save-game.js): local run save and restore
- [levels/](levels/): level designer JSON handoff
- [scripts/](scripts/): repo utility scripts

## Team Rules

- Do not commit browser localStorage dumps.
- Do not edit `level-data.js` directly for draft level work.
- Commit exported level JSON under `levels/drafts/`.
- Move reviewed levels into `levels/accepted/` or integrate them into `level-data.js` after review.
- Keep one PR focused on one level pass or one connected route pass.
