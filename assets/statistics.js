// assets/statistics.js — Render global comparative dashboard charts

const PROJECT_SLUG = 'hetero-ewas-explorer'; 
function detectBasePrefix() {
  const p = location.pathname;
  const marker = `/${PROJECT_SLUG}/`;
  const i = p.indexOf(marker);
  if (i >= 0) return p.slice(0, i + marker.length); 
  return p.endsWith('/') ? p : p.replace(/[^/]+$/, '');
}
const BASE_PATH = detectBasePrefix();                  
const BASE_URL  = new URL(BASE_PATH, location.origin); 
const STATS_URL = new URL('data/downloads/summary_stats.json', BASE_URL).href;

const layoutBase = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: { family: 'inherit' },
  margin: { t: 60, l: 50, r: 30, b: 50 } 
};

const colorMap = {
  'haEWAS-specific': '#e63946',
  'Common': '#2a9d8f',
  'common': '#2a9d8f',
  'EWAS-specific': '#457b9d'
};

const drawOrder = ['haEWAS-specific', 'Common', 'EWAS-specific']; 

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(STATS_URL);
    if (!res.ok) throw new Error('Failed to load JSON');
    const data = await res.json();

    renderGroupsChart(data.groups);
    renderDriversChart(data.drivers);
    renderRegionsChart(data.regions);
    renderPhenotypesChart(data.phenotypes);

    window.addEventListener('resize', () => {
      Plotly.Plots.resize('chart-groups');
      Plotly.Plots.resize('chart-drivers');
      Plotly.Plots.resize('chart-regions');
      Plotly.Plots.resize('chart-phenos');
      Plotly.Plots.resize('chart-pheno-pie');
      Plotly.Plots.resize('chart-pheno-drivers');
    });

  } catch (err) {
    document.querySelector('.dashboard-grid').innerHTML = 
      `<p style="color:red;">Failed to load data: ${err.message}. Ensure generate_stats.py has been executed.</p>`;
  }
});

function renderGroupsChart(groupsData) {
  const labels = [];
  const values = [];
  drawOrder.forEach(grp => {
    if(groupsData[grp] !== undefined) {
      labels.push(grp);
      values.push(groupsData[grp]);
    }
  });
  const colors = labels.map(lbl => colorMap[lbl] || '#999');

  const trace = {
    labels: labels, values: values, type: 'pie', hole: 0.4,
    sort: false,
    marker: { colors: colors }, textinfo: 'label+percent', hoverinfo: 'label+value'
  };

  const layout = {
    ...layoutBase,
    margin: { t: 60, l: 50, r: 30, b: 50 },
    title: { text: 'Global Epigenetic Variations Identified', font: { size: 16 } },
    showlegend: true, legend: { orientation: 'h', y: -0.1, xanchor: 'center', x: 0.5 }
  };
  Plotly.newPlot('chart-groups', [trace], layout, { displayModeBar: false, responsive: true });
}

function renderDriversChart(driversData) {
  const xLabels = ['CHALM', 'CAMDA'];
  const traces = [];

  ['Common', 'haEWAS-specific'].forEach(grp => {
    if (!driversData[grp]) return;
    const yVals = xLabels.map(drv => driversData[grp][drv] || 0);
    traces.push({
      x: xLabels, y: yVals, name: grp, type: 'bar',
      marker: { color: colorMap[grp] }
    });
  });

  const layout = {
    ...layoutBase,
    margin: { t: 60, l: 50, r: 30, b: 50 },
    barmode: 'group',
    title: { text: 'Heterogeneity Drivers by Group', font: { size: 16 } },
    showlegend: true, legend: { orientation: 'h', y: -0.1, xanchor: 'center', x: 0.5 }
  };
  Plotly.newPlot('chart-drivers', traces, layout, { displayModeBar: false, responsive: true });
}

function renderRegionsChart(regionsData) {
  const allRegions = new Set();
  Object.values(regionsData).forEach(g => Object.keys(g).forEach(r => allRegions.add(r)));
  const xLabels = Array.from(allRegions);

  const traces = [];
  drawOrder.forEach(grp => {
    if(!regionsData[grp]) return;
    const yVals = xLabels.map(r => regionsData[grp][r] || 0);
    traces.push({
      x: xLabels, y: yVals, name: grp, type: 'bar',
      marker: { color: colorMap[grp] }
    });
  });

  const layout = {
    ...layoutBase,
    barmode: 'group',
    title: { text: 'Genomic Context Comparison', font: { size: 16 } },
    xaxis: { tickangle: -45 },
    yaxis: { title: 'Number of CpGs' },
    margin: { t: 60, l: 60, r: 30, b: 80 },
    legend: { orientation: 'h', x: 0, xanchor: 'left', y: 1.05, yanchor: 'bottom' }
  };
  Plotly.newPlot('chart-regions', traces, layout, { displayModeBar: false, responsive: true });
}

