import {getContext, setContext} from "svelte";
import {getToastContext} from "$lib/widgets/Toaster.svelte";
import {getPgContext} from "$lib/table/pgContext.svelte";
import {catchError} from "$lib/helpers/catchError";
import {StoreContext} from "$lib/helpers/StoreContext";
import {getConnectionsContext} from "$lib/connection/connectionsContext.svelte";
import {readFile, writeTextFile} from "@tauri-apps/plugin-fs";
import {save} from "@tauri-apps/plugin-dialog";

const storePath = "scripts.json";

export type ScriptFile = {path: string; updated_at: string};
class ScriptsContext extends StoreContext {
    #connections = getConnectionsContext();
    #pg = getPgContext();
    #toaster = getToastContext();

    #files = $state<ScriptFile[]>([]);
    get files() {
        return this.#files;
    }

    #currentFile = $state<ScriptFile>();
    get currentFile() {
        return this.#currentFile;
    }

    currentValue = $state("");
    currentSelection = $state("");
    lastResult = $state<Record<string, string | null>[]>();
    errorMessage = $state("");

    constructor(storePath: string) {
        super(storePath);

        $effect(() => {
            if (this.#connections.current) {
                this.loadAll();
            }
        });
    }

    loadAll = async () => {
        if (!this.#connections.current?.name) {
            return;
        }
        this.#files = (await this.getFromStore<ScriptFile[]>(`${this.#connections.current.name}-scripts`)) ?? [];
    };

    selectFile = async (file: ScriptFile) => {
        this.#currentFile = file;
        try {
            const decoder = new TextDecoder();
            this.currentValue = decoder.decode(await readFile(file.path));
        } catch (err) {
            this.#toaster.toast(`Could not read file ${file.path}`, {
                kind: "error",
                details: err instanceof Error ? err.message : (err as string),
            });
        }
    };

    emptyFile = () => {
        this.#currentFile = undefined;
        this.currentValue = "";
    };

    importFile = async (scriptPath: string) => {
        if (!this.#connections.current?.name) {
            return;
        }
        const i = this.#files.findIndex((file) => file.path === scriptPath);
        if (i === -1) {
            this.#files.push({
                path: scriptPath,
                updated_at: new Date().toISOString(),
            });
        } else {
            this.#files[i].updated_at = new Date().toISOString();
        }
        await this.setToStore(`${this.#connections.current.name}-scripts`, this.#files);
        await this.saveToStore();
    };

    removeCurrentFile = async () => {
        if (!this.#connections.current?.name || !this.#currentFile?.path) {
            return;
        }
        const currentPath = this.#currentFile.path;
        const i = this.#files.findIndex((file) => file.path === currentPath);
        console.log(i, currentPath, this.#files);
        if (i === -1) {
            console.warn(`File ${currentPath} isn't imported.`);
        } else {
            this.#files.splice(i, 1);
            await this.setToStore(`${this.#connections.current.name}-scripts`, this.#files);
            await this.saveToStore();
            this.#currentFile = undefined;
            this.currentValue = "";
        }
    };

    saveCurrentFile = async () => {
        let path = this.#currentFile?.path ?? null;
        if (path === null) {
            path = await save({
                title: "Save sql script",
                filters: [{name: "SQL", extensions: ["sql"]}],
            });
            if (path === null) {
                this.#toaster.toast(`Failed to save file to ${path}`, {kind: "error"});
                return;
            }
            await this.importFile(path);
            this.#currentFile = this.#files.find((f) => f.path === path);
        }
        await writeTextFile(path, this.currentValue);
        this.#toaster.toast(`File saved to ${path}`, {kind: "success"});
    };

    run = async () => {
        this.errorMessage = "";
        const [error, result] = await catchError(
            this.#pg.rawQuery(this.currentSelection ? this.currentSelection : this.currentValue),
        );
        if (error) {
            this.errorMessage = error.message;
        } else {
            this.lastResult = result;
            if (this.lastResult !== undefined) {
                for (let i = 0; i < this.lastResult.length; i++) {
                    this.lastResult[i].__index = i.toString(); // used to prevent re-render table rows
                }
            }
        }
    };
}
const key = Symbol("scriptsContext");

export const getScriptsContext = () => getContext<ScriptsContext>(key);
export const setScriptsContext = () => setContext(key, new ScriptsContext(storePath));
