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
const TAXONOMY_OPEN_STORAGE = "skyblog.taxonomyOpen.v1";
const ALL_CATEGORY_LABEL = "\uC804\uCCB4";
const DEFAULT_CATEGORY_LABEL = "\uC77C\uC0C1";
const ETC_CATEGORY_LABEL = "\uAE30\uD0C0";
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
  taxonomyOpen: getStoredOpenState(),
  trashOpen: false,
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
  updateBrandTitle();
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

function updateBrandTitle() {
  const brandTitle = $("#brandTitle");
  if (!brandTitle) {
    return;
  }

  const selectedPost = state.posts.find((post) => post.id === state.selectedId);
  const isOwnPostView = state.view === "post" && selectedPost?.owner_id === state.session?.user?.id;
  const title = state.session && (state.view === "myblog" || state.view === "editor" || isOwnPostView)
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
            ${categories.map((category) => renderCategory(category, visiblePosts, visibleFolders, isMine)).join("")}
          </div>
          ${isMine ? renderTrashSection() : ""}
        </div>
      </aside>

      <section class="feed-panel">
        <div class="section-head">
          <div>
            <h2>${countLabel}</h2>
            <p id="visiblePostCount">${visiblePosts.length}개의 글</p>
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
                ? renderFeedPosts(visiblePosts, visibleFolders, isMine)
                : renderEmptyState(isMine)
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

function updatePostList() {
  const list = $(".post-list");
  const count = $("#visiblePostCount");
  if (!list) {
    return;
  }
  const visiblePosts = getVisiblePosts();
  const visibleFolders = getVisibleFolders();
  list.innerHTML = state.loading
    ? `<div class="empty-state">불러오는 중...</div>`
    : visiblePosts.length
      ? renderFeedPosts(visiblePosts, visibleFolders, state.view === "myblog")
      : renderEmptyState(state.view === "myblog");
  if (count) {
    count.textContent = `${visiblePosts.length}개의 글`;
  }
  bindDynamicListEvents();
  updateIcons();
}

function renderFeedPosts(posts, folders, isMine) {
  if (state.loading) {
    return `<div class="empty-state">불러오는 중...</div>`;
  }
  if (!posts.length) {
    return renderEmptyState(isMine);
  }
  if (state.activeFolderId !== "all") {
    return posts.map((post) => renderPostCard(post, false)).join("");
  }

  const categories = [...new Set(posts.map((post) => post.category || ETC_CATEGORY_LABEL))];
  return categories.map((category) => renderFeedCategory(category, posts, folders)).join("");
}

function renderFeedCategory(category, posts, folders) {
  const categoryPosts = posts.filter((post) => (post.category || ETC_CATEGORY_LABEL) === category);
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
          ${rootFolders.map((folder) => renderFeedFolder(folder, categoryPosts, 0)).join("")}
          ${directPosts.map((post) => renderPostCard(post, false)).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderFeedFolder(folder, posts, depth) {
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
          ${hasChildren ? folder.children.map((child) => renderFeedFolder(child, posts, depth + 1)).join("") : ""}
          ${ownPosts.map((post) => renderPostCard(post, false)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function renderTrashSection() {
  const trashItems = getTrashItems();
  return `
    <div class="trash-section">
      <button class="trash-toggle" type="button" id="trashToggle">
        <span><i data-lucide="${state.trashOpen ? "chevron-down" : "chevron-right"}"></i>휴지통</span>
        <strong>${trashItems.length}</strong>
      </button>
      ${state.trashOpen ? `
        <div class="trash-list">
          ${trashItems.length ? trashItems.map(renderTrashItem).join("") : `<p class="folder-empty">휴지통이 비어 있습니다.</p>`}
        </div>
      ` : ""}
    </div>
  `;
}

function renderTrashItem(item) {
  return `
    <div class="trash-item">
      <span>${escapeHtml(item.label)} <small>${escapeHtml(item.typeLabel)}</small></span>
      <button class="outline-button compact-action" type="button" data-restore-type="${item.type}" data-restore-id="${escapeAttr(item.id)}">복원</button>
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
  const categories = getCategories(state.posts).filter((category) => category !== "전체");
  const options = categories.length ? categories : ["일상"];
  return options.map((category) => `<option value="${escapeAttr(category)}" ${category === selectedCategory ? "selected" : ""}>${escapeHtml(category)}</option>`).join("");
}

function renderFolderOption(folder, selectedId, depth) {
  const prefix = depth ? `${"--".repeat(depth)} ` : "";
  return `
    <option value="${escapeAttr(folder.id)}" ${folder.id === selectedId ? "selected" : ""}>${escapeHtml(prefix + folder.name)}</option>
    ${folder.children.map((child) => renderFolderOption(child, selectedId, depth + 1)).join("")}
  `;
}

function renderColorPalette(type) {
  const colors = ["#111827", "#64748b", "#ef4444", "#f97316", "#eab308", "#22c55e", "#1499db", "#6366f1", "#a855f7", "#ffffff"];
  return colors.map((color) => `
    <button class="color-swatch" type="button" data-${type}-color="${color}" style="--swatch: ${color}" aria-label="${type === "text" ? "글자색" : "글씨 배경색"} ${color}" title="${type === "text" ? "글자색" : "글씨 배경색"} ${color}"></button>
  `).join("");
}

function renderCategory(category, posts, folders, canManage) {
  const isAll = category === ALL_CATEGORY_LABEL;
  const count = isAll ? posts.length : posts.filter((post) => (post.category || ETC_CATEGORY_LABEL) === category).length;
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
  const scopedFolders = getFoldersForCategory(getMyFolders(), categoryName || (selectedFolder ? getFolderCategoryName(selectedFolder) : DEFAULT_CATEGORY_LABEL));
  const roots = buildFolderTree(scopedFolders).filter((folder) => !folder.parent_id);
  return roots.map((folder) => renderFolderOption(folder, selectedId, 0)).join("");
}

function renderPostCard(post, isActive) {
  return `
    <article class="post-card ${isActive ? "is-active" : ""}" data-post-id="${escapeAttr(post.id)}" tabindex="0">
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

  $("#homeLoginButton")?.addEventListener("click", openAuth);

  $("#addCategoryButton")?.addEventListener("click", addCategory);
  $("#trashToggle")?.addEventListener("click", () => {
    state.trashOpen = !state.trashOpen;
    renderBlogList();
    updateIcons();
  });

  bindDynamicListEvents();
  bindStaticListEvents();
}

function bindDynamicListEvents() {
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

function bindStaticListEvents() {

  $$("[data-restore-type]").forEach((button) => {
    button.addEventListener("click", () => restoreTrashItem(button.dataset.restoreType, button.dataset.restoreId));
  });

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
  const normalized = name && name !== ALL_CATEGORY_LABEL ? name.trim() : DEFAULT_CATEGORY_LABEL;
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
          <div class="inline-field">
            <select id="editorCategory">
              ${renderCategoryOptions(post.category || "일상")}
            </select>
            <button class="icon-button" type="button" id="editorAddCategoryButton" aria-label="새 카테고리" title="새 카테고리"><i data-lucide="plus"></i></button>
          </div>
        </label>
        <label class="meta-field">
          <span>폴더</span>
          <div class="inline-field">
            <select id="editorFolder">
              <option value="">폴더 없음</option>
              ${renderFolderOptions(post.folder_id || "", post.category || DEFAULT_CATEGORY_LABEL)}
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
          <input class="color-input" id="textColor" type="color" value="#1499db" aria-label="글자색 직접 선택" title="글자색 직접 선택" />
          <div class="color-palette" aria-label="글자색 팔레트">
            ${renderColorPalette("text")}
          </div>
          <input class="color-input" id="highlightColor" type="color" value="#fff2a8" aria-label="글씨 배경색 직접 선택" title="글씨 배경색 직접 선택" />
          <div class="color-palette" aria-label="글씨 배경색 팔레트">
            ${renderColorPalette("bg")}
          </div>
        </div>
        <div class="tool-group style-tool-group">
          <select class="toolbar-select font-select" id="fontFamily" aria-label="글씨체" title="글씨체">
            <option value="">기본</option>
            <option value="'Noto Sans KR', sans-serif">Noto Sans</option>
            <option value="'Malgun Gothic', sans-serif">맑은 고딕</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times</option>
            <option value="'Courier New', monospace">Courier</option>
          </select>
          <input class="toolbar-number" id="fontSizeInput" type="number" min="8" max="96" step="1" value="16" aria-label="글씨 크기" title="글씨 크기" />
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
    applyTextColor(event.target.value, update);
  });
  $("#highlightColor").addEventListener("input", (event) => {
    applyInlineStyle({ backgroundColor: event.target.value }, update);
  });
  $("#fontFamily").addEventListener("change", (event) => {
    applyInlineStyle({ fontFamily: event.target.value }, update);
  });
  $("#fontSizeInput").addEventListener("input", (event) => {
    applyInlineStyle({ fontSize: `${clamp(Number(event.target.value) || 16, 8, 96)}px` }, update);
  });
  $("#lineHeightSelect").addEventListener("change", (event) => {
    applyInlineStyle({ lineHeight: event.target.value }, update);
  });
  $$("[data-text-color]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#textColor").value = button.dataset.textColor;
      applyTextColor(button.dataset.textColor, update);
    });
  });
  $$("[data-bg-color]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#highlightColor").value = button.dataset.bgColor;
      applyInlineStyle({ backgroundColor: button.dataset.bgColor }, update);
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
    category: $("#editorCategory").value.trim() || "일상",
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
    if (post.deleted_at) {
      return false;
    }
    const ownerMatch = isMine ? post.owner_id === userId : post.published === true && Boolean(post.owner_id);
    const categoryMatch = state.category === "전체" || (post.category || "기타") === state.category;
    const folderMatch = isFolderMatch(post);
    const haystack = `${post.title} ${post.excerpt || ""} ${(post.tags || []).join(" ")} ${post.author_name || ""} ${htmlToText(post.content)}`.toLowerCase();
    return ownerMatch && categoryMatch && folderMatch && (!query || haystack.includes(query));
  });
}

