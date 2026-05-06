const CONFIG = window.BLOG_CONFIG || {};
const SUPABASE_URL = CONFIG.supabaseUrl || "";
const TABLE_NAME = CONFIG.tableName || "posts";
const PROFILE_TABLE = "profiles";
const CATEGORY_TABLE = "categories";
const FOLDER_TABLE = "folders";
const AUTH_EMAIL_DOMAIN = CONFIG.authEmailDomain || "blog.local";
const SUPABASE_KEY_STORAGE = "skyblog.supabaseAnonKey";
const POSTS_STORAGE = "skyblog.posts.v2";
const CATEGORIES_STORAGE = "skyblog.categories.v1";
const FOLDERS_STORAGE = "skyblog.folders.v1";
const DRAFT_STORAGE = "skyblog.draft.v2";
const SIDEBAR_STORAGE = "skyblog.sidebarCollapsed";
const ROUTES = {
  home: "#home",
  myblog: "#blog/me",
  editor: "#write",
  postPrefix: "#post/"
};

const app = document.querySelector("#app");
const toastBox = document.querySelector("#toast");

const state = {
  posts: [],
  selectedId: null,
  category: "전체",
  activeFolderId: "all",
  query: "",
  view: "home",
  editingId: null,
  editorInitial: null,
  authMode: "login",
  supabase: null,
  session: null,
  profile: null,
  categories: [],
  folders: [],
  supabaseError: null,
  sidebarCollapsed: localStorage.getItem(SIDEBAR_STORAGE) === "true",
  loading: true
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("#brandTitle").textContent = CONFIG.blogTitle || "Blog";
  bindGlobalControls();
  await initSupabase();
  applyRouteFromHash();
  await loadPosts();
  updateIcons();
}

function bindGlobalControls() {
  document.body.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      document.getElementById(closeButton.dataset.closeDialog)?.close();
      return;
    }

    const nav = event.target.closest("[data-nav]");
    if (!nav) {
      return;
    }

    event.preventDefault();
    const nextView = nav.dataset.nav;
    if (nextView === "editor") {
      openEditor();
      return;
    }
    if (nextView === "myblog" && !state.session) {
      openAuth();
      toast("로그인하면 내 블로그를 만들 수 있습니다.");
      return;
    }
    navigateTo(nextView);
  });

  window.addEventListener("hashchange", applyRouteFromHash);

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
    state.profile = null;
    navigateTo("home", { replace: true });
    $("#settingsDialog").close();
    await loadPosts();
    toast("Supabase 키를 지우고 로컬 모드로 전환했습니다.");
  });

  $("#authButton").addEventListener("click", openAuth);
  $("#authForm").addEventListener("submit", submitAuthForm);
  $("#signOutButton").addEventListener("click", signOut);

  $$("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
      renderAuthDialog();
    });
  });
}

async function initSupabase(showSuccess = false) {
  const anonKey = getSupabaseKey();
  if (!SUPABASE_URL || !anonKey) {
    state.supabase = null;
    state.session = null;
    state.profile = null;
    updateConnectionStatus();
    return;
  }

  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.4/+esm");
    state.supabase = createClient(SUPABASE_URL, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    const { data } = await state.supabase.auth.getSession();
    state.session = data.session;
    if (state.session) {
      await ensureProfile();
    }

    state.supabase.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      state.profile = null;
      if (session) {
        await ensureProfile();
      } else if (state.view === "myblog" || state.view === "editor") {
        navigateTo("home", { replace: true });
      }
      updateConnectionStatus();
      await loadPosts();
    });

    updateConnectionStatus();
    if (showSuccess) {
      toast("Supabase 연결을 준비했습니다.");
    }
  } catch (error) {
    state.supabase = null;
    state.session = null;
    state.profile = null;
    updateConnectionStatus();
    toast(`Supabase SDK를 불러오지 못했습니다: ${error.message}`);
  }
}

async function ensureProfile() {
  if (!state.supabase || !state.session) {
    return null;
  }

  const user = state.session.user;
  const fallbackName = getUserIdentifier(user) || "작성자";
  const defaults = {
    id: user.id,
    display_name: fallbackName,
    blog_title: `${fallbackName}의 하늘색 블로그`,
    bio: "오늘의 생각을 차분히 기록합니다."
  };

  const existing = await state.supabase
    .from(PROFILE_TABLE)
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing.error) {
    toast(`프로필을 불러오지 못했습니다: ${existing.error.message}`);
    state.profile = defaults;
    return defaults;
  }

  if (existing.data) {
    state.profile = existing.data;
    return state.profile;
  }

  try {
    state.profile = await persistProfile(defaults);
    return state.profile;
  } catch (error) {
    toast(`프로필을 만들지 못했습니다: ${error.message}`);
    state.profile = defaults;
    return defaults;
  }
}

