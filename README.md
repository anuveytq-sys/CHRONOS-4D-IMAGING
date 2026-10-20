# CHRONOS 4D IMAGING

A browser-based temporal-media research interface. Phase 1 establishes the command-center UI and local-media workflow.

## Phase 1 — Interface Foundation
- Central Temporal Reality Viewport with local video import and browser playback.
- Timeline seeking, playback speed, mute, seeking, and approximate frame-step controls.
- Mission Control, Session Telemetry, Temporal Layers, Reality Analysis, Event Inspector, and System Telemetry panels.
- Timestamp bookmarks, local playback commands, settings, and keyboard shortcuts.
- Future engines remain clearly marked as planned until implemented.

## Scope and safety
Phase 1 does not perform temporal fusion, automated event detection, reconstruction, motion tracking, future prediction, or AI reasoning. Frame stepping is approximate because browser video APIs do not reliably expose source FPS.

The OpenRouter key field is not saved or transmitted by this static frontend. Never commit API keys or embed secrets in public client-side code. Secure AI integration is planned for Phase 5.

## Run locally
Open `index.html` in a modern browser. Video is handled locally by the browser; the interface does not upload the original recording.

## GitHub Pages
The workflow at `.github/workflows/pages.yml` deploys the repository root when changes reach `main` or when manually triggered. Merge the reviewed Phase 1 pull request into `main`, then check **Settings → Pages** and the Actions workflow status. A live URL is not confirmed until deployment succeeds.

## Roadmap
1. CHRONOS Interface
2. Temporal Vision Engine
3. Time Navigator & Temporal Reconstruction
4. Futurecast & Alternate Timelines
5. AI Command System & Intelligence
6. CHRONOS OMEGA integration, optimization, testing, and release
