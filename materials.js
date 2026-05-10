const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const state = {
  session: null,
  id: "",
  posts: [],
  tree: [],
  trashItems: [],
  materials: [],
  materialError: "",
};

const els = {
  title: document.querySelector("[data-materials-title]"),
  owner: document.querySelector("[data-materials-owner]"),
  brandTitle: document.querySelector("[data-brand-title]"),
  initials: document.querySelectorAll("[data-blog-initial]"),
  stats: document.querySelector("[data-materials-stats]"),
  recent: document.querySelector("[data-materials-recent]"),
  categories: document.querySelector("[data-materials-categories]"),
  folders: document.querySelector("[data-materials-folders]"),
  status: document.querySelector("[data-materials-status]"),
  materialForm: document.querySelector("[data-material-form]"),
  materialTitle: document.querySelector("[data-material-title]"),
  materialType: document.querySelector("[data-material-type]"),
  materialUrl: document.querySelector("[data-material-url]"),
  materialContent: document.querySelector("[data-material-content]"),
  materialSpace: document.querySelector("[data-materials-space]"),
  materialCount: document.querySelector("[data-materials-space-count]"),
};

async function requestRest(path, token, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: token ? `Bearer ${token}` : `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "자료를 불러오지 못했습니다.");
  return payload;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function htmlToPlainText(html = "") {
  const scratch = document.createElement("div");
  scratch.innerHTML = String(html);
  return scratch.textContent.replace(/\s+/g, " ").trim();
}

function getMaterialTypeLabel(type = "note") {
  const labels = {
    note: "메모",
    link: "링크",
    file: "파일",
    reference: "참고",
  };
  return labels[type] || "자료";
}

function normalizeMaterial(row = {}) {
  return {
    id: row.id || "",
    user_id: row.user_id || "",
    login_id: row.login_id || "",
    title: row.title || "제목 없는 자료",
    material_type: row.material_type || "note",
    url: row.url || "",
    content: row.content || "",
    source_post_id: row.source_post_id || "",
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  };
}

function renderBlog(id, profile = null) {
  const title = profile?.blog_title || `${id}'s Blog`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.title) els.title.textContent = "자료 공간";
  if (els.owner) els.owner.textContent = `${id} 계정의 블로그 자료를 따로 정리합니다.`;
  els.initials.forEach((initial) => {
    initial.textContent = id.slice(0, 1).toUpperCase();
  });
  document.title = `자료 | ${title}`;
}

function belongsToUser(post, session, id) {
  return (
    post.user_id === session?.user?.id ||
    String(post.login_id || "").toLowerCase() === id.toLowerCase() ||
    String(post.author || "").toLowerCase() === id.toLowerCase()
  );
}

function cloneNode(node) {
  return {
    id: node.id,
    type: node.type === "category" ? "category" : "folder",
    label: node.label || (node.type === "category" ? "카테고리" : "폴더"),
    filterCategory: node.type === "category" ? node.filterCategory || node.label || "카테고리" : "",
    children: Array.isArray(node.children) ? node.children.map(cloneNode) : [],
  };
}

function normalizeTree(tree) {
  return Array.isArray(tree)
    ? tree
        .filter((node) => node && node.id !== "all")
        .map(cloneNode)
    : [];
}

function normalizeTrashItems(items = []) {
  return Array.isArray(items)
    ? items.map((item) => ({
        id: item.id || "",
        kind: item.kind || "node",
        label: item.label || item.node?.label || item.posts?.[0]?.title || "삭제된 항목",
        posts: Array.isArray(item.posts) ? item.posts : [],
      }))
    : [];
}

function getTrashPostIdSet(items = state.trashItems) {
  const ids = new Set();
  items.forEach((item) => {
    (item.posts || []).forEach((post) => {
      if (post.id) ids.add(String(post.id));
    });
  });
  return ids;
}

function filterPostsOutsideTrash(posts = []) {
  const trashPostIds = getTrashPostIdSet();
  return posts.filter((post) => !trashPostIds.has(String(post.id)));
}

function getPostSortTime(post = {}) {
  const time = Date.parse(post.published_at || post.created_at || "");
  return Number.isFinite(time) ? time : 0;
}

function getPostViewHref(post = {}) {
  return `./viewer.html?id=${encodeURIComponent(post.id || "")}`;
}

