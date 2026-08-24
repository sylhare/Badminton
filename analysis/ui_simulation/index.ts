import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium, type Browser } from 'playwright';

import { pairKey } from '../../src/utils/playerUtils';
import { loadConfig, toCsv } from '../simulation/utils.ts';

import { ensureDevServer } from './devServer.ts';
import { ResourceSampler } from './resources.ts';
import { runSession } from './session.ts';
import { buildPlayers, buildSeedState, decodePlayerStats, decodeState, deriveSessionResult, levelByName, STATE_KEY } from './storage.ts';
import type {
  ConcurrencySummary,
  GenerateEvent,
  ResourceSample,
  SessionResult,
  UiConfig,
  UiEngine,
  UiMatchEvent,
  UiPlayerStat,
  RawConfigFile,
} from './types.ts';

const SCRIPT_DIR = import.meta.dirname;
const DATA_DIR = resolve(SCRIPT_DIR, '..', 'data');
const OUT_DIR = resolve(DATA_DIR, 'ui');
const CONFIG_PATH = resolve(DATA_DIR, 'config.json');
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

/** Fallback when config.json omits the `ui` block. */
const DEFAULT_UI: UiConfig = {
  engines: ['sa', 'sl'],
  concurrency: [1, 2, 4, 8],
  durationSec: 45,
  runs: 4,
  rounds: 10,
  playerCount: 16,
  sampleIntervalMs: 250,
  headless: true,
};

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Pairwise teammate keys within one team roster ("A|B" -> ["A|B"]). */
const teamPairs = (roster: string): string[] => {
  const p = roster.split('|').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) out.push(pairKey(p[i], p[j]));
  return out;
};

