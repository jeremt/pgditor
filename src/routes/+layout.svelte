<script lang="ts">
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount} from "svelte";

    import {set_connections_context} from "$lib/connection/connections_context.svelte";
    import {set_pg_context} from "$lib/table/pg_context.svelte";
    import Toaster, {set_toast_context} from "$lib/widgets/Toaster.svelte";
    import {set_scripts_context} from "$lib/scripts/scripts_context.svelte";
    import {set_commands_context} from "$lib/commands/commands_context.svelte";
    import {set_settings_context} from "$lib/settings/settings_context.svelte";
    import {set_graph_context} from "$lib/graph/graph_context.svelte";

    let {children} = $props();

    set_toast_context();

    const connections = set_connections_context();
    const pg = set_pg_context();
    set_scripts_context();
    set_settings_context();
    set_graph_context();
    set_commands_context();

    onMount(async () => {
        await connections.load();
    });

    $effect(() => {
        pg.load_tables();
    });
</script>

{@render children()}
<Toaster />
