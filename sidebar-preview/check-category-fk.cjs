require('../backend/node_modules/dotenv').config({path:'backend/.env'});
const db=require('../backend/src/config/db');
db.query("SELECT confdeltype FROM pg_constraint WHERE conrelid = 'services'::regclass AND confrelid = 'service_categories'::regclass AND contype = 'f'").then(r=>{if(!r.rows.length || r.rows.some(x=>x.confdeltype!=='n'))throw Error('Expected ON DELETE SET NULL');console.log('Verified: category deletion sets service category to null and preserves service records.');}).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.pool.end());
