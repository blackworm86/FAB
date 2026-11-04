// Renders the zone outlines as dashed black-on-white masks at 2 px per map px (one image per zone).
const {chromium}=require('playwright');const fs=require('fs');const Z=JSON.parse(fs.readFileSync('zones.json','utf8'));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1740,height:1584},deviceScaleFactor:2});
 for(const z of ['5','6','7']){await p.setContent(`<style>body{margin:0;background:#fff}</style><svg xmlns="http://www.w3.org/2000/svg" width="1740" height="1584" viewBox="0 0 1740 1584"><path d="${Z[z]}" fill="none" stroke="#000" stroke-width="2.6" stroke-dasharray="9 5" stroke-linejoin="round"/></svg>`);await p.waitForTimeout(200);await p.screenshot({path:`z${z}.png`});}
 await b.close();})();
