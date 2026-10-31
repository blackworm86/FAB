const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await ctx.newPage();const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(3500);
await p.evaluate(()=>{const f=window.__fab,E=f.E,g=E.newGame(5);const al=g.units.find(u=>u.side==='allied'&&u.area!=null),ge=g.units.find(u=>u.side==='german'&&u.area!=null&&!u.garrison);ge.area=al.area;g.phase='combat';g.phasing='german';const bt=E.startBattle(g,al.area);E.beginCombat(g,bt);f.g=g;f.refresh()});await p.waitForTimeout(1500);
await p.screenshot({path:'/tmp/d0.png'});
await p.click('button.go');await p.waitForTimeout(4200);await p.screenshot({path:'/tmp/d1.png'});console.log(er);await b.close()})()
