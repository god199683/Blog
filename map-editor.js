const SUPABASE_URL = "https://ipylqxcmajrwtvvmrvfy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlweWxxeGNtYWpyd3R2dm1ydmZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTM2ODMsImV4cCI6MjA5MzU2OTY4M30.v0s8RWMeMwqHGdL_1qey--PQGq67x0ltTojSxfV7T3M";

const DEFAULT_MAP = {
  kind: "blog-map",
  version: 3,
  width: 32,
  height: 20,
  tileSize: 32,
  canvasWidth: 1152,
  canvasHeight: 648,
  background: "#ffffff",
  cells: {},
  strokes: [],
  shapes: [],
  markers: [],
  layers: [],
  slides: [],
  activeSlideIndex: 0,
  zones: [],
  creatures: [],
  relations: [],
  appearances: [],
  abilities: [],
  titles: [],
  creations: [],
  items: [],
  manaStones: [],
  byproducts: [],
  accessKeys: [],
  settings: {},
  note: "",
};

const PALETTE = [
  "#000000",
  "#3b3b3b",
  "#7f7f7f",
  "#a31525",
  "#d83b01",
  "#ff7a45",
  "#fff100",
  "#22b14c",
  "#00a2e8",
  "#3f48cc",
  "#a349a4",
  "#ffffff",
  "#c8c8c8",
  "#b97a57",
  "#ffc90e",
  "#efe4b0",
  "#b5e61d",
  "#99d9ea",
  "#7092be",
  "#c8bfe7",
  "#f5f7fb",
  "#e5e7eb",
  "#fce7f3",
  "#fde68a",
  "#dcfce7",
  "#e0f2fe",
  "#dbeafe",
  "#ede9fe",
];

const SHAPE_LABELS = {
  line: "선",
  curve: "곡선",
  ellipse: "원",
  rectangle: "사각형",
  roundrect: "둥근 사각형",
  freeform: "자유 도형",
  triangle: "삼각형",
  "right-triangle": "직각 삼각형",
  diamond: "마름모",
  pentagon: "오각형",
  hexagon: "육각형",
  "arrow-right": "오른쪽 화살표",
  "arrow-left": "왼쪽 화살표",
  "arrow-up": "위쪽 화살표",
  "arrow-down": "아래쪽 화살표",
  star: "별",
  burst: "번쩍임",
  speech: "말풍선",
  cloud: "구름",
  image: "이미지",
};

const MIN_CANVAS_WIDTH = 320;
const MIN_CANVAS_HEIGHT = 240;
const MAX_CANVAS_WIDTH = 6000;
const MAX_CANVAS_HEIGHT = 4200;
const CANVAS_GROW_WIDTH = 240;
const CANVAS_GROW_HEIGHT = 160;
const HISTORY_LIMIT = 70;

const imageCache = new Map();

const state = {
  session: null,
  id: "",
  spaceId: new URLSearchParams(window.location.search).get("space") || "",
  space: null,
  map: structuredClone(DEFAULT_MAP),
  tool: "brush",
  shapeType: "line",
  primaryColor: "#000000",
  secondaryColor: "#ffffff",
  activeColorRole: "primary",
  brushSize: 6,
  brushStyle: "round",
  opacity: 1,
  zoom: 1,
  lineStyle: "solid",
  shapeFill: false,
  textFontFamily: "Malgun Gothic",
  textFontSize: 18,
  textBold: true,
  textItalic: false,
  textUnderline: false,
  selectedShapeId: "",
  isDrawing: false,
  currentStroke: null,
  currentShape: null,
  selection: null,
  selectionStart: null,
  resizeDrag: null,
  history: [],
  redo: [],
  activeSlideIndex: 0,
  layerDockOpen: true,
  ribbonCollapsed: localStorage.getItem("mapEditorRibbon") === "collapsed",
};

const els = {
  title: document.querySelector("[data-map-title]"),
  note: document.querySelector("[data-map-note]"),
  canvas: document.querySelector("[data-map-canvas]"),
  canvasWrap: document.querySelector("[data-map-canvas-wrap]"),
  canvasFrame: document.querySelector("[data-map-canvas-frame]"),
  canvasStage: document.querySelector("[data-map-canvas-stage]"),
  slidePane: document.querySelector("[data-map-slide-pane]") || document.querySelector(".paint-slide-pane"),
  thumbnail: document.querySelector("[data-map-thumbnail]"),
  slideTitle: document.querySelector("[data-map-slide-title]"),
  palette: document.querySelector("[data-map-palette]"),
  layerList: document.querySelector("[data-map-layer-list]"),
  layerDock: document.querySelector("[data-map-layer-dock]"),
  width: document.querySelector("[data-map-width]"),
  height: document.querySelector("[data-map-height]"),
  brushSize: document.querySelector("[data-map-brush-size]"),
  brushValue: document.querySelector("[data-map-brush-value]"),
  brushStyle: document.querySelector("[data-map-brush-style]"),
  opacity: document.querySelector("[data-map-opacity]"),
  opacityValue: document.querySelector("[data-map-opacity-value]"),
  zoom: document.querySelector("[data-map-zoom]"),
  zoomSelect: document.querySelector("[data-map-zoom-select]"),
  saveState: document.querySelector("[data-map-save-state]"),
  status: document.querySelector("[data-map-status]"),
  pointer: document.querySelector("[data-map-pointer]"),
  ribbonToggle: document.querySelector("[data-map-ribbon-toggle]"),
  primaryPreview: document.querySelector("[data-map-primary-preview]"),
  secondaryPreview: document.querySelector("[data-map-secondary-preview]"),
  customColor: document.querySelector("[data-map-custom-color]"),
  drawColor: document.querySelector("[data-map-draw-color]"),
  drawColorPreview: document.querySelector("[data-map-draw-color-preview]"),
  imageInput: document.querySelector("[data-map-image-input]"),
  dashboardLink: document.querySelector("[data-map-dashboard-link]"),
  fontFamily: document.querySelector("[data-map-font-family]"),
  fontSize: document.querySelector("[data-map-font-size]"),
  textColor: document.querySelector("[data-map-text-color]"),
  fillPalette: document.querySelector("[data-map-fill-palette]"),
  fillStandard: document.querySelector("[data-map-fill-standard]"),
  outlinePalette: document.querySelector("[data-map-outline-palette]"),
  outlineStandard: document.querySelector("[data-map-outline-standard]"),
  toolButtons: document.querySelectorAll("[data-map-tool]"),
  shapeButtons: document.querySelectorAll("[data-map-shape]"),
  fillToggle: document.querySelector("[data-map-fill-toggle]"),
  lineStyle: document.querySelector("[data-map-line-style]"),
  resizeHandles: document.querySelectorAll("[data-map-resize-handle]"),
};

const ctx = els.canvas?.getContext("2d", { willReadFrequently: true });

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

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function clampCanvasPixels(value, min, max) {
  return Math.round(clampNumber(value, min, max));
}

function createId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function snapshotMap(map = state.map) {
  if (map === state.map) syncActiveSlideFromMap();
  return structuredClone(map);
}

function pushHistory() {
  state.history.push(snapshotMap());
  if (state.history.length > HISTORY_LIMIT) state.history.shift();
  state.redo = [];
}

function restoreMap(map) {
  state.map = cloneMap(map);
  state.activeSlideIndex = normalizeSlideIndex(state.map.activeSlideIndex, state.map.slides);
  state.map.activeSlideIndex = state.activeSlideIndex;
  state.currentShape = null;
  state.currentStroke = null;
  state.selection = null;
  renderAll();
}

function undo() {
  if (state.history.length === 0) return;
  state.redo.push(snapshotMap());
  restoreMap(state.history.pop());
  setSaveState("되돌림");
}

function redo() {
  if (state.redo.length === 0) return;
  state.history.push(snapshotMap());
  restoreMap(state.redo.pop());
  setSaveState("다시 실행");
}

