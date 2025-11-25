/**
 * STAGE-SPECIFIC BACKGROUND OBSTACLES
 * These hazards live between the background and gameplay layers.
 * They can be destroyed for points and have a chance to drop powerups.
 */

class BackgroundObstacleManager {
  constructor() {
    this.obstacles = [];
    this.stageName = null;
    this.profile = null;
    this.spawnTimer = 0;
    this.idCounter = 0;
  }

  setStage(stageName) {
    this.stageName = stageName || null;
    this.profile = OBSTACLE_PROFILES[stageName] || OBSTACLE_PROFILES.DEFAULT;
    this.reset();
  }

  reset() {
    this.obstacles.length = 0;
    this.spawnTimer = 0;
  }

  getObstacles() {
    return this.obstacles;
  }

  update() {
    if (!this.profile) return;
    if (gameState !== 'PLAYING' && gameState !== 'DEMO') return;

    this.spawnTimer++;
    if (this.spawnTimer >= this.profile.spawnInterval) {
      this.spawnTimer = 0;
      if (this.countActive() < this.profile.maxCount) {
        const obstacle = this.profile.builder();
        if (obstacle) this.obstacles.push(obstacle);
      }
    }

    this.obstacles.forEach((obstacle) => {
      if (!obstacle.active) return;
      obstacle.age++;
      obstacle.x += obstacle.vx || 0;
      obstacle.y += obstacle.vy || 0;
      obstacle.pulsePhase += obstacle.pulseSpeed || 0.015;
      obstacle.spawnAlpha = Math.min(1, obstacle.spawnAlpha + 0.04);
      obstacle.spawnScale = Math.min(1, obstacle.spawnScale + 0.05);
      if (obstacle.hitTimer > 0) obstacle.hitTimer--;
      if (obstacle.flashTimer > 0) obstacle.flashTimer--;

      if (obstacle.trailColor) {
        if (!obstacle.trail) obstacle.trail = [];
        obstacle.trailInterval = (obstacle.trailInterval || 0) + 1;
        if (obstacle.trailInterval >= 2) {
          obstacle.trailInterval = 0;
          obstacle.trail.unshift({ x: obstacle.x, y: obstacle.y, life: 1 });
          if (obstacle.trail.length > 16) obstacle.trail.pop();
        }
        obstacle.trail.forEach((t) => (t.life -= 0.06));
        obstacle.trail = obstacle.trail.filter((t) => t.life > 0);
      }

      if (typeof obstacle.update === 'function') obstacle.update(obstacle);
      if (this.isOutOfBounds(obstacle)) obstacle.active = false;
    });

    this.obstacles = this.obstacles.filter((obstacle) => obstacle.active);
  }

  draw(ctx) {
    if (!this.profile || this.obstacles.length === 0) return;
    this.obstacles.forEach((obstacle) => {
      if (!obstacle.active || typeof obstacle.draw !== 'function') return;
      if (obstacle.trail && obstacle.trail.length) {
        drawObstacleTrail(ctx, obstacle);
      }
      obstacle.draw(ctx, obstacle);
      drawObstacleHalo(ctx, obstacle);
      drawObstacleOrbiters(ctx, obstacle);
    });
  }

  countActive() {
    return this.obstacles.reduce(
      (count, ob) => (ob.active ? count + 1 : count),
      0
    );
  }

  isOutOfBounds(obstacle) {
    const pad = 220;
    return (
      obstacle.y - obstacle.radius > height + pad ||
      obstacle.y + obstacle.radius < -pad ||
      obstacle.x + obstacle.radius < -pad ||
      obstacle.x - obstacle.radius > width + pad
    );
  }

  damageObstacle(obstacle, amount = 1) {
    if (!obstacle || !obstacle.active) return;
    obstacle.hp -= amount;
    obstacle.hitTimer = 6;
    obstacle.flashTimer = 6;
    createExplosionLogic(
      obstacle.x,
      obstacle.y,
      obstacle.hitColor || '#fff',
      2
    );
    if (obstacle.hp <= 0) {
      this.destroyObstacle(obstacle);
    }
  }

