/**
 * ENEMY CLASS
 */

class Enemy {
    constructor() { this.active = false; this.segments = []; }
    init(type) {
        this.type = type; this.active = true; this.hp = 1;
        this.timer = rand(0, 30); // Randomize start to prevent sync
        this.state = 'move';
        this.fireTimer = rand(0, 50); // Randomize start
        this.flashTimer = 0; // Flash effect when taking damage
        this.fade = 1; this.inactive = false;
        this.vx = 0; this.vy = 0;

        const spawnMargin = 50;
        // Spawn from the top band only to keep entries predictable
        this.x = rand(spawnMargin, width - spawnMargin); this.y = -40;

        const stats = levelManager.getCurrentStats();
        const hpMult = stats.hpMod;
        const speedMult = stats.speedMod;

        if (type === 'chaser') { this.hp = 4 * hpMult; this.radius = 18; this.speed = rand(2, 3.5) * speedMult; this.damage = 1; }
        else if (type === 'spinner') { this.hp = 15 * hpMult; this.radius = 25; this.speed = 1.5 * speedMult; this.damage = 2; }
        else if (type === 'dasher') {
            this.hp = 3 * hpMult; this.radius = 12; this.speed = 6 * speedMult; this.damage = 3;
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed;
        }
        else if (type === 'snake') {
            this.hp = 20 * hpMult; this.radius = 15; this.damage = 4;
            this.segments = [];
            for (let i = 0; i < 8; i++) this.segments.push({ x: this.x, y: this.y - i * 15 });
        }
        else if (type === 'sniper') {
            this.hp = 6 * hpMult; this.radius = 20; this.damage = 5;
            this.tx = rand(50, width - 50); this.ty = rand(50, height * 0.4);
        }
        else if (type === 'boss_stage3') {
            this.hp = 500 * hpMult;
            this.radius = 70;
            this.damage = 10;
            this.x = width / 2;
            this.y = -150; // Start further up
            this.state = 'enter';
            this.vx = 0; this.vy = 0;

            // Attack timers
            this.fireTimer = 60;
            this.orbTimer = 120;
            this.torpedoTimer = 200;

            // Visuals
            this.lightsOffset = rand(0, 100);

            // Initialize segments array (even though boss doesn't use it)
            this.segments = [];
        }
        else if (type === 'boss_stage5') {
            this.hp = 800 * hpMult; // Tankier than stage 3
            this.radius = 80;
            this.damage = 15;
            this.x = width / 2;
            this.y = -200; // Start further up
            this.state = 'enter';
            this.vx = 0; this.vy = 0;

            // Attack timers
            this.fireTimer = 60;
            this.orbTimer = 180;
            this.fuzzyTimer = 300;

            // Visuals
            this.lightsOffset = rand(0, 100);

            // Tentacles (8 segments)
            this.segments = [];
            for (let i = 0; i < 8; i++) {
                // Each tentacle has multiple joints for smooth movement
                let tentacle = [];
                for (let j = 0; j < 25; j++) { // Increased from 10 to 25 for much longer tentacles
                    tentacle.push({ x: this.x, y: this.y - j * 12 }); // Increased spacing slightly
                }
                this.segments.push(tentacle);
            }
        }
    }

