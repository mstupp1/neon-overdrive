// Injected only into the isolated preview iframe, after its in-memory storage shim.
import { profile } from '../src/core/storage.js';
import { ui } from '../src/ui/screens.js';
import { pressStart } from '../src/ui/press.js';
import { intro } from '../src/game/intro.js';

const N = window.NEON;
pressStart.stop();
intro.abort();
profile.settings.story = false;
profile.settings.music = 0;
profile.settings.sfx = 0;
profile.settings.retro = 'off';
profile.seenHelp = profile.seenRunInfo = true;
profile.credits = 10000;
document.querySelector('#notes').hidden = true;
const emit = (status) => parent.postMessage({kind:'location-preview-status', status}, parent.location.origin);
function show(place) {
  N.comms.skipAll();
  if (place === 'fab') N.openFab();
  else {
    N.launch();
    N.G.player.god = true;
    N.G.player.hp = Math.max(1, N.G.player.maxHp - 2);
    if (place === 'dock') N.applyUpgrade('rate');
    N.grant({wallet: 1500});
    N.visit(place);
    N.comms.skipAll();
  }
  emit(`${place} · preview only\nUse the game's normal controls to interact.`);
}
window.addEventListener('message', ({source, data}) => {
  if (source !== parent || data?.kind !== 'location-preview') return;
  if (data.action === 'show') show(data.location);
  if (data.action === 'resize') requestAnimationFrame(() => { ui.refit(); emit(`${N.G.screen} · ${innerWidth} × ${innerHeight}\nSave changes stay in memory.`); });
  if (data.action === 'credits') { N.grant({credits:10000, wallet:1500}); if(N.G.screen==='fab')N.openFab(); emit('Added preview credits.'); }
  if (data.action === 'pixel') profile.settings.retro = profile.settings.retro === 'off' ? 'pixel' : 'off';
  if (data.action === 'fallback') {
    const scene=document.querySelector('.screen.active .service-scene');
    scene?.querySelectorAll(':scope > img').forEach(img=>{img.src=new URL('missing-location-art.png',import.meta.url).href;});
    emit('Scene image failure requested. Controls and Fabricator reel still work.');
  }
});
show('fab');
