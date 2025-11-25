/**
 * COSMIC BACKGROUND
 */

class CosmicBackground {
  constructor() {
    this.stars = [];
    this.vortexes = [];
    this.planets = [];
    this.twinkleStars = []; // Small twinkling background stars
    this.starSpeedScale = 1; // scales with player forward push
    this.starThinScale = 1; // narrows stars as you accelerate
    this.forwardRatio = 0;
    this.vortexSpawnTimer = 0; // Timer for periodic vortex spawning
    this.themeHue = 240; // Default theme hue
    this.mode = 'DEFAULT';

    // specialized mode state
    this.gridOffset = 0;
    this.waveOffset = 0;
    this.bubbles = [];
    this.orbs = [];
    this.streaks = [];
    this.geomShapes = [];
    this.voidPulse = 0;

    this.init();
  }

  setTheme(hue, levelName) {
    this.themeHue = hue;

    // Map level names to visual modes
    const name = levelName || '';
    if (name === 'NEON GENESIS') this.mode = 'GRID';
    else if (name === 'VIOLET VORTEX') this.mode = 'VORTEX';
    else if (name === 'CRIMSON TIDE') this.mode = 'WAVE';
    else if (name === 'SOLAR FLARE') this.mode = 'ORBS';
    else if (name === 'TOXIC WASTE') this.mode = 'BUBBLES';
    else if (name === 'CYAN CYCLONE') this.mode = 'STREAK';
    else if (name === 'MAGENTA MADNESS') this.mode = 'GEOMETRIC';
    else if (name === 'VOID WALKER') this.mode = 'VOID';
    else if (name === 'OMEGA OVERDRIVE') this.mode = 'CHAOS';
    else this.mode = 'DEFAULT'; // Fallback

    // Update existing vortex colors to match new theme
    this.vortexes.forEach((v) => {
      v.color = `hsla(${hue + Math.random() * 40 - 20}, 70%, 50%, 0.1)`;
    });

    this.initModeData();
  }

