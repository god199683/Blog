const BLOG_SESSION_KEY = "blog.auth.session";

function readBlogSession() {
  try {
    const rawSession = localStorage.getItem(BLOG_SESSION_KEY);
    const session = rawSession ? JSON.parse(rawSession) : null;
    if (session?.expires_at && Date.now() >= session.expires_at * 1000) {
      localStorage.removeItem(BLOG_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function getSessionId(session) {
  return (
    session?.id ||
    session?.user?.user_metadata?.login_id ||
    session?.user?.user_metadata?.username ||
    ""
  );
}

function getCurrentPage() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function syncBrand(id) {
  const brand = document.querySelector(".brand");
  if (!brand) return;

  const brandText = brand.querySelector("[data-brand-text]");
  const currentPage = getCurrentPage();

  if (currentPage === "my-blog.html") {
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

function renderSignedInHeader() {
  const actions = document.querySelector("[data-auth-actions]");
  if (!actions) return;

  const session = readBlogSession();
  const id = getSessionId(session);
  syncBrand(id);
  if (!id) return;

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
  if (currentPage === "my-blog.html") {
    blogLink.setAttribute("aria-current", "page");
  }

  nav.append(homeLink, blogLink);

  const welcome = document.createElement("span");
  welcome.className = "welcome-message";
  welcome.textContent = `${id} 님 환영합니다.`;

  actions.classList.add("is-signed-in");
  actions.replaceChildren(nav, welcome);
}

renderSignedInHeader();

window.blogSession = {
  read: readBlogSession,
  getId: getSessionId,
};
