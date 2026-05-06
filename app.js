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
const CUSTOM_FONTS_STORAGE = "skyblog.customFonts.v1";
const SIDEBAR_STORAGE = "skyblog.sidebarCollapsed";
const TAXONOMY_OPEN_STORAGE = "skyblog.taxonomyOpen.v1";
const ALL_CATEGORY_LABEL = "\uC804\uCCB4";
const DEFAULT_CATEGORY_LABEL = "\uAE30\uD0C0";
const ETC_CATEGORY_LABEL = "\uAE30\uD0C0";
const ROUTES = {
  home: "#home",
  myblog: "#blog/me",
  trash: "#trash",
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
  pendingEditorPostId: null,
  pendingEditorUseDraft: false,
  authMode: "login",
  supabase: null,
  session: null,
  profile: null,
  categories: [],
  folders: [],
  supabaseError: null,
  sidebarCollapsed: localStorage.getItem(SIDEBAR_STORAGE) === "true",
  taxonomyOpen: getStoredOpenState(),
  trashOpen: false,
  selectionMode: false,
  selectedPostIds: new Set(),
  bookReader: false,
  loading: true
};
let savedEditorRange = null;

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
  $("#brandLink")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const targetView = state.session && (state.view === "myblog" || state.view === "editor" || isOwnSelectedPost()) ? "myblog" : "home";
    if (state.view === targetView) {
      await loadPosts();
      return;
    }
    navigateTo(targetView);
  });

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
  app.classList.toggle("is-editor-view", state.view === "editor");
  document.body.classList.toggle("is-editor-view", state.view === "editor");
  updateBrandTitle();
  updateTopNav();
  updateConnectionStatus();
  if (state.view === "editor") {
    renderEditor();
  } else if (state.view === "post") {
    renderPostView();
  } else if (state.view === "trash") {
    renderTrashPage();
  } else {
    renderBlogList();
  }
  updateIcons();
}

function updateBrandTitle() {
  const brandTitle = $("#brandTitle");
  if (!brandTitle) {
    return;
  }

  const selectedPost = state.posts.find((post) => post.id === state.selectedId);
  const isOwnPostView = state.view === "post" && selectedPost?.owner_id === state.session?.user?.id;
  const title = state.session && (state.view === "myblog" || state.view === "editor" || state.view === "trash" || isOwnPostView)
    ? getMyBlogTitle()
    : CONFIG.blogTitle || "Blog";
  brandTitle.textContent = title;
  document.title = title;
}

function isOwnSelectedPost() {
  const selectedPost = state.posts.find((post) => post.id === state.selectedId);
  return Boolean(selectedPost && state.session && selectedPost.owner_id === state.session.user.id);
}