function getCanvasWidth(map = state.map) {
  return clampCanvasPixels(map.canvasWidth || map.width * map.tileSize, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
}

function getCanvasHeight(map = state.map) {
  return clampCanvasPixels(map.canvasHeight || map.height * map.tileSize, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT);
}

function normalizePoint(point = {}) {
  return {
    x: Number(point.x) || 0,
    y: Number(point.y) || 0,
  };
}

function normalizeStroke(stroke = {}) {
  return {
    id: stroke.id || createId(),
    tool: stroke.tool === "erase" ? "erase" : "brush",
    color: stroke.color || "#000000",
    width: clampNumber(stroke.width || 6, 1, 96),
    opacity: clampNumber(stroke.opacity ?? 1, 0.1, 1),
    brushStyle: ["round", "square", "soft"].includes(stroke.brushStyle) ? stroke.brushStyle : "round",
    points: Array.isArray(stroke.points) ? stroke.points.map(normalizePoint) : [],
  };
}

function normalizeMarker(marker = {}) {
  return {
    id: marker.id || createId(),
    type: marker.type === "label" || marker.type === "text" ? "label" : "marker",
    x: Number(marker.x) || 0,
    y: Number(marker.y) || 0,
    label: String(marker.label || "표식").slice(0, 80),
    color: marker.color || "#0284c7",
    fontFamily: marker.fontFamily || "Malgun Gothic",
    fontSize: clampNumber(marker.fontSize || 18, 8, 96),
    bold: marker.bold !== false,
    italic: Boolean(marker.italic),
    underline: Boolean(marker.underline),
  };
}

function normalizeShape(shape = {}) {
  return {
    id: shape.id || createId(),
    type: SHAPE_LABELS[shape.type] ? shape.type : "rectangle",
    x: Number(shape.x) || 0,
    y: Number(shape.y) || 0,
    width: Number(shape.width) || 0,
    height: Number(shape.height) || 0,
    color: shape.color || "#000000",
    fillColor: shape.fillColor || "transparent",
    filled: Boolean(shape.filled),
    lineWidth: clampNumber(shape.lineWidth || 3, 1, 96),
    opacity: clampNumber(shape.opacity ?? 1, 0.1, 1),
    lineStyle: ["dash", "none"].includes(shape.lineStyle) ? shape.lineStyle : "solid",
    src: shape.src || "",
  };
}

function normalizeLayer(layer = {}, index = 0) {
  return {
    id: layer.id || createId(),
    name: String(layer.name || `레이어 ${index + 1}`).slice(0, 80),
    visible: layer.visible !== false,
    createdAt: layer.createdAt || layer.created_at || new Date().toISOString(),
  };
}

function normalizeSlide(slide = {}, index = 0) {
  return {
    id: slide.id || createId(),
    title: String(slide.title || slide.name || `슬라이드 ${index + 1}`).slice(0, 80),
    background: slide.background || DEFAULT_MAP.background,
    cells: slide.cells && typeof slide.cells === "object" ? structuredClone(slide.cells) : {},
    strokes: Array.isArray(slide.strokes) ? slide.strokes.map(normalizeStroke).filter((stroke) => stroke.points.length > 0) : [],
    shapes: Array.isArray(slide.shapes) ? slide.shapes.map(normalizeShape) : [],
    markers: Array.isArray(slide.markers) ? slide.markers.map(normalizeMarker) : [],
    layers: Array.isArray(slide.layers) ? slide.layers.map(normalizeLayer) : [],
  };
}

function normalizeSlideIndex(index, slides = []) {
  const count = Math.max(1, slides.length);
  const parsed = Number.parseInt(index, 10);
  return Math.min(count - 1, Math.max(0, Number.isFinite(parsed) ? parsed : 0));
}

function cloneMap(map = DEFAULT_MAP) {
  const tileSize = Number(map.tileSize) || DEFAULT_MAP.tileSize;
  const legacyWidth = Number(map.width) || DEFAULT_MAP.width;
  const legacyHeight = Number(map.height) || DEFAULT_MAP.height;
  const hasCanvasSize = Number.isFinite(Number(map.canvasWidth)) && Number.isFinite(Number(map.canvasHeight));
  const canvasWidth = hasCanvasSize ? Number(map.canvasWidth) : legacyWidth * tileSize;
  const canvasHeight = hasCanvasSize ? Number(map.canvasHeight) : legacyHeight * tileSize;
  const slides = (Array.isArray(map.slides) && map.slides.length ? map.slides : [map]).map(normalizeSlide);
  const activeSlideIndex = normalizeSlideIndex(map.activeSlideIndex ?? map.currentSlideIndex ?? 0, slides);
  const activeSlide = slides[activeSlideIndex] || normalizeSlide(map, 0);

  return {
    ...structuredClone(DEFAULT_MAP),
    ...map,
    kind: "blog-map",
    version: 3,
    tileSize,
    canvasWidth: clampCanvasPixels(canvasWidth, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH),
    canvasHeight: clampCanvasPixels(canvasHeight, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT),
    width: Math.ceil(clampCanvasPixels(canvasWidth, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH) / tileSize),
    height: Math.ceil(clampCanvasPixels(canvasHeight, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT) / tileSize),
    background: activeSlide.background,
    cells: structuredClone(activeSlide.cells),
    strokes: structuredClone(activeSlide.strokes),
    shapes: structuredClone(activeSlide.shapes),
    markers: structuredClone(activeSlide.markers),
    layers: structuredClone(activeSlide.layers),
    slides,
    activeSlideIndex,
    zones: Array.isArray(map.zones) ? map.zones : [],
    creatures: Array.isArray(map.creatures) ? map.creatures : [],
    byproducts: Array.isArray(map.byproducts) ? map.byproducts : [],
    accessKeys: Array.isArray(map.accessKeys) ? map.accessKeys : [],
    settings: map.settings && typeof map.settings === "object" ? map.settings : {},
    note: String(map.note || ""),
  };
}

function createSlideFromMap(map = state.map, index = 0) {
  const existing = Array.isArray(map.slides) ? map.slides[index] : null;
  return normalizeSlide(
    {
      id: existing?.id,
      title: existing?.title || `슬라이드 ${index + 1}`,
      background: map.background,
      cells: map.cells,
      strokes: map.strokes,
      shapes: map.shapes,
      markers: map.markers,
      layers: map.layers,
    },
    index
  );
}

function createBlankSlide(index = 0) {
  return normalizeSlide({ title: `슬라이드 ${index + 1}` }, index);
}

function ensureSlides() {
  const slides = Array.isArray(state.map.slides) && state.map.slides.length ? state.map.slides : [createSlideFromMap(state.map, 0)];
  state.map.slides = slides.map(normalizeSlide);
  state.activeSlideIndex = normalizeSlideIndex(state.map.activeSlideIndex ?? state.activeSlideIndex, state.map.slides);
  state.map.activeSlideIndex = state.activeSlideIndex;
}

function syncActiveSlideFromMap() {
  ensureSlides();
  state.map.slides[state.activeSlideIndex] = createSlideFromMap(state.map, state.activeSlideIndex);
  state.map.activeSlideIndex = state.activeSlideIndex;
}

function applySlideToMap(index) {
  ensureSlides();
  state.activeSlideIndex = normalizeSlideIndex(index, state.map.slides);
  state.map.activeSlideIndex = state.activeSlideIndex;
  const slide = normalizeSlide(state.map.slides[state.activeSlideIndex], state.activeSlideIndex);
  state.map.slides[state.activeSlideIndex] = slide;
  state.map.background = slide.background;
  state.map.cells = structuredClone(slide.cells);
  state.map.strokes = structuredClone(slide.strokes);
  state.map.shapes = structuredClone(slide.shapes);
  state.map.markers = structuredClone(slide.markers);
  state.map.layers = structuredClone(slide.layers);
  state.currentShape = null;
  state.currentStroke = null;
  state.selection = null;
  state.selectionStart = null;
  state.selectedShapeId = "";
}

function selectSlide(index) {
  const nextIndex = normalizeSlideIndex(index, state.map.slides);
  if (nextIndex === state.activeSlideIndex) return;
  syncActiveSlideFromMap();
  applySlideToMap(nextIndex);
  renderAll();
}

function deleteSlide(index) {
  ensureSlides();
  if (state.map.slides.length <= 1) {
    window.alert("마지막 슬라이드는 삭제할 수 없습니다.");
    return;
  }

  const targetIndex = normalizeSlideIndex(index, state.map.slides);
  if (!window.confirm(`${targetIndex + 1}번 슬라이드를 삭제할까요?`)) return;

  syncActiveSlideFromMap();
  pushHistory();
  state.map.slides.splice(targetIndex, 1);

  let nextIndex = state.activeSlideIndex;
  if (targetIndex < state.activeSlideIndex) nextIndex = state.activeSlideIndex - 1;
  if (targetIndex === state.activeSlideIndex) nextIndex = Math.min(targetIndex, state.map.slides.length - 1);

  applySlideToMap(nextIndex);
  setSaveState("슬라이드 삭제");
  renderAll();
}

function parseMapContent(content = "") {
  try {
    const parsed = JSON.parse(content || "");
    if (parsed?.kind === "blog-map") return cloneMap(parsed);
  } catch {}
  return cloneMap({
    ...DEFAULT_MAP,
    note: String(content || ""),
  });
}

function setSaveState(text, type = "") {
  if (!els.saveState) return;
  els.saveState.textContent = text;
  els.saveState.dataset.type = type;
}

function setPointerText(text) {
  if (els.pointer) els.pointer.textContent = text;
}

function setActiveTool(tool) {
  state.tool = tool;
  els.toolButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mapTool === tool));
  });
  setPointerText(`${getToolLabel(tool)} 도구`);
}

function getToolLabel(tool = state.tool) {
  return (
    {
      select: "선택",
      pencil: "연필",
      brush: "브러시",
      fill: "채우기",
      text: "텍스트",
      erase: "지우개",
      picker: "색 추출",
      zoom: "확대",
      marker: "표식",
      shape: SHAPE_LABELS[state.shapeType] || "도형",
    }[tool] || "도구"
  );
}

function setShape(type) {
  state.shapeType = SHAPE_LABELS[type] ? type : "line";
  setActiveTool("shape");
  els.shapeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mapShape === state.shapeType);
  });
}

function setZoom(value) {
  state.zoom = clampNumber(value, 0.35, 2.5);
  if (els.zoom) els.zoom.value = String(state.zoom);
  if (els.zoomSelect) {
    const matching = [...els.zoomSelect.options].some((option) => Number(option.value) === state.zoom);
    els.zoomSelect.value = matching ? String(state.zoom) : "";
  }
  drawMap();
}

function syncRibbonState() {
  document.body.classList.toggle("paint-ribbon-collapsed", state.ribbonCollapsed);
  if (!els.ribbonToggle) return;
  els.ribbonToggle.textContent = state.ribbonCollapsed ? "도구 펼치기" : "도구 접기";
  els.ribbonToggle.title = state.ribbonCollapsed ? "도구 펼치기" : "도구 접기";
  els.ribbonToggle.setAttribute("aria-expanded", String(!state.ribbonCollapsed));
}

