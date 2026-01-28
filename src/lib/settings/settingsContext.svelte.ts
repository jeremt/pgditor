import {browser} from "$app/environment";
import {StoreContext} from "$lib/helpers/StoreContext";
import {getContext, setContext} from "svelte";

class SettingsContext extends StoreContext {
    #colorScheme = $state<"light" | "dark">("dark");
    #matchLightColorScheme = matchMedia("(prefers-color-scheme: light)");

    constructor(storePath: string) {
        super(storePath);
        (async () => {
            if (browser) {
                this.#colorScheme =
                    ((await this.getFromStore<"light" | "dark">("colorScheme")) ?? this.#matchLightColorScheme.matches)
                        ? "light"
                        : "dark";
            }
        })();
        this.#matchLightColorScheme.addEventListener("change", ({matches}) => {
            this.colorScheme = matches ? "light" : "dark";
        });
    }

    get colorScheme() {
        return this.#colorScheme;
    }

    set colorScheme(newValue: "light" | "dark") {
        this.#colorScheme = newValue;
        document.documentElement.setAttribute("color-scheme", this.#colorScheme);
        (async () => {
            await this.setToStore("colorScheme", this.#colorScheme); // TODO: error handling
            await this.saveToStore();
        })();
    }
}

const key = Symbol("settings");

export const getSettingsContext = () => getContext<SettingsContext>(key);
export const setSettingsContext = () => setContext(key, new SettingsContext("settings.json"));
