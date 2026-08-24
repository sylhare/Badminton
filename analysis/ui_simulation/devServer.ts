import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitUntilUp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUp(url)) return;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Dev server did not come up at ${url} within ${timeoutMs}ms`);
}

export interface DevServer {
  url: string;
  stop: () => void;
}

/** Ensure a Vite dev server at `baseURL`: reuse a running one, else spawn `npm run dev` and kill its process group on stop. */
export async function ensureDevServer(baseURL: string): Promise<DevServer> {
  if (await isUp(baseURL)) {
    console.log(`Reusing dev server already running at ${baseURL}`);
    return { url: baseURL, stop: () => {} };
  }

  console.log('Starting dev server (npm run dev)…');
  const child: ChildProcess = spawn('npm', ['run', 'dev'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();

  await waitUntilUp(baseURL, 60_000);
  console.log(`Dev server ready at ${baseURL}`);

  return {
    url: baseURL,
    stop: () => {
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      }
    },
  };
}
