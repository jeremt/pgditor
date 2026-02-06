<script lang="ts">
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount, onDestroy} from "svelte";

    import {setConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    import {setPgContext} from "$lib/table/pgContext.svelte";
    import Toaster, {setToastContext} from "$lib/widgets/Toaster.svelte";
    import {setScriptsContext} from "$lib/scripts/scriptsContext.svelte";
    import {setCommandsContext} from "$lib/commands/commandsContext.svelte";
    import {setSettingsContext} from "$lib/settings/settingsContext.svelte";

    let {children} = $props();

    setToastContext();

    const connections = setConnectionsContext();
    const pg = setPgContext();
    const scripts = setScriptsContext();
    const settings = setSettingsContext();
    const commands = setCommandsContext();

    onMount(async () => {
        await connections.load();
        await commands.mountShortcuts();
    });

    onDestroy(() => {
        commands.unmountShortcuts();
    });

    $effect(() => {
        pg.loadTables();
    });
</script>

{@render children()}
<Toaster />
