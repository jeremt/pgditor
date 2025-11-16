import {getConnectionsContext} from "$lib/connection/connectionsContext.svelte";
import {catchError} from "$lib/helpers/catchError";
import {debounced} from "$lib/helpers/debounced.svelte";
import {invoke} from "@tauri-apps/api/core";
import {getContext, setContext} from "svelte";
import {formatValue, type PgType} from "./values";

export type PgTable = {
    schema: string;
    name: string;
    type: "BASE TABLE" | "VIEW";
};

export type PgColumn = {
    column_name: string;
    data_type: PgType;
    is_nullable: "YES" | "NO";
    column_default?: string;
    is_primary_key: "YES" | "NO";
    foreign_table_schema?: string;
    foreign_table_name?: string;
    foreign_column_name?: string;
};

export type PgRow = Record<string, object | string | number | boolean | null>;

class TableContext {
    list = $state<PgTable[]>([]);
    current = $state<PgTable & {columns: PgColumn[]; rows: PgRow[]; count: number}>();

    filters = $state({
        where: "",
        offset: 0,
        limit: 100,
    });

    debouncedFilters = debounced(
        () => this.filters,
        async (data) => {
            this.updateData(data.where, data.offset, data.limit);
        },
        500
    );

    selectedRows = $state<number[]>([]);

    private connections = getConnectionsContext();

    /**
     * Loads all available tables from every schemas for the current pg connection. The public schema appears before any users.
     *
     * The first table of the list is automatically used by default.
     */
    loadTables = async () => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const [tableError, unsortedTables] = await catchError(invoke<PgTable[]>("list_tables", {connectionString}));
        if (tableError) {
            throw tableError; // TODO: toast
        }
        this.list = unsortedTables.toSorted((table) => (table.schema === "public" ? -1 : 1));
        if (this.list[0]) {
            this.use(this.list[0]);
        }
    };

    /**
     * Select the given table and show its rows automatically.
     */
    use = async (table: PgTable) => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const [columnsError, columns] = await catchError(
            invoke<PgColumn[]>("list_table_columns", {
                connectionString,
                schema: table.schema,
                table: table.name,
            })
        );
        if (columnsError) {
            throw columnsError; // TODO: toast
        }
        this.current = {...table, columns, rows: [], count: 0};
        this.filters = {
            where: "",
            offset: 0,
            limit: 100,
        };
        await this.refresh();
    };

    /**
     * Run a select to get a list of rows from the currently selected table which applying the given filters.
     * @param where The where cause to apply (e.g. "WHERE id = 1 AND status = 'success'")
     * @param offset The offset to apply to the select query.
     * @param limit The maximal number of rows returns by the query.
     * @returns
     */
    updateData = async (where: string, offset: number, limit: number) => {
        if (!this.connections.current || !this.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        console.log({where});
        const [dataError, data] = await catchError(
            invoke<{rows: PgRow[]; count: number}>("get_table_data", {
                connectionString,
                schema: this.current.schema,
                table: this.current.name,
                offset,
                limit,
                where_clause: where,
            })
        );
        if (dataError) {
            throw dataError; // TODO: toast
        }
        this.selectedRows = [];
        this.current.rows = data.rows;
        this.current.count = data.count;
    };

    /**
     * Simple helper to re-run `updateData()` with the currently selected filters.
     */
    refresh = async () => {
        await this.updateData(this.filters.where, this.filters.offset, this.filters.limit);
    };

    /**
     * Run the given raw sql query and call `refresh()` to update the displayed rows.
     * @param sql The raw query string to run.
     */
    rawQuery = async (sql: string) => {
        if (!this.connections.current || !this.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const [error] = await catchError(
            invoke("raw_query", {
                connectionString,
                sql,
            })
        );
        if (error) {
            throw new Error(error.message); // TODO: toast
        }
        // FIXME: this is a bit wasteful to refresh data, it could be done through optimistic update directly
        await this.refresh();
    };

    upsertRow = async (row: PgRow & {ctid?: string}) => {
        if (!this.current) {
            return;
        }
        if (row.ctid) {
            const query = `UPDATE "${this.current.schema}"."${this.current.name}"
SET
  ${this.current.columns
      .filter((col) => col.is_primary_key === "NO")
      .map((col) => `${col.column_name} = ${formatValue(col, row[col.column_name])}`)
      .join(",\n  ")}
WHERE ctid = '${row.ctid}';`;
            await this.rawQuery(query);
        } else {
            const query = `INSERT INTO "${this.current.schema}"."${this.current.name}"
(${this.current.columns
                // only send pk if not null
                .filter((col) => col.is_primary_key === "NO" || row[col.column_name] !== null)
                .map(({column_name}) => column_name)
                .join(", ")})
VALUES
(${this.current.columns
                // only send pk if not null
                .filter((col) => col.is_primary_key === "NO" || row[col.column_name] !== null)
                .map((col) => formatValue(col, row[col.column_name]))
                .join(", ")});`;
            await this.rawQuery(query);
        }
    };
}

const key = Symbol("tableContext");

export const getTableContext = () => getContext<TableContext>(key);
export const setTableContext = () => setContext(key, new TableContext());
