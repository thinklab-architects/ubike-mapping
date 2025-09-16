const MAPBOX_ACCESS_TOKEN = "pk.eyJ1Ijoiam9obmNoZW4yMDI0IiwiYSI6ImNtZXdhZ3ZyMzBsemMya3F4Y2NwMHN3ZmwifQ.nawrXjd_rNZXL7xVFIMZ-g";
const MANIFEST_URL = "csv/manifest.json";

const sliderEl = document.getElementById("time-slider");
const labelEl = document.getElementById("timeline-label");
const dateSelectEl = document.getElementById("date-select");
const playButtonEl = document.getElementById("play-toggle");
const heightScaleEl = document.getElementById("height-scale");
const heightScaleValueEl = document.getElementById("height-scale-value");
const modeSelectEl = document.getElementById("mode-select");
const legendLabelLow = document.getElementById("legend-label-low");
const legendLabelMid = document.getElementById("legend-label-mid");
const legendLabelHigh = document.getElementById("legend-label-high");

const AUTOPLAY_INTERVAL = 1500;
const DEFAULT_HEIGHT_SCALE = Number(heightScaleEl?.value) || 6;
const DEFAULT_MODE = modeSelectEl?.value || "raw";

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
  }
};

const state = {
  timelineEntries: [],
  groupedByDate: new Map(),
  currentDate: null,
  currentTimeline: [],
  mapReady: false,
  map: null,
  popup: null,
  lastFittedDate: null,
  autoplayActive: false,
  autoplayHandle: null,
  heightScale: DEFAULT_HEIGHT_SCALE,
  currentMode: DEFAULT_MODE
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
updateLegendLabels();
updatePlayButtonState();

function initMap() {
  state.map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v11",
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

    state.map.addSource("stations", {
      type: "geojson",
      data: emptyGeoJSON()
    });

    state.map.addLayer({
      id: "stations-extrusion",
      type: "fill-extrusion",
      source: "stations",
      paint: {
        "fill-extrusion-height": 0,
        "fill-extrusion-base": 0,
        "fill-extrusion-color": "#38bdf8",
        "fill-extrusion-opacity": 0.82,
        "fill-extrusion-vertical-gradient": true
      }
    });

    state.map.addLayer({
      id: "stations-labels",
      type: "symbol",
      source: "stations",
      layout: {
        "text-field": ["get", "labelValue"],
        "text-size": 12,
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "symbol-placement": "point",
        "text-offset": [0, 1.2]
      },
      paint: {
        "text-color": "#e2e8f0",
        "text-halo-color": "#0f172a",
        "text-halo-width": 1.2
      }
    });

    state.map.on("mousemove", "stations-extrusion", e => {
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
        metricLabel,
        valueDisplay,
        centerLng,
        centerLat
      } = feature.properties;

      state.popup
        .setLngLat([centerLng, centerLat])
        .setHTML(`
          <div class="tooltip">
            <div class="tooltip__title">${station}</div>
            <div>${district}</div>
            <div>${address}</div>
            <div>${metricLabel}：${valueDisplay}</div>
            <div>即時車量：${formatNumber(available)}</div>
            <div>十分鐘變化：${formatSignedNumber(delta)}</div>
            <div>當日累積：${formatSignedNumber(cumulative)}</div>
          </div>
        `)
        .addTo(state.map);
    });

    state.map.on("mouseleave", "stations-extrusion", () => state.popup.remove());

    applyExtrusionStyle();
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

    const entries = [];
    for (const item of manifest) {
      if (!item?.file || !item?.date) {
        console.warn("manifest 格式錯誤", item);
        continue;
      }
      const csvUrl = `csv/${item.file}`;
      const text = await fetchCsv(csvUrl);
      const date = item.date;
      const parsed = parseCsv(text, date);
      entries.push(...parsed);
    }

    entries.sort((a, b) => a.timestamp - b.timestamp);
    state.timelineEntries = entries;
    state.groupedByDate = groupEntriesByDate(entries);
    populateDateSelect(state.groupedByDate.keys());

    const firstDate = state.groupedByDate.keys().next().value;
    updateTimelineForDate(firstDate);
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

    for (let i = 0; i < timeColumns.length; i += 1) {
      const timeLabel = timeColumns[i];
      const raw = Number(row[timeStartIndex + i]);
      const available = Number.isFinite(raw) ? raw : 0;
      const delta = previousValue === null ? 0 : available - previousValue;
      cumulativeChange += delta;

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
        geometry: createExtrusionPolygon(lng, lat, 60)
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

function groupEntriesByDate(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.date)) {
      grouped.set(entry.date, []);
    }
    grouped.get(entry.date).push(entry);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }
  return grouped;
}

