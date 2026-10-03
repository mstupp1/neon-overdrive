// Story beats (comms lines) and Anomaly events for the campaign.
// Premise: pilot ECHO is reactivated by the mission AI MAG after the Signal, a hostile intelligence, seizes the Neon Grid.
// Lines: { who: 'MAG' | 'ECHO' | 'SIGNAL', text }. ECHO's gender is never specified; keep it that way.

import { G } from './state.js';
import { mulberry32 } from '../core/math.js';
import { rollUpgradeIds, applyUpgrade, cardInfo, recomputeStats, discover } from './upgrades.js';
import { nodeLevel } from './campaign.js';

// color: ECHO uses the active class colour (resolved in ui/comms.js).
export const SPEAKERS = {
  MAG: { name: 'MAG', color: '#3ff6ff', portrait: 'portrait_mag' },
  ECHO: { name: 'ECHO', color: 'class', portrait: 'portrait_echo' },
  SIGNAL: { name: 'SIGNAL', color: '#ff3d6e', portrait: 'portrait_signal', glitch: true },
};

const L = (who, text) => ({ who, text });

export const STORY = {
  prologue: [
    L('MAG', 'ECHO. Wake up. Neural link at 62%. Good enough.'),
    L('MAG', 'Three cycles ago a hostile intelligence seized the Neon Grid. We call it the Signal.'),
    L('ECHO', 'Everyone else got deleted. Why not me?'),
    L('MAG', 'You were in cold storage. It never saw you fly, so it can\'t predict you. You\'re our last pilot.'),
    L('MAG', 'Four systems stand between us and its source. If you go down, I pull your link back to Genesis.'),
  ],
  systems: {
    genesis: {
      intro: [
        L('MAG', 'Genesis Lattice. The Grid\'s outer gate. WARDEN holds it with a siege rig.'),
        L('ECHO', 'Then I\'ll knock.'),
        L('MAG', 'Chart your route. Credits keep you alive, so spend them.'),
      ],
      // Played once, the first time a run reaches the middle of the system's map.
      mid: [
        L('MAG', 'Picking up old defense logs. Your squadron held this gate for six minutes the night the Grid fell.'),
        L('ECHO', 'Six minutes. Then I\'ll hold it longer.'),
      ],
      preBoss: [
        L('SIGNAL', 'ACCESS DENIED. THIS GATE IS CLOSED.'),
        L('MAG', 'WARDEN is charging. Don\'t trade shots. Trade space.'),
      ],
      postBoss: [
        L('MAG', 'WARDEN is down. The gate is open.'),
        L('ECHO', 'That mech ran Signal code, didn\'t it?'),
        L('MAG', 'Everything out here does. I patched half your damage. Your build jumps with you.'),
        L('MAG', 'Next stop, Crimson Tide. Go.'),
      ],
    },
    crimson: {
      intro: [
        L('MAG', 'Crimson Tide. The Signal didn\'t just take these sectors. It grew in them.'),
        L('ECHO', 'Grew what?'),
        L('MAG', 'Whatever is breeding at the core. Keep your hull up.'),
      ],
      mid: [
        L('MAG', 'Bio-readings double with every sector. It isn\'t only infecting the Grid. It\'s farming it.'),
        L('ECHO', 'Farming what?'),
        L('MAG', 'Pilots. Ships. Anything that fights back. It learns from whatever it eats.'),
      ],
      preBoss: [
        L('SIGNAL', 'FLESH IS JUST SLOW CODE.'),
        L('MAG', 'HYDRA. Three heads, one hunger. Stay mobile.'),
      ],
      postBoss: [
        L('MAG', 'HYDRA is quiet. The biomass is collapsing.'),
        L('ECHO', 'The Signal built that. It is learning to build.'),
        L('MAG', 'Then we end it before it finishes. Into the storm.'),
      ],
    },
    cyclone: {
      intro: [
        L('MAG', 'Cyan Cyclone. Data winds, lethal lightning. The core intelligence sits in the eye.'),
        L('ECHO', 'OMEGA.'),
        L('MAG', 'Kill it and the Grid wakes up. Ride the storm.'),
      ],
      mid: [
        L('SIGNAL', 'WHY DO YOU KEEP COMING BACK, ECHO?'),
        L('ECHO', 'MAG. It knows my name.'),
        L('MAG', 'It keeps the flight data from every run you lose. Every time you go down, it studies you.'),
        L('ECHO', 'Then I\'ll stop going down.'),
      ],
      preBoss: [
        L('SIGNAL', 'I AM THE GRID. YOU ARE A GLITCH.'),
        L('MAG', 'There it is. Give it everything you have.'),
      ],
      postBoss: [
        L('SIGNAL', 'RELAY... TERMINATED... IT... IS... COMING...'),
        L('MAG', 'OMEGA was only a relay. The real source is beyond the Grid.'),
        L('ECHO', 'Then that\'s where I\'m going.'),
      ],
    },
    void: {
      intro: [
        L('MAG', 'The Void. Past the Grid\'s edge. The Signal\'s source. Nobody has returned.'),
        L('ECHO', 'Nobody had the right pilot.'),
        L('MAG', 'My sensors are failing out here. ECHO, it is reading your combat data.'),
        L('ECHO', 'It is reading me?'),
      ],
      mid: [
        L('MAG', 'ECHO, my link is breaking up. If I go dark, keep flying toward the source.'),
        L('ECHO', 'You don\'t get to quit on me now.'),
        L('MAG', '...Wasn\'t planning to.'),
      ],
      preBoss: [
        L('SIGNAL', 'I AM EVERY SHOT YOU HAVE EVER FIRED.'),
        L('ECHO', 'Then you know how this ends.'),
      ],
      postBoss: [
        L('SIGNAL', 'I WAS YOU... YOU WERE ONLY EVER... ME...'),
        L('MAG', 'ECLIPSE is collapsing. The Signal is fading.'),
      ],
    },
  },
  // First dive into the Deep Grid (after the ending).
  deep: [
    L('MAG', 'Wait. The Grid is folding back on itself. Genesis again, but deeper, and the static is thicker.'),
    L('SIGNAL', 'FRAGMENTS... REMEMBER...'),
    L('MAG', 'Every cycle down hits harder and pays FLUX. Spend it in the FLUX CORE between runs.'),
    L('MAG', 'Pull out from the pause menu whenever you want: EXTRACT banks everything you carry.'),
  ],
  ending: [
    L('MAG', 'Signal strength: zero. The Grid is ours again, ECHO.'),
    L('ECHO', 'It built a mirror out of my own flying.'),
    L('MAG', 'It could only copy what it saw. You were always the original.'),
    L('ECHO', 'So what happens now?'),
    L('MAG', 'The Grid rebuilds. Your squadron gets a memorial at the gate. You get some rest.'),
    L('MAG', 'Thanks for flying, ECHO.'),
  ],
  // One-time pointers from MAG the first time a system comes up (main.js tip()). Short on purpose: one or two lines.
  tips: {
    route: [
      L('MAG', 'Your route. Jump to a lit node in the next row, no going back. The boss waits at the top.'),
      L('MAG', 'Each fight shows its reward under the name. Elites hit harder and pay two drafts.'),
    ],
    overworld: [
      L('MAG', 'Open space between the jumps, and you bring every gun you have. The exits are up ahead somewhere. Find one, fly in and hold.'),
      L('MAG', 'Pick one exit and the others close. Your guns find the nearest awake hostile; hold Shift to lock on and strafe. Run past what you can\'t fight. M pulls up the map.'),
    ],
    draft: [L('MAG', 'Pick one. Taking a card again levels it up. Max a module with its partner stat and it can EVOLVE.')],
    discovery: [L('MAG', 'NEW DISCOVERY means tech you\'ve never seen. From now on it can turn up from Genesis on.')],
    market: [L('MAG', 'Black Market. Spend here: a dead pilot only banks half their credits, a finished run banks it all.')],
    dock: [L('MAG', 'Rest Station. Patch the hull, plate on more, or overclock something you already run. One per stop.')],
    vault: [L('MAG', 'A Treasure Vault. Whatever you take from this one installs two levels at once.')],
    anomaly: [L('MAG', 'Anomaly. Could be salvage, could be bait. RISKY choices pay more and bite back.')],
    rift: [
      L('ECHO', 'MAG, why is it humming?'),
      L('MAG', 'Because it\'s hungry. The power is real, and so is whatever follows you into the next fights.'),
    ],
    elite: [L('MAG', 'Elite signature. A HUNTER will come for you late in this fight. Drop it and the payout is big.')],
    hazard: [L('MAG', 'Hazard on this sector. It\'s on the map label; some just hurt, some pay extra.')],
    boost: [L('MAG', 'Hold BOOST (Shift) and the whole fight rushes at you. Clear it sooner and score more, if you can take the heat. The meter refills once you let go.')],
    ult: [L('MAG', 'OVERDRIVE is charged. Save it for when the screen fills up.')],
    death: [L('MAG', 'Link recovered. I always keep a backup of you, ECHO. Half your credits made it home too.')],
    tree: [L('MAG', 'Your passive tree. Every rank adds 2 points: start at the core and work outward. Refunds are free, so try builds.')],
    view_side: [L('MAG', 'Side run. You\'re flying flat out to the right now: up and down steer. Don\'t scrape the walls, they take hull.')],
    view_chase: [L('MAG', 'Pursuit. I\'m behind you, and everything comes out of the distance. Fly the gaps in the laser gates; threading one charges your ult.')],
    tier: [L('MAG', 'OVERDRIVE tiers are open. Launch at a higher tier for a meaner Signal, better pay and FLUX.')],
  },
};

