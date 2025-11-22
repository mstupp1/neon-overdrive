/**
 * POWERUP CLASS
 */

class PowerUp {
    constructor() { this.active = false; }
    init(x, y, type = null, isKnockout = false) {
        this.x = x; this.y = y; this.active = true; this.radius = 16;
        this.isKnockout = isKnockout;
        this.pickupTimer = 0;
        this.age = 0;
        this.lifetime = POWERUP_LIFETIME_FRAMES;

        // Always bounce/move dynamically
        const a = Math.random() * 6.28;
        const speed = isKnockout ? 15 : rand(3, 7);
        this.vx = Math.cos(a) * speed;
        this.vy = Math.sin(a) * speed;

        if (isKnockout) this.pickupTimer = 60;

        if (type) this.type = type;
        else {
            const r = Math.random();
            if (r > 0.95) this.type = 'bomb';    // 5%
            else if (r > 0.85) this.type = 'shield'; // 10%
            else if (r > 0.80) this.type = 'life';   // 5%
            else if (r > 0.70) this.type = 'weapon'; // 10%
            else this.type = 'score';                // 70%
        }
    }
    update() {
        if (this.pickupTimer > 0) this.pickupTimer--;
        this.age++;
        if (this.age >= this.lifetime) {
            this.active = false;
            return;
        }
        this.x += this.vx; this.y += this.vy;

        // Bounce off walls
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        // Low friction to keep them moving
        this.vx *= 0.995;
        this.vy *= 0.995;

        // Keep within bounds just in case
        if (this.x < -50) this.x = 50;
        if (this.x > width + 50) this.x = width - 50;
        if (this.y < -50) this.y = 50;
        if (this.y > height + 50) this.y = height - 50;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.x, this.y);
        const s = 1 + Math.sin(frameCount * 0.2) * 0.3; ctx.scale(s, s);

        const timeLeft = Math.max(0, this.lifetime - this.age);
        let baseAlpha = 1;
        if (this.pickupTimer > 0) baseAlpha *= 0.5;
        if (timeLeft <= POWERUP_BLINK_FRAMES) {
            const urgency = timeLeft / POWERUP_BLINK_FRAMES;
            const pulse = 0.4 + Math.abs(Math.sin(frameCount * 0.5)) * 0.6;
            baseAlpha *= Math.max(0.15, pulse * (0.4 + urgency * 0.6));
        }

        let c = '#fff', t = '?';
        if (this.type === 'weapon') { c = '#0ff'; t = 'W'; }
        else if (this.type === 'bomb') { c = '#ff0'; t = 'B'; }
        else if (this.type === 'shield') { c = '#00f'; t = 'S'; }
        else if (this.type === 'life') { c = '#f00'; t = '♥'; }
        else if (this.type === 'score') { c = '#fd0'; t = '$'; }

        // Optimization: Removed shadowBlur
        // ctx.shadowBlur = 10; ctx.shadowColor = c; 

        ctx.globalAlpha = baseAlpha;
        if (this.type === 'bomb') {
            ctx.beginPath(); ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 0, ${0.3 + Math.sin(frameCount * 0.5) * 0.2})`; ctx.fill();
        }

        ctx.strokeStyle = c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.stroke();

        // Add a simple glow using a translucent arc behind
        ctx.fillStyle = c;
        ctx.globalAlpha = baseAlpha * 0.3;
        ctx.beginPath(); ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = baseAlpha;

        ctx.fillStyle = c; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t, 0, 2);
        ctx.restore();
    }
}
