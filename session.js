(() => {
  const SESSION_KEY = "blog.auth.session";
  const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";
  const REFRESH_WINDOW_MS = 60 * 1000;
  const AWAY_LOCK_KEY = "blog.away.locked";

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function writeSession(session) {
    if (!session?.access_token) return null;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function logout() {
    clearSession();
    window.location.href = "./";
  }

  function getId(session) {
    return (
      session?.id ||
      session?.user?.user_metadata?.login_id ||
      session?.user?.user_metadata?.username ||
      ""
    );
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

  async function refreshSession(session) {
    if (!session?.refresh_token) return session;

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      if (response.status >= 400 && response.status < 500) clearSession();
      return null;
    }

    return writeSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || session.refresh_token,
      expires_at:
        payload.expires_at ||
        (payload.expires_in ? Math.floor(Date.now() / 1000) + Number(payload.expires_in) : session.expires_at),
      user: payload.user || session.user,
      id: session.id || getId({ user: payload.user || session.user }),
    });
  }

  async function getFreshSession() {
    const session = readSession();
    if (!session) return null;

    if (session.expires_at && Date.now() >= session.expires_at * 1000 && !session.refresh_token) {
      clearSession();
      return null;
    }

    if (session.expires_at && Date.now() >= session.expires_at * 1000 - REFRESH_WINDOW_MS) {
      return refreshSession(session);
    }

    return session;
  }

  async function getAwayPasswordHash(session) {
    if (!session?.access_token || !session.user?.id) return "";
    const rows = await requestRest(
      `account_security?select=away_password_hash&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
      session.access_token
    );
    return Array.isArray(rows) ? rows[0]?.away_password_hash || "" : "";
  }

  function closeAwayOverlay() {
    document.querySelector("[data-away-lock]")?.remove();
    document.body.classList.remove("is-away-locked");
    sessionStorage.removeItem(AWAY_LOCK_KEY);
  }

  function showAwayOverlay(session, storedHash) {
    document.querySelector("[data-away-lock]")?.remove();

    const overlay = document.createElement("div");
    overlay.className = "away-lock";
    overlay.dataset.awayLock = "true";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <form class="away-lock-card" data-away-unlock-form>
        <p class="eyebrow">자리비움</p>
        <h2>화면 잠금</h2>
        <p>계정 관리에서 정한 자리비움 패스워드를 입력해주세요.</p>
        <input type="password" autocomplete="off" aria-label="자리비움 패스워드" data-away-password required>
        <button class="auth-submit" type="submit">돌아가기</button>
        <p class="auth-message" data-away-error role="status" aria-live="polite"></p>
      </form>
    `;

    const form = overlay.querySelector("[data-away-unlock-form]");
    const input = overlay.querySelector("[data-away-password]");
    const error = overlay.querySelector("[data-away-error]");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const enteredHash = await hashAwayPassword(session.user.id, input.value);
      if (enteredHash === storedHash) {
        closeAwayOverlay();
        return;
      }
      input.value = "";
      error.textContent = "자리비움 패스워드가 맞지 않습니다.";
      error.dataset.type = "error";
      input.focus();
    });

    document.body.append(overlay);
    document.body.classList.add("is-away-locked");
    window.setTimeout(() => input.focus(), 0);
  }

  async function lockAway(session, persist = true) {
    try {
      const storedHash = await getAwayPasswordHash(session);
      if (!storedHash) {
        window.alert("계정 관리 페이지에서 자리비움 패스워드를 먼저 만들어주세요.");
        return;
      }
      if (persist) sessionStorage.setItem(AWAY_LOCK_KEY, "1");
      showAwayOverlay(session, storedHash);
    } catch {
      window.alert("자리비움 잠금을 불러오지 못했습니다.");
    }
  }

  function renderHeader(session) {
    const actions = document.querySelector("[data-auth-actions]");
    if (!actions) return;

    const id = getId(session);
    if (!id) return;

    const account = document.createElement("div");
    account.className = "account-menu";

    const accountButton = document.createElement("button");
    accountButton.className = "account-menu-button";
    accountButton.type = "button";
    accountButton.setAttribute("aria-haspopup", "true");
    accountButton.setAttribute("aria-expanded", "false");
    accountButton.textContent = id;

    const dropdown = document.createElement("div");
    dropdown.className = "account-dropdown";
    dropdown.hidden = true;

    const blogLink = document.createElement("a");
    blogLink.href = "./my-blog.html";
    blogLink.textContent = "내 블로그";

    const accountLink = document.createElement("a");
    accountLink.href = "./account.html";
    accountLink.textContent = "계정 관리";

    const awayButton = document.createElement("button");
    awayButton.type = "button";
    awayButton.textContent = "자리비움";
    awayButton.addEventListener("click", () => {
      closeDropdown();
      lockAway(session);
    });

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.textContent = "로그아웃";
    logoutButton.addEventListener("click", logout);

    dropdown.append(blogLink, accountLink, awayButton, logoutButton);
    account.append(accountButton, dropdown);

    function closeDropdown() {
      dropdown.hidden = true;
      accountButton.setAttribute("aria-expanded", "false");
    }

    accountButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = dropdown.hidden;
      dropdown.hidden = !willOpen;
      accountButton.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", (event) => {
      if (!account.contains(event.target)) closeDropdown();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDropdown();
    });

    actions.replaceChildren(account);
  }

  const ready = getFreshSession().then((session) => {
    renderHeader(session);
    if (session && sessionStorage.getItem(AWAY_LOCK_KEY) === "1") {
      lockAway(session, false);
    }
    return session;
  });

  window.blogSession = {
    ready,
    read: readSession,
    clear: clearSession,
    logout,
    lockAway,
    getId,
  };
})();