  destroyObstacle(obstacle) {
    if (!obstacle.active) return;
    obstacle.active = false;
    createExplosionLogic(
      obstacle.x,
      obstacle.y,
      obstacle.explosionColor || '#fff',
      14
    );
    if (gameState === 'PLAYING') {
      score += obstacle.scoreValue || 50;
    }
    const dropChance = obstacle.dropChance ?? this.profile?.dropChance ?? 0.08;
    if (
      gameState === 'PLAYING' &&
      Math.random() < dropChance &&
      typeof spawnPowerup === 'function'
    ) {
      spawnPowerup(obstacle.x, obstacle.y);
    }
  }
}

const OBSTACLE_PROFILES = {
  DEFAULT: {
    spawnInterval: 240,
    maxCount: 3,
    dropChance: 0.08,
    builder: () => createNeonPylon(),
  },
  'NEON GENESIS': {
    spawnInterval: 200,
    maxCount: 4,
    dropChance: 0.08,
    builder: () => createNeonPylon(),
  },
  'VIOLET VORTEX': {
    spawnInterval: 220,
    maxCount: 3,
    dropChance: 0.1,
    builder: () => createVioletCrystal(),
  },
  'CRIMSON TIDE': {
    spawnInterval: 210,
    maxCount: 4,
    dropChance: 0.09,
    builder: () => createCrimsonBloom(),
  },
  'SOLAR FLARE': {
    spawnInterval: 240,
    maxCount: 3,
    dropChance: 0.1,
    builder: () => createSolarEmitter(),
  },
  'TOXIC WASTE': {
    spawnInterval: 190,
    maxCount: 5,
    dropChance: 0.12,
    builder: () => createToxicBubble(),
  },
  'CYAN CYCLONE': {
    spawnInterval: 220,
    maxCount: 4,
    dropChance: 0.09,
    builder: () => createCyanBlade(),
  },
  'MAGENTA MADNESS': {
    spawnInterval: 240,
    maxCount: 4,
    dropChance: 0.11,
    builder: () => createMagentaGlyph(),
  },
  'VOID WALKER': {
    spawnInterval: 260,
    maxCount: 3,
    dropChance: 0.07,
    builder: () => createVoidShard(),
  },
  'OMEGA OVERDRIVE': {
    spawnInterval: 160,
    maxCount: 5,
    dropChance: 0.13,
    builder: () => createOmegaRelic(),
  },
};

function createBaseObstacle(overrides = {}) {
  return Object.assign(
    {
      id: Date.now() + Math.random(),
      active: true,
      x: rand(80, width - 80),
      y: -100,
      vx: 0,
      vy: rand(2, 3),
      radius: 30,
      hp: 8,
      maxHp: 8,
      dropChance: 0.08,
      scoreValue: 60,
      collides: true,
      color: '#fff',
      explosionColor: '#fff',
      hitColor: '#fff',
      hitTimer: 0,
      flashTimer: 0,
      age: 0,
      spawnAlpha: 0,
      spawnScale: 0.4,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
      ringHue: rand(0, 360),
      orbitalCount: 0,
      trail: null,
      trailColor: null,
      trailInterval: 0,
    },
    overrides
  );
}

function createNeonPylon() {
  const widthSpan = rand(26, 42);
  const heightSpan = rand(120, 200);
  const hue = rand(200, 240);
  const obstacle = createBaseObstacle({
    type: 'neonPylon',
    x: rand(90, width - 90),
    y: -heightSpan,
    vy: rand(2.2, 3.4),
    radius: Math.max(widthSpan, heightSpan) * 0.4,
    hp: 8,
    maxHp: 8,
    dropChance: 0.08,
    scoreValue: 80,
    hue,
    widthSpan,
    heightSpan,
    ringHue: hue,
    orbitalCount: 2,
    orbitalColor: `hsla(${hue + 20}, 100%, 80%, 1)`,
    glowColor: `hsla(${hue}, 80%, 55%, 0.9)`,
    outlineColor: `hsla(${hue + 40}, 100%, 70%, 1)`,
    explosionColor: `hsla(${hue}, 90%, 65%, 1)`,
    hitColor: `hsla(${hue}, 100%, 80%, 1)`,
  });
  obstacle.update = (self) => {
    self.x += Math.sin((self.age + self.hue) * 0.02) * 0.4;
  };
  obstacle.draw = (ctx, self) => {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.scale(self.spawnScale, self.spawnScale);
    ctx.shadowBlur = 20;
    ctx.shadowColor = self.glowColor;
    const pulse = 0.8 + Math.sin(self.pulsePhase * 2) * 0.15;
    ctx.globalAlpha = (pulse + (self.flashTimer ? 0.3 : 0)) * self.spawnAlpha;
    ctx.fillStyle = self.glowColor;
    ctx.fillRect(
      -self.widthSpan / 2,
      -self.heightSpan / 2,
      self.widthSpan,
      self.heightSpan
    );
    ctx.lineWidth = 2;
    ctx.strokeStyle = self.outlineColor;
    ctx.strokeRect(
      -self.widthSpan / 2,
      -self.heightSpan / 2,
      self.widthSpan,
      self.heightSpan
    );
    const scanY = Math.sin(self.pulsePhase * 3) * (self.heightSpan * 0.4);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `hsla(${self.hue + 80}, 100%, 80%, 0.35)`;
    ctx.fillRect(-self.widthSpan / 2, scanY - 8, self.widthSpan, 16);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };
  return obstacle;
}

