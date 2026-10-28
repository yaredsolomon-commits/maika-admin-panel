/**
 * Small DOM helpers. Text always goes in as text (never innerHTML), so
 * nothing from the backend can inject markup.
 */

/**
 * h("button", { class: "btn", onclick: fn }, "Save")
 * @param {string} tag
 * @param {Record<string, unknown> | null} [attrs]
 * @param {...(Node | string | number | null | undefined | false)} children
 */
export function h(tag, attrs, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2), value);
    } else if (key === "dataset") {
      Object.assign(element.dataset, value);
    } else if (value === true) {
      element.setAttribute(key, "");
    } else {
      element.setAttribute(key, String(value));
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }
  return element;
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

export const PLATFORM_LABELS = { android: "Android", ios: "iOS" };

/** A short message in the corner. kind: "success" | "error" | "info". */
export function toast(message, kind = "info") {
  let region = $("#toasts");
  if (!region) {
    region = h("div", { id: "toasts", class: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(region);
  }
  const item = h("div", { class: `toast toast-${kind}` }, message);
  region.append(item);
  setTimeout(() => item.classList.add("toast-leaving"), 4200);
  setTimeout(() => item.remove(), 4600);
}

/**
 * Asks for confirmation in a modal. Resolves true when confirmed.
 * @param {{ title: string, body: (Node | string)[], confirmLabel: string }} options
 */
export function confirmDialog({ title, body, confirmLabel }) {
  return new Promise((resolve) => {
    const dialog = h(
      "dialog",
      { class: "dialog", "aria-labelledby": "confirm-title" },
      h("h2", { id: "confirm-title", class: "dialog-title" }, title),
      h("div", { class: "dialog-body" }, ...body),
      h(
        "div",
        { class: "dialog-actions" },
        h("button", { type: "button", class: "btn btn-ghost", value: "cancel", onclick: () => dialog.close("cancel") }, "Cancel"),
        h("button", { type: "button", class: "btn btn-primary", onclick: () => dialog.close("confirm") }, confirmLabel),
      ),
    );
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "confirm");
      dialog.remove();
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** Shows "n / max" under a text field as it's typed. */
export function attachCounter(field, counter) {
  const max = Number(field.getAttribute("maxlength"));
  const update = () => {
    counter.textContent = `${field.value.length} / ${max}`;
  };
  field.addEventListener("input", update);
  update();
  return update;
}

/** Disables a button and shows a spinner while `work` runs. */
export async function withBusy(button, work) {
  button.disabled = true;
  button.classList.add("is-busy");
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.classList.remove("is-busy");
  }
}
