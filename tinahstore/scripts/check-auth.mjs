// Production-build browser checks. All Google/auth/API calls use local fixtures.
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Map();
const index = new Map();
const requests = [];
const previousId = process.env.VITE_GOOGLE_CLIENT_ID;
try {
  for (const [variant, clientId] of [['missing', ''], ['whitespace', '   '], ['configured', 'qa-client.apps.googleusercontent.com']]) {
    process.env.VITE_GOOGLE_CLIENT_ID = clientId;
    const result = await build({ root, logLevel: 'silent', build: { write: false } });
    for (const file of result.output) {
      const content = file.type === 'asset' ? file.source : file.code;
      if (file.fileName === 'index.html') index.set(variant, content);
      else files.set(file.fileName, content);
    }
  }
} finally {
  if (previousId === undefined) delete process.env.VITE_GOOGLE_CLIENT_ID;
  else process.env.VITE_GOOGLE_CLIENT_ID = previousId;
}

const inject = `<script>
window.addEventListener('error', e => parent.errors.push({scenario:parent.scenario,message:e.message}));
window.addEventListener('unhandledrejection', e => parent.errors.push({scenario:parent.scenario,message:String(e.reason)}));
const append = Node.prototype.appendChild;
Node.prototype.appendChild = function(child) {
  if (child.tagName === 'SCRIPT' && child.src.includes('accounts.google.com/gsi/client')) {
    child.src = '/__google?scenario=' + parent.scenario;
    parent.sdkLoads.push(parent.scenario);
  }
  return append.call(this, child);
};
const rewrite = url => {
  const parsed = new URL(url,location.href);
  return parsed.pathname + '?scenario=' + parent.scenario;
};
const open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method,url,...rest) {
  if (String(url).includes('/api/v1/')) url = rewrite(url);
  return open.call(this,method,url,...rest);
};
const fetchOriginal = window.fetch;
window.fetch = (url,options) => fetchOriginal.call(window,String(url).includes('/api/v1/') ? rewrite(url) : url,options);
</script>`;

const page = `<!doctype html><pre id="results">Running</pre><script>
window.scenario=''; window.errors=[]; window.sdkLoads=[]; window.sdkInit=[];
let frame; const results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const doc=()=>frame.contentDocument;
const text=()=>doc()?.body?.innerText||'';
async function until(fn,label) { for(let i=0;i<200;i++){try{if(fn())return;}catch{} await sleep(40);}throw Error('Timed out: '+label+' | '+text().slice(0,200)); }
function assert(condition,label){if(!condition)throw Error(label);}
async function load(name,route='/account',variant='configured',authenticated=false){
  if(frame)frame.remove();
  localStorage.clear();sessionStorage.clear();
  if(authenticated)localStorage.setItem('ts_auth_token','mock-token');
  scenario=name;frame=document.createElement('iframe');frame.width=390;frame.height=844;
  frame.src=route+'?variant='+variant;document.body.append(frame);
  await until(()=>doc()?.querySelector('.account-card input')||text().includes('Seedling Order History'),'account render');
}
const googleButton=()=>[...doc().querySelectorAll('button')].find(b=>/Continue with Google|Sign up with Google/.test(b.textContent));
async function fillForm(values){
  const setter=Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLInputElement.prototype,'value').set;
  const inputs=doc().querySelectorAll('.account-card input');
  values.forEach((value,i)=>{setter.call(inputs[i],value);inputs[i].dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));});
  await sleep(60);doc().querySelector('.account-card').requestSubmit();
}
async function test(name,fn){try{await fn();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:error.message});}}
(async()=>{
  for(const route of ['/account','/signup']){
    await test('missing ID '+route,async()=>{
      const name='missing-'+route.slice(1);await load(name,route,'missing');await sleep(180);
      assert(!googleButton(),'Google button visible without configuration');
      assert(!doc().querySelector('.google-sign-in-divider'),'orphan OR divider');
      assert(!sdkLoads.includes(name),'SDK loaded without configuration');
      assert(doc().querySelector('.account-card input[type=password]'),'password form missing');
    });
  }
  await test('whitespace ID is treated as absent',async()=>{
    await load('whitespace','/account','whitespace');await sleep(180);
    assert(!googleButton()&&!sdkLoads.includes('whitespace'),'whitespace initialized Google');
  });
  await test('email login works without Google',async()=>{
    await load('email-login','/account','missing');
    await fillForm(['grower@example.test','Mock-Password-42!']);
    await until(()=>text().includes('Seedling Order History')&&text().includes('qa-grower'),'email login');
  });
  await test('email signup works without Google',async()=>{
    await load('email-signup','/signup','missing');
    await fillForm(['grower@example.test','Mock-Password-42!','Mock-Password-42!']);
    await until(()=>frame.contentWindow.location.pathname==='/account'&&text().includes('Welcome back'),'signup return to account');
  });
  await test('incorrect email credentials show error without blanking',async()=>{
    await load('email-invalid','/account','missing');
    await fillForm(['grower@example.test','Mock-Password-42!']);
    await until(()=>text().includes('Invalid email or password'),'login error');
    assert(doc().querySelector('.account-card input[type=password]'),'form unmounted');
  });
  await test('saved customer session restores without Google',async()=>{
    await load('restore','/account','missing',true);
    await until(()=>text().includes('Seedling Order History')&&text().includes('qa-grower'),'restored account');
    assert(!sdkLoads.includes('restore'),'SDK loaded on restored account');
  });
  for(const route of ['/account','/signup']){
    await test('configured Google button '+route,async()=>{
      await load('configured-'+route.slice(1),route);
      await until(()=>googleButton(),'Google button');
      assert(!googleButton().disabled,'configured Google disabled');
    });
    await test('SDK blocked '+route,async()=>{
      await load('blocked-'+route.slice(1),route);
      await until(()=>text().includes('Google sign-in is unavailable'),'SDK error fallback');
      assert(doc().querySelector('.account-card input[type=password]'),'email form lost');
    });
    await test('SDK initialization throws '+route,async()=>{
      await load('init-throws-'+route.slice(1),route);
      await until(()=>text().includes('Google sign-in is unavailable'),'initialization fallback');
      assert(doc().querySelector('.account-card input[type=password]'),'email form lost');
    });
  }
  await test('Google login exchanges access token and opens account',async()=>{
    await load('google-login');await until(()=>googleButton(),'Google button');googleButton().click();
    await until(()=>text().includes('Seedling Order History')&&text().includes('qa-grower'),'Google account');
  });
  await test('Google popup errors remain inline',async()=>{
    await load('popup-error');await until(()=>googleButton(),'Google button');googleButton().click();
    await until(()=>text().includes('Google sign-in failed'),'popup error');
    assert(doc().querySelector('.account-card input[type=password]'),'email form lost');
  });
  await test('Google request exceptions remain inline',async()=>{
    await load('request-throws');await until(()=>googleButton(),'Google button');googleButton().click();
    await until(()=>text().includes('Google sign-in failed'),'request error');
    assert(doc().querySelector('.account-card input[type=password]'),'email form lost');
  });
  await test('client-side account navigation works without Google',async()=>{
    await load('navigation','/signup','missing');
    doc().querySelector('a.account-link').click();
    await until(()=>frame.contentWindow.location.pathname==='/account'&&text().includes('Welcome back'),'client navigation');
    assert(!sdkLoads.includes('navigation'),'SDK loaded during navigation');
  });
  document.getElementById('results').textContent=JSON.stringify({results,errors,emptyClientInitializations:sdkInit.filter(v=>!v.hasClientId).length});
  if(frame)frame.remove();
})();</script>`;

