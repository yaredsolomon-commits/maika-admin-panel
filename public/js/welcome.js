/**
 * Welcome page: if this browser is already signed in as an admin, the
 * buttons go straight to the dashboard.
 */
import { checkAdmin, getSession } from "./auth.js";
import { $ } from "./ui.js";

async function main() {
  const session = await getSession();
  if (!session || (await checkAdmin()) !== "admin") return;

  for (const link of [$("#primary-action"), $("#header-action")]) {
    link.href = "/dashboard/";
  }
  $("#primary-action").textContent = "Open the dashboard";
  $("#header-action").textContent = "Dashboard";
  const signedIn = $("#signed-in-as");
  signedIn.textContent = `Signed in as ${session.user.email}`;
  signedIn.hidden = false;
}

main().catch(() => {
  // The page works signed out; nothing to show if the check fails.
});
