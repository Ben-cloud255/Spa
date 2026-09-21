const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function setup(balance = 100, fail = false) {
 const state = { balance, branches: {}, history: [] };
 let tail = Promise.resolve();
 const db = { query: async () => ({ rows: [] }), pool: { connect: async () => {
   let unlock, snapshot;
   return { release() {}, async query(sql, args) {
    if (sql === 'BEGIN') return {};
    if (sql.includes('SELECT * FROM inventory_items')) {
      assert.match(sql, /FOR UPDATE/);
      const previous = tail; tail = new Promise(resolve => { unlock = resolve; }); await previous;
      snapshot = structuredClone(state);
      return { rows: [{ id: 1, name: 'Oil', unit: 'bottles', available_quantity: state.balance }] };
    }
    if (sql === 'ROLLBACK') { if (snapshot) Object.assign(state, snapshot); unlock?.(); return {}; }
    if (sql === 'COMMIT') { unlock?.(); return {}; }
    if (sql.startsWith('UPDATE inventory_items')) { state.balance -= args[0]; return {}; }
    if (sql.includes('INSERT INTO inventory_distributions')) { state.history.push(args); return {}; }
    if (sql.includes('INSERT INTO inventory_branch_stock')) {
      if (fail) throw Error('Simulated branch write failure');
      state.branches[args[1]] = (state.branches[args[1]] || 0) + args[2]; return {};
    }
    throw Error('Unexpected SQL: ' + sql);
   }};
 }}};
 const sandbox = { require: name => name === '../config/db' ? db : { logAudit() {} }, module: { exports: {} }, console: { error() {} } };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/inventoryController.js'), 'utf8'), sandbox);
 async function deliver(allocations) {
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await sandbox.module.exports.distribute({ body: { itemId: 1, allocations }, user: { id: 1 } }, res); return res;
 }
 return { state, deliver, controller: sandbox.module.exports, db };
}
test('delivery subtracts the combined allocations and credits both branches', async () => {
 const { state, deliver } = setup();
 assert.equal((await deliver([{ branchId: 1, quantity: 30 }, { branchId: 2, quantity: 20 }])).code, 201);
 assert.equal(state.balance, 50); assert.deepEqual(state.branches, { 1: 30, 2: 20 }); assert.equal(state.history.length, 2);
});
test('insufficient combined stock changes nothing', async () => {
 const { state, deliver } = setup(10);
 assert.equal((await deliver([{ branchId: 1, quantity: 6 }, { branchId: 2, quantity: 5 }])).code, 409);
 assert.equal(state.balance, 10); assert.equal(state.history.length, 0);
});
test('failed branch write rolls back central stock and history', async () => {
 const { state, deliver } = setup(10, true);
 assert.equal((await deliver([{ branchId: 1, quantity: 5 }])).code, 500);
 assert.equal(state.balance, 10); assert.equal(state.history.length, 0);
});
test('concurrent deliveries cannot overspend the same balance', async () => {
 const { state, deliver } = setup(10);
 const results = await Promise.all([deliver([{ branchId: 1, quantity: 7 }]), deliver([{ branchId: 2, quantity: 7 }])]);
 assert.deepEqual(results.map(r => r.code).sort(), [201, 409]); assert.equal(state.balance, 3);
});
test('fractional deliveries can consume the exact balance', async () => {
 const { state, deliver } = setup(0.3);
 assert.equal((await deliver([{ branchId: 1, quantity: 0.1 }, { branchId: 2, quantity: 0.2 }])).code, 201);
 assert.equal(state.balance, 0);
});
test('invalid quantities are rejected without writes', async () => {
 for (const quantity of [-1, 0, 'NaN', 'Infinity', 0.001, null, true]) {
  const { state, deliver } = setup(); assert.equal((await deliver([{ branchId: 1, quantity }])).code, 400); assert.equal(state.balance, 100);
 }
 assert.equal((await setup().deliver([null])).code, 400);
});
test('new catalog item stores initial unassigned stock separately from minimum', async () => {
 const { controller, db } = setup(); let captured;
 db.query = async (sql, args) => { captured = { sql, args }; return { rows: [{ id: 1 }] }; };
 const res = { status(c) { this.code=c; return this; }, json(v) { return v; } };
 await controller.createItem({ body: { name: 'Oil', minimumStock: 5, initialQuantity: 100 } }, res);
 assert.equal(res.code, 201); assert.match(captured.sql, /available_quantity/); assert.equal(captured.args[2], 5); assert.equal(captured.args[4], 100);
});
test('restocking increments the balance atomically', async () => {
 const { controller, db } = setup(); let captured;
 db.query = async (sql, args) => { captured = { sql, args }; return { rowCount: 1, rows: [{ name: 'Oil' }] }; };
 const res = { status(c) { this.code=c; return this; }, json(v) { return v; } };
 await controller.updateItem({ params: { id: 1 }, body: { quantityAdded: 25 } }, res);
 assert.match(captured.sql, /available_quantity = available_quantity \+ \$1/); assert.equal(captured.args[0], 25);
});
