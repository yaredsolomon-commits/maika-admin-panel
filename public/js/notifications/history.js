/**
 * "History" tab: GET /notifications/sends, newest first.
 */
import { api } from "../api.js";
import { $, formatDateTime, h, PLATFORM_LABELS } from "../ui.js";

const LIMIT = 100;

export function initHistory({ types }) {
  const box = $("#history");
  const typeFilter = $("#history-type");
  const typeName = (key) => types.find((t) => t.key === key)?.name ?? key;

  typeFilter.replaceChildren(
    h("option", { value: "" }, "All types"),
    ...types.map((t) => h("option", { value: t.key }, t.name)),
  );

  async function reload() {
    box.replaceChildren(h("div", { class: "loading" }, "Loading history…"));
    try {
      const sends = await api("notifications/sends", { query: { type_key: typeFilter.value, limit: LIMIT } });
      render(sends);
    } catch (error) {
      box.replaceChildren(h("div", { class: "alert alert-error" }, error.message));
    }
  }

  function render(sends) {
    if (!sends.length) {
      box.replaceChildren(
        h("div", { class: "empty" }, h("strong", null, "Nothing sent yet"), "Notifications you send show up here."),
      );
      return;
    }
    box.replaceChildren(
      h(
        "table",
        null,
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h("th", { scope: "col" }, "Sent"),
            h("th", { scope: "col" }, "Message"),
            h("th", { scope: "col" }, "Audience"),
            h("th", { scope: "col", class: "num" }, "Devices"),
            h("th", { scope: "col", class: "num" }, "Accepted"),
            h("th", { scope: "col", class: "num" }, "Failed"),
            h("th", { scope: "col", class: "num" }, "Removed"),
            h("th", { scope: "col" }, "Status"),
          ),
        ),
        h(
          "tbody",
          null,
          ...sends.map((send) =>
            h(
              "tr",
              null,
              h(
                "td",
                { class: "cell-date" },
                h("div", null, formatDateTime(send.created_at)),
                h("div", { class: "cell-sub" }, send.sent_by ? "By an admin" : "Automatic"),
              ),
              h(
                "td",
                null,
                h("div", { class: "cell-title" }, send.title),
                h("div", { class: "cell-sub" }, send.body),
                h("span", { class: "badge badge-purple" }, typeName(send.type_key)),
              ),
              h("td", null, audienceLabel(send.audience)),
              h("td", { class: "num" }, send.device_count),
              h("td", { class: "num" }, send.sent_count),
              h("td", { class: "num" }, send.failed_count),
              h("td", { class: "num" }, send.removed_count),
              h(
                "td",
                null,
                send.completed_at
                  ? h("span", { class: "badge badge-ok" }, "Completed")
                  : h(
                      "span",
                      { class: "badge badge-warn", title: "Stopped partway: some devices may have been notified." },
                      "Interrupted",
                    ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  typeFilter.addEventListener("change", reload);
  $("#history-refresh").addEventListener("click", reload);

  return { reload };
}

function audienceLabel(audience) {
  if (audience?.platform) {
    const platform = PLATFORM_LABELS[audience.platform] ?? audience.platform;
    return audience.below_build ? `${platform}, below build ${audience.below_build}` : platform;
  }
  if (audience?.user_id) return "One user";
  return "—";
}
