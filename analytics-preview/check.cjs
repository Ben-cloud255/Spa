const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process');
require('../backend/node_modules/dotenv').config({path:'../backend/.env'});
const {pool}=require('../backend/src/config/db');
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'spa-analytics-check-'));
 const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});let ws;
 try{
 const user=(await pool.query("SELECT id,name,email,role,branch_id FROM users WHERE role='admin' AND is_active=TRUE LIMIT 1")).rows[0];const token=require('../backend/src/utils/jwt').signToken(user);
 for(let i=0;i<600&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await new Promise(r=>setTimeout(r,100));
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];const tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();
 ws=new WebSocket(tabs[0].webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
 await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('spa_token',${JSON.stringify(token)});localStorage.setItem('spa_user',${JSON.stringify(JSON.stringify(user))});`});await call('Page.navigate',{url:'http://localhost:3001/admin/analytics'});
 async function ready(){for(let i=0;i<180;i++){if(await ev("document.body.innerText.includes('How these numbers are calculated')"))return;await new Promise(r=>setTimeout(r,300));}fs.writeFileSync('preview-failure.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));console.log(await ev('JSON.stringify({url:location.href,text:document.body.innerText.slice(0,2000)})'));throw Error('Dashboard did not load');}
 await ready();await new Promise(r=>setTimeout(r,800));fs.writeFileSync('desktop.png',Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));console.log('Desktop overflow:',await ev('document.documentElement.scrollWidth>innerWidth'));
 await ev("(()=>{let e=document.getElementById('analytics-period');e.value='7';e.dispatchEvent(new Event('change',{bubbles:true}));})()");await new Promise(r=>setTimeout(r,800));await ready();
 await ev("(()=>{let e=document.getElementById('analytics-branch');e.value=e.options[1].value;e.dispatchEvent(new Event('change',{bubbles:true}));})()");await new Promise(r=>setTimeout(r,800));await ready();console.log('Branch and date filters passed');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await new Promise(r=>setTimeout(r,500));fs.writeFileSync('mobile.png',Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));console.log('Mobile overflow:',await ev('document.documentElement.scrollWidth>innerWidth'));
 await ev('localStorage.clear()');await call('Browser.close');
 }finally{ws?.close();browser.kill();await pool.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
