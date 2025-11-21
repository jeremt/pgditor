<script lang="ts">
    import ArrowIcon from "$lib/icons/ArrowIcon.svelte";
    import KeyIcon from "$lib/icons/KeyIcon.svelte";
    import LinkIcon from "$lib/icons/LinkIcon.svelte";
    import UnpluggedIcon from "$lib/icons/UnpluggedIcon.svelte";
    import CheckboxInput from "$lib/widgets/CheckboxInput.svelte";
    import Dialog from "$lib/widgets/Dialog.svelte";
    import {listen} from "@tauri-apps/api/event";
    import {Menu, MenuItem, PredefinedMenuItem} from "@tauri-apps/api/menu";
    import {writeText} from "@tauri-apps/plugin-clipboard-manager";

    import {getTableContext, type PgColumn, type PgRow} from "./tableContext.svelte";
    import TableUpsert from "./TableUpsert.svelte";
    import {getToastContext} from "$lib/widgets/Toaster.svelte";
    import {saveToFile} from "$lib/helpers/saveToFile";

    const pgTable = getTableContext();
    const {toast} = getToastContext();

    let rowToUpdate = $state<PgRow>();
    let isUpdateOpen = $state(false);

    let lastMenuContext: {column?: PgColumn; row?: PgRow} = {};

    const clickHandler = async (event: MouseEvent, column: PgColumn, row: PgRow) => {
        event.preventDefault();
        // save the context for when the menu item is selected
        lastMenuContext = {column, row};

        const items: Array<any> = [
            {id: "table_copy_value", text: "Copy value"},
            {id: "table_copy_row_to_json", text: "Copy row (JSON)"},
        ];

        if (column.is_primary_key === "NO" && column.is_nullable === "YES" && row[column.column_name] !== null) {
            items.push({id: "table_set_null", text: "Set to NULL"});
        }

        if (
            column.is_primary_key === "NO" &&
            column.column_default !== null &&
            row[column.column_name] !== column.column_default
        ) {
            items.push({id: "table_set_default", text: "Set to default"});
        }

        items.push({item: "Separator"}); // Predefined separator

        if (column.is_primary_key === "NO" && column.is_nullable === "YES") {
            items.push({id: "table_set_all_null", text: "Set all to NULL"});
        }
        if (column.is_primary_key === "NO" && column.column_default) {
            items.push({id: "table_set_all_default", text: "Set all to default"});
        }

        items.push({item: "Separator"}); // Predefined separator

        if (pgTable.selectedRows.length) {
            items.push({
                text: `Copy ${pgTable.selectedRows.length} row${pgTable.selectedRows.length > 1 ? "s" : ""}`,
                items: [
                    {id: "copy_json", text: "JSON"},
                    {id: "copy_csv", text: "CSV"},
                    {id: "copy_sql", text: "SQL"},
                ],
            });
            items.push({
                text: `Export ${pgTable.selectedRows.length} row${pgTable.selectedRows.length > 1 ? "s" : ""}`,
                items: [
                    {id: "export_json", text: "JSON"},
                    {id: "export_csv", text: "CSV"},
                    {id: "export_sql", text: "SQL"},
                ],
            });
        }

        // create and show menu
        const menu = await Menu.new({items});
        await menu.popup();
    };

    $effect(() => {
        const unlistenPromise = listen<string>("menu-event", async (event) => {
            console.log("menu-event", event, "context:", lastMenuContext);
            switch (event.payload) {
                case "table_copy_value":
                    if (lastMenuContext.column && lastMenuContext.row) {
                        await writeText(lastMenuContext.row[lastMenuContext.column.column_name]?.toString() ?? "null");
                        toast("Value copied to clipboard");
                    }
                    break;
                case "table_copy_row_to_json":
                    await writeText(JSON.stringify(lastMenuContext.row));
                    toast("Row copied to clipboard (in JSON)");
                    break;
                case "table_set_null":
                    if (lastMenuContext.column && lastMenuContext.row?.ctid && pgTable.current) {
                        pgTable.rawQuery(`UPDATE ${pgTable.fullName} SET
${lastMenuContext.column.column_name} = null
WHERE ctid = '${lastMenuContext.row.ctid}';
                        `);
                        toast("Value set to NULL");
                    }
                    break;
                case "table_set_default":
                    if (lastMenuContext.column && lastMenuContext.row?.ctid && pgTable.current) {
                        pgTable.rawQuery(`UPDATE ${pgTable.fullName} SET
${lastMenuContext.column.column_name} = ${lastMenuContext.column.column_default}
WHERE ctid = '${lastMenuContext.row.ctid}';
                        `);
                        toast("Value set to default");
                    }
                    break;
                case "table_set_all_null":
                    if (lastMenuContext.column && lastMenuContext.row?.ctid && pgTable.current) {
                        pgTable.rawQuery(
                            `UPDATE ${pgTable.fullName} SET ${lastMenuContext.column.column_name} = null;`
                        );
                        toast(`All values of column ${lastMenuContext.column.column_name} set to NULL`);
                    }
                    break;
                case "table_set_all_default":
                    if (lastMenuContext.column && lastMenuContext.row?.ctid && pgTable.current) {
                        pgTable.rawQuery(
                            `UPDATE ${pgTable.fullName} SET ${lastMenuContext.column.column_name} = ${lastMenuContext.column.column_default};`
                        );
                        toast(`All values of column ${lastMenuContext.column.column_name} set to default`);
                    }
                    break;
                case "copy_json":
                    if (pgTable.current) {
                        await writeText(JSON.stringify(pgTable.selectedRowsJson));
                        toast("Selected rows copied to JSON");
                    }
                    break;
                case "copy_csv":
                    if (pgTable.current) {
                        await writeText(pgTable.selectedRowsCsv);
                        toast("Selected rows copied to CSV");
                    }
                    break;
                case "copy_sql":
                    if (pgTable.current) {
                        await writeText(pgTable.selectedRowsSql);
                        toast("Selected rows copied to SQL");
                    }
                    break;
                case "export_json":
                    if (pgTable.current) {
                        if (await saveToFile(JSON.stringify(pgTable.selectedRowsJson), ["json"])) {
                            toast("Selected rows exported to JSON");
                        } else {
                            toast("Failed to export JSON", {kind: "error"});
                        }
                    }
                    break;
                case "export_csv":
                    if (await saveToFile(pgTable.selectedRowsCsv, ["csv"])) {
                        toast("Selected rows exported to CSV");
                    } else {
                        toast("Failed to export CSV", {kind: "error"});
                    }
                    break;
                case "export_sql":
                    if (await saveToFile(pgTable.selectedRowsSql, ["sql"])) {
                        toast("Selected rows exported to SQL");
                    } else {
                        toast("Failed to export SQL", {kind: "error"});
                    }
                    break;
                default:
                    console.warn("Unhandled context menu event", event.payload, lastMenuContext);
            }
            lastMenuContext = {};
        });

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    });
</script>

