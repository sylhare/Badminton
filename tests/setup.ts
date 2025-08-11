import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock canvas context for confetti effect (only in jsdom environment)
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

// Mock requestAnimationFrame and cancelAnimationFrame (only in browser environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'requestAnimationFrame', {
    value: vi.fn((cb) => setTimeout(cb, 16)),
  });

  Object.defineProperty(window, 'cancelAnimationFrame', {
    value: vi.fn((id) => clearTimeout(id)),
  });

  // Mock window dimensions for canvas sizing
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