const CONFIG = window.BLOG_CONFIG || {};
const SUPABASE_URL = CONFIG.supabaseUrl || "";
const TABLE_NAME = CONFIG.tableName || "posts";
const SUPABASE_KEY_STORAGE = "skyblog.supabaseAnonKey";
const POSTS_STORAGE = "skyblog.posts.v1";
const DRAFT_STORAGE = "skyblog.draft.v1";

const app = document.querySelector("#app");
const toastBox = document.querySelector("#toast");
const state = {
  posts: [],
  selectedId: null,
  category: "전체",
  query: "",
  view: "home",
  editingId: null,
  editorInitial: null,
  supabase: null,
  session: null,
  loading: true
};

const seedPosts = [
  {
    id: "local-seed-1",
    title: "하늘빛 블로그를 시작합니다",
    slug: "welcome-sky-blog",
    excerpt: "흰색 여백과 하늘색 포인트로 정리한 첫 글입니다.",
    category: "공지",
    tags: ["시작", "블로그"],
    cover_url: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=1200&q=80",
    content: `
      <p>이 블로그는 GitHub Pages에 바로 배포할 수 있는 정적 웹앱입니다. Supabase를 연결하면 공개 글을 불러오고, 로그인한 작성자는 에디터에서 새 글을 발행할 수 있습니다.</p>
      <h2>깔끔한 기록 공간</h2>
      <p>목록, 상세 보기, 검색, 카테고리, 태그, 커버 이미지, 리치 텍스트 편집 흐름을 한 화면 안에서 다룰 수 있게 구성했습니다.</p>
      <figure>
        <img src="https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=1200&q=80" alt="노트북이 놓인 밝은 책상" />
        <figcaption>밝고 정돈된 글쓰기 화면을 기준으로 잡았습니다.</figcaption>
      </figure>
    `,
    published: true,
    created_at: "2026-05-06T09:00:00+09:00",
    updated_at: "2026-05-06T09:00:00+09:00"
  },
  {
    id: "local-seed-2",
    title: "네이버 블로그처럼 편하게 쓰기",
    slug: "naver-like-editor",
    excerpt: "툴바, 제목, 카테고리, 태그, 커버 URL, 미리보기를 한 번에 제공합니다.",
    category: "에디터",
    tags: ["글쓰기", "에디터", "Supabase"],
    cover_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    content: `
      <p>글쓰기 화면에는 굵게, 기울임, 밑줄, 제목, 인용, 목록, 정렬, 링크, 이미지 삽입 버튼이 들어 있습니다. 본문은 자동으로 임시 저장되고, 오른쪽 미리보기에서 발행될 글의 느낌을 바로 확인할 수 있습니다.</p>
      <blockquote>Supabase anon key를 연결하고 작성자 계정으로 로그인하면 글이 데이터베이스에 저장됩니다.</blockquote>
      <p>키를 넣지 않은 상태에서는 브라우저 로컬 저장소에 저장되므로 디자인과 편집 경험을 먼저 확인하기 좋습니다.</p>
    `,
    published: true,
    created_at: "2026-05-05T18:20:00+09:00",
    updated_at: "2026-05-05T18:20:00+09:00"
  }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("#brandTitle").textContent = CONFIG.blogTitle || "Sky Blog";
  bindGlobalControls();
  await initSupabase();
  await loadPosts();
  updateIcons();
}