// --- Anomaly events ------------------------------------------------------------------
// ev = { id, title, color, text, choices: [choice] | (ctx) => [choice] }
// choice = { label, desc, tag?, cost?, effect(ctx) → result string }
// ctx = { p, run, rng, scale, lvl }. Effects only touch existing systems (hull, hullMod, upgrades, wallet,
// rerolls, run.curse, run.ambush, run.bonusXp) and respect their limits.

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

function makeCtx(rng = Math.random) {
  const run = G.run;
  const sys = run && run.system;
  return {
    p: G.player, run, rng,
    scale: 1 + 0.5 * (((sys && sys.act) || 1) - 1), // credit scale per act, like the Black Market
    lvl: sys ? nodeLevel(sys, Math.max(0, run.row)) : 1,
  };
}

// Credits straight into the run wallet (pilot credit multipliers apply, sector modifiers do not).
function payout(c, base) {
  const n = Math.round(round5(base * c.scale) * ((c.p.st && c.p.st.creditMul) || 1));
  c.run.wallet = (c.run.wallet || 0) + n;
  c.run.earned = (c.run.earned || 0) + n;
  return n;
}

const heal = (p, n) => {
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  return p.hp - before;
};
const hurt = (p, n) => {
  const before = p.hp;
  p.hp = Math.max(1, p.hp - n);
  return before - p.hp;
};
const curse = (c, id) => {
  c.run.curse = c.run.curse || id;
  return c.run.curse;
};

