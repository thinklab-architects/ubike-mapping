const MAPBOX_ACCESS_TOKEN = "pk.eyJ1Ijoiam9obmNoZW4yMDI0IiwiYSI6ImNtZXdhZ3ZyMzBsemMya3F4Y2NwMHN3ZmwifQ.nawrXjd_rNZXL7xVFIMZ-g";
const MANIFEST_URL = "csv/manifest.json";

const sliderEl = document.getElementById("time-slider");
const labelEl = document.getElementById("timeline-label");
const dateSelectEl = document.getElementById("date-select");

const state = {
  timelineEntries: [],
  groupedByDate: new Map(),
  currentDate: null,
  currentTimeline: [],
  mapReady: false,
  map: null,
  popup: null
};

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_ACCESS_TOKEN || MAPBOX_ACCESS_TOKEN === "YOUR_MAPBOX_ACCESS_TOKEN") {
  labelEl.textContent = "請先在 main.js 設定 MAPBOX_ACCESS_TOKEN";
}

function initMap() {
  state.map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v11",
    center: [121.0, 25.0],
    zoom: 11
  });

  state.popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
  });

  state.map.on("load", () => {
    state.mapReady = true;
    state.map.addSource("stations", {
      type: "geojson",
      data: emptyGeoJSON()
    });

    state.map.addLayer({
      id: "stations-circles",
      type: "circle",
      source: "stations",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "available"],
          0, 4,
          10, 9,
          20, 13,
          35, 18
        ],
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "available"],
          0, "#ef4444",
          10, "#fbbf24",
          20, "#22c55e"
        ],
        "circle-opacity": 0.85,
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 1
      }
    });

    state.map.addLayer({
      id: "stations-labels",
      type: "symbol",
      source: "stations",
      layout: {
        "text-field": ["get", "available"],
        "text-size": 11,
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-offset": [0, 1.2]
      },
      paint: {
        "text-color": "#e2e8f0",
        "text-halo-color": "#0f172a",
        "text-halo-width": 1.2
      }
    });

    state.map.on("mousemove", "stations-circles", e => {
      const feature = e.features?.[0];
      if (!feature) {
        state.popup.remove();
        return;
      }
      const { coordinates } = feature.geometry;
      const { station, district, address, available, capacity } = feature.properties;
      state.popup
        .setLngLat(coordinates)
        .setHTML(`
          <div class="tooltip">
            <div class="tooltip__title">${station}</div>
            <div>${district}</div>
            <div>${address}</div>
            <div>可借車輛：${available} / ${capacity}</div>
          </div>
        `)
        .addTo(state.map);
    });

    state.map.on("mouseleave", "stations-circles", () => state.popup.remove());

    tryRenderCurrentSlot();
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

    const defaultDate = state.groupedByDate.keys().next().value;
    updateTimelineForDate(defaultDate);
  } catch (error) {
    console.error(error);
    labelEl.textContent = `載入失敗：${error.message}`;
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
  const featuresBySlot = new Map();
  const slots = [];

  for (const row of dataRows) {
    if (!row.length) {
      continue;
    }
    const lat = parseFloat(row[columnIndex.lat]);
    const lng = parseFloat(row[columnIndex.lng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }

    for (let i = 0; i < timeColumns.length; i += 1) {
      const timeLabel = timeColumns[i];
      const value = Number(row[timeStartIndex + i]);
      const slotKey = `${date}T${timeLabel}`;
      if (!featuresBySlot.has(slotKey)) {
        featuresBySlot.set(slotKey, []);
        slots.push({
          key: slotKey,
          date,
          timeLabel
        });
      }
      const available = Number.isFinite(value) ? value : 0;
      featuresBySlot.get(slotKey).push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [lng, lat]
        },
        properties: {
          station: row[columnIndex.sna] ?? row[columnIndex.sno] ?? "未知站點",
          district: row[columnIndex.sarea] ?? "",
          address: row[columnIndex.ar] ?? "",
          capacity: Number(row[columnIndex.tot]) || 0,
          available
        }
      });
    }
  }

  return slots.map(slot => ({
    key: slot.key,
    date: slot.date,
    label: `${slot.date} ${slot.timeLabel}`,
    time: slot.timeLabel,
    timestamp: new Date(`${slot.date}T${slot.timeLabel}:00`),
    geojson: {
      type: "FeatureCollection",
      features: featuresBySlot.get(slot.key) ?? []
    }
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
    return;
  }
  state.currentDate = date;
  state.currentTimeline = entries;
  state.lastFittedDate = null;
  sliderEl.min = 0;
  sliderEl.max = entries.length - 1;
  sliderEl.value = 0;
  sliderEl.disabled = false;
  labelEl.textContent = entries[0].label;
  renderSlot(entries[0]);
}

sliderEl.addEventListener("input", () => {
  const index = Number(sliderEl.value);
  const entry = state.currentTimeline[index];
  if (!entry) {
    return;
  }
  labelEl.textContent = entry.label;
  renderSlot(entry);
});

function renderSlot(entry) {
  if (!state.mapReady) {
    return;
  }
  const source = state.map.getSource("stations");
  if (!source) {
    return;
  }
  source.setData(entry.geojson);
  labelEl.textContent = entry.label;
  if (state.lastFittedDate !== entry.date) {
    fitMapToFeatures(entry.geojson);
    state.lastFittedDate = entry.date;
  }
}

function tryRenderCurrentSlot() {
  const entry = state.currentTimeline[Number(sliderEl.value)] ?? state.currentTimeline[0];
  if (entry) {
    renderSlot(entry);
  }
}

function fitMapToFeatures(geojson) {
  if (!geojson.features.length) {
    return;
  }
  const bounds = geojson.features.reduce((acc, feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    acc.extend([lng, lat]);
    return acc;
  }, new mapboxgl.LngLatBounds());
  state.map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
}

function emptyGeoJSON() {
  return { type: "FeatureCollection", features: [] };
}

initMap();
loadData();




