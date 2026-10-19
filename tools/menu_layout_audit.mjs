// Menu layout-shift audit: opens each menu, browses every item (ships, classes, abilities, relics, tree nodes, draft
// rerolls, market / event rolls, tabs) and fails if anything on the screen moves or resizes, or the screen has to shrink
// its font or scroll to fit. Text whose length varies belongs in a fixed well (src/ui/wells.js) or a .clip line.
//
//   python3 -m http.server 8000          (in the repo root, in another terminal)
//   node tools/menu_layout_audit.mjs [menu,menu…] [--url http://localhost:8000/]
//
// The hub tab checks cycle pages with E and compare the shared header and text scale across them.
// Needs Playwright with Chromium (npm i -g playwright, or set PLAYWRIGHT_MODULE to its index.mjs). Exit code 1 on a shift.

import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const urlAt = args.indexOf('--url');
const URL = urlAt >= 0 ? args.splice(urlAt, 2)[1] : 'http://localhost:8000/';
const only = args[0] ? args[0].split(',') : null;

let pw;
try {
  pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
} catch {
  console.error('Playwright not found: npm i -g playwright, or set PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs');
  process.exit(2);
}
const chromium = pw.chromium || pw.default.chromium;

const VIEWS = { desktop: { width: 1280, height: 800 }, phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const PROFILE = { ownedShips: ['vector', 'needle', 'phantom'], lastShip: 'phantom', seenIntro: true, seenHelp: true, seenRunInfo: true, credits: 2500, rankXp: 40000, runs: 5, best: 123456, flux: 300, campaign: { cleared: ['genesis'], seenStory: { prologue: 1 }, bestSys: 1, bestRow: 3 } };
const PROFILE_KEY = 'neon-overdrive/profile/v3';

// Per menu: `open` (page JS), the item count `n` (page JS), and per item either a key press or `step` (page JS, I = index).
const focusEach = `{const b=[...document.querySelectorAll('.screen.active button')].filter(x=>x.offsetParent)[I]; if(b){b.dispatchEvent(new CustomEvent('menufocus',{bubbles:true})); b.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));}}`;
const focusCount = `document.querySelectorAll('.screen.active button').length`;
const tabEach = `{const t=document.querySelectorAll('.screen.active .tabbar.primary .tab'); t[I%t.length]?.click();}`;
const menuFocus = (sel) => `document.querySelectorAll('${sel}')[I]?.dispatchEvent(new CustomEvent('menufocus',{bubbles:true}))`;
function dialogueLines() {
  return [
    { who: 'MAG', text: 'Short line.' },
    { who: 'MAG', text: 'From the campaign screen, the HANGAR fits ships with the gear you find, and its PILOT tab is where you equip abilities. Then launch again, and this time bring back more than scrap; every relic you recover tells us something about the Signal.' },
    { who: 'ECHO', text: 'Nobody had the right pilot.' },
    { who: 'SIGNAL', text: 'Averylongtokenwithoutanyspacesatalltotesttheworstcaseforwrapping and then some normal words follow it to the end.' },
  ];
}

const MENUS = {
  title: { open: `NEON.toTitle()`, n: focusCount, step: focusEach },
  campaign: { open: `NEON.toTitle(); document.querySelector('#scr-title [data-act=play]').click()`, n: focusCount, step: focusEach },
  // The active ship wears gear (extra stats and paths), the others don't.
  ships: { open: `for (const [sl, r] of [['core', 4], ['plating', 3], ['thrusters', 2]]) NEON.equip('phantom', NEON.giveGear(sl, r, 30).uid); NEON.openHangar()`, n: `12`, key: 'ArrowRight' },
  // Paint chips preview on the hull; the caption and art swap in place.
  paints: { open: `NEON.openHangar()`, n: `8`, step: `document.querySelectorAll('#hs-paints .swatch')[I%4]?.dispatchEvent(new CustomEvent('menufocus',{bubbles:true}))` },
  // LOADOUT: the active ship's gear; equipping changes the bars, extras and paths, never the layout.
  loadout: { open: `for (const [sl, r] of [['core', 4], ['plating', 3]]) NEON.equip('phantom', NEON.giveGear(sl, r, 30).uid); NEON.openLoadout()`, n: `6`, step: `{const sl=['core','plating','thrusters'][I%3]; const g=NEON.giveGear(sl, I%5, 10+I*5); NEON.equip('phantom', g.uid); NEON.openLoadout();}` },
  // Dialogue (src/ui/comms.js): short, long and unbroken lines; the box keeps its size, long lines page.
  dialogue: { root: '#comms', open: `NEON.comms.play(${JSON.stringify(dialogueLines())}, { blocking: true })`, n: `24`, step: `NEON.comms.advance()` },
  liveDialogue: { root: '#comms', open: `NEON.startRun('vector'); NEON.comms.skipAll(); NEON.comms.play(${JSON.stringify(dialogueLines())}, { blocking: false })`, n: `24`, step: `NEON.comms.advance()` },
  // Hub tabs are separate pages under one shared header: the header and the text scale must hold still.
  hangarTabs: { open: `NEON.toTitle(); document.querySelector('#scr-title [data-act=hangar]').click()`, n: `12`, key: 'KeyE', across: 'header.hub-head' },
  collectionTabs: { open: `NEON.toTitle(); document.querySelector('#scr-title [data-act=gallery]').click()`, n: `4`, key: 'KeyE', across: 'header.hub-head' },
  parts: { open: `NEON.openLoadout(); document.querySelector('#lo-slots button')?.click()`, n: `document.querySelectorAll('#parts-list button').length`, step: menuFocus('#parts-list button') },
  fab: { open: `NEON.openFab()`, n: `document.querySelectorAll('#scr-fab button').length`, step: menuFocus('#scr-fab button') },
  classes: { open: `NEON.openPilot()`, n: `document.querySelectorAll('#pl-tabs .cls-tab').length`, step: `document.querySelectorAll('#pl-tabs .cls-tab')[I].click()` },
  abilities: { open: `NEON.openPilot()`, n: `document.querySelectorAll('#pl-passives button').length`, step: menuFocus('#pl-passives button') },
  tree: { open: `NEON.tree.open('striker')`, n: `12`, key: ['ArrowRight', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft'] },
  flux: { open: `NEON.openCore()`, n: `document.querySelectorAll('#core-list .core-tile').length`, step: menuFocus('#core-list .core-tile') },
  relics: { open: `NEON.openGallery()`, n: `document.querySelectorAll('#gl-tabs button').length * 6`, step: `{const t=document.querySelectorAll('#gl-tabs button'); if(I%6===0) t[Math.floor(I/6)].click(); const g=document.querySelectorAll('#gl-grid button'); g[(I%6)%g.length]?.click();}` },
  achievements: { open: `NEON.openAchievements()`, n: focusCount, step: focusEach },
  settings: { open: `NEON.toTitle(); document.querySelector('#scr-title [data-act=settings]').click()`, n: `6`, step: tabEach },
  help: { open: `NEON.toTitle(); document.querySelector('#scr-title [data-act=help]').click()`, n: `8`, step: tabEach },
  reward: { open: `NEON.launch(); NEON.openDraft('sector')`, n: `8`, step: `NEON.openDraft('sector')` },
  levelup: { open: `NEON.launch(); NEON.openDraft('level')`, n: `8`, step: `NEON.openDraft('level')` },
  market: { open: `NEON.launch(); NEON.simulate(1); NEON.grant({wallet:300}); NEON.visit('market')`, n: `6`, step: `NEON.visit('market')` },
  dock: { open: `NEON.launch(); NEON.visit('dock')`, n: `3`, step: `NEON.G.player.hp = Math.max(1, NEON.G.player.maxHp - I); NEON.visit('dock')` },
  event: { open: `NEON.launch(); NEON.simulate(1); NEON.event('carrier')`, n: `8`, step: `NEON.event()` },
  pause: { open: `NEON.launch(); NEON.simulate(2); window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}))`, n: focusCount, step: focusEach },
  runDetails: { open: `NEON.launch(); NEON.simulate(2); window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'})); setTimeout(()=>document.querySelector('#scr-pause [data-act=runDetails]').click(),300)`, n: `6`, step: tabEach },
};

// Box of every visible element in the open screen, keyed by its path.
function snapshot(root) {
  const scr = document.querySelector(root || '.screen.active');
  if (!scr || scr.hidden) return null; // e.g. the dialogue finished
  const path = (el) => {
    const p = [];
    while (el && el !== scr) {
      p.unshift(el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList[0] ? '.' + el.classList[0] : '') + ':' + [...el.parentNode.children].indexOf(el));
      if (el.id) break;
      el = el.parentElement;
    }
    return p.join('>');
  };
  const els = {};
  scr.querySelectorAll('*').forEach((el) => {
    if (el.closest('svg') && el.tagName !== 'svg') return;
    const r = el.getBoundingClientRect();
    if (r.width || r.height) els[path(el)] = [r.left, r.top, r.width, r.height];
  });
  return { id: scr.id, font: getComputedStyle(scr).fontSize, scroll: scr.scrollHeight - scr.clientHeight, els };
}

const TOL = 1; // px: sub-pixel rounding
const launch = { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] };
if (existsSync('/opt/pw-browsers/chromium')) launch.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(launch);
let failures = 0;
for (const [view, vp] of Object.entries(VIEWS)) {
  for (const [name, m] of Object.entries(MENUS)) {
    if (only && !only.includes(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(([k, p]) => localStorage.setItem(k, JSON.stringify(p)), [PROFILE_KEY, PROFILE]);
    await page.goto(URL);
    await page.waitForFunction(() => window.NEON, null, { timeout: 15000 });
    // Measure layout only: no achievement toasts, entrance animations or focus / hover transforms.
    await page.addStyleTag({ content: '#notes{display:none!important} #app *{animation:none!important;transition:none!important;transform:none!important}' });
    await page.waitForTimeout(400);
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Enter'); // PRESS START, title slam
      await page.waitForTimeout(400);
    }
    const settle = async (ms) => {
      if (!m.root) await page.evaluate(() => NEON.comms?.skipAll?.()); // dialogue in the way of a menu
      await page.waitForTimeout(ms);
    };
    await page.evaluate(m.open).catch((e) => errors.push('open: ' + e.message));
    await settle(700);
    const n = Math.min(40, (await page.evaluate(m.n).catch(() => 8)) || 0);
    const snaps = [await page.evaluate(snapshot, m.root)];
    for (let i = 0; i < n; i++) {
      if (m.key) await page.keyboard.press(Array.isArray(m.key) ? m.key[i % m.key.length] : m.key);
      else await page.evaluate(m.step.replaceAll('I', String(i))).catch((e) => errors.push('step: ' + e.message.slice(0, 80)));
      await settle(150);
      snaps.push(await page.evaluate(snapshot, m.root));
    }
    await ctx.close();

    const ok = snaps.filter((s) => s && (m.across || s.id === snaps[0]?.id));
    const keys = Object.keys(ok[0]?.els || {}).filter((k) => ok.every((s) => s.els[k]) && (!m.across || k.startsWith(m.across)));
    const moved = keys.filter((k) => {
      const range = (j) => Math.max(...ok.map((s) => s.els[k][j])) - Math.min(...ok.map((s) => s.els[k][j]));
      return range(1) > TOL || range(3) > TOL; // top or height (a line of text getting wider is fine)
    });
    const outer = moved.filter((k) => !moved.some((o) => o !== k && k.startsWith(o + '>')));
    const fonts = [...new Set(ok.map((s) => s.font))];
    const scroll = Math.max(0, ...ok.map((s) => s.scroll));
    const bad = outer.length || fonts.length > 1 || scroll > 1 || errors.length;
    if (bad) failures++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${view.padEnd(7)} ${name.padEnd(12)} ${n} items${fonts.length > 1 ? ` · font ${fonts.join('/')}` : ''}${scroll > 1 ? ` · scrolls ${scroll}px` : ''}`);
    outer.slice(0, 8).forEach((k) => {
      const hs = [...new Set(ok.map((s) => Math.round(s.els[k][3])))].join('/');
      const ys = [...new Set(ok.map((s) => Math.round(s.els[k][1])))].join('/');
      console.log(`       ${k.slice(-80)}  height ${hs}  top ${ys}`);
    });
    errors.forEach((e) => console.log('       error: ' + e));
  }
}
await browser.close();
console.log(failures ? `\n${failures} menu(s) shift.` : '\nNo layout shift.');
process.exit(failures ? 1 : 0);
