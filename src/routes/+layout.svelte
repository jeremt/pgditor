<script lang="ts">
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount, onDestroy} from "svelte";

    import {set_connections_context} from "$lib/connection/connectionsContext.svelte";
    import {set_pg_context} from "$lib/table/pg_context.svelte";
    import Toaster, {setToastContext} from "$lib/widgets/Toaster.svelte";
    import {setScriptsContext} from "$lib/scripts/scriptsContext.svelte";
    import {set_commands_context} from "$lib/commands/commandsContext.svelte";
    import {setSettingsContext} from "$lib/settings/settingsContext.svelte";
    import {set_graph_context} from "$lib/graph/graphContext.svelte";

    let {children} = $props();

    setToastContext();

    const connections = set_connections_context();
    const pg = set_pg_context();
    setScriptsContext();
    setSettingsContext();
    set_graph_context();
    const commands = set_commands_context();

    onMount(async () => {
        await connections.load();
        await commands.mount_shortcuts();
    });

    onDestroy(() => {
        commands.unmount_shortcuts();
    });

    $effect(() => {
        pg.load_tables();
    });
</script>

{@render children()}
<Toaster />
