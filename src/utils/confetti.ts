interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  oscillation: number;
  oscillationSpeed: number;
  curliness: number;
}

export class ConfettiEffect {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: ConfettiParticle[] = [];
  private animationId: number | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    this.ctx = ctx;

    this.updateCanvasSize();
    window.addEventListener('resize', () => this.updateCanvasSize());
  }

  private updateCanvasSize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private getRandomColor(): string {
    const colors = [
      '#FFD700', // Gold
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FECA57', // Yellow
      '#FF9FF3', // Pink
      '#54A0FF', // Light Blue
      '#F8B500', // Orange
      '#A8E6CF', // Mint
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private createParticle(x: number, y: number): ConfettiParticle {
    const angle = Math.random() * Math.PI * 2;
    const velocity = 1 + Math.random() * 4; // Slower initial velocity

    return {
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - Math.random() * 3, // Less upward bias
      gravity: 0.08 + Math.random() * 0.04, // Much slower gravity
      life: 0,
      maxLife: 180 + Math.random() * 120, // Longer life (3-5 seconds at 60fps)
      color: this.getRandomColor(),
      width: 3 + Math.random() * 4, // Width for rectangular confetti
      height: 8 + Math.random() * 12, // Height - makes it longer like paper strips
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15, // Slower rotation
      oscillation: 0,
      oscillationSpeed: 0.02 + Math.random() * 0.03, // Speed of side-to-side motion
      curliness: 0.5 + Math.random() * 1.5, // How much it curves side to side
    };
  }

  public burst(x: number, y: number, particleCount: number = 50): void {
    // Create new particles
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.createParticle(x, y));
    }

    // Start animation if not already running
    if (!this.animationId) {
      document.body.appendChild(this.canvas);
      this.animate();
    }
  }

  private animate = () => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update and draw particles
    this.particles = this.particles.filter(particle => {
      // Update oscillation for curly motion
      particle.oscillation += particle.oscillationSpeed;

      // Update position with oscillating horizontal movement
      particle.x += particle.vx + Math.sin(particle.oscillation) * particle.curliness;
      particle.y += particle.vy;
      particle.vy += particle.gravity;

      // Slower rotation for more natural paper-like movement
      particle.rotation += particle.rotationSpeed;

      // Add air resistance to horizontal movement
      particle.vx *= 0.995;

      particle.life++;

      // Calculate alpha based on remaining life
      const alpha = Math.max(0, 1 - particle.life / particle.maxLife);

      if (alpha <= 0) {
        return false; // Remove particle
      }

      // Draw particle as a paper strip
      this.ctx.save();
      this.ctx.translate(particle.x, particle.y);
      this.ctx.rotate(particle.rotation);
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = particle.color;

      // Draw as a longer rectangle (paper strip) with rounded corners
      const halfWidth = particle.width / 2;
      const halfHeight = particle.height / 2;

      // Simple rounded rectangle
      this.ctx.beginPath();
      this.ctx.roundRect(-halfWidth, -halfHeight, particle.width, particle.height, 1);
      this.ctx.fill();

      // Add a subtle gradient effect for more paper-like appearance
      this.ctx.globalAlpha = alpha * 0.3;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.roundRect(-halfWidth, -halfHeight, particle.width, particle.height / 3, 1);
      this.ctx.fill();

      this.ctx.restore();

      return true; // Keep particle
    });

    // Continue animation if there are particles, otherwise clean up
    if (this.particles.length > 0) {
      this.animationId = requestAnimationFrame(this.animate);
    } else {
      this.stop();
    }
  };

  public stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.particles = [];
  }
}

// Global confetti instance
let confettiInstance: ConfettiEffect | null = null;

export const triggerConfetti = (x: number, y: number, particleCount?: number): void => {
  if (!confettiInstance) {
    confettiInstance = new ConfettiEffect();
  }
  confettiInstance.burst(x, y, particleCount);
};

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (confettiInstance) {
      confettiInstance.stop();
    }
  });
}