    update() {
        // Apply slow-down effect if active
        let slowMult = 1.0;
        if (player.activePowerups && player.activePowerups.has('slowDown')) {
            slowMult = 0.4; // 60% slower
        }

        // Decrease flash timer
        if (this.flashTimer > 0) this.flashTimer--;

        // Fade-out zone near the bottom HUD to prevent clumping
        const bottomHudHeight = 80;
        const fadeBuffer = 50; // Reduced from 140 to keep enemies active longer
        const fadeStart = height - (bottomHudHeight + fadeBuffer);
        const fadeEnd = height - bottomHudHeight + 10;
        const inFadeZone = this.y >= fadeStart;
        const fadeT = inFadeZone ? Math.min(1, (this.y - fadeStart) / (fadeEnd - fadeStart)) : 0;
        this.fade = 1 - fadeT;
        this.inactive = inFadeZone;
        const allowFire = !this.inactive;

        if (this.type === 'chaser') {
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(a) * this.speed * slowMult; this.y += Math.max(1, Math.sin(a) * this.speed * slowMult);
            this.fireTimer++;
            if (allowFire && this.fireTimer > 140) { // Fire less often to ease pressure (was 100)
                this.fireTimer = 0;
                // Light harassment shots from chasers
                spawnBullet(this.x, this.y, a + rand(-0.2, 0.2), 6, 'enemy', 'basic', { damage: this.damage });
            }
        }
        else if (this.type === 'spinner') {
            this.y += 0.8 * slowMult; this.x += Math.sin(frameCount * 0.03) * slowMult;
            this.timer++;
            if (allowFire && this.timer > 140) { // Fire less often to ease pressure (was 100)
                this.timer = 0;
                // Spinners lay down destructible orbs
                for (let i = 0; i < 8; i++) spawnBullet(this.x, this.y, i * (Math.PI / 4) + frameCount * 0.1, 4, 'enemy', 'orb', { damage: this.damage });
            }
        }
        else if (this.type === 'dasher') {
            this.x += this.vx * slowMult; this.y += this.vy * slowMult;
            this.fireTimer++;
            if (allowFire && this.fireTimer > 70) { // Fire less often to ease pressure (was 50)
                this.fireTimer = 0;
                const backAngle = Math.atan2(this.vy, this.vx) + Math.PI; // Fire slightly backwards while dashing
                spawnBullet(this.x, this.y, backAngle + rand(-0.15, 0.15), 8, 'enemy', 'fast', { damage: this.damage });
            }
        }
        else if (this.type === 'snake') {
            this.x += Math.sin(frameCount * 0.05) * 3 * slowMult; this.y += 2 * slowMult;
            let p = { x: this.x, y: this.y };
            this.segments.forEach(s => { s.x += (p.x - s.x) * 0.3; s.y += (p.y - s.y) * 0.3; p = { x: s.x, y: s.y }; });
            this.fireTimer++;
            if (allowFire && this.fireTimer > 85) { // Fire less often to ease pressure (was 60)
                this.fireTimer = 0;
                spawnBullet(this.x, this.y, Math.PI / 2, 5, 'enemy', 'wobble', { damage: this.damage });
            }
        }
        else if (this.type === 'sniper') {
            if (this.state === 'move') {
                this.x += (this.tx - this.x) * 0.05; this.y += (this.ty - this.y) * 0.05;
                if (Math.abs(this.x - this.tx) < 5) { this.state = 'aim'; this.timer = 0; }
            } else if (this.state === 'aim') {
                this.timer++;
                if (allowFire && this.timer > 80) { // Fire less often to ease pressure (was 60)
                    const a = Math.atan2(player.y - this.y, player.x - this.x);
                    spawnBullet(this.x, this.y, a, 12, 'enemy', 'sniper', { damage: this.damage }); // Start slower, accelerates
                    this.tx = rand(50, width - 50); this.ty = rand(50, height * 0.4); this.state = 'move';
                }
            }
        }
        else if (this.type === 'boss_stage3') {
            if (this.state === 'enter') {
                this.y += 2;
                if (this.y >= 150) {
                    this.state = 'fight';
                    this.baseY = 150;
                    this.timer = 0;
                }
            } else if (this.state === 'fight') {
                // Movement: Figure 8 or simple horizontal sway
                this.timer++;
                this.x = width / 2 + Math.sin(this.timer * 0.02) * (width * 0.35);
                this.y = this.baseY + Math.sin(this.timer * 0.05) * 30;

                if (allowFire) {
                    // Attack 1: Basic Spread
                    this.fireTimer--;
                    if (this.fireTimer <= 0) {
                        this.fireTimer = 90;
                        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
                        for (let i = -2; i <= 2; i++) {
                            spawnBullet(this.x, this.y, baseAngle + i * 0.15, 7, 'enemy', 'basic', { damage: 1 });
                        }
                    }

                    // Attack 2: Destructible Orbs (Orange)
                    this.orbTimer--;
                    if (this.orbTimer <= 0) {
                        this.orbTimer = 150;
                        for (let i = 0; i < 6; i++) {
                            const angle = (i / 6) * Math.PI * 2 + this.timer * 0.05;
                            spawnBullet(this.x, this.y, angle, 5, 'enemy', 'orb', { damage: 2 });
                        }
                    }

                    // Attack 3: Homing Torpedos (Tanky)
                    this.torpedoTimer--;
                    if (this.torpedoTimer <= 0) {
                        this.torpedoTimer = 240; // Every 4 seconds
                        // Shoot 2 torpedos from sides
                        spawnBullet(this.x + 60, this.y, Math.PI / 2, 4, 'enemy', 'torpedo', { damage: 3, hp: 5 });
                    }
                }
            }
        }
        else if (this.type === 'boss_stage5') {
            if (this.state === 'enter') {
                this.y += 1.5;
                if (this.y >= 150) {
                    this.state = 'fight';
                    this.baseY = 150;
                    this.timer = 0;
                }
            } else if (this.state === 'fight') {
                this.timer++;
                // Slow movement - Ensure it stays centered
                // Using a smaller amplitude and ensuring it oscillates around width/2
                this.x = width / 2 + Math.sin(this.timer * 0.015) * (width * 0.1); // Reduced amplitude further
                this.y = this.baseY + Math.sin(this.timer * 0.03) * 20;

                // Update Tentacles (Slithering effect)
                this.segments.forEach((tentacle, tIndex) => {
                    // Base position (attached to body)
                    // Distribute around the body - Match the ellipse shape (60, 80)
                    const angle = (tIndex / 8) * Math.PI * 2 + this.timer * 0.02;
                    // Attach at the edge of the ellipse (slightly inside to look connected)
                    const attachX = this.x + Math.cos(angle) * 55; // Close to 60
                    const attachY = this.y + Math.sin(angle) * 75; // Close to 80

                    let p = { x: attachX, y: attachY };
                    tentacle.forEach((segment, sIndex) => {
                        // Drag effect
                        segment.x += (p.x - segment.x) * 0.2;
                        segment.y += (p.y - segment.y) * 0.2;

                        // Add sine wave motion
                        segment.x += Math.sin(this.timer * 0.05 + tIndex + sIndex * 0.5) * 2;
                        segment.y += Math.cos(this.timer * 0.05 + tIndex + sIndex * 0.5) * 2;

                        p = { x: segment.x, y: segment.y };
                    });
                });

                if (allowFire) {
                    // Attack 1: Snake Shots (Wobble)
                    this.fireTimer--;
                    if (this.fireTimer <= 0) {
                        this.fireTimer = 100;
                        const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
                        for (let i = -3; i <= 3; i++) {
                            spawnBullet(this.x, this.y, baseAngle + i * 0.2, 6, 'enemy', 'wobble', { damage: 2 });
                        }
                    }

                    // Attack 2: Destructible Orbs (Orange)
                    this.orbTimer--;
                    if (this.orbTimer <= 0) {
                        this.orbTimer = 200;
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2 + this.timer * 0.05;
                            spawnBullet(this.x, this.y, angle, 4, 'enemy', 'orb', { damage: 3 });
                        }
                    }

                    // Attack 3: Fuzzy Homing (Yellow)
                    this.fuzzyTimer--;
                    if (this.fuzzyTimer <= 0) {
                        this.fuzzyTimer = 350; // Rare attack
                        spawnBullet(this.x, this.y, -Math.PI / 2, 3, 'enemy', 'fuzzy', { damage: 5, hp: 15 }); // Very tanky
                    }
                }
            }
        }

