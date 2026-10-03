// Boot, layout, main loop and top-level game flow.

import { G, view } from './game/state.js';
import { profile, saveProfile, resetProfile } from './core/storage.js';
import { TIER_CAP, CORE, coreCost } from './game/core.js';
import { input, bindPointer, pollGamepads } from './core/input.js';
import { unlockAudio, music, setSfxVolume, setSfxMuted, sfx } from './core/audio.js';
import { buildSprites, buildEnemySpritesV2 } from './render/sprites.js';
import { prewarmBossArt } from './render/bossArt.js';
import { bg } from './render/background.js';
import { bloom } from './render/post.js';
import { beat as musicBeat } from './core/beat.js';
import { drawHud, updateBanner, buttonSide } from './render/hud.js';
import { SHIPS, shipById, ownsShip, isUnlocked } from './game/ships.js';
import { createPlayer } from './game/player.js';
import { drawBoostFx } from './game/boost.js';
import { createDirector, startSector, nextSector, endlessSpec } from './game/director.js';
import { rollDraft, applyUpgrade, UPGRADES, discover, rollCard, applyCard } from './game/upgrades.js';
import { runLuck, rankUpFinds, dropGear, dropAbility, addGear } from './game/loot.js';
import { makeItem } from './game/parts.js';
import { spawnEnemy, spawnWeavers } from './game/enemies.js';
import { step, renderWorld } from './game/world.js';
import { ui } from './ui/screens.js';
import { comms } from './ui/comms.js';
import { meta } from './ui/meta.js';
import { hangarActs, openHangar, openFab, initHangarUi } from './ui/hangar.js';
import { coreActs, openCore } from './ui/fluxcore.js';
import { pilotActs, openPilot, showPilot, initPilotUi } from './ui/pilot.js';
import { treeActs, openTree, treeView } from './ui/tree.js';
import * as passiveTree from './game/tree.js';
import { galleryActs, openGallery, openAchievements } from './ui/gallery.js';
import { initToasts, notifyBacklog } from './ui/toasts.js';
import { achInit, achTick } from './game/achievements.js';
import { rollRelicDrop } from './game/collectables.js';
import { setClass, setPassives, initPilotProfile, findClass, findPassive } from './game/pilot.js';
import { buyShip, equipPart, unequipSlot, setPaint, selectShip, applyAllPaints, rollGear, sellGear, sellJunk, initGear } from './game/hangar.js';
import { SYSTEMS, systemById, generateRoute, nodeSpec, reachableNodes, routeNode, REWARDS } from './game/campaign.js';
import { rand, pick, lerp, easeInOut } from './core/math.js';
import { ring, drawTexts } from './game/fx.js';
import { sv } from './game/stageview.js';
import { intro as bootIntro } from './game/intro.js';
import { cine } from './game/cinematic.js';
import { sectorIntro } from './render/sectorIntro.js';
import { overworld } from './game/overworld.js';
import { STORY, eventFor, eventById, startEvent, resolveChoice, choiceBlocked, RIFT, riftHazard } from './game/story.js';
import { rollMarket, buyOffer, dockRepair, dockReinforce, settleRun, rankFor, cachePayout } from './game/economy.js';

