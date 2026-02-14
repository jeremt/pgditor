import {getConnectionsContext} from "$lib/connection/connectionsContext.svelte";
import {catchError} from "$lib/helpers/catchError";
import {invoke} from "@tauri-apps/api/core";
import {getContext, setContext} from "svelte";
import {valueToSql, valueTypeIsNumber, type PgType} from "./values";
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
    data_type_params: string | null;
    is_nullable: "YES" | "NO";
    column_default: string | null;
    is_primary_key: "YES" | "NO";
    foreign_table_schema: string | null;
    foreign_table_name: string | null;
    foreign_column_name: string | null;
    enum_values: string[] | null;
};

export type PgTableForGraph = Omit<PgTable, "column_names"> & {columns: PgColumn[]};

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

const value_for_operator = (data_type: PgType, operator: WhereOperator, value: string) => {
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
export const filters_to_where = (filters: WhereFilter[]) =>
    filters.reduce((result, filter) => {
        return (
            result +
            "\n" +
            (result === "" ? "where" : "and") +
            ` ${filter.column} ${filter.operator} ${filter.operator !== "is null" && filter.operator !== "is not null" ? value_for_operator(filter.column_type, filter.operator, filter.value) : ""}`
        );
    }, "");

export const operators_for_column = (column: PgColumn | undefined): WhereOperator[] => {
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
    if (valueTypeIsNumber(column.data_type)) {
        operators.push("<", "<=", ">", "<=");
    }
    return operators;
};

const DEFAULT_LIMIT = 100;

class PgContext {
    #toast_context = getToastContext();
    tables = $state<PgTable[]>([]);
    current_table = $state<PgTable & {columns: PgColumn[]; rows: PgRow[]; count: number}>();
    last_query_time = $state<number>();
    is_loading = $state(false);

    selected_columns = $state<Set<string>>(new Set([]));
    get_selected_columns = () => {
        return (
            this.current_table?.columns.filter(
                (col) => this.selected_columns.size === 0 || this.selected_columns.has(col.column_name),
            ) ?? []
        );
    };

    // filters
    is_filters_open = $state(false);
    where_filters = $state<WhereFilter[]>([]);
    applied_filters = $state(0);
    where_sql = $state("");
    offset = $state(0);
    limit = $state(DEFAULT_LIMIT);
    order_by = $state<{column: string; direction: "asc" | "desc"}>();
    reset_filters = () => {
        this.where_filters = [];
        this.applied_filters = 0;
        this.where_sql = "";
        this.offset = 0;
        this.limit = DEFAULT_LIMIT;
        this.order_by = undefined;
    };

    row_to_update = $state<PgRow>();
    is_update_open = $state(false);

    open_update_row = (row: PgRow) => {
        this.row_to_update = row;
        this.is_update_open = true;
    };

    selected_rows = $state<number[]>([]);
    get selected_rows_json() {
        if (!this.current_table) {
            return [];
        }
        return this.current_table.rows.filter(
            (_, i) => this.selected_rows.length === 0 || this.selected_rows.includes(i),
        );
    }
    get selected_rows_csv() {
        if (!this.current_table) {
            return "";
        }
        return (
            this.current_table.columns.map((col) => col.column_name).join(",") +
            "\n" +
            this.selected_rows_json
                .map((row) => this.current_table!.columns.map((col) => row[col.column_name]).join(","))
                .join("\n")
        );
    }
    get selected_rows_sql() {
        if (!this.current_table) {
            return "";
        }
        return `INSERT INTO ${this.fullname}
(${this.current_table.columns.map((col) => col.column_name).join(",")})
VALUES
${this.selected_rows_json
    .map((row) => `(${this.current_table!.columns.map((col) => valueToSql(col, row[col.column_name])).join(",")})`)
    .join(",\n")}
;`;
    }

    private connections = getConnectionsContext();

    get fullname() {
        if (!this.current_table) {
            return undefined;
        }
        return `"${this.current_table.schema}"."${this.current_table.name}"`;
    }

    /**
     * Loads all available tables from every schemas for the current pg connection. The public schema appears before any users.
     *
     * The first table of the list is automatically used by default.
     *
     * @param autoUse if true, a table will be automatically selected. It should be set to false for a simple refresh for instance.
     */
    load_tables = async (autoUse = true) => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        this.is_loading = true;
        const unsortedTables = await catchError(invoke<PgTable[]>("list_tables", {connectionString}));
        if (unsortedTables instanceof Error) {
            console.error(unsortedTables.message);
            this.#toast_context.toast(`Server error: ${unsortedTables.message} (${this.connections.current.name})`, {
                kind: "error",
            });
            this.tables = [];
            this.current_table = undefined;
            return;
        } else {
            this.#toast_context.toast(`Connected to ${this.connections.current.name}`, {
                kind: "success",
                timeout: 2000,
            });
        }
        this.tables = unsortedTables.toSorted((table) => (table.schema === "public" ? -1 : 1));
        if (autoUse && this.tables[0]) {
            const selectedTable = await this.connections.getSelectedTable();
            const index = this.tables.findIndex((table) => `${table.schema}.${table.name}` === selectedTable);
            this.select_table(this.tables[index === -1 ? 0 : index]);
        }
        this.is_loading = false;
    };

    list_tables_for_graph = async () => {
        if (!this.connections.current) {
            return new Error(`Couldn't connect to the database`);
        }
        const connectionString = this.connections.current.connectionString;
        this.is_loading = true;

        const unsortedTables = await catchError(invoke<PgTableForGraph[]>("list_tables_for_graph", {connectionString}));
        this.is_loading = false;
        return unsortedTables;
    };

    /**
     * Select the given table and show its rows automatically.
     */
    select_table = async (table: Pick<PgTable, "schema" | "name">) => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        this.is_loading = true;
        const columns = await catchError(
            invoke<PgColumn[]>("list_table_columns", {
                connectionString,
                schema: table.schema,
                table: table.name,
            }),
        );
        if (columns instanceof Error) {
            console.error(columns.message);
            this.#toast_context.toast(`Server error: ${columns.message}`, {kind: "error"});
            return;
        }
        const t = this.tables.find((item) => item.schema === table.schema && item.name === table.name);
        if (!t) {
            console.error(`Table ${table.schema}.${table.name} not found`);
            this.#toast_context.toast(`Table ${table.schema}.${table.name} not found`);
            return;
        }
        this.current_table = {...t, columns, rows: [], count: 0};
        this.selected_columns = new Set(columns.map((col) => col.column_name));
        this.connections.saveSelectedTable(this.current_table);
        this.reset_filters();
        await this.refresh_data();
        this.is_loading = false;
    };

    /**
     * Return rows for the given table.
     */
    get_table_data = async (table: Pick<PgTable, "schema" | "name">, where: string, offset: number, limit: number) => {
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
    update_data = async (where: string, offset: number, limit: number) => {
        if (!this.connections.current || !this.current_table) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        this.is_loading = true;
        const primary_key = this.current_table.columns.find((col) => col.is_primary_key === "YES");
        const data = await catchError(
            invoke<{rows: PgRow[]; count: number}>("get_table_data", {
                connectionString,
                schema: this.current_table.schema,
                table: this.current_table.name,
                columns:
                    this.selected_columns.size === 0 ||
                    this.selected_columns.size === this.current_table.column_names.length
                        ? "*"
                        : this.selected_columns.values().toArray().join(", "),
                offset,
                limit,
                whereClause: where,
                orderBy: this.order_by
                    ? `order by ${this.order_by.column} ${this.order_by.direction}`
                    : primary_key !== undefined
                      ? `order by ${primary_key.column_name} asc`
                      : "",
            }),
        );
        if (data instanceof Error) {
            console.error(data.message);
            this.#toast_context.toast(`SQL error: ${data.message}`, {kind: "error"});
            return;
        }
        this.selected_rows = [];
        this.current_table.rows = data.rows;
        for (let i = 0; i < this.current_table.rows.length; i++) {
            this.current_table.rows[i].__index = i;
        }
        this.current_table.count = data.count;
        this.is_loading = false;
    };

    /**
     * Simple helper to re-run `updateData()` with the currently selected filters.
     */
    refresh_data = async () => {
        await this.update_data(this.where_sql, this.offset, this.limit);
    };

    /**
     * Run the given raw sql query and call `refresh()` to update the displayed rows.
     * @param sql The raw query string to run.
     * @param throwError Throws an error by default, set to `false` if you want a toast like other helpers.
     */
    raw_query = async (sql: string, {throwError = true, refresh = true} = {}) => {
        if (!this.connections.current || !this.current_table) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        this.is_loading = true;
        const data = await catchError(
            invoke<{rows: Record<string, string | null>[]; duration_ms: number}>("raw_query", {
                connectionString,
                sql,
            }),
        );
        this.is_loading = false;

        if (data instanceof Error) {
            console.error(data.message, sql);
            if (throwError) {
                throw data;
            }
            this.#toast_context.toast(`SQL error: ${data.message}`, {kind: "error", details: sql});
            return;
        }
        if (refresh) {
            this.is_loading = true;
            // FIXME: this is a bit wasteful to refresh data, it could be done through optimistic update directly
            await this.refresh_data();
            this.is_loading = false;
        }
        this.last_query_time = data.duration_ms;
        return data.rows;
    };

    /**
     * Get the primary key column of the currently selected table.
     */
    get_primary_key = () => {
        if (!this.current_table) {
            return;
        }
        const primary_key = this.current_table.columns.find((col) => col.is_primary_key === "YES");
        if (primary_key === undefined) {
            this.#toast_context.toast(`Cannot update row without primary key.`, {kind: "error"});
            return;
        }
        return primary_key;
    };

    delete_selection = async () => {
        const pk = this.get_primary_key();
        if (!pk || !this.current_table) {
            return;
        }
        const query = `delete from ${this.fullname}
where ${pk.column_name} = any(array[${this.selected_rows
            .map((index) => valueToSql(pk, this.current_table!.rows[index][pk.column_name]))
            .join(", ")}]);`;
        await this.raw_query(query);
        this.selected_rows = [];
        this.reset_filters();
    };

    truncate_table = async () => {
        await this.raw_query(`truncate ${this.fullname} restart identity cascade`, {throwError: false});
        this.reset_filters();
    };

    generate_update_row = async (row: PgRow) => {
        const pk = this.get_primary_key();
        if (!pk || !this.current_table) {
            console.warn(`Cannot update without primary key.`);
            return;
        }
        const editableColumns = (column: PgColumn) =>
            column.is_primary_key === "NO" &&
            column.data_type !== "tsvector" &&
            Object.keys(row).includes(column.column_name);
        return `UPDATE ${this.fullname} SET
${this.current_table.columns
    .filter(editableColumns)
    .map((col) => `${col.column_name} = ${valueToSql(col, row[col.column_name])}`)
    .join(",\n  ")}
WHERE ${pk.column_name} = ${valueToSql(pk, row[pk.column_name])};
                        `;
    };

    update_row = async (row: PgRow, {throwError = true} = {}) => {
        const query = await this.generate_update_row(row);
        if (!query) {
            return;
        }
        await this.raw_query(query, {throwError});
    };

    /**
     * Simple helper function to do an insert into or an update depending on whether there is a primary key or not.
     */
    upsert_row = async (row: PgRow, {throwError = true} = {}) => {
        if (!this.current_table) {
            return;
        }
        const primary_key = this.get_primary_key();
        if (!primary_key) {
            this.#toast_context.toast(`Can't update row without primary key`);
            return;
        }
        const editableColumns = (column: PgColumn) => column.is_primary_key === "NO" && column.data_type !== "tsvector";
        const primary_key_value = primary_key ? row[primary_key.column_name] : null;
        const query = primary_key_value
            ? // updae
              `update ${this.fullname}
set
  ${this.current_table.columns
      .filter(editableColumns)
      .map((col) => `${col.column_name} = ${valueToSql(col, row[col.column_name])}`)
      .join(",\n  ")}
where ${primary_key!.column_name} = ${valueToSql(primary_key!, primary_key_value)};`
            : // insert
              `insert into ${this.fullname}
(${this.current_table.columns
                  .filter(editableColumns)
                  .map(({column_name}) => column_name)
                  .join(", ")})
values
(${this.current_table.columns
                  .filter(editableColumns)
                  .map((col) => valueToSql(col, row[col.column_name]))
                  .join(", ")});`;

        return await this.raw_query(query, {throwError});
    };

    insert_row = async (row: PgRow, {throwError = true} = {}) => {
        if (!this.current_table) {
            return;
        }
        const editableColumns = (column: PgColumn) => column.is_primary_key === "NO" && column.data_type !== "tsvector";
        const query = `insert into ${this.fullname}
(${this.current_table.columns
            .filter(editableColumns)
            .map(({column_name}) => column_name)
            .join(", ")})
values
(${this.current_table.columns
            .filter(editableColumns)
            .map((col) => valueToSql(col, row[col.column_name]))
            .join(", ")});`;
        return await this.raw_query(query, {throwError});
    };
}
const key = Symbol("pgContext");

export const get_pg_context = () => getContext<PgContext>(key);
export const set_pg_context = () => setContext(key, new PgContext());