async function loadPosts() {
  state.loading = true;
  render();

  if (state.supabase) {
    try {
      const { data, error } = await state.supabase
        .from(TABLE_NAME)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      state.supabaseError = null;
      state.posts = normalizePosts(data || []);
      cacheLocalPosts(state.posts);
    } catch (error) {
      state.supabaseError = error;
      state.posts = getLocalPosts();
      toast(`Supabase에서 글을 불러오지 못해 로컬 글을 표시합니다: ${error.message}`);
    }
  } else {
    state.supabaseError = null;
    state.posts = getLocalPosts();
  }

  if (state.view !== "post") {
    state.selectedId = getVisiblePosts()[0]?.id || null;
  }
  await loadTaxonomy();
  state.loading = false;
  render();
}

async function loadTaxonomy() {
  if (state.supabase) {
    try {
      const [categoriesResult, foldersResult] = await Promise.all([
        state.supabase.from(CATEGORY_TABLE).select("*").order("name", { ascending: true }),
        state.supabase.from(FOLDER_TABLE).select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true })
      ]);

      if (categoriesResult.error && categoriesResult.error.code !== "PGRST205") {
        throw categoriesResult.error;
      }
      if (foldersResult.error && foldersResult.error.code !== "PGRST205") {
        throw foldersResult.error;
      }
      if (!categoriesResult.error) {
        state.categories = normalizeCategories(categoriesResult.data || []);
        cacheTaxonomy(CATEGORIES_STORAGE, state.categories);
      }
      if (!foldersResult.error) {
        state.folders = normalizeFolders(foldersResult.data || []);
        cacheTaxonomy(FOLDERS_STORAGE, state.folders);
      }
      return;
    } catch (error) {
      toast(`카테고리/폴더를 불러오지 못했습니다: ${error.message}`);
    }
  }

  state.categories = getStoredTaxonomy(CATEGORIES_STORAGE);
  state.folders = getStoredTaxonomy(FOLDERS_STORAGE);
}

function render() {
  updateTopNav();
  updateConnectionStatus();
  if (state.view === "editor") {
    renderEditor();
  } else if (state.view === "post") {
    renderPostView();
  } else {
    renderBlogList();
  }
  updateIcons();
}

function navigateTo(view, { replace = false } = {}) {
  if ((view === "myblog" || view === "editor") && !state.session) {
    openAuth();
    toast("로그인하면 내 블로그로 이동할 수 있습니다.");
    view = "home";
  }

  const route = ROUTES[view] || ROUTES.home;
  if (replace) {
    window.history.replaceState(null, "", route);
  } else if (window.location.hash !== route) {
    window.location.hash = route;
    return;
  }

  applyView(view);
}

function applyRouteFromHash() {
  const view = viewFromHash();
  if ((view === "myblog" || view === "editor") && !state.session) {
    window.history.replaceState(null, "", ROUTES.home);
    applyView("home");
    return;
  }

  if (view === "editor") {
    openEditor(null, { keepRoute: true });
    return;
  }

  applyView(view, { keepSelected: view === "post" });
}

function viewFromHash() {
  if (window.location.hash.startsWith(ROUTES.postPrefix)) {
    state.selectedId = decodeURIComponent(window.location.hash.slice(ROUTES.postPrefix.length));
    return "post";
  }
  if (window.location.hash === ROUTES.myblog) {
    return "myblog";
  }
  if (window.location.hash === ROUTES.editor) {
    return "editor";
  }
  return "home";
}

function applyView(view, { keepSelected = false } = {}) {
  state.view = view;
  state.editingId = null;
  state.editorInitial = null;
  if (!keepSelected) {
    state.selectedId = null;
  }
  state.category = "전체";
  state.activeFolderId = "all";
  render();
}

