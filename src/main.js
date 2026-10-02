// Boot, layout, main loop and top-level game flow.

import { G, view } from './game/state.js';
import { profile, saveProfile, resetProfile } from './core/storage.js';
import { input, bindPointer, pollGamepads } from './core/input.js';
import { unlockAudio, music, setSfxVolume, setSfxMuted, sfx } from './core/audio.js';
import { buildSprites, buildEnemySpritesV2 } from './render/sprites.js';
import { bg } from './render/background.js';
import { bloom } from './render/post.js';
import { drawHud, updateBanner } from './render/hud.js';
import { SHIPS, shipById, ownsShip, isUnlocked } from './game/ships.js';
import { createPlayer } from './game/player.js';
import { createDirector, startSector, nextSector, endlessSpec } from './game/director.js';
import { rollDraft, applyUpgrade } from './game/upgrades.js';
import { spawnEnemy, spawnWeavers } from './game/enemies.js';
import { step, renderWorld } from './game/world.js';
import { ui } from './ui/screens.js';
import { comms } from './ui/comms.js';
import { meta } from './ui/meta.js';
import { hangarActs, openHangar } from './ui/hangar.js';
import { pilotActs, openPilot } from './ui/pilot.js';
import { galleryActs, openGallery, openAchievements } from './ui/gallery.js';
import { initToasts, notifyBacklog } from './ui/toasts.js';
import { achInit, achTick } from './game/achievements.js';
import { rollRelicDrop } from './game/collectables.js';
import { setClass, setPassives } from './game/pilot.js';
import { buyShip, buyPart, equipPart, unequipSlot, setPaint, selectShip, applyAllPaints } from './game/hangar.js';
import { SYSTEMS, systemById, generateRoute, nodeSpec, reachableNodes, routeNode } from './game/campaign.js';
import { rand, pick, lerp, easeInOut } from './core/math.js';
import { ring } from './game/fx.js';
import { cine } from './game/cinematic.js';
import { sectorIntro } from './render/sectorIntro.js';
import { STORY, eventFor, eventById, startEvent, resolveChoice, choiceBlocked } from './game/story.js';
import { rollMarket, buyOffer, dockRepair, dockReinforce, settleRun, rankFor } from './game/economy.js';

const app = document.getElementById('app');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const pauseBtn = document.getElementById('pause-btn');
const touchUi = document.getElementById('touch-ui');
const dangerEl = document.getElementById('danger');
const probe = document.getElementById('safe-probe');
const bossCard = document.getElementById('boss-card');
const vignette = document.querySelector('.fx-vignette');
const off = document.createElement('canvas'); // fly-through camera: flat world frame, drawn rolled
const octx = off.getContext('2d', { alpha: false });

let dprCap = 2;
// The ship flown by Endless / campaign launches: the hangar's selection (profile.lastShip), if still owned.
const curShip = () => {
  const s = shipById(profile.lastShip);
  return ownsShip(profile, s) ? s : SHIPS[0];
};
let settingsReturn = 'title';
let draftKind = null;
let draftChoices = null;
let marketOffers = null; // current Black Market stock
let curEvent = null; // open anomaly event session (story.startEvent)
let bossCardT = 0;
let afterDraft = null; // 'route' | 'extract' | 'next': where to go once the sector reward / level drafts are done
// Level-up pacing: the world slows into the draft and eases back out of it instead of hard cuts.
const LEVEL_INTRO = 0.5; // real seconds of slow-down before the level-up draft opens
const RESUME_EASE = 0.45; // real seconds to ramp back to full speed after a draft
let levelIntro = -1; // seconds left in the slow-down (-1 = not running)
let resumeEase = 0;
let introDone = null; // callback once the sector intro animation ends

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

function hideBossCard() {
  clearTimeout(bossCardT);
  bossCard.classList.remove('show');
}

