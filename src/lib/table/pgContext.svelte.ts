import {getConnectionsContext} from "$lib/connection/connectionsContext.svelte";
import {catchError} from "$lib/helpers/catchError";
import {debounced} from "$lib/helpers/debounced.svelte";
import {invoke} from "@tauri-apps/api/core";
import {getContext, setContext} from "svelte";
import {valueToSql, type PgType} from "./values";
import {getToastContext} from "$lib/widgets/Toaster.svelte";

export type PgTable = {
    schema: string;
    name: string;
    type: "BASE TABLE" | "VIEW";
    column_names: string[]; // just get the name of all tables for quick lookup
    size_mb: number;
};

export type PgColumn = {
    column_name: string;
    data_type: PgType;
    is_nullable: "YES" | "NO";
    column_default: string | null;
    is_primary_key: "YES" | "NO";
    foreign_table_schema: string | null;
    foreign_table_name: string | null;
    foreign_column_name: string | null;
    enum_values: string[] | null;
};

export type PgRow = Record<string, object | string | bigint | number | boolean | null>;

export type WhereFilters = {column: string; operator: string; value: string}[];

class PgContext {
    toastContext = getToastContext();
    tables = $state<PgTable[]>([]);
    currentTable = $state<PgTable & {columns: PgColumn[]; rows: PgRow[]; count: number}>();
    isUseDialogOpen = $state(false);
    isFilterPopover = $state(false);
    lastQueryTime = $state<number>();
    isLoading = $state(false);

    filters = $state({
        where: "",
        offset: 0,
        limit: 100,
        orderBy: undefined as {column: string; direction: "asc" | "desc"} | undefined,
    });
    whereFilters = $state<WhereFilters>([]);
    appliedFilters = $state(0);

    debouncedFilters = debounced(
        () => this.filters,
        async (data) => {
            this.updateData(data.where, data.offset, data.limit);
        },
        500
    );

    rowToUpdate = $state<PgRow>();
    isUpdateOpen = $state(false);

    openUpdateRow = (row: PgRow) => {
        this.rowToUpdate = row;
        this.isUpdateOpen = true;
    };

    selectedRows = $state<number[]>([]);
    get selectedRowsJson() {
        if (!this.currentTable) {
            return [];
        }
        return this.currentTable.rows.filter((_, i) => this.selectedRows.length === 0 || this.selectedRows.includes(i));
    }
    get selectedRowsCsv() {
        if (!this.currentTable) {
            return "";
        }
        return (
            this.currentTable.columns.map((col) => col.column_name).join(",") +
            "\n" +
            this.selectedRowsJson
                .map((row) => this.currentTable!.columns.map((col) => row[col.column_name]).join(","))
                .join("\n")
        );
    }
    get selectedRowsSql() {
        if (!this.currentTable) {
            return "";
        }
        return `INSERT INTO ${this.fullName}
(${this.currentTable.columns.map((col) => col.column_name).join(",")})
VALUES
${this.selectedRowsJson
    .map((row) => `(${this.currentTable!.columns.map((col) => valueToSql(col, row[col.column_name])).join(",")})`)
    .join(",\n")}
;`;
    }

    private connections = getConnectionsContext();

    get fullName() {
        if (!this.currentTable) {
            return undefined;
        }
        return `"${this.currentTable.schema}"."${this.currentTable.name}"`;
    }

