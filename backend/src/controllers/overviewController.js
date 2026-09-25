const db=require('../config/db');
const {ROOM_SELECT,shapeRoom}=require('./roomController');
const DAY=86400000;
const dayKey=t=>new Date(new Date(t).getTime()+10800000).toISOString().slice(0,10);
function buildOverview({now,rooms,payments,bookings,branches,balances,lowStock,notifications}) {
 const start=Date.parse(dayKey(now)+'T00:00:00+03:00'),timestamp=Date.parse(now);
 const todayPayments=payments.filter(p=>Date.parse(p.created_at)>=start);
 const yesterday=payments.filter(p=>Date.parse(p.created_at)>=start-DAY&&Date.parse(p.created_at)<timestamp-DAY);
 const completed=bookings.filter(b=>b.status==='completed'&&b.ended_at&&Date.parse(b.ended_at)>=start&&Date.parse(b.ended_at)<=timestamp);
 const todayBookings=bookings.filter(b=>Date.parse(b.created_at)>=start);
 const days=Array.from({length:7},(_,i)=>({date:dayKey(start-(6-i)*DAY),amount:0}));
 for(const p of payments){const d=days.find(d=>d.date===dayKey(p.created_at));if(d)d.amount+=Number(p.amount);}
 const branchMap=new Map(branches.map(b=>[b.id,{id:b.id,name:b.name,rooms:0,active:0,pending:0,free:0,collected:0,completed:0}]));
 const row=(id,name)=>{if(!branchMap.has(id))branchMap.set(id,{id,name:name||'Unassigned',rooms:0,active:0,pending:0,free:0,collected:0,completed:0});return branchMap.get(id)};
 for(const r of rooms){const b=row(r.branch?.id??null,r.branch?.name);b.rooms++;if(r.status==='active')b.active++;else if(r.status==='pending')b.pending++;else b.free++;}
 for(const p of todayPayments)row(p.branch_id,p.branch_name).collected+=Number(p.amount);
 for(const b of completed)row(b.branch_id,b.branch_name).completed++;
 return {updatedAt:now,date:dayKey(now),rooms,totals:{collected:todayPayments.reduce((n,p)=>n+Number(p.amount),0),yesterdayCollected:yesterday.reduce((n,p)=>n+Number(p.amount),0),bookings:todayBookings.length,completed:completed.length,active:rooms.filter(r=>r.status==='active').length,pending:rooms.filter(r=>r.status==='pending').length,free:rooms.filter(r=>r.status==='inactive').length,onHold:bookings.filter(b=>b.status==='on_hold').length,overdue:rooms.filter(r=>r.currentBooking?.status==='active'&&r.currentBooking.expectedEndAt&&Date.parse(r.currentBooking.expectedEndAt)<timestamp).length,outstanding:Number(balances.amount||0),unpaid:Number(balances.count||0)},days,branches:[...branchMap.values()].sort((a,b)=>b.collected-a.collected||a.name.localeCompare(b.name)),payments:todayPayments,completed,lowStock,notifications};
}
async function getOverview(req,res){
 const branchId=req.query.branchId;
 if(branchId&&!/^[1-9]\d*$/.test(String(branchId)))return res.status(400).json({error:'Invalid branch.'});
 const now=new Date().toISOString(),today=Date.parse(dayKey(now)+'T00:00:00+03:00'),week=new Date(today-6*DAY).toISOString();
 const scope=branchId?'AND b.branch_id=$3':'';const params=branchId?[week,now,branchId]:[week,now];
 try{
 const [roomResult,payments,bookings,branches,balances,lowStock,notifications]=await Promise.all([
 db.query(`${ROOM_SELECT} WHERE r.is_archived=FALSE ${branchId?'AND r.branch_id=$1':''} ORDER BY br.name,r.name`,branchId?[branchId]:[]),
 db.query(`SELECT p.id,p.amount,p.created_at,b.branch_id,br.name AS branch_name,b.customer_name,u.name AS provider_name,rec.name AS receptionist_name FROM payments p JOIN bookings b ON b.id=p.booking_id LEFT JOIN branches br ON br.id=b.branch_id LEFT JOIN users u ON u.id=b.provider_id LEFT JOIN users rec ON rec.id=p.recorded_by WHERE p.created_at >= $1 AND p.created_at <= $2 ${scope} ORDER BY p.created_at DESC`,params),
 db.query(`SELECT b.id,b.customer_name,b.status,b.created_at,b.ended_at,b.branch_id,br.name AS branch_name,u.name AS provider_name,s.name AS service_name FROM bookings b LEFT JOIN branches br ON br.id=b.branch_id LEFT JOIN users u ON u.id=b.provider_id LEFT JOIN services s ON s.id=b.service_id WHERE (b.created_at >= $1 OR b.ended_at >= $1 OR b.status='on_hold') AND b.created_at <= $2 ${scope}`,branchId?[new Date(today).toISOString(),now,branchId]:[new Date(today).toISOString(),now]),
 db.query(`SELECT id,name FROM branches WHERE is_active=TRUE ${branchId?'AND id=$1':''}`,branchId?[branchId]:[]),
 db.query(`SELECT COUNT(*) AS count,COALESCE(SUM(b.amount_due-b.amount_paid),0) AS amount FROM bookings b WHERE b.status!='cancelled' AND b.amount_due>b.amount_paid ${branchId?'AND b.branch_id=$1':''}`,branchId?[branchId]:[]),
 db.query(`SELECT st.id,i.name AS item,br.name AS branch,st.quantity,i.minimum_stock AS minimum FROM inventory_branch_stock st JOIN inventory_items i ON i.id=st.item_id JOIN branches br ON br.id=st.branch_id WHERE st.quantity <= i.minimum_stock ${branchId?'AND st.branch_id=$1':''} ORDER BY st.quantity,i.name`,branchId?[branchId]:[]),
 db.query(`SELECT id,type,message,created_at FROM notifications ${branchId?'WHERE branch_id=$1':''} ORDER BY created_at DESC LIMIT 6`,branchId?[branchId]:[]),
 ]);
 return res.json(buildOverview({now,rooms:roomResult.rows.map(shapeRoom),payments:payments.rows,bookings:bookings.rows,branches:branches.rows,balances:balances.rows[0],lowStock:lowStock.rows,notifications:notifications.rows}));
 }catch(e){console.error('Overview error:',e);return res.status(500).json({error:'Could not refresh the overview. Please try again.'});}
}
module.exports={getOverview,buildOverview};
