/**
 * Dashboard: admins only. Shows the page once the backend confirms the
 * account is an admin, then wires up the notification tabs.
 */
import { api } from "./api.js";
import { requireAdmin, signOut } from "./auth.js";
import { initHistory } from "./notifications/history.js";
import { initSend } from "./notifications/send.js";
import { initTemplates } from "./notifications/templates.js";
import { $, toast, withBusy } from "./ui.js";

function initTabs(onShow) {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute("aria-selected", String(selected));
      other.tabIndex = selected ? 0 : -1;
      $(`#${other.getAttribute("aria-controls")}`).hidden = !selected;
    }
    onShow(tab.id);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });
}

async function main() {
  const session = await requireAdmin();
  const email = session.user.email ?? "";
  $("#user-email").textContent = email;
  $("#avatar").textContent = email.charAt(0) || "A";
  $("#sign-out").addEventListener("click", (event) =>
    withBusy(event.currentTarget, async () => {
      await signOut();
      window.location.replace("/login/");
    }),
  );

  $("#gate").hidden = true;
  $("#shell").hidden = false;

  const types = await api("notifications/types").catch((error) => {
    toast(error.message, "error");
    return [];
  });

  const templates = initTemplates({ types });
  const history = initHistory({ types });
  const send = initSend({ onSent: () => history.reload() });

  initTabs((id) => {
    if (id === "tab-templates") templates.reload();
    if (id === "tab-history") history.reload();
    if (id === "tab-send") send.reloadTemplates();
  });
}

main().catch((error) => {
  $("#gate").textContent = error instanceof Error ? error.message : String(error);
});