function navigateTo(view, { replace = false } = {}) {
  if ((view === "myblog" || view === "editor" || view === "trash") && !state.session) {
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
  if ((view === "myblog" || view === "editor" || view === "trash") && !state.session) {
    window.history.replaceState(null, "", ROUTES.home);
    applyView("home");
    return;
  }

  if (view === "editor") {
    openEditor(state.pendingEditorPostId || null, {
      keepRoute: true,
      useDraft: state.pendingEditorUseDraft
    });
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
  if (window.location.hash === ROUTES.trash) {
    return "trash";
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
  state.pendingEditorPostId = null;
  state.pendingEditorUseDraft = false;
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
  const sidebarPosts = getPostsForCurrentScope();
  const categories = getCategories(sidebarPosts);
  const visibleFolders = getVisibleFolders();
  const sidebarFolders = getSidebarFolders();

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
            ${categories.map((category) => renderCategory(category, sidebarPosts, sidebarFolders, isMine)).join("")}
          </div>
          ${isMine ? renderTrashSection() : ""}
        </div>
      </aside>

      <section class="feed-panel">
        <div class="section-head">
          <div>
            <h2>${countLabel}</h2>
            <p id="visiblePostCount">${state.selectionMode ? `${state.selectedPostIds.size}개 선택됨` : `${visiblePosts.length}개의 글`}</p>
          </div>
          <div class="list-actions">
            <input class="sr-only" id="importPostsInput" type="file" accept=".txt,.docx,.zip,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip" multiple />
            ${isMine ? `
              <button class="outline-button compact-action" type="button" id="importPostsButton">
                <i data-lucide="upload"></i>
                불러오기
              </button>
              <select class="export-format-select" id="exportFormat" aria-label="내보내기 형식" title="내보내기 형식">
                <option value="txt">TXT</option>
                <option value="docx">DOCX</option>
              </select>
              <button class="outline-button compact-action ${state.selectionMode ? "is-active" : ""}" type="button" id="selectionModeButton">
                <i data-lucide="list-checks"></i>
                선택
              </button>
              <button class="outline-button compact-action" type="button" id="exportSelectedButton" ${state.selectedPostIds.size ? "" : "disabled"}>
                <i data-lucide="download"></i>
                내보내기
              </button>
            ` : ""}
            <button class="icon-button" type="button" id="refreshButton" aria-label="새로고침" title="새로고침">
              <i data-lucide="refresh-cw"></i>
            </button>
          </div>
        </div>
        <div class="post-list">
          ${
            renderFeedPosts(visiblePosts, visibleFolders, isMine)
          }
        </div>
      </section>
    </section>

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
        <button class="outline-button viewer-compact-button" type="button" data-nav="${backView}">
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

function updatePostList() {
  const list = $(".post-list");
  const count = $("#visiblePostCount");
  if (!list) {
    return;
  }
  const visiblePosts = getVisiblePosts();
  const visibleFolders = getVisibleFolders();
  list.innerHTML = renderFeedPosts(visiblePosts, visibleFolders, state.view === "myblog");
  if (count) {
    count.textContent = state.selectionMode ? `${state.selectedPostIds.size}개 선택됨` : `${visiblePosts.length}개의 글`;
  }
  const exportButton = $("#exportSelectedButton");
  if (exportButton) {
    exportButton.disabled = state.selectedPostIds.size === 0;
  }
  bindDynamicListEvents();
  updateIcons();
}

function renderFeedPosts(posts, folders, isMine) {
  if (state.loading) {
    return `<div class="empty-state">불러오는 중...</div>`;
  }
  if (!posts.length && !folders.length) {
    return renderEmptyState(isMine);
  }
  if (state.activeFolderId !== "all") {
    const selectedFolder = findFolderInTree(buildFolderTree(folders), state.activeFolderId);
    return selectedFolder
      ? renderFeedFolder(selectedFolder, posts, 0, isMine)
      : posts.map((post) => renderPostCard(post, false, isMine)).join("");
  }

  const categories = [...new Set([
    ...posts.map((post) => post.category || getFallbackCategoryName()),
    ...folders.map((folder) => getFolderCategoryName(folder))
  ].filter((category) => category && category !== DEFAULT_CATEGORY_LABEL))];
  return categories.map((category) => renderFeedCategory(category, posts, folders, isMine)).join("");
}

function renderFeedCategory(category, posts, folders, canManagePosts) {
  const categoryPosts = posts.filter((post) => (post.category || getFallbackCategoryName()) === category);
  const categoryFolders = getFoldersForCategory(folders, category);
  const folderPostIds = new Set(categoryFolders.flatMap((folder) => [folder.id, ...getFolderDescendantIds(folder.id)]));
  const rootFolders = buildFolderTree(categoryFolders).filter((folder) => !folder.parent_id);
  const directPosts = categoryPosts.filter((post) => !folderPostIds.has(post.folder_id));
  const openKey = `feedCategory:${category}`;
  const isOpen = state.taxonomyOpen[openKey] !== false;

  return `
    <section class="feed-group">
      <button class="feed-group-head ${state.category === category ? "is-active" : ""}" type="button" data-feed-category="${escapeAttr(category)}">
        <span><i data-lucide="${isOpen ? "chevron-down" : "chevron-right"}"></i>${escapeHtml(category)}</span>
        <strong>${categoryPosts.length}</strong>
      </button>
      ${isOpen ? `
        <div class="feed-group-body">
          ${rootFolders.map((folder) => renderFeedFolder(folder, categoryPosts, 0, canManagePosts)).join("")}
          ${directPosts.map((post) => renderPostCard(post, false, canManagePosts)).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderFeedFolder(folder, posts, depth, canManagePosts) {
  const descendants = getFolderDescendantIds(folder.id);
  const folderIds = [folder.id, ...descendants];
  const folderPosts = posts.filter((post) => folderIds.includes(post.folder_id));
  const ownPosts = posts.filter((post) => post.folder_id === folder.id);
  const hasChildren = folder.children.length > 0;
  const openKey = `feedFolder:${folder.id}`;
  const isOpen = state.taxonomyOpen[openKey] !== false;

  return `
    <div class="feed-folder" style="--depth: ${depth}">
      <button class="feed-folder-head ${state.activeFolderId === folder.id ? "is-active" : ""}" type="button" data-feed-folder="${escapeAttr(folder.id)}">
        <span><i data-lucide="${isOpen ? "chevron-down" : "chevron-right"}"></i>${escapeHtml(folder.name)}</span>
        <strong>${folderPosts.length}</strong>
      </button>
      ${isOpen ? `
        <div class="feed-folder-body">
          ${hasChildren ? folder.children.map((child) => renderFeedFolder(child, posts, depth + 1, canManagePosts)).join("") : ""}
          ${ownPosts.map((post) => renderPostCard(post, false, canManagePosts)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderTrashSection() {
  const trashItems = getTrashItems();
  return `
    <div class="trash-section">
      <button class="trash-toggle ${state.view === "trash" ? "is-active" : ""}" type="button" data-nav="trash">
        <span><i data-lucide="trash-2"></i>휴지통</span>
        <strong>${trashItems.length}</strong>
      </button>
      ${trashItems.length ? `
        <div class="taxonomy-actions trash-actions">
          <button class="icon-button mini-button danger-button" type="button" id="emptyTrashButton" aria-label="휴지통 비우기" title="휴지통 비우기"><i data-lucide="trash"></i></button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderTrashPage() {
  const trashItems = getTrashItems();
  app.innerHTML = `
    <section class="trash-page-shell">
      <div class="section-head">
        <div>
          <h2>휴지통</h2>
          <p>${trashItems.length}개의 항목</p>
        </div>
        <div class="list-actions">
          <button class="outline-button compact-action" type="button" data-nav="myblog">
            <i data-lucide="arrow-left"></i>
            돌아가기
          </button>
          <button class="outline-button compact-action danger-button" type="button" id="emptyTrashButton" ${trashItems.length ? "" : "disabled"}>
            <i data-lucide="trash"></i>
            비우기
          </button>
        </div>
      </div>
      <div class="trash-page-list">
        ${trashItems.length ? trashItems.map(renderTrashItem).join("") : `<div class="empty-state">휴지통이 비어 있습니다.</div>`}
      </div>
    </section>
  `;

  bindStaticListEvents();
}

function renderTrashItem(item) {
  return `
    <div class="trash-item">
      <span>${escapeHtml(item.label)} <small>${escapeHtml(item.typeLabel)}</small></span>
      <div class="taxonomy-actions">
        <button class="icon-button mini-button" type="button" data-restore-type="${item.type}" data-restore-id="${escapeAttr(item.id)}" aria-label="복원" title="복원"><i data-lucide="rotate-ccw"></i></button>
      </div>
    </div>
  `;
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

function renderCategoryOptions(selectedCategory) {
  const categories = getCategories(state.posts).filter((category) => category !== ALL_CATEGORY_LABEL);
  return categories.length
    ? categories.map((category) => `<option value="${escapeAttr(category)}" ${category === selectedCategory ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")
    : `<option value="">카테고리 없음</option>`;
}

function renderFolderOption(folder, selectedId, depth) {
  const prefix = depth ? `${"--".repeat(depth)} ` : "";
  return `
    <option value="${escapeAttr(folder.id)}" ${folder.id === selectedId ? "selected" : ""}>${escapeHtml(prefix + folder.name)}</option>
    ${folder.children.map((child) => renderFolderOption(child, selectedId, depth + 1)).join("")}
  `;
}

function renderFontOptions() {
  const baseFonts = [
    { label: "맑은 고딕", value: "'Malgun Gothic', sans-serif" },
    { label: "Carlito", value: "Carlito, 'Noto Sans KR', sans-serif" },
    { label: "Noto Sans", value: "'Noto Sans KR', sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Times", value: "'Times New Roman', serif" },
    { label: "Courier", value: "'Courier New', monospace" }
  ];
  const customFonts = getCustomFonts().map((font) => ({
    label: font,
    value: quoteFontFamily(font)
  }));

  return [...baseFonts, ...customFonts]
    .map((font, index) => `<option value="${escapeAttr(font.value)}" ${index === 0 ? "selected" : ""}>${escapeHtml(font.label)}</option>`)
    .join("");
}

function renderColorPalette(type) {
  const colorLabel = type === "text" ? "글자색" : "글씨 배경색";
  const noneLabel = type === "text" ? "자동 색상(N)" : "채우기 없음(N)";
  const themeColumns = [
    ["#ffffff", "#f2f2f2", "#d9d9d9", "#bfbfbf", "#a6a6a6", "#808080"],
    ["#000000", "#404040", "#595959", "#737373", "#8c8c8c", "#0d0d0d"],
    ["#f8fafc", "#e5e7eb", "#d1d5db", "#9ca3af", "#6b7280", "#374151"],
    ["#111827", "#1f2937", "#374151", "#4b5563", "#6b7280", "#030712"],
    ["#0f5d78", "#c8eff9", "#90ddf0", "#45bfe3", "#087fa7", "#07536c"],
    ["#ed6c2f", "#fde2d1", "#fac4a4", "#f59a68", "#c44a0b", "#843000"],
    ["#166b2d", "#d2f6dc", "#97e9aa", "#3dd963", "#07531d", "#053512"],
    ["#16a7d6", "#c9eff9", "#8fdef1", "#45c4e5", "#087fa7", "#07506a"],
    ["#a62aa0", "#f3c8ef", "#e58edf", "#d14aca", "#7a116f", "#4e0a47"],
    ["#47a525", "#d8f4cd", "#b3e892", "#7fd55d", "#2c7117", "#1f4d10"]
  ];
  const standardColors = ["#d70000", "#ff0000", "#ffc000", "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0"];
  const dataName = type === "text" ? "data-text-color" : "data-bg-color";

  return `
    <div class="office-color-section office-color-toggle">
      <span>고대비 전용(H)</span>
      <span class="office-switch" aria-hidden="true"><span></span>끔</span>
    </div>
    <div class="office-color-section">
      <strong>테마 색</strong>
      <div class="theme-color-grid" aria-label="${colorLabel} 테마 색">
        ${themeColumns.map((column) => `
          <div class="theme-color-column">
            ${column.map((color) => `
              <button class="office-color-swatch" type="button" ${dataName}="${color}" style="--swatch: ${color}" aria-label="${colorLabel} ${color}" title="${colorLabel} ${color}"></button>
            `).join("")}
          </div>
        `).join("")}
      </div>
    </div>
    <div class="office-color-section">
      <strong>표준 색</strong>
      <div class="standard-color-grid" aria-label="${colorLabel} 표준 색">
        ${standardColors.map((color) => `
          <button class="office-color-swatch" type="button" ${dataName}="${color}" style="--swatch: ${color}" aria-label="${colorLabel} ${color}" title="${colorLabel} ${color}"></button>
        `).join("")}
      </div>
    </div>
    <button class="office-color-command" type="button" ${dataName}="${type === "text" ? "#111827" : "transparent"}">
      <span class="empty-color-box"></span>
      ${noneLabel}
    </button>
    <button class="office-color-command" type="button" data-open-native-color="${type}">
      <i data-lucide="palette"></i>
      다른 색(M)...
    </button>
  `;
}

function renderCategory(category, posts, folders, canManage) {
  const isAll = category === ALL_CATEGORY_LABEL;
  const count = isAll ? posts.length : posts.filter((post) => (post.category || getFallbackCategoryName()) === category).length;
  const categoryFolders = isAll ? [] : getFoldersForCategory(folders, category);
  const openKey = `category:${category}`;
  const isOpen = state.taxonomyOpen[openKey] !== false;

  return `
    <div class="category-group">
      <div class="category-row">
        ${isAll ? `<span class="tree-spacer"></span>` : `
          <button class="icon-button mini-button tree-toggle" type="button" data-category-toggle="${escapeAttr(category)}" aria-label="${isOpen ? "\uCE74\uD14C\uACE0\uB9AC \uC811\uAE30" : "\uCE74\uD14C\uACE0\uB9AC \uD3BC\uCE58\uAE30"}" title="${isOpen ? "\uCE74\uD14C\uACE0\uB9AC \uC811\uAE30" : "\uCE74\uD14C\uACE0\uB9AC \uD3BC\uCE58\uAE30"}">
            <i data-lucide="${isOpen ? "chevron-down" : "chevron-right"}"></i>
          </button>
        `}
        <button class="category-chip ${state.category === category ? "is-active" : ""}" type="button" data-category="${escapeAttr(category)}">
          <span>${escapeHtml(category)}</span>
          <strong>${count}</strong>
        </button>
        ${canManage && !isAll ? `
          <div class="taxonomy-actions">
            <button class="icon-button mini-button" type="button" data-add-category-folder="${escapeAttr(category)}" aria-label="\uD3F4\uB354 \uCD94\uAC00" title="\uD3F4\uB354 \uCD94\uAC00"><i data-lucide="folder-plus"></i></button>
            <button class="icon-button mini-button" type="button" data-edit-category="${escapeAttr(category)}" aria-label="\uCE74\uD14C\uACE0\uB9AC \uC774\uB984 \uBCC0\uACBD" title="\uCE74\uD14C\uACE0\uB9AC \uC774\uB984 \uBCC0\uACBD"><i data-lucide="pencil"></i></button>
            <button class="icon-button mini-button danger-button" type="button" data-delete-category="${escapeAttr(category)}" aria-label="\uCE74\uD14C\uACE0\uB9AC \uC0AD\uC81C" title="\uCE74\uD14C\uACE0\uB9AC \uC0AD\uC81C"><i data-lucide="trash-2"></i></button>
          </div>
        ` : `<span class="tree-spacer"></span>`}
      </div>
      ${!isAll && isOpen ? `<div class="category-folders">${renderFolderTree(categoryFolders, canManage, category)}</div>` : ""}
    </div>
  `;
}

function renderFolderTree(folders, canManage, category) {
  const tree = buildFolderTree(folders).filter((folder) => !folder.parent_id);
  return tree.length
    ? tree.map((folder) => renderFolderNode(folder, canManage, 0)).join("")
    : `<p class="folder-empty">${escapeHtml(category)} \uD3F4\uB354\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>`;
}

function renderFolderNode(folder, canManage, depth) {
  const descendants = getFolderDescendantIds(folder.id);
  const count = getPostsForCurrentScope().filter((post) => post.folder_id === folder.id || descendants.includes(post.folder_id)).length;
  const hasChildren = folder.children.length > 0;
  const isOpen = state.taxonomyOpen[`folder:${folder.id}`] !== false;

  return `
    <div class="folder-branch" style="--depth: ${depth}">
      ${hasChildren ? `
        <button class="icon-button mini-button tree-toggle" type="button" data-folder-toggle="${escapeAttr(folder.id)}" aria-label="${isOpen ? "\uD3F4\uB354 \uC811\uAE30" : "\uD3F4\uB354 \uD3BC\uCE58\uAE30"}" title="${isOpen ? "\uD3F4\uB354 \uC811\uAE30" : "\uD3F4\uB354 \uD3BC\uCE58\uAE30"}">
          <i data-lucide="${isOpen ? "chevron-down" : "chevron-right"}"></i>
        </button>
      ` : `<span class="tree-spacer"></span>`}
      <button class="folder-node ${state.activeFolderId === folder.id ? "is-active" : ""}" type="button" data-folder-id="${escapeAttr(folder.id)}">
        <span><i data-lucide="folder"></i>${escapeHtml(folder.name)}</span>
        <strong>${count}</strong>
      </button>
      ${canManage ? `
        <div class="taxonomy-actions">
          <button class="icon-button mini-button folder-add-child" type="button" data-add-child-folder="${escapeAttr(folder.id)}" aria-label="\uD558\uC704 \uD3F4\uB354 \uCD94\uAC00" title="\uD558\uC704 \uD3F4\uB354 \uCD94\uAC00"><i data-lucide="plus"></i></button>
          <button class="icon-button mini-button" type="button" data-edit-folder="${escapeAttr(folder.id)}" aria-label="\uD3F4\uB354 \uC774\uB984 \uBCC0\uACBD" title="\uD3F4\uB354 \uC774\uB984 \uBCC0\uACBD"><i data-lucide="pencil"></i></button>
          <button class="icon-button mini-button danger-button" type="button" data-delete-folder="${escapeAttr(folder.id)}" aria-label="\uD3F4\uB354 \uC0AD\uC81C" title="\uD3F4\uB354 \uC0AD\uC81C"><i data-lucide="trash-2"></i></button>
        </div>
      ` : ""}
    </div>
    ${hasChildren && isOpen ? folder.children.map((child) => renderFolderNode(child, canManage, depth + 1)).join("") : ""}
  `;
}

function renderFolderOptions(selectedId, categoryName) {
  const selectedFolder = state.folders.find((folder) => folder.id === selectedId);
  const scopedFolders = getFoldersForCategory(getMyFolders(), categoryName || (selectedFolder ? getFolderCategoryName(selectedFolder) : getFallbackCategoryName()));
  const roots = buildFolderTree(scopedFolders).filter((folder) => !folder.parent_id);
  return roots.map((folder) => renderFolderOption(folder, selectedId, 0)).join("");
}

function renderPostCard(post, isActive, canManage = false) {
  const isSelected = state.selectedPostIds.has(post.id);
  return `
    <article class="post-card ${isActive ? "is-active" : ""} ${isSelected ? "is-selected" : ""} ${state.selectionMode ? "is-selectable" : ""}" data-post-id="${escapeAttr(post.id)}" tabindex="0">
      ${state.selectionMode ? `
        <label class="post-select-check" aria-label="글 선택">
          <input type="checkbox" data-select-post="${escapeAttr(post.id)}" ${isSelected ? "checked" : ""} />
          <span></span>
        </label>
      ` : ""}
      <div>
        <div class="post-meta">${escapeHtml(post.category || getFallbackCategoryName())} · ${formatDate(post.created_at)}</div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt || makeExcerpt(post.content))}</p>
        ${canManage ? `
          <div class="post-card-actions">
            <button class="outline-button compact-action" type="button" data-edit-id="${escapeAttr(post.id)}">
              <i data-lucide="square-pen"></i>
              수정
            </button>
            <button class="ghost-button compact-action danger-button" type="button" data-delete-id="${escapeAttr(post.id)}">
              <i data-lucide="trash-2"></i>
              삭제
            </button>
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function renderReader(post, isMine) {
  const canEdit = state.session && post.owner_id === state.session.user.id;
  const readerSequence = getReaderSequence(post);
  const readerIndex = readerSequence.findIndex((item) => item.id === post.id);
  const previousPost = readerIndex > 0 ? readerSequence[readerIndex - 1] : null;
  const nextPost = readerIndex >= 0 && readerIndex < readerSequence.length - 1 ? readerSequence[readerIndex + 1] : null;
  return `
    <div class="reader-body ${state.bookReader ? "is-book-reader" : ""}">
      <div class="post-meta">${escapeHtml(post.category || getFallbackCategoryName())} · ${formatDate(post.created_at)} · ${escapeHtml(post.author_name || "공개 작성자")}</div>
      <h2 class="reader-title">${escapeHtml(post.title)}</h2>
      <div class="tag-list">${(post.tags || []).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="reader-toolbar">
        <button class="outline-button viewer-compact-button ${state.bookReader ? "is-active" : ""}" type="button" id="bookReaderButton">
          <i data-lucide="book-open"></i>
          책 형태로 읽기
        </button>
      </div>
      ${state.bookReader ? `
        <div class="reader-sequence">
          <button class="outline-button viewer-compact-button" type="button" data-reader-nav="${escapeAttr(previousPost?.id || "")}" ${previousPost ? "" : "disabled"}>
            <i data-lucide="chevron-left"></i>
            이전 글
          </button>
          <span>${readerIndex >= 0 ? `${readerIndex + 1} / ${readerSequence.length}` : "1 / 1"}</span>
          <button class="outline-button viewer-compact-button" type="button" data-reader-nav="${escapeAttr(nextPost?.id || "")}" ${nextPost ? "" : "disabled"}>
            다음 글
            <i data-lucide="chevron-right"></i>
          </button>
        </div>
      ` : ""}
      ${
        canEdit
          ? `
            <div class="reader-toolbar">
              <button class="outline-button viewer-compact-button" type="button" data-edit-id="${escapeAttr(post.id)}">
                <i data-lucide="square-pen"></i>
                수정
              </button>
              <button class="ghost-button viewer-compact-button" type="button" data-delete-id="${escapeAttr(post.id)}">
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

function getReaderSequence(post) {
  const category = post.category || getFallbackCategoryName();
  return state.posts
    .filter((item) => {
      if (item.deleted_at || item.owner_id !== post.owner_id) {
        return false;
      }
      if (!item.published && item.owner_id !== state.session?.user?.id) {
        return false;
      }
      const sameCategory = (item.category || getFallbackCategoryName()) === category;
      const sameFolder = (item.folder_id || null) === (post.folder_id || null);
      return sameCategory && sameFolder;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

function renderCover(post) {
  if (post.cover_url) {
    return `<img src="${escapeAttr(post.cover_url)}" alt="${escapeAttr(post.title)} 커버" loading="lazy" />`;
  }
  return `<div class="cover-placeholder"><i data-lucide="image"></i></div>`;
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
    updatePostList();
  });

  $("#refreshButton")?.addEventListener("click", loadPosts);
  $("#selectionModeButton")?.addEventListener("click", () => {
    state.selectionMode = !state.selectionMode;
    if (!state.selectionMode) {
      state.selectedPostIds.clear();
    }
    renderBlogList();
    updateIcons();
  });
  $("#exportSelectedButton")?.addEventListener("click", exportSelectedPosts);
  $("#importPostsButton")?.addEventListener("click", () => $("#importPostsInput")?.click());
  $("#importPostsInput")?.addEventListener("change", importPostFiles);

  $("#homeLoginButton")?.addEventListener("click", openAuth);

  $("#addCategoryButton")?.addEventListener("click", addCategory);

  bindDynamicListEvents();
  bindStaticListEvents();
}

function bindDynamicListEvents() {
  $$("[data-select-post]").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.selectedPostIds.add(checkbox.dataset.selectPost);
      } else {
        state.selectedPostIds.delete(checkbox.dataset.selectPost);
      }
      updatePostList();
    });
  });

  $$("[data-feed-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.feedCategory;
      state.category = category;
      state.activeFolderId = "all";
      state.taxonomyOpen[`feedCategory:${category}`] = state.taxonomyOpen[`feedCategory:${category}`] === false;
      localStorage.setItem(TAXONOMY_OPEN_STORAGE, JSON.stringify(state.taxonomyOpen));
      renderBlogList();
      updateIcons();
    });
  });

  $$("[data-feed-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      const folderId = button.dataset.feedFolder;
      state.activeFolderId = folderId;
      const folder = state.folders.find((item) => item.id === folderId);
      if (folder) {
        state.category = getFolderCategoryName(folder);
      }
      state.taxonomyOpen[`feedFolder:${folderId}`] = state.taxonomyOpen[`feedFolder:${folderId}`] === false;
      localStorage.setItem(TAXONOMY_OPEN_STORAGE, JSON.stringify(state.taxonomyOpen));
      renderBlogList();
      updateIcons();
    });
  });

  $$("[data-post-id]").forEach((card) => {
    const select = () => {
      if (state.selectionMode) {
        const postId = card.dataset.postId;
        if (state.selectedPostIds.has(postId)) {
          state.selectedPostIds.delete(postId);
        } else {
          state.selectedPostIds.add(postId);
        }
        updatePostList();
        return;
      }
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
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openEditor(button.dataset.editId);
    });
  });

  $$("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deletePost(button.dataset.deleteId);
    });
  });
}

function bindStaticListEvents() {

  $$("[data-restore-type]").forEach((button) => {
    button.addEventListener("click", () => restoreTrashItem(button.dataset.restoreType, button.dataset.restoreId));
  });
  $("#emptyTrashButton")?.addEventListener("click", emptyTrash);

  $$("[data-category-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTaxonomy(`category:${button.dataset.categoryToggle}`);
    });
  });

  $$("[data-folder-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTaxonomy(`folder:${button.dataset.folderToggle}`);
    });
  });

  $$("[data-add-category-folder]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      addFolder(null, { categoryName: button.dataset.addCategoryFolder });
    });
  });

  $$("[data-edit-category]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      renameCategory(button.dataset.editCategory);
    });
  });

  $$("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteCategory(button.dataset.deleteCategory);
    });
  });

  $$("[data-add-child-folder]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      addFolder(button.dataset.addChildFolder);
    });
  });

  $$("[data-edit-folder]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      renameFolder(button.dataset.editFolder);
    });
  });

  $$("[data-delete-folder]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteFolder(button.dataset.deleteFolder);
    });
  });

  $$("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      state.activeFolderId = "all";
      state.selectedId = null;
      renderBlogList();
      updateIcons();
    });
  });

  $$("[data-folder-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFolderId = button.dataset.folderId;
      const folder = state.folders.find((item) => item.id === state.activeFolderId);
      if (folder) {
        state.category = getFolderCategoryName(folder);
      }
      renderBlogList();
      updateIcons();
    });
  });

}

function bindPostViewEvents() {
  $("#bookReaderButton")?.addEventListener("click", () => {
    state.bookReader = !state.bookReader;
    renderPostView();
    updateIcons();
  });

  $$("[data-reader-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!button.dataset.readerNav) {
        return;
      }
      state.bookReader = true;
      navigateToPost(button.dataset.readerNav);
    });
  });

  $$("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => openEditor(button.dataset.editId));
  });

  $$("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deletePost(button.dataset.deleteId));
  });
}

function toggleTaxonomy(key) {
  state.taxonomyOpen[key] = state.taxonomyOpen[key] === false;
  localStorage.setItem(TAXONOMY_OPEN_STORAGE, JSON.stringify(state.taxonomyOpen));
  renderBlogList();
  updateIcons();
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

async function addCategory({ silent = false } = {}) {
  const name = prompt("추가할 카테고리 이름");
  const normalized = (name || "").trim();
  if (!normalized || !state.session) {
    return null;
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
    if (!silent) {
      renderBlogList();
    }
    return saved;
  } catch (error) {
    toast(`카테고리 추가 실패: ${error.message}`);
    return null;
  }
}

async function ensureCategoryId(name) {
  const normalized = name && name !== ALL_CATEGORY_LABEL ? name.trim() : getFallbackCategoryName();
  if (!normalized || !state.session) {
    return null;
  }

  const existing = state.categories.find((category) => category.name === normalized && category.owner_id === state.session.user.id);
  if (existing) {
    return existing.id;
  }

  const category = {
    id: crypto.randomUUID(),
    owner_id: state.session.user.id,
    name: normalized
  };
  const saved = await persistTaxonomy(CATEGORY_TABLE, category);
  state.categories = normalizeCategories([...state.categories.filter((item) => item.name !== saved.name), saved]);
  cacheTaxonomy(CATEGORIES_STORAGE, state.categories);
  return saved.id;
}

async function addFolder(parentId, { silent = false, categoryName = null } = {}) {
  const name = prompt(parentId ? "추가할 하위 폴더 이름" : "추가할 폴더 이름");
  const normalized = (name || "").trim();
  if (!normalized || !state.session) {
    return null;
  }

  try {
    const parentCategoryId = getFolderCategoryId(parentId, categoryName);
    const categoryId = parentCategoryId || await ensureCategoryId(categoryName || state.category);
    const folder = {
      id: crypto.randomUUID(),
      owner_id: state.session.user.id,
      parent_id: parentId || null,
      category_id: categoryId,
      name: normalized,
      sort_order: state.folders.length
    };
    const saved = await persistTaxonomy(FOLDER_TABLE, folder);
    state.folders = normalizeFolders([...state.folders, saved]);
    cacheTaxonomy(FOLDERS_STORAGE, state.folders);
    if (!silent) {
      renderBlogList();
    }
    return saved;
  } catch (error) {
    toast(`폴더 추가 실패: ${error.message}`);
    return null;
  }
}

async function renameCategory(categoryName) {
  const category = getCategoryByName(categoryName);
  const nextName = (prompt("변경할 카테고리 이름", categoryName) || "").trim();
  if (!nextName || nextName === categoryName || !state.session) {
    return;
  }

  try {
    if (state.supabase) {
      if (category?.id) {
        const { error } = await state.supabase
          .from(CATEGORY_TABLE)
          .update({ name: nextName })
          .eq("id", category.id)
          .eq("owner_id", state.session.user.id);
        if (error) {
          throw error;
        }
      }
      const postsUpdate = await state.supabase
        .from(TABLE_NAME)
        .update({ category: nextName })
        .eq("owner_id", state.session.user.id)
        .eq("category", categoryName);
      if (postsUpdate.error) {
        throw postsUpdate.error;
      }
    } else {
      state.categories = state.categories.map((item) => item.name === categoryName ? { ...item, name: nextName } : item);
      state.posts = state.posts.map((post) => post.category === categoryName ? { ...post, category: nextName } : post);
      cacheTaxonomy(CATEGORIES_STORAGE, state.categories);
      cacheLocalPosts(state.posts);
    }
    state.category = nextName;
    await loadPosts();
    toast("카테고리 이름을 변경했습니다.");
  } catch (error) {
    toast(`카테고리 이름 변경 실패: ${error.message}`);
  }
}

async function deleteCategory(categoryName) {
  if (!state.session || !confirm(`"${categoryName}" 카테고리를 휴지통으로 이동할까요?`)) {
    return;
  }

  const softCategory = getCategoryByName(categoryName);
  const deletedAt = new Date().toISOString();
  const softCategoryFolders = getFoldersForCategory(getMyFolders(), categoryName);
  const softFolderIds = softCategoryFolders.flatMap((folder) => [folder.id, ...getFolderDescendantIds(folder.id)]);

  try {
    if (state.supabase) {
      if (softCategory?.id) {
        const categoryUpdate = await state.supabase.from(CATEGORY_TABLE).update({ deleted_at: deletedAt }).eq("id", softCategory.id).eq("owner_id", state.session.user.id);
        if (categoryUpdate.error) throw categoryUpdate.error;
      }
      if (softFolderIds.length) {
        const foldersUpdate = await state.supabase.from(FOLDER_TABLE).update({ deleted_at: deletedAt }).eq("owner_id", state.session.user.id).in("id", softFolderIds);
        if (foldersUpdate.error) throw foldersUpdate.error;
      }
      const postsUpdate = await state.supabase.from(TABLE_NAME).update({ deleted_at: deletedAt }).eq("owner_id", state.session.user.id).eq("category", categoryName);
      if (postsUpdate.error) throw postsUpdate.error;
    } else {
      state.categories = state.categories.map((item) => item.name === categoryName ? { ...item, deleted_at: deletedAt } : item);
      state.folders = state.folders.map((folder) => softFolderIds.includes(folder.id) ? { ...folder, deleted_at: deletedAt } : folder);
      state.posts = state.posts.map((post) => post.category === categoryName ? { ...post, deleted_at: deletedAt } : post);
      cacheTaxonomy(CATEGORIES_STORAGE, state.categories);
      cacheTaxonomy(FOLDERS_STORAGE, state.folders);
      cacheLocalPosts(state.posts);
    }
    state.category = ALL_CATEGORY_LABEL;
    state.activeFolderId = "all";
    await loadPosts();
    toast("카테고리를 휴지통으로 이동했습니다.");
  } catch (error) {
    toast(`카테고리 삭제 실패: ${error.message}`);
  }
  return;
  if (!state.session || !confirm(`"${categoryName}" 카테고리를 삭제할까요? 글은 삭제하지 않고 기본 카테고리로 이동합니다.`)) {
    return;
  }

  const category = getCategoryByName(categoryName);
  const categoryFolders = getFoldersForCategory(getMyFolders(), categoryName);
  const folderIds = categoryFolders.flatMap((folder) => [folder.id, ...getFolderDescendantIds(folder.id)]);

  try {
    if (state.supabase) {
      if (folderIds.length) {
        const postFolderUpdate = await state.supabase
          .from(TABLE_NAME)
          .update({ folder_id: null })
          .eq("owner_id", state.session.user.id)
          .in("folder_id", folderIds);
        if (postFolderUpdate.error) {
          throw postFolderUpdate.error;
        }
      }
      const postsUpdate = await state.supabase
        .from(TABLE_NAME)
        .update({ category: DEFAULT_CATEGORY_LABEL })
        .eq("owner_id", state.session.user.id)
        .eq("category", categoryName);
      if (postsUpdate.error) {
        throw postsUpdate.error;
      }
      if (folderIds.length) {
        const foldersDelete = await state.supabase
          .from(FOLDER_TABLE)
          .delete()
          .eq("owner_id", state.session.user.id)
          .in("id", folderIds);
        if (foldersDelete.error) {
          throw foldersDelete.error;
        }
      }
      if (category?.id) {
        const categoryDelete = await state.supabase
          .from(CATEGORY_TABLE)
          .delete()
          .eq("id", category.id)
          .eq("owner_id", state.session.user.id);
        if (categoryDelete.error) {
          throw categoryDelete.error;
        }
      }
    } else {
      state.categories = state.categories.filter((item) => item.name !== categoryName);
      state.folders = state.folders.filter((folder) => !folderIds.includes(folder.id));
      state.posts = state.posts.map((post) => post.category === categoryName || folderIds.includes(post.folder_id)
        ? { ...post, category: post.category === categoryName ? DEFAULT_CATEGORY_LABEL : post.category, folder_id: folderIds.includes(post.folder_id) ? null : post.folder_id }
        : post);
      cacheTaxonomy(CATEGORIES_STORAGE, state.categories);
      cacheTaxonomy(FOLDERS_STORAGE, state.folders);
      cacheLocalPosts(state.posts);
    }
    state.category = ALL_CATEGORY_LABEL;
    state.activeFolderId = "all";
    await loadPosts();
    toast("카테고리를 삭제했습니다.");
  } catch (error) {
    toast(`카테고리 삭제 실패: ${error.message}`);
  }
}

async function renameFolder(folderId) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder || !state.session) {
    return;
  }
  const nextName = (prompt("변경할 폴더 이름", folder.name) || "").trim();
  if (!nextName || nextName === folder.name) {
    return;
  }

  try {
    if (state.supabase && isUuid(folderId)) {
      const { error } = await state.supabase
        .from(FOLDER_TABLE)
        .update({ name: nextName })
        .eq("id", folderId)
        .eq("owner_id", state.session.user.id);
      if (error) {
        throw error;
      }
    } else {
      state.folders = state.folders.map((item) => item.id === folderId ? { ...item, name: nextName } : item);
      cacheTaxonomy(FOLDERS_STORAGE, state.folders);
    }
    await loadTaxonomy();
    renderBlogList();
    toast("폴더 이름을 변경했습니다.");
  } catch (error) {
    toast(`폴더 이름 변경 실패: ${error.message}`);
  }
}

async function deleteFolder(folderId) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder || !state.session || !confirm(`"${folder.name}" 폴더를 휴지통으로 이동할까요?`)) {
    return;
  }
  const deletedAt = new Date().toISOString();
  const folderIds = [folderId, ...getFolderDescendantIds(folderId)];

  try {
    if (state.supabase && isUuid(folderId)) {
      const foldersUpdate = await state.supabase.from(FOLDER_TABLE).update({ deleted_at: deletedAt }).eq("owner_id", state.session.user.id).in("id", folderIds);
      if (foldersUpdate.error) throw foldersUpdate.error;
      const postsUpdate = await state.supabase.from(TABLE_NAME).update({ deleted_at: deletedAt }).eq("owner_id", state.session.user.id).in("folder_id", folderIds);
      if (postsUpdate.error) throw postsUpdate.error;
    } else {
      state.folders = state.folders.map((item) => folderIds.includes(item.id) ? { ...item, deleted_at: deletedAt } : item);
      state.posts = state.posts.map((post) => folderIds.includes(post.folder_id) ? { ...post, deleted_at: deletedAt } : post);
      cacheTaxonomy(FOLDERS_STORAGE, state.folders);
      cacheLocalPosts(state.posts);
    }
    state.activeFolderId = "all";
    await loadPosts();
    toast("폴더를 휴지통으로 이동했습니다.");
  } catch (error) {
    toast(`폴더 삭제 실패: ${error.message}`);
  }
  return;
}

async function __oldDeleteFolder(folderId) {
  const folder = state.folders.find((item) => item.id === folderId);
  if (!folder || !state.session || !confirm(`"${folder.name}" 폴더를 삭제할까요? 하위 폴더도 함께 삭제됩니다.`)) {
    return;
  }
  const folderIds = [folderId, ...getFolderDescendantIds(folderId)];

  try {
    if (state.supabase && isUuid(folderId)) {
      const postsUpdate = await state.supabase
        .from(TABLE_NAME)
        .update({ folder_id: null })
        .eq("owner_id", state.session.user.id)
        .in("folder_id", folderIds);
      if (postsUpdate.error) {
        throw postsUpdate.error;
      }
      const folderDelete = await state.supabase
        .from(FOLDER_TABLE)
        .delete()
        .eq("id", folderId)
        .eq("owner_id", state.session.user.id);
      if (folderDelete.error) {
        throw folderDelete.error;
      }
    } else {
      state.folders = state.folders.filter((item) => !folderIds.includes(item.id));
      state.posts = state.posts.map((post) => folderIds.includes(post.folder_id) ? { ...post, folder_id: null } : post);
      cacheTaxonomy(FOLDERS_STORAGE, state.folders);
      cacheLocalPosts(state.posts);
    }
    state.activeFolderId = "all";
    await loadPosts();
    toast("폴더를 삭제했습니다.");
  } catch (error) {
    toast(`폴더 삭제 실패: ${error.message}`);
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

function openEditor(postId = null, { keepRoute = false, useDraft = false } = {}) {
  if (!state.session && state.supabase) {
    openAuth();
    toast("로그인하면 계정별 블로그에 글을 쓸 수 있습니다.");
    return;
  }

  if (!keepRoute && window.location.hash !== ROUTES.editor) {
    state.pendingEditorPostId = postId;
    state.pendingEditorUseDraft = useDraft;
    window.location.hash = ROUTES.editor;
    return;
  }

  const post = postId ? state.posts.find((item) => item.id === postId) : (useDraft ? getDraft() : null) || createBlankPost();
  state.pendingEditorPostId = null;
  state.pendingEditorUseDraft = false;
  if (postId && !post) {
    toast("수정할 글을 찾지 못했습니다.");
    navigateTo(state.session ? "myblog" : "home", { replace: true });
    return;
  }
  state.view = "editor";
  state.editingId = postId;
  state.editorInitial = clonePost(post);
  render();
}

function renderEditor() {
  const post = state.editorInitial || createBlankPost();
  app.innerHTML = `
    <form class="editor-shell" id="editorForm">
      <div class="editor-head">
        <input class="editor-title" id="editorTitle" value="${escapeAttr(post.title || "")}" placeholder="제목" />
        <div class="editor-actions">
          <button class="ghost-button editor-compact-button" type="button" data-editor-action="draft">
            <i data-lucide="save"></i>
            임시저장
          </button>
          <button class="primary-button editor-compact-button" type="submit">
            <i data-lucide="send"></i>
            발행
          </button>
        </div>
      </div>

      <details class="editor-panel editor-meta-panel" open>
        <summary class="editor-panel-summary">
          <span><i data-lucide="folder-tree"></i>카테고리 설정</span>
          <i data-lucide="chevron-down"></i>
        </summary>
        <div class="editor-meta">
          <label class="meta-field">
            <span>카테고리</span>
            <div class="inline-field">
              <select id="editorCategory">
                ${renderCategoryOptions(post.category || getFallbackCategoryName())}
              </select>
              <button class="icon-button" type="button" id="editorAddCategoryButton" aria-label="새 카테고리" title="새 카테고리"><i data-lucide="plus"></i></button>
            </div>
          </label>
          <label class="meta-field">
            <span>폴더</span>
            <div class="inline-field">
              <select id="editorFolder">
                <option value="">폴더 없음</option>
                ${renderFolderOptions(post.folder_id || "", post.category || getFallbackCategoryName())}
              </select>
              <button class="icon-button" type="button" id="editorAddFolderButton" aria-label="새 폴더" title="새 폴더"><i data-lucide="folder-plus"></i></button>
            </div>
          </label>
          <label class="meta-field">
            <span>공개 상태</span>
            <select id="editorPublished">
              <option value="true" ${post.published !== false ? "selected" : ""}>공개</option>
              <option value="false" ${post.published === false ? "selected" : ""}>비공개</option>
            </select>
          </label>
        </div>
      </details>

      <details class="editor-panel editor-tools-panel" open>
        <summary class="editor-panel-summary">
          <span><i data-lucide="sliders-horizontal"></i>편집 기능</span>
          <i data-lucide="chevron-down"></i>
        </summary>
        <div class="editor-toolbar" aria-label="글 편집 도구">
        <div class="tool-group">
          <button class="tool-button" type="button" data-command="undo" aria-label="실행 취소" title="실행 취소"><i data-lucide="undo-2"></i></button>
          <button class="tool-button" type="button" data-command="redo" aria-label="다시 실행" title="다시 실행"><i data-lucide="redo-2"></i></button>
        </div>
        <div class="tool-group">
          <button class="tool-button" type="button" data-command="bold" aria-label="굵게" title="굵게"><i data-lucide="bold"></i></button>
          <button class="tool-button" type="button" data-command="italic" aria-label="기울임" title="기울임"><i data-lucide="italic"></i></button>
          <button class="tool-button" type="button" data-command="underline" aria-label="밑줄" title="밑줄"><i data-lucide="underline"></i></button>
          <button class="tool-button" type="button" data-command="strikeThrough" aria-label="취소선" title="취소선"><i data-lucide="strikethrough"></i></button>
          <button class="tool-button is-text" type="button" data-command="subscript" aria-label="아래 첨자" title="아래 첨자">x₂</button>
          <button class="tool-button is-text" type="button" data-command="superscript" aria-label="위 첨자" title="위 첨자">x²</button>
          <div class="color-dropdown">
            <button class="tool-button color-menu-button" type="button" data-color-menu="text" aria-label="글자색" title="글자색">
              <i data-lucide="type"></i>
              <span class="color-preview-line" id="textColorPreview" style="--active-color: #1499db"></span>
              <i data-lucide="chevron-down"></i>
            </button>
            <div class="office-color-menu" id="textColorMenu" hidden>
              ${renderColorPalette("text")}
            </div>
            <input class="sr-only" id="textColor" type="color" value="#1499db" aria-label="글자색 직접 선택" title="글자색 직접 선택" />
          </div>
          <div class="color-dropdown">
            <button class="tool-button color-menu-button" type="button" data-color-menu="bg" aria-label="글씨 배경색" title="글씨 배경색">
              <i data-lucide="paint-bucket"></i>
              <span class="color-preview-line" id="highlightColorPreview" style="--active-color: #fff2a8"></span>
              <i data-lucide="chevron-down"></i>
            </button>
            <div class="office-color-menu" id="bgColorMenu" hidden>
              ${renderColorPalette("bg")}
            </div>
            <input class="sr-only" id="highlightColor" type="color" value="#fff2a8" aria-label="글씨 배경색 직접 선택" title="글씨 배경색 직접 선택" />
          </div>
        </div>
        <div class="tool-group style-tool-group">
          <select class="toolbar-select font-select" id="fontFamily" aria-label="글씨체" title="글씨체">
            ${renderFontOptions()}
          </select>
          <input class="toolbar-number" id="fontSizeInput" type="number" min="8" max="96" step="1" value="16" aria-label="글씨 크기" title="글씨 크기" />
          <button class="tool-button" type="button" id="addFontButton" aria-label="폰트 추가" title="폰트 추가">Aa+</button>
          <select class="toolbar-select compact-select" id="lineHeightSelect" aria-label="줄 간격" title="줄 간격">
            <option value="1.2">1.2</option>
            <option value="1.5" selected>1.5</option>
            <option value="1.8">1.8</option>
            <option value="2">2.0</option>
            <option value="2.4">2.4</option>
          </select>
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
          <button class="tool-button" type="button" data-command="justifyRight" aria-label="오른쪽 정렬" title="오른쪽 정렬"><i data-lucide="align-right"></i></button>
          <button class="tool-button" type="button" data-command="justifyFull" aria-label="양쪽 정렬" title="양쪽 정렬"><i data-lucide="align-justify"></i></button>
          <button class="tool-button" type="button" data-command="outdent" aria-label="내어쓰기" title="내어쓰기"><i data-lucide="outdent"></i></button>
          <button class="tool-button" type="button" data-command="indent" aria-label="들여쓰기" title="들여쓰기"><i data-lucide="indent"></i></button>
        </div>
        <div class="tool-group">
          <button class="tool-button" type="button" data-vertical-align="top" aria-label="위쪽 정렬" title="위쪽 정렬"><i data-lucide="align-vertical-justify-start"></i></button>
          <button class="tool-button" type="button" data-vertical-align="middle" aria-label="세로 가운데 정렬" title="세로 가운데 정렬"><i data-lucide="align-vertical-justify-center"></i></button>
          <button class="tool-button" type="button" data-vertical-align="bottom" aria-label="아래쪽 정렬" title="아래쪽 정렬"><i data-lucide="align-vertical-justify-end"></i></button>
        </div>
        <div class="tool-group">
          <button class="tool-button" type="button" data-command="createLink" aria-label="링크" title="링크"><i data-lucide="link"></i></button>
          <button class="tool-button" type="button" data-command="insertImage" aria-label="이미지" title="이미지"><i data-lucide="image-plus"></i></button>
          <button class="tool-button" type="button" data-command="insertTable" aria-label="표 삽입" title="표 삽입"><i data-lucide="table"></i></button>
          <button class="tool-button" type="button" data-command="addTableRow" aria-label="표 행 추가" title="표 행 추가"><i data-lucide="rows-3"></i></button>
          <button class="tool-button" type="button" data-command="addTableColumn" aria-label="표 열 추가" title="표 열 추가"><i data-lucide="columns-3"></i></button>
          <button class="tool-button" type="button" data-command="insertHorizontalRule" aria-label="구분선" title="구분선"><i data-lucide="minus"></i></button>
          <button class="tool-button" type="button" data-command="removeFormat" aria-label="서식 지우기" title="서식 지우기"><i data-lucide="eraser"></i></button>
        </div>
        </div>
      </details>

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
          <button class="outline-button editor-compact-button" type="button" data-editor-action="cancel">돌아가기</button>
          <button class="primary-button editor-compact-button" type="submit">발행</button>
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

  $$("[data-command]").forEach((button) => {
    button.addEventListener("click", () => runEditorCommand(button.dataset.command, button.dataset.value));
  });

  $("[data-color-menu='text']").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleColorMenu("text");
  });
  $("[data-color-menu='bg']").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleColorMenu("bg");
  });
  $("#editorForm").addEventListener("click", (event) => {
    if (!event.target.closest(".color-dropdown")) {
      closeColorMenus();
    }
  });
  $("#textColor").addEventListener("input", (event) => {
    updateColorPreview("text", event.target.value);
    applyTextColor(event.target.value, update);
    closeColorMenus();
  });
  $("#highlightColor").addEventListener("input", (event) => {
    updateColorPreview("bg", event.target.value);
    applyInlineStyle({ backgroundColor: event.target.value }, update);
    closeColorMenus();
  });
  $("#fontFamily").addEventListener("change", (event) => {
    applyInlineStyle({ fontFamily: event.target.value }, update);
  });
  $("#addFontButton").addEventListener("click", () => {
    addCustomFont(update);
  });
  $("#fontSizeInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFontSizeFromInput(event.target, update);
    }
  });
  $("#lineHeightSelect").addEventListener("change", (event) => {
    applyInlineStyle({ lineHeight: event.target.value }, update);
  });
  $$("[data-text-color]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#textColor").value = button.dataset.textColor;
      updateColorPreview("text", button.dataset.textColor);
      applyTextColor(button.dataset.textColor, update);
      closeColorMenus();
    });
  });
  $$("[data-bg-color]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.bgColor !== "transparent") {
        $("#highlightColor").value = button.dataset.bgColor;
      }
      updateColorPreview("bg", button.dataset.bgColor);
      applyInlineStyle({ backgroundColor: button.dataset.bgColor }, update);
      closeColorMenus();
    });
  });
  $$("[data-open-native-color]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.dataset.openNativeColor === "text" ? $("#textColor") : $("#highlightColor");
      input.click();
    });
  });
  $$("[data-vertical-align]").forEach((button) => {
    button.addEventListener("click", () => {
      applyInlineStyle({ verticalAlign: button.dataset.verticalAlign }, update);
    });
  });

  ["editorTitle", "editorCategory", "editorFolder", "editorPublished"].forEach((id) => {
    document.getElementById(id).addEventListener("input", update);
  });
  $("#editorCategory").addEventListener("change", () => {
    $("#editorFolder").innerHTML = `<option value="">\uD3F4\uB354 \uC5C6\uC74C</option>${renderFolderOptions("", $("#editorCategory").value)}`;
    update();
  });
  $("#editorAddCategoryButton").addEventListener("click", async () => {
    const category = await addCategory({ silent: true });
    if (category) {
      $("#editorCategory").innerHTML = renderCategoryOptions(category.name);
      update();
    }
  });
  $("#editorAddFolderButton").addEventListener("click", async () => {
    const parentId = $("#editorFolder").value || null;
    const folder = await addFolder(parentId, { silent: true, categoryName: $("#editorCategory").value });
    if (folder) {
      $("#editorFolder").innerHTML = `<option value="">폴더 없음</option>${renderFolderOptions(folder.id, $("#editorCategory").value)}`;
      update();
    }
  });

  editor.addEventListener("input", update);
  editor.addEventListener("keyup", rememberEditorSelection);
  editor.addEventListener("mouseup", rememberEditorSelection);
  editor.addEventListener("paste", handleImagePaste);

  $("#editorForm").addEventListener("submit", publishPost);
  $("[data-editor-action='draft']").addEventListener("click", () => {
    saveDraft();
    toast("임시저장했습니다.");
  });
  $("[data-editor-action='cancel']").addEventListener("click", () => {
    state.editingId = null;
    state.editorInitial = null;
    state.pendingEditorPostId = null;
    state.pendingEditorUseDraft = false;
    navigateTo(state.session ? "myblog" : "home");
  });

  updatePreview();
}

