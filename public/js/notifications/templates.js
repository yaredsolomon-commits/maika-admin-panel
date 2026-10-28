/**
 * "Templates" tab: saved messages per notification type.
 * GET/POST /notifications/templates, PATCH /notifications/templates/{id}.
 * Templates are never deleted (sends point at them); they're retired.
 */
import { api } from "../api.js";
import { $, attachCounter, h, toast, withBusy } from "../ui.js";

export function initTemplates({ types }) {
  const list = $("#templates");
  const typeFilter = $("#templates-type");
  const showRetired = $("#templates-retired");
  const typeName = (key) => types.find((t) => t.key === key)?.name ?? key;

  typeFilter.replaceChildren(
    h("option", { value: "" }, "All types"),
    ...types.map((t) => h("option", { value: t.key }, t.name)),
  );

  async function reload() {
    list.replaceChildren(h("div", { class: "loading" }, "Loading templates…"));
    try {
      const templates = await api("notifications/templates", {
        query: { type_key: typeFilter.value, include_inactive: showRetired.checked },
      });
      render(templates);
    } catch (error) {
      list.replaceChildren(h("div", { class: "alert alert-error" }, error.message));
    }
  }

  function render(templates) {
    if (!templates.length) {
      list.replaceChildren(
        h(
          "div",
          { class: "card empty" },
          h("strong", null, "No templates yet"),
          "Create one to reuse the same message for every release.",
        ),
      );
      return;
    }
    list.replaceChildren(
      h(
        "div",
        { class: "template-list" },
        ...templates.map((template) =>
          h(
            "article",
            { class: `card template${template.is_active ? "" : " is-retired"}` },
            h(
              "div",
              { class: "template-head" },
              h("h3", { class: "template-name" }, template.name),
              h(
                "div",
                { class: "template-badges" },
                h("span", { class: "badge badge-purple" }, typeName(template.type_key)),
                template.is_active ? null : h("span", { class: "badge badge-warn" }, "Retired"),
              ),
            ),
            h(
              "div",
              { class: "template-message" },
              h("div", { class: "notification-title" }, template.title),
              h("div", { class: "notification-body" }, template.body),
            ),
            h(
              "div",
              { class: "template-actions" },
              h("button", { type: "button", class: "btn btn-small", onclick: () => openEditor(template) }, "Edit"),
              h(
                "button",
                {
                  type: "button",
                  class: "btn btn-small btn-ghost",
                  onclick: (event) => setActive(event.currentTarget, template, !template.is_active),
                },
                template.is_active ? "Retire" : "Restore",
              ),
            ),
          ),
        ),
      ),
    );
  }

  async function setActive(button, template, isActive) {
    await withBusy(button, async () => {
      try {
        await api(`notifications/templates/${template.id}`, { method: "PATCH", body: { is_active: isActive } });
        toast(isActive ? `"${template.name}" restored.` : `"${template.name}" retired.`, "success");
        await reload();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  /** Create (no template) or edit a template in a modal. */
  function openEditor(template) {
    const editing = Boolean(template);
    const typeSelect = h(
      "select",
      { class: "select", required: true, disabled: editing },
      ...types.map((t) => h("option", { value: t.key }, t.name)),
    );
    typeSelect.value = template?.type_key ?? (typeFilter.value || types[0]?.key || "");
    const name = h("input", { class: "input", type: "text", maxlength: 100, required: true, placeholder: "e.g. App update — new features" });
    const title = h("input", { class: "input", type: "text", maxlength: 100, required: true });
    const body = h("textarea", { class: "textarea", maxlength: 300, required: true });
    name.value = template?.name ?? "";
    title.value = template?.title ?? "";
    body.value = template?.body ?? "";
    const titleCounter = h("span", { class: "field-counter" });
    const bodyCounter = h("span", { class: "field-counter" });
    const error = h("div", { class: "alert alert-error", role: "alert", hidden: true });
    const save = h("button", { type: "submit", class: "btn btn-primary" }, editing ? "Save changes" : "Create template");

    const dialog = h(
      "dialog",
      { class: "dialog", "aria-labelledby": "template-dialog-title" },
      h(
        "form",
        { method: "dialog", novalidate: true },
        h("h2", { id: "template-dialog-title", class: "dialog-title" }, editing ? "Edit template" : "New template"),
        h(
          "div",
          { class: "dialog-body" },
          h("label", { class: "field" }, h("span", { class: "field-label" }, "Type"), typeSelect,
            editing ? h("span", { class: "field-hint" }, "The type can't change once the template exists.") : null),
          h("label", { class: "field" }, h("span", { class: "field-label" }, "Name"), name,
            h("span", { class: "field-hint" }, "Only admins see this.")),
          h("label", { class: "field" }, h("span", { class: "field-label" }, "Title"), title, titleCounter),
          h("label", { class: "field" }, h("span", { class: "field-label" }, "Text"), body, bodyCounter),
          error,
        ),
        h(
          "div",
          { class: "dialog-actions" },
          h("button", { type: "button", class: "btn btn-ghost", onclick: () => dialog.close() }, "Cancel"),
          save,
        ),
      ),
    );
    attachCounter(title, titleCounter);
    attachCounter(body, bodyCounter);

    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const values = { name: name.value.trim(), title: title.value.trim(), body: body.value.trim() };
      if (!values.name || !values.title || !values.body) {
        error.textContent = "Fill in the name, title and text.";
        error.hidden = false;
        return;
      }
      withBusy(save, async () => {
        try {
          if (editing) {
            await api(`notifications/templates/${template.id}`, { method: "PATCH", body: values });
          } else {
            await api("notifications/templates", { method: "POST", body: { ...values, type_key: typeSelect.value } });
          }
          dialog.close();
          toast(editing ? "Template saved." : "Template created.", "success");
          await reload();
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
        }
      });
    });
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
    name.focus();
  }

  typeFilter.addEventListener("change", reload);
  showRetired.addEventListener("change", reload);
  $("#template-new").addEventListener("click", () => {
    if (!types.length) {
      toast("No notification types available.", "error");
      return;
    }
    openEditor(null);
  });

  return { reload };
}