function newWorld(mode, shipDef, run = null) {
  G.mode = mode;
  G.run = run;
  comms.clear();
  hideBossCard();
  cine.clear();
  sectorIntro.stop();
  introDone = null;
  if (run) Object.assign(run, { wallet: 0, earned: 0, frac: 0, curse: null, ambush: false, bonusXp: 0, events: [] });
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
  G.supplyLeft = 0;
  afterDraft = null;
  levelIntro = -1;
  resumeEase = 0;
  G.deathT = 0;
  G.slowmo = 0;
  G.hitstop = 0;
  G.banner = null;
  G.pulse = 0;
  G.enemyTimeScale = 1;
  G.vacuum = false;
  G.director = createDirector();
  G.director.onClear = onSectorClear;
  G.director.onWarn = onBossWarn;
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

// Debug sandbox run (NEON.startRun / startSpec / balance sims): the classic endless sector chain. Not reachable from the menus.
function startRun(s) {
  profile.lastShip = s.id;
  saveProfile();
  newWorld('run', s, { mode: 'endless' });
  enterPlay();
}

// --- Campaign flow ---------------------------------------------------------------------

// A campaign run flies every system in order with one ship and build; dying anywhere ends it (the next run starts at
// system 1 again). `from` (debug) starts at another system index.
function launchRun(from = 0) {
  const ship = curShip();
  profile.lastShip = ship.id;
  saveProfile();
  newWorld('run', ship, { mode: 'campaign', sysIdx: from, system: SYSTEMS[from], route: null, row: -1, nodeId: null, sectors: 0, victory: false, visited: [] });
  enterSystem(from);
}

// Puts the run at row -1 of system `idx` (fresh route), plays the warp-in and its intro, then opens the route (after any supply drop).
function enterSystem(idx) {
  const r = G.run;
  const sys = SYSTEMS[idx];
  Object.assign(r, { sysIdx: idx, system: sys, route: generateRoute(sys, Math.floor(Math.random() * 2147483647)), row: -1, nodeId: null, visited: [] });
  noteProgress();
  playSectorIntro(sys, idx, () => blockingStory('intro:' + sys.id, STORY.systems[sys.id].intro, {}, () => startSupply(sys.supply || 0)));
}

// Entering a star system: the warp-in title animation (render/sectorIntro.js), then `done` (dialogue, supply, route).
function playSectorIntro(sys, idx, done) {
  G.screen = 'sector-intro';
  ui.hide();
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  music.setDuck(0.7);
  input.clear();
  introDone = done;
  sectorIntro.start(sys, idx);
}

function finishSectorIntro() {
  sectorIntro.stop();
  const done = introDone;
  introDone = null;
  input.clear();
  music.setDuck(1);
  if (done) done();
}

// Furthest point any run has reached (campaign screen / title records).
function noteProgress() {
  const c = profile.campaign;
  const r = G.run;
  if (r.sysIdx > c.bestSys || (r.sysIdx === c.bestSys && r.row > c.bestRow)) {
    c.bestSys = r.sysIdx;
    c.bestRow = r.row;
  }
}

// System boss down (not the last): post-boss dialogue, patch up half the missing hull, then warp to the next system.
function nextSystem() {
  const r = G.run;
  markCleared(r.system);
  blockingStory('post:' + r.system.id, STORY.systems[r.system.id].postBoss, { once: false, short: 'last' }, () => {
    comms.clear();
    hideBossCard();
    const p = G.player;
    const heal = Math.ceil((p.maxHp - p.hp) / 2);
    if (heal > 0) p.hp += heal;
    music.setSet('normal');
    enterSystem(r.sysIdx + 1);
  });
}

function markCleared(sys) {
  if (!profile.campaign.cleared.includes(sys.id)) profile.campaign.cleared.push(sys.id);
  saveProfile();
}

// Optional supply drop at system start (SYSTEMS[].supply; 0 everywhere now that the build carries over).
function startSupply(n) {
  G.supplyLeft = n;
  afterDraft = 'route';
  if (n > 0) openDraft('supply');
  else showRoute();
}

// --- Story --------------------------------------------------------------------------------

const storyOn = () => profile.settings.story !== false;

// Lines to play for a beat, or null to skip it. once: play only the first time (profile.campaign.seenStory[key]);
// otherwise replay a short version (short: 'first' | 'last' line) after the first time.
function storyLines(key, lines, { once = true, short = null } = {}) {
  if (!storyOn()) return null;
  const seen = !!profile.campaign.seenStory[key];
  if (seen && once) return null;
  profile.campaign.seenStory[key] = true;
  saveProfile();
  if (seen) return short === 'first' ? lines.slice(0, 1) : short === 'last' ? lines.slice(-1) : lines;
  return lines;
}

// Blocking dialogue between screens; `done` runs afterwards (or at once when the beat is skipped / already seen).
// overlay: keep the current menu behind the box instead of freezing the world on G.screen 'comms'.
function blockingStory(key, lines, opts, done) {
  const ls = storyLines(key, lines, opts);
  if (!ls) {
    comms.clear(); // e.g. a live pre-boss line still up when the boss dies
    return done();
  }
  if (!opts.overlay) {
    G.screen = 'comms';
    ui.hide();
    pauseBtn.hidden = true;
    touchUi.hidden = true;
    music.setDuck(0.6);
  }
  comms.play(ls, { blocking: true, onDone: done });
}

// Director hook (WARNING phase): boss title card + a short non-blocking exchange.
function onBossWarn(boss) {
  const r = G.run;
  const camp = r && r.mode === 'campaign';
  const kick = camp ? `ACT ${r.system.act} · ${r.system.name}` : `ENDLESS GRID · SECTOR ${G.sector}`;
  bossCard.style.setProperty('--c', boss.color);
  bossCard.innerHTML = `<div class="bc-kicker">${kick}</div><div class="bc-name" data-text="${boss.name}">${boss.name}</div><div class="bc-title">${boss.title}</div>`;
  bossCard.classList.remove('show');
  void bossCard.offsetWidth;
  bossCard.classList.add('show');
  clearTimeout(bossCardT);
  bossCardT = setTimeout(() => bossCard.classList.remove('show'), 3500);
  if (camp) {
    const ls = storyLines('pre:' + r.system.id, STORY.systems[r.system.id].preBoss, { once: false, short: 'first' });
    if (ls) comms.play(ls, { blocking: false });
  }
}

// focusId: element to focus instead of LAUNCH (a campaign loss lands on HANGAR).
function showCampaign(focusId) {
  if (G.mode !== 'attract') startAttract();
  G.screen = 'campaign';
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  music.setSet('normal');
  music.setDuck(1);
  const launchBtn = meta.renderCampaign(curShip().name);
  ui.show('campaign', { focus: (focusId && document.getElementById(focusId)) || launchBtn });
  blockingStory('prologue', STORY.prologue, { overlay: true }, () => {});
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
  noteProgress();
  if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
    const spec = nodeSpec(r.system, node, r.sectors + 1);
    if (r.curse) spec.modifiers.push(r.curse); // Contraband / event drawback
    r.curse = null;
    if (r.ambush && !spec.boss) spec.elite = true; // Glitched Cache ambush
    r.ambush = false;
    startSector(spec);
    r.sectors++;
    enterPlay();
  } else visitNode(node);
}

