<script lang="ts">
    import ConnectionButton from "$lib/connection/ConnectionButton.svelte";
    import Table from "$lib/table/Table.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";
    import TablesIcon from "$lib/icons/TablesIcon.svelte";
    import SqlScript from "$lib/scripts/SqlScript.svelte";
    import TablesMenu from "$lib/table/TablesMenu.svelte";
    import SqlScriptMenu from "$lib/scripts/SqlScriptMenu.svelte";
    import CommandPalette from "$lib/commands/CommandPalette.svelte";
    import {getCommandsContext} from "$lib/commands/commandsContext.svelte";
    import {onMount} from "svelte";
    import {invoke} from "@tauri-apps/api/core";
    import {getSettingsContext} from "$lib/settings/settingsContext.svelte";
    import SearchIcon from "$lib/icons/SearchIcon.svelte";

    const commands = getCommandsContext();
    const settings = getSettingsContext();

    onMount(() => {
        invoke("show_main_window");
    });
</script>

<header class="flex gap-2 p-2 items-center w-full overflow-auto shrink-0">
    <ConnectionButton />
    <button
        class="btn ghost icon"
        title="Command palette {commands.cmdOrCtrl}P"
        onclick={() => commands.execute("Open command palette")}><SearchIcon --size="1.2rem" /></button
    >
    <button
        class="btn ghost icon"
        title="Visualize tables {commands.cmdOrCtrl}1"
        disabled={commands.mode === "tables"}
        onclick={() => (commands.mode = "tables")}
    >
        <TablesIcon --size="1.2rem" />
    </button>
    <button
        class="btn ghost icon"
        title="Run raw sql queries {commands.cmdOrCtrl}2"
        disabled={commands.mode === "script"}
        onclick={() => (commands.mode = "script")}
    >
        <TerminalIcon --size="1.2rem" />
    </button>
    {#if commands.mode === "tables"}
        <TablesMenu />
    {:else}
        <SqlScriptMenu />
    {/if}
    <!-- <button
        class="btn ghost icon"
        onclick={() => (settings.colorScheme = settings.colorScheme === "dark" ? "light" : "dark")}
        >{settings.colorScheme === "dark" ? "S" : "M"}</button
    > -->
</header>

{#if commands.mode === "tables"}
    <Table />
{:else if commands.mode === "script"}
    <SqlScript />
{/if}

<CommandPalette />
