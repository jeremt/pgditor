<script>
    import "../app.css";
    import "@fontsource-variable/space-grotesk";
    import "@fontsource/space-mono/400.css";
    import "@fontsource/space-mono/700.css";

    import {onMount, onDestroy} from "svelte";
    import {register, unregister, isRegistered} from "@tauri-apps/plugin-global-shortcut";

    import {setConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    import {setTableContext} from "$lib/table/tableContext.svelte";
    import Toaster, {setToastContext} from "$lib/widgets/Toaster.svelte";

    let {children} = $props();

    const connections = setConnectionsContext();
    const pgTable = setTableContext();
    setToastContext();

    const shortcuts = [
        "CommandOrControl+T",
        "CommandOrControl+F",
        "CommandOrControl+R",
        "CommandOrControl+ArrowLeft",
        "CommandOrControl+ArrowRight",
    ];

    const registerShortcuts = async () => {
        for (const shortcut of shortcuts) {
            try {
                const registered = await isRegistered(shortcut);
                if (registered) {
                    await unregister(shortcut);
                }
            } catch (err) {
                console.warn(`Failed to check/unregister ${shortcut}:`, err);
            }
        }

        try {
            await register("CommandOrControl+T", (event) => {
                if (event.state === "Pressed") {
                    pgTable.isUseDialogOpen = true;
                }
            });
        } catch (err) {
            console.error("Failed to register CommandOrControl+T:", err);
        }

        try {
            await register("CommandOrControl+F", (event) => {
                if (event.state === "Pressed") {
                    pgTable.isFilterPopover = true;
                }
            });
        } catch (err) {
            console.error("Failed to register CommandOrControl+F:", err);
        }

        try {
            await register("CommandOrControl+R", (event) => {
                if (event.state === "Pressed") {
                    pgTable.loadTables();
                }
            });
        } catch (err) {
            console.error("Failed to register CommandOrControl+R:", err);
        }

        try {
            await register("CommandOrControl+ArrowLeft", (event) => {
                if (event.state === "Pressed" && pgTable.filters.offset > 0) {
                    pgTable.filters.offset = Math.max(0, pgTable.filters.offset - pgTable.filters.limit);
                }
            });
        } catch (err) {
            console.error("Failed to register CommandOrControl+ArrowLeft:", err);
        }

        try {
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
        } catch (err) {
            console.error("Failed to register CommandOrControl+ArrowRight:", err);
        }
    };

    const unregisterShortcuts = async () => {
        for (const shortcut of shortcuts) {
            try {
                await unregister(shortcut);
            } catch (err) {
                console.warn(`Failed to unregister ${shortcut}:`, err);
            }
        }
    };

    onMount(async () => {
        await connections.load();
        await registerShortcuts();
    });

    onDestroy(async () => {
        await unregisterShortcuts();
    });

    $effect(() => {
        pgTable.loadTables();
    });
</script>

{@render children()}
<Toaster />
