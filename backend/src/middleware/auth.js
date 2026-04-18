/**
 * RBAC middleware for Express — mirrors Python auth.py exactly.
 *
 * All protected routes read X-User-Id header, look up the user row
 * in Supabase `users` table, and attach it as req.currentUser.
 *
 * Roles: admin | recruiter
 * Multi-tenancy:
 *   - Recruiters → admin_id = the admin who manages them
 *   - Admins     → admin_id = null (they ARE the tenant root)
 */
const { getSupabase } = require('../lib/supabase');

/** Resolve caller from X-User-Id header. Attaches user row to req.currentUser. */
async function requireUser(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ detail: 'Missing X-User-Id header.' });
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('users')
      .select('id, role, email, admin_id')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return res.status(401).json({ detail: 'User not found.' });
    }

    req.currentUser = data;
    next();
  } catch (err) {
    return res.status(500).json({ detail: `Auth error: ${err.message}` });
  }
}

/** Only allow recruiter role. */
async function requireRecruiter(req, res, next) {
  await requireUser(req, res, () => {
    if (req.currentUser?.role !== 'recruiter') {
      return res.status(403).json({ detail: 'Access denied. Recruiter account required.' });
    }
    next();
  });
}

/** Only allow admin role. */
async function requireAdmin(req, res, next) {
  await requireUser(req, res, () => {
    if (req.currentUser?.role !== 'admin') {
      return res.status(403).json({ detail: 'Access denied. Admin account required.' });
    }
    next();
  });
}

/** Allow recruiter or admin. */
async function requireRecruiterOrAdmin(req, res, next) {
  await requireUser(req, res, () => {
    const role = req.currentUser?.role;
    if (role !== 'recruiter' && role !== 'admin') {
      return res.status(403).json({ detail: 'Access denied. Recruiter or Admin role required.' });
    }
    next();
  });
}

/**
 * Return the admin_id to use for tenant-scoping inserts/queries.
 * - Admins  → their own id (they are the tenant root)
 * - Recruiters → their admin_id (set at recruiter creation)
 */
function getTenantAdminId(user) {
  if (user.role === 'admin') return user.id;
  return user.admin_id ?? null;
}

module.exports = {
  requireUser,
  requireRecruiter,
  requireAdmin,
  requireRecruiterOrAdmin,
  getTenantAdminId,
};
