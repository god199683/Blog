const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const state = {
  session: null,
  id: "",
  materials: [],
  selectedIds: new Set(),
  selectionMode: false,
  busy: false,
};

const els = {
  summary: document.querySelector("[data-materials-trash-summary]"),
  status: document.querySelector("[data-materials-trash-status]"),
  list: document.querySelector("[data-materials-trash-list]"),
  selectionToggle: document.querySelector("[data-materials-trash-selection-toggle]"),
  restore: document.querySelector("[data-materials-trash-restore]"),
  deleteSelected: document.querySelector("[data-materials-trash-delete-selected]"),
  empty: document.querySelector("[data-materials-trash-empty]"),
  brandTitle: document.querySelector("[data-brand-title]"),
  initials: document.querySelectorAll("[data-blog-initial]"),
};

async function getFreshTrashSession() {
  const fresh = (await window.blogSession?.refresh?.()) || state.session;
  if (fresh?.access_token) {
    state.session = fresh;
    state.id = window.blogSession?.getId?.(fresh) || state.id;
  }
  return fresh;
}

async function requestRest(path, token, options = {}, retry = true) {
  const session = await getFreshTrashSession();
  const requestToken = session?.access_token || token || SUPABASE_ANON_KEY;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${requestToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.details || "자료실 휴지통 요청을 처리하지 못했습니다.";
    if (retry && /jwt expired|invalid jwt|expired/i.test(message)) {
      await window.blogSession?.refresh?.();
      return requestRest(path, token, options, false);
    }
    throw new Error(message);
  }
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
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
    deleted_at: row.deleted_at || "",
  };
}

function renderBlog(id, profile = null) {
  const title = profile?.blog_title || `${id}'s Blog`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  els.initials.forEach((initial) => {
    initial.textContent = id.slice(0, 1).toUpperCase();
  });
  document.title = `자료실 휴지통 | ${title}`;
}

function renderActions() {
  const hasItems = state.materials.length > 0;
  const selectedCount = state.selectedIds.size;
  els.selectionToggle?.classList.toggle("is-active", state.selectionMode);
  if (els.restore) els.restore.disabled = state.busy || selectedCount === 0;
  if (els.deleteSelected) els.deleteSelected.disabled = state.busy || selectedCount === 0;
  if (els.empty) els.empty.disabled = state.busy || !hasItems;
}

