const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const DEFAULT_MAP = {
  kind: "blog-map",
  version: 1,
  width: 32,
  height: 20,
  tileSize: 32,
  cells: {},
  markers: [],
  note: "",
};

const PALETTE = [
  { id: "plain", label: "기본", color: "#f8fcff" },
  { id: "sky", label: "하늘", color: "#dff4ff" },
  { id: "water", label: "물", color: "#8bd3ff" },
  { id: "grass", label: "풀", color: "#b9f3c7" },
  { id: "road", label: "길", color: "#e7edf4" },
  { id: "stone", label: "돌", color: "#b8c7d4" },
  { id: "wall", label: "벽", color: "#436174" },
  { id: "warm", label: "장소", color: "#ffe4b8" },
];

const state = {
  session: null,
  id: "",
  spaceId: new URLSearchParams(window.location.search).get("space") || "",
  space: null,
  map: structuredClone(DEFAULT_MAP),
  tool: "brush",
  tile: PALETTE[1],
  zoom: 1,
  isDrawing: false,
};

const els = {
  brandTitle: document.querySelector("[data-map-brand-title]"),
  initials: document.querySelectorAll("[data-map-brand-initial]"),
  title: document.querySelector("[data-map-title]"),
  note: document.querySelector("[data-map-note]"),
  canvas: document.querySelector("[data-map-canvas]"),
  palette: document.querySelector("[data-map-palette]"),
  markerList: document.querySelector("[data-map-marker-list]"),
  width: document.querySelector("[data-map-width]"),
  height: document.querySelector("[data-map-height]"),
  resize: document.querySelector("[data-map-resize]"),
  zoom: document.querySelector("[data-map-zoom]"),
  save: document.querySelector("[data-map-save]"),
  reset: document.querySelector("[data-map-reset]"),
  saveState: document.querySelector("[data-map-save-state]"),
  toolButtons: document.querySelectorAll("[data-map-tool]"),
};

const ctx = els.canvas?.getContext("2d");

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
  if (!response.ok) throw new Error(payload?.message || "맵 정보를 불러오지 못했습니다.");
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

function cloneMap(map = DEFAULT_MAP) {
  return {
    ...structuredClone(DEFAULT_MAP),
    ...map,
    cells: map.cells && typeof map.cells === "object" ? map.cells : {},
    markers: Array.isArray(map.markers) ? map.markers : [],
  };
}

function parseMapContent(content = "") {
  try {
    const parsed = JSON.parse(content || "");
    if (parsed?.kind === "blog-map") return cloneMap(parsed);
  } catch {}
  return {
    ...structuredClone(DEFAULT_MAP),
    note: String(content || ""),
  };
}

function setSaveState(text, type = "") {
  if (!els.saveState) return;
  els.saveState.textContent = text;
  els.saveState.dataset.type = type;
}

function syncBrand() {
  const title = `${state.id || "Blog"}'s 자료실`;
  if (els.brandTitle) els.brandTitle.textContent = title;
  els.initials.forEach((initial) => {
    initial.textContent = (state.id || "B").slice(0, 1).toUpperCase();
  });
}

function getCellFromEvent(event) {
  if (!els.canvas) return null;
  const rect = els.canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / (state.map.tileSize * state.zoom));
  const y = Math.floor((event.clientY - rect.top) / (state.map.tileSize * state.zoom));
  if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) return null;
  return { x, y };
}

function getCellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function drawMap() {
  if (!ctx || !els.canvas) return;
  const tile = state.map.tileSize * state.zoom;
  els.canvas.width = Math.ceil(state.map.width * tile);
  els.canvas.height = Math.ceil(state.map.height * tile);

  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.fillStyle = "#fbfdff";
  ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);

  Object.entries(state.map.cells || {}).forEach(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = cell.color || "#dff4ff";
    ctx.fillRect(x * tile, y * tile, tile, tile);
  });

  ctx.strokeStyle = "rgba(186, 230, 253, 0.75)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.map.width; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * tile + 0.5, 0);
    ctx.lineTo(x * tile + 0.5, state.map.height * tile);
    ctx.stroke();
  }
  for (let y = 0; y <= state.map.height; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * tile + 0.5);
    ctx.lineTo(state.map.width * tile, y * tile + 0.5);
    ctx.stroke();
  }

  state.map.markers.forEach((marker) => {
    const cx = marker.x * tile + tile / 2;
    const cy = marker.y * tile + tile / 2;
    ctx.fillStyle = marker.color || "#0284c7";
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(5, tile * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#17324a";
    ctx.font = `${Math.max(10, 12 * state.zoom)}px sans-serif`;
    ctx.fillText(marker.label || "표식", cx + tile * 0.22, cy + 4);
  });
}

function renderPalette() {
  if (!els.palette) return;
  els.palette.innerHTML = PALETTE.map(
    (tile) => `
      <button class="${tile.id === state.tile.id ? "is-active" : ""}" type="button" data-tile="${escapeHtml(tile.id)}" title="${escapeHtml(tile.label)}" aria-label="${escapeHtml(tile.label)}">
        <span style="background:${escapeHtml(tile.color)}"></span>
      </button>
    `
  ).join("");
}

