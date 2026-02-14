<script lang="ts">
    import ChevronIcon from "$lib/icons/ChevronIcon.svelte";
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import TableSelect from "$lib/table/TableSelect.svelte";
    import {get_pg_context, type PgRow} from "$lib/table/pgContext.svelte";
    import TableFilters from "$lib/table/TableFilters.svelte";
    import NumberInput from "$lib/widgets/NumberInput.svelte";
    import TableUpsert from "$lib/table/TableUpsert.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import RefreshIcon from "$lib/icons/RefreshIcon.svelte";
    import {defaultValues, sqlToValue, valueToSql} from "$lib/table/values";
    import ActionButton from "$lib/widgets/ActionButton.svelte";
    import DownloadIcon from "$lib/icons/DownloadIcon.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import {getToastContext} from "$lib/widgets/Toaster.svelte";
    import {saveToFile} from "$lib/helpers/saveToFile";
    import TableColumns from "./TableColumns.svelte";
    import TablePagination from "./TablePagination.svelte";

    const pg = get_pg_context();
    const {toast} = getToastContext();

    const rowToInsert = $derived<PgRow>(
        pg.current_table?.columns.reduce((result, column) => {
            return {
                ...result,
                [column.column_name]:
                    column.column_default && column.is_primary_key === "NO"
                        ? sqlToValue(column, column.column_default)
                        : column.is_nullable === "YES" || column.is_primary_key === "YES"
                          ? null
                          : (defaultValues[column.data_type] ?? ""),
            };
        }, {}) ?? {},
    );

    let isInsertOpen = $state(false);

    const deleteRows = async () => {
        if (pg.selected_rows.length > 0 && pg.current_table?.type === "BASE TABLE") {
            pg.delete_selection();
        } else {
            pg.truncate_table();
        }
    };

    let isExportOpen = $state(false);

    // for refresh
    let refreshing = $state(false);
    const refresh = async () => {
        refreshing = true;
        setTimeout(() => {
            refreshing = false;
        }, 500);
        await pg.load_tables(false);
        await pg.refresh_data();
    };
</script>

<TableSelect />

{#if pg.current_table}
    <TableFilters
        bind:isOpen={pg.is_filters_open}
        bind:filters={pg.where_filters}
        bind:whereSql={pg.where_sql}
        appliedFilters={pg.applied_filters}
        columns={pg.current_table.columns}
        onapply={() => {
            pg.applied_filters = pg.where_filters.length;
            pg.refresh_data();
            pg.is_filters_open = false;
        }}
    />
    <TableColumns />
    <TablePagination
        bind:offset={pg.offset}
        bind:limit={pg.limit}
        count={pg.current_table.count}
        onchange={pg.refresh_data}
    />
    <ActionButton
        class="btn ghost icon relative"
        onaction={deleteRows}
        title="Delete"
        disabled={pg.current_table.type !== "BASE TABLE"}
        confirm={{
            title: pg.selected_rows.length
                ? `Remove ${pg.selected_rows.length} rows`
                : `Truncate table and restart identity`,
            description: pg.selected_rows.length
                ? "Once you delete the selected rows, it can't be undone."
                : "Once you truncate the table, it can't be undone.\nThe identity of the primary key will be automatically restarted.",
            buttonClass: "btn error",
            buttonText: "Confirm delete",
        }}
        ><TrashIcon --size="1.2rem" />
        {#if pg.selected_rows.length && pg.current_table.type === "BASE TABLE"}<span
                class="badge absolute top-0"
                style:right="-0.6rem">{pg.selected_rows.length > 100 ? "99+" : pg.selected_rows.length}</span
            >{/if}
    </ActionButton>
    <Popover bind:isOpen={isExportOpen} offsetY={10}>
        {#snippet target()}
            <button class="btn ghost icon relative" title="Export" onclick={() => (isExportOpen = !isExportOpen)}
                ><DownloadIcon --size="1.2rem" />
                {#if pg.selected_rows.length}<span class="badge absolute top-0" style:right="-0.6rem"
                        >{pg.selected_rows.length > 100 ? "99+" : pg.selected_rows.length}</span
                    >{/if}
            </button>
        {/snippet}
        <div>
            <button
                class="btn ghost"
                onclick={async () => {
                    if (await saveToFile(JSON.stringify(pg.selected_rows_json), ["json"])) {
                        toast("Selected rows exported to JSON", {kind: "success"});
                    } else {
                        toast("Failed to export JSON", {kind: "error"});
                    }
                    isExportOpen = false;
                }}>Export {pg.selected_rows.length > 0 ? `${pg.selected_rows.length} rows` : "all rows"} to JSON</button
            >
            <button
                class="btn ghost"
                onclick={async () => {
                    if (await saveToFile(pg.selected_rows_csv, ["csv"])) {
                        toast("Selected rows exported to CSV", {kind: "success"});
                    } else {
                        toast("Failed to export CSV", {kind: "error"});
                    }
                    isExportOpen = false;
                }}>Export {pg.selected_rows.length > 0 ? `${pg.selected_rows.length} rows` : "all rows"} to CSV</button
            >
            <button
                class="btn ghost"
                onclick={async () => {
                    if (await saveToFile(pg.selected_rows_sql, ["sql"])) {
                        toast("Selected rows exported to SQL", {kind: "success"});
                    } else {
                        toast("Failed to export SQL", {kind: "error"});
                    }
                    isExportOpen = false;
                }}>Export {pg.selected_rows.length > 0 ? `${pg.selected_rows.length} rows` : "all rows"} to SQL</button
            >
        </div>
    </Popover>
    <button class="btn icon ghost" onclick={refresh} title="Refresh">
        <RefreshIcon --size="1.2rem" spinning={refreshing} />
    </button>
    <button class="btn" disabled={pg.current_table.type !== "BASE TABLE"} onclick={() => (isInsertOpen = true)}
        ><PlusIcon --size="1.2rem" /> Insert</button
    >
{/if}

{#if pg.current_table}
    <Dialog
        --padding="0"
        isOpen={isInsertOpen}
        onrequestclose={() => (isInsertOpen = false)}
        position="right"
        animation="right"
    >
        <TableUpsert row={rowToInsert} onclose={() => (isInsertOpen = false)} />
    </Dialog>
{/if}
