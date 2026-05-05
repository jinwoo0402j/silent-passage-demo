# Level Design Git Workflow

This folder is the handoff point for level design work.

The in-browser editor saves to localStorage first. That save is local to one browser profile and is not shared with the team. To share level work through Git, export JSON from the editor and commit the JSON file here.

## Folder Policy

- `drafts/`: work-in-progress level exports from designers.
- `accepted/`: reviewed level exports that are ready to be integrated into `level-data.js`.

Designers should usually commit only files under `levels/drafts/`. Developers move or copy reviewed files into `levels/accepted/` or integrate them into `level-data.js`.

## Branch Workflow

1. Create a branch for the level pass.

   ```powershell
   git checkout -b level/faceoff-checkpoint-pass-01
   ```

2. Open the editor.

   On Windows, double-click one of these files from the repository root:

   ```text
   start-guide.bat
   start-editor.bat
   start-game.bat
   ```

   `start-editor.bat` is the fastest path for level editing.
   If a server window opens, keep it open while editing.
   The launcher uses the bundled PowerShell server so level JSON files under `levels/drafts/` and `levels/accepted/` are discovered automatically.

   ```text
   http://localhost:4173/editor.html
   ```

3. Create or duplicate a level in the editor.

4. Build and test the level.

5. Use the editor's `JSON 저장` button to export the level.

   In Chrome or Edge, the editor will ask for a folder. Choose the repository's `levels/` folder:

   ```text
   levels/
   ```

   Then the JSON file is written directly into `levels/drafts/`, `levels/manifest.json` is updated, and both files appear in Git changes. If you choose `levels/drafts/` by mistake, the editor will reject it; choose the parent `levels/` folder.

   If the browser only downloads a file, move the downloaded JSON from `Downloads` into `levels/drafts/` manually, then run:

   ```powershell
   node scripts/update-level-manifest.mjs
   ```

6. Confirm the exported file is under `levels/drafts/`.

   ```text
   levels/drafts/faceoff-checkpoint-01.v001.json
   ```

7. Validate the exported level files.

   ```powershell
   node scripts/validate-levels.mjs
   ```

8. Commit and push.

   ```powershell
   git add levels/drafts/faceoff-checkpoint-01.v001.json levels/manifest.json
   git commit -m "Add draft faceoff checkpoint level"
   git push origin level/faceoff-checkpoint-pass-01
   ```

9. Open a PR with the test notes below.

## File Naming

Use stable, searchable names.

```text
levels/drafts/<level-id>.v001.json
levels/drafts/<level-id>.v002.json
levels/accepted/<level-id>.json
```

Examples:

```text
levels/drafts/movement-approach-01.v001.json
levels/drafts/faceoff-checkpoint-01.v002.json
levels/accepted/faceoff-checkpoint-01.json
```

## Required PR Notes

Include this in the PR description:

```text
Level ID:
Purpose:
Expected play time:
Start level:
Connected routes:
Main test goal:
Known issues:
```

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

## Level Connection Rules

- Every playable level should have at least one `entrance`.
- A `routeExit.toLevelId` must point to an existing level.
- A `routeExit.toEntranceId` must exist in the target level.
- If route exits are meant to be two-way, add a return route in the target level.
- Do not rename entrance IDs after other levels route into them unless you update every referring route.

## What Not To Commit

Do not commit browser localStorage dumps, screenshots, or temporary test output as level source. The source of truth for designer handoff is exported JSON under this folder.
