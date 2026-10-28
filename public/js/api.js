/**
 * Calls the Maika backend through this site's /api/backend proxy, which
 * adds the API key. Sends the admin's Supabase token; the backend checks
 * that the account is an admin.
 */
import { getSession } from "./auth.js";

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {string} path  Under /api/v1/, e.g. "notifications/sends".
 * @param {{ method?: string, body?: unknown, query?: Record<string, unknown> }} [options]
 */
export async function api(path, { method = "GET", body, query } = {}) {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Your session ended. Sign in again.", "unauthorized");

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const search = params.toString() ? `?${params}` : "";

  let response;
  try {
    response = await fetch(`/api/backend/${path}${search}`, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection.", "network");
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(response.status, data), data?.error?.code);
  }
  return data;
}

function errorMessage(status, data) {
  const error = data?.error;
  const first = error?.details?.errors?.[0];
  if (first) {
    // FastAPI validation: say which field and why.
    const field = Array.isArray(first.loc) ? first.loc.filter((p) => p !== "body").join(".") : "";
    return field ? `${field}: ${first.msg}` : first.msg;
  }
  if (error?.message) return error.message;
  if (status === 401) return "Your session ended. Sign in again.";
  if (status === 403) return "This account doesn't have admin access.";
  return `Something went wrong (${status}). Try again.`;
}
