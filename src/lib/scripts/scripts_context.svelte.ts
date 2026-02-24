import {getContext, setContext} from "svelte";
import {get_toast_context} from "$lib/widgets/Toaster.svelte";
import {get_pg_context} from "$lib/table/pg_context.svelte";
import {catch_error} from "$lib/helpers/catch_error";
import {StoreContext} from "$lib/helpers/StoreContext";
import {get_connections_context} from "$lib/connection/connections_context.svelte";
import {readFile, writeTextFile} from "@tauri-apps/plugin-fs";
import {save} from "@tauri-apps/plugin-dialog";

const store_path = "scripts.json";

export type ScriptFile = {path: string; updated_at: string};
class ScriptsContext extends StoreContext {
    #connections = get_connections_context();
    #pg = get_pg_context();
    #toaster = get_toast_context();

    #files = $state<ScriptFile[]>([]);
    get files() {
        return this.#files;
    }

    #current_file = $state<ScriptFile>();
    get current_file() {
        return this.#current_file;
    }

    current_value = $state("");
    current_selection = $state("");
    last_result = $state<Record<string, string | null>[]>();
    error_message = $state("");

    constructor(store_path: string) {
        super(store_path);

        $effect(() => {
            if (this.#connections.current) {
                this.load_all();
            }
        });
    }

    load_all = async () => {
        if (!this.#connections.current?.name) {
            return;
        }
        this.#files = (await this.get_from_store<ScriptFile[]>(`${this.#connections.current.name}-scripts`)) ?? [];
    };

    select_file = async (file: ScriptFile) => {
        this.#current_file = file;
        try {
            const decoder = new TextDecoder();
            this.current_value = decoder.decode(await readFile(file.path));
        } catch (err) {
            this.#toaster.toast(`Could not read file ${file.path}`, {
                kind: "error",
                details: err instanceof Error ? err.message : (err as string),
            });
        }
    };

    empty_file = () => {
        this.#current_file = undefined;
        this.current_value = "";
    };

    import_file = async (script_path: string) => {
        if (!this.#connections.current?.name) {
            return;
        }
        const i = this.#files.findIndex((file) => file.path === script_path);
        if (i === -1) {
            this.#files.push({
                path: script_path,
                updated_at: new Date().toISOString(),
            });
        } else {
            this.#files[i].updated_at = new Date().toISOString();
        }
        await this.set_to_store(`${this.#connections.current.name}-scripts`, this.#files);
        await this.save_store();
    };

    remove_current_file = async () => {
        if (!this.#connections.current?.name || !this.#current_file?.path) {
            return;
        }
        const currentPath = this.#current_file.path;
        const i = this.#files.findIndex((file) => file.path === currentPath);
        console.log(i, currentPath, this.#files);
        if (i === -1) {
            console.warn(`File ${currentPath} isn't imported.`);
        } else {
            this.#files.splice(i, 1);
            await this.set_to_store(`${this.#connections.current.name}-scripts`, this.#files);
            await this.save_store();
            this.#current_file = undefined;
            this.current_value = "";
        }
    };

    save_current_file = async () => {
        let path = this.#current_file?.path ?? null;
        if (path === null) {
            path = await save({
                title: "Save sql script",
                filters: [{name: "SQL", extensions: ["sql"]}],
            });
            if (path === null) {
                this.#toaster.toast(`Failed to save file to ${path}`, {kind: "error"});
                return;
            }
            await this.import_file(path);
            this.#current_file = this.#files.find((f) => f.path === path);
            console.log("is new file");
        }
        await writeTextFile(path, this.current_value);
        this.#toaster.toast(`File saved to ${path}`, {kind: "success"});
    };

    run = async () => {
        this.error_message = "";
        const result = await catch_error(
            this.#pg.raw_query(this.current_selection ? this.current_selection : this.current_value),
        );
        if (result instanceof Error) {
            this.error_message = result.message;
        } else {
            this.last_result = result;
            if (this.last_result !== undefined) {
                for (let i = 0; i < this.last_result.length; i++) {
                    this.last_result[i].__index = i.toString(); // used to prevent re-render table rows
                }
            }
        }
    };
}
const key = Symbol("scriptsContext");

export const get_scripts_context = () => getContext<ScriptsContext>(key);
export const set_scripts_context = () => setContext(key, new ScriptsContext(store_path));