function syncControls() {
  syncRibbonState();
  if (els.title) els.title.value = state.space?.title || "";
  if (els.note) els.note.value = state.map.note || "";
  if (els.width) els.width.value = String(getCanvasWidth());
  if (els.height) els.height.value = String(getCanvasHeight());
  if (els.brushSize) els.brushSize.value = String(state.brushSize);
  if (els.brushValue) els.brushValue.textContent = String(state.brushSize);
  if (els.opacity) els.opacity.value = String(state.opacity);
  if (els.opacityValue) els.opacityValue.textContent = String(Math.round(state.opacity * 100));
  if (els.brushStyle) els.brushStyle.value = state.brushStyle;
  if (els.lineStyle) els.lineStyle.value = state.lineStyle;
  if (els.fillToggle) {
    els.fillToggle.setAttribute("aria-pressed", String(state.shapeFill));
    els.fillToggle.classList.toggle("is-active", state.shapeFill);
  }
  if (els.primaryPreview) els.primaryPreview.style.background = state.primaryColor;
  if (els.secondaryPreview) els.secondaryPreview.style.background = state.secondaryColor;
  if (els.customColor) els.customColor.value = state[state.activeColorRole === "primary" ? "primaryColor" : "secondaryColor"];
  if (els.drawColor) els.drawColor.value = state.primaryColor === "transparent" ? "#000000" : state.primaryColor;
  if (els.drawColorPreview) els.drawColorPreview.style.background = state.primaryColor === "transparent" ? "#000000" : state.primaryColor;
  if (els.dashboardLink) els.dashboardLink.href = `./space-dashboard.html?space=${encodeURIComponent(state.spaceId)}#map`;
  if (els.slideTitle) els.slideTitle.textContent = state.space?.title || els.title?.value || "공간";
  document.title = `${state.space?.title || "제목 없음"} - 프레젠테이션 편집`;
}

function updateStatus() {
  if (els.status) {
    els.status.textContent = `${getCanvasWidth()} × ${getCanvasHeight()}px`;
  }
  if (els.canvasFrame) {
    els.canvasFrame.style.width = `${Math.ceil(getCanvasWidth() * state.zoom)}px`;
    els.canvasFrame.style.height = `${Math.ceil(getCanvasHeight() * state.zoom)}px`;
  }
}

function renderPalette() {
  if (!els.palette) return;
  els.palette.innerHTML = PALETTE.map(
    (color) => `
      <button class="${color === state.primaryColor || color === state.secondaryColor ? "is-active" : ""}" type="button" data-map-color="${escapeHtml(color)}" aria-label="${escapeHtml(color)}">
        <span style="background:${escapeHtml(color)}"></span>
      </button>
    `
  ).join("");
}

function renderColorMenu(target, colors, attribute) {
  if (!target) return;
  target.innerHTML = colors
    .map(
      (color) => `
        <button type="button" data-${attribute}="${escapeHtml(color)}" title="${escapeHtml(color)}" aria-label="${escapeHtml(color)}">
          <span style="background:${escapeHtml(color)}"></span>
        </button>
      `
    )
    .join("");
}

function renderPptPalettes() {
  const theme = ["#ffffff", "#000000", "#f2f2f2", "#0f2437", "#1f5f7a", "#ed7d31", "#1f6f2d", "#1aa7d9", "#a62aa1", "#49a52c", "#d9eaf7", "#bdd7ee", "#9dc3e6", "#5b9bd5", "#1f4e79", "#fce4d6", "#f4b183", "#c55a11", "#70ad47", "#255e2b", "#e2f0d9", "#c5e0b4", "#a9d18e", "#548235"];
  const standard = ["#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0"];
  renderColorMenu(els.fillPalette, theme, "map-fill-color");
  renderColorMenu(els.fillStandard, standard, "map-fill-color");
  renderColorMenu(els.outlinePalette, theme, "map-outline-color");
  renderColorMenu(els.outlineStandard, standard, "map-outline-color");
}

function renderLayers() {
  if (!els.layerDock) return;
  els.layerDock.hidden = !state.layerDockOpen;
  document.body.classList.toggle("paint-layer-closed", !state.layerDockOpen);
  document.querySelectorAll("[data-map-layer-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.layerDockOpen));
  });
  if (!els.layerList) return;

  const layers = Array.isArray(state.map.layers) ? state.map.layers : [];

  if (layers.length === 0) {
    els.layerList.innerHTML = `<p>아직 레이어가 없습니다.</p>`;
    return;
  }

  els.layerList.innerHTML = [...layers]
    .reverse()
    .map(
      (layer) => `
        <div class="paint-layer-item">
          <span>
            <strong>${escapeHtml(layer.name || "레이어")}</strong>
            <small>${layer.visible ? "표시 중" : "숨김"}</small>
          </span>
          <button type="button" data-layer-delete="${escapeHtml(layer.id)}" aria-label="레이어 삭제">×</button>
        </div>
      `
    )
    .join("");
}

function renderSlides() {
  if (!els.slidePane) return;
  syncActiveSlideFromMap();
  const canDelete = state.map.slides.length > 1;
  els.slidePane.innerHTML = state.map.slides
    .map(
      (slide, index) => `
        <div class="paint-slide-item">
          <button class="paint-slide-thumb ppt-slide-thumb${index === state.activeSlideIndex ? " is-active" : ""}" type="button" data-map-slide-index="${index}" aria-label="${index + 1}번 슬라이드">
            <b>${index + 1}</b>
            <canvas data-map-thumbnail width="224" height="126" aria-hidden="true"></canvas>
            <span>${escapeHtml(slide.title || `슬라이드 ${index + 1}`)}</span>
          </button>
          <button class="paint-slide-delete" type="button" data-map-delete-slide="${index}" title="슬라이드 삭제" aria-label="${index + 1}번 슬라이드 삭제"${canDelete ? "" : " disabled"}>×</button>
        </div>
      `
    )
    .join("");
  drawSlideThumbnails();
}

function renderAll() {
  syncControls();
  renderPalette();
  renderLayers();
  renderSlides();
  drawMap();
}

function drawLegacyCells(targetCtx, map = state.map) {
  const tile = map.tileSize || DEFAULT_MAP.tileSize;
  Object.entries(map.cells || {}).forEach(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    targetCtx.fillStyle = cell.color || "#dff4ff";
    targetCtx.fillRect(x * tile, y * tile, tile, tile);
  });
}

function drawStroke(targetCtx, stroke, map = state.map) {
  const points = stroke.points || [];
  if (points.length === 0) return;
  targetCtx.save();
  targetCtx.globalAlpha = clampNumber(stroke.opacity ?? 1, 0.1, 1);
  targetCtx.lineJoin = "round";
  targetCtx.lineCap = stroke.brushStyle === "square" ? "butt" : "round";
  targetCtx.strokeStyle = stroke.tool === "erase" ? map.background : stroke.color || "#000000";
  targetCtx.fillStyle = targetCtx.strokeStyle;
  targetCtx.lineWidth = stroke.width || state.brushSize;
  if (stroke.brushStyle === "soft" && stroke.tool !== "erase") {
    targetCtx.shadowColor = stroke.color || "#000000";
    targetCtx.shadowBlur = Math.max(2, (stroke.width || 6) * 0.8);
  }

  if (points.length === 1) {
    targetCtx.beginPath();
    if (stroke.brushStyle === "square") {
      const size = Math.max(1, targetCtx.lineWidth);
      targetCtx.fillRect(points[0].x - size / 2, points[0].y - size / 2, size, size);
    } else {
      targetCtx.arc(points[0].x, points[0].y, Math.max(1, targetCtx.lineWidth / 2), 0, Math.PI * 2);
      targetCtx.fill();
    }
    targetCtx.restore();
    return;
  }

  targetCtx.beginPath();
  targetCtx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    targetCtx.quadraticCurveTo(previous.x, previous.y, midX, midY);
  }
  const last = points[points.length - 1];
  targetCtx.lineTo(last.x, last.y);
  targetCtx.stroke();
  targetCtx.restore();
}

function getBounds(shape) {
  const left = Math.min(shape.x, shape.x + shape.width);
  const top = Math.min(shape.y, shape.y + shape.height);
  return {
    left,
    top,
    width: Math.abs(shape.width),
    height: Math.abs(shape.height),
    right: left + Math.abs(shape.width),
    bottom: top + Math.abs(shape.height),
  };
}

function roundedRectPath(targetCtx, left, top, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  targetCtx.moveTo(left + safeRadius, top);
  targetCtx.lineTo(left + width - safeRadius, top);
  targetCtx.quadraticCurveTo(left + width, top, left + width, top + safeRadius);
  targetCtx.lineTo(left + width, top + height - safeRadius);
  targetCtx.quadraticCurveTo(left + width, top + height, left + width - safeRadius, top + height);
  targetCtx.lineTo(left + safeRadius, top + height);
  targetCtx.quadraticCurveTo(left, top + height, left, top + height - safeRadius);
  targetCtx.lineTo(left, top + safeRadius);
  targetCtx.quadraticCurveTo(left, top, left + safeRadius, top);
}

function polygonPath(targetCtx, points) {
  if (points.length === 0) return;
  targetCtx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => targetCtx.lineTo(point.x, point.y));
  targetCtx.closePath();
}

function starPoints(cx, cy, outer, inner, count) {
  const points = [];
  for (let index = 0; index < count * 2; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI) / count;
    const radius = index % 2 === 0 ? outer : inner;
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  }
  return points;
}

