import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

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

/**
 * Load the app. The seed state is injected by a context init script (see
 * `runCell`), so a single navigation is enough — the app reads it on mount.
 */
async function load(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByTestId('generate-assignments-button')).toBeVisible();
  // Disable transitions/animations so crown/score badges don't make elements
  // "unstable" for clicks under load.
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;}' });
}

/** Click Generate and wait for the courts to render, returning the elapsed ms. */
async function timedGenerate(page: Page): Promise<number> {
  const start = Date.now();
  await page.getByTestId('generate-assignments-button').click();
  await expect(page.locator('.court-card').first()).toBeVisible({ timeout: 15_000 });
  return Date.now() - start;
}

const teamLevel = (names: string[], levels: Record<string, number>): number =>
  names.reduce((sum, n) => sum + (levels[n.trim()] ?? DEFAULT_LEVEL), 0);

/**
 * Decide every court on the board for one round: read each court's two teams,
 * pick a winner by team strength (same logistic model as the engine sim), click
 * that team (SL enters a matching score), and record the match. Mirrors a real
 * user recording all court results before regenerating.
 */
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
    if (team1.length === 0 || team2.length === 0) continue; // bye / singles placeholder

    const l1 = teamLevel(team1, levels);
    const l2 = teamLevel(team2, levels);
    const winner = simulateMatchOutcome(l1, l2);

    const clickable = page.getByTestId(`court-${ci + 1}`).locator('.team-clickable');
    await (winner === 1 ? clickable.first() : clickable.last()).click({ timeout: 8000 });
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

/**
 * Run one full session: load, then each round generate and record a realistic
 * winner on every court, with a final regenerate to commit the last round.
 */
export async function runSession(
  page: Page,
  courts: number,
  rounds: number,
  engine: UiEngine,
  levels: Record<string, number>,
): Promise<SessionOutput> {
  const mainPage = new MainPage(page);
  await load(page);
  await mainPage.setCourtCount(courts);

  const latencies: number[] = [];
  const matchEvents: SessionOutput['matchEvents'] = [];
  for (let r = 0; r < rounds; r++) {
    latencies.push(await timedGenerate(page));
    matchEvents.push(...await decideAllCourts(page, mainPage, engine, r + 1, levels));
  }
  // Final regenerate commits the last round's winners into the engine's tally.
  latencies.push(await timedGenerate(page));

  // Let the debounced save flush before reading it back.
  await page.waitForTimeout(400);
  const raw = await page.evaluate(key => localStorage.getItem(key) ?? '', STATE_KEY);

  return { latencies, raw, matchEvents };
}
