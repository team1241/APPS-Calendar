export type ThemePreference = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "apps-calendar-theme";

/**
 * @brief Inline script for <head>: applies a saved theme before first paint so it never flashes.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/**
 * @brief The theme saved in this browser, or "system" when none is saved or storage is unavailable.
 */
export function readThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

/**
 * @brief Applies a theme to the page and saves it; "system" follows the device setting.
 */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
  try {
    if (preference === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Private browsing or blocked storage: the theme still applies for this visit.
  }
}
