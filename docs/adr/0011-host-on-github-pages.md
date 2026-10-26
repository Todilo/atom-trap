# ADR-0011: Host on GitHub Pages from a public repo, deployed by GitHub Actions

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

An installable PWA must be served over HTTPS (ADR-0001). Milestone M0 (ADR-0010) needs a hosting path before any game code. The options were GitHub Pages, Cloudflare Pages, and Netlify/Vercel, all free at this scale. The owner is fine with a public repository.

## Decision

- The code lives in a **public GitHub repository**.
- A **GitHub Actions** workflow builds the Vite app on every push to the default branch and publishes it to **GitHub Pages**.
- The site is served under the repository path (`https://<user>.github.io/<repo>/`). Vite's `base`, the manifest's `start_url`/`scope` and the service worker scope must all use that path.

## Consequences

- A push to the default branch is a release. No other release step is needed.
- Everything in the repo is public, so it must contain **only our own work**: no original JezzBall code, graphics, sounds or help text. The rules docs describe facts in our own words. The downloaded original files stay outside the repo.
- Because the site lives under a sub-path, every asset URL must be relative to `base`. This is easy to get wrong, so check it during M0.
- Moving later to a custom domain or another host only changes the deploy workflow and `base`.