function arrowPath(targetCtx, bounds, direction) {
  const { left, top, width, height } = bounds;
  const right = left + width;
  const bottom = top + height;
  const midX = left + width / 2;
  const midY = top + height / 2;
  const head = Math.min(width, height) * 0.38;

  const points = {
    "arrow-right": [
      { x: left, y: top + height * 0.25 },
      { x: right - head, y: top + height * 0.25 },
      { x: right - head, y: top },
      { x: right, y: midY },
      { x: right - head, y: bottom },
      { x: right - head, y: top + height * 0.75 },
      { x: left, y: top + height * 0.75 },
    ],
    "arrow-left": [
      { x: right, y: top + height * 0.25 },
      { x: left + head, y: top + height * 0.25 },
      { x: left + head, y: top },
      { x: left, y: midY },
      { x: left + head, y: bottom },
      { x: left + head, y: top + height * 0.75 },
      { x: right, y: top + height * 0.75 },
    ],
    "arrow-up": [
      { x: left + width * 0.25, y: bottom },
      { x: left + width * 0.25, y: top + head },
      { x: left, y: top + head },
      { x: midX, y: top },
      { x: right, y: top + head },
      { x: left + width * 0.75, y: top + head },
      { x: left + width * 0.75, y: bottom },
    ],
    "arrow-down": [
      { x: left + width * 0.25, y: top },
      { x: left + width * 0.25, y: bottom - head },
      { x: left, y: bottom - head },
      { x: midX, y: bottom },
      { x: right, y: bottom - head },
      { x: left + width * 0.75, y: bottom - head },
      { x: left + width * 0.75, y: top },
    ],
  }[direction];
  polygonPath(targetCtx, points || []);
}

function getCachedImage(src) {
  if (!src) return null;
  if (imageCache.has(src)) return imageCache.get(src);
  const image = new Image();
  image.onload = drawMap;
  image.src = src;
  imageCache.set(src, image);
  return image;
}

