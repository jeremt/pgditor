<script lang="ts">
    import ConnectionButton from "$lib/connection/ConnectionButton.svelte";
    import Table from "$lib/table/Table.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";
    import TablesIcon from "$lib/icons/TablesIcon.svelte";
    import SqlScript from "$lib/scripts/SqlScript.svelte";
    import TablesMenu from "$lib/table/TablesMenu.svelte";
    import SqlScriptMenu from "$lib/scripts/SqlScriptMenu.svelte";
    import CommandPalette from "$lib/commands/CommandPalette.svelte";
    import {get_commands_context} from "$lib/commands/commands_context.svelte";
    import {onMount} from "svelte";
    import {invoke} from "@tauri-apps/api/core";
    import SearchIcon from "$lib/icons/SearchIcon.svelte";
    import GraphIcon from "$lib/icons/GraphIcon.svelte";
    import Graph from "$lib/graph/Graph.svelte";
    import {SvelteFlowProvider} from "@xyflow/svelte";
    import GraphMenu from "$lib/graph/GraphMenu.svelte";

    const commands = get_commands_context();

    onMount(() => {
        invoke("show_main_window");
    });
</script>

<header class="flex gap-2 p-2 items-center w-full overflow-auto shrink-0">
    <ConnectionButton />
    <button
        class="btn ghost icon"
        title="Command palette {commands.cmd_or_ctrl}P"
        onclick={() => commands.execute("Open command palette")}><SearchIcon --size="1.2rem" /></button
    >
    <button
        class="btn ghost icon"
        title="Visualize tables {commands.cmd_or_ctrl}1"
        disabled={commands.mode === "tables"}
        onclick={() => (commands.mode = "tables")}
    >
        <TablesIcon --size="1.2rem" />
    </button>
    <button
        class="btn ghost icon"
        title="Run raw sql queries {commands.cmd_or_ctrl}2"
        disabled={commands.mode === "script"}
        onclick={() => (commands.mode = "script")}
    >
        <TerminalIcon --size="1.2rem" />
    </button>
    <button
        class="btn ghost icon"
        title="Visualize your db as a graph {commands.cmd_or_ctrl}3"
        disabled={commands.mode === "graph"}
        onclick={() => (commands.mode = "graph")}
    >
        <GraphIcon --size="1.2rem" />
    </button>
    <div class="rounded-e-full h-10/12 bg-bg-1" style:width="2px"></div>
    {#if commands.mode === "tables"}
        <TablesMenu />
    {:else if commands.mode === "script"}
        <SqlScriptMenu />
    {:else if commands.mode === "graph"}
        <GraphMenu />
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
{:else if commands.mode === "graph"}
    <SvelteFlowProvider>
        <Graph />
    </SvelteFlowProvider>
{/if}

<CommandPalette />
