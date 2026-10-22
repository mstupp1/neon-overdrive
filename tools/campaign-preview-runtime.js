// Runs in the campaign preview iframe; storage is replaced before the game boots.
import { profile } from '../src/core/storage.js';
import { SYSTEMS } from '../src/game/campaign.js';
import { meta } from '../src/ui/meta.js';
import { ui } from '../src/ui/screens.js';
import { pressStart } from '../src/ui/press.js';
import { intro as bootIntro } from '../src/game/intro.js';

const emit=(status)=>parent.postMessage({kind:'campaign-preview',ready:true,status},parent.location.origin);
const presets={
  fresh:{cleared:[],bestSys:-1,bestRow:-1},
  partial:{cleared:['genesis'],bestSys:1,bestRow:3},
  'all-cleared':{cleared:SYSTEMS.map(system=>system.id),bestSys:3,bestRow:7},
  'clear-precedence':{cleared:['void'],bestSys:-1,bestRow:-1},
};
let current={state:'fresh',info:'shown'};

// Boot starts the title sequence before this preview module is injected. Stop both
// overlays and their delayed callbacks before opening the campaign screen.
pressStart.stop();
bootIntro.abort();

function render(state=current.state,info=current.info,failed=false){
  current={state,info};
  const campaign=presets[state]||presets.fresh;
  profile.campaign.cleared=[...campaign.cleared];
  profile.campaign.bestSys=campaign.bestSys;
  profile.campaign.bestRow=campaign.bestRow;
  window.NEON.G.screen='campaign';
  meta.renderCampaign('VECTOR');
  ui.show('campaign',{focus:document.querySelector('#launch-btn')});
  if(failed){
    const img=document.querySelector('#sys-map .sys-art');
    img.src=new URL('missing-campaign-card.png',import.meta.url).href;
  }
  const detail=campaign.bestSys<0?'no previous run':`best ${SYSTEMS[campaign.bestSys].short} sector ${campaign.bestRow+1}`;
  emit(`${state} · ${detail}\nFirst-run info ${info}\n${failed?'One image forced to fallback':'Artwork loads from campaign-card-v1.png'}`);
}

window.addEventListener('message',({source,data})=>{
  if(source!==parent||data?.kind!=='campaign-preview-action')return;
  if(data.action==='resize'){
    requestAnimationFrame(()=>{ui.refit();emit(`Viewport ${innerWidth} × ${innerHeight}\n${current.state} · first-run info ${current.info}`);});
    return;
  }
  render(data.state,data.info,data.action==='failed-image');
});

render();