function findNode(nodes, id, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node];
    if (node.id === id) return { node, path: nextPath };
    const found = findNode(node.children || [], id, nextPath);
    if (found) return found;
  }
  return null;
}

function getPathLabel(path = []) {
  return path
    .map((node) => node?.label || "")
    .filter(Boolean)
    .join(" / ");
}

function getTreeCategoryLabel(category = "") {
  const value = String(category || "").trim();
  if (!value || value === "전체") return "전체";
  const categoryNode = state.tree.find(
    (node) => node.type === "category" && (node.filterCategory === value || node.label === value)
  );
  return categoryNode?.label || value;
}

function getPostLocationLabel(post = {}) {
  if (post.folder_id) {
    const found = findNode(state.tree, post.folder_id);
    if (found) return getPathLabel(found.path);
  }
  if (post.folder_path) return post.folder_path;

  const categoryLabel = getTreeCategoryLabel(post.category);
  const folderName = post.folder_name || post.folder || "";
  if (folderName) return categoryLabel && categoryLabel !== "전체" ? `${categoryLabel} / ${folderName}` : folderName;
  return categoryLabel || "전체";
}

function flattenFolders(nodes = state.tree, path = [], category = "") {
  return nodes.flatMap((node) => {
    const nextCategory = node.type === "category" ? node.filterCategory || node.label : category;
    const nextPath = [...path, node];
    const current =
      node.type === "folder"
        ? [
            {
              id: node.id,
              label: node.label,
              path: getPathLabel(nextPath),
              category: nextCategory || "전체",
            },
          ]
        : [];
    return [...current, ...flattenFolders(node.children || [], nextPath, nextCategory)];
  });
}

function getCategorySummaries(posts = state.posts) {
  const byCategory = new Map();

  state.tree
    .filter((node) => node.type === "category")
    .forEach((node) => {
      const key = node.filterCategory || node.label || "전체";
      byCategory.set(key, {
        key,
        label: node.label || key,
        count: 0,
      });
    });

  posts.forEach((post) => {
    const key = post.category || "전체";
    const item = byCategory.get(key) || {
      key,
      label: getTreeCategoryLabel(key),
      count: 0,
    };
    item.count += 1;
    byCategory.set(key, item);
  });

  return [...byCategory.values()].sort((a, b) => a.label.localeCompare(b.label, "ko", { numeric: true }));
}

function getFolderSummaries(posts = state.posts) {
  const folders = flattenFolders();
  const byFolder = new Map(
    folders.map((folder) => [
      folder.id,
      {
        ...folder,
        count: 0,
      },
    ])
  );

  posts.forEach((post) => {
    const id = String(post.folder_id || "");
    if (id && byFolder.has(id)) {
      byFolder.get(id).count += 1;
      return;
    }

    const label = post.folder_path || post.folder_name || post.folder || "";
    if (!label) return;
    const key = `loose:${label}`;
    const item = byFolder.get(key) || {
      id: key,
      label,
      path: getPostLocationLabel(post),
      category: post.category || "전체",
      count: 0,
    };
    item.count += 1;
    byFolder.set(key, item);
  });

  return [...byFolder.values()]
    .filter((folder) => folder.count > 0 || !String(folder.id).startsWith("loose:"))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path, "ko", { numeric: true }));
}