const server = createServer(async (req,res) => {
  try {
    const url=new URL(req.url,'http://localhost');
    const scenario=url.searchParams.get('scenario')||'';
    let content,type='text/html',status=200;
    if(url.pathname==='/__checks')content=page;
    else if(url.pathname==='/__google'){
      type='application/javascript';
      if(scenario.startsWith('blocked-')){status=503;content='';}
      else content=`window.google={accounts:{oauth2:{initTokenClient(options){
        parent.sdkInit.push({hasClientId:!!options.client_id,scenario:${JSON.stringify(scenario)}});
        if(!options.client_id)throw Error('Missing required parameter client_id');
        if(${scenario.startsWith('init-throws-')})throw Error('Mock SDK initialization failure');
        return {requestAccessToken(){
          if(${scenario==='request-throws'})throw Error('Mock SDK request failure');
          if(${scenario==='popup-error'})options.error_callback({type:'popup_closed'});
          else options.callback({access_token:'mock-google-access'});
        }};
      }}}};`;
    } else if(url.pathname.startsWith('/api/v1/')){
      let body='';for await(const chunk of req)body+=chunk;
      const data=body?JSON.parse(body):null;
      requests.push({path:url.pathname,method:req.method,scenario,data});
      type='application/json';
      if(url.pathname.endsWith('/auth/user/'))content={username:'qa-grower',email:'grower@example.test'};
      else if(url.pathname.endsWith('/auth/login/')&&scenario==='email-invalid'){status=400;content={non_field_errors:['Invalid credentials']};}
      else if(/\/auth\/(login|google|registration)\/$/.test(url.pathname))content={key:'mock-token'};
      else content={results:[],count:0};
      content=JSON.stringify(content);
    } else if(url.pathname.startsWith('/assets/')){
      const name=url.pathname.slice(1);content=files.get(name);
      if(content===undefined){res.writeHead(404).end();return;}
      type=name.endsWith('.css')?'text/css':'application/javascript';
      if(type==='text/css')content=String(content).replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g,'');
    } else if(/\.(png|ico|json)$/.test(url.pathname)){
      content=await readFile(path.join(root,'public',path.basename(url.pathname)));
      type=url.pathname.endsWith('.json')?'application/json':'image/png';
    } else content=String(index.get(url.searchParams.get('variant')||'missing')).replace('<head>','<head>'+inject);
    res.writeHead(status,{'Content-Type':type});res.end(content);
  }catch(error){res.writeHead(500).end(error.message);}
});
server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const profile=await mkdtemp(path.join(tmpdir(),'seedlings-auth-qa-'));
try {
  const {stdout}=await promisify(execFile)(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run',
      '--user-data-dir='+profile,'--virtual-time-budget=60000','--dump-dom','http://127.0.0.1:'+server.address().port+'/__checks'],
    {timeout:55000,maxBuffer:4*1024*1024});
  const encoded=stdout.match(/<pre id="results">([\s\S]*?)<\/pre>/)?.[1];
  if(!encoded||encoded==='Running')throw Error('Browser checks did not complete.');
  const report=JSON.parse(encoded.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));
  console.log(JSON.stringify(report,null,2));
  const googleExchange=requests.some(r=>r.path.endsWith('/auth/google/')&&r.data.access_token==='mock-google-access'&&!r.data.id_token);
  console.log(JSON.stringify({googleAccessTokenExchangeVerified:googleExchange}));
  if(report.results.some(r=>!r.pass)||report.errors.length||report.emptyClientInitializations||!googleExchange)process.exitCode=1;
} finally {server.closeAllConnections();server.close();}
