// Real-API browser verification. Invoked by Django's disposable LiveServerTestCase.
// Never point this harness at a deployed backend or use real account credentials.
import {createServer, request as httpRequest} from 'node:http';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {homeStats, homeStatsNotice} from '../../tinahstore/src/data/homeStats.js';

const backend = new URL(process.argv[2]);
const focus = process.env.ADMIN_ACTIONS_FOCUS || 'all';
if (!['all', 'catalog-delivery', 'nursery-motion', 'catalog-sync', 'navigation-legal', 'checkout-signup'].includes(focus)) throw Error('Unknown admin-action test focus');
if (process.env.RUN_ADMIN_BROWSER_TESTS !== '1' || backend.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(backend.hostname) || !backend.port) {
  throw Error('Only the opted-in disposable local Django test server is allowed.');
}
const root = fileURLToPath(new URL('../../', import.meta.url));
const adminRoot = path.join(root, 'admin-panel/dist');
const storeRoot = path.join(root, 'tinahstore/dist');
const injection = `<script>
if(parent.checkoutQa)window.open=()=>({opener:null,closed:false,close(){this.closed=true;parent.closedHandoffs++;},location:{replace(url){parent.handoffs.push(url);}}});
if(parent.disableObserver)delete window.IntersectionObserver;
window.addEventListener('error',e=>parent.errors.push(e.message));
window.addEventListener('unhandledrejection',e=>parent.errors.push(String(e.reason)));
const rewrite=url=>{const parsed=new URL(url,location.href);return parsed.pathname+parsed.search;};
const open=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...rest){
 if(String(url).includes('/api/v1/')){
  url=rewrite(url);this.addEventListener('loadend',()=>{
   let detail;try{detail=JSON.parse(this.responseText).detail}catch{}
   parent.requests.push({method,path:url,status:this.status,...(detail?{detail}:{})});
  });
 }
 return open.call(this,method,url,...rest);
};
const originalFetch=window.fetch;
window.fetch=async(url,options)=>{
 const isApi=String(url).includes('/api/v1/');if(isApi)url=rewrite(url);
 const response=await originalFetch.call(window,url,options);
 if(isApi)parent.requests.push({method:options?.method||'GET',path:url,status:response.status});
 return response;
};
const append=Node.prototype.appendChild;
Node.prototype.appendChild=function(child){
 if(child.tagName==='SCRIPT'&&child.src.includes('accounts.google.com'))return child;
 return append.call(this,child);
};
</script>`;

