// Runs in the preview iframe so checks use the live game's modules and camera.
import { G, field } from '../src/game/state.js';
import { S } from '../src/render/sprites.js';
import { shipSpriteForView } from '../src/render/shipImages.js';
import { posedShipPoint } from '../src/render/shipMounts.js';
import { updatePlayer } from '../src/game/player.js';
import { SHIPS, weaponStreams } from '../src/game/ships.js';
import { sv } from '../src/game/stageview.js';
import { cine } from '../src/game/cinematic.js';

let checking = false;
window.addEventListener('message', async event => {
  if (event.source !== parent || event.data?.kind !== 'check-ship-muzzles') return;
  if (checking) return;
  checking = true;
  const N = window.NEON;
  const requested = SHIPS.find(ship => ship.id === event.data.ship) || G.player.ship;
  const ships = event.data.fleet ? SHIPS : [requested];
  let count = 0, worst = 0;
  try {
    G.screen = 'pause';
    await Promise.all(ships.map(ship => S['ship_' + ship.id].ready));
    for (const ship of ships) {
    N.startRun(ship.id); G.player.god = true;
    for (const mode of ['top', 'side', 'chase']) for (const bank of [-1, 0, 1]) for (let level = 1; level <= 8; level++) {
      sv.enter(mode); sv.push();
      const p = G.player;
      p.bank = bank; p.pitch = 0.5; p.fireT = 0; p.st.mainLv = level;
      G.pBullets.length = 0;
      updatePlayer(p, 0);
      const sprite = shipSpriteForView(S['ship_' + ship.id], mode);
      if (!sprite.generated || !sprite.muzzles?.length) throw Error(`${ship.name}/${mode}: generated cannon anchors unavailable`);
      const streams = weaponStreams(ship.weapon, level);
      if (G.pBullets.length !== streams.length) throw Error(`${ship.name}/${mode}: volley count changed`);
      for (let i = 0; i < streams.length; i++) {
        const offset = streams[i][0];
        const mounts = sprite.muzzles;
        const mount = mounts[offset < 0 ? 0 : offset > 0 ? mounts.length - 1 : i % mounts.length];
        const point = posedShipPoint(mount, p.bank, p.pitch, null, mode);
        const b = G.pBullets[i];
        let error;
        if (mode === 'chase') {
          const frame = cine.camera();
          const origin = sv.toScreen(p.x * frame.z + frame.x, p.y * frame.z + frame.y);
          const actual = sv.toScreen(b.x * frame.z + frame.x, b.y * frame.z + frame.y);
          const scale = frame.z * sv.cutoutGrow(p.y * frame.z + frame.y);
          error = Math.hypot(actual.x - origin.x - point[0] * origin.s * scale,
            actual.y - origin.y - point[1] * origin.s * scale);
        } else error = Math.hypot(b.x - p.x - point[0], b.y - p.y - point[1]);
        worst = Math.max(worst, error); count++;
      }
      sv.pop();
    }
    }
    if (worst > 0.01) throw Error(`Cannon mismatch: ${worst.toFixed(3)} logical pixels`);
    parent.postMessage({ kind: 'ship-muzzle-results', text: `PASS · ${ships.length} ships / ${count} live bullet origins · 3 cameras / 8 weapon levels / 3 bank angles · maximum error ${worst.toFixed(6)} logical pixels` }, parent.location.origin);
  } catch (error) {
    parent.postMessage({ kind: 'ship-muzzle-results', text: `FAIL · ${error.message}` }, parent.location.origin);
  } finally {
    sv.pop(); field.ow = false;
    N.startRun(requested.id); G.player.god = true;
    checking = false;
  }
});
