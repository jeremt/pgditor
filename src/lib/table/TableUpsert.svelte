<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import {defaultValues, formatValue} from "./values";
    import {getTableContext, type PgRow} from "./tableContext.svelte";
    import TableValueEditor from "./TableValueEditor.svelte";

    type Props = {
        row: PgRow & {ctid?: string};
        onclose: () => void;
    };

    let {row, onclose}: Props = $props();

    let localRow = $derived.by(() => $state.snapshot(row));

    const pgTable = getTableContext();

    const insertOrUpdate = async () => {
        await pgTable.upsertRow(localRow);
        onclose();
    };
</script>

<header class="flex gap-4 items-center w-md pb-4">
    <button class="btn icon ghost" aria-label="Cancel" onclick={onclose}><CrossIcon /></button>
    <h2>
        {localRow.ctid === undefined ? "Insert into" : "Update row of"}
        {#if pgTable.current}<span class="font-mono">{pgTable.current.schema}.{pgTable.current.name}</span>{/if}
    </h2>
    <button class="btn ml-auto" onclick={insertOrUpdate}>
        <CheckIcon --size="1.2rem" /> Apply
    </button>
</header>
<div class="flex flex-col gap-2 flex-1 overflow-auto">
    {#each pgTable.current?.columns ?? [] as column}
        <label class="text-sm flex gap-2 items-center pt-2" for={column.column_name}>
            {#if column.is_primary_key === "YES"}<KeyIcon --size="1.2rem" />{/if}
            {#if column.foreign_column_name !== null}
                <span title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                    ><LinkIcon --size="1.2rem" /></span
                >
            {/if}
            <strong>{column.column_name}</strong>{column.data_type}
            {#if column.is_nullable === "YES"}
                <span class="text-xs ml-auto">NULL</span>
                <CheckboxInput
                    checked={localRow[column.column_name] === null}
                    onchange={(event) => {
                        localRow[column.column_name] = event.currentTarget.checked
                            ? null
                            : defaultValues[column.data_type];
                    }}
                />
            {/if}
        </label>
        <TableValueEditor bind:row={localRow} {column} />
    {/each}
</div>
