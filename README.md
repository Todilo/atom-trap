# Atom Trap

*A neon tribute to JezzBall (1992).* Trap bouncing atoms by building walls, clear 75% of the chamber, then move on to the next level. Atom Trap is an installable web game (PWA) built with TypeScript, Vite and PixiJS.

**Play:** https://todilo.github.io/atom-trap/. On Android, open it in Chrome and choose *Install app*.

## How to play

- **Goal:** trap the bouncing atoms by building walls. Clear 75% of the chamber to reach the next level, and each level adds an atom.
- **Touch:** put your finger where a wall should start, then swipe. Sideways builds a horizontal wall, up or down a vertical one.
- **Mouse:** left-click builds a wall, right-click switches between vertical and horizontal.
- **Careful:** a wall is fragile while it grows. An atom that touches it breaks it and costs a life. Bigger clears earn bonus points for coverage above 80% and 90%, lives left and time left.
- **Continue** starts at your highest level, but the score doesn't count for the high-score table.
- **Speed: Slow** (title screen) runs at half speed for half points, like the original's Slow option. Music, sound and vibration have their own switches.

## Develop

```bash
npm install
npm run dev
```

`npm run build` type-checks and builds to `dist/`. Every push to `main` deploys to GitHub Pages.

## Docs

- [CONTEXT.md](CONTEXT.md): the domain glossary
- [docs/classic-rules.md](docs/classic-rules.md): the Classic mode rules spec
- [docs/adr/](docs/adr/): architecture decision records

## Credits

Atom Trap is an independent fan remake. It is not affiliated with or endorsed by Microsoft. JezzBall was created by Dima Pavlovsky and published by Microsoft in 1992. All code, art and sound in this repository are original.
