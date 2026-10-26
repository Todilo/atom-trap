# Backlog

Open items picked up along the way, with the milestone they belong to (ADR-0010).

## Done

| Item | Milestone | Notes |
|---|---|---|
| Board didn't fit in a normal browser tab | M1 | Sizing now uses dynamic viewport units and the stage's layout size. |
| "Rotate your device" when auto-rotate is off | M6 | In portrait, the game is drawn turned 90° (ADR-0013). |
| GitHub Actions on deprecated Node 20 | M6 | Actions bumped to current majors, build on Node 24. |
| Music loop too short and repetitive | M5 | 32-bar song in four sections. |
| Wall-break sound too harsh | M5 | Softer shatter. |
| Atoms looked like they collided too early | M5 | Two-phase atom update plus a contact animation and full-size atoms. |

## Ideas for after v1

| Idea | Notes |
|---|---|
| Pick the portrait rotation direction from the device sensors | Today it's always clockwise (ADR-0013). |
| Slow speed option | The ruleset already supports it (`classicRuleset(level, 'slow')`). It just needs a menu switch. |
| Extra modes | ADR-0002: new atom types, power-ups, a relaxed mode without a timer, a portrait board. |
| Play Store release | Wrap the PWA with Capacitor (ADR-0001). |
