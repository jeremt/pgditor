<script lang="ts">
    import TrashIcon from "$lib/icons/TrashIcon.svelte";
    import TableSelect from "$lib/table/TableSelect.svelte";
    import {get_pg_context, type PgRow} from "$lib/table/pg_context.svelte";
    import TableFilters from "$lib/table/TableFilters.svelte";
    import TableUpsert from "$lib/table/TableUpsert.svelte";
    import PlusIcon from "$lib/icons/PlusIcon.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import RefreshIcon from "$lib/icons/RefreshIcon.svelte";
    import {default_values, sql_to_value, value_to_sql} from "$lib/table/values";
    import ActionButton from "$lib/widgets/ActionButton.svelte";
    import DownloadIcon from "$lib/icons/DownloadIcon.svelte";
    import Popover from "$lib/widgets/Popover.svelte";
    import {get_toast_context} from "$lib/widgets/Toaster.svelte";
    import {save_to_file} from "$lib/helpers/save_to_file";
    import TableColumns from "./TableColumns.svelte";
    import TablePagination from "./TablePagination.svelte";
    import {get_commands_context} from "$lib/commands/commands_context.svelte";

    const pg = get_pg_context();
    const {toast} = get_toast_context();
    const commands = get_commands_context();

    const row_to_insert = $derived<PgRow>(
        pg.current_table?.columns.reduce((result, column) => {
            return {
                ...result,
                [column.column_name]:
                    column.column_default && column.is_primary_key === "NO"
                        ? sql_to_value(column, column.column_default)
                        : column.is_nullable === "YES" || column.is_primary_key === "YES"
                          ? null
                          : (default_values[column.data_type] ?? ""),
            };
        }, {}) ?? {},
    );

    const delete_rows = async () => {
        if (pg.selected_rows.length > 0 && pg.current_table?.type === "BASE TABLE") {
            pg.delete_selection();
        } else {
            pg.truncate_table();
        }
    };

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

    const escape_csv_value = (val: unknown) => {
        const str = typeof val === "object" ? JSON.stringify(val) : val === null || val === undefined ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const rows_to_csv = (rows: PgRow[]) => {
        const headers = pg.current_table!.columns.map((col) => col.column_name);
        return headers.join(",") + "\n" + rows.map((row: PgRow) => headers.map((h) => escape_csv_value(row[h])).join(",")).join("\n");
    };

    const rows_to_sql = (rows: PgRow[]) => `INSERT INTO ${pg.fullname}
(${pg.current_table!.columns.map((col) => col.column_name).join(",")})
VALUES
${rows.map((row: PgRow) => `(${pg.current_table!.columns.map((col) => value_to_sql(col, row[col.column_name])).join(",")})`).join(",\n")}
;`;

    const export_rows = async (rows: PgRow[], format: "json" | "csv" | "sql") => {
        const content = format === "json" ? JSON.stringify(rows) : format === "csv" ? rows_to_csv(rows) : rows_to_sql(rows);
        const success = await save_to_file(content, [format]);
        if (success) {
            toast(`Exported ${rows.length} rows to ${format.toUpperCase()}`, {kind: "success"});
        } else {
            toast(`Failed to export ${format.toUpperCase()}`, {kind: "error"});
        }
        commands.is_export_open = false;
    };
</script>

<TableSelect />

{#if pg.current_table}
    <TableFilters
        bind:isOpen={pg.is_filters_open}
        bind:filters={pg.where_filters}
        bind:where_sql={pg.where_sql}
        applied_filters={pg.applied_filters}
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
        onaction={delete_rows}
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
    {#snippet export_section(label: string, get_rows: () => Promise<PgRow[]>)}
        <span class="text-xs text-fg-2 px-2 py-1">{label}</span>
        <div class="flex gap-1">
            {#each ["json", "csv", "sql"] as format}
                <button
                    class="btn secondary flex-1"
                    onclick={async () => {
                        const rows = await get_rows();
                        await export_rows(rows, format as "json" | "csv" | "sql");
                    }}>{format.toUpperCase()}</button
                >
            {/each}
        </div>
    {/snippet}
    <Popover bind:is_open={commands.is_export_open} offset_y={10}>
        {#snippet target()}
            <button
                class="btn ghost icon relative"
                title="Export"
                onclick={() => (commands.is_export_open = !commands.is_export_open)}
                ><DownloadIcon --size="1.2rem" />
                {#if pg.selected_rows.length}<span class="badge absolute top-0" style:right="-0.6rem"
                        >{pg.selected_rows.length > 100 ? "99+" : pg.selected_rows.length}</span
                    >{/if}
            </button>
        {/snippet}
        <div class="flex flex-col gap-1">
            {@render export_section("All rows", pg.get_unfiltered_rows)}
            {#if pg.selected_rows.length > 0}
                {@render export_section(`${pg.selected_rows.length} selected`, async () => pg.selected_rows_json)}
            {/if}
            {#if pg.applied_filters > 0}
                {@render export_section("Filtered rows", pg.get_all_rows)}
            {/if}
        </div>
    </Popover>
    <button class="btn icon ghost" onclick={refresh} title="Refresh {commands.shortcut('Refresh data')}">
        <RefreshIcon --size="1.2rem" spinning={refreshing} />
    </button>
    <button
        class="btn"
        title="Insert row {commands.shortcut('Insert row')}"
        disabled={pg.current_table.type !== "BASE TABLE"}
        onclick={() => (commands.is_insert_open = true)}><PlusIcon --size="1.2rem" /> Insert</button
    >
{/if}

{#if pg.current_table}
    <Dialog
        --padding="0"
        is_open={commands.is_insert_open}
        onrequestclose={() => (commands.is_insert_open = false)}
        position="right"
        animation="right"
    >
        <TableUpsert row={row_to_insert} onclose={() => (commands.is_insert_open = false)} />
    </Dialog>
{/if}