/** Teammate-repeat stats from the rounds observed in the DOM; matches the engine baseline's definition. */
function observedRepeats(events: Array<{ team1: string; team2: string }>): {
  teammatePairs: number; repeatTeammatePairs: number; repeatTeammateEvents: number;
} {
  const counts = new Map<string, number>();
  for (const e of events) {
    for (const k of [...teamPairs(e.team1), ...teamPairs(e.team2)]) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let teammatePairs = 0, repeatTeammatePairs = 0, repeatTeammateEvents = 0;
  for (const c of counts.values()) {
    teammatePairs += 1;
    if (c > 1) { repeatTeammatePairs += 1; repeatTeammateEvents += c - 1; }
  }
  return { teammatePairs, repeatTeammatePairs, repeatTeammateEvents };
}

interface CellConfig {
  sessions: number;
  durationSec?: number;
  rounds: number;
  courts: number;
  seedState: string;
  players: ReturnType<typeof buildPlayers>;
  levels: Record<string, number>;
}

interface CellOutput {
  results: SessionResult[];
  events: GenerateEvent[];
  matchEvents: UiMatchEvent[];
  playerStats: UiPlayerStat[];
  wallMs: number;
}

/** Run `concurrency` sessions in parallel: an equal-time window when `durationSec` is set, else a fixed `sessions` count. */
async function runCell(browser: Browser, engine: UiEngine, concurrency: number, cfg: CellConfig): Promise<CellOutput> {
  const contexts = await Promise.all(
    Array.from({ length: concurrency }, async () => {
      const ctx = await browser.newContext({ baseURL: BASE_URL });
      await ctx.addInitScript(
        ([key, value]) => localStorage.setItem(key, value),
        [STATE_KEY, cfg.seedState] as const,
      );
      return ctx;
    }),
  );
  const pages = await Promise.all(contexts.map(c => c.newPage()));

  const results: SessionResult[] = [];
  const events: GenerateEvent[] = [];
  const matchEvents: UiMatchEvent[] = [];
  const playerStats: UiPlayerStat[] = [];
  let nextId = 0;
  const wallStart = Date.now();
  const deadline = cfg.durationSec ? wallStart + cfg.durationSec * 1000 : 0;

  const worker = async (page: (typeof pages)[number]): Promise<void> => {
    for (;;) {
      if (deadline ? Date.now() >= deadline : nextId >= cfg.sessions) break;
      const sessionId = nextId++;

      try {
        const started = Date.now();
        const out = await runSession(page, cfg.courts, cfg.rounds, engine, cfg.levels);
        const totalMs = Date.now() - started;

        out.latencies.forEach((latencyMs, i) =>
          events.push({ engine, concurrency, sessionId, round: i + 1, latencyMs }));
        for (const m of out.matchEvents) matchEvents.push({ engine, concurrency, sessionId, ...m });

        const state = await decodeState(out.raw);
        playerStats.push(...decodePlayerStats(state, { engine, concurrency, sessionId }, cfg.players));
        const derived = deriveSessionResult(
          state,
          { engine, concurrency, sessionId, players: cfg.players.length, courts: cfg.courts, rounds: cfg.rounds, totalMs },
          out.latencies,
        );
        results.push({ ...derived, ...observedRepeats(out.matchEvents) });
      } catch (err) {
        console.warn(`   ⚠ ${engine} c=${concurrency} session ${sessionId} failed: ${(err as Error).message.split('\n')[0]}`);
      }
    }
  };

  try {
    await Promise.all(pages.map(worker));
    const wallMs = Date.now() - wallStart;
    return { results, events, matchEvents, playerStats, wallMs };
  } finally {
    await Promise.all(contexts.map(c => c.close()));
  }
}

function summarise(
  engine: UiEngine,
  concurrency: number,
  results: SessionResult[],
  events: GenerateEvent[],
  samples: ResourceSample[],
  wallMs: number,
): ConcurrencySummary {
  const latencies = events.map(e => e.latencyMs).sort((a, b) => a - b);
  const cpu = samples.map(s => s.cpuPct);
  const rss = samples.map(s => s.rssMB);
  const roundsDone = events.length;
  return {
    engine,
    concurrency,
    sessions: results.length,
    wallMs,
    sessionsPerSec: wallMs ? (results.length / wallMs) * 1000 : 0,
    roundsPerSec: wallMs ? (roundsDone / wallMs) * 1000 : 0,
    p50GenerateMs: percentile(latencies, 50),
    p95GenerateMs: percentile(latencies, 95),
    meanGenerateMs: mean(latencies),
    peakCpuPct: cpu.length ? Math.max(...cpu) : 0,
    meanCpuPct: mean(cpu),
    peakRssMB: rss.length ? Math.max(...rss) : 0,
    meanRssMB: mean(rss),
  };
}

async function main(): Promise<void> {
  const raw = loadConfig(CONFIG_PATH) as unknown as RawConfigFile;
  const ui: UiConfig = { ...DEFAULT_UI, ...(raw.ui ?? {}) };
  const courts = raw.numCourts ?? 4;
  const profiles = raw.playerProfiles ?? {};
  const players = buildPlayers(ui.playerCount, profiles);
  const levels = levelByName(players);

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               UI LOAD-TEST SIMULATION                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  Engines:     ${ui.engines.join(', ')}`);
  console.log(`  Concurrency: ${ui.concurrency.join(', ')}`);
  console.log(`  Load/cell:   ${ui.durationSec ? `${ui.durationSec}s equal-time` : `${ui.runs} sessions`} × ${ui.rounds} rounds`);
  console.log(`  Players:     ${ui.playerCount} on ${courts} courts`);
  console.log(`  Base URL:    ${BASE_URL}\n`);

  mkdirSync(OUT_DIR, { recursive: true });

  const server = await ensureDevServer(BASE_URL);
  const browserServer = await chromium.launchServer({ headless: ui.headless });
  const browser = await chromium.connect(browserServer.wsEndpoint());
  const sampler = new ResourceSampler(browserServer.process()?.pid ?? process.pid, ui.sampleIntervalMs);

  const allResults: SessionResult[] = [];
  const allEvents: GenerateEvent[] = [];
  const allSamples: ResourceSample[] = [];
  const allMatchEvents: UiMatchEvent[] = [];
  const allPlayerStats: UiPlayerStat[] = [];
  const summaries: ConcurrencySummary[] = [];

  try {
    for (const engine of ui.engines) {
      const seedState = buildSeedState(players, courts, engine);
      for (const concurrency of ui.concurrency) {
        console.log(`▶ ${engine.toUpperCase()} @ concurrency ${concurrency} …`);
        sampler.start(engine, concurrency, Date.now());
        let cellSamples: ResourceSample[];
        let out: CellOutput;
        try {
          out = await runCell(browser, engine, concurrency, {
            sessions: ui.runs, durationSec: ui.durationSec, rounds: ui.rounds, courts, seedState, players, levels,
          });
        } finally {
          cellSamples = sampler.stop();
        }

        allResults.push(...out.results);
        allEvents.push(...out.events);
        allSamples.push(...cellSamples);
        allMatchEvents.push(...out.matchEvents);
        allPlayerStats.push(...out.playerStats);
        const summary = summarise(engine, concurrency, out.results, out.events, cellSamples, out.wallMs);
        summaries.push(summary);
        console.log(
          `   ${out.results.length} sessions in ${(out.wallMs / 1000).toFixed(1)}s | ` +
          `${summary.roundsPerSec.toFixed(2)} rounds/s | gen p50 ${summary.p50GenerateMs}ms p95 ${summary.p95GenerateMs}ms | ` +
          `cpu peak ${summary.peakCpuPct}% | rss peak ${summary.peakRssMB}MB`,
        );
      }
    }
  } finally {
    await browser.close();
    await browserServer.close();
    server.stop();
  }

  const writeCsv = (name: string, rows: object[]): void =>
    writeFileSync(resolve(OUT_DIR, name), toCsv(rows as Array<Record<string, string | number | boolean>>));

  writeCsv('generate_events.csv', allEvents);
  writeCsv('sessions.csv', allResults);
  writeCsv('resources.csv', allSamples);
  writeCsv('concurrency_summary.csv', summaries);
  writeCsv('match_events.csv', allMatchEvents);
  writeCsv('player_stats.csv', allPlayerStats);
  writeFileSync(resolve(OUT_DIR, 'config.json'), JSON.stringify({
    ...ui, courts, playerProfiles: profiles, baseUrl: BASE_URL, timestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`\n✓ Data saved to ${OUT_DIR}`);
  console.log('  Files: sessions.csv, generate_events.csv, resources.csv, concurrency_summary.csv, match_events.csv, player_stats.csv, config.json');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
