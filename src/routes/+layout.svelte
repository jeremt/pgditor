<script>
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount} from "svelte";

    import {setConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    import {setTableContext} from "$lib/table/tableContext.svelte";
    import Toaster, {setToastContext} from "$lib/widgets/Toaster.svelte";

    let {children} = $props();

    const connections = setConnectionsContext();
    const pgTable = setTableContext();
    setToastContext();

    onMount(() => {
        connections.load();
    });
    $effect(() => {
        pgTable.loadTables();
    });
</script>

{@render children()}
<Toaster />
