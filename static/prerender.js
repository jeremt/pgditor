import {load} from "@tauri-apps/plugin-store";

(async () => {
    const settingsStore = await load("settings.json");
    const localSettings = settingsStore.get("colorScheme");
    const matchLightScheme = matchMedia("(prefers-color-scheme: light)");

    const defaultSettings = {
        colorScheme: matchLightScheme.matches ? "light" : "dark",
        highContrast: false,
    };

    const settings = localSettings ?? defaultSettings;

    document.documentElement.setAttribute("color-scheme", settings.colorScheme ?? defaultSettings.colorScheme);
    document.documentElement.setAttribute("data-highContrast", settings.highContrast ?? defaultSettings.highContrast);
})();