function bindGlobalControls() {
  document.body.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      const dialog = document.getElementById(closeButton.dataset.closeDialog);
      dialog?.close();
      return;
    }

    const nav = event.target.closest("[data-nav]");
    if (nav) {
      event.preventDefault();
      if (nav.dataset.nav === "editor") {
        openEditor();
      } else {
        state.view = nav.dataset.nav;
        state.editingId = null;
        state.editorInitial = null;
        render();
      }
    }
  });

  $("#syncButton").addEventListener("click", () => {
    $("#supabaseUrl").value = SUPABASE_URL;
    $("#supabaseKey").value = getSupabaseKey();
    $("#settingsDialog").showModal();
    updateIcons();
  });

  $("#settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = $("#supabaseKey").value.trim();
    if (key) {
      localStorage.setItem(SUPABASE_KEY_STORAGE, key);
    } else {
      localStorage.removeItem(SUPABASE_KEY_STORAGE);
    }
    $("#settingsDialog").close();
    await initSupabase(true);
    await loadPosts();
  });

  $("#clearKeyButton").addEventListener("click", async () => {
    localStorage.removeItem(SUPABASE_KEY_STORAGE);
    $("#supabaseKey").value = "";
    state.supabase = null;
    state.session = null;
    $("#settingsDialog").close();
    await loadPosts();
    toast("Supabase 키를 지우고 로컬 모드로 전환했습니다.");
  });

  $("#authButton").addEventListener("click", () => {
    if (!state.supabase) {
      $("#settingsDialog").showModal();
      toast("Supabase anon key를 먼저 저장하세요.");
      return;
    }
    renderAuthDialog();
    $("#authDialog").showModal();
    updateIcons();
  });

  $("#authForm").addEventListener("submit", signInWithPassword);
  $("#magicLinkButton").addEventListener("click", sendMagicLink);
  $("#signOutButton").addEventListener("click", signOut);
}

async function initSupabase(showSuccess = false) {
  const anonKey = getSupabaseKey();
  if (!SUPABASE_URL || !anonKey) {
    state.supabase = null;
    state.session = null;
    updateConnectionStatus();
    return;
  }

  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.4/+esm");
    state.supabase = createClient(SUPABASE_URL, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;
    state.supabase.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      updateConnectionStatus();
      if (state.view === "home") {
        loadPosts();
      } else {
        render();
      }
    });
    updateConnectionStatus();
    if (showSuccess) {
      toast("Supabase 연결을 준비했습니다.");
    }
  } catch (error) {
    state.supabase = null;
    state.session = null;
    updateConnectionStatus();
    toast(`Supabase SDK를 불러오지 못했습니다: ${error.message}`);
  }
}

async function loadPosts() {
  state.loading = true;
  render();

  if (state.supabase) {
    try {
      let query = state.supabase.from(TABLE_NAME).select("*").order("created_at", { ascending: false });
      if (!state.session) {
        query = query.eq("published", true);
      }
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      state.posts = normalizePosts(data);
      cacheLocalPosts(state.posts);
    } catch (error) {
      state.posts = getLocalPosts();
      toast(`Supabase에서 글을 불러오지 못해 로컬 글을 표시합니다: ${error.message}`);
    }
  } else {
    state.posts = getLocalPosts();
  }

  if (!state.posts.length) {
    state.posts = clonePosts(seedPosts);
  }

  state.selectedId = state.selectedId || state.posts[0]?.id || null;
  state.loading = false;
  render();
}

function render() {
  updateTopNav();
  updateConnectionStatus();
  if (state.view === "editor") {
    renderEditor();
  } else {
    renderHome();
  }
  updateIcons();
}

