<script lang="ts">
    import ClearIcon from "$lib/icons/ClearIcon.svelte";
    import PlayIcon from "$lib/icons/PlayIcon.svelte";
    import {getScriptsContext} from "./scriptsContext.svelte";

    const scripts = getScriptsContext();
</script>

<button
    class="btn ghost ml-auto"
    disabled={scripts.errorMessage === "" && scripts.lastResult === undefined}
    onclick={() => {
        scripts.errorMessage = "";
        scripts.lastResult = undefined;
    }}><ClearIcon --size="1.2rem" /> Clear output</button
>
<button class="btn" onclick={scripts.run} title="⌘↵"
    ><PlayIcon --size="1.2rem" /> Run {scripts.currentSelection ? "selection" : "file"}</button
>