function drawShapePath(targetCtx, shape) {
  const bounds = getBounds(shape);
  const { left, top, width, height } = bounds;
  const right = left + width;
  const bottom = top + height;
  const cx = left + width / 2;
  const cy = top + height / 2;

  targetCtx.beginPath();
  if (shape.type === "line") {
    targetCtx.moveTo(shape.x, shape.y);
    targetCtx.lineTo(shape.x + shape.width, shape.y + shape.height);
    return;
  }
  if (shape.type === "curve") {
    targetCtx.moveTo(shape.x, shape.y);
    targetCtx.quadraticCurveTo(cx, top - Math.max(24, height * 0.35), shape.x + shape.width, shape.y + shape.height);
    return;
  }
  if (shape.type === "ellipse") {
    targetCtx.ellipse(cx, cy, Math.max(1, width / 2), Math.max(1, height / 2), 0, 0, Math.PI * 2);
    return;
  }
  if (shape.type === "roundrect") {
    roundedRectPath(targetCtx, left, top, width, height, Math.min(24, width / 5, height / 5));
    targetCtx.closePath();
    return;
  }
  if (shape.type === "triangle") {
    polygonPath(targetCtx, [
      { x: cx, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ]);
    return;
  }
  if (shape.type === "right-triangle") {
    polygonPath(targetCtx, [
      { x: left, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ]);
    return;
  }
  if (shape.type === "diamond") {
    polygonPath(targetCtx, [
      { x: cx, y: top },
      { x: right, y: cy },
      { x: cx, y: bottom },
      { x: left, y: cy },
    ]);
    return;
  }
  if (shape.type === "pentagon") {
    polygonPath(targetCtx, starPoints(cx, cy, Math.min(width, height) / 2, Math.min(width, height) / 2, 5).filter((_, index) => index % 2 === 0));
    return;
  }
  if (shape.type === "hexagon") {
    polygonPath(
      targetCtx,
      Array.from({ length: 6 }, (_, index) => {
        const angle = Math.PI / 6 + (index * Math.PI * 2) / 6;
        return { x: cx + Math.cos(angle) * width * 0.48, y: cy + Math.sin(angle) * height * 0.48 };
      })
    );
    return;
  }
  if (shape.type.startsWith("arrow-")) {
    arrowPath(targetCtx, bounds, shape.type);
    return;
  }
  if (shape.type === "star") {
    polygonPath(targetCtx, starPoints(cx, cy, Math.min(width, height) / 2, Math.min(width, height) / 4, 5));
    return;
  }
  if (shape.type === "burst") {
    polygonPath(targetCtx, starPoints(cx, cy, Math.min(width, height) / 2, Math.min(width, height) / 5, 8));
    return;
  }
  if (shape.type === "speech") {
    roundedRectPath(targetCtx, left, top, width, height * 0.78, Math.min(18, width / 8, height / 8));
    targetCtx.lineTo(left + width * 0.36, top + height * 0.78);
    targetCtx.lineTo(left + width * 0.25, bottom);
    targetCtx.lineTo(left + width * 0.55, top + height * 0.78);
    targetCtx.closePath();
    return;
  }
  if (shape.type === "cloud") {
    targetCtx.ellipse(left + width * 0.32, top + height * 0.55, width * 0.24, height * 0.24, 0, 0, Math.PI * 2);
    targetCtx.ellipse(left + width * 0.5, top + height * 0.4, width * 0.28, height * 0.28, 0, 0, Math.PI * 2);
    targetCtx.ellipse(left + width * 0.68, top + height * 0.57, width * 0.25, height * 0.22, 0, 0, Math.PI * 2);
    targetCtx.rect(left + width * 0.24, top + height * 0.48, width * 0.52, height * 0.32);
    return;
  }
  if (shape.type === "freeform") {
    polygonPath(targetCtx, [
      { x: left + width * 0.08, y: top + height * 0.32 },
      { x: left + width * 0.4, y: top + height * 0.08 },
      { x: right - width * 0.08, y: top + height * 0.28 },
      { x: right - width * 0.18, y: bottom - height * 0.16 },
      { x: left + width * 0.2, y: bottom - height * 0.08 },
    ]);
    return;
  }
  targetCtx.rect(left, top, width, height);
}

function drawShape(targetCtx, shape) {
  const bounds = getBounds(shape);
  if (bounds.width < 1 || bounds.height < 1) return;

  if (shape.type === "image") {
    const image = getCachedImage(shape.src);
    if (image?.complete && image.naturalWidth) {
      targetCtx.save();
      targetCtx.globalAlpha = clampNumber(shape.opacity ?? 1, 0.1, 1);
      targetCtx.drawImage(image, bounds.left, bounds.top, bounds.width, bounds.height);
      targetCtx.restore();
    }
    return;
  }

  targetCtx.save();
  targetCtx.globalAlpha = clampNumber(shape.opacity ?? 1, 0.1, 1);
  targetCtx.strokeStyle = shape.color || "#000000";
  targetCtx.fillStyle = shape.fillColor || "transparent";
  targetCtx.lineWidth = shape.lineWidth || 3;
  targetCtx.lineJoin = "round";
  targetCtx.lineCap = "round";
  if (shape.lineStyle === "dash") targetCtx.setLineDash([10, 7]);
  drawShapePath(targetCtx, shape);
  if (shape.filled && shape.fillColor !== "transparent" && shape.type !== "line" && shape.type !== "curve") {
    targetCtx.fill();
  }
  targetCtx.stroke();
  targetCtx.restore();
}

function drawMarker(targetCtx, marker) {
  targetCtx.save();
  targetCtx.font = "700 15px sans-serif";
  targetCtx.textBaseline = "middle";

  if (marker.type === "label") {
    targetCtx.fillStyle = marker.color || "#0f3f61";
    targetCtx.fillText(marker.label || "텍스트", marker.x, marker.y);
    targetCtx.restore();
    return;
  }

  targetCtx.fillStyle = marker.color || "#0284c7";
  targetCtx.beginPath();
  targetCtx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.fillStyle = "#17324a";
  targetCtx.fillText(marker.label || "표식", marker.x + 12, marker.y);
  targetCtx.restore();
}

function drawSelection(targetCtx) {
  if (!state.selection) return;
  const { left, top, width, height } = normalizeRect(state.selection);
  if (width < 2 || height < 2) return;
  targetCtx.save();
  targetCtx.strokeStyle = "#0ea5e9";
  targetCtx.lineWidth = 1;
  targetCtx.setLineDash([7, 5]);
  targetCtx.strokeRect(left, top, width, height);
  targetCtx.fillStyle = "rgba(14, 165, 233, 0.08)";
  targetCtx.fillRect(left, top, width, height);
  targetCtx.restore();
}

function paintMap(targetCtx, { includeSelection = true, map = state.map } = {}) {
  const canvasWidth = getCanvasWidth(map);
  const canvasHeight = getCanvasHeight(map);
  targetCtx.fillStyle = map.background || DEFAULT_MAP.background;
  targetCtx.fillRect(0, 0, canvasWidth, canvasHeight);
  drawLegacyCells(targetCtx, map);
  (map.shapes || []).forEach((shape) => drawShape(targetCtx, shape));
  (map.strokes || []).forEach((stroke) => drawStroke(targetCtx, stroke, map));
  (map.markers || []).forEach((marker) => drawMarker(targetCtx, marker));
  if (includeSelection && map === state.map) drawSelection(targetCtx);
}

function drawMap() {
  if (!ctx || !els.canvas) return;
  const canvasWidth = getCanvasWidth();
  const canvasHeight = getCanvasHeight();
  const displayWidth = Math.ceil(canvasWidth * state.zoom);
  const displayHeight = Math.ceil(canvasHeight * state.zoom);
  els.canvas.width = displayWidth;
  els.canvas.height = displayHeight;
  els.canvas.style.width = `${displayWidth}px`;
  els.canvas.style.height = `${displayHeight}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, displayWidth, displayHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.setTransform(state.zoom, 0, 0, state.zoom, 0, 0);
  paintMap(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  updateStatus();
  drawThumbnail();
}

function getActiveThumbnailCanvas() {
  return els.slidePane?.querySelector(`[data-map-slide-index="${state.activeSlideIndex}"] [data-map-thumbnail]`) || els.thumbnail;
}

function drawThumbnailToCanvas(canvas, slide = state.map) {
  if (!canvas) return;
  const thumbCtx = canvas.getContext("2d");
  if (!thumbCtx) return;
  const map = slide === state.map ? state.map : { ...state.map, ...slide };
  const thumbWidth = canvas.width;
  const thumbHeight = canvas.height;
  const mapWidth = getCanvasWidth(map);
  const mapHeight = getCanvasHeight(map);
  const scale = Math.min((thumbWidth - 16) / mapWidth, (thumbHeight - 16) / mapHeight);
  const offsetX = (thumbWidth - mapWidth * scale) / 2;
  const offsetY = (thumbHeight - mapHeight * scale) / 2;

  thumbCtx.setTransform(1, 0, 0, 1, 0, 0);
  thumbCtx.clearRect(0, 0, thumbWidth, thumbHeight);
  thumbCtx.fillStyle = "#eef7ff";
  thumbCtx.fillRect(0, 0, thumbWidth, thumbHeight);
  thumbCtx.save();
  thumbCtx.translate(offsetX, offsetY);
  thumbCtx.scale(scale, scale);
  paintMap(thumbCtx, { includeSelection: false, map });
  thumbCtx.restore();
  thumbCtx.strokeStyle = "#b7d9ee";
  thumbCtx.strokeRect(offsetX, offsetY, mapWidth * scale, mapHeight * scale);
}

function drawSlideThumbnails() {
  if (!els.slidePane) return;
  els.slidePane.querySelectorAll("[data-map-slide-index]").forEach((button) => {
    const index = normalizeSlideIndex(button.dataset.mapSlideIndex, state.map.slides);
    drawThumbnailToCanvas(button.querySelector("[data-map-thumbnail]"), state.map.slides[index] || state.map);
  });
}

function drawThumbnail() {
  drawThumbnailToCanvas(getActiveThumbnailCanvas(), state.map);
}

function normalizeRect(rect = {}) {
  const left = Math.min(rect.x, rect.x + rect.width);
  const top = Math.min(rect.y, rect.y + rect.height);
  return {
    left,
    top,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
    right: left + Math.abs(rect.width),
    bottom: top + Math.abs(rect.height),
  };
}

function pointInRect(point, rect) {
  const box = normalizeRect(rect);
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function rectsIntersect(a, b) {
  const first = normalizeRect(a);
  const second = normalizeRect(b);
  return first.left <= second.right && first.right >= second.left && first.top <= second.bottom && first.bottom >= second.top;
}

function getPointFromEvent(event) {
  if (!els.canvas) return null;
  const rect = els.canvas.getBoundingClientRect();
  const canvasWidth = getCanvasWidth();
  const canvasHeight = getCanvasHeight();
  const x = ((event.clientX - rect.left) / rect.width) * canvasWidth;
  const y = ((event.clientY - rect.top) / rect.height) * canvasHeight;
  if (x < 0 || y < 0 || x > canvasWidth || y > canvasHeight) return null;
  return { x, y };
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function removeMarkersNearPoint(point, radius) {
  const before = state.map.markers.length;
  state.map.markers = state.map.markers.filter((marker) => distanceBetween(point, marker) > radius);
  if (before !== state.map.markers.length) renderLayers();
}

function beginStroke(point) {
  pushHistory();
  const isEraser = state.tool === "erase";
  state.currentStroke = {
    id: createId(),
    tool: isEraser ? "erase" : "brush",
    color: state.primaryColor,
    width: isEraser ? Math.max(8, state.brushSize * 2.2) : state.tool === "pencil" ? Math.max(1, state.brushSize * 0.45) : state.brushSize,
    opacity: isEraser ? 1 : state.opacity,
    brushStyle: state.brushStyle,
    points: [point],
  };
  state.map.strokes.push(state.currentStroke);
  if (isEraser) removeMarkersNearPoint(point, state.currentStroke.width);
  drawMap();
}

function appendStrokePoint(point) {
  if (!state.currentStroke || !point) return;
  const points = state.currentStroke.points;
  const previous = points[points.length - 1];
  if (previous && distanceBetween(previous, point) < 1.2) return;
  points.push(point);
  if (state.currentStroke.tool === "erase") removeMarkersNearPoint(point, state.currentStroke.width);
  drawMap();
}

function addMarker(point, type = "marker") {
  const label = window.prompt(type === "label" ? "텍스트를 입력해주세요." : "표식 이름을 입력해주세요.", "");
  if (!label) return;
  pushHistory();
  state.map.markers.push({
    id: createId(),
    type,
    x: point.x,
    y: point.y,
    label: label.slice(0, 80),
    color: type === "label" ? state.primaryColor : "#0284c7",
  });
  renderLayers();
  drawMap();
}

function beginShape(point) {
  pushHistory();
  state.currentShape = {
    id: createId(),
    type: state.shapeType,
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
    color: state.primaryColor,
    fillColor: state.shapeFill ? state.secondaryColor : "transparent",
    filled: state.shapeFill,
    lineWidth: state.brushSize,
    opacity: state.opacity,
    lineStyle: state.lineStyle,
  };
  state.map.shapes.push(state.currentShape);
  drawMap();
}

function updateShape(point) {
  if (!state.currentShape || !point) return;
  state.currentShape.width = point.x - state.currentShape.x;
  state.currentShape.height = point.y - state.currentShape.y;
  drawMap();
}

function finishShape() {
  if (!state.currentShape) return;
  if (Math.abs(state.currentShape.width) < 2 && Math.abs(state.currentShape.height) < 2) {
    state.map.shapes = state.map.shapes.filter((shape) => shape.id !== state.currentShape.id);
  }
  state.currentShape = null;
  renderLayers();
  drawMap();
}

function beginSelection(point) {
  state.selectionStart = point;
  state.selection = {
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  };
  drawMap();
}

function updateSelection(point) {
  if (!state.selection || !state.selectionStart || !point) return;
  state.selection.width = point.x - state.selectionStart.x;
  state.selection.height = point.y - state.selectionStart.y;
  drawMap();
}

function fillCanvas() {
  pushHistory();
  state.map.background = state.primaryColor;
  drawMap();
  setSaveState("배경 채움");
}

function pickColor(point) {
  if (!ctx || !point) return;
  const x = Math.round(point.x * state.zoom);
  const y = Math.round(point.y * state.zoom);
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const color = `#${[pixel[0], pixel[1], pixel[2]].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  if (state.activeColorRole === "secondary") applyFillColor(color);
  else applyOutlineColor(color);
}

function handleCanvasDown(point, event) {
  if (!point) return;
  if (state.tool === "select") {
    state.isDrawing = true;
    beginSelection(point);
    return;
  }
  if (state.tool === "fill") {
    fillCanvas();
    return;
  }
  if (state.tool === "picker") {
    pickColor(point);
    return;
  }
  if (state.tool === "zoom") {
    setZoom(event?.shiftKey ? state.zoom - 0.2 : state.zoom + 0.2);
    return;
  }
  if (state.tool === "text") {
    addMarker(point, "label");
    return;
  }
  if (state.tool === "marker") {
    addMarker(point, "marker");
    return;
  }
  state.isDrawing = true;
  if (state.tool === "shape") {
    beginShape(point);
    return;
  }
  beginStroke(point);
}

function resizeMap(width, height, { trim = true } = {}) {
  const previousWidth = getCanvasWidth();
  const previousHeight = getCanvasHeight();
  pushHistory();
  const nextWidth = clampCanvasPixels(width, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
  const nextHeight = clampCanvasPixels(height, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT);
  if (nextWidth === previousWidth && nextHeight === previousHeight) {
    state.history.pop();
    syncControls();
    return;
  }
  state.map.canvasWidth = nextWidth;
  state.map.canvasHeight = nextHeight;
  state.map.width = Math.ceil(nextWidth / state.map.tileSize);
  state.map.height = Math.ceil(nextHeight / state.map.tileSize);

  if (trim) {
    Object.keys(state.map.cells).forEach((key) => {
      const [x, y] = key.split(",").map(Number);
      if (x * state.map.tileSize >= nextWidth || y * state.map.tileSize >= nextHeight) delete state.map.cells[key];
    });
    state.map.markers = state.map.markers.filter((marker) => marker.x <= nextWidth && marker.y <= nextHeight);
  }

  renderAll();
}

function resizeMapLive(width, height) {
  const nextWidth = clampCanvasPixels(width, MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
  const nextHeight = clampCanvasPixels(height, MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT);
  state.map.canvasWidth = nextWidth;
  state.map.canvasHeight = nextHeight;
  state.map.width = Math.ceil(nextWidth / state.map.tileSize);
  state.map.height = Math.ceil(nextHeight / state.map.tileSize);
  syncControls();
  drawMap();
}

function applyResizeFromInputs() {
  const width = clampCanvasPixels(els.width?.value || getCanvasWidth(), MIN_CANVAS_WIDTH, MAX_CANVAS_WIDTH);
  const height = clampCanvasPixels(els.height?.value || getCanvasHeight(), MIN_CANVAS_HEIGHT, MAX_CANVAS_HEIGHT);
  resizeMap(width, height, { trim: false });
}

function growMap(direction = "both") {
  const addWidth = direction === "wide" || direction === "both" ? CANVAS_GROW_WIDTH : 0;
  const addHeight = direction === "tall" || direction === "both" ? CANVAS_GROW_HEIGHT : 0;
  resizeMap(getCanvasWidth() + addWidth, getCanvasHeight() + addHeight, { trim: false });
}

function fitMapToView() {
  if (!els.canvasWrap) return;
  const availableWidth = Math.max(240, els.canvasWrap.clientWidth - 84);
  const availableHeight = Math.max(180, els.canvasWrap.clientHeight - 84);
  const nextZoom = clampNumber(Math.min(availableWidth / getCanvasWidth(), availableHeight / getCanvasHeight()), 0.35, 2.5);
  setZoom(Number(nextZoom.toFixed(2)));
}

function deleteSelection() {
  if (!state.selection || normalizeRect(state.selection).width < 2 || normalizeRect(state.selection).height < 2) {
    window.alert("삭제할 영역을 먼저 선택해주세요.");
    return;
  }
  pushHistory();
  const selection = state.selection;
  const before = state.map.strokes.length + state.map.shapes.length + state.map.markers.length;
  state.map.markers = state.map.markers.filter((marker) => !pointInRect(marker, selection));
  state.map.shapes = state.map.shapes.filter((shape) => !rectsIntersect(shape, selection));
  state.map.strokes = state.map.strokes.filter((stroke) => !stroke.points.some((point) => pointInRect(point, selection)));
  state.selection = null;
  state.selectionStart = null;
  const after = state.map.strokes.length + state.map.shapes.length + state.map.markers.length;
  if (before === after) state.history.pop();
  renderAll();
}

function addLayer() {
  pushHistory();
  const nextIndex = (state.map.layers || []).length + 1;
  state.map.layers = [...(state.map.layers || []), normalizeLayer({ name: `레이어 ${nextIndex}` }, nextIndex - 1)];
  state.layerDockOpen = true;
  renderAll();
}

function deleteLayer(id = "") {
  if (!id) return;
  const before = state.map.layers?.length || 0;
  pushHistory();
  state.map.layers = (state.map.layers || []).filter((item) => item.id !== id);
  if (state.map.layers.length === before) state.history.pop();
  renderAll();
}

function importImage(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result || "");
    if (!src) return;
    const image = new Image();
    image.onload = () => {
      pushHistory();
      const maxWidth = getCanvasWidth() * 0.72;
      const maxHeight = getCanvasHeight() * 0.72;
      const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
      state.map.shapes.push({
        id: createId(),
        type: "image",
        x: 24,
        y: 24,
        width: Math.max(40, image.naturalWidth * ratio),
        height: Math.max(40, image.naturalHeight * ratio),
        color: state.primaryColor,
        fillColor: "transparent",
        filled: false,
        lineWidth: 1,
        opacity: 1,
        lineStyle: "solid",
        src,
      });
      imageCache.set(src, image);
      renderAll();
    };
    image.src = src;
  };
  reader.readAsDataURL(file);
}

function exportPng() {
  const output = document.createElement("canvas");
  output.width = getCanvasWidth();
  output.height = getCanvasHeight();
  const outputCtx = output.getContext("2d");
  if (!outputCtx) return;
  paintMap(outputCtx, { includeSelection: false });
  const link = document.createElement("a");
  link.download = `${(els.title?.value || "map").trim() || "map"}.png`;
  link.href = output.toDataURL("image/png");
  link.click();
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
  syncActiveSlideFromMap();
  const title = els.title?.value.trim() || "이름 없는 공간";
  state.map.note = els.note?.value.trim() || "";
  state.map.canvasWidth = getCanvasWidth();
  state.map.canvasHeight = getCanvasHeight();
  state.map.width = Math.ceil(state.map.canvasWidth / state.map.tileSize);
  state.map.height = Math.ceil(state.map.canvasHeight / state.map.tileSize);
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
  syncControls();
}

function resetMap() {
  if (!window.confirm("맵을 초기화할까요?")) return;
  pushHistory();
  const preservedManagement = {
    zones: Array.isArray(state.map.zones) ? structuredClone(state.map.zones) : [],
    creatures: Array.isArray(state.map.creatures) ? structuredClone(state.map.creatures) : [],
    relations: Array.isArray(state.map.relations) ? structuredClone(state.map.relations) : [],
    appearances: Array.isArray(state.map.appearances) ? structuredClone(state.map.appearances) : [],
    abilities: Array.isArray(state.map.abilities) ? structuredClone(state.map.abilities) : [],
    titles: Array.isArray(state.map.titles) ? structuredClone(state.map.titles) : [],
    creations: Array.isArray(state.map.creations) ? structuredClone(state.map.creations) : [],
    items: Array.isArray(state.map.items) ? structuredClone(state.map.items) : [],
    manaStones: Array.isArray(state.map.manaStones) ? structuredClone(state.map.manaStones) : [],
    byproducts: Array.isArray(state.map.byproducts) ? structuredClone(state.map.byproducts) : [],
    accessKeys: Array.isArray(state.map.accessKeys) ? structuredClone(state.map.accessKeys) : [],
    settings: state.map.settings && typeof state.map.settings === "object" ? structuredClone(state.map.settings) : {},
  };
  state.map = {
    ...structuredClone(DEFAULT_MAP),
    ...preservedManagement,
  };
  renderAll();
}

function getSelectedShape() {
  return state.map.shapes.find((shape) => shape.id === state.selectedShapeId) || null;
}

function selectObject(id = "") {
  state.selectedShapeId = id;
  renderLayers();
  drawMap();
}

function getActiveShapeIndex() {
  if (state.selectedShapeId) {
    const selectedIndex = state.map.shapes.findIndex((shape) => shape.id === state.selectedShapeId);
    if (selectedIndex >= 0) return selectedIndex;
  }
  return state.map.shapes.length - 1;
}

function arrangeShape(mode = "front") {
  const index = getActiveShapeIndex();
  if (index < 0) return;
  pushHistory();
  const [shape] = state.map.shapes.splice(index, 1);
  if (mode === "front") state.map.shapes.push(shape);
  if (mode === "back") state.map.shapes.unshift(shape);
  if (mode === "forward") state.map.shapes.splice(Math.min(index + 1, state.map.shapes.length), 0, shape);
  if (mode === "backward") state.map.shapes.splice(Math.max(index - 1, 0), 0, shape);
  state.selectedShapeId = shape.id;
  renderAll();
}

function applyQuickStyle(style = "") {
  const selected = getSelectedShape();
  const target = selected || state.map.shapes.at(-1);
  if (!target) {
    state.shapeFill = true;
    state.secondaryColor = "#e8f6ff";
    state.primaryColor = "#0b78b6";
    return syncControls();
  }
  pushHistory();
  if (style === "shadow") {
    target.opacity = 0.92;
    target.lineWidth = Math.max(2, target.lineWidth || 2);
  } else {
    target.filled = true;
    target.fillColor = "#e8f6ff";
    target.color = "#0b78b6";
    target.lineWidth = 2;
  }
  renderAll();
}

function applyFillColor(color = "") {
  const selected = getSelectedShape();
  state.secondaryColor = color || "transparent";
  state.shapeFill = Boolean(color);
  if (selected) {
    pushHistory();
    selected.fillColor = state.secondaryColor;
    selected.filled = state.shapeFill;
  }
  renderAll();
}

function applyOutlineColor(color = "") {
  const selected = getSelectedShape();
  state.primaryColor = color || "transparent";
  if (selected) {
    pushHistory();
    selected.color = state.primaryColor;
    if (!color) selected.lineStyle = "none";
  }
  renderAll();
}

function applyOutlineWidth(width = 2) {
  state.brushSize = clampNumber(width, 1, 64);
  const selected = getSelectedShape();
  if (selected) {
    pushHistory();
    selected.lineWidth = state.brushSize;
  }
  renderAll();
}

function applyOutlineDash(style = "solid") {
  state.lineStyle = style === "dash" ? "dash" : "solid";
  const selected = getSelectedShape();
  if (selected) {
    pushHistory();
    selected.lineStyle = state.lineStyle;
  }
  renderAll();
}

function newSlide() {
  syncActiveSlideFromMap();
  pushHistory();
  const insertIndex = normalizeSlideIndex(state.activeSlideIndex, state.map.slides) + 1;
  const blankSlide = createBlankSlide(insertIndex);
  state.map.slides.splice(insertIndex, 0, blankSlide);
  applySlideToMap(insertIndex);
  setSaveState("새 슬라이드");
  renderAll();
}

function syncRibbonState() {
  document.body.classList.toggle("paint-ribbon-collapsed", state.ribbonCollapsed);
  if (!els.ribbonToggle) return;
  els.ribbonToggle.textContent = state.ribbonCollapsed ? "도구 펼치기" : "도구 접기";
  els.ribbonToggle.title = state.ribbonCollapsed ? "도구 펼치기" : "도구 접기";
  els.ribbonToggle.setAttribute("aria-expanded", String(!state.ribbonCollapsed));
}

function syncControls() {
  syncRibbonState();
  if (els.title) els.title.value = state.space?.title || "";
  if (els.note) els.note.value = state.map.note || "";
  if (els.width) els.width.value = String(getCanvasWidth());
  if (els.height) els.height.value = String(getCanvasHeight());
  if (els.brushSize) els.brushSize.value = String(state.brushSize);
  if (els.brushValue) els.brushValue.textContent = String(state.brushSize);
  if (els.opacity) els.opacity.value = String(state.opacity);
  if (els.opacityValue) els.opacityValue.textContent = String(Math.round(state.opacity * 100));
  if (els.brushStyle) els.brushStyle.value = state.brushStyle;
  if (els.lineStyle) els.lineStyle.value = state.lineStyle;
  if (els.fillToggle) {
    els.fillToggle.setAttribute("aria-pressed", String(state.shapeFill));
    els.fillToggle.classList.toggle("is-active", state.shapeFill);
  }
  if (els.primaryPreview) els.primaryPreview.style.background = state.primaryColor;
  if (els.secondaryPreview) els.secondaryPreview.style.background = state.secondaryColor;
  if (els.customColor) els.customColor.value = state[state.activeColorRole === "primary" ? "primaryColor" : "secondaryColor"];
  if (els.drawColor) els.drawColor.value = state.primaryColor === "transparent" ? "#000000" : state.primaryColor;
  if (els.drawColorPreview) els.drawColorPreview.style.background = state.primaryColor === "transparent" ? "#000000" : state.primaryColor;
  if (els.fontFamily) els.fontFamily.value = state.textFontFamily;
  if (els.fontSize) els.fontSize.value = String(state.textFontSize);
  if (els.textColor) els.textColor.value = state.primaryColor === "transparent" ? "#111827" : state.primaryColor;
  if (els.dashboardLink) els.dashboardLink.href = `./space-dashboard.html?space=${encodeURIComponent(state.spaceId)}#map`;
  if (els.slideTitle) els.slideTitle.textContent = state.space?.title || els.title?.value || "공간";
  document.title = `${state.space?.title || "제목 없음"} - 맵 에디터`;
}

function setShape(type) {
  const aliases = {
    plus: "rectangle",
    minus: "rectangle",
    multiply: "diamond",
    divide: "ellipse",
    "flow-rect": "rectangle",
    "flow-diamond": "diamond",
    "flow-data": "freeform",
    "flow-doc": "roundrect",
    badge: "burst",
    callout: "speech",
    "action-back": "arrow-left",
    "action-next": "arrow-right",
    "action-home": "roundrect",
  };
  state.shapeType = SHAPE_LABELS[type] ? type : aliases[type] || "rectangle";
  setActiveTool("shape");
  els.shapeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mapShape === type || button.dataset.mapShape === state.shapeType);
  });
}

