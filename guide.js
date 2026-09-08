(() => {
  const page = location.pathname.split("/").pop() || "index.html";
  const AUTO_MOVE_KEY = "blog.catGuideAutoMove";
  const AUTO_MOVE_DELAY = 11000;
  const catMarkup = `
    <span class="site-guide-cat" aria-hidden="true">
      <span class="site-guide-cat-ear site-guide-cat-ear-left"></span>
      <span class="site-guide-cat-ear site-guide-cat-ear-right"></span>
      <span class="site-guide-cat-face"><i></i><i></i><b></b></span>
      <span class="site-guide-cat-tail"></span>
    </span>
  `;

  const guides = {
    "editor.html": {
      title: "글쓰기 고양이",
      intro: "천천히 써도 괜찮아요. 필요한 기능을 제가 찾아드릴게요.",
      actions: [
        ["본문에 집중하기", "focus"],
        ["본문에서 찾기", "find"],
        ["임시 저장하기", "draft"],
      ],
    },
    "ebook-reader.html": {
      title: "책 뷰어 고양이",
      intro: "읽고 싶은 폴더를 고르면, 이어 읽기도 제가 도와드릴게요.",
      actions: [
        ["읽을 폴더 고르기", "folder"],
        ["선택 폴더에서 검색", "search"],
        ["북마크 관리", "bookmark"],
      ],
    },
    "my-blog.html": {
      title: "블로그 고양이",
      intro: "글과 폴더를 차분히 정리할 수 있도록 곁에 있을게요.",
      actions: [
        ["새 글 작성하기", "write"],
        ["글 검색하기", "search"],
        ["책 뷰어 열기", "reader"],
      ],
    },
    "materials.html": {
      title: "자료실 고양이",
      intro: "필요한 자료를 찾기 쉽도록 도와드릴게요.",
      actions: [["자료 검색하기", "search"], ["내 블로그 열기", "blog"]],
    },
    default: {
      title: "블로그 고양이",
      intro: "필요한 기능이 있으면 편하게 저를 눌러주세요.",
      actions: [["내 블로그 열기", "blog"], ["새 글 작성하기", "write"], ["책 뷰어 열기", "reader"]],
    },
  };

  const guide = guides[page] || guides.default;

  function runAction(action) {
    const targets = {
      focus: "[data-editor-writing-focus]",
      find: "[data-editor-find-toggle]",
      draft: "[data-editor-draft]",
      folder: "[data-ebook-folder-open]",
      search: page === "ebook-reader.html" ? "[data-ebook-search]" : "[data-blog-search-input], [data-material-search-input]",
      bookmark: "[data-ebook-bookmark-manage]",
    };
    const target = targets[action] ? document.querySelector(targets[action]) : null;
    if (target) {
      target.focus({ preventScroll: false });
      if (target.matches("input")) return;
      target.click();
      return;
    }

    const destinations = {
      write: "./editor.html?mode=new",
      reader: "./ebook-reader.html",
      blog: "./my-blog.html",
    };
    if (destinations[action]) location.href = destinations[action];
  }

  function mountGuide() {
    const root = document.createElement("section");
    root.className = "site-guide";
    root.setAttribute("aria-label", "고양이 웹 사용 도우미");
    root.innerHTML = `
      <button class="site-guide-launcher" type="button" aria-expanded="false" aria-controls="site-guide-panel" title="도움말 열기 또는 드래그해 이동">
        ${catMarkup}
        <span class="site-guide-launcher-label">도움</span>
      </button>
      <div class="site-guide-panel" id="site-guide-panel" hidden>
        <header>
          <div>${catMarkup}<strong>${guide.title}</strong></div>
          <button type="button" data-guide-close aria-label="도움말 닫기">×</button>
        </header>
        <p>${guide.intro}</p>
        <div class="site-guide-actions">
          ${guide.actions.map(([label, action]) => `<button type="button" data-guide-action="${action}">${label}</button>`).join("")}
        </div>
        <label class="site-guide-auto-toggle"><input type="checkbox" data-guide-auto-move> <span>자동 이동</span></label>
        <small>캐릭터를 끌어서 편한 곳에 놓을 수 있어요.</small>
      </div>
    `;
    document.body.append(root);

    const launcher = root.querySelector(".site-guide-launcher");
    const panel = root.querySelector(".site-guide-panel");
    const autoMove = root.querySelector("[data-guide-auto-move]");
    let autoMoveTimer = 0;
    let lastInteractionAt = Date.now();
    try {
      autoMove.checked = localStorage.getItem(AUTO_MOVE_KEY) === "true";
    } catch {
      autoMove.checked = false;
    }
    const setOpen = (open) => {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
    };

    const noteInteraction = () => {
      lastInteractionAt = Date.now();
    };

    const moveTowardEdge = () => {
      if (!autoMove.checked || !panel.hidden || Date.now() - lastInteractionAt < AUTO_MOVE_DELAY) return;
      const rect = root.getBoundingClientRect();
      const edge = 10;
      const x = rect.left < window.innerWidth / 2 ? Math.max(edge, rect.left - 18) : Math.min(window.innerWidth - rect.width - edge, rect.left + 18);
      const y = rect.top < window.innerHeight / 2 ? Math.max(edge, rect.top - 14) : Math.min(window.innerHeight - rect.height - edge, rect.top + 14);
      root.style.left = `${x}px`;
      root.style.top = `${y}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.classList.add("is-guide-auto-moving");
      window.setTimeout(() => root.classList.remove("is-guide-auto-moving"), 560);
      lastInteractionAt = Date.now();
    };

    autoMove.addEventListener("change", () => {
      try {
        localStorage.setItem(AUTO_MOVE_KEY, String(autoMove.checked));
      } catch {
        // The guide still works when local storage is unavailable.
      }
      noteInteraction();
    });
    autoMoveTimer = window.setInterval(moveTowardEdge, 1000);

    let dragStart = null;
    let moved = false;
    launcher.addEventListener("pointerdown", (event) => {
      noteInteraction();
      dragStart = { x: event.clientX, y: event.clientY, left: root.offsetLeft, top: root.offsetTop };
      moved = false;
      launcher.setPointerCapture?.(event.pointerId);
    });
    launcher.addEventListener("pointermove", (event) => {
      if (!dragStart) return;
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) < 6) return;
      moved = true;
      root.classList.add("is-guide-dragging");
      root.style.left = `${Math.max(8, Math.min(window.innerWidth - root.offsetWidth - 8, dragStart.left + dx))}px`;
      root.style.top = `${Math.max(8, Math.min(window.innerHeight - root.offsetHeight - 8, dragStart.top + dy))}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
    });
    launcher.addEventListener("pointerup", (event) => {
      if (!dragStart) return;
      launcher.releasePointerCapture?.(event.pointerId);
      dragStart = null;
      root.classList.remove("is-guide-dragging");
    });
    launcher.addEventListener("click", () => {
      noteInteraction();
      if (moved) {
        moved = false;
        return;
      }
      setOpen(panel.hidden);
    });
    root.querySelector("[data-guide-close]").addEventListener("click", () => setOpen(false));
    root.querySelectorAll("[data-guide-action]").forEach((button) => {
      button.addEventListener("click", () => {
        noteInteraction();
        setOpen(false);
        runAction(button.dataset.guideAction);
      });
    });
    window.addEventListener("beforeunload", () => window.clearInterval(autoMoveTimer), { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountGuide, { once: true });
  else mountGuide();
})();
