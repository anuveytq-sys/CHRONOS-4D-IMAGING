# CHRONOS 4D IMAGING

A browser-based temporal-media research interface. Phase 1 establishes the command-center UI and local-media workflow.

## Phase 1 — Interface Foundation
- Central Temporal Reality Viewport with local video import and browser playback.
- Timeline seeking, playback speed, mute, seeking, and approximate frame-step controls.
- Mission Control, Session Telemetry, Temporal Layers, Reality Analysis, Event Inspector, and System Telemetry panels.
- Timestamp bookmarks, local playback commands, settings, and keyboard shortcuts.
- Future engines remain clearly marked as planned until implemented.

## Phase 2 — Temporal Vision Engine
- Local video frame sampling and extraction, temporal fusion, and distinct Time Echo, Temporal Ghosting, Motion Trails, Chrono Freeze, Frame Stack, Event Highlighting, and frame comparison views.
- Phase 2 processing remains browser-local and does not upload the original recording.

## Phase 3 — Time Navigator & Temporal Reconstruction
- Direct timestamp navigation, approximate frame stepping, speed-aware reverse stepping, and a visual timeline.
- Timestamp bookmarks, frame-snapshot checkpoints, manual annotations, and automatic visual-change candidates are separate marker types.
- Multi-moment comparison grid with timestamped captured frames and controls to seek the shared source timeline.
- Heuristic candidate detection for strong visual changes and possible motion onset/offset, direction changes, or edge-entry/exit patterns. These are suggestions for review, not verified object tracking or scientific conclusions.
- Interpolated visual blends and sampled motion-trail overlays are clearly labeled as estimates. They do not recover unrecorded history, guarantee motion-compensated reconstruction, or create a true 3D/4D scene.
- Session marker timestamps and notes can be exported as JSON. Captured frames and processing remain local to the browser.

## Scope and safety
Phase 1 is the interface foundation; Phase 2 and Phase 3 add the temporal-media tools described above. Frame stepping remains approximate when source FPS metadata is unavailable. Phase 3 event detection uses downsampled visual differences and must be reviewed by a human; interpolation is a visual blend rather than true 3D reconstruction.

The OpenRouter key field is not saved or transmitted by this static frontend. Never commit API keys or embed secrets in public client-side code. Secure AI integration is planned for Phase 5.

## Run locally
Open `index.html` in a modern browser. Video is handled locally by the browser; the interface does not upload the original recording.

## GitHub Pages
The workflow at `.github/workflows/pages.yml` deploys the repository root when changes reach `main` or when manually triggered. Check **Settings → Pages** and the Actions workflow status; a live URL is not confirmed until deployment succeeds.

## Roadmap
1. CHRONOS Interface
2. Temporal Vision Engine
3. Time Navigator & Temporal Reconstruction
4. Futurecast & Alternate Timelines
5. AI Command System & Intelligence
6. CHRONOS OMEGA integration, optimization, testing, and release