const app = document.getElementById('app');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const pauseBtn = document.getElementById('pause-btn');
const mapBtn = document.getElementById('map-btn');
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
let draftRolls = {}; // card id → rarity roll (upgrades.js rollCard) for the open draft
let marketOffers = null; // current Black Market stock
let curEvent = null; // open anomaly event session (story.startEvent)
let bossCardT = 0;
let draftOnly = null; // category filter for the next 'sector' draft (campaign fight rewards)
let extraDrafts = 0; // further 'sector' drafts owed (elite fights pay two)
let draftNote = ''; // extra line for the next draft's subtitle (fight reward / vault haul)
let curNote = ''; // the open draft's note (kept for rerolls)
const START_REROLLS = 3; // draft rerolls at the start of a run (+1 every 5 levels and per boss)
let draftLocks = new Set(); // ids of locked draft cards: a reroll keeps them and replaces the rest
let afterDraft = null; // 'route' | 'extract' | 'next': where to go once the sector reward / level drafts are done
// Level-up pacing: the world slows into the draft and eases back out of it instead of hard cuts.
const LEVEL_INTRO = 0.5; // real seconds of slow-down before the level-up draft opens
const RESUME_EASE = 0.45; // real seconds to ramp back to full speed after a draft
let levelIntro = -1; // seconds left in the slow-down (-1 = not running)
let resumeEase = 0;
let introDone = null; // callback once the sector intro animation ends
let owBack = false; // the overworld is the run's current place: menus over it draw it behind them
let pauseFrom = 'play'; // screen the pause menu returns to (play | overworld)
let diveT = 0; // pending zoom-into-node timeout (route → fight); 0 = none
const routeEl = document.getElementById('scr-route');

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
  if (mode === 'run') bootIntro.abort(); // its scripted ship control would otherwise fly the run
  G.mode = mode;
  G.run = run;
  comms.clear();
  hideBossCard();
  cine.clear();
  sectorIntro.stop();
  introDone = null;
  owBack = false;
  overworld.exit(); // the fight systems back on the screen playfield
  if (run) Object.assign(run, { wallet: 0, earned: 0, frac: 0, flux: 0, curse: null, ambush: false, riftLeft: 0, bonusXp: 0, events: [], loot: [], found: [] });
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
  G.director.onView = (mode) => G.run && G.run.mode === 'campaign' && STORY.tips['view_' + mode] && tip('view_' + mode, true);
  G.player = createPlayer(shipDef, mode !== 'attract'); // hangar parts only in real runs
  G.rerolls = START_REROLLS + (G.player.st.rerolls || 0); // + gear, passive tree and Flux Core rerolls
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
  newWorld('run', ship, { mode: 'campaign', tier: profile.tier, deep: 0, sysIdx: from, system: SYSTEMS[from], route: null, row: -1, nodeId: null, sectors: 0, victory: false, visited: [] });
  enterSystem(from);
}

// Puts the run at row -1 of system `idx` (fresh route), plays the warp-in and its intro, then opens the route (after any supply drop).
function enterSystem(idx) {
  const r = G.run;
  const sys = SYSTEMS[idx];
  Object.assign(r, { sysIdx: idx, system: sys, route: generateRoute(sys, Math.floor(Math.random() * 2147483647)), row: -1, nodeId: null, visited: [] });
  G.player.techTier = Math.max(G.player.techTier || 0, idx); // this system's tech joins the upgrade pool (upgrades.js tiers); Deep Grid cycles keep it all
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

// THE VOID cleared: the run is won (death or EXTRACT now bank everything), the next Overdrive tier unlocks, and the run
// loops into Deep Grid cycle deep + 1 (harder, pays Flux; core.js). The ending plays after the first clear.
function diveDeeper() {
  const r = G.run;
  markCleared(r.system);
  r.victory = true;
  profile.tierMax = Math.min(TIER_CAP, Math.max(profile.tierMax, (r.tier || 0) + 1));
  saveProfile();
  const sys = r.system;
  const go = () => {
    comms.clear();
    hideBossCard();
    const p = G.player;
    p.hp += Math.ceil((p.maxHp - p.hp) / 2);
    r.deep = (r.deep || 0) + 1;
    profile.bestDeep = Math.max(profile.bestDeep, r.deep);
    saveProfile();
    music.setSet('normal');
    blockingStory('deep', STORY.deep, {}, () => enterSystem(0));
  };
  blockingStory('post:' + sys.id, STORY.systems[sys.id].postBoss, { once: false, short: 'last' }, () => {
    if (r.deep === 0) blockingStory('ending', STORY.ending, {}, go);
    else go();
  });
}

// Leave a won run from the pause menu / route: bank everything at the extraction screen.
const leaveRun = () => (G.run && G.run.mode === 'campaign' && G.run.victory ? finishExtract(true) : showCampaign());

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

// A one-time beat over whatever is on screen: mechanic tips and mid-system story (off with the story setting).
// Waits for a later chance while another line is up. live: a non-blocking line during play.
function beat(key, lines, live = false) {
  if (!lines || comms.active || (G.run && G.run.mode !== 'campaign')) return;
  const ls = storyLines(key, lines);
  if (ls) comms.play(ls, { blocking: !live });
}
const tip = (id, live = false) => beat('tip:' + id, STORY.tips[id], live);

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
  blockingStory('prologue', STORY.prologue, { overlay: true }, () => profile.tierMax > 0 && tip('tier'));
}

