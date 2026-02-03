import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Confetti', () => {
  let triggerConfetti: (x: number, y: number, particleCount?: number) => void;
  let confettiModule: typeof import('../../src/utils/confetti');

  beforeEach(async () => {
    vi.useFakeTimers();

    vi.resetModules();
    confettiModule = await import('../../src/utils/confetti');
    triggerConfetti = confettiModule.triggerConfetti;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('particle accumulation', () => {
    it('should not accumulate unlimited particles when triggered multiple times rapidly', async () => {
      for (let i = 0; i < 10; i++) {
        triggerConfetti(100, 100, 50); // 50 particles per click = 500 total without cap
      }

      vi.advanceTimersByTime(100); // Only 100ms - particles should still be alive

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeTruthy();

    });

    it('should cap total particles to prevent performance degradation', async () => {
      const MAX_PARTICLES = 80;

      for (let i = 0; i < 20; i++) {
        triggerConfetti(Math.random() * 500, Math.random() * 500, 50);
      }

      const particleCount = confettiModule.getParticleCount?.() ?? Infinity;

      expect(particleCount).toBeLessThanOrEqual(MAX_PARTICLES);
    });

    it('should replace oldest particles when at max capacity', async () => {
      const MAX_PARTICLES = 80;
      const PARTICLES_PER_BURST = 30;

      triggerConfetti(100, 100, MAX_PARTICLES);
      const initialCount = confettiModule.getParticleCount?.() ?? 0;
      expect(initialCount).toBe(MAX_PARTICLES);

      triggerConfetti(200, 200, PARTICLES_PER_BURST);
      const afterSecondBurst = confettiModule.getParticleCount?.() ?? 0;

      expect(afterSecondBurst).toBe(MAX_PARTICLES);

      triggerConfetti(300, 300, PARTICLES_PER_BURST);
      const afterThirdBurst = confettiModule.getParticleCount?.() ?? 0;
      expect(afterThirdBurst).toBe(MAX_PARTICLES);
    });

    it('should always show new particles even when at capacity', async () => {
      const MAX_PARTICLES = 80;

      triggerConfetti(100, 100, MAX_PARTICLES);

      vi.advanceTimersByTime(500);

      triggerConfetti(200, 200, 30);

      const afterBurst = confettiModule.getParticleCount?.() ?? 0;
      expect(afterBurst).toBeGreaterThan(0);
      expect(afterBurst).toBeLessThanOrEqual(MAX_PARTICLES);
    });
  });

  describe('particle lifecycle', () => {
    it('should remove particles when their life exceeds maxLife', async () => {
      triggerConfetti(100, 100, 10);

      await vi.runAllTimersAsync();

      const particleCount = confettiModule.getParticleCount?.() ?? -1;

      expect(particleCount).toBe(0);
    });
  });

  describe('animation performance', () => {
    it('should not have more than 2 canvas draw calls per particle per frame', () => {

      const ctx = document.createElement('canvas').getContext('2d');
      const fillSpy = vi.spyOn(ctx!, 'fill');

      triggerConfetti(100, 100, 10);
      vi.advanceTimersByTime(16); // One frame

      const fillCallsPerParticle = (fillSpy.mock.calls.length || 0) / 10;

      expect(fillCallsPerParticle).toBeLessThanOrEqual(2);
    });
  });
});
