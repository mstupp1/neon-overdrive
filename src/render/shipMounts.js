// Physical barrel tips serve both the firing origin and the matching muzzle flash.
export function cannonMount(mounts, streamOffset, streamIndex = 0) {
  if (!mounts?.length) return null;
  if (streamOffset === 0) return mounts[streamIndex % mounts.length];
  return mounts[streamOffset < 0 ? 0 : mounts.length - 1];
}

// How a flat hull poses for movement, in ship space (x across the nose, -y out of it). bank and pitch run -1..1.
// top:   a roll about the long axis. Wings foreshorten by cos(roll) and the rising wing (the one the ship banks away
//        from) grows toward the overhead camera while the dipping wing shrinks, so the hull reads as a solid rolling
//        rather than a card being squeezed. Free flight uses the same roll before turning to the heading.
// side:  the profile pitches its nose into climbs and dives; a side-on hull has no visible roll.
// chase: seen from behind, banking is a turn of the whole hull about the view axis (stageview tilts the cutout).
export const ROLL = 0.6; // radians at full bank
export const ROLL_PERSPECTIVE = 0.009; // height change per unit across the hull, per unit sin(roll)
export const SIDE_TILT = 0.24; // radians of nose pitch at full climb/dive speed
export const CHASE_TILT = 0.42; // radians of roll seen from behind
const viewMode = (mode) => (mode === true ? 'chase' : mode === false || !mode ? 'top' : mode);

// The pose without the chase roll, which stageview applies to the whole cutout.
export function shipPoseLocal(point, bank, pitch, mode = 'top') {
  let [x, y] = point;
  mode = viewMode(mode);
  if (mode === 'side') {
    y *= 1 + pitch * 0.04;
    const a = bank * SIDE_TILT, c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  }
  if (mode === 'chase') return [x * (1 - Math.abs(bank) * 0.1), y * (1 + pitch * 0.06)];
  const r = bank * ROLL;
  return [x * Math.cos(r), y * (1 - x * Math.sin(r) * ROLL_PERSPECTIVE) * (1 + pitch * 0.06)];
}

export function posedShipPoint(point, bank, pitch, aim = null, mode = 'top') {
  mode = viewMode(mode);
  let [x, y] = shipPoseLocal(point, bank, pitch, aim !== null ? 'top' : mode);
  if (aim !== null) {
    const a = aim + Math.PI / 2;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  }
  if (mode !== 'chase') return [x, y];
  const a = bank * CHASE_TILT;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

export function worldShipMount(point, player, mode, freeFlight, camera, chaseFrame = null) {
  const chase = !freeFlight && mode === 'chase';
  const [x, y] = posedShipPoint(point, player.bank, player.pitch, freeFlight ? player.aim : null, freeFlight ? 'top' : mode);
  if (chase) {
    const z = chaseFrame?.z ?? 1;
    const ox = chaseFrame?.x ?? 0;
    const oy = chaseFrame?.y ?? 0;
    const screenX = player.x * z + ox;
    const screenY = player.y * z + oy;
    const q = camera.toScreen(screenX, screenY);
    // stageview renders player cutouts after the world camera transform. Their local scale includes
    // that zoom plus the grow-in scale out of the haze, so invert those same transforms for the firing origin.
    const cutoutScale = z * (camera.cutoutGrow ? camera.cutoutGrow(screenY) : 1);
    const virtual = camera.toVirtual(q.x + x * q.s * cutoutScale, q.y + y * q.s * cutoutScale);
    return { x: (virtual.x - ox) / z, y: (virtual.y - oy) / z };
  }
  return { x: player.x + x, y: player.y + y };
}