function renderLayers() {
  if (!els.layerDock) return;
  els.layerDock.hidden = !state.layerDockOpen;
  document.body.classList.toggle("paint-layer-closed", !state.layerDockOpen);
  document.querySelectorAll("[data-map-layer-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.layerDockOpen));
  });
  if (!els.layerList) return;
  const objects = [
    ...state.map.shapes.map((shape, index) => ({ id: shape.id, label: SHAPE_LABELS[shape.type] || "도형", meta: `${index + 1}번 도형` })),
    ...state.map.markers.map((marker, index) => ({ id: marker.id, label: marker.type === "label" ? "텍스트" : "표식", meta: marker.label || `${index + 1}번 텍스트` })),
  ];
  if (objects.length === 0) {
    els.layerList.innerHTML = `<p>아직 개체가 없습니다.</p>`;
    return;
  }
  els.layerList.innerHTML = [...objects]
    .reverse()
    .map(
      (item) => `
        <button class="paint-layer-item${item.id === state.selectedShapeId ? " is-active" : ""}" type="button" data-map-select-object="${escapeHtml(item.id)}">
          <span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.meta)}</small>
          </span>
        </button>
      `
    )
    .join("");
}

function renderSlideList() {
  renderSlides();
}

function renderAll() {
  syncControls();
  renderSlideList();
  renderPalette();
  renderPptPalettes();
  renderLayers();
  drawMap();
}

