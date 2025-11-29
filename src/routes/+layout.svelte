<script lang="ts">
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount, onDestroy} from "svelte";

    import {setConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    import {setTableContext} from "$lib/table/tableContext.svelte";
    import Toaster, {setToastContext} from "$lib/widgets/Toaster.svelte";
    import {globalShortcuts} from "$lib/tauri/globalShortcuts";
    import {setScriptsContext} from "$lib/scripts/scriptsContext.svelte";

    let {children} = $props();

    setToastContext();

    const connections = setConnectionsContext();
    const pgTable = setTableContext();
    setScriptsContext();

    const shortcuts = globalShortcuts([
        {
            keys: "CommandOrControl+T",
            action: (event) => {
                if (event.state === "Pressed") {
                    pgTable.isUseDialogOpen = true;
                }
            },
        },
        {
            keys: "CommandOrControl+F",
            action: (event) => {
                if (event.state === "Pressed") {
                    pgTable.isFilterPopover = true;
                }
            },
        },
        {
            keys: "CommandOrControl+R",
            action: (event) => {
                if (event.state === "Pressed") {
                    pgTable.loadTables();
                }
            },
        },
        {
            keys: "CommandOrControl+ArrowLeft",
            action: (event) => {
                if (event.state === "Pressed" && pgTable.filters.offset > 0) {
                    pgTable.filters.offset = Math.max(0, pgTable.filters.offset - pgTable.filters.limit);
                }
            },
        },
        {
            keys: "CommandOrControl+ArrowRight",
            action: (event) => {
                if (
                    event.state === "Pressed" &&
                    pgTable.current &&
                    pgTable.filters.offset + pgTable.filters.limit < pgTable.current.count
                ) {
                    pgTable.filters.offset = Math.min(
                        pgTable.current.count,
                        pgTable.filters.offset + pgTable.filters.limit
                    );
                }
            },
        },
    ]);

    onMount(async () => {
        await connections.load();
        await shortcuts.mount();
    });

    onDestroy(async () => {
        shortcuts.unmount();
    });

    $effect(() => {
        pgTable.loadTables();
    });
</script>

{@render children()}
<Toaster />
