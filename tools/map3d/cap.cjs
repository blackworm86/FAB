const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
const L=fs.readFileSync('/home/user/FAB/web/public/map-lines.svg','utf8').replace(/<g id="cities"[\s\S]*?<\/g>/,'').replace(/<g id="towns"[\s\S]*?<\/g>/,'');
await p.route('**/map-lines.svg',r=>r.fulfill({contentType:'image/svg+xml',body:L}));
await p.goto('http://localhost:5199/?sandbox=1');await p.waitForFunction(()=>window.__fab&&document.querySelector('.c-bar.b'),{timeout:20000});await p.waitForTimeout(2500);
const d=await p.evaluate(()=>__fab.board());fs.writeFileSync('printed.png',Buffer.from(d.split(',')[1],'base64'));await b.close();})();