function renderStats() {
  const publicCount = state.posts.filter((post) => post.published !== false).length;
  const privateCount = state.posts.length - publicCount;
  const categories = getCategorySummaries();
  const folders = getFolderSummaries();
  const stats = [
    ["전체 글", state.posts.length],
    ["공개 글", publicCount],
    ["비공개 글", privateCount],
    ["자료", state.materials.length],
    ["카테고리", categories.length],
    ["폴더", folders.length],
    ["휴지통", state.trashItems.length],
  ];

  els.stats.innerHTML = stats
    .map(
      ([label, value]) => `
        <article class="materials-stat">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");
}

function renderMaterialSpace() {
  if (els.materialCount) {
    els.materialCount.textContent = `${state.materials.length}개의 자료`;
  }

  if (!els.materialSpace) return;

  if (state.materialError && state.materials.length === 0) {
    els.materialSpace.innerHTML = `<p class="materials-empty">${escapeHtml(state.materialError)}</p>`;
    return;
  }

  if (state.materials.length === 0) {
    els.materialSpace.innerHTML = `<p class="materials-empty">아직 저장된 자료가 없습니다.</p>`;
    return;
  }

  els.materialSpace.innerHTML = state.materials
    .map((material) => {
      const typeLabel = getMaterialTypeLabel(material.material_type);
      const content = String(material.content || "").trim();
      const url = String(material.url || "").trim();
      const isWebLink = /^https?:\/\//i.test(url);
      return `
        <article class="materials-space-row" data-material-id="${escapeHtml(material.id)}">
          <div class="materials-space-row-main">
            <div class="materials-space-meta">
              <span>${escapeHtml(typeLabel)}</span>
              <time>${escapeHtml(formatDate(material.created_at || material.updated_at))}</time>
            </div>
            <strong>${escapeHtml(material.title)}</strong>
            ${content ? `<p>${escapeHtml(content)}</p>` : ""}
            ${url ? `<small>${escapeHtml(url)}</small>` : ""}
          </div>
          <div class="materials-material-actions">
            ${
              isWebLink
                ? `<a class="materials-material-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">열기</a>`
                : ""
            }
            <button type="button" class="materials-material-delete" data-material-delete="${escapeHtml(material.id)}">
              삭제
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRecentPosts() {
  const posts = [...state.posts].sort((a, b) => getPostSortTime(b) - getPostSortTime(a)).slice(0, 6);
  if (posts.length === 0) {
    els.recent.innerHTML = `<p class="materials-empty">아직 정리할 글이 없습니다.</p>`;
    return;
  }

  els.recent.innerHTML = posts
    .map((post) => {
      const excerpt = htmlToPlainText(post.body || "").slice(0, 80);
      return `
        <a class="materials-row materials-row-post" href="${getPostViewHref(post)}">
          <span>
            <strong>${escapeHtml(post.title || "제목 없는 글")}</strong>
            <small>${escapeHtml(getPostLocationLabel(post))}${excerpt ? ` · ${escapeHtml(excerpt)}` : ""}</small>
          </span>
          <time>${escapeHtml(formatDate(post.published_at || post.created_at))}</time>
        </a>
      `;
    })
    .join("");
}

function renderCategories() {
  const categories = getCategorySummaries();
  if (categories.length === 0) {
    els.categories.innerHTML = `<p class="materials-empty">카테고리가 없습니다.</p>`;
    return;
  }

  els.categories.innerHTML = categories
    .map(
      (category) => `
        <div class="materials-row">
          <span>
            <strong>${escapeHtml(category.label)}</strong>
            <small>${escapeHtml(category.key)}</small>
          </span>
          <b>${escapeHtml(category.count)}개</b>
        </div>
      `
    )
    .join("");
}

function renderFolders() {
  const folders = getFolderSummaries().slice(0, 8);
  if (folders.length === 0) {
    els.folders.innerHTML = `<p class="materials-empty">폴더가 없습니다.</p>`;
    return;
  }

  els.folders.innerHTML = folders
    .map(
      (folder) => `
        <div class="materials-row">
          <span>
            <strong>${escapeHtml(folder.label)}</strong>
            <small>${escapeHtml(folder.path)}</small>
          </span>
          <b>${escapeHtml(folder.count)}개</b>
        </div>
      `
    )
    .join("");
}

function renderStatus() {
  const total = Math.max(state.posts.length, 1);
  const publicCount = state.posts.filter((post) => post.published !== false).length;
  const privateCount = state.posts.length - publicCount;
  const latest = [...state.posts].sort((a, b) => getPostSortTime(b) - getPostSortTime(a))[0];
  const categoryCount = getCategorySummaries().length;
  const folderCount = getFolderSummaries().length;
  const items = [
    ["공개 비율", `${Math.round((publicCount / total) * 100)}%`, publicCount / total],
    ["비공개 비율", `${Math.round((privateCount / total) * 100)}%`, privateCount / total],
    ["구조", `${categoryCount}개 카테고리 · ${folderCount}개 폴더`, Math.min(1, (categoryCount + folderCount) / 10)],
    ["최근 작성", latest ? formatDate(latest.published_at || latest.created_at) : "-", latest ? 1 : 0],
  ];

  els.status.innerHTML = items
    .map(
      ([label, value, ratio]) => `
        <article class="materials-status-item">
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
          <i aria-hidden="true"><span style="width:${Math.round(Number(ratio) * 100)}%"></span></i>
        </article>
      `
    )
    .join("");
}

function renderDashboard() {
  renderStats();
  renderMaterialSpace();
  renderRecentPosts();
  renderCategories();
  renderFolders();
  renderStatus();
}

async function loadBlogProfile(session) {
  if (!session?.access_token || !session.user?.id) return null;
  const rows = await requestRest(
    `blog_profiles?select=login_id,blog_title&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function loadTree(session) {
  const rows = await requestRest(
    `blog_trees?select=tree,trash&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  state.trashItems = normalizeTrashItems(row?.trash);
  return normalizeTree(row?.tree);
}

async function loadPosts(session, id) {
  const rows = await requestRest(
    "posts?select=id,title,body,category,folder,folder_id,folder_name,folder_path,cover_image,reading_time,author,login_id,user_id,published,published_at,created_at&order=published_at.desc&limit=1000",
    session.access_token
  );
  const posts = Array.isArray(rows) ? rows.filter((post) => belongsToUser(post, session, id)) : [];
  return filterPostsOutsideTrash(posts);
}

async function loadMaterials(session) {
  const rows = await requestRest(
    `blog_materials?select=id,user_id,login_id,title,material_type,url,content,source_post_id,created_at,updated_at&user_id=eq.${encodeURIComponent(
      session.user.id
    )}&order=created_at.desc&limit=1000`,
    session.access_token
  );
  return Array.isArray(rows) ? rows.map(normalizeMaterial) : [];
}

async function createMaterial(payload) {
  const rows = await requestRest("blog_materials", state.session.access_token, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  return normalizeMaterial(Array.isArray(rows) ? rows[0] : payload);
}

async function deleteMaterial(materialId) {
  await requestRest(
    `blog_materials?id=eq.${encodeURIComponent(materialId)}&user_id=eq.${encodeURIComponent(state.session.user.id)}`,
    state.session.access_token,
    {
      method: "DELETE",
    }
  );
}

els.materialForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = els.materialTitle?.value.trim() || "";
  if (!title) {
    els.materialTitle?.focus();
    return;
  }

  const submitButton = els.materialForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    const material = await createMaterial({
      user_id: state.session.user.id,
      login_id: state.id,
      title,
      material_type: els.materialType?.value || "note",
      url: els.materialUrl?.value.trim() || null,
      content: els.materialContent?.value.trim() || null,
    });
    state.materials = [material, ...state.materials];
    state.materialError = "";
    els.materialForm.reset();
    renderDashboard();
  } catch (error) {
    window.alert(error.message || "자료를 저장하지 못했습니다.");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

els.materialSpace?.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("[data-material-delete]");
  if (!deleteButton) return;

  const materialId = deleteButton.getAttribute("data-material-delete");
  if (!materialId || !window.confirm("자료를 삭제할까요?")) return;

  deleteButton.disabled = true;
  try {
    await deleteMaterial(materialId);
    state.materials = state.materials.filter((material) => material.id !== materialId);
    renderDashboard();
  } catch (error) {
    deleteButton.disabled = false;
    window.alert(error.message || "자료를 삭제하지 못했습니다.");
  }
});

window.blogSession?.ready.then(async (session) => {
  const id = window.blogSession.getId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }

  state.session = session;
  state.id = id;
  renderBlog(id);

  try {
    const profile = await loadBlogProfile(session);
    renderBlog(id, profile);
  } catch {
    renderBlog(id);
  }

  try {
    state.tree = await loadTree(session);
  } catch {
    state.tree = [];
    state.trashItems = [];
  }

  try {
    state.posts = await loadPosts(session, id);
  } catch (error) {
    els.recent.innerHTML = `<p class="materials-empty">${escapeHtml(error.message || "자료를 불러오지 못했습니다.")}</p>`;
    state.posts = [];
  }

  try {
    state.materials = await loadMaterials(session);
    state.materialError = "";
  } catch (error) {
    state.materials = [];
    state.materialError = error.message || "자료 공간을 불러오지 못했습니다.";
  }

  renderDashboard();
});
