import {getContext, setContext} from "svelte";
import {getToastContext} from "$lib/widgets/Toaster.svelte";
import {getPgContext} from "$lib/table/pgContext.svelte";
import {catchError} from "$lib/helpers/catchError";
import {StoreContext} from "$lib/helpers/StoreContext";
import {getConnectionsContext} from "$lib/connection/connectionsContext.svelte";
import {readFile} from "@tauri-apps/plugin-fs";

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

    add = async (scriptPath: string) => {
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

    run = async () => {
        this.errorMessage = "";
        const [error, result] = await catchError(
            this.#pg.rawQuery(this.currentSelection ? this.currentSelection : this.currentValue)
        );
        if (error) {
            this.errorMessage = error.message;
        } else {
            this.lastResult = result;
        }
    };
}
const key = Symbol("scriptsContext");

export const getScriptsContext = () => getContext<ScriptsContext>(key);
export const setScriptsContext = () => setContext(key, new ScriptsContext(storePath));
