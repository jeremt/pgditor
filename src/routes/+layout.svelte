<script>
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount} from "svelte";

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
