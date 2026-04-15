document.addEventListener('DOMContentLoaded', () => {
  const THEME_KEY = 'cookit-theme';

  const getPreferredTheme = () => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const applyTheme = (theme) => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark-mode', isDark);
    document.body?.classList.toggle('dark-mode', isDark);
    window.localStorage.setItem(THEME_KEY, theme);
    return isDark;
  };

  const syncToggleLabel = (button, isDark) => {
    button.textContent = isDark ? '☀' : '☾';
    button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    button.title = isDark ? 'Light mode' : 'Dark mode';
  };

  const toggleTheme = (button) => {
    const isDark = document.documentElement.classList.contains('dark-mode');
    const nextTheme = isDark ? 'light' : 'dark';
    const nextIsDark = applyTheme(nextTheme);
    syncToggleLabel(button, nextIsDark);
  };

  const mountThemeToggle = () => {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'theme-toggle';
    const isDark = applyTheme(getPreferredTheme());
    syncToggleLabel(toggle, isDark);
    toggle.addEventListener('click', () => toggleTheme(toggle));
    document.body.appendChild(toggle);
  };

  mountThemeToggle();
});