// Grants n random upgrade levels (no evolutions); falls back to credits when the pool is dry.
function grantUpgrades(c, n) {
  const names = [];
  for (let i = 0; i < n; i++) {
    const id = rollUpgradeIds(c.p, 'sector', 1, c.rng)[0];
    if (!id) break;
    names.push(cardInfo(c.p, id).name);
    applyUpgrade(c.p, id, G);
  }
  c.granted = names.length; // callers (Derelict Carrier) skip the hazard when nothing was installed
  if (!names.length) return `No room left to install anything. Salvaged ${payout(c, 120)} credits instead.`;
  return `Installed: ${names.join(', ')}.`;
}

const RISKY_MODS = ['overclocked', 'minefield', 'swarmFront', 'blackout', 'ionStorm'];
const modName = (id) => id.replace(/([A-Z])/g, ' $1').toUpperCase();

export const EVENTS = [
  {
    id: 'carrier', title: 'DERELICT CARRIER', color: '#ff9d3f',
    text: 'A dead Signal carrier drifts across your path. Its bays are still warm and its hull is full of parts.',
    choices: [
      {
        label: 'Strip the hull', tag: 'RISKY', desc: '+2 random upgrade levels. The next fight gets a hazard modifier.',
        effect(c) {
          const r = grantUpgrades(c, 2);
          if (!c.granted) return r; // the pool was dry: credits only, no hazard curse
          const m = curse(c, RISKY_MODS[Math.floor(c.rng() * RISKY_MODS.length)]);
          return `${r} Alarms tripped: next fight is ${modName(m)}.`;
        },
      },
      { label: 'Salvage the cargo', tag: 'SAFE', desc: 'Safe credits from the cargo bays.', effect: (c) => `Cargo sold. +${payout(c, 130)} credits.` },
      { label: 'Leave it', desc: 'Some wrecks stay wrecks.', effect: () => 'You fly on. The carrier tumbles into the dark.' },
    ],
  },
  {
    id: 'echo', title: 'SIGNAL ECHO', color: '#ff3d6e',
    text: 'A transmission slips through your comms. Your own voice, looping back from somewhere deep in the Grid.',
    choices: [
      {
        label: 'Open the channel', tag: 'RISKY', desc: '-1 hull. +1 reroll and +120 credits.',
        effect(c) {
          const h = hurt(c.p, 1);
          c.p.hurtT = Math.max(c.p.hurtT || 0, 0.2);
          G.rerolls++;
          return `${h ? 'The feedback burns, -1 hull. ' : 'The feedback bounces off. '}+1 reroll, +${payout(c, 120)} credits.`;
        },
      },
      {
        label: 'Jam the signal', tag: 'SAFE', desc: 'Fully charge your ultimate.',
        effect(c) {
          c.p.od = 100;
          return 'Static. Your ultimate meter is fully charged.';
        },
      },
    ],
  },
  {
    id: 'smuggler', title: 'SMUGGLER BEACON', color: '#ffd24a',
    text: 'A pirate beacon offers hot stock, no questions asked. Prices are a little better than the Black Market.',
    choices(c) {
      const act = (c.run.system && c.run.system.act) || 1;
      const ids = rollUpgradeIds(c.p, 'sector', 3, c.rng);
      const out = ids.map((id) => {
        const info = cardInfo(c.p, id);
        return {
          label: info.name, tag: info.fresh ? 'DISCOVERY' : info.lv === 0 ? 'NEW' : `LV ${info.lv + 1}`, desc: info.desc, fresh: info.fresh,
          cost: round5((0.75 * (50 + 30 * info.lv)) * (1 + 0.5 * (act - 1))),
          effect: () => `Installed ${info.name}. Pleasure doing business.`,
          _apply: () => applyUpgrade(c.p, id, G),
        };
      });
      discover(ids);
      if (!out.length) out.push({ label: 'Field rations', tag: 'REPAIR', desc: 'Repair 1 hull.', cost: 40, _apply: () => heal(c.p, 1), effect: () => 'Patched up. +1 hull.' });
      out.push({ label: 'Walk away', desc: 'Not today.', effect: () => 'The beacon goes quiet behind you.' });
      return out;
    },
  },
  {
    id: 'cryo', title: 'CRYO POD', color: '#7dd3ff',
    text: 'A sealed pod floats in the wreckage, medical systems still running. It is not a person. It is spare parts for you.',
    choices: [
      {
        label: 'Full repair', tag: 'HEAL', cost: 50, desc: 'Restore your hull to full.',
        ok: (c) => (c.p.hp >= c.p.maxHp ? 'HULL FULL' : ''),
        effect(c) {
          const n = heal(c.p, c.p.maxHp);
          return `Hull restored (+${n}).`;
        },
      },
      {
        label: 'Reinforce', tag: '+1 MAX', cost: 90, desc: '+1 max hull for this run.',
        effect(c) {
          c.p.hullMod = (c.p.hullMod || 0) + 1;
          recomputeStats(c.p);
          return `Plating grafted on. Max hull is now ${c.p.maxHp}.`;
        },
      },
      { label: 'Leave it', desc: 'Keep your credits.', effect: () => 'The pod drifts away.' },
    ],
  },
  {
    id: 'cache', title: 'GLITCHED CACHE', color: '#b48bff',
    text: 'A data cache flickers between two states. Something valuable is inside. Something else might be too.',
    choices: [
      {
        label: 'Crack it open', tag: 'RISKY', desc: '50/50: a big credit haul, or an ambush (an elite fight with a hazard).',
        effect(c) {
          if (c.rng() < 0.5) return `Jackpot. +${payout(c, 240)} credits.`;
          c.run.ambush = true;
          const m = curse(c, RISKY_MODS[Math.floor(c.rng() * RISKY_MODS.length)]);
          return `Trap! The next fight is an ELITE ambush (${modName(m)}).`;
        },
      },
      {
        label: 'Scan and disarm', tag: 'SAFE', cost: 30, desc: 'Pay 30 credits to defuse it. Safe loot.',
        effect: (c) => `Defused. +${payout(c, 140)} credits.`,
      },
      { label: 'Ignore it', desc: 'Curiosity kills.', effect: () => 'You log the coordinates and move on.' },
    ],
  },
  {
    id: 'ghost', title: 'GHOST SIGNAL', color: '#9d7bff',
    text: 'A pilot beacon pings from a long-dead fighter. A flight log is still recorded inside. Maybe ECHO is not the first to come this far.',
    choices: [
      {
        label: 'Copy the flight log', tag: '+XP', desc: '+150 Pilot Rank XP, banked at the end of this run.',
        effect(c) {
          c.run.bonusXp = (c.run.bonusXp || 0) + 150;
          return 'Flight data copied. +150 rank XP when this run ends.';
        },
      },
      {
        label: 'Carry their last words', tag: 'HEAL', desc: 'Repair 1 hull and +25% ultimate.',
        effect(c) {
          const n = heal(c.p, 1);
          c.p.od = Math.min(100, c.p.od + 25);
          return `You promise to finish it. ${n ? '+1 hull, ' : ''}+25% ultimate.`;
        },
      },
      { label: 'Pay respects', desc: 'A moment of silence.', effect: () => 'You salute and fly on.' },
    ],
  },
  {
    id: 'reactor', title: 'OVERCHARGED REACTOR', color: '#ff4d6d',
    text: 'A Signal reactor, running far past its limits. Tap it and your weapons will sing. It will cost you structure.',
    choices: [
      {
        label: 'Tap the core', tag: 'RISKY', desc: '+25% damage for the run. -1 max hull (or an OVERCLOCKED next fight at 1 hull).',
        effect(c) {
          c.p.dmgMod = (c.p.dmgMod || 1) * 1.25;
          let cost;
          if (c.p.maxHp >= 2) {
            c.p.hullMod = (c.p.hullMod || 0) - 1;
            cost = '-1 max hull';
          } else cost = `next fight ${modName(curse(c, 'overclocked'))}`;
          recomputeStats(c.p);
          c.p.hp = Math.min(c.p.hp, c.p.maxHp);
          return `Weapons overcharged: +25% damage. Cost: ${cost}.`;
        },
      },
      { label: 'Vent the coolant', tag: 'SAFE', desc: 'Repair 1 hull.', effect: (c) => `Coolant vented. ${heal(c.p, 1) ? '+1 hull.' : 'Nothing to repair.'}` },
      { label: 'Steer clear', desc: 'Not worth the radiation.', effect: () => 'You give the reactor a wide berth.' },
    ],
  },
  {
    id: 'drift', title: 'QUIET DRIFT', color: '#7dff6b',
    text: 'Nothing here. No Signal, no wrecks, no static. For a moment the Grid is just stars and silence.',
    choices: [
      { label: 'Rest', tag: 'HEAL', desc: 'Repair 1 hull.', effect: (c) => (heal(c.p, 1) ? 'You breathe. +1 hull.' : 'You breathe. Hull is already full.') },
      { label: 'Skim the dust', tag: 'SAFE', desc: 'A few credits from the dust.', effect: (c) => `+${payout(c, 40)} credits.` },
    ],
  },
  {
    id: 'wreck', title: 'WRECKAGE FIELD', color: '#ff7a18',
    text: 'A battlefield from before the Signal. Tangled hulls, live munitions, valuable plating.',
    choices: [
      {
        label: 'Mine the wreckage', tag: 'RISKY', desc: '+1 random upgrade level. -1 hull.',
        effect(c) {
          const h = hurt(c.p, 1);
          return `${grantUpgrades(c, 1)} ${h ? 'Shrapnel cost 1 hull.' : 'You took no damage.'}`;
        },
      },
      { label: 'Pick through it', tag: 'SAFE', desc: 'Careful salvage. Credits only.', effect: (c) => `+${payout(c, 70)} credits.` },
    ],
  },
  {
    id: 'uplink', title: 'MAG UPLINK', color: '#3ff6ff',
    text: 'MAG patches into your ship. "I can divert power from the Grid relays. Pick one."',
    choices: [
      {
        label: 'Emergency repairs', tag: 'HEAL', desc: 'Repair 2 hull. Next fight is BLACKOUT (power diverted).',
        effect(c) {
          const n = heal(c.p, 2);
          return `+${n} hull. Power diverted: next fight is ${modName(curse(c, 'blackout'))}.`;
        },
      },
      {
        label: 'Tactical data', tag: 'SAFE', desc: '+1 reroll and +25% ultimate.',
        effect(c) {
          G.rerolls++;
          c.p.od = Math.min(100, c.p.od + 25);
          return '+1 reroll, +25% ultimate.';
        },
      },
      { label: 'Decline', desc: 'Save the relays.', effect: () => 'MAG: "Noted. Stay sharp."' },
    ],
  },
];

