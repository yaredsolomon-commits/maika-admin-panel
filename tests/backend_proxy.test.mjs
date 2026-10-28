import assert from "node:assert/strict";
import { test } from "node:test";

import { isAllowed, proxyToBackend } from "../functions/_lib/backend_proxy.js";

const env = {
  MAIKA_BACKEND_URL: "https://backend.example/",
  MAIKA_BACKEND_API_KEY: "secret-key",
};

function request(path, { method = "GET", token = "jwt", body } = {}) {
  return new Request(`https://admin.example/api/backend/${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
}

function recordingFetch(status = 200, body = "[]") {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : body, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

test("only the admin notification routes, with their methods, are allowed", () => {
  assert.ok(isAllowed("notifications/types", "GET"));
  assert.ok(isAllowed("notifications/templates", "POST"));
  assert.ok(isAllowed("notifications/templates/12", "PATCH"));
  assert.ok(isAllowed("notifications/app-update", "POST"));
  assert.ok(isAllowed("notifications/sends", "GET"));

  assert.ok(!isAllowed("notifications/templates/12", "DELETE"));
  assert.ok(!isAllowed("notifications/app-update", "GET"));
  assert.ok(!isAllowed("notifications/devices", "PUT"));
  assert.ok(!isAllowed("users/me", "DELETE"));
  assert.ok(!isAllowed("notifications/templates/../../users/me", "PATCH"));
  assert.ok(!isAllowed("music", "POST"));
});

test("forwards the caller's token and query, adding the API key", async () => {
  const { calls, fetchImpl } = recordingFetch(200, '[{"id":1}]');
  const response = await proxyToBackend({
    request: new Request("https://admin.example/api/backend/notifications/sends?type_key=app_update&limit=5", {
      headers: { Authorization: "Bearer jwt" },
    }),
    env,
    path: "notifications/sends",
    fetchImpl,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ id: 1 }]);
  assert.equal(calls[0].url, "https://backend.example/api/v1/notifications/sends?type_key=app_update&limit=5");
  assert.equal(calls[0].init.headers.Authorization, "Bearer jwt");
  assert.equal(calls[0].init.headers["X-API-Key"], "secret-key");
  assert.equal(calls[0].init.body, undefined);
});

test("passes a JSON body through and the backend's status back", async () => {
  const { calls, fetchImpl } = recordingFetch(409, '{"error":{"message":"already announced"}}');
  const body = JSON.stringify({ platform: "android", build: 5 });
  const response = await proxyToBackend({
    request: request("notifications/app-update", { method: "POST", body }),
    env,
    path: "notifications/app-update",
    fetchImpl,
  });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.message, "already announced");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.body, body);
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
});

test("refuses other routes and calls without a token, without calling the backend", async () => {
  const { calls, fetchImpl } = recordingFetch();

  const blocked = await proxyToBackend({ request: request("users/me", { method: "DELETE" }), env, path: "users/me", fetchImpl });
  const anonymous = await proxyToBackend({
    request: request("notifications/types", { token: null }),
    env,
    path: "notifications/types",
    fetchImpl,
  });

  assert.equal(blocked.status, 404);
  assert.equal(anonymous.status, 401);
  assert.equal(calls.length, 0);
});

test("says so when the backend isn't configured or doesn't answer", async () => {
  const notConfigured = await proxyToBackend({
    request: request("notifications/types"),
    env: {},
    path: "notifications/types",
    fetchImpl: recordingFetch().fetchImpl,
  });
  const unreachable = await proxyToBackend({
    request: request("notifications/types"),
    env,
    path: "notifications/types",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });

  assert.equal(notConfigured.status, 503);
  assert.equal(unreachable.status, 502);
  // The API key never appears in what the browser gets back.
  assert.ok(!(await notConfigured.text()).includes("secret-key"));
});
