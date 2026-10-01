// Boot, layout, main loop and top-level game flow.

import { G, view } from './game/state.js';
import { profile, saveProfile, resetProfile } from './core/storage.js';
import { input, bindPointer, pollGamepads } from './core/input.js';
import { unlockAudio, music, setSfxVolume, setSfxMuted, sfx } from './core/audio.js';
import { buildSprites } from './render/sprites.js';
import { bg } from './render/background.js';
import { drawHud, updateBanner } from './render/hud.js';
import { SHIPS, shipById, ownsShip, isUnlocked } from './game/ships.js';
import { createPlayer } from './game/player.js';
import { createDirector, startSector, nextSector, endlessSpec } from './game/director.js';
import { rollDraft, applyUpgrade } from './game/upgrades.js';
import { step, renderWorld } from './game/world.js';
import { ui } from './ui/screens.js';
import { meta } from './ui/meta.js';
import { hangarActs, openHangar } from './ui/hangar.js';
import { pilotActs, openPilot } from './ui/pilot.js';
import { setClass, setPassives } from './game/pilot.js';
import { buyShip, buyPart, equipPart, unequipSlot, setPaint, selectShip, applyAllPaints } from './game/hangar.js';
import { SYSTEMS, systemById, generateRoute, nodeSpec, reachableNodes, routeNode, systemUnlocked } from './game/campaign.js';
import { rand, pick } from './core/math.js';
import { rollMarket, buyOffer, dockRepair, dockReinforce, settleRun, rankFor } from './game/economy.js';

const app = document.getElementById('app');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const pauseBtn = document.getElementById('pause-btn');
const touchUi = document.getElementById('touch-ui');
const dangerEl = document.getElementById('danger');
const probe = document.getElementById('safe-probe');

let dprCap = 2;
// The ship flown by Endless / campaign launches: the hangar's selection (profile.lastShip), if still owned.
const curShip = () => {
  const s = shipById(profile.lastShip);
  return ownsShip(profile, s) ? s : SHIPS[0];
};
let settingsReturn = 'title';
let draftKind = null;
let draftChoices = null;
let selSystem = 0;
let marketOffers = null; // current Black Market stock
let afterDraft = null; // 'route' | 'extract': where to go once the sector reward / level drafts are done

// --- Layout -------------------------------------------------------------------------

function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = vw;
  let h = vh;
  const maxAspect = 0.66; // width / height
  if (w / h > maxAspect) w = Math.round(h * maxAspect);
  app.style.width = w + 'px';
  app.style.height = h + 'px';
  view.scale = w / view.W;
  view.H = h / view.scale;
  view.dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  canvas.width = Math.round(w * view.dpr);
  canvas.height = Math.round(h * view.dpr);
  app.style.setProperty('--u', view.scale.toFixed(4));
  view.rect = app.getBoundingClientRect();
  const cs = getComputedStyle(probe);
  view.safeTop = (parseFloat(cs.paddingTop) || 0) / view.scale;
  view.safeBottom = (parseFloat(cs.paddingBottom) || 0) / view.scale;
}

window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 200));

// --- World lifecycle -----------------------------------------------------------------

function newWorld(mode, shipDef, run = null) {
  G.mode = mode;
  G.run = run;
  if (run) Object.assign(run, { wallet: 0, earned: 0, frac: 0, curse: null });
  G.time = 0;
  G.runTime = 0;
  G.enemies.length = 0;
  G.pBullets.length = 0;
  G.eBullets.length = 0;
  G.pickups.length = 0;
  G.particles.length = 0;
  G.texts.length = 0;
  G.beams.length = 0;
  G.bolts.length = 0;
  G.boss = null;
  G.score = 0;
  G.displayScore = 0;
  G.combo = 0;
  G.comboTimer = 0;
  G.maxCombo = 0;
  G.kills = 0;
  G.grazes = 0;
  G.bossKills = 0;
  G.rerolls = 1;
  G.pendingLevels = 0;
  G.deathT = 0;
  G.slowmo = 0;
  G.hitstop = 0;
  G.banner = null;
  G.pulse = 0;
  G.enemyTimeScale = 1;
  G.vacuum = false;
  G.director = createDirector();
  G.director.onClear = onSectorClear;
  G.player = createPlayer(shipDef, mode !== 'attract'); // hangar parts only in real runs
  startSector(endlessSpec(1));
  if (run && run.mode === 'campaign') {
    G.banner = null;
    G.director.state = 'await'; // idle until a route node is picked
  }
  setSfxMuted(mode === 'attract');
}

