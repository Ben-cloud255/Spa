const fs=require('fs');
const css=fs.readFileSync('sidebar-preview/theme-check.css','utf8');
const page=fs.readFileSync('overview-preview/overview.html','utf8');
fs.writeFileSync('sidebar-preview/theme-overview.html',page.replace(/<style>[\s\S]*?<\/style>/,'<style>'+css+'body{background:#f8faf8;margin:0;padding:28px;font-family:Arial,sans-serif;--font-display:Georgia;--font-body:Arial}main{max-width:1200px;margin:auto}</style>'));
function lum(hex){const a=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722}
for(const [name,fg,bg] of [['Body','152625','f8faf8'],['Secondary','2f6b58','f8faf8'],['Table headings','1f4f40','f8faf8'],['Button label','fcfdfc','1f4f40']])console.log(name+': '+((Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05)).toFixed(2)+':1');