function drawMarker(targetCtx, marker) {
  targetCtx.save();
  const size = clampNumber(marker.fontSize || state.textFontSize || 18, 8, 96);
  const weight = marker.bold === false ? 400 : 700;
  const italic = marker.italic ? "italic " : "";
  targetCtx.font = `${italic}${weight} ${size}px ${marker.fontFamily || "Malgun Gothic"}, sans-serif`;
  targetCtx.textBaseline = "middle";
  if (marker.type === "label") {
    const text = marker.label || "텍스트";
    targetCtx.fillStyle = marker.color || "#0f3f61";
    targetCtx.fillText(text, marker.x, marker.y);
    if (marker.underline) {
      const width = targetCtx.measureText(text).width;
      targetCtx.beginPath();
      targetCtx.moveTo(marker.x, marker.y + size * 0.58);
      targetCtx.lineTo(marker.x + width, marker.y + size * 0.58);
      targetCtx.strokeStyle = marker.color || "#0f3f61";
      targetCtx.lineWidth = 1;
      targetCtx.stroke();
    }
    targetCtx.restore();
    return;
  }
  targetCtx.fillStyle = marker.color || "#0284c7";
  targetCtx.beginPath();
  targetCtx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.fillStyle = "#17324a";
  targetCtx.fillText(marker.label || "표식", marker.x + 12, marker.y);
  targetCtx.restore();
}

function drawShape(targetCtx, shape) {
  const bounds = getBounds(shape);
  if (bounds.width < 1 || bounds.height < 1) return;
  if (shape.type === "image") {
    const image = getCachedImage(shape.src);
    if (image?.complete && image.naturalWidth) {
      targetCtx.save();
      targetCtx.globalAlpha = clampNumber(shape.opacity ?? 1, 0.1, 1);
      targetCtx.drawImage(image, bounds.left, bounds.top, bounds.width, bounds.height);
      targetCtx.restore();
    }
    return;
  }
  targetCtx.save();
  targetCtx.globalAlpha = clampNumber(shape.opacity ?? 1, 0.1, 1);
  targetCtx.strokeStyle = shape.lineStyle === "none" ? "transparent" : shape.color || "#000000";
  targetCtx.fillStyle = shape.fillColor || "transparent";
  targetCtx.lineWidth = shape.lineWidth || 3;
  targetCtx.lineJoin = "round";
  targetCtx.lineCap = "round";
  if (shape.lineStyle === "dash") targetCtx.setLineDash([10, 7]);
  drawShapePath(targetCtx, shape);
  if (shape.filled && shape.fillColor !== "transparent" && shape.type !== "line" && shape.type !== "curve") targetCtx.fill();
  targetCtx.stroke();
  targetCtx.restore();
  if (shape.id === state.selectedShapeId) {
    targetCtx.save();
    targetCtx.strokeStyle = "#0ea5e9";
    targetCtx.lineWidth = 1;
    targetCtx.setLineDash([6, 4]);
    targetCtx.strokeRect(bounds.left - 4, bounds.top - 4, bounds.width + 8, bounds.height + 8);
    targetCtx.restore();
  }
}

function addMarker(point, type = "marker") {
  const label = window.prompt(type === "label" ? "텍스트를 입력해주세요." : "표식 이름을 입력해주세요.", "");
  if (!label) return;
  pushHistory();
  const marker = {
    id: createId(),
    type,
    x: point.x,
    y: point.y,
    label: label.slice(0, 80),
    color: type === "label" ? state.primaryColor : "#0284c7",
    fontFamily: state.textFontFamily,
    fontSize: state.textFontSize,
    bold: state.textBold,
    italic: state.textItalic,
    underline: state.textUnderline,
  };
  state.map.markers.push(marker);
  state.selectedShapeId = marker.id;
  renderAll();
}

function beginShape(point) {
  pushHistory();
  state.currentShape = {
    id: createId(),
    type: state.shapeType,
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
    color: state.primaryColor,
    fillColor: state.shapeFill ? state.secondaryColor : "transparent",
    filled: state.shapeFill,
    lineWidth: state.brushSize,
    opacity: state.opacity,
    lineStyle: state.lineStyle,
  };
  state.selectedShapeId = state.currentShape.id;
  state.map.shapes.push(state.currentShape);
  drawMap();
}

