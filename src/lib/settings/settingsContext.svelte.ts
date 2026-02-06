import {browser} from "$app/environment";
import {catchError} from "$lib/helpers/catchError";
import {StoreContext} from "$lib/helpers/StoreContext";
import {getToastContext} from "$lib/widgets/Toaster.svelte";
import {getContext, setContext} from "svelte";

class SettingsContext extends StoreContext {
    #colorScheme = $state<"light" | "dark">("dark");
    #matchLightColorScheme = matchMedia("(prefers-color-scheme: light)");

    #toastContext = getToastContext();

    constructor(storePath: string) {
        super(storePath);
        (async () => {
            if (browser) {
                const systemColorScheme = this.#matchLightColorScheme.matches ? "light" : "dark";
                this.#colorScheme = (await this.getFromStore<"light" | "dark">("colorScheme")) ?? systemColorScheme;
                document.documentElement.setAttribute("color-scheme", this.#colorScheme);
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
            const setError = await catchError(this.setToStore("colorScheme", this.#colorScheme));
            if (setError instanceof Error) {
                this.#toastContext.toast("Failed to save color scheme", {kind: "error"});
            }
            const saveError = await catchError(this.saveToStore());
            if (saveError instanceof Error) {
                this.#toastContext.toast("Failed to save color scheme", {kind: "error"});
            }
        })();
    }

    toggleColorScheme = () => {
        this.colorScheme = this.colorScheme === "light" ? "dark" : "light";
    };
}

const key = Symbol("settings");

export const getSettingsContext = () => getContext<SettingsContext>(key);
export const setSettingsContext = () => setContext(key, new SettingsContext("settings.json"));
