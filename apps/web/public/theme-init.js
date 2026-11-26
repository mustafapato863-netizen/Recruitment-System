/* global document, localStorage */
(() => {
  try {
    const storedTheme = localStorage.getItem('recruitflow.theme');
    const theme = storedTheme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  }

  const fontLink = document.getElementById('rf-google-fonts');
  if (fontLink) {
    const activate = () => {
      fontLink.media = 'all';
    };
    if (fontLink.sheet) {
      activate();
    } else {
      fontLink.addEventListener('load', activate, { once: true });
    }
  }
})();
