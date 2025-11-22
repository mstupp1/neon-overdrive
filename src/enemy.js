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

        if (type === 'chaser') { this.hp = 4; this.radius = 18; this.speed = rand(2, 3.5); }
        else if (type === 'spinner') { this.hp = 15; this.radius = 25; this.speed = 1.5; }
        else if (type === 'dasher') {
            this.hp = 3; this.radius = 12; this.speed = 6;
            const a = Math.atan2(player.y - this.y, player.x - this.x);
            this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed;
        }
        else if (type === 'snake') {
            this.hp = 20; this.radius = 15;
            this.segments = [];
            for (let i = 0; i < 8; i++) this.segments.push({ x: this.x, y: this.y - i * 15 });
        }
        else if (type === 'sniper') {
            this.hp = 6; this.radius = 20;
            this.tx = rand(50, width - 50); this.ty = rand(50, height * 0.4);
        }
    }

    update() {
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
            this.x += Math.cos(a) * this.speed; this.y += Math.max(1, Math.sin(a) * this.speed);
            this.fireTimer++;
            if (allowFire && this.fireTimer > 140) { // Fire less often to ease pressure (was 100)
                this.fireTimer = 0;
                // Light harassment shots from chasers
                spawnBullet(this.x, this.y, a + rand(-0.2, 0.2), 6, 'enemy', 'basic');
            }
        }
        else if (this.type === 'spinner') {
            this.y += 0.8; this.x += Math.sin(frameCount * 0.03);
            this.timer++;
            if (allowFire && this.timer > 140) { // Fire less often to ease pressure (was 100)
                this.timer = 0;
                // Spinners lay down destructible orbs
                for (let i = 0; i < 8; i++) spawnBullet(this.x, this.y, i * (Math.PI / 4) + frameCount * 0.1, 4, 'enemy', 'orb');
            }
        }
        else if (this.type === 'dasher') {
            this.x += this.vx; this.y += this.vy;
            this.fireTimer++;
            if (allowFire && this.fireTimer > 70) { // Fire less often to ease pressure (was 50)
                this.fireTimer = 0;
                const backAngle = Math.atan2(this.vy, this.vx) + Math.PI; // Fire slightly backwards while dashing
                spawnBullet(this.x, this.y, backAngle + rand(-0.15, 0.15), 8, 'enemy', 'fast');
            }
        }
        else if (this.type === 'snake') {
            this.x += Math.sin(frameCount * 0.05) * 3; this.y += 2;
            let p = { x: this.x, y: this.y };
            this.segments.forEach(s => { s.x += (p.x - s.x) * 0.3; s.y += (p.y - s.y) * 0.3; p = { x: s.x, y: s.y }; });
            this.fireTimer++;
            if (allowFire && this.fireTimer > 85) { // Fire less often to ease pressure (was 60)
                this.fireTimer = 0;
                spawnBullet(this.x, this.y, Math.PI / 2, 5, 'enemy', 'wobble');
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
                    spawnBullet(this.x, this.y, a, 12, 'enemy', 'sniper'); // Start slower, accelerates
                    this.tx = rand(50, width - 50); this.ty = rand(50, height * 0.4); this.state = 'move';
                }
            }
        }

        // Drift down and disengage when overlapping the HUD zone
        if (inFadeZone) {
            const exitDrift = 1.5 + fadeT * 2.5;
            this.y += exitDrift;
            this.vx = (this.vx || 0) * 0.92;
            this.vy = (this.vy || 0) * 0.92;
        }

        // Soft steer away from edges so enemies don't linger at the borders
        const edgeMargin = 60;
        if (this.x < edgeMargin) this.x += (edgeMargin - this.x) * 0.05;
        else if (this.x > width - edgeMargin) this.x -= (this.x - (width - edgeMargin)) * 0.05;
        if (this.y < edgeMargin) this.y += (edgeMargin - this.y) * 0.05;
        else if (this.y > height - edgeMargin) this.y -= (this.y - (height - edgeMargin)) * 0.05;

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
        ctx.restore();
    }
}
