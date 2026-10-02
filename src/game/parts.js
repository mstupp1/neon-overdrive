// Hangar parts: 3 slots per ship, each part trades something for something.
// Bought once, usable on any ship. `apply(st, p)` runs at the end of recomputeStats,
// so parts stack multiplicatively on top of upgrades. `start` grants free upgrade levels at run start.

import { applyCore } from './core.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const SLOTS = ['core', 'plating', 'thrusters'];
export const SLOT_INFO = {
  core: { name: 'CORE', color: '#ff3df2' },
  plating: { name: 'PLATING', color: '#ffd23f' },
  thrusters: { name: 'THRUSTERS', color: '#3ff6ff' },
};

export const PARTS = [
  // --- Core ---
  {
    id: 'glass', slot: 'core', name: 'Glass Reactor', price: 300,
    desc: '+30% damage, -1 max hull.',
    icon: svg('<path d="M12 2l7 5v10l-7 5-7-5V7z"/><path d="M12 7l-3 5 3 5 3-5z"/>'),
    apply(st) { st.dmg *= 1.3; st.maxHp -= 1; },
  },
  {
    id: 'cycler', slot: 'core', name: 'Rapid Cycler', price: 250,
    desc: '+20% fire rate, -10% damage.',
    icon: svg('<path d="M20 12a8 8 0 11-3-6.2M20 4v5h-5"/><path d="M12 8v4l3 2"/>'),
    apply(st) { st.rate *= 1.2; st.dmg *= 0.9; },
  },
  {
    id: 'siphon', slot: 'core', name: 'Data Siphon', price: 200,
    desc: '+25% XP gain, -5% damage.',
    icon: svg('<path d="M5 4h14l-5 7v8l-4 2v-10z"/>'),
    apply(st) { st.xpMul *= 1.25; st.dmg *= 0.95; },
  },
  {
    id: 'optics', slot: 'core', name: 'Hunter Optics', price: 350,
    desc: '+10% crit chance, crits deal 3x. -8% fire rate.',
    icon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="9"/>'),
    apply(st) { st.crit += 0.1; st.critMul = 3; st.rate *= 0.92; },
  },
  // --- Plating ---
  {
    id: 'reactive', slot: 'plating', name: 'Reactive Armor', price: 350,
    desc: '+1 max hull, -8% move speed.',
    icon: svg('<path d="M4 6l8-3 8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9z"/><path d="M9 12h6M12 9v6"/>'),
    apply(st) { st.maxHp += 1; st.speed *= 0.92; },
  },
  {
    id: 'aegisPlate', slot: 'plating', name: 'Aegis Emitter', price: 400,
    desc: 'Start every run with Aegis Shield 1. Dashes recharge 15% slower.',
    icon: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8 11c2-2 6-2 8 0"/>'),
    start: { aegis: 1 },
    apply(st) { st.dashRecharge *= 1.15; },
  },
  {
    id: 'graze', slot: 'plating', name: 'Graze Mesh', price: 300,
    desc: '+40% graze radius, +30% Overdrive from grazes. -6% damage.',
    icon: svg('<path d="M3 12h18M3 6h18M3 18h18M7 3v18M12 3v18M17 3v18"/>'),
    apply(st) { st.grazeR *= 1.4; st.grazeOd *= 1.3; st.dmg *= 0.94; },
  },
  {
    id: 'salvage', slot: 'plating', name: 'Salvage Hull', price: 250,
    desc: '+30% credits, -10% damage.',
    icon: svg('<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.8-1-2-1.5-3-1.5-1.7 0-3 1-3 2.5s1.3 2 3 2.5 3 1 3 2.5-1.3 2.5-3 2.5c-1 0-2.2-.5-3-1.5M12 5v2M12 17v2"/>'),
    apply(st) { st.creditMul *= 1.3; st.dmg *= 0.9; },
  },
  // --- Thrusters ---
  {
    id: 'afterburner', slot: 'thrusters', name: 'Afterburner Kit', price: 450,
    desc: '+1 dash charge, dashes recharge 20% slower.',
    icon: svg('<path d="M4 18l6-6-6-6M12 18l6-6-6-6"/><path d="M20 6v12"/>'),
    apply(st) { st.maxCharges += 1; st.dashRecharge *= 1.2; },
  },
  {
    id: 'fins', slot: 'thrusters', name: 'Vector Fins', price: 250,
    desc: '+12% move speed, dashes recharge 15% slower.',
    icon: svg('<path d="M12 3v18M12 8L5 20M12 8l7 12"/>'),
    apply(st) { st.speed *= 1.12; st.dashRecharge *= 1.15; },
  },
  {
    id: 'phase', slot: 'thrusters', name: 'Phase Drive', price: 400,
    desc: '+40% dash length and i-frames. -5% move speed.',
    icon: svg('<path d="M3 12h6M11 12h2M15 12h6"/><circle cx="12" cy="12" r="6" stroke-dasharray="3 3"/>'),
    apply(st) { st.dashDur *= 1.4; st.speed *= 0.95; },
  },
  {
    id: 'coil', slot: 'thrusters', name: 'Magnet Coil', price: 150,
    desc: '+60% pickup range, -5% move speed.',
    icon: svg('<path d="M6 4v8a6 6 0 0012 0V4M6 8h4M14 8h4"/>'),
    apply(st) { st.magnet *= 1.6; st.speed *= 0.95; },
  },
];

const byId = new Map(PARTS.map((p) => [p.id, p]));
export const partById = (id) => byId.get(id);
export const partsForSlot = (slot) => PARTS.filter((p) => p.slot === slot);

export const ownsPart = (profile, id) => profile.ownedParts.includes(id);

// Equipped part defs for a ship (owned parts only, one per slot).
export function equippedParts(profile, shipId) {
  const eq = (profile.equip && profile.equip[shipId]) || {};
  const out = [];
  for (const slot of SLOTS) {
    const part = byId.get(eq[slot]);
    if (part && part.slot === slot && ownsPart(profile, part.id)) out.push(part);
  }
  return out;
}

export function applyParts(st, p) {
  for (const part of p.parts || []) part.apply(st, p);
  if (p.fluxCore) applyCore(st, p.fluxCore); // Flux Core levels (endgame), real runs only
}