function toggleColorMenu(type) {
  const currentMenu = type === "text" ? $("#textColorMenu") : $("#bgColorMenu");
  const shouldOpen = currentMenu.hidden;
  closeColorMenus();
  currentMenu.hidden = !shouldOpen;
}

function closeColorMenus() {
  ["textColorMenu", "bgColorMenu"].forEach((id) => {
    const menu = document.getElementById(id);
    if (menu) {
      menu.hidden = true;
    }
  });
}

function updateColorPreview(type, color) {
  const preview = type === "text" ? $("#textColorPreview") : $("#highlightColorPreview");
  if (preview) {
    preview.style.setProperty("--active-color", color);
  }
}

function addCustomFont(update) {
  const fontName = (prompt("추가할 폰트 이름을 입력하세요. 예: Pretendard, NanumSquare") || "").trim();
  if (!fontName) {
    return;
  }

  const fonts = getCustomFonts();
  if (!fonts.some((font) => font.toLowerCase() === fontName.toLowerCase())) {
    saveCustomFonts([...fonts, fontName]);
  }

  const select = $("#fontFamily");
  select.innerHTML = renderFontOptions();
  select.value = quoteFontFamily(fontName);
  applyInlineStyle({ fontFamily: select.value }, update);
  toast(`"${fontName}" 폰트를 추가했습니다.`);
}

