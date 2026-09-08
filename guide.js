(() => {
  const page = location.pathname.split("/").pop() || "index.html";
  const AUTO_MOVE_KEY = "blog.catGuideAutoMove";
  const AUTO_MOVE_DELAY = 9000;
  const CURSOR_NOTICE_DELAY = 650;
  const CURSOR_NOTICE_DISTANCE = 132;
  const catMarkup = '<img class="site-guide-cat" data-guide-cat src="./assets/cat-guide.png" alt="" aria-hidden="true">';

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

  function getChatReply(message = "") {
    const text = String(message).trim().toLocaleLowerCase();
    if (/(글쓰기|작성|새 글|게시|수정)/.test(text)) {
      return { text: "글을 쓰거나 수정하려면 글쓰기 화면으로 이동하면 돼요. 저장 전에는 임시 저장도 챙겨드릴게요.", action: "write", label: "글쓰기 열기" };
    }
    if (/(검색|찾기|단어)/.test(text)) {
      if (page === "ebook-reader.html") return { text: "선택한 폴더 안의 제목과 본문을 모두 찾을 수 있어요.", action: "search", label: "폴더에서 검색" };
      if (page === "editor.html") return { text: "본문 검색은 Ctrl+F, 바꾸기는 Ctrl+H로 열 수 있어요.", action: "find", label: "본문에서 찾기" };
      return { text: "원하는 글을 빠르게 찾을 수 있도록 검색창을 열어드릴게요.", action: "search", label: "글 검색하기" };
    }
    if (/(북마크|이어보기)/.test(text)) {
      return { text: "책 뷰어에서는 현재 페이지를 북마크로 저장하고, 나중에 같은 위치에서 이어볼 수 있어요.", action: "bookmark", label: "북마크 관리" };
    }
    if (/(폴더|카테고리|분류)/.test(text)) {
      return { text: "글은 카테고리와 폴더로 정리할 수 있어요. 책 뷰어에서는 선택한 폴더의 글을 순서대로 읽습니다.", action: page === "ebook-reader.html" ? "folder" : "blog", label: page === "ebook-reader.html" ? "폴더 선택" : "내 블로그 열기" };
    }
    if (/(책|이북|뷰어|읽기)/.test(text)) {
      return { text: "책 뷰어에서 폴더를 고르면 글을 페이지처럼 넘기며 읽을 수 있어요.", action: "reader", label: "책 뷰어 열기" };
    }
    if (/(붙여넣기|서식|글씨|색|글꼴)/.test(text)) {
      return { text: "에디터에서는 붙여넣은 글의 줄바꿈과 기본 서식을 다룰 수 있고, 글꼴과 글자색도 바꿀 수 있어요.", action: "write", label: "에디터 열기" };
    }
    if (/(임시|저장|복구)/.test(text)) {
      const inEditor = page === "editor.html";
      return {
        text: "글쓰기 화면에서는 Alt+S로 임시 저장할 수 있고, 입력을 멈추면 자동 임시 저장도 진행돼요.",
        action: inEditor ? "draft" : "write",
        label: inEditor ? "임시 저장하기" : "글쓰기 열기",
      };
    }
    return { text: "제가 도울 수 있는 건 글쓰기, 검색, 폴더 정리, 책 뷰어, 북마크예요. 하고 싶은 일을 짧게 말해 주세요." };
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
        <div class="site-guide-chat" aria-label="고양이 도우미 채팅">
          <div class="site-guide-chat-log" data-guide-chat-log aria-live="polite">
            <p class="is-assistant">안녕하세요. 이 웹에서 필요한 일을 말씀해 주세요.</p>
          </div>
          <form data-guide-chat-form>
            <input type="text" data-guide-chat-input placeholder="예: 북마크는 어떻게 해?" autocomplete="off">
            <button type="submit" aria-label="보내기" title="보내기">↑</button>
          </form>
        </div>
        <label class="site-guide-auto-toggle"><input type="checkbox" data-guide-auto-move> <span data-guide-auto-move-label></span></label>
        <small>캐릭터를 끌어서 편한 곳에 놓을 수 있어요.</small>
      </div>
    `;
    document.body.append(root);
    root.classList.add("is-guide-positioning");
    window.requestAnimationFrame(() => {
      const rect = root.getBoundingClientRect();
      root.style.left = `${Math.round(rect.left)}px`;
      root.style.top = `${Math.round(rect.top)}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
      window.requestAnimationFrame(() => root.classList.remove("is-guide-positioning"));
    });

    const launcher = root.querySelector(".site-guide-launcher");
    const panel = root.querySelector(".site-guide-panel");
    const autoMove = root.querySelector("[data-guide-auto-move]");
    const autoMoveLabel = root.querySelector("[data-guide-auto-move-label]");
    const chatLog = root.querySelector("[data-guide-chat-log]");
    const chatForm = root.querySelector("[data-guide-chat-form]");
    const chatInput = root.querySelector("[data-guide-chat-input]");
    let autoMoveTimer = 0;
    let lastInteractionAt = Date.now();
    let playfulTimer = 0;
    let cursorNoticeTimer = 0;
    let pointerFrame = 0;
    let pointerPosition = null;
    try {
      const savedAutoMove = localStorage.getItem(AUTO_MOVE_KEY);
      autoMove.checked = savedAutoMove === null ? true : savedAutoMove === "true";
    } catch {
      autoMove.checked = true;
    }
    const syncAutoMoveLabel = () => {
      autoMoveLabel.textContent = autoMove.checked ? "움직임 멈추기" : "움직이게 하기";
    };
    syncAutoMoveLabel();
    const setOpen = (open) => {
      panel.hidden = !open;
      launcher.setAttribute("aria-expanded", String(open));
    };

    const stopGuideMotion = () => {
      if (root.classList.contains("is-guide-auto-moving")) {
        const rect = root.getBoundingClientRect();
        root.classList.add("is-guide-paused");
        root.style.left = `${Math.round(rect.left)}px`;
        root.style.top = `${Math.round(rect.top)}px`;
        window.requestAnimationFrame(() => root.classList.remove("is-guide-paused"));
      }
      root.classList.remove("is-guide-auto-moving");
      if (playfulTimer) window.clearTimeout(playfulTimer);
      if (cursorNoticeTimer) window.clearTimeout(cursorNoticeTimer);
      playfulTimer = 0;
      cursorNoticeTimer = 0;
      root.classList.remove("is-guide-being-playful");
      root.classList.remove("is-guide-curious");
      root.querySelectorAll("[data-guide-cat]").forEach((cat) => {
        cat.src = "./assets/cat-guide.png";
      });
    };

    const noteInteraction = () => {
      lastInteractionAt = Date.now();
      stopGuideMotion();
    };

    const canPlay = () => {
      const active = document.activeElement;
      if (!panel.hidden || !autoMove.checked) return false;
      if (active?.matches?.("input, textarea, select, [contenteditable='true']")) return false;
      return !document.body.classList.contains("is-editor-writing-focus");
    };

    const playAffection = () => {
      if (!canPlay() || playfulTimer) return;
      const cats = root.querySelectorAll("[data-guide-cat]");
      cats.forEach((cat) => {
        cat.src = "./assets/cat-guide-wave.png";
      });
      root.classList.add("is-guide-being-playful");
      playfulTimer = window.setTimeout(() => {
        cats.forEach((cat) => {
          cat.src = "./assets/cat-guide.png";
        });
        root.classList.remove("is-guide-being-playful");
        playfulTimer = 0;
      }, 1900);
    };

    const reactToNearbyCursor = () => {
      cursorNoticeTimer = 0;
      if (!canPlay() || !pointerPosition) return;
      const rect = root.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(pointerPosition.x - centerX, pointerPosition.y - centerY);
      if (distance > CURSOR_NOTICE_DISTANCE) {
        root.classList.remove("is-guide-curious");
        return;
      }
      root.style.setProperty("--guide-look-x", pointerPosition.x < centerX ? "-8deg" : "8deg");
      root.classList.add("is-guide-curious");
      window.setTimeout(() => root.classList.remove("is-guide-curious"), 1300);
      playAffection();
    };

    const wanderAlongEdge = () => {
      if (!canPlay() || Date.now() - lastInteractionAt < AUTO_MOVE_DELAY) return;
      const rect = root.getBoundingClientRect();
      const edge = 10;
      const maxX = Math.max(edge, window.innerWidth - rect.width - edge);
      const maxY = Math.max(edge, window.innerHeight - rect.height - edge);
      const targets = [
        { x: edge, y: edge + Math.random() * (maxY - edge) },
        { x: maxX, y: edge + Math.random() * (maxY - edge) },
        { x: edge + Math.random() * (maxX - edge), y: edge },
        { x: edge + Math.random() * (maxX - edge), y: maxY },
      ].filter((target) => Math.hypot(target.x - rect.left, target.y - rect.top) > 96);
      const target = targets[Math.floor(Math.random() * targets.length)];
      if (!target) return;
      root.style.left = `${Math.round(target.x)}px`;
      root.style.top = `${Math.round(target.y)}px`;
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.classList.add("is-guide-auto-moving");
      if (Math.random() < 0.55) window.setTimeout(playAffection, 900);
      window.setTimeout(() => root.classList.remove("is-guide-auto-moving"), 3400);
      lastInteractionAt = Date.now();
    };

    autoMove.addEventListener("change", () => {
      try {
        localStorage.setItem(AUTO_MOVE_KEY, String(autoMove.checked));
      } catch {
        // The guide still works when local storage is unavailable.
      }
      syncAutoMoveLabel();
      noteInteraction();
    });
    autoMoveTimer = window.setInterval(wanderAlongEdge, 700);

    document.addEventListener("pointermove", (event) => {
      pointerPosition = { x: event.clientX, y: event.clientY };
      if (pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!canPlay()) return;
        const rect = root.getBoundingClientRect();
        const distance = Math.hypot(
          pointerPosition.x - (rect.left + rect.width / 2),
          pointerPosition.y - (rect.top + rect.height / 2),
        );
        if (distance <= CURSOR_NOTICE_DISTANCE) {
          root.style.setProperty("--guide-look-x", pointerPosition.x < rect.left + rect.width / 2 ? "-8deg" : "8deg");
          root.classList.add("is-guide-curious");
          if (!cursorNoticeTimer && !playfulTimer) {
            cursorNoticeTimer = window.setTimeout(reactToNearbyCursor, CURSOR_NOTICE_DELAY);
          }
          return;
        }
        root.classList.remove("is-guide-curious");
        if (cursorNoticeTimer) window.clearTimeout(cursorNoticeTimer);
        cursorNoticeTimer = 0;
      });
    }, { passive: true });

    let dragStart = null;
    let moved = false;
    launcher.addEventListener("pointerdown", (event) => {
      noteInteraction();
      dragStart = { x: event.clientX, y: event.clientY, left: root.offsetLeft, top: root.offsetTop };
      moved = false;
      launcher.setPointerCapture?.(event.pointerId);
    });
    document.addEventListener("focusin", (event) => {
      if (!root.contains(event.target) && event.target.matches?.("input, textarea, select, [contenteditable='true']")) noteInteraction();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!root.contains(event.target)) noteInteraction();
    }, { passive: true });
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
    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const message = String(chatInput.value || "").trim();
      if (!message) return;
      noteInteraction();
      const userMessage = document.createElement("p");
      userMessage.className = "is-user";
      userMessage.textContent = message;
      chatLog.append(userMessage);
      const reply = getChatReply(message);
      const assistantMessage = document.createElement("div");
      assistantMessage.className = "is-assistant";
      assistantMessage.innerHTML = `<p>${reply.text}</p>${reply.action ? `<button type="button" data-guide-action="${reply.action}">${reply.label}</button>` : ""}`;
      chatLog.append(assistantMessage);
      assistantMessage.querySelector("[data-guide-action]")?.addEventListener("click", () => {
        setOpen(false);
        runAction(reply.action);
      });
      chatInput.value = "";
      chatLog.scrollTop = chatLog.scrollHeight;
    });
    window.addEventListener("beforeunload", () => {
      window.clearInterval(autoMoveTimer);
      window.clearTimeout(playfulTimer);
      window.clearTimeout(cursorNoticeTimer);
      window.cancelAnimationFrame(pointerFrame);
    }, { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountGuide, { once: true });
  else mountGuide();
})();
