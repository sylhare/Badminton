import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { engineSA } from '../../src/engines/SimulatedAnnealingEngine.ts';
import { engineSL } from '../../src/engines/SmartEngine.ts';
import type { Court } from '../../src/types';
import { pairKey } from '../../src/utils/playerUtils';
import type { SimEngine } from '../simulation/types.ts';
import { calculateTeamStrength, loadConfig, simulateMatchOutcome } from '../simulation/utils.ts';

import { buildPlayers } from './storage.ts';
import type { RawConfigFile, UiEngine } from './types.ts';

/**
 * Direct-engine baseline for the UI comparison: same shipped engines (default
 * config), players, courts, rounds and teammate-repeat metric as the harness,
 * so any gap versus the UI is a browser effect, not a config or player-mix one.
 */

const SCRIPT_DIR = import.meta.dirname;
const DATA_DIR = resolve(SCRIPT_DIR, '..', 'data');
const OUT_DIR = resolve(DATA_DIR, 'ui');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');
/** Sessions per engine; enough for stable rates. */
const RUNS = 100;

interface EngineBaseline {
  timePerRoundMs: number;
  zeroRepeatPct: number;
  avgRepeatPairs: number;
  perfectBalancedPct: number;
  strongerWinPct: number;
}

function runEngine(engine: SimEngine, players: ReturnType<typeof buildPlayers>, courts: number, rounds: number): EngineBaseline {
  const levels = new Map(players.map(p => [p.id, p.level]));
  let genMs = 0;
  let genCalls = 0;
  let zeroRuns = 0;
  let totalRepeatPairs = 0;
  let matches = 0;
  let perfect = 0;
  let strongerWon = 0;

  for (let run = 0; run < RUNS; run++) {
    engine.resetHistory();
    const pairRounds = new Map<string, number>();

    for (let r = 0; r < rounds; r++) {
      const t0 = Date.now();
      const generated = engine.generate(players, courts).courts;
      genMs += Date.now() - t0;
      genCalls += 1;

      const decided: Court[] = [];
      for (const court of generated) {
        if (!court.teams) continue;
        const { team1, team2 } = court.teams;
        if (team1.length < 2 || team2.length < 2) continue;

        const k1 = pairKey(team1[0].id, team1[1].id);
        const k2 = pairKey(team2[0].id, team2[1].id);
        pairRounds.set(k1, (pairRounds.get(k1) ?? 0) + 1);
        pairRounds.set(k2, (pairRounds.get(k2) ?? 0) + 1);

        const s1 = calculateTeamStrength(team1, levels);
        const s2 = calculateTeamStrength(team2, levels);
        const winner = simulateMatchOutcome(s1, s2);
        matches += 1;
        if (s1 === s2) perfect += 1;
        if (winner === (s1 >= s2 ? 1 : 2)) strongerWon += 1;
        decided.push({ ...court, winner });
      }
      engine.recordWins?.(decided);
    }

    const repeatPairs = [...pairRounds.values()].filter(c => c > 1).length;
    totalRepeatPairs += repeatPairs;
    if (repeatPairs === 0) zeroRuns += 1;
  }

  return {
    timePerRoundMs: genCalls ? genMs / genCalls : 0,
    zeroRepeatPct: (zeroRuns / RUNS) * 100,
    avgRepeatPairs: totalRepeatPairs / RUNS,
    perfectBalancedPct: matches ? (perfect / matches) * 100 : 0,
    strongerWinPct: matches ? (strongerWon / matches) * 100 : 0,
  };
}

function main(): void {
  const raw = loadConfig(CONFIG_PATH) as unknown as RawConfigFile;
  const ui = raw.ui ?? {};
  const courts = raw.numCourts ?? 4;
  const rounds = ui.rounds ?? 10;
  const playerCount = ui.playerCount ?? 16;
  const players = buildPlayers(playerCount, raw.playerProfiles ?? {});

  const engines: Record<UiEngine, SimEngine> = { sa: engineSA, sl: engineSL };
  const wanted = (ui.engines ?? ['sa', 'sl']) as UiEngine[];

  console.log(`Engine baseline (matched to UI): ${playerCount} players, ${courts} courts, ${rounds} rounds, ${RUNS} runs`);
  const out: Record<string, unknown> = { params: { playerCount, courts, rounds, runs: RUNS } };
  for (const e of wanted) {
    const res = runEngine(engines[e], players, courts, rounds);
    out[e] = res;
    console.log(`  ${e.toUpperCase()}: zero-repeat ${res.zeroRepeatPct.toFixed(1)}% | avg repeats ${res.avgRepeatPairs.toFixed(2)} | ${res.timePerRoundMs.toFixed(2)} ms/round | balanced ${res.perfectBalancedPct.toFixed(1)}%`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'engine_baseline.json'), JSON.stringify(out, null, 2));
  console.log(`\n✓ Wrote ${resolve(OUT_DIR, 'engine_baseline.json')}`);
}

main();
