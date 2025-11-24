
const intro = {
    active: false,
    phase: 0,
    timer: 0,
    elements: [],
    
    init() {
        this.active = true;
        this.phase = 0;
        this.timer = 0;
        this.elements = [];
        
        // Reset game entities for clean slate
        bullets.length = 0;
        enemies.length = 0;
        particles.length = 0;
        powerups.length = 0;
        texts.length = 0;
        player.tail.length = 0;
        
        // Initial State
        player.x = width / 2;
        player.y = height + 100; // Start off screen
        player.tilt = 0;
        player.vx = 0;
        player.vy = 0;
        
        // Hide UI
        if(uiLayer) uiLayer.classList.add('hidden');
        if(startMenu) startMenu.classList.add('hidden');
    },

    skip() {
        this.active = false;
        gameState = 'MENU';
        startMenu.classList.remove('hidden');
        
        // Reset player for menu demo/background
        player.x = width / 2;
        player.y = height * 0.8;
        
        // Clear any intro entities
        enemies.length = 0;
        bullets.length = 0;
        particles.length = 0;
    },

    update() {
        if (!this.active) return;
        this.timer++;
        
        // Cosmic background always updates
        cosmicBg.update();
        globalHue += 2;
        frameCount++; // Keep global frame count moving for animations
        
        // Update particles for explosions
        particles.forEach(p => p.update());
        for (let i = particles.length - 1; i >= 0; i--) {
            if (!particles[i].active) {
                particlePool.release(particles[i]);
                particles.splice(i, 1);
            }
        }

        // Update Intro Specific Entities (Fake bullets/enemies)
        bullets.forEach(b => b.update());
        enemies.forEach(e => e.update());
        
        // Clean up
        for(let i=bullets.length-1; i>=0; i--) { if(!bullets[i].active) bullets.splice(i,1); }
        for(let i=enemies.length-1; i>=0; i--) { if(!enemies[i].active) enemies.splice(i,1); }

        // Helper for intro spawns
        const spawnIntroEnemy = (x, y, type) => {
            const e = enemyPool.get(type);
            e.x = x; 
            e.y = y;
            enemies.push(e);
        };

        // Phase Logic
        switch(this.phase) {
            case 0: // Title Glitch In
                if (this.timer > 60) {
                    this.phase++;
                    this.timer = 0;
                }
                break;
            
            case 1: // Player Entry
                player.y += (height * 0.75 - player.y) * 0.05;
                // Add trail
                if (this.timer % 2 === 0) player.tail.push({ x: player.x, y: player.y + 15, life: 1 });
                player.tail.forEach(t => t.life -= 0.1);
                player.tail = player.tail.filter(t => t.life > 0);
                
                if (this.timer > 80) {
                    this.phase++;
                    this.timer = 0;
                }
                break;

            case 2: // Enemy Swarm
                // Spawn a massive wave
                if (this.timer % 2 === 0 && this.timer < 80) {
                    const x = rand(20, width - 20);
                    const types = ['chaser', 'spinner', 'dasher', 'snake'];
                    const type = types[Math.floor(Math.random() * types.length)];
                    spawnIntroEnemy(x, -40, type);
                }
                
                // Move enemies down fast
                enemies.forEach(e => {
                    e.y += 5;
                    e.vx = Math.sin(e.y * 0.05) * 2;
                    e.x += e.vx;
                });

                // Player idle hover
                player.y = height * 0.75 + Math.sin(this.timer * 0.05) * 10;
                
                // Update tails
                 if (frameCount % 2 === 0) player.tail.push({ x: player.x, y: player.y + 15, life: 1 });
                player.tail.forEach(t => t.life -= 0.1);
                player.tail = player.tail.filter(t => t.life > 0);

                if (this.timer > 100) {
                    this.phase++;
                    this.timer = 0;
                }
                break;
            
            case 3: // ACTION! (MAX POWER)
                 // Player fires MAX WEAPONS
                 if (this.timer % 5 === 0) {
                     // Main Beams
                     spawnBullet(player.x, player.y, -Math.PI/2, 15, 'player', 'beam');
                     spawnBullet(player.x - 15, player.y, -Math.PI/2 - 0.1, 15, 'player', 'beam');
                     spawnBullet(player.x + 15, player.y, -Math.PI/2 + 0.1, 15, 'player', 'beam');
                     
                     // Waves
                     spawnBullet(player.x, player.y, -Math.PI/2, 12, 'player', 'wave');
                     spawnBullet(player.x, player.y, -Math.PI/2 - 0.2, 12, 'player', 'wave');
                     spawnBullet(player.x, player.y, -Math.PI/2 + 0.2, 12, 'player', 'wave');
                     
                     // Blades
                     if (this.timer % 10 === 0) {
                         spawnBullet(player.x - 30, player.y, -Math.PI/2 - 0.4, 10, 'player', 'blade');
                         spawnBullet(player.x + 30, player.y, -Math.PI/2 + 0.4, 10, 'player', 'blade');
                     }
                 }

                 // Enemies move
                 enemies.forEach(e => {
                     e.y += 2;
                 });

                 // Collision Logic (simplified for intro)
                 bullets.forEach(b => {
                     enemies.forEach(e => {
                         if (e.active && dist(b.x, b.y, e.x, e.y) < 40) {
                             e.active = false; // Kill instantly
                             b.active = false;
                             createExplosionLogic(e.x, e.y, `hsl(${Math.random()*360}, 100%, 50%)`, 20);
                             createExplosionLogic(e.x, e.y, '#fff', 10);
                         }
                     });
                 });

                 // Update tails
                 if (frameCount % 2 === 0) player.tail.push({ x: player.x, y: player.y + 15, life: 1 });
                player.tail.forEach(t => t.life -= 0.1);
                player.tail = player.tail.filter(t => t.life > 0);

                 if (this.timer > 150) {
                     this.phase++;
                     this.timer = 0;
                 }
                 break;
            
            case 4: // Transition to Menu (Clear Screen)
                // Fly everyone off screen
                player.y -= 15; // Player flies up and out
                enemies.forEach(e => e.y += 20); // Enemies drop down fast
                bullets.forEach(b => b.active = false);
                particles.forEach(p => p.active = false);

                if (this.timer > 40) {
                    this.skip();
                }
                break;
        }
    },

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.scale(GAME_SCALE, GAME_SCALE);

        // Draw BG
        cosmicBg.draw(ctx);

        // Draw Entities
        particles.forEach(p => p.draw(ctx));
        bullets.forEach(b => b.draw(ctx));
        enemies.forEach(e => e.draw(ctx));

        // Draw Player
        if (this.phase >= 1) {
            ctx.save();
            ctx.translate(player.x, player.y);
            
            // Engine Trails
            player.tail.forEach(t => {
                ctx.globalAlpha = t.life * 0.6;
                ctx.fillStyle = '#0ff';
                ctx.beginPath();
                ctx.arc(t.x - player.x, t.y - player.y, 6 * t.life, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            // Ship
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(0, -25);
            ctx.lineTo(8, 5);
            ctx.lineTo(16, 15);
            ctx.lineTo(8, 15);
            ctx.lineTo(6, 20);
            ctx.lineTo(-6, 20);
            ctx.lineTo(-8, 15);
            ctx.lineTo(-16, 15);
            ctx.lineTo(-8, 5);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#0ff';
            ctx.fillRect(-5, 20, 3, 5);
            ctx.fillRect(2, 20, 3, 5);
            ctx.restore();
        }
        
        // Skip Hint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("PRESS SPACE TO SKIP", width/2, height - 30);

        ctx.restore();
    }
};
