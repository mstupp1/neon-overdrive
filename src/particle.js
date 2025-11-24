/**
 * PARTICLE CLASS
 */

class Particle {
  constructor() {
    this.active = false;
  }
  init(x, y, color, speed = 5, size = null, isDashParticle = false) {
    this.x = x;
    this.y = y;
    const a = Math.random() * 6.28;
    this.vx = Math.cos(a) * speed;
    this.vy = Math.sin(a) * speed;
    this.life = 1;
    this.decay = rand(0.015, 0.04); // Slower decay for longer life
    this.color = color;
    this.size = size || rand(3, 8); // Variable size
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = rand(-0.2, 0.2);
    this.isDashParticle = isDashParticle; // Flag to disable upward boost scaling
    this.active = true;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98; // Slight drag
    this.vy *= 0.98;
    this.rotation += this.rotationSpeed;
    this.life -= this.decay;
    if (this.life <= 0) this.active = false;
  }
  draw(ctx) {
    // Boost glow/alpha when player pushes upward (skip for dash particles)
    const forwardBoost = this.isDashParticle
      ? 0
      : Math.max(0, -(player?.vy || 0)) / PLAYER_MAX_SPEED_UP;
    const brightScale = 1.25 + forwardBoost * 1.35; // higher base glow
    // const blurScale = 1.1 + forwardBoost * 2.0; // Unused optimization
    const sizeScale = this.isDashParticle ? 1.0 : 1.15 + forwardBoost * 0.85; // Fixed size for dash particles
    const streakScale = this.isDashParticle ? 1.0 : 1 + forwardBoost * 2.2; // Fixed streak for dash particles
    const alphaBoost = 0.2 + forwardBoost * 0.25;

    ctx.save();
    ctx.globalAlpha = Math.min(1, this.life * brightScale + alphaBoost);
    ctx.translate(this.x, this.y);

    if (!IS_MOBILE) {
      ctx.rotate(this.rotation);
    }

    // Optimization: Removed shadowBlur
    // ctx.shadowBlur = 14 * this.life * blurScale;
    // ctx.shadowColor = this.color;

    ctx.fillStyle = this.color;
    // Draw as rotated rectangle for more interesting shape
    const half = (this.size * sizeScale) / 2;

    if (!IS_MOBILE) {
      ctx.scale(1, streakScale);
      ctx.fillRect(-half, -half, half * 2, half * 2);

      // Simple fake glow - Desktop optimized (3x vs original 4x)
      const glowSize = IS_DESKTOP ? 3 : 4; // Smaller glow for desktop
      ctx.globalAlpha = Math.min(
        1,
        (this.life * brightScale + alphaBoost) * 0.4
      );
      ctx.fillRect(
        (-half * glowSize) / 2,
        (-half * glowSize) / 2,
        half * glowSize,
        half * glowSize
      );
    } else {
      // Simplified drawing for mobile
      ctx.fillRect(-half, -half, half * 2, half * 2);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