function applyFontSizeFromInput(input, update) {
  const size = clamp(Number(input.value) || 16, 8, 96);
  input.value = size;
  applyInlineStyle({ fontSize: `${size}px` }, update);
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
  } else if (command === "insertTable") {
    insertEditorTable();
  } else if (command === "addTableRow") {
    addTableRow();
  } else if (command === "addTableColumn") {
    addTableColumn();
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

function insertEditorTable() {
  const rows = clamp(Number(prompt("표 행 수", "3")) || 3, 1, 20);
  const columns = clamp(Number(prompt("표 열 수", "3")) || 3, 1, 12);
  restoreEditorSelection();
  const table = `
    <table>
      <tbody>
        ${Array.from({ length: rows }).map(() => `
          <tr>
            ${Array.from({ length: columns }).map(() => `<td><br></td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
    <p><br></p>
  `;
  document.execCommand("insertHTML", false, table);
  rememberEditorSelection();
  saveDraft();
  updatePreview();
}

function addTableRow() {
  const cell = getCurrentTableCell();
  const row = cell?.closest("tr");
  if (!row) {
    toast("표 안에 커서를 둔 뒤 행을 추가하세요.");
    return;
  }
  const nextRow = row.cloneNode(true);
  nextRow.querySelectorAll("td,th").forEach((cell) => {
    cell.innerHTML = "<br>";
  });
  row.after(nextRow);
  saveDraft();
  updatePreview();
}

function addTableColumn() {
  const cell = getCurrentTableCell();
  const row = cell?.closest("tr");
  const table = cell?.closest("table");
  if (!cell || !row || !table) {
    toast("표 안에 커서를 둔 뒤 열을 추가하세요.");
    return;
  }
  const index = Array.from(row.children).indexOf(cell);
  table.querySelectorAll("tr").forEach((tableRow) => {
    const reference = tableRow.children[index];
    const newCell = document.createElement(reference?.tagName?.toLowerCase() === "th" ? "th" : "td");
    newCell.innerHTML = "<br>";
    if (reference) {
      reference.after(newCell);
    } else {
      tableRow.appendChild(newCell);
    }
  });
  saveDraft();
  updatePreview();
}

function getCurrentTableCell() {
  restoreEditorSelection();
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return null;
  }
  const node = selection.getRangeAt(0).startContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return element?.closest("td,th") || null;
}

function applyTextColor(color, update) {
  restoreEditorSelection();
  document.execCommand("foreColor", false, color);
  rememberEditorSelection();
  saveDraft();
  updatePreview();
  update();
}

function rememberEditorSelection() {
  const editor = $("#editorContent");
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) {
    savedEditorRange = range.cloneRange();
  }
}

function restoreEditorSelection() {
  const editor = $("#editorContent");
  if (!editor || !savedEditorRange) {
    editor?.focus();
    return;
  }

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedEditorRange);
  editor.focus();
}

