(() => {
  const BLOG_SESSION_KEY = "blog.auth.session";
  const BLOG_AUTH_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
  const BLOG_AUTH_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";
  const REFRESH_WINDOW_MS = 60 * 1000;

  let sessionRefreshPromise = null;

  function readStoredSession() {
    try {
      const rawSession = localStorage.getItem(BLOG_SESSION_KEY);
      return rawSession ? JSON.parse(rawSession) : null;
    } catch {
      return null;
    }
  }

  function writeStoredSession(session) {
    if (!session?.access_token) return null;
    localStorage.setItem(BLOG_SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearStoredSession() {
    localStorage.removeItem(BLOG_SESSION_KEY);
  }

  function getSessionId(session) {
    return (
      session?.id ||
      session?.user?.user_metadata?.login_id ||
      session?.user?.user_metadata?.username ||
      ""
    );
  }

  function readBlogSession() {
    const session = readStoredSession();
    if (!session) return null;

    if (session.expires_at && Date.now() >= session.expires_at * 1000 && !session.refresh_token) {
      clearStoredSession();
      return null;
    }

    return session;
  }

  function shouldRefreshSession(session) {
    if (!session?.refresh_token || !session.expires_at) return false;
    return Date.now() >= session.expires_at * 1000 - REFRESH_WINDOW_MS;
  }

  function mergeRefreshedSession(payload, previousSession) {
    const nextExpiresAt =
      payload.expires_at ||
      (payload.expires_in ? Math.floor(Date.now() / 1000) + Number(payload.expires_in) : previousSession.expires_at);

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || previousSession.refresh_token,
      expires_at: nextExpiresAt,
      user: payload.user || previousSession.user,
      id: previousSession.id || getSessionId({ user: payload.user || previousSession.user }),
    };
  }

  async function refreshBlogSession(session) {
    const response = await fetch(`${BLOG_AUTH_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: BLOG_AUTH_ANON_KEY,
        Authorization: `Bearer ${BLOG_AUTH_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: session.refresh_token,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.access_token) {
      if (response.status >= 400 && response.status < 500) {
        clearStoredSession();
        return null;
      }
      return session;
    }

    return writeStoredSession(mergeRefreshedSession(payload, session));
  }

  async function ensureFreshSession() {
    const session = readBlogSession();
    if (!shouldRefreshSession(session)) return session;

    if (!sessionRefreshPromise) {
      sessionRefreshPromise = refreshBlogSession(session).finally(() => {
        sessionRefreshPromise = null;
      });
    }

    return sessionRefreshPromise;
  }

  function getCurrentPage() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function syncBrand(id) {
    const brand = document.querySelector(".brand");
    if (!brand) return;

    const brandText = brand.querySelector("[data-brand-text]");
    const currentPage = getCurrentPage();

    if (currentPage === "my-blog.html" || currentPage === "editor.html" || currentPage === "viewer.html") {
      brand.href = "./my-blog.html";
      brand.setAttribute("aria-label", "My blog home");
      if (brandText && id) {
        brandText.textContent = `${id}'s Blog`;
      }
      return;
    }

    brand.href = "./";
    brand.setAttribute("aria-label", "Blog home");
    if (brandText) {
      brandText.textContent = "홈";
    }
  }

  function renderSignedInHeader(session = readBlogSession()) {
    const actions = document.querySelector("[data-auth-actions]");
    const id = getSessionId(session);

    syncBrand(id);
    if (!actions || !id) return;

    const nav = document.createElement("nav");
    nav.className = "account-nav";
    nav.setAttribute("aria-label", "계정 네비게이션");

    const homeLink = document.createElement("a");
    homeLink.href = "./";
    homeLink.textContent = "홈";

    const blogLink = document.createElement("a");
    blogLink.href = "./my-blog.html";
    blogLink.textContent = "내 블로그";

    const currentPage = getCurrentPage();
    if (currentPage === "index.html") {
      homeLink.setAttribute("aria-current", "page");
    }
    if (currentPage === "my-blog.html" || currentPage === "editor.html" || currentPage === "viewer.html") {
      blogLink.setAttribute("aria-current", "page");
    }

    nav.append(homeLink, blogLink);

    const welcome = document.createElement("span");
    welcome.className = "welcome-message";
    welcome.textContent = `${id} 님 환영합니다.`;

    actions.classList.add("is-signed-in");
    actions.replaceChildren(nav, welcome);
  }

  const ready = ensureFreshSession()
    .then((session) => {
      renderSignedInHeader(session);
      return session;
    })
    .catch(() => {
      renderSignedInHeader(null);
      return null;
    });

  window.blogSession = {
    read: readBlogSession,
    refresh: ensureFreshSession,
    ready,
    getId: getSessionId,
  };
})();
