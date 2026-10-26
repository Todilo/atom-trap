# ADR-0012: The game is called "Atom Trap"

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

"JezzBall" is Microsoft's name for the 1992 original. The remake is public (ADR-0011), and its name appears in the repo, the URL, the page title, the PWA manifest and the home-screen label. Using the original's name for a public remake is avoidable risk.

## Decision

- The game's name is **Atom Trap**. The slug is `atom-trap`, used for the GitHub repo and so the Pages URL `https://<user>.github.io/atom-trap/`.
- Tagline: **"Atom Trap: a neon tribute to JezzBall (1992)"**. The original may be named only as an acknowledgement in the description, About screen and README, never as the product name.
- The manifest's `name` and `short_name` are both `Atom Trap` (9 characters, so it fits a home-screen label).

## Consequences

- No original branding appears in the product: no JezzBall name as the title, no original logo, art or sounds.
- Internal docs can keep referring to "the original" and quote its rule terms (atom, wallbuilder) when describing it.
- The local working folder (`JezzBall`) doesn't need renaming. Only the repo and the published app carry the name.
