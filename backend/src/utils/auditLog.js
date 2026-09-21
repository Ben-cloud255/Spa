const db = require('../config/db');

/**
 * Records one row in the audit trail. Best-effort — logging must never
 * break the action it's recording, so any failure here is caught and
 * logged to the console instead of thrown.
 *
 * req is the Express request of the logged-in staff member performing the
 * action (so we always know who did it); entityLabel is a short human
 * readable description of what was acted on (a customer's name, a booking
 * reference, a branch name, etc).
 */
/**
 * Records one row in the audit trail. Best-effort — logging must never
 * break the action it's recording, so any failure here is caught and
 * logged to the console instead of thrown.
 *
 * req is the Express request of the logged-in staff member performing the
 * action (so we always know who did it); entityLabel is a short human
 * readable description of what was acted on (a customer's name, a booking
 * reference, a branch name, etc).
 *
 * Pass `actor` to record on behalf of someone other than req.user — needed
 * for login, where the user has just been verified but requireAuth (which
 * normally sets req.user) hasn't run yet.
 */
async function logAudit(req, { action, entityType, entityLabel, branchId = null, actor = null }) {
  try {
    const who = actor || req?.user;
    if (!who) return;
    await db.query(
      `INSERT INTO audit_log (actor_user_id, actor_name, actor_role, action, entity_type, entity_label, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [who.id, who.name, who.role, action, entityType, entityLabel, branchId]
    );
  } catch (err) {
    console.error('[audit] Failed to record audit entry:', err.message);
  }
}

module.exports = { logAudit };
