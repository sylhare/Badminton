import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  importCount: 0,
  cv: null as unknown,
  throwOnce: false,
}));

vi.mock('@techstark/opencv-js', () => ({
  get default() {
    h.importCount++;
    if (h.throwOnce) {
      h.throwOnce = false;
      throw new Error('boom');
    }
    return h.cv;
  },
}));

async function freshLoader() {
  vi.resetModules();
  return import('../../src/utils/opencvLoader');
}

function makeCv() {
  return { setLogLevel: vi.fn(), LOG_LEVEL_SILENT: 0 };
}

describe('opencvLoader', () => {
  beforeEach(() => {
    h.importCount = 0;
    h.throwOnce = false;
    h.cv = makeCv();
  });

  it('returns the resolved cv module and silences logging', async () => {
    const cv = makeCv();
    h.cv = cv;

    const { loadOpenCV } = await freshLoader();
    const result = await loadOpenCV();

    expect(result).toBe(cv);
    expect(cv.setLogLevel).toHaveBeenCalledWith(0);
  });

  it('only imports once across concurrent calls', async () => {
    const { loadOpenCV } = await freshLoader();
    const [a, b] = await Promise.all([loadOpenCV(), loadOpenCV()]);

    expect(a).toBe(b);
    expect(h.importCount).toBe(1);
  });

  it('reuses the cached instance on subsequent calls', async () => {
    const { loadOpenCV } = await freshLoader();
    const first = await loadOpenCV();
    const second = await loadOpenCV();

    expect(first).toBe(second);
    expect(h.importCount).toBe(1);
  });

  it('clears the in-flight promise on failure so a later call can retry', async () => {
    h.throwOnce = true;
    const cv = makeCv();
    h.cv = cv;

    const { loadOpenCV } = await freshLoader();
    await expect(loadOpenCV()).rejects.toThrow('boom');

    const result = await loadOpenCV();
    expect(result).toBe(cv);
    expect(h.importCount).toBe(2);
  });
});
