/**
 * /api/backend/<path> → MAIKA_BACKEND_URL/api/v1/<path>, with the backend
 * API key added here. See functions/_lib/backend_proxy.js.
 */
import { proxyToBackend } from "../../_lib/backend_proxy.js";

export async function onRequest({ request, env, params }) {
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  return proxyToBackend({ request, env, path: segments.filter(Boolean).join("/") });
}
