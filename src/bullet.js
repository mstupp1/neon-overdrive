/**
 * BULLET CLASS
 */

class Bullet {
    constructor() { this.active = false; }
    init(x, y, angle, speed, type, subType = 'normal', opts = {}) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed; this.vy = Math.sin(angle) * speed;
        this.angle = angle; this.speed = speed;
        this.type = type; this.subType = subType;
        this.active = true;
        this.destructible = false; // Default

        const baseStats = PLAYER_WEAPON_BASE[subType] || PLAYER_WEAPON_BASE.normal;
        const defaultDamage = type === 'player' ? (baseStats?.damage || 1) : 1;
        this.damage = opts.damage ?? defaultDamage;
        this.hp = opts.hp ?? 1; // Default to 1 HP (instantly destroyed)
        this.pierce = opts.pierce ?? (subType === 'blade' || subType === 'wave');
        this.tintHue = opts.tintHue ?? 0;
        this.glow = opts.glow ?? 0;
        this.helixPhase = opts.helixPhase ?? 0;

        // Set radius based on subtype
        if (type === 'enemy') {
            if (subType === 'basic') this.radius = 5;
            else if (subType === 'orb') { this.radius = 12; this.destructible = true; } // Bigger & destructible
            else if (subType === 'fast') this.radius = 4;
            else if (subType === 'sniper') this.radius = 8;
            else if (subType === 'wobble') this.radius = 6;
            else if (subType === 'torpedo') { this.radius = 10; this.destructible = true; }
            else if (subType === 'fuzzy') { this.radius = 40; this.destructible = true; } // Massive
            else this.radius = 6;
        } else {
            this.radius = 8;
        }