// Between nodes the run is in the system's overworld (src/game/overworld.js): fly to a lit beacon to pick the next node.
function showRoute() {
  const r = G.run;
  ui.hide();
  sv.reset(); // the overworld is always top-down
  overworld.enter(r);
  owBack = true;
  resumeOverworld();
  tip('overworld', true);
  if (r.row >= r.system.rows >> 1) beat('mid:' + r.system.id, STORY.systems[r.system.id].mid, true);
}

// Back to flying in the overworld (after showRoute, or unpausing there).
function resumeOverworld() {
  ui.hide();
  G.screen = 'overworld';
  pauseBtn.hidden = false;
  touchUi.hidden = !input.isTouchDevice; // dash and ultimate work out here too
  input.clear();
  music.setDuck(0.85);
}

overworld.init({
  engage: (node) => pickRouteNode(node),
  // Distress signal: an anomaly event, seeded by the site like a route node.
  signal(site) {
    pauseBtn.hidden = true;
    openEvent(eventFor(G.run.route, site, G.run.events));
    tip('anomaly');
  },
  levelUp() {
    afterDraft = 'route';
    openDraft('level');
  },
  dead: () => gameOver(),
});

// Map transitions: the map pulls out of the node just left ('in'), and dives into the node picked ('out').
// The zoom is centred on that node (CSS transform-origin), so the map and the fight read as one space.
function routeZoom(dir, nodeEl) {
  const s = routeEl.getBoundingClientRect();
  if (nodeEl && s.width) {
    const r = nodeEl.getBoundingClientRect();
    routeEl.style.setProperty('--zx', (((r.left + r.width / 2 - s.left) / s.width) * 100).toFixed(1) + '%');
    routeEl.style.setProperty('--zy', (((r.top + r.height / 2 - s.top) / s.height) * 100).toFixed(1) + '%');
  }
  routeEl.classList.remove('zoom-in', 'zoom-out');
  void routeEl.offsetWidth; // restart the animation
  routeEl.classList.add('zoom-' + dir);
}

// Picks a route node: fighting nodes start a sector, the rest go through visitNode.
function pickRouteNode(node) {
  const r = G.run;
  pauseBtn.hidden = true;
  if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') overworld.leave();
  r.nodeId = node.id;
  r.row = node.row;
  r.visited.push(node.id);
  noteProgress();
  if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
    const spec = nodeSpec(r.system, node, r.sectors + 1, r.tier, r.deep);
    if (r.curse) spec.modifiers.push(r.curse); // Contraband / event drawback
    r.curse = null;
    if (r.ambush && !spec.boss) spec.elite = true; // Glitched Cache ambush
    r.ambush = false;
    if (r.riftLeft > 0 && !spec.boss) {
      spec.modifiers.push(riftHazard()); // Chaos Rift aftermath
      r.riftLeft--;
    }
    startSector(spec);
    r.sectors++;
    enterPlay();
    if (spec.elite) tip('elite', true);
    else if (spec.modifiers.length) tip('hazard', true);
    else tip('boost', true);
  } else visitNode(node);
}

