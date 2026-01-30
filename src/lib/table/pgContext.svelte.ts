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

export const whereOperators = [
    "=",
    "!=",
    ">",
    "<",
    "<=",
    ">=",
    "like",
    "ilike",
    "not like",
    "~",
    "~*",
    "!~",
    "!~*",
    "is null",
    "is not null",
] as const;
export type WhereOperator = (typeof whereOperators)[number];
export type WhereFilter = {column: string; column_type: PgType; operator: WhereOperator; value: string};

const valueForOperator = (data_type: PgType, operator: WhereOperator, value: string) => {
    if (
        operator === "like" ||
        operator === "ilike" ||
        operator === "not like" ||
        operator === "~" ||
        operator === "~*" ||
        operator === "!~" ||
        operator === "!~*"
    ) {
        return `'${value}'`;
    }
    return valueToSql({data_type}, value as any);
};
export const filtersToWhere = (filters: WhereFilter[]) =>
    filters.reduce((result, filter) => {
        return (
            result +
            "\n" +
            (result === "" ? "where" : "and") +
            ` ${filter.column} ${filter.operator} ${valueForOperator(filter.column_type, filter.operator, filter.value)}`
        );
    }, "");

export const operatorsForColumn = (column: PgColumn | undefined): WhereOperator[] => {
    if (column === undefined) {
        return [];
    }
    const operators: WhereOperator[] = ["=", "!="];
    if (column.is_nullable === "YES") {
        operators.push("is null", "is not null");
    }
    if (
        column.data_type === "text" ||
        column.data_type === "varchar" ||
        column.data_type === "character" ||
        column.data_type === "character_varying"
    ) {
        operators.push("<", "<=", ">", "<=", "like", "ilike", "not like", "~", "~*", "!~", "!~*");
    }
    if (
        column.data_type === "smallint" ||
        column.data_type === "integer" ||
        column.data_type === "bigint" ||
        column.data_type === "int2" ||
        column.data_type === "int4" ||
        column.data_type === "int8" ||
        column.data_type === "decimal" ||
        column.data_type === "numeric" ||
        column.data_type === "real" ||
        column.data_type === "double_precision" ||
        column.data_type === "smallserial" ||
        column.data_type === "serial" ||
        column.data_type === "bigserial" ||
        column.data_type === "money"
    ) {
        operators.push("<", "<=", ">", "<=");
    }
    return operators;
};

const DEFAULT_LIMIT = 100;

class PgContext {
    toastContext = getToastContext();
    tables = $state<PgTable[]>([]);
    currentTable = $state<PgTable & {columns: PgColumn[]; rows: PgRow[]; count: number}>();
    lastQueryTime = $state<number>();
    isLoading = $state(false);

    selectedColumns = $state<Set<string>>(new Set([]));
    getSelectedColumns = () => {
        return (
            this.currentTable?.columns.filter(
                (col) => this.selectedColumns.size === 0 || this.selectedColumns.has(col.column_name),
            ) ?? []
        );
    };

