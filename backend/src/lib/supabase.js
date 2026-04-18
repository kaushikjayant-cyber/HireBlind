const { createClient } = require('@supabase/supabase-js');

let _client = null;

/**
 * Return a singleton Supabase service-role client.
 * Throws a clear error if env vars are missing.
 */
function getSupabase() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

module.exports = { getSupabase };
