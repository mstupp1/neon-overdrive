/**
 * FLOATING TEXT CLASS
 */

class FloatingText {
    constructor() { this.active = false; }
    init(x, y, text, color) { this.x = x; this.y = y; this.text = text; this.color = color; this.life = 1; this.active = true; }
    update() { this.y -= 1; this.life -= 0.02; if (this.life <= 0) this.active = false; }
    draw(ctx) { ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.font = "bold 24px monospace"; ctx.fillText(this.text, this.x, this.y); ctx.globalAlpha = 1; }
}
