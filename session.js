(() => {
  const SESSION_KEY = "blog.auth.session";
  const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpydHZ2bXJ2ZnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3Nzk5MzY4MywiZXhwIjoyMDkzNTY5NjgzfQ.fake";

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore storage errors
    }
  }

  function getId(session) {
    return (
      session?.id ||
      session?.user?.user_metadata?.login_id ||
      session?.user?.user_metadata?.username ||
      ""
    );
  }

  function logout() {
    clearSession();
    window.location.href = "./";
  }

  function ensureTopNav() {
    const header = document.querySelector(".site-header");
    const actions = document.querySelector("[data-auth-actions]");
    if (!header || !actions) return null;

    let nav = header.querySelector(".top-nav");
    if (!nav) {
      nav = document.createElement("nav");
      nav.className = "top-nav";
      nav.setAttribute("aria-label", "상단 메뉴");
      const homeLink = document.createElement("a");
      homeLink.href = "./";
      homeLink.textContent = "홈";
      nav.append(homeLink);
      header.insertBefore(nav, actions);
    }
    return nav;
  }

  function syncMyBlogNavLink(session) {
    const nav = ensureTopNav();
    if (!nav) return;

    let link = nav.querySelector("[data-my-blog-link]");
    if (!link) {
      link = document.createElement("a");
      link.dataset.myBlogLink = "true";
      link.textContent = "내 블로그";
      nav.append(link);
    }
    link.href = "./my-blog.html";
    if (!getId(session)) {
      link.onclick = (event) => {
        event.preventDefault();
        window.alert("로그인 하세요.");
      };
    } else {
      link.onclick = null;
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
    accountButton.textContent = id;

    const dropdown = document.createElement("div");
    dropdown.className = "account-dropdown";
    dropdown.hidden = true;

    const accountLink = document.createElement("a");
    accountLink.href = "./account.html";
    accountLink.textContent = "계정 관리";

    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.textContent = "로그아웃";
    logoutButton.addEventListener("click", logout);

    dropdown.append(accountLink, logoutButton);
    account.append(accountButton, dropdown);
    actions.replaceChildren(account);

    accountButton.addEventListener("click", (event) => {
      event.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });

    document.addEventListener("click", (event) => {
      if (!account.contains(event.target)) dropdown.hidden = true;
    });
  }

  async function getFreshSession() {
    return readSession();
  }

  function init() {
    try {
      const ready = Promise.resolve(getFreshSession()).then((session) => {
        try {
          syncMyBlogNavLink(session);
          renderHeader(session);
        } catch (error) {
          console.warn("session header skipped", error);
        }
        return session;
      });

      window.blogSession = {
        ready,
        read: readSession,
        refresh: getFreshSession,
        clear: clearSession,
        logout,
        lockAway: () => window.alert("자리비움 기능은 임시로 비활성화되었습니다."),
        getId,
      };
    } catch (error) {
      console.warn("session init skipped", error);
      window.blogSession = {
        ready: Promise.resolve(null),
        read: readSession,
        refresh: getFreshSession,
        clear: clearSession,
        logout,
        lockAway: () => {},
        getId,
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
