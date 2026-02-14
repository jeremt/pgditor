<script lang="ts">
    import CleanBrushIcon from "$lib/icons/CleanBrushIcon.svelte";
    import RefreshIcon from "$lib/icons/RefreshIcon.svelte";
    import {get_pg_context} from "$lib/table/pgContext.svelte";
    import {get_graph_context} from "./graphContext.svelte";

    const pg = get_pg_context();
    const graph = get_graph_context();

    // for refresh
    let refreshing = $state(false);
    const refresh = async () => {
        refreshing = true;
        setTimeout(() => {
            refreshing = false;
        }, 500);
        // await pg.load_tables(false);
        // await pg.refresh_data();
    };

    const refresh_layout = () => {
        console.log("TODO");
    };
</script>

<button class="btn icon ghost" onclick={refresh} title="Refresh">
    <RefreshIcon --size="1.2rem" spinning={refreshing} />
</button>
