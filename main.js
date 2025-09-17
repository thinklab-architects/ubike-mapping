const MAPBOX_ACCESS_TOKEN = "pk.eyJ1Ijoiam9obmNoZW4yMDI0IiwiYSI6ImNtZXdhZ3ZyMzBsemMya3F4Y2NwMHN3ZmwifQ.nawrXjd_rNZXL7xVFIMZ-g";
const MANIFEST_URL = "csv/manifest.json";

const sliderEl = document.getElementById("time-slider");
const labelEl = document.getElementById("timeline-label");
const dateSelectEl = document.getElementById("date-select");
const playButtonEl = document.getElementById("play-toggle");
const viewToggleEl = document.getElementById("view-toggle");
const labelToggleEl = document.getElementById("label-toggle");
const heightScaleEl = document.getElementById("height-scale");
const heightScaleValueEl = document.getElementById("height-scale-value");
const speedSliderEl = document.getElementById("autoplay-speed");
const speedValueEl = document.getElementById("autoplay-speed-value");
const modeSelectEl = document.getElementById("mode-select");
const legendLabelLow = document.getElementById("legend-label-low");
const legendLabelMid = document.getElementById("legend-label-mid");
const legendLabelHigh = document.getElementById("legend-label-high");

const DEFAULT_HEIGHT_SCALE = Number(heightScaleEl?.value) || 6;
const DEFAULT_AUTOPLAY_SECONDS = Number(speedSliderEl?.value) || 1.5;
const DEFAULT_AUTOPLAY_INTERVAL_MS = DEFAULT_AUTOPLAY_SECONDS * 1000;
const DEFAULT_MODE = modeSelectEl?.value || "raw";
const DEFAULT_VIEW_MODE = "3d";

const MODE_CONFIGS = {
  raw: {
    id: "raw",
    label: "即時車量",
    metricLabel: "可借車輛",
    legend: { low: "低車量", mid: "中等", high: "高車量" },
    supportsNegative: false,
    formatter: value => formatNumber(value),
    colorExpression: [
      "interpolate",
      ["linear"],
      ["get", "value"],
      0, "#ef4444",
      10, "#fbbf24",
      20, "#22c55e"
    ]
  },
  delta: {
    id: "delta",
    label: "十分鐘變化量",
    metricLabel: "十分鐘變化",
    legend: { low: "下降", mid: "持平", high: "上升" },
    supportsNegative: true,
    formatter: value => formatSignedNumber(value),
    colorExpression: [
      "interpolate",
      ["linear"],
      ["get", "value"],
      -40, "#ef4444",
      -10, "#f87171",
      -1, "#fca5a5",
      0, "#e2e8f0",
      1, "#86efac",
      10, "#22c55e",
      40, "#15803d"
    ]
  },
  cumulative: {
    id: "cumulative",
    label: "當日累積變化",
    metricLabel: "當日累積",
    legend: { low: "累積下降", mid: "持平", high: "累積上升" },
    supportsNegative: true,
    formatter: value => formatSignedNumber(value),
    colorExpression: [
      "interpolate",
      ["linear"],
      ["get", "value"],
      -80, "#ef4444",
      -20, "#f87171",
      0, "#e2e8f0",
      20, "#86efac",
      80, "#15803d"
    ]
  },
  "abs-total": {
    id: "abs-total",
    label: "每日絕對變化累積",
    metricLabel: "絕對變化累積",
    legend: { low: "低總變化", mid: "中等", high: "高總變化" },
    supportsNegative: false,
    formatter: value => formatNumber(value),
    colorExpression: [
      "interpolate",
      ["linear"],
      ["get", "value"],
      0, "#e2e8f0",
      20, "#38bdf8",
      50, "#0ea5e9",
      80, "#1d4ed8"
    ]
  }
};

