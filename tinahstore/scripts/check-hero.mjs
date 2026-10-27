// Production-bundle checks. Local fixtures only; no account/backend/Unsplash calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const errors = [], results = [], requests = [];
let scenario = '';
const inject = `<script>
window.__heroErrors=[];
addEventListener('error',event=>window.__heroErrors.push(event.message));
addEventListener('unhandledrejection',event=>window.__heroErrors.push(String(event.reason)));
const originalFetch=window.fetch;
window.fetch=(url,options)=>originalFetch.call(window,String(url).includes('/api/v1/')?new URL(url,location.href).pathname:url,options);
const append=Node.prototype.appendChild;
Node.prototype.appendChild=function(node){if(node.tagName==='SCRIPT'&&node.src.includes('accounts.google.com'))return node;return append.call(this,node)};
</script>`;

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    requests.push({ scenario, pathname });
    if (pathname.startsWith('/api/v1/')) {
      const products = [{id:1,slug:'qa-seedling',name:'QA Seedling',category:'Fruit',price:'350',stock:10}];
      const data = pathname.includes('nursery-photos') ? [] : { count: 1, results: products };
      res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify(data)); return;
    }
    if ((scenario === 'failed-secondary' && pathname.endsWith('citrus-seedling.webp')) ||
        (scenario === 'failed-primary' && /nursery-(wide|mobile)\.webp$/.test(pathname))) {
      res.writeHead(503).end(); return;
    }
    const asset = /\.(js|css|png|ico|webp|json)$/.test(pathname);
    const filename = asset ? path.resolve(dist, '.' + decodeURIComponent(pathname)) : path.join(dist, 'index.html');
    if (!filename.startsWith(dist)) { res.writeHead(403).end(); return; }
    let content = await readFile(filename);
    const type = filename.endsWith('.js')?'application/javascript':filename.endsWith('.css')?'text/css':filename.endsWith('.webp')?'image/webp':filename.endsWith('.png')?'image/png':filename.endsWith('.json')?'application/json':'text/html';
    if (type === 'text/css') content = String(content).replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g, '');
    if (!asset) content = String(content).replace('<head>', '<head>' + inject);
    res.writeHead(200, {'Content-Type':type}).end(content);
  } catch { res.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(tmpdir(), 'seedlings-hero-qa-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run',
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', 'about:blank',
], {stdio:'ignore', windowsHide:true});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let port;
  for (let i=0;i<100;i++) {
    try { port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]); break; } catch {}
    await pause(100);
  }
  assert.ok(port, 'Chrome did not start');
  const target=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;
  const pending=new Map();
  socket.addEventListener('message',event=>{
    const result=JSON.parse(event.data), callback=pending.get(result.id);
    if(callback){pending.delete(result.id);result.error?callback.reject(Error(result.error.message)):callback.resolve(result.result);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timed out: '+method));},8000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
    socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description || 'Browser expression failed');
    return result.result?.value;
  };
  const until=async(expression,label)=>{
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}
    throw Error('Timed out: '+label);
  };
  const load=async(name,{width=1280,height=900,touch=false,reduce=false}={})=>{
    scenario='transition';
    await send('Page.navigate',{url:'about:blank'});
    await until('location.href==="about:blank"','previous page closed');
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:touch});
    await send('Emulation.setTouchEmulationEnabled',{enabled:touch,...(touch?{maxTouchPoints:1}:{})});
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
    scenario=name;
    await send('Page.navigate',{url:origin+'/?qa='+name});
    await until('!!document.querySelector(".hero--photographic")','hero render');
  };
  const ready=()=>until('!!document.querySelector(".hero-background.is-ready.is-playing")','loaded desktop slideshow');
  const paused=()=>evaluate('[...document.querySelectorAll(".hero-photo-slide")].every(node=>getComputedStyle(node).animationPlayState==="paused")');
  const test=async(name,run)=>{
    try { await run(); results.push({name,pass:true}); }
    catch(error) { results.push({name,pass:false,error:error.message}); }
    const found=await evaluate('window.__heroErrors||[]'); errors.push(...found);
  };
  const screenshot=async(name)=>{
    const result=await send('Page.captureScreenshot',{format:'png'});
    const filename=path.join(profile,name+'.png');await writeFile(filename,Buffer.from(result.data,'base64'));
    console.log('QA screenshot: '+filename);
  };
  await send('Network.enable'); await send('Network.setCacheDisabled',{cacheDisabled:true});

  await test('desktop loads three local photos with 6s intervals and stationary copy',async()=>{
    await load('desktop'); await ready();
    const data=await evaluate(`({
      sources:[...new Set([...document.querySelectorAll('.hero-background img')].map(node=>new URL(node.src).pathname))],
      slides:[...document.querySelectorAll('.hero-photo-slide')].map(node=>({duration:getComputedStyle(node).animationDuration,delay:getComputedStyle(node).animationDelay})),
      textAnimation:getComputedStyle(document.querySelector('.hero-copy h1')).animationName,
      buttons:[...document.querySelectorAll('.hero-actions a')].map(node=>node.getAttribute('href')),
      padding:getComputedStyle(document.querySelector('.hero')).paddingBottom,
      controls:document.querySelectorAll('.hero button').length
    })`);
    assert.equal(data.sources.length,3); assert.deepEqual(data.slides.map(row=>row.delay),['0s','6s','12s']);
    assert.ok(data.slides.every(row=>row.duration==='18s')); assert.equal(data.textAnimation,'none');
    assert.deepEqual(data.buttons.slice(0,2),['/shop','#about']); assert.equal(data.padding,'48px'); assert.equal(data.controls,0);
    await screenshot('hero-desktop');
  });
  await test('crossfade blends the next photo without exposing an empty frame',async()=>{
    await evaluate(`document.querySelectorAll('.hero-photo-slide').forEach(node=>node.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=6400;}))`);
    const layers=await evaluate(`[...document.querySelectorAll('.hero-photo-slide')].map(node=>({opacity:Number(getComputedStyle(node).opacity),z:Number(getComputedStyle(node).zIndex)}))`);
    assert.equal(layers[0].opacity,1); assert.ok(layers[1].opacity>0.4&&layers[1].opacity<0.6); assert.equal(layers[1].z,3);
    await evaluate(`document.querySelectorAll('.hero-photo-slide').forEach(node=>node.getAnimations().forEach(animation=>{animation.currentTime=18400;}))`);
    const wrap=await evaluate(`[...document.querySelectorAll('.hero-photo-slide')].map(node=>({opacity:Number(getComputedStyle(node).opacity),z:Number(getComputedStyle(node).zIndex)}))`);
    assert.equal(wrap[2].opacity,1); assert.ok(wrap[0].opacity>0.4&&wrap[0].opacity<0.6); assert.equal(wrap[0].z,3);
    await evaluate(`document.querySelectorAll('.hero-photo-slide').forEach(node=>node.getAnimations().forEach(animation=>{animation.currentTime=7000;animation.play();}))`);
  });
  await test('hover pauses all photos immediately and leaving resumes them',async()=>{
    await load('hover'); await ready(); // Fresh CSS animations, not the seeked test animations.
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:300}); await pause(100); assert.ok(await paused());
    const before=await evaluate('document.querySelector(".hero-photo-slide").getAnimations()[0].currentTime');
    await pause(200);
    const after=await evaluate('document.querySelector(".hero-photo-slide").getAnimations()[0].currentTime'); assert.ok(Math.abs(after-before)<2);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0}); await pause(100); assert.ok(!(await paused()));
  });
  await test('keyboard focus pauses the hero while keeping CTA links usable',async()=>{
    await evaluate('document.querySelector(".hero-actions a").focus()'); await pause(80); assert.ok(await paused());
    assert.equal(await evaluate('document.activeElement.getAttribute("href")'),'/shop');
    await evaluate('document.activeElement.blur()'); await pause(80); assert.ok(!(await paused()));
  });
  await test('scrolling the hero offscreen pauses its animation',async()=>{
    await evaluate('window.scrollTo({top:1400,behavior:"instant"})');
    await until('!document.querySelector(".hero-background.is-playing")','offscreen pause'); assert.ok(await paused());
    await evaluate('window.scrollTo({top:0,behavior:"instant"})'); await ready();
  });
  await test('touch/mobile uses only the small static image and keeps spacing',async()=>{
    for(const width of [320,390,768]){
      await load('mobile-'+width,{width,height:844,touch:true});
      await until('document.querySelector(".hero-photo-base img").complete&&document.querySelector(".hero-photo-base img").naturalWidth>0','mobile photo');
      await pause(120);
      assert.equal(await evaluate('document.querySelectorAll(".hero-photo-slide").length'),0);
      assert.ok(await evaluate('document.querySelector(".hero-photo-base img").currentSrc.endsWith("nursery-mobile.webp")'));
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero")).paddingBottom'),'32px');
      assert.ok(!requests.some(row=>row.scenario==='mobile-'+width&&/citrus-seedling|potted-seedlings|nursery-wide/.test(row.pathname)));
      if(width===390)await screenshot('hero-mobile');
    }
  });
  await test('wide touchscreens stay static even at desktop width',async()=>{
    await load('touch-wide',{width:1280,touch:true}); await pause(250);
    assert.equal(await evaluate('document.querySelectorAll(".hero-photo-slide").length'),0);
  });
  await test('reduced motion uses a single static photo',async()=>{
    await load('reduced',{reduce:true}); await pause(200);
    assert.equal(await evaluate('document.querySelectorAll(".hero-photo-slide").length'),0);
    assert.ok(!requests.some(row=>row.scenario==='reduced'&&/citrus-seedling|potted-seedlings/.test(row.pathname)));
  });
  await test('failed secondary image leaves the first photo and text intact',async()=>{
    await load('failed-secondary'); await until('document.querySelector(".hero-photo-base img").naturalWidth>0','fallback photo'); await pause(300);
    assert.equal(await evaluate('document.querySelectorAll(".hero-photo-slide").length'),0);
    assert.ok(await evaluate('!!document.querySelector(".hero-copy h1").textContent'));
  });
  await test('failed primary photo leaves a readable dark fallback and working links',async()=>{
    await load('failed-primary'); await pause(200);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero")).backgroundColor'),'rgb(16, 43, 25)');
    assert.equal(await evaluate('document.querySelector(".hero-actions a").getAttribute("href")'),'/shop');
    assert.equal(await evaluate('document.querySelectorAll(".hero-photo-slide").length'),0);
  });
  console.log(JSON.stringify({results,errors},null,2));
  if(errors.length||results.some(row=>!row.pass))process.exitCode=1;
  await Promise.race([send('Browser.close'),pause(1000)]);
} finally {
  socket?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  setTimeout(()=>process.exit(process.exitCode||0),1500).unref();
}