function renderMarkers() {
  if (!els.markerList) return;
  if (state.map.markers.length === 0) {
    els.markerList.innerHTML = `<p>표식이 없습니다.</p>`;
    return;
  }
  els.markerList.innerHTML = state.map.markers
    .map(
      (marker) => `
        <button type="button" data-marker-remove="${escapeHtml(marker.id)}">
          <span>${escapeHtml(marker.label || "표식")}</span>
          <small>${marker.x + 1}, ${marker.y + 1}</small>
        </button>
      `
    )
    .join("");
}

function renderAll() {
  if (els.title) els.title.value = state.space?.title || "";
  if (els.note) els.note.value = state.map.note || "";
  if (els.width) els.width.value = String(state.map.width);
  if (els.height) els.height.value = String(state.map.height);
  renderPalette();
  renderMarkers();
  drawMap();
}

function setTool(tool) {
  state.tool = tool;
  els.toolButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mapTool === tool));
  });
}

function applyTool(cell) {
  if (!cell) return;
  const key = getCellKey(cell);

  if (state.tool === "erase") {
    delete state.map.cells[key];
    state.map.markers = state.map.markers.filter((marker) => marker.x !== cell.x || marker.y !== cell.y);
    renderMarkers();
    drawMap();
    return;
  }

  if (state.tool === "marker" || state.tool === "label") {
    const label = window.prompt(state.tool === "label" ? "글자를 입력해주세요." : "표식 이름을 입력해주세요.", "");
    if (!label) return;
    state.map.markers.push({
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      type: state.tool,
      x: cell.x,
      y: cell.y,
      label: label.slice(0, 40),
      color: state.tool === "label" ? "#0f3f61" : "#0284c7",
    });
    renderMarkers();
    drawMap();
    return;
  }

  state.map.cells[key] = {
    tile: state.tile.id,
    color: state.tile.color,
  };
  drawMap();
}

async function loadSpace(session) {
  const rows = await requestRest(
    `blog_materials?select=id,title,content,material_type&user_id=eq.${encodeURIComponent(session.user.id)}&id=eq.${encodeURIComponent(state.spaceId)}&limit=1`,
    session.access_token
  );
  const space = Array.isArray(rows) ? rows[0] : null;
  if (!space || space.material_type !== "space") throw new Error("공간 정보를 찾지 못했습니다.");
  return space;
}

async function saveMap() {
  if (!state.spaceId || !state.session?.access_token) return;
  const title = els.title?.value.trim() || "이름 없는 공간";
  state.map.note = els.note?.value.trim() || "";
  setSaveState("저장 중...");
  await requestRest(
    `blog_materials?id=eq.${encodeURIComponent(state.spaceId)}&user_id=eq.${encodeURIComponent(state.session.user.id)}`,
    state.session.access_token,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        title,
        content: JSON.stringify(state.map),
        updated_at: new Date().toISOString(),
      }),
    }
  );
  state.space.title = title;
  setSaveState("저장됨", "success");
}

els.toolButtons.forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.mapTool || "brush"));
});

els.palette?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tile]");
  if (!button) return;
  const tile = PALETTE.find((item) => item.id === button.dataset.tile);
  if (!tile) return;
  state.tile = tile;
  renderPalette();
});

els.canvas?.addEventListener("pointerdown", (event) => {
  state.isDrawing = true;
  els.canvas.setPointerCapture?.(event.pointerId);
  applyTool(getCellFromEvent(event));
});

els.canvas?.addEventListener("pointermove", (event) => {
  if (!state.isDrawing || state.tool === "marker" || state.tool === "label") return;
  applyTool(getCellFromEvent(event));
});

window.addEventListener("pointerup", () => {
  state.isDrawing = false;
});

els.markerList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-marker-remove]");
  if (!button) return;
  state.map.markers = state.map.markers.filter((marker) => marker.id !== button.dataset.markerRemove);
  renderMarkers();
  drawMap();
});

els.resize?.addEventListener("click", () => {
  const width = Math.min(80, Math.max(8, Number(els.width?.value || state.map.width)));
  const height = Math.min(60, Math.max(8, Number(els.height?.value || state.map.height)));
  state.map.width = width;
  state.map.height = height;
  Object.keys(state.map.cells).forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    if (x >= width || y >= height) delete state.map.cells[key];
  });
  state.map.markers = state.map.markers.filter((marker) => marker.x < width && marker.y < height);
  renderAll();
});

els.zoom?.addEventListener("input", () => {
  state.zoom = Number(els.zoom.value || 1);
  drawMap();
});

els.save?.addEventListener("click", async () => {
  try {
    await saveMap();
  } catch (error) {
    setSaveState(error.message || "저장 실패", "error");
  }
});

els.reset?.addEventListener("click", () => {
  if (!window.confirm("맵을 초기화할까요?")) return;
  state.map = structuredClone(DEFAULT_MAP);
  renderAll();
});

window.blogSession?.ready.then(async (session) => {
  const id = window.blogSession.getId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }
  if (!state.spaceId) {
    window.location.href = "./materials.html";
    return;
  }

  state.session = session;
  state.id = id;
  syncBrand();
  setTool("brush");

  try {
    state.space = await loadSpace(session);
    state.map = parseMapContent(state.space.content || "");
    document.title = `${state.space.title || "맵 제작"} | 자료실`;
    renderAll();
    setSaveState("저장 준비");
  } catch (error) {
    window.alert(error.message || "공간을 불러오지 못했습니다.");
    window.location.href = "./materials.html";
  }
});
