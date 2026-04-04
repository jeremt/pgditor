import {browser} from "$app/environment";
import {catch_error} from "@les3dev/catch_error";
import {StoreContext} from "$lib/helpers/StoreContext";
import {get_toast_context} from "$lib/widgets/Toaster.svelte";
import {getContext, setContext} from "svelte";

class SettingsContext extends StoreContext {
    #color_scheme = $state<"light" | "dark">("dark");
    #match_light_color_scheme = matchMedia("(prefers-color-scheme: light)");
    #hide_system_tables = $state(true);
    #hide_views = $state(true);

    #toast_context = get_toast_context();

    constructor(store_path: string) {
        super(store_path);
        (async () => {
            if (browser) {
                const system_color_scheme = this.#match_light_color_scheme.matches ? "light" : "dark";
                this.#color_scheme =
                    (await this.get_from_store<"light" | "dark">("colorScheme")) ?? system_color_scheme;
                document.documentElement.setAttribute("color-scheme", this.#color_scheme);
                this.#hide_system_tables =
                    (await this.get_from_store<boolean>("hideSystemTables")) ?? true;
                this.#hide_views = (await this.get_from_store<boolean>("hideViews")) ?? true;
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
            const setError = await catch_error(() => this.set_to_store("colorScheme", this.#color_scheme));
            if (setError instanceof Error) {
                this.#toast_context.toast("Failed to save color scheme", {kind: "error"});
            }
            const saveError = await catch_error(() => this.save_store());
            if (saveError instanceof Error) {
                this.#toast_context.toast("Failed to save color scheme", {kind: "error"});
            }
        })();
    }

    get hide_system_tables() {
        return this.#hide_system_tables;
    }

    set hide_system_tables(newValue: boolean) {
        this.#hide_system_tables = newValue;
        (async () => {
            const setError = await catch_error(() => this.set_to_store("hideSystemTables", this.#hide_system_tables));
            if (setError instanceof Error) {
                this.#toast_context.toast("Failed to save hide system tables setting", {kind: "error"});
            }
            const saveError = await catch_error(() => this.save_store());
            if (saveError instanceof Error) {
                this.#toast_context.toast("Failed to save hide system tables setting", {kind: "error"});
            }
        })();
    }

    toggle_color_scheme = () => {
        this.color_scheme = this.color_scheme === "light" ? "dark" : "light";
    };

    toggle_hide_system_tables = () => {
        this.hide_system_tables = !this.hide_system_tables;
    };

    get hide_views() {
        return this.#hide_views;
    }

    set hide_views(newValue: boolean) {
        this.#hide_views = newValue;
        (async () => {
            const setError = await catch_error(() => this.set_to_store("hideViews", this.#hide_views));
            if (setError instanceof Error) {
                this.#toast_context.toast("Failed to save hide views setting", {kind: "error"});
            }
            const saveError = await catch_error(() => this.save_store());
            if (saveError instanceof Error) {
                this.#toast_context.toast("Failed to save hide views setting", {kind: "error"});
            }
        })();
    }

    toggle_hide_views = () => {
        this.hide_views = !this.hide_views;
    };
}

const key = Symbol();

export const get_settings_context = () => getContext<SettingsContext>(key);
export const set_settings_context = () => setContext(key, new SettingsContext("settings.json"));
