// Runs inside the preview iframe so imports share the live game's module state.
import { bg } from '../src/render/background.js';
import { loadGenesisLayers, genesisLayersReady, setGenesisLayersEnabled } from '../src/render/backgroundLayers.js';

const N = window.NEON;
let generated = true;
let boosted = false;
let frozen = false;
const emit = (status) => parent.postMessage({kind:'background-preview', ready:true, status}, parent.location.origin);

function start(boss = null) {
  N.G.scriptCtrl = null;
  boosted = false;
  N.profile.settings.story = false;
  N.profile.settings.retro = 'pixel';
  N.startSpec({level:3, duration:boss ? 1 : 180, name:'GENESIS ASSET PREVIEW', hue:215, boss, obstacles:false, view:'top', arenaView:'top'});
  N.G.autopilot = true;
  N.G.player.god = true;
  N.G.player.xp = -100000; // keep drafts out of the comparison
  bg.setTheme('genesis');
  frozen = false;
  emit(`Pixel look · top-down\n${generated ? 'Generated' : 'Procedural'} background\n${boss ? 'Warden arena' : 'Wave fight'}`);
}

async function benchmark() {
  // Only compare the background renderer: identical live state, a warmed canvas,
  // alternating order to reduce cache/order bias. This is not whole-game FPS.
  await loadGenesisLayers();
  if (!genesisLayersReady()) return emit('Assets unavailable; showing procedural fallback.');
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = Math.round(N.view.H * 2);
  const ctx = canvas.getContext('2d'); ctx.scale(2,2);
  const sample = (on) => {
    setGenesisLayersEnabled(on);
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
  setGenesisLayersEnabled(generated);
  const median=(a)=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
  const a=median(base), b=median(layers);
  const previousScreen = N.G.screen;
  N.G.screen = 'pause';
  const pacing = async (on) => {
    setGenesisLayersEnabled(on);
    const times=[];
    for(let i=0;i<80;i++) times.push(await new Promise(resolve=>requestAnimationFrame(resolve)));
    const intervals=times.slice(11).map((t,i)=>t-times[i+10]);
    return {median:median(intervals),p95:intervals.sort((x,y)=>x-y)[Math.floor(intervals.length*.95)]};
  };
  let pa, pb;
  try { pa=await pacing(false); pb=await pacing(true); }
  finally { N.G.screen=previousScreen; setGenesisLayersEnabled(generated); }
  emit(`Background draw median\nBaseline ${a.toFixed(3)} ms\nLayers ${b.toFixed(3)} ms\nAdded ${(b-a).toFixed(3)} ms\nCanvas submission only.\n\nFrozen-scene frame pacing\nBaseline median ${pa.median.toFixed(2)} ms / p95 ${pa.p95.toFixed(2)} ms\nLayers median ${pb.median.toFixed(2)} ms / p95 ${pb.p95.toFixed(2)} ms\nPacing is refresh-limited; not GPU timing or a combat FPS benchmark.`);
}

window.addEventListener('message', ({source,data}) => {
  if(source!==parent || data?.kind!=='background-preview-action') return;
  const action=data.action;
  if(action==='baseline'||action==='generated') {
    generated=action==='generated'; setGenesisLayersEnabled(generated);
    emit(`${generated?'Generated':'Procedural'} background\nImages ${genesisLayersReady()?'ready':'loading / fallback'}`);
  } else if(action==='waves') start();
  else if(action==='boss') start('warden');
  else if(action==='dense') {
    start();
    ['spinner','sniper','tank','carrier'].forEach((type,i)=>N.spawn(type,75+i*100,160,{elite:true}));
  } else if(action==='boost') {
    boosted=!boosted;
    N.G.scriptCtrl=boosted ? ()=>({mode:'dir',dx:0,dy:0,dash:false,od:false,boost:true}) : null;
    emit(`Boost ${boosted?'on':'off'}`);
  } else if(action==='freeze') {
    frozen=!frozen;
    N.G.screen=frozen?'pause':'play';
    emit(frozen?'Frozen scene':'Running scene');
  } else if(action==='benchmark') benchmark();
});
start();
loadGenesisLayers().then(()=>emit(`Pixel look · top-down\nImages ${genesisLayersReady()?'ready':'unavailable: procedural fallback'}`));
