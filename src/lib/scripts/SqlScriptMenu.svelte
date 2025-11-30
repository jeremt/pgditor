<script lang="ts">
    import PlayIcon from "$lib/icons/PlayIcon.svelte";
    import {getPgContext} from "$lib/table/pgContext.svelte";
    import {getScriptsContext} from "./scriptsContext.svelte";

    const scripts = getScriptsContext();
    const pg = getPgContext();
</script>

<button
    class="btn ml-auto"
    onclick={async () => {
        const result = await pg.rawQuery(scripts.currentScript, {throwError: false});
        if (result) {
            scripts.lastResult = result;
        }
    }}
    title="⌘↵"><PlayIcon --size="1.2rem" /> Run query</button
>