function applyInlineStyle(styles, update) {
  restoreEditorSelection();
  const editor = $("#editorContent");
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    return;
  }

  if (range.collapsed) {
    const target = getEditableStyleTarget(range.startContainer);
    Object.assign(target.style, styles);
  } else {
    const wrapper = document.createElement("span");
    Object.assign(wrapper.style, styles);
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    selection.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection.addRange(nextRange);
  }

  rememberEditorSelection();
  saveDraft();
  updatePreview();
  update();
}

function getEditableStyleTarget(node) {
  const editor = $("#editorContent");
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return element?.closest("p,h1,h2,h3,h4,h5,h6,li,blockquote,div,span") || editor;
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

  return {
    id: base.id || crypto.randomUUID(),
    owner_id: state.session?.user?.id || base.owner_id || null,
    author_name: getDisplayName(),
    title: title || "제목 없음",
    slug: base.slug || makeSlug(title || "untitled"),
    excerpt: makeExcerpt(content),
    category: $("#editorCategory").value.trim() || getFallbackCategoryName(),
    folder_id: $("#editorFolder").value || null,
    tags: Array.isArray(base.tags) ? base.tags : [],
    cover_url: base.cover_url || "",
    content,
    published: $("#editorPublished").value === "true",
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
    <div class="post-meta">${escapeHtml(post.category)} · ${formatDate(post.updated_at)} · ${escapeHtml(post.author_name)}</div>
    <h2 class="reader-title">${escapeHtml(post.title)}</h2>
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
    state.pendingEditorPostId = null;
    state.pendingEditorUseDraft = false;
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
  if (!confirm("이 글을 휴지통으로 이동할까요?")) {
    return;
  }

  const deletedAt = new Date().toISOString();
  if (state.supabase && state.session && isUuid(id)) {
    const { error } = await state.supabase
      .from(TABLE_NAME)
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .eq("owner_id", state.session.user.id);
    if (error) {
      toast(error.message);
      return;
    }
  } else {
    state.posts = state.posts.map((post) => post.id === id ? { ...post, deleted_at: deletedAt } : post);
    cacheLocalPosts(state.posts);
  }

  state.selectedId = null;
  await loadPosts();
  toast("글을 휴지통으로 이동했습니다.");
  return;
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

async function persistProfile(profile) {
  if (!state.supabase || !state.session) {
    return profile;
  }

  const userId = state.session.user.id;
  const payload = { ...profile, id: userId };
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

  const created = await state.supabase.from(PROFILE_TABLE).insert(payload).select().single();
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
  $("#authTitle").textContent = loggedIn ? identifier || "아이디" : state.authMode === "signup" ? "회원가입" : "작성자 로그인";
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

  authButton.textContent = state.session ? getUserIdentifier(state.session.user) || "아이디" : "로그인";
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
    if (post.deleted_at) {
      return false;
    }
    const ownerMatch = isMine ? post.owner_id === userId : post.published === true && Boolean(post.owner_id);
    const categoryMatch = state.category === ALL_CATEGORY_LABEL || (post.category || getFallbackCategoryName()) === state.category;
    const folderMatch = isFolderMatch(post);
    const haystack = `${post.title} ${post.excerpt || ""} ${(post.tags || []).join(" ")} ${post.author_name || ""} ${htmlToText(post.content)}`.toLowerCase();
    return ownerMatch && categoryMatch && folderMatch && (!query || haystack.includes(query));
  });
}