const state = {
  manifest: [],
  cacheByDate: new Map(),
  currentDate: null,
  currentTimeline: [],
  mapReady: false,
  map: null,
  popup: null,
  lastFittedDate: null,
  autoplayActive: false,
  autoplayHandle: null,
  heightScale: DEFAULT_HEIGHT_SCALE,
  autoplayIntervalMs: DEFAULT_AUTOPLAY_INTERVAL_MS,
  currentMode: DEFAULT_MODE,
  viewMode: DEFAULT_VIEW_MODE,
  labelsVisible: true
};

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_ACCESS_TOKEN || MAPBOX_ACCESS_TOKEN === "YOUR_MAPBOX_ACCESS_TOKEN") {
  labelEl.textContent = "請先在 main.js 設定 MAPBOX_ACCESS_TOKEN";
}

if (playButtonEl) {
  playButtonEl.disabled = true;
  playButtonEl.addEventListener("click", () => {
    if (!state.currentTimeline.length) {
      return;
    }
    if (state.autoplayActive) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });
}

if (viewToggleEl) {
  viewToggleEl.addEventListener("click", () => {
    state.viewMode = state.viewMode === "3d" ? "2d" : "3d";
    updateViewToggleButton();
    applyViewModeSettings();
  });
}

if (labelToggleEl) {
  labelToggleEl.addEventListener("click", () => {
    state.labelsVisible = !state.labelsVisible;
    updateLabelToggleButton();
    applyLabelVisibility();
  });
}

if (heightScaleEl) {
  heightScaleEl.addEventListener("input", () => {
    const value = Number(heightScaleEl.value);
    if (!Number.isFinite(value)) {
      return;
    }
    state.heightScale = value;
    updateHeightScaleLabel(value);
    applyExtrusionStyle();
  });
}

if (speedSliderEl) {
  speedSliderEl.addEventListener("input", () => {
    const seconds = Number(speedSliderEl.value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }
    state.autoplayIntervalMs = seconds * 1000;
    updateAutoplaySpeedLabel(seconds);
    rescheduleAutoplay();
  });
}

if (modeSelectEl) {
  modeSelectEl.addEventListener("change", () => {
    const nextMode = modeSelectEl.value;
    if (!MODE_CONFIGS[nextMode]) {
      return;
    }
    state.currentMode = nextMode;
    stopAutoplay();
    updateLegendLabels();
    applyExtrusionStyle();
    refreshCurrentView();
  });
}

updateHeightScaleLabel(state.heightScale);
updateAutoplaySpeedLabel(state.autoplayIntervalMs / 1000);
updateLegendLabels();
updatePlayButtonState();
updateViewToggleButton();
updateLabelToggleButton();

