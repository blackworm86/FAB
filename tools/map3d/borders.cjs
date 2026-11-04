// Area borders as masks (2 px per map px, region crop): R = solid core, G = dashed core, B = wide halo.
const {chromium}=require('playwright');const fs=require('fs');const {execSync}=require('child_process');
const svg=fs.readFileSync('/home/user/FAB/web/public/map-lines.svg','utf8');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1740,height:1584},deviceScaleFactor:2});
 for(const [n,css] of [['bR','#boundaries path{stroke:#000;stroke-width:3.2px}'],['bG','#boundaries path{stroke:#000;stroke-width:3.4px;stroke-dasharray:9 6;stroke-linecap:butt}'],['bB','#boundaries path{stroke:#000;stroke-width:8px}']]){
  await p.setContent(`<style>body{margin:0;background:#fff}svg>*:not(defs):not(#boundaries){display:none}${css}</style>${svg}`);await p.waitForTimeout(300);await p.screenshot({path:n+'.png'});}
 await b.close();})();
