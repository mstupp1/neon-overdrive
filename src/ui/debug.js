// A desktop inspector over the existing NEON hooks, with an independent gameplay freeze.
import { G } from '../game/state.js';
import { input } from '../core/input.js';
import { profile, saveProfile } from '../core/storage.js';
import { SHIPS } from '../game/ships.js';
import { SYSTEMS } from '../game/campaign.js';
import { UPGRADES } from '../game/upgrades.js';
import { TYPES } from '../game/enemies.js';
import { EVENTS } from '../game/story.js';
import { BASES, LEGENDARIES } from '../game/parts.js';
import { ultCap } from '../game/pilot.js';
import { unlockEverything, restoreDebugProfile, hasDebugBackup } from '../game/debug-profile.js';

let panel;
export const debugDrawer = { frozen: false, get open() { return !!panel?.open; } };

export function initDebugDrawer(api) {
  const tab = document.createElement('button');
  tab.id = 'debug-tab';
  tab.textContent = 'DEV';
  tab.title = 'Debug tools (`)';
  tab.setAttribute('aria-label', 'Open debug tools');
  tab.setAttribute('aria-controls', 'debug-drawer');
  tab.setAttribute('aria-expanded', 'false');
  panel = document.createElement('dialog');
  panel.id = 'debug-drawer';
  panel.setAttribute('aria-labelledby', 'debug-heading');
  panel.innerHTML = `<header><div><small>NEON OVERDRIVE / DEV</small><h2 id="debug-heading">Debug tools</h2></div><button type="button" id="debug-close" aria-label="Close debug tools">×</button></header>
    <p class="debug-hint">Game keeps running. Escape or \` to close.</p>
    <button type="button" id="debug-freeze" aria-pressed="false">Freeze gameplay</button>
    <output id="debug-status" aria-live="polite">Ready.</output><div id="debug-sections"></div>
    <footer>Advanced scripting: window.NEON · Saved changes affect this browser.</footer>`;
  document.body.append(tab, panel);
  const status = panel.querySelector('output');
  const sections = panel.querySelector('#debug-sections');
  const checks = [];
  const freeze = panel.querySelector('#debug-freeze');
  const hint = panel.querySelector('.debug-hint');
  checks.push(() => {
    freeze.disabled = G.mode !== 'run';
    freeze.textContent = debugDrawer.frozen ? 'Resume gameplay' : 'Freeze gameplay';
    freeze.setAttribute('aria-pressed', String(debugDrawer.frozen));
    hint.textContent = debugDrawer.frozen ? 'Gameplay frozen until resumed. Escape or ` closes the drawer.' : 'Game keeps running. Escape or ` to close.';
    tab.textContent = debugDrawer.frozen ? 'DEV / II' : 'DEV';
  });
  const say = (text) => { status.textContent = text; };
  const refresh = () => { for (const check of checks) check(); };
  const setFrozen = (value = true) => {
    debugDrawer.frozen = G.mode === 'run' && !!value;
    input.releaseAll();
    refresh();
  };
  freeze.addEventListener('click', () => setFrozen(!debugDrawer.frozen));
  debugDrawer.reset = () => setFrozen(false);
  const close = () => { panel.close(); tab.setAttribute('aria-expanded', 'false'); input.releaseAll(); };
  const open = () => {
    input.releaseAll();
    refresh();
    panel.showModal();
    tab.setAttribute('aria-expanded', 'true');
    panel.querySelector('#debug-close').focus();
  };
  tab.addEventListener('click', open);
  panel.querySelector('#debug-close').addEventListener('click', close);
  panel.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  panel.addEventListener('click', (e) => { if (e.target === panel && e.clientX < panel.getBoundingClientRect().left) close(); });
  // Native form navigation keeps Tab, arrows and Space; none may reach gameplay bindings.
  window.addEventListener('keydown', (e) => {
    const shortcut = e.code === 'Backquote' && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!panel.open && !shortcut) return;
    e.stopImmediatePropagation();
    // Let the native dialog cancel event handle Escape, so a select popup can consume it first.
    if (shortcut) {
      e.preventDefault();
      if (!e.repeat) panel.open ? close() : open();
    }
  }, true);
  window.addEventListener('keyup', (e) => { if (panel.open) e.stopImmediatePropagation(); }, true);

  function section(title, note) {
    const group = document.createElement('details');
    group.open = title === 'Launch & modes';
    const h = document.createElement('summary');
    h.textContent = title;
    const el = document.createElement('div');
    group.append(h, el);
    if (note) { const p = document.createElement('p'); p.textContent = note; el.append(p); }
    sections.append(group);
    return el;
  }
  function select(parent, label, options) {
    const wrap = document.createElement('label');
    wrap.textContent = label;
    const el = document.createElement('select');
    el.setAttribute('aria-label', label);
    for (const [value, text] of options) el.add(new Option(text, value));
    wrap.append(el);
    parent.append(wrap);
    return el;
  }
  const live = () => G.mode === 'run' && G.player && !G.player.dead && ['play', 'pause', 'draft', 'overworld'].includes(G.screen);
  const fight = () => live() && ['play', 'pause'].includes(G.screen);
  const campaign = () => live() && G.run?.mode === 'campaign';
  function button(parent, text, action, { enabled = () => true, leave = false } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    parent.append(b);
    checks.push(() => { b.disabled = !enabled(); });
    b.addEventListener('click', () => {
      if (!enabled()) return;
      try {
        if (leave) close();
        const result = action();
        say(typeof result === 'string' && result ? result : `${text}: done.`);
      } catch (e) { say(e.message); }
      refresh();
    });
    return b;
  }

  const run = section('Launch & modes', 'Launch buttons replace the current run.');
  const ship = select(run, 'Ship', SHIPS.map((s) => [s.id, s.name]));
  const system = select(run, 'Campaign system', SYSTEMS.map((s) => [s.id, s.name]));
  ship.value = profile.lastShip;
  button(run, 'Launch campaign', () => { api.selectShip(ship.value); api.launch(system.value); }, { leave: true, enabled: () => profile.ownedShips.includes(ship.value) || ship.value === 'vector' });
  ship.addEventListener('change', () => {
    // Update just the gate: refreshing every control would reset the ship selection.
    launchGate();
  });
  const launchGate = checks.at(-1);
  button(run, 'Endless sandbox', () => api.startRun(ship.value), { leave: true });
  const encounter = select(run, 'Encounter', [['combat', 'Combat'], ['elite', 'Elite'], ['boss', 'Boss']]);
  button(run, 'Test encounter', () => {
    const index = SYSTEMS.findIndex((s) => s.id === system.value);
    const route = api.campaign.generateRoute(SYSTEMS[index], Math.floor(Math.random() * 0xffffffff));
    const node = route.nodes.find((n) => n.type === encounter.value);
    if (!node) throw new Error('No matching encounter in this system.');
    api.startSpec(api.campaign.nodeSpec(SYSTEMS[index], node, 1), ship.value);
  }, { leave: true });
  button(run, 'Return to title', () => api.toTitle(), { leave: true });
  button(run, 'Replay intro', () => api.intro(), { leave: true });

  const combat = section('Live run', 'Available controls follow the current run and screen.');
  const autopilot = button(combat, 'Autopilot', () => { G.autopilot = !G.autopilot; return `Autopilot ${G.autopilot ? 'on' : 'off'}.`; }, { enabled: live });
  checks.push(() => { autopilot.textContent = `Autopilot: ${G.autopilot ? 'ON' : 'OFF'}`; autopilot.setAttribute('aria-pressed', String(G.autopilot)); });
  button(combat, 'Repair hull', () => { G.player.hp = G.player.maxHp; }, { enabled: live });
  button(combat, 'Fill ultimate', () => { G.player.od = ultCap(G.player); }, { enabled: live });
  for (const mode of ['top', 'side', 'chase']) button(combat, `${mode.toUpperCase()} camera`, () => api.stage(mode), { enabled: () => fight() && G.screen === 'play', leave: true });
  button(combat, 'Simulate 10 seconds', () => { const r = api.simulate(10); return `Simulation: ${r.screen} · sector ${r.sector} · hull ${r.hp} · ${r.time}s`; }, { enabled: live });
  button(combat, 'Pick next route node', () => api.pickNode(), { enabled: () => campaign() && ['route', 'overworld'].includes(G.screen), leave: true });
  button(combat, 'Extract campaign', () => api.extract(), { enabled: campaign, leave: true });
  button(combat, 'Skip dialogue', () => api.comms.skipAll(), { enabled: () => api.comms.blocking });
  const enemy = select(combat, 'Enemy', Object.keys(TYPES).map((id) => [id, id]));
  button(combat, 'Spawn enemy', () => api.spawn(enemy.value), { enabled: fight });
  const event = select(combat, 'Anomaly', EVENTS.map((e) => [e.id, e.title]));
  button(combat, 'Open anomaly', () => api.event(event.value), { enabled: campaign, leave: true });

  const rewards = section('Upgrades & drops');
  const upgrade = select(rewards, 'Upgrade', UPGRADES.map((u) => [u.id, u.name]));
  button(rewards, 'Apply upgrade', () => {
    const def = UPGRADES.find((u) => u.id === upgrade.value);
    if ((G.player.up[def.id] || 0) >= def.max) return 'Upgrade already at its maximum level.';
    api.applyUpgrade(def.id);
  }, { enabled: fight });
  for (const kind of ['level', 'sector']) button(rewards, `Open ${kind} draft`, () => api.openDraft(kind), { enabled: fight, leave: true });
  button(rewards, 'Drop relic cache', () => api.dropRelic(), { enabled: fight });
  button(rewards, 'Drop gear', () => api.dropGear(2), { enabled: fight });
  button(rewards, 'Drop ability', () => api.dropAbility(), { enabled: fight });
  const gear = select(rewards, 'Gear base', [...BASES, ...LEGENDARIES].map((g) => [g.id, g.name]));
  button(rewards, 'Give selected gear', () => {
    const def = [...BASES, ...LEGENDARIES].find((g) => g.id === gear.value);
    const item = api.giveGear(def.slot, LEGENDARIES.includes(def) ? 4 : 3, 20, def.id);
    return profile.gear.some((g) => g.uid === item.uid) ? 'Gear added. Full slots auto-salvage their weakest unequipped piece.' : 'Full slot: the new item was auto-salvaged for credits.';
  });

  const progression = section('Progression', 'Unlock saves all ships, paints, abilities, upgrade discoveries, relics, achievements and tiers. Grants max rank, tree points, 1M credits and 100K Flux. Gear is available above; build choices stay yours.');
  button(progression, 'Unlock everything', unlockEverything);
  button(progression, 'Restore pre-unlock progression', () => { const message = restoreDebugProfile(); api.toTitle(); return message; }, { enabled: hasDebugBackup, leave: true });
  button(progression, 'Grant 10,000 credits', () => { api.grant({ credits: 10000 }); });
  button(progression, 'Grant 5,000 rank XP', () => { api.grant({ rankXp: 5000 }); });
  button(progression, 'Grant 1,000 Flux', () => { profile.flux += 1000; saveProfile(); });
  button(progression, 'Grant 5,000 run credits', () => { api.grant({ wallet: 5000 }); }, { enabled: live });

  const screens = section('Screen previews', 'Opening a progression screen leaves the current run.');
  for (const [label, action] of [['Hangar', api.openHangar], ['Loadout', api.openLoadout], ['Fabricator', api.openFab], ['Pilot & trees', api.openPilot], ['Relic gallery', api.openGallery], ['Achievements', api.openAchievements], ['Flux Core', api.openCore]]) button(screens, label, action, { leave: true });
  const previews = section('Art & layout tools');
  for (const [name, path] of [['Ships & firing', 'ship-art-preview.html'], ['Campaign', 'campaign-preview.html'], ['Background layers', 'background-preview.html'], ['Icons', 'icon-preview.html'], ['Live icons', 'icon-live-preview.html'], ['Icon layouts', 'icon-ui-preview.html']]) {
    const link = document.createElement('a');
    link.textContent = `${name} ↗`;
    link.href = `tools/${path}`;
    link.target = '_blank';
    link.rel = 'noopener';
    previews.append(link);
  }
  api.debug = { open, close, freeze: setFrozen, unlockEverything, restoreProfile: restoreDebugProfile };
  let lastScreen;
  let lastDead;
  debugDrawer.update = () => {
    if (lastScreen !== G.screen || lastDead !== G.player?.dead) {
      lastScreen = G.screen;
      lastDead = G.player?.dead;
      refresh();
    }
    if (input.consume('back') || input.consume('pause')) return close();
    const controls = [...panel.querySelectorAll('button:not(:disabled), select, summary, a')].filter((el) => el.getClientRects().length);
    const current = document.activeElement;
    const index = controls.indexOf(current);
    const move = input.consume('down') ? 1 : input.consume('up') ? -1 : 0;
    if (move) {
      const el = controls[(index + move + controls.length) % controls.length];
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
    }
    const change = input.consume('right') ? 1 : input.consume('left') ? -1 : 0;
    if (change && current?.tagName === 'SELECT') {
      current.selectedIndex = (current.selectedIndex + change + current.options.length) % current.options.length;
      current.dispatchEvent(new Event('change'));
    }
    if (input.consume('confirm') && current?.tagName !== 'SELECT') current?.click();
    input.releaseAll(); // Drawer gamepad navigation must not also steer the live ship.
  };
}