    /**
     * Loads all available tables from every schemas for the current pg connection. The public schema appears before any users.
     *
     * The first table of the list is automatically used by default.
     *
     * @param autoUse if true, a table will be automatically selected. It should be set to false for a simple refresh for instance.
     */
    loadTables = async (autoUse = true) => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        this.isLoading = true;
        const [tableError, unsortedTables] = await catchError(invoke<PgTable[]>("list_tables", {connectionString}));
        if (tableError) {
            console.error(tableError.message);
            this.toastContext.toast(`Server error: ${tableError.message} (${this.connections.current.name})`, {
                kind: "error",
            });
            this.tables = [];
            this.currentTable = undefined;
            return;
        } else {
            this.toastContext.toast(`Connected to ${this.connections.current.name}`, {kind: "success", timeout: 2000});
        }
        this.tables = unsortedTables.toSorted((table) => (table.schema === "public" ? -1 : 1));
        if (autoUse && this.tables[0]) {
            const selectedTable = await this.connections.getSelectedTable();
            const index = this.tables.findIndex((table) => `${table.schema}.${table.name}` === selectedTable);
            this.use(this.tables[index === -1 ? 0 : index]);
        }
        this.isLoading = false;
    };

    /**
     * Select the given table and show its rows automatically.
     */
    use = async (table: Pick<PgTable, "schema" | "name">) => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        this.isLoading = true;
        const [columnsError, columns] = await catchError(
            invoke<PgColumn[]>("list_table_columns", {
                connectionString,
                schema: table.schema,
                table: table.name,
            })
        );
        if (columnsError) {
            console.error(columnsError.message);
            this.toastContext.toast(`Server error: ${columnsError.message}`, {kind: "error"});
            return;
        }
        const t = this.tables.find((item) => item.schema === table.schema && item.name === table.name);
        if (!t) {
            console.error(`Table ${table.schema}.${table.name} not found`);
            this.toastContext.toast(`Table ${table.schema}.${table.name} not found`);
            return;
        }
        this.currentTable = {...t, columns, rows: [], count: 0};
        this.connections.saveSelectedTable(this.currentTable);
        this.filters = {
            where: "",
            offset: 0,
            limit: 100,
            orderBy: undefined,
        };
        await this.refreshData();
        this.isLoading = false;
    };

    /**
     * Run a select to get a list of rows from the currently selected table which applying the given filters.
     * @param where The where cause to apply (e.g. "WHERE id = 1 AND status = 'success'")
     * @param offset The offset to apply to the select query.
     * @param limit The maximal number of rows returns by the query.
     */
    updateData = async (where: string, offset: number, limit: number) => {
        if (!this.connections.current || !this.currentTable) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const startTime = performance.now();
        this.isLoading = true;
        const [dataError, data] = await catchError(
            invoke<{rows: PgRow[]; count: number}>("get_table_data", {
                connectionString,
                schema: this.currentTable.schema,
                table: this.currentTable.name,
                offset,
                limit,
                whereClause: where,
                orderBy: this.filters.orderBy
                    ? `ORDER BY ${this.filters.orderBy.column} ${this.filters.orderBy.direction}`
                    : "",
            })
        );
        this.lastQueryTime = performance.now() - startTime;
        if (dataError) {
            console.error(dataError.message);
            this.toastContext.toast(`SQL error: ${dataError.message}`, {kind: "error"});
            return;
        }
        this.selectedRows = [];
        this.currentTable.rows = data.rows;
        for (let i = 0; i < this.currentTable.rows.length; i++) {
            this.currentTable.rows[i].__index = i;
        }
        this.currentTable.count = data.count;
        this.isLoading = false;
    };

    /**
     * Simple helper to re-run `updateData()` with the currently selected filters.
     */
    refreshData = async () => {
        await this.updateData(this.filters.where, this.filters.offset, this.filters.limit);
    };

    /**
     * Run the given raw sql query and call `refresh()` to update the displayed rows.
     * @param sql The raw query string to run.
     * @param throwError Throws an error by default, set to `false` if you want a toast like other helpers.
     */
    rawQuery = async (sql: string, {throwError = true, refresh = true} = {}) => {
        if (!this.connections.current || !this.currentTable) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const startTime = performance.now();
        this.isLoading = true;
        const [error, data] = await catchError(
            invoke<Record<string, string | null>[]>("raw_query", {
                connectionString,
                sql,
            })
        );
        this.lastQueryTime = performance.now() - startTime;

        if (error) {
            console.error(error.message, sql);
            if (throwError) {
                throw error;
            }
            this.toastContext.toast(`SQL error: ${error.message}`, {kind: "error", details: sql});
            return;
        }
        if (refresh) {
            // FIXME: this is a bit wasteful to refresh data, it could be done through optimistic update directly
            await this.refreshData();
        }
        this.isLoading = false;
        return data;
    };

    getPrimaryKey = () => {
        if (!this.currentTable) {
            return;
        }
        const primary_key = this.currentTable.columns.find((col) => col.is_primary_key === "YES");
        if (primary_key === undefined) {
            this.toastContext.toast(`Cannot update row without primary key.`, {kind: "error"});
            return;
        }
        return primary_key;
    };

    deleteSelection = async () => {
        const pk = this.getPrimaryKey();
        if (!pk || !this.currentTable) {
            return;
        }
        // TODO: check for cascading foreign keys and show a warning dialog before deleting if any
        const query = `DELETE FROM ${this.fullName}
WHERE ${pk.column_name} = ANY(ARRAY[${this.selectedRows
            .map((index) => valueToSql(pk, this.currentTable!.rows[index][pk.column_name]))
            .join(", ")}]);`;
        await this.rawQuery(query);
        this.selectedRows = [];
        this.filters.where = "";
    };

    updateRow = async (row: PgRow, {throwError = true} = {}) => {
        const pk = this.getPrimaryKey();
        if (!pk || !this.currentTable) {
            return;
        }
        this.rawQuery(
            `UPDATE ${this.fullName} SET
${this.currentTable.columns
    .filter((col) => col.is_primary_key === "NO")
    .map((col) => `${col.column_name} = ${valueToSql(col, row[col.column_name])}`)
    .join(",\n  ")}
WHERE ${pk.column_name} = ${valueToSql(pk, row[pk.column_name])};
                        `,
            {throwError}
        );
    };

    /**
     * Simple helper function to do an insert into or an update depending on whether there is a primary key or not.
     */
    upsertRow = async (row: PgRow, {throwError = true} = {}) => {
        if (!this.currentTable) {
            return;
        }
        const primary_key = this.getPrimaryKey();
        if (!primary_key) {
            this.toastContext.toast(`Can't update row without primary key`);
            return;
        }
        const editableColumns = (column: PgColumn) => column.is_primary_key === "NO" && column.data_type !== "tsvector";
        const primary_key_value = primary_key ? row[primary_key.column_name] : null;
        const query = primary_key_value
            ? // updae
              `UPDATE ${this.fullName}
SET
  ${this.currentTable.columns
      .filter(editableColumns)
      .map((col) => `${col.column_name} = ${valueToSql(col, row[col.column_name])}`)
      .join(",\n  ")}
WHERE ${primary_key!.column_name} = ${valueToSql(primary_key!, primary_key_value)};`
            : // insert
              `INSERT INTO ${this.fullName}
(${this.currentTable.columns
                  .filter(editableColumns)
                  .map(({column_name}) => column_name)
                  .join(", ")})
VALUES
(${this.currentTable.columns
                  .filter(editableColumns)
                  .map((col) => valueToSql(col, row[col.column_name]))
                  .join(", ")});`;

        return this.rawQuery(query, {throwError});
    };

    applyWhere = () => {
        this.filters.where = this.whereFilters.reduce((result, filter) => {
            return (
                result +
                "\n" +
                (result === "" ? "WHERE" : "AND") +
                ` ${filter.column} ${filter.operator} ${filter.value}`
            );
        }, "");
        this.appliedFilters = this.whereFilters.length;
    };
}
const key = Symbol("pgContext");

export const getPgContext = () => getContext<PgContext>(key);
export const setPgContext = () => setContext(key, new PgContext());
