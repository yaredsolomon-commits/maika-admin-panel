/**
 * Sign-in page. A correct email and password isn't enough: the account
 * must be an admin on the backend, or it's signed straight back out.
 */
import { checkAdmin, getSession, signIn, signOut } from "./auth.js";
import { $, withBusy } from "./ui.js";

const REASONS = {
  not_admin: "That account doesn't have admin access.",
  signed_out: "Your session ended. Sign in again.",
  unavailable: "Couldn't reach the backend to check your access. Try again in a moment.",
};

const form = $("#login-form");
const errorBox = $("#login-error");
const submit = $("#login-submit");

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

$("#password-toggle").addEventListener("click", (event) => {
  const field = $("#password");
  const showing = field.type === "text";
  field.type = showing ? "password" : "text";
  event.currentTarget.textContent = showing ? "Show" : "Hide";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  if (!email || !password) {
    showError("Enter your email and password.");
    return;
  }
  showError("");

  withBusy(submit, async () => {
    try {
      const error = await signIn(email, password);
      if (error) {
        showError(error);
        return;
      }
      const status = await checkAdmin();
      if (status === "admin") {
        window.location.replace("/dashboard/");
        return;
      }
      await signOut();
      showError(REASONS[status] ?? REASONS.unavailable);
    } catch (error) {
      showError(error instanceof Error ? error.message : REASONS.unavailable);
    }
  });
});

async function main() {
  const reason = new URLSearchParams(window.location.search).get("reason");
  if (reason && REASONS[reason]) showError(REASONS[reason]);

  // Already signed in as an admin: skip the form.
  if ((await getSession()) && (await checkAdmin()) === "admin") {
    window.location.replace("/dashboard/");
    return;
  }
  $("#email").focus();
}

main().catch((error) => showError(error instanceof Error ? error.message : String(error)));
