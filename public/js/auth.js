/**
 * Sign-in for the admin panel, with Supabase (the same project as the app).
 *
 * supabase-js is loaded from esm.sh, pinned to the same exact version as
 * maika-website, and configured from /api/config. It keeps the session in
 * localStorage and refreshes it on its own.
 *
 * Being signed in isn't enough: an account is an admin only if the backend
 * says so (`users.is_admin`). checkAdmin() asks an admin-only route, the
 * same check every admin route applies, so the panel never has to trust
 * its own copy of the flag.
 */
const SUPABASE_JS_URL = "https://esm.sh/@supabase/supabase-js@2.112.3";

let clientPromise = null;

/** @returns {Promise<import("@supabase/supabase-js").SupabaseClient>} */
export function getSupabase() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const response = await fetch("/api/config", { cache: "no-store" });
      const config = response.ok ? await response.json() : null;
      if (!config?.configured) {
        throw new Error("The admin panel isn't connected to Supabase (SUPABASE_URL / SUPABASE_ANON_KEY).");
      }
      const { createClient } = await import(SUPABASE_JS_URL);
      return createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "maika-admin-auth" },
      });
    })().catch((error) => {
      // Let the next call retry instead of failing for the page's lifetime.
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export async function getSession() {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** @returns {Promise<string | null>} An error message, or null on success. */
export async function signIn(email, password) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return null;
  if (/invalid login credentials/i.test(error.message)) return "Wrong email or password.";
  if (/email not confirmed/i.test(error.message)) return "Confirm your email address first.";
  return error.message || "Couldn't sign in. Try again.";
}

export async function signOut() {
  try {
    const supabase = await getSupabase();
    await supabase.auth.signOut();
  } catch {
    // Signing out locally must never fail the caller.
  }
}

/**
 * @returns {Promise<"admin" | "not_admin" | "signed_out" | "unavailable">}
 */
export async function checkAdmin() {
  const session = await getSession();
  if (!session) return "signed_out";
  try {
    const response = await fetch("/api/backend/notifications/types", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (response.ok) return "admin";
    if (response.status === 403) return "not_admin";
    if (response.status === 401) return "signed_out";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

/**
 * For pages only admins may see: sends anyone else to the sign-in page.
 * Resolves with the session when the account is an admin.
 */
export async function requireAdmin() {
  const status = await checkAdmin().catch(() => "unavailable");
  if (status === "admin") return getSession();
  if (status === "not_admin") await signOut();
  // Someone who simply isn't signed in gets the plain form, no message.
  const hadSession = status !== "signed_out" || (await getSession().catch(() => null)) !== null;
  window.location.replace(hadSession ? `/login/?reason=${encodeURIComponent(status)}` : "/login/");
  return new Promise(() => {});
}
