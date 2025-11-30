import {getContext, setContext} from "svelte";
import {getToastContext} from "$lib/widgets/Toaster.svelte";
import {getPgContext} from "$lib/table/pgContext.svelte";
import {catchError} from "$lib/helpers/catchError";

class ScriptsContext {
    toastContext = getToastContext();
    pg = getPgContext();
    currentScript = $state("");
    currentSelection = $state("");
    lastResult = $state<Record<string, string | null>[]>();
    errorMessage = $state("");

    run = async () => {
        this.errorMessage = "";
        const [error, result] = await catchError(
            this.pg.rawQuery(this.currentSelection ? this.currentSelection : this.currentScript)
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
export const setScriptsContext = () => setContext(key, new ScriptsContext());