function renderBlogList() {
  const isMine = state.view === "myblog";
  const visiblePosts = getVisiblePosts();
  const categories = getCategories(visiblePosts);
  const visibleFolders = getVisibleFolders();

  const title = isMine ? getMyBlogTitle() : "공용 홈";
  const countLabel = isMine ? "내 글" : "공개 글";

  app.innerHTML = `
    <section class="blog-grid ${state.sidebarCollapsed ? "is-sidebar-collapsed" : ""}">
      <aside class="profile-panel">
        <button class="icon-button sidebar-toggle" type="button" id="sidebarToggle" aria-label="${state.sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}" title="${state.sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}">
          <i data-lucide="${state.sidebarCollapsed ? "panel-left-open" : "panel-left-close"}"></i>
        </button>
        <div class="sidebar-body" ${state.sidebarCollapsed ? "hidden" : ""}>
          <p class="eyebrow">${isMine ? "My Blog" : "Public Home"}</p>
          <h1>${escapeHtml(title)}</h1>
          ${
            isMine
              ? `
                <div class="profile-actions">
                  <button class="outline-button" type="button" id="editProfileButton">
                    <i data-lucide="settings"></i>
                    블로그 설정
                  </button>
                  <button class="primary-button" type="button" data-nav="editor">
                    <i data-lucide="square-pen"></i>
                    새 글 쓰기
                  </button>
                </div>
              `
              : `
                <button class="primary-button wide" type="button" ${state.session ? 'data-nav="myblog"' : 'id="homeLoginButton"'}>
                  <i data-lucide="${state.session ? "user-round" : "log-in"}"></i>
                  ${state.session ? "내 블로그로" : "로그인하고 시작"}
                </button>
              `
          }
          <label class="search-field">
            <span class="sr-only">검색</span>
            <input id="searchInput" type="search" value="${escapeAttr(state.query)}" placeholder="글 검색" />
          </label>
          <div class="category-list" aria-label="카테고리">
            <div class="sidebar-section-head">
              <strong>카테고리</strong>
              ${isMine ? `<button class="icon-button mini-button" type="button" id="addCategoryButton" aria-label="카테고리 추가" title="카테고리 추가"><i data-lucide="plus"></i></button>` : ""}
            </div>
            ${categories.map((category) => renderCategory(category, visiblePosts)).join("")}
          </div>
          <div class="folder-list" aria-label="폴더">
            <div class="sidebar-section-head">
              <strong>폴더</strong>
              ${isMine ? `<button class="icon-button mini-button" type="button" id="addRootFolderButton" aria-label="폴더 추가" title="폴더 추가"><i data-lucide="folder-plus"></i></button>` : ""}
            </div>
            ${renderFolderTree(visibleFolders, isMine)}
          </div>
        </div>
      </aside>

      <section class="feed-panel">
        <div class="section-head">
          <div>
            <h2>${countLabel}</h2>
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
                ? visiblePosts.map((post) => renderPostCard(post, false)).join("")
                : renderEmptyState(isMine)
          }
        </div>
      </section>
    </section>

    ${isMine ? renderProfileDialog() : ""}
  `;

  bindListEvents();
}

function renderPostView() {
  const post = state.posts.find((item) => item.id === state.selectedId);
  const canView = post && (post.published || post.owner_id === state.session?.user?.id);
  const isMine = Boolean(post && state.session && post.owner_id === state.session.user.id);
  const backView = isMine ? "myblog" : "home";

  app.innerHTML = `
    <section class="post-view-shell">
      <div class="post-view-head">
        <button class="outline-button" type="button" data-nav="${backView}">
          <i data-lucide="arrow-left"></i>
          돌아가기
        </button>
      </div>
      <article class="reader-panel post-view-panel">
        ${canView ? renderReader(post, isMine) : `<div class="empty-state">글을 찾을 수 없습니다.</div>`}
      </article>
    </section>
  `;

  bindPostViewEvents();
}

function renderEmptyState(isMine) {
  if (state.supabaseError) {
    return `
      <div class="empty-state">
        <div>
          <strong>Supabase 테이블 연결이 필요합니다.</strong>
          <p>${escapeHtml(getSupabaseSetupMessage(state.supabaseError))}</p>
        </div>
      </div>
    `;
  }

  return `<div class="empty-state">${isMine ? "아직 내 글이 없습니다." : "아직 공개된 계정 글이 없습니다."}</div>`;
}

