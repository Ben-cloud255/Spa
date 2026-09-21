const db = require('../config/db');
const DAY = 86400000;
const OFFSET = 3 * 3600000;
const localDay = value => new Date(new Date(value).getTime() + OFFSET).toISOString().slice(0, 10);
function summarize(bookings, payments) {
  const valid = bookings.filter(b => b.status !== 'cancelled');
  return {
    revenue: payments.reduce((n, p) => n + Number(p.amount), 0),
    bookings: bookings.length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
    averageValue: valid.length ? valid.reduce((n, b) => n + Number(b.amount_due), 0) / valid.length : 0,
    outstanding: valid.reduce((n, b) => n + Math.max(0, Number(b.amount_due) - Number(b.amount_paid)), 0),
  };
}
function buildAnalytics({bookings, payments, branches, stock, centralValue, from, to}) {
  const start = new Date(from).getTime(), end = new Date(to).getTime();
  const inPeriod = row => new Date(row.created_at).getTime() >= start;
  const currentBookings = bookings.filter(inPeriod), currentPayments = payments.filter(inPeriod);
  const current = summarize(currentBookings, currentPayments);
  const previous = summarize(bookings.filter(b => !inPeriod(b)), payments.filter(p => !inPeriod(p)));
  const days = new Map();
  const first = Date.parse(localDay(from) + 'T00:00:00+03:00');
  for (let time = first; time < end; time += DAY) days.set(localDay(time), {date: localDay(time), revenue: 0, bookings: 0});
  const hours = Array.from({length:24}, (_, hour) => ({hour, bookings:0}));
  const status = new Map();
  const byBranch = new Map(branches.map(b => [b.id, {id:b.id, name:b.name, bookings:0, completed:0, revenue:0}]));
  const services = new Map(), providers = new Map();
  function row(map, id, name) { if (!map.has(id)) map.set(id, {id, name:name || 'Unassigned', bookings:0, completed:0, revenue:0}); return map.get(id); }
  for (const b of currentBookings) {
    const day = days.get(localDay(b.created_at)); if(day) day.bookings++;
    hours[new Date(new Date(b.created_at).getTime()+OFFSET).getUTCHours()].bookings++;
    status.set(b.status, (status.get(b.status)||0)+1);
    for (const r of [row(byBranch,b.branch_id,b.branch_name),row(services,b.service_id,b.service_name),row(providers,b.provider_id,b.provider_name)]) {r.bookings++; if(b.status==='completed') r.completed++;}
  }
  for (const p of currentPayments) {
    const day = days.get(localDay(p.created_at)); if(day) day.revenue += Number(p.amount);
    for (const r of [row(byBranch,p.branch_id,p.branch_name),row(services,p.service_id,p.service_name),row(providers,p.provider_id,p.provider_name)]) r.revenue += Number(p.amount);
  }
  const rank = map => [...map.values()].sort((a,b)=>b.revenue-a.revenue || b.bookings-a.bookings);
  const lowStock = stock.filter(s=>Number(s.quantity)<=Number(s.minimum_stock)).map(s=>({id:s.id,item:s.item_name,branch:s.branch_name,quantity:Number(s.quantity),minimum:Number(s.minimum_stock)}));
  return {range:{from,to,previousFrom:new Date(start-(end-start)).toISOString(),previousTo:from},current,previous,days:[...days.values()],hours,statuses:[...status].map(([status,count])=>({status,count})),branches:rank(byBranch),services:rank(services),providers:rank(providers),inventory:{value:Number(centralValue)+stock.reduce((n,s)=>n+Number(s.quantity)*Number(s.cost_per_unit||0),0),lowStock},updatedAt:new Date().toISOString()};
}
async function getAnalytics(req,res) {
  const {from,to,branchId} = req.query;
  const start = Date.parse(from), end = Date.parse(to);
  if (!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>367*DAY || (branchId && !/^\d+$/.test(String(branchId)))) return res.status(400).json({error:'Choose a valid date range of up to one year and a valid branch.'});
  const previousFrom = new Date(start-(end-start)).toISOString();
  const params = branchId ? [previousFrom,to,branchId] : [previousFrom,to];
  const scope = branchId ? 'AND b.branch_id = $3' : '';
  try {
    const [bookings,payments,branches,stock,central] = await Promise.all([
      db.query(`SELECT b.id,b.status,b.amount_due,b.amount_paid,b.created_at,b.branch_id,br.name AS branch_name,b.service_id,s.name AS service_name,b.provider_id,u.name AS provider_name FROM bookings b LEFT JOIN branches br ON br.id=b.branch_id LEFT JOIN services s ON s.id=b.service_id LEFT JOIN users u ON u.id=b.provider_id WHERE b.created_at >= $1 AND b.created_at < $2 ${scope}`,params),
      db.query(`SELECT p.amount,p.created_at,b.branch_id,br.name AS branch_name,b.service_id,s.name AS service_name,b.provider_id,u.name AS provider_name FROM payments p JOIN bookings b ON b.id=p.booking_id LEFT JOIN branches br ON br.id=b.branch_id LEFT JOIN services s ON s.id=b.service_id LEFT JOIN users u ON u.id=b.provider_id WHERE p.created_at >= $1 AND p.created_at < $2 ${scope}`,params),
      db.query(`SELECT id,name FROM branches ${branchId?'WHERE id=$1':''} ORDER BY name`,branchId?[branchId]:[]),
      db.query(`SELECT st.id,st.quantity,i.minimum_stock,i.cost_per_unit,i.name AS item_name,br.name AS branch_name FROM inventory_branch_stock st JOIN inventory_items i ON i.id=st.item_id JOIN branches br ON br.id=st.branch_id ${branchId?'WHERE st.branch_id=$1':''}`,branchId?[branchId]:[]),
      branchId ? Promise.resolve({rows:[{value:0}]}) : db.query('SELECT COALESCE(SUM(available_quantity * COALESCE(cost_per_unit,0)),0) AS value FROM inventory_items'),
    ]);
    return res.json(buildAnalytics({bookings:bookings.rows,payments:payments.rows,branches:branches.rows,stock:stock.rows,centralValue:central.rows[0].value,from:new Date(start).toISOString(),to:new Date(end).toISOString()}));
  } catch(err) {console.error('Analytics error:',err);return res.status(500).json({error:'Could not load analytics. Please try again.'});}
}
module.exports={getAnalytics,buildAnalytics};
