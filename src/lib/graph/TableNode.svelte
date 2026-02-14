<script lang="ts">
    import {get_commands_context} from "$lib/commands/commandsContext.svelte";
    import ArrowIcon from "$lib/icons/ArrowIcon.svelte";
    import TableIcon from "$lib/icons/TableIcon.svelte";
    import {get_pg_context, type PgTable} from "$lib/table/pgContext.svelte";
    import {Handle, Position} from "@xyflow/svelte";

    let {data, id} = $props();
    const commands = get_commands_context();
    const pg = get_pg_context();
    const selectTable = (table: Pick<PgTable, "schema" | "name">) => {
        commands.mode = "tables";
        pg.select_table(table);
    };
</script>

<div class=" bg-bg border border-bg-2 rounded-xl hover:border-fg-2 min-w-60">
    <div class="flex gap-2 items-center px-4 py-2 border-b border-b-bg-2">
        <TableIcon />
        <strong class="text-lg">{data.label}</strong>
        <span class="font-mono text-sm bg-bg-1 py-0.5 px-2 rounded-md ms-auto">
            {data.schema}
        </span>
        <button class="btn ghost icon" onclick={() => selectTable({schema: data.schema, name: data.label})}
            ><ArrowIcon direction="right" /></button
        >
    </div>
    <div class="py-2">
        {#each data.columns as column}
            <div class="column-row relative px-4 py-1 flex items-center gap-4">
                <!-- Target handle (for incoming FK relationships) -->
                <Handle type="target" position={Position.Left} id={`${id}.${column.column_name}-target`} />

                <span class="column-name">{column.column_name}</span>
                <span class="ms-auto text-fg-2 text-sm"
                    >{column.data_type}{#if column.is_nullable === "YES"}?{/if}</span
                >

                <!-- Source handle (for outgoing FK relationships) -->
                <Handle type="source" position={Position.Right} id={`${id}.${column.column_name}-source`} />
            </div>
        {/each}
    </div>
</div>

<style>
    .column-row :global(.svelte-flow__handle) {
        opacity: 0;
    }
</style>
