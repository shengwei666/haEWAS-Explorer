(function(){
  const key = 'hc-ewas-theme';
  const root = document.documentElement;

  function applyTheme(theme){
    if(theme === 'light'){
      root.classList.add('light');
    }else{
      root.classList.remove('light');
    }
    localStorage.setItem(key, theme);
  }

  function toggle(){
    const current = localStorage.getItem(key) || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // init
  const initial = localStorage.getItem(key) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(initial);

  window.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('themeToggle');
    if(btn) btn.addEventListener('click', toggle);
    // year
    const y = document.getElementById('year');
    if(y) y.textContent = new Date().getFullYear();
  });
})();
