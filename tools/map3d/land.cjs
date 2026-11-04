// Land mask (the terrain shape of map-base.svg) at 1 px per map px.
const {chromium}=require('playwright');const fs=require('fs');const base=fs.readFileSync('/home/user/FAB/web/public/map-base.svg','utf8');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1740,height:1584}});
await p.setContent(`<style>body{margin:0;background:#fff}svg>*:not(defs):not(#terrain){display:none}#terrain *{fill:#000!important}</style>${base}`);await p.waitForTimeout(400);await p.screenshot({path:'land.png'});await b.close();})();
