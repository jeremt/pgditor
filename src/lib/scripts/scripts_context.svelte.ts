import {getContext, setContext} from "svelte";
import {get_toast_context} from "$lib/widgets/Toaster.svelte";
import {get_pg_context} from "$lib/table/pg_context.svelte";
import {catch_error} from "@les3dev/catch_error";
import {StoreContext} from "$lib/helpers/StoreContext";
import {get_connections_context} from "$lib/connection/connections_context.svelte";
import {readFile, writeTextFile} from "@tauri-apps/plugin-fs";
import {save} from "@tauri-apps/plugin-dialog";
import {writeText} from "@tauri-apps/plugin-clipboard-manager";
import {save_to_file} from "$lib/helpers/save_to_file";
import {rows_to_format, type RowsFormat} from "$lib/table/rows_format";

const store_path = "scripts.json";

export type ScriptFile = {path: string; updated_at: string};
export type ResultCell = {row: number; column: number};
export type ResultSelection = {anchor: ResultCell; focus: ResultCell};
export type ResultScope = "selection" | "all";

/**
 * Query results have no source table, so the generated `INSERT` targets a placeholder name.
 */
const RESULT_TABLE_NAME = "query_result";
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
    selection = $state<ResultSelection>();

    result_columns = $derived(
        this.last_result?.length ? Object.keys(this.last_result[0]).filter((col) => col !== "__index") : [],
    );

    /**
     * Normalized bounds of the rectangular selection, whatever direction it was dragged in.
     */
    selection_bounds = $derived.by(() => {
        if (!this.selection) {
            return undefined;
        }
        const {anchor, focus} = this.selection;
        return {
            row_start: Math.min(anchor.row, focus.row),
            row_end: Math.max(anchor.row, focus.row),
            column_start: Math.min(anchor.column, focus.column),
            column_end: Math.max(anchor.column, focus.column),
        };
    });

    is_cell_selected = (row: number, column: number) => {
        const bounds = this.selection_bounds;
        return (
            bounds !== undefined &&
            row >= bounds.row_start &&
            row <= bounds.row_end &&
            column >= bounds.column_start &&
            column <= bounds.column_end
        );
    };

    clear_result = () => {
        this.error_message = "";
        this.last_result = undefined;
        this.selection = undefined;
    };

    #result_scope_data = (scope: ResultScope) => {
        const rows = this.last_result ?? [];
        const bounds = this.selection_bounds;
        if (scope === "all" || bounds === undefined) {
            return {columns: this.result_columns, rows};
        }
        return {
            columns: this.result_columns.slice(bounds.column_start, bounds.column_end + 1),
            rows: rows.slice(bounds.row_start, bounds.row_end + 1),
        };
    };

    #format_result = (scope: ResultScope, format: RowsFormat) => {
        const {columns, rows} = this.#result_scope_data(scope);
        // results are returned as text by the backend, so every value is quoted as text
        return rows_to_format(
            format,
            RESULT_TABLE_NAME,
            columns.map((column_name) => ({column_name, data_type: "text" as const})),
            rows,
        );
    };

    copy_result = async (scope: ResultScope, format: RowsFormat) => {
        await writeText(this.#format_result(scope, format));
        this.#toaster.toast(`Copied ${scope === "all" ? "all results" : "selection"} as ${format.toUpperCase()}`);
    };

    export_result = async (scope: ResultScope, format: RowsFormat) => {
        if (await save_to_file(this.#format_result(scope, format), [format])) {
            this.#toaster.toast(`Exported ${scope === "all" ? "all results" : "selection"} to ${format.toUpperCase()}`, {
                kind: "success",
            });
        } else {
            this.#toaster.toast(`Failed to export ${format.toUpperCase()}`, {kind: "error"});
        }
    };

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
        const result = await catch_error(() =>
            this.#pg.raw_query(this.current_selection ? this.current_selection : this.current_value),
        );
        if (result instanceof Error) {
            this.error_message = result.message;
        } else {
            this.selection = undefined;
            this.last_result = result;
            if (this.last_result !== undefined) {
                for (let i = 0; i < this.last_result.length; i++) {
                    this.last_result[i].__index = i.toString(); // used to prevent re-render table rows
                }
            }
        }
    };
}
const key = Symbol();

export const get_scripts_context = () => getContext<ScriptsContext>(key);
export const set_scripts_context = () => setContext(key, new ScriptsContext(store_path));