function renderHome() {
  const categories = getCategories();
  const visiblePosts = getFilteredPosts();
  const selected = visiblePosts.find((post) => post.id === state.selectedId) || visiblePosts[0] || state.posts[0];
  if (selected) {
    state.selectedId = selected.id;
  }

  app.innerHTML = `
    <section class="blog-grid">
      <aside class="profile-panel">
        <div class="profile-visual"><i data-lucide="cloud-sun"></i></div>
        <h1>${escapeHtml(CONFIG.blogTitle || "Sky Blog")}</h1>
        <p>${escapeHtml(CONFIG.ownerName || "나의 기록")}의 하늘색 블로그</p>
        <button class="primary-button wide" type="button" data-nav="editor">
          <i data-lucide="square-pen"></i>
          새 글 쓰기
        </button>
        <label class="search-field">
          <span class="sr-only">검색</span>
          <i data-lucide="search"></i>
          <input id="searchInput" type="search" value="${escapeAttr(state.query)}" placeholder="글 검색" />
        </label>
        <div class="category-list" aria-label="카테고리">
          ${categories.map(renderCategory).join("")}
        </div>
      </aside>

      <section class="feed-panel">
        <div class="section-head">
          <div>
            <h2>최근 글</h2>
            <p>${visiblePosts.length}개의 글</p>
          </div>
          <button class="icon-button" type="button" id="refreshButton" aria-label="새로고침" title="새로고침">
            <i data-lucide="refresh-cw"></i>
          </button>
        </div>
        <div class="post-list">
          ${
            state.loading
              ? `<div class="empty-state">불러오는 중...</div>`
              : visiblePosts.length
                ? visiblePosts.map((post) => renderPostCard(post, selected?.id === post.id)).join("")
                : `<div class="empty-state">표시할 글이 없습니다.</div>`
          }
        </div>
      </section>

      <article class="reader-panel">
        ${selected ? renderReader(selected) : `<div class="empty-state">첫 글을 작성해보세요.</div>`}
      </article>
    </section>
  `;

  bindHomeEvents();
}

function renderCategory(category) {
  const count = category === "전체" ? state.posts.length : state.posts.filter((post) => (post.category || "기타") === category).length;
  return `
    <button class="category-chip ${state.category === category ? "is-active" : ""}" type="button" data-category="${escapeAttr(category)}">
      <span>${escapeHtml(category)}</span>
      <strong>${count}</strong>
    </button>
  `;
}

function renderPostCard(post, isActive) {
  return `
    <article class="post-card ${isActive ? "is-active" : ""}" data-post-id="${escapeAttr(post.id)}" tabindex="0">
      <div class="post-thumb">${renderCover(post, "thumb")}</div>
      <div>
        <div class="post-meta">${escapeHtml(post.category || "기타")} · ${formatDate(post.created_at)}</div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt || makeExcerpt(post.content))}</p>
      </div>
    </article>
  `;
}

function renderReader(post) {
  return `
    <div class="reader-cover">${renderCover(post, "reader")}</div>
    <div class="reader-body">
      <div class="post-meta">${escapeHtml(post.category || "기타")} · ${formatDate(post.created_at)}</div>
      <h2 class="reader-title">${escapeHtml(post.title)}</h2>
      <div class="tag-list">${(post.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="reader-toolbar">
        <button class="outline-button" type="button" data-edit-id="${escapeAttr(post.id)}">
          <i data-lucide="square-pen"></i>
          수정
        </button>
        <button class="ghost-button" type="button" data-delete-id="${escapeAttr(post.id)}">
          <i data-lucide="trash-2"></i>
          삭제
        </button>
      </div>
      <div class="content">${sanitizeHtml(post.content)}</div>
    </div>
  `;
}

function renderCover(post) {
  if (post.cover_url) {
    return `<img src="${escapeAttr(post.cover_url)}" alt="${escapeAttr(post.title)} 커버" loading="lazy" />`;
  }
  return `<div class="cover-placeholder"><i data-lucide="image"></i></div>`;
}

function bindHomeEvents() {
  $("#searchInput")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderHome();
    updateIcons();
    $("#searchInput")?.focus();
  });

  $("#refreshButton")?.addEventListener("click", loadPosts);

  $$("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      state.selectedId = null;
      renderHome();
      updateIcons();
    });
  });

  $$("[data-post-id]").forEach((card) => {
    const select = () => {
      state.selectedId = card.dataset.postId;
      renderHome();
      updateIcons();
    };
    card.addEventListener("click", select);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
  });

  $$("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => openEditor(button.dataset.editId));
  });

  $$("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deletePost(button.dataset.deleteId));
  });
}

function openEditor(postId = null) {
  const post = postId ? state.posts.find((item) => item.id === postId) : getDraft() || createBlankPost();
  state.view = "editor";
  state.editingId = postId;
  state.editorInitial = clonePost(post || createBlankPost());
  render();
}

