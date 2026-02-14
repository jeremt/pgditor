import {listen} from "@tauri-apps/api/event";
import {Menu} from "@tauri-apps/api/menu";
import {writeText} from "@tauri-apps/plugin-clipboard-manager";
import {saveToFile} from "$lib/helpers/saveToFile";
import {getToastContext} from "$lib/widgets/Toaster.svelte";
import {get_pg_context, type PgColumn, type PgRow} from "./pgContext.svelte";

export const createContextMenu = () => {
    const pg = get_pg_context();
    const {toast} = getToastContext();
    let lastMenuContext: {column?: PgColumn; row?: PgRow} = {};

    const oncontextmenu = async (event: MouseEvent, column: PgColumn, row: PgRow) => {
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
        // if (column.is_primary_key === "YES") {
        items.push({id: "table_update_row", text: "Update row"});
        // }

        items.push({item: "Separator"}); // Predefined separator

        if (pg.selected_rows.length) {
            items.push({
                text: `Copy ${pg.selected_rows.length} row${pg.selected_rows.length > 1 ? "s" : ""}`,
                items: [
                    {id: "copy_json", text: "JSON"},
                    {id: "copy_csv", text: "CSV"},
                    {id: "copy_sql", text: "SQL"},
                ],
            });
            items.push({
                text: `Export ${pg.selected_rows.length} row${pg.selected_rows.length > 1 ? "s" : ""}`,
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
                case "table_set_null": {
                    if (lastMenuContext.column) {
                        await pg.update_row({[lastMenuContext.column.column_name]: null}, {throwError: false});
                        toast("Value set to NULL");
                    }
                    break;
                }
                case "table_set_default": {
                    if (lastMenuContext.column) {
                        await pg.update_row(
                            {[lastMenuContext.column.column_name]: lastMenuContext.column.column_default},
                            {throwError: false},
                        );
                        toast("Value set to default");
                    }
                    break;
                }
                case "table_set_all_null":
                    if (lastMenuContext.column && pg.current_table) {
                        await pg.raw_query(`UPDATE ${pg.fullname} SET ${lastMenuContext.column.column_name} = null;`, {
                            throwError: false,
                        });
                        toast(`All values of column ${lastMenuContext.column.column_name} set to NULL`);
                    }
                    break;
                case "table_set_all_default":
                    if (lastMenuContext.column && pg.current_table) {
                        await pg.raw_query(
                            `UPDATE ${pg.fullname} SET ${lastMenuContext.column.column_name} = ${lastMenuContext.column.column_default};`,
                            {throwError: false},
                        );
                        toast(`All values of column ${lastMenuContext.column.column_name} set to default`);
                    }
                    break;
                case "copy_json":
                    if (pg.current_table) {
                        await writeText(JSON.stringify(pg.selected_rows_json));
                        toast("Selected rows copied to JSON");
                    }
                    break;
                case "copy_csv":
                    if (pg.current_table) {
                        await writeText(pg.selected_rows_csv);
                        toast("Selected rows copied to CSV");
                    }
                    break;
                case "copy_sql":
                    if (pg.current_table) {
                        await writeText(pg.selected_rows_sql);
                        toast("Selected rows copied to SQL");
                    }
                    break;
                case "export_json":
                    if (pg.current_table) {
                        if (await saveToFile(JSON.stringify(pg.selected_rows_json), ["json"])) {
                            toast("Selected rows exported to JSON");
                        } else {
                            toast("Failed to export JSON", {kind: "error"});
                        }
                    }
                    break;
                case "export_csv":
                    if (await saveToFile(pg.selected_rows_csv, ["csv"])) {
                        toast("Selected rows exported to CSV");
                    } else {
                        toast("Failed to export CSV", {kind: "error"});
                    }
                    break;
                case "export_sql":
                    if (await saveToFile(pg.selected_rows_sql, ["sql"])) {
                        toast("Selected rows exported to SQL");
                    } else {
                        toast("Failed to export SQL", {kind: "error"});
                    }
                    break;
                case "table_update_row": {
                    if (lastMenuContext.row) {
                        pg.open_update_row(lastMenuContext.row);
                    }
                    break;
                }
                default:
                    console.warn("Unhandled context menu event", event.payload, lastMenuContext);
            }
            lastMenuContext = {};
        });

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
        };
    });

    return {oncontextmenu};
};
