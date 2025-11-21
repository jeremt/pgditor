<script>
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount} from "svelte";
    import {register} from "@tauri-apps/plugin-global-shortcut";

    import {setConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    import {setTableContext} from "$lib/table/tableContext.svelte";
    import Toaster, {setToastContext} from "$lib/widgets/Toaster.svelte";

    let {children} = $props();

    const connections = setConnectionsContext();
    const pgTable = setTableContext();
    setToastContext();

    onMount(async () => {
        await connections.load();
        await register("CommandOrControl+T", (event) => {
            if (event.state === "Pressed") {
                pgTable.isUseDialogOpen = true;
            }
        });
        await register("CommandOrControl+F", (event) => {
            if (event.state === "Pressed") {
                pgTable.isFilterPopover = true;
            }
        });
        await register("CommandOrControl+R", (event) => {
            if (event.state === "Pressed") {
                pgTable.loadTables();
            }
        });
        await register("CommandOrControl+ArrowLeft", (event) => {
            if (event.state === "Pressed" && pgTable.filters.offset > 0) {
                pgTable.filters.offset = Math.max(0, pgTable.filters.offset - pgTable.filters.limit);
            }
        });
        await register("CommandOrControl+ArrowRight", (event) => {
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
        });
    });
    $effect(() => {
        pgTable.loadTables();
    });
</script>

{@render children()}
<Toaster />
