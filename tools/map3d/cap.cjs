const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto('http://localhost:5199/?sandbox=1');await p.waitForFunction(()=>window.__fab&&document.querySelector('.c-bar.b'),{timeout:20000});await p.waitForTimeout(2500);
const d=await p.evaluate(()=>__fab.board());fs.writeFileSync('printed.png',Buffer.from(d.split(',')[1],'base64'));await b.close();})();
