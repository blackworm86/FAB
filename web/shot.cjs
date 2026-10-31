const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();
const p=await b.newPage({viewport:{width:390,height:800},hasTouch:true});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(2500);
await p.evaluate(()=>{const f=window.__fab,E=f.E,g=E.newGame(5);const al=g.units.find(u=>u.side==='allied'&&u.area!=null),ge=g.units.find(u=>u.side==='german'&&u.area!=null&&!u.garrison);ge.area=al.area;g.phase='combat';g.phasing='german';const bt=E.startBattle(g,al.area);E.beginCombat(g,bt);f.g=g;f.refresh()});
await p.waitForTimeout(1500);await p.screenshot({path:`/tmp/f.png`});console.log(er);await b.close()})()
