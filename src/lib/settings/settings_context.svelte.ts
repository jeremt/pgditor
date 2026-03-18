import {browser} from "$app/environment";
import {catch_error} from "$lib/helpers/catch_error";
import {StoreContext} from "$lib/helpers/StoreContext";
import {get_toast_context} from "$lib/widgets/Toaster.svelte";
import {getContext, setContext} from "svelte";

class SettingsContext extends StoreContext {
    #color_scheme = $state<"light" | "dark">("dark");
    #match_light_color_scheme = matchMedia("(prefers-color-scheme: light)");

    #toast_context = get_toast_context();

    constructor(store_path: string) {
        super(store_path);
        (async () => {
            if (browser) {
                const system_color_scheme = this.#match_light_color_scheme.matches ? "light" : "dark";
                this.#color_scheme =
                    (await this.get_from_store<"light" | "dark">("colorScheme")) ?? system_color_scheme;
                document.documentElement.setAttribute("color-scheme", this.#color_scheme);
            }
        })();
        this.#match_light_color_scheme.addEventListener("change", ({matches}) => {
            this.color_scheme = matches ? "light" : "dark";
        });
    }

    get color_scheme() {
        return this.#color_scheme;
    }

    set color_scheme(newValue: "light" | "dark") {
        this.#color_scheme = newValue;
        document.documentElement.setAttribute("color-scheme", this.#color_scheme);
        (async () => {
            const setError = await catch_error(this.set_to_store("colorScheme", this.#color_scheme));
            if (setError instanceof Error) {
                this.#toast_context.toast("Failed to save color scheme", {kind: "error"});
            }
            const saveError = await catch_error(this.save_store());
            if (saveError instanceof Error) {
                this.#toast_context.toast("Failed to save color scheme", {kind: "error"});
            }
        })();
    }

    toggle_color_scheme = () => {
        this.color_scheme = this.color_scheme === "light" ? "dark" : "light";
    };
}

const key = Symbol();

export const get_settings_context = () => getContext<SettingsContext>(key);
export const set_settings_context = () => setContext(key, new SettingsContext("settings.json"));
