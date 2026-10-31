const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});const er=[];p.on('pageerror',e=>er.push(e.message));p.on('console',m=>m.type()==='error'&&er.push(m.text()));
await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(4000);
await p.click('[data-tint]');await p.click('.chip:text-is("TDN") >> nth=1');await p.waitForTimeout(2500);await p.click('[data-modal=""]');await p.waitForTimeout(500);await p.screenshot({path:'/tmp/t1.png'});
await p.click('[data-tint]');await p.click('.chip:text-is("Floating")');await p.waitForTimeout(2500);await p.click('[data-modal=""]');await p.waitForTimeout(500);await p.screenshot({path:'/tmp/t2.png'});console.log(er);await b.close()})()