function populateDateSelect(datesIterator) {
  dateSelectEl.innerHTML = "";
  const dates = Array.from(datesIterator);
  for (const date of dates) {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    dateSelectEl.appendChild(option);
  }
  dateSelectEl.addEventListener("change", event => {
    updateTimelineForDate(event.target.value);
  });
}

function updateTimelineForDate(date) {
  const entries = state.groupedByDate.get(date);
  if (!entries || !entries.length) {
    labelEl.textContent = "選擇的日期沒有資料";
    sliderEl.disabled = true;
    stopAutoplay();
    updatePlayButtonState();
    return;
  }
  stopAutoplay();
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
  const source = state.map.getSource("stations");
  if (!source) {
    return;
  }
  const geojson = getGeoJSONForEntry(entry, state.currentMode);
  source.setData(geojson);
  labelEl.textContent = entry.label;
  if (state.lastFittedDate !== entry.date) {
    fitMapToFeatures(geojson);
    state.lastFittedDate = entry.date;
  }
}

function getGeoJSONForEntry(entry, mode) {
  if (!entry.geojsonCache.has(mode)) {
    entry.geojsonCache.set(mode, buildGeoJSON(entry, mode));
  }
  return entry.geojsonCache.get(mode);
}

function buildGeoJSON(entry, mode) {
  const config = MODE_CONFIGS[mode] ?? MODE_CONFIGS.raw;
  const features = entry.stations.map(station => {
    const value = getMetricValue(station, mode);
    return {
      type: "Feature",
      geometry: station.geometry,
      properties: {
        station: station.station,
        district: station.district,
        address: station.address,
        capacity: station.capacity,
        available: station.available,
        delta: station.delta,
        cumulative: station.cumulative,
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
  if (!state.mapReady || !state.map?.getLayer("stations-extrusion")) {
    return;
  }
  const config = MODE_CONFIGS[state.currentMode] ?? MODE_CONFIGS.raw;
  const valueExpr = ["get", "value"];
  const scaledExpr = ["*", valueExpr, state.heightScale];
  const heightExpr = config.supportsNegative
    ? [
        "case",
        [">=", valueExpr, 0],
        scaledExpr,
        0
      ]
    : scaledExpr;
  const baseExpr = config.supportsNegative
    ? [
        "case",
        [">=", valueExpr, 0],
        0,
        scaledExpr
      ]
    : 0;

  state.map.setPaintProperty("stations-extrusion", "fill-extrusion-height", heightExpr);
  state.map.setPaintProperty("stations-extrusion", "fill-extrusion-base", baseExpr);
  state.map.setPaintProperty("stations-extrusion", "fill-extrusion-color", config.colorExpression);
}

function updateHeightScaleLabel(value) {
  if (heightScaleValueEl) {
    heightScaleValueEl.textContent = `${value}×`;
  }
}

function startAutoplay() {
  if (state.autoplayActive || !state.currentTimeline.length) {
    return;
  }
  state.autoplayActive = true;
  updatePlayButtonState();
  state.autoplayHandle = setInterval(() => {
    const entries = state.currentTimeline;
    if (!entries.length) {
      stopAutoplay();
      return;
    }
    const currentIndex = Number(sliderEl.value) || 0;
    const nextIndex = (currentIndex + 1) % entries.length;
    goToTimelineIndex(nextIndex);
  }, AUTOPLAY_INTERVAL);
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

function createExtrusionPolygon(lng, lat, sizeMeters = 60) {
  const latOffset = sizeMeters / 111320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngOffset = sizeMeters / (111320 * Math.max(cosLat, 0.01));
  const ring = [
    [lng - lngOffset, lat - latOffset],
    [lng + lngOffset, lat - latOffset],
    [lng + lngOffset, lat + latOffset],
    [lng - lngOffset, lat + latOffset],
    [lng - lngOffset, lat - latOffset]
  ];
  return {
    type: "Polygon",
    coordinates: [ring]
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