// Non-fighting stops: market, dock and anomaly events.
// Every stop must end by calling nodeContinue().
function visitNode(node) {
  switch (node.type) {
    case 'market':
      marketOffers = rollMarket(G.player, G.run.system);
      discover(marketOffers.filter((o) => o.kind === 'upgrade').map((o) => o.up));
      G.screen = 'market';
      meta.renderMarket(G, marketOffers, true);
      ui.show('market', { lock: 250 });
      tip('market');
      break;
    case 'dock':
      G.screen = 'dock';
      meta.renderDock(G.player, boostChoices(G.player).length > 0);
      ui.show('dock', { lock: 250 });
      tip('dock');
      break;
    case 'vault': {
      const cr = cachePayout();
      draftNote = `${cr ? `+${cr} credits in the vault · ` : ''}each pick installs 2 levels`;
      afterDraft = 'route';
      openDraft('vault', true);
      tip('vault');
      break;
    }
    case 'rift':
      openEvent(RIFT);
      tip('rift');
      break;
    default:
      openEvent(eventFor(G.run.route, node, G.run.events));
      tip('anomaly');
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
  if (btn.dataset.opt === 'overclock') {
    if (!boostChoices(G.player).length) return;
    afterDraft = 'route';
    return openDraft('boost', true);
  }
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
    maxCombo: G.maxCombo, grazes: G.grazes, unlocked, reward, player: p, final, deep: r.deep || 0, tier: r.tier || 0,
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
  rankUpFinds(reward.rankBefore.rank, reward.rankAfter.rank); // each rank gained finds an ability (lands in run.found)
  reward.loot = (G.run && G.run.loot) || [];
  reward.found = (G.run && G.run.found) || [];
  saveProfile();
  // Legacy unlock conditions still grant ships for free (they join ownedShips).
  const unlocked = SHIPS.filter((s) => s.unlock && isUnlocked(s, profile) && !ownsShip(profile, s));
  for (const s of unlocked) profile.ownedShips.push(s.id);
  saveProfile();
  return { unlocked, reward };
}

function enterPlay() {
  if (comms.blocking) comms.clear(); // a menu tip still up (debug node picks)
  owBack = false;
  ui.hide();
  G.screen = 'play';
  pauseBtn.hidden = false;
  touchUi.hidden = !input.isTouchDevice;
  input.clear();
  music.setDuck(1);
}

function pause() {
  if ((G.screen !== 'play' && G.screen !== 'overworld') || G.player.dead) return;
  pauseFrom = G.screen;
  G.screen = 'pause';
  ui.renderPause(G);
  ui.show('pause', { lock: 150 });
  pauseBtn.hidden = true;
  music.setDuck(0.45);
}

function unpause() {
  if (pauseFrom === 'overworld') resumeOverworld();
  else enterPlay();
}

// Owned, non-maxed, non-evolution upgrades (Rest Station overclock / BOOST reward).
function boostChoices(p) {
  return UPGRADES.filter((u) => u.cat !== 'evolution' && (p.up[u.id] || 0) > 0 && p.up[u.id] < u.max).map((u) => u.id);
}

const DRAFT_ONLY = {
  offense: (u) => u.cat === 'weapon' || u.cat === 'stat',
  defense: (u) => u.cat === 'defense',
  module: (u) => u.cat === 'module' || u.cat === 'evolution',
};

// Choices for a draft of `kind`: level | sector | supply | vault (2 levels per pick) | boost (+1 to an owned upgrade).
// avoid: ids a reroll must not repeat (the locked cards).
function rollFor(kind, avoid = null) {
  const p = G.player;
  if (avoid && avoid.size) {
    const noEvo = [...avoid].some((id) => (UPGRADES.find((u) => u.id === id) || {}).cat === 'evolution'); // one evolution per draft
    const keep = (u) => !avoid.has(u.id) && !(noEvo && u.cat === 'evolution');
    if (kind === 'boost') return boostChoices(p).filter((id) => !avoid.has(id)).sort(() => Math.random() - 0.5).slice(0, 3);
    if (kind === 'sector' && draftOnly) {
      const only = rollDraft(p, 'sector', (u) => keep(u) && DRAFT_ONLY[draftOnly](u));
      if (only.filter((id) => id !== 'repair' && id !== 'credits').length >= 1) return only;
    }
    return rollDraft(p, kind === 'level' ? 'level' : 'sector', keep);
  }
  if (kind === 'boost') {
    const ids = boostChoices(p);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.length ? ids.slice(0, 3) : ['credits'];
  }
  if (kind === 'sector' && draftOnly) {
    const only = rollDraft(p, 'sector', DRAFT_ONLY[draftOnly]);
    if (only.filter((id) => id !== 'repair' && id !== 'credits').length >= 2) return only; // else the category is spent
  }
  return rollDraft(p, kind === 'level' ? 'level' : 'sector');
}

function openDraft(kind, quiet = false) {
  levelIntro = -1;
  draftKind = kind;
  if (G.run.mode !== 'campaign') G.player.techTier = Math.min(3, Math.floor((G.sector - 1) / 3)); // debug sandbox
  draftChoices = rollFor(kind);
  draftLocks = new Set();
  rollRarities(kind);
  G.screen = 'draft';
  curNote = draftNote;
  draftNote = '';
  const fresh = showDraftCards(kind);
  // guard: keys already held for flying (or a stray dash) don't drive the menu until released.
  ui.show('draft', { lock: 420, guard: true });
  pauseBtn.hidden = true;
  music.setDuck(0.6);
  if (kind === 'level' && !quiet) sfx.levelUp();
  if (fresh.length && G.run.sysIdx > 0) tip('discovery'); // a later system's tech: Genesis tech is new to everyone at first
  if (kind === 'level' || kind === 'sector') tip('draft');
}

// Card rarities for the open draft (Rest Station boosts stay plain).
// keep: ids whose roll stays (locked cards through a reroll).
function rollRarities(kind, keep = null) {
  const old = draftRolls;
  draftRolls = {};
  if (kind === 'boost') return;
  const luck = runLuck();
  for (const id of draftChoices) draftRolls[id] = keep && keep.has(id) ? old[id] : rollCard(G.player, id, luck);
}

// Locked cards survive a reroll; at least one card must stay unlocked to reroll.
function toggleLock(i) {
  if (draftLocks.has(i)) draftLocks.delete(i);
  else if (draftLocks.size < draftChoices.length - 1) draftLocks.add(i);
  else return false;
  sfx.ui();
  return true;
}

// Renders the draft (cards flag never-seen tech), then records those options as discovered. Returns the new ids.
function showDraftCards(kind) {
  ui.renderDraft(G.player, draftChoices, kind, G.rerolls, pickUpgrade, G.supplyLeft, curNote, draftRolls, draftLocks, toggleLock);
  const fresh = discover(draftChoices);
  if (fresh.length) sfx.achieve(true);
  return fresh;
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
  const p = G.player;
  applyCard(p, id, draftRolls[id], G);
  draftRolls = {};
  // Treasure Vault: each pick is worth two levels (where the upgrade has room).
  if (draftKind === 'vault' && p.up[id] && p.up[id] < (UPGRADES.find((u) => u.id === id) || {}).max) applyUpgrade(p, id, G);
  if (draftKind === 'level') G.pendingLevels = Math.max(0, G.pendingLevels - 1);
  if (draftKind === 'supply' && --G.supplyLeft > 0) return openDraft('supply');
  p.iframes = Math.max(p.iframes, 0.5);
  if (draftKind === 'sector') {
    draftOnly = null;
    if (extraDrafts > 0) {
      extraDrafts--;
      return openDraft('sector', true);
    }
    if (G.run.mode === 'campaign') afterDraft = afterDraft === 'next' || afterDraft === 'deep' ? afterDraft : 'route';
    else nextSector();
  }
  if (G.pendingLevels > 0) return openDraft('level');
  const next = afterDraft;
  afterDraft = null;
  if (next === 'route') return showRoute();
  if (next === 'extract') return extract();
  if (next === 'next') return nextSystem();
  if (next === 'deep') return diveDeeper();
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
    // THE VOID's boss: a reward draft, then the run dives into the next Deep Grid cycle.
    afterDraft = 'deep';
    openDraft('sector');
    return;
  }
  if (G.run.mode === 'campaign') applyFightReward(G.director.spec.reward);
  openDraft('sector');
}

