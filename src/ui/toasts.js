// Notification toasts (achievements, relic finds, set completions, gear / pilot finds): small pills that drop in at the
// top, at most three at a time; the rest wait their turn.

import { sfx } from '../core/audio.js';
import { TIERS, onAchievement } from '../game/achievements.js';
import { RARITY, SET_BONUS, themeById, onRelic, onSetComplete } from '../game/collectables.js';
import { RARITY as GEAR_RARITY } from '../game/rarity.js';
import { onLoot } from '../game/loot.js';
import { gearDef, itemName, SLOT_INFO } from '../game/parts.js';

const STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/></svg>';
const SET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"/><path d="M8 12.2l2.8 2.8L16.2 9.6"/></svg>';
const MAX = 3;
const LIFE = 3600;

let box = null;
const queue = [];
let live = 0;

function show(n) {
  live++;
  const el = document.createElement('div');
  el.className = 'note' + (n.shine ? ' shine' : '');
  el.style.setProperty('--c', n.color);
  el.innerHTML = `<span class="note-ico">${n.icon}</span><span class="note-txt"><em>${n.kicker}</em><b>${n.title}</b></span>`;
  box.appendChild(el);
  n.sound?.();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      live--;
      if (queue.length) show(queue.shift());
    }, 400);
  }, LIFE);
}

export function notify(n) {
  if (!box) return;
  if (live < MAX) show(n);
  else queue.push(n);
}

export function notifyBacklog(n) {
  notify({ kicker: 'FROM PAST RUNS', title: `${n} achievement${n > 1 ? 's' : ''} unlocked`, icon: STAR, color: TIERS.g.color, shine: true, sound: () => sfx.achieve(true) });
}

export function initToasts() {
  box = document.getElementById('notes');
  onAchievement((a, reward) => {
    const t = TIERS[a.tier];
    notify({ kicker: `ACHIEVEMENT · +${reward}`, title: a.name, icon: STAR, color: t.color, shine: a.tier === 'g', sound: () => sfx.achieve(a.tier === 'g') });
  });
  onRelic((relic, source) => {
    if (source === 'shop') return; // the gallery shows purchases itself
    const legend = relic.rarity === 'legendary';
    notify({
      kicker: source === 'capsule' ? 'CAPSULE' : legend ? 'LEGENDARY FIND' : 'RELIC FOUND',
      title: relic.name, icon: relic.icon, color: legend ? RARITY.legendary.color : themeById(relic.theme).color, shine: legend,
      sound: () => sfx.relic(legend),
    });
  });
  onLoot((kind, x) => {
    if (kind === 'gear') {
      const { item, salvaged, credits } = x;
      const r = GEAR_RARITY[item.r];
      const kick = salvaged === item ? `${r.name} · SALVAGED +${credits}` : `${r.name} ${SLOT_INFO[item.slot].name}${salvaged ? ` · SOLD SPARE +${credits}` : ''}`;
      notify({ kicker: kick, title: itemName(item), icon: gearDef(item.base).icon, color: r.color, shine: item.r >= 4, sound: () => (item.r >= 3 ? sfx.relic(item.r >= 4) : sfx.coin()) });
    } else if (kind === 'class') {
      notify({ kicker: 'PILOT CLASS FOUND', title: x.name, icon: x.icon, color: x.color, shine: true, sound: () => sfx.achieve(true) });
    } else if (kind === 'ability') {
      const r = GEAR_RARITY[x.r];
      notify({ kicker: `${r.name} ABILITY FOUND`, title: x.name, icon: x.icon, color: r.color, shine: x.r >= 4, sound: () => sfx.achieve(x.r >= 3) });
    }
  });
  onSetComplete((theme) => {
    notify({ kicker: `SET COMPLETE · +${SET_BONUS}`, title: theme.name, icon: SET, color: theme.color, shine: true, sound: () => sfx.achieve(true) });
  });
}
