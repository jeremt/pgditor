<script lang="ts">
    import PlayIcon from "$lib/icons/PlayIcon.svelte";
    import {getTableContext} from "$lib/table/tableContext.svelte";
    import {getScriptsContext} from "./scriptsContext.svelte";

    const scripts = getScriptsContext();
    const pgTable = getTableContext();
</script>

<button
    class="btn ml-auto"
    onclick={async () => {
        const result = await pgTable.rawQuery(scripts.currentScript, {throwError: false});
        if (result) {
            scripts.lastResult = result;
        }
    }}
    title="⌘↵"><PlayIcon --size="1.2rem" /> Run query</button
>
