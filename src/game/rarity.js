// Diablo-style rarity shared by equipment (parts.js) and level-up cards (upgrades.js).
// Luck shifts the odds toward the rarer tiers: +1 per campaign system, +0.45 per Overdrive tier, +1 per Deep Grid cycle,
// plus Rarity Find from gear (luckFor). `floor` is the lowest rarity a roll may land on (premium rolls, boss drops).

// At luck 0 (Genesis, tier 0) a card is Rare or better 5% of the time; the rarer tiers grow faster with luck, so they
// arrive with later systems, higher Overdrive tiers and the Deep Grid rather than in the first fights.
export const RARITY = [
  { id: 'common', name: 'COMMON', color: '#d9dee8', weight: 72, grow: 0.9 },
  { id: 'uncommon', name: 'UNCOMMON', color: '#5dff6a', weight: 23, grow: 1.07 },
  { id: 'rare', name: 'RARE', color: '#4d9dff', weight: 4.2, grow: 1.26 },
  { id: 'epic', name: 'EPIC', color: '#c45bff', weight: 0.7, grow: 1.45 },
  { id: 'legendary', name: 'LEGENDARY', color: '#ff9a1f', weight: 0.1, grow: 1.62 },
];
export const LEGENDARY = 4;

// find: Rarity Find stat (fraction, from gear affixes / legendaries / ship traits).
export const luckFor = ({ sys = 0, tier = 0, deep = 0, find = 0 } = {}) => Math.max(0, sys + 0.45 * tier + deep + 3 * find);

// Probability of each rarity (array of 5, sums to 1).
export function rarityOdds(luck = 0, floor = 0) {
  const w = RARITY.map((r, i) => (i < floor ? 0 : r.weight * Math.pow(r.grow, luck)));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

export function rollRarity(luck = 0, rng = Math.random, floor = 0) {
  const odds = rarityOdds(luck, floor);
  let x = rng();
  for (let i = 0; i < odds.length; i++) if ((x -= odds[i]) <= 0) return i;
  return odds.length - 1;
}

export const rarityColor = (r) => RARITY[r].color;
