import {getConnectionsContext} from "$lib/connection/connectionsContext.svelte";
import {catchError} from "$lib/helpers/catchError";
import {debounced} from "$lib/helpers/debounced.svelte";
import {invoke} from "@tauri-apps/api/core";
import {getContext, setContext} from "svelte";

type PgTable = {
    schema: string;
    name: string;
    type: "BASE TABLE" | "VIEW";
};

type PgColumn = {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default?: string;
    is_primary_key: string;
    foreign_table_schema?: string;
    foreign_table_name?: string;
    foreign_column_name?: string;
};

type PgRow = Record<string, string | number | null>;

class TableContext {
    list = $state<PgTable[]>([]);
    current = $state<PgTable & {columns: PgColumn[]; rows: PgRow[]; count: number}>();

    filters = $state({
        offset: 0,
        limit: 100,
    });

    debouncedFilters = debounced(
        () => this.filters,
        async (data) => {
            this.updateData(data.offset, data.limit);
        },
        500
    );

    private connections = getConnectionsContext();

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
        await this.updateData(this.filters.offset, this.filters.limit);
    };

    updateData = async (offset: number, limit: number) => {
        if (!this.connections.current || !this.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const [dataError, data] = await catchError(
            invoke<{rows: PgRow[]; count: number}>("get_table_data", {
                connectionString,
                schema: this.current.schema,
                table: this.current.name,
                offset,
                limit,
            })
        );
        if (dataError) {
            throw dataError; // TODO: toast
        }
        this.current.rows = data.rows;
        this.current.count = data.count;
    };
}

const key = Symbol("tableContext");

export const getTableContext = () => getContext<TableContext>(key);
export const setTableContext = () => setContext(key, new TableContext());