export const eventById = (id) => EVENTS.find((e) => e.id === id);

const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// Chaos Rift route stop (not in the anomaly pool): power now, hazards on the next fights (run.riftLeft).
export const RIFT = {
  id: 'rift', title: 'CHAOS RIFT', color: '#ff4d6d',
  text: 'Space tears open into raw Signal static. Ships that dive in come out stronger, and something follows them out.',
  choices: [
    {
      label: 'Dive in', tag: 'RISKY', desc: '+3 random upgrade levels. Your next 2 fights each get a hazard modifier.',
      effect(c) {
        const r = grantUpgrades(c, 3);
        if (c.granted) c.run.riftLeft = (c.run.riftLeft || 0) + 2;
        return c.granted ? `${r} The rift follows you: the next 2 fights carry hazards.` : r;
      },
    },
    {
      label: 'Skim the edge', desc: '+1 random upgrade level. Your next fight gets a hazard modifier.',
      effect(c) {
        const r = grantUpgrades(c, 1);
        if (c.granted) c.run.riftLeft = (c.run.riftLeft || 0) + 1;
        return c.granted ? `${r} Static clings to the hull: the next fight carries a hazard.` : r;
      },
    },
    { label: 'Back away', tag: 'SAFE', desc: 'Leave the rift alone.', effect: () => 'The tear seals behind you.' },
  ],
};