// The reward a campaign fight showed on the map (campaign.js REWARDS), paid at sector clear around its sector draft.
function applyFightReward(rw) {
  const p = G.player;
  const notes = [];
  const say = (t) => notes.push(t);
  draftOnly = rw === 'offense' || rw === 'defense' || rw === 'module' ? rw : null;
  extraDrafts = rw === 'double' ? 1 : 0;
  if (rw === 'defense' && p.hp < p.maxHp) {
    p.hp++;
    say('repaired 1 hull');
  }
  if (rw === 'credits') {
    const cr = cachePayout();
    if (cr) say(`+${cr} credit cache`);
  }
  if (rw === 'hull') {
    dockReinforce(p);
    p.hp = Math.min(p.maxHp, p.hp + 1);
    say('+1 max hull');
  }
  if (rw === 'boost') {
    const ids = boostChoices(p);
    if (ids.length) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      applyUpgrade(p, id, G);
      say(`${UPGRADES.find((u) => u.id === id).name} +1 level`);
    }
  }
  if (rw && REWARDS[rw]) draftNote = `${REWARDS[rw].name} reward${notes.length ? ': ' + notes.join(' · ') : ''}`;
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
  if (campaign && !G.run.victory) tip('death');
}

// Back to the title menu without restarting the attract demo.
function titleMenu(focus) {
  G.screen = 'title';
  ui.renderTitle();
  ui.show('title', { focus: document.querySelector('#scr-title ' + focus) });
}

