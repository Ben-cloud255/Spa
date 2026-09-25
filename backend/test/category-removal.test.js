const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function controller(query) {
 const box = {module:{exports:{}}, require:(name)=>name.includes('auditLog')?{logAudit:async()=>{}}:{query}, console:{error(){}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/controllers/categoryController'),'utf8'),box);
 return box.module.exports.removeCategory;
}
function response(){return {code:200,body:null,status(code){this.code=code;return this},json(body){this.body=body;return this}}}
test('invalid category identifiers never reach the database',async()=>{const handler=controller(()=>{throw Error('Unexpected database access')});for(const id of ['bad','0','-1','1.5']){const res=response();await handler({params:{id}},res);assert.equal(res.code,400)}});
test('missing category returns a useful not-found response',async()=>{const res=response();await controller(async()=>({rows:[]}))({params:{id:'42'}},res);assert.equal(res.code,404)});
test('successful deletion only targets the selected category',async()=>{const res=response();let calls=0;await controller(async(sql,params)=>{calls++;assert.match(sql,/DELETE FROM service_categories WHERE id = \$1 RETURNING id/);assert.equal(params[0],42);return {rows:[{id:42}]}})({params:{id:'42'}},res);assert.equal(calls,1);assert.equal(res.body.success,true)});
test('database failure is reported without claiming success',async()=>{const res=response();await controller(async()=>{throw Error('database unavailable')})({params:{id:'42'}},res);assert.equal(res.code,500);assert.ok(res.body.error)});

