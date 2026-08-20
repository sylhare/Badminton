import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { ResourceSample, UiEngine } from './types';

const execFileAsync = promisify(execFile);

interface Proc { pid: number; ppid: number; cpu: number; rssKB: number }

/** Snapshot every process once, so we can walk the browser's subtree. */
async function snapshot(): Promise<Proc[]> {
  const { stdout } = await execFileAsync('ps', ['-Ao', 'pid=,ppid=,%cpu=,rss=']);
  const procs: Proc[] = [];
  for (const line of stdout.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+([\d.,]+)\s+(\d+)$/);
    if (m) procs.push({ pid: +m[1], ppid: +m[2], cpu: +m[3].replace(',', '.'), rssKB: +m[4] });
  }
  return procs;
}

/** Sum %cpu and RSS across `rootPid` and all of its descendants. */
async function measureSubtree(rootPid: number): Promise<{ cpuPct: number; rssMB: number; procCount: number }> {
  const procs = await snapshot();
  const childrenOf = new Map<number, Proc[]>();
  for (const p of procs) {
    let siblings = childrenOf.get(p.ppid);
    if (!siblings) childrenOf.set(p.ppid, siblings = []);
    siblings.push(p);
  }
  const byPid = new Map(procs.map(p => [p.pid, p]));

  let cpuPct = 0;
  let rssKB = 0;
  let procCount = 0;
  const stack = [rootPid];
  const seen = new Set<number>();
  while (stack.length) {
    const pid = stack.pop()!;
    if (seen.has(pid)) continue;
    seen.add(pid);
    const p = byPid.get(pid);
    if (p) { cpuPct += p.cpu; rssKB += p.rssKB; procCount += 1; }
    for (const c of childrenOf.get(pid) ?? []) stack.push(c.pid);
  }
  return { cpuPct, rssMB: rssKB / 1024, procCount };
}

/** Periodically samples CPU%/RSS of the browser process subtree; reused across sequential cells with the label swapped. */
export class ResourceSampler {
  private samples: ResourceSample[] = [];
  private timer: NodeJS.Timeout | null = null;
  private sampling = false;
  private startedAt = 0;
  private engine: UiEngine = 'sa';
  private concurrency = 1;

  constructor(private readonly rootPid: number, private readonly intervalMs: number) {}

  start(engine: UiEngine, concurrency: number, nowMs: number): void {
    this.engine = engine;
    this.concurrency = concurrency;
    this.startedAt = nowMs;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  private async tick(): Promise<void> {
    if (this.sampling) return;
    this.sampling = true;
    try {
      const { cpuPct, rssMB, procCount } = await measureSubtree(this.rootPid);
      this.samples.push({
        engine: this.engine,
        concurrency: this.concurrency,
        tMs: Date.now() - this.startedAt,
        cpuPct: Math.round(cpuPct * 10) / 10,
        rssMB: Math.round(rssMB),
        procCount,
      });
    } catch {} finally {
      this.sampling = false;
    }
  }

  /** Stop sampling and return this cell's samples, clearing the buffer for the next cell. */
  stop(): ResourceSample[] {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    const samples = this.samples;
    this.samples = [];
    return samples;
  }
}