function initMap() {
  state.map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [121.0, 25.0],
    zoom: 11,
    pitch: 60,
    bearing: -32
  });

  state.popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  });

  state.map.on("load", () => {
    state.mapReady = true;

    state.map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1"
    });
    state.map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
    state.map.setLight({ anchor: "viewport", color: "#ffffff", intensity: 0.6 });

    state.map.addSource("stations-3d", {
      type: "geojson",
      data: emptyGeoJSON()
    });

    state.map.addSource("stations-2d", {
      type: "geojson",
      data: emptyGeoJSON()
    });

    state.map.addLayer({
      id: "stations-extrusion",
      type: "fill-extrusion",
      source: "stations-3d",
      paint: {
        "fill-extrusion-height": 0,
        "fill-extrusion-base": 0,
        "fill-extrusion-color": "#38bdf8",
        "fill-extrusion-opacity": 0.82,
        "fill-extrusion-vertical-gradient": true
      }
    });

    state.map.addLayer({
      id: "stations-heatmap-negative",
      type: "heatmap",
      source: "stations-2d",
      layout: {
        visibility: "none"
      },
      paint: {
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 20, 14, 45],
        "heatmap-intensity": 0.6,
        "heatmap-weight": [
          "case",
          ["<", ["get", "value"], 0],
          ["min", 1, ["/", ["abs", ["get", "value"]], 20]],
          0
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(248,113,113,0)",
          0.4, "rgba(248,113,113,0.4)",
          0.7, "rgba(239,68,68,0.65)",
          1, "rgba(190,18,60,0.9)"
        ],
        "heatmap-opacity": 0.0
      }
    });

    state.map.addLayer({
      id: "stations-heatmap-positive",
      type: "heatmap",
      source: "stations-2d",
      layout: {
        visibility: "none"
      },
      paint: {
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 20, 14, 45],
        "heatmap-intensity": 0.6,
        "heatmap-weight": [
          "case",
          [">", ["get", "value"], 0],
          ["min", 1, ["/", ["abs", ["get", "value"]], 20]],
          0
        ],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(134,239,172,0)",
          0.4, "rgba(74,222,128,0.35)",
          0.7, "rgba(34,197,94,0.6)",
          1, "rgba(21,128,61,0.85)"
        ],
        "heatmap-opacity": 0.0
      }
    });

    state.map.addLayer({
      id: "stations-circle",
      type: "circle",
      source: "stations-2d",
      layout: {
        visibility: "none"
      },
      paint: {
        "circle-radius": 4,
        "circle-color": "#38bdf8",
        "circle-opacity": 0.85,
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 1
      }
    });

    state.map.addLayer({
      id: "stations-labels",
      type: "symbol",
      source: "stations-2d",
      layout: {
        "text-field": ["get", "labelValue"],
        "text-size": 12,
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "symbol-placement": "point",
        "text-offset": [0, 0.6]
      },
      paint: {
        "text-color": "#0f172a",
        "text-halo-color": "rgba(255,255,255,0.85)",
        "text-halo-width": 1.2
      }
    });

    const hoverLayers = ["stations-extrusion", "stations-circle"];
    hoverLayers.forEach(layerId => {
      state.map.on("mousemove", layerId, e => {
        const feature = e.features?.[0];
        if (!feature) {
          state.popup.remove();
          return;
        }
        const {
          station,
          district,
          address,
          available,
          delta,
          cumulative,
          absCumulative,
          absCumulativeDisplay,
          metricLabel,
          valueDisplay,
          centerLng,
          centerLat
        } = feature.properties;

        state.popup
          .setLngLat([Number(centerLng), Number(centerLat)])
          .setHTML(`
            <div class="tooltip">
              <div class="tooltip__title">${station}</div>
              <div>${district}</div>
              <div>${address}</div>
              <div>${metricLabel}：${valueDisplay}</div>
              <div>即時車量：${formatNumber(available)}</div>
              <div>十分鐘變化：${formatSignedNumber(delta)}</div>
              <div>絕對變化累積：${absCumulativeDisplay ?? formatNumber(absCumulative ?? 0)}</div>
              <div>當日累積：${formatSignedNumber(cumulative)}</div>
            </div>
          `)
          .addTo(state.map);
      });
    });

    hoverLayers.forEach(layerId => {
      state.map.on("mouseleave", layerId, () => state.popup.remove());
    });

    applyExtrusionStyle();
    applyViewModeSettings({ animate: false });
    applyLabelVisibility();
    updateHeatmapVisibility();
    refreshCurrentView();
  });
}

async function loadData() {
  try {
    const manifestResp = await fetch(MANIFEST_URL);
    if (!manifestResp.ok) {
      throw new Error(`讀取 manifest 失敗 (${manifestResp.status})`);
    }
    const manifest = await manifestResp.json();
    if (!Array.isArray(manifest) || manifest.length === 0) {
      throw new Error("manifest 無資料");
    }

    state.manifest = manifest.filter(item => item?.file && item?.date);
    state.cacheByDate.clear();
    populateDateSelect(state.manifest.map(item => item.date));

    const firstDate = state.manifest[0]?.date;
    if (firstDate) {
      await updateTimelineForDate(firstDate);
    }
  } catch (error) {
    console.error(error);
    labelEl.textContent = `載入失敗：${error.message}`;
    if (playButtonEl) {
      playButtonEl.disabled = true;
    }
  }
}

async function fetchCsv(url) {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`讀取 ${url} 失敗 (${resp.status})`);
  }
  return await resp.text();
}

