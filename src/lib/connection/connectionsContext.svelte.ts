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
    currentId = $state<string>();

    /**
     * Load all saved connections from _connections.json_.
     */
    load = async () => {
        this.list = (await this.getFromStore<Connection[]>(connectionsKey)) ?? [];
        if (this.list.length) {
            this.currentId = this.list[0].id;
        }
    };

    /**
     * Select the connection with the given id. This is used to interact with the DB.
     * @param id connection id
     */
    use = async (id: string) => {
        if (!this.list.find((connection) => connection.id === id)) {
            throw new Error(`Connection ${id} not found`);
        }
        this.currentId = id;
        await this.setToStore(selectedIdKey, id);
        await this.saveToStore();
    };

    /**
     * Returns the currently selected connection. This is used to interact with the DB.
     */
    get current() {
        return this.list.find((connection) => connection.id === this.currentId);
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
            this.currentId = undefined;
        } else {
            this.use(this.list[0].id);
        }
    };

    /**
     * Try to create and save the connection string into the store.
     *
     * If there is an error, it will return it instead.
     */
    create = async (name: string, connectionString: string) => {
        const connection = {id: crypto.randomUUID(), name, connectionString};
        const errorMessage = await this.checkErrors(connection);
        if (errorMessage) {
            return errorMessage;
        }
        this.list.unshift(connection);
        await this.setToStore(connectionsKey, this.list);
        await this.saveToStore();
        this.use(connection.id);
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
        const errorMessage = await this.checkErrors({id, name, connectionString}, i);
        if (errorMessage) {
            return errorMessage;
        }
        this.list[i].name = name;
        this.list[i].connectionString = connectionString;
        await this.setToStore(connectionsKey, this.list);
        await this.saveToStore();
        this.use(this.list[i].id);
    };

    /**
     * Check all possible errors in the connection data.
     */
    private checkErrors = async ({name, connectionString}: Connection, index?: number) => {
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
        const [error, ok] = await catchError(invoke<boolean>("test_connection", {connectionString}));
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

const key = Symbol("connectionsContext");

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
