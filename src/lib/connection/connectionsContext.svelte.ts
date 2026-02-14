import {catchError} from "$lib/helpers/catchError";
import {StoreContext} from "$lib/helpers/StoreContext";
import type {PgTable} from "$lib/table/pgContext.svelte";
import {invoke} from "@tauri-apps/api/core";
import {getContext, setContext} from "svelte";

export type Connection = {
    id: string;
    name: string;
    connectionString: string;
};

const storePath = "connections.json";

class ConnectionsContext extends StoreContext {
    list = $state<Connection[]>([]);
    current_id = $state<string>();

    /**
     * Load all saved connections from _connections.json_.
     */
    load = async () => {
        this.list = (await this.getFromStore<Connection[]>("connections")) ?? [];
        if (this.list.length) {
            const selectedId = await this.getFromStore<string>("selected_connection_id");
            this.current_id =
                selectedId && this.list.find((c) => c.id === selectedId) !== undefined ? selectedId : this.list[0].id;
        }
    };

    /**
     * Select the connection with the given id. This is used to interact with the DB.
     * @param id connection id
     */
    connect = async (id: string) => {
        if (!this.list.find((connection) => connection.id === id)) {
            throw new Error(`Connection ${id} not found`);
        }
        this.current_id = id;
        await this.setToStore("selected_connection_id", id);
        await this.saveToStore();
    };

    /**
     * Get the lastly selected table to restore it when the app starts.
     */
    get_selected_table = async () => {
        return this.getFromStore<string>("selected_table");
    };

    /**
     * Save the given table to the store so it can be used when the app restarts
     * @param table
     */
    save_selected_table = (table: PgTable | undefined) => {
        this.setToStore("selected_table", table === undefined ? undefined : `${table.schema}.${table.name}`);
        this.saveToStore();
    };

    /**
     * Returns the currently selected connection. This is used to interact with the DB.
     */
    get current() {
        return this.list.find((connection) => connection.id === this.current_id);
    }

    /**
     * Remove the connection with the given id from the store.
     * @param id connection id
     */
    remove = async (id: string) => {
        this.list = this.list.filter((connection) => connection.id !== id);
        await this.setToStore("connections", this.list);
        await this.saveToStore();
        if (this.list.length === 0) {
            this.current_id = undefined;
        } else {
            this.connect(this.list[0].id);
        }
    };

    /**
     * Try to create and save the connection string into the store.
     *
     * If there is an error, it will return it instead.
     */
    create = async (name: string, connectionString: string) => {
        const connection = {id: crypto.randomUUID(), name, connectionString};
        const errorMessage = await this.#check_errors(connection);
        if (errorMessage) {
            return errorMessage;
        }
        this.list.unshift(connection);
        await this.setToStore("connections", this.list);
        await this.saveToStore();
        this.connect(connection.id);
    };

    /**
     * Try to edit and save the connection string into the store.
     *
     * If there is an error, it will return it instead.
     */
    edit = async (id: string, name: string, connectionString: string) => {
        const i = this.list.findIndex((connection) => connection.id === id);
        if (i === -1) {
            return `Connection ${id} not found`;
        }
        const errorMessage = await this.#check_errors({id, name, connectionString}, i);
        if (errorMessage) {
            return errorMessage;
        }
        this.list[i].name = name;
        this.list[i].connectionString = connectionString;
        await this.setToStore("connections", this.list);
        await this.saveToStore();
        this.connect(this.list[i].id);
    };

    /**
     * Check all possible errors in the connection data.
     */
    #check_errors = async ({name, connectionString}: Connection, index?: number) => {
        if (name === "") {
            return "Name is required";
        }
        if (
            this.list.find((connection) => connection.name === name) &&
            (index === undefined || name !== this.list[index].name)
        ) {
            return "Name is already taken";
        }
        if (connectionString === "") {
            return "Connection string is required";
        }
        const ok = await catchError(invoke<boolean>("test_connection", {connectionString}));
        if (ok instanceof Error || !ok) {
            return "Connection string is invalid";
        }
    };
}

const key = Symbol("connectionsContext");

/**
 * Persist postgres connection strings using tauri's store plugin.
 *
 * You must call `setConnectionsContext()` in a parent component to use it.
 * @returns the context
 */
export const get_connections_context = () => getContext<ConnectionsContext>(key);

/**
 * Persist postgres connection strings using tauri's store plugin.
 *
 * This must be called in order to use `getConnectionsContext()`.
 * @returns the context
 */
export const set_connections_context = () => setContext(key, new ConnectionsContext(storePath));
