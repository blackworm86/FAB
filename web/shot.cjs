const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
for (const [w,h] of [[390,800],[1280,720]]){const p=await b.newPage({viewport:{width:w,height:h},hasTouch:w<500});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(2500);
await p.evaluate(()=>{const f=window.__fab,E=f.E,g=E.newGame(5);const al=g.units.find(u=>u.side==='allied'&&u.area!=null),ge=g.units.find(u=>u.side==='german'&&u.area!=null&&!u.garrison);ge.area=al.area;g.phase='combat';g.phasing='german';E.startBattle(g,al.area);f.g=g;f.refresh()});
await p.waitForTimeout(1500);await p.screenshot({path:`/tmp/b${w}.png`});console.log(w,er)}await b.close()})()