    // filters
    isFilterPopover = $state(false);
    whereFilters = $state<WhereFilter[]>([]);
    appliedFilters = $state(0);
    whereSql = $state("");
    offset = $state(0);
    limit = $state(DEFAULT_LIMIT);
    orderBy = $state<{column: string; direction: "asc" | "desc"}>();
    resetFilters = () => {
        this.whereFilters = [];
        this.appliedFilters = 0;
        this.whereSql = "";
        this.offset = 0;
        this.limit = DEFAULT_LIMIT;
        this.orderBy = undefined;
    };

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
        const unsortedTables = await catchError(invoke<PgTable[]>("list_tables", {connectionString}));
        if (unsortedTables instanceof Error) {
            console.error(unsortedTables.message);
            this.toastContext.toast(`Server error: ${unsortedTables.message} (${this.connections.current.name})`, {
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
        const columns = await catchError(
            invoke<PgColumn[]>("list_table_columns", {
                connectionString,
                schema: table.schema,
                table: table.name,
            }),
        );
        if (columns instanceof Error) {
            console.error(columns.message);
            this.toastContext.toast(`Server error: ${columns.message}`, {kind: "error"});
            return;
        }
        const t = this.tables.find((item) => item.schema === table.schema && item.name === table.name);
        if (!t) {
            console.error(`Table ${table.schema}.${table.name} not found`);
            this.toastContext.toast(`Table ${table.schema}.${table.name} not found`);
            return;
        }
        this.currentTable = {...t, columns, rows: [], count: 0};
        this.selectedColumns = new Set(columns.map((col) => col.column_name));
        this.connections.saveSelectedTable(this.currentTable);
        this.resetFilters();
        await this.refreshData();
        this.isLoading = false;
    };

    /**
     * Return rows for the given table.
     */
    getTableData = async (table: Pick<PgTable, "schema" | "name">, where: string, offset: number, limit: number) => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const columns = await catchError(
            invoke<PgColumn[]>("list_table_columns", {
                connectionString,
                schema: table.schema,
                table: table.name,
            }),
        );
        if (columns instanceof Error) {
            return columns;
        }
        const data = await catchError(
            invoke<{rows: PgRow[]; count: number}>("get_table_data", {
                connectionString,
                schema: table.schema,
                table: table.name,
                columns: "*",
                whereClause: where,
                offset,
                limit,
                orderBy: "",
            }),
        );
        if (data instanceof Error) {
            return data;
        }
        for (let i = 0; i < data.rows.length; i++) {
            data.rows[i].__index = i;
        }
        return {...data, columns};
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
        this.isLoading = true;
        const primary_key = this.currentTable.columns.find((col) => col.is_primary_key === "YES");
        const data = await catchError(
            invoke<{rows: PgRow[]; count: number}>("get_table_data", {
                connectionString,
                schema: this.currentTable.schema,
                table: this.currentTable.name,
                columns:
                    this.selectedColumns.size === 0 ||
                    this.selectedColumns.size === this.currentTable.column_names.length
                        ? "*"
                        : this.selectedColumns.values().toArray().join(", "),
                offset,
                limit,
                whereClause: where,
                orderBy: this.orderBy
                    ? `order by ${this.orderBy.column} ${this.orderBy.direction}`
                    : primary_key !== undefined
                      ? `order by ${primary_key.column_name} asc`
                      : "",
            }),
        );
        if (data instanceof Error) {
            console.error(data.message);
            this.toastContext.toast(`SQL error: ${data.message}`, {kind: "error"});
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
        await this.updateData(this.whereSql, this.offset, this.limit);
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
        this.isLoading = true;
        const data = await catchError(
            invoke<{rows: Record<string, string | null>[]; duration_ms: number}>("raw_query", {
                connectionString,
                sql,
            }),
        );
        this.isLoading = false;

        if (data instanceof Error) {
            console.error(data.message, sql);
            if (throwError) {
                throw data;
            }
            this.toastContext.toast(`SQL error: ${data.message}`, {kind: "error", details: sql});
            return;
        }
        if (refresh) {
            this.isLoading = true;
            // FIXME: this is a bit wasteful to refresh data, it could be done through optimistic update directly
            await this.refreshData();
            this.isLoading = false;
        }
        this.lastQueryTime = data.duration_ms;
        return data.rows;
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
        const query = `delete from ${this.fullName}
where ${pk.column_name} = any(array[${this.selectedRows
            .map((index) => valueToSql(pk, this.currentTable!.rows[index][pk.column_name]))
            .join(", ")}]);`;
        await this.rawQuery(query);
        this.selectedRows = [];
        this.resetFilters();
    };

    truncateTable = async () => {
        await this.rawQuery(`truncate ${this.fullName} restart identity cascade`, {throwError: false});
        this.resetFilters();
    };

    generateUpdateRow = async (row: PgRow) => {
        const pk = this.getPrimaryKey();
        if (!pk || !this.currentTable) {
            console.warn(`Cannot update without primary key.`);
            return;
        }
        const editableColumns = (column: PgColumn) =>
            column.is_primary_key === "NO" &&
            column.data_type !== "tsvector" &&
            Object.keys(row).includes(column.column_name);
        return `UPDATE ${this.fullName} SET
${this.currentTable.columns
    .filter(editableColumns)
    .map((col) => `${col.column_name} = ${valueToSql(col, row[col.column_name])}`)
    .join(",\n  ")}
WHERE ${pk.column_name} = ${valueToSql(pk, row[pk.column_name])};
                        `;
    };

    updateRow = async (row: PgRow, {throwError = true} = {}) => {
        const query = await this.generateUpdateRow(row);
        if (!query) {
            return;
        }
        await this.rawQuery(query, {throwError});
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
              `update ${this.fullName}
set
  ${this.currentTable.columns
      .filter(editableColumns)
      .map((col) => `${col.column_name} = ${valueToSql(col, row[col.column_name])}`)
      .join(",\n  ")}
where ${primary_key!.column_name} = ${valueToSql(primary_key!, primary_key_value)};`
            : // insert
              `insert into ${this.fullName}
(${this.currentTable.columns
                  .filter(editableColumns)
                  .map(({column_name}) => column_name)
                  .join(", ")})
values
(${this.currentTable.columns
                  .filter(editableColumns)
                  .map((col) => valueToSql(col, row[col.column_name]))
                  .join(", ")});`;

        return await this.rawQuery(query, {throwError});
    };

    insertRow = async (row: PgRow, {throwError = true} = {}) => {
        if (!this.currentTable) {
            return;
        }
        const editableColumns = (column: PgColumn) => column.is_primary_key === "NO" && column.data_type !== "tsvector";
        const query = `insert into ${this.fullName}
(${this.currentTable.columns
            .filter(editableColumns)
            .map(({column_name}) => column_name)
            .join(", ")})
values
(${this.currentTable.columns
            .filter(editableColumns)
            .map((col) => valueToSql(col, row[col.column_name]))
            .join(", ")});`;
        return await this.rawQuery(query, {throwError});
    };
}
const key = Symbol("pgContext");

export const getPgContext = () => getContext<PgContext>(key);
export const setPgContext = () => setContext(key, new PgContext());
