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

## Files

- `index.html`: app shell and canvas mount point
- `styles.css`: page layout and responsive UI framing
- `main.js`: game loop, input, camera, collision, discoveries, and finish state
- `.github/workflows/deploy-pages.yml`: Pages deployment workflow