function parseCsv(text, date) {
  const result = Papa.parse(text.trim(), {
    skipEmptyLines: true
  });
  const rows = result.data;
  if (!rows.length) {
    return [];
  }
  const header = rows[0];
  const dataRows = rows.slice(1);
  const timeStartIndex = header.findIndex(col => /\d{2}:\d{2}/.test(col));
  if (timeStartIndex === -1) {
    throw new Error("找不到時間欄位");
  }
  const baseColumns = header.slice(0, timeStartIndex);
  const timeColumns = header.slice(timeStartIndex);

  const columnIndex = Object.fromEntries(baseColumns.map((col, idx) => [col, idx]));
  const slots = timeColumns.map((timeLabel, index) => ({
    key: `${date}T${timeLabel}`,
    date,
    timeLabel,
    order: index,
    stations: []
  }));

  for (const row of dataRows) {
    if (!row.length) {
      continue;
    }
    const lat = parseFloat(row[columnIndex.lat]);
    const lng = parseFloat(row[columnIndex.lng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }

    let previousValue = null;
    let cumulativeChange = 0;
    let absCumulative = 0;

    for (let i = 0; i < timeColumns.length; i += 1) {
      const rawValue = Number(row[timeStartIndex + i]);
      const available = Number.isFinite(rawValue) ? rawValue : 0;
      const delta = previousValue === null ? 0 : available - previousValue;
      const absDelta = previousValue === null ? 0 : Math.abs(delta);
      cumulativeChange += delta;
      absCumulative += absDelta;

      slots[i].stations.push({
        lng,
        lat,
        station: row[columnIndex.sna] ?? row[columnIndex.sno] ?? "未知站點",
        district: row[columnIndex.sarea] ?? "",
        address: row[columnIndex.ar] ?? "",
        capacity: Number(row[columnIndex.tot]) || 0,
        available,
        delta,
        cumulative: cumulativeChange,
        absCumulative: absCumulative,
        polygon: createExtrusionPolygon(lng, lat, 40)
      });

      previousValue = available;
    }
  }

  return slots.map(slot => ({
    key: slot.key,
    date: slot.date,
    label: `${slot.date} ${slot.timeLabel}`,
    time: slot.timeLabel,
    timestamp: new Date(`${slot.date}T${slot.timeLabel}:00`),
    stations: slot.stations,
    geojsonCache: new Map()
  }));
}

function populateDateSelect(dates) {
  dateSelectEl.innerHTML = "";
  for (const date of dates) {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    dateSelectEl.appendChild(option);
  }
  dateSelectEl.addEventListener("change", async event => {
    await updateTimelineForDate(event.target.value);
  });
}

async function loadEntriesForDate(date) {
  if (!date) {
    return [];
  }
  if (state.cacheByDate.has(date)) {
    return state.cacheByDate.get(date);
  }
  const manifestItem = state.manifest.find(item => item.date === date);
  if (!manifestItem) {
    throw new Error(`manifest 沒有 ${date} 的資料`);
  }
  const csvUrl = `csv/${manifestItem.file}`;
  const textData = await fetchCsv(csvUrl);
  const entries = parseCsv(textData, date);
  state.cacheByDate.set(date, entries);
  return entries;
}

async function updateTimelineForDate(date) {
  stopAutoplay();
  labelEl.textContent = "載入資料中…";
  try {
    const entries = await loadEntriesForDate(date);
    if (!entries.length) {
      labelEl.textContent = "選擇的日期沒有資料";
      sliderEl.disabled = true;
      updatePlayButtonState();
      return;
    }
    state.currentDate = date;
    if (dateSelectEl) {
      dateSelectEl.value = date;
    }
    state.currentTimeline = entries;
    state.lastFittedDate = null;
    sliderEl.min = 0;
    sliderEl.max = entries.length - 1;
    sliderEl.value = 0;
    sliderEl.disabled = false;
    goToTimelineIndex(0, { fromSlider: true });
    updatePlayButtonState();
  } catch (error) {
    console.error(error);
    labelEl.textContent = `載入失敗：${error.message}`;
    sliderEl.disabled = true;
    updatePlayButtonState();
  }
}

sliderEl.addEventListener("input", () => {
  const index = Number(sliderEl.value);
  goToTimelineIndex(index, { fromSlider: true });
});

function goToTimelineIndex(index, { fromSlider = false } = {}) {
  const entry = state.currentTimeline[index];
  if (!entry) {
    return;
  }
  if (!fromSlider) {
    sliderEl.value = String(index);
  }
  renderSlot(entry);
}

function renderSlot(entry) {
  if (!state.mapReady || !state.map?.isStyleLoaded()) {
    return;
  }
  const source3d = state.map.getSource("stations-3d");
  const source2d = state.map.getSource("stations-2d");
  if (!source3d || !source2d) {
    return;
  }
  const polygons = getGeoJSONForEntry(entry, state.currentMode, "polygon");
  const points = getGeoJSONForEntry(entry, state.currentMode, "point");
  source3d.setData(polygons);
  source2d.setData(points);
  labelEl.textContent = entry.label;
  if (state.lastFittedDate !== entry.date) {
    fitMapToFeatures(polygons);
    state.lastFittedDate = entry.date;
  }
}

function getGeoJSONForEntry(entry, mode, geometryType) {
  const key = `${mode}:${geometryType}`;
  if (!entry.geojsonCache.has(key)) {
    entry.geojsonCache.set(key, buildGeoJSON(entry, mode, geometryType));
  }
  return entry.geojsonCache.get(key);
}

function buildGeoJSON(entry, mode, geometryType) {
  const config = MODE_CONFIGS[mode] ?? MODE_CONFIGS.raw;
  const features = entry.stations.map(station => {
    const value = getMetricValue(station, mode);
    const geometry = geometryType === "polygon"
      ? station.polygon
      : { type: "Point", coordinates: [station.lng, station.lat] };

    return {
      type: "Feature",
      geometry,
      properties: {
        station: station.station,
        district: station.district,
        address: station.address,
        capacity: station.capacity,
        available: station.available,
        delta: station.delta,
        cumulative: station.cumulative,
        absCumulative: station.absCumulative,
        absCumulativeDisplay: formatNumber(station.absCumulative),
        value,
        valueDisplay: config.formatter(value),
        metricLabel: config.metricLabel,
        labelValue: config.formatter(value),
        centerLng: station.lng,
        centerLat: station.lat
      }
    };
  });
  return {
    type: "FeatureCollection",
    features
  };
}

function getMetricValue(station, mode) {
  switch (mode) {
    case "delta":
      return station.delta;
    case "cumulative":
      return station.cumulative;
    case "abs-total":
      return station.absCumulative;
    case "raw":
    default:
      return station.available;
  }
}

function refreshCurrentView() {
  const entry = state.currentTimeline[Number(sliderEl.value)] ?? state.currentTimeline[0];
  if (entry) {
    renderSlot(entry);
  }
  updatePlayButtonState();
}

function fitMapToFeatures(geojson) {
  if (!geojson.features.length) {
    return;
  }
  const bounds = geojson.features.reduce((acc, feature) => {
    extendBoundsWithGeometry(acc, feature.geometry);
    return acc;
  }, new mapboxgl.LngLatBounds());

  if (!bounds.isEmpty()) {
    state.map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
  }
}

function extendBoundsWithGeometry(bounds, geometry) {
  if (!geometry) {
    return;
  }
  if (geometry.type === "Point") {
    bounds.extend(geometry.coordinates);
  } else if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      for (const coord of ring) {
        bounds.extend(coord);
      }
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const coord of ring) {
          bounds.extend(coord);
        }
      }
    }
  }
}

