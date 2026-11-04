// One pass over every screen on a phone: screenshot + automatic checks (overflow, small tap targets, panels overlapping the bottom bar).
const {chromium,devices}=require('playwright');const fs=require('fs');
const DEV=process.argv[2]||'iPhone 13', O=(process.argv[3]||'sweep-out')+'/';// usage: (dev server on :5199) NODE_PATH=$(npm root -g) node tools/mobile-sweep.cjs 'iPhone 13' out-dirfs.mkdirSync(O,{recursive:true});
const out=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices[DEV]});const p=await ctx.newPage();
 p.on('pageerror',e=>out.push('PAGE ERROR '+e.message));
 const check=async(name)=>{await p.waitForTimeout(250);const r=await p.evaluate(()=>{const W=innerWidth,H=innerHeight,vis=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).opacity!=='0'};
   const all=[...document.querySelectorAll('#ui *')].filter(vis);
   const over=all.filter(e=>{const r=e.getBoundingClientRect();if(r.right<=W+1)return false;let a=e.parentElement;while(a){const s=getComputedStyle(a);if(/(auto|scroll|hidden)/.test(s.overflowX))return false;a=a.parentElement;}return true}).map(e=>e.tagName+'.'+String(e.className).slice(0,24));
   const small=[...document.querySelectorAll('#ui button, #ui [role=button]')].filter(vis).filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e,"::after"),pad=s.content!=="none"&&s.position==="absolute"?14:0;return (r.height+pad<32||r.width+pad<32)&&!e.closest('.vps')&&!e.disabled}).map(e=>(e.textContent.trim()||e.getAttribute('aria-label')||e.className).slice(0,18)+` ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
   const bar=document.querySelector('#ui .c-bar.b')?.getBoundingClientRect();
   const covering=bar?['.c-dispatch','.c-table','.mapbubble','.toast','.feed'].flatMap(s=>[...document.querySelectorAll('#ui '+s)].filter(vis).filter(e=>{const r=e.getBoundingClientRect();return r.bottom>bar.top+2&&r.top<bar.bottom&&!e.closest('.dock')}).map(e=>s)):[];
   const clipped=[...document.querySelectorAll('#ui .go, #ui .dundo span, #ui .dchip, #ui .c-prompt b, #ui h3, #ui h4')].filter(vis).filter(e=>e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).textOverflow!=='ellipsis').map(e=>e.textContent.trim().slice(0,24));
   return {over:[...new Set(over)].slice(0,5),small:[...new Set(small)].slice(0,6),covering:[...new Set(covering)],clipped:clipped.slice(0,4)}});
  const bad=Object.entries(r).filter(([,v])=>v.length);out.push(`${name.padEnd(22)} ${bad.length?JSON.stringify(Object.fromEntries(bad)):'ok'}`);await p.screenshot({path:O+name+'.png'});};
 const G=(fn,arg)=>p.evaluate(fn,arg);const tap=async(s)=>{await p.tap(s).catch(()=>{});await p.waitForTimeout(350)};
 // ---- home
 await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(3500);
 await G(()=>{const o=__fab.online;o.mode='remote';o.ready=true;o.hasAccounts=true;o.uid='u1';o.admin=false;o.account={uid:'u1',name:'Riccardo',email:'r@example.com',guest:false,admin:false};__fab.setMatches([{id:'a',game:'bulge',title:'Bulge with Marco',opts:{scenario:'campaign',fuel:true,bridgeLimit:true,bid:2},owner:'u1',members:[],germanName:'Riccardo',alliedName:'Marco',created:Date.now()},{id:'b',game:'bulge',title:'Cold Shoulder test',opts:{scenario:'cold',fuel:true},owner:'u1',members:[],germanName:'Riccardo',alliedName:null,created:Date.now()}]);__fab.setGame(__fab.game());});
 await p.waitForTimeout(500);await check('01-home-list');await p.click('text=New',{force:true}).catch(()=>{});await p.waitForTimeout(400);await check('02-home-new');await tap('.optrules .ohead');await check('03-home-optional');
 await G(()=>{const o=__fab.online;o.account={uid:'g',name:'',email:'',guest:true,admin:false};__fab.setMatches([]);__fab.setGame(__fab.game());});await p.waitForTimeout(400);await check('04-home-guest');
 // ---- game (sandbox)
 await p.goto('http://localhost:5199/?sandbox=1');await p.waitForFunction(()=>window.__fab&&document.querySelector('.c-bar.b'),{timeout:20000});await p.waitForTimeout(1200);await tap('[title="Hide the sandbox tools"]');
 const NEW=(o)=>G((o)=>{const f=__fab,E=f.E,g=E.newGame(undefined,{scenario:'campaign',fuel:true,...(o.opts||{})});Object.assign(g,o.set||{});f.setGame(g);return true},o);
 // reinforcement with arrivals
 await G(()=>{const f=__fab,E=f.E,g=E.newGame(undefined,{scenario:'campaign',fuel:true});g.turn=3;g.phasing='allied';g.phase='supply';g.supplyPending=false;g.contestedAtMoveStart=E.contestedAreas(g);try{E.endPhase(g)}catch(e){}f.setGame(g)});await p.waitForTimeout(800);await check('05-reinforcement');
 await tap('[data-arr]');await check('06-arrival-selected');
 // prepare
 await G(()=>{const f=__fab,E=f.E,g=E.newGame(undefined,{scenario:'campaign',fuel:true});g.phase='admin';g.turn=3;g.phasing='german';for(const c of g.chits.filter(c=>c.side==='german'&&(c.box==='cup'||c.box==='future')).slice(0,10))c.box='available';const cs=g.chits.find(c=>c.side==='german'&&c.kind==='command_staff');cs.box='available';window._cs=cs.id;f.setGame(g)});await p.waitForTimeout(700);await check('07-prepare-hand');
 const cs=await G(()=>window._cs);if(!(await p.$(`.card2[data-chit="${cs}"]`)))await tap('.handtab button');await tap(`.card2[data-chit="${cs}"]`);await check('08-chitbar-staff');
 await tap('.chitbar [aria-label="What it does"]');await check('09-chitbar-rules');await tap('.chitbar [aria-label="Put away"]');
 // movement
 await G(()=>{const f=__fab,E=f.E,g=E.newGame(undefined,{scenario:'campaign',fuel:true});g.phase='movement';g.turn=2;for(const c of g.chits)if(c.kind==='fuel'&&c.side==='german')c.box='used';const u=g.units.find(u=>u.side==='german'&&u.area!=null&&!u.garrison&&E.moveOptions(g,u.id).length);u.interdict=undefined;f.setGame(g);f.sel(u.id)});await p.waitForTimeout(800);await check('10-move-selected');
 await G(()=>{const f=__fab,E=f.E;f.act(()=>{const g=f.g,u=g.units.find(x=>x.id===g.units.find(u=>u.side==='german'&&u.area!=null&&!u.garrison&&E.moveOptions(g,u.id).length).id);E.move(g,u.id,E.moveOptions(g,u.id)[0].area)},'x')});await p.waitForTimeout(700);await check('11-after-move');
 // fight: choose
 await NEW({set:{phase:'combat',turn:2}});await p.waitForTimeout(700);await check('12-fight-choose');
 // battle set-up with assets + SA
 await G(()=>{const f=__fab,E=f.E,g=E.newGame(undefined,{scenario:'campaign',fuel:true});g.phase='combat';g.turn=3;for(const c of g.chits)if(c.kind==='sa_block')c.box='available';const a=10;g.fieldWorks.push(a);g.fwOwner[a]='allied';const b=E.startBattle(g,a);const add=(side,kinds)=>{for(const k of kinds){g.chits.find(c=>c.side===side&&c.kind===k&&c.box!=='map'&&(()=>{const o=c.box;c.box='available';try{E.assign(g,b,c.id);return true}catch{c.box=o;return false}})());}};add('german',['artillery','rocket_artillery','engineer','armor_asset','infantry_asset']);add('allied',['artillery','armor_asset']);for(const c of g.chits.filter(c=>c.side==='german'&&c.box==='cup').slice(0,8))c.box='available';f.setGame(g)});await p.waitForTimeout(1500);await check('13-battle-setup');
 await G(()=>{const f=__fab,g=f.game();g.battle.stage='attArty';for(const u of g.units)if(u.area===g.battle.area)u.up=u.area;f.setGame(g)});await p.waitForTimeout(1300);await check('14-battle-artillery');
 await G(()=>{const f=__fab,g=f.game();g.battle.stage='offFire';f.setGame(g)});await p.waitForTimeout(1300);await check('15-battle-offfire');
 await G(()=>{const f=__fab,g=f.game();g.battle.stage='defChoice';g.battle.pending=2;g.battle.pendingKind='ground';f.setGame(g)});await p.waitForTimeout(1300);await check('16-battle-hitchoice');
 await G(()=>{const f=__fab,g=f.game();g.battle.stage='done';g.battle.result='Attack aborted: attackers disordered';f.setGame(g)});await p.waitForTimeout(1300);await check('17-battle-over');
 // breakthrough
 await G(()=>{const f=__fab,E=f.E,g=E.newGame(undefined,{scenario:'campaign',fuel:true});g.phase='btMove';g.turn=2;for(const u of g.units)u.moved=false;for(const c of g.chits)if(c.kind==='sa_block')c.box='available';f.setGame(g)});await p.waitForTimeout(900);await check('18-breakthrough-move');
 await G(()=>{const f=__fab,E=f.E,g=f.game();g.phase='btCombat';g.contestedAtMoveStart=E.contestedAreas(g).slice(1);f.setGame(g)});await p.waitForTimeout(900);await check('19-breakthrough-combat');
 // supply
 await G(()=>{const f=__fab,E=f.E,g=E.newGame(undefined,{scenario:'campaign',fuel:true});g.phase='supply';g.phasing='german';g.supplyPending=true;g.units.filter(u=>u.side==='german'&&u.area!=null&&!u.garrison).slice(0,7).forEach(u=>u.unsupplied=true);f.setGame(g)});await p.waitForTimeout(800);await check('20-supply');
 // windows
 await NEW({set:{turn:4,phase:'movement'}});await p.waitForTimeout(600);
 await tap('[data-modal="boxes"]');await check('21-pieces-boxes');await tap('[title="Arrivals by turn"]');await check('22-pieces-arrivals');await tap('.modal [aria-label="Close"]');
 await tap('[data-modal="menu"]');await check('23-menu-players');await tap('.tabs button[aria-label="Log"]');await check('24-menu-log');await tap('.tabs button[aria-label="Settings"]');await check('25-menu-settings');await tap('.sheet [aria-label="Close"]');
 await tap('[data-tint]');await check('26-view');await tap('.modal [aria-label="Close"]');
 await tap('.vps');await check('27-vp-sheet');await tap('.vsheet [aria-label="Close"]');
 await G(()=>{const f=__fab,E=f.E,g=E.newGame(undefined,{scenario:'campaign',fuel:true});g.turn=9;g.over='Allied Marginal Victory';g.vpHist=[-11,-9,-6,-3,-1,1,2,0,-2];g.battles=31;f.setGame(g)});await p.waitForTimeout(800);await check('28-end-panel');
 fs.writeFileSync(O+'report.txt',out.join('\n'));console.log(out.join('\n'));await b.close();})();