        this.timer = 0; this.rotation = 0;
        this.life = 1.0;
        this.initialAngle = angle; // For wobble
    }

    update() {
        this.timer++;

        // Apply slow-down effect to enemy bullets
        let speedMult = 1.0;
        if (this.type === 'enemy' && player.activePowerups && player.activePowerups.has('slowDown')) {
            speedMult = 0.4; // 60% slower
        }

        this.x += this.vx * speedMult;
        this.y += this.vy * speedMult;

        if (this.subType === 'homing') {
            let target = null;
            let minDist = 400;
            if (frameCount % 4 === 0) {
                for (let e of enemies) {
                    if (!e.active) continue;
                    let d = dist(this.x, this.y, e.x, e.y);
                    if (d < minDist && e.y > 0) { minDist = d; target = e; }
                }
            }

            if (target) {
                let angleTo = Math.atan2(target.y - this.y, target.x - this.x);
                let diff = angleTo - this.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.angle += diff * 0.15;
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
            }
        } else if (this.subType === 'blade') {
            this.rotation += 0.3;
            this.vx *= 0.99; this.vy *= 0.99;
            this.life -= 0.005;
            if (this.life <= 0) this.active = false;
        } else if (this.subType === 'helix') {
            const helixRadius = 16;
            const helixFrequency = 0.25;
            const perpendicularAngle = this.angle + Math.PI / 2;
            const offsetMagnitude = Math.sin(this.timer * helixFrequency + this.helixPhase) * helixRadius;
            this.x += Math.cos(perpendicularAngle) * offsetMagnitude;
            this.y += Math.sin(perpendicularAngle) * offsetMagnitude;
        } else if (this.subType === 'wobble') {
            // Sine wave motion relative to direction
            this.x += Math.cos(this.angle + Math.PI / 2) * Math.sin(this.timer * 0.2) * 2;
            this.y += Math.sin(this.angle + Math.PI / 2) * Math.sin(this.timer * 0.2) * 2;
        } else if (this.subType === 'sniper') {
            // Accelerate
            this.speed += 0.2;
            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
        } else if (this.subType === 'torpedo') {
            // Torpedos home on player
            if (frameCount % 4 === 0) {
                let angleTo = Math.atan2(player.y - this.y, player.x - this.x);
                let diff = angleTo - this.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.angle += diff * 0.12; // Slightly slower turning than homing missiles
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
            }
        } else if (this.subType === 'fuzzy') {
            // Slow homing, very persistent
            if (frameCount % 2 === 0) {
                let angleTo = Math.atan2(player.y - this.y, player.x - this.x);
                let diff = angleTo - this.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.angle += diff * 0.05; // Very slow turn
                this.vx = Math.cos(this.angle) * this.speed;
                this.vy = Math.sin(this.angle) * this.speed;
            }
        }

        // Let enemy bullets travel farther offscreen to keep long shots alive a bit longer
        const bounds = this.type === 'enemy' ? 300 : 50;
        if (this.x < -bounds || this.x > width + bounds || this.y < -bounds || this.y > height + bounds) this.active = false;
    }

    draw(ctx) {
        if (this.type === 'enemy') {
            ctx.globalAlpha = 1;
            if (this.subType === 'basic') ctx.drawImage(sprites.enemyBulletBasic, this.x - 12, this.y - 12);
            else if (this.subType === 'orb') ctx.drawImage(sprites.enemyBulletOrb, this.x - 24, this.y - 24); // Larger
            else if (this.subType === 'fast') {
                ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle + Math.PI / 2);
                ctx.drawImage(sprites.enemyBulletFast, -6, -15); // Beam shape
                ctx.restore();
            }
            else if (this.subType === 'sniper') {
                ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
                ctx.drawImage(sprites.enemyBulletSniper, -15, -15);
                ctx.restore();
            }
            else if (this.subType === 'wobble') ctx.drawImage(sprites.enemyBulletWobble, this.x - 12, this.y - 12);
            else if (this.subType === 'torpedo') {
                ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle + Math.PI / 2);
                ctx.drawImage(sprites.enemyBulletTorpedo, -10, -20); // Torpedo sprite
                ctx.restore();
            }
            else if (this.subType === 'fuzzy') {
                // Procedural drawing for fuzzy bullet
                ctx.save(); ctx.translate(this.x, this.y);

                // Fuzzy glow with Flash
                const flash = Math.floor(frameCount / 4) % 2 === 0; // Flash every 4 frames
                const pulse = 0.8 + 0.2 * Math.sin(frameCount * 0.2);

                ctx.shadowBlur = (flash ? 60 : 30) * pulse; // More glow
                ctx.shadowColor = flash ? '#ff0000' : '#ffff00'; // Flash red

                // Core
                ctx.fillStyle = flash ? '#ffcccc' : '#ffffaa';
                ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.fill(); // Increased size to 35

                // Outer fuzz
                ctx.strokeStyle = `rgba(${flash ? '255, 0, 0' : '255, 255, 0'}, ${0.5 * pulse})`;
                ctx.lineWidth = 4;
                for (let i = 0; i < 12; i++) { // More fuzz strands
                    ctx.beginPath();
                    ctx.arc(0, 0, 40 + Math.random() * 10, i * Math.PI / 6, (i + 1) * Math.PI / 6); // Increased size
                    ctx.stroke();
                }

                ctx.restore();
            }
            else ctx.drawImage(sprites.enemyBulletBasic, this.x - 12, this.y - 12); // Fallback
        } else {
            const prevAlpha = ctx.globalAlpha;
            const prevFilter = ctx.filter;
            const alphaBoost = this.glow || 0;
            ctx.globalAlpha = Math.min(1.2, 0.9 + alphaBoost);
            if (this.tintHue) ctx.filter = `hue-rotate(${this.tintHue}deg) saturate(1.2)`;
            else ctx.filter = 'none';
            ctx.globalCompositeOperation = 'lighter';
            if (this.subType === 'beam') {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle + Math.PI / 2);
                ctx.drawImage(sprites.playerBeam, -10, -20, 20, 40);
                ctx.restore();
            }
            else if (this.subType === 'homing') ctx.drawImage(sprites.playerHoming, this.x - 12, this.y - 12);
            else if (this.subType === 'wave') ctx.drawImage(sprites.playerWave, this.x - 18, this.y - 18);
            else if (this.subType === 'helix') ctx.drawImage(sprites.playerWave, this.x - 18, this.y - 18);
            else if (this.subType === 'blade') {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.globalAlpha = Math.max(0, this.life);
                ctx.drawImage(sprites.playerBlade, -25, -25);
                ctx.globalAlpha = 1;
                ctx.restore();
            }
            else if (this.subType === 'missile') {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle + Math.PI / 2);
                ctx.drawImage(sprites.playerMissile, -16, -16, 32, 32);
                ctx.restore();
            }
            else ctx.drawImage(sprites.playerNormal, this.x - 12, this.y - 12);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = prevAlpha;
            ctx.filter = prevFilter;
        }
    }
}