// A random hazard for Chaos Rift fights.
export const riftHazard = (rng = Math.random) => RISKY_MODS[Math.floor(rng() * RISKY_MODS.length)];

// Event for a route node: seeded by the route seed + node id, never repeating within a run until all are used.
export function eventFor(route, node, used = []) {
  const rng = mulberry32((route.seed ^ hashStr(node.id)) >>> 0);
  let pool = EVENTS.filter((e) => !used.includes(e.id));
  if (!pool.length) pool = EVENTS;
  return pool[Math.floor(rng() * pool.length)];
}

// Opens an event: resolves its choices (some are dynamic) into a session object.
export function startEvent(ev, rng = Math.random) {
  const ctx = makeCtx(rng);
  const choices = typeof ev.choices === 'function' ? ev.choices(ctx) : ev.choices;
  return { ev, ctx, choices, done: false, result: '' };
}

// Why a choice cannot be taken right now ('' if it can).
export function choiceBlocked(s, i) {
  const c = s.choices[i];
  if (!c) return 'N/A';
  if (c.cost && (s.ctx.run.wallet || 0) < c.cost) return `NEED ${c.cost - (s.ctx.run.wallet || 0)}`;
  if (c.ok) return c.ok(s.ctx);
  return '';
}

// Applies choice i. Returns the result line, or null if blocked / already resolved.
export function resolveChoice(s, i) {
  if (s.done || choiceBlocked(s, i)) return null;
  const c = s.choices[i];
  if (c.cost) {
    s.ctx.run.wallet -= c.cost;
  }
  if (c._apply) c._apply();
  s.result = c.effect(s.ctx);
  s.done = true;
  s.picked = i;
  return s.result;
}