function applyExtrusionStyle() {
  if (!state.mapReady) {
    return;
  }
  const config = MODE_CONFIGS[state.currentMode] ?? MODE_CONFIGS.raw;
  const map = state.map;
  if (map.getLayer("stations-extrusion")) {
    const valueExpr = ["get", "value"];
    const magnitudeExpr = config.supportsNegative ? ["abs", valueExpr] : valueExpr;
    const heightExpr = ["*", magnitudeExpr, state.heightScale];

    map.setPaintProperty("stations-extrusion", "fill-extrusion-height", heightExpr);
    map.setPaintProperty("stations-extrusion", "fill-extrusion-base", 0);
    map.setPaintProperty("stations-extrusion", "fill-extrusion-color", config.colorExpression);
  }

  applyCircleStyle(config);
  applyHeatmapStyle(config);
  updateHeatmapVisibility();
}

function applyCircleStyle(config) {
  if (!state.mapReady) {
    return;
  }
  const map = state.map;
  if (!map.getLayer("stations-circle")) {
    return;
  }
  const valueExpr = ["abs", ["get", "value"]];
  const baseScale = Math.max(state.heightScale / 6, 0.8);
  const radiusExpr = [
    "case",
    ["<=", valueExpr, 0],
    2,
    ["min", 80, ["*", ["sqrt", valueExpr], baseScale]]
  ];

  map.setPaintProperty("stations-circle", "circle-radius", radiusExpr);
  map.setPaintProperty("stations-circle", "circle-color", config.colorExpression);
  map.setPaintProperty("stations-circle", "circle-opacity", 0.85);
  map.setPaintProperty("stations-circle", "circle-stroke-color", "#0f172a");
  map.setPaintProperty("stations-circle", "circle-stroke-width", 1);
}

