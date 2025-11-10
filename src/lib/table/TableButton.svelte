<script lang="ts">
    import {getConnectionsContext} from "$lib/connection/connectionsContext.svelte";
    import {catchError} from "$lib/helpers/catchError";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import {invoke} from "@tauri-apps/api/core";

    type TableInfo = {
        schema: string;
        name: string;
        type: string;
    };

    const connections = getConnectionsContext();

    let tables = $state<TableInfo[]>([]);
    let selectedTable = $state<TableInfo>();
    let isPopoverOpen = $state(false);
    let filterQuery = $state("");

    const loadTables = async () => {
        if (!connections.selected) return;
        const [error, unsortedTables] = await catchError(
            invoke<TableInfo[]>("list_tables", {connectionString: connections.selected.connectionString})
        );
        if (error) {
            throw error; // TODO: toast
        }
        tables = unsortedTables.toSorted((table) => (table.schema === "public" ? -1 : 1));
        selectedTable = tables[0];
    };

    $effect(() => {
        loadTables();
    });
</script>

<Popover isOpen={isPopoverOpen} offsetY={10}>
    {#snippet target()}
        <button class="btn outline" onclick={() => (isPopoverOpen = !isPopoverOpen)} disabled={!selectedTable}>
            {#if selectedTable}
                {selectedTable.type === "BASE TABLE" ? "🗃️" : "👁️"}
                {selectedTable.schema}.{selectedTable.name}
            {:else}
                no tables
            {/if}
        </button>
    {/snippet}
    <div class="flex flex-col gap-2">
        <input type="text" bind:value={filterQuery} placeholder="Search table" />
        <div class="flex flex-col gap-2 overflow-auto h-80 py-2">
            {#each tables as table}
                <button
                    class="table-btn"
                    onclick={() => {
                        selectedTable = table;
                        isPopoverOpen = false;
                    }}
                >
                    {table.type === "BASE TABLE" ? "🗃️" : "👁️"}
                    {table.schema}.{table.name}
                </button>
            {/each}
        </div>
    </div>
</Popover>

<style>
    .table-btn {
        padding: 0.2em 0.4em;
        border-radius: var(--radius-input);
        cursor: pointer;
        text-align: start;
        border: 2px solid transparent;
        &:hover {
            border: 2px solid var(--color-fg);
        }
    }
</style>