function getCategories(posts) {
  const scopeCategories = state.categories
    .filter((category) => !category.deleted_at && (!category.owner_id || category.owner_id === state.session?.user?.id))
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
  return state.posts.filter((post) => !post.deleted_at && (isMine ? post.owner_id === userId : post.published === true && Boolean(post.owner_id)));
}

function getVisibleFolders() {
  const ownerIds = new Set(getPostsForCurrentScope().map((post) => post.owner_id).filter(Boolean));
  if (state.view === "myblog") {
    return getMyFolders();
  }
  return state.folders.filter((folder) => !folder.deleted_at && ownerIds.has(folder.owner_id));
}

function getMyFolders() {
  return state.folders.filter((folder) => !folder.deleted_at && (!folder.owner_id || folder.owner_id === state.session?.user?.id));
}

function getFoldersForCategory(folders, categoryName) {
  return folders.filter((folder) => getFolderCategoryName(folder) === categoryName);
}

function getFolderCategoryName(folder) {
  const category = state.categories.find((item) => item.id === folder.category_id);
  if (category) {
    return category.name;
  }

  const descendantIds = [folder.id, ...getFolderDescendantIds(folder.id)];
  const linkedPost = getPostsForCurrentScope().find((post) => descendantIds.includes(post.folder_id));
  return linkedPost?.category || DEFAULT_CATEGORY_LABEL;
}

function getFolderCategoryId(parentId, categoryName) {
  const parentFolder = state.folders.find((folder) => folder.id === parentId);
  if (parentFolder?.category_id) {
    return parentFolder.category_id;
  }
  return getCategoryIdByName(categoryName || state.category) || null;
}

function getCategoryIdByName(name) {
  const normalized = name && name !== ALL_CATEGORY_LABEL ? name : DEFAULT_CATEGORY_LABEL;
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
    category_id: categoryExists ? folder.category_id : getCategoryIdByName(DEFAULT_CATEGORY_LABEL)
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
    category: categoryExists ? post.category : DEFAULT_CATEGORY_LABEL
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
    }
  });
  return Array.from(map.values());
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
    category: post.category || "일상",
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