// Non-fighting stops: market, dock and anomaly events.
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
      openEvent(eventFor(G.run.route, node, G.run.events));
  }
}

function openEvent(ev, rng) {
  curEvent = startEvent(ev, rng);
  if (!G.run.events.includes(ev.id)) G.run.events.push(ev.id);
  meta.renderEvent(curEvent, G);
  G.screen = 'event';
  ui.show('event', { lock: 250 });
}

function eventPick(btn) {
  const s = curEvent;
  if (!s || s.done) return;
  if (resolveChoice(s, +btn.dataset.i) === null) return;
  sfx.levelUp();
  meta.renderEventResult(s, G);
  ui.show('event', { focus: document.getElementById('event-continue'), lock: 200 });
}

function buy(btn) {
  const o = marketOffers[+btn.dataset.i];
  if (!o || buyOffer(o)) return;
  sfx.coin();
  sfx.levelUp();
  const cards = () => [...document.querySelectorAll('#market-cards .card')];
  meta.renderMarket(G, marketOffers, false);
  const next = cards().find((c, i) => i >= +btn.dataset.i && !c.disabled && !c.hasAttribute('aria-disabled')) || cards().find((c) => !c.disabled && !c.hasAttribute('aria-disabled')) || document.getElementById('market-leave');
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

// Last boss down: post-boss dialogue and the ending, then the extraction screen. extract() also ends a run early (debug).
function extract() {
  const sys = G.run.system;
  const final = SYSTEMS.indexOf(sys) === SYSTEMS.length - 1;
  blockingStory('post:' + sys.id, STORY.systems[sys.id].postBoss, { once: false, short: 'last' }, () => {
    if (final) blockingStory('ending', STORY.ending, {}, () => finishExtract(true));
    else finishExtract(false);
  });
}

function finishExtract(final) {
  comms.clear();
  hideBossCard();
  const p = G.player;
  const r = G.run;
  r.victory = true;
  markCleared(r.system);
  const { unlocked, reward } = bankRun();
  meta.renderExtract({
    system: r.system, score: Math.floor(G.score), time: G.runTime, level: p.level, kills: G.kills, sectors: r.sectors,
    maxCombo: G.maxCombo, grazes: G.grazes, unlocked, reward, player: p, final,
  });
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
  profile.bestSector = Math.max(profile.bestSector, G.sector); // most sectors fought in one run
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

function openDraft(kind, quiet = false) {
  levelIntro = -1;
  draftKind = kind;
  draftChoices = rollDraft(G.player, kind === 'supply' ? 'sector' : kind);
  G.screen = 'draft';
  ui.renderDraft(G.player, draftChoices, kind, G.rerolls, pickUpgrade, G.supplyLeft);
  // guard: keys already held for flying (or a stray dash) don't drive the menu until released.
  ui.show('draft', { lock: 420, guard: true });
  pauseBtn.hidden = true;
  music.setDuck(0.6);
  if (kind === 'level' && !quiet) sfx.levelUp();
}

// Level-up during play: a short slow-motion beat (ring + chime) before the draft opens.
function startLevelIntro() {
  const p = G.player;
  levelIntro = LEVEL_INTRO;
  p.iframes = Math.max(p.iframes, LEVEL_INTRO + 0.1);
  ring(p.x, p.y, 70, '#3ff6ff', LEVEL_INTRO);
  sfx.levelUp();
  music.setDuck(0.8);
}

// World time scale from the level-up slow-down / post-draft ease (1 = normal).
function draftTimeScale() {
  if (levelIntro >= 0) return lerp(0.12, 1, easeInOut(levelIntro / LEVEL_INTRO));
  if (resumeEase > 0) return lerp(0.25, 1, easeInOut(1 - resumeEase / RESUME_EASE));
  return 1;
}

function pickUpgrade(id) {
  applyUpgrade(G.player, id, G);
  if (draftKind === 'level') G.pendingLevels = Math.max(0, G.pendingLevels - 1);
  if (draftKind === 'supply' && --G.supplyLeft > 0) return openDraft('supply');
  G.player.iframes = Math.max(G.player.iframes, 0.5);
  if (draftKind === 'sector') {
    if (G.run.mode === 'campaign') afterDraft = afterDraft === 'next' ? 'next' : 'route';
    else nextSector();
  }
  if (G.pendingLevels > 0) return openDraft('level');
  const next = afterDraft;
  afterDraft = null;
  if (next === 'route') return showRoute();
  if (next === 'extract') return extract();
  if (next === 'next') return nextSystem();
  enterPlay();
  resumeEase = RESUME_EASE;
  input.holdTarget(); // the cursor was on the menu: don't yank the ship toward it
}

function onSectorClear() {
  if (G.mode === 'attract') {
    if (G.sector >= 2) startAttract();
    else nextSector();
    return;
  }
  if (G.player.dead) return;
  if (G.screen !== 'play') return;
  if (G.run.mode === 'campaign' && G.director.spec.boss && G.run.sysIdx < SYSTEMS.length - 1) {
    // System boss: a reward draft, then on to the next system.
    afterDraft = 'next';
    openDraft('sector');
    return;
  }
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
  comms.clear();
  hideBossCard();
  const p = G.player;
  const newBest = G.score > profile.best;
  const { unlocked, reward } = bankRun();
  const campaign = G.run.mode === 'campaign';
  ui.renderGameOver({
    score: Math.floor(G.score), newBest: newBest && profile.runs > 1, sector: G.sector, time: G.runTime,
    level: p.level, kills: G.kills, maxCombo: G.maxCombo, grazes: G.grazes, unlocked, reward, player: p, campaign,
  });
  meta.renderRewards(document.getElementById('over-rewards'), reward, campaign);
  G.screen = 'gameover';
  ui.show('over', { lock: 700 });
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  music.setDuck(0.5);
}

// Back to the title menu without restarting the attract demo.
function titleMenu(focus) {
  G.screen = 'title';
  ui.renderTitle();
  ui.show('title', { focus: document.querySelector('#scr-title ' + focus) });
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
      ui.show('help', { focus: document.getElementById('help-back') });
      return;
    }
    showCampaign();
  },
  help() {
    settingsReturn = 'title';
    G.screen = 'help';
    ui.show('help', { focus: document.getElementById('help-back') });
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
  helpTab(btn) {
    document.querySelectorAll('#scr-help [data-tab]').forEach((el) => el.classList.toggle('on', el.dataset.tab === btn.dataset.tab));
  },
  launch: () => launchRun(),
  hangar: () => openHangar(),
  leaveHangar: () => showCampaign(),
  ...hangarActs,
  pilot: () => openPilot(),
  leavePilot: () => showCampaign(),
  ...pilotActs,
  gallery: () => openGallery(() => titleMenu('[data-act=gallery]')),
  achievements: () => openAchievements(() => titleMenu('[data-act=achievements]')),
  ...galleryActs,
  campaign: () => showCampaign(),
  upgrade: () => showCampaign('ship-btn'),
  node(btn) {
    pickRouteNode(routeNode(G.run.route, btn.dataset.id));
  },
  nodeDone: () => nodeContinue(),
  event: eventPick,
  eventDone: () => nodeContinue(),
  buy,
  dock: dockChoose,
  abandon: () => showCampaign(),
  resume: () => {
    enterPlay();
  },
  restart: () => (G.run.mode === 'campaign' ? launchRun() : startRun(curShip())),
  quit: () => (G.run.mode === 'campaign' ? showCampaign() : toTitle()),
  retry: () => (G.run.mode === 'campaign' ? launchRun() : startRun(curShip())),
  title: () => toTitle(),
  reroll() {
    if (G.rerolls <= 0) return;
    G.rerolls--;
    draftChoices = rollDraft(G.player, draftKind === 'supply' ? 'sector' : draftKind);
    ui.renderDraft(G.player, draftChoices, draftKind, G.rerolls, pickUpgrade, G.supplyLeft);
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
// Tap / click skips the sector intro.
app.addEventListener('pointerdown', () => {
  if (G.screen === 'sector-intro') sectorIntro.skip();
});

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
  return s === 'play' || s === 'gameover' || s === 'title' || s === 'campaign' || s === 'hangar' || s === 'parts' || s === 'pilot' || s === 'settings' || s === 'help' || s === 'gallery' || s === 'achievements';
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

  achTick(raw);
  comms.update(raw, G.screen === 'play');
  if (G.screen === 'sector-intro') {
    if (input.consume('confirm') || input.consume('back') || input.consume('dash')) sectorIntro.skip();
    if (sectorIntro.update(raw)) finishSectorIntro();
  } else if (G.screen === 'play') {
    if (input.consume('pause')) pause();
  } else if (!comms.blocking) {
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
      if (!cine.on) dt *= 0.3; // the finisher cam sets its own pace
    }
    if (G.screen === 'play') dt *= draftTimeScale() * cine.timeScale();
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
  const boost = Math.max(cine.boost(), G.player && (G.player.odT > 0 || G.player.dashT > 0) ? 3 : G.director && G.director.state === 'clear' ? 4 : 1);
  const dk = !!(G.mode === 'run' && (G.screen === 'play' || G.screen === 'pause' || G.screen === 'pause-settings') && G.director.diff.blackout && G.director.state !== 'clear' && G.director.state !== 'await'); // not on result screens
  bg.setDark(dk);
  vignette.classList.toggle('dark', dk);
  const intro = G.screen === 'sector-intro';
  bg.update(simulating() || intro ? raw : raw * 0.25, intro ? sectorIntro.boost() : boost);
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
    if (resumeEase > 0) resumeEase = Math.max(0, resumeEase - raw);
    // A finisher shot outranks the level-up slow-down: it waits (and one already running is dropped) until the shot ends.
    if (G.pendingLevels > 0 && !p.dead && G.director.state !== 'clear' && !cine.on) {
      if (levelIntro < 0) startLevelIntro();
      else if ((levelIntro -= raw) <= 0) openDraft('level', true);
    } else if (levelIntro >= 0) {
      levelIntro = -1;
      if (!cine.on) music.setDuck(1);
    }
    cine.update(raw); // after the level check, so the director clears the node before a level-up can start
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
  if (G.screen === 'sector-intro') {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    sectorIntro.draw(ctx);
    bloom(ctx);
    return;
  }
  // Finisher / node-start camera: zoom about a world point (screen = world * z + cam offset).
  const live = G.mode === 'run' && (G.screen === 'play' || G.screen === 'pause' || G.screen === 'pause-settings');
  const cam = live ? cine.camera() : null;
  if (cam && cam.rot) {
    // Rolled fly-through camera: sprites set axis-aligned transforms of their own, so the world is drawn flat into an
    // offscreen copy and that is blitted rolled, zoomed and skewed (one extra full-frame drawImage, transit only).
    if (off.width !== canvas.width || off.height !== canvas.height) {
      off.width = canvas.width;
      off.height = canvas.height;
    }
    octx.setTransform(k, 0, 0, k, view.ox, view.oy);
    renderWorld(octx, k);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05030d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(cam.px * k, cam.py * k);
    ctx.rotate(cam.rot);
    ctx.transform(cam.z, 0, cam.skew * cam.z, cam.z * cam.sy, 0, 0);
    ctx.translate(-cam.fx * k, -cam.fy * k);
    ctx.drawImage(off, 0, 0);
  } else {
    const kz = cam ? k * cam.z : k;
    if (cam) {
      view.ox += cam.x * k;
      view.oy += cam.y * k;
    }
    ctx.setTransform(kz, 0, 0, kz, view.ox, view.oy);
    renderWorld(ctx, kz);
  }
  bloom(ctx, live ? 1 + 0.25 * cine.amount() : 1);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (live) cine.overlay(ctx);
  if (G.mode === 'run' && (G.screen === 'play' || G.screen === 'pause' || G.screen === 'draft' || G.screen === 'pause-settings')) drawHud(ctx, live ? cine.hudAlpha() : 1);
  if (G.flash > 0.01) {
    ctx.fillStyle = `rgba(${G.flashColor},${Math.min(0.8, G.flash)})`;
    ctx.fillRect(0, 0, view.W, view.H);
  }
  // Menu dim; fades in over the level-up slow-down so the draft doesn't hard-cut.
  const dim = G.screen === 'pause' || G.screen === 'draft' || G.screen === 'pause-settings' ? 0.35 : levelIntro >= 0 && G.screen === 'play' ? 0.35 * (1 - levelIntro / LEVEL_INTRO) : 0;
  if (dim > 0) {
    ctx.fillStyle = `rgba(5,3,13,${dim})`;
    ctx.fillRect(0, 0, view.W, view.H);
  }
}

// --- Boot -----------------------------------------------------------------------------

function boot() {
  layout();
  buildSprites(SHIPS);
  buildEnemySpritesV2();
  applyAllPaints();
  bg.init();
  setSfxVolume(profile.settings.sfx);
  initToasts();
  const past = achInit(); // achievements older saves already earned
  if (past) setTimeout(() => notifyBacklog(past), 1200);
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
  // Debug: spawn an enemy (already on screen). 'weaver' spawns the linked pair and returns both nodes.
  spawn(type, x = view.W / 2, y = 150, opts = {}) {
    if (type === 'weaver') return spawnWeavers(x, y, opts.gap || 200).map((e) => ((e.entered = true), e));
    const e = spawnEnemy(type, x, y, { tx: x, ty: y, ...opts });
    e.entered = true;
    return e;
  },
  rollDraft: (kind = 'level') => rollDraft(G.player, kind),
  // Start a campaign run (1 = the normal start; a later 1-based index or system id starts there, debug); lands on the route screen.
  // The intro dialogue is skipped (still marked seen) unless opts.story is true.
  // The sector intro animation is skipped too unless opts.intro is true.
  launch(sys = 1, opts = {}) {
    launchRun(typeof sys === 'number' ? sys - 1 : SYSTEMS.indexOf(systemById(sys)));
    if (!opts.intro && G.screen === 'sector-intro') finishSectorIntro();
    if (!opts.story) comms.skipAll();
  },
  cine,
  sectorIntro,
  comms,
  // Debug: open anomaly event `id` (campaign run required; opts.rng forces rolls). pickEvent(i) chooses; the result screen then has #event-continue.
  event(id, opts = {}) {
    if (!G.run || G.run.mode !== 'campaign' || !eventById(id)) return false;
    openEvent(eventById(id), opts.rng);
    return true;
  },
  pickEvent(i) {
    if (G.screen !== 'event' || !curEvent) return false;
    eventPick({ dataset: { i } });
    return curEvent.done;
  },
  eventState: () => curEvent,
  extract, // debug: end the campaign run now (post-boss dialogue → extraction screen)
  showBossCard: onBossWarn,
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
  // Debug: drop a relic cache (run only) at x, y (default: above the ship).
  dropRelic: (x = G.player.x, y = G.player.y - 120) => rollRelicDrop({ x, y }, true),
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
      if (G.screen === 'sector-intro') finishSectorIntro(); // nor does the sector intro
      if (comms.blocking) comms.skipAll(); // dialogue never blocks the simulator
      if (G.screen === 'draft') pickUpgrade(pickFn(draftChoices));
      for (let guard = 0; guard < 6 && (G.screen === 'route' || G.screen === 'event' || G.screen === 'market' || G.screen === 'dock'); guard++) {
        if (G.screen === 'event') {
          // Default: the first choice that can be taken. opts.eventPick(event, session) → index.
          const s = curEvent;
          let i = opts.eventPick ? opts.eventPick(s.ev, s) : -1;
          if (!(i >= 0) || choiceBlocked(s, i)) i = s.choices.findIndex((c, k) => !choiceBlocked(s, k));
          if (i >= 0) eventPick({ dataset: { i } });
          nodeContinue();
        } else if (G.screen === 'market') {
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
