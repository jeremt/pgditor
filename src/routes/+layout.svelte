<script>
    import {onMount} from "svelte";
    import "../app.css";
    import {setConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    import {setTableContext} from "$lib/table/tableContext.svelte";
    let {children} = $props();

    const connections = setConnectionsContext();
    const pgTable = setTableContext();

    onMount(() => {
        connections.load();
    });
    $effect(() => {
        pgTable.loadTables();
    });
</script>

{@render children()}
