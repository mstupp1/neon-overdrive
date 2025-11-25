/**
 * ASSETS & SPRITES
 */

const sprites = {};

function renderGlowSprite(color, radius, glow, type = 'circle', fillColor = '#fff') {
    const size = (radius + glow) * 2;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const cx = c.getContext('2d');
    const center = size / 2;

    cx.shadowBlur = glow; cx.shadowColor = color;
    cx.fillStyle = fillColor;

    if (type === 'circle') {
        cx.beginPath(); cx.arc(center, center, radius, 0, Math.PI * 2); cx.fill();
    } else if (type === 'beam') {
        cx.fillStyle = color;
        cx.fillRect(center - radius, center - radius * 3, radius * 2, radius * 6);
        cx.fillStyle = '#fff';
        cx.fillRect(center - radius / 2, center - radius * 2, radius, radius * 4);
    } else if (type === 'blade') {
        cx.strokeStyle = color; cx.lineWidth = 3;
        cx.beginPath();
        cx.moveTo(center - radius, center); cx.lineTo(center + radius, center);
        cx.moveTo(center, center - radius); cx.lineTo(center, center + radius);
        cx.stroke();
    } else if (type === 'chaser') {
        cx.shadowBlur = glow; cx.shadowColor = color;

        // Core hull
        const hullGrad = cx.createLinearGradient(center, center - 18, center, center + 18);
        hullGrad.addColorStop(0, '#ff5a5a');
        hullGrad.addColorStop(1, '#d00000');
        cx.fillStyle = hullGrad;
        cx.beginPath();
        cx.moveTo(center, center - 18);
        cx.lineTo(center + 10, center + 6);
        cx.lineTo(center, center + 18);
        cx.lineTo(center - 10, center + 6);
        cx.closePath();
        cx.fill();

        // Wings
        cx.fillStyle = '#ff1f1f';
        cx.beginPath();
        cx.moveTo(center - 16, center + 2);
        cx.lineTo(center - 4, center + 8);
        cx.lineTo(center - 2, center + 2);
        cx.lineTo(center - 12, center - 10);
        cx.closePath();
        cx.fill();
        cx.beginPath();
        cx.moveTo(center + 16, center + 2);
        cx.lineTo(center + 4, center + 8);
        cx.lineTo(center + 2, center + 2);
        cx.lineTo(center + 12, center - 10);
        cx.closePath();
        cx.fill();

        // Nose highlight
        cx.fillStyle = '#ffb6b6';
        cx.beginPath();
        cx.moveTo(center, center - 18);
        cx.lineTo(center + 3, center - 10);
        cx.lineTo(center - 3, center - 10);
        cx.closePath();
        cx.fill();

        // Engine glow
        cx.fillStyle = '#ff4040';
        cx.beginPath();
        cx.ellipse(center, center + 20, 5, 8, 0, 0, Math.PI * 2);
        cx.fill();
    } else if (type === 'spinnerCore') {
        cx.shadowBlur = glow; cx.shadowColor = color;

        // Saucer base
        const baseGrad = cx.createLinearGradient(center, center - 10, center, center + 16);
        baseGrad.addColorStop(0, '#f66cf6');
        baseGrad.addColorStop(1, '#a300a3');
        cx.fillStyle = baseGrad;
        cx.beginPath();
        cx.ellipse(center, center + 2, 20, 12, 0, 0, Math.PI * 2);
        cx.fill();

        // Central ring (static accent)
        cx.strokeStyle = '#ffb2ff';
        cx.lineWidth = 3;
        cx.beginPath(); cx.ellipse(center, center + 2, 14, 8, 0, 0, Math.PI * 2); cx.stroke();

        // Glass dome
        const domeGrad = cx.createRadialGradient(center - 4, center - 4, 2, center, center - 6, 12);
        domeGrad.addColorStop(0, '#ffe8ff');
        domeGrad.addColorStop(1, '#c03bc0');
        cx.fillStyle = domeGrad;
        cx.beginPath(); cx.arc(center, center - 6, 10, 0, Math.PI * 2); cx.fill();

        // Soft underglow
        cx.fillStyle = 'rgba(255, 102, 255, 0.15)';
        cx.beginPath(); cx.ellipse(center, center + 18, 18, 6, 0, 0, Math.PI * 2); cx.fill();
    } else if (type === 'spinnerRing') {
        cx.shadowBlur = glow; cx.shadowColor = color;

        // Outer ring
        const ringGrad = cx.createLinearGradient(center - 22, center, center + 22, center);
        ringGrad.addColorStop(0, '#ff7aff');
        ringGrad.addColorStop(1, '#b300b3');
        cx.strokeStyle = ringGrad;
        cx.lineWidth = 4;
        cx.beginPath(); cx.ellipse(center, center, 24, 16, 0, 0, Math.PI * 2); cx.stroke();

        // Spinner fins on the ring
        cx.fillStyle = '#ff4dff';
        for (let i = 0; i < 4; i++) {
            cx.save(); cx.translate(center, center); cx.rotate(i * Math.PI / 2);
            cx.beginPath(); cx.moveTo(18, 0); cx.lineTo(28, 6); cx.lineTo(28, -6); cx.closePath(); cx.fill();
            cx.restore();
        }
    } else if (type === 'dasher') {
        cx.shadowBlur = glow; cx.shadowColor = color;

        // Missile body (cylindrical with gradient)
        const bodyGrad = cx.createLinearGradient(center - 8, center - 15, center + 8, center + 15);
        bodyGrad.addColorStop(0, '#ffff66');
        bodyGrad.addColorStop(0.5, '#ffdd00');
        bodyGrad.addColorStop(1, '#cc9900');
        cx.fillStyle = bodyGrad;
        cx.fillRect(center - 6, center - 10, 12, 20);

        // Warning stripes on body
        cx.fillStyle = '#000';
        cx.fillRect(center - 6, center - 4, 12, 2);
        cx.fillRect(center - 6, center + 2, 12, 2);

        // Pointed nose cone
        const noseGrad = cx.createLinearGradient(center, center - 20, center, center - 10);
        noseGrad.addColorStop(0, '#ff4444');
        noseGrad.addColorStop(1, '#ffaa00');
        cx.fillStyle = noseGrad;
        cx.beginPath();
        cx.moveTo(center, center - 20);
        cx.lineTo(center + 6, center - 10);
        cx.lineTo(center - 6, center - 10);
        cx.closePath();
        cx.fill();

        // Nose cone highlight
        cx.fillStyle = '#ffcccc';
        cx.beginPath();
        cx.moveTo(center, center - 20);
        cx.lineTo(center + 2, center - 14);
        cx.lineTo(center - 1, center - 14);
        cx.closePath();
        cx.fill();

        // Stabilizer fins (4 fins)
        cx.fillStyle = '#ffaa00';
        cx.strokeStyle = '#996600';
        cx.lineWidth = 1;

        // Left fin
        cx.beginPath();
        cx.moveTo(center - 6, center + 5);
        cx.lineTo(center - 12, center + 2);
        cx.lineTo(center - 12, center + 8);
        cx.lineTo(center - 6, center + 10);
        cx.closePath();
        cx.fill();
        cx.stroke();

        // Right fin
        cx.beginPath();
        cx.moveTo(center + 6, center + 5);
        cx.lineTo(center + 12, center + 2);
        cx.lineTo(center + 12, center + 8);
        cx.lineTo(center + 6, center + 10);
        cx.closePath();
        cx.fill();
        cx.stroke();

        // Top fin (smaller)
        cx.beginPath();
        cx.moveTo(center - 2, center + 5);
        cx.lineTo(center - 3, center - 2);
        cx.lineTo(center + 3, center - 2);
        cx.lineTo(center + 2, center + 5);
        cx.closePath();
        cx.fill();
        cx.stroke();

        // Engine exhaust (glowing)
        cx.shadowBlur = 15;
        cx.shadowColor = '#ff6600';
        const exhaustGrad = cx.createRadialGradient(center, center + 12, 0, center, center + 12, 8);
        exhaustGrad.addColorStop(0, '#ffff00');
        exhaustGrad.addColorStop(0.5, '#ff6600');
        exhaustGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
        cx.fillStyle = exhaustGrad;
        cx.beginPath();
        cx.arc(center, center + 12, 8, 0, Math.PI * 2);
        cx.fill();

        // Engine nozzle
        cx.shadowBlur = 0;
        cx.fillStyle = '#333';
        cx.fillRect(center - 4, center + 10, 8, 3);

        // Rivets on body
        cx.fillStyle = '#996600';
        cx.beginPath();
        cx.arc(center - 4, center - 6, 1, 0, Math.PI * 2);
        cx.arc(center + 4, center - 6, 1, 0, Math.PI * 2);
        cx.arc(center - 4, center + 6, 1, 0, Math.PI * 2);
        cx.arc(center + 4, center + 6, 1, 0, Math.PI * 2);
        cx.fill();
    } else if (type === 'snake') {
        cx.shadowBlur = glow; cx.shadowColor = color;

        // Main alien head body with organic gradient (GREEN)
        const headGrad = cx.createRadialGradient(center - 3, center - 3, 2, center, center, 15);
        headGrad.addColorStop(0, '#6bff6b');
        headGrad.addColorStop(0.6, '#20ff20');
        headGrad.addColorStop(1, '#008b00');
        cx.fillStyle = headGrad;
        cx.beginPath();
        cx.arc(center, center, 15, 0, Math.PI * 2);
        cx.fill();

        // Alien tentacle protrusions (3 on each side) (GREEN)
        cx.fillStyle = '#30ff30';
        for (let i = 0; i < 3; i++) {
            const angle = -Math.PI / 2 + (i - 1) * 0.4;
            const len = 8 - Math.abs(i - 1) * 2;
            // Left side
            cx.beginPath();
            cx.moveTo(center - 12, center);
            cx.quadraticCurveTo(
                center - 12 - len, center + Math.sin(angle) * len,
                center - 12 - len * 1.2, center + Math.sin(angle) * len * 1.5
            );
            cx.lineTo(center - 12 - len * 0.8, center + Math.sin(angle) * len * 1.2);
            cx.closePath();
            cx.fill();
            // Right side
            cx.beginPath();
            cx.moveTo(center + 12, center);
            cx.quadraticCurveTo(
                center + 12 + len, center + Math.sin(angle) * len,
                center + 12 + len * 1.2, center + Math.sin(angle) * len * 1.5
            );
            cx.lineTo(center + 12 + len * 0.8, center + Math.sin(angle) * len * 1.2);
            cx.closePath();
            cx.fill();
        }

        // Single cyclops eye at the front (bottom) (GREEN GLOW)
        cx.shadowBlur = 10;
        cx.shadowColor = '#00ff00';

        // Eye white/outer
        cx.fillStyle = '#00ff00';
        cx.beginPath();
        cx.arc(center, center + 6, 6, 0, Math.PI * 2);
        cx.fill();

        // Eye pupil (dark slit)
        cx.shadowBlur = 0;
        cx.fillStyle = '#000';
        cx.beginPath();
        cx.ellipse(center, center + 6, 2, 4, 0, 0, Math.PI * 2);
        cx.fill();

        // Eye highlight
        cx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        cx.beginPath();
        cx.arc(center - 1.5, center + 4.5, 1.5, 0, Math.PI * 2);
        cx.fill();
    } else if (type === 'sniper') {
        cx.shadowBlur = glow; cx.shadowColor = color;

        // Main robot body (rectangular core) (CHROME/SILVER)
        const bodyGrad = cx.createLinearGradient(center - 12, center - 12, center + 12, center + 12);
        bodyGrad.addColorStop(0, '#e8e8e8');
        bodyGrad.addColorStop(0.5, '#c0c0c0');
        bodyGrad.addColorStop(1, '#888888');
        cx.fillStyle = bodyGrad;
        cx.fillRect(center - 12, center - 12, 24, 24);

        // Body panel lines (mechanical segmentation)
        cx.strokeStyle = '#444444';
        cx.lineWidth = 1.5;
        cx.beginPath();
        cx.moveTo(center - 12, center - 4);
        cx.lineTo(center + 12, center - 4);
        cx.moveTo(center - 12, center + 4);
        cx.lineTo(center + 12, center + 4);
        cx.moveTo(center - 4, center - 12);
        cx.lineTo(center - 4, center + 12);
        cx.moveTo(center + 4, center - 12);
        cx.lineTo(center + 4, center + 12);
        cx.stroke();

        // Robotic claws (left side) (CHROME)
        cx.fillStyle = '#d0d0d0';
        cx.strokeStyle = '#666666';
        cx.lineWidth = 2;
        // Left claw upper
        cx.beginPath();
        cx.moveTo(center - 12, center - 8);
        cx.lineTo(center - 20, center - 12);
        cx.lineTo(center - 24, center - 10);
        cx.lineTo(center - 22, center - 6);
        cx.closePath();
        cx.fill();
        cx.stroke();
        // Left claw lower
        cx.beginPath();
        cx.moveTo(center - 12, center + 8);
        cx.lineTo(center - 20, center + 12);
        cx.lineTo(center - 24, center + 10);
        cx.lineTo(center - 22, center + 6);
        cx.closePath();
        cx.fill();
        cx.stroke();

        // Robotic claws (right side)
        // Right claw upper
        cx.beginPath();
        cx.moveTo(center + 12, center - 8);
        cx.lineTo(center + 20, center - 12);
        cx.lineTo(center + 24, center - 10);
        cx.lineTo(center + 22, center - 6);
        cx.closePath();
        cx.fill();
        cx.stroke();
        // Right claw lower
        cx.beginPath();
        cx.moveTo(center + 12, center + 8);
        cx.lineTo(center + 20, center + 12);
        cx.lineTo(center + 24, center + 10);
        cx.lineTo(center + 22, center + 6);
        cx.closePath();
        cx.fill();
        cx.stroke();

        // Claw joints (rivets)
        cx.fillStyle = '#222222';
        cx.beginPath();
        cx.arc(center - 12, center - 8, 2, 0, Math.PI * 2);
        cx.arc(center - 12, center + 8, 2, 0, Math.PI * 2);
        cx.arc(center + 12, center - 8, 2, 0, Math.PI * 2);
        cx.arc(center + 12, center + 8, 2, 0, Math.PI * 2);
        cx.fill();

        // Glowing visor eye (central scanner) (RED for contrast)
        cx.shadowBlur = 12;
        cx.shadowColor = '#ff0000';
        const eyeGrad = cx.createLinearGradient(center - 8, center - 2, center + 8, center + 2);
        eyeGrad.addColorStop(0, '#ff0000');
        eyeGrad.addColorStop(0.5, '#ffff00');
        eyeGrad.addColorStop(1, '#ff0000');
        cx.fillStyle = eyeGrad;
        cx.fillRect(center - 8, center - 2, 16, 4);

        // Eye highlight
        cx.shadowBlur = 0;
        cx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        cx.fillRect(center - 6, center - 1, 4, 1);

        // Corner armor plating (CHROME)
        cx.fillStyle = '#a0a0a0';
        cx.beginPath();
        cx.moveTo(center - 12, center - 12);
        cx.lineTo(center - 8, center - 12);
        cx.lineTo(center - 12, center - 8);
        cx.closePath();
        cx.fill();
        cx.beginPath();
        cx.moveTo(center + 12, center - 12);
        cx.lineTo(center + 8, center - 12);
        cx.lineTo(center + 12, center - 8);
        cx.closePath();
        cx.fill();
        cx.beginPath();
        cx.moveTo(center - 12, center + 12);
        cx.lineTo(center - 8, center + 12);
        cx.lineTo(center - 12, center + 8);
        cx.closePath();
        cx.fill();
        cx.beginPath();
        cx.moveTo(center + 12, center + 12);
        cx.lineTo(center + 8, center + 12);
        cx.lineTo(center + 12, center + 8);
        cx.closePath();
        cx.fill();
    }
    return c;
}