function renderEditor() {
  const post = state.editorInitial || createBlankPost();
  const tags = Array.isArray(post.tags) ? post.tags.join(", ") : "";
  app.innerHTML = `
    <form class="editor-shell" id="editorForm">
      <div class="editor-head">
        <input class="editor-title" id="editorTitle" value="${escapeAttr(post.title || "")}" placeholder="제목" />
        <div class="editor-actions">
          <button class="ghost-button" type="button" data-editor-action="draft">
            <i data-lucide="save"></i>
            임시저장
          </button>
          <button class="primary-button" type="submit">
            <i data-lucide="send"></i>
            발행
          </button>
        </div>
      </div>

      <div class="editor-meta">
        <label class="meta-field">
          <span>카테고리</span>
          <input id="editorCategory" value="${escapeAttr(post.category || "일상")}" />
        </label>
        <label class="meta-field">
          <span>태그</span>
          <input id="editorTags" value="${escapeAttr(tags)}" placeholder="쉼표로 구분" />
        </label>
        <label class="meta-field">
          <span>커버 URL</span>
          <input id="editorCover" type="url" value="${escapeAttr(post.cover_url || "")}" />
        </label>
        <label class="switch-field">
          <input id="editorPublished" type="checkbox" ${post.published !== false ? "checked" : ""} />
          공개
        </label>
      </div>

      <div class="editor-toolbar" aria-label="글 편집 도구">
        <div class="tool-group">
          <button class="tool-button" type="button" data-command="undo" aria-label="실행 취소" title="실행 취소"><i data-lucide="undo-2"></i></button>
          <button class="tool-button" type="button" data-command="redo" aria-label="다시 실행" title="다시 실행"><i data-lucide="redo-2"></i></button>
        </div>
        <div class="tool-group">
          <button class="tool-button" type="button" data-command="bold" aria-label="굵게" title="굵게"><i data-lucide="bold"></i></button>
          <button class="tool-button" type="button" data-command="italic" aria-label="기울임" title="기울임"><i data-lucide="italic"></i></button>
          <button class="tool-button" type="button" data-command="underline" aria-label="밑줄" title="밑줄"><i data-lucide="underline"></i></button>
          <input class="color-input" id="textColor" type="color" value="#1499db" aria-label="글자색" title="글자색" />
        </div>
        <div class="tool-group">
          <button class="tool-button is-text" type="button" data-command="formatBlock" data-value="h2">H2</button>
          <button class="tool-button is-text" type="button" data-command="formatBlock" data-value="h3">H3</button>
          <button class="tool-button is-text" type="button" data-command="formatBlock" data-value="p">P</button>
          <button class="tool-button" type="button" data-command="blockquote" aria-label="인용" title="인용"><i data-lucide="quote"></i></button>
        </div>
        <div class="tool-group">
          <button class="tool-button" type="button" data-command="insertUnorderedList" aria-label="글머리 목록" title="글머리 목록"><i data-lucide="list"></i></button>
          <button class="tool-button" type="button" data-command="insertOrderedList" aria-label="번호 목록" title="번호 목록"><i data-lucide="list-ordered"></i></button>
          <button class="tool-button" type="button" data-command="justifyLeft" aria-label="왼쪽 정렬" title="왼쪽 정렬"><i data-lucide="align-left"></i></button>
          <button class="tool-button" type="button" data-command="justifyCenter" aria-label="가운데 정렬" title="가운데 정렬"><i data-lucide="align-center"></i></button>
        </div>
        <div class="tool-group">
          <button class="tool-button" type="button" data-command="createLink" aria-label="링크" title="링크"><i data-lucide="link"></i></button>
          <button class="tool-button" type="button" data-command="insertImage" aria-label="이미지" title="이미지"><i data-lucide="image-plus"></i></button>
          <button class="tool-button" type="button" data-command="insertHorizontalRule" aria-label="구분선" title="구분선"><i data-lucide="minus"></i></button>
          <button class="tool-button" type="button" data-command="removeFormat" aria-label="서식 지우기" title="서식 지우기"><i data-lucide="eraser"></i></button>
        </div>
      </div>

      <div class="editor-workspace">
        <div class="editor-page">
          <div id="editorContent" class="editor-canvas content" contenteditable="true" spellcheck="true">${sanitizeHtml(post.content || "")}</div>
        </div>
        <aside class="editor-preview">
          <h2>미리보기</h2>
          <div class="preview-frame" id="editorPreview"></div>
        </aside>
      </div>

      <div class="editor-foot">
        <p class="status-line" id="editorStatus">로컬 자동 임시저장</p>
        <div class="editor-actions">
          <button class="outline-button" type="button" data-editor-action="cancel">돌아가기</button>
          <button class="primary-button" type="submit">발행</button>
        </div>
      </div>
    </form>
  `;

  bindEditorEvents();
}

