const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(4000);await p.screenshot({path:'/tmp/game.png'});console.log(er);await b.close()})()
