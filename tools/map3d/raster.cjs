// Rasterise single layers of the map SVGs to black-on-white masks (1 px = 1 map px).
const {chromium}=require('playwright');const fs=require('fs');
const base=fs.readFileSync('/home/user/FAB/web/public/map-base.svg','utf8'),lines=fs.readFileSync('/home/user/FAB/web/public/map-lines.svg','utf8');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1740,height:1584}});
 const shot=async(svg,keep,name,css='')=>{await p.setContent(`<style>body{margin:0;background:#fff}svg>*:not(defs):not(${keep}){display:none}${css}</style>${svg}`);await p.waitForTimeout(300);await p.screenshot({path:name+'.png'});};
 await shot(base,'#woods','woods');
 await shot(lines,'#rivers','rivers','#rivers *{stroke:#000!important}');
 await shot(lines,'#roads','roads','#roads *{stroke:#000!important}');
 await shot(lines,'#cities','cities','#cities *{fill:#000!important;stroke:#000!important}');
 await shot(lines,'#towns','townsonly','#towns *{fill:#000!important;stroke:none!important}');
 await shot(lines,'#boundaries','borders','#boundaries *{stroke:#000!important}');
 await b.close();})();