{#if pgTable.current === undefined}
    <div class="w-full h-full flex flex-col gap-4 items-center justify-center text-fg-1">
        <UnpluggedIcon --size="3rem" --thickness="1.2" />
        <div>The database is empty or not started.</div>
    </div>
{:else}
    <div class="flex flex-1 w-full h-full overflow-auto">
        <div>
            <div class="grid items-center px-2 h-10">
                <CheckboxInput
                    checked={pgTable.selectedRows.length === pgTable.current.rows.length &&
                        pgTable.current.rows.length > 0}
                    disabled={pgTable.current.rows.length === 0}
                    indeterminate={pgTable.selectedRows.length > 0 &&
                        pgTable.selectedRows.length !== pgTable.current.rows.length}
                    onchange={() => {
                        if (!pgTable.current || pgTable.selectedRows.length === pgTable.current.rows.length) {
                            pgTable.selectedRows = [];
                        } else {
                            pgTable.selectedRows = Array.from(new Array(pgTable.current.rows.length)).map((_, i) => i);
                        }
                    }}
                />
            </div>
            {#each pgTable.current.rows as _, i}
                <div class="grid items-center px-2 h-10">
                    <CheckboxInput
                        checked={pgTable.selectedRows.indexOf(i) !== -1}
                        onchange={(e) => {
                            if (e.currentTarget.checked) {
                                pgTable.selectedRows.push(i);
                            } else {
                                pgTable.selectedRows.splice(pgTable.selectedRows.indexOf(i), 1);
                            }
                        }}
                    />
                </div>
            {/each}
        </div>
        <table class="h-fit">
            <thead class="sticky top-0 bg-bg">
                <tr>
                    {#each pgTable.current.columns as column}
                        <th>
                            <div class="flex gap-2 items-center px-1">
                                {#if column.is_primary_key === "YES"}<KeyIcon --size="1.2rem" />{/if}
                                {#if column.foreign_table_schema && column.foreign_table_name}
                                    <button
                                        onclick={() =>
                                            pgTable.use({
                                                type: "BASE TABLE",
                                                schema: column.foreign_table_schema!,
                                                name: column.foreign_table_name!,
                                            })}
                                        title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                        ><LinkIcon --size="1.2rem" /></button
                                    >
                                {/if}
                                <div>
                                    {column.column_name}
                                    <span class="font-normal text-xs! pl-2">{column.data_type}</span>
                                </div>
                            </div>
                        </th>
                    {/each}
                </tr>
            </thead>
            <tbody>
                {#each pgTable.current.rows as row}
                    <tr
                        onclick={() => {
                            rowToUpdate = row;
                            isUpdateOpen = true;
                        }}
                    >
                        {#each pgTable.current.columns as column}
                            {@const value = row[column.column_name]}
                            <td oncontextmenu={(e) => clickHandler(e, column, row)}>
                                {#if value === null}
                                    null
                                {:else if typeof value === "object"}
                                    {JSON.stringify(value)}
                                {:else}
                                    <div class="flex gap-2 items-center">
                                        <span class="grow">{value}</span>
                                        {#if column.foreign_table_schema && column.foreign_table_name && column.foreign_column_name}
                                            <button
                                                class="my-auto cursor-pointer"
                                                onclick={(event) => {
                                                    event.stopPropagation();
                                                    pgTable.use({
                                                        type: "BASE TABLE",
                                                        schema: column.foreign_table_schema!,
                                                        name: column.foreign_table_name!,
                                                    });
                                                    pgTable.whereFilters = [
                                                        {
                                                            column: column.foreign_column_name!,
                                                            operator: "=",
                                                            value: `${value}`,
                                                        },
                                                    ];
                                                    pgTable.applyWhere();
                                                }}
                                                title="{column.foreign_table_schema}.{column.foreign_table_name}.{column.foreign_column_name}"
                                                ><ArrowIcon direction="right" --size="1rem" /></button
                                            >
                                        {/if}
                                    </div>
                                {/if}
                            </td>
                        {/each}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

{#if pgTable.current && rowToUpdate}
    <Dialog isOpen={isUpdateOpen} onrequestclose={() => (isUpdateOpen = false)} position="right" animation="right">
        <TableUpsert row={rowToUpdate} onclose={() => (isUpdateOpen = false)} />
    </Dialog>
{/if}
