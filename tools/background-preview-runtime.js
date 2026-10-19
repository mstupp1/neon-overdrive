// Runs inside the preview iframe so imports share the live game's module state.
import { bg } from '../src/render/background.js';
import { loadThemeLayers, themeLayersReady, loadZoneLayers, zoneLayersReady, setThemeLayersEnabled } from '../src/render/backgroundLayers.js';
import { loadOverworldLayers, overworldLayersReady, setOverworldLayersEnabled } from '../src/render/overworldLayers.js';
import { SYSTEMS } from '../src/game/campaign.js';

const N = window.NEON;
let generated = true;
let boosted = false;
let frozen = false;
let frozenScreen = 'play';
let currentTheme = 'genesis';
let currentView = 'top';
let currentZone = '';
let configurationRevision = 0;
let zoneLoading = false;
const zonesFor = (theme) => ({crimson:['spore-fields','hive-trench'],void:['shattered-orbit']})[theme] || [];
const zoneLabel = (slug) => ({'spore-fields':'Spore Fields','hive-trench':'Hive Trench','shattered-orbit':'Shattered Orbit'})[slug] || 'System default';
const systemFor = (id) => SYSTEMS.find((system) => system.id === id) || SYSTEMS[0];
const bossFor = (id) => systemFor(id).boss;
const bossName = (id) => ({warden:'Warden',hydra:'Hydra',omega:'Omega',eclipse:'Eclipse'})[bossFor(id)];
const emit = (status) => parent.postMessage({kind:'background-preview', ready:true, status}, parent.location.origin);

function applyZone() {
  bg.setZone(currentView === 'overworld' ? '' : currentZone || null);
}

function zoneStatus(theme = currentTheme) {
  if (currentView === 'overworld' || !currentZone) return `${currentView === 'overworld' ? 'Zone base' : 'Zone system default'} · ready`;
  return `Zone ${zoneLabel(currentZone)} · ${zoneLayersReady(theme, currentZone) ? 'ready' : zoneLoading ? 'loading' : 'unavailable: procedural fallback'}`;
}

function configure(theme = currentTheme, view = currentView, zone = currentZone) {
  const revision = ++configurationRevision;
  if (SYSTEMS.some((system) => system.id === theme)) currentTheme = theme;
  if (['top','side','chase','overworld'].includes(view)) currentView = view;
  currentZone = currentView === 'overworld' || !zonesFor(currentTheme).includes(zone) ? '' : zone;
  zoneLoading = Boolean(currentZone && !zoneLayersReady(currentTheme, currentZone));
  bg.setTheme(currentTheme);
  applyZone();
  const requestedTheme = currentTheme;
  const requestedView = currentView;
  const requestedZone = currentZone;
  setThemeLayersEnabled(requestedTheme, generated);
  const layered = currentView === 'overworld'
    ? (setOverworldLayersEnabled(requestedTheme, generated), loadOverworldLayers(requestedTheme))
    : Promise.all([loadThemeLayers(requestedTheme), requestedZone ? loadZoneLayers(requestedTheme, requestedZone) : Promise.resolve()]);
  layered.then(() => {
    if (revision !== configurationRevision || currentTheme !== requestedTheme || currentView !== requestedView || currentZone !== requestedZone) return;
    zoneLoading = false;
    const ready = currentView === 'overworld' ? overworldLayersReady(requestedTheme) : themeLayersReady(requestedTheme);
    emit(`${systemFor(requestedTheme).name} · ${currentView}\n${generated ? 'Generated' : 'Procedural'} background\nImages ${ready ? 'ready' : 'unavailable: procedural fallback'}\n${zoneStatus(requestedTheme)}`);
  }).catch(() => {
    if (revision !== configurationRevision || currentTheme !== requestedTheme || currentView !== requestedView || currentZone !== requestedZone) return;
    zoneLoading = false;
    emit(`${systemFor(requestedTheme).name} · ${requestedView}\n${generated ? 'Generated' : 'Procedural'} background\nImages unavailable: procedural fallback\n${zoneStatus(requestedTheme)}`);
  });
}

function start(boss = false) {
  const system = systemFor(currentTheme);
  boosted = false;
  N.input.hold('focus', false);
  if (currentView === 'overworld') {
    N.profile.settings.story = false;
    N.launch(currentTheme, { story: false, intro: false });
    if (N.G.screen === 'draft') {
      // Genesis starts with a supply pick. Use its real Skip control, then fall
      // back to the game's debug hook / first card if Fortune is already full.
      const skip = document.querySelector('#skip-btn');
      if (skip && !skip.disabled) skip.click();
      if (N.G.screen === 'draft') N.skip();
      if (N.G.screen === 'draft') {
        const first = document.querySelector('#draft-cards .card');
        if (first?._onPick && first.dataset.id) first._onPick(first.dataset.id);
      }
    }
    N.G.player.god = true;
    N.G.player.xp = -100000;
    frozenScreen = 'overworld';
    bg.setTheme(currentTheme);
    applyZone();
    frozen = false;
    emit(`${system.name} · overworld\n${generated ? 'Generated' : 'Procedural'} background\nFree flight and combat\nZone base · ready`);
    return;
  }
  N.G.scriptCtrl = null;
  boosted = false;
  N.profile.settings.story = false;
  N.profile.settings.retro = 'pixel';
  N.startSpec({level:system.level, duration:boss ? 1 : 180, name:`${system.short} ASSET PREVIEW`, hue:system.hue, boss:boss ? system.boss : null, bossHp:0.15, obstacles:false, view:currentView, arenaView:currentView});
  frozenScreen = 'play';
  N.G.autopilot = true;
  N.G.player.god = true;
  N.G.player.xp = -100000; // keep drafts out of the comparison
  bg.setTheme(currentTheme);
  applyZone();
  frozen = false;
  emit(`${system.name} · ${currentView}\n${generated ? 'Generated' : 'Procedural'} background\n${boss ? `${bossName(currentTheme)} arena` : 'Wave fight'}\n${zoneStatus()}`);
}

