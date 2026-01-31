const MAX_PARTICLES = 80;
const GRAVITY = 0.18;
const DRAG = 0.995;

const COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FECA57', '#FF9FF3', '#54A0FF', '#F8B500', '#A8E6CF',
];

class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 0;
  color = '';
  size = 0;
  active = false;

  init(x: number, y: number): void {
    const angle = -Math.PI + Math.random() * Math.PI;
    const speed = 5 + Math.random() * 7;
    const spread = 8;

    this.x = x + (Math.random() - 0.5) * spread;
    this.y = y + (Math.random() - 0.5) * spread;
    this.vx = Math.cos(angle) * speed * (0.6 + Math.random() * 0.4);
    this.vy = Math.sin(angle) * speed - 2;
    this.life = 0;
    this.maxLife = 45 + Math.random() * 35;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.size = 5 + Math.random() * 5;
    this.active = true;
  }

  update(): boolean {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += GRAVITY;
    this.vx *= DRAG;
    this.life++;

    if (this.life >= this.maxLife) {
      this.active = false;
      return false;
    }
    return true;
  }

  getAlpha(): number {
    return 1 - this.life / this.maxLife;
  }
}

class ConfettiEffect {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pool: Particle[];
  private activeCount = 0;
  private animationId: number | null = null;
  private isAttached = false;
  private resizeHandler: () => void;
  private width = 0;
  private height = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '9999',
    });

    const ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;

    this.pool = Array.from({ length: MAX_PARTICLES }, () => new Particle());

    this.updateSize();
    this.resizeHandler = () => this.updateSize();
    window.addEventListener('resize', this.resizeHandler);

    document.body.appendChild(this.canvas);
    this.isAttached = true;
  }

  private updateSize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  burst(x: number, y: number, count = 30): void {
    if (!this.isAttached) {
      document.body.appendChild(this.canvas);
      this.isAttached = true;
    }

    let activated = 0;

    for (const p of this.pool) {
      if (activated >= count) break;
      if (!p.active) {
        p.init(x, y);
        activated++;
      }
    }

    if (activated < count) {
      for (const p of this.pool) {
        if (activated >= count) break;
        if (p.life > p.maxLife * 0.3) {
          p.init(x, y);
          activated++;
        }
      }
    }

    this.activeCount = this.pool.filter(p => p.active).length;

    if (!this.animationId && this.activeCount > 0) {
      this.render();
      this.animationId = requestAnimationFrame(this.animate);
    }
  }

  private render(): void {
    const { ctx, pool, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    for (const p of pool) {
      if (!p.active) continue;
      const alpha = p.getAlpha();
      if (alpha <= 0) continue;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 1.5);
    }

    ctx.globalAlpha = 1;
  }

  private animate = (): void => {
    let activeCount = 0;

    for (const p of this.pool) {
      if (p.active && p.update()) {
        activeCount++;
      }
    }

    this.activeCount = activeCount;

    if (activeCount > 0) {
      this.render();
      this.animationId = requestAnimationFrame(this.animate);
    } else {
      this.stop();
    }
  };

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    for (const p of this.pool) p.active = false;
    this.activeCount = 0;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.resizeHandler);
    this.canvas.parentNode?.removeChild(this.canvas);
    this.isAttached = false;
  }

  getParticleCount(): number {
    return this.activeCount;
  }
}

let instance: ConfettiEffect | null = null;

const init = (): void => {
  if (!instance && typeof window !== 'undefined') {
    instance = new ConfettiEffect();
  }
};

export const triggerConfetti = (x: number, y: number, count?: number): void => {
  if (!instance) instance = new ConfettiEffect();
  instance.burst(x, y, count);
};

export const getParticleCount = (): number => instance?.getParticleCount() ?? 0;

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
  window.addEventListener('beforeunload', () => instance?.destroy());
}