        // Drift down and disengage when overlapping the HUD zone (not for bosses)
        if (inFadeZone && this.type !== 'boss_stage3') {
            const exitDrift = 1.5 + fadeT * 2.5;
            this.y += exitDrift;
            this.vx = (this.vx || 0) * 0.92;
            this.vy = (this.vy || 0) * 0.92;
        }

        // Soft steer away from edges so enemies don't linger at the borders (not for bosses)
        if (this.type !== 'boss_stage3') {
            const edgeMargin = 60;
            if (this.x < edgeMargin) this.x += (edgeMargin - this.x) * 0.05;
            else if (this.x > width - edgeMargin) this.x -= (this.x - (width - edgeMargin)) * 0.05;
            if (this.y < edgeMargin) this.y += (edgeMargin - this.y) * 0.05;
            else if (this.y > height - edgeMargin) this.y -= (this.y - (height - edgeMargin)) * 0.05;
        }

        if (this.y > height + 100 || this.x < -100 || this.x > width + 100) this.active = false;
    }

    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y);

        const baseAlpha = this.fade ?? 1;
        ctx.globalAlpha = baseAlpha;

        // Flash effect when taking damage
        if (this.flashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
            const flashIntensity = this.flashTimer / 8; // 8 frames flash duration
            ctx.shadowBlur = 20 * flashIntensity;
            ctx.shadowColor = '#fff';
            ctx.globalAlpha = baseAlpha * (0.5 + (flashIntensity * 0.5));
        }

        if (this.type === 'chaser') {
            ctx.rotate(Math.atan2(player.y - this.y, player.x - this.x) - Math.PI / 2);
            ctx.drawImage(sprites.enemyChaser, -30, -30); // Size roughly (20+10)*2 = 60
        }
        else if (this.type === 'spinner') {
            ctx.drawImage(sprites.enemySpinner, -40, -40); // Size roughly (30+10)*2 = 80
        }
        else if (this.type === 'dasher') {
            ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
            ctx.drawImage(sprites.enemyDasher, -30, -30);
        }
        else if (this.type === 'snake') {
            // Draw tail segments first (so head appears on top)
            ctx.restore(); ctx.save();
            ctx.globalAlpha = baseAlpha;
            // Flash effect for segments too
            if (this.flashTimer > 0) {
                ctx.shadowBlur = 15 * (this.flashTimer / 8);
                ctx.shadowColor = '#fff';
            }
            this.segments.forEach((s, i) => {
                ctx.fillStyle = `rgba(50, 255, 50, ${1 - i / 10})`;
                ctx.beginPath(); ctx.arc(s.x, s.y, 10 - i, 0, Math.PI * 2); ctx.fill();
            });

            // Draw head on top
            ctx.restore(); ctx.save();
            ctx.translate(this.x, this.y);
            ctx.globalAlpha = baseAlpha;
            if (this.flashTimer > 0) {
                ctx.globalCompositeOperation = 'lighter';
                const flashIntensity = this.flashTimer / 8;
                ctx.shadowBlur = 20 * flashIntensity;
                ctx.shadowColor = '#fff';
                ctx.globalAlpha = baseAlpha * (0.5 + (flashIntensity * 0.5));
            }
            ctx.drawImage(sprites.enemySnake, -25, -25); // Head drawn last
        }
        else if (this.type === 'sniper') {
            ctx.drawImage(sprites.enemySniper, -30, -30);
            if (this.state === 'aim') {
                ctx.restore(); ctx.save(); ctx.globalAlpha = baseAlpha; ctx.strokeStyle = `rgba(255,0,0,${this.timer / 50})`; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(player.x, player.y); ctx.stroke();
            }
        }
        else if (this.type === 'boss_stage3') {
            // Reset any previous state changes first
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';

            // Draw Boss
            // Main Body
            ctx.fillStyle = '#222';
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 4;

            // Central Hull
            ctx.beginPath();
            ctx.rect(-60, -40, 120, 80);
            ctx.fill();
            ctx.stroke();

            // Side Pods (Engines/Weapon Mounts)
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.rect(-90, -30, 30, 60); // Left
            ctx.rect(60, -30, 30, 60);  // Right
            ctx.fill();
            ctx.stroke();

            // Mandibles (Front)
            ctx.fillStyle = '#444';
            ctx.beginPath();
            ctx.moveTo(-40, 40); ctx.lineTo(-50, 80); ctx.lineTo(-30, 70); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(40, 40); ctx.lineTo(50, 80); ctx.lineTo(30, 70); ctx.closePath(); ctx.fill(); ctx.stroke();

            // Blinking Lights (Red/Orange)
            const blink = Math.sin((frameCount + this.lightsOffset) * 0.1) > 0;
            ctx.fillStyle = blink ? '#ff0000' : '#550000';
            ctx.shadowBlur = blink ? 15 : 0;
            ctx.shadowColor = '#ff0000';

            // Eyes/Sensors
            ctx.beginPath(); ctx.arc(-20, 20, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(20, 20, 5, 0, Math.PI * 2); ctx.fill();

            // Central Core (Pulsing)
            const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05);
            ctx.fillStyle = `rgba(255, 100, 0, ${pulse})`;
            ctx.shadowBlur = 20 * pulse;
            ctx.shadowColor = '#ff6600';
            ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();

            // Turrets (Visual only)
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#666';
            ctx.beginPath(); ctx.arc(-50, -10, 8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(50, -10, 8, 0, Math.PI * 2); ctx.fill();

            // Barrels pointing at player
            const aimAngle = Math.atan2(player.y - this.y, player.x - this.x) - Math.PI / 2;
            ctx.save();
            ctx.translate(-50, -10); ctx.rotate(aimAngle);
            ctx.fillStyle = '#888'; ctx.fillRect(-2, 0, 4, 15);
            ctx.restore();

            ctx.save();
            ctx.translate(50, -10); ctx.rotate(aimAngle);
            ctx.fillStyle = '#888'; ctx.fillRect(-2, 0, 4, 15);
            ctx.restore();

            // Clean up state before final restore
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.globalCompositeOperation = 'source-over';
        }
        else if (this.type === 'boss_stage5') {
            // Reset any previous state changes first
            ctx.globalCompositeOperation = 'source-over';
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';

            // Draw Tentacles first (behind body)
            this.segments.forEach((tentacle, tIndex) => {
                ctx.beginPath();
                tentacle.forEach((s, sIndex) => {
                    if (sIndex === 0) ctx.moveTo(s.x, s.y);
                    else ctx.lineTo(s.x, s.y);
                });

                // Tentacle style
                ctx.strokeStyle = `hsl(${100 + tIndex * 10}, 80%, 30%)`; // Green to Dark Green
                ctx.lineWidth = 12;
                ctx.lineCap = 'round';
                ctx.stroke();

                // Inner highlight
                ctx.strokeStyle = `hsl(${100 + tIndex * 10}, 80%, 50%)`;
                ctx.lineWidth = 4;
                ctx.stroke();
            });

            // Draw Main Body
            ctx.save();
            ctx.translate(this.x, this.y);

            // Body Glow
            const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05);
            ctx.shadowBlur = 30 * pulse;
            ctx.shadowColor = '#00ff00';

            // Main Hull
            ctx.fillStyle = '#004400'; // Dark Green
            ctx.beginPath();
            ctx.ellipse(0, 0, 60, 80, 0, 0, Math.PI * 2);
            ctx.fill();

            // Purple/Yellow Accents
            ctx.fillStyle = '#440044'; // Purple
            ctx.beginPath();
            ctx.ellipse(0, -20, 40, 50, 0, 0, Math.PI * 2);
            ctx.fill();

            // Horns
            ctx.fillStyle = '#aaaa00'; // Yellowish Horns
            ctx.beginPath();
            ctx.moveTo(-40, -40); ctx.lineTo(-70, -90); ctx.lineTo(-20, -60); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(40, -40); ctx.lineTo(70, -90); ctx.lineTo(20, -60); ctx.fill();

            // Eyes
            const blink = Math.sin((frameCount + this.lightsOffset) * 0.1) > 0;
            ctx.fillStyle = blink ? '#ffff00' : '#888800';
            ctx.shadowBlur = blink ? 20 : 0;
            ctx.shadowColor = '#ffff00';

            ctx.beginPath(); ctx.arc(-25, 0, 10, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(25, 0, 10, 0, Math.PI * 2); ctx.fill();

            // Mouth / Core
            ctx.fillStyle = '#220022';
            ctx.beginPath();
            ctx.arc(0, 40, 20, 0, Math.PI, false);
            ctx.fill();

            ctx.restore();
        }
        ctx.restore();
    }
}
