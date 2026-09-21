const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function setup({status = 'in_use', authorized = true, fail = false} = {}) {
 const events = [], alerts = [];
 const allocation = {id: 1, item_id: 2, room_id: 3, branch_id: 4, quantity: '10.00', status};
 const client = {release(){}, async query(sql) {
  events.push(sql);
  if(sql.startsWith('SELECT * FROM inventory_room_allocations')) return {rows:[allocation]};
  if(sql.includes('SELECT r.provider_id')) return {rows:[{provider_id: authorized ? 7 : 8}]};
  if(fail && sql.includes('SET status')) throw Error('write failure');
  return {rows:[]};
 }};
 const db = {pool:{connect:async()=>client},query:async sql=>({rows:[{name:sql.includes('inventory_items')?'Face cream':'Room 3'}]})};
 const sandbox={module:{exports:{}},console:{error(){}}, require:n=>n==='../config/db'?db:n==='../utils/notify'?{notify:async alert=>{assert.ok(events.includes('COMMIT'));alerts.push(alert)}}:{logAudit(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/controllers/inventoryController.js'),'utf8'),sandbox);
 return {alerts,async complete(){const res={code:200,status(c){this.code=c;return this},json(b){this.body=b;return this}};await sandbox.module.exports.completeAllocation({params:{id:1},body:{quantityReturned:2},user:{id:7,name:'Provider',role:'provider'}},res);return res;}};
}
test('completed item alerts the branch receptionist through the shared admin notification channel',async()=>{
 const s=setup();assert.equal((await s.complete()).code,200);assert.equal(s.alerts.length,1);
 const a=s.alerts[0];assert.equal(a.type,'inventory_item_finished');assert.equal(a.targetRole,'receptionist');assert.equal(a.branchId,4);assert.equal(a.roomId,3);assert.match(a.message,/Provider.*Face cream.*Room 3/);assert.match(a.message,/Returned to stock: 2/);
});
test('duplicate, unauthorized and failed completions do not send alerts',async()=>{
 for(const [options,code] of [[{status:'completed'},409],[{authorized:false},403],[{fail:true},500]]){const s=setup(options);assert.equal((await s.complete()).code,code);assert.equal(s.alerts.length,0);}
});
test('shared notification delivery persists and targets admin plus only the selected branch receptionist',async()=>{
 const targets=[],queries=[];const notification={id:1};const sandbox={module:{exports:{}},console,require:n=>n==='../config/db'?{query:async(sql,args)=>{queries.push({sql,args});return {rows:sql.includes('INSERT INTO notifications')?[notification]:[]}}}:n==='../sockets'?{getIo:()=>({to:target=>({emit:(event)=>targets.push([target,event])})})}:{sendPushToSubscriptions:async()=>{}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/utils/notify.js'),'utf8'),sandbox);
 await sandbox.module.exports.notify({type:'inventory_item_finished',message:'Finished',roomId:3,branchId:4,targetRole:'receptionist'});
 assert.deepEqual(targets,[['role:admin','notification:new'],['branch:4:role:receptionist','notification:new']]);assert.equal(queries[0].args[4],4);assert.equal(queries[0].args[5],'receptionist');
});