function startAttract() {
  newWorld('attract', pick(SHIPS.filter((s) => ownsShip(profile, s))));
  // Give the demo ship some toys so the menus look alive.
  const p = G.player;
  for (const id of ['main', 'main', 'main', pick(['missiles', 'orbitals', 'drones', 'arc'])]) applyUpgrade(p, id, G);
}

function startRun(s) {
  profile.lastShip = s.id;
  saveProfile();
  newWorld('run', s, { mode: 'endless' });
  enterPlay();
}

// --- Campaign flow ---------------------------------------------------------------------

function launchSystem(sys) {
  const ship = curShip();
  profile.lastShip = ship.id;
  saveProfile();
  const route = generateRoute(sys, Math.floor(Math.random() * 2147483647));
  newWorld('run', ship, { mode: 'campaign', system: sys, route, row: -1, nodeId: null, sectors: 0, victory: false, visited: [] });
  showRoute();
}

function showCampaign() {
  if (G.mode !== 'attract') startAttract();
  G.screen = 'campaign';
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  music.setSet('normal');
  music.setDuck(1);
  if (!systemUnlocked(SYSTEMS[selSystem], profile)) selSystem = 0;
  const focus = meta.renderCampaign(selSystem, curShip().name);
  ui.show('campaign', { focus });
}

function showRoute() {
  G.screen = 'route';
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  music.setDuck(0.6);
  const focus = meta.renderRoute(G);
  ui.show('route', { focus, lock: 250 });
}

// Picks a route node: fighting nodes start a sector, the rest go through visitNode.
function pickRouteNode(node) {
  const r = G.run;
  r.nodeId = node.id;
  r.row = node.row;
  r.visited.push(node.id);
  if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
    const spec = nodeSpec(r.system, node, r.sectors + 1);
    if (r.curse) spec.modifiers.push(r.curse); // Contraband drawback
    r.curse = null;
    startSector(spec);
    r.sectors++;
    enterPlay();
  } else visitNode(node);
}

// Non-fighting stops. Market and dock live here; anomaly is a PLACEHOLDER (step 7 events replace it).
// Every stop must end by calling nodeContinue().
function visitNode(node) {
  switch (node.type) {
    case 'market':
      marketOffers = rollMarket(G.player, G.run.system);
      G.screen = 'market';
      meta.renderMarket(G, marketOffers, true);
      ui.show('market', { lock: 250 });
      break;
    case 'dock':
      G.screen = 'dock';
      meta.renderDock(G.player);
      ui.show('dock', { lock: 250 });
      break;
    default:
      meta.renderNode(node);
      G.screen = 'node';
      ui.show('node', { lock: 250 });
  }
}

function buy(btn) {
  const o = marketOffers[+btn.dataset.i];
  if (!o || buyOffer(o)) return;
  sfx.coin();
  sfx.levelUp();
  const cards = () => [...document.querySelectorAll('#market-cards .card')];
  meta.renderMarket(G, marketOffers, false);
  const next = cards().find((c, i) => i >= +btn.dataset.i && !c.disabled) || cards().find((c) => !c.disabled) || document.getElementById('market-leave');
  ui.show('market', { focus: next });
}

function dockChoose(btn) {
  if (btn.dataset.opt === 'repair') dockRepair();
  else dockReinforce();
  sfx.heal();
  nodeContinue();
}

function nodeContinue() {
  showRoute();
}

function extract() {
  const p = G.player;
  const r = G.run;
  r.victory = true;
  if (!profile.campaign.cleared.includes(r.system.id)) profile.campaign.cleared.push(r.system.id);
  const { unlocked, reward } = bankRun();
  meta.renderExtract({
    system: r.system, score: Math.floor(G.score), time: G.runTime, level: p.level, kills: G.kills, sectors: r.sectors,
    maxCombo: G.maxCombo, grazes: G.grazes, unlocked, reward, player: p,
  });
  const idx = SYSTEMS.indexOf(r.system);
  if (idx < SYSTEMS.length - 1) selSystem = idx + 1;
  G.screen = 'extract';
  ui.show('extract', { lock: 700 });
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  music.setDuck(0.5);
}

