// assets/main.js

// 1) Footer year
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

// 2) Smooth same-page anchors
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const el = document.getElementById(id);
  if (el) {
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.pushState(null, '', `#${id}`);
  }
});

// 3) Copy citation + toast
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('#copyCitationBtn');
  if (!btn) return;
  const citation = 'Name et al. Correcting methylation heterogeneity improves epigenome-wide discovery of phenotype-associated CpGs. Preprint/Journal, 2025. DOI: TBD.';
  try {
    await navigator.clipboard.writeText(citation);
    showToast('Copied!');
  } catch {
    showToast('Copy failed');
  }
});

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1500);
}

// 4) Reveal-on-scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
