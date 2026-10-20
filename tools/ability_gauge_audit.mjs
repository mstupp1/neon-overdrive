// Serve the root, then: node tools/ability_gauge_audit.mjs [http://localhost:8000/]
// PLAYWRIGHT_MODULE can point to a bundled Playwright index.mjs. Saves screenshots under /tmp.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2] || 'http://localhost:8000/';
const output = process.env.GAUGE_AUDIT_OUTPUT || '/tmp/neon-gauge-audit';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
// Preview storage stays in memory in an isolated browser context.
await context.addInitScript({ path: new URL('./background-preview-storage.js', import.meta.url).pathname });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(url);
  await page.waitForFunction(() => window.NEON?.debug);
  await page.evaluate(async () => {
    NEON.skipIntro(); NEON.toTitle(); NEON.startRun('vector'); NEON.comms.skipAll();
    NEON.debug.freeze(true); NEON.input.setDevice('touch');
    NEON.G.banner = null; NEON.G.flash = 0;
    NEON.G.player.x = 225; NEON.G.player.y = 160;
    await (await import('/src/render/gaugeImages.js')).prewarmGaugeImages();
  });
  for (const [width, height] of [[320,568], [375,667], [390,844], [844,390]]) {
    await page.setViewportSize({ width, height });
    for (const side of ['right', 'left']) {
      const result = await page.evaluate(async side => {
        NEON.profile.settings.touchSide = side;
        document.documentElement.style.setProperty('--safe-bottom', '24px');
        document.getElementById('safe-probe').style.paddingLeft = '12px';
        document.getElementById('safe-probe').style.paddingRight = '12px';
        window.dispatchEvent(new Event('resize'));
        const { gaugeSpots } = await import('/src/render/hud.js');
        const origin = document.getElementById('app').getBoundingClientRect();
        return Object.entries(gaugeSpots()).map(([kind, spot]) => {
          const rect = document.getElementById(`touch-${kind}`).getBoundingClientRect();
          return { kind, width:rect.width, height:rect.height,
            dx:rect.x + rect.width/2 - origin.x - spot.x*NEON.view.scale,
            dy:rect.y + rect.height/2 - origin.y - spot.y*NEON.view.scale };
        });
      }, side);
      for (const rect of result) {
        assert.ok(rect.width >= 43.99 && rect.height >= 43.99, JSON.stringify(rect));
        assert.ok(Math.abs(rect.dx)<.05 && Math.abs(rect.dy)<.05, JSON.stringify(rect));
      }
      for (const look of ['off', 'pixel']) {
        await page.evaluate(look => NEON.profile.settings.retro=look, look);
        await page.waitForTimeout(100);
        await page.screenshot({ path: `${output}/${width}-${side}-${look}.png` });
      }
    }
  }
  // Each supported cell count and a dense dash fixture, in five meter states.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => { window.gaugeFixtures=document.createElement('canvas');gaugeFixtures.width=1080;gaugeFixtures.height=1100; });
  for (const n of [1,2,3,4,5,12]) {
    for (const state of ['empty','partial','ready','active','depleted']) {
      await page.evaluate(async ({n,state}) => {
        const p=NEON.G.player;
        const {ULT_CELL}=await import('/src/game/pilot.js');
        p.st.ultCells=Math.min(5,n); p.maxCharges=n; p.st.boostCap=1.75;
        p.charges=state==='empty'||state==='depleted'?0:state==='partial'?Math.max(0,n-1):n;
        p.rechargeT=state==='partial'?p.st.dashRecharge*.4:0;
        p.od=state==='empty'||state==='depleted'?0:state==='partial'?(Math.min(5,n)-.6)*ULT_CELL:Math.min(5,n)*ULT_CELL;
        p.odT=state==='active'?2:0; p.odDurMax=4; p.ultLv=2;
        p.boost=state==='empty'||state==='depleted'?0:state==='partial'?87.5:175;
        p.boosting=state==='active';p.boostLock=state==='depleted';
        NEON.G.director.state='waves'; NEON.profile.settings.touchSide='right';
        window.dispatchEvent(new Event('resize'));
        const {drawHud,gaugeSpots}=await import('/src/render/hud.js');
        const g=gaugeSpots(),ctx=gaugeFixtures.getContext('2d');
        const x=[1,2,3,4,5,12].indexOf(n)*180,y=['empty','partial','ready','active','depleted'].indexOf(state)*220;
        ctx.fillStyle='#070b1b';ctx.fillRect(x,y,180,220);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText(`${n} charges / ${state}`,x+8,y+16);
        ctx.save();ctx.beginPath();ctx.rect(x,y+24,180,196);ctx.clip();ctx.translate(x+8-(g.dash.x-36),y+28-(g.od.y-36));drawHud(ctx);ctx.restore();
      }, {n,state});
      // Render a full HUD into its real Canvas path before advancing to the next state.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
  }
  await writeFile(`${output}/meter-states.png`,Buffer.from((await page.evaluate(()=>gaugeFixtures.toDataURL())).split(',')[1],'base64'));
  console.log('PASS: 4 viewports, both sides, normal/pixel looks, 30 meter fixtures');
  const renderChecks = await page.evaluate(async () => {
    const {drawHud}=await import('/src/render/hud.js');
    const {ULT_CELL}=await import('/src/game/pilot.js');
    const p=NEON.G.player;p.od=ULT_CELL;p.odT=0;p.charges=2;p.maxCharges=3;p.boost=100;p.boostLock=false;p.boosting=false;
    const canvas=document.createElement('canvas');canvas.width=450;canvas.height=NEON.view.H;
    const ctx=canvas.getContext('2d');
    const original=ctx.fillText.bind(ctx),labels={};let captured=[];
    ctx.fillText=(text,...args)=>{captured.push(String(text));original(text,...args);};
    for(const device of ['keyboard','mouse','pad','touch']) {
      NEON.input.device=device;captured=[];drawHud(ctx);labels[device]=captured;
    }
    ctx.fillText=original;
    for(let i=0;i<20;i++)drawHud(ctx);
    const start=performance.now();for(let i=0;i<500;i++)drawHud(ctx);
    return {labels,msPerHud:(performance.now()-start)/500};
  });
  for(const [device,hints] of Object.entries({keyboard:['SPACE','E','SHIFT'],mouse:['LMB','RMB','SHIFT'],pad:['A','B','LB'],touch:['DASH','TAP','HOLD']})) {
    for(const hint of hints)assert.ok(renderChecks.labels[device].includes(hint),`${device}: ${hint}`);
  }
  console.log(`PASS: device hints; cached full HUD draw ${renderChecks.msPerHud.toFixed(3)} ms (local headless Chromium)`);


  // Real browser multi-touch: steer with finger 1 while finger 2 holds boost.
  await page.evaluate(() => {
    NEON.debug.freeze(false);NEON.input.setDevice('touch');
    const p=NEON.G.player;p.boost=175;p.boostLock=false;p.odT=0;p.boosting=false;p.dead=false;p.iframes=100;
    NEON.G.director.state='waves';NEON.G.enemies.length=0;
  });
  const cdp=await context.newCDPSession(page);
  const center=async id=>{const r=await page.locator(id).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
  const boost=await center('#touch-boost');
  const steer={id:1,x:120,y:400};const held={id:2,...boost};
  const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await touch('touchStart',[steer]);await touch('touchStart',[steer,held]);
  await page.waitForTimeout(70);
  assert.ok(await page.evaluate(()=>NEON.input.down('focus')&&NEON.G.player.boosting));
  const before=await page.evaluate(()=>NEON.input.tx);
  await touch('touchMove',[{...steer,x:150},held]);
  assert.notEqual(await page.evaluate(()=>NEON.input.tx),before);
  await touch('touchEnd',[held]);await page.waitForFunction(()=>!NEON.input.down('focus'));
  // A second finger on the field retains the dash gesture.
  await page.evaluate(()=>{NEON.G.player.charges=3;NEON.G.player.maxCharges=3;NEON.G.player.dashT=0;});
  await touch('touchStart',[{...steer,x:150},{id:3,x:240,y:400}]);
  await page.waitForTimeout(40);
  assert.ok(await page.evaluate(()=>NEON.G.player.charges<3));
  await touch('touchEnd',[]);
  // Ultimate uses its aligned target while the steering finger stays active.
  await page.evaluate(()=>{NEON.G.player.od=300;NEON.G.player.odT=0;});
  const ult=await center('#touch-od');
  await touch('touchStart',[steer]);await touch('touchStart',[steer,{id:4,...ult}]);
  await page.waitForTimeout(40);
  assert.ok(await page.evaluate(()=>NEON.G.player.odT>0));
  assert.ok(await page.evaluate(()=>NEON.input.touch!==null));
  await touch('touchEnd',[]);
  // Cancellation, lost capture, blur, and pause must release boost.
  await page.evaluate(()=>document.getElementById('touch-boost').addEventListener('pointerdown',e=>window.gaugePointerId=e.pointerId));
  for (const mode of ['cancel','capture','blur','pause','background']) {
    await page.evaluate(()=>{NEON.startRun('vector');NEON.comms.skipAll();NEON.G.director.state='waves';NEON.G.player.iframes=100;NEON.G.player.boostLock=false;NEON.G.player.boost=100;NEON.input.setDevice('touch');});
    // Menu screens retain hit testing during their 250ms exit transition.
    await page.waitForFunction(({x,y})=>document.elementFromPoint(x,y)?.id==='touch-boost',held);
    await touch('touchStart',[held]);
    await page.waitForFunction(()=>NEON.input.down('focus'),null,{timeout:1500});
    if(mode==='cancel') await touch('touchCancel',[]);
    if(mode==='capture') await touch('touchMove',[{...held,x:held.x-1}]);
    if(mode==='capture') await page.evaluate(()=>{
      const el=document.getElementById('touch-boost');
      el.releasePointerCapture(window.gaugePointerId);
    });
    if(mode==='blur') await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    if(mode==='pause') await page.locator('#pause-btn').dispatchEvent('pointerdown');
    if(mode==='background') await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    if(mode==='capture') await touch('touchMove',[{...held,x:held.x-2}]);
    await page.waitForFunction(()=>!NEON.input.down('focus'),null,{timeout:1500});
    if(mode!=='cancel') await touch('touchEnd',[]);
  }
  console.log('PASS: steering + boost/ultimate, field dash, cancel/lost-capture/blur/pause/background releases');
  // Validate a genuine resource failure in a fresh module cache/browser context.
  const fallback=await browser.newContext({viewport:{width:320,height:568},hasTouch:true});
  await fallback.route('**/assets/hud/*',route=>route.abort());
  const failed=await fallback.newPage();failed.on('pageerror',e=>errors.push(e.message));
  await failed.goto(url);await failed.waitForFunction(()=>window.NEON);
  assert.equal(await failed.evaluate(async()=>{
    const art=await import('/src/render/gaugeImages.js');await art.prewarmGaugeImages();
    NEON.startRun('vector');return ['dash','od','boost'].every(k=>art.gaugeImage(k)===null);
  }),true);
  await failed.waitForTimeout(100);await failed.screenshot({path:`${output}/fallback.png`});
  await fallback.close();
  // Enter free flight through the real campaign flow, including first-visit tutorial dismissal.
  await page.evaluate(()=>{NEON.launch();NEON.comms.skipAll();NEON.visit('market');NEON.comms.skipAll();});
  await page.waitForTimeout(300);await page.locator('#market-leave').click();
  await page.waitForFunction(()=>NEON.G.screen==='overworld');
  await page.evaluate(()=>{
    NEON.comms.skipAll();NEON.debug.freeze(true);NEON.input.setDevice('touch');
    const ow=NEON.G.run.ow,e=ow.exits[0];ow.ease=2;e.seen=true;ow.card=e;
    NEON.G.player.x=e.x;NEON.G.player.y=e.y+100;ow.cam.x=e.x;ow.cam.y=e.y-20;
  });
  for(const [width,height] of [[320,568],[390,844],[844,390]]) {
    await page.setViewportSize({width,height});
    for(const side of ['right','left']) {
      await page.evaluate(side=>{NEON.profile.settings.touchSide=side;window.dispatchEvent(new Event('resize'));},side);
      await page.waitForTimeout(100);
      const clearance=await page.evaluate(async()=>{
        const {gaugeSpots}=await import('/src/render/hud.js');
        const {abilityClusterTop}=await import('/src/ui/ability-layout.js');
        const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),rects=[];
        const stroke=ctx.strokeRect.bind(ctx);ctx.strokeRect=(...r)=>{rects.push(r);stroke(...r)};
        NEON.overworld.drawHud(ctx,true);
        const card=rects.find(r=>r[2]===NEON.view.W-24&&r[3]===108);
        return {cardBottom:card?.[1]+card?.[3],clusterTop:abilityClusterTop(gaugeSpots())};
      });
      assert.ok(clearance.cardBottom<clearance.clusterTop,JSON.stringify(clearance));
      await page.screenshot({path:`${output}/overworld-${width}-${side}.png`});
    }
  }
  console.log('PASS: overworld cards clear the gauges in portrait/landscape on both sides');
  assert.deepEqual(errors,[]);
  console.log(`PASS: image failure fallback, no JS errors. Screenshots: ${output}`);
} finally { await browser.close(); }