// Folds the finished run into the profile records and banks credits / rank XP.
// Returns { unlocked: newly unlocked ships, reward: economy.settleRun summary }.
function bankRun() {
  profile.runs++;
  profile.kills += G.kills;
  profile.best = Math.max(profile.best, Math.floor(G.score));
  if (!G.run || G.run.mode === 'endless') profile.bestSector = Math.max(profile.bestSector, G.sector);
  profile.bestCombo = Math.max(profile.bestCombo, G.maxCombo);
  profile.bossKills += G.bossKills;
  const reward = settleRun(!!(G.run && G.run.victory));
  saveProfile();
  // Legacy unlock conditions still grant ships for free (they join ownedShips).
  const unlocked = SHIPS.filter((s) => s.unlock && isUnlocked(s, profile) && !ownsShip(profile, s));
  for (const s of unlocked) profile.ownedShips.push(s.id);
  saveProfile();
  return { unlocked, reward };
}

function enterPlay() {
  ui.hide();
  G.screen = 'play';
  pauseBtn.hidden = false;
  touchUi.hidden = !input.isTouchDevice;
  input.clear();
  music.setDuck(1);
}

function pause() {
  if (G.screen !== 'play' || G.player.dead) return;
  G.screen = 'pause';
  ui.renderPause(G);
  ui.show('pause', { lock: 150 });
  pauseBtn.hidden = true;
  music.setDuck(0.45);
}

function openDraft(kind) {
  draftKind = kind;
  draftChoices = rollDraft(G.player, kind);
  G.screen = 'draft';
  ui.renderDraft(G.player, draftChoices, kind, G.rerolls, pickUpgrade);
  ui.show('draft', { lock: 420 });
  pauseBtn.hidden = true;
  music.setDuck(0.6);
  if (kind === 'level') sfx.levelUp();
}

function pickUpgrade(id) {
  applyUpgrade(G.player, id, G);
  if (draftKind === 'level') G.pendingLevels = Math.max(0, G.pendingLevels - 1);
  G.player.iframes = Math.max(G.player.iframes, 0.5);
  if (draftKind === 'sector') {
    if (G.run.mode === 'campaign') afterDraft = 'route';
    else nextSector();
  }
  if (G.pendingLevels > 0) return openDraft('level');
  const next = afterDraft;
  afterDraft = null;
  if (next === 'route') return showRoute();
  if (next === 'extract') return extract();
  enterPlay();
}

function onSectorClear() {
  if (G.mode === 'attract') {
    if (G.sector >= 2) startAttract();
    else nextSector();
    return;
  }
  if (G.player.dead) return;
  if (G.screen !== 'play') return;
  if (G.run.mode === 'campaign' && G.director.spec.boss) {
    // Final boss: skip the reward draft, finish any pending level-ups, then extract.
    afterDraft = 'extract';
    if (G.pendingLevels > 0) openDraft('level');
    else {
      afterDraft = null;
      extract();
    }
    return;
  }
  openDraft('sector');
}

function gameOver() {
  const p = G.player;
  const newBest = G.score > profile.best;
  const { unlocked, reward } = bankRun();
  const campaign = G.run.mode === 'campaign';
  ui.renderGameOver({
    score: Math.floor(G.score), newBest: newBest && profile.runs > 1, sector: G.sector, time: G.runTime,
    level: p.level, kills: G.kills, maxCombo: G.maxCombo, grazes: G.grazes, unlocked, reward, player: p,
  });
  meta.renderRewards(document.getElementById('over-rewards'), reward, campaign);
  G.screen = 'gameover';
  ui.show('over', { lock: 700 });
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  music.setDuck(0.5);
}

function toTitle() {
  G.screen = 'title';
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  startAttract();
  ui.renderTitle();
  ui.show('title');
  music.setSet('normal');
  music.setDuck(1);
}

// --- UI handlers ---------------------------------------------------------------------

