(() => {
  const tabList = document.querySelector("[data-tab-list]");
  const panelHost = document.querySelector("[data-tab-panels]");
  const newTabButton = document.querySelector("[data-new-tab]");
  const splitButton = document.querySelector("[data-split-tab]");
  const tabs = [];
  let activeId = null;
  let split = false;
  let dragId = null;

  function sameOriginUrl(value) {
    try {
      const url = new URL(value || "/ebook-reader.html", window.location.origin);
      return url.origin === window.location.origin ? url.href : new URL("/ebook-reader.html", window.location.origin).href;
    } catch {
      return new URL("/ebook-reader.html", window.location.origin).href;
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
      tab.panel.contentWindow?.postMessage({ type: "desktop-tab-visibility", visible }, window.location.origin);
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
      openTab("/");
      return;
    }
    if (activeId === id) activeId = tabs[Math.max(0, index - 1)].id;
    render();
  }

  function moveTab(draggedId, targetId, placeAfter) {
    const draggedIndex = tabs.findIndex((tab) => tab.id === draggedId);
    const targetIndex = tabs.findIndex((tab) => tab.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return;

    const [dragged] = tabs.splice(draggedIndex, 1);
    const adjustedTargetIndex = tabs.findIndex((tab) => tab.id === targetId);
    const insertionIndex = adjustedTargetIndex + (placeAfter ? 1 : 0);
    tabs.splice(insertionIndex, 0, dragged);
    tabList.insertBefore(dragged.button, tabs[insertionIndex + 1]?.button || null);
  }

  function openTab(url = "/ebook-reader.html") {
    const source = sameOriginUrl(url);
    const id = `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const button = document.createElement("div");
    button.className = "desktop-tab";
    button.draggable = true;
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
      render();
    });

    const tab = { id, button, panel };
    label.addEventListener("click", () => activate(id));
    close.addEventListener("click", () => closeTab(id));
    close.addEventListener("dragstart", (event) => event.preventDefault());
    button.addEventListener("dragstart", (event) => {
      if (event.target === close) {
        event.preventDefault();
        return;
      }
      dragId = id;
      button.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    });
    button.addEventListener("dragend", () => {
      dragId = null;
      button.classList.remove("is-dragging");
      tabList.querySelectorAll(".is-drop-target").forEach((tabButton) => tabButton.classList.remove("is-drop-target"));
    });
    button.addEventListener("dragover", (event) => {
      if (!dragId || dragId === id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      button.classList.add("is-drop-target");
    });
    button.addEventListener("dragleave", () => button.classList.remove("is-drop-target"));
    button.addEventListener("drop", (event) => {
      if (!dragId || dragId === id) return;
      event.preventDefault();
      const bounds = button.getBoundingClientRect();
      moveTab(dragId, id, event.clientX > bounds.left + bounds.width / 2);
      button.classList.remove("is-drop-target");
    });
    tabList.append(button);
    panelHost.append(panel);
    tabs.push(tab);
    activate(id);
    return tab;
  }

  function toggleSplit() {
    if (!split && tabs.length < 2) openTab("/ebook-reader.html");
    split = !split;
    render();
  }

  newTabButton.addEventListener("click", () => openTab());
  splitButton.addEventListener("click", toggleSplit);
  window.desktopTabs = { openTab, toggleSplit };
  openTab("/");
})();
