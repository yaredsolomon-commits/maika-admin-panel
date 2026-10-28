/**
 * GET /api/config — the Supabase settings the browser signs in with.
 * Both are public by design (the anon key is meant for browsers); the
 * backend API key is never sent from here.
 */
import { readEnv } from "../_lib/backend_proxy.js";

export async function onRequestGet({ env }) {
  const supabaseUrl = readEnv(env, "SUPABASE_URL");
  const supabaseAnonKey = readEnv(env, "SUPABASE_ANON_KEY");
  return new Response(
    JSON.stringify({ supabaseUrl, supabaseAnonKey, configured: !!(supabaseUrl && supabaseAnonKey) }),
    { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
  );
}
