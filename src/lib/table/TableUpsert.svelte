<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import {defaultValues, formatValue} from "./values";
    import {getPgContext, type PgRow} from "./pgContext.svelte";
    import TableValueEditor from "./TableValueEditor.svelte";
    import {catchError} from "$lib/helpers/catchError";

    type Props = {
        row: PgRow & {ctid?: string};
        onclose: () => void;
    };

    let {row, onclose}: Props = $props();

    let errorMessage = $state("");

    // type is lost if not specified here
    let localRow: PgRow & {ctid?: string} = $derived.by(() => {
        const value = $state($state.snapshot(row)); // recreate a deeply reactive value separated from the prop
        return value;
    });

    $effect(() => {
        if (localRow) {
            errorMessage = ""; // reset error message whenever row changes
        }
    });

    const pg = getPgContext();

    const insertOrUpdate = async () => {
        const [error] = await catchError(pg.upsertRow(localRow));
        if (error) {
            errorMessage = error.message;
        } else {
            onclose();
        }
    };
</script>

<header class="flex flex-col">
    <div class="flex gap-2 items-center w-md pb-4">
        <button class="btn icon ghost" type="button" aria-label="Cancel" onclick={onclose}><CrossIcon /></button>
        <h2>
            {localRow.ctid === undefined ? "Insert into" : "Update row from"}
            {#if pg.currentTable}<span class="font-mono text-sm bg-bg-1 py-0.5 px-2 rounded-md ml-1"
                    >{pg.currentTable.schema}.{pg.currentTable.name}</span
                >{/if}
        </h2>
        <button class="btn ml-auto" onclick={insertOrUpdate}>
            <CheckIcon --size="1.2rem" /> Apply
        </button>
    </div>
    {#if errorMessage !== ""}<div class="text-error pb-2 text-sm">{errorMessage}</div>{/if}
</header>
<div class="flex flex-col gap-2 flex-1 overflow-auto">
    {#each pg.currentTable?.columns ?? [] as column}
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
                    onchange={() => {
                        if (localRow[column.column_name] !== null) {
                            localRow[column.column_name] = null;
                        } else {
                            localRow[column.column_name] = defaultValues[column.data_type];
                        }
                    }}
                />
            {/if}
        </label>
        <TableValueEditor bind:row={localRow} {column} />
    {/each}
</div>
