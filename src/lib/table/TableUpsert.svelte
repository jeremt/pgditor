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

    const pgTable = getTableContext();

    const insertOrUpdate = async () => {
        if (!pgTable.current) {
            return;
        }
        if (row.ctid) {
            const query = `UPDATE "${pgTable.current.schema}"."${pgTable.current.name}"
SET
  ${pgTable.current.columns
      .filter((col) => col.is_primary_key === "NO")
      .map((col) => `${col.column_name} = ${formatValue(col, row[col.column_name])}`)
      .join(",\n  ")}
WHERE ctid = '${row.ctid}';`;
            console.log(query);
            await pgTable.rawQuery(query);
            onclose();
        } else {
            const query = `INSERT INTO "${pgTable.current.schema}"."${pgTable.current.name}"
(${pgTable.current.columns.map(({column_name}) => column_name).join(", ")})
VALUES
(${pgTable.current.columns.map((col) => formatValue(col, row[col.column_name])).join(", ")});`;
            console.log(query);
            await pgTable.rawQuery(query);
            onclose();
        }
    };
</script>

<header class="flex gap-4 items-center w-md pb-4">
    <button class="btn icon ghost" aria-label="Cancel" onclick={onclose}><CrossIcon /></button>
    <h2>
        {row.ctid === undefined ? "Insert into" : "Update row of"}
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
                    checked={row[column.column_name] === null}
                    onchange={(event) => {
                        row[column.column_name] = event.currentTarget.checked ? null : defaultValues[column.data_type];
                    }}
                />
            {/if}
        </label>
        <TableValueEditor bind:row {column} />
    {/each}
</div>