function getCategories(posts) {
  const scopeCategories = state.categories
    .filter((category) => !category.deleted_at && category.name && category.name !== DEFAULT_CATEGORY_LABEL && (!category.owner_id || category.owner_id === state.session?.user?.id))
    .map((category) => category.name);
  const postCategories = posts.map((post) => post.category).filter((category) => category && category !== DEFAULT_CATEGORY_LABEL);
  const folderCategories = getSidebarFolders().map((folder) => getFolderCategoryName(folder)).filter((category) => category && category !== DEFAULT_CATEGORY_LABEL);
  return [ALL_CATEGORY_LABEL, ...new Set([...scopeCategories, ...postCategories, ...folderCategories])];
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
  return state.posts.filter((post) => !post.deleted_at && (isMine ? post.owner_id === userId : post.published === true && Boolean(post.owner_id)));
}

function getVisibleFolders() {
  const ownerIds = new Set(getPostsForCurrentScope().map((post) => post.owner_id).filter(Boolean));
  const folders = state.view === "myblog"
    ? getMyFolders()
    : state.folders.filter((folder) => !folder.deleted_at && ownerIds.has(folder.owner_id));

  if (state.activeFolderId !== "all") {
    const folderIds = [state.activeFolderId, ...getFolderDescendantIds(state.activeFolderId)];
    return folders.filter((folder) => folderIds.includes(folder.id));
  }
  if (state.category !== ALL_CATEGORY_LABEL) {
    return folders.filter((folder) => getFolderCategoryName(folder) === state.category);
  }
  return folders;
}

