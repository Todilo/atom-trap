# Backlog

Open items picked up along the way, with the milestone they belong to (ADR-0010).

| Item | Milestone | Notes |
|---|---|---|
| **Board doesn't fit in a normal browser tab** (it's fine when installed). | M0 fix, done | The size used `vh`, which ignores Chrome's address bar. Switched to `dvh`/`dvw` (dynamic viewport units). Check again on the phone. |
| **"Rotate your device" when auto-rotate is off.** A web page can't rotate the phone's screen itself. The orientation lock only works installed/fullscreen. If auto-rotate is off, a browser tab stays portrait forever. | M6 | Option: when in portrait, draw the whole game rotated 90° with CSS, so turning the phone sideways just works even with auto-rotate off. The input mapping must rotate too. Decide in M6. |
| GitHub Actions: `actions/deploy-pages@v4` runs on deprecated Node 20 | M6 | Bump action versions. |
