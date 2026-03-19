# Heterogeneity-Adjusted EWAS Explorer (v1.0)

[![GitHub Pages](https://img.shields.io/badge/Status-Live-brightgreen)](https://shengwei666.github.io/haEWAS-Explorer/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bioinformatics](https://img.shields.io/badge/Field-Bioinformatics-blue)](https://en.wikipedia.org/wiki/Bioinformatics)

**Heterogeneity-Adjusted EWAS Explorer** is a professional, high-performance web portal designed for the exploration and visualization of DNA methylation meta-analysis summaries. By implementing a **Heterogeneity-Adjusted (haEWAS)** framework, this platform enables the identification of phenotype-associated CpG markers driven by methylation heterogeneity (**CHALM**) and co-methylation (**CAMDA**)—signals that are typically masked in conventional Beta-value-based Epigenome-Wide Association Studies (EWAS).

## Key Features

* **Global Statistics Dashboard:** Visualizes the "haEWAS Advantage" through interactive donut charts and grouped bar plots, comparing haEWAS-specific discoveries against conventional EWAS results across 40+ phenotypes.
* **Interactive Manhattan Plots:** Dynamic genome-wide association views seamlessly linked to data tables. Users can click any data point on the plot to instantly filter the corresponding statistics in the table below.
* **Dual-Layer Data Mining:**
    * **Macro-scale:** Explore genomic context distribution (TSS1500, Body, Island, etc.) and primary heterogeneity drivers.
    * **Micro-scale:** Search by CpG ID, Gene Name, or Genomic Location with real-time filtering and sorting.
* **Reproducible Science:** One-click downloads for full meta-analysis summary statistics in standardized CSV formats.

## Technical Architecture

This is a **serverless static web application** optimized for speed and reliability:
* **Frontend:** Vanilla JS / HTML5 / CSS3 (No heavy frameworks for maximum compatibility).
* **Visualization:** Powered by **Plotly.js** for high-fidelity interactive scientific plots.
* **Data Processing:** Utilizes **Web Workers** and **PapaParse** to handle large-scale CSV parsing (80,000+ rows) directly in the user's browser without server-side lag.
* **Deployment:** Hosted on GitHub Pages.

## Citation

If you use this explorer or the haEWAS framework in your research, please cite:

> A. et al. (2026). Correcting methylation heterogeneity improves epigenome-wide discovery of phenotype-associated loci.*

---
© 2026 **Heterogeneity-Adjusted EWAS Explorer Team**. All rights reserved.*