const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true,deviceScaleFactor:2});const p=await ctx.newPage();const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(3500);
await p.evaluate(()=>{const f=window.__fab,E=f.E,g=E.newGame(5);g.turn=3;g.phase='admin';for(const u of g.units.filter(u=>u.side==='german'&&u.area!=null&&!u.garrison).slice(0,6)){u.str=Math.max(1,u.max-1)}const rc=g.chits.filter(c=>c.kind==='replacement_inf'&&c.side==='german').slice(0,1);rc.forEach(c=>c.box='available');g.phasing='german';f.g=g;f.refresh()});await p.waitForTimeout(800);
const ids=await p.evaluate(()=>window.__fab.g.chits.filter(c=>c.box==='available'&&c.kind.startsWith('replacement')).map(c=>c.id));console.log(ids);
await p.evaluate((id)=>{window.__fab.selChit&&0},ids[0]);
const el=await p.$(`.card2[data-chit="${ids[0]}"]`);if(el){await el.scrollIntoViewIfNeeded();await el.tap()}await p.waitForTimeout(1200);await p.screenshot({path:'/tmp/rep.png'});console.log(er);await b.close()})()