function createVioletCrystal() {
  const radius = rand(24, 36);
  const hue = rand(260, 300);
  const obstacle = createBaseObstacle({
    type: 'violetCrystal',
    radius,
    hp: 10,
    maxHp: 10,
    dropChance: 0.1,
    scoreValue: 90,
    vy: rand(1.6, 2.4),
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: rand(0.01, 0.03) * (Math.random() < 0.5 ? -1 : 1),
    ringHue: hue,
    orbitalCount: 3,
    orbitalColor: `hsla(${hue + 40}, 100%, 85%, 1)`,
    color: `hsla(${hue}, 70%, 60%, 0.8)`,
    outlineColor: `hsla(${hue + 30}, 90%, 75%, 1)`,
    explosionColor: `hsla(${hue}, 90%, 70%, 1)`,
    hitColor: `hsla(${hue}, 100%, 85%, 1)`,
  });
  const driftDir = Math.random() < 0.5 ? -1 : 1;
  obstacle.update = (self) => {
    self.x += driftDir * Math.sin(self.age * 0.01) * 1.4;
    self.rotation += self.rotationSpeed;
  };
  obstacle.draw = (ctx, self) => {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.scale(self.spawnScale, self.spawnScale);
    ctx.rotate(self.rotation);
    ctx.shadowBlur = 15;
    ctx.shadowColor = self.color;
    const size = self.radius * 1.2;
    const gradient = ctx.createLinearGradient(-size, -size, size, size);
    gradient.addColorStop(0, `hsla(${hue}, 80%, 80%, 0.2)`);
    gradient.addColorStop(0.6, self.color);
    gradient.addColorStop(1, `hsla(${hue + 30}, 90%, 85%, 0.8)`);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = Math.cos(angle) * size;
      const y = Math.sin(angle) * size * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.globalAlpha = (0.75 + (self.flashTimer ? 0.25 : 0)) * self.spawnAlpha;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = self.outlineColor;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };
  return obstacle;
}

function createCrimsonBloom() {
  const radius = rand(26, 34);
  const hue = rand(330, 10);
  const obstacle = createBaseObstacle({
    type: 'crimsonBloom',
    radius,
    hp: 9,
    maxHp: 9,
    vy: rand(2.4, 3.2),
    dropChance: 0.09,
    scoreValue: 85,
    waveOffset: Math.random() * Math.PI * 2,
    ringHue: hue,
    orbitalCount: 4,
    orbitalColor: `hsla(${hue + 40}, 100%, 70%, 1)`,
    color: `hsla(${hue}, 80%, 50%, 0.8)`,
    outlineColor: `hsla(${hue + 20}, 90%, 70%, 1)`,
    explosionColor: `hsla(${hue}, 90%, 60%, 1)`,
    hitColor: `hsla(${hue}, 100%, 75%, 1)`,
  });
  obstacle.update = (self) => {
    self.x += Math.sin(self.age * 0.05 + self.waveOffset) * 2.5;
  };
  obstacle.draw = (ctx, self) => {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.scale(self.spawnScale, self.spawnScale);
    const glow = (self.hitTimer ? 1 : 0.8) + (self.flashTimer ? 0.2 : 0);
    ctx.shadowBlur = 20;
    ctx.shadowColor = self.color;
    ctx.fillStyle = self.color;
    ctx.globalAlpha = glow * self.spawnAlpha;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const petalX = Math.cos(angle) * self.radius * 1.5;
      const petalY = Math.sin(angle) * self.radius;
      ctx.ellipse(
        petalX,
        petalY,
        self.radius * 0.6,
        self.radius * 0.3,
        angle,
        0,
        Math.PI * 2
      );
    }
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, self.radius * 0.7, 0, Math.PI * 2);
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, self.radius);
    coreGradient.addColorStop(0, `hsla(${hue}, 100%, 80%, 1)`);
    coreGradient.addColorStop(1, self.outlineColor);
    ctx.fillStyle = coreGradient;
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };
  return obstacle;
}

