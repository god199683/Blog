(() => {
  const idEl = document.querySelector("[data-account-id]");
  const logoutButton = document.querySelector("[data-account-logout]");

  window.blogSession?.ready.then((session) => {
    const id = window.blogSession.getId(session);
    if (!id) {
      window.location.href = "./login.html";
      return;
    }

    if (idEl) idEl.textContent = id;
  });

  logoutButton?.addEventListener("click", () => {
    window.blogSession?.logout();
  });
})();