document.addEventListener("click", async (event) => {
  const toolButton = event.target.closest("[data-map-tool]");
  if (toolButton) {
    setActiveTool(toolButton.dataset.mapTool || "brush");
    return;
  }

  const shapeButton = event.target.closest("[data-map-shape]");
  if (shapeButton) {
    setShape(shapeButton.dataset.mapShape || "line");
    return;
  }

  const slideDeleteButton = event.target.closest("[data-map-delete-slide]");
  if (slideDeleteButton) {
    deleteSlide(slideDeleteButton.dataset.mapDeleteSlide);
    return;
  }

  const slideButton = event.target.closest("[data-map-slide-index]");
  if (slideButton) {
    selectSlide(slideButton.dataset.mapSlideIndex);
    return;
  }

  const objectButton = event.target.closest("[data-map-select-object]");
  if (objectButton) {
    selectObject(objectButton.dataset.mapSelectObject || "");
    return;
  }

  const fillColorButton = event.target.closest("[data-map-fill-color]");
  if (fillColorButton) {
    applyFillColor(fillColorButton.dataset.mapFillColor || "");
    return;
  }

  const outlineColorButton = event.target.closest("[data-map-outline-color]");
  if (outlineColorButton) {
    applyOutlineColor(outlineColorButton.dataset.mapOutlineColor || "");
    return;
  }

  const outlineWidthButton = event.target.closest("[data-map-outline-width]");
  if (outlineWidthButton) {
    applyOutlineWidth(outlineWidthButton.dataset.mapOutlineWidth || 2);
    return;
  }

  const outlineDashButton = event.target.closest("[data-map-outline-dash], [data-map-outline-sketch]");
  if (outlineDashButton) {
    applyOutlineDash(outlineDashButton.dataset.mapOutlineDash || outlineDashButton.dataset.mapOutlineSketch || "solid");
    return;
  }

  const arrangeButton = event.target.closest("[data-map-arrange]");
  if (arrangeButton) {
    arrangeShape(arrangeButton.dataset.mapArrange || "front");
    return;
  }

  const styleButton = event.target.closest("[data-map-style]");
  if (styleButton) {
    applyQuickStyle(styleButton.dataset.mapStyle || "");
    return;
  }

  const pickerButton = event.target.closest("[data-map-picker]");
  if (pickerButton) {
    state.activeColorRole = pickerButton.dataset.mapPicker === "fill" ? "secondary" : "primary";
    setActiveTool("picker");
    return;
  }

  if (event.target.closest("[data-map-fill-background]")) {
    fillCanvas();
    return;
  }

  if (event.target.closest("[data-map-new-slide]")) {
    newSlide();
    return;
  }

  if (event.target.closest("[data-map-fill-none]")) {
    applyFillColor("");
    return;
  }

  if (event.target.closest("[data-map-outline-none]")) {
    applyOutlineColor("");
    return;
  }

  if (event.target.closest("[data-map-fill-custom]")) {
    state.activeColorRole = "secondary";
    els.customColor?.click();
    return;
  }

  if (event.target.closest("[data-map-outline-custom]")) {
    state.activeColorRole = "primary";
    els.customColor?.click();
    return;
  }

  if (event.target.closest("[data-map-fill-picture]")) {
    els.imageInput?.click();
    return;
  }

  if (event.target.closest("[data-map-fill-gradient], [data-map-fill-texture]")) {
    applyFillColor("#e8f6ff");
    return;
  }

  const colorButton = event.target.closest("[data-map-color]");
  if (colorButton) {
    state[state.activeColorRole === "primary" ? "primaryColor" : "secondaryColor"] = colorButton.dataset.mapColor || "#000000";
    renderAll();
    return;
  }

  const colorRole = event.target.closest("[data-map-color-role]");
  if (colorRole) {
    state.activeColorRole = colorRole.dataset.mapColorRole === "secondary" ? "secondary" : "primary";
    syncControls();
    return;
  }

  if (event.target.closest("[data-map-text-bold]")) {
    state.textBold = !state.textBold;
    syncControls();
    return;
  }

  if (event.target.closest("[data-map-text-italic]")) {
    state.textItalic = !state.textItalic;
    syncControls();
    return;
  }

  if (event.target.closest("[data-map-text-underline]")) {
    state.textUnderline = !state.textUnderline;
    syncControls();
    return;
  }

  if (event.target.closest("[data-map-save]")) {
    try {
      await saveMap();
    } catch (error) {
      setSaveState(error.message || "저장 실패", "error");
    }
    return;
  }

  if (event.target.closest("[data-map-reset]")) {
    resetMap();
    return;
  }

  if (event.target.closest("[data-map-undo]")) {
    undo();
    return;
  }

  if (event.target.closest("[data-map-redo]")) {
    redo();
    return;
  }

  if (event.target.closest("[data-map-ribbon-toggle]")) {
    state.ribbonCollapsed = !state.ribbonCollapsed;
    localStorage.setItem("mapEditorRibbon", state.ribbonCollapsed ? "collapsed" : "expanded");
    syncRibbonState();
    return;
  }

  if (event.target.closest("[data-map-export]")) {
    exportPng();
    return;
  }

  if (event.target.closest("[data-map-resize]")) {
    applyResizeFromInputs();
    return;
  }

  const growButton = event.target.closest("[data-map-grow]");
  if (growButton) {
    growMap(growButton.dataset.mapGrow || "both");
    return;
  }

  if (event.target.closest("[data-map-fit]")) {
    fitMapToView();
    return;
  }

  if (event.target.closest("[data-map-zoom-in]")) {
    setZoom(state.zoom + 0.1);
    return;
  }

  if (event.target.closest("[data-map-zoom-out]")) {
    setZoom(state.zoom - 0.1);
    return;
  }

  if (event.target.closest("[data-map-delete-selection]")) {
    deleteSelection();
    return;
  }

  if (event.target.closest("[data-map-fill-toggle]")) {
    state.shapeFill = !state.shapeFill;
    syncControls();
    return;
  }

  if (event.target.closest("[data-map-layer-toggle]")) {
    state.layerDockOpen = !state.layerDockOpen;
    renderLayers();
    return;
  }

  if (event.target.closest("[data-map-add-layer]")) {
    addLayer();
    return;
  }

  const layerDelete = event.target.closest("[data-layer-delete]");
  if (layerDelete) {
    deleteLayer(layerDelete.dataset.layerDelete);
    return;
  }
});

document.addEventListener("input", (event) => {
  if (event.target === els.brushSize) {
    state.brushSize = clampNumber(els.brushSize.value, 1, 64);
    syncControls();
    return;
  }
  if (event.target === els.opacity) {
    state.opacity = clampNumber(els.opacity.value, 0.1, 1);
    syncControls();
    return;
  }
  if (event.target === els.zoom) {
    setZoom(Number(els.zoom.value || 1));
    return;
  }
  if (event.target === els.customColor) {
    state[state.activeColorRole === "primary" ? "primaryColor" : "secondaryColor"] = els.customColor.value;
    if (state.activeColorRole === "primary") applyOutlineColor(els.customColor.value);
    else applyFillColor(els.customColor.value);
    return;
  }
  if (event.target === els.drawColor) {
    state.primaryColor = els.drawColor.value || "#000000";
    state.activeColorRole = "primary";
    renderAll();
    return;
  }
  if (event.target === els.textColor) {
    state.primaryColor = els.textColor.value;
    renderAll();
    return;
  }
});

document.addEventListener("change", (event) => {
  if (event.target === els.imageInput) {
    const file = els.imageInput.files?.[0];
    els.imageInput.value = "";
    importImage(file);
    return;
  }
  if (event.target === els.width || event.target === els.height) {
    applyResizeFromInputs();
    return;
  }
  if (event.target === els.brushStyle) {
    state.brushStyle = els.brushStyle.value || "round";
    return;
  }
  if (event.target === els.lineStyle) {
    state.lineStyle = els.lineStyle.value || "solid";
    return;
  }
  if (event.target === els.fontFamily) {
    state.textFontFamily = els.fontFamily.value || "Malgun Gothic";
    return;
  }
  if (event.target === els.fontSize) {
    state.textFontSize = clampNumber(els.fontSize.value || 18, 8, 96);
    return;
  }
  if (event.target === els.zoomSelect && els.zoomSelect.value) {
    setZoom(Number(els.zoomSelect.value));
    return;
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.target === els.width || event.target === els.height) && event.key === "Enter") {
    event.preventDefault();
    applyResizeFromInputs();
    event.target.blur();
  }
});

els.canvas?.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  els.canvas.setPointerCapture?.(event.pointerId);
  handleCanvasDown(getPointFromEvent(event), event);
});

els.resizeHandles.forEach((handle) => {
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    pushHistory();
    state.resizeDrag = {
      handle: handle.dataset.mapResizeHandle || "se",
      startX: event.clientX,
      startY: event.clientY,
      startWidth: getCanvasWidth(),
      startHeight: getCanvasHeight(),
    };
    handle.setPointerCapture?.(event.pointerId);
  });
});

els.canvas?.addEventListener("pointermove", (event) => {
  const point = getPointFromEvent(event);
  if (point) setPointerText(`${Math.round(point.x)}, ${Math.round(point.y)}`);
  if (!state.isDrawing || !point) return;
  event.preventDefault();
  if (state.tool === "select") {
    updateSelection(point);
    return;
  }
  if (state.tool === "shape") {
    updateShape(point);
    return;
  }
  if (state.tool === "brush" || state.tool === "pencil" || state.tool === "erase") {
    appendStrokePoint(point);
  }
});

els.canvas?.addEventListener("pointerleave", () => {
  setPointerText("준비");
});

window.addEventListener("pointerup", () => {
  if (state.resizeDrag) {
    state.resizeDrag = null;
    renderAll();
  }
  if (state.tool === "shape") finishShape();
  state.isDrawing = false;
  state.currentStroke = null;
  state.selectionStart = null;
  renderLayers();
});

window.addEventListener("pointermove", (event) => {
  if (!state.resizeDrag) return;
  const drag = state.resizeDrag;
  const dx = (event.clientX - drag.startX) / state.zoom;
  const dy = (event.clientY - drag.startY) / state.zoom;
  const growsRight = drag.handle.includes("e");
  const growsLeft = drag.handle.includes("w");
  const growsDown = drag.handle.includes("s");
  const growsUp = drag.handle.includes("n");
  const width = drag.startWidth + (growsRight ? dx : 0) - (growsLeft ? dx : 0);
  const height = drag.startHeight + (growsDown ? dy : 0) - (growsUp ? dy : 0);
  resizeMapLive(width, height);
});

window.addEventListener("keydown", (event) => {
  const editableTarget = event.target.closest?.("input, textarea, select, [contenteditable='true']");
  if (editableTarget && !(event.ctrlKey || event.metaKey)) return;

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveMap().catch((error) => setSaveState(error.message || "저장 실패", "error"));
    return;
  }
  if (event.key === "Delete" || event.key === "Backspace") {
    if (state.selection) {
      event.preventDefault();
      deleteSelection();
    }
  }
});

window.blogSession?.ready.then(async (session) => {
  const id = window.blogSession.getId(session);
  if (!id) {
    window.location.href = "./login.html";
    return;
  }
  if (!state.spaceId) {
    window.location.href = "./materials.html#spaces";
    return;
  }

  state.session = session;
  state.id = id;
  setShape("line");
  setActiveTool("brush");

  try {
    state.space = await loadSpace(session);
    state.map = parseMapContent(state.space.content || "");
    renderAll();
    setSaveState("저장 준비");
    window.setTimeout(fitMapToView, 80);
  } catch (error) {
    window.alert(error.message || "공간을 불러오지 못했습니다.");
    window.location.href = "./materials.html#spaces";
  }
});
