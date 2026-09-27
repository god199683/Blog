(() => {
  const tabList = document.querySelector("[data-tab-list]");
  const panelHost = document.querySelector("[data-tab-panels]");
  const newTabButton = document.querySelector("[data-new-tab]");
  const splitButton = document.querySelector("[data-split-tab]");
  const tabs = [];
  let activeId = null;
  let split = false;

  function sameOriginUrl(value) {
    try {
      const url = new URL(value || "./ebook-reader.html", window.location.href);
      return url.origin === window.location.origin ? url.href : new URL("./ebook-reader.html", window.location.href).href;
    } catch {
      return new URL("./ebook-reader.html", window.location.href).href;
    }
  }

  function titleFor(url) {
    const path = new URL(url).pathname;
    if (path.endsWith("ebook-reader.html") || path.endsWith("viewer.html")) return "책 뷰어";
    if (path.endsWith("editor.html")) return "글쓰기";
    if (path.endsWith("my-blog.html")) return "내 블로그";
    return "블로그 홈";
  }

  function getTab(id) { return tabs.find((tab) => tab.id === id); }

  function pairedTab() {
    return tabs.find((tab) => tab.id !== activeId) || null;
  }

  function render() {
    const pair = split ? pairedTab() : null;
    if (split && !pair) split = false;
    panelHost.classList.toggle("is-split", split);
    splitButton.classList.toggle("is-active", split);
    splitButton.setAttribute("aria-pressed", String(split));

    tabs.forEach((tab) => {
      const visible = tab.id === activeId || tab.id === pair?.id;
      tab.panel.classList.toggle("is-visible", visible);
      tab.button.classList.toggle("is-active", tab.id === activeId);
      tab.button.classList.toggle("is-paired", tab.id === pair?.id);
    });
  }

  function activate(id) {
    if (!getTab(id)) return;
    activeId = id;
    render();
  }

  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const [tab] = tabs.splice(index, 1);
    tab.button.remove();
    tab.panel.remove();
    if (!tabs.length) {
      openTab("./");
      return;
    }
    if (activeId === id) activeId = tabs[Math.max(0, index - 1)].id;
    render();
  }

  function openTab(url = "./ebook-reader.html") {
    const source = sameOriginUrl(url);
    const id = `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const button = document.createElement("div");
    button.className = "desktop-tab";
    const label = document.createElement("button");
    label.className = "desktop-tab-label";
    label.type = "button";
    label.textContent = titleFor(source);
    const close = document.createElement("button");
    close.className = "desktop-tab-close";
    close.type = "button";
    close.textContent = "×";
    close.title = "탭 닫기";
    close.setAttribute("aria-label", "탭 닫기");
    button.append(label, close);

    const panel = document.createElement("iframe");
    panel.className = "desktop-panel";
    panel.src = source;
    panel.title = label.textContent;
    panel.addEventListener("load", () => {
      try {
        const pageTitle = panel.contentDocument?.title?.replace(/\s*\|.*$/u, "").trim();
        if (pageTitle) label.textContent = pageTitle;
      } catch {}
    });

    const tab = { id, button, panel };
    label.addEventListener("click", () => activate(id));
    close.addEventListener("click", () => closeTab(id));
    tabList.append(button);
    panelHost.append(panel);
    tabs.push(tab);
    activate(id);
    return tab;
  }

  function toggleSplit() {
    if (!split && tabs.length < 2) openTab("./ebook-reader.html");
    split = !split;
    render();
  }

  newTabButton.addEventListener("click", () => openTab());
  splitButton.addEventListener("click", toggleSplit);
  window.desktopTabs = { openTab, toggleSplit };
  openTab("./");
})();