function renderPhenotypesChart(phenosData) {
  const entries = Object.entries(phenosData);
  entries.sort((a, b) => a[1].total - b[1].total); 

  const yLabels = entries.map(e => e[0]);
  const traces = [];

  drawOrder.forEach(grp => {
    const xVals = entries.map(e => {
      const val = e[1].groups[grp] || 0;
      return val > 0 ? val : null; 
    });

    traces.push({
      y: yLabels, x: xVals, name: grp, type: 'bar', orientation: 'h',
      marker: { color: colorMap[grp] },
      text: xVals.map(v => v ? String(v) : ''), 
      textposition: 'outside', hoverinfo: 'name+x'
    });
  });

  const dynamicHeight = Math.max(500, entries.length * 45);

  const layout = {
    ...layoutBase,
    height: dynamicHeight, 
    barmode: 'group', 
    title: null, 
    xaxis: { title: 'Number of CpGs (Log)', type: 'log', dtick: 1 },
    yaxis: { automargin: true, tickmode: 'linear', dtick: 1 },
    margin: { t: 30, l: 10, r: 60, b: 50 },
    legend: { orientation: 'h', x: 0, xanchor: 'left', y: 1.0, yanchor: 'bottom' }
  };

  Plotly.newPlot('chart-phenos', traces, layout, { displayModeBar: false, responsive: true });

  if (entries.length > 0) {
    const largestPheno = entries[entries.length - 1][0]; 
    const phenoInfo = phenosData[largestPheno];
    setTimeout(() => {
      renderPhenoDetails(largestPheno, phenoInfo);
    }, 500);
  }

  const phenoChart = document.getElementById('chart-phenos');
  phenoChart.on('plotly_click', function(data) {
    if (data.points.length > 0) {
      const clickedPheno = data.points[0].y;
      const phenoInfo = phenosData[clickedPheno];
      if (phenoInfo) {
        renderPhenoDetails(clickedPheno, phenoInfo);
      }
    }
  });
}

function renderPhenoDetails(phenoName, phenoInfo) {
  document.getElementById('pheno-placeholder').style.display = 'none';
  const pieWrapper = document.getElementById('pie-wrapper');
  const driverWrapper = document.getElementById('driver-wrapper');
  
  pieWrapper.style.display = 'block';
  document.getElementById('pie-title').textContent = phenoName;

  const gLabels = [];
  const gValues = [];
  drawOrder.forEach(grp => {
    if (phenoInfo.groups[grp] !== undefined) {
      gLabels.push(grp);
      gValues.push(phenoInfo.groups[grp]);
    }
  });
  const gColors = gLabels.map(lbl => colorMap[lbl] || '#999');

  const traceGroups = {
    labels: gLabels, values: gValues, type: 'pie', hole: 0.4,
    sort: false,
    marker: { colors: gColors }, textinfo: 'percent', hoverinfo: 'label+value'
  };
  
  const layoutGroups = {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    title: null, 
    margin: { t: 40, l: 20, r: 20, b: 20 },
    showlegend: true, legend: { orientation: 'h', y: -0.1, xanchor: 'center', x: 0.5 }
  };
  Plotly.newPlot('chart-pheno-pie', [traceGroups], layoutGroups, { displayModeBar: false, responsive: true });

  const preferredDriverOrder = ['CHALM', 'CAMDA', 'Both'];
  const rawDrivers = phenoInfo.drivers || {};
  
  const dLabels = Object.keys(rawDrivers).sort((a, b) => {
    let idxA = preferredDriverOrder.indexOf(a);
    let idxB = preferredDriverOrder.indexOf(b);
    if(idxA === -1) idxA = 99;
    if(idxB === -1) idxB = 99;
    return idxA - idxB;
  });
  const dValues = dLabels.map(lbl => rawDrivers[lbl]);
  
  const dColors = dLabels.map(lbl => 
    lbl.toUpperCase().includes('CHALM') ? '#f4a261' : 
    lbl.toUpperCase().includes('CAMDA') ? '#e76f51' : 
    '#e9c46a'
  );

  if (dLabels.length > 0) {
    driverWrapper.style.display = 'block';
    const traceDrivers = {
      labels: dLabels, values: dValues, type: 'pie', hole: 0.5,
      sort: false,
      marker: { colors: dColors }, textinfo: 'percent', hoverinfo: 'label+value'
    };
    const layoutDrivers = {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      title: null, 
      margin: { t: 40, l: 20, r: 20, b: 20 },
      showlegend: true, legend: { orientation: 'h', y: -0.1, xanchor: 'center', x: 0.5 }
    };
    Plotly.newPlot('chart-pheno-drivers', [traceDrivers], layoutDrivers, { displayModeBar: false, responsive: true });
  } else {
    driverWrapper.style.display = 'none';
    Plotly.purge('chart-pheno-drivers');
  }
}