function getSidebarFolders() {
  return state.view === "myblog" ? getMyFolders() : getVisibleFolders();
}

function getMyFolders() {
  return state.folders.filter((folder) => !folder.deleted_at && (!folder.owner_id || folder.owner_id === state.session?.user?.id));
}

function getFoldersForCategory(folders, categoryName) {
  const categoryFolders = folders.filter((folder) => getFolderCategoryName(folder) === categoryName);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const expanded = new Map(categoryFolders.map((folder) => [folder.id, folder]));
  categoryFolders.forEach((folder) => {
    let parentId = folder.parent_id;
    while (parentId && byId.has(parentId)) {
      const parent = byId.get(parentId);
      expanded.set(parent.id, parent);
      parentId = parent.parent_id;
    }
  });
  return Array.from(expanded.values());
}

function getFolderCategoryName(folder) {
  const category = state.categories.find((item) => item.id === folder.category_id);
  if (category) {
    return category.name;
  }

  const descendantIds = [folder.id, ...getFolderDescendantIds(folder.id)];
  const linkedPost = getPostsForCurrentScope().find((post) => descendantIds.includes(post.folder_id));
  return linkedPost?.category || getFallbackCategoryName();
}

function getFallbackCategoryName() {
  return state.categories.find((category) => (
    !category.deleted_at &&
    category.name &&
    category.name !== DEFAULT_CATEGORY_LABEL &&
    (!category.owner_id || category.owner_id === state.session?.user?.id)
  ))?.name || "";
}

function getFolderCategoryId(parentId, categoryName) {
  const parentFolder = state.folders.find((folder) => folder.id === parentId);
  if (parentFolder?.category_id) {
    return parentFolder.category_id;
  }
  return getCategoryIdByName(categoryName || state.category) || null;
}

function getCategoryIdByName(name) {
  const normalized = name && name !== ALL_CATEGORY_LABEL ? name : getFallbackCategoryName();
  if (!normalized) {
    return null;
  }
  return state.categories.find((category) => category.name === normalized && (!category.owner_id || category.owner_id === state.session?.user?.id))?.id || null;
}

function getCategoryByName(name) {
  return state.categories.find((category) => category.name === name && (!category.owner_id || category.owner_id === state.session?.user?.id)) || null;
}

function getTrashItems() {
  const userId = state.session?.user?.id;
  const categories = state.categories
    .filter((item) => item.deleted_at && item.owner_id === userId)
    .map((item) => ({ type: "category", typeLabel: "카테고리", id: item.id, label: item.name, deleted_at: item.deleted_at }));
  const folders = state.folders
    .filter((item) => item.deleted_at && item.owner_id === userId)
    .map((item) => ({ type: "folder", typeLabel: "폴더", id: item.id, label: item.name, deleted_at: item.deleted_at }));
  const posts = state.posts
    .filter((item) => item.deleted_at && item.owner_id === userId)
    .map((item) => ({ type: "post", typeLabel: "글", id: item.id, label: item.title, deleted_at: item.deleted_at }));

  return [...categories, ...folders, ...posts].sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
}

async function restoreTrashItem(type, id) {
  try {
    if (type === "category") {
      await restoreCategory(id);
    } else if (type === "folder") {
      await restoreFolder(id);
    } else if (type === "post") {
      await restorePost(id);
    }
    await loadPosts();
    state.trashOpen = true;
    toast("휴지통에서 복원했습니다.");
  } catch (error) {
    toast(`복원 실패: ${error.message}`);
  }
}

async function emptyTrash() {
  const trashItems = getTrashItems();
  if (!trashItems.length || !state.session) {
    return;
  }
  if (!confirm("휴지통의 모든 항목을 완전히 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) {
    return;
  }

  const idsByType = {
    category: trashItems.filter((item) => item.type === "category").map((item) => item.id),
    folder: trashItems.filter((item) => item.type === "folder").map((item) => item.id),
    post: trashItems.filter((item) => item.type === "post").map((item) => item.id)
  };
  const uuidIdsByType = Object.fromEntries(
    Object.entries(idsByType).map(([type, ids]) => [type, ids.filter(isUuid)])
  );

  try {
    if (state.supabase) {
      if (uuidIdsByType.post.length) {
        const postsDelete = await state.supabase
          .from(TABLE_NAME)
          .delete()
          .eq("owner_id", state.session.user.id)
          .in("id", uuidIdsByType.post);
        if (postsDelete.error) throw postsDelete.error;
      }
      if (uuidIdsByType.folder.length) {
        const foldersDelete = await state.supabase
          .from(FOLDER_TABLE)
          .delete()
          .eq("owner_id", state.session.user.id)
          .in("id", uuidIdsByType.folder);
        if (foldersDelete.error) throw foldersDelete.error;
      }
      if (uuidIdsByType.category.length) {
        const categoriesDelete = await state.supabase
          .from(CATEGORY_TABLE)
          .delete()
          .eq("owner_id", state.session.user.id)
          .in("id", uuidIdsByType.category);
        if (categoriesDelete.error) throw categoriesDelete.error;
      }
    }

    state.posts = state.posts.filter((post) => !idsByType.post.includes(post.id));
    state.folders = state.folders.filter((folder) => !idsByType.folder.includes(folder.id));
    state.categories = state.categories.filter((category) => !idsByType.category.includes(category.id));
    cacheLocalPosts(state.posts);
    cacheTaxonomy(FOLDERS_STORAGE, state.folders);
    cacheTaxonomy(CATEGORIES_STORAGE, state.categories);
    await loadPosts();
    state.trashOpen = true;
    toast("휴지통을 비웠습니다.");
  } catch (error) {
    toast(`휴지통 비우기 실패: ${error.message}`);
  }
}

async function exportSelectedPosts() {
  const posts = state.posts.filter((post) => state.selectedPostIds.has(post.id) && !post.deleted_at);
  if (!posts.length) {
    toast("내보낼 글을 선택하세요.");
    return;
  }

  const format = $("#exportFormat")?.value || "txt";
  try {
    if (posts.length === 1) {
      const post = posts[0];
      if (format === "docx") {
        downloadBlob(await createDocxBlob(post), `${safeFileName(post.title)}.docx`);
      } else {
        downloadBlob(new Blob([postToText(post)], { type: "text/plain;charset=utf-8" }), `${safeFileName(post.title)}.txt`);
      }
      return;
    }

    const JSZip = await loadJSZip();
    const zip = new JSZip();
    for (const post of posts) {
      const filename = safeFileName(post.title);
      if (format === "docx") {
        zip.file(`${filename}.docx`, await createDocxBlob(post));
      } else {
        zip.file(`${filename}.txt`, postToText(post));
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `blog-posts-${new Date().toISOString().slice(0, 10)}.zip`);
  } catch (error) {
    toast(`내보내기 실패: ${error.message}`);
  }
}

async function importPostFiles(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (!files.length) {
    return;
  }

  try {
    const importedPosts = [];
    for (const file of files) {
      importedPosts.push(...await readImportFile(file));
    }
    if (!importedPosts.length) {
      toast("불러올 수 있는 글 파일이 없습니다.");
      return;
    }

    for (const post of importedPosts) {
      await persistPost(post);
    }
    await loadPosts();
    toast(`${importedPosts.length}개의 글을 불러왔습니다.`);
  } catch (error) {
    toast(`불러오기 실패: ${error.message}`);
  }
}

async function readImportFile(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".zip")) {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const posts = [];
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      if (entry.name.toLowerCase().endsWith(".txt")) {
        posts.push(textToPost(await entry.async("text"), entry.name));
      } else if (entry.name.toLowerCase().endsWith(".docx")) {
        posts.push(await docxToPost(await entry.async("blob"), entry.name));
      }
    }
    return posts;
  }
  if (lowerName.endsWith(".docx")) {
    return [await docxToPost(file, file.name)];
  }
  return [textToPost(await file.text(), file.name)];
}

