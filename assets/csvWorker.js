// assets/csvWorker.js — Papa Parse in a Web Worker
importScripts('papaparse.min.js');

self.onmessage = (e) => {
  const { url, fileLabel = '', batchSize = 2000 } = e.data || {};
  if (!url) {
    self.postMessage({ type: 'error', error: 'No CSV URL provided.', fileLabel });
    return;
  }

  const datasetName = fileLabel.replace(/\.csv$/i, '');

  let buffer = [];
  let totalCount = 0;

  const flush = () => {
    if (buffer.length) {
      self.postMessage({ type: 'rows', rows: buffer, fileLabel });
      buffer = [];
    }
  };

  Papa.parse(url, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    worker: false,
    chunk: (results) => {
      const rows = (results.data || []).map((d) => {
        const rawChr = String(d.seqnames || d.chromosome || d.Chromosome || '');
        const cleanChr = rawChr.replace(/^chr/i, '');
        
        const rawGroup = String(d.Group || '');
        const cleanGroup = rawGroup.replace(/-only/gi, '-specific');

        return {
          CpG_ID: d.CpG_ID,
          Phenotype: datasetName, 
          Chromosome: cleanChr,
          Start: d.start || d.Start,
          End: d.end || d.End,
          Gene_name: d.gene_name || d.Gene_name,
          Gene_region: d.gene_region || d.Gene_region,
          Relation_to_island: d.relation_to_island || d.Relation_to_island,
          P_Beta: +d.P_Beta,
          Effect_Beta: +d.Effect_Beta,
          P_CHALM: +d.P_CHALM,
          Effect_CHALM: +d.Effect_CHALM,
          P_CAMDA: +d.P_CAMDA,
          Effect_CAMDA: +d.Effect_CAMDA,
          P_haEWAS: +d.P_haEWAS,
          Effect_haEWAS: +d.Effect_haEWAS,
          haEWAS_Driver: d.haEWAS_Driver || d.HaEWAS_Driver, 
          Group: cleanGroup,
          Source: fileLabel
        };
      });

      buffer.push(...rows);
      totalCount += rows.length;
      if (buffer.length >= batchSize) flush();
    },
    complete: () => {
      flush();
      self.postMessage({ type: 'complete', total: totalCount, fileLabel });
    },
    error: (err) => {
      self.postMessage({ type: 'error', error: err?.message || String(err), fileLabel });
    }
  });
};