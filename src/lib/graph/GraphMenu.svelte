<script lang="ts">
    import CleanBrushIcon from "$lib/icons/CleanBrushIcon.svelte";
    import RefreshIcon from "$lib/icons/RefreshIcon.svelte";
    import {get_graph_context} from "./graphContext.svelte";

    const graph = get_graph_context();

    let refreshing = $state(false);
    const refresh = async () => {
        refreshing = true;
        setTimeout(() => {
            refreshing = false;
        }, 500);
        await graph.load_db();
    };
</script>

<button class="btn icon ghost" onclick={graph.apply_layout} title="Re-layout">
    <CleanBrushIcon --size="1.2rem" />
</button>

<button class="btn icon ghost" onclick={refresh} title="Refresh">
    <RefreshIcon --size="1.2rem" spinning={refreshing} />
</button>
