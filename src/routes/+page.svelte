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

    const commands = getCommandsContext();
</script>

<header class="flex gap-2 p-2 items-center w-full overflow-auto shrink-0">
    <ConnectionButton />
    <button
        class="btn ghost icon"
        title={"Visualize tables"}
        disabled={commands.mode === "tables"}
        onclick={() => (commands.mode = "tables")}
    >
        <TablesIcon --size="1.2rem" />
    </button>
    <button
        class="btn ghost icon"
        title={"Run raw sql queries"}
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
</header>

{#if commands.mode === "tables"}
    <Table />
{:else if commands.mode === "script"}
    <SqlScript />
{/if}

<CommandPalette />
