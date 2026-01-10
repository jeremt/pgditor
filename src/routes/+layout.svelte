<script lang="ts">
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount, onDestroy} from "svelte";

    import {setConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    import {setPgContext} from "$lib/table/pgContext.svelte";
    import Toaster, {setToastContext} from "$lib/widgets/Toaster.svelte";
    import {globalShortcuts} from "$lib/tauri/globalShortcuts";
    import {setScriptsContext} from "$lib/scripts/scriptsContext.svelte";

    let {children} = $props();

    setToastContext();

    const connections = setConnectionsContext();
    const pg = setPgContext();
    const scripts = setScriptsContext();

    const shortcuts = globalShortcuts([
        {
            keys: "CommandOrControl+T",
            action: (event) => {
                if (event.state === "Pressed") {
                    pg.isUseDialogOpen = true;
                }
            },
        },
        {
            keys: "CommandOrControl+F",
            action: (event) => {
                if (event.state === "Pressed") {
                    pg.isFilterPopover = true;
                }
            },
        },
        {
            keys: "CommandOrControl+R",
            action: (event) => {
                if (event.state === "Pressed") {
                    pg.loadTables();
                }
            },
        },
        {
            keys: "CommandOrControl+ArrowLeft",
            action: (event) => {
                if (event.state === "Pressed" && pg.filters.offset > 0) {
                    pg.filters.offset = Math.max(0, pg.filters.offset - pg.filters.limit);
                }
            },
        },
        {
            keys: "CommandOrControl+ArrowRight",
            action: (event) => {
                if (
                    event.state === "Pressed" &&
                    pg.currentTable &&
                    pg.filters.offset + pg.filters.limit < pg.currentTable.count
                ) {
                    pg.filters.offset = Math.min(pg.currentTable.count, pg.filters.offset + pg.filters.limit);
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
        pg.loadTables();
    });
</script>

{@render children()}
<Toaster />
