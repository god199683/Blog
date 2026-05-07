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

function renderSignedInHeader() {
  const actions = document.querySelector("[data-auth-actions]");
  if (!actions) return;

  const session = readBlogSession();
  const id = getSessionId(session);
  if (!id) return;

  const welcome = document.createElement("span");
  welcome.className = "welcome-message";
  welcome.textContent = `${id} 님 환영합니다.`;

  actions.classList.add("is-signed-in");
  actions.replaceChildren(welcome);
}

renderSignedInHeader();
