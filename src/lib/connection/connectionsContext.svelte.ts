import {catchError} from "$lib/helpers/catchError";
import {invoke} from "@tauri-apps/api/core";
import {load, type Store} from "@tauri-apps/plugin-store";
import {getContext, setContext} from "svelte";

export type Connection = {
    id: string;
    name: string;
    connectionString: string;
};

const storePath = "connections.json";
const connectionsKey = "connections";
const selectedIdKey = "selected_connection_id";

class ConnectionsContext {
    private store?: Store;

    list = $state<Connection[]>([]);
    selectedId = $state<string>();

    /**
     * Load all saved connections from _connections.json_.
     */
    load = async () => {
        this.list = (await this.getFromStore<Connection[]>(connectionsKey)) ?? [];
        if (this.list.length) {
            this.selectedId = this.list[0].id;
        }
    };

    /**
     * Set the connection with the given id to be currently used.
     * @param id connection id
     */
    select = async (id: string) => {
        if (!this.list.find((connection) => connection.id === id)) {
            throw new Error(`Connection ${id} not found`);
        }
        this.selectedId = id;
        await this.setToStore(selectedIdKey, id);
        await this.saveToStore();
    };

    get selected() {
        return this.list.find((connection) => connection.id === this.selectedId);
    }

    /**
     * Remove the connection with the given id from the store.
     * @param id connection id
     */
    remove = async (id: string) => {
        this.list = this.list.filter((connection) => connection.id !== id);
        await this.setToStore(connectionsKey, this.list);
        await this.saveToStore();
        if (this.list.length === 0) {
            this.selectedId = undefined;
        } else {
            this.select(this.list[0].id);
        }
    };

    create = async (name: string, connectionString: string) => {
        const connection = {id: crypto.randomUUID(), name, connectionString};
        const errorMessage = await this.checkErrors(connection);
        if (errorMessage) {
            return errorMessage;
        }
        this.list.unshift(connection);
        await this.setToStore(connectionsKey, this.list);
        await this.saveToStore();
        this.select(connection.id);
    };

    edit = async (id: string, name: string, connectionString: string) => {
        const i = this.list.findIndex((connection) => connection.id === id);
        if (i === -1) {
            return `Connection ${id} not found`;
        }
        const errorMessage = await this.checkErrors({id, name, connectionString});
        if (errorMessage) {
            return errorMessage;
        }
        this.list[i].name = name;
        this.list[i].connectionString = connectionString;
        await this.setToStore(connectionsKey, this.list);
        await this.saveToStore();
        this.select(this.list[i].id);
    };

    private checkErrors = async (connection: Connection) => {
        if (connection.name === "") {
            return "Name is required";
        }
        if (connection.connectionString === "") {
            return "Connection string is required";
        }
        const [error, ok] = await catchError(
            invoke<boolean>("test_connection", {connectionString: connection.connectionString})
        );
        if (error || !ok) {
            return "Connection string is invalid";
        }
    };

    /**
     * Returns the value for the given key or undefined if the key does not exist.
     */
    private getFromStore = async <T>(key: string) => {
        if (!this.store) {
            this.store = await load(storePath);
        }
        return this.store.get<T>(key);
    };

    /**
     * Inserts a key-value pair into the store.
     */
    private setToStore = async <T>(key: string, value: T) => {
        if (!this.store) {
            this.store = await load(storePath);
        }
        await this.store.set(key, value);
    };

    /**
     * Saves the store to disk at the store's path.
     */
    saveToStore = async () => {
        if (!this.store) {
            this.store = await load(storePath);
        }
        await this.store.save();
    };
}

const key = Symbol("connections");

/**
 * Persist postgres connection strings using tauri's store plugin.
 *
 * You must call `setConnectionsContext()` in a parent component to use it.
 * @returns the context
 */
export const getConnectionsContext = () => getContext<ConnectionsContext>(key);

/**
 * Persist postgres connection strings using tauri's store plugin.
 *
 * This must be called in order to use `getConnectionsContext()`.
 * @returns the context
 */
export const setConnectionsContext = () => setContext(key, new ConnectionsContext());