ui.init({
  play() {
    if (!profile.seenHelp) {
      profile.seenHelp = true;
      saveProfile();
      settingsReturn = 'campaign';
      G.screen = 'help';
      ui.show('help');
      return;
    }
    showCampaign();
  },
  help() {
    settingsReturn = 'title';
    G.screen = 'help';
    ui.show('help');
  },
  settings() {
    settingsReturn = G.screen === 'pause' ? 'pause' : 'title';
    ui.syncSettings();
    G.screen = settingsReturn === 'pause' ? 'pause-settings' : 'settings';
    ui.show('settings');
  },
  back() {
    if (ui.current === 'settings' || ui.current === 'help') {
      if (settingsReturn === 'pause') {
        G.screen = 'pause';
        ui.renderPause(G);
        ui.show('pause', { focus: 1 });
      } else if (settingsReturn === 'campaign') {
        settingsReturn = 'title';
        showCampaign();
      } else {
        G.screen = 'title';
        ui.renderTitle();
        ui.show('title', { focus: ui.current === 'help' ? 1 : 2 });
      }
    } else {
      G.screen = 'title';
      ui.renderTitle();
      ui.show('title');
    }
  },
  sys(btn) {
    selSystem = +btn.dataset.i;
    meta.selectSystem(selSystem);
  },
  launch: () => launchSystem(SYSTEMS[selSystem]),
  endless: () => startRun(curShip()),
  hangar: () => openHangar(),
  leaveHangar: () => showCampaign(),
  ...hangarActs,
  pilot: () => openPilot(),
  leavePilot: () => showCampaign(),
  ...pilotActs,
  campaign: () => showCampaign(),
  node(btn) {
    pickRouteNode(routeNode(G.run.route, btn.dataset.id));
  },
  nodeDone: () => nodeContinue(),
  buy,
  dock: dockChoose,
  abandon: () => showCampaign(),
  resume: () => {
    enterPlay();
  },
  restart: () => (G.run.mode === 'campaign' ? launchSystem(G.run.system) : startRun(curShip())),
  quit: () => (G.run.mode === 'campaign' ? showCampaign() : toTitle()),
  retry: () => (G.run.mode === 'campaign' ? launchSystem(G.run.system) : startRun(curShip())),
  title: () => toTitle(),
  reroll() {
    if (G.rerolls <= 0) return;
    G.rerolls--;
    draftChoices = rollDraft(G.player, draftKind);
    ui.renderDraft(G.player, draftChoices, draftKind, G.rerolls, pickUpgrade);
    ui.show('draft', { lock: 200 });
  },
  fullscreen() {
    const d = document;
    if (d.fullscreenElement) d.exitFullscreen?.();
    else d.documentElement.requestFullscreen?.().catch(() => {});
  },
  reset(btn) {
    const label = document.getElementById('reset-label');
    if (btn.dataset.armed) {
      resetProfile();
      label.textContent = 'Progress reset';
      delete btn.dataset.armed;
    } else {
      btn.dataset.armed = '1';
      label.textContent = 'Press again to confirm';
      setTimeout(() => {
        delete btn.dataset.armed;
        label.textContent = 'Reset progress';
      }, 3000);
    }
  },
  setMusic(v) {
    profile.settings.music = v;
  },
  setSfx(v) {
    setSfxVolume(v);
  },
});

pauseBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  unlockAudio();
  pause();
});
for (const [id, action] of [['touch-od', 'od'], ['touch-dash', 'dash']]) {
  document.getElementById(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.setDevice('touch');
    input.press(action);
  });
}

input.onAnyGesture = unlockAudio;
input.getAnchor = () => (G.player ? { x: G.player.x, y: G.player.y } : { x: view.W / 2, y: view.H * 0.8 });
input.onDeviceChange = (d) => {
  if (G.screen === 'play') touchUi.hidden = d !== 'touch';
  app.style.cursor = G.screen === 'play' && d === 'mouse' ? 'crosshair' : '';
};
document.addEventListener('pointerdown', unlockAudio, { capture: true });
bindPointer(canvas);

music.onTrack = (name) => {
  if (G.mode === 'run' || G.screen === 'title') ui.toast(name);
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    music.suspend(true);
  } else {
    music.suspend(false);
    last = performance.now();
  }
});

// --- Main loop ------------------------------------------------------------------------

let last = performance.now();
let frameAvg = 16;
let slowFrames = 0;

