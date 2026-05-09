(() => {
  const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";
  const ID_EMAIL_DOMAIN = "blog.local";

  const idEl = document.querySelector("[data-account-id]");
  const logoutButton = document.querySelector("[data-account-logout]");
  const passwordForm = document.querySelector("[data-password-form]");
  const awayForm = document.querySelector("[data-away-form]");
  const passwordMessage = document.querySelector("[data-password-message]");
  const awayMessage = document.querySelector("[data-away-message]");

  let currentSession = null;
  let currentId = "";

  function normalizeId(value) {
    return value.trim().toLowerCase();
  }

  function toBase64Url(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  }

  function idToEmail(id) {
    return `id.${toBase64Url(normalizeId(id))}@${ID_EMAIL_DOMAIN}`;
  }

  function getErrorMessage(payload, fallback) {
    const message = payload?.error_description || payload?.msg || payload?.message || payload?.error || fallback;
    if (/invalid login credentials/i.test(message)) return "현재 비밀번호가 맞지 않습니다.";
    return message;
  }

  function setMessage(el, text, type = "info") {
    if (!el) return;
    el.textContent = text;
    el.dataset.type = type;
  }

  async function requestAuth(path, body, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: options.method || "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: options.token ? `Bearer ${options.token}` : `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(getErrorMessage(payload, "요청을 처리하지 못했습니다."));
    return payload;
  }

  async function requestRest(path, token, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || "요청을 처리하지 못했습니다.");
    return payload;
  }

  async function hashAwayPassword(userId, password) {
    const data = new TextEncoder().encode(`${userId}:away:${password}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function setBusy(form, busy) {
    const button = form.querySelector("button[type='submit']");
    button.disabled = busy;
    button.textContent = busy ? "처리 중" : button.dataset.label;
  }

  passwordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSession || !currentId) return;

    const currentPassword = passwordForm.querySelector("#current-password").value;
    const newPassword = passwordForm.querySelector("#new-password").value;
    const confirmPassword = passwordForm.querySelector("#new-password-confirm").value;

    try {
      setBusy(passwordForm, true);
      if (newPassword.length < 6) throw new Error("새 비밀번호는 6자 이상 입력해주세요.");
      if (newPassword !== confirmPassword) throw new Error("새 비밀번호가 서로 다릅니다.");

      const loginPayload = await requestAuth("token?grant_type=password", {
        email: idToEmail(currentId),
        password: currentPassword,
      });

      await requestAuth(
        "user",
        { password: newPassword },
        { method: "PUT", token: loginPayload.access_token || currentSession.access_token }
      );

      passwordForm.reset();
      setMessage(passwordMessage, "비밀번호를 변경했습니다.", "success");
    } catch (error) {
      setMessage(passwordMessage, error.message, "error");
    } finally {
      setBusy(passwordForm, false);
    }
  });

  awayForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentSession || !currentId) return;

    const awayPassword = awayForm.querySelector("#away-password").value;
    const confirmPassword = awayForm.querySelector("#away-password-confirm").value;

    try {
      setBusy(awayForm, true);
      if (awayPassword.length < 4) throw new Error("자리비움 패스워드는 4자 이상 입력해주세요.");
      if (awayPassword !== confirmPassword) throw new Error("자리비움 패스워드가 서로 다릅니다.");

      const awayPasswordHash = await hashAwayPassword(currentSession.user.id, awayPassword);
      await requestRest("account_security?on_conflict=user_id", currentSession.access_token, {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: currentSession.user.id,
          login_id: currentId,
          away_password_hash: awayPasswordHash,
          updated_at: new Date().toISOString(),
        }),
      });

      awayForm.reset();
      setMessage(awayMessage, "자리비움 패스워드를 저장했습니다.", "success");
    } catch (error) {
      setMessage(awayMessage, error.message, "error");
    } finally {
      setBusy(awayForm, false);
    }
  });

  document.querySelectorAll(".account-form").forEach((form) => {
    const button = form.querySelector("button[type='submit']");
    if (button) button.dataset.label = button.textContent;
  });

  window.blogSession?.ready.then((session) => {
    const id = window.blogSession.getId(session);
    if (!id || !session?.access_token) {
      window.location.href = "./login.html";
      return;
    }

    currentSession = session;
    currentId = id;
    if (idEl) idEl.textContent = id;
  });

  logoutButton?.addEventListener("click", () => {
    window.blogSession?.logout();
  });
})();