function applyHeatmapStyle(config) {
  if (!state.mapReady) {
    return;
  }
  const map = state.map;
  if (!map.getLayer("stations-heatmap-negative") || !map.getLayer("stations-heatmap-positive")) {
    return;
  }
  const magnitudeExpr = ["abs", ["get", "value"]];
  const weightExpr = ["min", 1, ["/", magnitudeExpr, 20]];

  map.setPaintProperty("stations-heatmap-negative", "heatmap-weight", [
    "case",
    ["<", ["get", "value"], 0],
    weightExpr,
    0
  ]);
  map.setPaintProperty("stations-heatmap-positive", "heatmap-weight", [
    "case",
    [">", ["get", "value"], 0],
    weightExpr,
    0
  ]);
}

function updateHeatmapVisibility() {
  if (!state.mapReady) {
    return;
  }
  const shouldShow = state.currentMode === "delta" || state.currentMode === "cumulative" || state.currentMode === "abs-total";
  const visibility = shouldShow ? "visible" : "none";
  const opacity = shouldShow ? 0.55 : 0;

  if (state.map.getLayer("stations-heatmap-negative")) {
    state.map.setLayoutProperty("stations-heatmap-negative", "visibility", visibility);
    state.map.setPaintProperty("stations-heatmap-negative", "heatmap-opacity", opacity);
  }
  if (state.map.getLayer("stations-heatmap-positive")) {
    state.map.setLayoutProperty("stations-heatmap-positive", "visibility", visibility);
    state.map.setPaintProperty("stations-heatmap-positive", "heatmap-opacity", opacity);
  }
}

function applyLabelVisibility() {
  if (!state.mapReady || !state.map.getLayer("stations-labels")) {
    return;
  }
  const visibility = state.labelsVisible ? "visible" : "none";
  state.map.setLayoutProperty("stations-labels", "visibility", visibility);
}

function updateLabelToggleButton() {
  if (!labelToggleEl) {
    return;
  }
  labelToggleEl.textContent = state.labelsVisible ? "隱藏數字" : "顯示數字";
  labelToggleEl.setAttribute("aria-pressed", state.labelsVisible ? "true" : "false");
}

function applyViewModeSettings({ animate = true } = {}) {
  if (!state.mapReady) {
    return;
  }
  const is3D = state.viewMode === "3d";
  const extrudeVisibility = is3D ? "visible" : "none";
  const circleVisibility = is3D ? "none" : "visible";

  if (state.map.getLayer("stations-extrusion")) {
    state.map.setLayoutProperty("stations-extrusion", "visibility", extrudeVisibility);
  }
  if (state.map.getLayer("stations-circle")) {
    state.map.setLayoutProperty("stations-circle", "visibility", circleVisibility);
  }
  if (state.map.getLayer("stations-labels")) {
    state.map.setLayoutProperty("stations-labels", "text-offset", is3D ? [0, 1.2] : [0, 0.6]);
  }

  const pitch = is3D ? 60 : 0;
  const bearing = is3D ? -32 : 0;
  if (animate) {
    state.map.easeTo({ pitch, bearing, duration: 600 });
  } else {
    state.map.setPitch(pitch);
    state.map.setBearing(bearing);
  }
}