function simulating() {
  const s = G.screen;
  return s === 'play' || s === 'gameover' || s === 'title' || s === 'campaign' || s === 'hangar' || s === 'parts' || s === 'pilot' || s === 'settings' || s === 'help';
}

function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;
  G.realTime += raw;
  pollGamepads();

  // Adaptive quality: sustained slow frames lower resolution and particle budget.
  frameAvg += (raw * 1000 - frameAvg) * 0.05;
  if (frameAvg > 24 && simulating()) {
    if (++slowFrames > 120 && (view.quality > 0.5 || dprCap > 1)) {
      slowFrames = 0;
      view.quality = Math.max(0.5, view.quality - 0.25);
      dprCap = Math.max(1, dprCap - 0.5);
      layout();
    }
  } else slowFrames = 0;

  if (G.screen === 'play') {
    if (input.consume('pause')) pause();
  } else {
    ui.update();
    input.consume('pause') && G.screen === 'pause' && enterPlay();
  }

  if (simulating()) {
    let dt = raw;
    if (G.hitstop > 0) {
      G.hitstop -= raw;
      dt = 0;
    }
    if (G.slowmo > 0) {
      G.slowmo -= raw;
      dt *= 0.3;
    }
    while (dt > 0) {
      const s = Math.min(dt, 1 / 60);
      step(s);
      dt -= s;
    }
    afterStep(raw);
  }

  // Real-time effects
  G.shake = Math.max(0, G.shake - raw * 1.8);
  G.flash = Math.max(0, G.flash - raw * 2.5);
  updateBanner(raw);
  const boost = G.player && (G.player.odT > 0 || G.player.dashT > 0) ? 3 : G.director && G.director.state === 'clear' ? 4 : 1;
  bg.update(simulating() ? raw : raw * 0.25, boost);
  music.update(raw);
  render();
}

function afterStep(raw) {
  const p = G.player;
  if (G.mode === 'attract') {
    // The demo pilot is immortal; keep it tidy and auto-pick upgrades.
    while (G.pendingLevels > 0) {
      G.pendingLevels--;
      applyUpgrade(p, pick(rollDraft(p, 'level')), G);
    }
    return;
  }
  if (G.screen === 'play') {
    if (G.pendingLevels > 0 && !p.dead && G.director.state !== 'clear') openDraft('level');
    if (p.dead) {
      G.deathT -= raw;
      if (G.deathT <= 0) gameOver();
    }
  }
  dangerEl.classList.toggle('on', G.screen === 'play' && !p.dead && p.hp === 1 && p.maxHp > 1);
}

function render() {
  const k = view.scale * view.dpr;
  const sh = G.shake * G.shake;
  view.ox = sh > 0.001 ? rand(-1, 1) * sh * 12 * k : 0;
  view.oy = sh > 0.001 ? rand(-1, 1) * sh * 12 * k : 0;
  ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
  renderWorld(ctx, k);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (G.mode === 'run' && (G.screen === 'play' || G.screen === 'pause' || G.screen === 'draft' || G.screen === 'pause-settings')) drawHud(ctx);
  if (G.flash > 0.01) {
    ctx.fillStyle = `rgba(${G.flashColor},${Math.min(0.8, G.flash)})`;
    ctx.fillRect(0, 0, view.W, view.H);
  }
  if (G.screen === 'pause' || G.screen === 'draft' || G.screen === 'pause-settings') {
    ctx.fillStyle = 'rgba(5,3,13,0.35)';
    ctx.fillRect(0, 0, view.W, view.H);
  }
}

// --- Boot -----------------------------------------------------------------------------

function boot() {
  layout();
  buildSprites(SHIPS);
  applyAllPaints();
  bg.init();
  setSfxVolume(profile.settings.sfx);
  toTitle();
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
  // Re-measure once web fonts land (HUD metrics / safe areas).
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
}