  initModeData() {
    // Reset special arrays
    this.bubbles = [];
    this.orbs = [];
    this.streaks = [];
    this.geomShapes = [];

    if (this.mode === 'BUBBLES') {
      for (let i = 0; i < 15; i++) this.spawnBubble(true);
    } else if (this.mode === 'ORBS') {
      for (let i = 0; i < 5; i++) {
        this.orbs.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 50 + Math.random() * 100,
          pulse: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.02,
        });
      }
    } else if (this.mode === 'STREAK') {
      for (let i = 0; i < 20; i++) {
        this.streaks.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: 50 + Math.random() * 100,
          speed: 10 + Math.random() * 10,
          alpha: 0.1 + Math.random() * 0.3,
        });
      }
    } else if (this.mode === 'GEOMETRIC') {
      for (let i = 0; i < 10; i++) {
        this.geomShapes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 20 + Math.random() * 40,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.1,
          type: Math.floor(Math.random() * 3), // 0=square, 1=triangle, 2=diamond
        });
      }
    }
  }

  spawnBubble(randomY = false) {
    this.bubbles.push({
      x: Math.random() * width,
      y: randomY ? Math.random() * height : height + 50,
      size: 10 + Math.random() * 30,
      speed: 1 + Math.random() * 2,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  init() {
    this.stars = [];
    this.vortexes = [];
    this.planets = [];
    this.vortexSpawnTimer = 0;

    // Stars - Desktop optimized
    const starCount = IS_MOBILE ? 40 : 70;
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * width,
        size: Math.random() * 2,
      });
    }

    // Initial Vortexes
    const vortexCount = IS_MOBILE ? 1 : 2;
    for (let i = 0; i < vortexCount; i++) {
      this.spawnVortex(true);
    }

    // Planets
    for (let i = 0; i < 3; i++) {
      this.planets.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 30 + Math.random() * 50,
        color: `hsla(${Math.random() * 360}, 60%, 40%, 0.8)`,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      });
    }

    // Twinkling stars
    this.twinkleStars = [];
    for (let i = 0; i < 50; i++) {
      this.twinkleStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 0.5 + Math.random() * 1.5,
        twinkleSpeed: 0.02 + Math.random() * 0.04,
        twinklePhase: Math.random() * Math.PI * 2,
        brightness: 0.3 + Math.random() * 0.4,
      });
    }
  }

  spawnVortex(visible = false) {
    const hue = this.mode === 'VORTEX' ? 270 : this.themeHue; // Force purple for VORTEX mode
    const pos = visible
      ? { x: Math.random() * width, y: Math.random() * height }
      : this.getOffscreenVortexPosition();

    this.vortexes.push({
      x: pos.x,
      y: pos.y,
      angle: Math.random() * Math.PI * 2,
      speed: this.getVortexSpeed(),
      color: `hsla(${hue + Math.random() * 40 - 20}, 70%, 50%, 0.1)`,
      size: 200 + Math.random() * 300,
      opacity: visible ? 1.0 : 0.0,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.03,
    });
  }

  getVortexSpeed() {
    const minSpeed = 0.015;
    const maxSpeed = 0.035;
    const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
    return Math.random() < 0.5 ? speed : -speed;
  }

  getOffscreenVortexPosition() {
    const margin = 400;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0:
        return { x: Math.random() * width, y: -margin };
      case 1:
        return { x: width + margin, y: Math.random() * height };
      case 2:
        return { x: Math.random() * width, y: height + margin };
      case 3:
        return { x: -margin, y: Math.random() * height };
    }
  }

  update() {
    // Tie backdrop speed/shape to velocity
    const forwardSpeed = Math.max(0, -(player?.vy || 0));
    const backwardSpeed = Math.max(0, player?.vy || 0);
    this.forwardRatio = Math.min(1, forwardSpeed / PLAYER_MAX_SPEED_UP);
    const backwardRatio = Math.min(1, backwardSpeed / PLAYER_MAX_SPEED_DOWN);

    const baseScale = 0.35 + this.forwardRatio * 1.65;
    this.starSpeedScale = Math.max(
      0.12,
      baseScale * (1 - backwardRatio * 0.65)
    );
    this.starThinScale = Math.max(0.35, 1 / (1 + this.forwardRatio * 1.1));

    const speed = 8 * this.starSpeedScale;

    // VOID MODE: Very slow stars, fewer updates
    if (this.mode === 'VOID') {
      this.voidPulse += 0.01;
    }

    // Stars Update
    if (this.mode !== 'VOID') {
      this.stars.forEach((s) => {
        const depthSpeed = speed * (1 + ((width - s.z) / width) * 2);
        s.y += depthSpeed;
        if (s.y > height + 50) {
          s.y = -50;
          s.x = Math.random() * width;
          s.z = Math.random() * width;
        }
      });
    }

    // Vortexes Update
    // Only spawn new ones in DEFAULT or VORTEX modes, or occasionally in CHAOS
    const spawnRate = this.mode === 'VORTEX' ? 120 : 240; // Faster spawn in VORTEX mode
    const maxVortex = this.mode === 'VORTEX' ? 8 : 6;

    this.vortexSpawnTimer++;
    if (['DEFAULT', 'VORTEX', 'CHAOS'].includes(this.mode)) {
      if (
        this.vortexSpawnTimer >= spawnRate &&
        this.vortexes.length < maxVortex
      ) {
        this.vortexSpawnTimer = 0;
        this.spawnVortex();
      }
    }

    this.vortexes.forEach((v) => {
      v.angle += v.speed;
      v.pulsePhase = (v.pulsePhase || 0) + (v.pulseSpeed || 0.03);
      if (v.opacity < 1.0) v.opacity = Math.min(1.0, v.opacity + 0.01);
      v.x -= (player.x - width / 2) * 0.002;
      v.y -= (player.y - height / 2) * 0.002;
    });

    this.vortexes = this.vortexes.filter((v) => {
      const dx = v.x - width / 2;
      const dy = v.y - height / 2;
      return Math.sqrt(dx * dx + dy * dy) < Math.max(width, height) * 2;
    });

    // Planets Update (Standard)
    this.planets.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -100) p.x = width + 100;
      if (p.x > width + 100) p.x = -100;
      if (p.y < -100) p.y = height + 100;
      if (p.y > height + 100) p.y = -100;
    });

    // Twinkling stars
    this.twinkleStars.forEach((s) => (s.twinklePhase += s.twinkleSpeed));

    // MODE SPECIFIC UPDATES
    if (this.mode === 'GRID') {
      this.gridOffset = (this.gridOffset + speed * 0.5) % 40; // Grid scrolling
    } else if (this.mode === 'WAVE') {
      this.waveOffset += 0.05;
    } else if (this.mode === 'BUBBLES') {
      if (Math.random() < 0.05) this.spawnBubble();
      this.bubbles.forEach((b) => {
        b.y -= b.speed;
        b.wobble += 0.1;
        b.x += Math.sin(b.wobble) * 0.5;
      });
      this.bubbles = this.bubbles.filter((b) => b.y > -50);
    } else if (this.mode === 'ORBS') {
      this.orbs.forEach((o) => {
        o.pulse += o.speed;
        o.x += Math.sin(o.pulse) * 0.2;
        o.y += Math.cos(o.pulse) * 0.2;
      });
    } else if (this.mode === 'STREAK') {
      this.streaks.forEach((s) => {
        s.x -= s.speed; // Fly left like wind
        if (s.x < -s.length) {
          s.x = width + s.length;
          s.y = Math.random() * height;
        }
      });
    } else if (this.mode === 'GEOMETRIC') {
      this.geomShapes.forEach((g) => {
        g.angle += g.spin;
        g.x -= (player.x - width / 2) * 0.005; // Parallax
        g.y -= (player.y - height / 2) * 0.005;

        // Wrap around
        if (g.x < -50) g.x = width + 50;
        if (g.x > width + 50) g.x = -50;
        if (g.y < -50) g.y = height + 50;
        if (g.y > height + 50) g.y = -50;
      });
    }
  }

  draw(ctx) {
    // Deep space bg
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    // In VOID mode, make it darker
    const hue = this.mode === 'CHAOS' ? (Date.now() / 20) % 360 : this.themeHue;
    const lightness = this.mode === 'VOID' ? 2 : 5;

    grad.addColorStop(0, `hsla(${hue}, 60%, ${lightness}%, 1)`);
    grad.addColorStop(1, `hsla(${hue}, 60%, ${lightness + 5}%, 1)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // MODE: GRID (Neon Genesis) - Draw grid at bottom
    if (this.mode === 'GRID') {
      ctx.save();
      ctx.strokeStyle = `hsla(${hue}, 80%, 50%, 0.15)`;
      ctx.lineWidth = 1;
      // Vertical lines perspective
      const centerX = width / 2;
      const horizonY = height * 0.2; // High horizon

      // Draw floor grid
      for (let x = -width; x < width * 2; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(centerX + (x - centerX) * 0.2, horizonY);
        ctx.stroke();
      }
      // Horizontal moving lines
      for (let y = height; y > horizonY; y -= 40) {
        const yPos = y + this.gridOffset;
        if (yPos > height) continue;
        if (yPos < horizonY) continue;

        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(width, yPos);
        ctx.stroke();
      }
      ctx.restore();
    }

    // MODE: WAVE (Crimson Tide)
    if (this.mode === 'WAVE') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.lineWidth = 50;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `hsla(${hue}, 60%, 30%, 0.1)`;
        ctx.beginPath();
        for (let x = 0; x < width; x += 20) {
          const y =
            height / 2 +
            Math.sin(x * 0.01 + this.waveOffset + i) * 100 +
            (i * 100 - 100);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // MODE: ORBS (Solar Flare)
    if (this.mode === 'ORBS') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      this.orbs.forEach((o) => {
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.size);
        const pulse = 1 + Math.sin(o.pulse) * 0.2;
        grad.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.2)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size * pulse, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Standard Twinkle Stars (Reduced in VOID mode)
    if (this.mode !== 'VOID') {
      ctx.globalCompositeOperation = 'lighter';
      this.twinkleStars.forEach((s) => {
        const twinkle = Math.sin(s.twinklePhase) * 0.5 + 0.5;
        const opacity = s.brightness * twinkle;
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // MODE: GEOMETRIC (Magenta Madness)
    if (this.mode === 'GEOMETRIC') {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      this.geomShapes.forEach((g) => {
        ctx.strokeStyle = `hsla(${hue}, 70%, 50%, 0.2)`;
        ctx.lineWidth = 2;
        ctx.translate(g.x, g.y);
        ctx.rotate(g.angle);
        ctx.beginPath();
        if (g.type === 0) ctx.rect(-g.size / 2, -g.size / 2, g.size, g.size);
        else if (g.type === 1) {
          ctx.moveTo(0, -g.size / 2);
          ctx.lineTo(g.size / 2, g.size / 2);
          ctx.lineTo(-g.size / 2, g.size / 2);
          ctx.closePath();
        } else {
          ctx.moveTo(0, -g.size / 2);
          ctx.lineTo(g.size / 2, 0);
          ctx.lineTo(0, g.size / 2);
          ctx.lineTo(-g.size / 2, 0);
          ctx.closePath();
        }
        ctx.stroke();
        ctx.rotate(-g.angle);
        ctx.translate(-g.x, -g.y);
      });
      ctx.restore();
    }

    // Vortexes (Standard + VORTEX mode)
    // Hide vortexes in GRID or STREAK mode to reduce clutter if desired,
    // but they add depth. Let's keep them but make them subtle.
    if (
      this.mode !== 'GRID' &&
      this.mode !== 'STREAK' &&
      this.mode !== 'VOID'
    ) {
      ctx.globalCompositeOperation = 'screen';
      this.vortexes.forEach((v) => {
        // (Keep existing vortex draw logic)
        const pulse = 0.8 + Math.sin(v.pulsePhase || 0) * 0.1 + 0.1;
        const maxOpacity = 0.5;
        const baseOpacity = Math.min(v.opacity || 1.0, maxOpacity);
        ctx.globalAlpha = baseOpacity * pulse;

        const baseBlur = IS_DESKTOP ? 12 : 15;
        const blurRange = IS_DESKTOP ? 4 : 5;
        const blurAmount =
          baseBlur + Math.sin(v.pulsePhase || 0) * blurRange + blurRange;
        if (!IS_MOBILE) {
          ctx.shadowBlur = blurAmount;
          ctx.shadowColor = v.color;
        }

        const g = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.size);
        g.addColorStop(0, v.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(v.x - v.size, v.y - v.size, v.size * 2, v.size * 2);

        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle);

        const lineBaseBlur = IS_DESKTOP ? 8 : 10;
        const lineBlurRange = IS_DESKTOP ? 4 : 5;
        const lineBlur =
          lineBaseBlur +
          Math.sin(v.pulsePhase || 0) * lineBlurRange +
          lineBlurRange;
        if (!IS_MOBILE) {
          ctx.shadowBlur = lineBlur;
          ctx.shadowColor = v.color;
        }
        ctx.strokeStyle = v.color.replace('0.1)', '0.15)');
        const lineWidth = 1.5 + Math.sin(v.pulsePhase || 0) * 0.5 + 0.5;
        ctx.lineWidth = lineWidth;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          ctx.rotate(Math.PI / 3);
          const segments = IS_MOBILE ? 4 : 6;
          const wavePhase = v.angle * 3;
          const baseAmplitude = 15 + Math.sin(v.angle * 2 + i) * 5;
          ctx.moveTo(0, 0);
          for (let j = 1; j <= segments; j++) {
            const t = j / segments;
            const baseX = t * v.size;
            const baseY = t * v.size * 0.5;
            const wave = Math.sin(t * 9.42 + wavePhase) * baseAmplitude * t;
            const x = baseX;
            const y = baseY + wave;
            if (j === 1) ctx.lineTo(x, y);
            else {
              const prevT = (j - 1) / segments;
              const prevX = prevT * v.size;
              const prevY =
                prevT * v.size * 0.5 +
                Math.sin(prevT * 9.42 + wavePhase) * baseAmplitude * prevT;
              const cpX = (prevX + x) / 2;
              const cpY = (prevY + y) / 2;
              ctx.quadraticCurveTo(cpX, cpY, x, y);
            }
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }

    // MODE: STREAK (Cyan Cyclone)
    if (this.mode === 'STREAK') {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.3)`;
      ctx.lineWidth = 2;
      this.streaks.forEach((s) => {
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.length, s.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    // Stars Motion Trails (Standard)
    // Disable in VOID mode
    if (this.mode !== 'VOID') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fff';
      this.stars.forEach((s) => {
        const depthFactor = (width - s.z) / width;
        const baseWidth = s.size * (0.3 + depthFactor * 0.5);
        const finalWidth = baseWidth * this.starThinScale;
        const screenProgress = s.y / height;
        const stretchFactor = 0.5 + screenProgress * 3;
        const height_oval =
          baseWidth * stretchFactor * 4 * (1 + this.forwardRatio * 0.3);
        if (s.x > 0 && s.x < width && s.y > 0 && s.y < height) {
          ctx.globalAlpha = 0.1 + depthFactor * 0.15;
          ctx.fillStyle = '#fff';
          ctx.fillRect(
            s.x - finalWidth / 2,
            s.y - height_oval / 2,
            finalWidth,
            height_oval
          );
        }
      });
      ctx.globalAlpha = 1;
    }

    // MODE: BUBBLES (Toxic Waste)
    if (this.mode === 'BUBBLES') {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.3)`;
      ctx.lineWidth = 2;
      this.bubbles.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.stroke();
        // glint
        ctx.beginPath();
        ctx.arc(
          b.x - b.size * 0.3,
          b.y - b.size * 0.3,
          b.size * 0.2,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `hsla(${hue}, 80%, 80%, 0.2)`;
        ctx.fill();
      });
    }

    // Planets (Standard)
    ctx.globalCompositeOperation = 'source-over';
    this.planets.forEach((p) => {
      ctx.fillStyle = p.color;
      if (!IS_MOBILE) {
        ctx.shadowBlur = IS_DESKTOP ? 15 : 20;
        ctx.shadowColor = p.color;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.3, p.y + p.r * 0.3, p.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
