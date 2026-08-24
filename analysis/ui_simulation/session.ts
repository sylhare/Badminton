import type { Page } from '@playwright/test';

import { MainPage } from '../../e2e/support/pages/MainPage';
import { DEFAULT_LEVEL } from '../../src/types';
import { simulateMatchOutcome } from '../simulation/utils.ts';

import { STATE_KEY } from './storage';
import type { UiEngine, UiMatchEvent } from './types';

export interface SessionOutput {
  /** Latency (ms) of every generate/regenerate call in the session. */
  latencies: number[];
  /** Raw localStorage value after the session, for metric extraction. */
  raw: string;
  /** Every court decided during the session, with its realistic outcome. */
  matchEvents: Array<Omit<UiMatchEvent, 'engine' | 'concurrency' | 'sessionId'>>;
}

/** Load the app via the shared page object; seed state is injected before navigation (see `runCell`). */
async function load(page: Page, mainPage: MainPage): Promise<void> {
  await mainPage.goto();
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;}' });
}

/** Regenerate via the shared page object and return the elapsed ms. */
async function timedGenerate(mainPage: MainPage): Promise<number> {
  const start = Date.now();
  await mainPage.regenerate(15_000);
  return Date.now() - start;
}

const teamLevel = (names: string[], levels: Record<string, number>): number =>
  names.reduce((sum, n) => sum + (levels[n.trim()] ?? DEFAULT_LEVEL), 0);

/** Decide every court for one round: pick a winner by team strength, click it (SL enters a score), record the match. */
async function decideAllCourts(
  page: Page,
  mainPage: MainPage,
  engine: UiEngine,
  round: number,
  levels: Record<string, number>,
): Promise<Array<Omit<UiMatchEvent, 'engine' | 'concurrency' | 'sessionId'>>> {
  const events: Array<Omit<UiMatchEvent, 'engine' | 'concurrency' | 'sessionId'>> = [];
  const courtCount = await page.locator('.court-card').count();

  for (let ci = 0; ci < courtCount; ci++) {
    const court = mainPage.court(ci + 1);
    const [team1, team2] = await Promise.all([court.getTeamPlayers(1), court.getTeamPlayers(2)]);
    if (team1.length === 0 || team2.length === 0) continue;

    const l1 = teamLevel(team1, levels);
    const l2 = teamLevel(team2, levels);
    const winner = simulateMatchOutcome(l1, l2);

    await court.clickTeam(winner, { timeout: 8000 });
    if (engine === 'sl') {
      await mainPage.enterScore(winner === 1 ? '21' : '15', winner === 1 ? '15' : '21');
    }

    events.push({
      round,
      courtIndex: ci + 1,
      team1: team1.map(n => n.trim()).join('|'),
      team2: team2.map(n => n.trim()).join('|'),
      team1Level: l1,
      team2Level: l2,
      strengthDiff: Math.abs(l1 - l2),
      winner,
      strongerTeamWon: winner === (l1 >= l2 ? 1 : 2),
    });
  }
  return events;
}

/** Run one full session: load, then per round generate and decide every court, with a final commit regenerate. */
export async function runSession(
  page: Page,
  courts: number,
  rounds: number,
  engine: UiEngine,
  levels: Record<string, number>,
): Promise<SessionOutput> {
  const mainPage = new MainPage(page);
  await load(page, mainPage);
  await mainPage.setCourtCount(courts);

  const latencies: number[] = [];
  const matchEvents: SessionOutput['matchEvents'] = [];
  for (let r = 0; r < rounds; r++) {
    latencies.push(await timedGenerate(mainPage));
    matchEvents.push(...await decideAllCourts(page, mainPage, engine, r + 1, levels));
  }
  latencies.push(await timedGenerate(mainPage));

  const raw = await readStableState(page);
  return { latencies, raw, matchEvents };
}

/** Read persisted state once the debounced save settles: poll until two reads match, capped at 400ms. */
async function readStableState(page: Page): Promise<string> {
  const readKey = (): Promise<string> =>
    page.evaluate(key => localStorage.getItem(key) ?? '', STATE_KEY);
  const deadline = Date.now() + 400;
  let prev = await readKey();
  while (Date.now() < deadline) {
    await page.waitForTimeout(50);
    const next = await readKey();
    if (next && next === prev) return next;
    prev = next;
  }
  return prev;
}
