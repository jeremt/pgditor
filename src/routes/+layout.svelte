<script>
    import {onMount} from "svelte";
    import "../app.css";
    import {setConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    let {children} = $props();

    const connections = setConnectionsContext();

    onMount(() => {
        connections.load();
    });
</script>

{@render children()}
