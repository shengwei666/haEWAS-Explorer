// assets/download.js — Render downloadable CSV list from a local manifest
// Uses absolute URLs so it works under a subpath like "/hetero-ewas-explorer/".

const PROJECT_SLUG = 'haEWAS-Explorer';
const MANIFEST_REL = 'data/downloads/index.json';
const CSV_DIR_REL  = 'data/downloads';

// Base URL detection
function detectBasePrefix() {
  const p = location.pathname;
  const marker = `/${PROJECT_SLUG}/`;
  const i = p.indexOf(marker);
  if (i >= 0) return p.slice(0, i + marker.length);
  return p.endsWith('/') ? p : p.replace(/[^/]+$/, '');
}
const BASE_PATH = detectBasePrefix();
const BASE_URL  = new URL(BASE_PATH, location.origin);
function abs(urlLike) { return new URL(urlLike, BASE_URL).href; }

const MANIFEST_URL = abs(MANIFEST_REL);
function csvAbsUrl(name) { return abs(`${CSV_DIR_REL}/${name}`); }

let allFiles = [];   // [{name, url, dataset, sizeBytes?}]
let filtered = [];

// Format file size
function humanSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}

// Fetch file size via HEAD request
async function headSize(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return undefined;
    const len = res.headers.get('Content-Length');
    const n = len ? Number(len) : NaN;
    return Number.isFinite(n) ? n : undefined;
  } catch (_) {
    return undefined;
  }
}

// Apply text search filter
function applyFilters() {
  const q = document.getElementById('fQuery').value.trim().toLowerCase();

  filtered = allFiles.filter(f => {
    return (!q || f.name.toLowerCase().includes(q) || f.dataset.toLowerCase().includes(q));
  });

  renderTable();
}

// Render the download table
function renderTable() {
  const tbody = document.querySelector('#dlTable tbody');
  tbody.innerHTML = '';
  for (const f of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${f.name}</td>
      <td>${f.dataset}</td>
      <td>${typeof f.sizeBytes === 'number' ? humanSize(f.sizeBytes) : ''}</td>
      <td><a class="btn ghost" href="${f.url}" download>Download</a></td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('dlCount').textContent = `${filtered.length} file(s)`;
}

// Initialize event listeners
function initFilters() {
  const queryInput = document.getElementById('fQuery');
  
  document.getElementById('dlReset').addEventListener('click', () => {
    queryInput.value = '';
    applyFilters();
  });

  queryInput.addEventListener('input', applyFilters);
}

// Load index.json manifest
async function loadManifest() {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${MANIFEST_URL}`);
  const json = await res.json();
  if (!json || !Array.isArray(json.files)) throw new Error('Manifest must be a JSON object with a "files" array.');
  
  return json.files
    .filter(name => /\.csv$/i.test(name))
    .map(name => {
      // Create a dataset name by removing '.csv' (e.g., 'Asthma_Blood')
      const dataset = name.replace(/\.csv$/i, '');
      return {
        name,
        url: csvAbsUrl(name),
        dataset
      };
    });
}

// Fetch sizes for all files sequentially
async function enrichSizesSequential(files) {
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    f.sizeBytes = await headSize(f.url);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    allFiles = await loadManifest();

    // Initial render without sizes
    filtered = allFiles.slice();
    renderTable();
    initFilters();

    // Fetch and update sizes in the background
    await enrichSizesSequential(allFiles);
    renderTable();

  } catch (e) {
    const tbody = document.querySelector('#dlTable tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">
      Failed to load manifest: ${String(e?.message || e)}<br>
      Make sure <code>${MANIFEST_URL}</code> exists and lists your CSV files.
    </td></tr>`;
    document.getElementById('dlCount').textContent = `0 file(s)`;
  }
});