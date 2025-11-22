/**
 * POOL INITIALIZATION
 */

const bulletPool = new Pool(() => new Bullet(), 500);
const enemyPool = new Pool(() => new Enemy(), 50);
const particlePool = new Pool(() => new Particle(), 200);
const powerupPool = new Pool(() => new PowerUp(), 20);
const textPool = new Pool(() => new FloatingText(), 20);

const cosmicBg = new CosmicBackground();
