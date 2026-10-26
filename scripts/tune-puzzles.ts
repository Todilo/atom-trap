// Plays every puzzle many times with the bot (src/game/bot.ts) and suggests pars from the results.
// Run with `npm run tune-puzzles` (optionally `-- 1000` for runs per puzzle). Copy the suggested pars
// into PUZZLES in src/game/puzzles.ts, then adjust them from real play.
//
// The bot looks ahead on a copy of the game, which no human can, so its best results are out of reach.
// Instead: three stars at the expert bot's typical result, two stars at the casual bot's.
import { CASUAL, EXPERT, medianWalls, parFromRuns, playPuzzleBot, type BotOptions } from '../src/game/bot';
import { PUZZLES, type Puzzle } from '../src/game/puzzles';

const runs = Number(process.argv[2]) || 400;

function play(p: Puzzle, options: BotOptions) {
  const walls: number[] = [];
  let livesLost = 0;
  for (let r = 0; r < runs; r++) {
    const result = playPuzzleBot(p, 1000 + r, options);
    livesLost += result.livesLost;
    if (result.cleared) walls.push(result.walls);
  }
  return { walls, cleared: walls.length / runs, median: medianWalls(walls), livesLost: livesLost / runs };
}

console.log(`Bot results, ${runs} runs per puzzle and skill\n`);
console.log('#   Puzzle            Atoms  Expert: cleared  walls  lives lost   Casual: cleared  walls  lives lost   Par now  Suggested');
PUZZLES.forEach((p, i) => {
  const expert = play(p, EXPERT);
  const casual = play(p, CASUAL);
  const [three, two] = parFromRuns(expert.walls, casual.walls);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  console.log(
    [
      String(i + 1).padEnd(3),
      p.name.padEnd(17),
      String(p.atoms).padStart(5),
      pct(expert.cleared).padStart(16),
      String(expert.median).padStart(5),
      expert.livesLost.toFixed(2).padStart(11),
      pct(casual.cleared).padStart(16),
      String(casual.median).padStart(5),
      casual.livesLost.toFixed(2).padStart(11),
      `[${p.par.join(', ')}]`.padStart(9),
      `[${three}, ${two}]`.padStart(10),
    ].join('  '),
  );
});