function bindEditorEvents() {
  const editor = $("#editorContent");
  const update = debounce(() => {
    saveDraft();
    updatePreview();
  }, 300);

  $$(".tool-button").forEach((button) => {
    button.addEventListener("click", () => runEditorCommand(button.dataset.command, button.dataset.value));
  });

  $("#textColor").addEventListener("input", (event) => {
    editor.focus();
    document.execCommand("foreColor", false, event.target.value);
    update();
  });

  ["editorTitle", "editorCategory", "editorTags", "editorCover", "editorPublished"].forEach((id) => {
    document.getElementById(id).addEventListener("input", update);
  });

  editor.addEventListener("input", update);
  editor.addEventListener("paste", handleImagePaste);

  $("#editorForm").addEventListener("submit", publishPost);
  $("[data-editor-action='draft']").addEventListener("click", () => {
    saveDraft();
    toast("임시저장했습니다.");
  });
  $("[data-editor-action='cancel']").addEventListener("click", () => {
    state.view = "home";
    state.editingId = null;
    state.editorInitial = null;
    render();
  });

  updatePreview();
}

function runEditorCommand(command, value) {
  const editor = $("#editorContent");
  editor.focus();

  if (command === "createLink") {
    const url = normalizeUrl(prompt("링크 URL"));
    if (url) {
      document.execCommand("createLink", false, url);
    }
  } else if (command === "insertImage") {
    const url = normalizeUrl(prompt("이미지 URL"));
    if (url) {
      document.execCommand("insertImage", false, url);
    }
  } else if (command === "blockquote") {
    document.execCommand("formatBlock", false, "blockquote");
  } else if (command === "formatBlock") {
    document.execCommand("formatBlock", false, value);
  } else {
    document.execCommand(command, false, value || null);
  }

  saveDraft();
  updatePreview();
}

function handleImagePaste(event) {
  const items = Array.from(event.clipboardData?.items || []).filter((item) => item.type.startsWith("image/"));
  if (!items.length) {
    return;
  }

  event.preventDefault();
  items.forEach((item) => {
    const file = item.getAsFile();
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      $("#editorContent").focus();
      document.execCommand("insertImage", false, reader.result);
      saveDraft();
      updatePreview();
    };
    reader.readAsDataURL(file);
  });
}

function readEditorPost({ loose = false } = {}) {
  const base = state.editorInitial || createBlankPost();
  const title = $("#editorTitle").value.trim();
  const content = sanitizeHtml($("#editorContent").innerHTML.trim());
  const text = htmlToText(content);

  if (!loose && !title) {
    throw new Error("제목을 입력하세요.");
  }
  if (!loose && !text) {
    throw new Error("본문을 입력하세요.");
  }

  const now = new Date().toISOString();
  const tags = $("#editorTags").value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    id: base.id || crypto.randomUUID(),
    title: title || "제목 없음",
    slug: base.slug || makeSlug(title || "untitled"),
    excerpt: makeExcerpt(content),
    category: $("#editorCategory").value.trim() || "일상",
    tags,
    cover_url: $("#editorCover").value.trim(),
    content,
    published: $("#editorPublished").checked,
    created_at: base.created_at || now,
    updated_at: now
  };
}

