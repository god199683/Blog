(() => {
  const idEl = document.querySelector("[data-account-id]");
  const logoutButton = document.querySelector("[data-account-logout]");

  function getSessionId(session) {
    return (
      session?.id ||
      session?.user?.user_metadata?.login_id ||
      session?.user?.user_metadata?.username ||
      ""
    );
  }

  window.blogSession?.ready.then((session) => {
    const id = getSessionId(session);
    if (!id) {
      window.location.href = "./login.html";
      return;
    }
    if (idEl) idEl.textContent = id;
  });

  logoutButton?.addEventListener("click", () => {
    window.blogSession?.logout?.();
  });
})();
