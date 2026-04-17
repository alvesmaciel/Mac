const THEME_STORAGE_KEY = 'autofinance_theme';

export class ThemeController {
    constructor({ onThemeChange }) {
        this.onThemeChange = onThemeChange;
        this.button = document.getElementById('darkToggleBtn');
        this.button.addEventListener('click', () => this.toggle());
    }

    boot() {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        this.apply(savedTheme === 'dark');
    }

    toggle() {
        const nextDark = !document.documentElement.classList.contains('dark');
        localStorage.setItem(THEME_STORAGE_KEY, nextDark ? 'dark' : 'light');
        this.apply(nextDark);
    }

    apply(dark) {
        document.documentElement.classList.toggle('dark', dark);
        this.button.textContent = dark ? 'Sol' : 'Lua';
        this.button.title = dark ? 'Modo claro' : 'Modo escuro';
        this.onThemeChange();
    }
}