function saveDraft() {
  try {
    const draft = readEditorPost({ loose: true });
    localStorage.setItem(DRAFT_STORAGE, JSON.stringify(draft));
    $("#editorStatus").textContent = `임시저장 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    $("#editorStatus").textContent = "임시저장 대기";
  }
}

function updatePreview() {
  const post = readEditorPost({ loose: true });
  $("#editorPreview").innerHTML = `
    ${post.cover_url ? `<div class="reader-cover"><img src="${escapeAttr(post.cover_url)}" alt="${escapeAttr(post.title)} 커버" /></div>` : ""}
    <div class="post-meta">${escapeHtml(post.category)} · ${formatDate(post.updated_at)}</div>
    <h2 class="reader-title">${escapeHtml(post.title)}</h2>
    <div class="tag-list">${post.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>
    <div class="content">${sanitizeHtml(post.content)}</div>
  `;
}

async function publishPost(event) {
  event.preventDefault();
  try {
    const post = readEditorPost();
    const saved = await persistPost(post);
    localStorage.removeItem(DRAFT_STORAGE);
    state.selectedId = saved.id;
    state.view = "home";
    state.editingId = null;
    state.editorInitial = null;
    await loadPosts();
    state.selectedId = saved.id;
    render();
  } catch (error) {
    toast(error.message);
  }
}

async function persistPost(post) {
  if (state.supabase && state.session) {
    const payload = {
      ...post,
      id: isUuid(post.id) ? post.id : crypto.randomUUID()
    };
    const { data, error } = await state.supabase.from(TABLE_NAME).upsert(payload, { onConflict: "id" }).select().single();
    if (error) {
      throw error;
    }
    toast("Supabase에 발행했습니다.");
    return normalizePost(data);
  }

  const saved = {
    ...post,
    id: post.id || crypto.randomUUID()
  };
  const next = [saved, ...state.posts.filter((item) => item.id !== saved.id)].sort(sortByDate);
  state.posts = next;
  cacheLocalPosts(next);
  toast(state.supabase ? "로그인 전이라 로컬에 저장했습니다." : "로컬에 저장했습니다.");
  return saved;
}

async function deletePost(id) {
  if (!confirm("이 글을 삭제할까요?")) {
    return;
  }

  if (state.supabase && state.session && isUuid(id)) {
    const { error } = await state.supabase.from(TABLE_NAME).delete().eq("id", id);
    if (error) {
      toast(error.message);
      return;
    }
    toast("Supabase에서 삭제했습니다.");
  } else {
    state.posts = state.posts.filter((post) => post.id !== id);
    cacheLocalPosts(state.posts);
    toast("로컬 글을 삭제했습니다.");
  }

  state.selectedId = null;
  await loadPosts();
}

async function signInWithPassword(event) {
  event.preventDefault();
  if (!state.supabase) {
    toast("Supabase 연결이 필요합니다.");
    return;
  }
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const { error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    toast(error.message);
    return;
  }
  $("#authDialog").close();
  toast("로그인했습니다.");
}

async function sendMagicLink() {
  if (!state.supabase) {
    toast("Supabase 연결이 필요합니다.");
    return;
  }
  const email = $("#authEmail").value.trim();
  if (!email) {
    toast("이메일을 입력하세요.");
    return;
  }
  const { error } = await state.supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split("#")[0] }
  });
  if (error) {
    toast(error.message);
    return;
  }
  toast("매직 링크를 보냈습니다.");
}

async function signOut() {
  if (!state.supabase) {
    return;
  }
  await state.supabase.auth.signOut();
  $("#authDialog").close();
  toast("로그아웃했습니다.");
}

function renderAuthDialog() {
  const email = state.session?.user?.email || "";
  $("#authState").textContent = email ? `${email} 로그인됨` : "로그인 필요";
  $("#authEmail").value = email;
  $("#authPassword").value = "";
  $("#signOutButton").hidden = !state.session;
}

function updateConnectionStatus() {
  const syncLabel = $("#syncLabel");
  const authButton = $("#authButton");
  if (!syncLabel || !authButton) {
    return;
  }

  if (!getSupabaseKey()) {
    syncLabel.textContent = "로컬 모드";
  } else if (state.supabase && state.session) {
    syncLabel.textContent = "작성자 연결";
  } else if (state.supabase) {
    syncLabel.textContent = "Supabase";
  } else {
    syncLabel.textContent = "연결 대기";
  }

  authButton.textContent = state.session ? "계정" : "로그인";
}

function updateTopNav() {
  $$(".nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === state.view);
  });
}

function getFilteredPosts() {
  const query = state.query.trim().toLowerCase();
  return state.posts.filter((post) => {
    const inCategory = state.category === "전체" || (post.category || "기타") === state.category;
    const haystack = `${post.title} ${post.excerpt || ""} ${(post.tags || []).join(" ")} ${htmlToText(post.content)}`.toLowerCase();
    return inCategory && (!query || haystack.includes(query));
  });
}

function getCategories() {
  return ["전체", ...new Set(state.posts.map((post) => post.category || "기타"))];
}

function getSupabaseKey() {
  return localStorage.getItem(SUPABASE_KEY_STORAGE) || CONFIG.supabaseAnonKey || "";
}

function getLocalPosts() {
  try {
    const saved = JSON.parse(localStorage.getItem(POSTS_STORAGE) || "[]");
    return saved.length ? normalizePosts(saved) : clonePosts(seedPosts);
  } catch {
    return clonePosts(seedPosts);
  }
}

function cacheLocalPosts(posts) {
  localStorage.setItem(POSTS_STORAGE, JSON.stringify(posts));
}

function getDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_STORAGE) || "null");
    return draft ? normalizePost(draft) : null;
  } catch {
    return null;
  }
}

function createBlankPost() {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    slug: "",
    excerpt: "",
    category: "일상",
    tags: [],
    cover_url: "",
    content: "<p></p>",
    published: true,
    created_at: now,
    updated_at: now
  };
}

function normalizePosts(posts = []) {
  return posts.map(normalizePost).sort(sortByDate);
}

function normalizePost(post) {
  return {
    id: post.id,
    title: post.title || "제목 없음",
    slug: post.slug || makeSlug(post.title || "post"),
    excerpt: post.excerpt || makeExcerpt(post.content || ""),
    category: post.category || "일상",
    tags: Array.isArray(post.tags) ? post.tags : [],
    cover_url: post.cover_url || "",
    content: sanitizeHtml(post.content || ""),
    published: post.published !== false,
    created_at: post.created_at || new Date().toISOString(),
    updated_at: post.updated_at || post.created_at || new Date().toISOString()
  };
}

function clonePost(post) {
  return JSON.parse(JSON.stringify(post));
}

function clonePosts(posts) {
  return posts.map(clonePost);
}

function sortByDate(a, b) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function makeSlug(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `post-${Date.now()}`;
}

function makeExcerpt(html) {
  const text = htmlToText(html);
  return text.length > 92 ? `${text.slice(0, 92)}...` : text;
}

function htmlToText(html) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeHtml(html || "");
  return template.content.textContent.replace(/\s+/g, " ").trim();
}

function sanitizeHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  template.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) {
        node.removeAttribute(attribute.name);
      }
      if ((name === "href" || name === "src") && /^javascript:/i.test(value)) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return template.innerHTML;
}

function normalizeUrl(value) {
  const url = (value || "").trim();
  if (!url) {
    return "";
  }
  if (/^(https?:|mailto:|data:image\/)/i.test(url)) {
    return url;
  }
  return `https://${url}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function debounce(callback, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

function toast(message) {
  toastBox.textContent = message;
  toastBox.classList.add("is-visible");
  clearTimeout(toastBox.dataset.timer);
  toastBox.dataset.timer = setTimeout(() => {
    toastBox.classList.remove("is-visible");
  }, 3200);
}

function updateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
