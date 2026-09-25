import {catch_error} from "@les3dev/catch_error";
import {writeText} from "@tauri-apps/plugin-clipboard-manager";
import {value_to_sql} from "./values";
import {get_pg_context, type PgColumn, type PgRow} from "./pg_context.svelte";
import {get_commands_context} from "$lib/commands/commands_context.svelte";
import {get_scripts_context} from "$lib/scripts/scripts_context.svelte";
import {get_toast_context} from "$lib/widgets/Toaster.svelte";

export const create_table_value_actions = (
    target: () => {element: HTMLElement; row: PgRow; column: PgColumn} | undefined,
    close: () => void,
) => {
    const pg = get_pg_context();
    const commands = get_commands_context();
    const scripts = get_scripts_context();
    const {toast} = get_toast_context();

    let error_message = $state("");
    let refreshing = $state(false);

    $effect(() => {
        if (target()) {
            error_message = "";
        }
    });

    /**
     * Keep the primary key of the target row and the value of the target cell.
     */
    const target_update = () => {
        const t = target();
        const primary_key = t && pg.pick_primary_keys(t.row);
        if (t === undefined || primary_key === undefined) {
            return;
        }
        return {...primary_key, [t.column.column_name]: t.row[t.column.column_name]} as PgRow;
    };

    const update_value = async () => {
        const row = target_update();
        if (row === undefined) {
            return;
        }
        const error = await catch_error(() => pg.update_row(row));
        if (error instanceof Error) {
            error_message = error.message;
        } else {
            close();
        }
    };

    /**
     * Re-run the query for this cell only, dropping the changes that have not been applied yet.
     */
    const refresh_value = async () => {
        const t = target();
        if (t === undefined) {
            return;
        }
        refreshing = true;
        setTimeout(() => {
            refreshing = false;
        }, 500);
        const value = await pg.get_row_value(t.row, t.column);
        if (value !== undefined) {
            t.row[t.column.column_name] = value;
        }
    };

    const copy_value = async () => {
        const t = target();
        if (!t) {
            return;
        }
        await writeText(value_to_sql(t.column, t.row[t.column.column_name]));
        toast(`Copied value to clipboard`);
    };

    const copy_sql = async () => {
        const row = target_update();
        if (row === undefined) {
            return;
        }
        const sql = await pg.generate_update_row(row);
        if (sql !== undefined) {
            await writeText(sql.trim());
            toast(`Copied sql to clipboard`);
        }
    };

    const edit_sql = async () => {
        const row = target_update();
        if (row === undefined) {
            return;
        }
        const sql = await pg.generate_update_row(row);
        if (sql) {
            scripts.empty_file();
            scripts.current_value = sql.trim();
            commands.mode = "script";
        }
    };

    return {
        get error_message() {
            return error_message;
        },
        get refreshing() {
            return refreshing;
        },
        update_value,
        refresh_value,
        copy_value,
        copy_sql,
        edit_sql,
    };
};