function getSupabaseSetupMessage(error) {
  const message = error?.message || "";
  if (message.includes("Could not find the table") || error?.code === "PGRST205") {
    return "Supabase SQL Editor에서 supabase-schema.sql을 실행하면 posts/profiles 테이블이 생성됩니다.";
  }
  return message;
}

function renderCategory(category, posts) {
  const count = category === "전체" ? posts.length : posts.filter((post) => (post.category || "기타") === category).length;
  return `
    <button class="category-chip ${state.category === category ? "is-active" : ""}" type="button" data-category="${escapeAttr(category)}">
      <span>${escapeHtml(category)}</span>
      <strong>${count}</strong>
    </button>
  `;
}

function renderFolderTree(folders, canManage) {
  const tree = buildFolderTree(folders).filter((folder) => !folder.parent_id);
  return `
    <button class="folder-node ${state.activeFolderId === "all" ? "is-active" : ""}" type="button" data-folder-id="all">
      <span><i data-lucide="folder"></i>전체 폴더</span>
      <strong>${getPostsForCurrentScope().length}</strong>
    </button>
    ${tree.length ? tree.map((folder) => renderFolderNode(folder, canManage, 0)).join("") : `<p class="folder-empty">폴더가 없습니다.</p>`}
  `;
}

function renderFolderNode(folder, canManage, depth) {
  const descendants = getFolderDescendantIds(folder.id);
  const count = getPostsForCurrentScope().filter((post) => post.folder_id === folder.id || descendants.includes(post.folder_id)).length;
  return `
    <div class="folder-branch" style="--depth: ${depth}">
      <button class="folder-node ${state.activeFolderId === folder.id ? "is-active" : ""}" type="button" data-folder-id="${escapeAttr(folder.id)}">
        <span><i data-lucide="folder"></i>${escapeHtml(folder.name)}</span>
        <strong>${count}</strong>
      </button>
      ${canManage ? `<button class="icon-button mini-button folder-add-child" type="button" data-add-child-folder="${escapeAttr(folder.id)}" aria-label="하위 폴더 추가" title="하위 폴더 추가"><i data-lucide="plus"></i></button>` : ""}
    </div>
    ${folder.children.map((child) => renderFolderNode(child, canManage, depth + 1)).join("")}
  `;
}

function renderFolderOptions(selectedId) {
  const roots = buildFolderTree(getMyFolders()).filter((folder) => !folder.parent_id);
  return roots.map((folder) => renderFolderOption(folder, selectedId, 0)).join("");
}

function renderFolderOption(folder, selectedId, depth) {
  const prefix = depth ? `${"--".repeat(depth)} ` : "";
  return `
    <option value="${escapeAttr(folder.id)}" ${folder.id === selectedId ? "selected" : ""}>${escapeHtml(prefix + folder.name)}</option>
    ${folder.children.map((child) => renderFolderOption(child, selectedId, depth + 1)).join("")}
  `;
}

function renderPostCard(post, isActive) {
  return `
    <article class="post-card ${isActive ? "is-active" : ""}" data-post-id="${escapeAttr(post.id)}" tabindex="0">
      <div class="post-thumb">${renderCover(post)}</div>
      <div>
        <div class="post-meta">${escapeHtml(post.category || "기타")} · ${formatDate(post.created_at)}</div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt || makeExcerpt(post.content))}</p>
      </div>
    </article>
  `;
}

