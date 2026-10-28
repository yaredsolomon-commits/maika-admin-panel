/**
 * "Send app update" tab: POST /notifications/app-update.
 *
 * The backend notifies every device of the platform whose build is older
 * than the one given, and refuses a second announcement of the same build
 * (409). Title and text come from the chosen template; they're sent only
 * when edited, so the record shows which template went out unchanged.
 */
import { api } from "../api.js";
import { $, attachCounter, confirmDialog, h, PLATFORM_LABELS, toast, withBusy } from "../ui.js";

// The backend's own default text (NotificationService), shown when no
// template is picked.
const DEFAULT_TITLE = "A new version of Maika is available";
const DEFAULT_BODY = "Update now to get the latest improvements.";

export function initSend({ onSent }) {
  const form = $("#send-form");
  const templateSelect = $("#template");
  const titleField = $("#title");
  const bodyField = $("#body");
  const buildField = $("#build");
  const urlField = $("#url");
  const errorBox = $("#send-error");
  const resultBox = $("#send-result");
  const submit = $("#send-submit");

  let templates = [];
  // What the title and text start from: the template's, or the default.
  let base = { title: DEFAULT_TITLE, body: DEFAULT_BODY };

  const updateTitleCount = attachCounter(titleField, $("#title-counter"));
  const updateBodyCount = attachCounter(bodyField, $("#body-counter"));

  const platform = () => form.querySelector('input[name="platform"]:checked').value;

  function updatePreview() {
    $("#preview-title").textContent = titleField.value.trim() || "Title";
    $("#preview-body").textContent = bodyField.value.trim() || "Text";
  }

  function updatePlatformHints() {
    const p = platform();
    $("#platform-hint").textContent =
      p === "ios" ? "iPhones only receive it once the APNs key is set up in Firebase." : "";
    $("#url-hint").textContent =
      `Leave empty to use the backend's APP_UPDATE_URL_${p.toUpperCase()}, the same link as the app's "Update required" screen.`;
  }

  function applyBase() {
    const template = templates.find((t) => String(t.id) === templateSelect.value);
    base = template ? { title: template.title, body: template.body } : { title: DEFAULT_TITLE, body: DEFAULT_BODY };
    titleField.value = base.title;
    bodyField.value = base.body;
    updateTitleCount();
    updateBodyCount();
    updatePreview();
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  async function reloadTemplates() {
    try {
      templates = await api("notifications/templates", { query: { type_key: "app_update" } });
    } catch (error) {
      toast(`Couldn't load templates: ${error.message}`, "error");
      templates = [];
    }
    const selected = templateSelect.value;
    templateSelect.replaceChildren(
      h("option", { value: "" }, "Default message"),
      ...templates.map((t) => h("option", { value: String(t.id) }, t.name)),
    );
    const stillThere = templates.some((t) => String(t.id) === selected);
    templateSelect.value = stillThere ? selected : "";
    if (!stillThere) applyBase();
  }

  function renderResult(send) {
    const a = send.audience ?? {};
    resultBox.replaceChildren(
      h(
        "section",
        { class: "card result", "aria-live": "polite" },
        h("h3", null, `${PLATFORM_LABELS[a.platform] ?? a.platform} build ${a.below_build} announced`),
        h(
          "div",
          { class: "stats" },
          stat(send.device_count, "Outdated devices"),
          stat(send.sent_count, "Accepted by Firebase"),
          stat(send.failed_count, "Failed"),
          stat(send.removed_count, "Dead tokens removed"),
        ),
        send.device_count === 0
          ? h("p", { class: "cell-sub" }, "No registered device was on an older build, so nothing went out. It still counts as announced.")
          : null,
        send.completed_at
          ? null
          : h("p", { class: "alert alert-error" }, "The send was interrupted. Some devices may have been notified; this build can't be announced again."),
      ),
    );
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showError("");

    const p = platform();
    const build = Number(buildField.value);
    const title = titleField.value.trim();
    const body = bodyField.value.trim();
    const url = urlField.value.trim();

    if (!Number.isInteger(build) || build < 1) return showError("Enter the new build number, e.g. 46.");
    if (!title || !body) return showError("The notification needs a title and a text.");
    if (url && !/^https?:\/\/\S+$/i.test(url)) return showError("The store link must start with https://.");

    const payload = { platform: p, build };
    if (templateSelect.value) payload.template_id = Number(templateSelect.value);
    if (title !== base.title) payload.title = title;
    if (body !== base.body) payload.body = body;
    if (url) payload.url = url;

    withBusy(submit, async () => {
      const confirmed = await confirmDialog({
        title: `Send to ${PLATFORM_LABELS[p]} users?`,
        body: [
          h("p", null, `Every ${PLATFORM_LABELS[p]} device on a build older than ${build} gets:`),
          h(
            "div",
            { class: "notification" },
            h("div", { class: "notification-title" }, title),
            h("div", { class: "notification-body" }, body),
          ),
          h("p", null, `${PLATFORM_LABELS[p]} build ${build} can only be announced once.`),
        ],
        confirmLabel: "Send now",
      });
      if (!confirmed) return;

      try {
        const send = await api("notifications/app-update", { method: "POST", body: payload });
        renderResult(send);
        toast(`Sent to ${send.sent_count} of ${send.device_count} devices.`, "success");
        buildField.value = "";
        onSent?.();
      } catch (error) {
        showError(error.message);
      }
    });
  });

  for (const radio of form.querySelectorAll('input[name="platform"]')) {
    radio.addEventListener("change", updatePlatformHints);
  }
  templateSelect.addEventListener("change", applyBase);
  titleField.addEventListener("input", updatePreview);
  bodyField.addEventListener("input", updatePreview);

  updatePlatformHints();
  applyBase();
  reloadTemplates();

  return { reloadTemplates };
}

function stat(value, label) {
  return h("div", { class: "stat" }, h("div", { class: "stat-value" }, value), h("div", { class: "stat-label" }, label));
}
