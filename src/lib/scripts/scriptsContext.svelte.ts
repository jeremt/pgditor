import {getContext, setContext} from "svelte";
import {getToastContext} from "$lib/widgets/Toaster.svelte";

class ScriptsContext {
    toastContext = getToastContext();
    currentScript = $state("");
    lastResult = $state<Record<string, string | null>[]>();
}
const key = Symbol("scriptsContext");

export const getScriptsContext = () => getContext<ScriptsContext>(key);
export const setScriptsContext = () => setContext(key, new ScriptsContext());
