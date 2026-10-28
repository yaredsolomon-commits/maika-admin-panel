/**
 * Forwards the admin panel's calls to the Maika backend, adding the backend
 * API key on the server so it never reaches the browser.
 *
 * Only the admin notification routes are allowed through, with the methods
 * the panel uses. The caller's own Supabase token is forwarded as is: the
 * backend checks it, and checks that the account is an admin. This proxy
 * decides nothing about who may do what.
 */

/** [path pattern, allowed methods] under /api/v1/. */
const ALLOWED_ROUTES = [
  [/^notifications\/types$/, ["GET"]],
  [/^notifications\/templates$/, ["GET", "POST"]],
  [/^notifications\/templates\/\d+$/, ["PATCH"]],
  [/^notifications\/app-update$/, ["POST"]],
  [/^notifications\/sends$/, ["GET"]],
];

const UPSTREAM_TIMEOUT_MS = 60_000;

/** @param {Record<string, string | undefined>} env */
export function readEnv(env, key) {
  const value = env[key];
  return value == null ? "" : String(value).trim();
}

export function isAllowed(path, method) {
  return ALLOWED_ROUTES.some(([pattern, methods]) => pattern.test(path) && methods.includes(method));
}

function json(status, message, code) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * @param {object} options
 * @param {Request} options.request
 * @param {Record<string, string | undefined>} options.env
 * @param {string} options.path  The part after /api/backend/, e.g. "notifications/sends".
 * @param {typeof fetch} [options.fetchImpl]
 */
export async function proxyToBackend({ request, env, path, fetchImpl = fetch }) {
  const method = request.method.toUpperCase();
  if (!isAllowed(path, method)) {
    return json(404, "Not found", "not_found");
  }

  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    return json(401, "Sign in first.", "unauthorized");
  }

  const baseUrl = readEnv(env, "MAIKA_BACKEND_URL").replace(/\/+$/, "");
  const apiKey = readEnv(env, "MAIKA_BACKEND_API_KEY");
  if (!baseUrl || !apiKey) {
    return json(503, "The admin panel isn't connected to the backend.", "not_configured");
  }

  const query = new URL(request.url).search;
  const headers = {
    Accept: "application/json",
    Authorization: authorization,
    "X-API-Key": apiKey,
  };
  let body;
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = await request.text();
  }

  let upstream;
  try {
    upstream = await fetchImpl(`${baseUrl}/api/v1/${path}${query}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return json(502, "The backend didn't respond. Try again in a moment.", "upstream_unreachable");
  }

  return new Response(upstream.status === 204 ? null : await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