function prerenderAssets() {
    // Varied enemy bullets
    // Make hazards solid red/orange instead of white cores for better readability
    sprites.enemyBulletBasic = renderGlowSprite('#ff1f1f', 4, 10, 'circle', '#ff4a4a');   // Chaser: Small, sharp, avoid
    sprites.enemyBulletOrb = renderGlowSprite('#ff9c2a', 9, 18, 'circle', '#ffb347');    // Spinner: Large, orange, destructible
    sprites.enemyBulletFast = renderGlowSprite('#ff3b3b', 3, 12, 'beam', '#ff3b3b'); // Dasher: Fast, red beam-like
    sprites.enemyBulletSniper = renderGlowSprite('#ff6b6b', 6, 22, 'blade', '#ff6b6b'); // Sniper: Sharp, red-tinted contrast
    sprites.enemyBulletWobble = renderGlowSprite('#ff2f2f', 5, 12, 'circle', '#ff4a4a'); // Snake: Red wobbling hazard
    sprites.enemyBulletTorpedo = renderGlowSprite('#ff4400', 4, 15, 'dasher', '#ff6600'); // Re-using dasher shape but smaller/orange for torpedo

    sprites.playerNormal = renderGlowSprite('#0ff', 4, 8);
    sprites.playerBeam = renderGlowSprite('#0ff', 3, 15, 'beam');
    sprites.playerHoming = renderGlowSprite('#d0f', 4, 8);
    sprites.playerWave = renderGlowSprite('#50f', 5, 12);
    sprites.playerBlade = renderGlowSprite('#0ff', 15, 10, 'blade');
    sprites.playerMissile = renderGlowSprite('#ff9c2a', 6, 20, 'circle', '#ffcc00'); // Missile: Orange/yellow with glow
    sprites.enemyChaser = renderGlowSprite('#f00', 20, 10, 'chaser');
    sprites.enemySpinnerCore = renderGlowSprite('#f0f', 30, 10, 'spinnerCore');
    sprites.enemySpinnerRing = renderGlowSprite('#f0f', 30, 10, 'spinnerRing');
    sprites.enemySpinner = sprites.enemySpinnerCore; // Backward compatibility
    sprites.enemyDasher = renderGlowSprite('#ff0', 20, 10, 'dasher');
    sprites.enemySnake = renderGlowSprite('#0f0', 15, 10, 'snake');
    sprites.enemySniper = renderGlowSprite('#f44', 20, 10, 'sniper');
}

prerenderAssets();
