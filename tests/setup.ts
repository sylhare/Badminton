import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(async () => {
  cleanup();
  await new Promise(resolve => setTimeout(resolve, 0));
});

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      clearRect: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
    })),
  });
}

/**
 * Mock requestAnimationFrame and cancelAnimationFrame (only in browser environment).
 * Uses writable and configurable properties so vi.useFakeTimers() can override them.
 */
if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'undefined') {
  Object.defineProperty(window, 'requestAnimationFrame', {
    writable: true,
    configurable: true,
    value: vi.fn((cb) => setTimeout(cb, 16)),
  });
}

if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'undefined') {
  Object.defineProperty(window, 'cancelAnimationFrame', {
    writable: true,
    configurable: true,
    value: vi.fn((id) => clearTimeout(id)),
  });
}

/** Mock window dimensions for canvas sizing */
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 768,
  });
}