function postToText(post) {
  return [
    `Title: ${post.title || "제목 없음"}`,
    `Category: ${post.category || getFallbackCategoryName()}`,
    `Published: ${post.published !== false ? "true" : "false"}`,
    `Date: ${post.created_at || new Date().toISOString()}`,
    "---",
    htmlToText(post.content || "")
  ].join("\n");
}

function textToPost(text, filename = "imported.txt") {
  const normalized = text.replace(/\r\n/g, "\n");
  const [rawMeta, ...bodyParts] = normalized.includes("\n---\n")
    ? normalized.split("\n---\n")
    : ["", normalized];
  const meta = Object.fromEntries(rawMeta.split("\n")
    .map((line) => line.match(/^([^:]+):\s*(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1].trim().toLowerCase(), match[2].trim()]));
  const body = bodyParts.join("\n---\n").trim() || normalized.trim();
  return createImportedPost({
    title: meta.title || filename.replace(/\.[^.]+$/, ""),
    category: meta.category || getFallbackCategoryName(),
    published: meta.published !== "false",
    content: textToHtml(body)
  });
}

async function docxToPost(file, filename = "imported.docx") {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file);
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) {
    throw new Error(`${filename}에서 문서를 찾을 수 없습니다.`);
  }
  const doc = new DOMParser().parseFromString(documentXml, "application/xml");
  const paragraphs = Array.from(doc.getElementsByTagName("w:p"))
    .map((paragraph) => Array.from(paragraph.getElementsByTagName("w:t")).map((node) => node.textContent || "").join(""))
    .filter((line) => line.trim());
  return createImportedPost({
    title: filename.replace(/\.[^.]+$/, ""),
    content: textToHtml(paragraphs.join("\n\n"))
  });
}

function createImportedPost({ title, category = getFallbackCategoryName(), published = true, content }) {
  const now = new Date().toISOString();
  return {
    ...createBlankPost(),
    id: crypto.randomUUID(),
    title: title || "불러온 글",
    slug: makeSlug(title || "imported"),
    excerpt: makeExcerpt(content),
    category,
    folder_id: state.activeFolderId !== "all" ? state.activeFolderId : null,
    content,
    published,
    created_at: now,
    updated_at: now
  };
}

async function createDocxBlob(post) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  const lines = [post.title || "제목 없음", "", ...htmlToText(post.content || "").split(/\n+/)];
  const body = lines.map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
  zip.folder("word").file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

async function loadJSZip() {
  if (window.JSZip) {
    return window.JSZip;
  }
  const module = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
  return module.default || module;
}

function textToHtml(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("") || "<p></p>";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value) {
  return (value || "post").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "post";
}

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  }[char]));
}

async function restoreCategory(id) {
  const category = state.categories.find((item) => item.id === id);
  if (!category || !state.session) return;
  const folderIds = state.folders
    .filter((folder) => folder.category_id === id)
    .flatMap((folder) => [folder.id, ...getFolderDescendantIds(folder.id)]);

  if (state.supabase && isUuid(id)) {
    const categoryUpdate = await state.supabase.from(CATEGORY_TABLE).update({ deleted_at: null }).eq("id", id).eq("owner_id", state.session.user.id);
    if (categoryUpdate.error) throw categoryUpdate.error;
    if (folderIds.length) {
      const foldersUpdate = await state.supabase.from(FOLDER_TABLE).update({ deleted_at: null }).eq("owner_id", state.session.user.id).in("id", folderIds);
      if (foldersUpdate.error) throw foldersUpdate.error;
    }
    const postsUpdate = await state.supabase.from(TABLE_NAME).update({ deleted_at: null, category: category.name }).eq("owner_id", state.session.user.id).eq("category", category.name);
    if (postsUpdate.error) throw postsUpdate.error;
  } else {
    state.categories = state.categories.map((item) => item.id === id ? { ...item, deleted_at: null } : item);
    state.folders = state.folders.map((folder) => folderIds.includes(folder.id) ? { ...folder, deleted_at: null } : folder);
    state.posts = state.posts.map((post) => post.category === category.name ? { ...post, deleted_at: null } : post);
    cacheTaxonomy(CATEGORIES_STORAGE, state.categories);
    cacheTaxonomy(FOLDERS_STORAGE, state.folders);
    cacheLocalPosts(state.posts);
  }
}

async function restoreFolder(id) {
  const folder = state.folders.find((item) => item.id === id);
  if (!folder || !state.session) return;
  const folderIds = [id, ...getFolderDescendantIds(id)];
  const parentExists = !folder.parent_id || state.folders.some((item) => item.id === folder.parent_id && !item.deleted_at);
  const categoryExists = folder.category_id && state.categories.some((item) => item.id === folder.category_id && !item.deleted_at);
  const rootUpdate = {
    deleted_at: null,
    parent_id: parentExists ? folder.parent_id : null,
    category_id: categoryExists ? folder.category_id : getCategoryIdByName(getFallbackCategoryName())
  };

  if (state.supabase && isUuid(id)) {
    const foldersUpdate = await state.supabase.from(FOLDER_TABLE).update({ deleted_at: null }).eq("owner_id", state.session.user.id).in("id", folderIds);
    if (foldersUpdate.error) throw foldersUpdate.error;
    const rootFolderUpdate = await state.supabase.from(FOLDER_TABLE).update(rootUpdate).eq("id", id).eq("owner_id", state.session.user.id);
    if (rootFolderUpdate.error) throw rootFolderUpdate.error;
    const postsUpdate = await state.supabase.from(TABLE_NAME).update({ deleted_at: null }).eq("owner_id", state.session.user.id).in("folder_id", folderIds);
    if (postsUpdate.error) throw postsUpdate.error;
  } else {
    state.folders = state.folders.map((item) => item.id === id ? { ...item, ...rootUpdate } : folderIds.includes(item.id) ? { ...item, deleted_at: null } : item);
    state.posts = state.posts.map((post) => folderIds.includes(post.folder_id) ? { ...post, deleted_at: null } : post);
    cacheTaxonomy(FOLDERS_STORAGE, state.folders);
    cacheLocalPosts(state.posts);
  }
}

async function restorePost(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post || !state.session) return;
  const folderExists = post.folder_id && state.folders.some((folder) => folder.id === post.folder_id && !folder.deleted_at);
  const categoryExists = state.categories.some((category) => category.name === post.category && !category.deleted_at);
  const update = {
    deleted_at: null,
    folder_id: folderExists ? post.folder_id : null,
    category: categoryExists ? post.category : getFallbackCategoryName()
  };

  if (state.supabase && isUuid(id)) {
    const postUpdate = await state.supabase.from(TABLE_NAME).update(update).eq("id", id).eq("owner_id", state.session.user.id);
    if (postUpdate.error) throw postUpdate.error;
  } else {
    state.posts = state.posts.map((item) => item.id === id ? { ...item, ...update } : item);
    cacheLocalPosts(state.posts);
  }
}

function buildFolderTree(folders) {
  const map = new Map(folders.map((folder) => [folder.id, { ...folder, children: [] }]));
  map.forEach((folder) => {
    if (folder.parent_id && map.has(folder.parent_id)) {
      map.get(folder.parent_id).children.push(folder);
    } else if (folder.parent_id) {
      folder.parent_id = null;
    }
  });
  return Array.from(map.values());
}

function findFolderInTree(folders, folderId) {
  for (const folder of folders) {
    if (folder.id === folderId) {
      return folder;
    }
    const child = findFolderInTree(folder.children || [], folderId);
    if (child) {
      return child;
    }
  }
  return null;
}

function getFolderDescendantIds(folderId) {
  const children = state.folders.filter((folder) => folder.parent_id === folderId);
  return children.flatMap((child) => [child.id, ...getFolderDescendantIds(child.id)]);
}

function getMyBlogTitle() {
  const identifier = getUserIdentifier(state.session?.user);
  return `${identifier || "User"}'s Blog`;
}

function getDisplayName() {
  return getUserIdentifier(state.session?.user) || "작성자";
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

function getStoredOpenState() {
  try {
    const saved = JSON.parse(localStorage.getItem(TAXONOMY_OPEN_STORAGE) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function cacheTaxonomy(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

function getCustomFonts() {
  try {
    const fonts = JSON.parse(localStorage.getItem(CUSTOM_FONTS_STORAGE) || "[]");
    return Array.isArray(fonts) ? fonts.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveCustomFonts(fonts) {
  const uniqueFonts = [...new Set(fonts.map((font) => font.trim()).filter(Boolean))];
  localStorage.setItem(CUSTOM_FONTS_STORAGE, JSON.stringify(uniqueFonts));
}

function quoteFontFamily(fontName) {
  const escaped = fontName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${escaped}', 'Noto Sans KR', sans-serif`;
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
    category: state.category !== ALL_CATEGORY_LABEL ? state.category : getFallbackCategoryName(),
    tags: [],
    cover_url: "",
    content: "<p></p>",
    published: true,
    deleted_at: null,
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
      deleted_at: category.deleted_at || null,
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
    category_id: folder.category_id || null,
    name: folder.name || "새 폴더",
    sort_order: Number(folder.sort_order || 0),
    deleted_at: folder.deleted_at || null,
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
    category: post.category || getFallbackCategoryName(),
    tags: Array.isArray(post.tags) ? post.tags : [],
    cover_url: post.cover_url || "",
    content: sanitizeHtml(post.content || ""),
    published: post.published !== false,
    deleted_at: post.deleted_at || null,
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
