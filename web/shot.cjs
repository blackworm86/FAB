const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await ctx.newPage();const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(3500);
await p.evaluate(()=>{const f=window.__fab,E=f.E,g=E.newGame(11);const al=g.units.find(u=>u.side==='allied'&&u.area!=null&&!u.garrison),ge=g.units.find(u=>u.side==='german'&&u.area!=null&&!u.garrison);ge.area=al.area;g.phase='combat';g.phasing='german';const bt=E.startBattle(g,al.area);E.beginCombat(g,bt);f.g=g;f.refresh()});await p.waitForTimeout(1200);
for(let i=0;i<14;i++){
 const n=await p.$$('.fx');if(n.length){await p.waitForTimeout(900);await p.screenshot({path:'/tmp/fx1.png'});console.log('fx at step',i,await p.$$eval('.fx',e=>e.map(x=>x.textContent)));break}
 const go=await p.$('button.go:not([disabled])');const cont=await p.$('.c-ledger .row.end button.primary:not([disabled])');const opt=await p.$$('.c-ledger .row.end button, .c-ledger .row button');
 if(cont){await cont.click();} else if(go){await go.click();} else if(opt.length){await opt[opt.length-1].click();}
 await p.waitForTimeout(3600)}
console.log(er);await b.close()})()