const page = `<!doctype html><pre id="results">Running</pre><script>
window.errors=[];window.requests=[];const results=[];let frame;
window.checkoutQa=${focus === 'checkout-signup'};window.handoffs=[];window.closedHandoffs=0;
const focus=${JSON.stringify(focus)};
const expectedStats=${JSON.stringify(homeStats)};
const expectedStatsNotice=${JSON.stringify(homeStatsNotice)};
const processScreenshots=${process.env.NURSERY_QA_SCREENSHOTS === '1'};
const deferred=['clear original price removes storefront sale price','remove photo does not submit form and persists on save'];
const catalogChecks=new Set([
 'real staff login',
 'create category through admin and expose it through public API',
 'empty admin-created category appears in storefront filters',
 'admin-created category appears in homepage category cards',
 'create product with uploaded image and stock batch',
 'created product and real uploaded photo appear in storefront',
 'assigned category appears in shop and filters its product',
 'initial stock quantity appears on product page',
 'edit price, description, planting guide and stock in admin',
 'updated fields reach storefront after navigation',
 'zero-stock batch is shown as out of stock on storefront',
 'multiple stock batches total correctly on storefront',
 'hide product removes it from public storefront',
 'category rename reaches storefront filter and product detail',
 'product created without batches displays zero stock',
 'all active products remain discoverable beyond the API first page',
 'category links and search find products beyond the first API page',
 'later product page failure shows an error instead of a partial catalog',
 'categories beyond the first API page reach admin and storefront',
 'homepage limits categories and featured seedlings to four',
 'homepage stats appear below hero with current saved figures',
 'stats count once per visit without changing width or accessible values',
 'reduced motion displays final stats immediately',
 'changing motion preference finishes active stats',
 'missing observer leaves stats readable',
 'category fetch failure is readable and retry restores real categories',
 'category layout preserves spacing on mobile and desktop in both themes',
 'services sit between featured seedlings and about with approved content',
 'service links create safe accessible WhatsApp enquiries',
 'service cards preserve spacing and fit mobile and desktop in both themes',
]);
const navigationLegalChecks=new Set([
 'mobile drawer uses 75 percent width with blurred backdrop in both themes',
 'mobile menu closes with backdrop and Escape and restores scrolling and focus',
 'native mobile dialog keeps keyboard focus inside and closes on desktop resize',
 'Our Services navigates from shop and repeated home visits below sticky header',
 'policy links work from menu with active state and accessible page focus',
 'policy pages load directly and fit mobile and desktop in both themes',
 'footer signup and checkout expose policies without changing checkout flow',
 'legal documents retain draft status when printed and do not change shop indexing',
]);
const originalPassword='QA-Original-Password-42!',newPassword='QA-Replaced-Password-73!';
const doc=()=>frame.contentDocument,text=()=>doc()?.body?.innerText||'';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(condition,message)=>{if(!condition)throw Error(message)};
async function until(fn,label){for(let i=0;i<100;i++){try{if(fn())return}catch{}await pause(40)}throw Error('Timed out: '+label+' | '+text().slice(-200));}
async function test(name,run){
 if(focus==='catalog-sync'&&!catalogChecks.has(name))return;
 if(focus==='navigation-legal'&&!navigationLegalChecks.has(name))return;
 if(focus!=='all'&&deferred.includes(name)){
  results.push({name,skipped:true,reason:'Known product-form issue outside the catalog/delivery fix'});return;
 }
 try{await run();results.push({name,pass:true})}catch(error){results.push({name,pass:false,error:error.message})}
}
async function load(route,ready,width=1280,height=1000){
 if(frame)frame.remove();frame=document.createElement('iframe');frame.width=width;frame.height=height;
 const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
 frame.src=route;document.body.append(frame);await loaded;await until(ready,route+' render');
}
function set(input,value){
 assert(input,'Input not found');
 const cls=input.tagName==='SELECT'?'HTMLSelectElement':input.tagName==='TEXTAREA'?'HTMLTextAreaElement':'HTMLInputElement';
 Object.getOwnPropertyDescriptor(frame.contentWindow[cls].prototype,'value').set.call(input,value);
 input.dispatchEvent(new frame.contentWindow.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));
}
function field(label){return [...doc().querySelectorAll('label')].find(el=>el.textContent.trim().startsWith(label))?.parentElement.querySelector('input,textarea,select')}
function button(label){return [...doc().querySelectorAll('button')].find(el=>el.textContent.trim()===label)}
async function submit(form){await pause(80);assert(form.checkValidity(),'Test form invalid');form.requestSubmit();}
async function api(route,method='GET',data){
 const response=await fetch('/api/v1'+route,{method,headers:{'Content-Type':'application/json',Authorization:'AdminToken '+sessionStorage.getItem('ts_admin_token')},body:data?JSON.stringify(data):undefined});
 const result=response.status===204?null:await response.json();return {status:response.status,data:result};
}
async function upload(color,name){
 const canvas=doc().createElement('canvas');canvas.width=120;canvas.height=80;
 const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,120,80);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 const file=new frame.contentWindow.File([blob],name,{type:'image/png'});
 const transfer=new frame.contentWindow.DataTransfer();transfer.items.add(file);
 const input=doc().querySelector('input[type=file]');input.files=transfer.files;
 input.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));await pause(60);
}
const inventory=()=>text().includes('Store Inventory');
const editReady=()=>[...doc().querySelectorAll('input')].some(el=>el.value==='qa-browser-seedling');
async function edit(){await load('/products/qa-browser-seedling/edit',editReady)}
async function saveProduct(){await submit(doc().querySelector('form'));await until(inventory,'saved inventory')}
async function login(password){set(doc().getElementById('admin-username'),'qa-actions-staff');set(doc().getElementById('admin-password'),password);await submit(doc().querySelector('form'))}
async function settings(){
 const start=requests.length;
 await load('/settings',()=>text().includes('Security & Password'));
 await until(()=>requests.slice(start).some(row=>row.method==='GET'&&row.path==='/api/v1/orders/delivery-settings/'&&row.status===200),'delivery settings fetched');
 await pause(80);
}
async function passwordForm(old,next,confirm=next){
 set(field('Current Password'),old);set(field('New Password'),next);set(field('Confirm New Password'),confirm);
 await submit(field('Current Password').closest('form'));
}
(async()=>{
 localStorage.clear();sessionStorage.clear();
 if(focus==='checkout-signup'){
  const password='Orchard-42!Verification-Leaf9';
  async function signup(email){
   await load('/signup',()=>doc().querySelector('input[type=email]'),390,844);
   const inputs=doc().querySelectorAll('.account-card input');
   [email,password,password].forEach((value,index)=>set(inputs[index],value));
   await submit(doc().querySelector('form'));
  }
  await test('real email signup signs customer in and opens account',async()=>{
   await signup('qa-customer-one@example.test');
   await until(()=>text().includes('Seedling Order History'),'signed-in customer account');
   assert(frame.contentWindow.location.pathname==='/account','Signup did not open account');
   assert(localStorage.getItem('ts_auth_token'),'Application token missing after signup');
  });
  await test('real customer session survives page reload',async()=>{
   await load('/account',()=>text().includes('Seedling Order History'),390,844);
   assert(text().includes('qa-customer-one'),'Reloaded account is not the created customer');
  });
  await test('second real email signup also succeeds',async()=>{
   button('Sign out').click();await pause(60);
   await signup('qa-customer-two@example.test');
   await until(()=>text().includes('Seedling Order History')||doc().querySelector('[role=alert]'),'second customer signup');
   assert(!doc().querySelector('[role=alert]'),'Second signup failed: '+doc().querySelector('[role=alert]')?.textContent);
   assert(text().includes('qa-customer-two'),'Second customer profile incorrect');
  });
  await test('real duplicate signup is readable and preserves entered values',async()=>{
   if(button('Sign out'))button('Sign out').click();await pause(60);
   await signup('QA-CUSTOMER-TWO@EXAMPLE.TEST');
   await until(()=>doc().querySelector('[role=alert]'),'duplicate signup error');
   const alert=doc().querySelector('[role=alert]').textContent;
   assert(alert.includes('sign in')&&!alert.includes('{'),'Duplicate email message is not readable');
   assert(doc().querySelector('input[type=email]').value==='QA-CUSTOMER-TWO@EXAMPLE.TEST','Email was cleared');
   assert(doc().querySelector('input[type=password]').value===password,'Password was cleared');
   assert(!localStorage.getItem('ts_auth_token'),'Failed signup stored token');
  });
  let product,orderNumber;
  await test('admin-created batch stock is accepted by real WhatsApp checkout',async()=>{
   const login=await fetch('/api/v1/admin/auth/login/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'qa-actions-staff',password:originalPassword})});
   assert(login.status===200,'QA staff login failed');sessionStorage.setItem('ts_admin_token',(await login.json()).token);
   const categories=await api('/categories/'),category=(categories.data.results||categories.data)[0];
   const created=await api('/products/','POST',{name:'QA Checkout Seedling',slug:'qa-checkout-seedling',category_id:category.id,price:'350.00',description:'Disposable checkout test',variants_json:[{stock:5},{stock:6}]});
   assert(created.status===201,'QA batch product creation failed');
   product=(await api('/products/qa-checkout-seedling/')).data;
   assert(product.stock===11&&product.variants.length===2,'Public stock total incorrect');
   localStorage.setItem('ts_cart',JSON.stringify([{productId:product.id,product,quantity:8}]));
   await load('/checkout',()=>doc().querySelector('.checkout-submit'),390,844);
   const contact={fullName:'QA Grower',email:'checkout@example.test',phone:'0712345678',county:'Kiambu',city:'Ruiru',address:'QA Farm near market'};
   Object.entries(contact).forEach(([name,value])=>set(doc().querySelector('[name='+name+']'),value));
   await submit(doc().querySelector('form'));
   await until(()=>frame.contentWindow.location.pathname==='/confirmation','saved checkout confirmation');
   orderNumber=new URL(frame.contentWindow.location.href).searchParams.get('order');
   const saved=await api('/orders/'+orderNumber+'/');
   assert(saved.data.items.length===1&&saved.data.items[0].quantity===8,'Stock allocation split customer receipt lines');
   assert(saved.data.status==='pending_confirmation'&&saved.data.delivery_fee===null&&!saved.data.deposit_paid,'WhatsApp order terms changed');
   assert(JSON.parse(localStorage.getItem('ts_cart')).length===0,'Saved checkout did not clear cart');
   assert(handoffs.length===1&&handoffs[0].startsWith('https://wa.me/'),'Prepared WhatsApp handoff missing');
   assert((await api('/products/qa-checkout-seedling/')).data.stock===3,'Stock was not deducted from batches');
  });
  await test('real stock shortage identifies seedling and retains cart and delivery form',async()=>{
   localStorage.setItem('ts_cart',JSON.stringify([{productId:product.id,product,quantity:4}]));
   await load('/checkout',()=>doc().querySelector('.checkout-submit'),390,844);
   const contact={fullName:'QA Retained Grower',email:'retry@example.test',phone:'0712345678',county:'Kiambu',city:'Ruiru',address:'QA Retained Farm'};
   Object.entries(contact).forEach(([name,value])=>set(doc().querySelector('[name='+name+']'),value));
   await submit(doc().querySelector('form'));
   await until(()=>doc().querySelector('[role=alert]'),'stock shortage');
   const alert=doc().querySelector('[role=alert]');
   assert(alert.textContent.includes('QA Checkout Seedling: requested 4, available 3.'),'Per-seedling shortage details missing');
   assert(!alert.textContent.includes('{')&&alert.querySelector('a').getAttribute('href')==='/cart','Raw JSON or edit-cart action missing');
   assert(doc().querySelector('[name=fullName]').value==='QA Retained Grower'&&doc().querySelector('[name=address]').value==='QA Retained Farm','Delivery fields were cleared');
   assert(JSON.parse(localStorage.getItem('ts_cart'))[0].quantity===4,'Failed checkout changed the cart');
   assert(handoffs.length===1&&closedHandoffs===1,'Failed checkout attempted WhatsApp handoff');
   for(const width of [320,390,768,1280]){
    frame.width=width;await pause(50);assert(doc().documentElement.scrollWidth<=doc().documentElement.clientWidth+1,'Checkout error overflows at '+width);
   }
   frame.width=390;
  });
  await test('checkout retry succeeds after admin replenishes stock without re-entering details',async()=>{
   const fresh=(await api('/products/qa-checkout-seedling/')).data;
   const updated=await api('/products/qa-checkout-seedling/','PATCH',{variants_json:JSON.stringify(fresh.variants.map((batch,index)=>({...batch,stock:index===0?4:3})))});
   assert(updated.status===200,'Stock replenishment failed');
   await submit(doc().querySelector('form'));
   await until(()=>frame.contentWindow.location.pathname==='/confirmation','retried checkout confirmation');
   const number=new URL(frame.contentWindow.location.href).searchParams.get('order');
   assert(number!==orderNumber,'New checkout reused an existing saved order');
   const saved=await api('/orders/'+number+'/');
   assert(saved.data.customer_name==='QA Retained Grower'&&saved.data.delivery_address==='QA Retained Farm','Retried details were not retained');
   assert(handoffs.length===2,'Successful retry did not prepare WhatsApp handoff');
   assert((await api('/products/qa-checkout-seedling/')).data.stock===3,'Retried order stock incorrect');
   await api('/orders/'+number+'/','PATCH',{status:'cancelled'});
   await api('/orders/'+number+'/','PATCH',{status:'cancelled'});
   assert((await api('/products/qa-checkout-seedling/')).data.stock===7,'Cancellation did not restore exact stock once');
  });
  document.getElementById('results').textContent=JSON.stringify({focus,results,errors,failedRequests:requests.filter(row=>row.status>=400)});
  if(frame)frame.remove();return;
 }
 if(focus==='navigation-legal'){
  const menu=()=>doc().getElementById('mobile-menu');
  const trigger=()=>doc().querySelector('.nav-toggle');
  const openMenu=async()=>{trigger().click();await until(()=>menu().open,'mobile dialog opens');await pause(260);};
  const closeMenu=async()=>{menu().querySelector('[aria-label="Close menu"]').click();await until(()=>!menu().open,'mobile dialog closes');};
  await test('mobile drawer uses 75 percent width with blurred backdrop in both themes',async()=>{
   await fetch('/__motion?reduce=1');
   try{
    for(const theme of ['dark','light']){
     localStorage.setItem('tinahstore-theme',theme);
     for(const width of [320,390,480,768,900]){
      await load('/shop',()=>trigger(),width,844);await openMenu();
      const win=frame.contentWindow,dialog=menu(),bounds=dialog.getBoundingClientRect();
      assert(Math.abs(bounds.width-win.innerWidth*.75)<1,'Drawer is not 75 percent at '+width);
      assert(Math.abs(bounds.left-win.innerWidth*.25)<1&&Math.abs(bounds.right-win.innerWidth)<1,'Drawer is not right-aligned');
      const backdrop=win.getComputedStyle(dialog,'::backdrop');
      assert(backdrop.backdropFilter.includes('blur(6px)'),'Backdrop blur missing');
      assert(doc().body.style.overflow==='hidden','Background scroll is not locked');
      assert(dialog.scrollWidth<=dialog.clientWidth,'Drawer overflows horizontally');
      assert(dialog.querySelector('.mobile-menu-header').scrollWidth<=dialog.querySelector('.mobile-menu-header').clientWidth,'Drawer branding crowds close control');
      for(const link of dialog.querySelectorAll('nav a'))assert(link.getBoundingClientRect().height>=44,'Menu target too short');
      assert(dialog.querySelector('a[href="/#services"]').textContent.includes('Our Services'),'Services menu link missing');
      assert(dialog.querySelectorAll('.legal-links a').length===2,'Menu policy links missing');
      if(processScreenshots&&[320,390].includes(width))await fetch('/__screenshot?name=menu-'+theme+'-'+width+'&width='+width+'&height=900');
      await closeMenu();assert(doc().body.style.overflow==='','Background scrolling was not restored');
     }
    }
   }finally{await fetch('/__motion?reduce=0');}
  });
  await test('mobile menu closes with backdrop and Escape and restores scrolling and focus',async()=>{
   await load('/shop',()=>trigger(),390,844);trigger().focus();await openMenu();
   const rect=frame.getBoundingClientRect();
   await fetch('/__pointer-click?x='+Math.round(rect.left+frame.contentWindow.innerWidth*.125)+'&y='+Math.round(rect.top+240));
   await until(()=>!menu().open,'blurred backdrop dismisses drawer');
   assert(doc().body.style.overflow==='','Backdrop close left body locked');
   await openMenu();await fetch('/__keyboard-escape');await until(()=>!menu().open,'Escape dismisses drawer');
   assert(doc().body.style.overflow==='','Escape close left body locked');
   assert(doc().activeElement===trigger(),'Escape did not restore trigger focus');
  });
  await test('native mobile dialog keeps keyboard focus inside and closes on desktop resize',async()=>{
   await load('/shop',()=>trigger(),320,400);trigger().focus();await openMenu();
   assert(doc().activeElement===menu().querySelector('[aria-label="Close menu"]'),'Initial menu focus is incorrect');
   for(let index=0;index<16;index++){
    await fetch('/__keyboard-tab');assert(menu().contains(doc().activeElement),'Tab escaped modal dialog');
   }
   frame.width=1024;await until(()=>!menu().open,'desktop resize closes dialog');
   assert(doc().body.style.overflow==='','Resize left body locked');
   assert(frame.contentWindow.getComputedStyle(doc().querySelector('.main-nav')).display!=='none','Desktop navigation did not return');
  });
  await test('Our Services navigates from shop and repeated home visits below sticky header',async()=>{
   await fetch('/__motion?reduce=1');
   try{
    await load('/shop',()=>trigger(),390,844);await openMenu();menu().querySelector('a[href="/#services"]').click();
    await until(()=>frame.contentWindow.location.pathname==='/'&&frame.contentWindow.location.hash==='#services'&&doc().querySelector('#services'),'Services route');
    await until(()=>!menu().open&&Math.abs(doc().querySelector('#services').getBoundingClientRect().top-160)<3,'Services jump after catalogue loading');
    assert(doc().body.style.overflow==='','Services navigation left body locked');
    assert(doc().querySelector('#services').getBoundingClientRect().top>=doc().querySelector('.site-header').getBoundingClientRect().bottom,'Services heading obscured by header');
    await openMenu();assert(menu().querySelector('a[href="/#services"]').getAttribute('aria-current')==='location','Services menu active state missing');await closeMenu();
    doc().querySelector('.hero').scrollIntoView({behavior:'instant'});await openMenu();menu().querySelector('a[href="/#services"]').click();
    await until(()=>Math.abs(doc().querySelector('#services').getBoundingClientRect().top-160)<3,'Repeated Services link scroll');
   }finally{await fetch('/__motion?reduce=0');}
  });
  await test('policy links work from menu with active state and accessible page focus',async()=>{
   await load('/shop',()=>trigger(),390,844);
   for(const [path,title] of [['/privacy-policy','Privacy Policy'],['/terms-of-service','Terms of Service']]){
    await openMenu();menu().querySelector('a[href="'+path+'"]').click();
    await until(()=>frame.contentWindow.location.pathname===path&&doc().querySelector('.legal-page h1')?.textContent===title,'policy route');
    await until(()=>!menu().open&&doc().activeElement===doc().querySelector('.legal-page h1'),'policy heading receives focus after dialog closes');
    assert(doc().body.style.overflow==='','Policy navigation left scrolling locked');
    await openMenu();assert(menu().querySelector('a[href="'+path+'"]').getAttribute('aria-current')==='page','Policy menu active state missing');await closeMenu();
   }
  });
  await test('policy pages load directly and fit mobile and desktop in both themes',async()=>{
   for(const theme of ['dark','light']){
    localStorage.setItem('tinahstore-theme',theme);
    for(const width of [320,390,768,1280]){
     for(const [path,title] of [['/privacy-policy','Privacy Policy'],['/terms-of-service','Terms of Service']]){
      await load(path,()=>doc().querySelector('.legal-body'),width,844);
      assert(doc().querySelectorAll('h1').length===1&&doc().querySelector('h1').textContent===title,'Policy heading missing');
      assert(doc().documentElement.scrollWidth<=width,'Policy overflows at '+width+' in '+theme);
      assert(doc().querySelector('.legal-draft').textContent.includes('Draft for business review'),'Policy is not marked for review');
      assert(doc().querySelector('time').dateTime==='2026-10-28','Wrong policy update date');
      assert(doc().querySelector('meta[name=robots]')?.content==='noindex,follow','Draft policy is indexed');
      assert(doc().title.includes(title),'Policy page title missing');
      if(processScreenshots)await pause(350); // Let the theme transition settle before captures.
      for(const link of doc().querySelectorAll('.legal-toc a'))assert(doc().getElementById(link.hash.slice(1)),'Broken policy contents link');
      assert(doc().querySelector('.legal-body a[href="mailto:savannahseedlings@gmail.com"]'),'Policy contact email missing');
      if(path==='/privacy-policy')for(const text of ['Telegram','WhatsApp','local browser storage','before WhatsApp opens'])assert(doc().querySelector('.legal-body').textContent.includes(text),'Privacy disclosure missing: '+text);
      else assert(doc().querySelector('.legal-body').textContent.includes('does not impose a blanket no-refund rule'),'Consumer rights preservation missing');
      if(processScreenshots&&width===390&&path==='/privacy-policy')await fetch('/__screenshot?name=privacy-'+theme+'-390&width=390&height=900');
     }
    }
   }
  });
  await test('footer signup and checkout expose policies without changing checkout flow',async()=>{
   await load('/shop',()=>doc().querySelector('.site-footer .legal-links'),390);
   assert(doc().querySelectorAll('.site-footer .legal-links a').length===2,'Full footer policy links missing');
   await load('/signup',()=>doc().querySelector('.policy-form-note'),390);
   assert(doc().querySelectorAll('.policy-form-note a').length===2,'Signup policy links missing');
   const product={id:987,slug:'qa-legal-seedling',name:'QA Legal Seedling',price:'350.00',stock:4};
   localStorage.setItem('ts_cart',JSON.stringify([{productId:product.id,product,quantity:1}]));
   await load('/checkout',()=>doc().querySelector('.checkout-submit'),390);
   assert(doc().querySelectorAll('.policy-form-note a').length===2,'Checkout policy notice missing');
   assert(doc().querySelectorAll('.site-footer .legal-links a').length===2,'Compact footer policy links missing');
   for(const link of doc().querySelectorAll('.policy-form-note a'))assert(link.target==='_blank'&&link.relList.contains('noopener'),'Policy link discards unsaved form');
   assert(doc().querySelector('.checkout-submit').textContent.includes('Save order & continue on WhatsApp'),'Checkout action changed');
   for(const link of doc().querySelectorAll('.site-footer .legal-links a'))assert(link.target==='_blank','Checkout footer policy link loses form state');
   assert(!doc().querySelector('input[type=checkbox]'),'New mandatory policy acceptance was silently added');
   localStorage.removeItem('ts_cart');
  });
  await test('legal documents retain draft status when printed and do not change shop indexing',async()=>{
   await load('/terms-of-service',()=>doc().querySelector('.legal-draft'),1280);
   await fetch('/__print?enabled=1');
   try{
    assert(frame.contentWindow.getComputedStyle(doc().querySelector('.site-header')).display==='none','Printed policy includes navigation');
    assert(frame.contentWindow.getComputedStyle(doc().querySelector('.legal-draft')).display!=='none','Print hides draft status');
    assert(doc().querySelector('.legal-body').textContent.includes('Contact Savannah Seedlings'),'Print lacks contact details');
   }finally{await fetch('/__print?enabled=0');}
   await load('/shop',()=>text().includes('Shop all fruit seedlings'));
   assert(!doc().querySelector('meta[name=robots][content*="noindex"]'),'Draft indexing policy leaked to shop');
  });
 }
 await test('real staff login',async()=>{
  await load('/login',()=>doc().getElementById('admin-username'));await login(originalPassword);
  await until(()=>text().includes('Recent Orders'),'dashboard');
 });
 if(focus==='catalog-sync'){
  await test('create category through admin and expose it through public API',async()=>{
   await load('/categories',()=>field('Category Name'));
   set(field('Category Name'),'QA Browser Citrus');
   set(field('Description'),'Created through the real admin category form');
   const start=requests.length;await submit(doc().querySelector('form'));
   await until(()=>requests.slice(start).some(row=>row.method==='POST'&&row.path==='/api/v1/categories/'),'category create response');
   assert(requests.slice(start).find(row=>row.method==='POST'&&row.path==='/api/v1/categories/').status===201,'Category creation failed');
   await until(()=>[...doc().querySelectorAll('td')].some(el=>el.textContent==='QA Browser Citrus'),'saved category in admin table');
   const response=await fetch('/api/v1/categories/'),data=await response.json();
   assert(response.status===200&&(data.results||data).some(row=>row.name==='QA Browser Citrus'&&row.slug==='qa-browser-citrus'),'Created category missing from public category API');
  });
  await test('empty admin-created category appears in storefront filters',async()=>{
   await load('/shop',()=>text().includes('No seedlings match those filters'));
   await until(()=>doc().querySelectorAll('.filter-row').length===2,'empty categories fetched');
   assert([...doc().querySelectorAll('.filter-row')].some(el=>el.textContent.includes('QA Browser Citrus')),'Empty category is absent: shop derives filters from products, not the categories API');
  });
  await test('admin-created category appears in homepage category cards',async()=>{
   await load('/',()=>doc().querySelectorAll('.cat-card').length===2);
   assert([...doc().querySelectorAll('.cat-card')].some(el=>el.textContent.includes('QA Browser Citrus')),'Homepage category cards are hardcoded; admin-created category does not appear');
   const card=[...doc().querySelectorAll('.cat-card')].find(el=>el.textContent.includes('QA Browser Citrus'));
   assert(card.getAttribute('href')==='/shop?category=qa-browser-citrus','Category link uses search text instead of its slug');
   assert(card.textContent.includes('Created through the real admin category form'),'Category description was ignored');
  });
 }
 await test('create product with uploaded image and stock batch',async()=>{
  await load('/products/new',()=>field('Seedling Variety Name'));
  set(field('Seedling Variety Name'),'QA Browser Seedling');set(field('Description'),'QA original description');
  const categoryName=focus==='catalog-sync'?'QA Browser Citrus':'QA Fruit';
  await until(()=>[...field('Fruit Category').options].some(option=>option.text===categoryName),'categories');
  set(field('Fruit Category'),[...field('Fruit Category').options].find(option=>option.text===categoryName).value);
  set(field('Price per Seedling'),'350');set(field('Original Price'),'600');
  button('Add Batch').click();await pause(60);set(field('Size'),'Regular');set(field('Stock'),'17');
  await upload('#2e7d32','qa-first.png');await saveProduct();
  const saved=await api('/products/qa-browser-seedling/');
  assert(saved.status===200&&saved.data.images.length===1&&saved.data.variants[0].stock===17,'Uploaded product was not persisted');
 });
 await test('created product and real uploaded photo appear in storefront',async()=>{
  await load('/shop',()=>doc().querySelector('.product-card'));
  const card=[...doc().querySelectorAll('.product-card')].find(el=>el.textContent.includes('QA Browser Seedling'));
  assert(card,'Product not present in shop');const image=card.querySelector('img.product-image');
  await until(()=>image?.complete&&image.naturalWidth>0,'uploaded photo loads');
  assert(card.textContent.includes('350'),'Shop price incorrect');
 });
 if(focus==='catalog-sync'){
  await test('assigned category appears in shop and filters its product',async()=>{
   await load('/shop',()=>doc().querySelector('.product-card'));
   const filter=[...doc().querySelectorAll('.filter-row')].find(el=>el.textContent.includes('QA Browser Citrus'));
   assert(filter,'Assigned category missing from shop filter');filter.querySelector('input').click();await pause(100);
   const cards=[...doc().querySelectorAll('.product-card')];
   assert(cards.length===1&&cards[0].textContent.includes('QA Browser Seedling'),'Category filter does not show assigned product');
   assert(cards[0].querySelector('.cat').textContent==='QA Browser Citrus','Product card category incorrect');
  });
  await test('initial stock quantity appears on product page',async()=>{
   await load('/product/qa-browser-seedling',()=>doc().querySelector('.stock-note'));
   assert(doc().querySelector('.stock-note').textContent.includes('17 seedlings available'),'Initial stock is not 17');
   const saved=await api('/products/qa-browser-seedling/');assert(saved.data.stock===17,'Detail API stock disagrees with batch');
  });
 }
 await test('edit price, description, planting guide and stock in admin',async()=>{
  await edit();set(field('Price per Seedling'),'425.50');set(field('Description'),'QA updated description');
  set(field('Planting & Care Procedure'),'QA updated planting instructions');set(field('Stock'),'7');await saveProduct();
  const saved=await api('/products/qa-browser-seedling/');assert(saved.data.price==='425.50'&&saved.data.variants[0].stock===7,'Product edit not persisted');
 });
 await test('updated fields reach storefront after navigation',async()=>{
  await load('/product/qa-browser-seedling',()=>doc().querySelector('.pd-desc'));
  assert(text().includes('QA updated description'),'Updated description missing');
  assert(text().includes('425.5'),'Updated price missing');
  assert(text().includes('QA updated planting instructions'),'Updated planting guide missing');
  assert(text().includes('7 seedlings available'),'Updated variant stock missing');
 });
 await test('zero-stock batch is shown as out of stock on storefront',async()=>{
  await edit();set(field('Stock'),'0');await saveProduct();
  await load('/product/qa-browser-seedling',()=>doc().querySelector('.stock-note'));
  assert(doc().querySelector('.stock-note').textContent.includes('Out of stock'),'Zero batch stock fell back to another value');
  await edit();set(field('Stock'),'7');await saveProduct();
 });
 if(focus==='catalog-sync'){
  await test('multiple stock batches total correctly on storefront',async()=>{
   await edit();button('Add Batch').click();await pause(80);
   const stocks=[...doc().querySelectorAll('label')].filter(el=>el.textContent.trim()==='Stock').map(el=>el.parentElement.querySelector('input'));
   assert(stocks.length===2,'Second stock batch not added');set(stocks[0],'7');set(stocks[1],'5');await saveProduct();
   const listing=await api('/products/'),detail=await api('/products/qa-browser-seedling/');
   assert(listing.data.results.find(row=>row.slug==='qa-browser-seedling').stock===12&&detail.data.stock===12,'API stock total is not 7 + 5 = 12');
   await load('/product/qa-browser-seedling',()=>doc().querySelector('.stock-note'));
   assert(doc().querySelector('.stock-note').textContent.includes('12 seedlings available'),'Storefront does not show summed batch stock');
  });
 }
 await test('add a second photo and show it in storefront gallery',async()=>{
  await edit();await upload('#e67e22','qa-second.png');await saveProduct();
  await load('/product/qa-browser-seedling',()=>doc().querySelector('.pd-desc'));
  await until(()=>doc().querySelectorAll('.thumb-row img').length===2,'gallery thumbnails');
  for(const image of doc().querySelectorAll('.pd-gallery img'))await until(()=>image.complete&&image.naturalWidth>0,'gallery image');
 });
 await test('clear original price removes storefront sale price',async()=>{
  await edit();set(field('Original Price'),'');await saveProduct();
  const saved=await api('/products/qa-browser-seedling/');assert(saved.data.original_price===null,'Cleared price stayed at '+saved.data.original_price);
 });
 await test('remove photo does not submit form and persists on save',async()=>{
  await edit();const before=requests.filter(row=>row.method==='PATCH'&&row.path==='/api/v1/products/qa-browser-seedling/').length;
  doc().querySelector('button[title="Remove"]').click();await pause(300);
  const after=requests.filter(row=>row.method==='PATCH'&&row.path==='/api/v1/products/qa-browser-seedling/').length;
  assert(after===before,'Remove photo unexpectedly submitted the whole product form');
  await saveProduct();const saved=await api('/products/qa-browser-seedling/');assert(saved.data.images.length===1,'Removed photo still exists after save');
 });
 await test('hide product removes it from public storefront',async()=>{
  await edit();[...doc().querySelectorAll('button')].find(el=>el.className.includes('w-11')).click();await saveProduct();
  const saved=await api('/products/qa-browser-seedling/');assert(saved.data.is_active===false,'Visibility change did not persist');
  const start=requests.length;
  await load('/shop',()=>text().includes('Shop all fruit seedlings'));
  await until(()=>requests.slice(start).some(row=>row.method==='GET'&&row.path.startsWith('/api/v1/products/')&&row.status===200),'fresh catalog');
  await pause(150);assert(![...doc().querySelectorAll('.product-card')].some(el=>el.textContent.includes('QA Browser Seedling')),'Hidden product is still listed in public shop');
  const hidden=await fetch('/api/v1/products/qa-browser-seedling/');assert(hidden.status===404,'Anonymous product URL is still visible');
  await edit();[...doc().querySelectorAll('button')].find(el=>el.className.includes('w-11')).click();await saveProduct();
  await load('/shop',()=>doc().querySelector('.product-card'));
  assert(text().includes('QA Browser Seedling'),'Reactivated product did not return to shop');
 });
 if(focus==='catalog-sync'){
  await test('category rename reaches storefront filter and product detail',async()=>{
   await load('/categories',()=>[...doc().querySelectorAll('td')].some(el=>el.textContent==='QA Browser Citrus'));
   const row=[...doc().querySelectorAll('tr')].find(el=>el.querySelector('td')?.textContent==='QA Browser Citrus');
   row.querySelector('button').click();await pause(80);set(field('Category Name'),'QA Renamed Citrus');
   const start=requests.length;await submit(doc().querySelector('form'));
   await until(()=>requests.slice(start).some(row=>row.method==='PATCH'&&row.path==='/api/v1/categories/qa-browser-citrus/'),'category rename response');
   assert(requests.slice(start).find(row=>row.method==='PATCH'&&row.path==='/api/v1/categories/qa-browser-citrus/').status===200,'Category rename failed');
   await load('/shop',()=>doc().querySelector('.product-card'));
   assert([...doc().querySelectorAll('.filter-row')].some(el=>el.textContent.includes('QA Renamed Citrus')),'Renamed category missing from filter');
   assert(doc().querySelector('.product-card .cat').textContent==='QA Renamed Citrus','Product card retains old category name');
   await load('/product/qa-browser-seedling',()=>doc().querySelector('.stock-note'));
   assert(doc().querySelector('.pd-info .eyebrow').textContent.includes('QA Renamed Citrus'),'Product detail retains old category name');
   await load('/',()=>[...doc().querySelectorAll('.cat-card')].some(el=>el.textContent.includes('QA Renamed Citrus')));
   const card=[...doc().querySelectorAll('.cat-card')].find(el=>el.textContent.includes('QA Renamed Citrus'));
   assert(card.getAttribute('href')==='/shop?category=qa-renamed-citrus','Homepage link retained the old category slug');
  });
  await test('product created without batches displays zero stock',async()=>{
   await load('/products/new',()=>field('Seedling Variety Name'));
   set(field('Seedling Variety Name'),'QA No Batch Seedling');set(field('Description'),'No stock batch has been added');
   await until(()=>[...field('Fruit Category').options].some(option=>option.text==='QA Fruit'),'categories');
   set(field('Fruit Category'),[...field('Fruit Category').options].find(option=>option.text==='QA Fruit').value);
   set(field('Price per Seedling'),'250');await saveProduct();
   const saved=await api('/products/qa-no-batch-seedling/');
   assert(saved.data.stock===0&&saved.data.variants.length===0,'Unbatched product has unexpected stock');
   await load('/product/qa-no-batch-seedling',()=>doc().querySelector('.stock-note'));
   assert(doc().querySelector('.stock-note').textContent.includes('Out of stock'),'Unbatched zero stock not displayed correctly');
  });
  await test('all active products remain discoverable beyond the API first page',async()=>{
   const categories=await api('/categories/'),category=(categories.data.results||categories.data).find(row=>row.name==='QA Fruit');
   for(let index=0;index<12;index++){
    const response=await api('/products/','POST',{name:'QA Pagination Seedling '+index,slug:'qa-pagination-'+index,description:'Isolated pagination verification',category_id:category.id,price:'300.00'});
    assert(response.status===201,'Pagination fixture creation failed');
   }
   const response=await fetch('/api/v1/products/'),data=await response.json();
   assert(data.count===14&&data.next&&data.results.length===12,'Expected API boundary of 12 out of 14 products');
   await load('/shop',()=>doc().querySelector('.product-card'));
   const pages=[...doc().querySelectorAll('.pagination button')].filter(el=>/^\\d+$/.test(el.textContent.trim()));
   const found=new Set();
   for(const page of pages){page.click();await pause(100);for(const card of doc().querySelectorAll('.product-card'))found.add(card.getAttribute('href'));}
   assert(found.has('/product/qa-browser-seedling')&&found.has('/product/qa-no-batch-seedling'),'Only first 12 API products are loaded; older active products and their category filter disappear from the shop');
   assert(found.size===14,'Shop pagination lost or duplicated products');
  });
  await test('category links and search find products beyond the first API page',async()=>{
   await load('/',()=>doc().querySelectorAll('.cat-card').length===2);
   const card=[...doc().querySelectorAll('.cat-card')].find(el=>el.textContent.includes('QA Renamed Citrus'));
   card.click();await until(()=>frame.contentWindow.location.pathname==='/shop'&&doc().querySelectorAll('.product-card').length===1,'category navigation');
   assert(doc().querySelector('.product-card').textContent.includes('QA Browser Seedling'),'Category navigation missed the older product');
   assert(doc().querySelector('.filter-row input:checked')?.value==='qa-renamed-citrus','URL category is not selected');
   button('Clear all filters').click();await until(()=>doc().querySelectorAll('.product-card').length===8,'clear category');
   assert(!frame.contentWindow.location.search.includes('category'),'Clear filters retained category URL');
   set(doc().querySelector('input[type=search]'),'QA Browser Seedling');
   await until(()=>doc().querySelectorAll('.product-card').length===1,'search across all pages');
   assert(doc().querySelector('.product-card').textContent.includes('QA Browser Seedling'),'Search missed older product');
  });
  await test('later product page failure shows an error instead of a partial catalog',async()=>{
   await fetch('/__catalog?fail=1');
   try{
    await load('/shop',()=>text().includes('We could not load the seedling catalog.'));
    assert(doc().querySelectorAll('.product-card').length===0,'First page displayed as a complete catalog after page two failed');
   }finally{await fetch('/__catalog?fail=0');}
   await load('/shop',()=>doc().querySelectorAll('.product-card').length===8);
   assert(text().includes('14 seedling varieties'),'Catalog did not recover after reload');
  });
  await test('categories beyond the first API page reach admin and storefront',async()=>{
   for(let index=0;index<12;index++){
    const response=await api('/categories/','POST',{name:'AA QA Category '+index,slug:'aa-qa-category-'+index,description:'Empty admin-managed category'});
    assert(response.status===201,'Category pagination fixture failed');
   }
   await load('/categories',()=>doc().querySelectorAll('tbody tr').length===14);
   assert([...doc().querySelectorAll('td')].some(el=>el.textContent==='QA Renamed Citrus'),'Admin category list lost later categories');
   await load('/products/new',()=>field('Seedling Variety Name'));
   await until(()=>field('Fruit Category').options.length===15,'all categories in product form');
   assert([...field('Fruit Category').options].some(el=>el.text==='QA Renamed Citrus'),'Cannot assign a category beyond page one');
   await load('/shop',()=>doc().querySelectorAll('.filter-row').length===14&&doc().querySelector('.product-card'));
   assert([...doc().querySelectorAll('.filter-row')].some(el=>el.textContent.includes('QA Renamed Citrus')),'Shop category pagination truncated');
   const empty=[...doc().querySelectorAll('.filter-row')].find(el=>el.textContent.includes('AA QA Category 0'));
   assert(empty.textContent.includes('(0)'),'Empty category count is not zero');
   empty.querySelector('input').click();await until(()=>text().includes('No seedlings match those filters'),'empty category selected');
   assert(doc().querySelectorAll('.product-card').length===0,'Empty category shows unrelated products');
  });
  await test('homepage limits categories and featured seedlings to four',async()=>{
   const response=await fetch('/api/v1/categories/'),data=await response.json();
   assert(data.count===14,'Expected more than four saved categories');
   await load('/',()=>doc().querySelectorAll('.cat-card').length===4&&doc().querySelectorAll('.product-grid .product-card').length===4);
   const categoryNames=[...doc().querySelectorAll('.cat-card h3')].map(el=>el.textContent);
   assert(JSON.stringify(categoryNames)===JSON.stringify(data.results.slice(0,4).map(row=>row.name)),'Homepage does not show the first four categories in saved catalog order');
   const productsResponse=await fetch('/api/v1/products/?ordering=-created_at'),products=await productsResponse.json();
   assert(products.count===14,'Expected more than four saved products');
   const featured=[...doc().querySelectorAll('.product-grid .product-card')].map(el=>el.getAttribute('href'));
   assert(JSON.stringify(featured)===JSON.stringify(products.results.slice(0,4).map(row=>'/product/'+row.slug)),'Featured seedlings do not match the first four newest products');
  });
  await test('homepage stats appear below hero with current saved figures',async()=>{
   await load('/',()=>doc().querySelectorAll('.home-stat').length===4);
   const stats=doc().querySelector('.home-stats');
   assert(doc().querySelector('.hero').nextElementSibling.contains(stats),'Stats are not immediately below the hero');
   assert(stats.closest('.trust-strip'),'Stats are not grouped with existing trust content');
   assert(stats.getAttribute('aria-describedby')==='home-stats-notice','Stats supporting text is not accessible');
   const notice=doc().getElementById('home-stats-notice');
   assert(notice.textContent===expectedStatsNotice&&notice.getBoundingClientRect().height>0,'Saved stats supporting text was changed or hidden');
   const values=[...stats.querySelectorAll('dd .sr-only')].map(el=>el.textContent);
   const labels=[...stats.querySelectorAll('dt')].map(el=>el.textContent);
   assert(JSON.stringify(values)===JSON.stringify(expectedStats.map(stat=>stat.value)),'Saved stats figures were changed');
   assert(JSON.stringify(labels)===JSON.stringify(expectedStats.map(stat=>stat.label)),'Expected stat labels missing');
   assert([...stats.querySelectorAll('.home-stat')].every(el=>el.dataset.reveal==='fade'),'Stats do not use existing section fades');
   assert(doc().querySelectorAll('.trust-item').length===4,'Stats removed existing delivery/WhatsApp assurances');
  });
  await test('stats count once per visit without changing width or accessible values',async()=>{
   await load('/',()=>doc().querySelectorAll('.home-stat-count').length===4,1280,400);
   const counts=[...doc().querySelectorAll('.home-stat-count')];
   assert(window.innerWidth>=frame.getBoundingClientRect().right,'QA browser viewport clips the desktop iframe');
   assert(counts.every(el=>/^0\\+?$/.test(el.textContent)),'Offscreen stats did not wait at zero');
   const widths=counts.map(el=>el.parentElement.getBoundingClientRect().width);
   counts[0].scrollIntoView({behavior:'instant',block:'center'});
   await until(()=>Number(counts[0].textContent.replace(/[^0-9]/g,''))>0&&counts[0].textContent!==expectedStats[0].value,'count-up intermediate number');
   for(let index=0;index<counts.length;index++){
    assert(counts[index].parentElement.getAttribute('aria-hidden')==='true','Intermediate values are announced to screen readers');
    assert(counts[index].closest('dd').querySelector('.sr-only').textContent===expectedStats[index].value,'Accessible final value changes during animation');
   }
   await until(()=>counts.every((el,index)=>el.textContent===expectedStats[index].value),'stats reach final values');
   assert(counts.every((el,index)=>Math.abs(el.parentElement.getBoundingClientRect().width-widths[index])<1),'Counter width shifted while counting');
   doc().querySelector('.hero').scrollIntoView({behavior:'instant'});await pause(100);
   counts[0].scrollIntoView({behavior:'instant',block:'center'});await pause(100);
   assert(counts.every((el,index)=>el.textContent===expectedStats[index].value),'Stats replayed on scroll back');
   await load('/',()=>doc().querySelectorAll('.home-stat-count').length===4,1280,400);
   assert([...doc().querySelectorAll('.home-stat-count')].every(el=>/^0\\+?$/.test(el.textContent)),'New page visit did not reset the counters');
  });
  await test('reduced motion displays final stats immediately',async()=>{
   await fetch('/__motion?reduce=1');
   try{
    await load('/',()=>doc().querySelectorAll('.home-stat-count').length===4,1280,400);
    assert(frame.contentWindow.matchMedia('(prefers-reduced-motion: reduce)').matches,'Reduced-motion preference not applied');
    assert([...doc().querySelectorAll('.home-stat-count')].every((el,index)=>el.textContent===expectedStats[index].value),'Reduced motion left a counter at zero');
   }finally{await fetch('/__motion?reduce=0');}
  });
  await test('changing motion preference finishes active stats',async()=>{
   await load('/',()=>doc().querySelectorAll('.home-stat-count').length===4,1280,400);
   const counts=[...doc().querySelectorAll('.home-stat-count')];counts[0].scrollIntoView({behavior:'instant',block:'center'});
   await until(()=>Number(counts[0].textContent.replace(/[^0-9]/g,''))>0&&counts[0].textContent!==expectedStats[0].value,'active counter');
   try{
    await fetch('/__motion?reduce=1');
    await until(()=>counts.every((el,index)=>el.textContent===expectedStats[index].value),'preference change completes stats');
   }finally{await fetch('/__motion?reduce=0');}
  });
  await test('missing observer leaves stats readable',async()=>{
   window.disableObserver=true;
   try{
    await load('/',()=>doc().querySelectorAll('.home-stat-count').length===4,1280,400);
    assert([...doc().querySelectorAll('.home-stat-count')].every((el,index)=>el.textContent===expectedStats[index].value),'Missing observer leaves stats at zero');
   }finally{window.disableObserver=false;}
  });
  await test('category fetch failure is readable and retry restores real categories',async()=>{
   await fetch('/__categories?fail=1');
   try{
    await load('/',()=>text().includes('We could not load categories.'));
    assert(doc().querySelectorAll('.cat-card').length===0,'Outage replaced real categories with hardcoded ones');
   }finally{await fetch('/__categories?fail=0');}
   button('Try again').click();await until(()=>doc().querySelectorAll('.cat-card').length===4,'category retry');
   assert(!text().includes('We could not load categories.'),'Category retry retained error state');
  });
  await test('category layout preserves spacing on mobile and desktop in both themes',async()=>{
   for(const theme of ['dark','light']){
    localStorage.setItem('tinahstore-theme',theme);
    for(const width of [320,390,768,1280]){
     await load('/',()=>doc().querySelectorAll('.cat-card').length===4&&doc().querySelectorAll('.product-grid .product-card').length===4,width);
     const win=frame.contentWindow,grid=doc().querySelector('.cat-grid');
     assert(doc().documentElement.dataset.theme===theme,'Requested theme not applied');
     assert(doc().documentElement.scrollWidth<=width,'Homepage overflows at '+width+' in '+theme);
     const columns=win.getComputedStyle(grid).gridTemplateColumns.split(' ').length;
     assert(columns===(width<=480?1:width<=900?2:4),'Category columns changed at '+width);
     assert(win.getComputedStyle(grid).gap===(width<=900?'16px':'22px'),'Category gap changed');
     const statsGrid=doc().querySelector('.home-stats-grid');
     assert(win.getComputedStyle(statsGrid).gridTemplateColumns.split(' ').length===(width<=900?2:4),'Stats grid columns incorrect at '+width);
     for(const node of statsGrid.querySelectorAll('.home-stat')){
      assert(node.scrollWidth<=node.clientWidth,'Stats text overflows at '+width);
      assert(win.getComputedStyle(node.querySelector('dd')).color!==win.getComputedStyle(doc().querySelector('.trust-strip')).backgroundColor,'Stats numbers lack theme contrast');
     }
     const hero=doc().querySelector('.hero');
     const gap=doc().querySelector('.trust-strip').getBoundingClientRect().top-doc().querySelector('.hero-actions').getBoundingClientRect().bottom;
     assert(gap>=(width<=900?31:47),'Hero CTA spacing tightened');
     if(processScreenshots&&[390,1280].includes(width)){
      const stats=doc().querySelector('.home-stats');
      win.scrollTo({top:stats.getBoundingClientRect().top+win.scrollY-160,behavior:'instant'});await pause(800);
      await fetch('/__screenshot?name=stats-'+theme+'-'+width+'&width='+width+'&height=1000');
      win.scrollTo({top:grid.getBoundingClientRect().top+win.scrollY-160,behavior:'instant'});await pause(700);
      await fetch('/__screenshot?name=catalog-'+theme+'-'+width+'&width='+width+'&height=1000');
     }
     await load('/shop?category=qa-renamed-citrus',()=>doc().querySelectorAll('.filter-row').length===14&&doc().querySelectorAll('.product-card').length===1,width);
     assert(doc().documentElement.scrollWidth<=width,'Shop overflows at '+width+' in '+theme);
    }
   }
  });
  await test('services sit between featured seedlings and about with approved content',async()=>{
   await load('/',()=>doc().querySelectorAll('.service-card').length===3);
   const section=doc().getElementById('services');
   assert(section.previousElementSibling.querySelector('.product-grid'),'Services are not after featured seedlings');
   assert(section.nextElementSibling.id==='about','Services are not before About Us');
   assert(section.getAttribute('aria-labelledby')==='home-services-title','Services section is not labeled');
   assert(doc().getElementById('home-services-title').textContent==='Expert support for your farm','Service heading changed');
   assert(JSON.stringify([...section.querySelectorAll('h3')].map(el=>el.textContent))===JSON.stringify(['Agronomy support','Soil testing','Irrigation services']),'Service titles are missing or duplicated');
   const irrigation=section.querySelector('#service-irrigation-services').closest('article');
   for(const scope of ['Planning','installation','maintenance'])assert(irrigation.textContent.includes(scope),'Irrigation scope missing: '+scope);
   assert(section.querySelector('.services-note').textContent.includes('Provided directly by Savannah Seedlings'),'Direct provider clarification missing');
   assert(section.querySelectorAll('.service-icon svg').length===3,'A service icon did not render');
   assert(!section.querySelector('.services-grid').hasAttribute('data-reveal'),'Entire tall services grid reveals too early');
   assert([...section.querySelectorAll('.service-card')].every(el=>el.dataset.reveal==='fade'),'Individual service fade missing');
  });
  await test('service links create safe accessible WhatsApp enquiries',async()=>{
   await load('/',()=>doc().querySelectorAll('.service-enquiry').length===3);
   const links=[...doc().querySelectorAll('.service-enquiry')];
   const drafts=new Set();
   for(const link of links){
    const title=link.closest('article').querySelector('h3').textContent.toLowerCase(),url=new URL(link.href);
    assert(url.protocol==='https:'&&url.hostname==='wa.me'&&url.pathname==='/254710583989','Service enquiry points to the wrong recipient');
    const message=url.searchParams.get('text');
    assert(message.includes(title)&&message.includes('availability and pricing'),'Message does not identify requested service');
    drafts.add(message);
    assert(link.target==='_blank'&&link.relList.contains('noopener')&&link.relList.contains('noreferrer'),'External-link protections missing');
    assert(link.getAttribute('aria-label').includes(title),'Repeated enquiry link lacks accessible service context');
    assert(link.getAttribute('aria-label').startsWith(link.textContent.trim()),'Accessible name does not include the visible enquiry label');
    assert(!link.hasAttribute('onclick'),'Service link auto-sends or intercepts messages');
   }
   assert(drafts.size===3,'Different services share the same draft');
   links[0].scrollIntoView({behavior:'instant',block:'center'});links[0].focus();
   await fetch('/__keyboard-tab');await until(()=>doc().activeElement===links[1],'Tab reaches the next service enquiry');
   const style=frame.contentWindow.getComputedStyle(links[1]);
   assert(style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0,'Keyboard focus indicator missing');
   assert(frame.contentWindow.getComputedStyle(links[1].closest('article')).opacity==='1','Keyboard focus left service content faded');
   // Inspect drafts only; never navigate to WhatsApp or send a message in QA.
  });
  await test('service cards preserve spacing and fit mobile and desktop in both themes',async()=>{
   for(const theme of ['dark','light']){
    localStorage.setItem('tinahstore-theme',theme);
    for(const width of [320,390,768,900,901,1024,1280]){
     await load('/',()=>doc().querySelectorAll('.service-card').length===3&&doc().querySelectorAll('.cat-card').length===4&&doc().querySelectorAll('.product-grid .product-card').length===4,width);
     const win=frame.contentWindow,section=doc().getElementById('services'),grid=section.querySelector('.services-grid');
     assert(doc().documentElement.dataset.theme===theme,'Service theme not applied');
     assert(doc().documentElement.scrollWidth<=width,'Services create page overflow at '+width+' in '+theme);
     assert(win.getComputedStyle(grid).gridTemplateColumns.split(' ').length===(width<=900?1:3),'Unexpected service columns at '+width);
     const padding=width<=640?48:width<=900?64:88,style=win.getComputedStyle(section);
     assert(parseFloat(style.paddingTop)===padding&&parseFloat(style.paddingBottom)===padding,'Services section spacing tightened');
     assert(win.getComputedStyle(grid).gap==='24px','Service card spacing changed');
     for(const card of grid.children){
      const link=card.querySelector('.service-enquiry'),cardBounds=card.getBoundingClientRect(),buttonBounds=link.getBoundingClientRect();
      const heading=card.querySelector('.service-card-heading'),icon=heading.querySelector('.service-icon').getBoundingClientRect(),title=heading.querySelector('h3').getBoundingClientRect();
      assert(title.left>=icon.right+13,'Service title is not to the right of its icon at '+width);
      assert(title.top<icon.bottom&&title.bottom>icon.top,'Service title is not vertically aligned with its icon');
      assert(icon.width===48&&icon.height===48,'Service icon shrinks at '+width);
      assert(heading.scrollWidth<=heading.clientWidth,'Service heading overflows at '+width);
      assert(card.querySelector('p').getBoundingClientRect().top>=Math.max(icon.bottom,title.bottom)+19,'Service description crowds its heading');
      assert(card.scrollWidth<=card.clientWidth,'Service card content overflows at '+width);
      assert(buttonBounds.height>=44,'Service enquiry touch target too short');
      assert(buttonBounds.left>=cardBounds.left&&buttonBounds.right<=cardBounds.right,'Service enquiry overflows its card');
     }
     if(processScreenshots&&[390,1280].includes(width)){
      win.scrollTo({top:section.getBoundingClientRect().top+win.scrollY-140,behavior:'instant'});await pause(800);
      await fetch('/__screenshot?name=services-'+theme+'-'+width+'&width='+width+'&height=1000');
     }
    }
   }
  });
 }
 await test('save Settings delivery rates and persist on reload',async()=>{
  await settings();set(field('Nairobi Region Delivery Fee'),'80.50');set(field('Upcountry / Rest'),'375');
  const start=requests.length;await submit(field('Nairobi Region Delivery Fee').closest('form'));
  await until(()=>requests.slice(start).some(row=>row.method==='PATCH'&&row.path==='/api/v1/orders/delivery-settings/'),'delivery save response');
  const response=requests.slice(start).find(row=>row.method==='PATCH'&&row.path==='/api/v1/orders/delivery-settings/');
  assert(response.status===200,'Settings save returned HTTP '+response.status);
  await settings();assert(Number(field('Nairobi Region Delivery Fee').value)===80.5&&Number(field('Upcountry / Rest').value)===375,'Delivery rates were not saved');
 });
 await test('delivery form blocks negative fees without submitting',async()=>{
  await settings();const input=field('Nairobi Region Delivery Fee');set(input,'-1');await pause(60);
  assert(!input.checkValidity(),'Negative fee is accepted by the form');
  const start=requests.length;input.closest('form').requestSubmit();await pause(200);
  assert(!requests.slice(start).some(row=>row.method==='PATCH'&&row.path==='/api/v1/orders/delivery-settings/'),'Invalid form was submitted');
 });
 await test('delivery API rejects invalid fee without partially changing rates',async()=>{
  const before=await api('/orders/delivery-settings/');
  const response=await api('/orders/delivery-settings/','PATCH',{nairobi_delivery_fee:'-1.00',upcountry_delivery_fee:'999.00'});
  assert(response.status===400&&response.data.nairobi_delivery_fee,'API did not reject negative fee');
  const after=await api('/orders/delivery-settings/');
  assert(JSON.stringify(before.data)===JSON.stringify(after.data),'Rejected request changed settings');
 });
 if(focus==='nursery-motion') {
  const nurseryReady=()=>doc().getElementById('nursery-alt')&&!doc().querySelector('fieldset')?.disabled;
  const editPhoto=async(caption)=>{
   const card=[...doc().querySelectorAll('article')].find(el=>el.textContent.includes(caption));
   assert(card,'Photo card not found: '+caption);[...card.querySelectorAll('button')].find(el=>el.textContent==='Edit photo').click();
   await pause(100);
  };
  const savePhoto=async()=>{
   const start=requests.length;await submit(doc().querySelector('form'));
   await until(()=>requests.slice(start).some(row=>['POST','PATCH'].includes(row.method)&&row.path.startsWith('/api/v1/nursery-photos/')),'nursery save response');
   const response=requests.slice(start).find(row=>['POST','PATCH'].includes(row.method)&&row.path.startsWith('/api/v1/nursery-photos/'));
   assert(response.status<300,'Nursery save failed: '+response.status);
   await until(()=>!doc().querySelector('fieldset')?.disabled,'nursery saved list');
  };
  await test('empty nursery gallery leaves existing homepage and spacing intact',async()=>{
   await load('/',()=>doc().querySelector('.hero'));
   await until(()=>requests.some(row=>row.path==='/api/v1/nursery-photos/'&&row.status===200),'empty nursery fetch');
   assert(!doc().querySelector('.nursery-gallery'),'Empty gallery created a blank section');
   const hero=doc().querySelector('.hero'),style=frame.contentWindow.getComputedStyle(hero);
   assert(style.paddingTop==='64px'&&style.paddingBottom==='48px','Desktop hero spacing changed');
   await pause(600); // Measure settled layout, not the 6px entrance transform.
   const gap=doc().querySelector('.trust-strip').getBoundingClientRect().top-doc().querySelector('.hero-actions').getBoundingClientRect().bottom;
   assert(gap>=47,'Hero CTAs became tight against trust strip: '+gap);
   assert(doc().querySelector('#about .about-panel svg'),'Nursery illustration disappeared');
  });
  await test('admin creates two nursery photos with captions and descriptions',async()=>{
   await load('/nursery-photos',nurseryReady);
   for(const [caption,description,position] of [['QA Nairobi nursery','Rows of avocado seedlings',2],['QA Grafting nursery','Grafted seedlings in Muranga',1]]){
    await upload('#2e7d32','nursery.png');set(doc().getElementById('nursery-caption'),caption);
    set(doc().getElementById('nursery-alt'),description);set(doc().getElementById('nursery-position'),String(position));await savePhoto();
   }
   assert(doc().querySelectorAll('article').length===2,'Photo list not refreshed');
  });
  await test('published nursery photos load on storefront in saved display order',async()=>{
   await load('/',()=>doc().querySelectorAll('.nursery-photo').length===2);
   assert(doc().querySelector('.nursery-photo figcaption').textContent==='QA Grafting nursery','Display order ignored');
   for(const image of doc().querySelectorAll('.nursery-photo img')){
    image.scrollIntoView({behavior:'instant',block:'center'});await until(()=>image.complete&&image.naturalWidth>0,'nursery image load');
    assert(image.alt&&image.loading==='lazy','Image accessibility/lazy loading missing');
   }
  });
  await test('admin nursery controls fit mobile and preserve drafts on list refresh',async()=>{
   await load('/nursery-photos',nurseryReady);await editPhoto('QA Nairobi nursery');
   set(doc().getElementById('nursery-caption'),'Draft caption');await pause(60);
   button('Refresh photos').click();await until(nurseryReady,'refreshed nursery list');
   assert(doc().getElementById('nursery-caption').value==='Draft caption','List refresh discarded draft');
   for(const width of [320,390,768]){
    frame.width=width;await pause(150);
    assert(doc().documentElement.scrollWidth<=width,'Admin nursery page overflows at '+width);
   }
  });
  await test('admin can feature a photo and hide or republish it',async()=>{
   await load('/nursery-photos',nurseryReady);await editPhoto('QA Nairobi nursery');
   doc().querySelectorAll('input[type=checkbox]')[1].click();await savePhoto();
   await load('/',()=>doc().querySelectorAll('.nursery-photo').length===2);
   assert(doc().querySelector('.nursery-photo figcaption').textContent==='QA Nairobi nursery','Featured photo not first');
   await load('/nursery-photos',nurseryReady);await editPhoto('QA Nairobi nursery');
   doc().querySelectorAll('input[type=checkbox]')[0].click();await savePhoto();
   await load('/',()=>doc().querySelectorAll('.nursery-photo').length===1);
   assert(!doc().querySelector('.nursery-gallery').textContent.includes('QA Nairobi nursery'),'Hidden photo leaked');
   await load('/nursery-photos',nurseryReady);await editPhoto('QA Nairobi nursery');
   doc().querySelectorAll('input[type=checkbox]')[0].click();await savePhoto();
  });
  await test('rejected nursery replacement retains saved image and editable form',async()=>{
   await load('/nursery-photos',nurseryReady);await editPhoto('QA Nairobi nursery');
   const before=await api('/nursery-photos/');
   const transfer=new frame.contentWindow.DataTransfer();
   transfer.items.add(new frame.contentWindow.File(['invalid image'],'broken.png',{type:'image/png'}));
   doc().getElementById('nursery-image').files=transfer.files;
   doc().getElementById('nursery-image').dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
   set(doc().getElementById('nursery-caption'),'Unsaved caption');await submit(doc().querySelector('form'));
   await until(()=>doc().querySelector('form [role=alert]'),'invalid photo error');
   assert(doc().getElementById('nursery-caption').value==='Unsaved caption','Failed edit discarded form');
   const after=await api('/nursery-photos/');assert(JSON.stringify(before.data)===JSON.stringify(after.data),'Failed edit changed saved photo');
  });
  await test('mobile nursery gallery and hero preserve breathing room in both themes',async()=>{
   for(const theme of ['light','dark'])for(const width of [320,390,768]){
    localStorage.setItem('tinahstore-theme',theme);
    await load('/',()=>doc().querySelectorAll('.nursery-photo').length===2);
    frame.width=width;await pause(500);
    const win=frame.contentWindow,hero=doc().querySelector('.hero'),style=win.getComputedStyle(hero);
    assert(style.paddingTop==='40px'&&style.paddingBottom==='32px','Mobile hero padding changed');
   const gap=doc().querySelector('.trust-strip').getBoundingClientRect().top-doc().querySelector('.hero-actions').getBoundingClientRect().bottom;
   assert(gap>=31,'Hero CTAs became tight');
    assert(doc().documentElement.scrollWidth<=width,'Horizontal page overflow at '+width+' '+theme);
    assert(parseFloat(win.getComputedStyle(doc().querySelector('.nursery-gallery')).marginTop)>=48,'Gallery spacing too tight');
    for(const image of doc().querySelectorAll('.nursery-photo img')){
     image.scrollIntoView({behavior:'instant',block:'center'});await until(()=>image.complete&&image.naturalWidth>0,'responsive nursery image');
     const rect=image.getBoundingClientRect();assert(rect.left>=0&&rect.right<=width,'Image outside viewport');
    }
    assert(win.getComputedStyle(doc().querySelector('.hero-copy h1')).animationName==='none','Hero copy moves');
    if(processScreenshots&&width===390){
     doc().querySelector('.nursery-gallery').scrollIntoView({behavior:'instant',block:'start'});
     win.scrollBy({top:-130,behavior:'instant'});
     frame.scrollIntoView({behavior:'instant',block:'start'});await pause(500);
     await fetch('/__screenshot?name=gallery-'+theme+'&width=390&height=844');
    }
   }
  });
  await test('photographic hero keeps copy steady and uses fixed desktop photo timing',async()=>{
   await load('/',()=>doc().querySelector('.hero-background'));
   const win=frame.contentWindow;
   if(win.matchMedia('(min-width:901px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches){
    await until(()=>doc().querySelector('.hero-background.is-ready'),'hero photos ready');
    const slides=doc().querySelectorAll('.hero-photo-slide');assert(slides.length===3,'Three photo layers missing');
    [...slides].forEach((slide,index)=>{
     const style=win.getComputedStyle(slide);assert(style.animationName==='hero-photo-cycle'&&style.animationDuration==='18s'&&style.animationDelay===index*6+'s','Unexpected photo timing');
    });
   }
   for(const selector of ['.hero-copy h1','.hero-actions','.site-header .logo','.main-nav']){
    assert(win.getComputedStyle(doc().querySelector(selector)).animationName==='none','Hero copy or navigation moves: '+selector);
   }
  });
  await test('cart and wishlist count feedback does not move floating controls',async()=>{
   await load('/',()=>doc().querySelector('.product-card .wish'));
   frame.width=390;await pause(100);
   const wish=doc().querySelector('.product-card .wish');wish.click();await pause(80);
   const badge=doc().querySelector('.floating-action[href="/wishlist"] .count-feedback');
   assert(badge?.textContent==='1','Wishlist badge acknowledgement missing');
   assert(wish.getAttribute('aria-pressed')==='true','Wishlist state not exposed');
   assert(frame.contentWindow.getComputedStyle(badge.parentElement).animationName==='none','Floating control bounces');
   assert(frame.contentWindow.location.pathname==='/','Wishlist click unexpectedly navigated');
  });
  await test('section reveal runs once and does not hide content after scrolling back',async()=>{
   await load('/',()=>doc().querySelectorAll('.nursery-photo').length===2);
   const target=doc().querySelector('#contact [data-reveal]');
   target.scrollIntoView({behavior:'instant',block:'center'});
   await until(()=>target.getAnimations().some(animation=>animation.effect.getKeyframes().some(frame=>'opacity' in frame)),'contact reveal started');
   await until(()=>!target.getAnimations().length&&frame.contentWindow.getComputedStyle(target).opacity==='1','contact reveal settled');
   assert(!target.getAnimations().length&&frame.contentWindow.getComputedStyle(target).opacity==='1','Reveal did not settle');
   doc().querySelector('.hero').scrollIntoView({behavior:'instant'});await pause(100);
   target.scrollIntoView({behavior:'instant',block:'center'});await pause(60);
   assert(!target.getAnimations().length,'Reveal replayed on return');
  });
  await test('homepage uses individual scroll fades from hero highlights to newsletter',async()=>{
   await load('/',()=>doc().querySelector('.product-card[data-reveal="fade"]')&&doc().querySelector('.cat-card[data-reveal="fade"]'),390);
   for(const selector of ['.home-stat','.trust-item','.cat-card','.product-card','.service-card','.testi-card','.contact-card','.newsletter .container']){
    const nodes=doc().querySelectorAll(selector);assert(nodes.length,'Missing fade group: '+selector);
    nodes.forEach(node=>assert(node.dataset.reveal==='fade','Missing per-block fade: '+selector));
   }
   assert(!doc().querySelector('.cat-grid').parentElement.hasAttribute('data-reveal'),'Category section fades too early as one block');
   assert(!doc().querySelector('.product-grid').parentElement.hasAttribute('data-reveal'),'Product section fades too early as one block');
   const card=[...doc().querySelectorAll('.cat-card')].at(-1);
   card.scrollIntoView({behavior:'instant',block:'center'});
   await until(()=>card.getAnimations().some(animation=>animation.effect.getKeyframes().some(frame=>'opacity' in frame)),'category card fade');
   const fade=card.getAnimations().find(animation=>animation.effect.getKeyframes().some(frame=>'opacity' in frame));
   assert(fade,'No opacity animation found');const frames=fade.effect.getKeyframes();
   assert(frames[0].opacity==='0'&&frames.at(-1).opacity==='1'&&!frames.some(frame=>frame.transform),'Card does not use opacity-only fade');
  });
  await test('footer fades once on scroll without moving or changing spacing',async()=>{
   await load('/',()=>doc().querySelector('.footer-grid[data-reveal="fade"]'));
   const win=frame.contentWindow,target=doc().querySelector('.footer-grid');
   const height=target.offsetHeight;
   target.scrollIntoView({behavior:'instant',block:'center'});
   await until(()=>target.getAnimations().length,'footer fade starts');
   const animation=target.getAnimations()[0];
   const frames=animation.effect.getKeyframes();
   assert(frames[0].opacity==='0'&&frames.at(-1).opacity==='1','Footer does not fade in');
   assert(!frames.some(frame=>frame.transform),'Footer moves instead of fading');
   assert(animation.effect.getTiming().duration===600,'Footer fade timing incorrect');
   await pause(700);
   assert(target.offsetHeight===height&&win.getComputedStyle(target).opacity==='1','Footer dimensions or visibility changed');
   doc().querySelector('.hero').scrollIntoView({behavior:'instant'});await pause(100);
   target.scrollIntoView({behavior:'instant',block:'center'});await pause(70);
   assert(!target.getAnimations().length,'Footer fade replays on return');
  });
  await test('reduced-motion disables hero and reveal motion without hiding content',async()=>{
   await fetch('/__motion?reduce=1');
   await load('/',()=>doc().querySelectorAll('.nursery-photo').length===2);
   const win=frame.contentWindow;assert(win.matchMedia('(prefers-reduced-motion: reduce)').matches,'Browser preference not applied');
   assert(!doc().querySelector('.hero-photo-slide'),'Reduced-motion hero rotates');
   for(const node of doc().querySelectorAll('[data-reveal]')){
    node.scrollIntoView({behavior:'instant',block:'center'});await pause(50);
    assert(Number(win.getComputedStyle(node).opacity)>0&&!node.getAnimations().length,'Reduced-motion content animated or hidden: '+node.className+' '+JSON.stringify({opacity:win.getComputedStyle(node).opacity,animations:node.getAnimations().map(animation=>animation.effect.getKeyframes())}));
   }
   await fetch('/__motion?reduce=0');
  });
  await test('unsupported reveal observer leaves homepage readable',async()=>{
   window.disableObserver=true;
   await load('/',()=>doc().querySelectorAll('.nursery-photo').length===2);
   for(const node of doc().querySelectorAll('[data-reveal]'))assert(Number(frame.contentWindow.getComputedStyle(node).opacity)>0,'Content relies on observer: '+node.className+' opacity='+frame.contentWindow.getComputedStyle(node).opacity);
   window.disableObserver=false;
  });
  await test('photo API outage gracefully retains nursery illustration and text',async()=>{
   await fetch('/__gallery?fail=1');await load('/',()=>doc().querySelector('#about .about-panel svg'));
   await pause(150);assert(!doc().querySelector('.nursery-gallery'),'Broken gallery rendered');
   assert(text().includes('Propagating Sustainable Agriculture'),'Nursery text missing');
   await fetch('/__gallery?fail=0');
  });
  await test('admin removes nursery photo and storefront drops it on fresh load',async()=>{
   await load('/nursery-photos',nurseryReady);frame.contentWindow.confirm=()=>true;
   const card=[...doc().querySelectorAll('article')].find(el=>el.textContent.includes('QA Nairobi nursery'));
   [...card.querySelectorAll('button')].find(el=>el.textContent==='Remove').click();
   await until(()=>doc().querySelectorAll('article').length===1,'removed photo');
   await load('/',()=>doc().querySelectorAll('.nursery-photo').length===1);
   assert(!doc().querySelector('.nursery-gallery').textContent.includes('QA Nairobi nursery'),'Removed image remains public');
  });
 }
 await test('password confirmation mismatch is blocked before API call',async()=>{
  await settings();const start=requests.length;await passwordForm(originalPassword,newPassword,'Does-not-match-42!');
  await until(()=>text().includes('New passwords do not match'),'mismatch error');
  assert(!requests.slice(start).some(row=>row.path==='/api/v1/admin/auth/password/'),'Mismatched password was submitted');
 });
 await test('wrong current password is rejected without signing out',async()=>{
  await settings();await passwordForm('Wrong-Password-42!',newPassword);
  await until(()=>text().includes('Current password is incorrect'),'wrong current password error');
  assert(sessionStorage.getItem('ts_admin_token'),'Session cleared on rejected change');
 });
 await test('successful password change signs out and old login stops working',async()=>{
  await settings();await passwordForm(originalPassword,newPassword);
  await until(()=>doc().getElementById('admin-username'),'sign out after password change');
  assert(!sessionStorage.getItem('ts_admin_token'),'Admin session survived password change');
  await login(originalPassword);await until(()=>doc().querySelector('[role=alert]'),'old password denied');
  assert(!sessionStorage.getItem('ts_admin_token'),'Old password opened a session');
  await login(newPassword);
  await until(()=>text().includes('Security & Password')&&sessionStorage.getItem('ts_admin_token'),'new password opens intended settings route');
  const identity=await api('/admin/auth/me/');assert(identity.status===200,'New password did not establish a valid session');
  assert(frame.contentWindow.location.pathname==='/settings','Post-password-change return route was lost');
 });
 document.getElementById('results').textContent=JSON.stringify({focus,results,errors,failedRequests:requests.filter(row=>row.status>=400)});
 if(frame)frame.remove();
})().catch(error=>document.getElementById('results').textContent=JSON.stringify({error:error.message,results,errors}));
</script>`;