function createSolarEmitter() {
  const radius = rand(28, 36);
  const hue = rand(20, 50);
  const obstacle = createBaseObstacle({
    type: 'solarEmitter',
    radius,
    hp: 11,
    maxHp: 11,
    vy: rand(2.0, 2.8),
    dropChance: 0.12,
    scoreValue: 95,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: rand(0.02, 0.04),
    colorHue: hue,
    ringHue: hue,
    orbitalCount: 5,
    orbitalColor: `hsla(${hue + 120}, 100%, 75%, 1)`,
    color: `hsla(${hue}, 90%, 60%, 0.8)`,
    outlineColor: `hsla(${hue + 30}, 100%, 70%, 1)`,
    explosionColor: `hsla(${hue}, 90%, 70%, 1)`,
    hitColor: `hsla(${hue}, 100%, 85%, 1)`,
  });
  obstacle.update = (self) => {
    self.pulse += self.pulseSpeed;
  };
  obstacle.draw = (ctx, self) => {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.scale(self.spawnScale, self.spawnScale);
    const pulseScale =
      1 + Math.sin(self.pulse) * 0.2 + (self.hitTimer ? 0.2 : 0);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 3; i >= 1; i--) {
      const size = self.radius * (pulseScale + i * 0.3);
      const alpha = 0.08 * i;
      ctx.fillStyle = `hsla(${self.colorHue + rand(-5, 5)},100%,70%,${alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `hsla(${self.colorHue + 40}, 100%, 80%, 0.6)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + self.pulse;
      ctx.moveTo(0, 0);
      ctx.lineTo(
        Math.cos(angle) * self.radius * 1.8,
        Math.sin(angle) * self.radius * 1.8
      );
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = self.color;
    ctx.arc(0, 0, self.radius * pulseScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };
  return obstacle;
}

function createToxicBubble() {
  const radius = rand(18, 32);
  const obstacle = createBaseObstacle({
    type: 'toxicBubble',
    x: rand(60, width - 60),
    y: height + rand(60, 160),
    vy: -rand(1.2, 2.0),
    radius,
    hp: 6,
    maxHp: 6,
    dropChance: 0.12,
    scoreValue: 70,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: rand(0.02, 0.05),
    ringHue: rand(90, 140),
    color: `hsla(${rand(100, 140)}, 80%, 45%, 0.4)`,
    outlineColor: `hsla(${rand(90, 120)}, 100%, 70%, 0.8)`,
    explosionColor: '#7dfc4c',
    hitColor: '#cfffaa',
  });
  obstacle.update = (self) => {
    self.wobble += self.wobbleSpeed;
    self.x += Math.sin(self.wobble) * 1.3;
  };
  obstacle.draw = (ctx, self) => {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.scale(self.spawnScale, self.spawnScale);
    ctx.strokeStyle = self.outlineColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = (0.6 + (self.hitTimer ? 0.2 : 0)) * self.spawnAlpha;
    ctx.fillStyle = self.color;
    ctx.beginPath();
    ctx.arc(0, 0, self.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const swirl = ctx.createRadialGradient(
      0,
      0,
      self.radius * 0.2,
      0,
      0,
      self.radius
    );
    swirl.addColorStop(0, 'rgba(255,255,255,0.4)');
    swirl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = swirl;
    ctx.beginPath();
    ctx.arc(
      Math.sin(self.pulsePhase) * self.radius * 0.4,
      Math.cos(self.pulsePhase) * self.radius * 0.4,
      self.radius * 0.9,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#fff';
    ctx.arc(
      -self.radius * 0.3,
      -self.radius * 0.3,
      self.radius * 0.3,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  };
  return obstacle;
}

function createCyanBlade() {
  const fromLeft = Math.random() < 0.5;
  const yPos = rand(140, height - 140);
  const speed = rand(2.4, 3.4) * (fromLeft ? 1 : -1);
  const obstacle = createBaseObstacle({
    type: 'cyanBlade',
    x: fromLeft ? -120 : width + 120,
    y: yPos,
    vx: speed,
    vy: Math.sin(Math.random()) * 0.5,
    radius: 36,
    hp: 10,
    maxHp: 10,
    dropChance: 0.09,
    scoreValue: 95,
    collides: true,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.08,
    ringHue: 190,
    trailColor: 'hsla(180, 90%, 70%, 0.5)',
    color: `hsla(180, 80%, 60%, 0.8)`,
    outlineColor: `hsla(190, 100%, 80%, 1)`,
    explosionColor: '#6ff',
    hitColor: '#dff',
  });
  obstacle.update = (self) => {
    self.rotation += self.rotationSpeed;
    self.y += Math.sin(self.age * 0.05) * 0.5;
  };
  obstacle.draw = (ctx, self) => {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.scale(self.spawnScale, self.spawnScale);
    ctx.rotate(self.rotation);
    ctx.fillStyle = self.color;
    ctx.globalAlpha =
      (0.85 + (self.hitTimer ? 0.15 : 0) + (self.flashTimer ? 0.2 : 0)) *
      self.spawnAlpha;
    ctx.shadowBlur = 15;
    ctx.shadowColor = self.color;
    ctx.beginPath();
    ctx.moveTo(0, -self.radius);
    ctx.lineTo(self.radius * 0.5, 0);
    ctx.lineTo(0, self.radius);
    ctx.lineTo(-self.radius * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = self.outlineColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -self.radius);
    ctx.lineTo(0, self.radius);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };
  return obstacle;
}

function createMagentaGlyph() {
  const size = rand(26, 36);
  const hue = rand(290, 320);
  const obstacle = createBaseObstacle({
    type: 'magentaGlyph',
    y: -120,
    vy: rand(2.6, 3.4),
    radius: size * 1.2,
    hp: 9,
    maxHp: 9,
    dropChance: 0.11,
    scoreValue: 100,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: rand(0.01, 0.03),
    ringHue: hue,
    orbitalCount: 4,
    orbitalColor: `hsla(${hue + 40}, 100%, 80%, 1)`,
    color: `hsla(${hue}, 100%, 65%, 0.85)`,
    outlineColor: `hsla(${hue + 20}, 100%, 80%, 1)`,
    explosionColor: `hsla(${hue}, 100%, 75%, 1)`,
    hitColor: `hsla(${hue}, 100%, 90%, 1)`,
    glyphSize: size,
  });
  obstacle.update = (self) => {
    self.rotation += self.rotationSpeed;
    self.x += Math.sin(self.age * 0.03) * 1.0;
  };
  obstacle.draw = (ctx, self) => {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.scale(self.spawnScale, self.spawnScale);
    ctx.rotate(self.rotation);
    ctx.strokeStyle = self.outlineColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha =
      (0.8 + (self.hitTimer ? 0.2 : 0) + (self.flashTimer ? 0.2 : 0)) *
      self.spawnAlpha;
    ctx.beginPath();
    ctx.rect(
      -self.glyphSize,
      -self.glyphSize,
      self.glyphSize * 2,
      self.glyphSize * 2
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-self.glyphSize, 0);
    ctx.lineTo(self.glyphSize, 0);
    ctx.moveTo(0, -self.glyphSize);
    ctx.lineTo(0, self.glyphSize);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  };
  return obstacle;
}

function createVoidShard() {
  const radius = rand(28, 34);
  const obstacle = createBaseObstacle({
    type: 'voidShard',
    radius,
    hp: 14,
    maxHp: 14,
    vy: rand(1.4, 2.2),
    dropChance: 0.07,
    scoreValue: 120,
    collides: true,
    flickerPhase: Math.random() * Math.PI * 2,
    flickerSpeed: rand(0.02, 0.05),
    ringHue: 250,
    orbitalCount: 2,
    orbitalColor: 'hsla(260, 80%, 80%, 1)',
    color: 'hsla(250, 60%, 40%, 0.7)',
    outlineColor: 'hsla(260, 80%, 70%, 1)',
    explosionColor: '#a6a0ff',
    hitColor: '#d6d0ff',
  });
  obstacle.update = (self) => {
    self.flickerPhase += self.flickerSpeed;
    self.x += Math.sin(self.flickerPhase) * 0.6;
  };
  obstacle.draw = (ctx, self) => {
    ctx.save();
    ctx.translate(self.x, self.y);
    ctx.scale(self.spawnScale, self.spawnScale);
    const flicker =
      0.6 + Math.sin(self.flickerPhase) * 0.2 + (self.hitTimer ? 0.2 : 0);
    ctx.globalAlpha = flicker * self.spawnAlpha;
    ctx.shadowBlur = 25;
    ctx.shadowColor = self.color;
    ctx.beginPath();
    ctx.moveTo(0, -self.radius);
    ctx.lineTo(self.radius * 0.4, 0);
    ctx.lineTo(0, self.radius);
    ctx.lineTo(-self.radius * 0.4, 0);
    ctx.closePath();
    ctx.fillStyle = self.color;
    ctx.fill();
    ctx.strokeStyle = self.outlineColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  };
  return obstacle;
}

function createOmegaRelic() {
  // Mix existing builders for chaos
  const builders = [
    createNeonPylon,
    createVioletCrystal,
    createCrimsonBloom,
    createSolarEmitter,
    createToxicBubble,
    createCyanBlade,
    createMagentaGlyph,
    createVoidShard,
  ];
  const builder = builders[Math.floor(Math.random() * builders.length)];
  const obstacle = builder();
  obstacle.hp += 2;
  obstacle.maxHp += 2;
  obstacle.dropChance += 0.05;
  obstacle.scoreValue += 40;
  obstacle.explosionColor = '#fff';
  return obstacle;
}

function drawObstacleTrail(ctx, obstacle) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const color = obstacle.trailColor || 'rgba(255,255,255,0.4)';
  obstacle.trail.forEach((node) => {
    ctx.globalAlpha = node.life * 0.35 * obstacle.spawnAlpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(
      node.x,
      node.y,
      (obstacle.radius || 30) * 0.25 * node.life,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawObstacleHalo(ctx, obstacle) {
  if (!obstacle.maxHp) return;
  const ratio = Math.max(0, obstacle.hp) / obstacle.maxHp;
  const haloRadius = (obstacle.radius || 30) + 8;
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  ctx.scale(obstacle.spawnScale, obstacle.spawnScale);
  ctx.rotate(-Math.PI / 2);
  const hue = obstacle.hue ?? obstacle.ringHue ?? globalHue;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.25 * obstacle.spawnAlpha;
  ctx.strokeStyle = `hsla(${hue}, 80%, 55%, 1)`;
  ctx.beginPath();
  ctx.arc(0, 0, haloRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6 * obstacle.spawnAlpha;
  ctx.lineWidth = 3;
  ctx.strokeStyle = `hsla(${hue + 30}, 100%, 70%, 1)`;
  ctx.beginPath();
  ctx.arc(0, 0, haloRadius, 0, Math.PI * 2 * ratio);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawObstacleOrbiters(ctx, obstacle) {
  const count = obstacle.orbitalCount || 0;
  if (!count) return;
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  const orbitColor =
    obstacle.orbitalColor ||
    `hsla(${obstacle.hue ?? obstacle.ringHue ?? globalHue}, 100%, 75%, 1)`;
  const baseRadius = (obstacle.radius || 30) + 12;
  for (let i = 0; i < count; i++) {
    const angle = obstacle.pulsePhase + (i / count) * Math.PI * 2;
    const offset = baseRadius + Math.sin(obstacle.pulsePhase * 1.5 + i) * 4;
    ctx.globalAlpha = 0.5 * obstacle.spawnAlpha;
    ctx.fillStyle = orbitColor;
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * offset,
      Math.sin(angle) * offset,
      3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

const backgroundObstacleManager = new BackgroundObstacleManager();
