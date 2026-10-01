// Achievements: definitions plus a tracker that mostly polls G / profile once a frame (achTick),
// so gameplay code only needs two tiny hooks (achEvent 'kill' / 'heartFull').
// Unlocks persist in profile.ach {id: timestamp}; lifetime counters in profile.stats.

import { G } from './state.js';
import { profile, saveProfile } from '../core/storage.js';
import { rankFor, RANK_CAP } from './economy.js';
import { SHIPS, ownsShip } from './ships.js';
import { upgradeById } from './upgrades.js';
import { THEMES, SET_BONUS, setDone, onRelic, onSetComplete } from './collectables.js';

export const TIERS = {
  b: { name: 'BRONZE', color: '#e8a46a', reward: 20 },
  s: { name: 'SILVER', color: '#cfe3ff', reward: 60 },
  g: { name: 'GOLD', color: '#ffd24a', reward: 150 },
};

export const GROUPS = ['COMBAT', 'SKILL', 'CAREER', 'ODDITIES'];

// hidden: name and description stay ??? until unlocked; `hint` is shown instead.
export const ACHIEVEMENTS = [
  // COMBAT
  { id: 'first_blood', group: 'COMBAT', tier: 'b', name: 'First Blood', desc: 'Destroy your first enemy.' },
  { id: 'kills_1k', group: 'COMBAT', tier: 's', name: 'Thousand Cuts', desc: 'Destroy 1,000 enemies.' },
  { id: 'kills_10k', group: 'COMBAT', tier: 'g', name: 'Exterminator', desc: 'Destroy 10,000 enemies.' },
  { id: 'pest', group: 'COMBAT', tier: 'b', name: 'Pest Control', desc: 'Destroy 500 swarmers.' },
  { id: 'boss_1', group: 'COMBAT', tier: 'b', name: 'Giant Slayer', desc: 'Defeat a boss.' },
  { id: 'boss_10', group: 'COMBAT', tier: 's', name: 'Boss Rush', desc: 'Defeat 10 bosses.' },
  { id: 'clear_1', group: 'COMBAT', tier: 's', name: 'System Secured', desc: 'Extract from a star system.' },
  { id: 'clear_all', group: 'CAREER', tier: 'g', name: 'Overdrive', desc: 'Clear all four star systems.' },
  { id: 'endless_10', group: 'COMBAT', tier: 's', name: 'Deep Grid', desc: 'Reach sector 10 in the Endless Grid.' },
  { id: 'ult_1', group: 'COMBAT', tier: 'b', name: 'Unleashed', desc: 'Fire your ultimate.' },
  { id: 'evolve', group: 'COMBAT', tier: 's', name: 'Metamorphosis', desc: 'Evolve a weapon module.' },
  { id: 'rank_5', group: 'CAREER', tier: 'b', name: 'Promoted', desc: 'Reach Pilot Rank 5.' },
  { id: 'rank_max', group: 'CAREER', tier: 'g', name: 'Living Legend', desc: 'Reach the top Pilot Rank.' },
  // SKILL
  { id: 'combo_50', group: 'SKILL', tier: 'b', name: 'Chain Reaction', desc: 'Reach a 50 kill chain.' },
  { id: 'combo_200', group: 'SKILL', tier: 'g', name: 'Unbroken', desc: 'Reach a 200 kill chain.' },
  { id: 'untouched', group: 'SKILL', tier: 's', name: 'Untouchable', desc: 'Clear a sector without losing hull.' },
  { id: 'flawless', group: 'SKILL', tier: 'g', name: 'Flawless', desc: 'Extract from a system without losing hull.' },
  { id: 'glass', group: 'SKILL', tier: 's', name: 'Glass Cannon', desc: 'Defeat a boss on your last hull point.' },
  { id: 'comeback', group: 'SKILL', tier: 's', name: 'Comeback Kid', desc: 'Extract after dropping to 1 hull.' },
  { id: 'graze_250', group: 'SKILL', tier: 's', name: 'Bullet Whisperer', desc: 'Graze 250 bullets in one run.' },
  { id: 'level_15', group: 'SKILL', tier: 's', name: 'Overclocked', desc: 'Reach level 15 in one run.' },
  { id: 'dash_100', group: 'SKILL', tier: 'b', name: 'Dash Addict', desc: 'Dash 100 times in one run.' },
  { id: 'ult_10', group: 'SKILL', tier: 's', name: 'Unlimited Power', desc: 'Fire your ultimate 10 times in one run.' },
  { id: 'hoard', group: 'CAREER', tier: 's', name: 'Dragon Hoard', desc: 'Hold 1,000 credits in a run wallet.' },
  { id: 'tourist', group: 'SKILL', tier: 'b', name: 'Space Tourist', desc: 'Visit a Market, a Dock and an Anomaly in one run.' },
  // CAREER
  { id: 'relic_1', group: 'CAREER', tier: 'b', name: 'Finders Keepers', desc: 'Find a relic in the field.' },
  { id: 'relic_legend', group: 'CAREER', tier: 's', name: 'Lucky Star', desc: 'Find a legendary relic.' },
  { id: 'set_1', group: 'CAREER', tier: 's', name: 'Completionist', desc: 'Complete a relic set.' },
  { id: 'set_all', group: 'CAREER', tier: 'g', name: 'Curator', desc: 'Complete every relic set.' },
  { id: 'capsule', group: 'CAREER', tier: 'b', name: 'Gacha Brain', desc: 'Open a Data Capsule.' },
  { id: 'bigspend', group: 'CAREER', tier: 's', name: 'Big Spender', desc: 'Spend 400 credits at a single Black Market.' },
  { id: 'drip', group: 'CAREER', tier: 'b', name: 'Fresh Paint', desc: 'Buy a paint job.' },
  { id: 'fleet', group: 'CAREER', tier: 'g', name: 'Fleet Admiral', desc: 'Own every ship.' },
  // ODDITIES
  { id: 'rtfm', group: 'ODDITIES', tier: 'b', name: 'Read the Manual', desc: 'Open How to Play from the title screen.' },
  { id: 'indecisive', group: 'ODDITIES', tier: 'b', name: 'Indecisive', desc: 'Reroll an upgrade draft.' },
  { id: 'window', group: 'ODDITIES', tier: 'b', name: 'Window Shopper', desc: 'Leave a Black Market without buying anything.' },
  { id: 'fast_death', group: 'ODDITIES', tier: 'b', hidden: true, hint: 'Speed is not always a virtue.', name: 'That Was Quick', desc: 'Lose a run in under 20 seconds.' },
  { id: 'broke', group: 'ODDITIES', tier: 'b', hidden: true, hint: 'Empty pockets.', name: 'Nothing to Show', desc: 'Bank zero credits from a run.' },
  { id: 'ragequit', group: 'ODDITIES', tier: 'b', hidden: true, hint: 'Sometimes you just walk away.', name: 'Strategic Retreat', desc: 'Abandon a campaign run.' },
  { id: 'overheal', group: 'ODDITIES', tier: 'b', hidden: true, hint: 'Already fine, thanks.', name: 'Waste Not', desc: 'Grab a repair kit at full hull.' },
  { id: 'potty', group: 'ODDITIES', tier: 'b', hidden: true, hint: 'Nature calls.', name: 'Bathroom Break', desc: 'Pause 10 times in one run.' },
  { id: 'nightowl', group: 'ODDITIES', tier: 'b', hidden: true, hint: "Shouldn't you be asleep?", name: 'Night Shift', desc: 'Start a run between 2 and 5 AM.' },
  { id: 'tldr', group: 'ODDITIES', tier: 'b', hidden: true, hint: 'Too long.', name: 'TL;DR', desc: 'Turn off story dialogue.' },
  { id: 'silent', group: 'ODDITIES', tier: 'b', hidden: true, hint: 'Shhh.', name: 'Silent Running', desc: 'Turn the music all the way down.' },
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achById = (id) => byId.get(id);
export const hasAch = (id) => !!profile.ach[id];

// [current, goal] for counter achievements (shown as a bar while locked).
export function achProgress(id) {
  const kills = profile.kills;
  switch (id) {
    case 'kills_1k': return [kills, 1000];
    case 'kills_10k': return [kills, 10000];
    case 'pest': return [profile.stats.swarm || 0, 500];
    case 'boss_10': return [profile.bossKills, 10];
    case 'clear_all': return [profile.campaign.cleared.length, 4];
    case 'rank_max': return [rankFor(profile.rankXp).rank, RANK_CAP];
    case 'fleet': return [SHIPS.filter((s) => ownsShip(profile, s)).length, SHIPS.length];
    case 'set_all': return [THEMES.filter((t) => setDone(t.id)).length, THEMES.length];
    default: return null;
  }
}

const listeners = [];
// fn(achievement, reward) on every unlock (toasts).
export const onAchievement = (fn) => listeners.push(fn);

let R = null; // per-run tracker
let prevScreen = null;
let slowT = 0;
let quiet = false; // boot sweep: unlock without toasts

export function unlock(id) {
  const a = byId.get(id);
  if (!a || profile.ach[id]) return false;
  const reward = TIERS[a.tier].reward;
  profile.ach[id] = Date.now();
  profile.credits += reward;
  if (R) R.credits0 += reward; // not banked by the run
  saveProfile();
  if (!quiet) for (const fn of listeners) fn(a, reward);
  return true;
}

const at = (v, n, id) => v >= n && unlock(id);

// Gameplay hooks.
export function achEvent(name, data) {
  if (G.mode !== 'run') return;
  if (name === 'kill' && data.type === 'swarm') at((profile.stats.swarm = (profile.stats.swarm || 0) + 1), 500, 'pest');
  else if (name === 'heartFull') unlock('overheal');
}

function startRun(run) {
  const p = G.player;
  R = {
    run, ended: false, hp: p.hp, low: false, hits: 0, sectorHits: 0, dashT: 0, odT: 0, ults: 0, dashes: 0,
    ds: G.director.state, bossKills: G.bossKills, rerolls: G.rerolls, pauses: 0, visits: new Set(), mw: 0,
    credits0: profile.credits,
  };
  const h = new Date().getHours();
  if (h >= 2 && h < 5) unlock('nightowl');
}

function endRun(victory) {
  R.ended = true;
  if (G.runTime < 20 && !victory) unlock('fast_death');
  if (profile.credits - R.credits0 <= 0) unlock('broke');
  if (victory) {
    unlock('clear_1');
    if (R.hits === 0) unlock('flawless');
    if (R.low) unlock('comeback');
  }
}

function onScreen(s, prev) {
  if (s === 'help' && prev === 'title') unlock('rtfm');
  if (!R || R.ended) return;
  const w = R.run.wallet || 0;
  if (s === 'gameover') endRun(false);
  else if (s === 'extract') endRun(true);
  else if (s === 'pause' && prev === 'play') at(++R.pauses, 10, 'potty');
  else if (s === 'market') R.mw = w;
  if (prev === 'market' && s !== 'market') {
    const spent = R.mw - w;
    if (spent <= 0) unlock('window');
    if (spent >= 400) unlock('bigspend');
  }
  if (s === 'market' || s === 'dock' || s === 'event') {
    R.visits.add(s);
    if (R.visits.size >= 3) unlock('tourist');
  }
}

function runTick() {
  const p = G.player;
  const r = R.run;
  if (p.hp < R.hp) {
    R.hits++;
    R.sectorHits++;
  }
  R.hp = p.hp;
  if (p.hp === 1 && p.maxHp > 1 && !p.dead) R.low = true;
  if (p.dashT > 0 && R.dashT <= 0) at(++R.dashes, 100, 'dash_100');
  R.dashT = p.dashT;
  if (p.odT > 0 && R.odT <= 0) {
    unlock('ult_1');
    at(++R.ults, 10, 'ult_10');
  }
  R.odT = p.odT;
  const ds = G.director.state;
  if (ds !== R.ds) {
    if (ds === 'intro') R.sectorHits = 0;
    if (ds === 'clear' && R.sectorHits === 0 && !p.dead) unlock('untouched');
    R.ds = ds;
  }
  if (G.bossKills > R.bossKills && p.hp === 1 && p.maxHp > 1) unlock('glass');
  R.bossKills = G.bossKills;
  if (G.rerolls < R.rerolls && G.screen === 'draft') unlock('indecisive');
  R.rerolls = G.rerolls;
  const kills = profile.kills + G.kills;
  at(kills, 1, 'first_blood');
  at(kills, 1000, 'kills_1k');
  at(kills, 10000, 'kills_10k');
  at(profile.bossKills + G.bossKills, 1, 'boss_1');
  at(profile.bossKills + G.bossKills, 10, 'boss_10');
  at(G.maxCombo, 50, 'combo_50');
  at(G.maxCombo, 200, 'combo_200');
  at(G.grazes, 250, 'graze_250');
  at(p.level, 15, 'level_15');
  at(r.wallet || 0, 1000, 'hoard');
  if (r.mode === 'endless') at(G.sector, 10, 'endless_10');
  if (!hasAch('evolve') && Object.keys(p.up).some((id) => upgradeById(id)?.cat === 'evolution')) unlock('evolve');
}

// Profile-wide checks: cheap, but no need to run them every frame.
function profileTick() {
  const c = profile.campaign.cleared.length;
  at(c, 1, 'clear_1');
  at(c, 4, 'clear_all');
  at(profile.kills, 1, 'first_blood');
  at(profile.kills, 1000, 'kills_1k');
  at(profile.kills, 10000, 'kills_10k');
  at(profile.bossKills, 1, 'boss_1');
  at(profile.bossKills, 10, 'boss_10');
  at(profile.bestCombo, 50, 'combo_50');
  at(profile.bestCombo, 200, 'combo_200');
  at(profile.bestSector, 10, 'endless_10');
  const rank = rankFor(profile.rankXp).rank;
  at(rank, 5, 'rank_5');
  at(rank, RANK_CAP, 'rank_max');
  if (SHIPS.every((s) => ownsShip(profile, s))) unlock('fleet');
  if (Object.values(profile.paintsOwned).some((a) => a.some((i) => i > 0))) unlock('drip');
  at(profile.stats.capsules || 0, 1, 'capsule');
  if (profile.settings.story === false) unlock('tldr');
  if (profile.settings.music <= 0.001) unlock('silent');
}

// Boot: grant what older saves already earned, silently. Returns how many were granted.
export function achInit() {
  onRelic((relic, source) => {
    if (source === 'field') {
      unlock('relic_1');
      if (relic.rarity === 'legendary') unlock('relic_legend');
    }
  });
  onSetComplete((theme) => {
    if (R) R.credits0 += SET_BONUS; // paid straight to the profile, not banked by the run
    unlock('set_1');
    if (THEMES.every((t) => setDone(t.id))) unlock('set_all');
  });

  const before = Object.keys(profile.ach).length;
  quiet = true;
  profileTick();
  quiet = false;
  prevScreen = G.screen;
  return Object.keys(profile.ach).length - before;
}

// Once per frame from main.js.
export function achTick(dt) {
  const run = G.mode === 'run' ? G.run : null;
  if (R && R.run !== run) {
    if (!R.ended && R.run.mode === 'campaign') unlock('ragequit');
    R = null;
  }
  if (run && !R && G.player) startRun(run);
  if (G.screen !== prevScreen) {
    onScreen(G.screen, prevScreen);
    prevScreen = G.screen;
  }
  if (R && !R.ended && G.player) runTick();
  if ((slowT -= dt) <= 0) {
    slowT = 0.5;
    profileTick();
  }
}
