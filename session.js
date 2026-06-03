(() => {
  const SESSION_KEY = "blog.auth.session";
  const APK_DOWNLOAD_PATH = "./Blog.apk?v=1.0.4";

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
      // Storage can be blocked in some WebViews.
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

  function isAndroidAppWebView() {
    const ua = navigator.userAgent || "";
    return /BlogAndroidApp/i.test(ua) || /; wv\)/i.test(ua) || /\bwv\b/i.test(ua);
  }

  function markAppEnvironment() {
    try {
      document.documentElement.classList.toggle("is-android-app-view", isAndroidAppWebView());
    } catch {
      // Ignore environment marker failures.
    }
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
      header.insertBefore(nav, actions);
    }

    let homeLink = [...nav.querySelectorAll("a")].find((item) => {
      const href = item.getAttribute("href") || "";
      return href === "./" || href.endsWith("index.html");
    });
    if (!homeLink) {
      homeLink = document.createElement("a");
      homeLink.href = "./";
      homeLink.textContent = "홈";
      nav.prepend(homeLink);
    }

    return nav;
  }

  function syncMyBlogNavLink(session) {
    const nav = ensureTopNav();
    if (!nav) return;

    const allMyBlogLinks = [...nav.querySelectorAll("a")].filter((item) => {
      const href = item.getAttribute("href") || "";
      return item.dataset.myBlogLink === "true" || href.includes("my-blog.html") || item.textContent.trim() === "내 블로그";
    });

    let link = allMyBlogLinks[0];
    allMyBlogLinks.slice(1).forEach((item) => item.remove());

    if (!link) {
      link = document.createElement("a");
      link.textContent = "내 블로그";
      nav.append(link);
    }

    link.dataset.myBlogLink = "true";
    link.href = "./my-blog.html";
    if (window.location.pathname.endsWith("/my-blog.html")) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }

    if (!getId(session)) {
      link.onclick = (event) => {
        event.preventDefault();
        window.alert("로그인 하세요.");
      };
    } else {
      link.onclick = null;
    }
  }

  function ensureAppDownloadButton() {
    const header = document.querySelector(".site-header");
    const actions = document.querySelector("[data-auth-actions]");
    if (!header || !actions) return;

    const existingButton = header.querySelector("[data-apk-download]");
    if (isAndroidAppWebView()) {
      existingButton?.remove();
      return;
    }
    if (existingButton) return;

    const link = document.createElement("a");
    link.className = "auth-button app-download-button";
    link.href = APK_DOWNLOAD_PATH;
    link.download = "Blog.apk";
    link.dataset.apkDownload = "true";
    link.textContent = "APK";
    link.title = "앱 파일 다운로드";
    link.setAttribute("aria-label", "APK 앱 파일 다운로드");
    header.insertBefore(link, actions);
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
  }

  async function getFreshSession() {
    return readSession();
  }

  function init() {
    markAppEnvironment();
    const ready = Promise.resolve(getFreshSession()).then((session) => {
      try {
        syncMyBlogNavLink(session);
        ensureAppDownloadButton();
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
