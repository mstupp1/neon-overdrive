/**
 * COSMIC BACKGROUND
 */

class CosmicBackground {
    constructor() {
        this.stars = [];
        this.vortexes = [];
        this.planets = [];
        this.dust = [];
        this.twinkleStars = []; // Small twinkling background stars
        this.starSpeedScale = 1; // scales with player forward push
        this.starThinScale = 1;  // narrows stars as you accelerate
        this.forwardRatio = 0;
        this.vortexSpawnTimer = 0; // Timer for periodic vortex spawning
        this.init();
    }

    init() {
        this.stars = [];
        this.vortexes = [];
        this.planets = [];
        this.vortexSpawnTimer = 0;
        // Stars
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                z: Math.random() * width,
                size: Math.random() * 2
            });
        }
        // Vortexes - Optimized count for performance
        for (let i = 0; i < 3; i++) {
            this.vortexes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                angle: Math.random() * Math.PI * 2,
                speed: this.getVortexSpeed(), // Ensure all vortexes spin
                color: `hsla(${Math.random() * 360}, 70%, 50%, 0.1)`,
                size: 200 + Math.random() * 300,
                opacity: 1.0, // Initial vortexes are fully visible
                pulsePhase: Math.random() * Math.PI * 2, // Random starting pulse phase
                pulseSpeed: 0.02 + Math.random() * 0.03 // Varied pulse speeds
            });
        }
        // Planets
        for (let i = 0; i < 3; i++) {
            this.planets.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: 30 + Math.random() * 50,
                color: `hsla(${Math.random() * 360}, 60%, 40%, 0.8)`,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5
            });
        }
        // Twinkling stars - subtle background stars
        this.twinkleStars = [];
        for (let i = 0; i < 50; i++) {
            this.twinkleStars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: 0.5 + Math.random() * 1.5, // Vary size: 0.5 to 2
                twinkleSpeed: 0.02 + Math.random() * 0.04, // Different twinkle rates
                twinklePhase: Math.random() * Math.PI * 2, // Random starting phase
                brightness: 0.3 + Math.random() * 0.4 // Base brightness varies (0.3-0.7)
            });
        }
    }

    getVortexSpeed() {
        // Ensure vortexes always spin with a minimum speed
        // Random direction, but always at least 0.015 radians/frame
        const minSpeed = 0.015;
        const maxSpeed = 0.035;
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        return Math.random() < 0.5 ? speed : -speed;
    }

    getOffscreenVortexPosition() {
        // Spawn vortexes off-screen so they drift in naturally
        const margin = 400; // Spawn this far off-screen
        const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left

        switch (side) {
            case 0: // Top
                return { x: Math.random() * width, y: -margin };
            case 1: // Right
                return { x: width + margin, y: Math.random() * height };
            case 2: // Bottom
                return { x: Math.random() * width, y: height + margin };
            case 3: // Left
                return { x: -margin, y: Math.random() * height };
        }
    }

    update() {
        // Tie backdrop speed/shape to velocity so accelerating feels faster
        const forwardSpeed = Math.max(0, -(player?.vy || 0));
        const backwardSpeed = Math.max(0, player?.vy || 0);
        this.forwardRatio = Math.min(1, forwardSpeed / PLAYER_MAX_SPEED_UP);
        const backwardRatio = Math.min(1, backwardSpeed / PLAYER_MAX_SPEED_DOWN);
        // Slower idle drift; ramps harder with thrust; braking/downward makes it calmer
        const baseScale = 0.35 + this.forwardRatio * 1.65;
        this.starSpeedScale = Math.max(0.12, baseScale * (1 - backwardRatio * 0.65));
        this.starThinScale = Math.max(0.35, 1 / (1 + this.forwardRatio * 1.1));

        const speed = 8 * this.starSpeedScale; // Base flight speed, boosted by player thrust

        // Stars - Move downward to simulate flying upward
        this.stars.forEach(s => {
            // Move stars downward based on their depth (z)
            // Stars closer (smaller z) move faster for parallax effect
            const depthSpeed = speed * (1 + (width - s.z) / width * 2);
            s.y += depthSpeed;

            // Reset star to top when it goes off bottom
            if (s.y > height + 50) {
                s.y = -50;
                s.x = Math.random() * width;
                s.z = Math.random() * width;
            }
        });

        // Vortexes - Periodic spawning (optimized frequency)
        this.vortexSpawnTimer++;
        if (this.vortexSpawnTimer >= 240 && this.vortexes.length < 6) { // Spawn every ~4 seconds, max 6 vortexes
            this.vortexSpawnTimer = 0;
            // Spawn new vortex off-screen
            const pos = this.getOffscreenVortexPosition();
            this.vortexes.push({
                x: pos.x,
                y: pos.y,
                angle: Math.random() * Math.PI * 2,
                speed: this.getVortexSpeed(), // Ensure it spins
                color: `hsla(${Math.random() * 360}, 70%, 50%, 0.1)`,
                size: 200 + Math.random() * 300,
                opacity: 0.0, // Start invisible for fade-in
                pulsePhase: Math.random() * Math.PI * 2, // Random starting pulse phase
                pulseSpeed: 0.02 + Math.random() * 0.03 // Varied pulse speeds
            });
        }

        // Update existing vortexes
        this.vortexes.forEach(v => {
            v.angle += v.speed;
            // Animate pulse phase
            v.pulsePhase = (v.pulsePhase || 0) + (v.pulseSpeed || 0.03);
            // Fade in gradually
            if (v.opacity < 1.0) {
                v.opacity = Math.min(1.0, v.opacity + 0.01); // Fade in over ~100 frames
            }
            // Parallax
            v.x -= (player.x - width / 2) * 0.002;
            v.y -= (player.y - height / 2) * 0.002;
        });

        // Remove vortexes that have drifted too far off-screen
        const maxDistance = Math.max(width, height) * 2;
        this.vortexes = this.vortexes.filter(v => {
            const dx = v.x - width / 2;
            const dy = v.y - height / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < maxDistance;
        });

        // Planets
        this.planets.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -100) p.x = width + 100;
            if (p.x > width + 100) p.x = -100;
            if (p.y < -100) p.y = height + 100;
            if (p.y > height + 100) p.y = -100;
        });

        // Twinkling stars - update phase for animation
        this.twinkleStars.forEach(s => {
            s.twinklePhase += s.twinkleSpeed;
        });
    }

    draw(ctx) {
        // Deep space bg
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#050010');
        grad.addColorStop(1, '#100020');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Twinkling stars - draw first so they're behind everything
        ctx.globalCompositeOperation = 'lighter';
        this.twinkleStars.forEach(s => {
            // Calculate twinkle opacity using sine wave
            const twinkle = Math.sin(s.twinklePhase) * 0.5 + 0.5; // 0 to 1
            const opacity = s.brightness * twinkle;

            ctx.globalAlpha = opacity;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        // Vortexes / Nebula - Push to background with more blur and oscillation
        ctx.globalCompositeOperation = 'screen';
        this.vortexes.forEach(v => {
            // Calculate pulse effect (0.8 to 1.0)
            const pulse = 0.8 + Math.sin(v.pulsePhase || 0) * 0.1 + 0.1;

            // Apply fade-in opacity with pulse, but keep them more subtle (max 0.5 for background feel)
            const maxOpacity = 0.5;
            const baseOpacity = Math.min(v.opacity || 1.0, maxOpacity);
            ctx.globalAlpha = baseOpacity * pulse;

            // Radial gradient glow with pulsing blur
            const blurAmount = 15 + Math.sin(v.pulsePhase || 0) * 5 + 5; // 15-25px range
            ctx.shadowBlur = blurAmount;
            ctx.shadowColor = v.color;

            const g = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.size);
            g.addColorStop(0, v.color);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(v.x - v.size, v.y - v.size, v.size * 2, v.size * 2);

            // Oscillating spiral lines with sine wave distortion
            ctx.save();
            ctx.translate(v.x, v.y);
            ctx.rotate(v.angle);

            // Pulsing blur for spiral lines
            const lineBlur = 10 + Math.sin(v.pulsePhase || 0) * 5 + 5; // 10-20px range
            ctx.shadowBlur = lineBlur;
            ctx.shadowColor = v.color;
            ctx.strokeStyle = v.color.replace('0.1)', '0.15)'); // Slightly more visible lines

            // Pulsing line width
            const lineWidth = 1.5 + Math.sin(v.pulsePhase || 0) * 0.5 + 0.5; // 1.5-2.5px range
            ctx.lineWidth = lineWidth;

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                ctx.rotate(Math.PI / 3);

                // Draw oscillating spiral arm using fewer segments for performance
                const segments = 8; // Reduced from 20 for better performance
                const wavePhase = v.angle * 3;
                const baseAmplitude = 15 + Math.sin(v.angle * 2 + i) * 5;

                ctx.moveTo(0, 0);

                for (let j = 1; j <= segments; j++) {
                    const t = j / segments; // 0 to 1
                    const baseX = t * v.size;
                    const baseY = t * v.size * 0.5;

                    // Simplified sine wave oscillation
                    const wave = Math.sin(t * 9.42 + wavePhase) * baseAmplitude * t; // 9.42 ≈ 3π

                    const x = baseX;
                    const y = baseY + wave;

                    // Use quadraticCurveTo for smoother curves with fewer points
                    if (j === 1) {
                        ctx.lineTo(x, y);
                    } else {
                        const prevT = (j - 1) / segments;
                        const prevX = prevT * v.size;
                        const prevY = prevT * v.size * 0.5 + Math.sin(prevT * 9.42 + wavePhase) * baseAmplitude * prevT;
                        const cpX = (prevX + x) / 2;
                        const cpY = (prevY + y) / 2;
                        ctx.quadraticCurveTo(cpX, cpY, x, y);
                    }
                }
            }
            ctx.stroke();

            ctx.shadowBlur = 0; // Reset shadow
            ctx.restore();
        });
        ctx.globalAlpha = 1; // Reset alpha

        // Stars - Motion blur ovals
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#fff';
        this.stars.forEach(s => {
            // Size based on depth - closer stars (smaller z) are larger
            const depthFactor = (width - s.z) / width;
            const baseWidth = s.size * (0.3 + depthFactor * 0.5); // Base thickness
            const finalWidth = baseWidth * this.starThinScale;

            // Height stretches based on Y position - fatter at bottom, skinnier at top
            const screenProgress = s.y / height; // 0 at top, 1 at bottom
            const stretchFactor = 0.5 + screenProgress * 3; // More stretch toward bottom
            const height_oval = baseWidth * stretchFactor * 4 * (1 + this.forwardRatio * 0.3);

            if (s.x > 0 && s.x < width && s.y > 0 && s.y < height) {
                // Very faded - max opacity of 0.25
                ctx.globalAlpha = (0.1 + depthFactor * 0.15);

                // Simple trail
                ctx.fillStyle = '#fff';
                ctx.fillRect(s.x - finalWidth / 2, s.y - height_oval / 2, finalWidth, height_oval);
            }
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';

        // Planets
        ctx.globalCompositeOperation = 'source-over';
        this.planets.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 20; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // Shadow/Crater detail
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(p.x - p.r * 0.3, p.y + p.r * 0.3, p.r * 0.8, 0, Math.PI * 2); ctx.fill();
        });
    }
}