function toTitle(slam = false) {
  G.screen = 'title';
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  startAttract();
  ui.renderTitle();
  ui.show('title');
  music.setSet('normal');
  music.setDuck(1);
  const logo = document.querySelector('#scr-title .logo');
  logo.classList.remove('slam');
  if (slam) {
    void logo.offsetWidth;
    logo.classList.add('slam');
  }
}

// Boot intro (src/game/intro.js): plays on a fresh attract world, then lands on the title with the logo slam.
function playIntro() {
  ui.hide();
  pauseBtn.hidden = true;
  touchUi.hidden = true;
  comms.clear();
  bootIntro.start({
    setup: () => newWorld('attract', curShip()),
    done: () => {
      profile.seenIntro = true;
      saveProfile();
      toTitle(true);
    },
  });
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
    document.getElementById('set-intro').hidden = settingsReturn === 'pause'; // replaying would end the run
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
  // Campaign "how a run works" box: toggled by the ? button, opens once by itself.
  runInfo() {
    const box = document.getElementById('run-info');
    box.hidden = !box.hidden;
    if (!profile.seenRunInfo) {
      profile.seenRunInfo = true;
      saveProfile();
    }
    (box.hidden ? document.querySelector('#sys-detail .info-btn') : box.querySelector('.btn')).focus();
  },
  hangar: () => openHangar(),
  core: () => openCore(() => showCampaign('core-btn')),
  ...coreActs,
  // Overdrive tier for the next launch: cycles through the unlocked tiers.
  tier() {
    if (!profile.tierMax) return;
    profile.tier = (profile.tier + 1) % (profile.tierMax + 1);
    saveProfile();
    showCampaign('tier-btn');
  },
  leaveHangar: () => showCampaign(),
  ...hangarActs,
  pilot: () => openPilot(),
  leavePilot: () => showCampaign(),
  ...pilotActs,
  tree() {
    openTree(document.querySelector('#pl-tabs .view')?.dataset.id, () => showPilot('#pl-tree'));
    tip('tree');
  },
  ...treeActs,
  gallery: () => openGallery(() => titleMenu('[data-act=gallery]')),
  achievements: () => openAchievements(() => titleMenu('[data-act=achievements]')),
  ...galleryActs,
  campaign: () => showCampaign(),
  upgrade: () => showCampaign('ship-btn'),
  node(btn) {
    if (diveT) return;
    const node = routeNode(G.run.route, btn.dataset.id);
    routeZoom('out', btn);
    diveT = setTimeout(() => {
      diveT = 0; // zoom-out stays on until the next routeZoom, so the map doesn't flash back while it fades
      if (G.screen === 'route') pickRouteNode(node);
    }, 380);
  },
  nodeDone: () => nodeContinue(),
  event: eventPick,
  eventDone: () => nodeContinue(),
  buy,
  dock: dockChoose,
  abandon: leaveRun,
  resume: () => unpause(),
  restart: () => (G.run.mode === 'campaign' ? launchRun() : startRun(curShip())),
  quit: () => (G.run.mode === 'campaign' ? leaveRun() : toTitle()),
  retry: () => (G.run.mode === 'campaign' ? launchRun() : startRun(curShip())),
  title: () => toTitle(),
  intro: () => settingsReturn !== 'pause' && playIntro(),
  reroll() {
    if (G.rerolls <= 0 || draftLocks.size >= draftChoices.length) return;
    G.rerolls--;
    const kept = new Set([...draftLocks].map((i) => draftChoices[i]));
    const fresh = rollFor(draftKind, kept);
    draftChoices = draftChoices.map((id, i) => (draftLocks.has(i) ? id : fresh.shift() || 'credits'));
    rollRarities(draftKind, kept);
    showDraftCards(draftKind);
    ui.show('draft', { lock: 200 });
  },
  touchSide() {
    profile.settings.touchSide = buttonSide() === 'right' ? 'left' : 'right';
    saveProfile();
    ui.syncSettings?.();
    placeTouchUi();
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
mapBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  e.preventDefault();
  unlockAudio();
  if (G.screen === 'overworld') overworld.toggleMap();
});
// Touch buttons go in the corner picked in Settings (hud.js gaugeSpots draws the gauges under them).
function placeTouchUi() {
  touchUi.classList.toggle('side-left', buttonSide() === 'left');
}
placeTouchUi();
for (const [id, action] of [['touch-od', 'od'], ['touch-dash', 'dash']]) {
  document.getElementById(id).addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.setDevice('touch');
    input.press(action);
  });
}
// Boost is held, not pressed.
{
  const el = document.getElementById('touch-boost');
  const down = (e) => {
    e.preventDefault();
    e.stopPropagation();
    input.setDevice('touch');
    input.hold('focus', true);
  };
  const up = () => input.hold('focus', false);
  el.addEventListener('pointerdown', down);
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, up);
}