function startAutoplay() {
  if (state.autoplayActive || !state.currentTimeline.length) {
    return;
  }
  state.autoplayActive = true;
  updatePlayButtonState();
  rescheduleAutoplay();
}

function stopAutoplay() {
  if (!state.autoplayActive) {
    return;
  }
  state.autoplayActive = false;
  if (state.autoplayHandle) {
    clearInterval(state.autoplayHandle);
    state.autoplayHandle = null;
  }
  updatePlayButtonState();
}

function rescheduleAutoplay() {
  if (!state.autoplayActive) {
    return;
  }
  if (state.autoplayHandle) {
    clearInterval(state.autoplayHandle);
  }
  state.autoplayHandle = setInterval(() => {
    const entries = state.currentTimeline;
    if (!entries.length) {
      stopAutoplay();
      return;
    }
    const currentIndex = Number(sliderEl.value) || 0;
    const nextIndex = (currentIndex + 1) % entries.length;
    goToTimelineIndex(nextIndex);
  }, state.autoplayIntervalMs);
}

function updatePlayButtonState() {
  if (!playButtonEl) {
    return;
  }
  const hasMultipleSlots = state.currentTimeline.length > 1;
  playButtonEl.disabled = !hasMultipleSlots && !state.autoplayActive;

  if (state.autoplayActive) {
    playButtonEl.classList.add("control-button--active");
    playButtonEl.textContent = "⏸ 暫停";
    playButtonEl.setAttribute("aria-pressed", "true");
  } else {
    playButtonEl.classList.remove("control-button--active");
    playButtonEl.textContent = "▶ 自動播放";
    playButtonEl.setAttribute("aria-pressed", "false");
  }
}

function updateViewToggleButton() {
  if (!viewToggleEl) {
    return;
  }
  viewToggleEl.textContent = state.viewMode === "3d" ? "切換為 2D" : "切換為 3D";
}

function updateHeightScaleLabel(value) {
  if (heightScaleValueEl) {
    heightScaleValueEl.textContent = `${value}×`;
  }
}

function updateAutoplaySpeedLabel(seconds) {
  if (speedValueEl) {
    speedValueEl.textContent = `${seconds.toFixed(1)} 秒`;
  }
}

function updateLegendLabels() {
  const config = MODE_CONFIGS[state.currentMode] ?? MODE_CONFIGS.raw;
  if (legendLabelLow) {
    legendLabelLow.textContent = config.legend.low;
  }
  if (legendLabelMid) {
    legendLabelMid.textContent = config.legend.mid;
  }
  if (legendLabelHigh) {
    legendLabelHigh.textContent = config.legend.high;
  }
}

function createExtrusionPolygon(lng, lat, radiusMeters = 40, segments = 24) {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const coordinates = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const dx = Math.cos(angle) * radiusMeters;
    const dy = Math.sin(angle) * radiusMeters;
    const latOffset = dy / 111320;
    const lngOffset = dx / (111320 * Math.max(cosLat, 0.01));
    coordinates.push([lng + lngOffset, lat + latOffset]);
  }
  return {
    type: "Polygon",
    coordinates: [coordinates]
  };
}

function formatNumber(value) {
  const rounded = Math.round(Number(value) ?? 0);
  return Number.isFinite(rounded) ? rounded.toString() : "0";
}

function formatSignedNumber(value) {
  const rounded = Math.round(Number(value) ?? 0);
  if (!Number.isFinite(rounded)) {
    return "0";
  }
  if (rounded > 0) {
    return `+${rounded}`;
  }
  return rounded.toString();
}

function emptyGeoJSON() {
  return { type: "FeatureCollection", features: [] };
}

initMap();
loadData();

