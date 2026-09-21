const db = require('../config/db');
const DAY = 86400000;
const dayKey = value => new Date(new Date(value).getTime() + 10800000).toISOString().slice(0,10);
function totalsFor(bookings,payments) {
 const valid=bookings.filter(b=>b.status!=='cancelled');
 return {bookings:bookings.length,completed:bookings.filter(b=>b.status==='completed').length,cancelled:bookings.filter(b=>b.status==='cancelled').length,noShows:bookings.filter(b=>b.no_show_reported_at).length,inProgress:bookings.filter(b=>['pending','active','awaiting_payment','on_hold'].includes(b.status)).length,bookingValue:valid.reduce((n,b)=>n+Number(b.amount_due),0),collected:payments.reduce((n,p)=>n+Number(p.amount),0),paidOnBookings:valid.reduce((n,b)=>n+Number(b.amount_paid),0),outstanding:valid.reduce((n,b)=>n+Math.max(0,Number(b.amount_due)-Number(b.amount_paid)),0),paymentCount:payments.length};
}
function summarizeManagement(bookings,payments,from,to){
 const groups={branches:new Map(),services:new Map(),providers:new Map(),methods:new Map(),days:new Map()};
 const ensure=(map,key,name)=>{if(!map.has(key))map.set(key,{id:key,name:name||'Unassigned',bookings:0,completed:0,collected:0,transactions:0});return map.get(key)};
 const first=Date.parse(dayKey(from)+'T00:00:00+03:00');for(let t=first;t<Date.parse(to);t+=DAY)ensure(groups.days,dayKey(t),dayKey(t));
 for(const b of bookings){for(const row of [ensure(groups.branches,b.branch_id,b.branch_name),ensure(groups.services,b.service_id,b.service_name),ensure(groups.providers,b.provider_id,b.provider_name),ensure(groups.days,dayKey(b.created_at),dayKey(b.created_at))]){row.bookings++;if(b.status==='completed')row.completed++;}}
 for(const p of payments){for(const row of [ensure(groups.branches,p.branch_id,p.branch_name),ensure(groups.services,p.service_id,p.service_name),ensure(groups.providers,p.provider_id,p.provider_name),ensure(groups.methods,p.method,p.method),ensure(groups.days,dayKey(p.created_at),dayKey(p.created_at))]){row.collected+=Number(p.amount);row.transactions++;}}
 const ranked=map=>[...map.values()].sort((a,b)=>b.collected-a.collected||b.bookings-a.bookings);
 return {totals:totalsFor(bookings,payments),branches:ranked(groups.branches),services:ranked(groups.services),providers:ranked(groups.providers),methods:ranked(groups.methods),days:[...groups.days.values()].sort((a,b)=>a.name.localeCompare(b.name))};
}
async function getManagement(req,res){
 const {from,to,providerId,serviceId}=req.query;
 const start=Date.parse(from),end=Date.parse(to);
 const branchId=req.user.role==='admin'?(req.query.branchId||null):req.user.branchId;
 if(req.user.role!=='admin'&&!branchId)return res.status(403).json({error:'A branch must be assigned to view reports.'});
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>367*DAY||[branchId,providerId,serviceId].some(id=>id&&!/^[1-9]\d*$/.test(String(id))))return res.status(400).json({error:'Choose a valid period of up to one year and valid report filters.'});
 const filters=[],values=[from,to];for(const [field,value] of [['branch_id',branchId],['provider_id',providerId],['service_id',serviceId]])if(value){values.push(value);filters.push(`AND b.${field}=$${values.length}`)}
 const scope=filters.join(' ');let client;
 try{
  client=await db.pool.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const bookings=(await client.query(`SELECT b.id,b.customer_name,b.customer_phone,b.status,b.amount_due,b.amount_paid,b.payment_status,b.created_at,b.no_show_reported_at,b.branch_id,br.name AS branch_name,b.service_id,s.name AS service_name,b.provider_id,u.name AS provider_name,r.name AS room_name,rec.name AS receptionist_name,COALESCE((SELECT string_agg(s2.name, ', ' ORDER BY ba.created_at) FROM booking_addons ba JOIN services s2 ON s2.id=ba.service_id WHERE ba.booking_id=b.id),'') AS extra_services FROM bookings b LEFT JOIN branches br ON br.id=b.branch_id LEFT JOIN services s ON s.id=b.service_id LEFT JOIN users u ON u.id=b.provider_id LEFT JOIN rooms r ON r.id=b.room_id LEFT JOIN users rec ON rec.id=b.receptionist_id WHERE b.created_at >= $1 AND b.created_at < $2 ${scope} ORDER BY b.created_at,b.id`,values)).rows;
  const payments=(await client.query(`SELECT p.id,p.booking_id,p.amount,p.method,p.created_at,b.customer_name,b.branch_id,br.name AS branch_name,b.service_id,s.name AS service_name,b.provider_id,u.name AS provider_name,rec.name AS recorded_by_name FROM payments p JOIN bookings b ON b.id=p.booking_id LEFT JOIN branches br ON br.id=b.branch_id LEFT JOIN services s ON s.id=b.service_id LEFT JOIN users u ON u.id=b.provider_id LEFT JOIN users rec ON rec.id=p.recorded_by WHERE p.created_at >= $1 AND p.created_at < $2 ${scope} ORDER BY p.created_at,p.id`,values)).rows;
  const prevFrom=new Date(start-(end-start)).toISOString();const prevValues=[prevFrom,from,...values.slice(2)];
  const prevBookings=(await client.query(`SELECT b.status,b.amount_due,b.amount_paid,b.no_show_reported_at FROM bookings b WHERE b.created_at >= $1 AND b.created_at < $2 ${scope}`,prevValues)).rows;
  const prevPayments=(await client.query(`SELECT p.amount FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE p.created_at >= $1 AND p.created_at < $2 ${scope}`,prevValues)).rows;
  const branch=branchId?(await client.query('SELECT name FROM branches WHERE id=$1',[branchId])).rows[0]?.name:null;
  if(branchId&&!branch){await client.query('ROLLBACK');return res.status(404).json({error:'The selected branch was not found.'});}
  await client.query('COMMIT');
  return res.json({...summarizeManagement(bookings,payments,from,to),previous:totalsFor(prevBookings,prevPayments),range:{from,to,previousFrom:prevFrom,previousTo:from},scope:{branchId,branchName:branch||'All branches',providerId:providerId||null,serviceId:serviceId||null},generatedAt:new Date().toISOString(),bookings,payments});
 }catch(err){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('Management report error:',err);return res.status(500).json({error:'Could not generate the report. Please try again.'});}finally{client?.release();}
}
module.exports={getManagement,summarizeManagement,totalsFor};
