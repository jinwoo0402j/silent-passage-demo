# Silent Passage Demo

Fast HTML demo for validating a side-view exploration loop in the browser.

## What this demo is testing

- Does a simple world layout create curiosity without explicit tutorial text?
- Do players naturally follow visual signals toward the finish?
- Do optional discoveries and a hidden route make exploration feel worthwhile?

## Controls

- `Enter`: start
- `A` / `D` or arrow keys: move
- `Space`: jump
- `E`: interact
- `R`: restart
- `F2`: toggle level debug overlay
- `F3`: toggle design mode

## Local run

Because this project is fully static, you can either open `index.html` directly or serve the folder with any static server.

Example:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages deployment

This repository includes a GitHub Actions workflow that deploys the static site to GitHub Pages from the `main` branch.

After pushing to GitHub:

1. Create a GitHub repository and push this folder to `main`.
2. In GitHub, enable Pages for GitHub Actions if prompted.
3. The site will deploy automatically on pushes to `main`.

The published URL will usually be:

`https://<github-username>.github.io/<repository-name>/`

## Editing the level

Level layout now lives in `level-data.js`, not inside the game loop.

- Change `playerSpawn` to set the starting point
- Change `platforms` to reshape the route
- Change `landmarks` to place visual discovery signals
- Change `interactables` to add optional discoveries or hidden reveals
- Change `finishZone` to move the exit

Use `F2` in the browser while testing to show:

- player world coordinates
- camera position
- a world grid
- object labels and platform coordinates

Use `F3` to open design mode:

- click any platform, landmark, interactable, spawn, or finish zone to select it
- drag the selected object directly in the canvas
- edit the selected object in the JSON panel
- add or delete level objects
- copy the full current draft as a ready-to-paste `window.LEVEL_DATA = ...;` payload

Draft edits are stored in browser local storage so you can iterate without touching the repo immediately.  
When the layout feels right, copy the full level payload and replace the contents of `level-data.js`.

## Files

- `index.html`: app shell and canvas mount point
- `level-data.js`: editable level layout and world values
- `styles.css`: page layout and responsive UI framing
- `main.js`: game loop, input, camera, collision, discoveries, and debug tools
- `.github/workflows/deploy-pages.yml`: Pages deployment workflow
