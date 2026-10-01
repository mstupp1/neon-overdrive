// Credits (run wallet + profile bank), Pilot Rank and the Black Market.
// Wallet: G.run.wallet is spendable mid-run; G.run.earned is the run total. Multipliers hook into
// gainCredits: diff.credits (modifiers), p.st.creditMul (later steps), endless ×0.5.

import { G } from './state.js';
import { profile, saveProfile } from '../core/storage.js';
import { chance } from '../core/math.js';
import { floatText } from './fx.js';
import { dropCredit } from './pickups.js';
import { ICONS, upgradeById, rollUpgradeIds, applyUpgrade, cardInfo, recomputeStats } from './upgrades.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ECON_ICONS = {
  reroll: svg('<path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/>'),
  contraband: svg('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>'),
  reinforce: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v7M8.5 11.5h7"/>'),
  repairFull: svg('<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/><path d="M12 9v5M9.5 11.5h5"/>'),
};

// --- Wallet ------------------------------------------------------------------------

const wallet = () => (G.run ? G.run.wallet || 0 : 0);
export const getWallet = wallet;

// Adds credits to the run wallet after multipliers. Returns the amount actually gained (0 in attract).
export function gainCredits(amount, at) {
  const r = G.run;
  if (!r || G.mode !== 'run' || !(amount > 0)) return 0;
  const p = G.player;
  let mul = (G.director && G.director.diff.credits) || 1;
  mul *= (p && p.st && p.st.creditMul) || 1;
  if (r.mode === 'endless') mul *= 0.5;
  const exact = amount * mul + (r.frac || 0);
  const gain = Math.floor(exact);
  r.frac = exact - gain;
  r.wallet = (r.wallet || 0) + gain;
  r.earned = (r.earned || 0) + gain;
  r.flash = G.realTime;
  if (at && gain > 0) {
    // Batch the little gold labels so chip streams do not spam the screen.
    r.pendText = (r.pendText || 0) + gain;
    if (G.realTime - (r.textT || -9) > 0.9) {
      floatText(at.x, at.y - 26, `+${r.pendText}`, '#ffd24a', 11, 0.9);
      r.pendText = 0;
      r.textT = G.realTime;
    }
  }
  return gain;
}

export function spendCredits(n) {
  if (!G.run || wallet() < n) return false;
  G.run.wallet -= n;
  return true;
}

// Credit value scale for the current sector (campaign level, endless local level + loops).
function unit() {
  const sp = G.director && G.director.spec;
  const lvl = sp ? sp.level + sp.loop * 9 : 1;
  return Math.max(0.8, 0.95 * lvl - 0.1);
}

// Called from killEnemy: small chance of a chip from normal kills, a guaranteed haul from elites.
export function dropKillCredits(e) {
  if (!G.run || G.mode !== 'run') return;
  const u = unit();
  if (e.elite) {
    const n = 3 * (G.director.diff.eliteCredits || 1);
    for (let i = 0; i < n; i++) dropCredit(e.x, e.y, u * 0.9);
  } else {
    const c = e.type === 'swarm' || e.type === 'mine' ? 0.025 : e.r > 20 ? 0.3 : 0.1;
    if (chance(c)) dropCredit(e.x, e.y, u * (e.r > 20 ? 1.4 : 0.7));
  }
}

// Paid out when a sector is cleared (direct to wallet). Returns the amount gained.
export function sectorPayout() {
  return gainCredits(Math.round(unit() * 4.5));
}

export function bossPayout(e) {
  return gainCredits(Math.round(unit() * 14), e);
}

// --- Pilot Rank ----------------------------------------------------------------------

export const RANK_CAP = 15;
// XP needed to go from rank r to r+1.
const need = (r) => 200 + 100 * r;
export const RANKS = [0]; // RANKS[r-1] = cumulative XP to reach rank r
for (let r = 1; r < RANK_CAP; r++) RANKS.push(RANKS[r - 1] + need(r));

// → { rank, into (xp into this rank), need (xp span of this rank; 0 at cap) }
export function rankFor(xp) {
  let rank = 1;
  while (rank < RANK_CAP && xp >= RANKS[rank]) rank++;
  if (rank >= RANK_CAP) return { rank, into: 0, need: 0 };
  return { rank, into: xp - RANKS[rank - 1], need: RANKS[rank] - RANKS[rank - 1] };
}

// Rank XP for a finished run.
export function runRankXp(score, sectors, bosses, victory) {
  return Math.round(Math.sqrt(Math.max(0, score)) * 0.25 + sectors * 40 + bosses * 120 + (victory ? 250 : 0));
}

