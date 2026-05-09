(() => {
  const SESSION_KEY = "blog.auth.session";
  const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";
  const REFRESH_WINDOW_MS = 60 * 1000;

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

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.textContent = "로그아웃";
    logoutButton.addEventListener("click", logout);

    dropdown.append(blogLink, accountLink, logoutButton);
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
    return session;
  });

  window.blogSession = {
    ready,
    read: readSession,
    clear: clearSession,
    logout,
    getId,
  };
})();
