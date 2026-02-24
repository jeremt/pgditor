<script lang="ts">
    import CheckIcon from "$lib/icons/CheckIcon.svelte";
    import CrossIcon from "$lib/icons/CrossIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import {defaultValues} from "./values";
    import {get_pg_context, type PgRow} from "./pg_context.svelte";
    import TableValueEditor from "./TableValueEditor.svelte";
    import {catchError} from "$lib/helpers/catchError";
    import ActionButton from "$lib/widgets/ActionButton.svelte";
    import TerminalIcon from "$lib/icons/TerminalIcon.svelte";

    type Props = {
        row: PgRow;
        onclose: () => void;
    };

    let {row, onclose}: Props = $props();

    const pg = get_pg_context();

    let errorMessage = $state("");

    // type is lost if not specified here
    let localRow: PgRow = $derived.by(() => {
        const value = $state($state.snapshot(row)); // recreate a deeply reactive value separated from the prop
        return value;
    });

    const pk = $derived.by(() => {
        if (!pg.current_table) {
            return;
        }
        return pg.current_table.columns.find((column) => column.is_primary_key === "YES");
    });

    const hasPkValue = $derived(!pk ? false : localRow[pk.column_name] !== null);

    $effect(() => {
        if (localRow) {
            errorMessage = ""; // reset error message whenever row changes
        }
    });

    const insertOrUpdate = async () => {
        const error = await catchError(hasPkValue === false ? pg.insert_row(localRow) : pg.upsert_row(localRow));
        if (error instanceof Error) {
            errorMessage = error.message;
        } else {
            onclose();
        }
    };
</script>

<div class="flex flex-col w-lg h-full">
    <header class="flex flex-col pt-4 px-4">
        <div class="flex gap-2 items-center pb-4">
            <button class="btn icon ghost" type="button" aria-label="Cancel" onclick={onclose}><CrossIcon /></button>
            <h2>
                {hasPkValue ? "Update set" : "Insert into"}
                {#if pg.current_table}
                    <span class="font-mono text-sm bg-bg-1 py-0.5 px-2 rounded-md ml-1">
                        {pg.current_table.schema}.{pg.current_table.name}
                    </span>
                {/if}
            </h2>
            <ActionButton class="btn ml-auto" onaction={insertOrUpdate}>
                <CheckIcon --size="1.2rem" />
                {hasPkValue ? "Update" : "Insert"}
            </ActionButton>
        </div>
    </header>
    {#if errorMessage}
        <div class="text-sm text-error p-2 mx-4 mb-4 border border-bg-2 rounded-xl">{errorMessage}</div>
    {/if}
    <div class="flex flex-col gap-2 grow overflow-auto pb-4 px-4">
        {#if pk === undefined && hasPkValue}
            <div class="text-fg-1 text-xs flex flex-wrap gap-1">
                Without primary key, you cannot update a specific row, use <TerminalIcon --size="1rem" /> instead.
            </div>
        {/if}
        {#each pg.current_table?.columns ?? [] as column (column.column_name)}
            <label class="text-sm flex gap-2 items-center pt-2" for={column.column_name}>
                {#if column.is_primary_key === "YES"}<KeyIcon --size="1.2rem" />{/if}
                {#if column.foreign_column_name !== null}
                    <span title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                        ><LinkIcon --size="1.2rem" /></span
                    >
                {/if}
                <strong>{column.column_name}</strong
                >{column.data_type}{#if column.data_type_params}{column.data_type_params}{/if}
                {#if column.is_nullable === "YES"}
                    <label class="text-xs ml-auto flex gap-2 items-center"
                        >NULL
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
                    </label>
                {/if}
            </label>
            <TableValueEditor bind:row={localRow} {column} inlined={true} />
        {/each}
    </div>
</div>
