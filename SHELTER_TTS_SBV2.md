# Shelter TTS with Style-Bert-VITS2

This project treats Style-Bert-VITS2 as an offline voice-bank generator.
The browser game does not call SBV2 at runtime. It only plays files listed in
`assets/voice/shelter/manifest.json`.

## Flow

1. Run SBV2 locally and make sure its FastAPI server is reachable.
2. Generate Type-07A line metadata:

   ```powershell
   node .\scripts\generate-shelter-voice-lines.mjs
   ```

3. Edit `assets/voice/shelter/sbv2.config.json` for the installed model:

   - `serverUrl`
   - `modelName` or `modelId`
   - `speakerName` or `speakerId`
   - `language`
   - per-emotion style names and weights

4. Generate a small test batch first:

   ```powershell
   node .\scripts\generate-sbv2-shelter-voice-bank.mjs --limit 5
   ```

5. Build the runtime manifest from files that actually exist:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-voice-manifest.ps1
   ```

6. Generate audition presets when comparing voice directions:

   ```powershell
   node .\scripts\generate-sbv2-shelter-voice-presets.mjs --overwrite
   ```

7. Open `voice-audition.html` from the local dev server to compare and select
   presets. The selected preset is stored in browser localStorage and is used by
   the main game voice loader.

## Notes

- SBV2's official language enum is `JP`, `EN`, and `ZH`; JP-Extra models can only synthesize `JP`.
- The current game dialogue is Korean. If the chosen SBV2 model does not handle
  Korean text well, keep `text` as the Korean subtitle and add a separate
  `voiceText` suitable for the model.
- Start with `--limit 5` and review the files before generating the full bank.
- The game intentionally has no browser TTS fallback. Missing files are silent.

## Current local setup

- SBV2 checkout: `D:\Style-Bert-VITS2`
- FastAPI endpoint: `http://127.0.0.1:5000`
- Test model: `jvnv-F2-jp` / `modelId: 2` / `language: JP`
- Current tone target: calm cool-beauty bishoujo, restrained and low-emotion
  while keeping a lightly polished anime voice.
- Runtime playback tuning: `playbackRate: 1.04` and `preservesPitch: false`.
  This keeps only a small pitch lift; most of the cold tone comes from neutral
  SBV2 style weights and restrained Japanese `voiceText`.
- Audition presets include raw installed model checks (`model-amitaro`,
  `model-jvnv-f1`, `model-jvnv-f2`, `model-koharune-ami`, `model-jvnv-m1`,
  `model-jvnv-m2`) plus tuned directions (`calm-bishoujo`, `cool-beauty`,
  `proud-commanding`, `elegant-beauty`, and `mature-cool`).
- Additional downloaded model: `Mofa-Xingche/girl-style-bert-vits2-JPExtra-models`
  installed as `D:\Style-Bert-VITS2\model_assets\girl-jp-extra`.
  It is MIT-licensed and adds audition presets `new-amazingood`,
  `new-calmcloud`, `new-coolcute`, `new-finecrystal`, and `new-lightfire`.
- Additional downloaded RikkaBotan models installed as
  `D:\Style-Bert-VITS2\model_assets\rikka-cool`,
  `D:\Style-Bert-VITS2\model_assets\rikka-sweet`, and
  `D:\Style-Bert-VITS2\model_assets\rikka-asmr`. They are CC BY-SA 4.0
  Hugging Face models and add audition presets `rikka-cool`, `rikka-sweet`,
  and `rikka-asmr`.
- The first two shelter lines have Japanese `voiceText` and generated wav files.
  Direct Korean input produced unusably short output with the JP model.

## Useful checks

```powershell
node --check .\scripts\generate-shelter-voice-lines.mjs
node --check .\scripts\generate-sbv2-shelter-voice-bank.mjs
node .\scripts\generate-shelter-voice-lines.mjs --dry-run
```
