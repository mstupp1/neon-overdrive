// Physical barrel tips serve both the firing origin and the matching muzzle flash.
export function cannonMount(mounts, streamOffset, streamIndex = 0) {
  if (!mounts?.length) return null;
  if (streamOffset === 0) return mounts[streamIndex % mounts.length];
  return mounts[streamOffset < 0 ? 0 : mounts.length - 1];
}

export function posedShipPoint(point, bank, pitch, aim = null, chase = false) {
  let [x, y] = point;
  if (aim !== null) {
    const a = aim + Math.PI / 2;
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  }
  x *= 1 - Math.abs(bank) * 0.28;
  y *= 1 + pitch * 0.06;
  if (!chase) return [x, y];
  const a = bank * 0.42;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

export function worldShipMount(point, player, mode, freeFlight, camera, chaseFrame = null) {
  const chase = !freeFlight && mode === 'chase';
  const [x, y] = posedShipPoint(point, player.bank, player.pitch, freeFlight ? player.aim : null, chase);
  if (chase) {
    const z = chaseFrame?.z ?? 1;
    const ox = chaseFrame?.x ?? 0;
    const oy = chaseFrame?.y ?? 0;
    const screenX = player.x * z + ox;
    const screenY = player.y * z + oy;
    const q = camera.toScreen(screenX, screenY);
    // stageview renders player cutouts after the world camera transform. Their local scale includes
    // that zoom plus the near/far fog scale, so invert those same transforms for the firing origin.
    const fog = Math.max(0, Math.min(1, (screenY + 20) / 260));
    const cutoutScale = z * (0.4 + 0.6 * fog);
    const virtual = camera.toVirtual(q.x + x * q.s * cutoutScale, q.y + y * q.s * cutoutScale);
    return { x: (virtual.x - ox) / z, y: (virtual.y - oy) / z };
  }
  return { x: player.x + x, y: player.y + y };
}
