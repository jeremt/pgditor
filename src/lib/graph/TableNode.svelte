<script lang="ts">
    import {get_commands_context} from "$lib/commands/commandsContext.svelte";
    import ArrowIcon from "$lib/icons/ArrowIcon.svelte";
    import EyeIcon from "$lib/icons/EyeIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import TableIcon from "$lib/icons/TableIcon.svelte";
    import {get_pg_context, type PgColumn, type PgTable} from "$lib/table/pg_context.svelte";
    import {Handle, Position, type Node, type NodeProps} from "@xyflow/svelte";

    type Props = NodeProps<Node<{schema: string; label: string; type: PgTable["type"]; columns: PgColumn[]}>>;

    let {data, id}: Props = $props();
    const commands = get_commands_context();
    const pg = get_pg_context();
    const selectTable = (table: Pick<PgTable, "schema" | "name">) => {
        commands.mode = "tables";
        pg.select_table(table);
    };
    //     column_default
    // enum_values
    const column_title = (column: PgColumn) => {
        let lines = [];
        if (column.column_default !== null) {
            lines.push(`default: ${column.column_default}`);
        }
        if (column.foreign_table_schema && column.foreign_table_name && column.foreign_column_name) {
            lines.push(
                `foreign key: ${column.column_name} <-> ${column.foreign_table_schema}.${column.foreign_table_name}.${column.foreign_column_name}`,
            );
        }
        return lines.join("\n");
    };
</script>

<div class=" bg-bg border border-bg-2 rounded-xl hover:border-fg-2 min-w-60">
    <div class="flex gap-2 items-center px-4 py-2 border-b border-b-bg-2">
        {#if data.type === "BASE TABLE"}
            <TableIcon --size="1.2rem" />
        {:else if data.type === "VIEW"}
            <EyeIcon --size="1.2rem" />
        {/if}
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
            <div class="column-row relative px-4 py-1 flex items-center gap-2" title={column_title(column)}>
                <!-- Target handle (for incoming FK relationships) -->
                <Handle type="target" position={Position.Left} id={`${id}.${column.column_name}-target`} />
                {#if column.is_primary_key === "YES"}
                    <KeyIcon --size="1rem" />
                {:else if column.foreign_column_name !== null}
                    <LinkIcon --size="1rem" />
                {/if}
                <span class="column-name">{column.column_name}</span>
                <span
                    class="ms-auto text-fg-2 text-sm"
                    title={column.enum_values ? column.enum_values.join(", ") : undefined}
                    >{column.data_type}{#if column.data_type_params}{column.data_type_params}{/if}{#if column.is_nullable === "YES"}?{/if}</span
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
