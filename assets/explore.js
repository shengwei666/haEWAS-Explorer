// assets/explore.js — Local manifest + Papa Parse + IndexedDB Cache + Debouncing

const PROJECT_SLUG = 'hetero-ewas-explorer'; 
const UPDATE_INTERVAL_MS = 300; 
const MANIFEST_REL = 'data/downloads/index.json';
const CSV_DIR_REL  = 'data/downloads';
const CACHE_VERSION = "v3.0";

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
const WORKER_URL = new URL('assets/csvWorker.js', BASE_URL); 

let rawData = [];
let filtered = [];
let sortKey = 'P_haEWAS'; 
let sortAsc = true;
let page = 1;
let pageSize = 10; 

let lastRenderTs = 0;
let loadingState = { totalFiles: 0, completedFiles: 0 };
let totalRowsLoaded = 0;
const errorLog = [];

const DB_NAME = 'haEWAS_Cache_DB';
const DB_VERSION = 1;
const STORE_NAME = 'csvStore';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedData() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('all_rows');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB read failed:', e);
    return null;
  }
}

async function setCachedData(data) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, 'all_rows');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB write failed:', e);
  }
}
// ==========================================

function uniqueValues(arr, key) {
  return [...new Set(arr.map(d => d[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function formatNumber(x) {
  if (x == null || x === '') return '';
  const n = Number(x);
  if (!isFinite(n)) return String(x);
  if (Math.abs(n) < 1e-3 || Math.abs(n) >= 1e4) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function sortData() {
  const key = sortKey;
  const numericKeys = [
    'Start', 'End', 
    'P_Beta', 'Effect_Beta', 'FDR_Beta',
    'P_haEWAS', 'Effect_haEWAS', 'FDR_haEWAS'
  ];

  filtered.sort((a, b) => {
    let va = a[key], vb = b[key];
    if (numericKeys.includes(key)) { 
      va = Number(va); 
      vb = Number(vb); 
    }
    const cmp = (typeof va === 'number' && typeof vb === 'number')
      ? (va - vb)
      : String(va ?? '').localeCompare(String(vb ?? ''));
    return sortAsc ? cmp : -cmp;
  });
}

// ----- UI -----
function updateSelects() {
  const ph = document.getElementById('phenotype');
  const chr = document.getElementById('chromosome');
  const grp = document.getElementById('group');

  if(!ph || !chr || !grp) return;

  const valPh = ph.value;
  const valChr = chr.value;
  const valGrp = grp.value;

  ph.innerHTML = '<option value="">All</option>';
  chr.innerHTML = '<option value="">All</option>';
  grp.innerHTML = '<option value="">All</option>';

  uniqueValues(rawData, 'Phenotype').forEach(v => ph.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
  uniqueValues(rawData, 'Chromosome').forEach(v => chr.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
  uniqueValues(rawData, 'Group').forEach(v => grp.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));

  if (valPh) ph.value = valPh;
  if (valChr) chr.value = valChr;
  if (valGrp) grp.value = valGrp;
}

function renderTable(force = false) {
  const now = performance.now();
  if (!force && now - lastRenderTs < UPDATE_INTERVAL_MS) return;
  lastRenderTs = now;

  const tbody = document.querySelector('#resultsTable tbody');
  tbody.innerHTML = '';

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;

  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  
  for (const d of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.CpG_ID ?? ''}</td>
      <td>${d.Phenotype ?? ''}</td>
      <td>${d.Chromosome ?? ''}</td>
      <td>${d.Start ?? ''}</td>
      <td>${d.End ?? ''}</td>
      <td style="white-space: normal; word-break: break-word; min-width: 120px; max-width: 250px;">${d.Gene_name ?? ''}</td>
      <td style="white-space: normal; word-break: break-word; min-width: 120px; max-width: 250px;">${d.Gene_region ?? ''}</td>
      <td>${d.Relation_to_island ?? ''}</td>
      <td>${formatNumber(d.P_haEWAS)}</td>
      <td>${formatNumber(d.Effect_haEWAS)}</td>
      <td>${formatNumber(d.FDR_haEWAS)}</td>
      <td>${formatNumber(d.P_Beta)}</td>
      <td>${formatNumber(d.Effect_Beta)}</td>
      <td>${formatNumber(d.FDR_Beta)}</td>
      <td>${d.Group ?? ''}</td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById('rowCount').textContent = `${filtered.length} rows`;
  document.getElementById('totalPagesInfo').textContent = totalPages;
  
  const pageInput = document.getElementById('pageInput');
  if (pageInput) pageInput.value = page;

  document.getElementById('prevPage').disabled = (page <= 1);
  document.getElementById('nextPage').disabled = (page >= totalPages);

  requestAnimationFrame(() => {
    const tableWrap = document.getElementById('tableWrap');
    const dummy = document.getElementById('topScrollDummy');
    if (tableWrap && dummy) {
      dummy.style.width = tableWrap.scrollWidth + 'px';
    }
  });
}

function renderManhattanPlot() {
  const container = document.getElementById('plotContainer');
  if (!container || typeof Plotly === 'undefined') return;

  if (filtered.length === 0) {
    Plotly.purge(container);
    return;
  }

  const chrOrder = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','X','Y'];
  let plotData = filtered.filter(d => d.Chromosome && d.Start);

  let chrOffsets = {};
  let tickVals = [];
  let tickText = [];
  let currentOffset = 0;

  chrOrder.forEach((chr) => {
    let chrData = plotData.filter(d => String(d.Chromosome) === chr);
    if (chrData.length === 0) return;

    let maxPos = Math.max(...chrData.map(d => Number(d.Start)));
    chrOffsets[chr] = currentOffset;
    tickVals.push(currentOffset + (maxPos / 2));
    tickText.push(chr);

    currentOffset += maxPos + 10000000; 
  });

  const colorMap = {
    'haEWAS-specific': '#e63946',
    'Common': '#2a9d8f',
    'common': '#2a9d8f',          
    'EWAS-specific': '#457b9d',
    'Beta-specific': '#457b9d'
  };

  const drawOrder = ['EWAS-specific', 'Beta-specific', 'Common', 'common', 'haEWAS-specific'];
  let uniqueGroups = [...new Set(plotData.map(d => d.Group))].filter(Boolean);
  
  uniqueGroups.sort((a, b) => {
    let ia = drawOrder.indexOf(a);
    let ib = drawOrder.indexOf(b);
    if (ia === -1) ia = -1;
    if (ib === -1) ib = -1;
    return ia - ib;
  });

  let traces = [];

  uniqueGroups.forEach(grp => {
    let grpData = plotData.filter(d => d.Group === grp);
    if (grpData.length === 0) return;

    let xVals = [];
    let yVals = [];
    let textVals = [];

    grpData.forEach(d => {
      let offset = chrOffsets[String(d.Chromosome)];
      if (offset === undefined) return;

      let rawP = d.P_haEWAS; 
      if (d.Group === 'EWAS-specific' || d.Group === 'Beta-specific' || d.Group === 'Common' || d.Group === 'common') {
        rawP = d.P_Beta;
      }

      if (rawP === null || rawP === undefined || String(rawP).trim() === '' || String(rawP).toUpperCase() === 'NA') {
        return; 
      }

      let plotP = Number(rawP);
      if (isNaN(plotP) || plotP <= 0) {
        return; 
      }

      xVals.push(offset + Number(d.Start));
      yVals.push(-Math.log10(plotP));

      let plottedPName = (d.Group === 'haEWAS-specific') ? 'P_haEWAS' : 'P_Beta';

      textVals.push(
        `<b>CpG:</b> ${d.CpG_ID}<br>` +
        `<b>Gene:</b> ${d.Gene_name || 'N/A'}<br>` +
        `<b>Chr:</b> ${d.Chromosome}:${d.Start}<br>` +
        `<b>Group:</b> ${d.Group}<br>` +
        `----------------------<br>` +
        `<b>Plotting Y:</b> -log10(${plottedPName})<br>` +
        `<b>P_haEWAS:</b> ${formatNumber(d.P_haEWAS)} (FDR: ${formatNumber(d.FDR_haEWAS)})<br>` +
        `<b>P_Beta:</b> ${formatNumber(d.P_Beta)} (FDR: ${formatNumber(d.FDR_Beta)})`
      );
    });

    let isTarget = (grp === 'haEWAS-specific');

    traces.push({
      x: xVals,
      y: yVals,
      text: textVals,
      mode: 'markers',
      type: xVals.length > 500 ? 'scattergl' : 'scatter', 
      name: grp, 
      hoverinfo: 'text',
      marker: {
        size: isTarget ? 6 : 5, 
        color: colorMap[grp] || '#999999', 
        opacity: isTarget ? 0.9 : 0.6 
      }
    });
  });

  const currentPh = document.getElementById('phenotype').value;
  const plotTitle = currentPh 
    ? `Comparative Landscape of haEWAS and Conventional EWAS (${currentPh})` 
    : `Comparative Landscape of haEWAS and Conventional EWAS`;

  const layout = {
    title: { text: plotTitle, font: { size: 16 } },
    showlegend: true, 
    legend: { orientation: 'h', y: 1.05, x: 0.5, xanchor: 'center', yanchor: 'bottom', font: { size: 16 } },
    hovermode: 'closest',
    xaxis: { title: 'Chromosome', tickvals: tickVals, ticktext: tickText, showgrid: false, zeroline: false, tickangle: 0 },
    yaxis: { title: 'Significance: -log10(P)', zeroline: true },
    margin: { t: 100, l: 60, r: 20, b: 60 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)'
  };

  Plotly.react(container, traces, layout, { displayModeBar: true, responsive: true });

  if (!container._hasClickListener) {
    container.on('plotly_click', function(data) {
      if (data.points.length > 0) {
        const match = data.points[0].text.match(/CpG:<\/b>\s*(cg\d+)/);
        if (match && match[1]) {
          const clickedCpG = match[1];
          document.getElementById('search').value = clickedCpG;
          applyFilters(); 
        }
      }
    });
    container._hasClickListener = true;
  }
}

// ----- Sort indicators -----
function ensureSortIndicators() {
  document.querySelectorAll('#resultsTable thead th').forEach(th => {
    const key = th.dataset.sort;
    if (!key) return;
    if (!th.querySelector('.sort-ind')) {
      const ind = document.createElement('span');
      ind.className = 'sort-ind';
      ind.textContent = '⇅'; 
      th.appendChild(ind);
    }
    th.classList.add('th-sortable');
    th.tabIndex = 0; 
    th.setAttribute('role', 'button');
    th.setAttribute('aria-sort', 'none');
  });
}

function updateSortIndicators() {
  document.querySelectorAll('#resultsTable thead th').forEach(th => {
    const key = th.dataset.sort;
    if (!key) return;
    const ind = th.querySelector('.sort-ind');
    if (!ind) return;
    if (key === sortKey) {
      ind.textContent = sortAsc ? '▲' : '▼';
      th.setAttribute('aria-sort', sortAsc ? 'ascending' : 'descending');
    } else {
      ind.textContent = '⇅';
      th.setAttribute('aria-sort', 'none');
    }
  });
}

// ----- Interactions -----
function initSort() {
  ensureSortIndicators();
  updateSortIndicators();

  document.querySelectorAll('#resultsTable thead th').forEach(th => {
    const key = th.dataset.sort;
    if (!key) return;
    const toggle = () => {
      if (sortKey === key) { sortAsc = !sortAsc; }
      else { sortKey = key; sortAsc = true; }
      sortData();
      updateSortIndicators();
      renderTable(true);
    };
    th.addEventListener('click', toggle);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

function initPager() {
  const pageSizeSelect = document.getElementById('pageSize');
  const pageInput = document.getElementById('pageInput');
  const btnPrev = document.getElementById('prevPage');
  const btnNext = document.getElementById('nextPage');

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      pageSize = parseInt(e.target.value, 10);
      page = 1; renderTable(true);
    });
  }

  if (pageInput) {
    pageInput.addEventListener('change', (e) => {
      let val = parseInt(e.target.value, 10);
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      if (isNaN(val) || val < 1) val = 1;
      if (val > totalPages) val = totalPages;
      page = val; renderTable(true);
    });
  }

  if (btnPrev) btnPrev.addEventListener('click', () => { if (page > 1) { page--; renderTable(true); } });
  if (btnNext) btnNext.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page < totalPages) { page++; renderTable(true); }
  });
}

function initReset() {
  document.getElementById('resetBtn').addEventListener('click', () => {
    ['phenotype', 'chromosome', 'group', 'pValueThresh', 'search'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = '';
      }
    });
    applyFilters();
    updateSortIndicators();
  });
}

function initScrollSync() {
  const topScroll = document.getElementById('topScrollWrapper');
  const tableWrap = document.getElementById('tableWrap');
  if (topScroll && tableWrap) {
    topScroll.addEventListener('scroll', () => { tableWrap.scrollLeft = topScroll.scrollLeft; });
    tableWrap.addEventListener('scroll', () => { topScroll.scrollLeft = tableWrap.scrollLeft; });
  }
}

function renderLoadingStatusCustom(msg) {
  const footer = document.getElementById('tableFooter');
  if (!footer) return;
  let el = document.getElementById('loadingStatus');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loadingStatus';
    el.style.opacity = '0.85';
    el.style.whiteSpace = 'pre-line';
    footer.prepend(el);
  }
  el.textContent = msg;
}

function renderLoadingStatus() {
  const { totalFiles, completedFiles } = loadingState;
  let msg = '';
  if (totalFiles > 0 && completedFiles < totalFiles) {
    msg = `Loading CSVs: ${completedFiles} / ${totalFiles} completed…\nRows loaded: ${totalRowsLoaded}`;
  } else if (totalFiles > 0) {
    msg = `Loaded ${completedFiles} CSV file(s). Rows loaded: ${totalRowsLoaded}`;
  }
  if (errorLog.length) msg += `\nErrors (${errorLog.length}):\n- ` + errorLog.join('\n- ');
  renderLoadingStatusCustom(msg);
}

function applyFilters() {
  const ph = document.getElementById('phenotype').value;
  const chr = document.getElementById('chromosome').value;
  const grp = document.getElementById('group').value;
  const q  = document.getElementById('search').value.trim().toLowerCase();
  
  const threshVal = document.getElementById('pValueThresh').value;
  const maxP = threshVal ? Number(threshVal) : null;

  filtered = rawData.filter(d => {
    const passBasic = (!ph || d.Phenotype === ph)
      && (!chr || String(d.Chromosome) === String(chr))
      && (!grp || d.Group === grp)
      && (!q  || [d.CpG_ID, d.Gene_name, d.Gene_region].some(x => String(x ?? '').toLowerCase().includes(q)));

    if (!passBasic) return false;

    if (maxP !== null) {
      let rawP = d.P_haEWAS; 
      if (d.Group === 'EWAS-specific' || d.Group === 'Beta-specific' || d.Group === 'Common' || d.Group === 'common') {
        rawP = d.P_Beta;
      }
      let plotP = Number(rawP);
      if (isNaN(plotP) || plotP > maxP) return false;
    }
    return true;
  });

  sortData();
  page = 1;
  renderTable(true);
  renderManhattanPlot();
}

let renderTimeout = null;
function debouncedApplyFilters() {
  if (renderTimeout) return;
  renderTimeout = setTimeout(() => {
    applyFilters();
    renderTimeout = null;
  }, 800);
}

async function loadManifest() {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${MANIFEST_URL}`);
  const json = await res.json();
  if (!json || !Array.isArray(json.files)) {
    throw new Error('Manifest must be a JSON object with a "files" array.');
  }
  return json.files.filter(name => /\.csv$/i.test(name)).map(name => ({ name, url: csvAbsUrl(name) }));
}

function loadCsvWithWorker(url, name) {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_URL, { type: 'classic' });
    worker.onmessage = (e) => {
      const { type, rows, total, error } = e.data || {};
      if (type === 'rows') {
        rows.forEach(r => { if (r.Group === 'Beta-specific') r.Group = 'EWAS-specific'; });
        rawData.push(...rows);
        totalRowsLoaded += rows.length;

        if (filtered.length === 0) {
          filtered = rawData.slice();
          sortData();
          updateSortIndicators();
          renderTable(); 
        } else {
          debouncedApplyFilters();
        }
        renderLoadingStatus();
      } else if (type === 'complete') {
        loadingState.completedFiles++;
        renderLoadingStatus();
        resolve({ name, rows: total || 0 });
        worker.terminate();
      } else if (type === 'error') {
        loadingState.completedFiles++;
        errorLog.push(`${name}: ${String(error)}`);
        renderLoadingStatus();
        resolve({ name, rows: 0, error: String(error) });
        worker.terminate();
      }
    };
    worker.onerror = (err) => {
      loadingState.completedFiles++;
      errorLog.push(`${name}: ${String(err?.message || err)}`);
      renderLoadingStatus();
      resolve({ name, rows: 0, error: String(err?.message || err) });
      worker.terminate();
    };
    worker.postMessage({ url, fileLabel: name, batchSize: 4000 });
  });
}

async function bootData() {
  const files = await loadManifest();
  
  const currentManifestHash = CACHE_VERSION + JSON.stringify(files);
  const cachedManifestHash = localStorage.getItem('haEWAS_manifest_hash');

  if (cachedManifestHash === currentManifestHash) {
    renderLoadingStatusCustom('Loading data instantly from local browser cache...');
    const cachedData = await getCachedData();
    if (cachedData && cachedData.length > 0) {
      rawData = cachedData;
      totalRowsLoaded = rawData.length;
      
      updateSelects();
      applyFilters();
      updateSortIndicators();
      
      renderLoadingStatusCustom(`⚡ Loaded ${totalRowsLoaded} rows from local cache in milliseconds.`);
      return;
    }
  }

  loadingState.totalFiles = files.length;
  loadingState.completedFiles = 0;
  renderLoadingStatus();

  let i = 0;
  const concurrencyLimit = 6;
  const runners = Array(concurrencyLimit).fill().map(async () => {
    while (i < files.length) {
      const f = files[i++];
      await loadCsvWithWorker(f.url, f.name);
    }
  });

  await Promise.all(runners);

  updateSelects();
  applyFilters();
  updateSortIndicators();
  renderTable(true);
  renderLoadingStatusCustom(`Loaded ${totalRowsLoaded} rows. Saving to local cache for next time...`);

  await setCachedData(rawData);
  localStorage.setItem('haEWAS_manifest_hash', currentManifestHash);
  renderLoadingStatusCustom(`Loaded ${totalRowsLoaded} rows. Ready!`);
}

document.addEventListener('DOMContentLoaded', async () => {
  initSort();
  initPager(); 
  initReset();
  initScrollSync(); 

  ['phenotype', 'chromosome', 'group', 'driver', 'pValueThresh', 'search'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.addEventListener('input', applyFilters);
      el.addEventListener('change', applyFilters);
    }
  });

  try {
    await bootData();
  } catch (e) {
    console.error('Failed to load CSVs:', e);
    const tbody = document.querySelector('#resultsTable tbody');
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;">Failed to load data. ${String(e?.message || e)}</td></tr>`;
  }
});