// Debug / agent hook (see agents.md). `simulate` fast-forwards the game
// headlessly, auto-picking drafts, for balance testing.
window.NEON = {
  G, view, profile, input, toTitle,
  startRun: (id) => startRun(shipById(id || 'vector')),
  startEndless: (id) => startRun(shipById(id || 'vector')),
  // Start a run on an arbitrary sector spec (see endlessSpec in director.js).
  startSpec(spec, id) {
    startRun(shipById(id || 'vector'));
    startSector({ ...endlessSpec(1), ...spec });
  },
  applyUpgrade: (id) => applyUpgrade(G.player, id, G),
  rollDraft: (kind = 'level') => rollDraft(G.player, kind),
  // Start a campaign run (1-based index or system id); lands on the route screen.
  launch(sys = 1) {
    launchSystem(typeof sys === 'number' ? SYSTEMS[sys - 1] : systemById(sys));
  },
  // Pick the i-th currently reachable route node.
  pickNode(i = 0) {
    if (G.screen !== 'route') return false;
    const node = reachableNodes(G.run.route, G.run.nodeId)[i];
    if (!node) return false;
    pickRouteNode(node);
    return true;
  },
  // Test helper: grant profile credits / rank XP, and/or run wallet credits.
  grant({ credits = 0, rankXp = 0, wallet = 0 } = {}) {
    profile.credits += credits;
    profile.rankXp += rankXp;
    if (G.run && wallet) {
      G.run.wallet = (G.run.wallet || 0) + wallet;
      G.run.earned = (G.run.earned || 0) + wallet;
    }
    saveProfile();
    return { credits: profile.credits, rankXp: profile.rankXp, rank: rankFor(profile.rankXp), wallet: G.run && G.run.wallet };
  },
  market: () => marketOffers,
  // Hangar (return '' on success, else a reason). Costs credits; use grant() first in tests.
  buyShip, buyPart, selectShip,
  equip: (shipId, partId) => (partId ? equipPart(shipId, partId) : 'NO PART'),
  unequip: unequipSlot,
  paint: setPaint,
  // Pilot (return '' on success, else a reason). Classes / passives are rank-gated: grant({rankXp}) first.
  setClass,
  setPassives,
  campaign: { SYSTEMS, generateRoute, nodeSpec, reachableNodes },
  // opts.nodePick(nodes) → index overrides the default (random fighting node).
  simulate(seconds, pickFn = (choices) => pick(choices), opts = {}) {
    const dt = 1 / 60;
    const nodePick = opts.nodePick || ((nodes) => {
      const fights = nodes.map((n, i) => i).filter((i) => ['combat', 'elite', 'boss'].includes(nodes[i].type));
      return pick(fights.length ? fights : nodes.map((n, i) => i));
    });
    for (let t = 0; t < seconds; t += dt) {
      if (G.screen === 'draft') pickUpgrade(pickFn(draftChoices));
      for (let guard = 0; guard < 6 && (G.screen === 'route' || G.screen === 'node' || G.screen === 'market' || G.screen === 'dock'); guard++) {
        if (G.screen === 'node') nodeContinue();
        else if (G.screen === 'market') {
          // Default: buy the cheapest affordable upgrade offer. opts.marketPick(offers, wallet) → index | -1.
          const w = G.run.wallet;
          let i = -1;
          if (opts.marketPick) i = opts.marketPick(marketOffers, w);
          else {
            const ok = marketOffers.map((o, k) => k).filter((k) => marketOffers[k].kind === 'upgrade' && marketOffers[k].price <= w);
            if (ok.length) i = ok.reduce((a, b) => (marketOffers[b].price < marketOffers[a].price ? b : a));
          }
          if (i >= 0) buyOffer(marketOffers[i]);
          nodeContinue();
        } else if (G.screen === 'dock') {
          const p = G.player;
          if (p.hp < p.maxHp) dockRepair();
          else dockReinforce();
          nodeContinue();
        } else {
          const nodes = reachableNodes(G.run.route, G.run.nodeId);
          pickRouteNode(nodes[nodePick(nodes)]);
        }
      }
      if (G.screen === 'gameover' || G.screen === 'extract') break;
      if (G.hitstop > 0) G.hitstop = 0;
      step(dt);
      afterStep(dt);
    }
    return {
      screen: G.screen, sector: G.sector, hp: G.player.hp, level: G.player.level, score: Math.floor(G.score), time: Math.round(G.runTime),
      run: G.run && { system: G.run.system && G.run.system.id, row: G.run.row, wallet: G.run.wallet, earned: G.run.earned }, victory: !!(G.run && G.run.victory),
    };
  },
};

boot();
