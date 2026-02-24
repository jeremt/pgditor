import {browser} from "$app/environment";
import {catch_error} from "$lib/helpers/catch_error";
import {StoreContext} from "$lib/helpers/StoreContext";
import {get_toast_context} from "$lib/widgets/Toaster.svelte";
import {getContext, setContext} from "svelte";

class SettingsContext extends StoreContext {
    #colorScheme = $state<"light" | "dark">("dark");
    #matchLightColorScheme = matchMedia("(prefers-color-scheme: light)");

    #toastContext = get_toast_context();

    constructor(storePath: string) {
        super(storePath);
        (async () => {
            if (browser) {
                const systemColorScheme = this.#matchLightColorScheme.matches ? "light" : "dark";
                this.#colorScheme = (await this.get_from_store<"light" | "dark">("colorScheme")) ?? systemColorScheme;
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
            const setError = await catch_error(this.set_to_store("colorScheme", this.#colorScheme));
            if (setError instanceof Error) {
                this.#toastContext.toast("Failed to save color scheme", {kind: "error"});
            }
            const saveError = await catch_error(this.save_store());
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

export const get_settings_context = () => getContext<SettingsContext>(key);
export const set_settings_context = () => setContext(key, new SettingsContext("settings.json"));