input.onAnyGesture = unlockAudio;
input.getAnchor = () => (G.screen === 'overworld' ? overworld.anchor() : G.player ? (sv.active ? sv.toScreen(G.player.x, G.player.y) : { x: G.player.x, y: G.player.y }) : { x: view.W / 2, y: view.H * 0.8 });
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
  return s === 'play' || s === 'intro' || s === 'gameover' || s === 'title' || s === 'campaign' || s === 'hangar' || s === 'parts' || s === 'fab' || s === 'pilot' || s === 'settings' || s === 'help' || s === 'gallery' || s === 'achievements' || s === 'core' || s === 'tree';
}

function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;
  G.realTime += raw;
  pollGamepads();

  // Adaptive quality: sustained slow frames lower resolution and particle budget.
  frameAvg += (raw * 1000 - frameAvg) * 0.05;
  if (frameAvg > 24 && (simulating() || G.screen === 'overworld')) {
    if (++slowFrames > 120 && (view.quality > 0.5 || dprCap > 1)) {
      slowFrames = 0;
      view.quality = Math.max(0.5, view.quality - 0.25);
      dprCap = Math.max(1, dprCap - 0.5);
      layout();
    }
  } else slowFrames = 0;

  achTick(raw);
  comms.update(raw, G.screen === 'play' || G.screen === 'overworld');
  if (G.screen === 'intro') bootIntro.update(raw);
  else if (G.screen === 'sector-intro') {
    if (input.consume('confirm') || input.consume('back') || input.consume('dash')) sectorIntro.skip();
    if (sectorIntro.update(raw)) finishSectorIntro();
  } else if (G.screen === 'play') {
    if (input.consume('pause')) pause();
  } else if (G.screen === 'overworld') {
    if (input.consume('pause')) pause();
    else if (!comms.blocking) overworld.update(raw);
  } else if (!comms.blocking) {
    ui.update();
    input.consume('pause') && G.screen === 'pause' && unpause();
  }

  G.frameDt = simulating() ? raw : 0; // screen-space effects that should freeze with the game (boost streaks)
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
  mapBtn.hidden = G.screen !== 'overworld';
  const boost = Math.max(cine.boost(), G.player && (G.player.odT > 0 || G.player.dashT > 0) ? 3 : G.director && G.director.state === 'clear' ? 4 : 1, G.player && G.player.boostV ? 1 + 3.2 * G.player.boostV : 1);
  const dk = !!(G.mode === 'run' && (G.screen === 'play' || G.screen === 'pause' || G.screen === 'pause-settings') && G.director.diff.blackout && G.director.state !== 'clear' && G.director.state !== 'await'); // not on result screens
  bg.setDark(dk);
  vignette.classList.toggle('dark', dk);
  const intro = G.screen === 'sector-intro';
  bg.update(simulating() || intro ? raw * cine.bgScale() : raw * 0.25, intro ? sectorIntro.boost() : boost);
  music.update(raw);
  musicBeat.update();
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
    if (p.odReady && !p.dead && G.run.mode === 'campaign') tip('ult', true);
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
  if (owBack && G.mode === 'run' && G.screen !== 'play') {
    // Overworld (and the menus a beacon opens over it).
    overworld.drawWorld(ctx, k);
    bloom(ctx);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    overworld.drawHud(ctx, G.screen === 'overworld');
    if (G.flash > 0.01) {
      ctx.fillStyle = `rgba(${G.flashColor},${Math.min(0.8, G.flash)})`;
      ctx.fillRect(0, 0, view.W, view.H);
    }
    if (G.screen !== 'overworld' && G.screen !== 'gameover') {
      ctx.fillStyle = 'rgba(5,3,13,0.45)';
      ctx.fillRect(0, 0, view.W, view.H);
    }
    return;
  }
  // Finisher / node-start camera: zoom about a world point (screen = world * z + cam offset).
  const live = G.mode === 'run' && (G.screen === 'play' || G.screen === 'pause' || G.screen === 'pause-settings');
  const cam = live && !sv.active ? cine.camera() : null;
  if (sv.active && G.mode === 'run') {
    // Side / chase stage (stageview.js): the world renders in its own frame and is mapped onto the screen; the camera
    // is read inside that frame. Floating numbers are drawn upright afterwards.
    sv.render(ctx, k, renderWorld, () => (live ? cine.camera() : null));
    ctx.setTransform(k, 0, 0, k, view.ox, view.oy);
    drawTexts(ctx, (x, y, o) => sv.toScreen(x, y, o));
  } else if (cam && cam.rot) {
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
  if (G.screen === 'intro') bootIntro.draw(ctx, k);
  bloom(ctx, live ? 1 + 0.25 * cine.amount() + 0.3 * ((G.player && G.player.boostV) || 0) : 1);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (live) drawBoostFx(ctx);
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
  prewarmBossArt();
  applyAllPaints();
  initGear(); // legacy parts → items
  initPilotProfile(); // legacy saves: classes / abilities their rank had unlocked
  passiveTree.sanitizeTrees(); // drop unknown / unlinked / over-budget tree nodes from older or edited saves
  bg.init();
  setSfxVolume(profile.settings.sfx);
  initToasts();
  initHangarUi();
  initPilotUi();
  const past = achInit(); // achievements older saves already earned
  if (past) setTimeout(() => notifyBacklog(past), 1200);
  if (profile.seenIntro) toTitle();
  else playIntro();
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
  intro: () => playIntro(), // replay the boot intro (NEON.introState for its clock)
  introState: () => ({ active: bootIntro.active, t: bootIntro.t }),
  skipIntro: () => bootIntro.skip(),
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
    if (!opts.story) while (comms.blocking) comms.skipAll(); // the intro, then the route tip
  },
  cine,
  // Stage views (stageview.js): sv.mode, sv.enter('side' | 'chase' | 'top') switches the live fight now (debug).
  sv,
  stage: (mode) => (G.mode === 'run' && G.screen === 'play' ? (sv.enter(mode), sv.mode) : ''),
  sectorIntro,
  overworld, // overworld.state (G.run.ow), warp(nodeId | x, y), toggleMap()
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
    if (G.screen !== 'route' && G.screen !== 'overworld') return false;
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
  buyShip, selectShip,
  equip: (shipId, uid) => (uid ? equipPart(shipId, uid) : 'NO PART'),
  // Gear (parts.js / hangar.js / loot.js). rollGear(slot, 'standard'|'premium') spends credits → {item, salvaged} | {err}.
  rollGear, sellGear, sellJunk,
  gear: () => profile.gear,
  giveGear: (slot = 'core', r = 0, il = 1, base = null) => addGear(makeItem(slot, r, il, Math.random, base)).item,
  dropGear: (bonus = 0) => dropGear(G.player.x, G.player.y - 100, bonus),
  findClass, findPassive,
  dropAbility: (luck = 2) => dropAbility(G.player ? G.player.x : 0, 300, luck),
  rolls: () => draftRolls,
  openDraft: (kind = 'level') => openDraft(kind),
  // Menus (debug / screenshots): open the Hangar, Fabricator or Pilot screen over the campaign map.
  openHangar: () => (showCampaign(), openHangar()),
  openFab: () => (showCampaign(), openHangar(), openFab()),
  openPilot: () => (showCampaign(), openPilot()),
  unequip: unequipSlot,
  paint: setPaint,
  // Pilot (return '' on success, else a reason). Classes / passives are rank-gated: grant({rankXp}) first.
  setClass,
  setPassives,
  // Passive tree (game/tree.js): allocate / refund / resetTree(cls, id) return '' or a reason; openTree(cls) shows it.
  tree: { ...passiveTree, open: (cls) => openTree(cls, () => showPilot('#pl-tree')), view: treeView },
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
      for (let guard = 0; guard < 6 && (G.screen === 'route' || G.screen === 'overworld' || G.screen === 'event' || G.screen === 'market' || G.screen === 'dock'); guard++) {
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
