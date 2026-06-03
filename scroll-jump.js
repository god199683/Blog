(() => {
  function getScrollBottom() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
  }

  function ensureScrollJump() {
    let root = document.querySelector("[data-global-scroll-jump]") || document.querySelector(".blog-scroll-jump");
    if (!root) {
      root = document.createElement("div");
      root.className = "blog-scroll-jump";
      root.setAttribute("data-global-scroll-jump", "");
      root.setAttribute("aria-label", "빠른 이동");
      root.innerHTML = `
        <button type="button" data-scroll-top title="최상단으로" aria-label="최상단으로">
          <span class="scroll-jump-icon scroll-jump-up" aria-hidden="true"></span>
        </button>
        <button type="button" data-scroll-bottom title="최하단으로" aria-label="최하단으로">
          <span class="scroll-jump-icon scroll-jump-down" aria-hidden="true"></span>
        </button>
      `;
      document.body.appendChild(root);
    }
    return root;
  }

  function syncVisibility(root) {
    const canScroll = getScrollBottom() > window.innerHeight + 120;
    root.hidden = !canScroll;
  }

  function initScrollJump() {
    const root = ensureScrollJump();
    root.addEventListener("click", (event) => {
      const top = event.target.closest("[data-scroll-top]");
      const bottom = event.target.closest("[data-scroll-bottom]");
      if (top) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (bottom) {
        window.scrollTo({ top: getScrollBottom(), behavior: "smooth" });
      }
    });

    syncVisibility(root);
    window.addEventListener("resize", () => syncVisibility(root));
    window.addEventListener("load", () => syncVisibility(root));
    setTimeout(() => syncVisibility(root), 500);
    setTimeout(() => syncVisibility(root), 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScrollJump, { once: true });
  } else {
    initScrollJump();
  }
})();
