// The entry strips (green Allied, grey German) of map-base.svg alone, on a transparent background.
const {chromium}=require('playwright');const fs=require('fs');const base=fs.readFileSync('/home/user/FAB/web/public/map-base.svg','utf8');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1740,height:1584}});
await p.setContent(`<style>body{margin:0;background:transparent}svg>*:not(defs):not(#entering-zones){display:none}</style>${base}`);await p.waitForTimeout(400);await p.screenshot({path:'/home/user/FAB/web/public/relief/entry.png',omitBackground:true});await b.close();})();