async function benchmark() {
  if (currentView !== 'top') return emit('Benchmark is limited to the top-down fight background renderer. Select Top-down to compare its procedural and layered paths.');
  // Compare only the top-down background renderer: identical live state, a warmed canvas,
  // alternating order to reduce cache/order bias. This is not whole-game FPS.
  await loadThemeLayers(currentTheme);
  if (!themeLayersReady(currentTheme)) return emit(`${currentTheme} layers unavailable; showing procedural fallback.`);
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = Math.round(N.view.H * 2);
  const ctx = canvas.getContext('2d'); ctx.scale(2,2);
  const sample = (on) => {
    setThemeLayersEnabled(currentTheme,on);
    for(let i=0;i<2;i++) bg.draw(ctx);
    const before=performance.now();
    for(let i=0;i<4;i++) bg.draw(ctx);
    return (performance.now()-before)/4;
  };
  const base=[], layers=[];
  for(let i=0;i<4;i++) {
    if(i%2) {layers.push(sample(true));base.push(sample(false));}
    else {base.push(sample(false));layers.push(sample(true));}
    await new Promise(resolve=>requestAnimationFrame(resolve));
  }
  setThemeLayersEnabled(currentTheme,generated);
  const median=(a)=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
  const a=median(base), b=median(layers);
  const previousScreen = N.G.screen;
  N.G.screen = 'pause';
  const pacing = async (on) => {
    setThemeLayersEnabled(currentTheme,on);
    const times=[];
    for(let i=0;i<80;i++) times.push(await new Promise(resolve=>requestAnimationFrame(resolve)));
    const intervals=times.slice(11).map((t,i)=>t-times[i+10]);
    return {median:median(intervals),p95:intervals.sort((x,y)=>x-y)[Math.floor(intervals.length*.95)]};
  };
  let pa, pb;
  try { pa=await pacing(false); pb=await pacing(true); }
  finally { N.G.screen=previousScreen; setThemeLayersEnabled(currentTheme,generated); }
  emit(`${currentTheme} top-down background draw median\nProcedural ${a.toFixed(3)} ms\nLayered ${b.toFixed(3)} ms\nAdded ${(b-a).toFixed(3)} ms\nCanvas submission only.\n\nFrozen-scene frame pacing\nProcedural median ${pa.median.toFixed(2)} ms / p95 ${pa.p95.toFixed(2)} ms\nLayered median ${pb.median.toFixed(2)} ms / p95 ${pb.p95.toFixed(2)} ms\nRefresh-limited; this measures the selected theme's top-down background only, not combat FPS or GPU time.`);
}

window.addEventListener('message', ({source,data}) => {
  if(source!==parent || data?.kind!=='background-preview-action') return;
  const action=data.action;
  if (action === 'configure' || data.theme !== currentTheme || data.view !== currentView || data.zone !== currentZone) {
    configure(data.theme,data.view,data.zone);
  }
  if(action==='configure') start();
  if(action==='baseline'||action==='generated') {
    generated=action==='generated'; setThemeLayersEnabled(currentTheme,generated);
    if (currentView === 'overworld') setOverworldLayersEnabled(currentTheme, generated);
    const ready = currentView === 'overworld' ? overworldLayersReady(currentTheme) : themeLayersReady(currentTheme);
    emit(`${systemFor(currentTheme).name} · ${currentView}\n${generated?'Generated':'Procedural'} background\nImages ${ready?'ready':'loading / fallback'}\n${zoneStatus()}`);
  } else if(action==='waves') start();
  else if(action==='boss') start(true);
  else if(action==='dense') {
    start();
    const W=N.view.W;
    if (currentView === 'overworld') {
      const p=N.G.player;
      ['spinner','sniper','tank','carrier','shielder','weaver'].forEach((type,i)=>N.spawn(type,p.x+(i-2.5)*115,p.y-250,{elite:true}));
      emit(`${systemFor(currentTheme).name} · overworld\nDense free-flight combat contrast check\nZone base · ready`);
    } else {
      ['spinner','sniper','tank','carrier','shielder','weaver'].forEach((type,i)=>N.spawn(type,W*(i+1)/7,160,{elite:true}));
      emit(`${systemFor(currentTheme).name} · ${currentView}\nDense wave and fire contrast check\n${zoneStatus()}`);
    }
  } else if(action==='boost') {
    boosted=!boosted;
    if (currentView === 'overworld') N.input.hold('focus', boosted);
    else N.G.scriptCtrl=boosted ? ()=>({mode:'dir',dx:0,dy:0,dash:false,od:false,boost:true}) : null;
    emit(`Boost ${boosted?'on':'off'} · ${currentView}\n${zoneStatus()}`);
  } else if(action==='freeze') {
    frozen=!frozen;
    N.G.screen=frozen?'pause':frozenScreen;
    emit(`${frozen?'Frozen scene':'Running scene'} · ${currentView}\n${zoneStatus()}`);
  } else if(action==='benchmark') benchmark();
});
const initial = new URLSearchParams(parent.location.search);
configure(initial.get('theme') || 'genesis', initial.get('view') || 'top', initial.get('zone') || '');
start();