// Folds the run's wallet + rank XP into the profile. Returns the reward summary for results screens.
export function settleRun(victory) {
  const r = G.run;
  const mode = r.mode;
  const w = r.wallet || 0;
  const pct = mode === 'campaign' && !victory ? 0.5 : 1;
  const banked = Math.floor(w * pct);
  // Cleared sectors: campaign counts fought sectors (the fatal one excluded); endless counts passed sectors.
  const cleared = Math.max(0, mode === 'campaign' ? (victory ? r.sectors : r.sectors - 1) : G.sector - 1);
  const gainXp = runRankXp(G.score, cleared, G.bossKills, victory);
  const before = rankFor(profile.rankXp);
  profile.credits += banked;
  profile.rankXp += gainXp;
  const after = rankFor(profile.rankXp);
  saveProfile();
  return {
    earned: r.earned || 0, spent: (r.earned || 0) - w, wallet: w, pct, banked, total: profile.credits,
    rankXp: gainXp, rankBefore: before, rankAfter: after, rankUp: after.rank > before.rank, victory,
  };
}

// --- Black Market ----------------------------------------------------------------------

const act = (system) => (system && system.act) || 1;
const price = (base, system) => Math.round((base * (1 + 0.5 * (act(system) - 1))) / 5) * 5;

// Offer: { id, kind: 'upgrade'|'repair'|'reroll'|'contraband', name, desc, icon, cat, tag, price, up?, amount?, sold, note? }
// kinds are applied by buyOffer(). Prices: ~40-230 in system 1, ×(1+0.5*(act-1)).
export function rollMarket(p, system, rng = Math.random) {
  const offers = [];
  for (const id of rollUpgradeIds(p, 'sector', 2, rng)) {
    const info = cardInfo(p, id);
    offers.push({
      id: 'up-' + id, kind: 'upgrade', up: id, name: info.name, desc: info.desc, icon: info.icon, cat: info.cat,
      tag: info.lv === 0 ? 'NEW' : `LV ${info.lv + 1}`, price: price(50 + 30 * info.lv, system), sold: false,
    });
  }
  const missing = p.maxHp - p.hp;
  const full = missing >= 2;
  offers.push({
    id: 'repair', kind: 'repair', amount: full ? missing : 1, name: full ? 'Full Repair' : 'Field Repair', cat: 'defense',
    desc: full ? `Restore all ${missing} missing hull.` : 'Repair 1 hull.', icon: full ? ECON_ICONS.repairFull : ICONS.repair, tag: 'REPAIR',
    price: price(full ? 45 + 25 * (missing - 1) : 45, system), sold: false, blocked: missing <= 0 ? 'HULL FULL' : '',
  });
  offers.push({
    id: 'reroll', kind: 'reroll', name: 'Reroll Token', cat: 'stat', desc: '+1 reroll for upgrade drafts.', icon: ECON_ICONS.reroll,
    tag: 'UTILITY', price: price(45, system), sold: false,
  });
  // Contraband: two random upgrade levels, with a drawback (−1 max hull; at ≤2 hull, the next fight is OVERCLOCKED).
  const hullDrawback = p.maxHp >= 3;
  offers.push({
    id: 'contraband', kind: 'contraband', name: 'Contraband', cat: 'module',
    desc: `+2 random upgrade levels. ${hullDrawback ? '−1 max hull.' : 'Next fight is OVERCLOCKED.'}`, icon: ECON_ICONS.contraband,
    tag: 'RISKY', price: price(110, system), hullDrawback, sold: false,
  });
  return offers;
}

// Returns '' on success or a reason string. Mutates player/wallet; marks the offer sold.
export function buyOffer(offer, p = G.player) {
  if (offer.sold) return 'SOLD';
  if (offer.blocked) return offer.blocked;
  if (wallet() < offer.price) return 'NEED CREDITS';
  if (offer.kind === 'upgrade') {
    if ((p.up[offer.up] || 0) >= upgradeById(offer.up).max) return 'MAXED';
    applyUpgrade(p, offer.up, G);
  } else if (offer.kind === 'repair') {
    p.hp = Math.min(p.maxHp, p.hp + offer.amount);
  } else if (offer.kind === 'reroll') {
    G.rerolls++;
  } else if (offer.kind === 'contraband') {
    for (const id of rollUpgradeIds(p, 'sector', 2)) applyUpgrade(p, id, G);
    if (offer.hullDrawback) {
      p.hullMod = (p.hullMod || 0) - 1;
      recomputeStats(p);
      p.hp = Math.min(p.hp, p.maxHp);
    } else G.run.curse = 'overclocked';
  }
  spendCredits(offer.price);
  offer.sold = true;
  return '';
}

// Dock choices (used by the dock screen and simulate).
export function dockRepair(p = G.player) {
  p.hp = p.maxHp;
}
export function dockReinforce(p = G.player) {
  p.hullMod = (p.hullMod || 0) + 1;
  recomputeStats(p);
}
