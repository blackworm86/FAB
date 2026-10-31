const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('http://localhost:5199/?dev=1');await p.waitForTimeout(5000);
const d=await p.evaluate(()=>window.__fab.sheets());fs.writeFileSync('/tmp/sheets.json',JSON.stringify(d));console.log(Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.length])),er);await b.close()})()
