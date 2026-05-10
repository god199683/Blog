const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const state = {
  session: null,
  id: "",
  materials: [],
  materialError: "",
};

const els = {
  title: document.querySelector("[data-materials-title]"),
  owner: document.querySelector("[data-materials-owner]"),
  brandTitle: document.querySelector("[data-brand-title]"),
  initials: document.querySelectorAll("[data-blog-initial]"),
  stats: document.querySelector("[data-materials-stats]"),
  materialForm: document.querySelector("[data-material-form]"),
  materialTitle: document.querySelector("[data-material-title]"),
  materialType: document.querySelector("[data-material-type]"),
  materialUrl: document.querySelector("[data-material-url]"),
  materialContent: document.querySelector("[data-material-content]"),
  materialSpace: document.querySelector("[data-materials-space]"),
  materialCount: document.querySelector("[data-materials-space-count]"),
  materialDashboard: document.querySelector("[data-materials-room-dashboard]"),
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

function getMaterialCounts() {
  return state.materials.reduce(
    (counts, material) => {
      const type = material.material_type || "note";
      counts.total += 1;
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    },
    { total: 0, note: 0, link: 0, file: 0, reference: 0 }
  );
}

function getLatestMaterial() {
  return [...state.materials].sort((a, b) => {
    const aTime = Date.parse(a.created_at || a.updated_at || "");
    const bTime = Date.parse(b.created_at || b.updated_at || "");
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  })[0];
}

function renderBlog(id, profile = null) {
  const title = profile?.blog_title || `${id}'s Blog`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  if (els.title) els.title.textContent = "자료실";
  if (els.owner) els.owner.textContent = `${id} 계정의 독립 자료실입니다.`;
  els.initials.forEach((initial) => {
    initial.textContent = id.slice(0, 1).toUpperCase();
  });
  document.title = `자료실 | ${title}`;
}

function renderStats() {
  if (!els.stats) return;

  const counts = getMaterialCounts();
  const stats = [
    ["전체 자료", counts.total],
    ["메모 자료", counts.note],
    ["링크 자료", counts.link],
    ["파일 자료", counts.file],
    ["참고 자료", counts.reference],
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

function renderMaterialDashboard() {
  if (!els.materialDashboard) return;

  const counts = getMaterialCounts();
  const latest = getLatestMaterial();
  const cards = [
    ["저장 자료", `${counts.total}`],
    ["링크 자료", `${counts.link}`],
    ["파일 자료", `${counts.file}`],
    ["최근 등록", latest ? formatDate(latest.created_at || latest.updated_at) : "-"],
  ];

  els.materialDashboard.innerHTML = cards
    .map(
      ([label, value]) => `
        <article>
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

function renderDashboard() {
  renderStats();
  renderMaterialDashboard();
  renderMaterialSpace();
}

async function loadBlogProfile(session) {
  if (!session?.access_token || !session.user?.id) return null;
  const rows = await requestRest(
    `blog_profiles?select=login_id,blog_title&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    session.access_token
  );
  return Array.isArray(rows) ? rows[0] : null;
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
    state.materials = await loadMaterials(session);
    state.materialError = "";
  } catch (error) {
    state.materials = [];
    state.materialError = error.message || "자료실을 불러오지 못했습니다.";
  }

  renderDashboard();
});