const upstreams=new Set();
let sendCommand, nurseryFailure=false, catalogFailure=false, categoriesFailure=false;
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if(url.pathname==='/__keyboard-tab'){
      await sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      await sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
      res.end('OK');return;
    }
    if(url.pathname==='/__keyboard-escape'){
      await sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      await sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      res.end('OK');return;
    }
    if(url.pathname==='/__pointer-click'){
      const x=Number(url.searchParams.get('x')),y=Number(url.searchParams.get('y'));
      if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid QA pointer coordinates');
      await sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
      await sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
      res.end('OK');return;
    }
    if(url.pathname==='/__print'){
      await sendCommand('Emulation.setEmulatedMedia',{media:url.searchParams.get('enabled')==='1'?'print':'screen'});
      res.end('OK');return;
    }
    if(url.pathname==='/__motion'){
      await sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:url.searchParams.get('reduce')==='1'?'reduce':'no-preference'}]});
      res.end('OK');return;
    }
    if(url.pathname==='/__screenshot'){
      const shot=await sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,
        clip:{x:8,y:0,width:Number(url.searchParams.get('width')),height:Number(url.searchParams.get('height')),scale:1}});
      const name=url.searchParams.get('name');
      if(!/^(gallery-(light|dark)|(catalog|stats|services)-(light|dark)-(390|1280)|menu-(light|dark)-(320|390)|privacy-(light|dark)-390)$/.test(name))throw Error('Unknown screenshot');
      const filename=path.join(profile,name+'.png');await writeFile(filename,Buffer.from(shot.data,'base64'));
      console.log('QA screenshot: '+filename);res.end('OK');return;
    }
    if(url.pathname==='/__gallery'){nurseryFailure=url.searchParams.get('fail')==='1';res.end('OK');return;}
    if(url.pathname==='/__catalog'){catalogFailure=url.searchParams.get('fail')==='1';res.end('OK');return;}
    if(url.pathname==='/__categories'){categoriesFailure=url.searchParams.get('fail')==='1';res.end('OK');return;}
    if((catalogFailure&&url.pathname==='/api/v1/products/'&&url.searchParams.get('page')==='2') ||
       (categoriesFailure&&url.pathname==='/api/v1/categories/')){
      res.writeHead(503,{'Content-Type':'application/json'}).end('{"detail":"Simulated catalog outage"}');return;
    }
    if(nurseryFailure&&url.pathname==='/api/v1/nursery-photos/'){res.writeHead(503,{'Content-Type':'application/json'}).end('{"detail":"Simulated outage"}');return;}
    if (url.pathname === '/__checks') {
      res.setHeader('Content-Type', 'text/html');res.end(page);return;
    }
    if (url.pathname.startsWith('/api/v1/') || url.pathname.startsWith('/media/')) {
      const upstream = httpRequest(new URL(req.url, backend), {
        method:req.method, agent:false, headers:{...req.headers, host:backend.host},
      }, response => {
        // Keep generated image URLs local to the QA proxy so they can be viewed.
        if (String(response.headers['content-type']).includes('application/json')) {
          const chunks=[];
          response.on('data',chunk=>chunks.push(chunk));
          response.on('end',()=>{
            const headers={...response.headers};delete headers['content-length'];delete headers['transfer-encoding'];
            res.writeHead(response.statusCode,headers);
            res.end(Buffer.concat(chunks).toString().replaceAll(backend.origin,'http://127.0.0.1:'+server.address().port));
          });
        } else {res.writeHead(response.statusCode,response.headers);response.pipe(res);}
      });
      upstreams.add(upstream);upstream.once('close',()=>upstreams.delete(upstream));
      upstream.on('error',error=>res.writeHead(502).end(error.message));req.pipe(upstream);return;
    }
    const isAdmin = /^\/(login|dashboard|products|categories|settings|nursery-photos)(\/|$)/.test(url.pathname);
    const asset = /\.(js|css|png|ico|svg|webp|json)$/.test(url.pathname);
    let content, file;
    if (asset) {
      for (const directory of [adminRoot,storeRoot]) {
        const candidate=path.resolve(directory,'.'+decodeURIComponent(url.pathname));
        if (!candidate.startsWith(directory+path.sep)) continue;
        try {content=await readFile(candidate);file=candidate;break;} catch {}
      }
      if (content===undefined) {res.writeHead(404).end();return;}
    } else {file=path.join(isAdmin?adminRoot:storeRoot,'index.html');content=await readFile(file);}
    const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'text/html';
    if (type==='text/css') content=String(content).replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g,'');
    if (!asset) content=String(content).replace('<head>','<head>'+injection);
    res.writeHead(200,{'Content-Type':type});res.end(content);
  } catch (error) {res.writeHead(500).end(error.message);}
});
server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const profile=await mkdtemp(path.join(tmpdir(),'seedlings-real-api-qa-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--no-first-run',
  '--user-data-dir='+profile,'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','about:blank',
],{stdio:'ignore',windowsHide:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket;
try {
  let debugPort;
  for(let i=0;i<100;i++) {
    try {debugPort=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;} catch {}
    await pause(100);
  }
  if(!debugPort) throw Error('QA Chrome debugging port did not start');
  const target=await (await fetch('http://127.0.0.1:'+debugPort+'/json/new?about:blank',{method:'PUT'})).json();
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map();
  socket.addEventListener('message',event=>{
    const result=JSON.parse(event.data),callback=pending.get(result.id);
    if(callback){pending.delete(result.id);result.error?callback.reject(Error(result.error.message)):callback.resolve(result.result);}
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('Chrome debugging command timed out: '+method));},5000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
    socket.send(JSON.stringify({id,method,params}));
  });
  sendCommand=send;
  // IntersectionObserver also clips to the outer page. Fit desktop iframes in
  // the headless window so right-hand counters can genuinely enter the viewport.
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/__checks'});
  let report;
  for(let i=0;i<800;i++) {
    const result=await send('Runtime.evaluate',{expression:"document.getElementById('results')?.textContent",returnByValue:true});
    const value=result.result?.value;
    if(value&&value!=='Running'){report=JSON.parse(value);break;}
    await pause(100);
  }
  if(!report) throw Error('Browser actions did not complete in real time');
  console.log(JSON.stringify(report,null,2));
  if (report.error||report.errors.length||report.results.some(row=>!row.pass&&!row.skipped)) process.exitCode=1;
  // Do not leave the owned headless browser running after a failing test.
  await Promise.race([send('Browser.close'),pause(1000)]);
} finally {
  socket?.close();chrome.kill();
  for(const upstream of upstreams)upstream.destroy();
  server.closeAllConnections();server.close();
  // Remove only this run's owned profile; keep explicitly requested screenshots.
  if(process.env.NURSERY_QA_SCREENSHOTS!=='1'&&path.dirname(profile)===path.resolve(tmpdir())&&path.basename(profile).startsWith('seedlings-real-api-qa-')){
    try{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
    catch{console.warn('Disposable Chrome profile could not be removed: '+profile);}
  }
  // Some Chrome/HTTP handles on Windows can outlive their closed socket. The CLI
  // has already printed its result; don't leave a test helper process behind.
  setTimeout(()=>process.exit(process.exitCode||0),1500).unref();
}