function renderTrash() {
  const count = state.materials.length;
  const selectedCount = state.selectedIds.size;
  if (els.summary) {
    els.summary.textContent =
      count === 0
        ? "삭제된 자료가 없습니다."
        : `${count}개의 삭제된 자료가 있습니다.${selectedCount ? ` ${selectedCount}개 선택됨.` : ""}`;
  }

  renderActions();
  if (!els.list) return;

  if (count === 0) {
    els.list.innerHTML = `
      <div class="trash-page-empty">
        <h2>자료실 휴지통이 비어 있습니다</h2>
        <p>자료실에서 삭제한 자료가 이곳에 따로 모입니다.</p>
      </div>
    `;
    return;
  }

  els.list.innerHTML = state.materials
    .map((material) => {
      const isSelected = state.selectedIds.has(material.id);
      const content = String(material.content || "").trim();
      const url = String(material.url || "").trim();
      const dateLabel = formatDate(material.deleted_at || material.updated_at);
      const checkbox = state.selectionMode
        ? `<input class="trash-check" type="checkbox" data-materials-trash-check="${escapeHtml(material.id)}" ${
            isSelected ? "checked" : ""
          } aria-label="${escapeHtml(material.title)} 선택">`
        : "";

      return `
        <article class="trash-page-item ${isSelected ? "is-selected" : ""}" data-materials-trash-item="${escapeHtml(
          material.id
        )}" tabindex="0">
          ${checkbox}
          <div class="trash-page-item-main">
            <h2>${escapeHtml(material.title)}</h2>
            <p>${escapeHtml(getMaterialTypeLabel(material.material_type))} · 삭제일 ${escapeHtml(dateLabel)}</p>
            ${content ? `<p>${escapeHtml(content)}</p>` : ""}
            ${url ? `<div class="trash-page-posts"><span class="trash-page-post-link is-static"><span>${escapeHtml(url)}</span></span></div>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadBlogProfile(session) {
  if (!session?.access_token || !session.user?.id) return null;
  const rows = await requestRest(
    `blog_profiles?select=login_id,blog_title&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function loadTrashedMaterials(session) {
  const rows = await requestRest(
    `blog_materials?select=id,user_id,login_id,title,material_type,url,content,created_at,updated_at,deleted_at&user_id=eq.${encodeURIComponent(
      session.user.id
    )}&deleted_at=not.is.null&order=deleted_at.desc&limit=1000`,
    session.access_token
  );
  return Array.isArray(rows) ? rows.map(normalizeMaterial) : [];
}

async function restoreMaterial(materialId) {
  await requestRest(
    `blog_materials?id=eq.${encodeURIComponent(materialId)}&user_id=eq.${encodeURIComponent(state.session.user.id)}`,
    state.session.access_token,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        deleted_at: null,
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

async function permanentlyDeleteMaterial(materialId) {
  await requestRest(
    `blog_materials?id=eq.${encodeURIComponent(materialId)}&user_id=eq.${encodeURIComponent(state.session.user.id)}`,
    state.session.access_token,
    {
      method: "DELETE",
    }
  );
}

async function runBatch(ids, action, successMessage, errorMessage) {
  if (state.busy || ids.length === 0) return;
  state.busy = true;
  renderActions();

  try {
    for (const id of ids) {
      await action(id);
    }
    const idSet = new Set(ids);
    state.materials = state.materials.filter((material) => !idSet.has(material.id));
    state.selectedIds.clear();
    if (state.materials.length === 0) state.selectionMode = false;
    if (els.status) els.status.textContent = successMessage;
  } catch (error) {
    if (els.status) els.status.textContent = error.message || errorMessage;
  } finally {
    state.busy = false;
    renderTrash();
  }
}

function getSelectedIds() {
  return [...state.selectedIds].filter((id) => state.materials.some((material) => material.id === id));
}

function toggleSelection(id) {
  if (!id) return;
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
  } else {
    state.selectedIds.add(id);
  }
  renderTrash();
}

els.selectionToggle?.addEventListener("click", () => {
  state.selectionMode = !state.selectionMode;
  state.selectedIds.clear();
  renderTrash();
});

els.restore?.addEventListener("click", async () => {
  const ids = getSelectedIds();
  if (ids.length === 0 || !window.confirm("선택한 자료를 복원할까요?")) return;
  await runBatch(ids, restoreMaterial, "선택한 자료를 복원했습니다.", "자료를 복원하지 못했습니다.");
});

els.deleteSelected?.addEventListener("click", async () => {
  const ids = getSelectedIds();
  if (ids.length === 0 || !window.confirm("내용을 정말로 삭제할까요?")) return;
  await runBatch(ids, permanentlyDeleteMaterial, "선택한 자료를 완전히 삭제했습니다.", "자료를 삭제하지 못했습니다.");
});

els.empty?.addEventListener("click", async () => {
  const ids = state.materials.map((material) => material.id).filter(Boolean);
  if (ids.length === 0 || !window.confirm("내용을 정말로 삭제할까요?")) return;
  await runBatch(ids, permanentlyDeleteMaterial, "자료실 휴지통을 비웠습니다.", "자료실 휴지통을 비우지 못했습니다.");
});

els.list?.addEventListener("click", (event) => {
  const checkbox = event.target.closest("[data-materials-trash-check]");
  if (checkbox) {
    if (checkbox.checked) {
      state.selectedIds.add(checkbox.dataset.materialsTrashCheck);
    } else {
      state.selectedIds.delete(checkbox.dataset.materialsTrashCheck);
    }
    renderTrash();
    return;
  }

  const item = event.target.closest("[data-materials-trash-item]");
  if (!item) return;
  if (!state.selectionMode) state.selectionMode = true;
  toggleSelection(item.dataset.materialsTrashItem);
});

els.list?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const item = event.target.closest("[data-materials-trash-item]");
  if (!item) return;
  event.preventDefault();
  if (!state.selectionMode) state.selectionMode = true;
  toggleSelection(item.dataset.materialsTrashItem);
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
    state.materials = await loadTrashedMaterials(session);
    if (els.status) els.status.textContent = "";
  } catch (error) {
    state.materials = [];
    if (els.status) els.status.textContent = error.message || "자료실 휴지통을 불러오지 못했습니다.";
  }

  renderTrash();
});
