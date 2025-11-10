import {getConnectionsContext} from "$lib/connection/connectionsContext.svelte";
import {catchError} from "$lib/helpers/catchError";
import {invoke} from "@tauri-apps/api/core";
import {getContext, setContext} from "svelte";

type TableInfo = {
    schema: string;
    name: string;
    type: "BASE TABLE" | "VIEW";
};

type ColumnInfo = {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default?: string;
    is_primary_key: string;
    foreign_table_schema?: string;
    foreign_table_name?: string;
    foreign_column_name?: string;
};

type RowInfo = Record<string, string | number | null>;

class TableContext {
    list = $state<TableInfo[]>([]);
    current = $state<TableInfo & {columns: ColumnInfo[]; rows: RowInfo[]}>();

    private connections = getConnectionsContext();

    loadTables = async () => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const [tableError, unsortedTables] = await catchError(invoke<TableInfo[]>("list_tables", {connectionString}));
        if (tableError) {
            throw tableError; // TODO: toast
        }
        this.list = unsortedTables.toSorted((table) => (table.schema === "public" ? -1 : 1));
        if (this.list[0]) {
            this.use(this.list[0]);
        }
    };

    use = async (table: TableInfo) => {
        if (!this.connections.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        const [columnsError, columns] = await catchError(
            invoke<ColumnInfo[]>("list_table_columns", {
                connectionString,
                schema: table.schema,
                table: table.name,
            })
        );
        if (columnsError) {
            throw columnsError; // TODO: toast
        }
        const rows = await this.listRows();
        this.current = {...table, columns, rows: rows ?? []};
    };

    listRows = async () => {
        if (!this.connections.current || !this.current) {
            return;
        }
        const connectionString = this.connections.current.connectionString;
        console.log("IN");
        const [rowsError, rows] = await catchError(
            invoke<RowInfo[]>("list_table_columns", {
                connectionString,
                schema: this.current.schema,
                table: this.current.name,
                offset: 0,
                limit: 100,
            })
        );
        if (rowsError) {
            throw rowsError; // TODO: toast
        }
        return rows;
    };
}

const key = Symbol("tableContext");

export const getTableContext = () => getContext<TableContext>(key);
export const setTableContext = () => setContext(key, new TableContext());