function renderReader(post, isMine) {
  const canEdit = state.session && post.owner_id === state.session.user.id;
  return `
    <div class="reader-cover">${renderCover(post)}</div>
    <div class="reader-body">
      <div class="post-meta">${escapeHtml(post.category || "기타")} · ${formatDate(post.created_at)} · ${escapeHtml(post.author_name || "공개 작성자")}</div>
      <h2 class="reader-title">${escapeHtml(post.title)}</h2>
      <div class="tag-list">${(post.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>
      ${
        canEdit
          ? `
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
          `
          : isMine
            ? `<p class="status-line">내 계정의 글만 수정할 수 있습니다.</p>`
            : ""
      }
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

function renderProfileDialog() {
  return `
    <dialog class="modal" id="profileDialog">
      <form id="profileForm" class="modal-body">
        <div class="modal-head">
          <div>
            <p class="eyebrow">My Blog</p>
            <h2>블로그 설정</h2>
          </div>
          <button class="icon-button" type="button" data-close-dialog="profileDialog" aria-label="닫기" title="닫기">
            <i data-lucide="x"></i>
          </button>
        </div>
        <label class="field">
          <span>블로그 이름</span>
          <input id="profileBlogTitle" value="${escapeAttr(getMyBlogTitle())}" />
        </label>
        <label class="field">
          <span>작성자 이름</span>
          <input id="profileDisplayName" value="${escapeAttr(getDisplayName())}" />
        </label>
        <div class="modal-actions">
          <button class="primary-button" type="submit">저장</button>
        </div>
      </form>
    </dialog>
  `;
}

function bindListEvents() {
  $("#sidebarToggle")?.addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem(SIDEBAR_STORAGE, String(state.sidebarCollapsed));
    renderBlogList();
    updateIcons();
  });

  $("#searchInput")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderBlogList();
    $("#searchInput")?.focus();
    updateIcons();
  });

  $("#refreshButton")?.addEventListener("click", loadPosts);

  $("#homeLoginButton")?.addEventListener("click", openAuth);

  $("#editProfileButton")?.addEventListener("click", () => {
    $("#profileDialog")?.showModal();
    updateIcons();
  });

  $("#profileForm")?.addEventListener("submit", saveProfile);
  $("#addCategoryButton")?.addEventListener("click", addCategory);
  $("#addRootFolderButton")?.addEventListener("click", () => addFolder(null));

  $$("[data-add-child-folder]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      addFolder(button.dataset.addChildFolder);
    });
  });

  $$("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      state.selectedId = null;
      renderBlogList();
      updateIcons();
    });
  });

  $$("[data-folder-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFolderId = button.dataset.folderId;
      renderBlogList();
      updateIcons();
    });
  });

  $$("[data-post-id]").forEach((card) => {
    const select = () => {
      navigateToPost(card.dataset.postId);
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

function bindPostViewEvents() {
  $$("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => openEditor(button.dataset.editId));
  });

  $$("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deletePost(button.dataset.deleteId));
  });
}

function navigateToPost(postId) {
  const route = `${ROUTES.postPrefix}${encodeURIComponent(postId)}`;
  if (window.location.hash !== route) {
    window.location.hash = route;
    return;
  }
  state.selectedId = postId;
  applyView("post", { keepSelected: true });
}

async function addCategory() {
  const name = prompt("추가할 카테고리 이름");
  const normalized = (name || "").trim();
  if (!normalized || !state.session) {
    return;
  }

  const category = {
    id: crypto.randomUUID(),
    owner_id: state.session.user.id,
    name: normalized
  };

  try {
    const saved = await persistTaxonomy(CATEGORY_TABLE, category);
    state.categories = normalizeCategories([...state.categories.filter((item) => item.name !== saved.name), saved]);
    cacheTaxonomy(CATEGORIES_STORAGE, state.categories);
    renderBlogList();
  } catch (error) {
    toast(`카테고리 추가 실패: ${error.message}`);
  }
}

async function addFolder(parentId) {
  const name = prompt(parentId ? "추가할 하위 폴더 이름" : "추가할 폴더 이름");
  const normalized = (name || "").trim();
  if (!normalized || !state.session) {
    return;
  }

  const folder = {
    id: crypto.randomUUID(),
    owner_id: state.session.user.id,
    parent_id: parentId || null,
    name: normalized,
    sort_order: state.folders.length
  };

  try {
    const saved = await persistTaxonomy(FOLDER_TABLE, folder);
    state.folders = normalizeFolders([...state.folders, saved]);
    cacheTaxonomy(FOLDERS_STORAGE, state.folders);
    renderBlogList();
  } catch (error) {
    toast(`폴더 추가 실패: ${error.message}`);
  }
}

async function persistTaxonomy(table, item) {
  if (state.supabase && state.session) {
    const { data, error } = await state.supabase.from(table).insert(item).select().single();
    if (error) {
      throw error;
    }
    return data;
  }
  return item;
}

function openEditor(postId = null, { keepRoute = false } = {}) {
  if (!state.session && state.supabase) {
    openAuth();
    toast("로그인하면 계정별 블로그에 글을 쓸 수 있습니다.");
    return;
  }

  if (!keepRoute && window.location.hash !== ROUTES.editor) {
    window.location.hash = ROUTES.editor;
    return;
  }

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
          <input id="editorCategory" list="categoryOptions" value="${escapeAttr(post.category || "일상")}" />
          <datalist id="categoryOptions">
            ${getCategories(state.posts).filter((category) => category !== "전체").map((category) => `<option value="${escapeAttr(category)}"></option>`).join("")}
          </datalist>
        </label>
        <label class="meta-field">
          <span>폴더</span>
          <select id="editorFolder">
            <option value="">폴더 없음</option>
            ${renderFolderOptions(post.folder_id || "")}
          </select>
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
        <p class="status-line" id="editorStatus">${state.session ? `${getMyBlogTitle()}에 저장` : "로컬 자동 임시저장"}</p>
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

  ["editorTitle", "editorCategory", "editorFolder", "editorTags", "editorCover", "editorPublished"].forEach((id) => {
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
    state.editingId = null;
    state.editorInitial = null;
    navigateTo(state.session ? "myblog" : "home");
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
    owner_id: state.session?.user?.id || base.owner_id || null,
    author_name: getDisplayName(),
    title: title || "제목 없음",
    slug: base.slug || makeSlug(title || "untitled"),
    excerpt: makeExcerpt(content),
    category: $("#editorCategory").value.trim() || "일상",
    folder_id: $("#editorFolder").value || null,
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
    <div class="post-meta">${escapeHtml(post.category)} · ${formatDate(post.updated_at)} · ${escapeHtml(post.author_name)}</div>
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
    state.editingId = null;
    state.editorInitial = null;
    await loadPosts();
    state.selectedId = saved.id;
    navigateTo(state.session ? "myblog" : "home");
  } catch (error) {
    toast(error.message);
  }
}

async function persistPost(post) {
  if (state.supabase && state.session) {
    const payload = {
      ...post,
      id: isUuid(post.id) ? post.id : crypto.randomUUID(),
      owner_id: state.session.user.id,
      author_name: getDisplayName()
    };
    const { data, error } = await state.supabase.from(TABLE_NAME).upsert(payload, { onConflict: "id" }).select().single();
    if (error) {
      throw error;
    }
    toast("내 블로그에 발행했습니다.");
    return normalizePost(data);
  }

  const saved = { ...post, id: post.id || crypto.randomUUID(), author_name: "로컬 작성자" };
  const next = [saved, ...state.posts.filter((item) => item.id !== saved.id)].sort(sortByDate);
  state.posts = next;
  cacheLocalPosts(next);
  toast("로컬에 저장했습니다. Supabase 로그인 후에는 계정별 블로그에 저장됩니다.");
  return saved;
}

async function deletePost(id) {
  if (!confirm("이 글을 삭제할까요?")) {
    return;
  }

  if (state.supabase && state.session && isUuid(id)) {
    const { error } = await state.supabase.from(TABLE_NAME).delete().eq("id", id).eq("owner_id", state.session.user.id);
    if (error) {
      toast(error.message);
      return;
    }
    toast("내 블로그에서 삭제했습니다.");
  } else {
    state.posts = state.posts.filter((post) => post.id !== id);
    cacheLocalPosts(state.posts);
    toast("로컬 글을 삭제했습니다.");
  }

  state.selectedId = null;
  await loadPosts();
}

async function saveProfile(event) {
  event.preventDefault();
  if (!state.session) {
    openAuth();
    return;
  }

  const profile = {
    id: state.session.user.id,
    blog_title: $("#profileBlogTitle").value.trim() || "나의 하늘색 블로그",
    display_name: $("#profileDisplayName").value.trim() || getUserIdentifier(state.session.user) || "작성자",
    bio: state.profile?.bio || ""
  };

  if (state.supabase) {
    try {
      state.profile = await persistProfile(profile);
    } catch (error) {
      toast(`블로그 이름 저장 실패: ${error.message}`);
      return;
    }
  } else {
    state.profile = profile;
  }

  $("#profileDialog")?.close();
  toast("블로그 설정을 저장했습니다.");
  render();
}

async function persistProfile(profile) {
  if (!state.supabase || !state.session) {
    return profile;
  }

  const userId = state.session.user.id;
  const payload = {
    ...profile,
    id: userId
  };

  const updated = await state.supabase
    .from(PROFILE_TABLE)
    .update({
      blog_title: payload.blog_title,
      display_name: payload.display_name,
      bio: payload.bio
    })
    .eq("id", userId)
    .select()
    .maybeSingle();

  if (updated.error) {
    throw updated.error;
  }

  if (updated.data) {
    return updated.data;
  }

  const created = await state.supabase
    .from(PROFILE_TABLE)
    .insert(payload)
    .select()
    .single();

  if (created.error) {
    throw created.error;
  }

  return created.data;
}

function openAuth() {
  if (!state.supabase) {
    $("#settingsDialog").showModal();
    toast("Supabase anon key를 먼저 저장하세요.");
    return;
  }
  if (!state.session) {
    state.authMode = "login";
    $("#signOutButton").hidden = true;
  }
  renderAuthDialog();
  $("#authDialog").showModal();
  updateIcons();
}

async function submitAuthForm(event) {
  event.preventDefault();
  if (state.session) {
    return;
  }
  if (state.authMode === "signup") {
    await signUpWithPassword();
  } else {
    await signInWithPassword();
  }
}

async function signInWithPassword() {
  if (!state.supabase) {
    toast("Supabase 연결이 필요합니다.");
    return;
  }
  const identifier = normalizeIdentifier($("#authIdentifier").value);
  const password = $("#authPassword").value;
  if (!identifier) {
    toast("아이디를 입력하세요.");
    return;
  }
  const email = identifierToEmail(identifier);
  const { error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) {
    toast(error.message);
    return;
  }
  $("#authDialog").close();
  toast("로그인했습니다. 내 블로그를 준비했습니다.");
}

async function signUpWithPassword() {
  if (!state.supabase) {
    toast("Supabase 연결이 필요합니다.");
    return;
  }
  const identifier = normalizeIdentifier($("#authIdentifier").value);
  const password = $("#authPassword").value;
  if (!identifier) {
    toast("아이디를 입력하세요.");
    return;
  }
  if (password.length < 6) {
    toast("비밀번호는 최소 6자 이상이어야 합니다.");
    return;
  }
  const email = identifierToEmail(identifier);
  const { data, error } = await state.supabase.auth.signUp({ email, password });
  if (error) {
    toast(error.message);
    return;
  }
  $("#authDialog").close();
  if (data.session) {
    toast("회원가입이 완료되었습니다. 내 블로그를 준비했습니다.");
  } else {
    toast("회원가입이 접수되었습니다. Supabase 가입 확인 설정이 켜져 있으면 로그인 전 비활성화가 필요합니다.");
  }
}

async function signOut() {
  if (!state.supabase) {
    return;
  }
  await state.supabase.auth.signOut();
  state.profile = null;
  navigateTo("home", { replace: true });
  $("#authDialog").close();
  toast("로그아웃했습니다.");
}

function renderAuthDialog() {
  const identifier = getUserIdentifier(state.session?.user);
  const loggedIn = Boolean(state.session);
  $("#authTitle").textContent = loggedIn ? "계정" : state.authMode === "signup" ? "회원가입" : "작성자 로그인";
  $("#authState").textContent = loggedIn ? `${identifier} 로그인됨` : state.authMode === "signup" ? "아이디로 새 계정을 만들고 내 블로그를 시작하세요." : "아이디로 로그인하면 내 블로그를 관리할 수 있습니다.";
  $("#authIdentifier").value = identifier;
  $("#authPassword").value = "";
  $("#authIdentifier").closest(".field").hidden = loggedIn;
  $("#authPassword").closest(".field").hidden = loggedIn;
  $("#authTabs").hidden = loggedIn;
  $("#authSubmitButton").hidden = loggedIn;
  $("#signOutButton").hidden = !loggedIn;
  $$("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === state.authMode);
  });
  $("#authPassword").autocomplete = state.authMode === "signup" ? "new-password" : "current-password";
  $("#authSubmitButton").textContent = state.authMode === "signup" ? "회원가입" : "로그인";
}

function updateConnectionStatus() {
  const authButton = $("#authButton");
  const myBlogNav = $("#myBlogNav");
  if (!authButton) {
    return;
  }

  if (myBlogNav) {
    myBlogNav.hidden = !state.session;
  }

  authButton.textContent = state.session ? "계정" : "로그인";
}

function updateTopNav() {
  $$(".nav-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === state.view);
  });
}

function getVisiblePosts() {
  const query = state.query.trim().toLowerCase();
  const isMine = state.view === "myblog";
  const userId = state.session?.user?.id;

  return state.posts.filter((post) => {
    const ownerMatch = isMine ? post.owner_id === userId : post.published === true && Boolean(post.owner_id);
    const categoryMatch = state.category === "전체" || (post.category || "기타") === state.category;
    const folderMatch = isFolderMatch(post);
    const haystack = `${post.title} ${post.excerpt || ""} ${(post.tags || []).join(" ")} ${post.author_name || ""} ${htmlToText(post.content)}`.toLowerCase();
    return ownerMatch && categoryMatch && folderMatch && (!query || haystack.includes(query));
  });
}

function getCategories(posts) {
  const scopeCategories = state.categories
    .filter((category) => !category.owner_id || category.owner_id === state.session?.user?.id)
    .map((category) => category.name);
  return ["전체", ...new Set([...scopeCategories, ...posts.map((post) => post.category || "기타")])];
}

function isFolderMatch(post) {
  if (state.activeFolderId === "all") {
    return true;
  }
  const folderIds = [state.activeFolderId, ...getFolderDescendantIds(state.activeFolderId)];
  return folderIds.includes(post.folder_id);
}

function getPostsForCurrentScope() {
  const isMine = state.view === "myblog";
  const userId = state.session?.user?.id;
  return state.posts.filter((post) => (isMine ? post.owner_id === userId : post.published === true && Boolean(post.owner_id)));
}

function getVisibleFolders() {
  const ownerIds = new Set(getPostsForCurrentScope().map((post) => post.owner_id).filter(Boolean));
  if (state.view === "myblog") {
    return getMyFolders();
  }
  return state.folders.filter((folder) => ownerIds.has(folder.owner_id));
}

function getMyFolders() {
  return state.folders.filter((folder) => !folder.owner_id || folder.owner_id === state.session?.user?.id);
}

function buildFolderTree(folders) {
  const map = new Map(folders.map((folder) => [folder.id, { ...folder, children: [] }]));
  map.forEach((folder) => {
    if (folder.parent_id && map.has(folder.parent_id)) {
      map.get(folder.parent_id).children.push(folder);
    }
  });
  return Array.from(map.values());
}

function getFolderDescendantIds(folderId) {
  const children = state.folders.filter((folder) => folder.parent_id === folderId);
  return children.flatMap((child) => [child.id, ...getFolderDescendantIds(child.id)]);
}

function getMyBlogTitle() {
  return state.profile?.blog_title || `${getDisplayName()}의 하늘색 블로그`;
}

function getDisplayName() {
  return state.profile?.display_name || getUserIdentifier(state.session?.user) || "작성자";
}

function normalizeIdentifier(value) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function identifierToEmail(identifier) {
  return `${normalizeIdentifier(identifier)}@${AUTH_EMAIL_DOMAIN}`;
}

function emailToIdentifier(email) {
  const value = email || "";
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value.split("@")[0];
}

function getUserIdentifier(user) {
  return emailToIdentifier(user?.email || "");
}

function getSupabaseKey() {
  return localStorage.getItem(SUPABASE_KEY_STORAGE) || CONFIG.supabaseAnonKey || "";
}

function getLocalPosts() {
  try {
    const saved = JSON.parse(localStorage.getItem(POSTS_STORAGE) || "[]");
    return saved.length ? normalizePosts(saved) : [];
  } catch {
    return [];
  }
}

function cacheLocalPosts(posts) {
  localStorage.setItem(POSTS_STORAGE, JSON.stringify(posts));
}

function getStoredTaxonomy(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function cacheTaxonomy(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
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
    owner_id: state.session?.user?.id || null,
    folder_id: state.activeFolderId !== "all" ? state.activeFolderId : null,
    author_name: getDisplayName(),
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

function normalizeCategories(categories = []) {
  return categories
    .map((category) => ({
      id: category.id,
      owner_id: category.owner_id || null,
      name: category.name || "기타",
      created_at: category.created_at || new Date().toISOString()
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function normalizeFolders(folders = []) {
  return folders.map((folder) => ({
    id: folder.id,
    owner_id: folder.owner_id || null,
    parent_id: folder.parent_id || null,
    name: folder.name || "새 폴더",
    sort_order: Number(folder.sort_order || 0),
    created_at: folder.created_at || new Date().toISOString()
  }));
}

function normalizePost(post) {
  return {
    id: post.id,
    owner_id: post.owner_id || null,
    folder_id: post.folder_id || null,
    author_name: post.author_name || "공개 작성자",
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
  const base = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return `${base || "post"}-${Date.now().toString(36)}`;
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
